import { Vector3, MathUtils, Color } from 'three';

import { Renderer } from './Renderer.js';
import { Time } from './Time.js';
import { CameraRig } from './CameraRig.js';
import { frame } from './FrameUniforms.js';

import { Environment } from '../world/Environment.js';
import { Ground } from '../world/Ground.js';
import { Mountains } from '../world/Mountains.js';
import { DustMotes } from '../world/DustMotes.js';
import { ContactShadows } from '../world/ContactShadows.js';

import { AssetLoader } from '../loaders/AssetLoader.js';
import { CharacterController } from '../animation/CharacterController.js';

import { InputManager } from '../input/InputManager.js';
import { AimController } from '../input/AimController.js';

import { ParticleEngine } from '../particles/ParticleEngine.js';
import { LightPool } from '../effects/LightPool.js';
import { DecalSystem } from '../effects/GroundDecals.js';
import { FissureSystem } from '../effects/GroundFissures.js';
import { BurstSystem } from '../effects/BurstSphere.js';
import { CameraShake } from '../effects/CameraShake.js';
import { ScreenFlash } from '../effects/ScreenFlash.js';

import { AbilityManager } from '../abilities/AbilityManager.js';
import { PostProcessing } from '../postprocessing/PostProcessing.js';

import { HUD, LoadingScreen } from '../ui/HUD.js';
import { EnemySystem } from '../enemies/EnemySystem.js';

import { settings, ELEMENTS } from '../config/settings.js';


/**
 * Application root: owns every subsystem and the frame loop.
 *
 * The wiring is deliberately one-directional — App builds the systems, hands the
 * ability manager a context object of the shared services, and then does nothing
 * but order the per-frame updates. No subsystem reaches back into App.
 *
 * The interaction is a single loop: select and arm an ability (Q / E), swing the
 * ground arrow with the mouse, click to fire. `AimController` owns the targeting
 * and emits one `cast` event; App turns that into an ability, a heading for the
 * character and a cooldown.
 */
export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.time = new Time();
    this.elapsed = 0;
    this.paused = false;
    this._raf = 0;

    /**
     * Seconds left before each ability can be armed again. Per element, so
     * spending one slot never locks the other out.
     */
    this.cooldowns = new Map(ELEMENTS.map((element) => [element, 0]));

    this._fpsSamples = [];
    this._autoScaled = false;

    /* ---- core ---- */
    this.renderer = new Renderer(canvas);
    this.rig = new CameraRig(canvas);
    this.camera = this.rig.camera;

    this.environment = new Environment(this.renderer, this.camera);
    this.scene = this.environment.scene;

    /* ---- world ---- */
    this.ground = new Ground(this.environment);
    this.mountains = new Mountains(this.environment);
    this.dust = new DustMotes();
    this.contactShadows = new ContactShadows(this.renderer, { size: 2.6, height: 2.4, blur: 2.0 });

    this.scene.add(this.ground.mesh, this.mountains.mesh, this.dust.points, this.contactShadows.group);
    this.dust.setPixelRatio(this.renderer.gl.getPixelRatio());

    /* ---- shared VFX services ---- */
    this.particles = new ParticleEngine(this.scene);
    this.lights = new LightPool(this.scene);
    this.decals = new DecalSystem(this.scene);
    this.fissures = new FissureSystem(this.scene);
    this.bursts = new BurstSystem(this.scene);
    this.shake = new CameraShake(this.rig);
    this.flash = new ScreenFlash();
    this.enemies = new EnemySystem(this.scene);

    this.abilities = new AbilityManager({
      scene: this.scene,
      camera: this.camera,
      environment: this.environment,
      particles: this.particles,
      lights: this.lights,
      decals: this.decals,
      fissures: this.fissures,
      bursts: this.bursts,
      shake: this.shake,
      flash: this.flash
    });

    /* ---- character ---- */
    this.character = new CharacterController(this.environment);
    this.scene.add(this.character.root);

    /* ---- input & targeting ---- */
    this.input = new InputManager(canvas);
    this.aim = new AimController(this.camera);
    this.scene.add(this.aim.object3D);

    /* ---- post ---- */
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);

    /* ---- UI ---- */
    this.loading = new LoadingScreen();
    this.hud = new HUD(document.getElementById('hud'));
    this.editor = null;

    /* ---- Player Combat Stats ---- */
    this.playerMaxHealth = 100;
    this.playerHealth = 100;
    this.isPlayerDead = false;
    this.playerInvulnTimer = 0;
    this.playerCombatTimer = 0;   // seconds since last hit — regen kicks in after 5s
    this.respawnTimer = 0;

    // Regen rates (HP per second)
    this.REGEN_COMBAT   = 20.0; // slow trickle even while fighting
    this.REGEN_PASSIVE  = 50.0; // fast recovery when out of combat
    this.REGEN_DELAY    = 5.0;  // seconds after last hit to switch to fast regen

    this.hud.setPlayerHealth(this.playerHealth, this.playerMaxHealth);

    this._bindEvents();
    this.selectAbility(ELEMENTS[0], { silent: true });

    this._focusPoint = new Vector3();
  }

  /** Damage the player when struck by enemy melee or projectile */
  damagePlayer(amount, sourcePos = null, attackName = 'Attack') {
    if (this.isPlayerDead || this.playerInvulnTimer > 0) return;

    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.playerInvulnTimer = 0.08; // 80ms damage grace period
    this.playerCombatTimer = 0;    // reset out-of-combat regen delay

    console.log(`[COMBAT] Hero took -${amount} damage from ${attackName}. Remaining HP: ${this.playerHealth}`);

    // 1. Compute Knockback Vector away from attack source
    const knockbackDir = new Vector3();
    if (sourcePos) {
      knockbackDir.subVectors(this.character.position, sourcePos).setY(0);
      if (knockbackDir.lengthSq() < 1e-4) {
        knockbackDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      }
    } else {
      knockbackDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    }
    knockbackDir.normalize();

    // Scale knockback force by damage amount
    const knockForce = Math.min(8.5, 3.5 + amount * 0.16);
    this.character.applyKnockback(knockbackDir, knockForce);

    // 2. Spawn Impact Shockwave & Spark Burst on Character
    this.bursts.spawn(0, this.character.position.clone().setY(1.0), {
      radius: 0.25,
      endRadius: 2.2,
      life: 0.4,
      intensity: 3.5
    });

    // 3. Screen Red Flash & Impact Rumble
    this.flash.trigger(new Color(1.0, 0.12, 0.12), 0.85, 0.001);
    this.shake.add(0.32, 0.7, 16);

    this.hud.setPlayerHealth(this.playerHealth, this.playerMaxHealth);

    if (this.playerHealth <= 0) {
      this.isPlayerDead = true;
      this.playerHealth = 0;
      this.hud.setPlayerHealth(0, this.playerMaxHealth);
      this.hud.showDefeatScreen(`Fell to ${attackName}`);
    } else {
      this.hud.showToast(`🩸 -${amount} HP (${attackName})`, 800);
    }
  }

  /** The ability currently in the slot. */
  get element() {
    return this.abilities.selected;
  }

  /* ------------------------------------------------------------------ */

  _bindEvents() {
    this.renderer.onResize((width, height, pixelRatio) => {
      this.rig.resize(width, height);
      this.post.setSize(width, height, pixelRatio);
      this.dust.setPixelRatio(pixelRatio);
    });

    this.input.on('pointer:move', (pointer) => this.aim.point(pointer));
    this.input.on('pointer:confirm', (pointer) => {
      if (this.isPlayerDead) return;
      this.aim.point(pointer);
      this.aim.confirm();
    });
    this.input.on('action', (action, slot) => this._handleAction(action, slot));

    this.aim.on('cast', (origin, direction, distance) => {
      if (this.isPlayerDead) return;
      this._cast(origin, direction, distance);
    });
    this.aim.on('reject', () => this.hud.showToast('Too close — aim further out'));

    this.hud.onAbility = (element) => {
      if (!this.isPlayerDead) this.armAbility(element);
    };
    this.hud.onSpawnEnemy = () => this._handleAction('spawnEnemy');
    this.hud.onToggleAutoSpawn = () => this._handleAction('toggleAutoSpawn');
    this.hud.onRestart = () => this.restartGame();
  }

  /** Reset player and field after defeat */
  restartGame() {
    this.isPlayerDead = false;
    this.playerHealth = this.playerMaxHealth;
    this.playerInvulnTimer = 0.5;
    this.playerCombatTimer = this.REGEN_DELAY; // start fully out-of-combat after restart
    this.respawnTimer = 0;
    this.hud.setPlayerHealth(this.playerHealth, this.playerMaxHealth);
    this.hud.hideDefeatScreen();
    this.enemies.clear();
    this.clearEffects();
    this.character.resetPlacement();
    this.hud.showToast('⚔️ Battle Restarted — 100 HP Restored!', 1800);
  }

  async toggleEditor() {
    if (!this.editor) {
      const { Editor } = await import('../ui/Editor.js');
      this.editor = new Editor({
        onClear: () => this.clearEffects(),
        onToast: (message) => this.hud.showToast(message)
      });
    }
    this.editor.toggle();
  }

  _handleAction(action, slot) {
    switch (action) {
      case 'spawnEnemy': {
        // Spawn at a random location 15m+ away around the player (ground or flying archetype)
        const result = this.enemies.spawnRandom(this.character.position, 15, 24);
        const icon = result.archetype?.category === 'flying' ? '🦅' : '👹';
        console.log(`[Enemy] Spawned ${result.archetype?.name} at`, result.position, `(${result.distance.toFixed(1)}m away)`);
        this.hud.showToast(`${icon} Spawned ${result.archetype?.name || 'Enemy'} (${result.distance.toFixed(0)}m away)`);
        break;
      }
      case 'toggleAutoSpawn': {
        const active = this.enemies.toggleAutoSpawn();
        this.hud.setAutoSpawn?.(active);
        this.hud.showToast(active ? 'Auto-Spawn Waves: ON (every 4s at 15m+)' : 'Auto-Spawn Waves: OFF');
        break;
      }
      case 'restart': {
        if (this.isPlayerDead) this.restartGame();
        break;
      }
      case 'ability': {
        const element = ELEMENTS[slot] ?? this.element;
        // Pressing the *same* key again puts an armed cast away, as it does in a
        // MOBA; pressing a different one swaps the slot without disarming.
        if (this.aim.isArmed && element === this.element) this.aim.cancel();
        else this.armAbility(element);
        break;
      }
      case 'cancel':
        this.aim.cancel();
        break;
      case 'toggleHelp':
        this.hud.toggleHelp();
        break;
      case 'toggleEditor':
        this.toggleEditor();
        break;
      case 'clear':
        this.clearEffects();
        this.hud.showToast('Effects cleared');
        break;
      case 'togglePause':
        this.paused = !this.paused;
        this.hud.setPaused(this.paused);
        this.hud.showToast(this.paused ? 'Paused — the editor still applies' : 'Resumed');
        break;
      default:
        break;
    }
  }

  /**
   * Put an ability in the slot. The aim indicator and the HUD both follow,
   * because `range` and `minRange` are the ability's, not the app's.
   */
  selectAbility(element, options = {}) {
    if (!ELEMENTS.includes(element)) return;
    this.abilities.select(element);
    this.aim.setElement(element);
    this.hud.setElement(element, options);
  }

  /** Select an ability and arm it, unless it is still cooling down. */
  armAbility(element = this.element) {
    if ((this.cooldowns.get(element) ?? 0) > 0) {
      this.hud.showToast('Not ready');
      return;
    }
    // Selecting before arming means the arrow is already drawn to the new
    // ability's range on the frame it appears.
    if (element !== this.element) this.selectAbility(element);
    this.aim.arm();
  }

  _cast(origin, direction, distance) {
    const element = this.element;
    this.abilities.cast(origin, direction, distance, element);
    this.cooldowns.set(element, Math.max(0, settings[element].cooldown));

    // Snap onto the shot and throw the body into it. Which clip that is belongs
    // to the ability, so each spell can be cast with its own gesture.
    this.character.setFacing(this.aim.facing);
    this.character.playCast(settings[element].castAnim);
    this.character.castLunge();

    // Smooth cinematic sub-bass ground rumble on cast release
    this.shake.add(0.45, 0.95, 9.5);

    // Recentre to default third-person distance 2.5 s after the cast fires.
    this.rig.recentre(2.5);
  }

  clearEffects() {
    this.aim.cancel();
    this.abilities.clear();
    this.particles.reset();
    this.decals.clear();
    this.fissures.clear();
    this.bursts.clear();
    this.lights.reset();
    this.shake.reset();
    this.flash.reset();
    this.enemies.clear();
  }

  /* ------------------------------------------------------------------ */

  /** Load assets, warm the shader cache, then start the loop. */
  async load() {
    const assets = new AssetLoader();

    this.loading.setProgress(0.05, 'Loading environment…');
    await this.environment.loadEnvironment();
    frame.uEnvMap.value = this.environment.equirect;

    this.loading.setProgress(0.35, 'Loading terrain…');
    await Promise.all([
      this.ground.loadTextures(assets),
      this.mountains.loadTextures(assets)
    ]);

    this.loading.setProgress(0.5, 'Loading character…');
    await this.character.load(assets);

    this.loading.setProgress(0.85, 'Compiling shaders…');
    // Compile everything up front so the first cast never stutters.
    await this.renderer.gl.compileAsync(this.scene, this.camera);

    this.loading.setProgress(1, 'Ready');
    this.loading.hide();

    this.start();
  }

  start() {
    this.time.reset();
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this.frame();
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this._raf);
  }

  /* ------------------------------------------------------------------ */

  frame() {
    const gl = this.renderer.gl;
    gl.info.reset();

    const raw = this.time.tick();
    const dt = this.paused ? 0 : raw * settings.global.timeScale;
    this.elapsed += dt;

    if (raw > 0) {
      this._fpsSamples.push(1 / raw);
      if (this._fpsSamples.length > 60) this._fpsSamples.shift();
      if (!this._autoScaled && this._fpsSamples.length >= 60) {
        const avgFps = this._fpsSamples.reduce((a, b) => a + b, 0) / 60;
        if (avgFps < 45) {
          settings.global.particleCount = 0.5;
          settings.global.particleLifetime = 0.25;
          this._autoScaled = true;
          this.hud.showToast('FPS low — auto-scaled particle budget');
        }
      }
    }

    /* ---- shared uniforms ---- */
    frame.uTime.value = this.elapsed;
    frame.uDelta.value = dt;
    frame.uShaderIntensity.value = settings.global.shaderIntensity;
    frame.uGlobalGlow.value = settings.global.glow;
    frame.uCameraNear.value = this.camera.near;
    frame.uCameraFar.value = this.camera.far;

    /* ---- simulation ---- */
    this.renderer.syncSettings();

    this.environment.setFocus(this.character.position.x, this.character.position.z);
    this.environment.update();

    // Targeting runs on *real* time so the arrow keeps sweeping and animating
    // while the sandbox is paused — pausing freezes the effects, not the UI.
    this.aim.setOrigin(this.character.position);
    this.aim.update(raw);

    if (settings.character.turnToAim && this.aim.isArmed) {
      this.character.turnToward(this.aim.facing, settings.character.turnRate, raw);
    }
    this.character.update(dt);

    /* ---- Player Health Lifecycle Tick ---- */
    if (this.playerInvulnTimer > 0) {
      this.playerInvulnTimer -= raw;
    }

    if (!this.isPlayerDead && this.playerHealth < this.playerMaxHealth) {
      this.playerCombatTimer += raw;
      const rate = this.playerCombatTimer >= this.REGEN_DELAY
        ? this.REGEN_PASSIVE
        : this.REGEN_COMBAT;
      this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + rate * raw);
      this.hud.setPlayerHealth(this.playerHealth, this.playerMaxHealth);
    }

    for (const [element, remaining] of this.cooldowns) {
      if (remaining > 0) this.cooldowns.set(element, Math.max(0, remaining - raw));
    }

    this.ground.update(this.elapsed);
    this.dust.update(this.elapsed, this.character.position);

    this.abilities.update(dt);
    this.particles.flush(this.elapsed);
    this.decals.update(dt);
    this.fissures.update(dt);
    this.bursts.update(dt);
    this.lights.update(dt);
    this.enemies.update(
      dt,
      this.character.position,
      this.camera,
      this.aim,
      this.abilities.active,
      (dmg, src, name) => this.damagePlayer(dmg, src, name)
    );
    this.enemies.checkCombat(this.abilities.active, {
      bursts: this.bursts,
      shake: this.shake,
      hud: this.hud
    });

    /* ---- camera ---- */
    const focus = this.abilities.focus;
    if (focus) this.rig.lookAt(focus.position, MathUtils.clamp(1 - focus.u * 0.4, 0, 1));
    this.rig.setAnchor(this.character.position.x, 0, this.character.position.z);
    this.shake.update(raw);
    this.flash.update(raw);
    this.rig.update(raw);

    this.contactShadows.setPosition(this.character.position.x, this.character.position.z);
    this.contactShadows.render(this.scene);

    /* ---- render ---- */
    // Exactly one cascade shadow update per frame (see Renderer).
    gl.shadowMap.needsUpdate = true;
    this.post.sync(this.elapsed, this.flash);
    this.post.render();

    /* ---- readouts ---- */
    for (const element of ELEMENTS) {
      this.hud.setCooldown(element, this.cooldowns.get(element) ?? 0, settings[element].cooldown);
    }
    this.hud.setArmed(this.aim.isArmed);
    this.hud.update(raw, () => ({
      particles: this.particles.countLive(this.elapsed),
      calls: gl.info.render.calls,
      spikes: this.abilities.active.reduce((total, ability) => total + ability.instanceCount, 0),
      abilities: this.abilities.active.length
    }));
  }

  /* ------------------------------------------------------------------ */

  dispose() {
    this.stop();
    this.input.dispose();
    this.aim.dispose();
    this.abilities.dispose();
    this.particles.dispose();
    this.decals.dispose();
    this.fissures.dispose();
    this.bursts.dispose();
    this.lights.dispose();
    this.character.dispose();
    this.ground.dispose();
    this.mountains.dispose();
    this.dust.dispose();
    this.contactShadows.dispose();
    this.post.dispose();
    this.environment.dispose();
    this.editor?.dispose();
    this.rig.dispose();
    this.renderer.dispose();
  }
}
