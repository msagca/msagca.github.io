---
layout: post
title: Adding Frustum Culling to My Engine
---

Even though not every object in a 3D scene appears on the screen, their data is still sent to the GPU for processing, only to be discarded later in the rendering pipeline. This increases the number of draw calls needed to render the scene, which adds extra latency and processing costs. However, we could just pick the objects that lie inside the viewing volume of the camera and send only the data associated with this subset of entities to the GPU. This is what **Frustum Culling** does, and it can dramatically improve the performance in many applications.

> The name is somewhat of a misnomer as this technique can be applied to orthographic cameras as well.

Frustum culling operates by iterating over a list of objects (entities) in the active scene and checking if any part of them lies in the viewing volume. The method or metric that is used to determine if an object is considered inside the frustum may be different between implementations. A view frustum is defined by its planes, and an object can be represented by a bounding box since the original shape may be too complex for efficiently performing the tests. Let's see first what a bounding box is and how to obtain one for a given mesh.

## Bounding Box

A bounding box is a 3D volume that contains all the vertices of a mesh. Ideally, it should tightly contain the mesh so it could be accurately determined if the object intersects the frustum. An axis aligned bounding box (AABB), where each face is parallel to either one of the _xz_, _xy_ or _yz_ plane, is good enough in many cases. Though, there could be cases such as a model of the [Leaning Tower of Pisa](https://en.wikipedia.org/wiki/Leaning_Tower_of_Pisa) that might require special handling. In my AABB implementation, I use two points that are the corners with the minimum and maximum coordinate values. These points are given in model space and are valid for the original scale.

> In the following code, the definitions should either be marked `inline` or put in a separate (source) file to prevent multiple definition errors.

```cpp
struct BoundingBox {
  glm::vec3 min{};
  glm::vec3 max{};
  BoundingBox();
  BoundingBox(glm::vec3, glm::vec3);
  BoundingBox GetWorldBounds(glm::mat4);
};
BoundingBox::BoundingBox()
  : min(glm::vec3(std::numeric_limits<float>::max())), max(glm::vec3(std::numeric_limits<float>::lowest())) {}
BoundingBox::BoundingBox(glm::vec3 min, glm::vec3 max) {
  if (glm::any(glm::lessThan(max, min)))
    throw std::invalid_argument("Max bounds must be greater than or equal to min bounds.");
  this->min = min;
  this->max = max;
}
```

For a given set of vertices that defines a mesh, an AABB can be calculated by iterating over each vertex and updating the `min` and `max` points through comparisons.

> `glm::min` and `glm::max` operate on each component independently.

```cpp
void AssetLoader::CalculateBounds(Mesh& mesh, const std::vector<Vertex>& vertices) {
  mesh.bounds.min = glm::vec3(std::numeric_limits<float>::max());
  mesh.bounds.max = glm::vec3(std::numeric_limits<float>::lowest());
  for (const auto& vertex : vertices) {
    mesh.bounds.min = glm::min(mesh.bounds.min, vertex.position);
    mesh.bounds.max = glm::max(mesh.bounds.max, vertex.position);
  }
}
```

Since we need to check for intersections with the camera frustum, we need to bring the local bounds to the world space. The following method accepts a world transform and calculates a new bounding box that contains the transformed points. Notice that we apply the transformation to each of the 8 corners of the box and take all into consideration. The reason is that the original extremes might get replaced by other corners after transformations like rotation or non-uniform scale.

```cpp
BoundingBox BoundingBox::GetWorldBounds(const glm::mat4& transform) {
  glm::vec3 corners[8] = {
    {min.x, min.y, min.z},
    {max.x, min.y, min.z},
    {min.x, max.y, min.z},
    {max.x, max.y, min.z},
    {min.x, min.y, max.z},
    {max.x, min.y, max.z},
    {min.x, max.y, max.z},
    {max.x, max.y, max.z}};
  BoundingBox bounds{};
  for (const auto& v : corners) {
    auto v4 = transform * glm::vec4(v, 1.0f);
    auto v3 = glm::vec3(v4);
    bounds.min = glm::min(bounds.min, v3);
    bounds.max = glm::max(bounds.max, v3);
  }
  return bounds;
}
```

## Frustum

Recall that a frustum is defined by six planes: near, far, top, bottom, left and right. The `Frustum` type is simply a container for these planes.

```cpp
struct Frustum {
  Plane top{};
  Plane bottom{};
  Plane right{};
  Plane left{};
  Plane far{};
  Plane near{};
  bool InFrustum(const BoundingBox&) const;
};
```

A plane can be defined in a few different ways. I chose to define it by a point and a normal direction such that the point is on the plane and any vector on the plane is perpendicular to the normal.

```cpp
struct Plane {
  glm::vec3 point{};
  glm::vec3 normal{};
  bool OnPositiveSide(const BoundingBox&) const;
  float SignedDistance(const glm::vec3&) const;
};
```

> For a clean and clear implementation, normal directions of a frustum's planes must be consistent such that they all point inwards.

We can create a vector from a point on the plane to an arbitrary point in space, and calculate its dot product with the plane normal to obtain a number. If this number is positive, then we can conclude that the vector makes less than $90^\circ$ angle with the normal, and the point is on the positive side of the plane.

```cpp
float Plane::SignedDistance(const glm::vec3& point) const {
  return glm::dot(normal, point - this->point);
}
```

For a box to be considered on the positive side of a plane, any portion of it must lie on the positive side. However, we don't need to test every corner, we're only interested in the one that is most likely to pass the test. This is the corner that is most aligned with the plane normal (i.e., that would result in the most positive dot product). If correctly calculated, the `max` coordinates of a bounding box must be greater than the `min` coordinates — `max.x` is greater than `min.x` and so on. To find the corner farthest in the normal’s direction, check the sign of each normal component and choose the box’s min or max value on that axis accordingly — always taking the value that lies farther along the normal. It doesn't matter if it has the same sign as the normal component or not — if `normal.x` is positive and both `bounds.min` and `bounds.max` are in the negative x-axis, then `bounds.max` is the more positive (less negative) of the two in the normal direction. After determining which one of the eight points is the best candidate, we calculate its signed distance from the plane to see if it's on the positive side.

```cpp
bool Plane::OnPositiveSide(const BoundingBox& bounds) const {
  glm::vec3 positiveCorner;
  positiveCorner.x = (normal.x >= 0) ? bounds.max.x : bounds.min.x;
  positiveCorner.y = (normal.y >= 0) ? bounds.max.y : bounds.min.y;
  positiveCorner.z = (normal.z >= 0) ? bounds.max.z : bounds.min.z;
  return SignedDistance(positiveCorner) >= 0;
}
```

Being on the positive side of one plane is not enough for a point to be considered inside the frustum. For example, if a point has a large _z_ coordinate, it may be on the positive side of the near plane, but it might end up in the negative side of the far plane, whose normal is towards the origin. It's clear that a point must be on the positive side of each plane to be in the camera's view volume. Hence, the `InFrustum` method will return `false` if any one of those 6 checks fails.

```cpp
bool Frustum::InFrustum(const BoundingBox& bounds) const {
  const Plane planes[6] = {near, far, right, left, top, bottom};
  for (const auto& plane : planes)
    if (!plane.OnPositiveSide(bounds))
      return false;
  return true;
}
```

The implementation is then straightforward: get a reference to the active `Camera` object and call `InFrustum` for each entity that has a `MeshFilter` (container for `Mesh`) component, then initiate draw calls for the ones that pass the test. There are obviously ways to optimize this process. Instead of individual draw calls, we could group entities that share the same mesh and material settings, and do instanced rendering. I won't get into that in this post, but I would like to talk about another technique that could significantly reduce the number of tests performed.

## Spatial Partitioning

If a scene contains _n_ entities, we have to perform _n_ tests to obtain a set of visible entities. This has $O(n)$ time complexity, but we could do better. If you have ever attempted to solve a [LeetCode](https://leetcode.com/) problem and your $O(n)$ solution timed out for a large input, then you know that the next best thing you can do is $O(\log{n})$. To achieve that, we have to employ a divide-and-conquer technique. Currently, we have _n_ (invisible) bounding boxes in the scene, each containing an entire object. What if these boxes too were contained inside bigger boxes, and those inside even bigger ones, stacked like [Matryoshka dolls](https://en.wikipedia.org/wiki/Matryoshka_doll), up to a single huge box that contains the entire scene?

An [octree](https://www.open3d.org/docs/release/tutorial/geometry/octree.html) is a data structure where each node has exactly eight children. It can be used to partition 3D space such that each axis is split in half at the origin to create eight subdivisions (octants). Each node can be further (recursively) subdivided as needed. In practice, we work with a bounded volume that is large enough to contain the entire scene or the part we're interested in.

Initially, every object is inside the root node that is a cubic volume centered around the origin. A node stores a list of items (entities) whose bounding boxes either intersect or are fully contained by the node's volume, which is a bigger box. If the number of items in a node exceeds a certain limit, the node subdivides and distributes its items to its children. This can be implemented in various ways; for example, if no child fully contains the item it remains associated with the parent. If items are being removed, the opposite happens, that is, the child nodes collapse (merge) by giving their items back to their parent node. But, how does this help with frustum culling?

> The upper limit for subdivision should be set proportional to the node volume — child nodes shall have lower limits, e.g., 1/8 of those of the parent node.

Without partitioning, we have to check every bounding box for intersection with the frustum to determine the objects to be culled. However, after just one subdivision, we put those objects into 8 separate boxes (9 including the root node). If any one of these big boxes does not intersect with the camera, then this means that the objects inside it are out of the view, and there is no need to individually test them. With deeper hierarchies, and optimal limits, the search space can be reduced even further.

The following is a demonstration of frustum culling applied to a scene represented by an octree.

<div class="youtube-video">
  <iframe src="https://www.youtube.com/embed/QO2msArorrg" allowfullscreen></iframe>
</div>
