import {
  WebGLRenderer,
  PCFSoftShadowMap,
  ACESFilmicToneMapping,
  SRGBColorSpace
} from 'three';
import { settings } from '../config/settings.js';

/**
 * Thin wrapper around WebGLRenderer that owns canvas sizing, pixel-ratio
 * budgeting and the render-quality knobs the rest of the app never touches.
 *
 * Quality tiers
 * ─────────────
 * | Tier | Condition                                    | DPR cap | AA  |
 * |------|----------------------------------------------|---------|-----|
 * | LOW  | width < 768  OR  deviceMemory ≤ 2 GB         |  1.0    | off |
 * | MED  | 768 ≤ width < 1440  OR  deviceMemory 2–4 GB  |  1.25   | on  |
 * | HIGH | width ≥ 1440 AND deviceMemory > 4 GB         |  2.0    | on  |
 *
 * `navigator.deviceMemory` is an optional API; unknown devices default to
 * HIGH so desktop users with unsupported browsers are never penalised.
 * The tier is re-evaluated on every resize, so rotating a phone or plugging
 * in an external monitor is handled automatically.
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.tier = this.calculateTier();

    this.gl = new WebGLRenderer({
      canvas,
      antialias: this.tier !== 'LOW',
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false
    });

    this._applyPixelRatio();
    this.gl.setSize(window.innerWidth, window.innerHeight, false);

    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFSoftShadowMap;
    // The frame renders the scene several times (depth prepass, distortion,
    // contact shadows, main pass). Automatic updates would rebuild the cascade
    // shadow maps for every one of them, so the app flags a single update per
    // frame instead.
    this.gl.shadowMap.autoUpdate = false;

    // Tone mapping is executed by the post pipeline's OutputPass, which reads
    // these two properties from the renderer.
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = settings.post.exposure;
    this.gl.outputColorSpace = SRGBColorSpace;

    this.gl.info.autoReset = false;

    this._onResize = null;
  }

  // ─── Tier detection & Resolution Budgeting ──────────────────────────────

  /**
   * Multi-heuristic classification of the current device into a quality tier.
   * Considers mobile touch environment, CPU concurrency, device memory, and viewport.
   */
  calculateTier() {
    const isMobile =
      /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

    const cores = navigator.hardwareConcurrency ?? (isMobile ? 4 : 8);
    const mem = navigator.deviceMemory ?? (isMobile ? 3 : 8);
    const w = window.innerWidth;

    if (w < 768 || (isMobile && (w < 900 || mem <= 3 || cores <= 4)) || mem <= 2 || cores <= 4) {
      return 'LOW';
    }
    if (isMobile || w < 1440 || mem <= 4 || cores <= 6) {
      return 'MED';
    }
    return 'HIGH';
  }

  /**
   * Budget pixel ratio based on screen size and maximum total pixel count.
   * Prevents 4K/Ultrawide screens from rendering at 8K (33M+ pixels) and prevents
   * Mobile 3x Retina screens from overheating the GPU.
   */
  _applyPixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);

    // Maximum total fragment pixel budgets per tier
    const maxPixels = this.tier === 'LOW' ? 1.3e6 : this.tier === 'MED' ? 2.3e6 : 3.8e6;
    const maxDprByPixels = Math.sqrt(maxPixels / (w * h));
    const maxDprByTier = this.tier === 'LOW' ? 1.0 : this.tier === 'MED' ? 1.25 : 1.5;

    const targetDpr = Math.max(0.75, Math.min(dpr, maxDprByTier, maxDprByPixels));
    this.gl.setPixelRatio(targetDpr);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  get domElement() {
    return this.gl.domElement;
  }

  get size() {
    return this.gl.getSize({ width: 0, height: 0 });
  }

  onResize(callback) {
    this._onResize = callback;
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  handleResize = () => {
    const newTier = this.calculateTier();
    if (newTier !== this.tier) {
      this.tier = newTier;
      // Note: antialias is baked at WebGL context creation and cannot be
      // toggled at runtime. The tier update still propagates to App and
      // PostProcessing so they can adapt quality knobs live.
    }
    this._applyPixelRatio();
    this.gl.setSize(window.innerWidth, window.innerHeight, false);
    this._onResize?.(window.innerWidth, window.innerHeight, this.gl.getPixelRatio());
  };

  /** Called once per frame before rendering so the editor can drive exposure. */
  syncSettings() {
    this.gl.toneMappingExposure = settings.post.exposure;
  }

  dispose() {
    window.removeEventListener('resize', this.handleResize);
    this.gl.dispose();
  }
}
