import {
  Group,
  Box3,
  Vector3,
  Mesh,
  MeshStandardMaterial,
  Color,
  SRGBColorSpace,
  TextureLoader
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LAYER } from '../core/Layers.js';

/** URL of the modular ancient ruins GLB asset */
const RUINS_URL = './Env/ancient_ruins_modular.glb';

/**
 * Minimal GLTFLoader extension plugin that handles the legacy
 * `KHR_materials_pbrSpecularGlossiness` extension by mapping its diffuse
 * texture into the standard `material.map` slot.
 */
class SpecularGlossinessPlugin {
  constructor(parser) {
    this.parser = parser;
    this.name = 'KHR_materials_pbrSpecularGlossiness';
  }

  getMaterialType() {
    return MeshStandardMaterial;
  }

  async extendMaterialParams(materialIndex, materialParams) {
    const parser = this.parser;
    const json = parser.json;
    const materialDef = json.materials[materialIndex];
    const ext = materialDef?.extensions?.[this.name];
    if (!ext) return;

    const pending = [];

    // Map diffuse texture → map
    if (ext.diffuseTexture !== undefined) {
      pending.push(
        parser.assignTexture(materialParams, 'map', ext.diffuseTexture, SRGBColorSpace)
      );
    }

    // Apply diffuse factor as base colour tint
    if (ext.diffuseFactor) {
      const [r, g, b] = ext.diffuseFactor;
      materialParams.color = new Color(r, g, b);
    }

    // Ensure roughness is set (spec-gloss → rough equiv)
    materialParams.roughness = 0.85;
    materialParams.metalness = 0.04;

    await Promise.all(pending);
  }
}

/**
 * Arena Ruins built from the `ancient_ruins_modular.glb` asset.
 *
 * Loads the GLB once, decodes the spec-gloss diffuse texture via a custom
 * extension plugin, then creates ONE shared geometry + ONE shared
 * MeshStandardMaterial reused across all placed instances.
 * No extra VRAM is consumed per copy.
 */
export class Ruins {
  constructor(environment) {
    this.environment = environment;
    this.group = new Group();
    this.group.name = 'ArenaRuins';

    this._sharedMaterial = null;
    this._sharedGeometry = null;
  }

  /**
   * Loads the GLB, builds the shared material, and places all instances.
   * @param {import('../loaders/AssetLoader.js').AssetLoader} _assets
   */
  async loadTextures(_assets) {
    let gltf;
    try {
      gltf = await this._loadGLB();
    } catch (err) {
      console.warn('[Ruins] Failed to load ancient_ruins_modular.glb:', err);
      return;
    }

    // ── 1. Find the first mesh in the loaded scene ───────────────────────────
    let sourceMesh = null;
    gltf.scene.traverse((node) => {
      if (node.isMesh && !sourceMesh) sourceMesh = node;
    });

    if (!sourceMesh) {
      console.warn('[Ruins] No mesh found in GLB.');
      return;
    }

    // ── 2. Build ONE shared material from the loaded mesh ────────────────────
    // The SpecularGlossinessPlugin has already wired the diffuse texture into
    // sourceMat.map (if present in the GLB). We take that and build a clean,
    // tuned MeshStandardMaterial to share across all instances.
    const sourceMat = sourceMesh.material;
    const diffuseMap = sourceMat?.map ?? null;

    this._sharedMaterial = new MeshStandardMaterial({
      color:     new Color(0xb8c4cc),
      roughness: 0.87,
      metalness: 0.03,
      map:       diffuseMap,
      normalMap: sourceMat?.normalMap ?? null,
      aoMap:     sourceMat?.aoMap     ?? null,
    });

    // Dispose the loader-created material — no longer needed
    if (sourceMat) sourceMat.dispose();

    // ── 3. Keep one shared geometry reference ────────────────────────────────
    this._sharedGeometry = sourceMesh.geometry;
    this._sharedGeometry.computeBoundingBox();

    const bbox = this._sharedGeometry.boundingBox;
    const size = new Vector3();
    bbox.getSize(size);

    // Scale so longest horizontal span ≈ 28 m
    const targetSpan  = 28.0;
    const currentSpan = Math.max(size.x, size.z);
    const scaleFactor = targetSpan / currentSpan;
    const minY        = bbox.min.y * scaleFactor;

    // ── 4. Place instances — all share the same geometry + material ──────────
    const placements = [
      { angle: 0,               radius: 42, yRot: 0              },
      { angle: Math.PI * 0.5,   radius: 44, yRot: Math.PI * 0.5  },
      { angle: Math.PI,         radius: 42, yRot: Math.PI         },
      { angle: Math.PI * 1.5,   radius: 44, yRot: Math.PI * 1.5  },
      { angle: Math.PI * 0.25,  radius: 50, yRot: Math.PI * 0.25 },
      { angle: Math.PI * 0.75,  radius: 50, yRot: Math.PI * 0.75 },
      { angle: Math.PI * 1.25,  radius: 50, yRot: Math.PI * 1.25 },
      { angle: Math.PI * 1.75,  radius: 50, yRot: Math.PI * 1.75 },
    ];

    for (const { angle, radius, yRot } of placements) {
      const mesh = new Mesh(this._sharedGeometry, this._sharedMaterial);
      mesh.scale.setScalar(scaleFactor);
      mesh.position.set(
        Math.cos(angle) * radius,
        -minY,
        Math.sin(angle) * radius
      );
      mesh.rotation.y    = yRot;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      mesh.layers.set(LAYER.WORLD);
      this.group.add(mesh);
    }
  }

  /**
   * Loads the GLB with the spec-gloss extension registered so the diffuse
   * texture is decoded into `material.map`.
   */
  _loadGLB() {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.register((parser) => new SpecularGlossinessPlugin(parser));
      loader.load(RUINS_URL, resolve, undefined, reject);
    });
  }

  update(_dt) {}

  dispose() {
    // Geometry and material are shared — only one disposal needed
    this._sharedGeometry?.dispose();
    this._sharedMaterial?.dispose();
    this.group.clear();
  }
}
