---
title: "Handling Deep Transform Hierarchies"
description:
date: 2026-02-07
tags: ["C++"]
categories: ["Engine Development"]
image: cover.png
math:
license:
comments: true
draft:
build:
  list: always
---

`Transform` component of an entity in a game scene encodes where that entity is in the scene, how it's oriented, what is its relation to other entities, and so on. It's a crucial component in game engines, and must be attached to most (or all) entities since multiple systems may require it to carry out their tasks. In my game engine, and many others, its definition more or less looks like this:

```cpp
struct Transform final : public Component {
  glm::vec3 position{};
  glm::quat rotation{};
  glm::vec3 scale{1.0f};
  EntityID parent{EntityID::Invalid};
  glm::mat4 local{1.0f};
  glm::mat4 world{1.0f};
  bool dirty{true};
  // ...
};
```

Initially, it only consisted of `position`, `rotation`, `scale`, and a `parent` pointer. Yes, a pointer, a raw one. For context, the components are stored in contiguous arrays (`std::vector`) for cache-friendly iterations, and to preserve this contiguity, the array reallocates when its size reaches its capacity, which usually results in doubled capacity. So, when reallocation happens, all existing elements are moved/copied to the newly allocated memory block, which invalidates all iterators/pointers/references to the old addresses. I knew reallocation would happen at some point, but didn't really pay attention to it when declaring the parent as a pointer. Only after an exception, and a lengthy debugging session, I realized my mistake. A safe alternative would be to store an index into the array, as it's an offset from the pointer to the first element (at index 0). However, in practice, entities are referred to by an `EntityID`; so, a more ergonomic solution is to maintain a map between entity IDs and component indices, and go through this indirection layer when accessing components.

The values stored in a `Transform` component are usually with respect to the parent of that entity, i.e., they are defined in the parent's coordinate frame. Here, the `local` transform encodes an entity's relation to its parent, and can be calculated from the `position`, `rotation` and `scale` values. The `world` transform is with respect to a larger world, and it can be obtained by multiplying the `local` transform matrix with the parent's `world` matrix. The multiplication order matters though; for column-major representations (like GLM's), the `local` matrix appears on the right (`parent->world * local`). As I briefly mentioned in [an earlier post]({{< relref "post/a-summary-of-learnopengl/index.md#common-transformations" >}}), keeping both matrices make it easier to work with and reason about transforms.

> For entities with no parents (root entities), the `world` transform is equal to the `local` transform.

When I first enabled runtime `Transform` updates via gizmos or through the "Properties" window of the editor, and examined the [hot path](https://learn.microsoft.com/en-us/visualstudio/profiling/flame-graph) in Visual Studio, I noticed that the `Transform` updates were consuming a lot of CPU cycles. At this point, entire transform hierarchies were being traversed upwards through recursive function calls to recompute transform matrices of the parents first before moving on to the child entities. This was done every frame, whether or not the transforms were modified. An obvious improvement to this design is to do recomputations only after a transform or one of its parent transforms has been modified.

To notify systems of component modifications, there are two main options: events and flags (or counters). The first option is to emit an event, and let event subscribers (systems) know about the change. This can be desired if immediate attention is needed, but the order in which systems respond to changes should be managed carefully. Moreover, such an event system adds significant overhead due to the sheer number of dispatch calls when the number of emitters and/or subscribers increase beyond a certain point. They can be queued and executed in batches to minimize this overhead, but this makes the implementation even more complex.

The other alternative is to mark the modified components with something like a `dirty` flag and let the systems lazily process them. Here, the word "lazily" means that recomputations happen not immediately but when the updated values are needed. For example, the rendering system needs to know the most up-to-date transforms of entities in view, hence may trigger checks to determine if updates are needed every frame. The system that is responsible for updating the transforms, simply iterates over them and recomputes only the ones marked "dirty" (`dirty = true`). However, it's not that simple; when a parent is marked dirty, it must be propagated to its children, because their world transform changes with the parent's. As a result, for every transform, the parents must be visited recursively, propagating the flag on return. This could also be done in reverse by storing child indices/IDs in each `Transform`, which would be more efficient for wide hierarchies rather than deep ones. Either way, this is still simpler and faster (more cache-friendly) than the event-driven alternative, and it can be made even better.

Before moving on to the improved version, let me talk about the choice of a boolean flag here. In its current state, my game engine has one system that consumes (reads) the `Transform` components, and the only way to update the transforms is through the editor. Since there is one producer and one consumer, a two-state value (`bool`) is enough to communicate the changes — editor marks the modified components "dirty", the rendering system clears the flags after updating them. Once multiple systems get involved, each writing to or reading from the transforms array, something more structured is needed. It could be as simple as a counter, which is incremented by each system that writes to the components. The systems that read these values can cache the last version number they saw. When they access the components later, they compare the version with the cached value to determine if they have been modified.

Now, let's see how we can improve the `dirty` flag propagation. The problem we currently have is potentially deep, recursive parent traversals. The root cause of this problem is the fact that components are stored in an `std::vector` in the order they were added, with no concern for parent-child relationships. What we want is to be able to iterate over this array and update the `Transform` components in a single pass, with minimal indirections, for maximum performance. Since a child transform depends on the parent's, it would be nice if the parent transform was already computed before the iterator arrived at any one of its children. The solution is obvious: keep the transforms sorted such that a parent always comes before its children. While iterating over this sorted array, we perform the following tasks for each `Transform`:

- If parent is **dirty**, mark this transform as **dirty** (if not already)
- If this is marked **dirty**, recompute `local` and `world` matrices
- If no parent, assign `local` to `world` (`world = local`)

Notice that we no longer need to go beyond the immediate parent to confirm if transform matrices need to be recomputed, this information is already available since we now iterate in the "right" order. We still need to visit every element in the array though, but this is very efficient, even for a large number of entities, since they are stored contiguously. This could be improved even more by storing `dirty` flags in batches (e.g., in an `std::bitset`) and performing fewer checks, potentially skipping many entities (~64) at once if most entities are clean most frames. For now, I'm satisfied with the current implementation and its performance. The following are the `Update` methods that perform `Transform` updates per scene and per entity, respectively.

```cpp
template <>
inline auto ComponentManager<Transform>::Update() -> void {
  const auto count = ActiveCount();
  for (auto i = 0; i < count; ++i) {
    auto& transform = components[i];
    const auto& parentId = transform.parent;
    Transform* parentTransform = nullptr;
    if (auto it = entityToComponent.find(parentId); it != entityToComponent.end())
      parentTransform = &components[it->second];
    transform.dirty |= parentTransform && parentTransform->dirty;
    if (transform.dirty)
      transform.Update(parentTransform);
  }
  for (auto& c : components)
    c.dirty = false;
}

auto Transform::Update(const Transform* parent) -> void {
  const auto I = glm::mat4(1.f);
  const auto T = glm::translate(I, position);
  const auto R = glm::toMat4(rotation);
  const auto S = glm::scale(I, scale);
  local = T * R * S;
  if (parent)
    world = parent->world * local;
  else
    world = local;
}
```
