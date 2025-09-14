---
layout: post
title: A Summary of LearnOpenGL
---

I’ve prepared a concise summary of the lectures from <https://learnopengl.com/> for a quick reference.

> This text explains graphics concepts without using visuals.

## OpenGL

[OpenGL](https://www.opengl.org/) is a cross-platform API for rendering graphics, maintained by the [Khronos Group](https://www.khronos.org/). It is a specification that must be implemented by GPU vendors (or third parties) and made available through graphics driver software.

If you're building your project with [CMake](https://cmake.org/) and want to use OpenGL in your C++ application, your **CMakeLists.txt** should include the following commands:

```cmake
find_package(OpenGL REQUIRED)
target_link_libraries("${PROJECT_NAME}" PUBLIC OpenGL::GL)
```

## GLFW

A graphics application requires a window to render graphics, but creating a window is OS-specific. [GLFW](https://www.glfw.org/) is a cross-platform library that abstracts away the details and provides a simple API for creating native windows (and more).

The GLFW source code can be included in a [Git](https://git-scm.com/) repository as a submodule.

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

- Go to <https://glad.dav1d.de/>
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

## Rendering Pipeline

The sequence of steps that OpenGL takes to transform **3D** shapes into **2D** images is called the rendering pipeline. This pipeline is designed as a streaming architecture and consists of several stages, each one requiring the output of the previous one as its input. These stages are highly specialized and can be executed in parallel on thousands of GPU cores today.

> Running in parallel means that while _stage-A_ processes its new input, _stage-B_ works on A's previous output, and so on.

## Shaders

Each stage in the rendering pipeline executes small programs on GPU cores to perform its tasks. A program that runs on the GPU is called a **shader**. They can be written in one of the many shading languages that exist today. **OpenGL Shading Language (GLSL)** is the default for OpenGL and widely supported, so it will be the language of choice for us.

## Abstract Pipeline Structure

The pipeline structure is defined by standards bodies, e.g., Khronos Group, and implemented in hardware by GPU vendors, e.g., Nvidia. The OpenGL rendering pipeline consists of the following stages (in the given order):

- Vertex Specification
- _**Vertex Shader**_
- _**Tessellation**_
- _**Geometry Shader**_
- Vertex Post-Processing
- Primitive Assembly
- Rasterization
- _**Fragment Shader**_
- Per-Sample Operations

> Bold-italic text indicates a programmable pipeline stage.

## Vertex Specification

A **vertex** is a collection of attributes associated with a point in space. These attributes can include position, normal direction, texture coordinates, tangent vector, color, etc.

Since this is the first stage in the pipeline, vertex data must be provided by the application. The vertex data can be as simple as an array of positions where each element is a `float` corresponding to a value on one of three axes $(x,y,z)$. For example, a triangle formed by vertices $A$, $B$, and $C$ can be defined as follows:

```cpp
float vertices[] = {
  // x, y, z
  -0.5f, -0.5f, 0.0f, // A
  0.5f, -0.5f, 0.0f, // B
  0.0f, 0.5f, 0.0f // C
};
```

> How will OpenGL know this array represents a triangle and not two lines ($AB$, $BC$, and no $CA$)? We will tell OpenGL how to connect these points when initiating draw calls.

Sending data from CPU to GPU memory is relatively slow, so we want to send the data once and keep it in GPU memory for as long as we need it. We can store large amounts of vertex data in memory via [Vertex Buffer Objects (VBO)](https://www.khronos.org/opengl/wiki/Vertex_Specification#Vertex_Buffer_Object). We can create such a buffer by calling `glGenBuffers` which assigns an ID to this buffer so we can refer to it later.

We have to bind this buffer to a target such as `GL_ARRAY_BUFFER` before being able to modify it. Then, we can send the vertex data to GPU memory via `glBufferData` by specifying the target, data length, data itself, and the expected usage pattern. The pattern `GL_STATIC_DRAW` is optimal for data that doesn't need to change frequently but will be read many times.

```cpp
GLuint vbo;
glGenBuffers(1, &vbo);
glBindBuffer(GL_ARRAY_BUFFER, vbo);
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
glBindBuffer(GL_ARRAY_BUFFER, 0); // unbind the vbo
```

> `GLuint` is just an alias for `unsigned int`.

If we forget to unbind the buffer, all subsequent operations with the same target will affect its state. In modern OpenGL (4.5+), we have [Direct State Access (DSA)](https://www.khronos.org/opengl/wiki/Direct_State_Access) that allows us to modify object state without affecting the global state. The previous code can be rewritten using DSA as follows:

```cpp
GLuint vbo;
glCreateBuffers(1, &vbo);
glNamedBufferData(vbo, sizeof(vertices), vertices, GL_STATIC_DRAW);
```

> If a buffer was created using `glGenBuffers`, it may not be compatible with DSA.

We will keep using the pre-DSA ways of doing things to be compatible with version 3.3+.

## Vertex Shader

The **vertex shader** is a programmable stage in the pipeline that handles the processing of individual vertices. It receives a single vertex and outputs a single vertex, performing transformations or other per-vertex calculations in between. One of its predefined outputs is `gl_Position` which is of type `vec4`, and it must be set in the shader.

Vertex data we stored in the previous section will be consumed by the vertex shader. For this purpose, we need to define a vertex input for each attribute in the buffer. Since we only have one attribute, that is the position, we define one `vec3` input. It's advised to assign a location to each attribute manually (as opposed to letting OpenGL do it) so that we don't have to query the locations later. The following is a simple vertex shader that directly outputs the input position without doing any transformations.

> You must specify the shader version at the top of the shader using the version directive.

```glsl
#version 330 core
layout(location = 0) in vec3 i_pos;
void main() {
  gl_Position = vec4(i_pos, 1.0);
}
```

> Why `gl_Position` has a fourth component and why it's set to `1.0` will be discussed later.

> Vertex shader files usually have the extension `.vert`.

Whether we have a single or multiple attributes, we have to tell OpenGL how to interpret the vertex data in memory. The way we do it is by calling `glVertexAttribPointer` with the argument's index (location), number of components per attribute (3 for position), data type, whether to normalize data, stride (distance between consecutive attributes), and attribute offset in the buffer. After this, `glEnableVertexAttribArray` must be called for the correct location to activate the attribute.

```cpp
glBindBuffer(GL_ARRAY_BUFFER, vbo);
glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
glEnableVertexAttribArray(0);
glBindBuffer(GL_ARRAY_BUFFER, 0);
```

The VBO only stores raw vertex data, and it doesn't remember the attribute settings we just made. So, all of these steps must be repeated whenever we want to draw an object. For this reason, there are [Vertex Array Objects](https://www.khronos.org/opengl/wiki/Vertex_Specification#Vertex_Array_Object), which can store all the state needed to supply vertex data. In the following code, VAO remembers every state change that was done while it was bound.

> There is no need to re-send the buffer data, it's already associated with the VBO.

```cpp
GLuint vao;
glGenVertexArrays(1, &vao);
glBindVertexArray(vao);
glBindBuffer(GL_ARRAY_BUFFER, vbo);
glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
glEnableVertexAttribArray(0);
glBindVertexArray(0); // unbind the vao
```

> On OpenGL 3.3+ core profile, VAOs are mandatory (you must bind one before drawing).

## Shader Compilation

It would not be feasible to pre-compile shaders compatible with many hardware-driver combinations. If there are many shaders or shader variations, it would make more sense to compile them at runtime on the target platform. Moreover, when a shader is compiled at runtime, hardware-specific optimizations can be applied by the graphics driver.

The following code reads a vertex shader from a file, creates a shader object by calling `glCreateShader`, providing the source code via `glShaderSource`, and compiles the shader into an intermediate representation.

```cpp
// read the shader file
std::ifstream fs("example.vert");
std::stringstream ss;
ss << fs.rdbuf();
fs.close();
std::string vertexText = ss.str();
// compile the shader
GLuint vertexShader;
vertexShader = glCreateShader(GL_VERTEX_SHADER);
glShaderSource(vertexShader, 1, &vertexText.c_str(), NULL);
glCompileShader(vertexShader);
```

## Fragment Shader

A **fragment** contains all the data that is needed to shade a pixel. A **fragment shader** usually has a single color output. Unlike the vertex shader, there is no predefined output variables (they are deprecated). OpenGL assigns the location 0 to the first output by default, but it can also be specified manually, especially when there are multiple outputs. The following is a fragment shader that assigns a predefined color to the output. The fourth component in the color vector is the alpha value that is used in [blending](https://www.khronos.org/opengl/wiki/Blending).

```glsl
#version 330 core
out vec4 o_color;
void main() {
 o_color = vec4(1.0f, 0.5f, 0.2f, 1.0f);
}
```

The process to create and compile a fragment shader is almost the same as for a vertex shader, except for the shader type (`GL_FRAGMENT_SHADER`) passed to the `glCreateShader` function.

```cpp
GLuint fragmentShader;
fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
```

> Fragment shader files usually have the extension `.frag`.

## Shader Program

A **shader program** is the final linked version of multiple shaders. During linking, outputs of each shader are linked to the inputs of the next shader (by their names, unless manually given locations), which can result in errors if there is a mismatch in types (e.g., `vec3` vs `vec4`) or interpolation qualifiers (e.g., `flat` vs `smooth`). The following code creates a shader program, attaches both vertex and fragment shaders, which were compiled before, to this program, and deletes the shader objects since they're no longer needed.

```cpp
GLuint shaderProgram;
shaderProgram = glCreateProgram();
glAttachShader(shaderProgram, vertexShader);
glAttachShader(shaderProgram, fragmentShader);
glLinkProgram(shaderProgram);
glDeleteShader(vertexShader);
glDeleteShader(fragmentShader);
```

To activate a shader, we call `glUseProgram` with the program ID. The VAO stores all the state needed to draw our triangle, so we bind it. Then, we make a draw call by telling OpenGL how to interpret the data to assemble primitives, i.e., we set the draw mode to `GL_TRIANGLES` (see the [OpenGL primitive documentation](https://www.khronos.org/opengl/wiki/Primitive) for more detail). The `glDrawArrays` call accepts two more inputs: the start index in the enabled arrays, and the number of vertices to render. By default, OpenGL fills the interior (i.e., faces) of polygon primitives, but this behavior can be changed by setting `glPolygonMode` to something different than `GL_FILL`, e.g., `GL_LINE`, which draws only the outline.

> A collection of vertices, edges that connect them, and faces that are formed by loops constitute a **mesh**.

```cpp
glUseProgram(shaderProgram);
glBindVertexArray(vao);
glDrawArrays(GL_TRIANGLES, 0, 3);
```

## Multiple Shader Attributes

We've so far had only one attribute: position. A VAO can store multiple attributes and reference multiple VBOs if these attributes are stored in different buffers. In most cases, we can store all the attributes in a single VBO in interleaved format (e.g., position0, color0, position1, color1, ...). However, if some attributes need to be updated more frequently than others, it might be better to store them in separate VBOs.

Let's update our `vertices` array to include per-vertex color data:

```cpp
float vertices[] = {
  // x, y, z, r, g, b
  0.5f, -0.5f, 0.0f, 1.0f, 0.0f, 0.0f, // A
  -0.5f, -0.5f, 0.0f, 0.0f, 1.0f, 0.0f, // B
  0.0f, 0.5f, 0.0f, 0.0f, 0.0f, 1.0f // C
};
```

The vertex shader needs to be updated to include this new color input and an output to pass the color data to the fragment shader.

```glsl
#version 330 core
layout(location = 0) in vec3 i_pos;
layout(location = 1) in vec3 i_color;
out vec3 color;
void main() {
  gl_Position = vec4(i_pos, 1.0);
  color = i_color;
}
```

Similarly, the fragment shader needs to be updated to receive the color value from the vertex shader. We have to use the same name (`color`) and type (`vec3`) for both the vertex shader output and the fragment shader input.

```glsl
#version 330 core
in vec3 color;
out vec4 o_color;
void main() {
  o_color = vec4(color, 1.0f);
}
```

Finally, we need to update the attribute pointers so that they point to the correct locations in the buffer. The second set of calls now has $1$ as the index argument, and the stride has been doubled since one set of attributes is now $6$ `float`s long ($3$ for position, $3$ for color). The offset value for the color attribute pointer must be $3$ `float`s to correctly skip the position attribute. Also, the `vertices` array, which is in CPU memory, has been updated to include color values; hence, we need to update the GPU memory by sending the new array via `glBufferData`.

```cpp
glBindVertexArray(vao);
glBindBuffer(GL_ARRAY_BUFFER, vbo);
// send the updated data
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
// position
glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
glEnableVertexAttribArray(0);
// color
glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3* sizeof(float)));
glEnableVertexAttribArray(1);
glBindVertexArray(0);
```

> A VAO needs to associate the attribute layout with the VBO that stores the attribute data. Hence, we need to bind the VBO after binding the VAO and before calling `glVertexAttribPointer`.

## Coordinate Spaces, Systems and Frames

Notice that so far, we've used points within the range $[-1,1]$ on all axes. Also, recall that our vertex shader did not do any transformations, and directly output the values we set via a VBO. For a vertex to be visible on the screen in OpenGL, it must be in **Normalized Device Coordinates (NDC)** after it is processed. NDC is a space where all coordinates are normalized to $[-1,1]^3$. These numbers, however, are merely percentages that need to be transformed to a coordinate frame, e.g., screen coordinates, to represent actual positions. Before we go any further, it's important to define the terms "space", "system" and "frame".

A **geometric space** is an abstract framework that defines the geometric rules (axioms), e.g., how to measure distances or angles, or how lines behave, to represent physical space. A **Euclidean** space is one such space where Euclidean geometry rules apply; for example, distances are calculated using the [Euclidean distance](https://en.wikipedia.org/wiki/Euclidean_distance) formula. A **coordinate system** describes how to uniquely specify each point in a space. A **Cartesian** coordinate system specifies points using real numbers called **coordinates**, which are the signed distances from perpendicular oriented lines called coordinate lines or axes. The point where these axes meet is called the **origin**. The direction vectors that represent these axes (e.g., $(1,0,0)$, $(0,1,0)$ and $(0,0,1)$) form an **orthogonal basis**, meaning that they are mutually orthogonal, and any vector in this system can be represented as a finite linear combination of these basis vectors. A **coordinate frame** is a specific instance of a coordinate system with a defined origin and basis. In computer graphics, a **coordinate space** usually means a frame of reference in space (a coordinate frame).

In graphics applications, some calculations can be done more efficiently and are more intuitive in certain coordinate spaces. We move a vector from one space to another by applying a **transformation**. Before diving into transformations, it's important to build a solid understanding of vectors and matrices.

## Vector Operations

A **vector** ($\vec{v}$) is a 1D array of numerical components. It can be of size $n$, which is the number of components the vector has. In computer graphics, we usually use vectors of size up to $4$.

$$
\vec{a} =
\begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix}
$$

A **vector space** ($V$) defines a set of axioms (e.g., commutativity, associativity, etc.), and a set of vector operations (e.g., addition, multiplication, etc.) over a field (e.g., real numbers ($\mathbb{R}$)) in algebraic terms. A Euclidean space satisfies all the axioms of a vector space over the real numbers.

We can add or subtract a scalar ($c$) to or from a vector, or multiply or divide a vector by a scalar by simply applying this operation to each component of the vector.

$$
c\vec{a} = c
\begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix} =
\begin{bmatrix}
c \cdot a_1 \\
c \cdot a_2 \\
c \cdot a_3
\end{bmatrix}
$$

The **length** (magnitude) of a vector is defined as the square root of the sum of the squares of its components.

$$
\|\vec{a}\| = \sqrt{a_1^2+a_2^2+a_3^2}
$$

A vector can be **normalized** to obtain a **unit vector** (a vector with a length of $1$) by dividing its components by its length. Unit vectors are easy to work with when we only care about a vector's direction.

> Normalizing does not change a vector's direction.

$$
\hat{a} =
\frac{\vec{a}}{\|\vec{a}\|} =
\frac{1}{\sqrt{a_1^2+a_2^2+a_3^2}}
\begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix}
$$

Two vectors of the same size can be added or subtracted through component-wise addition or subtraction.

$$
\vec{a} + \vec{b} =
\begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix} +
\begin{bmatrix}
b_1 \\
b_2 \\
b_3
\end{bmatrix} =
\begin{bmatrix}
a_1 + b_1 \\
a_2 + b_2 \\
a_3 + b_3
\end{bmatrix}
$$

GLSL defines vector-vector multiplication as component-wise multiplication. However, there are more useful and specialized forms of multiplication: dot and cross products.

### Dot Product

In graphics applications, it's important to know how much two vectors align, i.e., whether they're parallel, perpendicular, or somewhere in between. **Dot product** is the operation that tells us about this relationship. It can be calculated by summing the component-wise products. The same result can be obtained by multiplying the lengths of the two vectors and the cosine of the angle between them. The second method is more intuitive because this operation is defined, geometrically, as the length of one vector's projection onto the other, multiplied by the other's length. One can verify that the two equations are identical through the use of the [law of cosines](https://en.wikipedia.org/wiki/Law_of_cosines) on a triangle formed by the two vectors (making an angle $\theta$) and their difference vector connecting both.

> The result of a dot product is a scalar (not a vector).

$$
\vec{a} \cdot \vec{b} =
\begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix} \cdot
\begin{bmatrix}
b_1 \\
b_2 \\
b_3
\end{bmatrix} = a_1b_1 + a_2b_2 + a_3b_3 = \|\vec{a}\| \|\vec{b}\| \cos{\theta}
$$

> If two vectors are perpendicular, their dot product is zero ($\cos{90^\circ} = 0$).

> Dot product is commutative, that is, $\vec{a}\cdot\vec{b}$ is equal to $\vec{b}\cdot\vec{a}$.

A geometric space, e.g., a Euclidean space, is a vector space plus an inner product that defines lengths of vectors, angles between vectors, or orthogonality. An **inner product**, e.g., the dot product, is an operation that takes two vectors and produces a single scalar in a way that encodes geometric meaning — it lets us talk about lengths, angles, and orthogonality inside a vector space.

### Cross Product

This operation takes two non-parallel vectors as input and outputs a vector that is orthogonal to both inputs. It will prove useful in future chapters.

$$
\vec{a} \times \vec{b} =
\begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix} \times
\begin{bmatrix}
b_1 \\
b_2 \\
b_3
\end{bmatrix} =
\begin{bmatrix}
a_2b_3 - a_3b_2 \\
a_3b_1 - a_1b_3 \\
a_1b_2 - a_2b_1
\end{bmatrix}
$$

## Matrix Operations

A **matrix** ($M$) is a 2D array of elements, where each element is identified by its row and column indices. If a matrix has $m$ rows and $n$ columns, it's an $mxn$ matrix, and these are called the matrix dimensions. Matrices can be used to solve systems of linear equations; for example, one matrix can store the coefficients while another stores the variables.

> If both dimensions are the same, then the matrix is called a **square matrix**.

A matrix-scalar product multiplies each element of the matrix by a scalar. Addition and subtraction can be done element-wise if both matrices have the same dimensions.

$$
A + B =
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix} +
\begin{bmatrix}
5 & 6 \\
7 & 8
\end{bmatrix} =
\begin{bmatrix}
1 + 5 & 2 + 6 \\
3 + 7 & 4 + 8
\end{bmatrix} =
\begin{bmatrix}
6 & 8 \\
10 & 12
\end{bmatrix}
$$

Two matrices, $A$ and $B$, can be multiplied (in this order) if the number of columns in $A$ is equal to the number of rows in $B$. Every element in a row of $A$ is multiplied by the corresponding element in a column of $B$. Then, these products are summed up to obtain one element in the resulting matrix $C$. The result obtained from processing row $i$ of $A$ and column $j$ of $B$ will end up in the $i^{th}$ row and $j^{th}$ column of $C$. This implies that the resulting matrix has the same number of rows as $A$ and the same number of columns as $B$.

$$
AB =
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
\begin{bmatrix}
5 & 6 \\
7 & 8
\end{bmatrix} =
\begin{bmatrix}
1 \cdot 5 + 2 \cdot 7 & 1 \cdot 6 + 2 \cdot 8 \\
3 \cdot 5 + 4 \cdot 7 & 3 \cdot 6 + 4 \cdot 8
\end{bmatrix} =
\begin{bmatrix}
5 + 14 & 6 + 16 \\
15 + 28 & 18 + 32
\end{bmatrix} =
\begin{bmatrix}
19 & 22 \\
43 & 50
\end{bmatrix}
$$

> Matrix multiplication is not commutative, that is, $AB$ is not the same as $BA$.

$$
BA =
\begin{bmatrix}
5 & 6 \\
7 & 8
\end{bmatrix}
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix} =
\begin{bmatrix}
5 \cdot 1 + 6 \cdot 3 & 5 \cdot 2 + 6 \cdot 4 \\
7 \cdot 1 + 8 \cdot 3 & 7 \cdot 2 + 8 \cdot 4
\end{bmatrix} =
\begin{bmatrix}
5 + 18 & 10 + 24 \\
7 + 24 & 14 + 32
\end{bmatrix} =
\begin{bmatrix}
23 & 34 \\
31 & 46
\end{bmatrix}
$$

When a matrix is **transposed**, its rows become its columns and vice versa. If $M$ has the dimensions $mxn$, $M^T$ (transpose of $M$) has a dimension of $nxm$.

$$
A^T =
\begin{bmatrix}
1 & 3 \\
2 & 4
\end{bmatrix},
B^T =
\begin{bmatrix}
5 & 7 \\
6 & 8
\end{bmatrix}
$$

The transpose of a product is equal to the product of the transposes in **reverse** order.

$$
(AB)^T =
B^TA^T =
\begin{bmatrix}
5 & 7 \\
6 & 8
\end{bmatrix}
\begin{bmatrix}
1 & 3 \\
2 & 4
\end{bmatrix} =
\begin{bmatrix}
5 \cdot 1 + 7 \cdot 2 & 5 \cdot 3 + 7 \cdot 4 \\
6 \cdot 1 + 8 \cdot 2 & 6 \cdot 3 + 8 \cdot 4
\end{bmatrix} =
\begin{bmatrix}
5 + 14 & 15 + 28 \\
6 + 16 & 18 + 32
\end{bmatrix} =
\begin{bmatrix}
19 & 43 \\
22 & 50
\end{bmatrix}
$$

## Transformations

A vector is basically an $nx1$ matrix, if represented as a **column vector** (i.e., components appear in the same column); hence, it can be multiplied by an $mxn$ matrix ($M\vec{v}$). Through matrix multiplication, a vector can be transformed into another vector. We use matrices for transforming vectors, because they allow us to combine multiple transformations into a single matrix, which we'll see later on.

> GPUs are very good at multiplying thousands of matrices in parallel.

An **identity matrix** is an $nxn$ matrix that has $1s$ on its **main diagonal** (from top-left to bottom-right) and $0s$ elsewhere. When you multiply any compatible matrix or vector with it, you get the original matrix or vector back. So, it's essentially a **no transform**.

$$
IA = \begin{bmatrix}
1 & 0 \\
0 & 1
\end{bmatrix}
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix} =
\begin{bmatrix}
1 \cdot 1 + 0 \cdot 3 & 1 \cdot 2 + 0 \cdot 4 \\
0 \cdot 1 + 1 \cdot 3 & 0 \cdot 2 + 1 \cdot 4
\end{bmatrix} =
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
$$

> A **diagonal matrix** has non-zero entries only along its main diagonal.

### Scaling

We can change the length (and direction) of a vector by scaling it. This is achieved by multiplying individual components by a scalar. If the same scalar is used for all components, it is a **uniform** scale operation; otherwise, it's called a **non-uniform** scale.

> A positive uniform scale operation does not change a vector's direction. If it's negative, then the vector points the opposite way.

We would like to form a scale matrix ($S$) so that the scaling operation could be represented as a matrix-vector multiplication. To obtain that matrix, let's first write a set of equations that describes scaling for a vector in a Euclidean space defined by Cartesian coordinates:

$$
\begin{align}
x' = S_x \cdot x \\
y' = S_y \cdot y \\
z' = S_z \cdot z
\end{align}
$$

Since there are $3$ equations, there should be $3$ rows in the scale matrix to store the coefficients for each equation. Also, since a 3D vector is a $3x1$ matrix, our matrix needs to have $3$ columns to be compatible. So, this will be a $3x3$ matrix. Let's rewrite the equations so that each one has $3$ coefficients (columns):

$$
\begin{align}
x' = S_x \cdot x + 0 \cdot y + 0 \cdot z \\
y' = 0 \cdot x + S_y \cdot y + 0 \cdot z \\
z' = 0 \cdot x + 0 \cdot y + S_z \cdot z
\end{align}
$$

We want to scale each axis independently; hence, we want no contribution from other axes. For this purpose, we set the coefficients of other components to $0$. In this type of scenario, we obtain a diagonal matrix. These equations can be written in matrix form as follows:

$$
\begin{bmatrix}
x' \\
y' \\
z'
\end{bmatrix} =
\begin{bmatrix}
S_x & 0 & 0 \\
0 & S_y & 0 \\
0 & 0 & S_z
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z
\end{bmatrix}
$$

### Translation

We can move (translate) a vector by adding another vector to it. Similar to scaling, we would love to represent this too as a matrix multiplication, which will help us combine both matrices into one. Again, let's start by writing a set of equations that translate a vector:

$$
\begin{align}
x' &= x + T_x \\
y' &= y + T_y \\
z' &= z + T_z
\end{align}
$$

Wait... can we obtain $x+T_x$ through matrix multiplication? This seems impossible... and it is, in the same dimensional space. The reason is that matrix multiplication is a **linear transformation**; but, translation is an **affine transformation**.

A transformation ($L$) is **linear** if it satisfies the following condition, where $a$ and $b$ are scalars:

$$
L(a\vec{u} + b\vec{v}) = aL(\vec{u}) + bL(\vec{v})
$$

An **affine** transformation ($A$) has the following form, where $L$ is the linear part, and $\vec{c}$ is a constant vector (e.g., translation vector):

$$
A(\vec{u}) = L\vec{u} + \vec{c}
$$

This is not linear because:

$$
A(\vec{u} + \vec{v}) = L(\vec{u} + \vec{v}) + \vec{c} \neq A(\vec{u}) + A(\vec{v}) = L(\vec{u}) + \vec{c} + L(\vec{v}) + \vec{c}
$$

There is, however, an augmentation technique we can use to obtain a translation matrix. But first, let's expand the equations to include all the components, which must have a corresponding coefficient in each row of this matrix. It's obvious that these coefficients should be $0$. On the other hand, translation amounts must be preserved; hence, they are multiplied by $1$.

$$
\begin{align}
x' = 1 \cdot x + 0 \cdot y + 0 \cdot z + T_x \cdot 1 \\
y' = 0 \cdot x + 1 \cdot y + 0 \cdot z + T_y \cdot 1 \\
z' = 0 \cdot x + 0 \cdot y + 1 \cdot z + T_z \cdot 1
\end{align}
$$

It looks like our vector is not $(x,y,z)$ anymore, but rather $(x,y,z,1)$. Similarly, each row appears to have one more coefficient that is the translation amount. Let's try to convert this to a matrix multiplication using the available information:

$$
\begin{bmatrix}
x' \\
y' \\
z'
\end{bmatrix} =
\begin{bmatrix}
1 & 0 & 0 & T_x \\
0 & 1 & 0 & T_y \\
0 & 0 & 1 & T_z
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix}
$$

This operation is valid because the translation matrix ($T$) has a dimension of $3x4$ and it is multiplied by a $4x1$ vector, and the resulting vector is of size $3x1$. More importantly, it gives the correct result. So, we've finally obtained a translation matrix by introducing a new dimension.

> When a 3D point is represented in a 4D projective space, the new coordinate system is referred to as **homogenous coordinates**.

There is a problem though. The $w$ component we added to our original vector makes it impossible to perform multiplications with our scale matrix since the dimensions $3x3$ and $4x1$ are not compatible ($3\neq 4$). As a workaround, we could add one extra column of $0s$ to our scale matrix:

$$
\begin{bmatrix}
S_x & 0 & 0 & 0 \\
0 & S_y & 0 & 0 \\
0 & 0 & S_z & 0
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix} =
\begin{bmatrix}
S_x \cdot x \\
S_y \cdot y \\
S_z \cdot z
\end{bmatrix}
$$

This seems to work, but we do not just perform one transformation on a vector and call it a day; it's often necessary to apply a series of transformations to the same vector. Let's say we intend to apply a translation next, can we do it? Notice that we no longer have a $4x1$ vector; we have lost the $w$ component, which makes it impossible to perform this operation. It's clear that we have to preserve the 4D representation while operating on the vector.

What dimensions does the scale matrix need to have to produce a $4x1$ vector when multiplied by a $4x1$ vector? Yes, the answer is $4x4$. But, what values should we have in this new row? The $w$ component of the result must be $1$, which suggests $(0,0,0,1)$.

$$
\begin{bmatrix}
S_x & 0 & 0 & 0 \\
0 & S_y & 0 & 0 \\
0 & 0 & S_z & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix} =
\begin{bmatrix}
S_x \cdot x \\
S_y \cdot y \\
S_z \cdot z \\
1
\end{bmatrix}
$$

Now, let's try to apply scaling followed by translation. When using column vectors, this chain of operations is written left to right, but performed right to left. It follows the **nested functions** analogy: $f(g(h(x))) = (f \circ g \circ h)(x)$.

$$
\begin{bmatrix}
1 & 0 & 0 & T_x \\
0 & 1 & 0 & T_y \\
0 & 0 & 1 & T_z \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
S_x & 0 & 0 & 0 \\
0 & S_y & 0 & 0 \\
0 & 0 & S_z & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix} =
\begin{bmatrix}
1 & 0 & 0 & T_x \\
0 & 1 & 0 & T_y \\
0 & 0 & 1 & T_z \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
S_x \cdot x \\
S_y \cdot y \\
S_z \cdot z \\
1
\end{bmatrix} =
\begin{bmatrix}
S_x \cdot x + T_x \\
S_y \cdot y + T_y \\
S_z \cdot z + T_z \\
1
\end{bmatrix}
$$

Matrix multiplication is **associative**, that is, $(AB)C = A(BC)$; hence, we are free to combine any anjacent pair without changing the order. This allows us to collapse the entire transformation chain into one matrix, and multiply the combined result with the vector. If these are some predefined transformations or do not change often, this can save a lot of CPU/GPU time and memory resources. Let's combine the translation and scale matrices:

$$
\begin{bmatrix}
1 & 0 & 0 & T_x \\
0 & 1 & 0 & T_y \\
0 & 0 & 1 & T_z \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
S_x & 0 & 0 & 0 \\
0 & S_y & 0 & 0 \\
0 & 0 & S_z & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix} =
\begin{bmatrix}
S_x & 0 & 0 & T_x \\
0 & S_y & 0 & T_y \\
0 & 0 & S_z & T_z \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix}
$$

It the vector was represented as a row vector, then the multiplication would be done left to right in reverse order, i.e., we would take the transpose of the transformation chain: $(TS\vec{v})^T=\vec{v}^TS^TT^T$. Notice that the vector dimensions become $1x4$, and the transform matrices are of size $4x4$, which explains the need to reverse the order to make them compatible for multiplication.

$$
\begin{bmatrix}
x & y & z & 1
\end{bmatrix}
\begin{bmatrix}
S_x & 0 & 0 & 0 \\
0 & S_y & 0 & 0 \\
0 & 0 & S_z & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
1 & 0 & 0 & 0 \\
0 & 1 & 0 & 0 \\
0 & 0 & 1 & 0 \\
T_x & T_y & T_z & 1
\end{bmatrix} =
\begin{bmatrix}
x & y & z & 1
\end{bmatrix}
\begin{bmatrix}
S_x & 0 & 0 & 0 \\
0 & S_y & 0 & 0 \\
0 & 0 & S_z & 0 \\
T_x & T_y & T_z & 1
\end{bmatrix}
$$

### Rotation

One way to represent rotations is by using three separate rotations around coordinate axes, applied in a specific sequence. For example, we first rotate around $x$ by $\alpha$, then around $y$ by $\beta$, and finally around $z$ by $\gamma$. These are called **Euler angles**. In different industries, these rotations might have different names; for example, in avionics, rotations around $x$, $y$ and $z$ are called **pitch**, **yaw** and **roll**, respectively, given that $y$ is up. The following are the most common rotation matrices, derived for the right-handed basis [orientation](<https://en.wikipedia.org/wiki/Orientation_(vector_space)>).

$$
R_z R_y R_x =
\begin{bmatrix}
\cos{\gamma} & -\sin{\gamma} & 0 & 0\\
\sin{\gamma} & \cos{\gamma} & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
\cos{\beta} & 0 & \sin{\beta} & 0\\
0 & 1 & 0 & 0 \\
-\sin{\beta} & 0 & \cos{\beta} & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
1 & 0 & 0 & 0\\
0 & \cos{\alpha} & -\sin{\alpha} & 0 \\
0 & \sin{\alpha} & \cos{\alpha} & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
$$

This representation is easy to understand and visualize, but it's not perfect. Before we point out the issues, let's make some observations. The first thing to notice is that a rotation around a certain axis preserves the coordinates on that axis (through multiplication by $1$), which is expected. Another thing to notice is that the order matters due to the non-commutative nature of matrix multiplication, but in what order should we apply these rotations?

An important thing to know is that there are two types of rotations: intrinsic and extrinsic. These describe the frame of reference you're rotating about, which completely changes how the same sequence of angles plays out. With **intrinsic rotations**, the object is rotated about its local frame, which means that each rotation causes the local coordinate axes to move; the next rotation in the sequence happens relative to the new orientation. On the other hand, **extrinsic rotations** are about a fixed frame, e.g., world frame, or the parent object's frame.

> When we talk about rotations, we usually mean intrinsic rotations.

The problems associated with the representation above is not clear at first glance. To give you a clue, the first axis (rightmost in the matrix multiplication, outermost in a three-gimbal mechanism) can spin freely as it's fixed in the world frame, the middle one is othogonal to both the first and the last by definition, but there is a chance for the first and last to align when the middle axis is at its extremes (e.g., at $90$ degrees). When two axes align, rotations around both will have the same effect; hence, we lose one degree of freedom, which is called **gimbal lock**. Changing the multiplication order does not prevent this from happening, it just changes the pair that gets aligned.

To avoid gimbal lock, we could limit the movement of the middle axis, and in some cases, we could get away with it. For example, in an FPS game, players rarely look up to the sky or down to the ground, and it won't bother them when the rotation hits its limitations as it would also be physically impossible for a human's head to move beyond those angles. However, this is not a fix, just a mitigation. To eliminate the possibility of a gimbal lock altogether, modern graphics applications represent rotations using [quaternions](https://en.wikipedia.org/wiki/Quaternion).

#### Algebraic Explanation of Gimbal Lock

Let's say we have rotated around the $y$-axis by ${90^\circ}$, then the transformation becomes:

$$
\begin{bmatrix}
\cos{\gamma} & -\sin{\gamma} & 0 & 0\\
\sin{\gamma} & \cos{\gamma} & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
0 & 0 & 1 & 0\\
0 & 1 & 0 & 0 \\
-1 & 0 & 0 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
1 & 0 & 0 & 0\\
0 & \cos{\alpha} & -\sin{\alpha} & 0 \\
0 & \sin{\alpha} & \cos{\alpha} & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
$$

$$
\begin{bmatrix}
\cos{\gamma} & -\sin{\gamma} & 0 & 0\\
\sin{\gamma} & \cos{\gamma} & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
0 & \sin{\alpha} & \cos{\alpha} & 0\\
0 & \cos{\alpha} & -\sin{\alpha} & 0 \\
-1 & 0 & 0 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
$$

$$
\begin{bmatrix}
0 & \cos{\gamma}\sin{\alpha} - \sin{\gamma}\cos{\alpha} & \cos{\gamma}\cos{\alpha} + \sin{\gamma}\sin{\alpha} & 0 \\
0 & \sin{\gamma}\sin{\alpha} + \cos{\gamma}\cos{\alpha} & \sin{\gamma}\cos{\alpha} - \cos{\gamma}\sin{\alpha} & 0 \\
-1 & 0 & 0 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
$$

Using trigonometric identities, e.g., $\cos{\gamma}\sin{\alpha} - \sin{\gamma}\cos{\alpha} = \sin{(\alpha-\gamma)}$, we can rewrite this matrix as:

$$
\begin{bmatrix}
0 & \sin{(\alpha-\gamma)} & \cos{(\alpha-\gamma)} & 0 \\
0 & \cos{(\alpha-\gamma)} & -\sin{(\alpha-\gamma)} & 0 \\
-1 & 0 & 0 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
$$

Notice that the final rotation matrix only depends on the difference $\alpha-\gamma$, not on $\alpha$ and $\gamma$ individually; they're now coupled. Substituting $\theta$ for $\alpha-\gamma$, we can see that we now have two degrees of freedom, $\beta$ and $\theta$, one less compared to before: $\alpha$, $\beta$, $\gamma$.

### Transformation Order

In a matrix-based system, the order matters because the multiplication operation is not commutative. When deciding on an order, we must consider in what space each operation should happen. There is no right or wrong answer — it all depends on what result we want to achieve at the end. Let's analyze $TS\vec{v}$, which we derived before, in reverse order ($ST\vec{v}$).

$$
\begin{bmatrix}
S_x & 0 & 0 & 0 \\
0 & S_y & 0 & 0 \\
0 & 0 & S_z & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
1 & 0 & 0 & T_x \\
0 & 1 & 0 & T_y \\
0 & 0 & 1 & T_z \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix} =
\begin{bmatrix}
S_x & 0 & 0 & S_x \cdot T_x \\
0 & S_y & 0 & S_y \cdot T_y \\
0 & 0 & S_z & S_z \cdot T_z \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix}
$$

As you can see, if translation is applied first, then the translation vector is scaled as well. If it was rotation that followed translation, then the object would be rotated about a shifted origin, which would result in an arc shaped movement. If scale follows rotation, then it's applied with respect to the new orientation, which would make even a uniform scale look non-uniform. In many applications, we want to scale first, then rotate, and finally translate: $TRS\vec{v}$.

## GLM

In graphics applications, it's common, and often necessary, to perform matrix operations on the CPU. For example, in a game engine, object hierarchies are stored in CPU memory, and the transforms need to be re-calculated only when an object's local transform or a parent transform changes, which can be done more efficiently on the CPU. The **OpenGL Mathematics Library (GLM)** is a header-only C++ math library that provides a large set of classes and functions that follow the same naming conventions and functionality as GLSL. It can be added to a CMake project as we did with GLFW.

```bash
git submodule add https://github.com/g-truc/glm /external/glm
```

```cmake
add_subdirectory("${CMAKE_CURRENT_SOURCE_DIR}/external/glm")
target_link_libraries("${PROJECT_NAME}" PUBLIC glm)
```

Now, we can include the required GLM headers and define the transformation matrices. We usually start with a unit matrix, and call either one of `glm::rotate`, `glm::scale`, or `glm::translate`, to obtain a combined matrix. Since GLM, like OpenGL, represents matrices in **column-major** order, we place the first transformation to apply at the end in the multiplication.

```cpp
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
int main() {
  // vertex specification & shader creation
  // ...
  auto unit = glm::mat4(1.0f);
  // a uniform scale of .5
  auto scale = glm::scale(unit, glm::vec3(0.5f, 0.5f, 0.5f));
  // rotate 90 degrees around the z-axis
  auto rotate = glm::rotate(unit, glm::radians(90.0f), glm::vec3(0.0f, 0.0f, 1.0f));
  // translate by (.3, .2, .1)
  auto translate = glm::translate(unit, glm::vec3(0.3f, 0.2f, 0.1f));
  // construct the transform matrix
  auto transform = translate * rotate * scale;
  // ...
}
```

A transformation is typically defined per object — it applies to all vertices of that object. When a draw call (e.g., `glDrawArrays`) is issued, GPU launches many shader invocations in parallel — one per vertex, fragment, etc. GLSL defines per-draw, read-only constants called **uniforms** that are stored in a dedicated, broadcast-friendly area in GPU memory. Every thread can access these uniforms at no additional cost.

> Uniform variables are global to the program object; if both vertex and fragment shaders define the same uniform, the linker treats them as referring to the same data.

In our vertex shader, we can define a uniform of type `mat4` for the transform matrix. Then, we multiply the position vector with this matrix to obtain a final position. Notice that we represent the position in homogenous coordinates so that it's compatible with the matrix, and the $w$ component is `1.0` since this is a position vector.

```glsl
#version 330 core
layout(location = 0) in vec3 i_pos;
uniform mat4 transform;
void main() {
  gl_Position = transform * vec4(i_pos, 1.0);
}
```

To send the transform matrix to the shader, we first need to query its location via `glGetUniformLocation`. It's advised to cache this location for later use since every communication with the graphics driver adds some latency. Then, we can send the transform data by calling `glUniformMatrix4fv` with the following arguments: location, the number of matrices to set, whether to transpose the matrix, and a pointer to the matrix data.

```cpp
glUseProgram(shaderProgram);
GLuint transformLoc = glGetUniformLocation(shaderProgram, "transform");
glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));
```

## Common Transformations

In most 3D applications, we define a few different coordinate spaces (or frames) to make it easier to perform and reason about certain operations. We set initial vertex positions with respect to a local frame that's defined per object (model) so that they can be created independently (by multiple artists). Then, we bring multiple objects into a common (world) frame so that we can talk about their relative properties and make them interact with each other. We are only interested in a portion of this world that is visible to a camera, so we bring everything to a new (view) frame where the camera is at the origin. Finally, we define a volume that contains all the visible vertices, and discard the rest.

The use of multiple spaces requires us to apply a sequence of transformations to obtain the final (screen) position. However, they make it easier to selectively update any of the transform matrices. For example, if a 3D scene contains multiple cameras, and we want to give the user the ability to switch between them, then we only need to update the view matrix and can keep the rest.

The matrix that transforms a point defined in an object's local frame to a point in the world frame is called the **model** matrix, and it's obtained the same way we constructed the `transform` matrix in the previous chapter. The matrix that moves points in the world frame to the camera's local frame is called the **view** matrix. The process to construct a view matrix is a bit different because of how we represent a camera in computer graphics. Unlike object, world and view spaces, clip space does not define a coordinate frame — it defines a bounded volume. The coordinates in the clip space are only meaningful relative to the $w$ component, and their values are bounded by it. The matrix that transforms view space to clip space is called the **projection** matrix. Once everything is in clip space, an operation called **perspective division** maps clip space to NDC space.

## Camera

View space can be defined as the camera's coordinate frame. GLM provides `glm::lookAt` to calculate the view matrix, which accepts three inputs: `eye` (camera position in world space), `center` (target position in world space), and `up` (positive $y$ direction in world space). GLM internally calculates a **forward** ($z$) vector by subtracting the camera position from the target position. Then, it obtains a **right** ($x$) vector by taking the cross product of the forward and up vectors. Because the provided up vector might not be orthogonal to both the forward and right vectors, GLM calculates a local **up** ($y$) vector by taking the cross product of these two vectors. The final three direction vectors with the camera at the origin constitute a new coordinate frame.

```cpp
static constexpr glm::vec3 WORLD_UP = glm::vec3(0.0f, 1.0f, 0.0f);
auto position = glm::vec3(-2.0f, 2.0f, 2.0f);
auto target = glm::vec3(0.0f, 0.0f, 0.0f);
auto view = glm::lookAt(position, target, WORLD_UP);
```

The view matrix can also be constructed manually by first calculating the camera's basis vectors, then forming the rotation and translation matrices, and finally combining them. The way we form the rotation matrix is by placing each basis vector in a column — `glm::mat4` constructor accepts column vectors as input. When the matrix is constructed this way, every row contains a component from each basis vector — a rotation is expressed as a linear combination of the basis vectors.

> Don't forget to normalize the results, because we're only interested in directions.

```cpp
auto forward = glm::normalize(target - position);
auto right = glm::normalize(glm::cross(forward, WORLD_UP));
auto up = glm::cross(right, forward);
auto rotate = glm::mat4(glm::vec4(right, 0.0f), glm::vec4(up, 0.0f), glm::vec4(-forward, 0.0f), glm::vec4(0.0f, 0.0f, 0.0f, 1.0f));
auto translate = glm::translate(glm::mat4(1.0f), -position);
auto view = rotate * translate;
```

To make the camera the origin point of this new coordinate frame, we apply a translation that is equal to the negative of the `position` vector — their sum is $(0,0,0)$. OpenGL uses the right-handed coordinate system, and expects the camera to look along the negative $z$-axis in view space, i.e., objects in front of the camera should have negative $z$ coordinates. As a result, what's considered "forward" in world space should map to negative $z$ in view space. To achieve this, we negate the `forward` vector when constructing the rotation matrix, regardless of its world space direction. Also, notice that translation is applied first, then rotation. This is because we want to rotate objects around the camera, not the world origin.

### Camera Movement

In many applications, like most games, we have a moving camera that the user can control in some way. So far, we've hardcoded the arguments when creating a view matrix. In practice, this matrix can be updated as frequently as every frame, e.g., in an FPS game. To implement this, all we need to do is to call the `glm::lookAt` function in the render loop, and specify a dynamic target that is in front of the camera. We've learned that the target position is needed to calculate a `forward` vector. This calculation, however, can also be done in reverse — we can obtain a target by adding the forward vector to the current position. The forward vector must be initialized beforehand, though.

```cpp
auto forward = glm::vector3(0.0f, 0.0f, -1.0f);
auto view = glm::lookAt(position, position + forward, up);
```

It would be nice if we could move the camera with key presses. Remember that GLFW can also receive input events — we can read the WASD keys to update the camera position. `glfwGetKey` is the function we call to read key status, which takes two inputs: the `window` pointer, and a key ID. The return value is compared against a predefined action, e.g., `GLFW_PRESS`, for confirmation.

> Despite not being shown explicitly in some code blocks, if something has to be done every frame, e.g., reading inputs, it goes in the render loop.

```cpp
static constexpr float speed = 0.05f;
if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
  position += forward * speed;
if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
  position -= forward * speed;
if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
  position += right * speed;
if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
  position -= right * speed;
```

One thing to notice is that the final position after $1$ second depends on how many frames have been rendered, which is hardware-dependent. However, we usually want to have consistent results across different hardware. We can achieve this by scaling the increment amounts with the real time that passed to render the frame. Since we can't calculate the frame time before the current frame ends, we use the most recent value instead. The time between two consecutive frames is called the **delta time**, and it can be calculated by subtracting the last frame's time from the current time (at the beginning of the loop).

```cpp
auto deltaTime = 0.0f;
auto lastFrame = 0.0f;
while (!glfwWindowShouldClose(window)) {
  float currentFrame = glfwGetTime();
  deltaTime = currentFrame - lastFrame;
  lastFrame = currentFrame;
  if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
    position += forward * speed * deltaTime;
  // ...
}
```

Even though we can move on the $xz$-plane, we are currently stuck with the same camera orientation — basis vectors do not change. To turn around, we would need to update the forward vector, and the others accordingly. Since we are talking about rotations, we could use Euler angles to represent them. We can use the avionics terms to describe the rotations: pitch, yaw, and roll. We will bind these to mouse movements. However, a mouse moves on a plane, so a roll movement is not possible. Front-back movement can represent pitch, and left-right movement can be interpreted as yaw. We can achieve $360^\circ$ coverage with combinations of pitch and yaw values.

Counter-clockwise rotations are considered positive in OpenGL. We usually represent rotations in radians, which is the format expected by GLM. A rotation that makes an angle $\beta$ (`yaw`) around the $y$-axis has a projection along the $x$-axis with length $\cos{\beta}$, and along the $z$-axis with length $\sin{\beta}$. Similarly, a rotation by an angle $\alpha$ (`pitch`) around the $x$-axis has a projection on the $xz$-plane with length $\cos{\alpha}$, and along the $y$-axis with length $\sin{\alpha}$. If we combine these, we obtain the following equations for the components of the `forward` vector.

```cpp
forward.x = cos(yaw) * cos(pitch);
forward.y = sin(pitch);
forward.z = sin(yaw) * cos(pitch);
```

If `forward` vector is modified, `right` and `up` vectors should be updated as well to re-orient the coordinate frame.

```cpp
right = glm::normalize(glm::cross(forward, WORLD_UP));
up = glm::normalize(glm::cross(right, forward));
```

Remember that we can register callbacks for input events with GLFW during initialization. We can move the update logic related to camera axes into the cursor position callback. We will assume that they are defined globally, and are accessible in this function. In a serious project, we would need to re-structure this code.

In the following callback function, we calculate the difference in mouse position between calls, then scale it with a sensitivity term, and finally add the horizontal ($x$) difference to `yaw` and the vertical ($y$) difference to `pitch`. The $y$ difference is negated because screen coordinates range from top to bottom. Also, if you look at the calculation of the `forward` vector again, you'll see that at pitch angles close to $\pm90^\circ$, both $x$ and $z$ components approach $0$ while $y$ goes to $1$, resulting in the `forward` vector aligning with the `up` vector. Consequently, the cross product used to calculate the `right` vector becomes unstable, oscillating near $(0,0,0)$, which causes sudden $180^\circ$ flips (i.e., "up" becomes "down" and vice versa). Hence, it's advised to limit the pitch to some safe range like $[-89^\circ,89^\circ]$.

> We change the cursor mode to `GLFW_CURSOR_DISABLED` during initialization so that the cursor becomes invisible and can't leave the window, while allowing for unlimited mouse movement (i.e., position is no longer clamped to screen edges).

```cpp
void CursorPosCallback(GLFWwindow* window, double xpos, double ypos) {
  static constexpr float PITCH_LIMIT = glm::radians(89.0f);
  static constexpr float SENSITIVITY = 0.001f;
  static auto firstEnter = true;
  static glm::vec2 mousePos;
  static glm::vec2 mouseLast;
  static glm::vec2 mouseDiff;
  mousePos.x = xpos;
  mousePos.y = ypos;
  if (firstEnter)
    mouseLast = mousePos;
  firstEnter = false;
  mouseDiff.x = (mousePos.x - mouseLast.x) * SENSITIVITY;
  mouseDiff.y = (mouseLast.y - mousePos.y) * SENSITIVITY;
  mouseLast = mousePos;
  yaw += mouseDiff.x;
  pitch += mouseDiff.y;
  pitch = std::clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
  // update camera's basis vectors
  // update the view matrix
}
int main() {
  // ...
  glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
  glfwSetCursorPosCallback(window, CursorPosCallback);
  // ...
}
```

> Since the cursor can enter the window at an arbitrary position, we initially set `mouseLast` to `mousePos` to prevent a sudden jump.

## Projection

Clip space is the result of applying a projection matrix to a region of the view space defined by some boundaries. This bounded region is called the **viewing volume**, and any point inside this volume that survives the **depth test** will end up on the screen. In clip space, points are represented using homogenous coordinates, i.e., $(x,y,z,w)$, and are not yet normalized, i.e., they're not in the form $(x',y',z')$. The $w$ component was added for convenience — to enable translation to be expressed as matrix multiplication. At projection stage, we repurpose this component to store the depth information. But, $z$ already represents depth (distance from camera) in view space, why do we need to use the $w$ component? After applying the projection, $z$ is no longer the original depth — it's been remapped for the depth buffer (usually to $[0,1]$ range). The projection matrix typically puts the original view space $z$ value into $w$. Note that this is only needed when **perspective projection** is used — for perspective division that happens after the projection matrix is applied. On the other hand, in **orthographic projection**, $w$ remains $1$ throughout the pipeline. Now, let's explore these two types of projection.

### Orthographic Projection

This type of projection is an affine transformation — it preserves straight lines, and ratios along a line (e.g., midpoints stay midpoints). It can be expressed as a combination of a linear transformation and a translation in Cartesian coordinates. To create an orthographic projection matrix, we first define a cubic viewing volume (a **cuboid**) bounded by six axis-aligned planes: near ($n$), far ($f$), left ($l$), right ($r$), bottom ($b$), and top ($t$). Then, we calculate the scaling factors and translation amounts that map each point in this volume to clip space ($[l, r][b, t][n, f] \rightarrow [-1,1]^3$), which is equal to NDC when using orthographic projection.

> $x_e$ is the eye (view) space, $x_c$ is the clip space, and $x_n$ is the NDC space coordinate.

$$
\begin{align}
\frac{x_c}{1-(-1)} = \frac{x_e-\frac{r+l}{2}}{r-l} \Rightarrow x_c = \frac{2x_e-(r+l)}{r-l} \\
y_c = \frac{2y_e-(t+b)}{t-b} \\
\frac{z_c}{1-(-1)} = -\frac{z_e-\frac{f+n}{2}}{f-n} \Rightarrow z_c = \frac{2z_e-(f+n)}{n-f}
\end{align}
$$

We subtract the midpoint, e.g., $(r+l)\div2$, from each coordinate so that the points on the left map to $[-1,0]$ while those on the right map to $[0,1]$. The cuboid is usually centered on the $xy$-plane, i.e., $l$ and $b$ are equal to negative $r$ and $t$, respectively. By convention, near and far planes are given as positive distances. As opposed to view space, NDC uses the left-handed coordinate system, i.e., **far** maps to $1$, and **near** maps to $-1$. Scale along the $z$-axis is negated, because larger (less negative) $z$ coordinates represent points that are closer to the near plane. This set of equations can be written in matrix form as follows:

$$
\begin{bmatrix}
x_n \\
y_n \\
z_n \\
w_n
\end{bmatrix} =
\begin{bmatrix}
x_c \\
y_c \\
z_c \\
w_c
\end{bmatrix} =
M_{orthographic}\vec{v_e} =
\begin{bmatrix}
\frac{2}{r-l} & 0 & 0 & -\frac{r+l}{r-l} \\
0 & \frac{2}{t-b} & 0 & -\frac{t+b}{t-b} \\
0 & 0 & -\frac{2}{f-n} & -\frac{f+n}{f-n} \\
0 & 0 & 0 & 1
\end{bmatrix}
\begin{bmatrix}
x_e \\
y_e \\
z_e \\
w_e
\end{bmatrix}
$$

This matrix can be created by calling `glm::ortho` with the plane coordinates as inputs. To prevent stretching or squashing due to a mismatch in aspect ratio between the viewport and the viewing volume, we multiply the width (length along the $x$-axis) of the cuboid with the aspect ratio ($width/height$).

```cpp
auto size = 2.0f;
auto aspect = 16.0f / 9;
auto near = 0.1f;
auto far = 100.0f;
auto left = -size * aspect;
auto bottom = -size;
glm::mat4 projection = glm::ortho(left, -left, bottom, -bottom, near, far);
```

### Perspective Projection

Orthographic projection has its uses in many engineering applications since it preserves relative sizes of objects, i.e., there is no sense of depth. However, in many other 3D applications, we want to see realistic results. In the context of projection, realism can be achieved by simulating the natural phenomenon of perspective foreshortening — objects appear smaller when they are moved farther away from the eye (camera). For example, a human that is close to the camera may appear the same height as a mountain that is miles away. It's clear that a cuboid cannot represent this viewing volume — if it barely covers a human close to the near frame, it will cover only a fraction of the mountain at the other end, due to both faces having the same area. A more appropriate volume would have a pyramid-like shape, which extends in cross-sectional area with increasing distance. However, its top will be cut off due to near plane being slightly larger than zero (for various reasons). This unique shape is called a **frustum**.

In orthographic projection, we projected each component of a point independently through linear transformations (scale + translate). In perspective projection, we have to map points on both near and far planes (and those in between) to the same $[-1,1]$ range, which implies that the larger plane must be "squeezed" more, and the scale amount is proportional to the depth. Scaling by $z$ (depth) is not a linear transformation — it's division by a component of the input vector. This cannot be represented as matrix multiplication; hence, it has to happen in a separate step called **perspective division**, after the projection matrix has been applied. Since we will lose the original $z_e$ value when we move from view space to clip space, we will store it in the $w_c$ component.

We can hypothetically project any point inside the frustum onto the near plane to have a better understanding of where each point will end up in the final image. In the process, we calculate the ratios between the $x_e$ and $y_e$ coordinates and their projections ($x_p$ and $y_p$) using the properties of similar triangles.

$$
\begin{align}
\frac{x_p}{x_e} = \frac{n}{-z_e} \Rightarrow x_p = x_e\frac{n}{-z_e} \\
\frac{y_p}{y_e} = \frac{n}{-z_e} \Rightarrow y_p = y_e\frac{n}{-z_e}
\end{align}
$$

Once they're on the near plane, we can linearly map both $x_p$ and $y_p$ to NDC ($x_n$ and $y_n$) just like we did in orthographic projection. However, we were supposed to go from eye space to NDC, so we need to rewrite the projected coordinates in terms of the eye space coordinates, which we calculated above. Remember that we can't represent division by $-z_e$ in matrix form, which is the reason we'll store the value in $w_c$. Hence, we can get rid of the $-z_e$ in the denominator by multiplying everything by it. Notice that the multiplication of the NDC coordinates with $z_e$ are just clip space coordinates.

$$
\begin{align}
x_n = \frac{2x_p}{r-l}-\frac{r+l}{r-l} \Rightarrow x_n = \frac{2nx_e}{-z_e(r-l)}-\frac{r+l}{r-l} \Rightarrow -z_ex_n = \frac{2nx_e}{r-l}+\frac{z_e(r+l)}{r-l} = x_c \\
-z_ey_n = \frac{2ny_e}{t-b}+\frac{z_e(t+b)}{t-b} = y_c
\end{align}
$$

Projecting $z_e$ onto the near plane would result in all having the same $-n$ value since they are along the same axis. So, there is not much information to gain from that. We know that $z_n$ does not depend on $x_e$ or $y_e$, so we can write it as a linear combination of $z_e$ and $w_e$. In eye space, $w$ is 1, so the equation can be written as follows:

$$
z_n = \frac{z_c}{w_c} = \frac{az_e+bw_e}{-z_e} = \frac{az_e+b}{-z_e}
$$

We want to map $[-n,-f]$ to $[-1,1]$ when transforming eye coordinates to NDC, which gives us two equations to solve for $a$ and $b$.

$$
\begin{align}
-1 = \frac{-na+b}{n},\, 1 = \frac{-fa+b}{f} \Rightarrow a = -\frac{f+n}{f-n},\, b = -\frac{2fn}{f-n} \\
z_c = -z_ez_n = -\frac{f+n}{f-n}z_e -\frac{2fn}{f-n}
\end{align}
$$

We now have all the elements needed to construct the perspective projection matrix. Notice that the clip space $w$ component is equal to eye space $z$ after the multiplication, which is the value used in perspective divide to normalize all components of the clip space vector. This final step is performed by the GPU, and the result is the NDC coordinates.

$$
\begin{bmatrix}
x_c \\
y_c \\
z_c \\
w_c
\end{bmatrix} =
M_{perspective}\vec{v_e} =
\begin{bmatrix}
\frac{2n}{r-l} & 0 & \frac{r+l}{r-l} & 0 \\
0 & \frac{2n}{t-b} & \frac{t+b}{t-b} & 0 \\
0 & 0 & -\frac{f+n}{f-n} & -\frac{2fn}{f-n} \\
0 & 0 & -1 & 0
\end{bmatrix}
\begin{bmatrix}
x_e \\
y_e \\
z_e \\
w_e
\end{bmatrix}
$$

```cpp
auto fov = glm::radians(45.0f);
auto aspect = 16.0f / 9;
auto near = 0.1f;
auto far = 100.0f;
glm::mat4 projection = glm::perspective(fov, aspect, near, far);
```

## Depth Buffer

Perspective projection remaps $z$ into a normalized range $[-1,1]$ in NDC; however, unlike orthographic projection, this mapping is nonlinear (by design), which gives higher precision to depths closer to the near plane. For example, a point halfway between the near and far planes of the frustum will end up closer to the near side of the cube. This mimics how we see in real world — our eyes are more sensitive to depth changes nearby. On the other hand, it has side effects like **depth fighting** in distant geometry, i.e., there is not enough precision to reliably determine which vertex is in front of the other, and this leads to flickering, tearing or shimmering.

OpenGL stores a per-fragment depth information in a **depth buffer** (or $z$-buffer). Just like a color buffer, a default depth buffer is created by GLFW. When depth testing is enabled, OpenGL compares a fragment's depth with the existing value in the buffer; if the fragment is in front, value in the buffer is overwritten. This way, objects closer to the camera become the ones appearing in the final image. Depth testing is disabled by default — an OpenGL capability can be enabled via a `glEnable` call by specifying an ID. When it's enabled, depth buffer should be included in the `glClear` calls to remove residual data from the previous frame.

```cpp
glEnable(GL_DEPTH_TEST);
while (!glfwWindowShouldClose(window)) {
  glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
  // ...
}
```

Since we have enabled depth testing, we can correctly render more complex 3D shapes. Let's replace our triangle with a cube by specifying the positions of its $36$ vertices — a cube has six faces (quads), each of which is formed by two triangles (six vertices). Of the four vertices that define a quad (when connected), two are shared between the triangles that form the quad. Each corner of the cube is also shared by three faces. Depending on how we split the faces in half, the same vertex may appear three to six times in the `vertices` array.

```cpp
float vertices[] = {
  -0.5f, -0.5f, -0.5f, // 0
  0.5f, -0.5f, -0.5f, // 1
  0.5f, 0.5f, -0.5f, // 2
  0.5f, 0.5f, -0.5f, // 2
  -0.5f, 0.5f, -0.5f, // 3
  -0.5f, -0.5f, -0.5f, // 0
  -0.5f, -0.5f, 0.5f, // 4
  0.5f, -0.5f, 0.5f, // 5
  0.5f, 0.5f, 0.5f, // 6
  0.5f, 0.5f, 0.5f, // 6
  -0.5f, 0.5f, 0.5f, // 7
  -0.5f, -0.5f, 0.5f, // 4
  -0.5f, 0.5f, 0.5f, // 7
  -0.5f, 0.5f, -0.5f, // 3
  -0.5f, -0.5f, -0.5f, // 0
  -0.5f, -0.5f, -0.5f, // 0
  -0.5f, -0.5f, 0.5f, // 4
  -0.5f, 0.5f, 0.5f, // 7
  0.5f, 0.5f, 0.5f, // 6
  0.5f, 0.5f, -0.5f, // 2
  0.5f, -0.5f, -0.5f, // 1
  0.5f, -0.5f, -0.5f, // 1
  0.5f, -0.5f, 0.5f, // 5
  0.5f, 0.5f, 0.5f, // 6
  -0.5f, -0.5f, -0.5f, // 0
  0.5f, -0.5f, -0.5f, // 1
  0.5f, -0.5f, 0.5f, // 5
  0.5f, -0.5f, 0.5f, // 5
  -0.5f, -0.5f, 0.5f, // 4
  -0.5f, -0.5f, -0.5f, // 0
  -0.5f, 0.5f, -0.5f, // 3
  0.5f, 0.5f, -0.5f, // 2
  0.5f, 0.5f, 0.5f, // 6
  0.5f, 0.5f, 0.5f, // 6
  -0.5f, 0.5f, 0.5f, // 7
  -0.5f, 0.5f, -0.5f // 3
};
```

Duplicates are fine since they do not inherently harm performance, as long as there is enough GPU memory. In fact, they are often necessary, e.g., when we need to encode per-face attributes such as surface normals. However, in this case, we only have position attributes, and there is a more elegant way of representing this data. OpenGL provides a variety of targets for a buffer to bind to. One such target is `GL_ELEMENT_ARRAY_BUFFER`, which indicates that the buffer contains indices. An index buffer is often referred to as an **Element Buffer Object (EBO)**. An EBO is VAO-specific, which means a VAO can only refer to one such buffer. During indexed rendering, the stored indices are used to access the elements in any vertex attribute buffer (VBO) that the bound VAO refers to (via attribute pointers).

> A VBO can be unbound before the VAO is, as long as the attribute pointers have already been configured. In contrast, unbinding an EBO while a VAO is bound will disassociate it from that VAO.

We can reduce the size of the `vertices` array from $36$ positions to just $8$, one for each corner, by introducing an `indices` array that defines the triangles.

```cpp
float vertices[] = {
  -0.5f, -0.5f, -0.5f, // 0
  0.5f, -0.5f, -0.5f, // 1
  0.5f, 0.5f, -0.5f, // 2
  -0.5f, 0.5f, -0.5f, // 3
  -0.5f, -0.5f, 0.5f, // 4
  0.5f, -0.5f, 0.5f, // 5
  0.5f, 0.5f, 0.5f, // 6
  -0.5f, 0.5f, 0.5f, // 7
};
unsigned int indices[] = {
  0, 1, 2,
  2, 3, 0,
  4, 5, 6,
  6, 7, 4,
  7, 3, 0,
  0, 4, 7,
  6, 2, 1,
  1, 5, 6,
  0, 1, 5,
  5, 4, 0,
  3, 2, 6,
  6, 7, 3
};
```

Previously, we had to store $36\cdot 3\cdot 4=432$ bytes of data (a `float` is $4$ bytes in most systems); now, we only need a storage area of $8\cdot 3\cdot 4+12\cdot 3\cdot 4=240$ bytes, which is a $44\%$ reduction. If a `byte` or `short` is sufficient to store the indices, and vertex reuse is high in the mesh, memory savings can be even more. However, GPUs today have huge amounts of memory, which makes it pointless to look for small optimizations like this. Now, let's see how we would use the `indices` buffer to draw a cube.

```cpp
GLuint ebo;
glGenBuffers(1, &ebo);
glBindVertexArray(vao);
glBindBuffer(GL_ARRAY_BUFFER, vbo);
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo);
glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);
glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
glEnableVertexAttribArray(0);
```

In the render loop, we simply bind the VAO and call `glDrawElements` by specifying the draw mode, index count, index type, and an index buffer pointer if no EBO is used.

```cpp
glUseProgram(shaderProgram);
glBindVertexArray(vao);
glDrawElements(GL_TRIANGLES, 36, GL_UNSIGNED_INT, 0);
glBindVertexArray(0);
```

## MVP

To obtain the final position of a vertex in clip space, we apply the model, view and projection (MVP) transforms in succession ($PVM\vec{v}$). Our vertex shader now has three `uniform mat4` inputs each of whom shall be sent separately to the GPU. The model matrix should also encode parent transformations if there is a hierarchy.

```glsl
#version 330 core
layout(location = 0) in vec3 i_pos;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
void main() {
  gl_Position = projection * view * model * vec4(i_pos, 1.0);
}
```

```cpp
auto model = glm::mat4(1.0f);
model = glm::rotate(model, glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f));
auto view = glm::mat4(1.0f);
view = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));
glm::mat4 projection;
projection = glm::perspective(glm::radians(45.0f), 800.0f / 600.0f, 0.1f, 100.0f);
// ...
glUseProgram(shaderProgram);
auto modelLoc = glGetUniformLocation(shaderProgram, "model");
glUniformMatrix4fv(modelLoc, 1, GL_FALSE, glm::value_ptr(model));
// ...
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

These debug messages may help you identify common issues such as buffer-target mismatches; however, there are more nuanced issues that do not necessarily generate error messages, but can only be identified visually while the application is running. Tools like [RenderDoc](https://renderdoc.org/) allow you to capture frames, step through every draw call, view GPU resources (e.g., textures), inspect pipeline stages, and visually debug meshes and vertex attributes.

---

_To be continued..._
