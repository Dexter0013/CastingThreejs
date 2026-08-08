import GUI from 'lil-gui';
import { settings } from '../config/settings.js';
import { PresetManager } from './PresetManager.js';

/**
 * Real-time VFX editor.
 *
 * Every control binds straight to a field in `config/settings.js`. Because all
 * shaders, particle systems, lights and post passes *read* those fields each
 * frame, no controller needs an onChange handler: moving a slider updates the
 * ice field that is already standing, the bolt that is already in the air, the
 * next cast, the environment and the post stack simultaneously, with no rebuild
 * and no shader recompilation.
 *
 * That holds while the simulation is paused (`P`), which is the point — the
 * silhouette of a frozen eruption and the shape of a frozen bolt are the things
 * worth tuning, and both abilities re-resolve themselves from these values on a
 * zero-length frame.
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
    this._buildThunder();
    this._buildMeteor();
    this._buildBeam();
    this._buildEnvironment();
    this._buildPost();
    this._buildCamera();
    this._buildCharacter();

    // Everything starts collapsed, top-level folders included. There are enough
    // controls here that any folder left open pushes the rest off the screen,
    // so the panel opens as a list of sections and the user picks one.
    this.gui.foldersRecursive().forEach((folder) => folder.close());
  }

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  static range(folder, object, key, min, max, step, label) {
    return folder.add(object, key, min, max, step).name(label ?? key);
  }

  /**
   * The four colour stops of a particle system's lifetime gradient.
   *
   * `ParticleSystem#setGradient` samples them across a particle's own life, so
   * they are labelled by *when* they are seen rather than by what they are —
   * `A` is the instant it is born, `D` is the moment it dies.
   *
   * @param {string} prefix settings key without the A/B/C/D suffix
   */
  static gradient(folder, object, prefix, title) {
    const group = folder.addFolder(title);
    group.addColor(object, `${prefix}A`).name('birth');
    group.addColor(object, `${prefix}B`).name('early');
    group.addColor(object, `${prefix}C`).name('late');
    group.addColor(object, `${prefix}D`).name('death');
    return group;
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
    R(folder, g, 'distortion', 0, 3, 0.01, 'heat distortion');

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
    ground.addColor(c, 'colorShockA').name('shockwave ring');
    ground.addColor(c, 'colorShockB').name('shockwave crest');

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
    Editor.gradient(mist, c, 'colorMist', 'Mist colour');
    Editor.gradient(mist, c, 'colorShard', 'Chip colour');
    Editor.gradient(mist, c, 'colorSparkle', 'Glitter colour');

    const impact = folder.addFolder('Impact');
    R(impact, c, 'burstSize', 0.2, 14, 0.05, 'burst size');
    R(impact, c, 'burstIntensity', 0, 4, 0.01, 'burst intensity');
    R(impact, c, 'burstShards', 0, 400, 1, 'burst chips');
    R(impact, c, 'impactShake', 0, 3, 0.01, 'shake');
    R(impact, c, 'shakeDuration', 0.1, 4, 0.01, 'shake duration');
    R(impact, c, 'impactFlash', 0, 2, 0.01, 'screen flash');
    R(impact, c, 'rumble', 0, 0.5, 0.005, 'travel rumble');
    impact.addColor(c, 'colorBurstA').name('vapour shell');
    impact.addColor(c, 'colorBurstB').name('shell body');
    impact.addColor(c, 'colorBurstC').name('plates & rim');
    impact.addColor(c, 'colorFlash').name('screen flash colour');

    const light = folder.addFolder('Dynamic light');
    R(light, c, 'lightIntensity', 0, 80, 0.1, 'light intensity');
    R(light, c, 'lightRadius', 0.5, 40, 0.1, 'light radius');
    light.addColor(c, 'lightColor').name('light colour');

    this.iceFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  /**
   * Storm Lance.
   *
   * Every control here is read by the vertex shader on the frame it changes, so
   * the whole folder reshapes a bolt that is already in the air. The ones worth
   * reaching for first are `jitter` and `jitterScale` (how violently it kinks),
   * `strands` and `spread` (how wide the bundle reads) and `restrike` (how hard
   * it strobes) — those four carry the character of the effect.
   */
  _buildThunder() {
    const folder = this.gui.addFolder('⚡  Storm Lance');
    const c = settings.thunder;
    const R = Editor.range;

    const cast = folder.addFolder('The cast');
    R(cast, c, 'range', 2, 60, 0.1, 'max range');
    R(cast, c, 'minRange', 0, 10, 0.1, 'min range');
    R(cast, c, 'speed', 5, 400, 1, 'strike speed');
    R(cast, c, 'lifetime', 0.05, 6, 0.01, 'bolt lifetime');
    R(cast, c, 'fadeTime', 0.05, 4, 0.01, 'blow-out time');
    R(cast, c, 'cooldown', 0, 6, 0.05, 'cooldown');

    const anchor = folder.addFolder('Where it leaves the hand');
    R(anchor, c, 'handHeight', 0, 3, 0.01, 'hand height');
    R(anchor, c, 'handForward', -1, 3, 0.01, 'hand forward');
    R(anchor, c, 'handSide', -1.5, 1.5, 0.01, 'hand lateral');
    R(anchor, c, 'endHeight', 0, 4, 0.01, 'height at target');
    R(anchor, c, 'sag', -3, 3, 0.01, 'mid-span bow');

    const bundle = folder.addFolder('The bundle');
    R(bundle, c, 'strands', 1, 24, 1, 'filaments');
    R(bundle, c, 'spread', 0, 5, 0.01, 'fan at target');
    R(bundle, c, 'spreadNear', 0, 2, 0.01, 'fan at hand');
    R(bundle, c, 'spreadCurve', 0.2, 5, 0.01, 'fan curve');
    R(bundle, c, 'twist', -4, 4, 0.01, 'twist over length');
    R(bundle, c, 'twistSpeed', -6, 6, 0.01, 'twist speed');
    R(bundle, c, 'branchDim', 0, 1, 0.01, 'outer filament dim');

    const shape = folder.addFolder('The filament');
    R(shape, c, 'jitter', 0, 3, 0.01, 'kink amplitude');
    R(shape, c, 'jitterScale', 0.05, 6, 0.01, 'kinks / metre');
    R(shape, c, 'octaves', 1, 5, 1, 'octaves');
    R(shape, c, 'jitterFalloff', 0.1, 0.95, 0.01, 'octave falloff');
    R(shape, c, 'crawl', -20, 20, 0.1, 'kink crawl');
    R(shape, c, 'pinch', 0.01, 0.5, 0.005, 'end pinch');
    R(shape, c, 'converge', 0, 1, 0.01, 'lock onto target');

    const ribbon = folder.addFolder('The ribbon');
    R(ribbon, c, 'width', 0.005, 0.6, 0.005, 'width at hand');
    R(ribbon, c, 'widthTip', 0.02, 3, 0.01, 'width at target');
    R(ribbon, c, 'widthCurve', 0.1, 4, 0.01, 'taper curve');
    R(ribbon, c, 'coreWidth', 1, 6, 0.01, 'spine thickness');
    R(ribbon, c, 'coreSharp', 0.5, 12, 0.05, 'core sharpness');
    R(ribbon, c, 'glowWidth', 1, 30, 0.1, 'halo width');
    R(ribbon, c, 'glowFalloff', 0.2, 8, 0.05, 'halo falloff');
    R(ribbon, c, 'glowOpacity', 0, 2, 0.01, 'halo opacity');
    R(ribbon, c, 'softFade', 0.02, 3, 0.01, 'soft intersection');

    const strobe = folder.addFolder('Flicker & restrike');
    R(strobe, c, 'restrike', 0.5, 90, 0.5, 'restrikes / sec');
    R(strobe, c, 'flicker', 0, 1, 0.01, 'brightness stutter');
    R(strobe, c, 'flickerSpeed', 1, 120, 1, 'stutter rate');
    R(strobe, c, 'strandFlash', 0, 1, 0.01, 'filament blink');
    R(strobe, c, 'tipGlow', 0, 8, 0.05, 'leading-edge glow');
    R(strobe, c, 'tipLength', 0.005, 0.5, 0.005, 'leading-edge length');

    const material = folder.addFolder('Bolt colour');
    material.addColor(c, 'colorCore').name('core');
    material.addColor(c, 'colorInner').name('inner');
    material.addColor(c, 'colorOuter').name('outer');
    material.addColor(c, 'colorHalo').name('halo');
    R(material, c, 'glow', 0, 8, 0.01, 'glow');
    R(material, c, 'opacity', 0, 2, 0.01, 'opacity');

    const ground = folder.addFolder('Burns on the ground');
    R(ground, c, 'arcRate', 0.05, 8, 0.05, 'burns / metre');
    R(ground, c, 'arcRadius', 0.1, 8, 0.05, 'burn radius');
    R(ground, c, 'arcLife', 0.05, 5, 0.05, 'burn lifetime');
    R(ground, c, 'arcIntensity', 0, 3, 0.01, 'burn intensity');
    R(ground, c, 'arcBranches', 0, 3, 0.01, 'branch detail');
    R(ground, c, 'scorchRadius', 0.05, 4, 0.05, 'scorch radius');
    R(ground, c, 'scorchLife', 0.5, 20, 0.1, 'scorch lifetime');
    R(ground, c, 'scorchIntensity', 0, 2, 0.01, 'scorch intensity');
    R(ground, c, 'shockRadius', 0.5, 25, 0.1, 'shockwave radius');
    ground.addColor(c, 'colorArc').name('burn');
    ground.addColor(c, 'colorEmber').name('ember');
    ground.addColor(c, 'colorScorch').name('scorch');
    ground.addColor(c, 'colorShockA').name('shockwave ring');
    ground.addColor(c, 'colorShockB').name('shockwave crest');

    const sparks = folder.addFolder('Sparks & motes');
    R(sparks, c, 'sparkRate', 0, 1200, 1, 'spark rate');
    R(sparks, c, 'sparkSize', 0.005, 0.8, 0.005, 'spark size');
    R(sparks, c, 'sparkSpeed', 0, 40, 0.1, 'spark speed');
    R(sparks, c, 'sparkLifetime', 0.05, 4, 0.01, 'spark lifetime');
    R(sparks, c, 'sparkGravity', -50, 5, 0.1, 'spark gravity');
    R(sparks, c, 'sparkStretch', 0, 3, 0.01, 'spark stretch');
    R(sparks, c, 'moteRate', 0, 600, 1, 'mote rate');
    R(sparks, c, 'moteSize', 0.005, 0.4, 0.005, 'mote size');
    R(sparks, c, 'moteSpeed', 0, 12, 0.05, 'mote speed');
    R(sparks, c, 'moteLifetime', 0.1, 8, 0.05, 'mote lifetime');
    R(sparks, c, 'moteRise', -3, 8, 0.05, 'mote rise');
    R(sparks, c, 'moteTurbulence', 0, 3, 0.01, 'mote turbulence');
    Editor.gradient(sparks, c, 'colorSpark', 'Spark colour');
    Editor.gradient(sparks, c, 'colorMote', 'Mote colour');

    const dust = folder.addFolder('Smoke & debris');
    R(dust, c, 'smokeRate', 0, 500, 1, 'smoke rate');
    R(dust, c, 'smokeSize', 0.05, 4, 0.01, 'smoke size');
    R(dust, c, 'smokeSpeed', 0, 8, 0.05, 'smoke speed');
    R(dust, c, 'smokeLifetime', 0.2, 8, 0.05, 'smoke lifetime');
    R(dust, c, 'smokeOpacity', 0, 1, 0.005, 'smoke opacity');
    R(dust, c, 'smokeRise', -2, 4, 0.01, 'smoke rise');
    R(dust, c, 'debrisRate', 0, 300, 1, 'debris rate');
    R(dust, c, 'debrisSize', 0.005, 0.4, 0.005, 'debris size');
    R(dust, c, 'debrisSpeed', 0, 25, 0.1, 'debris speed');
    R(dust, c, 'debrisLifetime', 0.1, 5, 0.05, 'debris lifetime');
    R(dust, c, 'debrisGravity', -50, 0, 0.1, 'debris gravity');
    Editor.gradient(dust, c, 'colorSmoke', 'Smoke colour');
    Editor.gradient(dust, c, 'colorDebris', 'Debris colour');

    const impact = folder.addFolder('Muzzle & impact');
    R(impact, c, 'muzzleSize', 0.05, 6, 0.05, 'muzzle size');
    R(impact, c, 'muzzleIntensity', 0, 5, 0.01, 'muzzle intensity');
    R(impact, c, 'castFlash', 0, 2, 0.01, 'flash on release');
    impact.addColor(c, 'colorMuzzleA').name('muzzle shell');
    impact.addColor(c, 'colorMuzzleB').name('muzzle body');
    impact.addColor(c, 'colorMuzzleC').name('muzzle arcs');
    impact.addColor(c, 'colorCastFlash').name('release flash colour');
    R(impact, c, 'burstSize', 0.2, 14, 0.05, 'burst size');
    R(impact, c, 'burstIntensity', 0, 5, 0.01, 'burst intensity');
    R(impact, c, 'burstSparks', 0, 600, 1, 'burst sparks');
    R(impact, c, 'burstDebris', 0, 300, 1, 'burst debris');
    R(impact, c, 'impactShake', 0, 3, 0.01, 'shake');
    R(impact, c, 'shakeDuration', 0.1, 4, 0.01, 'shake duration');
    R(impact, c, 'impactFlash', 0, 2, 0.01, 'screen flash');
    R(impact, c, 'rumble', 0, 0.5, 0.005, 'travel rumble');
    impact.addColor(c, 'colorBurstA').name('burst shell');
    impact.addColor(c, 'colorBurstB').name('burst body');
    impact.addColor(c, 'colorBurstC').name('burst arcs');
    impact.addColor(c, 'colorFlash').name('impact flash colour');

    const light = folder.addFolder('Dynamic light');
    R(light, c, 'lightIntensity', 0, 120, 0.5, 'light intensity');
    R(light, c, 'lightRadius', 0.5, 50, 0.1, 'light radius');
    R(light, c, 'lightFlicker', 0, 1, 0.01, 'light gutter');
    R(light, c, 'lightFlickerSpeed', 1, 90, 1, 'gutter rate');
    light.addColor(c, 'lightColor').name('light colour');

    this.thunderFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  /**
   * Cinder Fall.
   *
   * The seven controls under "The rock" regenerate real geometry — see
   * `MeteorAbility#_syncGeometry` — and everything else is read by a shader or
   * resolved from scratch on the frame it changes, so the whole folder reshapes
   * a meteor that is already in the air. The ones worth reaching for first are
   * `arc` (how hard it is lobbed), `crackWidth` and `chargeCurve` (how the lava
   * seams open on the way in), `trailSpan` and `trailWidth` (how much fire
   * streams off it) and `chunkSpeed` (how far the wreckage is thrown).
   */
  _buildMeteor() {
    const folder = this.gui.addFolder('☄  Cinder Fall');
    const c = settings.meteor;
    const R = Editor.range;

    const cast = folder.addFolder('The cast');
    R(cast, c, 'range', 2, 60, 0.1, 'max range');
    R(cast, c, 'minRange', 0, 10, 0.1, 'min range');
    R(cast, c, 'speed', 3, 90, 0.5, 'travel speed');
    R(cast, c, 'lifetime', 0.2, 10, 0.1, 'crater lifetime');
    R(cast, c, 'fadeTime', 0.1, 6, 0.05, 'clear-out time');
    R(cast, c, 'cooldown', 0, 6, 0.05, 'cooldown');

    const path = folder.addFolder('The flight path');
    R(path, c, 'handHeight', 0, 3, 0.01, 'hand height');
    R(path, c, 'handForward', -1, 3, 0.01, 'hand forward');
    R(path, c, 'handSide', -1.5, 1.5, 0.01, 'hand lateral');
    R(path, c, 'endHeight', 0, 4, 0.01, 'height at target');
    R(path, c, 'arc', -4, 12, 0.05, 'lob height');
    R(path, c, 'arcCurve', 0.1, 4, 0.01, 'lob curve');

    // Everything down to `craterSize` rebuilds the asteroid geometry. `cuts` is
    // the one that decides whether it reads as stone: it slices flat fracture
    // faces off the ball, which no amount of noise can fake.
    const rock = folder.addFolder('The rock');
    R(rock, c, 'radius', 0.05, 3, 0.01, 'radius');
    R(rock, c, 'facets', 0, 3, 1, 'subdivisions');
    R(rock, c, 'lumpiness', 0, 0.8, 0.01, 'lumpiness');
    R(rock, c, 'lumpScale', 0.2, 6, 0.05, 'lumps / radius');
    R(rock, c, 'surfaceRoughness', 0, 1, 0.01, 'surface roughness');
    R(rock, c, 'cuts', 0, 16, 1, 'fracture faces');
    R(rock, c, 'cutDepth', 0, 0.5, 0.01, 'fracture depth');
    R(rock, c, 'craters', 0, 14, 1, 'craters');
    R(rock, c, 'craterDepth', 0, 0.6, 0.01, 'crater depth');
    R(rock, c, 'craterSize', 0.05, 1.4, 0.01, 'crater size');
    R(rock, c, 'spin', -20, 20, 0.1, 'tumble rate');

    const seams = folder.addFolder('Lava seams');
    R(seams, c, 'chargeCurve', 0.1, 5, 0.01, 'heat-up curve');
    R(seams, c, 'crackScale', 0.3, 10, 0.05, 'seams / radius');
    R(seams, c, 'crackWidth', 0.005, 0.5, 0.005, 'seam width');
    R(seams, c, 'crackBranches', 0, 1.5, 0.01, 'branch seams');
    R(seams, c, 'crackGlow', 0, 10, 0.05, 'seam glow');
    R(seams, c, 'crackFlow', 0, 1, 0.01, 'magma crawl');
    R(seams, c, 'crackFlowSpeed', 0, 5, 0.01, 'crawl speed');
    R(seams, c, 'rockScale', 0.2, 10, 0.05, 'rock mottling');
    R(seams, c, 'facetTint', 0, 1.2, 0.01, 'per-facet tint');
    R(seams, c, 'cavity', 0, 1, 0.01, 'cavity shading');
    R(seams, c, 'soot', 0, 1.5, 0.01, 'soot around seams');
    R(seams, c, 'rimHeat', 0, 4, 0.01, 'heat sheath');
    R(seams, c, 'leadGlow', 0, 6, 0.01, 'leading-face heat');
    R(seams, c, 'leadSharp', 0.5, 8, 0.05, 'leading-face falloff');
    R(seams, c, 'glow', 0, 4, 0.01, 'glow');
    R(seams, c, 'envIntensity', 0, 3, 0.01, 'reflection');
    seams.addColor(c, 'colorRock').name('rock');
    seams.addColor(c, 'colorChar').name('char');
    seams.addColor(c, 'colorCrack').name('seam');
    seams.addColor(c, 'colorHot').name('white hot');

    // The trail is a raymarched volume, so these are volume parameters, not
    // surface ones — see `materials/VolumetricFireMaterial.js`. `trailWidth`,
    // `trailPlume` and `trailSpan` set its shape; `trailSteps` is the cost dial.
    const trail = folder.addFolder('The fire trail');
    R(trail, c, 'trailSpan', 0.5, 30, 0.1, 'trail length');
    R(trail, c, 'trailWidth', 0.02, 2, 0.01, 'tube radius');
    R(trail, c, 'trailHeadSize', 0.5, 5, 0.01, 'head size');
    R(trail, c, 'trailPlume', 0.3, 4, 0.01, 'upward stretch');
    R(trail, c, 'trailWakeSpread', 0, 3, 0.01, 'wake spread');
    R(trail, c, 'trailRise', 0, 3, 0.01, 'wake rise');
    R(trail, c, 'trailDetachment', 0, 1.5, 0.01, 'tail break-up');
    R(trail, c, 'trailSoftness', 0.05, 1, 0.01, 'surface softness');
    R(trail, c, 'trailBurnout', 0.05, 4, 0.05, 'burn-out time');
    R(trail, c, 'trailTailFade', 0.01, 0.8, 0.01, 'tail burn-out');

    // Metre-scale lobes. Without these the outline stays a capsule no matter how
    // much fine turbulence is piled on top of it.
    const silhouette = trail.addFolder('Silhouette');
    R(silhouette, c, 'trailBulge', 0, 1, 0.01, 'lobe depth');
    R(silhouette, c, 'trailBulgeScale', 0.05, 2, 0.01, 'lobes / metre');
    R(silhouette, c, 'trailShred', 0, 4, 0.01, 'fringe shred');
    R(silhouette, c, 'trailWisps', 0, 2, 0.01, 'wisps');
    R(silhouette, c, 'trailLick', 0, 8, 0.05, 'radial shear');

    const motion = trail.addFolder('Motion & turbulence');
    R(motion, c, 'trailSpeed', 0, 12, 0.01, 'flow speed');
    R(motion, c, 'trailBuoyancy', 0, 10, 0.01, 'buoyancy');
    R(motion, c, 'trailTurbulence', 0, 8, 0.01, 'turbulence');
    R(motion, c, 'trailNoiseStrength', 0, 4, 0.01, 'noise strength');
    R(motion, c, 'trailNoiseFrequency', 0.1, 10, 0.01, 'noise frequency');
    R(motion, c, 'trailWarp', 0, 1.5, 0.01, 'domain warp');
    R(motion, c, 'trailCurl', 0, 3, 0.01, 'axial swirl');
    R(motion, c, 'trailVortex', 0, 2, 0.01, 'vortex roll-up');
    R(motion, c, 'trailRingFrequency', 0, 3, 0.01, 'rings / metre');
    R(motion, c, 'trailRingSpeed', 0, 10, 0.05, 'ring speed');
    R(motion, c, 'trailTongue', 0.2, 3, 0.01, 'tongue stretch');
    R(motion, c, 'trailStreamStretch', 0.2, 3, 0.01, 'streamwise stretch');
    R(motion, c, 'trailFlicker', 0, 2, 0.01, 'flicker');
    R(motion, c, 'trailOctaves', 1, 5, 1, 'detail octaves');

    // The flame is shaded as a Planckian radiator: colour comes out of the
    // temperature. `trailPalette` blends toward the hand-authored stops instead.
    const heat = trail.addFolder('Temperature & radiance');
    R(heat, c, 'trailTempCore', 1000, 5000, 10, 'core temperature (K)');
    R(heat, c, 'trailTempEdge', 1000, 4000, 10, 'edge temperature (K)');
    R(heat, c, 'trailEmissionCurve', 1, 6, 0.01, 'radiance exponent');
    R(heat, c, 'trailHeatFocus', 0.05, 3, 0.01, 'heat focus');
    R(heat, c, 'trailHeatFalloff', 0.05, 4, 0.01, 'heat falloff');
    R(heat, c, 'trailHeatFollow', 0, 1, 0.01, 'heat follows noise');
    R(heat, c, 'trailTailHeat', 0, 1, 0.01, 'spent-gas heat');
    R(heat, c, 'trailScatter', 0, 4, 0.01, 'scatter');
    R(heat, c, 'trailScatterFalloff', 0.2, 8, 0.05, 'scatter falloff');
    R(heat, c, 'trailPalette', 0, 1, 0.01, 'palette vs physics');
    heat.addColor(c, 'colorFlameMid').name('flame mid');
    heat.addColor(c, 'colorFlameEdge').name('flame edge');
    heat.addColor(c, 'colorFlameSmoke').name('flame smoke');

    const march = trail.addFolder('Volume rendering');
    R(march, c, 'trailDensity', 0, 6, 0.01, 'density');
    R(march, c, 'trailSoot', 0, 5, 0.01, 'soot absorption');
    R(march, c, 'trailCoreClarity', 0, 1, 0.01, 'core clarity');
    R(march, c, 'trailGlow', 0, 8, 0.01, 'glow');
    R(march, c, 'trailOpacity', 0, 2, 0.01, 'opacity');
    R(march, c, 'trailSteps', 6, 72, 1, 'raymarch steps');

    const chunks = folder.addFolder('The wreckage');
    R(chunks, c, 'chunkCount', 0, 28, 1, 'chunks');
    R(chunks, c, 'chunkScale', 0.05, 0.8, 0.01, 'chunk size');
    R(chunks, c, 'chunkSpeed', 0, 30, 0.1, 'throw speed');
    R(chunks, c, 'chunkForward', 0, 2, 0.01, 'downrange bias');
    R(chunks, c, 'chunkLoft', 0, 1.5, 0.01, 'loft');
    R(chunks, c, 'chunkGravity', -50, -1, 0.1, 'gravity');
    R(chunks, c, 'chunkSpin', 0, 20, 0.1, 'tumble rate');
    R(chunks, c, 'chunkCool', 0.1, 8, 0.05, 'cool-down time');
    R(chunks, c, 'chunkLinger', 0, 4, 0.05, 'hold before sinking');
    R(chunks, c, 'chunkSink', 0.1, 4, 0.05, 'sink time');

    const embers = folder.addFolder('Embers & sparks');
    R(embers, c, 'emberRate', 0, 900, 1, 'ember rate');
    R(embers, c, 'emberSize', 0.005, 0.5, 0.005, 'ember size');
    R(embers, c, 'emberSpeed', 0, 15, 0.05, 'ember speed');
    R(embers, c, 'emberLifetime', 0.1, 8, 0.05, 'ember lifetime');
    R(embers, c, 'emberRise', -3, 8, 0.05, 'ember rise');
    R(embers, c, 'emberGlow', 0, 4, 0.01, 'ember glow');
    R(embers, c, 'emberTurbulence', 0, 3, 0.01, 'ember turbulence');
    R(embers, c, 'sparkRate', 0, 900, 1, 'spark rate');
    R(embers, c, 'sparkSize', 0.005, 0.8, 0.005, 'spark size');
    R(embers, c, 'sparkSpeed', 0, 40, 0.1, 'spark speed');
    R(embers, c, 'sparkLifetime', 0.05, 4, 0.01, 'spark lifetime');
    R(embers, c, 'sparkGravity', -50, 5, 0.1, 'spark gravity');
    R(embers, c, 'sparkStretch', 0, 3, 0.01, 'spark stretch');
    Editor.gradient(embers, c, 'colorEmber', 'Ember colour');
    Editor.gradient(embers, c, 'colorSpark', 'Spark colour');

    const dust = folder.addFolder('Smoke & grit');
    R(dust, c, 'smokeRate', 0, 500, 1, 'smoke rate');
    R(dust, c, 'smokeSize', 0.05, 4, 0.01, 'smoke size');
    R(dust, c, 'smokeSpeed', 0, 8, 0.05, 'smoke speed');
    R(dust, c, 'smokeLifetime', 0.2, 10, 0.05, 'smoke lifetime');
    R(dust, c, 'smokeOpacity', 0, 1, 0.005, 'smoke opacity');
    R(dust, c, 'smokeRise', -2, 5, 0.01, 'smoke rise');
    R(dust, c, 'debrisSize', 0.005, 0.4, 0.005, 'grit size');
    R(dust, c, 'debrisSpeed', 0, 25, 0.1, 'grit speed');
    R(dust, c, 'debrisLifetime', 0.1, 5, 0.05, 'grit lifetime');
    R(dust, c, 'debrisGravity', -50, 0, 0.1, 'grit gravity');
    Editor.gradient(dust, c, 'colorSmoke', 'Smoke colour');
    Editor.gradient(dust, c, 'colorDebris', 'Grit colour');

    const cracks = folder.addFolder('Molten cracks');
    R(cracks, c, 'fissureRadius', 0.5, 16, 0.05, 'reach');
    R(cracks, c, 'fissureLife', 0.5, 25, 0.1, 'lifetime');
    R(cracks, c, 'fissureArms', 2, 12, 1, 'main cracks');
    R(cracks, c, 'fissureWander', 0, 6, 0.05, 'meander');
    R(cracks, c, 'fissureBranches', 0, 1, 0.01, 'branch density');
    R(cracks, c, 'fissureBranchLength', 0, 1, 0.01, 'branch length');
    R(cracks, c, 'fissureWidth', 0.01, 1, 0.005, 'seam width');
    R(cracks, c, 'fissureHeat', 0, 4, 0.01, 'core heat');
    R(cracks, c, 'fissurePulse', 0, 5, 0.01, 'heat-wave speed');
    R(cracks, c, 'fissureGrowth', 0.5, 40, 0.1, 'spread speed');
    R(cracks, c, 'fissureRockSize', 0, 1.2, 0.01, 'lip rubble size');

    const ground = folder.addFolder('The crater');
    R(ground, c, 'scorchRadius', 0.2, 12, 0.05, 'scorch radius');
    R(ground, c, 'scorchLife', 0.5, 20, 0.1, 'scorch lifetime');
    R(ground, c, 'scorchIntensity', 0, 2, 0.01, 'scorch intensity');
    R(ground, c, 'shockRadius', 0.5, 25, 0.1, 'shockwave radius');
    ground.addColor(c, 'colorScorch').name('scorch');
    ground.addColor(c, 'colorShockA').name('shockwave ring');
    ground.addColor(c, 'colorShockB').name('shockwave crest');

    const impact = folder.addFolder('Launch & detonation');
    R(impact, c, 'muzzleSize', 0.05, 6, 0.05, 'launch flare');
    R(impact, c, 'muzzleIntensity', 0, 5, 0.01, 'launch intensity');
    R(impact, c, 'castFlash', 0, 2, 0.01, 'flash on release');
    impact.addColor(c, 'colorCastFlash').name('release flash colour');
    R(impact, c, 'burstSize', 0.2, 18, 0.05, 'fireball size');
    R(impact, c, 'burstIntensity', 0, 5, 0.01, 'fireball intensity');
    R(impact, c, 'burstTurbulence', 0, 4, 0.01, 'fireball turbulence');
    R(impact, c, 'burstEmbers', 0, 800, 1, 'burst embers');
    R(impact, c, 'burstSparks', 0, 600, 1, 'burst sparks');
    R(impact, c, 'burstDebris', 0, 400, 1, 'burst grit');
    R(impact, c, 'burstSmoke', 0, 300, 1, 'burst smoke');
    R(impact, c, 'impactShake', 0, 3, 0.01, 'shake');
    R(impact, c, 'shakeDuration', 0.1, 4, 0.01, 'shake duration');
    R(impact, c, 'impactFlash', 0, 2, 0.01, 'screen flash');
    R(impact, c, 'rumble', 0, 0.5, 0.005, 'travel rumble');
    impact.addColor(c, 'colorFlash').name('impact flash colour');

    const light = folder.addFolder('Dynamic light');
    R(light, c, 'lightIntensity', 0, 120, 0.5, 'light intensity');
    R(light, c, 'lightRadius', 0.5, 50, 0.1, 'light radius');
    R(light, c, 'lightFlicker', 0, 1, 0.01, 'light gutter');
    R(light, c, 'lightFlickerSpeed', 1, 60, 0.5, 'gutter rate');
    light.addColor(c, 'lightColor').name('light colour');

    this.meteorFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  /**
   * Nova Beam.
   *
   * Every control here is read by a shader on the frame it changes, so the whole
   * folder reshapes a beam that is already burning — pause with **P** halfway
   * through the hold and the entire panel stays live. The ones worth reaching
   * for first are `radius` and `flare` (how heavy the column reads), `charge`
   * and `lifetime` (the wind-up and the hold, which are what make this ability
   * different from the other three), `coils` / `coilTurns` (the ribbons around
   * it) and `streak` / `flowSpeed` (how hard the energy streams downrange).
   */
  _buildBeam() {
    const folder = this.gui.addFolder('✦  Nova Beam');
    const c = settings.beam;
    const R = Editor.range;

    const cast = folder.addFolder('The cast');
    R(cast, c, 'range', 2, 60, 0.1, 'max range');
    R(cast, c, 'minRange', 0, 10, 0.1, 'min range');
    R(cast, c, 'charge', 0, 3, 0.01, 'wind-up time');
    R(cast, c, 'speed', 5, 400, 1, 'travel speed');
    R(cast, c, 'lifetime', 0.05, 8, 0.01, 'burn time');
    R(cast, c, 'fadeTime', 0.05, 4, 0.01, 'collapse time');
    R(cast, c, 'cooldown', 0, 6, 0.05, 'cooldown');

    const anchor = folder.addFolder('Where it leaves the hands');
    R(anchor, c, 'handHeight', 0, 3, 0.01, 'hand height');
    R(anchor, c, 'handForward', -1, 3, 0.01, 'hand forward');
    R(anchor, c, 'handSide', -1.5, 1.5, 0.01, 'hand lateral');
    R(anchor, c, 'endHeight', 0, 4, 0.01, 'height at target');

    const column = folder.addFolder('The column');
    R(column, c, 'radiusNear', 0.01, 3, 0.01, 'radius at hands');
    R(column, c, 'radius', 0.02, 5, 0.01, 'radius at target');
    R(column, c, 'radiusCurve', 0.1, 4, 0.01, 'radius curve');
    R(column, c, 'flare', 0, 4, 0.01, 'flare at target');
    R(column, c, 'flareWidth', 0.02, 1, 0.01, 'flare width');
    R(column, c, 'throb', 0, 0.6, 0.005, 'pressure waves');
    R(column, c, 'throbScale', 0, 12, 0.1, 'waves / length');
    R(column, c, 'throbSpeed', 0, 10, 0.05, 'wave speed');
    R(column, c, 'wander', 0, 1, 0.005, 'axis drift');
    R(column, c, 'wanderScale', 0.1, 6, 0.05, 'drift scale');
    R(column, c, 'wanderSpeed', 0, 5, 0.01, 'drift speed');

    // The three tube passes. `coreSharp` and `shellRim` are the pair that decide
    // whether the beam reads as a solid rod or as a lit pipe — see
    // `materials/BeamMaterial.js`.
    const layers = folder.addFolder('Core, sheath & halo');
    R(layers, c, 'coreWidth', 0.05, 1.5, 0.01, 'core width');
    R(layers, c, 'coreSharp', 0.1, 8, 0.05, 'core focus');
    R(layers, c, 'coreFill', 0, 3, 0.01, 'core fill');
    R(layers, c, 'shellWidth', 0.2, 3, 0.01, 'sheath width');
    R(layers, c, 'shellRim', 0, 3, 0.01, 'sheath rim');
    R(layers, c, 'shellFill', 0, 1.5, 0.01, 'sheath fill');
    R(layers, c, 'shellOpacity', 0, 2, 0.01, 'sheath opacity');
    R(layers, c, 'edgePower', 0.2, 8, 0.05, 'rim falloff');
    R(layers, c, 'haloWidth', 0.5, 8, 0.05, 'halo width');
    R(layers, c, 'haloRim', 0.5, 10, 0.05, 'halo falloff');
    R(layers, c, 'haloOpacity', 0, 2, 0.01, 'halo opacity');

    const surface = folder.addFolder('Surface & flow');
    R(surface, c, 'ripple', 0, 1, 0.005, 'surface ripple');
    R(surface, c, 'rippleBands', 0.1, 8, 0.05, 'ripples around');
    R(surface, c, 'rippleScale', 0.1, 12, 0.05, 'ripples along');
    R(surface, c, 'rippleSpeed', 0, 12, 0.05, 'ripple crawl');
    R(surface, c, 'streak', 0, 3, 0.01, 'filaments');
    R(surface, c, 'streakSharp', 0, 1, 0.01, 'filament sharpness');
    R(surface, c, 'streakScale', 0.2, 20, 0.1, 'filaments / length');
    R(surface, c, 'streakBands', 0.2, 10, 0.05, 'filaments around');
    R(surface, c, 'streakGlow', 0, 4, 0.01, 'filament heat');
    R(surface, c, 'flowSpeed', 0, 30, 0.1, 'flow speed');
    R(surface, c, 'mouthGlow', 0, 6, 0.05, 'muzzle heat');
    R(surface, c, 'mouthLength', 0.005, 0.5, 0.005, 'muzzle length');
    R(surface, c, 'tipGlow', 0, 6, 0.05, 'burning-end heat');
    R(surface, c, 'tipLength', 0.005, 0.5, 0.005, 'burning-end length');
    R(surface, c, 'softFade', 0.02, 3, 0.01, 'soft intersection');

    const material = folder.addFolder('Beam colour');
    material.addColor(c, 'colorCore').name('axis');
    material.addColor(c, 'colorInner').name('inner');
    material.addColor(c, 'colorOuter').name('sheath');
    material.addColor(c, 'colorHalo').name('halo');
    R(material, c, 'glow', 0, 8, 0.01, 'glow');
    R(material, c, 'opacity', 0, 2, 0.01, 'opacity');

    const coils = folder.addFolder('The coils');
    R(coils, c, 'coils', 0, 8, 1, 'ribbons');
    R(coils, c, 'coilTurns', -8, 8, 0.05, 'turns over length');
    R(coils, c, 'coilSpeed', -6, 6, 0.01, 'roll speed');
    R(coils, c, 'coilRadius', 0.2, 4, 0.01, 'ride radius');
    R(coils, c, 'coilFlare', 0, 4, 0.01, 'flare at target');
    R(coils, c, 'coilWidth', 0.005, 0.6, 0.005, 'width at hands');
    R(coils, c, 'coilWidthTip', 0.05, 6, 0.01, 'width at target');
    R(coils, c, 'coilSharp', 0.2, 8, 0.05, 'edge falloff');
    R(coils, c, 'coilPulse', 0, 1, 0.01, 'charge pulse');
    R(coils, c, 'coilPulseFreq', 0, 12, 0.05, 'pulses / length');
    R(coils, c, 'coilPulseSpeed', -8, 8, 0.05, 'pulse speed');
    // Headroom above the shipped values on purpose — they sit high, and a
    // control that starts pinned to its own maximum can only ever come down.
    R(coils, c, 'coilGlow', 0, 14, 0.01, 'glow');
    R(coils, c, 'coilOpacity', 0, 3, 0.01, 'opacity');
    coils.addColor(c, 'colorCoil').name('ribbon core');
    coils.addColor(c, 'colorCoilEdge').name('ribbon edge');

    const rings = folder.addFolder('Shock discs');
    R(rings, c, 'rings', 0, 12, 1, 'discs');
    R(rings, c, 'ringSpeed', 0, 6, 0.01, 'trips / second');
    R(rings, c, 'ringInner', 0.2, 4, 0.01, 'inner lip');
    R(rings, c, 'ringOuter', 0.3, 6, 0.01, 'outer lip');
    R(rings, c, 'ringSwell', 0, 3, 0.01, 'swell downrange');
    R(rings, c, 'ringFade', 0, 1, 0.01, 'fade downrange');
    R(rings, c, 'ringSharp', 0.2, 8, 0.05, 'band sharpness');
    R(rings, c, 'ringGlow', 0, 8, 0.01, 'glow');
    R(rings, c, 'ringOpacity', 0, 2, 0.01, 'opacity');
    rings.addColor(c, 'colorRing').name('disc colour');

    const orb = folder.addFolder('The charge');
    R(orb, c, 'orbSize', 0.02, 2, 0.01, 'orb radius');
    R(orb, c, 'orbThrob', 0, 0.6, 0.005, 'orb pulse');
    R(orb, c, 'orbThrobSpeed', 0, 20, 0.1, 'pulse rate');
    R(orb, c, 'orbTurbulence', 0, 1, 0.01, 'surface turbulence');
    R(orb, c, 'orbScale', 0.2, 8, 0.05, 'surface scale');
    R(orb, c, 'orbFlow', 0, 5, 0.01, 'surface crawl');
    R(orb, c, 'orbBands', 0.5, 15, 0.1, 'filament scale');
    R(orb, c, 'orbRim', 0.2, 6, 0.05, 'rim falloff');
    R(orb, c, 'orbGlow', 0, 8, 0.01, 'glow');
    R(orb, c, 'orbOpacity', 0, 2, 0.01, 'opacity');
    R(orb, c, 'intakeRate', 0, 900, 1, 'intake rate');
    R(orb, c, 'intakeRadius', 0.2, 8, 0.05, 'intake radius');
    R(orb, c, 'intakeSpeed', 0.5, 25, 0.1, 'intake speed');
    R(orb, c, 'chargeShake', 0, 0.5, 0.005, 'wind-up rumble');

    const ground = folder.addFolder('What the floor does');
    R(ground, c, 'scorchRate', 0.05, 8, 0.05, 'burns / metre');
    R(ground, c, 'scorchRadius', 0.05, 4, 0.05, 'burn radius');
    R(ground, c, 'scorchLife', 0.5, 20, 0.1, 'burn lifetime');
    R(ground, c, 'scorchIntensity', 0, 2, 0.01, 'burn intensity');
    R(ground, c, 'dustRate', 0, 20, 0.1, 'dust rings / sec');
    R(ground, c, 'dustRadius', 0.2, 10, 0.05, 'dust ring radius');
    R(ground, c, 'dustLife', 0.1, 5, 0.05, 'dust ring lifetime');
    R(ground, c, 'shockRate', 0, 20, 0.1, 'shock rings / sec');
    R(ground, c, 'shockRadius', 0.5, 25, 0.1, 'shockwave radius');
    ground.addColor(c, 'colorScorch').name('scorch');
    ground.addColor(c, 'colorEmber').name('ember');
    ground.addColor(c, 'colorDustA').name('dust');
    ground.addColor(c, 'colorDustB').name('dust crest');
    ground.addColor(c, 'colorShockA').name('shockwave ring');
    ground.addColor(c, 'colorShockB').name('shockwave crest');

    const sparks = folder.addFolder('Sparks & motes');
    R(sparks, c, 'sparkRate', 0, 1200, 1, 'spark rate');
    R(sparks, c, 'sparkSize', 0.005, 0.8, 0.005, 'spark size');
    R(sparks, c, 'sparkSpeed', 0, 40, 0.1, 'spark speed');
    R(sparks, c, 'sparkLifetime', 0.05, 4, 0.01, 'spark lifetime');
    R(sparks, c, 'sparkGravity', -50, 5, 0.1, 'spark gravity');
    R(sparks, c, 'sparkStretch', 0, 3, 0.01, 'spark stretch');
    R(sparks, c, 'sparkForward', 0, 4, 0.01, 'downrange drag');
    R(sparks, c, 'moteRate', 0, 600, 1, 'mote rate');
    R(sparks, c, 'moteSize', 0.005, 0.4, 0.005, 'mote size');
    R(sparks, c, 'moteSpeed', 0, 12, 0.05, 'mote speed');
    R(sparks, c, 'moteLifetime', 0.1, 8, 0.05, 'mote lifetime');
    R(sparks, c, 'moteRise', -3, 8, 0.05, 'mote rise');
    R(sparks, c, 'moteTurbulence', 0, 3, 0.01, 'mote turbulence');
    Editor.gradient(sparks, c, 'colorSpark', 'Spark colour');
    Editor.gradient(sparks, c, 'colorMote', 'Mote colour');

    const dust = folder.addFolder('Steam & debris');
    R(dust, c, 'smokeRate', 0, 500, 1, 'steam rate');
    R(dust, c, 'smokeSize', 0.05, 4, 0.01, 'steam size');
    R(dust, c, 'smokeSpeed', 0, 8, 0.05, 'steam speed');
    R(dust, c, 'smokeLifetime', 0.2, 8, 0.05, 'steam lifetime');
    R(dust, c, 'smokeOpacity', 0, 1, 0.005, 'steam opacity');
    R(dust, c, 'smokeRise', -2, 4, 0.01, 'steam rise');
    R(dust, c, 'debrisRate', 0, 300, 1, 'debris rate');
    R(dust, c, 'debrisSize', 0.005, 0.4, 0.005, 'debris size');
    R(dust, c, 'debrisSpeed', 0, 25, 0.1, 'debris speed');
    R(dust, c, 'debrisLifetime', 0.1, 5, 0.05, 'debris lifetime');
    R(dust, c, 'debrisGravity', -50, 0, 0.1, 'debris gravity');
    Editor.gradient(dust, c, 'colorSmoke', 'Steam colour');
    Editor.gradient(dust, c, 'colorDebris', 'Debris colour');

    const impact = folder.addFolder('Release, impact & burn');
    R(impact, c, 'muzzleSize', 0.05, 8, 0.05, 'release shell');
    R(impact, c, 'muzzleIntensity', 0, 5, 0.01, 'release intensity');
    R(impact, c, 'castFlash', 0, 2, 0.01, 'flash on release');
    impact.addColor(c, 'colorCastFlash').name('release flash colour');
    R(impact, c, 'burstSize', 0.2, 18, 0.05, 'impact shell');
    R(impact, c, 'burstIntensity', 0, 5, 0.01, 'impact intensity');
    R(impact, c, 'burstSparks', 0, 800, 1, 'impact sparks');
    R(impact, c, 'burstDebris', 0, 400, 1, 'impact debris');
    R(impact, c, 'pulseRate', 0, 12, 0.1, 'burn shells / sec');
    R(impact, c, 'pulseSize', 0.1, 10, 0.05, 'burn shell size');
    R(impact, c, 'pulseIntensity', 0, 5, 0.01, 'burn shell intensity');
    R(impact, c, 'splashRate', 0, 900, 1, 'back-splash rate');
    R(impact, c, 'impactShake', 0, 3, 0.01, 'shake');
    R(impact, c, 'shakeDuration', 0.1, 4, 0.01, 'shake duration');
    R(impact, c, 'impactFlash', 0, 2, 0.01, 'screen flash');
    R(impact, c, 'rumble', 0, 0.5, 0.005, 'travel rumble');
    R(impact, c, 'burnShake', 0, 0.5, 0.005, 'burn rumble');
    impact.addColor(c, 'colorBurstA').name('impact shell');
    impact.addColor(c, 'colorBurstB').name('impact body');
    impact.addColor(c, 'colorBurstC').name('impact arcs');
    impact.addColor(c, 'colorFlash').name('impact flash colour');

    const light = folder.addFolder('Dynamic light');
    R(light, c, 'lightIntensity', 0, 120, 0.5, 'beam intensity');
    R(light, c, 'lightRadius', 0.5, 60, 0.1, 'beam radius');
    R(light, c, 'lightPulse', 0, 1, 0.01, 'hum depth');
    R(light, c, 'lightPulseSpeed', 0, 30, 0.1, 'hum rate');
    R(light, c, 'muzzleLightIntensity', 0, 120, 0.5, 'hand intensity');
    R(light, c, 'muzzleLightRadius', 0.5, 40, 0.1, 'hand radius');
    light.addColor(c, 'lightColor').name('light colour');

    this.beamFolder = folder;
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
    R(folder, p, 'distortion', 0, 0.2, 0.001, 'screen warp');
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
