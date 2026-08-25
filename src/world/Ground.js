import {
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  BufferAttribute
} from 'three';
import { settings } from '../config/settings.js';
import { getColor } from '../utils/color.js';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { LAYER } from '../core/Layers.js';

/** Side length of the arena floor plane, metres (covers the inner arena r <= 110m) */
const PLANE_SIZE = 230;

/**
 * Brown mud & leaves PBR terrain — Polyhaven brown_mud_leaves_01 (CC0).
 * Full PBR set: diffuse albedo, OpenGL normal, and ARM (AO, Roughness, Metalness).
 * The textures live inside public/brown_mud_leaves_01_1k.gltf/textures/.
 */
const TEXTURE_URLS = {
  map:         './brown_mud_leaves_01_1k.gltf/textures/brown_mud_leaves_01_diff_1k.jpg',
  normalMap:   './brown_mud_leaves_01_1k.gltf/textures/brown_mud_leaves_01_nor_gl_1k.jpg',
  roughnessMap:'./brown_mud_leaves_01_1k.gltf/textures/brown_mud_leaves_01_arm_1k.jpg',
  aoMap:       './brown_mud_leaves_01_1k.gltf/textures/brown_mud_leaves_01_arm_1k.jpg'
};

/**
 * The stage floor.
 *
 * Kept perfectly flat (y = 0) on purpose: the path-drawing raycast, every
 * ability and the earth eruptions all assume a planar surface, and a flat plane
 * makes those interactions exact.
 *
 * The base is a tiled stone flagstone (see `TEXTURE_URLS`), graded toward the
 * cool stage palette so it reads as castle rock rather than a daylit courtyard.
 * On top of the sampled albedo the shader keeps the two things that make the
 * floor sit in this scene: a luminance-preserving tint toward `floorTint`, and a
 * radial light pool that keeps the stage centre readable and sinks the floor
 * into the backdrop long before the plane's edge. When the texture is switched
 * off (or has not loaded yet) the same shader falls back to the original
 * procedural stone, so nothing depends on the download succeeding.
 */
export class Ground {
  constructor(environment) {
    this.environment = environment;

    this.material = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: settings.environment.floorRoughness,
      metalness: 0.0,
      aoMapIntensity: 1.0,
      dithering: true
    });
    this.material.normalScale = new Vector2(
      settings.environment.floorNormalScale,
      settings.environment.floorNormalScale
    );

    /** The four stone maps, filled in by `loadTextures`. Null until then. */
    this.textures = null;
    this._textured = false;

    this.uniforms = {
      uFloorColor: { value: getColor(settings.environment.floorColor).clone() },
      uFloorTint: { value: getColor(settings.environment.floorTint).clone() },
      uTexTint: { value: settings.environment.floorTexTint },
      uSheen: { value: settings.environment.floorSheen },
      uPool: { value: settings.environment.floorPool },
      uGrassAmount: { value: settings.environment.grassAmount ?? 0.82 },
      uGrassColor: { value: getColor(settings.environment.grassColor ?? '#4f852b').clone() },
      uGrassColorWarm: { value: getColor(settings.environment.grassColorWarm ?? '#82a832').clone() },
      uGrassColorDark: { value: getColor(settings.environment.grassColorDark ?? '#274b17').clone() },
      uTime: { value: 0 }
    };

    environment.registerShadowCasterWithPatch(this.material, (shader) => {
      shader.uniforms.uFloorColor = this.uniforms.uFloorColor;
      shader.uniforms.uFloorTint = this.uniforms.uFloorTint;
      shader.uniforms.uTexTint = this.uniforms.uTexTint;
      shader.uniforms.uSheen = this.uniforms.uSheen;
      shader.uniforms.uPool = this.uniforms.uPool;
      shader.uniforms.uGrassAmount = this.uniforms.uGrassAmount;
      shader.uniforms.uGrassColor = this.uniforms.uGrassColor;
      shader.uniforms.uGrassColorWarm = this.uniforms.uGrassColorWarm;
      shader.uniforms.uGrassColorDark = this.uniforms.uGrassColorDark;
      shader.uniforms.uTime = this.uniforms.uTime;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vGroundWorld;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vGroundWorld;
           uniform vec3 uFloorColor;
           uniform vec3 uFloorTint;
           uniform float uTexTint;
           uniform float uSheen;
           uniform float uPool;
           uniform float uGrassAmount;
           uniform vec3 uGrassColor;
           uniform vec3 uGrassColorWarm;
           uniform vec3 uGrassColorDark;
           uniform float uTime;
           ${noiseGLSL}
           float gSharedGrassMask = 0.0;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           {
             vec3 wp = vGroundWorld;

             #ifdef USE_MAP
               vec3 baseTex = diffuseColor.rgb;

               // Multi-scale procedural grass and terrain synthesis (optimized ALU)
               // 1. Macro zones: expansive meadow zones vs shady muddy paths
               float macroField = snoise(wp * 0.032);

               // 2. Mid clusters: organic grass tufts and clover colonies
               float midPatches = snoise(wp * 0.19);

               // 3. Micro grain: high-frequency grass blade texture
               float microBlades = snoise(wp * 1.5) * 0.6 + snoise(wp * 4.2) * 0.4;

               // Combined organic coverage mask
               float grassMask = smoothstep(-0.25, 0.42, macroField * 0.85 + midPatches * 0.45 + microBlades * 0.2);
               gSharedGrassMask = grassMask;

               // Multi-hue grass chromatic variation
               vec3 gBase = uGrassColor;
               vec3 gWarm = uGrassColorWarm;
               vec3 gDark = uGrassColorDark;

               vec3 grassHue = mix(gDark, gBase, smoothstep(-0.4, 0.25, macroField + midPatches * 0.2));
               grassHue = mix(grassHue, gWarm, smoothstep(0.05, 0.65, midPatches + microBlades * 0.4));

               // Modulate with leaf & mud texture luminance so organic ground details show through the grass
               float texLum = dot(baseTex, vec3(0.299, 0.587, 0.114));
               vec3 grassShaded = grassHue * (0.42 + texLum * 1.05);

               // Moss/lichen spatter in mud & leaf clearings
               float mossNoise = smoothstep(0.35, 0.7, snoise(wp * 0.85));
               vec3 mudShaded = mix(baseTex, gDark * 0.75, mossNoise * 0.35);

               // Blend between soil/leaves and living grass based on organic mask & user amount
               vec3 terrainColor = mix(mudShaded, grassShaded, grassMask * clamp(uGrassAmount, 0.0, 1.0));

               // Anti-tiling subtle luminance break-up (eliminates repeating grid patterns across 400m)
               float antiTile = snoise(wp * 0.055) * 0.08 + snoise(wp * 0.012) * 0.12;
               terrainColor *= (1.0 + antiTile);

               // Stage color grading
               vec3 tint = uFloorTint;
               float tl = max(1e-4, dot(tint, vec3(0.299, 0.587, 0.114)));
               vec3 graded = terrainColor * (tint / tl);
               diffuseColor.rgb = mix(terrainColor, graded, clamp(uTexTint, 0.0, 1.0));
             #else
               // Procedural fallback if texture is disabled
               float macro = snoise(wp * 0.02);
               float tintMask = smoothstep(-0.4, 0.5, macro);
               vec3 base = mix(uGrassColorDark, uGrassColor, tintMask);
               base *= 1.0 + (snoise(wp * 1.2) - 0.5) * 0.1;
               diffuseColor.rgb *= base;
               gSharedGrassMask = tintMask;
             #endif

             // Radial light pool for stage integration
             float dist = length(wp.xz);
             float pool = mix(1.0, smoothstep(40.0, 5.0, dist), clamp(uPool, 0.0, 1.0));
             diffuseColor.rgb *= mix(0.18, 1.0, pool);
           }`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           {
             // Varied surface scattering: reuse shared grass mask and single-eval polish noise
             float polish = smoothstep(0.3, 0.85, snoise(vGroundWorld * 0.06 + 3.0) * 0.5 + 0.5);
             roughnessFactor = mix(roughnessFactor * mix(1.0, 0.45, polish * clamp(uSheen, 0.0, 1.0)), 0.96, gSharedGrassMask * clamp(uGrassAmount, 0.0, 1.0));
           }`
        );
    });

    const geo = new PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 1, 1);
    // aoMap requires a second UV set — copy uv → uv2 so MeshStandardMaterial
    // can sample ambient occlusion from the ARM texture without extra shaders.
    geo.setAttribute('uv2', new BufferAttribute(geo.attributes.uv.array.slice(), 2));

    this.mesh = new Mesh(geo, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.name = 'Ground';
    this.mesh.layers.set(LAYER.WORLD);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.updateMatrix();

    this.group = this.mesh;
  }

  /**
   * Load the stone maps and attach them. Called during boot so the maps are in
   * place before the shader is compiled — no first-cast recompile — but the
   * ground renders fine (procedural fallback) if this is skipped or fails.
   *
   * @param {import('../loaders/AssetLoader.js').AssetLoader} assets
   */
  async loadTextures(assets) {
    const entries = await Promise.all(
      Object.entries(TEXTURE_URLS).map(async ([slot, url]) => [slot, await assets.loadTexture(url)])
    );

    const maxAniso = this.environment.renderer?.gl.capabilities.getMaxAnisotropy?.() ?? 1;
    const textures = {};
    for (const [slot, texture] of entries) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.anisotropy = maxAniso;
      // Only the diffuse albedo is sRGB; normal/roughness/AO are linear data.
      if (slot === 'map') texture.colorSpace = SRGBColorSpace;
      textures[slot] = texture;
    }

    // ARM packing: R = AO, G = Roughness, B = Metalness.
    // Three.js reads roughnessMap.g and aoMap.r automatically — no custom
    // shader needed, the standard material handles it.
    if (textures.roughnessMap) this.material.roughnessMap = textures.roughnessMap;
    if (textures.aoMap)        this.material.aoMap        = textures.aoMap;

    this.textures = textures;
    this._applyTiling();
    this._setTextured(settings.environment.floorTexture);
  }

  /**
   * Point every map at the same tiling, derived from metres-per-tile. Only the
   * repeat is touched — that feeds the texture's UV matrix (auto-updated each
   * render), so there is no image re-upload and this is safe to call per frame.
   */
  _applyTiling() {
    if (!this.textures) return;
    const repeat = PLANE_SIZE / Math.max(0.1, settings.environment.floorTextureScale);
    if (repeat === this._repeat) return;
    this._repeat = repeat;
    for (const texture of Object.values(this.textures)) texture.repeat.set(repeat, repeat);
  }

  /** Attach or detach the full PBR terrain maps. Flipping this recompiles once (USE_MAP). */
  _setTextured(on) {
    if (!this.textures || on === this._textured) return;
    for (const slot of Object.keys(TEXTURE_URLS)) {
      this.material[slot] = on ? this.textures[slot] : null;
    }
    this.material.needsUpdate = true;
    this._textured = on;
  }

  update(elapsed) {
    const env = settings.environment;
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uFloorColor.value.copy(getColor(env.floorColor));
    this.uniforms.uFloorTint.value.copy(getColor(env.floorTint));
    this.uniforms.uTexTint.value = env.floorTexTint;
    this.uniforms.uSheen.value = env.floorSheen;
    this.uniforms.uPool.value = env.floorPool;
    this.uniforms.uGrassAmount.value = env.grassAmount ?? 0.82;
    if (env.grassColor) this.uniforms.uGrassColor.value.copy(getColor(env.grassColor));
    if (env.grassColorWarm) this.uniforms.uGrassColorWarm.value.copy(getColor(env.grassColorWarm));
    if (env.grassColorDark) this.uniforms.uGrassColorDark.value.copy(getColor(env.grassColorDark));
    this.material.roughness = env.floorRoughness;
    this.material.normalScale.set(env.floorNormalScale, env.floorNormalScale);

    if (this.textures) {
      this._applyTiling();
      this._setTextured(env.floorTexture);
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    if (this.textures) {
      for (const texture of Object.values(this.textures)) texture.dispose();
    }
  }
}
