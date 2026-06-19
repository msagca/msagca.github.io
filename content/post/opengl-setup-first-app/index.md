---
title: "OpenGL Setup and First Application"
description:
date: 2025-08-27
tags: ["C++", "OpenGL"]
categories: ["Computer Graphics"]
image:
license:
comments: true
draft:
build:
  list: always
---

This is the first post of a series summarizing the lectures on <https://learnopengl.com> with some additions of my own.

## OpenGL

[OpenGL](https://www.opengl.org) is a cross-platform API for rendering graphics, maintained by the [Khronos Group](https://www.khronos.org). It is a specification that must be implemented by GPU vendors (or third parties) and made available through graphics driver software.

If you're building your project with [CMake](https://cmake.org) and want to use OpenGL in your C++ application, your **CMakeLists.txt** should include the following commands:

```cmake
find_package(OpenGL REQUIRED)
target_link_libraries("${PROJECT_NAME}" PUBLIC OpenGL::GL)
```

## GLFW

A graphics application requires a window to draw to, but creating a window is OS-specific. [GLFW](https://www.glfw.org) is a cross-platform library that abstracts away the details and provides a simple API for creating native windows (and more).

The GLFW source code can be included in a [Git](https://git-scm.com) repository as a submodule.

```bash
git submodule add https://github.com/glfw/glfw /external/glfw
```

Then, it can be included in the build via `add_subdirectory`, since it contains a CMakeLists.txt that defines how it should be built.

```cmake
add_subdirectory("${CMAKE_CURRENT_SOURCE_DIR}/external/glfw")
target_link_libraries("${PROJECT_NAME}" PUBLIC glfw)
```

## GLAD

Due to the differences between implementations and platforms, OpenGL function addresses aren't known at compile time. As a result, they need to be queried at runtime using platform-specific mechanisms. That's why there are libraries like [GLAD](https://github.com/Dav1dde/glad), which dynamically loads the function pointers.

To generate a GLAD loader:

- Go to <https://glad.dav1d.de>
- Select a GL API version (3.3+ is recommended)
- Select the **Core** profile
- Enable **Generate a loader** option
- Click the **Generate** button

> You can also enable some OpenGL extensions that add new capabilities or optimizations, but they are not guaranteed to be supported by the graphics driver.

Download the generated zip file and extract it into `external/glad`. To keep things clean, we can define a static library called `glad` and associate the source and header files with it. Then, it can be added to the build just like we did with GLFW.

```cmake
add_library(glad STATIC "${CMAKE_CURRENT_SOURCE_DIR}/external/glad/src/glad.c")
target_include_directories(glad PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/external/glad/include")
target_link_libraries(glad PUBLIC OpenGL::GL)
target_link_libraries("${PROJECT_NAME}" PUBLIC glad)
```

## OpenGL Context

OpenGL is basically a **state machine**, and all rendering commands are executed based on the current state. An [OpenGL context](https://www.khronos.org/opengl/wiki/OpenGL_Context) is a container that stores this state information, and GLFW will be responsible for creating one for us (during window creation). We have to set the current context, via `glfwMakeContextCurrent`; otherwise, GLAD won't be able to resolve function pointers.

> Only one context can be current on a thread at a time, and a context cannot be current on multiple threads at the same time.

For example, calling `glClearColor(r,g,b,a)` will update the state, and all subsequent `glClear` calls will use the specified color until another `glClearColor` call with a different set of arguments is made.

## How does GLAD load OpenGL functions?

When a program that links to some shared library is launched, the operating system maps that library's segments (e.g., text and data) into this process's virtual address space. In our case, an OpenGL stub library (e.g., `opengl32.dll` or `libGL.so`) is dynamically loaded for our application. When an OpenGL context is created, the OS then loads the vendor-specific driver library into the process memory. A loader function such as `glfwGetProcAddress` can query the driver and get the addresses of actual implementations of the supported OpenGL functions. GLAD calls this loader for each OpenGL function name by iterating over a list for each version of the specification (until the one we set during GLAD generation) and stores those pointers in usable global function pointers.

## Render Loop

Program statements are executed sequentially, and when the last one is done, the process terminates. We usually want to keep the application running until the user issues an exit command. A `while` loop is how this behavior can be implemented in code, and in computer graphics, this loop is often referred to as a **render loop** or **game loop** depending on the context. The exit condition in our case is the close flag of the GLFW window, and the `glfwWindowShouldClose` call returns `true` if this flag is set (e.g., after the user clicks on the close button). Every iteration of this loop (one cycle of work) is colloquially called a **frame**. A frame can also refer to the fully rendered 2D image — the output of that iteration.

## Double Buffering

Updating a color buffer while displaying that same buffer on the screen would result in screen tearing or flickering. For this reason, GLFW creates two buffers, front and back, and draws to the back buffer while displaying the front buffer. When `glfwSwapBuffers` is called, the back buffer becomes the front and vice versa.

> By buffers, we actually mean framebuffers. For now, we're using the default ones created by GLFW. Later, we'll manually create them for other purposes.

One thing to keep in mind is that we need to call `glViewport` with the correct width and height of the current window so that we draw to the entire buffer, but we can choose to use a smaller region as well. Another reason this call is important is that it sets the correct aspect ratio for viewport transformation, which will be discussed later.

> It is advisable to register a callback function via `glfwSetFramebufferSizeCallback` so that the viewport is updated when the window is resized.

## User Input

In addition to creating windows and contexts, GLFW can also receive input events. `glfwPollEvents` handles events that are currently in the event queue and calls the callbacks associated with those events. Callback functions can be registered using calls such as `glfwSetMouseButtonCallback`.

## Minimal Application

With this knowledge, we can create our first OpenGL application that displays a single color background.

> Some calls in this program might fail, but the necessary checks are omitted.

```cpp
#include <glad/glad.h>
#include <GLFW/glfw3.h>
void FramebufferSizeCallback(GLFWwindow*, int, int);
int main() {
  glfwInit();
  GLFWwindow* window = glfwCreateWindow(800, 600, "LearnOpenGL", NULL, NULL);
  glfwMakeContextCurrent(window);
  glfwSetFramebufferSizeCallback(window, FramebufferSizeCallback);
  gladLoadGLLoader((GLADloadproc)glfwGetProcAddress);
  glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
  while (!glfwWindowShouldClose(window)) {
    glClear(GL_COLOR_BUFFER_BIT);
    glfwSwapBuffers(window);
    glfwPollEvents();
  }
  glfwTerminate();
  return 0;
}
void FramebufferSizeCallback(GLFWwindow* window, int width, int height) {
  glViewport(0, 0, width, height);
}
```

## Debugging and Logging

OpenGL cannot output its debug messages unless our application provides a way to display them. We can receive these messages by registering a callback function via `glDebugMessageCallback` and process them within this function. The most common way to handle debug messaging is by using a logger like [spdlog](https://github.com/gabime/spdlog) to either store the messages or directly output them to a chosen target (sink) as formatted text.

```bash
git submodule add https://github.com/gabime/spdlog /external/spdlog
```

```cmake
add_subdirectory("${CMAKE_CURRENT_SOURCE_DIR}/external/spdlog")
target_link_libraries("${PROJECT_NAME}" PUBLIC spdlog)
```

If you use the default logger, which is created implicitly when a call like `spdlog::info` is made, it's a colorized console logger that outputs to **stdout**, which is good enough for our purposes.

```cpp
#include <spdlog/spdlog.h>
void DebugMessageCallback(unsigned int, unsigned int, unsigned int, unsigned int, int, const char*, const void*);
int main() {
  // ...
  glDebugMessageCallback(DebugMessageCallback, nullptr);
  // ...
}
void DebugMessageCallback(unsigned int source, unsigned int type, unsigned int id, unsigned int severity, int length, const char* message, const void* userParam) {
  std::string sourceStr, typeStr;
  switch (source) {
  case GL_DEBUG_SOURCE_API:
    sourceStr = "API";
    break;
  case GL_DEBUG_SOURCE_WINDOW_SYSTEM:
    sourceStr = "Window System";
    break;
  case GL_DEBUG_SOURCE_SHADER_COMPILER:
    sourceStr = "Shader Compiler";
    break;
  case GL_DEBUG_SOURCE_THIRD_PARTY:
    sourceStr = "Third Party";
    break;
  case GL_DEBUG_SOURCE_APPLICATION:
    sourceStr = "Application";
    break;
  case GL_DEBUG_SOURCE_OTHER:
    sourceStr = "Other";
    break;
  }
  switch (type) {
  case GL_DEBUG_TYPE_ERROR:
    typeStr = "Error";
    break;
  case GL_DEBUG_TYPE_DEPRECATED_BEHAVIOR:
    typeStr = "Deprecated Behavior";
    break;
  case GL_DEBUG_TYPE_UNDEFINED_BEHAVIOR:
    typeStr = "Undefined Behavior";
    break;
  case GL_DEBUG_TYPE_PORTABILITY:
    typeStr = "Portability";
    break;
  case GL_DEBUG_TYPE_PERFORMANCE:
    typeStr = "Performance";
    break;
  case GL_DEBUG_TYPE_MARKER:
    typeStr = "Marker";
    break;
  case GL_DEBUG_TYPE_PUSH_GROUP:
    typeStr = "Push Group";
    break;
  case GL_DEBUG_TYPE_POP_GROUP:
    typeStr = "Pop Group";
    break;
  case GL_DEBUG_TYPE_OTHER:
    typeStr = "Other";
    break;
  }
  switch (severity) {
  case GL_DEBUG_SEVERITY_HIGH:
    spdlog::error("OpenGL {} {}: {}", sourceStr, typeStr, message);
    break;
  case GL_DEBUG_SEVERITY_MEDIUM:
    spdlog::warn("OpenGL {} {}: {}", sourceStr, typeStr, message);
    break;
  case GL_DEBUG_SEVERITY_LOW:
    spdlog::info("OpenGL {} {}: {}", sourceStr, typeStr, message);
    break;
  default:
    spdlog::debug("OpenGL {} {}: {}", sourceStr, typeStr, message);
  }
}
```

These debug messages may help you identify common issues such as buffer-target mismatches; however, there are more nuanced issues that do not necessarily generate error messages, but can only be identified visually while the application is running. Tools like [RenderDoc](https://renderdoc.org) allow you to capture frames, step through every draw call, view GPU resources (e.g., textures), inspect pipeline stages, and visually debug meshes and vertex attributes.
