---
title: "Making a Game Engine"
description:
date: 2025-05-30
tags: ["C++"]
categories: ["Engine Development"]
image:
math:
license:
comments: true
draft:
build:
  list: always
---

I'm writing this to reflect on my progress so far in making my own game engine, [Kuki](https://github.com/msagca/kuki), that is named after my eldest cat. My journey began by following the tutorials at [learnopengl.com](https://learnopengl.com) to learn graphics programming. After some time, I realized that I was just copy-pasting code and running it locally. This is often the case with tutorials — without a clear goal, it's easy to lose focus and interest. So, I wanted to do something meaningful with the stuff I was learning. The choice was obvious: creating a game engine.

The first thing I needed to do was to decide on an architecture. Luckily, there aren't many options when it comes to game engine architecture. The most well-known model is the _Game Object–Component_ model, in which data and behavior are tightly coupled. Alternatively, there is the _Entity‑Component‑System (ECS)_ model, which emphasizes separating data from behavior. In ECS, component data is stored in contiguous memory arrays and systems can efficiently process many components in a cache-friendly manner. ECS is easy to scale and suitable for performance critical applications. There is a shift toward ECS in modern game engines, and there are a lot of open source examples. I found the ECS architecture easy to understand and more straightforward to implement because of the clear separation between data and control paths. So, ECS was the way to go.

I had very little knowledge of C++ when I started the OpenGL tutorials. Even though I had a couple of years' experience with C#—a language syntactically similar to C++—I struggled in the beginning because of the differences in memory management. When I designed a `Transform` component, I included a raw pointer to the parent. When it came to resolving world-space positions of the entities in the scene, I had invalid memory access exceptions. I knew that `std::vector`, which was the underlying data structure for storing components of the same type, would reallocate when new elements were added to it in order to preserve the contiguous nature of the storage. However, I didn't account for this behavior until it resulted in an error. I had to switch to using parent entity IDs instead of raw pointers to resolve the issue. I avoided using smart pointers because they added overhead, disrupted cache efficiency, and, more importantly, were unnecessary for my design.

Since my main focus was the visual aspects of the engine, I wanted to define the components and systems that are directly related to rendering first. In Unity, three main components impact how an object is rendered: `Transform`, `MeshFilter`, and `MeshRenderer`. These components define where, what and how to render, respectively. `MeshFilter` is a wrapper around the `Mesh` component which stores OpenGL buffer IDs that define a mesh, and contains some metadata. `MeshRenderer` comprises shader and texture IDs, color values, and properties such as roughness or metalness that the shader may require. Components are all simple structs with fixed sizes for efficient storage. I have defined a generic class named `ComponentManager<T>` to manage component addition, removal, etc. This class stores component instances in a dynamic array and keeps mappings between entity IDs and array indices for efficient look-ups.

In most ECS implementations, entities are simply IDs, and there can be additional metadata such as names or tags associated with those IDs. In my game engine, I have a class called `EntityManager` to manage entity creation, deletion, renaming, etc. This class creates `ComponentManager<T>` instances on demand when methods like `AddComponent<T>` are called for a valid entity. Operations associated with a component type is passed to the corresponding manager instance. To store the `ComponentManager<T>*` instances, I use `std::type_index` as the key.

```cpp
template <typename T>
ComponentManager<T>* EntityManager::GetManager() {
  static_assert(std::is_base_of<IComponent, T>::value, "T must inherit from IComponent.");
  auto type = std::type_index(typeid(T));
  auto it = typeToManager.find(type);
  if (it == typeToManager.end()) {
    typeToManager.emplace(type, new ComponentManager<T>());
    nameToType.emplace(ComponentTraits<T>::GetName(), type);
    idToType.emplace(ComponentTraits<T>::GetId(), type);
    typeToMask.emplace(type, ComponentTraits<T>::GetMask());
  }
  return static_cast<ComponentManager<T>*>(typeToManager[type]);
}
```

`EntityManager` keeps a counter of type `unsigned int` to assign an ID to the next entity. At the moment, I'm not concerned about the limits or reuse of these values. I also keep a map between IDs and entity names. To prevent duplicates, I've implemented a `Trie` data structure to keep track of the names. A reference to an std::string must be passed to the `Create` method for each new entity. If the name already exists, a numeric suffix is appended to the requested name. This `Trie` is updated after entity deletion or rename operations to enable name reuse.

In addition to these, `EntityManager` defines methods that facilitate iterating over entities. These helper methods take in a function pointer and execute it on entities that satisfy some specified constraints. One such method, shown below, checks whether an entity possesses the required components and, if so, calls the specified function.

```cpp
template <typename... T, typename F>
void EntityManager::ForEach(F func) {
  for (const auto id : ids)
    if (HasComponents<T...>(id)) {
      auto components = GetComponents<T...>(id);
      std::apply([&](T*... args) { func(id, args...); }, components);
    }
}
```

Entities usually live in a scene; therefore, each scene in my engine has its own `EntityManager` instance. I also defined a method in my `Scene` class that returns a pointer to the active `Camera` component (in case the scene contains more than one). Most games require multiple scenes and the ability to switch between them, which I implemented in my `SceneManager` class. Together with the `InputManager` and other systems, these components form an `Application` that serves as the base for any program utilizing my engine's functionality.

The first application that I built by extending this `Application` class was obviously an editor. When working with an engine, you quickly realize that even a simple change such as moving an entity requires you to re-compile the entire application. An editor provides an interface to manipulate object properties at runtime. Like most open source engines, I decided to use [Dear ImGui](https://www.dearimgui.com) to create a UI for my editor. It's an immediate mode GUI implementation that is quite easy to use. However, I still didn't want to deal with the UI code, so I let AI generate it. And, as long as it can be maintained and updated by AI, I don't need to know the details of the implementation. Even though I had to manually edit the UI code a few times, AI is doing a fantastic job today.

To display and manipulate component properties in the UI, I needed to define an interface called `IComponent` that every component struct had to extend. This interface lets the editor retrieve an array of `Property` instances and set new values as the values are edited through the UI. The PropertyType informs the UI how to display that particular property (e.g., as a color wheel).

```cpp
struct KUKI_ENGINE_API Property {
  using PropertyValue = std::variant<int, float, bool, glm::vec3, glm::vec4...>; // some types are omitted
  std::string name{};
  PropertyValue value{};
  PropertyType type{PropertyType::Number};
  Property(const std::string& = "", const PropertyValue& = 0, PropertyType = PropertyType::Number);
};

struct IComponent {
  virtual ~IComponent() = default;
  virtual const std::string GetName() const = 0;
  virtual std::vector<Property> GetProperties() const = 0;
  virtual void SetProperty(Property) = 0;
};
```

The `KUKI_ENGINE_API` is a macro that is needed to export symbols when the engine is built as a shared library. I initially made the engine a shared library, then later turned everything static so that only an executable file is created. When working with shared libraries, I had to deal with some issues. One of them was the scope of globals in these libraries. For context, I'm using [CMake](https://cmake.org) as the build tool. The engine is a target linked against statically built C libraries such as GLFW and [GLAD](https://gen.glad.sh), while the editor is another target linked against the engine's shared library. When the editor program is executed, it becomes a process, and all the required shared libraries (DLLs on Windows) are loaded into the process memory. A library like GLAD defines many functions in its global scope. You may think that these globals are shared between the engine and the editor, but that's not the case. When the `Application` class (in the engine library) initializes an OpenGL context in its `Init` method, the editor's ImGui initialization code later attempts to access OpenGL functions but finds a different copy of the globals, resulting in an error because no valid context exists. The solution I found was to also build GLAD and GLFW as shared libraries, which guarantees that there is exactly one copy of their globals in the memory. I don't know how this would work out in a multi-threaded scenario though.

The first system I defined was the `RenderingSystem`. Initially, I was using the default framebuffer for rendering since that's how it's done in the tutorial. But, when I created the editor, I needed to display the scene within an ImGui window. So, I created a custom framebuffer, which also enabled me to apply post-processing in a separate pass. My `Shader` class looks more or less like the one in the tutorial. The `LitShader` class that extends the `Shader` class, defines additional methods to set material and light properties. Moreover, I implemented instanced rendering by automatically grouping objects by shared meshes to reduce draw calls. For now, I'm using OpenGL buffer IDs to determine if a mesh is referenced by multiple entities in the scene; however, more advanced methods are needed to determine if two meshes with different IDs are nearly identical. Although I allow per-instance properties such as colors, I do not account for texture variations; if two copies of the same mesh reference different textures, the last one processed will determine which texture is used. This means I might need to issue a new draw call for each variation.

```cpp
void RenderingSystem::DrawScene() {
  std::unordered_map<unsigned int, std::vector<unsigned int>> vaoToEntities;
  std::unordered_map<unsigned int, Mesh> vaoToMesh;
  app.ForEachEntity<MeshFilter>([this, &vaoToMesh, &vaoToEntities](unsigned int id, MeshFilter* filter) {
    auto vao = filter->mesh.vertexArray;
    vaoToMesh[vao] = filter->mesh;
    vaoToEntities[vao].push_back(id);
  });
  for (const auto& [vao, entities] : vaoToEntities)
    DrawEntitiesInstanced(&vaoToMesh[vao], entities);
}
```

An important part of a game engine is the ability to work with assets, because basic shapes and colors quickly become monotonous. However, I needed specialized classes to load and store assets. For the storage part, I noticed that the task was quite similar to managing entities and their components. An asset needed to be easily convertible to an entity once it was loaded into a scene. So, an `AssetManager` would simply be an instance of `EntityManager`, and instantiating an asset would mean copying its components from one manager to another. For the loading part, I struggled a bit while trying to load models using [Assimp](https://assimp.org). First, I was unable to load model textures from FBX models. When I switched to using [glTF](https://www.khronos.org/gltf) I was able to load the textures. Second, the loaded model parts had incorrect rotations because I converted quaternion values to Euler angles before storing them in the `Transform` component. Since Euler angles are susceptible to gimbal lock, switching the storage to quaternions resolved the issue. Finally, load operations were stalling the main thread, and I resolved this by asynchronously loading the textures. However, OpenGL buffers must be created on the main thread, as the OpenGL context is only valid there.

The tutorial begins with the Blinn-Phong model and then introduces the [PBR](https://learnopengl.com/PBR/Theor) pipeline. Transitioning to PBR, however, was challenging. I had to load an environment map, generate both an irradiance map and a prefilter map, and implement instanced rendering. Achieving correct functionality required significant effort—including extensive debugging with [RenderDoc](https://renderdoc.org)—but ultimately, the results were stunning.

Features that are not yet fully functional include frustum culling and a scripting system. I'm also dissatisfied with the frame rates in simple scenes. CPU profiling in Visual Studio revealed significant performance improvements when I added dirty flags to `Transform` components. This change ensured that the entity hierarchy is traversed only when a change necessitates recalculating the world transform. Nonetheless, there is still room for improvement, and I am actively working on further enhancements.
