---
title: "OpenGL Rendering Pipeline and Shaders"
date: 2025-08-28
tags: ["C++", "OpenGL", "GLSL"]
series: "OpenGL"
---

## Rendering Pipeline

The sequence of steps that OpenGL takes to transform **3D** shapes into **2D** images is called the **rendering pipeline**. This pipeline is designed as a streaming architecture and consists of several stages, each one requiring the output of the previous one as its input. These stages are highly specialized and can be executed in parallel on thousands of GPU cores today.

> Running in parallel means that while stage-A processes its new input, stage-B works on A's previous output, and so on.

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

Since this is the first stage in the pipeline, vertex data must be provided by the application. The vertex data can be as simple as an array of positions where each element is a `float` corresponding to a value on one of three axes $(x,y,z)$. For example, a triangle formed by vertices _A_, _B_, and _C_ can be defined as follows:

```cpp
float vertices[] = {
  // x, y, z
  -0.5f, -0.5f, 0.0f, // A
  0.5f, -0.5f, 0.0f, // B
  0.0f, 0.5f, 0.0f // C
};
```

> How will OpenGL know this array represents a triangle and not two lines (_AB_, _BC_, and no _CA_)? We will tell OpenGL how to connect these points when initiating draw calls.

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

> You must specify the shader version at the top of the shader using the `#version` directive.

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

> There is no need to re-send the buffer data, it's already in GPU memory — binding the VBO is enough.

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
const char* vertexSource = vertexText.c_str();
// compile the shader
GLuint vertexShader;
vertexShader = glCreateShader(GL_VERTEX_SHADER);
glShaderSource(vertexShader, 1, &vertexSource, NULL);
glCompileShader(vertexShader);
```

## Fragment Shader

A **fragment** contains all the data that is needed to shade a pixel. A **fragment shader** usually has a single color output. Unlike the vertex shader, there are no predefined output variables (they are deprecated). OpenGL assigns the location 0 to the first output by default, but it can also be specified manually, especially when there are multiple outputs. The following is a fragment shader that assigns a predefined color to the output. The fourth component in the color vector is the alpha value that is used in [blending](https://www.khronos.org/opengl/wiki/Blending).

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
  -0.5f, -0.5f, 0.0f, 1.0f, 0.0f, 0.0f, // A
  0.5f, -0.5f, 0.0f, 0.0f, 1.0f, 0.0f, // B
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

Finally, we need to update the attribute pointers so that they point to the correct locations in the buffer. The second set of calls now has 1 as the index argument, and the stride has been doubled since one set of attributes is now 6 `float`s long (3 for position, 3 for color). The offset value for the color attribute pointer must be 3 `float`s to correctly skip the position attribute. Also, the `vertices` array, which is in CPU memory, has been updated to include color values; hence, we need to update the GPU memory by sending the new array via `glBufferData`.

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
