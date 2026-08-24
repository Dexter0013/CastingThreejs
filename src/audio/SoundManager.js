import { AudioListener, Audio, PositionalAudio, AudioLoader, Vector3 } from 'three';

/**
 * SoundManager — Context-Aware 3D Spatial Audio & Procedural Sound Engine
 * 
 * Dynamically modulates pitch, sub-bass resonance, filter envelope, and volume
 * based on attack heaviness, damage intensity, enemy archetype scale, and cast distance.
 */
export class SoundManager {
  constructor(camera) {
    this.camera = camera;
    this.listener = new AudioListener();
    this.camera.add(this.listener);

    this.context = this.listener.context;
    this.masterGain = this.listener.gain;

    this.buffers = new Map();
    this.audioPool = [];
    this.posPool = [];
    this.enabled = true;
    this.unlocked = false;

    /* ---- Background Music (Normal Ambient & Wave Combat) ---- */
    this.audioLoader = new AudioLoader();
    this.bgmNormal = new Audio(this.listener);
    this.bgmWave = new Audio(this.listener);
    this.isWaveMode = false;
    this.normalVolume = 0.42;
    this.waveVolume = 0.50;

    this._initBuffers();
    this._initBGM();
    this._bindUnlock();
  }

  _initBGM() {
    this.audioLoader.load('back_music/rubyzephyr-majestic-frost-446039.mp3', (buffer) => {
      this.bgmNormal.setBuffer(buffer);
      this.bgmNormal.setLoop(true);
      this.bgmNormal.setVolume(this.isWaveMode ? 0 : this.normalVolume);
      if (this.unlocked && !this.bgmNormal.isPlaying && !this.isWaveMode && this.enabled) {
        this.bgmNormal.play();
      }
    });

    this.audioLoader.load('back_music/sigmamusicart-epic-cinematic-background-music-551329.mp3', (buffer) => {
      this.bgmWave.setBuffer(buffer);
      this.bgmWave.setLoop(true);
      this.bgmWave.setVolume(this.isWaveMode ? this.waveVolume : 0);
      if (this.unlocked && !this.bgmWave.isPlaying && this.isWaveMode && this.enabled) {
        this.bgmWave.play();
      }
    });
  }

  _bindUnlock() {
    const unlock = () => {
      if (this.context && this.context.state === 'suspended') {
        this.context.resume().then(() => {
          this.unlocked = true;
          this.startBGM();
        });
      } else {
        this.unlocked = true;
        this.startBGM();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  startBGM() {
    if (!this.enabled) return;

    if (this.isWaveMode) {
      if (this.bgmWave.buffer && !this.bgmWave.isPlaying) {
        this.bgmWave.setVolume(this.waveVolume);
        this.bgmWave.play();
      }
      if (this.bgmNormal.isPlaying) {
        this.bgmNormal.setVolume(0);
      }
    } else {
      if (this.bgmNormal.buffer && !this.bgmNormal.isPlaying) {
        this.bgmNormal.setVolume(this.normalVolume);
        this.bgmNormal.play();
      }
      if (this.bgmWave.isPlaying) {
        this.bgmWave.setVolume(0);
      }
    }
  }

  /**
   * Smoothly cross-fades background music between Normal Ambient and Wave Mode Combat.
   * @param {boolean} isWaveActive true when Auto-Spawn Waves are active
   */
  setWaveMode(isWaveActive) {
    this.isWaveMode = isWaveActive;
    if (!this.unlocked || !this.enabled) return;

    const ctx = this.context;
    const now = ctx.currentTime;
    const fadeDuration = 1.4; // 1.4 second smooth crossfade

    if (isWaveActive) {
      // Fade in Wave Music, Fade out Normal Music
      if (this.bgmWave.buffer && !this.bgmWave.isPlaying) {
        this.bgmWave.setVolume(0);
        this.bgmWave.play();
      }
      if (this.bgmWave.gain) {
        this.bgmWave.gain.gain.cancelScheduledValues(now);
        this.bgmWave.gain.gain.setValueAtTime(this.bgmWave.gain.gain.value, now);
        this.bgmWave.gain.gain.linearRampToValueAtTime(this.waveVolume, now + fadeDuration);
      }
      if (this.bgmNormal.gain && this.bgmNormal.isPlaying) {
        this.bgmNormal.gain.gain.cancelScheduledValues(now);
        this.bgmNormal.gain.gain.setValueAtTime(this.bgmNormal.gain.gain.value, now);
        this.bgmNormal.gain.gain.linearRampToValueAtTime(0, now + fadeDuration);
      }
    } else {
      // Fade in Normal Music, Fade out Wave Music
      if (this.bgmNormal.buffer && !this.bgmNormal.isPlaying) {
        this.bgmNormal.setVolume(0);
        this.bgmNormal.play();
      }
      if (this.bgmNormal.gain) {
        this.bgmNormal.gain.gain.cancelScheduledValues(now);
        this.bgmNormal.gain.gain.setValueAtTime(this.bgmNormal.gain.gain.value, now);
        this.bgmNormal.gain.gain.linearRampToValueAtTime(this.normalVolume, now + fadeDuration);
      }
      if (this.bgmWave.gain && this.bgmWave.isPlaying) {
        this.bgmWave.gain.gain.cancelScheduledValues(now);
        this.bgmWave.gain.gain.setValueAtTime(this.bgmWave.gain.gain.value, now);
        this.bgmWave.gain.gain.linearRampToValueAtTime(0, now + fadeDuration);
      }
    }
  }

  unlockAudio() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume().then(() => {
        this.unlocked = true;
        this.startBGM();
      });
    } else {
      this.startBGM();
    }
  }

  setVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.context.currentTime);
    }
  }

  toggleMute() {
    this.enabled = !this.enabled;
    this.setVolume(this.enabled ? 1.0 : 0.0);
    if (this.enabled) {
      this.startBGM();
    }
    return this.enabled;
  }

  /* ------------------------------------------------------------------ */
  /* Procedural Multi-Layer Sound Synthesizers                          */
  /* ------------------------------------------------------------------ */

  _initBuffers() {
    const ctx = this.context;
    const sampleRate = ctx.sampleRate || 44100;

    const makeBuffer = (duration, renderFn) => {
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, numSamples, sampleRate);
      const data = buffer.getChannelData(0);
      renderFn(data, numSamples, sampleRate);
      return buffer;
    };

    /* ---- 1. Elemental Spell Casts (Visceral Exponential Transients) ---- */

    // 1. Frost Lance (Sharp icy spear punch + permafrost crackle)
    this.buffers.set('cast_ice', makeBuffer(0.75, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 5.0);
        const pike = Math.sin(2 * Math.PI * (170 + 720 * Math.exp(-t * 24)) * t);
        const crackle = (Math.random() * 2 - 1) * (Math.sin(t * 110) > 0.1 ? 0.75 : 0.12);
        data[i] = (pike * 0.6 + crackle * 0.55) * env;
      }
    }));

    // 2. Storm Lance (High-voltage electrical arc + lightning crack)
    this.buffers.set('cast_thunder', makeBuffer(0.8, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 4.8);
        const spark = Math.sin(2 * Math.PI * (160 + 550 * Math.exp(-t * 22)) * t);
        const crackle = (Math.random() * 2 - 1) * (Math.sin(t * 90) > 0 ? 0.8 : 0.15);
        data[i] = (spark * 0.6 + crackle * 0.55) * env;
      }
    }));

    // 3. Cinder Fall (Heavy explosive meteor blast + volcanic detonation)
    this.buffers.set('cast_meteor', makeBuffer(0.95, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 3.8);
        const blast = Math.sin(2 * Math.PI * (80 + 520 * Math.exp(-t * 20)) * t);
        const explosion = (Math.random() * 2 - 1) * (Math.sin(t * 70) > -0.1 ? 0.85 : 0.2);
        const sub = Math.sin(2 * Math.PI * 55 * t) * 0.4;
        data[i] = (blast * 0.65 + explosion * 0.55 + sub) * env;
      }
    }));

    // 4. Nova Beam (Supercharged laser zap + high-energy plasma discharge)
    this.buffers.set('cast_beam', makeBuffer(0.85, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 4.4);
        const laser = Math.sin(2 * Math.PI * (190 + 780 * Math.exp(-t * 22)) * t);
        const discharge = (Math.random() * 2 - 1) * (Math.sin(t * 130) > 0.1 ? 0.75 : 0.12);
        const hum = Math.sin(2 * Math.PI * 380 * t) * 0.3;
        data[i] = (laser * 0.6 + discharge * 0.55 + hum) * env;
      }
    }));

    // 5. Voltaic Snare (Magnetic coil clamp snap + electric pulse)
    this.buffers.set('cast_snare', makeBuffer(0.75, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 5.5);
        const clamp = Math.sin(2 * Math.PI * (180 + 880 * Math.exp(-t * 28)) * t);
        const electric = (Math.random() * 2 - 1) * (Math.sin(t * 140) > 0.2 ? 0.8 : 0.15);
        data[i] = (clamp * 0.65 + electric * 0.55) * env;
      }
    }));

    // 6. Glacial Crown (Heavy seismic ice rupture + tectonic permafrost crush)
    this.buffers.set('cast_glacier', makeBuffer(1.0, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 4.0);
        const rupture = Math.sin(2 * Math.PI * (95 + 560 * Math.exp(-t * 20)) * t);
        const crunch = (Math.random() * 2 - 1) * (Math.sin(t * 85) > 0 ? 0.85 : 0.18);
        const earth = Math.sin(2 * Math.PI * 65 * t) * 0.4;
        data[i] = (rupture * 0.65 + crunch * 0.55 + earth) * env;
      }
    }));

    /* ---- 2. Contextual Hit Impacts (Crisp Tactile Feedback) ---- */

    // Light Hit: Sharp slice/flesh scrape
    this.buffers.set('hit_light', makeBuffer(0.25, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 22);
        const snap = Math.sin(2 * Math.PI * (320 + 600 * Math.exp(-t * 35)) * t);
        const crunch = (Math.random() * 2 - 1) * 0.45;
        data[i] = (snap * 0.65 + crunch * 0.45) * env;
      }
    }));

    // Medium Hit: Solid bone/armor cracking punch
    this.buffers.set('hit_medium', makeBuffer(0.38, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 14);
        const punch = Math.sin(2 * Math.PI * (140 + 420 * Math.exp(-t * 26)) * t);
        const crunch = (Math.random() * 2 - 1) * 0.65;
        data[i] = (punch * 0.7 + crunch * 0.55) * env;
      }
    }));

    // Heavy Impact: Ground-shattering explosive boom
    this.buffers.set('hit_heavy', makeBuffer(0.7, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 5.8);
        const subThud = Math.sin(2 * Math.PI * (55 + 240 * Math.exp(-t * 18)) * t) * 0.95;
        const blast = (Math.random() * 2 - 1) * 0.8 * Math.exp(-t * 9);
        data[i] = (subThud * 0.7 + blast * 0.6) * env;
      }
    }));

    /* ---- 3. Enemy Archetype Specific Attacks ---- */

    // Brute (Demon): Heavy seismic ground slam & monstrous roar
    this.buffers.set('enemy_atk_brute', makeBuffer(0.75, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 5.0);
        const slam = Math.sin(2 * Math.PI * (70 - t * 30) * t) * 0.85;
        const roar = Math.sin(2 * Math.PI * 110 * t) * (Math.random() * 2 - 1) * 0.5;
        data[i] = (slam + roar) * env;
      }
    }));

    // Runner (Skull): Fast snapping predatory bite
    this.buffers.set('enemy_atk_runner', makeBuffer(0.3, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 16);
        const snap = Math.sin(2 * Math.PI * (480 - t * 320) * t);
        const hiss = (Math.random() * 2 - 1) * 0.35;
        data[i] = (snap * 0.8 + hiss) * env;
      }
    }));

    // Drone (YellowDragon): Plasma bolt discharge
    this.buffers.set('enemy_atk_drone', makeBuffer(0.45, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 9.0);
        const plasma = Math.sin(2 * Math.PI * (640 - t * 400) * t) * (1 + 0.3 * Math.sin(t * 60));
        data[i] = plasma * env * 0.8;
      }
    }));

    // Specter (Bat): Ultrasonic screech & wing flutter
    this.buffers.set('enemy_atk_specter', makeBuffer(0.4, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 11.0);
        const chirp = Math.sin(2 * Math.PI * (950 + 400 * Math.sin(t * 70)) * t);
        const flap = (Math.random() * 2 - 1) * 0.3;
        data[i] = (chirp * 0.65 + flap) * env;
      }
    }));

    /* ---- 4. Enemy Archetype Specific Death Screams ---- */

    // Brute Death: Deep crumbling seismic roar
    this.buffers.set('enemy_die_brute', makeBuffer(1.2, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 2.8);
        const sub = Math.sin(2 * Math.PI * (65 - t * 35) * t);
        const crumble = (Math.random() * 2 - 1) * 0.6;
        data[i] = (sub * 0.7 + crumble) * env;
      }
    }));

    // Runner Death: Shattering bone screech
    this.buffers.set('enemy_die_runner', makeBuffer(0.65, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 5.0);
        const screech = Math.sin(2 * Math.PI * (340 - t * 200) * t);
        const shatter = (Math.random() * 2 - 1) * 0.5;
        data[i] = (screech * 0.6 + shatter) * env;
      }
    }));

    // Drone Death: Electronic overload burst
    this.buffers.set('enemy_die_drone', makeBuffer(0.7, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 4.5);
        const zap = Math.sin(2 * Math.PI * (800 * Math.exp(-t * 8)) * t);
        const pop = (Math.random() * 2 - 1) * 0.55;
        data[i] = (zap * 0.6 + pop) * env;
      }
    }));

    // Specter Death: Ghostly sonic dissipation
    this.buffers.set('enemy_die_specter', makeBuffer(0.85, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 3.5);
        const scream = Math.sin(2 * Math.PI * (620 - t * 380) * t) * (1 + 0.4 * Math.sin(t * 40));
        data[i] = scream * env * 0.7;
      }
    }));

    /* ---- 5. Hero Feedback ---- */

    this.buffers.set('hero_hurt', makeBuffer(0.3, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 16);
        const thud = Math.sin(2 * Math.PI * 85 * t);
        data[i] = (thud * 0.85 + (Math.random() * 2 - 1) * 0.2) * env;
      }
    }));

    this.buffers.set('hero_defeat', makeBuffer(2.2, (data, n, sr) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 1.4);
        const c3 = Math.sin(2 * Math.PI * 130.81 * t);
        const eb3 = Math.sin(2 * Math.PI * 155.56 * t);
        const g3 = Math.sin(2 * Math.PI * 196.00 * t);
        const sub = Math.sin(2 * Math.PI * 65.4 * t) * 0.5;
        data[i] = (((c3 + eb3 + g3) / 3) * 0.7 + sub) * env;
      }
    }));
  }

  /* ------------------------------------------------------------------ */
  /* Contextual High-Level Playback API                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Play spell cast sound dynamically scaled by element heaviness and distance.
   * @param {string} element 'ice', 'thunder', 'meteor', 'beam', 'snare', 'glacier'
   * @param {number} distance cast distance in metres
   */
  playCast(element, distance = 10) {
    if (!this.enabled) return;
    this.unlockAudio();

    const soundKey = `cast_${element}`;
    const buffer = this.buffers.get(soundKey);
    if (!buffer) return;

    // Heaviness parameters per element (balanced for visceral punchiness)
    const HEAVINESS = {
      ice:     { pitch: 1.05, vol: 0.95, distPitchDrop: 0.05 },
      thunder: { pitch: 1.00, vol: 0.95, distPitchDrop: 0.06 },
      snare:   { pitch: 1.00, vol: 0.95, distPitchDrop: 0.06 },
      beam:    { pitch: 1.00, vol: 0.95, distPitchDrop: 0.06 },
      meteor:  { pitch: 0.95, vol: 1.05, distPitchDrop: 0.08 },
      glacier: { pitch: 0.92, vol: 1.05, distPitchDrop: 0.08 }
    };

    const cfg = HEAVINESS[element] || { pitch: 1.0, vol: 0.95, distPitchDrop: 0.06 };
    // Distant casts drop slightly in pitch and gain body
    const distFactor = Math.min(1.0, distance / 35.0);
    const finalPitch = Math.max(0.75, cfg.pitch - distFactor * cfg.distPitchDrop);
    const finalVol = Math.min(1.0, cfg.vol * (0.95 + distFactor * 0.1));

    this.play(soundKey, finalVol, finalPitch);
  }

  /**
   * Play combat hit impact dynamically adapted to damage amount.
   * @param {Vector3} position 3D impact location
   * @param {number} damage damage points (35 = light, 45-60 = medium, 85+ = heavy)
   */
  playHitImpact(position, damage = 35) {
    if (!this.enabled) return;

    let soundKey = 'hit_light';
    let volume = 0.7;
    let pitch = 1.1;

    if (damage >= 75) {
      soundKey = 'hit_heavy';
      volume = 1.0;
      pitch = 0.85 - (damage / 150) * 0.15; // deeper boom for huge damage
    } else if (damage >= 40) {
      soundKey = 'hit_medium';
      volume = 0.85;
      pitch = 0.95;
    }

    this.playAt(soundKey, position, volume, 6, 50, pitch);
  }

  /**
   * Play enemy archetype-specific attack whoosh/bite.
   * @param {string} type 'brute', 'runner', 'drone', 'specter'
   * @param {Vector3} position
   */
  playEnemyAttack(type, position) {
    const key = `enemy_atk_${type}`;
    const soundKey = this.buffers.has(key) ? key : 'enemy_atk_runner';

    // Brutes hit harder and have a deeper audio signature
    const volume = type === 'brute' ? 1.0 : (type === 'runner' ? 0.75 : 0.85);
    const refDist = type === 'brute' ? 8 : 5;
    this.playAt(soundKey, position, volume, refDist, 45);
  }

  /**
   * Play enemy archetype-specific demise scream.
   * @param {string} type 'brute', 'runner', 'drone', 'specter'
   * @param {Vector3} position
   */
  playEnemyDefeat(type, position) {
    const key = `enemy_die_${type}`;
    const soundKey = this.buffers.has(key) ? key : 'enemy_die_runner';

    const volume = type === 'brute' ? 1.0 : 0.85;
    this.playAt(soundKey, position, volume, 8, 55);
  }

  /* ------------------------------------------------------------------ */
  /* Low-Level Spatial & Global Audio Playback                          */
  /* ------------------------------------------------------------------ */

  play(name, volume = 0.8, pitch = 1.0) {
    if (!this.enabled) return;
    this.unlockAudio();

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    let sound = this.audioPool.find((s) => !s.isPlaying);
    if (!sound) {
      sound = new Audio(this.listener);
      this.audioPool.push(sound);
    }

    sound.setBuffer(buffer);
    sound.setVolume(volume);
    sound.setPlaybackRate(pitch * (0.97 + Math.random() * 0.06));
    sound.play();
  }

  playAt(name, position, volume = 0.9, refDistance = 6, maxDistance = 45, pitch = 1.0) {
    if (!this.enabled) return;
    this.unlockAudio();

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    let posSound = this.posPool.find((s) => !s.isPlaying);
    if (!posSound) {
      posSound = new PositionalAudio(this.listener);
      this.posPool.push(posSound);
    }

    posSound.position.copy(position);
    posSound.setBuffer(buffer);
    posSound.setRefDistance(refDistance);
    posSound.setMaxDistance(maxDistance);
    posSound.setRolloffFactor(1.15);
    posSound.setVolume(volume);
    posSound.setPlaybackRate(pitch * (0.96 + Math.random() * 0.08));
    posSound.play();
  }
}
