# Elemental Sandbox — Procedural Skillshots & Tactical AI Combat Arena

A real-time skillshot VFX sandbox and tactical combat playground built with **Three.js**, **Vite** and hand-written **GLSL**.

Featuring **six elemental abilities** with two distinct aiming paradigms, a multi-archetype **tactical enemy AI system** with spatial kill-zone memory and predictive dodging, a **hero vitality and combat loop** with dynamic knockback and two-tier health regeneration, and a live parameter editor with over 900 tunable controls.

---

## ⚡ Six Elemental Abilities

Four are **line casts** (press the key to arm, swing the MOBA-style ground arrow with the cursor, click to fire); two are **far casts** (the arrow is replaced by a ground-projected circle that measures out AoE space before committing):

1. **Q — Frost Lance (Line Cast).** A fracture front races out along the line while a field of procedural ice crystals tears up out of the floor behind it — dense at your feet, opening into a wall of monolithic blades at the far end with an explosive impact cluster.
2. **E — Storm Lance (Line Cast).** A high-voltage bolt leaves the caster's hand and a bundle of lightning filaments is drawn out behind the strike front, holding while it gutters and re-strikes. The floor takes branching electric burns and scorch marks, shedding dynamic sparks and an ionised air shell.
3. **R — Cinder Fall (Line Cast).** A burning meteor is lobbed downrange on an arc, trailing a raymarched wake of incandescent gas with expanding lava seams. Detonates violently on impact, throwing shattered basalt chunks and tearing the ground open into molten glowing fissures.
4. **F — Nova Beam (Line Cast).** The caster winds a ball of light up in both hands, pulling motes in from the air, then unleashes a sustained multi-layered plasma column — white-hot core, cyan sheath, gold helical ribbons, and travelling shock discs that burn into the floor before collapsing.
5. **V — Voltaic Snare (Far Cast / Ground AoE).** A leash of current whips across the floor to the target point, snapping open a surging electric cage: a central violet column tears upward, ground tendrils crawl outward to the boundary, and high-frequency arcs run along the perimeter rim.
6. **X — Glacial Crown (Far Cast / Ground AoE).** A sub-zero beacon is thrown downrange, erupting on impact into an expansive circular crown of towering ice monoliths along the outer perimeter while keeping the interior arena open, trapping enemies within and spreading frost rime.

Everything visible is generated procedurally: no sprite sheets or static textures on disk. Shaders, parametric curves, instanced buffers, and GPU particle engines evaluate all visual effects in real time.

---

## 👹 Tactical Enemy AI & Combat Arena

Enemies are governed by an adaptive AI system with multiple specialized archetypes, spatial memory, and reactive movement mechanics:

### Enemy Archetypes

| Archetype | Category | Max HP | Speed | Attack Type | Attack Details |
|---|---|---|---|---|---|
| **Brute Golem** | Ground | 220 HP | 2.1 m/s | Heavy Seismic Slam | 35 Damage, 3.8m range, high knockback resistance (0.4×) |
| **Runner Skirmisher** | Ground | 80 HP | 4.0 m/s | Cyber Strike | 18 Damage, 3.4m range, fast 0.85s attack cadence, flanker |
| **Aerial Drone** | Flying | 90 HP | 3.4 m/s | Plasma Bolt | 20 Damage, 22m range, 18 m/s projectile, hovering core + spinning torus |
| **Sky Specter** | Flying | 110 HP | 3.8 m/s | Astral Shock | 26 Damage, 24m range, 20 m/s projectile, aerodynamic shard wings |

### AI Tactical Features (`AI_CONFIG` in `src/enemies/EnemyAI.js`)

- **Predictive Skillshot Dodging:** Enemies compute perpendicular distances to active aiming corridors and travelling spell heads. When threatened, they execute lateral strafe dashes to evade incoming fire.
- **Spatial Kill-Zone Memory (Danger Heatmap):** When an enemy is defeated or caught in heavy blasts, a danger zone is recorded. Other enemies generate steering repulsion vectors to avoid and flank around deadly areas.
- **Dynamic Flanking & Encirclement:** Rather than forming single-file lines, enemies calculate lateral angle biases to spread out and surround the caster.
- **Weighted Spawning:** Balanced spawn tables prioritize ground combat with tactical aerial fire support (~28% aerial spawns).
- **Smooth 3D Flight Dynamics:** Flying units feature procedural sinusoidal hover bobbing and bank their roll angle into high-speed turns.

---

## 🛡️ Hero Vitality, Combat & Health Regeneration

- **Vitality HUD Bar:** Top-center responsive health bar with real-time color transitions (Emerald → Amber → Crimson) and precise numerical readout.
- **Hit Feedback & Knockback:** Taking damage applies physical directional impulses with exponential friction decay, character stagger, hit-flash emissive highlights, screen red flashes (`ScreenFlash`), and camera rumble (`CameraShake`).
- **Two-Tier Health Regeneration:**
  - **Combat Trickle (20 HP/s):** Constant slow healing while actively engaged in combat.
  - **Out-of-Combat Surge (50 HP/s):** Rapid recovery kicking in **5.0 seconds** after taking the last damage hit.
- **Defeat & Instant Restart Loop:** Reaching 0 HP triggers the Hero Defeat overlay, locking combat inputs until restart. Pressing **Space**, **Enter**, or clicking **Restart Battle** restores 100 HP, resets the character to arena center, and clears active threats.

---

## 🎮 Controls

| Input | Action |
|---|---|
| **Q** (or **1**) | Arm **Frost Lance** (Line Cast) — press again to disarm |
| **E** (or **2**) | Arm **Storm Lance** (Line Cast) — press again to disarm |
| **R** (or **3**) | Arm **Cinder Fall** (Line Cast) — press again to disarm |
| **F** (or **4**) | Arm **Nova Beam** (Line Cast) — press again to disarm |
| **V** (or **5**) | Arm **Voltaic Snare** (Far Cast / Ground AoE) |
| **X** (or **6**) | Arm **Glacial Crown** (Far Cast / Ground AoE) |
| **Move Mouse** | Aim skillshot arrow / position AoE targeting circle |
| **Left Click** | Cast armed ability / Confirm target |
| **Esc / Right Click** | Cancel armed cast |
| **Right Click + Drag** | Orbit camera around arena |
| **Scroll Wheel** | Zoom camera in / out |
| **Z** | Spawn random enemy (15m+ away around player) |
| **T** | Toggle Auto-Spawn Waves (spawns enemies every 3.5s) |
| **Space / Enter** | Restart Battle (when defeated) |
| **G** | Show / hide real-time VFX & parameter editor |
| **P** | Pause / resume simulation (*editor sliders stay live!*) |
| **C** | Clear all active spells, effects, and enemies |
| **H** | Show / hide HUD controls help overlay |

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation & Local Run

```bash
# Clone the repository
git clone https://github.com/Dexter0013/CastingThreejs.git
cd CastingThreejs

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at the local URL printed by Vite (typically `http://localhost:5173`).

### Production Build & Preview

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 📦 Project Structure

```
src/
  abilities/        Ability base class, IceAbility, ThunderAbility, MeteorAbility,
                    BeamAbility, SnareAbility, GlacierAbility, and AbilityManager
  animation/        FBX character loading, AnimationMixer, per-ability cast clips,
                    procedural cast lunge, stagger, and knockback physics
  assets/           Procedural crystal, asteroid, and ice ring geometries, ribbon strips,
                    beam tube, and shock discs
  config/           settings.js — single source of truth for 900+ parameters,
                    ability metadata, and default presets
  core/             App, Renderer, CameraRig, Time, Layers, shared frame uniforms
  effects/          Aim arrow SDF, far-cast circle, ground decals, fissures, bursts,
                    light pool, camera shake, screen flash
  enemies/          Enemy.js (archetypes, visual meshes, hitboxes),
                    EnemyAI.js (steering, dodging, spatial memory),
                    EnemySystem.js (waves, projectile physics, combat checks)
  input/            InputManager (event bus) and AimController (dual targeting modes)
  loaders/          AssetLoader with shared LoadingManager and HDR loader
  materials/        IceMaterial, LightningMaterial, MeteorMaterial, VolumetricFireMaterial,
                    BeamMaterial, SnareMaterial, GlacierMaterial
  particles/        GPU particle system with curl turbulence and lifetime gradients
  postprocessing/   Composer pipeline, ACES tone mapping, bloom, chromatic aberration, grade
  shaders/lib/      Shared GLSL: noise library, common math helpers
  ui/               HUD, vitality bar, defeat screen, lil-gui editor, presets, styles
  utils/            Math utilities, color cache, object pooling, disposal helpers
  world/            Environment lighting, procedural floor, dust motes, contact shadows
```

---

## 🔬 Technical Architecture & Shaders

### 1. Settings as the Single Source of Truth
`src/config/settings.js` holds every live parameter. Shaders, particle systems, dynamic lights, and post passes read these objects every frame without caching stale CPU copies. Pausing the game with **P** freezes the time delta while keeping all 900+ editor sliders fully active to reshape silhouettes and lighting against a frozen frame.

### 2. Line Cast SDF Aim Indicator
`AimIndicator.js` renders a single ground quad evaluated with a signed distance field (SDF) in world-meter space. Derives smooth outlines, animated energy chevrons, rim-weighted glow, and edge feathering without texture lookups.

### 3. Far-Cast Zone Indicator
`ZoneIndicator.js` draws an outer boundary quad and inner range rings. Features a dynamic overshoot-and-settle envelope when armed and accurately displays the exact area of effect before casting.

### 4. GPU Instanced Particle Systems
`ParticleSystem.js` evaluates particle motion (velocity, gravity, curl turbulence, analytic drag, and 4-stop color ramps) entirely in GLSL vertex/fragment shaders. Particles recycle through a ring buffer with zero per-frame CPU allocations.

### 5. Multi-Pass Post Processing Pipeline
Custom composer pass pipeline:
1. **Depth Prepass:** Half-resolution packed depth for soft geometry-particle intersections.
2. **Distortion Buffer:** Screen-space refraction offsets for heat haze and shockwaves.
3. **Post Stack:** Selective bloom → Tone mapping (ACES) → Film grade (chromatic aberration, vignette, grain, impact flash).

---

## 🌐 Deployment (Firebase Hosting)

This application is ready for static deployment to **Firebase Hosting**:

1. Link your Firebase project in `.firebaserc`.
2. Configure GitHub Actions with the secret `FIREBASE_SERVICE_ACCOUNT_CASTINGTHREEJS`.
3. Pushes to `main` automatically build and deploy via `.github/workflows/firebase-hosting.yml`.

Manual deployment via Firebase CLI:
```bash
npm run build
firebase deploy --only hosting
```

---

## 📄 License

Code is provided under the terms of the project repository. FBX character models and HDR environment probes retain their original respective asset licenses.
