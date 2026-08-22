// src/enemies/EnemySystem.js
import { Group, Vector3 } from 'three';
import { ObjectPool } from '../utils/ObjectPool.js';
import { Enemy } from './Enemy.js';

/** Maximum simultaneous enemies; oldest is removed when cap is hit */
const MAX_ACTIVE_ENEMIES = 8;

export class EnemySystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new Group();
    this.group.name = 'Enemies';
    scene.add(this.group);

    this.active = [];
    this.pools = new Map(); // we only have one type now, but keep map for future extensions
    // Pre‑create a pool for the simple box enemy
    const pool = new ObjectPool(
      () => new Enemy(),
      (enemy) => {
        enemy.visible = false;
        this.group.remove(enemy);
        enemy.reset();
      }
    );
    this.pools.set('box', pool);

    this.autoSpawn = false;
    this.autoSpawnInterval = 4.0;
    this.autoSpawnTimer = 2.0;
  }

  /** Acquire a pool (currently only 'box') */
  _poolFor(type = 'box') {
    return this.pools.get(type);
  }

  /** Spawn an enemy at a given world position */
  spawn(position = new Vector3()) {
    const pool = this._poolFor();
    if (this.active.length >= MAX_ACTIVE_ENEMIES) {
      const oldest = this.active.shift();
      pool.release(oldest);
    }
    const enemy = pool.acquire();
    enemy.position.copy(position);
    enemy.visible = true;
    if (enemy.parent !== this.group) {
      this.group.add(enemy);
    }
    this.active.push(enemy);
    return enemy;
  }

  /**
   * Spawns an enemy at a random 360° angle around the player at 15m+ distance.
   * @param {THREE.Vector3} playerPos
   * @param {number} minDistance minimum distance in meters (default 15)
   * @param {number} maxDistance maximum distance in meters (default 24)
   */
  spawnRandom(playerPos = new Vector3(), minDistance = 15, maxDistance = 24) {
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    const spawnPos = new Vector3(
      playerPos.x + Math.sin(angle) * distance,
      0,
      playerPos.z + Math.cos(angle) * distance
    );
    const enemy = this.spawn(spawnPos);
    return { enemy, distance, position: spawnPos };
  }

  /** Toggle auto spawning */
  toggleAutoSpawn() {
    this.autoSpawn = !this.autoSpawn;
    this.autoSpawnTimer = 1.0;
    return this.autoSpawn;
  }

  /** Update all active enemies, handle collisions and auto-spawner */
  update(dt, playerPos, camera = null) {
    if (this.autoSpawn && playerPos && this.active.length < MAX_ACTIVE_ENEMIES) {
      this.autoSpawnTimer -= dt;
      if (this.autoSpawnTimer <= 0) {
        this.spawnRandom(playerPos, 15, 25);
        this.autoSpawnTimer = this.autoSpawnInterval;
      }
    }

    // 1. Update individual enemies
    for (let i = this.active.length - 1; i >= 0; i--) {
      const enemy = this.active[i];
      enemy.update(dt, playerPos, camera);
      if (enemy.isDead || enemy.health <= 0) {
        this.active.splice(i, 1);
        this._poolFor().release(enemy);
      }
    }

    // 2. Enemy vs Player collision (push enemy out)
    if (playerPos) {
      const playerRadius = 0.65;
      for (const enemy of this.active) {
        const dist = enemy.position.distanceTo(playerPos);
        const minDist = enemy.radius + playerRadius;
        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const normal = new Vector3().subVectors(enemy.position, playerPos).setY(0).normalize();
          enemy.position.addScaledVector(normal, overlap);
        }
      }
    }

    // 3. Enemy vs Enemy soft separation
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
    ctx.bursts?.spawn(0, enemy.position.clone().setY(1.0), {
      radius: 0.7,
      endRadius: 4.5,
      life: 0.85,
      intensity: 4.5
    });
    ctx.shake?.add(0.45, 0.9, 15);
    ctx.hud?.showToast('💥 Enemy Defeated!');
    this.active.splice(index, 1);
    this._poolFor().release(enemy);
  }

  clear() {
    for (const e of this.active) {
      this._poolFor().release(e);
    }
    this.active.length = 0;
  }

  dispose() {
    this.clear();
    for (const pool of this.pools.values()) pool.dispose();
    this.group.parent?.remove(this.group);
  }
}
