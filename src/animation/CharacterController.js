import {
  AnimationMixer,
  Box3,
  Group,
  LinearMipmapLinearFilter,
  LoopRepeat,
  MathUtils,
  MeshStandardMaterial,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3
} from 'three';
import { settings } from '../config/settings.js';
import { LAYER } from '../core/Layers.js';
import { disposeObject } from '../utils/dispose.js';
import { SittingPose } from './SittingPose.js';

const CHARACTER_URL = './models/Standing Idle.fbx';
/** Hand-authored albedo atlas replacing the FBX's unresolvable texture refs. */
const CHARACTER_TEXTURE_URL = './angtexture.png';
/** Mixamo exports in centimetres. */
const FBX_SCALE = 0.01;
/** Rigs vary; normalise to a believable human height so the world scale holds. */
const TARGET_HEIGHT = 1.78;

/**
 * Loads the rigged FBX, normalises it for the scene and drives its animation.
 *
 * The character is intentionally stationary — it only ever idles. The class is
 * still built around a small action registry with cross-fading so additional
 * clips (a casting flourish, a reaction) can be dropped in without touching
 * anything else.
 *
 * On top of the clip sits a second, procedural layer: `SittingPose` bakes a
 * cross-legged meditation pose straight onto the skeleton, and `settings.
 * character.pose` cross-fades the two. Because that layer runs *after* the
 * mixer each frame it needs no clip of its own.
 */
export class CharacterController {
  constructor(environment) {
    this.environment = environment;
    this.root = new Group();
    this.root.name = 'Character';

    // Position and heading live on `root`; the bank (walk mode leans into its
    // turns) lives on a joint underneath it, so the two never fight over the
    // same rotation.
    this.tilt = new Group();
    this.tilt.name = 'CharacterTilt';
    this.root.add(this.tilt);

    this.mixer = null;
    this.actions = new Map();
    this.current = null;
    this.height = 1.8;
    this.headPosition = new Vector3(0, 1.5, 0);
    /** The rig's own forward, in model space — the axis a bank rotates about. */
    this.forwardAxis = new Vector3(0, 0, 1);

    this.sitting = null;
    this._poseWeight = 0; // 0 = idle clip, 1 = seated
    this._poseTime = 0;
    this._poseBlend = null; // seconds, overrides settings for one transition

    /**
     * Yaw of the rig's own forward in model space. Bind poses are not
     * necessarily axis aligned, so `setFacing` subtracts this to make "0 faces
     * +Z" true for the caller regardless of how the FBX was authored.
     */
    this._forwardYaw = 0;
    /** 0..1 lunge envelope, decays on its own after `castLunge()`. */
    this._lunge = 0;
    this._rightAxis = new Vector3(1, 0, 0);
  }

  /**
   * @param {import('../loaders/AssetLoader.js').AssetLoader} assets
   */
  async load(assets) {
    const [fbx, albedo] = await Promise.all([
      assets.loadFBX(CHARACTER_URL),
      assets.loadTexture(CHARACTER_TEXTURE_URL)
    ]);
    // The FBX resolves before its textures do; material prep inspects them.
    await assets.settled();

    // A small pixel-art atlas: keep the texels hard under magnification, but
    // let mipmaps handle minification so the face doesn't shimmer at distance.
    albedo.colorSpace = SRGBColorSpace;
    albedo.magFilter = NearestFilter;
    albedo.minFilter = LinearMipmapLinearFilter;
    albedo.generateMipmaps = true;
    albedo.anisotropy = 4;
    // The rig's UVs run outside the unit square (u ∈ [-1, 1], v ∈ [1, 2]), so
    // the default clamp would drag one edge row across the whole body.
    albedo.wrapS = RepeatWrapping;
    albedo.wrapT = RepeatWrapping;
    albedo.needsUpdate = true;
    this.albedo = albedo;

    fbx.scale.setScalar(FBX_SCALE);
    fbx.updateMatrixWorld(true);

    const box = new Box3().setFromObject(fbx);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);

    // Normalise the rig's height, then drop it onto y = 0 and centre it.
    fbx.scale.setScalar(FBX_SCALE * (TARGET_HEIGHT / Math.max(0.001, size.y)));
    fbx.updateMatrixWorld(true);
    box.setFromObject(fbx);
    box.getSize(size);
    box.getCenter(center);
    this.height = size.y;
    fbx.position.x -= center.x;
    fbx.position.z -= center.z;
    fbx.position.y -= box.min.y;

    this._prepareMaterials(fbx);

    this.tilt.add(fbx);
    this.model = fbx;
    this.headPosition.set(0, size.y * 0.86, 0);

    // Bake the seated pose while the rig is still untouched by the mixer.
    this.sitting = new SittingPose(fbx);
    if (this.sitting.valid) this.forwardAxis.copy(this.sitting.forward);
    this._forwardYaw = Math.atan2(this.forwardAxis.x, this.forwardAxis.z);
    this._rightAxis.set(0, 1, 0).cross(this.forwardAxis).normalize();

    // The idle clip ships inside the same file.
    this.mixer = new AnimationMixer(fbx);
    const clips = fbx.animations ?? [];
    if (clips.length === 0) {
      console.warn('[CharacterController] no animation clips found in the FBX');
    } else {
      clips.forEach((clip, index) => {
        const name = clip.name && clip.name !== 'mixamo.com' ? clip.name : index === 0 ? 'idle' : `clip_${index}`;
        const action = this.mixer.clipAction(clip);
        action.setLoop(LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        this.actions.set(name, action);
      });
      this.play([...this.actions.keys()][0], 0);
    }

    return this;
  }

  /** Convert imported materials to PBR and hook them into the shadow system. */
  _prepareMaterials(root) {
    const converted = new Map();

    root.traverse((node) => {
      if (!node.isMesh && !node.isSkinnedMesh) return;

      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;
      node.layers.set(LAYER.WORLD);
      node.layers.enable(LAYER.CONTACT); // captured by the contact shadow pass

      const source = Array.isArray(node.material) ? node.material : [node.material];
      const result = source.map((material) => {
        if (!material) return material;
        if (converted.has(material)) return converted.get(material);

        // FBX gives us Phong/Lambert; move to Standard so IBL and CSM apply.
        // The FBX references its own textures by absolute local path, so they
        // never resolve — the authored atlas is substituted wholesale, with a
        // white base colour so the map's tones come through untinted.
        const standard = new MeshStandardMaterial({
          name: material.name,
          color: 0xffffff,
          map: this.albedo,
          normalMap: material.normalMap ?? null,
          roughness: 0.85,
          metalness: 0,
          transparent: material.transparent ?? false,
          opacity: material.opacity ?? 1,
          side: material.side
        });

        this.environment.registerShadowCaster(standard);
        material.dispose();
        converted.set(material, standard);
        return standard;
      });

      node.material = Array.isArray(node.material) ? result : result[0];
    });
  }

  /** Cross-fade to a named action. */
  play(name, fadeDuration = 0.35) {
    const next = this.actions.get(name);
    if (!next || next === this.current) return;

    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);

    if (this.current && fadeDuration > 0) {
      next.crossFadeFrom(this.current, fadeDuration, true);
    }
    next.play();
    this.current = next;
  }

  /* ------------------------------------------------------------------ */
  /* pose layer                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * @param {'idle'|'sitting'} pose
   * @param {number|null} [blend] seconds for *this* transition only; the
   *   configured blend time is used again as soon as the pose is set without one.
   */
  setPose(pose, blend = null) {
    this._poseBlend = blend;
    settings.character.pose = pose === 'sitting' ? 'sitting' : 'idle';
    return settings.character.pose;
  }

  /** Flip between the idle clip and the meditation sit. @returns {string} the new pose */
  togglePose() {
    return this.setPose(settings.character.pose === 'sitting' ? 'idle' : 'sitting');
  }

  get isSitting() {
    return settings.character.pose === 'sitting';
  }

  /** How far the seated pose has actually blended in, 0..1. */
  get poseWeight() {
    return this._poseWeight;
  }

  /* ------------------------------------------------------------------ */
  /* placement — driven by walk mode, inert otherwise                    */
  /* ------------------------------------------------------------------ */

  /** Heading, radians about world +Y. 0 faces +Z, whichever way the rig binds. */
  setFacing(yaw) {
    this.root.rotation.y = yaw - this._forwardYaw;
  }

  get facing() {
    return this.root.rotation.y + this._forwardYaw;
  }

  /**
   * Turn toward `yaw` over time rather than snapping.
   * @param {number} rate fraction of the angle gap left after one second
   */
  turnToward(yaw, rate, dt) {
    const current = this.facing;
    // Shortest way round, so aiming across the -Z seam does not spin the body.
    const delta = MathUtils.euclideanModulo(yaw - current + Math.PI, Math.PI * 2) - Math.PI;
    this.setFacing(current + delta * (1 - Math.pow(MathUtils.clamp(rate, 1e-6, 1), dt)));
  }

  /**
   * Punch the body forward, then let it settle.
   *
   * The rig only ships an idle clip, so the cast is sold procedurally: a pitch
   * about the body's own right axis plus a shove back along its forward axis,
   * both riding on one decaying envelope. Applied to `tilt` rather than `root`
   * so it composes with the heading instead of fighting it.
   */
  castLunge() {
    this._lunge = 1;
  }

  _applyLunge(dt) {
    const c = settings.character;
    if (this._lunge > 0) {
      this._lunge = Math.max(0, this._lunge - c.castSettle * dt);
    }
    // A short overshoot at the front of the envelope reads as a snap rather than
    // a slow bow.
    const envelope = this._lunge * this._lunge * (1 + 0.35 * Math.sin(this._lunge * Math.PI));
    this.tilt.quaternion.setFromAxisAngle(this._rightAxis, envelope * c.castLean);
    this.tilt.position.copy(this.forwardAxis).multiplyScalar(-envelope * c.castRecoil);
  }

  /** Put the character back on the floor, upright and facing where it was. */
  resetPlacement() {
    this.root.position.y = 0;
    this._lunge = 0;
    this.tilt.quaternion.identity();
    this.tilt.position.set(0, 0, 0);
  }

  update(dt) {
    // Driven by the *simulation* delta, and re-applied every frame even at
    // dt = 0: pausing mid-cast holds the lunge, and `castLean` stays a live
    // slider against that frozen pose.
    this._applyLunge(dt);

    if (!this.mixer) return;

    // Editing the tuning sliders re-bakes the pose; cheap and rare.
    if (this.sitting?.valid && this.sitting.stale) this.sitting.build();

    this.mixer.timeScale = settings.global.animationSpeed;
    this.mixer.update(dt);

    if (!this.sitting?.valid) return;
    this._poseTime += dt;

    const target = this.isSitting ? 1 : 0;
    const step = dt / Math.max(0.001, this._poseBlend ?? settings.character.blendTime);
    this._poseWeight = MathUtils.clamp(
      this._poseWeight + MathUtils.clamp(target - this._poseWeight, -step, step),
      0,
      1
    );

    // Ease the blend so the sit settles instead of arriving at constant speed.
    this.sitting.apply(MathUtils.smoothstep(this._poseWeight, 0, 1), this._poseTime);
  }

  get position() {
    return this.root.position;
  }

  dispose() {
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.actions.clear();
    disposeObject(this.root);
  }
}
