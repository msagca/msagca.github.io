---
title: "Math and Transformations for OpenGL"
date: 2025-08-29
tags: ["C++", "OpenGL", "Linear Algebra"]
series: "OpenGL"
math: true
---

## Coordinate Spaces, Systems and Frames

Notice that so far, we've used points within the range $[-1,1]$ on all axes. Also, recall that our vertex shader did not do any transformations, and directly output the values we set via a VBO. For a vertex to be visible on the screen in OpenGL, it must be in **Normalized Device Coordinates (NDC)** after it is processed. NDC is a space where all coordinates are normalized to $[-1,1]^3$. These numbers, however, are merely percentages that need to be transformed to a coordinate frame, e.g., screen coordinates, to represent actual positions. Before we go any further, it's important to define the terms "space", "system" and "frame".

A **geometric space** is an abstract framework that defines the geometric rules (axioms), e.g., how to measure distances or angles, or how lines behave, to represent physical space. A **Euclidean** space is one such space where Euclidean geometry rules apply; for example, distances are calculated using the [Euclidean distance](https://en.wikipedia.org/wiki/Euclidean_distance) formula. A **coordinate system** describes how to uniquely specify each point in a space. A **Cartesian** coordinate system specifies points using real numbers called **coordinates**, which are the signed distances from perpendicular oriented lines called coordinate lines or axes. The point where these axes meet is called the **origin**. The direction vectors that represent these axes (e.g., $(1,0,0)$, $(0,1,0)$ and $(0,0,1)$) form an **orthogonal basis**, meaning that they are mutually orthogonal, and any vector in this system can be represented as a finite linear combination of these basis vectors. A **coordinate frame** is a specific instance of a coordinate system with a defined origin and basis. In computer graphics, a **coordinate space** usually means a frame of reference in space (a coordinate frame).

In graphics applications, some calculations can be done more efficiently and are more intuitive in certain coordinate spaces. We move a vector from one space to another by applying a **transformation**. Before diving into transformations, it's important to build a solid understanding of vectors and matrices.

## Vector Operations

A **vector** ($\vec{v}$) is a 1D array of numerical components. It can be of size _n_, which is the number of components the vector has. In computer graphics, we usually use vectors of size up to 4.

$$
\vec{a}
= \begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix}
$$

A **vector space** (_V_) defines a set of axioms (e.g., commutativity, associativity, etc.), and a set of vector operations (e.g., addition, multiplication, etc.) over a field (e.g., real numbers ($\mathbb{R}$)) in algebraic terms. A Euclidean space satisfies all the axioms of a vector space over the real numbers.

We can add or subtract a scalar (_c_) to or from a vector, or multiply or divide a vector by a scalar by simply applying this operation to each component of the vector.

$$
c\vec{a}
= c \begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix}
= \begin{bmatrix}
c \cdot a_1 \\
c \cdot a_2 \\
c \cdot a_3
\end{bmatrix}
$$

The **length** (magnitude) of a vector is defined as the square root of the sum of the squares of its components.

$$
\|\vec{a}\| = \sqrt{a_1^2+a_2^2+a_3^2}
$$

A vector can be **normalized** to obtain a **unit vector** (a vector with a length of 1) by dividing its components by its length. Unit vectors are easy to work with when we only care about a vector's direction.

> Normalizing does not change a vector's direction.

$$
\hat{a}
= \frac{\vec{a}}{\|\vec{a}\|}
= \frac{1}{\sqrt{a_1^2+a_2^2+a_3^2}}
\begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix}
$$

Two vectors of the same size can be added or subtracted through component-wise addition or subtraction.

$$
\vec{a} + \vec{b}
= \begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix} +
\begin{bmatrix}
b_1 \\
b_2 \\
b_3
\end{bmatrix}
= \begin{bmatrix}
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
\begin{aligned}
\vec{a} \cdot \vec{b}
&= \begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix} \cdot
\begin{bmatrix}
b_1 \\
b_2 \\
b_3
\end{bmatrix} \\
&= a_1b_1 + a_2b_2 + a_3b_3 \\
&= \|\vec{a}\| \|\vec{b}\| \cos{\theta}
\end{aligned}
$$

> If two vectors are perpendicular, their dot product is zero ($\cos{90^\circ} = 0$).

> Dot product is commutative, that is, $\vec{a}\cdot\vec{b}$ is equal to $\vec{b}\cdot\vec{a}$.

A geometric space, e.g., a Euclidean space, is a vector space plus an inner product that defines lengths of vectors, angles between vectors, or orthogonality. An **inner product**, e.g., the dot product, is an operation that takes two vectors and produces a single scalar in a way that encodes geometric meaning — it lets us talk about lengths, angles, and orthogonality inside a vector space.

### Cross Product

This operation takes two non-parallel vectors as input and outputs a vector that is orthogonal to both inputs. It will prove useful in future chapters.

$$
\begin{aligned}
\vec{a} \times \vec{b}
&= \begin{bmatrix}
a_1 \\
a_2 \\
a_3
\end{bmatrix} \times
\begin{bmatrix}
b_1 \\
b_2 \\
b_3
\end{bmatrix} \\
&= \begin{bmatrix}
a_2b_3 - a_3b_2 \\
a_3b_1 - a_1b_3 \\
a_1b_2 - a_2b_1
\end{bmatrix}
\end{aligned}
$$

## Matrix Operations

A **matrix** (_M_) is a 2D array of elements, where each element is identified by its row and column indices. If a matrix has _m_ rows and _n_ columns, it's an _mxn_ matrix, and these are called the matrix dimensions.

> If both dimensions are the same, then the matrix is called a **square matrix**.

A matrix-scalar product multiplies each element of the matrix by a scalar. Addition and subtraction can be done element-wise if both matrices have the same dimensions.

$$
\begin{aligned}
A + B
&= \begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix} +
\begin{bmatrix}
5 & 6 \\
7 & 8
\end{bmatrix} \\
&= \begin{bmatrix}
1 + 5 & 2 + 6 \\
3 + 7 & 4 + 8
\end{bmatrix} \\
&= \begin{bmatrix}
6 & 8 \\
10 & 12
\end{bmatrix}
\end{aligned}
$$

Two matrices, _A_ and _B_, can be multiplied (in this order) if the number of columns in _A_ is equal to the number of rows in _B_. Every element in a row of _A_ is multiplied by the corresponding element in a column of _B_. Then, these products are summed up to obtain one element in the resulting matrix _C_. The result obtained from processing row _i_ of _A_ and column _j_ of _B_ will end up in the $i^{th}$ row and $j^{th}$ column of _C_. This implies that the resulting matrix has the same number of rows as _A_ and the same number of columns as _B_.

$$
\begin{aligned}
AB
&= \begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
\begin{bmatrix}
5 & 6 \\
7 & 8
\end{bmatrix} \\
&= \begin{bmatrix}
1 \cdot 5 + 2 \cdot 7 & 1 \cdot 6 + 2 \cdot 8 \\
3 \cdot 5 + 4 \cdot 7 & 3 \cdot 6 + 4 \cdot 8
\end{bmatrix} \\
&= \begin{bmatrix}
5 + 14 & 6 + 16 \\
15 + 28 & 18 + 32
\end{bmatrix} \\
&= \begin{bmatrix}
19 & 22 \\
43 & 50
\end{bmatrix}
\end{aligned}
$$

> Matrix multiplication is not commutative, that is, _AB_ is not the same as _BA_.

$$
\begin{aligned}
BA
&= \begin{bmatrix}
5 & 6 \\
7 & 8
\end{bmatrix}
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix} \\
&= \begin{bmatrix}
5 \cdot 1 + 6 \cdot 3 & 5 \cdot 2 + 6 \cdot 4 \\
7 \cdot 1 + 8 \cdot 3 & 7 \cdot 2 + 8 \cdot 4
\end{bmatrix} \\
&= \begin{bmatrix}
5 + 18 & 10 + 24 \\
7 + 24 & 14 + 32
\end{bmatrix} \\
&= \begin{bmatrix}
23 & 34 \\
31 & 46
\end{bmatrix}
\end{aligned}
$$

When a matrix is **transposed**, its rows become its columns and vice versa. If _M_ has the dimensions _mxn_, $M^T$ (transpose of _M_) has a dimension of _nxm_.

$$
\begin{aligned}
A^T
&= \begin{bmatrix}
1 & 3 \\
2 & 4
\end{bmatrix} \\
B^T
&= \begin{bmatrix}
5 & 7 \\
6 & 8
\end{bmatrix}
\end{aligned}
$$

The transpose of a product is equal to the product of the transposes in **reverse** order.

$$
\begin{aligned}
(AB)^T
= B^TA^T
&= \begin{bmatrix}
5 & 7 \\
6 & 8
\end{bmatrix}
\begin{bmatrix}
1 & 3 \\
2 & 4
\end{bmatrix} \\
&= \begin{bmatrix}
5 \cdot 1 + 7 \cdot 2 & 5 \cdot 3 + 7 \cdot 4 \\
6 \cdot 1 + 8 \cdot 2 & 6 \cdot 3 + 8 \cdot 4
\end{bmatrix} \\
&= \begin{bmatrix}
5 + 14 & 15 + 28 \\
6 + 16 & 18 + 32
\end{bmatrix} \\
&= \begin{bmatrix}
19 & 43 \\
22 & 50
\end{bmatrix}
\end{aligned}
$$

## Transformations

A vector is basically an _nx1_ matrix, if represented as a **column vector** (i.e., components appear in the same column); hence, it can be multiplied by an _mxn_ matrix ($M\vec{v}$). Through matrix multiplication, a vector can be transformed into another vector. We use matrices for transforming vectors, because they allow us to combine multiple transformations into a single matrix, which we'll see later on.

> GPUs are very good at multiplying thousands of matrices in parallel.

An **identity matrix** is an _nxn_ matrix that has _1s_ on its **main diagonal** (from top-left to bottom-right) and _0s_ elsewhere. When you multiply any compatible matrix or vector with it, you get the original matrix or vector back. So, it's essentially a **no transform**.

$$
\begin{aligned}
IA
&= \begin{bmatrix}
1 & 0 \\
0 & 1
\end{bmatrix}
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix} \\
&= \begin{bmatrix}
1 \cdot 1 + 0 \cdot 3 & 1 \cdot 2 + 0 \cdot 4 \\
0 \cdot 1 + 1 \cdot 3 & 0 \cdot 2 + 1 \cdot 4
\end{bmatrix} \\
&= \begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
\end{aligned}
$$

> A **diagonal matrix** has non-zero entries only along its main diagonal.

### Scaling

We can change the length (and direction) of a vector by scaling it. This is achieved by multiplying individual components by a scalar. If the same scalar is used for all components, it is a **uniform** scale operation; otherwise, it's called a **non-uniform** scale.

> A positive uniform scale operation does not change a vector's direction. If it's negative, then the vector points the opposite way.

We would like to form a scale matrix (_S_) so that the scaling operation could be represented as a matrix-vector multiplication. To obtain that matrix, let's first write a set of equations that describes scaling for a vector in a Euclidean space defined by Cartesian coordinates:

$$
\begin{aligned}
x' &= S_x \cdot x \\
y' &= S_y \cdot y \\
z' &= S_z \cdot z
\end{aligned}
$$

Since there are 3 equations, there should be 3 rows in the scale matrix to store the coefficients for each equation. Also, since a 3D vector is a _3x1_ matrix, our matrix needs to have 3 columns to be compatible. So, this will be a _3x3_ matrix. Let's rewrite the equations so that each one has 3 coefficients (columns):

$$
\begin{aligned}
x' &= S_x \cdot x + 0 \cdot y + 0 \cdot z \\
y' &= 0 \cdot x + S_y \cdot y + 0 \cdot z \\
z' &= 0 \cdot x + 0 \cdot y + S_z \cdot z
\end{aligned}
$$

We want to scale each axis independently; hence, we want no contribution from other axes. For this purpose, we set the coefficients of other components to 0. In this type of scenario, we obtain a diagonal matrix. These equations can be written in matrix form as follows:

$$
\begin{bmatrix}
x' \\
y' \\
z'
\end{bmatrix}
= \begin{bmatrix}
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
\begin{aligned}
x' &= x + T_x \\
y' &= y + T_y \\
z' &= z + T_z
\end{aligned}
$$

Wait... can we obtain $x+T_x$ through matrix multiplication? This seems impossible... and it is, in the same dimensional space. The reason is that matrix multiplication is a **linear transformation**; but, translation is an **affine transformation**.

A transformation (_L_) is **linear** if it satisfies the following condition, where _a_ and _b_ are scalars:

$$
L(a\vec{u} + b\vec{v}) = aL(\vec{u}) + bL(\vec{v})
$$

An **affine** transformation (_A_) has the following form, where _L_ is the linear part, and $\vec{c}$ is a constant vector (e.g., translation vector):

$$
A(\vec{u}) = L\vec{u} + \vec{c}
$$

This is not linear when $\vec{c} \neq \vec{0}$, because:

$$
\begin{aligned}
A(\vec{u} + \vec{v}) &\neq A(\vec{u}) + A(\vec{v}) \\
L(\vec{u} + \vec{v}) + \vec{c} &\neq L(\vec{u}) + \vec{c} + L(\vec{v}) + \vec{c}
\end{aligned}
$$

There is, however, an augmentation technique we can use to obtain a translation matrix. But first, let's expand the equations to include all the components, which must have a corresponding coefficient in each row of this matrix. It's obvious that these coefficients should be 0. On the other hand, translation amounts must be preserved; hence, they are multiplied by 1.

$$
\begin{aligned}
x' &= 1 \cdot x + 0 \cdot y + 0 \cdot z + T_x \cdot 1 \\
y' &= 0 \cdot x + 1 \cdot y + 0 \cdot z + T_y \cdot 1 \\
z' &= 0 \cdot x + 0 \cdot y + 1 \cdot z + T_z \cdot 1
\end{aligned}
$$

It looks like our vector is not $(x,y,z)$ anymore, but rather $(x,y,z,1)$. Similarly, each row appears to have one more coefficient that is the translation amount. Let's try to convert this to a matrix multiplication using the available information:

$$
\begin{bmatrix}
x' \\
y' \\
z'
\end{bmatrix}
= \begin{bmatrix}
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

This operation is valid because the translation matrix (_T_) has a dimension of _3x4_ and it is multiplied by a _4x1_ vector, and the resulting vector is of size _3x1_. More importantly, it gives the correct result. So, we've finally obtained a translation matrix by introducing a new dimension.

> When a 3D point is represented in a 4D projective space, the new coordinate system is referred to as **homogenous coordinates**.

There is a problem though. The _w_ component we added to our original vector makes it impossible to perform multiplications with our scale matrix since the dimensions _3x3_ and _4x1_ are not compatible ($3\neq 4$). As a workaround, we could add one extra column of _0s_ to our scale matrix:

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
\end{bmatrix}
= \begin{bmatrix}
S_x \cdot x \\
S_y \cdot y \\
S_z \cdot z
\end{bmatrix}
$$

This seems to work, but we do not just perform one transformation on a vector and call it a day; it's often necessary to apply a series of transformations to the same vector. Let's say we intend to apply a translation next, can we do it? Notice that we no longer have a _4x1_ vector; we have lost the _w_ component, which makes it impossible to perform this operation. It's clear that we have to preserve the 4D representation while operating on the vector.

What dimensions does the scale matrix need to have to produce a _4x1_ vector when multiplied by a _4x1_ vector? Yes, the answer is _4x4_. But, what values should we have in this new row? The _w_ component of the result must be 1, which suggests $(0,0,0,1)$.

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
\end{bmatrix}
= \begin{bmatrix}
S_x \cdot x \\
S_y \cdot y \\
S_z \cdot z \\
1
\end{bmatrix}
$$

Now, let's try to apply scaling followed by translation. When using column vectors, this chain of operations is written left to right, but performed right to left. It follows the **nested functions** analogy: $f(g(h(x))) = (f \circ g \circ h)(x)$.

$$
\begin{aligned}
TS\vec{v}
&= \begin{bmatrix}
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
\end{bmatrix} \\
&= \begin{bmatrix}
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
\end{bmatrix} \\
&= \begin{bmatrix}
S_x \cdot x + T_x \\
S_y \cdot y + T_y \\
S_z \cdot z + T_z \\
1
\end{bmatrix}
\end{aligned}
$$

Matrix multiplication is **associative**, that is, $(AB)C = A(BC)$; hence, we are free to combine any adjacent pair without changing the order. This allows us to collapse the entire transformation chain into one matrix. Let's combine the translation and scale matrices:

$$
\begin{aligned}
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
\end{bmatrix} \\
= \begin{bmatrix}
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
\end{aligned}
$$

> Being able to represent a sequence of transformations as a single matrix can save precious GPU resources.

If the vector was represented as a row vector, then the multiplication would be done left to right in reverse order, i.e., we would take the transpose of the transformation chain: $(TS\vec{v})^T=\vec{v}^TS^TT^T$. Notice that the vector dimensions become _1x4_, and the transform matrices are of size _4x4_, which explains the need to reverse the order to make them compatible for multiplication.

$$
\begin{aligned}
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
\end{bmatrix} \\
= \begin{bmatrix}
x & y & z & 1
\end{bmatrix}
\begin{bmatrix}
S_x & 0 & 0 & 0 \\
0 & S_y & 0 & 0 \\
0 & 0 & S_z & 0 \\
T_x & T_y & T_z & 1
\end{bmatrix}
\end{aligned}
$$

### Rotation

One way to represent rotations is by using three separate rotations around coordinate axes, applied in a specific sequence. For example, we first rotate around _x_ by $\alpha$, then around _y_ by $\beta$, and finally around _z_ by $\gamma$. These are called **Euler angles**. In different industries, these rotations might have different names; for example, in avionics, rotations around _x_, _y_ and _z_ are called **pitch**, **yaw** and **roll**, respectively, given that _y_ is up. The following are the most common rotation matrices, derived for the right-handed basis [orientation](<https://en.wikipedia.org/wiki/Orientation_(vector_space)>).

$$
R_z R_y R_x
= \begin{bmatrix}
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

This representation is easy to understand and visualize, but it's not perfect. Before we point out the issues, let's make some observations. The first thing to notice is that a rotation around a certain axis preserves the coordinates on that axis (through multiplication by 1), which is expected. Another thing to notice is that the order matters due to the non-commutative nature of matrix multiplication, but in what order should we apply these rotations?

An important thing to know is that there are two types of rotations: intrinsic and extrinsic. These describe the frame of reference you're rotating about, which completely changes how the same sequence of angles plays out. With **intrinsic rotations**, the object is rotated about its local frame, which means that each rotation causes the local coordinate axes to move; the next rotation in the sequence happens relative to the new orientation. On the other hand, **extrinsic rotations** are about a fixed frame, e.g., world frame, or the parent object's frame.

> When we talk about rotations, we usually mean intrinsic rotations.

The problems associated with the representation above is not clear at first glance. To give you a clue, the first axis (rightmost in the matrix multiplication, outermost in a three-gimbal mechanism) can spin freely as it's fixed in the world frame, the middle one is orthogonal to both the first and the last by definition, but there is a chance for the first and last to align when the middle axis is at its extremes (e.g., at 90 degrees). When two axes align, rotations around both will have the same effect; hence, we lose one degree of freedom, which is called **gimbal lock**. Changing the multiplication order does not prevent this from happening, it just changes the pair that gets aligned.

To avoid gimbal lock, we could limit the movement of the middle axis, and in some cases, we could get away with it. For example, in an FPS game, players rarely look up to the sky or down to the ground, and it won't bother them when the rotation hits its limitations as it would also be physically impossible for a human's head to move beyond those angles. However, this is not a fix, just a mitigation. To eliminate the possibility of a gimbal lock altogether, modern graphics applications represent rotations using [quaternions](https://en.wikipedia.org/wiki/Quaternion).

#### Algebraic Explanation of Gimbal Lock

Let's say we have rotated around the _y_-axis by ${90^\circ}$, then the transformation becomes:

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
\begin{aligned}
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
\end{bmatrix} \\
= \begin{bmatrix}
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
\end{aligned}
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

Now, we can include the required GLM headers and define the transformation matrices. We usually start with a unit matrix, and call either one of `glm::rotate`, `glm::scale` or `glm::translate`, to obtain a combined matrix. Since GLM, like OpenGL, represents matrices in **column-major** order, we place the first transformation to apply at the end in the multiplication.

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

In our vertex shader, we can define a uniform of type `mat4` for the transform matrix. Then, we multiply the position vector with this matrix to obtain a final position. Notice that we represent the position in homogenous coordinates so that it's compatible with the matrix, and the _w_ component is `1.0` since this is a position vector.

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
