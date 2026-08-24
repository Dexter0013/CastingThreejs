import { Group, Vector3, SphereGeometry, MeshBasicMaterial, Mesh } from 'three';
import { ObjectPool } from '../utils/ObjectPool.js';
import { Enemy, ENEMY_ARCHETYPES } from './Enemy.js';
import { AI_CONFIG } from './EnemyAI.js';
import { EnemyModelLoader } from './EnemyModelLoader.js';
import { LAYER } from '../core/Layers.js';

/** Maximum simultaneous enemies; oldest is removed when cap is hit */
const MAX_ACTIVE_ENEMIES = 10;
const MAX_DANGER_ZONES = 12;
const ALL_TYPES = Object.keys(ENEMY_ARCHETYPES);

// Weighted spawn pool — more ground entries = ground enemies spawn more often.
// brute:2, runner:3, drone:1, specter:1  →  flying ~25% of spawns
const SPAWN_POOL = [
  'brute', 'brute',
  'runner', 'runner', 'runner',
  'drone',
  'specter'
];

export class EnemySystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new Group();
    this.group.name = 'Enemies';
    scene.add(this.group);

    // Enemy projectile system
    this.projectilesGroup = new Group();
    this.projectilesGroup.name = 'EnemyProjectiles';
    scene.add(this.projectilesGroup);
    this.activeProjectiles = [];

    this.projGeo = new SphereGeometry(0.35, 8, 8);
    this.projMatDrone = new MeshBasicMaterial({ color: 0x34d399 });
    this.projMatSpecter = new MeshBasicMaterial({ color: 0xc084fc });

    this.active = [];
    this.pools = new Map();

    // GLB/GLTF model loader for animated enemy archetypes
    this.modelLoader = new EnemyModelLoader();

    // Create pools for all enemy archetypes
    for (const type of ALL_TYPES) {
      const pool = new ObjectPool(
        () => new Enemy(type),
        (enemy) => {
          enemy.visible = false;
          this.group.remove(enemy);
          enemy.reset();
        }
      );
      this.pools.set(type, pool);
    }

    this.autoSpawn = false;
    this.autoSpawnInterval = 3.5;
    this.autoSpawnTimer = 1.5;

    // Spatial Kill-Zone Memory (Heatmap of danger areas)
    this.dangerZones = [];
  }

  /**
   * Load animated GLTF/GLB models for enemies.
   */
  async load() {
    await this.modelLoader.load();
  }

  /** Record a death or heavy blast location to spatial AI memory */
  addDangerZone(position) {
    if (this.dangerZones.length >= MAX_DANGER_ZONES) {
      this.dangerZones.shift();
    }
    this.dangerZones.push({
      position: position.clone().setY(0),
      age: 0,
      life: AI_CONFIG.dangerDecayTime
    });
  }

  /** Fire an energy bolt from flying enemy towards player */
  fireProjectile(fromPos, targetPos, type = 'drone', speed = 16, damage = 16) {
    const mat = type === 'specter' ? this.projMatSpecter : this.projMatDrone;
    const mesh = new Mesh(this.projGeo, mat);
    mesh.layers.set(LAYER.WORLD);
    mesh.position.copy(fromPos);

    const dir = new Vector3().copy(targetPos).setY(0.9).sub(fromPos).normalize();
    const velocity = dir.multiplyScalar(speed);

    this.projectilesGroup.add(mesh);
    this.activeProjectiles.push({
      mesh,
      velocity,
      damage,
      life: 2.5
    });
  }

  /** Acquire a pool for a given archetype */
  _poolFor(type = 'runner') {
    return this.pools.get(type) || this.pools.get('runner');
  }

  /**
   * Spawn an enemy of a specific archetype at a given world position
   * @param {THREE.Vector3} position
   * @param {string} [type='runner'] 'brute' | 'runner' | 'drone' | 'specter'
   */
  spawn(position = new Vector3(), type = 'runner') {
    const pool = this._poolFor(type);
    if (this.active.length >= MAX_ACTIVE_ENEMIES) {
      const oldest = this.active.shift();
      this._poolFor(oldest.type).release(oldest);
    }

    const enemy = pool.acquire();
    const archetype = ENEMY_ARCHETYPES[type] || ENEMY_ARCHETYPES.runner;
    const initialY = archetype.category === 'flying' ? archetype.altitude : 0;

    enemy.position.set(position.x, initialY, position.z);
    enemy.visible = true;
    if (enemy.parent !== this.group) {
      this.group.add(enemy);
    }

    // Apply GLB/GLTF model if loaded
    if (this.modelLoader.has(type) && !enemy.glbAnim) {
      enemy.glbAnim = this.modelLoader.applyTo(enemy);
    } else if (enemy.glbAnim) {
      enemy.glbAnim.mixer.stopAllAction();
      enemy.glbAnim.play('idle');
    }

    this.active.push(enemy);
    return enemy;
  }

  /**
   * Spawns an enemy at a random 360° angle around the player at 15m+ distance.
   */
  spawnRandom(playerPos = new Vector3(), minDistance = 15, maxDistance = 24, type = null) {
    const chosenType = type || SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)];
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    const spawnPos = new Vector3(
      playerPos.x + Math.sin(angle) * distance,
      0,
      playerPos.z + Math.cos(angle) * distance
    );
    const enemy = this.spawn(spawnPos, chosenType);
    return { enemy, distance, position: spawnPos, type: chosenType, archetype: enemy.archetype };
  }

  /** Toggle auto spawning */
  toggleAutoSpawn() {
    this.autoSpawn = !this.autoSpawn;
    this.autoSpawnTimer = 1.0;
    return this.autoSpawn;
  }

  /** Update all active enemies, handle attacks, projectiles, and collisions */
  update(dt, playerPos, camera = null, aim = null, abilities = null, onPlayerDamage = null) {
    if (this.autoSpawn && playerPos && this.active.length < MAX_ACTIVE_ENEMIES) {
      this.autoSpawnTimer -= dt;
      if (this.autoSpawnTimer <= 0) {
        this.spawnRandom(playerPos, 15, 25);
        this.autoSpawnTimer = this.autoSpawnInterval;
      }
    }

    // 1. Age and decay spatial kill-zone memory
    for (let i = this.dangerZones.length - 1; i >= 0; i--) {
      this.dangerZones[i].age += dt;
      if (this.dangerZones[i].age >= this.dangerZones[i].life) {
        this.dangerZones.splice(i, 1);
      }
    }

    const aiContext = {
      aim,
      abilities,
      dangerZones: this.dangerZones
    };

    // 2. Update individual enemies & process enemy offensive attacks
    for (let i = this.active.length - 1; i >= 0; i--) {
      const enemy = this.active[i];
      enemy.update(dt, playerPos, camera, aiContext);

      if (enemy.isDead || enemy.health <= 0) {
        this.active.splice(i, 1);
        this._poolFor(enemy.type).release(enemy);
        continue;
      }

      // Decrement attack cooldown
      if (enemy.attackCooldownTimer > 0) {
        enemy.attackCooldownTimer -= dt;
      }

      // Offensive Attack Processing
      if (playerPos && onPlayerDamage && enemy.attackCooldownTimer <= 0) {
        const arch = enemy.archetype;
        const dX = enemy.position.x - playerPos.x;
        const dZ = enemy.position.z - playerPos.z;
        const flatDist = Math.sqrt(dX * dX + dZ * dZ);

        if (!enemy.isFlying && flatDist <= (arch.attackRange || 3.6)) {
          // Ground melee attack / slam
          enemy.attackCooldownTimer = arch.attackCooldown || 1.0;
          // Attack lunge toward player
          const lungeDir = new Vector3().subVectors(playerPos, enemy.position).setY(0).normalize();
          enemy.velocity.addScaledVector(lungeDir, 3.2);
          onPlayerDamage(arch.attackDamage || 20, enemy.position, arch.name);
        } else if (enemy.isFlying) {
          const dist3D = enemy.position.distanceTo(playerPos);
          if (dist3D <= (arch.attackRange || 24.0)) {
            // Aerial projectile shot
            enemy.attackCooldownTimer = arch.attackCooldown || 1.6;
            this.fireProjectile(enemy.position, playerPos, enemy.type, arch.projSpeed || 18, arch.attackDamage || 20);
          }
        }
      }
    }

    // 3. Update active enemy projectiles
    const playerTargetCenter = playerPos ? new Vector3(playerPos.x, 0.9, playerPos.z) : null;

    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const proj = this.activeProjectiles[i];
      proj.mesh.position.addScaledVector(proj.velocity, dt);
      proj.life -= dt;

      // Check collision with player (1.6m radius capsule)
      if (playerTargetCenter && proj.mesh.position.distanceTo(playerTargetCenter) < 1.6) {
        if (onPlayerDamage) {
          onPlayerDamage(proj.damage, proj.mesh.position, 'Energy Bolt');
        }
        this.projectilesGroup.remove(proj.mesh);
        this.activeProjectiles.splice(i, 1);
        continue;
      }

      // Remove expired or fallen into void
      if (proj.life <= 0 || proj.mesh.position.y < -0.8) {
        this.projectilesGroup.remove(proj.mesh);
        this.activeProjectiles.splice(i, 1);
      }
    }

    // 4. Enemy vs Player collision (push enemy out)
    if (playerPos) {
      const playerRadius = 0.65;
      for (const enemy of this.active) {
        if (enemy.isFlying) continue; // Flying enemies don't ground-collide
        const dist = enemy.position.distanceTo(playerPos);
        const minDist = enemy.radius + playerRadius;
        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const normal = new Vector3().subVectors(enemy.position, playerPos).setY(0).normalize();
          enemy.position.addScaledVector(normal, overlap);
        }
      }
    }

    // 5. Enemy vs Enemy soft separation
    for (let i = 0; i < this.active.length; i++) {
      const eA = this.active[i];
      for (let j = i + 1; j < this.active.length; j++) {
        const eB = this.active[j];
        const dist = eA.position.distanceTo(eB.position);
        const minDist = eA.radius + eB.radius;
        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) * 0.5;
          const normal = new Vector3().subVectors(eA.position, eB.position).setY(0).normalize();
          eA.position.addScaledVector(normal, overlap);
          eB.position.addScaledVector(normal, -overlap);
        }
      }
    }
  }

  /**
   * Check dynamic collisions between active player abilities and enemies.
   * Uses capsule line-segment collision along the entire travel path + AoE blast zones.
   * @param {Array<import('../abilities/Ability.js').Ability>} abilities
   * @param {object} ctx { bursts, shake, hud }
   */
  checkCombat(abilities = [], ctx = {}) {
    if (!abilities || abilities.length === 0 || this.active.length === 0) return;

    const now = performance.now() * 0.001;

    for (const ability of abilities) {
      if (!ability.isActive) continue;

      if (!ability._hitTimestamps) {
        ability._hitTimestamps = new Map();
      }

      // 1. Dynamic Travel Corridor (Capsule Collision along the spell path)
      if (ability.phase === 'travel') {
        const segA = ability.origin;
        const segB = ability.position;
        // Corridor width: spell radius (2.4m) + enemy radius
        const corridorRadius = 2.4;

        for (let i = this.active.length - 1; i >= 0; i--) {
          const enemy = this.active[i];
          const enemyKey = enemy.id || i;
          const lastHit = ability._hitTimestamps.get(enemyKey) || 0;
          if (now - lastHit < 0.4) continue; // Cooldown between ticks

          const dist = this._distToSegment(enemy.position, segA, segB);
          if (dist <= corridorRadius + enemy.radius) {
            ability._hitTimestamps.set(enemyKey, now);
            const isDead = enemy.takeDamage(45, segB, 7.5);
            ctx.sound?.playHitImpact(enemy.position, 45);

            // Hit feedback
            ctx.bursts?.spawn(0, enemy.position.clone().setY(1.0), {
              radius: 0.4,
              endRadius: 2.2,
              life: 0.35,
              intensity: 3.0
            });
            ctx.shake?.add(0.2, 0.45, 12);

            if (isDead) {
              this._onEnemyDefeated(enemy, i, ctx);
            }
          }
        }
      }

      // 2. Continuous / Sustained Beam & Zone hits (Nova Beam, Glacial Crown, Voltaic Snare)
      if (ability.element === 'beam' || ability.element === 'snare' || ability.element === 'glacier') {
        const segA = ability.origin;
        const endPos = new Vector3().copy(ability.origin).addScaledVector(ability.direction, ability.length);
        const beamWidth = 3.2;

        for (let i = this.active.length - 1; i >= 0; i--) {
          const enemy = this.active[i];
          const enemyKey = enemy.id || i;
          const lastHit = ability._hitTimestamps.get(enemyKey) || 0;
          if (now - lastHit < 0.35) continue;

          // Check line corridor for beam, or circular zone for ground rings
          let inRange = false;
          if (ability.element === 'beam') {
            const dist = this._distToSegment(enemy.position, segA, endPos);
            inRange = dist <= beamWidth + enemy.radius;
          } else {
            const zoneRadius = ability.config?.zoneRadius || 6.5;
            const dist = enemy.position.distanceTo(ability.position);
            inRange = dist <= zoneRadius + enemy.radius;
          }

          if (inRange) {
            ability._hitTimestamps.set(enemyKey, now);
            const isDead = enemy.takeDamage(35, ability.position, 6.0);
            ctx.sound?.playHitImpact(enemy.position, 35);

            ctx.bursts?.spawn(0, enemy.position.clone().setY(1.0), {
              radius: 0.35,
              endRadius: 2.0,
              life: 0.3,
              intensity: 2.5
            });

            if (isDead) {
              this._onEnemyDefeated(enemy, i, ctx);
            }
          }
        }
      }

      // 3. AoE Explosion / Impact Phase (Generous 6.5m - 8.5m Blast Radius)
      if (ability.phase === 'impact' && ability.impactTime < 0.25) {
        const blastRadius = (ability.config?.zoneRadius || ability.config?.impactRadius || 5.5) * 1.35;
        for (let i = this.active.length - 1; i >= 0; i--) {
          const enemy = this.active[i];
          const enemyKey = enemy.id || i;
          const lastHit = ability._hitTimestamps.get(enemyKey) || 0;
          if (now - lastHit < 0.5) continue;

          const dist = enemy.position.distanceTo(ability.position);
          if (dist <= blastRadius + enemy.radius) {
            ability._hitTimestamps.set(enemyKey, now);
            const damage = Math.round(85 * Math.max(0.45, 1 - dist / (blastRadius + 2)));
            const isDead = enemy.takeDamage(damage, ability.position, 11.0);
            ctx.sound?.playHitImpact(enemy.position, damage);

            ctx.bursts?.spawn(0, enemy.position.clone().setY(1.0), {
              radius: 0.5,
              endRadius: 3.2,
              life: 0.45,
              intensity: 3.5
            });
            ctx.shake?.add(0.35, 0.7, 14);

            if (isDead) {
              this._onEnemyDefeated(enemy, i, ctx);
            }
          }
        }
      }
    }
  }

  /**
   * Helper: Perpendicular flat distance from point P to line segment AB on XZ plane.
   */
  _distToSegment(p, a, b) {
    const abX = b.x - a.x;
    const abZ = b.z - a.z;
    const abLenSq = abX * abX + abZ * abZ;

    if (abLenSq < 1e-4) {
      const dx = p.x - a.x;
      const dz = p.z - a.z;
      return Math.sqrt(dx * dx + dz * dz);
    }

    const apX = p.x - a.x;
    const apZ = p.z - a.z;
    const t = Math.max(0, Math.min(1, (apX * abX + apZ * abZ) / abLenSq));

    const projX = a.x + t * abX;
    const projZ = a.z + t * abZ;

    const dx = p.x - projX;
    const dz = p.z - projZ;
    return Math.sqrt(dx * dx + dz * dz);
  }

  _onEnemyDefeated(enemy, index, ctx) {
    this.addDangerZone(enemy.position);
    ctx.sound?.playEnemyDefeat(enemy.type, enemy.position);
    ctx.bursts?.spawn(0, enemy.position.clone().setY(enemy.isFlying ? enemy.position.y : 1.0), {
      radius: 0.7,
      endRadius: 4.5,
      life: 0.85,
      intensity: 4.5
    });
    ctx.shake?.add(0.45, 0.9, 15);
    ctx.hud?.showToast(`💥 ${enemy.archetype?.name || 'Enemy'} Defeated!`);
    this.active.splice(index, 1);
    this._poolFor(enemy.type).release(enemy);
  }

  clear() {
    for (const e of this.active) {
      this._poolFor(e.type).release(e);
    }
    this.active.length = 0;
  }

  dispose() {
    this.clear();
    for (const pool of this.pools.values()) pool.dispose();
    this.group.parent?.remove(this.group);
  }
}
