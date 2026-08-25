import {
  Scene,
  Fog,
  Vector3,
  Object3D,
  AmbientLight,
  HemisphereLight,
  DirectionalLight,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  TextureLoader
} from 'three';
import { settings } from '../config/settings.js';
import { getColor } from '../utils/color.js';
import { frame } from '../core/FrameUniforms.js';
import { patchOnBeforeCompile } from '../utils/shaderPatch.js';

/** Equirectangular skybox loaded from the public folder. */
const SKYBOX_URL = './skybox/sky_88_2k.png';

const _sunDir = new Vector3();

/** Half-width of the shadowed area, in metres, centred on the action. */
const SHADOW_EXTENT = 26;

/**
 * Scene, atmosphere and lighting.
 *
 * The look is a dark cinematic stage rather than an outdoor field: a warm key
 * light, a cool rim from behind, almost no fill, and a fog whose colour matches
 * the flat backdrop so the floor dissolves into the void at the edges. The HDR
 * probe is still loaded, but only as (dim) image-based lighting and as the
 * reflection source for the water / wind shaders — never as the visible sky.
 *
 * Sun shadows use one directional light whose orthographic shadow camera is
 * re-centred on the character every frame and fitted tightly to the play area.
 * At 4096² over a 52 m box that is ~1.3 cm per texel — sharper than a three
 * cascade split would give here, without the cost or the complexity.
 *
 * (An earlier revision used the CSM addon. It replaces three's
 * `lights_fragment_begin` chunk *globally*, which means every material in the
 * scene silently loses all directional lighting unless it is explicitly
 * registered with CSM — a footgun that is not worth it for a play area this
 * small.)
 */
export class Environment {
  /**
   * @param {import('../core/Renderer.js').Renderer} renderer
   * @param {THREE.PerspectiveCamera} camera
   */
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;

    this.scene = new Scene();
    // Flat dark backdrop, kept in a Color we own so the editor can drive it.
    this._bgColor = getColor(settings.environment.backgroundColor).clone();
    this.scene.background = this._bgColor;
    // Kept in a Fog we own so the editor can drive its colour and range, and so
    // it can be switched off entirely by detaching it from the scene.
    this._fog = new Fog(
      getColor(settings.environment.fogColor).clone(),
      settings.environment.fogNear,
      settings.environment.fogFar
    );
    this.scene.fog = settings.environment.fogEnabled ? this._fog : null;

    this.ambient = new AmbientLight(
      getColor(settings.environment.ambientColor).clone(),
      settings.environment.ambientIntensity
    );
    this.hemi = new HemisphereLight(
      getColor(settings.environment.hemiSkyColor).clone(),
      getColor(settings.environment.hemiGroundColor).clone(),
      settings.environment.hemiIntensity
    );

    this.sun = new DirectionalLight(
      getColor(settings.environment.sunColor).clone(),
      settings.environment.sunIntensity
    );
    this.sun.castShadow = true;

    // Scale shadow map by tier: 1024 on LOW, 2048 on MED, 2048 on HIGH (saving massive VRAM & fill rate)
    const tier = renderer.tier ?? 'MED';
    const shadowRes = tier === 'LOW' ? 1024 : tier === 'MED' ? 2048 : 2048;
    this.sun.shadow.mapSize.set(shadowRes, shadowRes);
    this.sun.shadow.bias = settings.environment.shadowBias;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = settings.environment.shadowRadius;

    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -SHADOW_EXTENT;
    shadowCamera.right = SHADOW_EXTENT;
    shadowCamera.top = SHADOW_EXTENT;
    shadowCamera.bottom = -SHADOW_EXTENT;
    shadowCamera.near = 0.5;
    shadowCamera.far = 140;
    shadowCamera.updateProjectionMatrix();

    /** The light aims at this; both are moved together to follow the action. */
    this.sunTarget = new Object3D();

    /**
     * Cool separation light coming from behind the stage. No shadows: it exists
     * purely to draw a bright edge around the character and the effects so they
     * do not merge into the dark backdrop.
     */
    this.rim = new DirectionalLight(
      getColor(settings.environment.rimColor).clone(),
      settings.environment.rimIntensity
    );
    this.rimTarget = new Object3D();
    this.rim.target = this.rimTarget;

    this.scene.add(this.ambient, this.hemi, this.sun, this.sunTarget, this.rim, this.rimTarget);
    this.sun.target = this.sunTarget;

    this.focus = new Vector3();
    this._envMap = null;
    this._pmrem = null;
    this._rimDir = new Vector3();
  }

  /**
   * Load `public/skybox/sky_88_2k.png` as the visible sky *and* as the IBL
   * probe for PBR reflections. The raw equirect is mapped directly onto the
   * scene background; a PMREM cube is generated from it so all standard
   * materials (water, ice, etc.) pick up the correct filtered reflections.
   *
   * The `hdrTexture` argument is accepted for API compatibility but ignored —
   * the skybox PNG is always the source of truth now.
   */
  async loadEnvironment(_hdrTexture) {
    return new Promise((resolve, reject) => {
      new TextureLoader().load(
        SKYBOX_URL,
        (tex) => {
          tex.mapping = EquirectangularReflectionMapping;

          // Visible sky.
          this.scene.background = tex;
          this.equirect = tex;

          // IBL — run the equirect through PMREM so PBR materials get proper
          // filtered environment reflections.
          const pmrem = new PMREMGenerator(this.renderer.gl);
          pmrem.compileEquirectangularShader();
          const envTarget = pmrem.fromEquirectangular(tex);
          this._envMap = envTarget.texture;
          this.scene.environment = this._envMap;
          this.scene.environmentIntensity = settings.environment.envIntensity;
          pmrem.dispose();

          resolve();
        },
        undefined,
        (err) => {
          console.warn('[Environment] Skybox failed to load, keeping flat background.', err);
          resolve(); // non-fatal
        }
      );
    });
  }


  /**
   * Opt a material into the scene's shadow setup.
   *
   * Nothing is required any more — standard materials receive the sun by
   * default — but the hook is kept so callers do not need to care whether the
   * shadow implementation changes again.
   */
  registerShadowCaster(material) {
    return material;
  }

  /** Register a material and inject custom shader code into it. */
  registerShadowCasterWithPatch(material, patch) {
    patchOnBeforeCompile(material, patch);
    return material;
  }

  /** Keep the shadow volume centred on the action. */
  setFocus(x, z) {
    this.focus.set(x, 0, z);
  }

  /** Direction a light travels (from the light toward the scene). */
  _computeLightDirection(out, azimuth, elevation) {
    const cosE = Math.cos(elevation);
    out.set(-Math.cos(azimuth) * cosE, -Math.sin(elevation), -Math.sin(azimuth) * cosE);
    return out.normalize();
  }

  update() {
    const env = settings.environment;

    this._computeLightDirection(_sunDir, env.sunAzimuth, env.sunElevation);

    // Park the light up-sun from the focus point so the shadow frustum always
    // contains the play area.
    this.sunTarget.position.copy(this.focus);
    this.sun.position.copy(this.focus).addScaledVector(_sunDir, -70);

    // Hand the key direction to the custom shaders that fake their own normals.
    frame.uLightDir.value.copy(_sunDir).negate();

    this.sun.intensity = env.sunIntensity;
    this.sun.color.copy(getColor(env.sunColor));
    this.sun.shadow.radius = env.shadowRadius;
    this.sun.shadow.bias = env.shadowBias;

    this._computeLightDirection(this._rimDir, env.rimAzimuth, env.rimElevation);
    this.rimTarget.position.copy(this.focus);
    this.rim.position.copy(this.focus).addScaledVector(this._rimDir, -40);
    this.rim.intensity = env.rimIntensity;
    this.rim.color.copy(getColor(env.rimColor));

    this.ambient.intensity = env.ambientIntensity;
    this.ambient.color.copy(getColor(env.ambientColor));
    this.hemi.intensity = env.hemiIntensity;
    this.hemi.color.copy(getColor(env.hemiSkyColor));
    this.hemi.groundColor.copy(getColor(env.hemiGroundColor));

    this.scene.environmentIntensity = env.envIntensity;

    // Only restore the flat bgColor fallback if the skybox texture hasn't
    // loaded yet — once it is set we never want to overwrite it.
    if (this.scene.background === this._bgColor) {
      this._bgColor.copy(getColor(env.backgroundColor));
    }

    // Attaching / detaching the fog flips the FOG shader define, so the switch
    // costs one recompile — fine for an editor toggle, and free while it stays on.
    this.scene.fog = env.fogEnabled ? this._fog : null;
    this._fog.color.copy(getColor(env.fogColor));
    this._fog.near = env.fogNear;
    this._fog.far = env.fogFar;
  }

  dispose() {
    this._envMap?.dispose();
    this.equirect?.dispose();
    this.sun.shadow.dispose();
  }
}
