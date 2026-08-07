# Elemental Sandbox

A linear-skillshot VFX sandbox built with **Three.js**, **Vite** and hand-written **GLSL**.

Two abilities, both cast the same way: press the key to arm, a League-of-Legends style arrow
appears on the ground and swings with the mouse, click to fire.

**Q — Frost Lance.** A fracture front races out along the line while a field of ice crystals
tears up out of the floor behind it — small and dense at your feet, opening into a wall of blades
at the far end, with a cluster thrown up around the impact point.

**E — Storm Lance.** A bolt leaves the caster's hand and a bundle of lightning filaments is drawn
out behind the strike front, holds while it gutters and re-strikes, then blows out. Sparks come
off it the whole way, the floor underneath takes a branching electric burn and a dark scorch, and
the far end gets a shell of ionised air.

Everything you can see is generated. There are no textures, no sprite sheets and no meshes on
disk except the character: the crystals are procedural geometry, the bolt is a strip of ribbon
placed entirely by a vertex shader, the arrow, the rime and the burns are signed-distance and
noise shaders on quads, and the mist, sparks, chips and glitter are GPU particles.

**Every parameter is a live slider** — 317 of them — and they stay live while the simulation is
paused. That is the point of the project: freeze a frame mid-eruption or mid-strike with **P**,
then reshape the silhouette, the palette and the timing against a still image.

References for the look: `icecast.jpg` and `thundercast.jpg`.

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
| `public/hdri/spruit_sunrise.hdr` | HDR probe used for image-based lighting and crystal reflections |

The FBX is a Mixamo export: it contains a skinned mesh plus a single animation stack, so the
character and the idle clip come from the same file. Its texture paths are absolute local paths
baked in by the exporting tool and cannot resolve over HTTP, so a hand-authored atlas
(`public/angtexture.png`) is substituted wholesale.

The HDR is loaded as image-based lighting and as the reflection source for the ice — it is never
shown as a visible sky. The stage keeps its flat dark backdrop.

---

## Controls

| Input | Action |
| --- | --- |
| **Q** (or **1**) | Arm Frost Lance — press again to put it away |
| **E** (or **2**) | Arm Storm Lance — press again to put it away |
| **Move the mouse** | Swing the aim arrow |
| **Left click** | Cast along the arrow |
| **Esc** / **right click** | Cancel an armed cast |
| **Right mouse + drag** | Orbit the camera |
| **Scroll** | Zoom |
| **G** | Show/hide the VFX editor |
| **P** | Pause / resume — *the editor keeps applying* |
| **C** | Clear all active effects |
| **T** | Toggle the character between the standing idle and the meditation sit |
| **H** | Hide the controls panel |

`range` and `minRange` are per ability, so the arrow's reach changes with the slot you have
selected. Aiming closer than the selected ability's `minRange` tints the arrow red and refuses the
cast; set `minRange` to 0 if you would rather cast at your own feet. Cooldowns are per ability
too, so spending one slot never locks the other out.

---

## Project layout

```
src/
  abilities/      Ability base class (linear skillshot), IceAbility, ThunderAbility,
                  pooling manager
  animation/      FBX character loading, AnimationMixer, procedural meditation pose,
                  the procedural cast lunge
  assets/         Procedural crystal geometry and the bolt ribbon strip
  config/         settings.js — the single source of truth for every parameter
  core/           App, Renderer, CameraRig, Time, Layers, shared frame uniforms
  effects/        Aim indicator, ground decals, bursts, light pool, shake, flash
  input/          InputManager (events) and AimController (targeting)
  loaders/        AssetLoader with a shared LoadingManager
  materials/      IceMaterial, LightningMaterial
  particles/      GPU particle system + engine and rate emitters
  postprocessing/ Composer pipeline, grade shader, distortion shader
  shaders/lib/    Shared GLSL: noise library, common helpers
  ui/             HUD, lil-gui editor, preset manager, styles
  utils/          Maths, colour cache, pooling, disposal, shader patching
  world/          Environment (stage lighting), floor, dust, contact shadows
  archive/        The retired four-element sandbox — see archive/README.md
```

---

## How it fits together

### Settings are the API

`src/config/settings.js` holds every tweakable value. Nothing else owns that state: shaders,
particle systems, lights and post passes *read* those objects every frame. That is what makes the
editor work with no rebuild — moving a slider changes the ice field that is already standing, the
next cast, the environment and the post stack at once. Preset loading deep-merges *into* the same
objects so every live binding stays valid.

```js
import { settings } from './config/settings.js';
settings.ice.height = 7;          // visible on the next frame, even mid-cast
settings.thunder.jitter = 1.2;    // re-kinks a bolt that is already in the air
settings.global.timeScale = 0.1;  // slow the whole cast to a crawl
```

Ability blocks are keyed by their id in `ELEMENTS`, and the shared systems that need to know
"which ability is the player holding" — the aim controller, the cooldowns, the HUD — look it up as
`settings[element]`. The four fields they rely on being present are `range`, `minRange`, `speed`
and `cooldown`. Everything else in a block is that ability's own business.

### The rule that makes "edit while paused" work

A spike record in `IceAbility` stores **only what the dice decided**: a position *fraction* along
the line, a signed lateral *fraction*, and a handful of unitless jitters. Not one metre, radian or
second is captured when the cast starts. Every dimension is resolved against `settings.ice` inside
the update loop, which runs on a zero-length frame too.

So dragging `height` re-grows a field that is already standing; dragging `lean` re-tilts it;
dragging `clumping` re-packs it toward the centre line. The only values a record *does* capture
are timestamps — the moment its own eruption was triggered. Those are events, not dimensions.

The four *shape* controls (`facets`, `taper`, `roughness`, `bend`) cannot be expressed as a
per-instance transform, so they are baked into the geometry instead — and a six-sided crystal is
just 60 triangles, cheap enough to regenerate outright rather than approximate in a vertex shader.
`IceAbility#_syncGeometry` hashes those four values and rebuilds the three crystal meshes when the
hash changes, which is what keeps them live sliders rather than restart-required constants.

### Aiming

`AimController` raycasts the pointer onto the ground plane **every frame**, not only on mouse
move, so orbiting the camera with a cast armed swings the arrow under a stationary cursor. It
clamps the distance into `[ice.minRange, ice.range]`, tracks a 0..1 reveal envelope, and emits a
single `cast` event carrying an origin, a unit direction and a distance — which is exactly the
signature `Ability#spawn` takes. It decides nothing about what the cast does.

It runs on **real** time rather than the scaled simulation delta, so the indicator keeps animating
while the sandbox is paused.

### The arrow is one SDF

`AimIndicator` is a single ground quad. Its fragment shader remaps UV into **metres measured from
the caster**, so every control in `settings.aim` is a real measurement — the shaft stays 0.42 m
wide whether the cast is 3 m or 15 m long.

The silhouette is a rounded union of a box (the shaft) and iq's exact triangle SDF (the head);
the cheap half-plane intersection leaves visible corner artefacts on a wedge this shallow. From
that one distance field the shader derives the outline, the rim-weighted interior wash, the
chevrons (a phase skewed by `|x|`, which turns flat bands into arrowheads pointing the way the
cast does), the frost noise and voronoi plates, the ring at the caster's feet, the range cap arc,
a six-fold frost rosette pinned to the impact point, and the sweep-out when the ability is armed.

### The ice

`materials/IceMaterial.js` patches a `MeshStandardMaterial` rather than replacing it, so the
crystals cast and receive the stage's real shadows and pick up the HDR probe. The stylisation is
injected on top:

- **Thickness tint** — a facet seen head-on has the longest path through the crystal, so it
  darkens toward `colorDeep`; grazing edges stay pale. This is the term that makes the field read
  as a solid you can see *into* rather than as blue plastic.
- **Internal fracture** — ridged noise sampled in **world** space, so the crack planes stay a fixed
  physical size whether a spike is ankle-high or three metres tall, and neighbouring crystals look
  quarried from the same block.
- **Feather frost and rime** — fbm sampled in **local** space (0..1 up the crystal), so the milky
  veining and the frost creeping up from the base follow each spike's own axis however it is
  scaled or leaned.
- **Glint** — a hard-thresholded high-frequency field scrolling in world space, biased toward
  grazing angles, which is where real ice catches.
- **Birth flash** — a per-instance attribute the ability drives from 1 to 0 over `birthFade`, so a
  crystal is lit from within for the moment it erupts.

Three `InstancedMesh`es share one material. Three rather than one because the *facets* differ, not
just the proportions — per-instance scaling alone cannot buy that silhouette variety, and three
draw calls is a cheap price.

### The lightning

`ThunderAbility` takes the "no dimensions on the CPU" rule further than the ice does: there is no
path object at all. The bolt is one `InstancedBufferGeometry` — a flat ladder of quads in
*parameter* space, where each vertex carries only `(t, side)`: how far along the bolt it is, and
which edge of the ribbon it is on. One instance is one filament. `materials/LightningMaterial.js`
turns that pair into a world position every frame, so a single strip serves a bolt of any length,
any shape and any width.

Three things stack to make the shape:

- **the axis** — a straight line from the hand to the impact point, bowed by `sag`. The only part
  that knows where the cast is pointing.
- **the fan** — a constant per-filament offset in the plane perpendicular to the axis, opening
  from `spreadNear` at the hand to `spread` at the target and rolling around the axis with
  `twist`. This is what separates one filament from the next.
- **the kinks** — octaves of *linearly* interpolated value noise. Linear on purpose: smoothstep
  would round the corners off, and the corners are the entire reason it reads as lightning rather
  than as a wobbly tube.

The ribbon is turned to face the camera by crossing the local tangent with the view vector, which
is why the bolt keeps its apparent thickness from any angle without ever being a screen-space
line. It is drawn twice — a wide soft halo underneath and the hot core on top — because drawing
the glow as real ribbon rather than leaving it to bloom is what keeps it *attached* to every kink.

Two clocks run the flicker. `restrike` snaps every filament onto a new shape N times a second,
and `crawl` slides the kinks continuously in between; together they stop a held bolt from looking
like a static ribbon. A cast captures exactly one number — a seed, so two casts do not draw the
identical bolt — and resolves every metre, radian and second against `settings.thunder` each
frame. That is why dragging `jitter` re-kinks a bolt that is already in the air.

The ground burns are worth a note as a thing *not* to do. The first version sampled the filament
field on `atan(y, x)`, which hands every radius along a given bearing the same value and draws
dead-straight spokes out of the centre — a firework, not a burn. Sampling the same noise in the
plane and warping the lookup is what lets the filaments meander and fork.

### Adding another ability

1. Add a settings block in `config/settings.js` and an entry in `ELEMENTS` / `ELEMENT_META`.
2. Subclass `Ability` and implement `createShaders`, `createParticles`, `onTravel`, `onImpact`,
   `onFade`.
3. Register the class in `abilities/AbilityManager.js`.
4. Add an editor folder in `ui/Editor.js`, and a sigil in `ui/glyphs.js`.
5. Bind a key in `input/InputManager.js` — it emits `ability` with the 0-based slot index, which
   `App` maps through `ELEMENTS`.

Everything else — pooling, the travelling front, the local frame, lights, phases, per-ability
cooldowns, the aim reach and camera framing — is inherited or driven off `ELEMENTS`. The HUD
builds its slots from that array, so a new ability appears in the bar on its own.

### Particles

`particles/ParticleSystem.js` is a GPU-simulated, instanced-quad system. Motion (velocity, gravity,
analytic drag, curl turbulence, vortex swirl), size-over-lifetime, the colour gradient and alpha
fade are all evaluated in the shader from per-instance attributes; the CPU only ever writes spawn
data, and only the slots that changed are uploaded. Particles live in a ring buffer, so spamming
the ability recycles slots instead of allocating. Silhouettes (soft, smoke, streak, leaf, chip,
ring) are procedural — there are no sprite textures anywhere in the project.

Frost Lance uses three systems: **mist** (non-additive, so the fog genuinely occludes and gives the
field depth), **shards** (lit chips under gravity) and **glitter** (additive, negative gravity — the
rising plume that is the signature of the reference frame).

Storm Lance uses four: **sparks** (velocity-stretched streaks under gravity), **motes** (the slow
ionised drift around the bolt), **smoke** (non-additive haze off the scorched floor) and **debris**
(lit chips). Its sparks are emitted from several points along the bolt each frame rather than one:
a beam sheds along its whole length, and a single origin makes every batch read as a starburst.

### Render pipeline

Per frame:

1. **Depth prepass** — the opaque world into a half-res packed-depth buffer. Every VFX shader
   samples it for soft intersections, so nothing cuts a hard line into the ground. The crystals sit
   on `LAYER.WORLD`, so mist and glitter fade softly against them.
2. **Distortion pass** — meshes on the distortion layer write screen-space UV offsets into a second
   half-res buffer. Nothing writes to it in the current build; the pass is kept because it is the
   hook a refraction effect would use.
3. **Composer** — scene → refraction warp → bloom → tone map (ACES) → grade.

The grade pass folds chromatic aberration, lift/gain/contrast/saturation/temperature, vignette,
film grain and the impact flash into one resample.

Shadows come from a single directional light whose orthographic shadow camera is re-centred on the
character each frame and fitted to a 52 m box at 4096² (~1.3 cm/texel). The `three/addons` CSM
module was tried first and removed: it replaces three's `lights_fragment_begin` chunk *globally*,
so any material not explicitly registered with it silently loses all directional lighting.

Contact shadows are a real render: the character's depth is captured from below into a 256²
target, blurred twice and projected onto the ground.

---

## Editor and presets

Press **G** for the panel. Folders: Presets, Global, Aim indicator, Frost Lance, Storm Lance,
Environment, Post processing, Camera, Character.

- **Global** multipliers scale everything at once (speed, glow, noise, particles, lights, impact
  intensity, camera shake, time scale…).
- **Aim indicator** — the arrow's silhouette in metres, its outline and fill, the chevrons and
  frost, and the rings and rosette.
- **Frost Lance** (95 controls) — the cast, the footprint, the silhouette, the crystal itself, the
  eruption timing, the ice material, the frost on the ground, mist/chips/glitter, the impact and
  the dynamic light.
- **Storm Lance** (100 controls) — the cast, where the bolt leaves the hand, the bundle, one
  filament, the ribbon, flicker and restrike, the bolt's colour, the burns on the ground,
  sparks/motes/smoke/debris, the muzzle and impact, and the dynamic light.
- **Presets** save to `localStorage`, and can be duplicated, deleted, exported to JSON, imported
  from JSON, or reset to the shipped defaults.

Presets are plain snapshots of the settings tree, so an exported file is readable and editable by
hand.

Knobs worth knowing about, because they reshape their ability the most:

- `ice.heightCurve` — how late the ramp climbs; raise it and the field stays low until it explodes
  at the target. `ice.frontBias` below 1 crowds the crystals toward the impact point.
- `thunder.jitter` and `thunder.jitterScale` — how violently the bolt kinks, and how often.
  `thunder.strands` and `thunder.spread` set how wide the bundle reads, and `thunder.restrike`
  how hard it strobes. Those five carry the character of the effect.

---

## Performance notes

- Abilities, decals, bursts and particles are pooled, per type. Twelve casts in a row build at most
  **four** instances of an ability and then stop allocating.
- The whole crystal field is three draw calls regardless of crystal count; the cap is 288.
- A whole bolt is **two** draw calls regardless of filament count; the cap is 24 filaments at 72
  samples each. Nothing about the path touches the CPU, so `strands` is nearly free.
- The six dynamic point lights are created at boot and parked at zero intensity rather than added
  and removed — changing the light count forces three to recompile every material.
- Shadow maps update exactly once per frame even though the scene is rendered several times.
- `renderer.compileAsync()` runs during boot so the first cast never stutters on shader compile.
- Pixel ratio is capped at 1.75; the depth and distortion buffers are half resolution.

Measured on a default cast: 32 draw calls idle, ~69 with a full ice field standing and ~49 with a
bolt in the air, ~1150 live particles, 43 compiled programs once both abilities have been cast.

Live counters (FPS, live particles, instances, draw calls) are in the top-right of the HUD.

---

## The archive

`src/archive/` holds the previous incarnation of this project: a four-element bending sandbox
(fire, water, earth, air) cast along a freehand-drawn spline, plus a walk mode that let the avatar
ride the same stroke. None of it is imported by the live app, so Vite never bundles it.

It was retired because this build replaced path drawing with a linear skillshot, which removed the
input every one of those systems was built on. The raymarched flame and water surfaces in
particular are worth mining. See `src/archive/README.md` for what is in there and how to restore a
piece of it.

---

## Known rough edges

- Crystals are drawn with `transparent: true` and `depthWrite: true`. That is the right trade for
  near-opaque ice and it keeps the field from sorting through itself, but at low `ice.opacity` the
  sorting artefacts between overlapping spikes become visible.
- The eruption front is a straight line on a flat floor. Both assumptions are baked in — the ground
  is a single plane at y = 0, and the aim raycast targets that plane.
- The distortion pass runs with nothing writing to it. It costs a half-res clear per frame.
- The impact cluster is placed radially around the end point, so at very short cast distances it
  can overlap the band behind it more than it should.

---

## Licence

Code is provided as-is for the purposes of this project. The bundled HDR probe and the character
FBX retain their original licences.
