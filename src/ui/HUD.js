import { ELEMENTS, ELEMENT_META } from '../config/settings.js';
import { ELEMENT_SIGILS } from './glyphs.js';

/**
 * Heads-up display: the ability bar, controls, live stats and toasts.
 *
 * Plain DOM — no framework. The bar is built from `ELEMENTS`, so a new ability
 * appears in it on its own; the slots are the only interactive part, and they
 * mirror the keyboard shortcuts through `onAbility`.
 *
 * The cooldown sweep is a `conic-gradient` driven by a CSS custom property, so
 * updating it every frame is one `setProperty` call and never touches layout.
 */
export class HUD {
  constructor(root) {
    this.root = root;
    this.onAbility = null;
    this.onSpawnEnemy = null;
    this._toastTimer = 0;
    this._statsAccumulator = 0;
    this._frames = 0;
    this._fps = 0;
    /** Last sweep ratio pushed to the DOM, per element. */
    this._cooldownShown = new Map();
    this._armedShown = null;

    root.innerHTML = `
      <div class="hud__panel hud__title">
        Elemental Sandbox
        <span data-blurb>Press Q, E, R, F, V, X to cast. Press Z or button to spawn enemy.</span>
      </div>

      <div class="hud__left-actions">
        <button class="hud__action-btn hud__spawn-btn" id="hud-spawn-btn" title="Random Spawn 15m+ (Z)">
          <svg class="hud__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
            <path d="M8 15h8" />
          </svg>
          <span class="hud__btn-text">Spawn Random</span>
          <kbd>Z</kbd>
        </button>

        <button class="hud__action-btn hud__auto-btn" id="hud-auto-btn" title="Toggle Auto-Spawn Waves (T)">
          <svg class="hud__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span class="hud__btn-text" id="hud-auto-text">Auto Waves</span>
          <kbd>T</kbd>
        </button>
      </div>

      <div class="hud__panel hud__stats">
        <div>FPS <b data-stat="fps">—</b></div>
        <div>Particles <b data-stat="particles">0</b></div>
        <div>Instances <b data-stat="spikes">0</b></div>
        <div>Draw calls <b data-stat="calls">0</b></div>
      </div>

      <div class="hud__panel hud__help">
        <div><strong>Q</strong> — Frost Lance &nbsp; <strong>E</strong> — Storm Lance</div>
        <div><strong>R</strong> — Cinder Fall &nbsp; <strong>F</strong> — Nova Beam</div>
        <div><strong>V</strong> — Voltaic Snare &nbsp; <strong>X</strong> — Glacial Crown</div>
        <div class="hud__help-note">V and X are far casts — aimed with a circle, not an arrow.</div>
        <div><strong>Move</strong> — aim &nbsp; <strong>Left click</strong> — cast</div>
        <div><strong>Esc / right click</strong> — cancel the cast</div>
        <div><strong>Right drag</strong> — orbit &nbsp; <strong>Scroll</strong> — zoom</div>
        <div style="margin-top:6px">
          <kbd>Z</kbd> spawn 15m+ &nbsp; <kbd>T</kbd> auto waves &nbsp; <kbd>G</kbd> editor &nbsp; <kbd>P</kbd> pause &nbsp; <kbd>C</kbd> clear
        </div>
        <div><kbd>H</kbd> hide this</div>
        <div class="hud__help-note">Paused still applies every editor change.</div>
      </div>

      <!-- Player Vitality Bar (Top Center Header) -->
      <div class="hud__player-bar">
        <div class="hud__player-hp">
          <div class="hud__hp-text">
            <span class="hud__hp-label">HERO VITALITY</span>
            <b id="player-hp-value">100 / 100</b>
          </div>
          <div class="hud__hp-track">
            <div class="hud__hp-fill" id="player-hp-fill" style="width: 100%;"></div>
          </div>
        </div>
      </div>

      <div class="hud__abilities">
        ${ELEMENTS.map((element) => {
          const meta = ELEMENT_META[element];
          return `
            <div class="ability-card" data-element="${element}" style="--accent:${meta.accent}">
              <div class="ability-card__sweep" data-sweep></div>
              <div class="ability-card__key">${meta.key}</div>
              <div class="ability-card__glyph">${ELEMENT_SIGILS[element] ?? ''}</div>
              <div class="ability-card__label">${meta.label}</div>
            </div>`;
        }).join('')}
      </div>

      <div class="hud__toast" data-toast></div>
      <div class="hud__paused" data-paused>Paused</div>

      <!-- Defeat / Game Over Overlay -->
      <div class="hud__defeat-screen" id="hud-defeat-screen">
        <div class="hud__defeat-box">
          <div class="hud__defeat-icon">💀</div>
          <div class="hud__defeat-title">HERO DEFEATED</div>
          <div class="hud__defeat-sub" id="hud-defeat-sub">You were slain in combat</div>
          <button class="hud__restart-btn" id="hud-restart-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            <span>Restart Battle</span>
          </button>
        </div>
      </div>
    `;

    this.spawnBtn = root.querySelector('#hud-spawn-btn');
    this.spawnBtn?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    this.spawnBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onSpawnEnemy?.();
    });

    this.autoBtn = root.querySelector('#hud-auto-btn');
    this.autoText = root.querySelector('#hud-auto-text');
    this.autoBtn?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    this.autoBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onToggleAutoSpawn?.();
    });

    this.defeatScreen = root.querySelector('#hud-defeat-screen');
    this.defeatSub = root.querySelector('#hud-defeat-sub');
    this.restartBtn = root.querySelector('#hud-restart-btn');
    this.restartBtn?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    this.restartBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onRestart?.();
    });

    this.hpFill = root.querySelector('#player-hp-fill');
    this.hpText = root.querySelector('#player-hp-value');

    this.cards = new Map();
    for (const card of root.querySelectorAll('.ability-card')) {
      this.cards.set(card.dataset.element, card);
      card.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.onAbility?.(card.dataset.element);
      });
    }

    this.stats = {
      fps: root.querySelector('[data-stat="fps"]'),
      particles: root.querySelector('[data-stat="particles"]'),
      spikes: root.querySelector('[data-stat="spikes"]'),
      calls: root.querySelector('[data-stat="calls"]')
    };
    this.help = root.querySelector('.hud__help');
    this.toast = root.querySelector('[data-toast]');
    this.pausedBadge = root.querySelector('[data-paused]');
    this.abilityBar = root.querySelector('.hud__abilities');
  }

  setAutoSpawn(active) {
    if (this.autoBtn) {
      this.autoBtn.classList.toggle('is-active', active);
    }
    if (this.autoText) {
      this.autoText.textContent = active ? 'Waves: ON' : 'Auto Waves';
    }
  }

  showDefeatScreen(subtitle = 'You were slain in combat') {
    if (this.defeatSub) {
      this.defeatSub.textContent = subtitle;
    }
    if (this.defeatScreen) {
      this.defeatScreen.classList.add('is-active');
    }
  }

  hideDefeatScreen() {
    if (this.defeatScreen) {
      this.defeatScreen.classList.remove('is-active');
    }
  }

  setPlayerHealth(current, max) {
    if (this.hpFill) {
      const pct = Math.max(0, Math.min(1, current / Math.max(1, max))) * 100;
      this.hpFill.style.width = `${pct}%`;
      if (pct < 30) {
        this.hpFill.style.background = 'linear-gradient(90deg, #b91c1c, #ef4444)';
        this.hpFill.style.boxShadow = '0 0 16px rgba(239, 68, 68, 0.9)';
      } else if (pct < 60) {
        this.hpFill.style.background = 'linear-gradient(90deg, #c2410c, #f59e0b)';
        this.hpFill.style.boxShadow = '0 0 16px rgba(245, 158, 11, 0.8)';
      } else {
        this.hpFill.style.background = 'linear-gradient(90deg, #059669, #10b981)';
        this.hpFill.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.8)';
      }
    }
    if (this.hpText) {
      this.hpText.textContent = `${Math.ceil(Math.max(0, current))} / ${max}`;
    }
  }

  /** @param {{silent?: boolean}} [options] */
  setElement(element, options = {}) {
    for (const [key, card] of this.cards) {
      card.classList.toggle('is-active', key === element);
    }
    const meta = ELEMENT_META[element];
    if (meta && !options.silent) this.showToast(`${meta.hint} selected`);
  }

  /** Highlight the slot while a cast is armed. */
  setArmed(armed) {
    if (armed === this._armedShown) return;
    this._armedShown = armed;
    this.abilityBar.classList.toggle('is-armed', armed);
  }

  /**
   * Drive one slot's cooldown sweep. Cooldowns are per ability, so this is
   * called once per element each frame.
   *
   * @param {string} element
   * @param {number} remaining seconds left
   * @param {number} total     the full cooldown, for the sweep angle
   */
  setCooldown(element, remaining, total) {
    const card = this.cards.get(element);
    if (!card) return;

    const ratio = Math.max(0, Math.min(1, remaining / Math.max(total, 0.001)));
    // Only touch the DOM when the sweep visibly moves.
    if (Math.abs(ratio - (this._cooldownShown.get(element) ?? -1)) < 0.01) return;
    this._cooldownShown.set(element, ratio);
    card.style.setProperty('--cooldown', ratio);
    card.classList.toggle('is-cooling', ratio > 0.001);
  }

  setPaused(paused) {
    this.pausedBadge.classList.toggle('is-visible', paused);
  }

  toggleHelp() {
    this.help.classList.toggle('is-hidden');
  }

  showToast(message, duration = 1600) {
    this.toast.textContent = message;
    this.toast.classList.add('is-visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove('is-visible'), duration);
  }

  /**
   * @param {number} dt
   * @param {() => {particles:number, spikes:number, calls:number}} collect
   *   Called only when the readout actually refreshes, so gathering the numbers
   *   (which means walking the particle pools) stays off the hot path.
   */
  update(dt, collect) {
    this._frames++;
    this._statsAccumulator += dt;
    if (this._statsAccumulator < 0.4) return;

    this._fps = Math.round(this._frames / this._statsAccumulator);
    this._frames = 0;
    this._statsAccumulator = 0;
    console.log(`FPS: ${this._fps}`);

    const info = collect();
    this.stats.fps.textContent = this._fps;
    this.stats.particles.textContent = info.particles;
    this.stats.spikes.textContent = info.spikes;
    this.stats.calls.textContent = info.calls;
  }
}

/** Boot screen helper. */
export class LoadingScreen {
  constructor() {
    this.element = document.getElementById('loader');
    this.fill = document.getElementById('loader-fill');
    this.status = document.getElementById('loader-status');
  }

  setProgress(ratio, message) {
    this.fill.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    if (message) this.status.textContent = message;
  }

  hide() {
    this.setProgress(1);
    setTimeout(() => this.element.classList.add('is-hidden'), 220);
  }

  fail(message) {
    this.status.textContent = message;
    this.status.style.color = '#ff7a6a';
  }
}
