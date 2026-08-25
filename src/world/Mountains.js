import {
  Mesh,
  RingGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  BufferAttribute,
  Vector3
} from 'three';
import { getColor } from '../utils/color.js';
import { LAYER } from '../core/Layers.js';

/**
 * Distant Mountain Ring dimensions:
 * - Placed far in the background (r = 110m to 560m)
 * - Low-profile elevation (peaks 16m - 32m) so they gracefully sit on the
 *   horizon and leave the skybox and atmosphere completely open and visible.
 */
const MOUNTAIN_INNER_RADIUS = 110.0;
const MOUNTAIN_OUTER_RADIUS = 560.0;
const THETA_SEGMENTS = 192;
const PHI_SEGMENTS = 90;

/** Foothill transition zone */
const FOOTHILL_TRANSITION = 190.0;

/** Rocky terrain PBR texture URLs from rocky_terrain_03_1k.gltf */
const TEXTURE_URLS = {
  map: './rocky_terrain_03_1k.gltf/textures/rocky_terrain_03_diff_1k.jpg',
  normalMap: './rocky_terrain_03_1k.gltf/textures/rocky_terrain_03_nor_gl_1k.jpg',
  roughnessMap: './rocky_terrain_03_1k.gltf/textures/rocky_terrain_03_arm_1k.jpg',
  aoMap: './rocky_terrain_03_1k.gltf/textures/rocky_terrain_03_arm_1k.jpg'
};

/* Fast 2D simplex/fractal noise implementation for CPU mountain synthesis */
function createNoise2D() {
  const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = Math.floor(Math.random() * 256);
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
  const grad3 = new Float32Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
  ]);

  return function noise2D(xin, yin) {
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = permMod12[ii + perm[jj]] * 3;
    const gi1 = permMod12[ii + i1 + perm[jj + j1]] * 3;
    const gi2 = permMod12[ii + 1 + perm[jj + 1]] * 3;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2);
    }
    return 70.0 * (n0 + n1 + n2);
  };
}

const noise = createNoise2D();

/** Low-profile mountain ridge elevation placed far in the background */
function getMountainElevation(x, z) {
  const dist = Math.hypot(x, z);

  // Exact lock to y = 0 at the inner edge (r = 110m)
  if (dist <= MOUNTAIN_INNER_RADIUS + 0.8) return 0.0;

  // Gentle smooth transition from the distant plains into rolling ridges
  const t = Math.min(1.0, (dist - MOUNTAIN_INNER_RADIUS) / (FOOTHILL_TRANSITION - MOUNTAIN_INNER_RADIUS));
  const ramp = t * t * (3.0 - 2.0 * t);

  const nx = x * 0.0035;
  const nz = z * 0.0035;

  // Domain warp for undulating natural ridges
  const warpX = noise(nx * 1.5, nz * 1.5) * 1.2;
  const warpZ = noise(nx * 1.5 + 5.2, nz * 1.5 + 1.8) * 1.2;

  const wx = nx + warpX * 0.15;
  const wz = nz + warpZ * 0.15;

  // Multi-frequency low-profile mountain ridgelines
  const ridge1 = 1.0 - Math.abs(noise(wx * 2.2, wz * 2.2));
  const ridge2 = 1.0 - Math.abs(noise(wx * 4.4, wz * 4.4));
  const massif = Math.abs(noise(wx * 1.0 + 8.0, wz * 1.0 + 5.0));
  const fine = noise(x * 0.02, z * 0.02) * 0.5 + noise(x * 0.05, z * 0.05) * 0.25;

  // Distance scaling keeping peaks modest (max elevation ~ 22m - 32m)
  const distScale = Math.min(1.3, 0.4 + ((dist - MOUNTAIN_INNER_RADIUS) / 320.0) * 0.9);

  const baseElevation = (massif * 12.0 + ridge1 * ridge1 * 15.0 + ridge2 * 6.5 + fine * 3.0) * distScale;

  return Math.max(0.0, baseElevation * ramp);
}

export class Mountains {
  /**
   * @param {import('./Environment.js').Environment} environment
   */
  constructor(environment) {
    this.environment = environment;

    // Create radial ring mountain geometry positioned in the far distance
    this.geometry = this._createMountainRingGeometry();

    this.material = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
      aoMapIntensity: 1.0,
      flatShading: false,
      dithering: true
    });

    this.uniforms = {
      uRockColor: { value: getColor('#4a3f36').clone() },
      uPeakColor: { value: getColor('#dbe6f0').clone() },
      uGrassColor: { value: getColor('#48782a').clone() }
    };

    environment.registerShadowCasterWithPatch(this.material, (shader) => {
      shader.uniforms.uRockColor = this.uniforms.uRockColor;
      shader.uniforms.uPeakColor = this.uniforms.uPeakColor;
      shader.uniforms.uGrassColor = this.uniforms.uGrassColor;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
           vWorldNormal = normalize(mat3(modelMatrix) * normal);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWorldPos;
           varying vec3 vWorldNormal;
           uniform vec3 uRockColor;
           uniform vec3 uPeakColor;
           uniform vec3 uGrassColor;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           {
             vec3 wp = vWorldPos;
             vec3 norm = normalize(vWorldNormal);
             float slope = 1.0 - clamp(norm.y, 0.0, 1.0);

             // Triplanar / slope-aware texture color modulation
             vec3 baseTex = diffuseColor.rgb;

             // Foothill grass blend
             float grassBlend = smoothstep(0.0, 18.0, wp.y) * (1.0 - smoothstep(10.0, 26.0, wp.y));
             grassBlend *= (1.0 - smoothstep(0.25, 0.65, slope));

             // High peak rime / snow dusting on summits y > 20m
             float snowBlend = smoothstep(19.0, 30.0, wp.y + norm.y * 6.0);
             snowBlend *= (1.0 - smoothstep(0.68, 0.95, slope));

             // Cliff rock contrast
             float cliffFactor = smoothstep(0.38, 0.85, slope);

             vec3 shadedRock = mix(baseTex, baseTex * uRockColor * 1.45, 0.3);
             shadedRock = mix(shadedRock, shadedRock * 0.72, cliffFactor * 0.5);

             vec3 col = mix(shadedRock, uGrassColor * (0.6 + dot(baseTex, vec3(0.333)) * 0.8), grassBlend * 0.75);
             col = mix(col, uPeakColor * (0.8 + dot(baseTex, vec3(0.333)) * 0.4), snowBlend * 0.85);

             // Distance atmospheric aerial perspective
             float dist = length(wp.xz);
             float haze = smoothstep(160.0, 480.0, dist) * 0.45;
             vec3 horizonColor = vec3(0.58, 0.72, 0.86);

             diffuseColor.rgb = mix(col, horizonColor, haze);
           }`
        );
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false; // Mountains are r=110m..560m, outside the 26m shadow box
    this.mesh.name = 'MountainTerrain';
    this.mesh.layers.set(LAYER.WORLD);

    this.textures = null;
  }

  /**
   * Generates a distant, low-profile mountain ring geometry
   */
  _createMountainRingGeometry() {
    const geo = new RingGeometry(
      MOUNTAIN_INNER_RADIUS,
      MOUNTAIN_OUTER_RADIUS,
      THETA_SEGMENTS,
      PHI_SEGMENTS
    );
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const vertex = new Vector3();

    // Planar tiling scale (metres per tile)
    const TILE_SCALE = 24.0;

    for (let i = 0; i < pos.count; i++) {
      vertex.fromBufferAttribute(pos, i);
      const elevation = getMountainElevation(vertex.x, vertex.z);
      pos.setY(i, elevation);

      // Assign planar UVs for seamless, uniform texturing without stretching
      uv.setXY(i, vertex.x / TILE_SCALE, vertex.z / TILE_SCALE);
    }

    geo.computeVertexNormals();

    // Copy uv -> uv2 for aoMap
    geo.setAttribute('uv2', new BufferAttribute(uv.array.slice(), 2));

    return geo;
  }

  /**
   * Loads the rocky terrain PBR textures from rocky_terrain_03_1k.gltf
   * @param {import('../loaders/AssetLoader.js').AssetLoader} assets
   */
  async loadTextures(assets) {
    try {
      const entries = await Promise.all(
        Object.entries(TEXTURE_URLS).map(async ([slot, url]) => [slot, await assets.loadTexture(url)])
      );

      const maxAniso = this.environment.renderer?.gl.capabilities.getMaxAnisotropy?.() ?? 1;
      const textures = {};

      for (const [slot, texture] of entries) {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.anisotropy = maxAniso;
        if (slot === 'map') texture.colorSpace = SRGBColorSpace;
        textures[slot] = texture;
      }

      this.textures = textures;
      this.material.map = textures.map;
      this.material.normalMap = textures.normalMap;
      this.material.normalScale = new Vector2(1.2, 1.2);
      this.material.roughnessMap = textures.roughnessMap;
      this.material.aoMap = textures.aoMap;
      this.material.needsUpdate = true;
    } catch (err) {
      console.warn('[Mountains] Failed to load rocky terrain textures, using fallback:', err);
    }
  }

  update(dt) {
    // Dynamic updates if needed
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    if (this.textures) {
      for (const t of Object.values(this.textures)) t.dispose();
    }
  }
}
