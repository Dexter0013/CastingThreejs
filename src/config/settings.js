/**
 * settings.js — the single source of truth for every tweakable value in the sandbox.
 *
 * Nothing in the renderer owns state that lives here: shaders, particle systems,
 * lights and post processing all *read* these objects every frame. That is what
 * makes the real-time editor work without rebuilding anything — mutating a field
 * is immediately visible on screen, including on an ice field that is already
 * standing, and including while the clock is paused (`P`), which is when the
 * shapes are actually worth tuning.
 *
 * The one rule that keeps that promise: a system may only ever *sample* these
 * values. It must never copy one into a record at spawn time and read it back
 * later — see `IceAbility`, whose spike records hold nothing but unitless dice
 * rolls, and resolve every metre, radian and second against this file each frame.
 *
 * Conventions
 *  - Colours are stored as `#rrggbb` strings so lil-gui can bind them directly.
 *    Use `utils/color.js#getColor()` to read them as a cached THREE.Color.
 *  - `global` holds multipliers that scale everything at once (1 = neutral).
 *  - The per-ability blocks (`ice`, `thunder`) hold absolute values.
 *
 * Every ability block is keyed by its id in `ELEMENTS`, and the shared systems
 * that need to know about "the ability the player is currently holding" — the
 * aim controller, the cooldown, the HUD — look it up as `settings[element]`.
 * The four fields they rely on being present are `range`, `minRange`, `speed`
 * and `cooldown`; everything else in a block is that ability's own business.
 */

export const settings = {
  /* ------------------------------------------------------------------ */
  /* Global multipliers                                                  */
  /* ------------------------------------------------------------------ */
  global: {
    timeScale: 1.0, // slow-mo / fast forward for the whole simulation
    speed: 1.0, // eruption travel speed multiplier
    lifetime: 1.0, // ability lifetime multiplier
    glow: 1.0, // emissive multiplier fed into bloom
    shaderIntensity: 1.0, // master strength of every procedural shader effect
    noiseStrength: 1.0,
    noiseFrequency: 1.0,
    noiseSpeed: 1.0,
    turbulence: 1.0,
    randomness: 1.0, // per-instance / per-particle jitter multiplier
    particleCount: 1.0,
    particleLifetime: 1.0,
    particleSpeed: 1.0,
    particleSize: 1.0,
    emissionRate: 1.0,
    lightIntensity: 1.0,
    lightRadius: 1.0,
    distortion: 1.0,
    fresnel: 1.0,
    opacity: 1.0,
    animationSpeed: 1.0, // character animation playback rate
    cameraShake: 1.0,
    explosionIntensity: 1.0
  },

  /* ------------------------------------------------------------------ */
  /* The aim indicator — the ground arrow drawn while the cast is armed  */
  /* ------------------------------------------------------------------ */
  /**
   * A League-style skillshot indicator: one ground quad with a signed-distance
   * arrow in its fragment shader, so every dimension below is in *metres* and
   * nothing is a texture. The quad is rebuilt from these numbers each frame,
   * which is why dragging `range` while aiming stretches the arrow live.
   */
  aim: {
    /* --- silhouette (metres) --- */
    shaftWidth: 0.42, // half-width of the shaft
    headLength: 2.6, // length of the arrowhead
    headWidth: 1.35, // half-width at the base of the head
    round: 0.12, // corner rounding of the whole silhouette
    startOffset: 0.9, // gap between the caster and the tail of the arrow

    /* --- rendering --- */
    edge: 0.09, // outline thickness, metres
    edgeGlow: 2.6, // how hard the outline blooms
    softness: 0.06, // feather on the outer edge
    fill: 0.3, // opacity of the interior wash
    fillFalloff: 1.1, // how fast the wash fades from the axis to the edge
    opacity: 1.0,

    /* --- energy running up the shaft --- */
    stripes: 0.55, // chevrons per metre
    stripeSharp: 0.62, // 0 = soft gradient, 1 = hard bars
    stripeDepth: 0.55, // how much they modulate the fill
    scrollSpeed: 2.4, // metres/second they travel toward the tip
    pulse: 0.28, // brightness breathing
    pulseSpeed: 2.2,

    /* --- frost break-up --- */
    noise: 0.45, // how much noise eats into the fill
    noiseScale: 1.6, // features per metre
    noiseSpeed: 0.35,
    crystals: 0.55, // voronoi frost plates over the interior
    crystalScale: 2.4,

    /* --- furniture --- */
    baseRing: 0.62, // radius of the ring at the caster's feet, metres
    baseRingWidth: 0.06,
    tipGlyph: 0.9, // strength of the crystal rosette at the impact point
    tipGlyphSize: 1.15, // radius of that rosette, metres
    tipSpin: 0.45, // revolutions/second
    rangeArc: 0.55, // brightness of the max-range cap
    reveal: 0.055, // seconds for the arrow to sweep out when armed

    /* --- colour --- */
    colorCore: '#ecfbff',
    colorEdge: '#3fb4ff',
    colorInvalid: '#ff6a5c', // shown when the target is inside `minRange`

    height: 0.035 // hover distance above the floor, metres
  },

  /* ------------------------------------------------------------------ */
  /* Character                                                           */
  /* ------------------------------------------------------------------ */
  character: {
    pose: 'idle', // 'idle' (the FBX clip) or 'sitting' (animation/SittingPose.js)
    blendTime: 0.9,
    breathing: 1.0,
    breathRate: 0.2,
    legSpread: 1.0,
    torsoLean: 0.0,
    seatClearance: 0.004,
    handsOnKnees: true,
    handHeight: 0.095,

    /* --- how the body sells the cast --- */
    turnToAim: true, // face the arrow while aiming
    turnRate: 0.0002, // fraction of the heading gap left after 1s (lower = snappier)
    castLean: 0.34, // radians the torso pitches forward on release
    castRecoil: 0.16, // metres the body is shoved back
    castSettle: 2.6 // seconds⁻¹ the lunge decays at
  },

  /* ================================================================== */
  /* ICE — ability one                                                   */
  /* ================================================================== */
  /**
   * A glacial eruption: a fracture front races out along the aimed line and a
   * field of crystal spikes tears up out of the floor behind it, small and dense
   * at the caster, tall and violent at the far end.
   *
   * Everything is generated — the crystals are procedural geometry
   * (`assets/ProceduralGeometry.js`), their shading is a patched standard
   * material (`materials/IceMaterial.js`), the frost is a shader on a quad and
   * the mist, shards and glitter are GPU particles. There are no textures and no
   * meshes on disk.
   */
  ice: {
    /* --- the cast itself --- */
    range: 15.0, // maximum cast distance, metres
    minRange: 2.5, // closer than this and the cast is refused
    speed: 26.0, // how fast the fracture front travels, metres/second
    lifetime: 3.6, // seconds the field stands before it withdraws
    cooldown: 0.4, // seconds before the ability can be armed again

    /* --- the footprint the spikes fill --- */
    widthNear: 0.55, // half-width of the band at the caster, metres
    width: 2.5, // half-width at the far end, metres
    widthCurve: 0.75, // <1 flares early, >1 stays narrow then opens out
    spikeCount: 190, // instances spent on one cast (capped at 288)
    density: 1.0, // multiplier on that count
    clumping: 1.35, // >1 pulls spikes toward the centre line
    scatter: 0.55, // extra lateral jitter, fraction of the local half-width
    frontBias: 0.85, // <1 crowds spikes toward the impact point

    /* --- silhouette of the field --- */
    heightNear: 0.5, // spike height at the caster, metres
    height: 3.1, // spike height at the far end, metres
    heightCurve: 1.7, // how late the ramp climbs
    heightJitter: 0.55,
    crown: 0.55, // how much shorter the flank blades are than the spine, 0..1
    peak: 1.45, // extra height multiplier at the impact point
    peakWidth: 0.28, // how much of the line that swell covers, 0..1
    rubble: 0.42, // fraction of the spikes demoted to ankle-height shards
    rubbleScale: 0.3,

    /* --- an individual crystal --- */
    radius: 0.41, // base radius, metres
    radiusJitter: 0.93,
    taper: 0.69, // tip radius as a fraction of the base
    facets: 7, // sides of the prism (5–8 read best)
    roughness: 0.09, // how far the facets are pushed off a clean prism
    bend: 0.66, // sideways curve from base to tip
    lean: 0.42, // radians the spikes lean away from the caster
    leanJitter: 1.5,
    twist: 1.0, // random yaw, 0..1 of a full turn

    /* --- the eruption --- */
    riseTime: 0.17, // seconds from buried to full height
    riseOvershoot: 0.26, // how far past full height the punch carries
    riseStagger: 0.09, // seconds of random delay between neighbours
    settle: 0.55, // seconds the overshoot takes to damp out
    shatterDelay: 0.6, // seconds after `lifetime` before they start to go
    sinkTime: 1.0, // seconds to withdraw into the floor

    /* --- the ice material --- */
    colorDeep: '#12496f', // the colour thick ice accumulates toward
    colorIce: '#a9e4ff', // body
    colorRim: '#f2feff', // fresnel edge
    colorCore: '#57c9ff', // the light trapped inside a fresh crystal
    opacity: 0.92,
    depthTint: 1.15, // how fast the deep tint builds with thickness
    fresnel: 2.3,
    fresnelPower: 2.4,
    translucency: 1.5, // light bleeding through from behind
    envIntensity: 0.9, // how much of the HDR probe the facets catch
    facetSharp: 0.68, // crispness of the internal facet shading
    fracture: 0.62, // internal crack planes
    fractureScale: 6.5, // cracks per metre
    veins: 0.45, // milky feather-frost inside the crystal
    veinScale: 3.2,
    // Named `glint*` rather than `sparkle*` on purpose: these are the pinpoint
    // highlights on the crystal *surface*, and the `sparkle*` family further
    // down drives the glitter *particles*. Two different effects.
    glint: 1.1,
    glintScale: 34.0,
    glintSpeed: 0.7,
    frostLine: 0.5, // rime banding climbing the crystal
    glow: 0.85, // overall emissive gain
    edgeGlow: 1.1, // brightness of the silhouette rim
    birthGlow: 1.6, // extra glow on a crystal that has just erupted
    birthFade: 0.45, // seconds that birth flash lasts

    /* --- what the ground does --- */
    frostSpread: 1.35, // frost patch radius, × the local half-width
    frostRate: 3.6, // patches laid per metre of front travel
    frostLife: 7.0, // seconds a patch lingers
    frostIntensity: 0.85,
    frostCrystals: 1.5, // sharpness of the frost fingers
    colorFrost: '#cdefff',
    colorFrostEdge: '#5fd0ff',
    shockRadius: 5.5, // impact shockwave ring, metres
    colorShockA: '#5fd0ff', // body of the shockwave ring
    colorShockB: '#f2feff', // its crest

    /* --- mist, shards and glitter --- */
    /**
     * Every particle system is coloured by a four-stop gradient sampled over the
     * particle's own lifetime: `A` the instant it is born, `D` as it dies. They
     * are spelled out rather than derived from the crystal palette so the fog can
     * be warmed, or the glitter recoloured, without touching the ice itself.
     */
    mistRate: 260, // rolling ground fog, particles/second
    mistSize: 1.15,
    mistSpeed: 1.3,
    mistLifetime: 2.8,
    mistOpacity: 0.05,
    mistRise: 0.35, // how fast the fog lifts, metres/second
    colorMistA: '#f2feff',
    colorMistB: '#cdefff',
    colorMistC: '#a9e4ff',
    colorMistD: '#09304c',
    shardRate: 150, // ice chips thrown off the eruption
    shardSize: 0.075,
    shardSpeed: 7.0,
    shardLifetime: 1.7,
    shardGravity: -14.0,
    colorShardA: '#f2feff',
    colorShardB: '#a9e4ff',
    colorShardC: '#a9e4ff',
    colorShardD: '#12496f',
    sparkleRate: 130, // the rising glitter plume
    sparkleSize: 0.055,
    sparkleSpeed: 3.4,
    sparkleLifetime: 2.6,
    sparkleRise: 1.6, // upward drift, metres/second
    sparkleTurbulence: 0.55,
    colorSparkleA: '#f2feff',
    colorSparkleB: '#57c9ff',
    colorSparkleC: '#a9e4ff',
    colorSparkleD: '#041e32',

    /* --- dynamic light --- */
    lightIntensity: 9,
    lightRadius: 13,
    lightColor: '#7fd4ff',

    /* --- the impact at the far end --- */
    burstSize: 3.6,
    burstIntensity: 0.75,
    burstShards: 90, // extra chips thrown at the impact
    impactShake: 0.7,
    impactFlash: 0.12,
    shakeDuration: 0.9,
    rumble: 0.06, // continuous shake while the front travels
    // The frost shell mixes A→B across its billowing noise and lays C over the
    // crystallised plates and the fresnel rim, so C is the one that reads hot.
    colorBurstA: '#a9e4ff',
    colorBurstB: '#cdefff',
    colorBurstC: '#f2feff',
    colorFlash: '#f2feff' // the full-screen flash on impact
  },

  /* ================================================================== */
  /* THUNDER — ability two                                               */
  /* ================================================================== */
  /**
   * A bolt thrown from the caster's hand along the aimed line: a bundle of
   * lightning filaments that snap into existence, hold while they gutter, and
   * blow out. Reference for the look: `thundercast.jpg`.
   *
   * The bolt is **one mesh**. Every filament is an instance of the same ribbon
   * strip, and its entire shape — the sag of the axis, the fan of the bundle,
   * the kinks in an individual strand, the camera-facing width — is evaluated in
   * the vertex shader from the numbers below. Nothing about the path exists on
   * the CPU, which is why `strands`, `jitter` and `spread` reshape a bolt that
   * is already in the air, and do it with the clock paused.
   *
   * The one thing a cast *does* capture is `uSeed`, a single random number
   * rolled at spawn so two casts do not draw the identical bolt. That is an
   * event, not a dimension — the same rule `IceAbility` follows.
   */
  thunder: {
    /* --- the cast --- */
    range: 24.0, // maximum cast distance, metres
    minRange: 2.0, // closer than this and the cast is refused
    speed: 105.0, // how fast the strike front travels, metres/second
    lifetime: 0.45, // seconds the bolt holds after it lands
    fadeTime: 0.5, // seconds it takes to blow out
    cooldown: 0.5,

    /* --- where the bolt leaves the caster --- */
    // The beam starts at the hand, not at the feet, so these are measured from
    // the caster's origin in the cast's own frame.
    handHeight: 1.28, // metres above the floor
    handForward: 0.55, // metres in front of the caster
    handSide: 0.16, // metres to the side (+ follows `Ability#side`)
    endHeight: 0.35, // height of the bolt where it lands, metres
    sag: 0.22, // metres the mid-span bows upward (negative droops)

    /* --- the bundle of filaments --- */
    strands: 9, // separate filaments (capped at 24)
    spread: 0.75, // metres the bundle fans out at the far end
    spreadNear: 0.05, // ... and at the hand
    spreadCurve: 1.6, // >1 keeps the bundle tight then opens it late
    twist: 0.45, // turns the bundle makes around the axis over its length
    twistSpeed: 0.8, // turns/second it rolls on top of that
    branchDim: 0.72, // how much dimmer an outer filament is than the spine

    /* --- the shape of one filament --- */
    jitter: 0.34, // metres of kink at the coarsest octave
    jitterScale: 0.85, // kinks per metre
    octaves: 4, // 1–5; each one halves the amplitude and doubles the rate
    jitterFalloff: 0.55, // amplitude kept per octave
    crawl: 3.2, // how fast the kinks slide along the bolt
    pinch: 0.14, // fraction of the span the ends are pulled straight over
    converge: 0.8, // how hard the far end is pulled onto the target, 0..1

    /* --- the ribbon --- */
    width: 0.025, // half-width of a filament at the hand, metres
    widthTip: 0.43, // that width at the impact point, as a fraction
    widthCurve: 1.09, // how early the taper happens
    coreWidth: 1.31, // multiplier on the central spine
    coreSharp: 4.95, // how hard the hot core falls off across the ribbon
    glowWidth: 5.7, // the halo, × the core width
    glowFalloff: 2.4, // how fast the halo fades across its ribbon
    glowOpacity: 0.49,
    softFade: 0.78, // metres of soft fade where the bolt meets geometry

    /* --- flicker & restrike --- */
    restrike: 24, // times/second the filaments re-roll their shape
    flicker: 0.3, // depth of the whole-bolt brightness stutter
    flickerSpeed: 34, // stutters/second
    strandFlash: 0.5, // how much individual filaments blink out
    tipGlow: 2.0, // extra heat on the leading edge while it travels
    tipLength: 0.08, // length of that leading edge, fraction of the span

    /* --- colour --- */
    colorCore: '#ffffff', // the centre of a filament
    colorInner: '#c9ecff',
    colorOuter: '#3aa0ff', // the outside of a filament
    colorHalo: '#0b3fc8', // the wide glow around the bundle
    glow: 2.3, // overall emissive gain
    opacity: 1.0,

    /* --- what the ground does --- */
    arcRate: 0.9, // electric burns laid per metre of front travel
    arcRadius: 1.5, // radius of one burn, metres
    arcLife: 0.6, // seconds a burn lingers
    arcIntensity: 1.0,
    arcBranches: 0.6, // how finely the burn splits into filaments
    scorchRadius: 0.5, // dark burn mark under the bolt, metres
    scorchLife: 6.5,
    scorchIntensity: 0.45,
    colorArc: '#9fdcff',
    colorScorch: '#080b11',
    colorEmber: '#4aa8ff',
    shockRadius: 6.5, // impact shockwave ring, metres
    colorShockA: '#c9ecff', // body of the shockwave ring
    colorShockB: '#ffffff', // its crest

    /* --- sparks, motes, smoke and debris --- */
    /**
     * As in `ice`: each system is coloured by a four-stop gradient sampled over
     * the particle's own lifetime, `A` at birth through `D` as it dies. Spelled
     * out rather than derived from the bolt palette, so the sparks can be made
     * to cool to orange while the filaments stay blue.
     */
    sparkRate: 240, // sparks thrown off the bolt, particles/second
    sparkSize: 0.16,
    sparkSpeed: 9.0,
    sparkLifetime: 0.5,
    sparkGravity: -12.0,
    sparkStretch: 0.18, // how far a spark smears along its velocity
    colorSparkA: '#ffffff',
    colorSparkB: '#ffffff',
    colorSparkC: '#c9ecff',
    colorSparkD: '#1e5b95',
    moteRate: 90, // the slow ionised motes drifting off the bolt
    moteSize: 0.05,
    moteSpeed: 1.5,
    moteLifetime: 1.6,
    moteRise: 1.0, // upward drift, metres/second
    moteTurbulence: 0.7,
    colorMoteA: '#ffffff',
    colorMoteB: '#c9ecff',
    colorMoteC: '#3aa0ff',
    colorMoteD: '#02195f',
    smokeRate: 50, // thin haze off the scorched floor
    smokeSize: 1.0,
    smokeSpeed: 1.1,
    smokeLifetime: 2.2,
    smokeOpacity: 0.06,
    smokeRise: 0.55,
    colorSmokeA: '#3d546e',
    colorSmokeB: '#33475e',
    colorSmokeC: '#33475e',
    colorSmokeD: '#1c2938',
    debrisRate: 24, // chips kicked off the floor under the bolt
    debrisSize: 0.055,
    debrisSpeed: 5.0,
    debrisLifetime: 1.3,
    debrisGravity: -17.0,
    colorDebrisA: '#252c36',
    colorDebrisB: '#1c222a',
    colorDebrisC: '#1c222a',
    colorDebrisD: '#1c222a',

    /* --- dynamic light --- */
    lightIntensity: 26,
    lightRadius: 17,
    lightColor: '#63b8ff',
    lightFlicker: 0.4, // depth of the light's gutter, 0 = steady
    lightFlickerSpeed: 26,

    /* --- the muzzle and the impact --- */
    // Both shells are the same shader: A→B is mixed across the billowing noise
    // and stays nearly empty, and C is what the racing filaments and the fresnel
    // rim are drawn in — so C is the one carrying the read.
    muzzleSize: 0.55, // the flash at the hand, metres
    muzzleIntensity: 1.9,
    castFlash: 0.1, // screen flash on release
    colorMuzzleA: '#3aa0ff',
    colorMuzzleB: '#c9ecff',
    colorMuzzleC: '#ffffff',
    colorCastFlash: '#c9ecff',
    burstSize: 3.0, // the shell at the impact point, metres
    burstIntensity: 1.4,
    burstSparks: 170, // extra sparks thrown at the impact
    burstDebris: 45,
    impactShake: 0.8,
    shakeDuration: 0.55,
    impactFlash: 0.28,
    rumble: 0.03, // continuous shake while the front travels
    colorBurstA: '#3aa0ff',
    colorBurstB: '#c9ecff',
    colorBurstC: '#ffffff',
    colorFlash: '#c9ecff' // the full-screen flash on impact
  },

  /* ------------------------------------------------------------------ */
  /* Camera rig                                                          */
  /* ------------------------------------------------------------------ */
  camera: {
    distance: 11.5,
    minDistance: 3.5,
    maxDistance: 30,
    zoomSpeed: 1.0,
    zoomDamping: 0.002,
    minPolar: 0.35,
    maxPolar: 1.32,
    fov: 46,
    targetHeight: 1.35,
    damping: 0.06,
    autoFrame: 0.35 // how strongly the rig drifts toward an active cast
  },

  /* ------------------------------------------------------------------ */
  /* Environment & lighting                                              */
  /* ------------------------------------------------------------------ */
  environment: {
    // A dark cinematic stage: one cool key, a colder rim from behind, and very
    // little fill, so the ice is the brightest thing on screen and the fog can
    // swallow the floor into the backdrop.
    sunIntensity: 2.6,
    sunColor: '#e8f3ff',
    sunAzimuth: 2.95,
    sunElevation: 0.6,
    ambientIntensity: 0.14,
    ambientColor: '#8ea8d8',
    hemiIntensity: 0.36,
    hemiSkyColor: '#bdd7ff',
    hemiGroundColor: '#3a4552',
    rimIntensity: 1.1,
    rimColor: '#9ec2ff',
    rimAzimuth: 5.45,
    rimElevation: 0.35,
    envIntensity: 0.32,
    backgroundColor: '#121820',
    fogColor: '#121820',
    fogNear: 10,
    fogFar: 38,
    shadowBias: -0.0008,
    shadowRadius: 2.2,
    floorColor: '#191f27',
    floorTint: '#232b35',
    floorRoughness: 0.88,
    floorSheen: 0.34,
    floorPool: 0.8,
    dustAmount: 0.85,
    contactShadow: 0.55
  },

  /* ------------------------------------------------------------------ */
  /* Post processing                                                     */
  /* ------------------------------------------------------------------ */
  post: {
    enabled: true,
    exposure: 1.05,
    // Threshold sits above the ice body's lit value on purpose: only the rim,
    // the glints and the impact should bloom, not the whole crystal field.
    // Strength is deliberately near zero — the crystal silhouette carries the
    // read, and bloom was the thing eating it. Push it up if you want the halo.
    bloomStrength: 0.03,
    bloomRadius: 0.6,
    bloomThreshold: 0.88,
    vignette: 0.52,
    chromaticAberration: 0.4,
    contrast: 1.12,
    saturation: 1.08,
    temperature: -0.03, // + warm / - cool
    lift: -0.008,
    gain: 1.0,
    grain: 0.045,
    flashStrength: 1.0
  }
};

/**
 * Ability ids, in slot order.
 *
 * `AbilityManager`, the HUD, the aim controller and the editor all key off this
 * array, and the index is the slot the keyboard binds to — adding a third
 * ability is a new file, an entry here and a settings block above.
 */
export const ELEMENTS = ['ice', 'thunder'];

/** Presentation metadata for the HUD. `key` must match `InputManager`. */
export const ELEMENT_META = {
  ice: { label: 'Frost Lance', accent: '#5fd0ff', key: 'Q', hint: 'Frost Lance' },
  thunder: { label: 'Storm Lance', accent: '#7fb4ff', key: 'E', hint: 'Storm Lance' }
};

/** Immutable snapshot used by "Reset to defaults" and the preset system. */
export const DEFAULT_SETTINGS = structuredClone(settings);

/**
 * Deep-merge a plain object into `settings` in place.
 * Existing object identity is preserved so every live binding keeps working.
 */
export function applySettings(patch, target = settings) {
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (target[key] && typeof target[key] === 'object') applySettings(value, target[key]);
    } else if (key in target) {
      target[key] = value;
    }
  }
  return target;
}

/** Restore every value to the shipped defaults (in place). */
export function resetSettings() {
  applySettings(structuredClone(DEFAULT_SETTINGS));
}

/** Serialisable clone of the current state. */
export function snapshotSettings() {
  return structuredClone(settings);
}
