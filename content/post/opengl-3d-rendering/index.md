---
title: "3D Rendering With OpenGL"
date: 2025-08-30
tags: ["C++", "OpenGL"]
series: "OpenGL"
math: true
shader: cover.glsl
---

## Common Transformations

In most 3D applications, we define a few different coordinate spaces (or frames) to make it easier to perform and reason about certain operations. We set initial vertex positions with respect to a local frame that's defined per object (model) so that they can be created independently (by multiple artists). Then, we bring multiple objects into a common (world) frame so that we can talk about their relative properties and make them interact with each other. We are only interested in a portion of this world that is visible to a camera, so we bring everything to a new (view) frame where the camera is at the origin. Finally, we define a volume that contains all the visible vertices, and discard the rest.

The use of multiple spaces requires us to apply a sequence of transformations to obtain the final (screen) position. However, they make it easier to selectively update any of the transform matrices. For example, if a 3D scene contains multiple cameras, and we want to give the user the ability to switch between them, then we only need to update the view matrix and can keep the rest.

The matrix that transforms a point defined in an object's local frame to a point in the world frame is called the **model** matrix, and it's obtained the same way we constructed the `transform` matrix in the previous chapter. The matrix that moves points in the world frame to the camera's local frame is called the **view** matrix. The process to construct a view matrix is a bit different because of how we represent a camera in computer graphics. Unlike object, world and view spaces, clip space does not define a coordinate frame — it defines a bounded volume. The coordinates in the clip space are only meaningful relative to the _w_ component, and their values are bounded by it. The matrix that transforms view space to clip space is called the **projection** matrix. Once everything is in clip space, an operation called **perspective division** maps clip space to NDC space.

## Camera

View space can be defined as the camera's coordinate frame. GLM provides `glm::lookAt` to calculate the view matrix, which accepts three inputs: `eye` (camera position in world space), `center` (target position in world space), and `up` (positive _y_ direction in world space). GLM internally calculates a **forward** (_z_) vector by subtracting the camera position from the target position. Then, it obtains a **right** (_x_) vector by taking the cross product of the forward and up vectors. Because the provided up vector might not be orthogonal to both the forward and right vectors, GLM calculates a local **up** (_y_) vector by taking the cross product of these two vectors. The final three direction vectors with the camera at the origin constitute a new coordinate frame.

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

To make the camera the origin point of this new coordinate frame, we apply a translation that is equal to the negative of the `position` vector — their sum is $(0,0,0)$. OpenGL uses the right-handed coordinate system, and expects the camera to look along the negative _z_-axis in view space, i.e., objects in front of the camera should have negative _z_ coordinates. As a result, what's considered "forward" in world space should map to negative _z_ in view space. To achieve this, we negate the `forward` vector when constructing the rotation matrix, regardless of its world space direction. Also, notice that translation is applied first, then rotation. This is because we want to rotate objects around the camera, not the world origin.

### Camera Movement

In many applications, like most games, we have a moving camera that the user can control in some way. So far, we've hardcoded the arguments when creating a view matrix. In practice, this matrix can be updated as frequently as every frame, e.g., in an FPS game. To implement this, all we need to do is to call the `glm::lookAt` function in the render loop, and specify a dynamic target that is in front of the camera. We've learned that the target position is needed to calculate a `forward` vector. This calculation, however, can also be done in reverse — we can obtain a target by adding the forward vector to the current position. The forward vector must be initialized beforehand, though.

```cpp
auto forward = glm::vector3(0.0f, 0.0f, -1.0f);
auto view = glm::lookAt(position, position + forward, up);
```

It would be nice if we could move the camera with key presses. Remember that GLFW can also receive input events — we can read the WASD keys to update the camera position. `glfwGetKey` is the function we call to read key state, which takes two inputs: the `window` pointer, and a key ID. The return value is compared against a predefined action, e.g., `GLFW_PRESS`, for confirmation.

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

One thing to notice is that the final position after 1 second depends on how many frames have been rendered, which is hardware-dependent. However, we usually want to have consistent results across different hardware. We can achieve this by scaling the increment amounts with the real time that passed to render the frame. Since we can't calculate the frame time before the current frame ends, we use the most recent value instead. The time between two consecutive frames is called the **delta time**, and it can be calculated by subtracting the last frame's time from the current time (at the beginning of the loop).

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

Even though we can move on the _xz_-plane, we are currently stuck with the same camera orientation — basis vectors do not change. To turn around, we would need to update the forward vector, and the others accordingly. Since we are talking about rotations, we could use Euler angles to represent them. We can use the avionics terms to describe the rotations: pitch, yaw, and roll. We will bind these to mouse movements. However, a mouse moves on a plane, so a roll movement is not possible. Front-back movement can represent pitch, and left-right movement can be interpreted as yaw. We can achieve $360^\circ$ coverage with combinations of pitch and yaw values.

Counter-clockwise rotations are considered positive in OpenGL. We usually represent rotations in radians, which is the format expected by GLM. A rotation that makes an angle $\beta$ (`yaw`) around the _y_-axis has a projection along the _x_-axis with length $\cos{\beta}$, and along the _z_-axis with length $\sin{\beta}$. Similarly, a rotation by an angle $\alpha$ (`pitch`) around the _x_-axis has a projection on the _xz_-plane with length $\cos{\alpha}$, and along the _y_-axis with length $\sin{\alpha}$. If we combine these, we obtain the following equations for the components of the `forward` vector.

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

In the following callback function, we calculate the difference in mouse position between calls, then scale it with a sensitivity term, and finally add the horizontal (_x_) difference to `yaw` and the vertical (_y_) difference to `pitch`. The _y_ difference is negated because screen coordinates range from top to bottom. Also, if you look at the calculation of the `forward` vector again, you'll see that at pitch angles close to $\pm90^\circ$, both _x_ and _z_ components approach 0 while _y_ goes to 1, resulting in the `forward` vector aligning with the `up` vector. Consequently, the cross product used to calculate the `right` vector becomes unstable, oscillating near $(0,0,0)$, which causes sudden $180^\circ$ flips (i.e., "up" becomes "down" and vice versa). Hence, it's advised to limit the pitch to some safe range like $[-89^\circ,89^\circ]$.

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

Clip space is the result of applying a projection matrix to a region of the view space defined by some boundaries. This bounded region is called the **viewing volume**, and any point inside this volume that survives the **depth test** will end up on the screen. In clip space, points are represented using homogenous coordinates, i.e., $(x,y,z,w)$, and are not yet normalized, i.e., they're not in the form $(x',y',z')$. The _w_ component was added for convenience — to enable translation to be expressed as matrix multiplication. At projection stage, we repurpose this component to store the depth information. But, _z_ already represents depth (distance from camera) in view space, why do we need to use the _w_ component? After applying the projection, _z_ is no longer the original depth — it's been remapped for the depth buffer (usually to $[0,1]$ range). The projection matrix typically puts the original view space _z_ value into _w_. Note that this is only needed when **perspective projection** is used — for perspective division that happens after the projection matrix is applied. On the other hand, in **orthographic projection**, _w_ remains 1 throughout the pipeline. Now, let's explore these two types of projection.

### Orthographic Projection

This type of projection is an affine transformation — it preserves straight lines, and ratios along a line (e.g., midpoints stay midpoints). It can be expressed as a combination of a linear transformation and a translation in Cartesian coordinates. To create an orthographic projection matrix, we first define a cubic viewing volume (a **cuboid**) bounded by six axis-aligned planes: near (_n_), far (_f_), left (_l_), right (_r_), bottom (_b_), and top (_t_). Then, we calculate the scaling factors and translation amounts that map each point in this volume to clip space ($[l, r][b, t][n, f] \rightarrow [-1,1]^3$), which is equal to NDC when using orthographic projection.

> _x_e_ is the eye (view) space, _x_c_ is the clip space, and _x_n_ is the NDC space coordinate.

$$
\begin{aligned}
\frac{x_c}{1-(-1)} &= \frac{x_e-\frac{r+l}{2}}{r-l} \Rightarrow x_c = \frac{2x_e-(r+l)}{r-l} \\
y_c &= \frac{2y_e-(t+b)}{t-b} \\
\frac{z_c}{1-(-1)} &= -\frac{z_e-\frac{f+n}{2}}{f-n} \Rightarrow z_c = \frac{2z_e-(f+n)}{n-f}
\end{aligned}
$$

We subtract the midpoint, e.g., $(r+l)\div2$, from each coordinate so that the points on the left map to $[-1,0]$ while those on the right map to $[0,1]$. The cuboid is usually centered on the _xy_-plane, i.e., _l_ and _b_ are equal to negative _r_ and _t_, respectively. By convention, near and far planes are given as positive distances. As opposed to view space, NDC uses the left-handed coordinate system, i.e., **far** maps to 1, and **near** maps to $-1$. Scale along the _z_-axis is negated, because larger (less negative) _z_ coordinates represent points that are closer to the near plane. This set of equations can be written in matrix form as follows:

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

This matrix can be created by calling `glm::ortho` with the plane coordinates as inputs. To prevent stretching or squashing due to a mismatch in aspect ratio between the viewport and the viewing volume, we multiply the width (length along the _x_-axis) of the cuboid with the aspect ratio ($width/height$).

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

In orthographic projection, we projected each component of a point independently through linear transformations (scale + translate). In perspective projection, we have to map points on both near and far planes (and those in between) to the same $[-1,1]$ range, which implies that the larger plane must be "squeezed" more, and the scale amount is proportional to the depth. Scaling by _z_ (depth) is not a linear transformation — it's division by a component of the input vector. This cannot be represented as matrix multiplication; hence, it has to happen in a separate step called **perspective division**, after the projection matrix has been applied. Since we will lose the original _z_e_ value when we move from view space to clip space, we will store it in the _w_c_ component.

We can hypothetically project any point inside the frustum onto the near plane to have a better understanding of where each point will end up in the final image. In the process, we calculate the ratios between the _x_e_ and _y_e_ coordinates and their projections (_x_p_ and _y_p_) using the properties of similar triangles.

$$
\begin{aligned}
\frac{x_p}{x_e} &= \frac{n}{-z_e} \Rightarrow x_p = x_e\frac{n}{-z_e} \\
\frac{y_p}{y_e} &= \frac{n}{-z_e} \Rightarrow y_p = y_e\frac{n}{-z_e}
\end{aligned}
$$

Once they're on the near plane, we can linearly map both _x_p_ and _y_p_ to NDC (_x_n_ and _y_n_) just like we did in orthographic projection. However, we were supposed to go from eye space to NDC, so we need to rewrite the projected coordinates in terms of the eye space coordinates, which we calculated above. Remember that we can't represent division by $-z_e$ in matrix form, which is the reason we'll store the value in _w_c_. Hence, we can get rid of the $-z_e$ in the denominator by multiplying everything by it. Notice that the multiplication of the NDC coordinates with _z_e_ are just clip space coordinates.

$$
\begin{aligned}
x_n &= \frac{2x_p}{r-l}-\frac{r+l}{r-l} \Rightarrow x_n = \frac{2nx_e}{-z_e(r-l)}-\frac{r+l}{r-l} \\
&\Rightarrow -z_ex_n = \frac{2nx_e}{r-l}+\frac{z_e(r+l)}{r-l} = x_c \\
-z_ey_n &= \frac{2ny_e}{t-b}+\frac{z_e(t+b)}{t-b} = y_c
\end{aligned}
$$

Projecting _z_e_ onto the near plane would result in all having the same $-n$ value since they are along the same axis. So, there is not much information to gain from that. We know that _z_n_ does not depend on _x_e_ or _y_e_, so we can write it as a linear combination of _z_e_ and _w_e_. In eye space, _w_ is 1, so the equation can be written as follows:

$$
z_n = \frac{z_c}{w_c} = \frac{az_e+bw_e}{-z_e} = \frac{az_e+b}{-z_e}
$$

We want to map $[-n,-f]$ to $[-1,1]$ when transforming eye coordinates to NDC, which gives us two equations to solve for _a_ and _b_.

$$
\begin{aligned}
-1 &= \frac{-na+b}{n},\, 1 = \frac{-fa+b}{f} \\
\Rightarrow a &= -\frac{f+n}{f-n},\, b = -\frac{2fn}{f-n} \\
z_c &= -z_ez_n = -\frac{f+n}{f-n}z_e -\frac{2fn}{f-n}
\end{aligned}
$$

We now have all the elements needed to construct the perspective projection matrix. Notice that the clip space _w_ component is equal to eye space _z_ after the multiplication, which is the value used in perspective divide to normalize all components of the clip space vector. This final step is performed by the GPU, and the result is the NDC coordinates.

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

Perspective projection remaps _z_ into a normalized range $[-1,1]$ in NDC; however, unlike orthographic projection, this mapping is nonlinear (by design), which gives higher precision to depths closer to the near plane. For example, a point halfway between the near and far planes of the frustum will end up closer to the near side of the cube. This mimics how we see in real world — our eyes are more sensitive to depth changes nearby. On the other hand, it has side effects like **depth fighting** in distant geometry, i.e., there is not enough precision to reliably determine which vertex is in front of the other, and this leads to flickering, tearing or shimmering.

OpenGL stores a per-fragment depth information in a **depth buffer** (or _z_-buffer). Just like a color buffer, a default depth buffer is created by GLFW. When depth testing is enabled, OpenGL compares a fragment's depth with the existing value in the buffer; if the fragment is in front, value in the buffer is overwritten. This way, objects closer to the camera become the ones appearing in the final image. Depth testing is disabled by default — an OpenGL capability can be enabled via a `glEnable` call by specifying an ID. When it's enabled, depth buffer should be included in the `glClear` calls to remove residual data from the previous frame.

```cpp
glEnable(GL_DEPTH_TEST);
while (!glfwWindowShouldClose(window)) {
  glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
  // ...
}
```

Since we have enabled depth testing, we can correctly render more complex 3D shapes. Let's replace our triangle with a cube by specifying the positions of its 36 vertices — a cube has six faces (quads), each of which is formed by two triangles (six vertices). Of the four vertices that define a quad (when connected), two are shared between the triangles that form the quad. Each corner of the cube is also shared by three faces. Depending on how we split the faces in half, the same vertex may appear three to six times in the `vertices` array.

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

Duplicates are fine since they do not inherently harm performance, as long as there is enough GPU memory. In fact, they are often necessary, e.g., when we need to encode per-face attributes such as surface normals. However, in this case, we only have position attributes, and there is a more elegant way of representing this data.

OpenGL provides a variety of targets for a buffer to bind to. One such target is `GL_ELEMENT_ARRAY_BUFFER`, which indicates that the buffer contains indices. An index buffer is often referred to as an **Element Buffer Object (EBO)**. An EBO is VAO-specific, which means a VAO can only refer to one such buffer. During indexed rendering, the stored indices are used to access the elements in any vertex attribute buffer (VBO) that the bound VAO refers to (via attribute pointers).

> A VBO can be unbound before the VAO is, as long as the attribute pointers have already been configured. In contrast, unbinding an EBO while a VAO is bound will disassociate it from that VAO.

We can reduce the size of the `vertices` array from 36 positions to just 8, one for each corner, by introducing an `indices` array that defines the triangles.

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

Previously, we had to store $36\cdot 3\cdot 4=432$ bytes of data (a `float` is 4 bytes in most systems); now, we only need a storage area of $8\cdot 3\cdot 4+12\cdot 3\cdot 4=240$ bytes, which is a $44\%$ reduction. If a `byte` or `short` is sufficient to store the indices, and vertex reuse is high in the mesh, memory savings can be even more. However, GPUs today have huge amounts of memory, which makes it pointless to look for small optimizations like this. Now, let's see how we would use the `indices` buffer to draw a cube.

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
