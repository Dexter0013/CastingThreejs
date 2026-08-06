# Bending Sandbox

An Avatar-inspired elemental bending sandbox built with **Three.js**, **Vite** and hand-written
**GLSL**. Draw a path on the ground with the mouse, release, and a Fire, Water, Earth or Air
ability travels that spline and detonates at the end. Every visual parameter is editable at
runtime through an in-game VFX editor, and the settings can be saved as presets.

The same gesture has a second meaning. Switch to **walk mode** and the drawn path is not cast but
*ridden*: the avatar leaps onto the head of the stroke, folds into the meditation pose on a
spinning ball of air and rides the path to its end, banking into every turn.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints (default <http://127.0.0.1:5173>).

```bash
npm run build
```

```bash
npm run preview
```

### Assets

Two binary assets are served from `public/` and loaded automatically at boot:

| File | Purpose |
| --- | --- |
| `public/models/Standing Idle.fbx` | Rigged character **and** its idle animation clip |
| `public/hdri/spruit_sunrise.hdr` | HDR probe used for image-based lighting and the sky |

The FBX is a Mixamo export: it contains a skinned mesh plus a single animation stack, so the
character and the idle clip come from the same file. Its texture paths are absolute local paths
baked in by the exporting tool and cannot resolve over HTTP; the loader redirects those to a
neutral placeholder and falls back to a muted cloth tone (see `loaders/AssetLoader.js`).
Replacing the FBX with a textured one works without code changes — real textures are kept.

---

## Controls

| Input | Action |
| --- | --- |
| **Hold left mouse + drag** | Draw a path on the ground |
| **Release** | Cast the selected element along that path — or ride it, in walk mode |
| **Right mouse + drag** | Orbit the camera (zoom is locked) |
| **M** | Switch between **cast** and **walk** mode |
| **1 / 2 / 3 / 4** | Fire / Water / Earth / Air |
| **Q / E** | Cycle elements |
| **G** | Show/hide the VFX editor |
| **C** | Clear all active effects (and cancel a ride) |
| **P** | Pause / resume the simulation |
| **T** | Toggle the character between the standing idle and the meditation sit |
| **H** | Hide the controls panel |

Left mouse is reserved for drawing, which is why orbiting is bound to the right button.

---

## Project layout

```
src/
  abilities/      Ability base class, the four elements, the pooling manager
  animation/      FBX character loading, material conversion, AnimationMixer,
                  procedural cross-legged meditation pose (SittingPose.js),
                  walk mode's leap → ride → dismount sequence (WalkController.js)
  assets/         Procedural geometry generators (rocks, ground plates, tower, shards)
  config/         settings.js — the single source of truth for every parameter
  core/           App, Renderer, CameraRig, Time, Layers, shared frame uniforms
  effects/        Ribbon builder, cast trail, decals, bursts, lights, shake, flash,
                  the air scooter the avatar rides in walk mode (AirScooter.js)
  input/          InputManager (events) and PathDrawer (raycast → spline)
  loaders/        AssetLoader with a shared LoadingManager
  materials/      Fire volume / Ocean water / Wind / Rock / Trail / Distortion /
                  Air scooter materials
  particles/      GPU particle system + engine and rate emitters
  postprocessing/ Composer pipeline, grade shader, distortion shader
  shaders/lib/    Shared GLSL: noise library, common helpers
  ui/             HUD, lil-gui editor, preset manager, styles
  utils/          Maths, colour cache, pooling, disposal, shader patching
  world/          Environment (stage lighting), floor, dust, contact shadows
```

---

## How it fits together

### Settings are the API

`src/config/settings.js` holds every tweakable value. Nothing else owns that state: shaders,
particle systems, lights and post passes *read* those objects every frame. That is what makes
the editor work with no rebuild — moving a slider changes abilities that are already in flight,
future casts, the environment and the post stack at once. Preset loading deep-merges *into* the
same objects so every live binding stays valid.

```js
import { settings } from './config/settings.js';
settings.fire.flameHeight = 5;      // visible on the next frame
settings.global.speed = 0.35;       // slow every element down
```

### Drawing → spline → ability

`PathDrawer` raycasts the pointer against the ground plane, drops samples closer together than
`input.minPointDistance` (jitter filter), exponentially smooths the rest, and builds a
`CatmullRomCurve3`. The same resampled polyline feeds the preview ribbon and the ability, so the
trail you drew and the path travelled are guaranteed to agree. Strokes shorter than
`input.minPathLength` are discarded.

`Ability.followPath()` advances by **arc length**, not by curve parameter, so travel speed is a
true metres-per-second regardless of frame rate or how unevenly the path was drawn.

The path is always drawn on the ground, but an element does not have to crawl along it:
`Ability.pathHeight(u)` lifts the trajectory, and the head, the trailing window, the dynamic
light and every particle emission point follow it together. Fire overrides it to fly.

### Walk mode: the same stroke, ridden

`settings.mode` decides what a finished stroke means. In `'casting'` it goes to `AbilityManager`;
in `'walk'` it goes to `WalkController`, which runs a four-phase sequence over the curve
`PathDrawer` already built:

| Phase | What happens |
| --- | --- |
| `leap` | A parabolic arc from wherever he stands to the head of the path. He turns in the air onto the path's own heading, and at `walk.tuck` of the way through he starts folding into the meditation pose so he arrives already seated. |
| `ride` | The air ball puffs into existence under him. He follows the curve **by arc length** at `walk.speed` m/s, easing up over `walk.accel` and gliding to a stop over the last `walk.brake` seconds' worth of path. |
| `dismount` | The ball blows apart, he steps off forward and settles onto the floor. |
| `idle` | Placement is handed straight back to the idle clip. |

Banking is derived, not authored: the controller tracks how fast the heading is actually swinging
and rolls the body about its own forward axis in proportion, so tight corners lean hard and
straights run level. The roll lives on a `tilt` joint underneath the character root, which keeps it
from fighting the heading for the same rotation.

Drawing a new path mid-ride is allowed — he simply leaps off whatever he is doing onto the head of
the new one. `walk.returnHome` makes him hop back to where the whole thing started once the path is
finished; by default he stays at the far end.

### The air scooter

`windball.jpg` (an air scooter, from the show) is the reference, not an asset: the ball is a shader
sphere, not a texture. `AirScooterMaterial` partitions the sphere into `walk.bands` streamlines of
constant *longitude + twist × latitude* — the family of curves that spirals from one pole to the
other — and draws one strand per lane, warped by an fbm field so the strands weave and break up
instead of reading as a wireframe globe. The pattern rotates about the mesh's local Y axis, which
`AirScooter` aligns with the rider's side vector, so the swirl rolls the way the ball rolls. On the
dark stage the arcs come out as the bright part under additive blending, which is the standard
translation of a light-on-light reference.

Keep `walk.bands` on whole numbers: the longitude coordinate wraps at ±π, so a fractional band
count leaves a visible seam down one side.

### Fire is a raymarched volume

Fire is not a textured ribbon like earth and air. `VolumetricFireMaterial` renders an
actual volume: the mesh is only a camera-facing proxy hull around the flight path, and each
fragment reconstructs the path's local frame from the hull's `aCenter` / `aTangent` attributes,
fires a ray from the camera and integrates through a density field wrapped around that axis —
a capsule falloff eroded by three octaves of noise that stream backwards along the path and
climb with buoyancy, stretched upward so tongues lick off the top.

Emission is radiated as `pow(heat, 2.4)` off a geometric temperature (hot on the axis, cooling
outward and backward through the wake), which is what blows the core out to white while the
fringe stays deep red. Soot absorbs, so the cool gas genuinely *occludes* the background instead
of adding to it — hence premultiplied "over" blending rather than the additive blending the rest
of the VFX use. The march is clipped by the depth prepass, so the flame is correctly occluded by
the ground and the character.

`fire.volumeSteps` is the quality/cost dial: 26 samples per pixel costs ~1.3 ms at 960×540.

### Water is a raymarched surface

Water uses the same proxy-hull trick as fire and then does the opposite thing with it.
A flame is emissive gas, so fire integrates *through* its medium; water has a surface, and
everything that reads as water happens on it. `OceanWaterMaterial` marches for the first sign
change of

```
field(p) = radius(u) * (1 + swell + chop) − distanceToAxis(p)
```

refines that crossing with four bisections, takes the gradient of the same field as the normal —
so every ripple in the field is a real ripple in the lighting — and shades the point: Schlick
fresnel over the HDR probe plus one tight sun glint, a Beer-Lambert depth tint over the
*analytic* chord through the tube (thin edges stay turquoise, the belly goes deep blue), backlit
translucency through thin crests, and foam where the swell peaks upward, where a ridged octave
erodes the surface, and at the silhouette — all broken into cells by a voronoi so it reads as
bubbles rather than white paint.

The glint and the backlight are aimed with the stage's key light, so the water is lit from where
the rest of the scene is lit from. The impact lands as a crown of jets, a foam sheet that washes
outward over wet stone and then drains back into a ring, and expanding surface rings.

`water.volumeSteps` is its quality/cost dial.

### Earth paves the ground, then breaks it

Earth is the one element made of solid geometry rather than shaders. It plays in three beats.
As the head travels it *paves*: rows of procedural stone plates (`createSlabGeometry`) surface
flush with the floor in a band `earth.crustWidth` wide, overlapping heavily so the crust reads as
one continuous slab. A fracture wave then follows the head by `earth.crackDelay` and breaks that
crust — each plate levers up on its low edge, tips over or drops into the seam, slides apart and
coughs out dust and chips. The cast ends with a tower (`createTowerGeometry`, an obelisk on a
stepped plinth) climbing out of the floor while a ring of boulders is shouldered up around its
base, and everything sinks back after `earth.towerHold`.

Plates, boulders and the tower are three meshes — two `InstancedMesh` and one `Mesh` — sharing
`RockMaterial`, so all of it casts and receives the scene's cascaded shadows. Each gets its own
material instance: one material used by both an instanced and a non-instanced mesh compiles two
program variants and CSM only tracks the uniforms of the last one it saw. `mossAmount` differs
per instance because the moss term keys off upward-facing normals, which a field of flat ground
plates would otherwise saturate completely.

### Adding a fifth element

1. Add a settings block in `config/settings.js` and an entry in `ELEMENTS` / `ELEMENT_META`.
2. Subclass `Ability` and implement `createShaders`, `createParticles`, `onTravel`, `onImpact`,
   `onFade`.
3. Register the class in `abilities/AbilityManager.js`.
4. Add an editor folder case in `ui/Editor.js#_buildElement`.

Everything else — pooling, path following, lights, phases, camera framing — is inherited.

### Particles

`particles/ParticleSystem.js` is a GPU-simulated, instanced-quad system. Motion (velocity,
gravity, analytic drag, turbulence, vortex swirl), size-over-lifetime, the colour gradient and
alpha fade are all evaluated in the shader from per-instance attributes; the CPU only ever writes
spawn data, and only the slots that changed are uploaded. Particles live in a ring buffer, so
spamming abilities recycles slots instead of allocating. Silhouettes (soft, smoke, streak, leaf,
rock chip, ring) are procedural — there are no sprite textures anywhere in the project.

### Render pipeline

Per frame:

1. **Depth prepass** — the opaque world into a half-res packed-depth buffer. Every VFX shader
   samples it for soft intersections, so nothing cuts a hard line into the ground.
2. **Distortion pass** — meshes on the distortion layer write screen-space UV offsets into a
   second half-res buffer (heat shimmer, water refraction, air pressure waves).
3. **Composer** — scene → refraction warp → bloom → tone map (ACES) → grade.

The grade pass folds chromatic aberration, lift/gain/contrast/saturation/temperature, vignette,
film grain and the impact flash into one resample.

Shadows come from a single directional light whose orthographic shadow camera is re-centred on
the character each frame and fitted to a 52 m box at 4096² (~1.3 cm/texel). The `three/addons`
CSM module was tried first and removed: it replaces three's `lights_fragment_begin` chunk
*globally*, so any material not explicitly registered with it silently loses all directional
lighting. For a play area this size, one tight cascade is sharper and far less fragile.

Contact shadows are a real render: the character's depth is captured from below into a 256²
target, blurred twice and projected onto the ground.

---

## Editor and presets

Press **G** for the panel. Folders: Presets, Global, Cast trail, the four elements,
Environment, Post processing, Camera, Character, Walk mode.

- **Global** multipliers scale every element at once (speed, glow, noise, particles, lights,
  distortion, explosion intensity, camera shake, animation speed, time scale…).
- **Per element** folders expose the full parameter set for that element — fire's flight height,
  volume radius/density/soot/raymarch steps and its gradient, water's surge, crest, chop, depth
  tint, glint and foam, earth's crust width/plate size/crack delay/tower height/shake duration,
  spiral radius/vortex strength/tornado size, and so on.
- **Walk mode** holds the mode switch itself plus the leap arc, ride speed and braking, bank
  angle and response, the air ball's streamlines/twist/turbulence/colours, and its dust and light.
- **Presets** save to `localStorage`, and can be duplicated, deleted, exported to JSON,
  imported from JSON, or reset to the shipped defaults.

Presets are plain snapshots of the settings tree, so an exported file is readable and editable
by hand.

---

## Performance notes

- Abilities, decals, bursts and particles are pooled; a warm session allocates almost nothing
  per frame.
- Ribbon geometry is pre-allocated once per ability and rewritten in place with partial buffer
  uploads.
- The six dynamic point lights are created at boot and parked at zero intensity rather than
  added and removed — changing the light count forces three to recompile every material.
- Shadow maps update exactly once per frame even though the scene is rendered several times.
- `renderer.compileAsync()` runs during boot so the first cast never stutters on shader compile.
- Pixel ratio is capped at 1.75; the depth and distortion buffers are half resolution.

Live counters (FPS, live particles, draw calls, active abilities) are in the top-right of the HUD.

---

## Known rough edges

- The impact bursts read better on Fire and Water than on Earth and Air; the burst shell could
  use more art direction (it currently reads as a faceted shard at some angles).
- Water's thickness is an analytic chord through the tube rather than a marched exit point, so
  the depth tint ignores the wave displacement it is passing through. It is hidden by foam at the
  crests, but a very slow, very close shot can show the belly reading slightly too shallow.
- The stage floor is a single flat plane, so it cannot show the fog rolling over uneven ground —
  the illusion depends on the fog and the backdrop sharing one colour.
- The heat-distortion buffer is half resolution, so very thin shimmer detail is soft.

---

## Licence

Code is provided as-is for the purposes of this project. The bundled HDR probe and the character
FBX retain their original licences.
