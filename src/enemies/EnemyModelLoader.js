/**
 * EnemyModelLoader.js
 *
 * Loads GLB / GLTF files for each enemy archetype, extracts skeletons + animations,
 * and provides an `applyTo(enemy)` function that replaces procedural meshes
 * with the loaded 3D animated model.
 *
 * Falls back silently to procedural geometry if a model is missing.
 */

import { AnimationMixer, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

/** Custom GLTF/GLB paths per archetype */
const CUSTOM_PATHS = {
  brute: './models/enemies/brute/Demon.gltf',
  runner: './models/enemies/runner/Skull.gltf',
  drone: './models/enemies/drone/YellowDragon (1).gltf',
  specter: './models/enemies/specter/Bat.gltf',
};

/** Default path pattern if not in CUSTOM_PATHS */
const defaultPath = (type) => `./models/enemies/${type}/${type}.glb`;

/**
 * Animation clip name mappings.
 * Maps logical state names -> substring match inside GLB/GLTF clip names.
 */
const ANIM_MAP = {
  brute: {
    idle: 'Idle',
    walk: 'Walk',
    run: 'Walk',
    attack: 'Bite_Front',
    hit: 'HitRecieve',
    jump: 'Jump',
    dance: 'Dance',
    die: 'Death',
  },
  runner: {
    idle: 'Idle',
    walk: 'Walk',
    run: 'Walk',
    attack: 'Bite_Front',
    hit: 'HitRecieve',
    jump: 'Jump',
    dance: 'Dance',
    die: 'Death',
  },
  drone: {
    idle: 'Flying',
    walk: 'Flying',
    run: 'Flying',
    attack: 'Bite_Front',
    hit: 'HitRecieve',
    die: 'Death',
  },
  specter: {
    idle: 'Flying',
    walk: 'Flying',
    run: 'Flying',
    attack: 'Bite_Front',
    hit: 'HitRecieve',
    die: 'Death',
  }
};

/**
 * Per-type target height in metres (matching ENEMY_ARCHETYPES in Enemy.js).
 */
const TARGET_HEIGHTS = {
  brute: 2.4,
  runner: 1.7,
  drone: 2.0,
  specter: 1.5,
};

export class EnemyModelLoader {
  constructor() {
    /** @type {Map<string, {scene: THREE.Group, clips: THREE.AnimationClip[], scaleFactor: number}>} */
    this._cache = new Map();
    this._loader = new GLTFLoader();
  }

  /**
   * Loads all available enemy models.
   * Missing models fall back to procedural meshes without crashing.
   */
  async load() {
    const types = ['brute', 'runner', 'drone', 'specter'];
    await Promise.allSettled(types.map((t) => this._loadType(t)));
  }

  /**
   * Returns true if a model was successfully loaded for this archetype.
   * @param {string} type
   */
  has(type) {
    return this._cache.has(type);
  }

  /**
   * Clones the loaded model for an enemy instance, replaces visualRoot,
   * wires up an AnimationMixer, and returns a controller object.
   *
   * @param {import('./Enemy.js').Enemy} enemy
   * @returns {{ mixer: AnimationMixer, play: (state: string) => void } | null}
   */
  applyTo(enemy) {
    const cached = this._cache.get(enemy.type);
    if (!cached) return null;

    const { scene: template, clips, scaleFactor } = cached;

    // Deep skeleton clone to keep bone hierarchy intact for skinned meshes
    const instance = cloneSkeleton(template);
    instance.scale.setScalar(scaleFactor);

    // Align vertical origin
    const box = new Box3().setFromObject(instance);
    instance.position.y = -box.min.y;

    // Replace procedural mesh inside visualRoot
    enemy.visualRoot.clear();
    enemy.visualRoot.add(instance);

    // Enable shadows for all meshes in the model
    instance.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    // Create animation mixer
    const mixer = new AnimationMixer(instance);
    const map = ANIM_MAP[enemy.type] ?? {};

    let currentAction = null;
    let currentActionName = null;

    function play(state) {
      if (currentActionName === state && currentAction?.isRunning()) return;
      const keyword = map[state] || state;
      if (!keyword) return;

      const clip = clips.find((c) => c.name.toLowerCase().includes(keyword.toLowerCase()));
      if (!clip) return;

      const next = mixer.clipAction(clip);
      if (state === 'die') {
        next.clampWhenFinished = true;
        next.setLoop(2201, 1); // LoopOnce
      }

      if (currentAction && currentAction !== next) {
        next.reset().fadeIn(0.2);
        currentAction.fadeOut(0.2);
      } else if (!next.isRunning()) {
        next.reset().fadeIn(0.1);
      }

      next.play();
      currentAction = next;
      currentActionName = state;
    }

    // Default to idle state
    play('idle');

    return { mixer, play };
  }

  /* ── private ── */

  async _loadType(type) {
    const url = CUSTOM_PATHS[type] ?? defaultPath(type);
    try {
      const gltf = await this._loadGLTF(url);

      const box = new Box3().setFromObject(gltf.scene);
      const size = new Vector3();
      box.getSize(size);
      const targetH = TARGET_HEIGHTS[type] ?? 1.7;
      const scaleFactor = targetH / Math.max(size.y, 0.001);

      this._cache.set(type, {
        scene: gltf.scene,
        clips: gltf.animations ?? [],
        scaleFactor,
      });

      console.info(
        `[EnemyModelLoader] ✓ ${type} loaded (${url}) — ` +
        `${gltf.animations?.length ?? 0} anims, scale ×${scaleFactor.toFixed(3)}`
      );
    } catch (err) {
      console.info(`[EnemyModelLoader] ✗ ${type} — fallback to procedural (${err.message})`);
    }
  }

  _loadGLTF(url) {
    return new Promise((resolve, reject) =>
      this._loader.load(url, resolve, undefined, (e) => reject(e))
    );
  }

  dispose() {
    this._cache.clear();
  }
}
