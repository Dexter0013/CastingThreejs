import GUI from 'lil-gui';
import { settings } from '../config/settings.js';
import { PresetManager } from './PresetManager.js';

/**
 * Real-time VFX editor.
 *
 * Every control binds straight to a field in `config/settings.js`. Because all
 * shaders, particle systems, lights and post passes *read* those fields each
 * frame, no controller needs an onChange handler: moving a slider updates the
 * ice field that is already standing, the next cast, the environment and the
 * post stack simultaneously, with no rebuild and no shader recompilation.
 *
 * That holds while the simulation is paused (`P`), which is the point — the
 * silhouette of a frozen eruption is the thing worth tuning, and `IceAbility`
 * re-resolves every crystal from these values on a zero-length frame.
 */
export class Editor {
  /**
   * @param {object} hooks { onClear, onToast }
   */
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.presets = new PresetManager();

    this.gui = new GUI({ title: 'VFX Editor', width: 330 });
    this.gui.domElement.style.setProperty('--title-height', '30px');

    this._presetState = { name: 'My preset', selected: this.presets.names[0] ?? '' };

    this._buildPresets();
    this._buildGlobal();
    this._buildAim();
    this._buildIce();
    this._buildEnvironment();
    this._buildPost();
    this._buildCamera();
    this._buildCharacter();

    // Everything starts closed except the ability itself — that is what the
    // sandbox is for.
    this.gui.folders.forEach((folder) => folder.close());
    this.iceFolder.open();
  }

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  static range(folder, object, key, min, max, step, label) {
    return folder.add(object, key, min, max, step).name(label ?? key);
  }

  refresh() {
    this.gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  }

  toggle() {
    this._hidden = !this._hidden;
    this.gui.show(!this._hidden);
  }

  /* ------------------------------------------------------------------ */
  /* folders                                                             */
  /* ------------------------------------------------------------------ */

  _buildPresets() {
    const folder = this.gui.addFolder('Presets');
    const state = this._presetState;

    let selector = folder
      .add(state, 'selected', this.presets.names.length ? this.presets.names : [''])
      .name('preset');

    // lil-gui rebuilds the controller when the option list changes, so the
    // reference has to be replaced rather than mutated.
    const refreshOptions = () => {
      const names = this.presets.names;
      selector = selector.options(names.length ? names : ['']).name('preset');
      selector.setValue(names.includes(state.selected) ? state.selected : (names[0] ?? ''));
    };

    folder.add(state, 'name').name('name');

    folder
      .add(
        {
          save: () => {
            this.presets.save(state.name);
            state.selected = state.name;
            refreshOptions();
            this.hooks.onToast?.(`Saved preset "${state.name}"`);
          }
        },
        'save'
      )
      .name('Save preset');

    folder
      .add(
        {
          load: () => {
            if (this.presets.load(state.selected)) {
              this.refresh();
              this.hooks.onToast?.(`Loaded "${state.selected}"`);
            }
          }
        },
        'load'
      )
      .name('Load preset');

    folder
      .add(
        {
          duplicate: () => {
            const copy = this.presets.duplicate(state.selected);
            if (copy) {
              state.selected = copy;
              refreshOptions();
              this.hooks.onToast?.(`Duplicated to "${copy}"`);
            }
          }
        },
        'duplicate'
      )
      .name('Duplicate');

    folder
      .add(
        {
          remove: () => {
            if (this.presets.remove(state.selected)) {
              refreshOptions();
              this.hooks.onToast?.('Preset deleted');
            }
          }
        },
        'remove'
      )
      .name('Delete');

    folder.add({ exportOne: () => this.presets.exportJSON() }, 'exportOne').name('Export current (JSON)');
    folder.add({ exportAll: () => this.presets.exportAll() }, 'exportAll').name('Export all presets');

    folder
      .add(
        {
          import: async () => {
            const result = await this.presets.importFromFile();
            refreshOptions();
            this.refresh();
            this.hooks.onToast?.(
              result.applied
                ? 'Settings imported'
                : result.imported.length
                  ? `Imported ${result.imported.length} preset(s)`
                  : 'Nothing imported'
            );
          }
        },
        'import'
      )
      .name('Import JSON…');

    folder
      .add(
        {
          reset: () => {
            this.presets.reset();
            this.refresh();
            this.hooks.onToast?.('Reset to defaults');
          }
        },
        'reset'
      )
      .name('Reset to defaults');

    this.presetFolder = folder;
  }

  _buildGlobal() {
    const folder = this.gui.addFolder('Global');
    const g = settings.global;
    const R = Editor.range;

    R(folder, g, 'timeScale', 0.02, 2, 0.01, 'time scale');
    R(folder, g, 'speed', 0.1, 4, 0.01, 'cast speed');
    R(folder, g, 'lifetime', 0.1, 4, 0.01, 'lifetime');
    R(folder, g, 'glow', 0, 5, 0.01, 'glow intensity');
    R(folder, g, 'shaderIntensity', 0, 2, 0.01, 'shader intensity');
    R(folder, g, 'opacity', 0, 2, 0.01, 'opacity');
    R(folder, g, 'noiseFrequency', 0.1, 4, 0.01, 'noise frequency');
    R(folder, g, 'noiseSpeed', 0, 4, 0.01, 'noise speed');
    R(folder, g, 'turbulence', 0, 4, 0.01, 'turbulence');
    R(folder, g, 'randomness', 0, 2, 0.01, 'randomness');
    R(folder, g, 'fresnel', 0, 3, 0.01, 'fresnel strength');

    const particles = folder.addFolder('Particles');
    R(particles, g, 'particleCount', 0, 3, 0.01, 'count');
    R(particles, g, 'particleLifetime', 0.1, 3, 0.01, 'lifetime');
    R(particles, g, 'particleSpeed', 0.1, 3, 0.01, 'speed');
    R(particles, g, 'particleSize', 0.1, 3, 0.01, 'size');
    R(particles, g, 'emissionRate', 0, 3, 0.01, 'emission rate');

    const lighting = folder.addFolder('Lighting & impact');
    R(lighting, g, 'lightIntensity', 0, 4, 0.01, 'light intensity');
    R(lighting, g, 'lightRadius', 0.1, 4, 0.01, 'light radius');
    R(lighting, g, 'explosionIntensity', 0, 3, 0.01, 'impact intensity');
    R(lighting, g, 'cameraShake', 0, 3, 0.01, 'camera shake');
    R(lighting, g, 'animationSpeed', 0, 3, 0.01, 'animation speed');

    this.globalFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  _buildAim() {
    const folder = this.gui.addFolder('➤  Aim indicator');
    const a = settings.aim;
    const R = Editor.range;

    const shape = folder.addFolder('Silhouette (metres)');
    R(shape, a, 'shaftWidth', 0.05, 2, 0.01, 'shaft half-width');
    R(shape, a, 'headLength', 0.2, 8, 0.05, 'head length');
    R(shape, a, 'headWidth', 0.1, 5, 0.01, 'head half-width');
    R(shape, a, 'round', 0, 0.6, 0.01, 'corner rounding');
    R(shape, a, 'startOffset', 0, 5, 0.05, 'gap at the caster');
    R(shape, a, 'height', 0.005, 0.4, 0.005, 'hover height');

    const look = folder.addFolder('Rendering');
    R(look, a, 'edge', 0.01, 0.5, 0.005, 'outline thickness');
    R(look, a, 'edgeGlow', 0, 8, 0.05, 'outline glow');
    R(look, a, 'softness', 0.005, 0.5, 0.005, 'edge softness');
    R(look, a, 'fill', 0, 1.5, 0.01, 'interior fill');
    R(look, a, 'fillFalloff', 0.1, 4, 0.05, 'fill falloff');
    R(look, a, 'opacity', 0, 2, 0.01, 'opacity');
    look.addColor(a, 'colorCore').name('core colour');
    look.addColor(a, 'colorEdge').name('edge colour');
    look.addColor(a, 'colorInvalid').name('too-close colour');

    const energy = folder.addFolder('Energy & frost');
    R(energy, a, 'stripes', 0, 4, 0.01, 'chevrons / metre');
    R(energy, a, 'stripeSharp', 0, 1, 0.01, 'chevron sharpness');
    R(energy, a, 'stripeDepth', 0, 1, 0.01, 'chevron depth');
    R(energy, a, 'scrollSpeed', -10, 10, 0.05, 'scroll speed');
    R(energy, a, 'pulse', 0, 1, 0.01, 'pulse');
    R(energy, a, 'pulseSpeed', 0, 8, 0.05, 'pulse speed');
    R(energy, a, 'noise', 0, 1.5, 0.01, 'frost noise');
    R(energy, a, 'noiseScale', 0.1, 8, 0.05, 'noise scale');
    R(energy, a, 'noiseSpeed', 0, 3, 0.01, 'noise speed');
    R(energy, a, 'crystals', 0, 2, 0.01, 'frost plates');
    R(energy, a, 'crystalScale', 0.2, 10, 0.05, 'plate scale');

    const furniture = folder.addFolder('Rings & rosette');
    R(furniture, a, 'baseRing', 0, 3, 0.01, 'base ring radius');
    R(furniture, a, 'baseRingWidth', 0.005, 0.4, 0.005, 'base ring width');
    R(furniture, a, 'tipGlyph', 0, 2, 0.01, 'tip rosette');
    R(furniture, a, 'tipGlyphSize', 0.1, 4, 0.05, 'rosette radius');
    R(furniture, a, 'tipSpin', -3, 3, 0.01, 'rosette spin');
    R(furniture, a, 'rangeArc', 0, 2, 0.01, 'range arc');
    R(furniture, a, 'reveal', 0.01, 1, 0.005, 'sweep-out time');
  }

  /* ------------------------------------------------------------------ */

  _buildIce() {
    const folder = this.gui.addFolder('❄  Frost Lance');
    const c = settings.ice;
    const R = Editor.range;

    const cast = folder.addFolder('The cast');
    R(cast, c, 'range', 2, 40, 0.1, 'max range');
    R(cast, c, 'minRange', 0, 10, 0.1, 'min range');
    R(cast, c, 'speed', 2, 80, 0.5, 'front speed');
    R(cast, c, 'lifetime', 0.2, 12, 0.1, 'field lifetime');
    R(cast, c, 'cooldown', 0, 6, 0.05, 'cooldown');

    const field = folder.addFolder('Footprint');
    R(field, c, 'widthNear', 0.05, 6, 0.01, 'width at caster');
    R(field, c, 'width', 0.1, 10, 0.05, 'width at target');
    R(field, c, 'widthCurve', 0.2, 4, 0.01, 'width curve');
    R(field, c, 'spikeCount', 4, 288, 1, 'crystal count');
    R(field, c, 'density', 0.05, 1, 0.01, 'density');
    R(field, c, 'clumping', 0.3, 4, 0.01, 'pull to centre');
    R(field, c, 'scatter', 0, 2, 0.01, 'lateral scatter');
    R(field, c, 'frontBias', 0.3, 3, 0.01, 'crowd toward target');

    const shape = folder.addFolder('Silhouette');
    R(shape, c, 'heightNear', 0.05, 6, 0.01, 'height at caster');
    R(shape, c, 'height', 0.1, 12, 0.05, 'height at target');
    R(shape, c, 'heightCurve', 0.2, 5, 0.01, 'height curve');
    R(shape, c, 'heightJitter', 0, 1.5, 0.01, 'height jitter');
    R(shape, c, 'crown', 0, 0.95, 0.01, 'flank falloff');
    R(shape, c, 'peak', 1, 4, 0.01, 'swell at target');
    R(shape, c, 'peakWidth', 0.02, 1, 0.01, 'swell width');
    R(shape, c, 'rubble', 0, 1, 0.01, 'rubble fraction');
    R(shape, c, 'rubbleScale', 0.05, 1, 0.01, 'rubble height');

    // These four regenerate the crystal geometry — see IceAbility#_syncGeometry.
    const crystal = folder.addFolder('The crystal');
    R(crystal, c, 'radius', 0.02, 1.5, 0.01, 'base radius');
    R(crystal, c, 'radiusJitter', 0, 1.5, 0.01, 'radius jitter');
    R(crystal, c, 'taper', 0.01, 0.8, 0.01, 'tip taper');
    R(crystal, c, 'facets', 3, 10, 1, 'facets');
    R(crystal, c, 'roughness', 0, 1, 0.01, 'surface roughness');
    R(crystal, c, 'bend', 0, 1.5, 0.01, 'bend');
    R(crystal, c, 'lean', 0, 1.4, 0.01, 'lean from caster');
    R(crystal, c, 'leanJitter', 0, 1.5, 0.01, 'lean jitter');
    R(crystal, c, 'twist', 0, 1, 0.01, 'random yaw');

    const rise = folder.addFolder('The eruption');
    R(rise, c, 'riseTime', 0.02, 1.5, 0.01, 'rise time');
    R(rise, c, 'riseOvershoot', 0, 1, 0.01, 'punch overshoot');
    R(rise, c, 'riseStagger', 0, 1, 0.005, 'stagger');
    R(rise, c, 'settle', 0.05, 2, 0.01, 'settle time');
    R(rise, c, 'shatterDelay', 0, 4, 0.05, 'hold before sinking');
    R(rise, c, 'sinkTime', 0.1, 4, 0.05, 'sink time');

    const material = folder.addFolder('Ice material');
    material.addColor(c, 'colorDeep').name('deep');
    material.addColor(c, 'colorIce').name('body');
    material.addColor(c, 'colorRim').name('rim');
    material.addColor(c, 'colorCore').name('inner light');
    R(material, c, 'opacity', 0, 1, 0.01, 'opacity');
    R(material, c, 'depthTint', 0, 3, 0.01, 'thickness tint');
    R(material, c, 'fresnel', 0, 6, 0.01, 'fresnel');
    R(material, c, 'fresnelPower', 0.5, 6, 0.05, 'fresnel power');
    R(material, c, 'translucency', 0, 4, 0.01, 'translucency');
    R(material, c, 'envIntensity', 0, 3, 0.01, 'reflection');
    R(material, c, 'facetSharp', 0, 1.5, 0.01, 'facet contrast');
    R(material, c, 'fracture', 0, 2, 0.01, 'internal cracks');
    R(material, c, 'fractureScale', 0.5, 20, 0.1, 'crack scale');
    R(material, c, 'veins', 0, 2, 0.01, 'feather frost');
    R(material, c, 'veinScale', 0.2, 10, 0.05, 'frost scale');
    R(material, c, 'glint', 0, 5, 0.01, 'surface glint');
    R(material, c, 'glintScale', 4, 90, 0.5, 'glint scale');
    R(material, c, 'glintSpeed', 0, 4, 0.01, 'glint speed');
    R(material, c, 'frostLine', 0, 1.5, 0.01, 'rime at the base');
    R(material, c, 'glow', 0, 5, 0.01, 'glow');
    R(material, c, 'edgeGlow', 0, 6, 0.01, 'edge glow');
    R(material, c, 'birthGlow', 0, 10, 0.05, 'birth flash');
    R(material, c, 'birthFade', 0.02, 2, 0.01, 'birth flash time');

    const ground = folder.addFolder('Frost on the ground');
    R(ground, c, 'frostSpread', 0.1, 5, 0.01, 'patch radius');
    R(ground, c, 'frostRate', 0.2, 12, 0.1, 'patches / metre');
    R(ground, c, 'frostLife', 0.5, 20, 0.1, 'patch lifetime');
    R(ground, c, 'frostIntensity', 0, 2, 0.01, 'intensity');
    R(ground, c, 'frostCrystals', 0, 4, 0.01, 'crystal sharpness');
    R(ground, c, 'shockRadius', 0.5, 20, 0.1, 'shockwave radius');
    ground.addColor(c, 'colorFrost').name('frost');
    ground.addColor(c, 'colorFrostEdge').name('frost edge');

    const mist = folder.addFolder('Mist, chips & glitter');
    R(mist, c, 'mistRate', 0, 900, 1, 'mist rate');
    R(mist, c, 'mistSize', 0.05, 4, 0.01, 'mist size');
    R(mist, c, 'mistSpeed', 0, 8, 0.05, 'mist speed');
    R(mist, c, 'mistLifetime', 0.2, 8, 0.05, 'mist lifetime');
    R(mist, c, 'mistOpacity', 0, 2, 0.01, 'mist opacity');
    R(mist, c, 'mistRise', -2, 4, 0.01, 'mist rise');
    R(mist, c, 'shardRate', 0, 500, 1, 'chip rate');
    R(mist, c, 'shardSize', 0.005, 0.5, 0.005, 'chip size');
    R(mist, c, 'shardSpeed', 0, 25, 0.1, 'chip speed');
    R(mist, c, 'shardLifetime', 0.1, 5, 0.05, 'chip lifetime');
    R(mist, c, 'shardGravity', -40, 0, 0.1, 'chip gravity');
    R(mist, c, 'sparkleRate', 0, 600, 1, 'glitter rate');
    R(mist, c, 'sparkleSize', 0.005, 0.4, 0.005, 'glitter size');
    R(mist, c, 'sparkleSpeed', 0, 12, 0.05, 'glitter speed');
    R(mist, c, 'sparkleLifetime', 0.2, 8, 0.05, 'glitter lifetime');
    R(mist, c, 'sparkleRise', -2, 8, 0.05, 'glitter rise');
    R(mist, c, 'sparkleTurbulence', 0, 3, 0.01, 'glitter turbulence');

    const impact = folder.addFolder('Impact');
    R(impact, c, 'burstSize', 0.2, 14, 0.05, 'burst size');
    R(impact, c, 'burstIntensity', 0, 4, 0.01, 'burst intensity');
    R(impact, c, 'burstShards', 0, 400, 1, 'burst chips');
    R(impact, c, 'impactShake', 0, 3, 0.01, 'shake');
    R(impact, c, 'shakeDuration', 0.1, 4, 0.01, 'shake duration');
    R(impact, c, 'impactFlash', 0, 2, 0.01, 'screen flash');
    R(impact, c, 'rumble', 0, 0.5, 0.005, 'travel rumble');

    const light = folder.addFolder('Dynamic light');
    R(light, c, 'lightIntensity', 0, 80, 0.1, 'light intensity');
    R(light, c, 'lightRadius', 0.5, 40, 0.1, 'light radius');
    light.addColor(c, 'lightColor').name('light colour');

    this.iceFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  _buildEnvironment() {
    const folder = this.gui.addFolder('Environment');
    const e = settings.environment;
    const R = Editor.range;

    R(folder, e, 'sunIntensity', 0, 8, 0.01, 'key intensity');
    folder.addColor(e, 'sunColor').name('key colour');
    R(folder, e, 'sunAzimuth', 0, Math.PI * 2, 0.01, 'key azimuth');
    R(folder, e, 'sunElevation', 0.05, 1.5, 0.01, 'key elevation');
    R(folder, e, 'ambientIntensity', 0, 3, 0.01, 'ambient');
    folder.addColor(e, 'ambientColor').name('ambient colour');
    R(folder, e, 'hemiIntensity', 0, 3, 0.01, 'hemisphere');
    R(folder, e, 'envIntensity', 0, 3, 0.01, 'env (IBL)');
    R(folder, e, 'shadowRadius', 0, 8, 0.05, 'shadow softness');
    R(folder, e, 'shadowBias', -0.01, 0.001, 0.0001, 'shadow bias');
    R(folder, e, 'contactShadow', 0, 1.5, 0.01, 'contact shadow');

    const rim = folder.addFolder('Rim light');
    R(rim, e, 'rimIntensity', 0, 4, 0.01, 'rim intensity');
    rim.addColor(e, 'rimColor').name('rim colour');
    R(rim, e, 'rimAzimuth', 0, Math.PI * 2, 0.01, 'rim azimuth');
    R(rim, e, 'rimElevation', 0.05, 1.5, 0.01, 'rim elevation');
    rim.addColor(e, 'hemiSkyColor').name('hemi sky');
    rim.addColor(e, 'hemiGroundColor').name('hemi bounce');

    const fog = folder.addFolder('Backdrop, fog & dust');
    fog.addColor(e, 'backgroundColor').name('backdrop');
    fog.addColor(e, 'fogColor').name('fog colour');
    R(fog, e, 'fogNear', 1, 120, 1, 'fog near');
    R(fog, e, 'fogFar', 10, 400, 1, 'fog far');
    R(fog, e, 'dustAmount', 0, 3, 0.01, 'floating dust');

    const floor = folder.addFolder('Stage floor');
    floor.addColor(e, 'floorColor').name('floor colour');
    floor.addColor(e, 'floorTint').name('floor tint');
    R(floor, e, 'floorRoughness', 0.05, 1, 0.01, 'roughness');
    R(floor, e, 'floorSheen', 0, 1, 0.01, 'sheen');
    R(floor, e, 'floorPool', 0, 1, 0.01, 'light pool');
  }

  _buildPost() {
    const folder = this.gui.addFolder('Post processing');
    const p = settings.post;
    const R = Editor.range;

    folder.add(p, 'enabled').name('enabled');
    R(folder, p, 'exposure', 0.1, 3, 0.01, 'exposure');
    R(folder, p, 'bloomStrength', 0, 3, 0.01, 'bloom intensity');
    R(folder, p, 'bloomRadius', 0, 1.5, 0.01, 'bloom radius');
    R(folder, p, 'bloomThreshold', 0, 2, 0.01, 'bloom threshold');
    R(folder, p, 'contrast', 0.5, 2, 0.01, 'contrast');
    R(folder, p, 'saturation', 0, 2.5, 0.01, 'saturation');
    R(folder, p, 'temperature', -0.5, 0.5, 0.01, 'temperature');
    R(folder, p, 'lift', -0.2, 0.2, 0.005, 'lift');
    R(folder, p, 'gain', 0.5, 2, 0.01, 'gain');
    R(folder, p, 'vignette', 0, 1.5, 0.01, 'vignette');
    R(folder, p, 'chromaticAberration', 0, 3, 0.01, 'chromatic aberration');
    R(folder, p, 'grain', 0, 0.2, 0.001, 'film grain');
    R(folder, p, 'flashStrength', 0, 2, 0.01, 'impact flash');
  }

  _buildCamera() {
    const folder = this.gui.addFolder('Camera');
    const c = settings.camera;
    const R = Editor.range;

    // The wheel writes `distance` straight into settings, so the slider listens.
    R(folder, c, 'distance', 1, 40, 0.1, 'distance').listen();
    R(folder, c, 'minDistance', 1, 20, 0.1, 'min distance');
    R(folder, c, 'maxDistance', 4, 40, 0.1, 'max distance');
    R(folder, c, 'zoomSpeed', 0.1, 3, 0.01, 'zoom speed');
    R(folder, c, 'fov', 20, 90, 0.5, 'field of view');
    R(folder, c, 'targetHeight', 0, 4, 0.01, 'target height');
    R(folder, c, 'minPolar', 0.05, 1.5, 0.01, 'min pitch');
    R(folder, c, 'maxPolar', 0.2, 1.55, 0.01, 'max pitch');
    R(folder, c, 'damping', 0.001, 0.5, 0.001, 'follow damping');
    R(folder, c, 'autoFrame', 0, 1, 0.01, 'auto framing');

    folder.add({ clear: () => this.hooks.onClear?.() }, 'clear').name('Clear effects (C)');
  }

  _buildCharacter() {
    const folder = this.gui.addFolder('Character');
    const c = settings.character;
    const R = Editor.range;

    // The controller polls `pose` every frame, so the dropdown needs no handler.
    folder.add(c, 'pose', ['idle', 'sitting']).name('pose (T)');
    R(folder, c, 'blendTime', 0.05, 3, 0.01, 'blend time');
    R(folder, settings.global, 'animationSpeed', 0.1, 3, 0.01, 'idle speed');

    const cast = folder.addFolder('Casting');
    cast.add(c, 'turnToAim').name('turn to aim');
    R(cast, c, 'turnRate', 0.000001, 0.02, 0.000001, 'turn follow');
    R(cast, c, 'castLean', 0, 1.2, 0.01, 'lunge lean');
    R(cast, c, 'castRecoil', 0, 0.8, 0.005, 'lunge recoil');
    R(cast, c, 'castSettle', 0.2, 8, 0.05, 'lunge settle');

    // Everything below re-bakes the seated pose when it changes.
    const seated = folder.addFolder('Meditation pose');
    R(seated, c, 'breathing', 0, 3, 0.01, 'breathing');
    R(seated, c, 'breathRate', 0.05, 1, 0.01, 'breaths / sec');
    R(seated, c, 'legSpread', 0.6, 1.4, 0.01, 'leg spread');
    R(seated, c, 'torsoLean', -20, 20, 0.5, 'torso lean');
    R(seated, c, 'seatClearance', 0, 0.08, 0.002, 'seat clearance');
    R(seated, c, 'handHeight', 0, 0.25, 0.005, 'hand height');
    seated.add(c, 'handsOnKnees').name('hands on knees');
  }

  dispose() {
    this.gui.destroy();
  }
}
