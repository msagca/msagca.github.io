---
layout: post
title: Procedurally Generated Maps for MOBAs
---

In recent months, I've been exploring procedural level generation techniques and algorithms to streamline the level design process for my future game projects so that I can spend more time on gameplay programming. While I haven't delved into some of the more advanced stuff, I think I gained enough experience to quickly create levels suitable for various genres. In this post, I will talk about my progress in incorporating procedural map generation into a [MOBA](https://en.wikipedia.org/wiki/Multiplayer_online_battle_arena) game I've been working on (in [Unity](https://unity.com)).

When approaching the level design task, it would make sense to start with a conceptual design, do some sketching and use generative AI to create inspirational visuals before moving on to the actual implementation. However, I chose to skip this part knowing that once I decided on the strategies and assembled my toolkit, procedural generation would give me satisfactory results in no time, and instead of drawings I would have a 3D scene to work with and build upon. In the case of a MOBA, there are only a few special areas and structures which can easily be integrated into the level generation process without requiring human intervention.

The first thing my level needed was a terrain whose shape looked natural and organic. While Unity's built-in [terrain features](https://docs.unity3d.com/Manual/terrain-UsingTerrains.html) allow us to create and update terrains at runtime, I wanted more control over the generation process, so I decided not to use those features. One of the reasons behind this decision was my desire to stay away from grid based implementations as grids are not that interesting. However, grids are easy to work with, and now I needed more advanced algorithms to create points in 3D space and connect (triangulate) them to form surfaces. I knew that [Poisson Disk Sampling](http://www.cemyuksel.com/cyCodeBase/soln/poisson_disk_sampling.html) would create nicely distributed point samples and [Delaunay Triangulation](https://en.wikipedia.org/wiki/Delaunay_triangulation) would be able to triangulate these samples, which would give me the required data to create a [Mesh](https://docs.unity3d.com/ScriptReference/Mesh.html).

My initial idea was to implement both of these algorithms myself so I could better understand how they worked. And I was able to implement the sampling algorithm which worked well. When I attempted to implement the triangulation algorithm, I realized that it would take a long time to do it and it would probably contain lots of bugs in it. I had implemented the [Ear Clipping](https://articles.dp.software/triangulating-polygon-by-ear-clipping-2de405c27992) algorithm before (which wasn't useful in this case), but this was much more complex. So I started looking for a *C#* implementation of *Delaunay Triangulation* and found this [nice repository](https://github.com/nol1fe/delaunator-sharp/tree/master) by Patryk Grech which also contained an implementation of the *Poisson Disk Sampling* algorithm. The sample scene in the project allowed me to learn how to use the code and confirm that it worked as expected.

The following code generates point samples inside a circular region, triangulates the points and creates a terrain mesh by providing the required data to the mesh constructor.

```cs
var radius = 40f;
var minDistance = 1f;
var sampler = UniformPoissonDiskSampler.SampleCircle(
  center: Vector2.zero,
  radius: radius,
  minimumDistance: minDistance);
var points = sampler.Select(
  selector: point => new Vector2(
    x: point.x,
    y: point.y)
  ).ToPoints();
var delaunator = new Delaunator(points);
var vertices = new Vector3[delaunator.Points.Length];
for (var i = 0; i < points.Length; i++) {
  var x = (float)points[i].X;
  var z = (float)points[i].Y;
  // assign a noise (elevation) value to the y coordinate
  vertices[i] = new Vector3(x, y, z);
}
var mesh = new Mesh {
  vertices = vertices,
  triangles = delaunator.Triangles
};
meshFilter.mesh = mesh;
```

The part below is what's missing in the code above, which is the elevation calculation that utilizes [Mathf.PerlinNoise](https://docs.unity3d.com/ScriptReference/Mathf.PerlinNoise.html). Getting good results for the terrain heights is all about finding good value ranges for the `frequency`, `amplitude`, `octaves`, `persistence`, `lacunarity` and `offset` parameters.

```cs
var amplitude = 3f;
var frequency = .04f;
var lacunarity = 2f;
var persistence = .5f;
var octaves = 4;
var y = 0f;
for (var j = 0; j < octaves; j++) {
  y += Mathf.PerlinNoise(
    x: offset + x * frequency,
    y: offset + z * frequency) * amplitude;
  frequency *= lacunarity;
  amplitude *= persistence;
}
```

By combining these two code blocks, I got the following result.

![](assets/terrain.jpg)

It is shaped like a terrain and it looks natural enough, so I'm satisfied with the result. However, a barren land like this isn’t particularly interesting, so I decided to introduce obstacles (trees) into the terrain. In nature, trees don't usually stand alone, instead they create formations. For this purpose, I could have set a threshold value and decided whether to place a tree at any point in the mesh by comparing its y value with the threshold. This approach would have resulted in tree covered areas that are above or below a certain height, resulting in unrealistic tree-covered areas. Instead, I decided to generate a distinct noise value for each point by adjusting the offset provided to `PerlinNoise` and re-running the algorithm. I stored the tree locations in a `HashSet` for later.

To place trees on the terrain I needed a tree mesh. I found what I was looking for in this [asset pack](https://kenney.nl/assets/nature-kit) by Kenney. I knew that spawning many tree objects in a scene would result in significant performance issues, and I only wanted to display the trees with no extra functionality. As a result, I decided to use [GPU instancing](https://docs.unity3d.com/Manual/GPUInstancing.html), which reduces the number of draw calls between the CPU and GPU, and improves performance when many instances of a mesh are being drawn. Even though the mesh is the same, it is still possible to apply a different transformation to each instance, which creates variation. So, I chose a tree model and passed it as a [prefab](https://docs.unity3d.com/Manual/Prefabs.html) to the `MapContainer` class which contains all the code related to map generation. All I needed was its mesh.

```cs
treeMesh = treePrefab.GetComponent<MeshFilter>().sharedMesh;
var treeMaterial = new Material(shader: Shader.Find(
  name: "Universal Render Pipeline/Lit")
  ) { color = Color.green, enableInstancing = true };
treeParams = new RenderParams(mat: treeMaterial);
```

In addition to the mesh to be rendered and a submesh index (my tree had two submeshes: leaves and the trunk), the [Graphics.RenderMeshInstanced](https://docs.unity3d.com/ScriptReference/Graphics.RenderMeshInstanced.html) method requires an array of `Matrix4x4` that specifies the scale, rotation and translation amounts for each instance. For variation, I randomized the scale and rotation of each tree within reasonable limits. Randomization calls are omitted in the following code.

```cs
treeData = new Matrix4x4[trees.Count];
var k = 0;
foreach (var pos in trees) {
  var translate = Matrix4x4.Translate(vector: pos);
  var scale = Matrix4x4.Scale(vector: new Vector3(scaleX, scaleY, scaleZ));
  var rotate = Matrix4x4.Rotate(q: Quaternion.Euler(rotateX, rotateY, rotateZ));
  var transform = translate * rotate * scale;
  treeData[k++] = transform;
}
```

After creating all the necessary data, it was time to make the render calls within the `Update` method so it would be executed every frame. If a mesh has multiple submeshes, calling `RenderMeshInstanced` is necessary for each submesh which can have their own set of parameters. In the following function, I omitted the calls to render the trunks of the trees.

```cs
void Update () {
  if (treeData != null)
    Graphics.RenderMeshInstanced(
      rparams: treeParams,
      mesh: treeMesh,
      submeshIndex: 0,
      instanceData: treeData);
}
```

![](assets/forest.jpg)

In most MOBA games, 'minions' are the AI agents whose movements are restricted (with exceptions) to a path that connects the two bases. These minions move along this path towards the enemy base and if they come across an enemy unit or building they will start attacking. There are usually three such paths, but in my game I decided to go with one path not to complicate things. What I needed to do was to place the bases far apart from each other and create a path (a list of waypoints) passing through the forest so there was a clear path for the minions to follow along.

To create such a path I needed to define the walkable areas on the map and decide on a pathfinding algorithm to efficiently find the most optimal path. The performance of this algorithm mattered a lot as I wanted to enable players to re-generate the map with one click and instantly see the results. I was aware of an algorithm called [A* Search](https://www.redblobgames.com/pathfinding/a-star/introduction.html), and I had watched videos explaining how it worked and why it outperformed an algorithm like [Dijkstra's](https://www.freecodecamp.org/news/dijkstras-shortest-path-algorithm-visual-introduction). However, I hadn't yet had the chance to apply it in a game. Now, the moment had arrived, it was time to implement *A** and see it in action. 

I found this awesome [YouTube playlist](https://www.youtube.com/playlist?list=PLFt_AvWsXl0cq5Umv3pMC9SPnKjfp9eGW) by Sebastian Lague to teach me how to implement the algorithm. I utilized the [Euclidean distance](https://en.wikipedia.org/wiki/Euclidean_distance) for `g` (cost from the start node) and `h` (heuristic cost to the end node), which were calculated via [Vector2.Distance](https://docs.unity3d.com/ScriptReference/Vector2.Distance.html). Due to an error in my heap implementation, the algorithm explored the entire map regardless of the end points' locations. After some debugging, I fixed the errors and the results started to make sense. In the following image, *cyan*{: style="color: cyan;" } and *green*{: style="color: green;" } dots represent the start and end nodes respectively, *red*{: style="color: red;" } dots are the explored nodes and the *magenta*{: style="color: magenta;" } ones are the waypoints.

![](assets/path.jpg)

To facilitate easy testing of map generation without entering play mode, I created an [editor script](https://docs.unity3d.com/ScriptReference/Editor.html) which displays a button labeled 'Generate Map' in the inspector when a [GameObject](https://docs.unity3d.com/ScriptReference/GameObject.html) with an attached instance of the `MapContainer` script is selected. The `AddComponents` method defined in this class attaches [MeshFilter](https://docs.unity3d.com/ScriptReference/MeshFilter.html) and [MeshRenderer](https://docs.unity3d.com/ScriptReference/MeshRenderer.html) components to the game object to display the terrain mesh. The `CreateMap` method generates point samples, triangulates them and turns them into a mesh. This method also creates the data (graph nodes, tree positions, render parameters, etc.) required by the pathfinder and the renderer.

```cs
using UnityEditor;
using UnityEngine;
[CustomEditor(inspectedType: typeof(MapContainer))]
public sealed class MapEditor : Editor {
  MapContainer map;
  void OnEnable () {
    map = (MapContainer)target;
    map.AddComponents();
  }
  public override void OnInspectorGUI () {
    base.OnInspectorGUI();
    if (GUILayout.Button(text: "Generate Map"))
      map.CreateMap();
  }
  public void OnSceneGUI () {
    Graphics.RenderMeshInstanced(
      rparams: map.treeParams,
      mesh: map.treeMesh,
      submeshIndex: 0,
      instanceData: map.treeData);
    // other render calls
  }
}
```

Up until this point, I was only concerned with points and triangles, that's why in all the images above, Unity's wireframe shader was used. From this point on, I began to focus on the visual aesthetics of the level...
