import { Vector3 } from 'three';
import { settings } from '../config/settings.js';

/**
 * Additive camera shake driven by layered noise.
 *
 * Multiple impacts stack into a single trauma value; the offset is derived from
 * smooth pseudo-noise rather than white noise so the motion reads as weight
 * rather than jitter. Trauma decays quadratically, which is what makes small
 * hits feel snappy and big ones feel heavy.
 */
export class CameraShake {
  constructor(rig) {
    this.rig = rig;
    this.trauma = 0;
    this.decay = 0.95;
    this.frequency = 9.5; // Low-frequency cinematic sub-bass rumble
    this._castCount = 0;   // Stacked skill cast counter for n log(n) decay scaling
    this._time = 0;
    this._offset = new Vector3();
  }

  /**
   * @param {number} amount    0..1 trauma to add
   * @param {number} [decay]   trauma units per second
   * @param {number} [frequency]
   */
  add(amount, decay = 0.95, frequency = 9.5) {
    this._castCount++;
    this.trauma = Math.min(1, this.trauma + amount * settings.global.cameraShake * 1.25);
    this.decay = decay;
    this.frequency = frequency;
  }

  /** Sustained cinematic ground rumble */
  rumble(amount, dt) {
    this.trauma = Math.min(1, this.trauma + amount * settings.global.cameraShake * dt * 4);
  }

  update(dt) {
    this._time += dt;

    if (this.trauma <= 0.0001) {
      this.trauma = 0;
      this._castCount = 0;
      this.rig.shakeOffset.set(0, 0, 0);
      this.rig.shakeRoll = 0;
      return;
    }

    // Smooth power curve for heavy seismic weight (no jagged snapping)
    const shake = Math.pow(this.trauma, 1.4);
    const t = this._time * this.frequency;

    // Smooth, low-frequency harmonics for cinematic rolling wave motion
    const nx = Math.sin(t * 0.7) * 0.75 + Math.sin(t * 1.3 + 1.1) * 0.25;
    const ny = Math.cos(t * 0.85 + 2.1) * 0.8 + Math.sin(t * 1.5 + 0.4) * 0.2;
    const nz = Math.sin(t * 0.5 + 4.3) * 0.7 + Math.cos(t * 1.1 + 2.8) * 0.3;

    // Smooth spatial displacement & rolling pitch for cinematic immersion
    this._offset.set(nx * 0.7, ny * 0.9, nz * 0.65).multiplyScalar(shake * 0.85);
    this.rig.shakeOffset.copy(this._offset);
    this.rig.shakeRoll = nz * shake * 0.055;

    // n log(n) decay scaling for stacked skill casts:
    // As castCount (n) increases, effectiveDecay accelerates by n * log(n + 1)
    const n = Math.max(1, this._castCount);
    const nlogMult = Math.max(1.0, (n * Math.log(n + 1.0)) / 0.693);
    const effectiveDecay = this.decay * nlogMult;

    this.trauma = Math.max(0, this.trauma - effectiveDecay * dt);
  }

  reset() {
    this.trauma = 0;
    this._castCount = 0;
    this.rig.shakeOffset.set(0, 0, 0);
    this.rig.shakeRoll = 0;
  }
}
