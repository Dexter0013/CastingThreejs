# README — enemy model folder

Paste each enemy's GLB file into its named subfolder.
The code will look for the file at the exact path shown below.

```
public/models/enemies/
├── brute/
│   └── brute.glb          ← Brute Golem (heavy, large, ground)
├── runner/
│   └── runner.glb         ← Runner Skirmisher (fast, slim, ground)
├── drone/
│   └── drone.glb          ← Aerial Drone (flying, ranged)
└── specter/
    └── specter.glb        ← Sky Specter (flying, ranged)
```

## Requirements per GLB

| Property          | Requirement                                      |
|:------------------|:-------------------------------------------------|
| Format            | `.glb` (binary GLTF) or `.gltf` + textures      |
| Skeleton / rig    | Optional — static mesh is fine too               |
| Animations        | Optional names: `Idle`, `Walk`, `Attack`, `Die`  |
| Scale             | Any — the loader auto-scales to match the archetype height defined in `Enemy.js` |
| Up axis           | Y-up preferred; Z-up is also handled             |
| Textures          | Embedded in the GLB, or in a `textures/` subfolder next to the `.glb` |

## How the loader will work (once integrated)

- On startup, `EnemySystem` will call `EnemyModelLoader.load(assets)` which loads
  all four GLBs in parallel.
- If a GLB is **missing**, the enemy falls back to the existing procedural
  geometry (colored boxes / shapes) — no crash.
- Each archetype gets **one** shared geometry + material; all spawned instances
  reuse them (same memory model as the ruins).

## Tip — quick test

Drop any placeholder GLB (even a cube) named correctly into one of the folders
and let the dev server hot-reload. The console will log which models loaded
successfully vs. fell back to procedural.
