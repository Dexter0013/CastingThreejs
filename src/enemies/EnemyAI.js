// src/enemies/EnemyAI.js
import { Vector3, MathUtils } from 'three';

/**
 * =========================================================================
 * AI CONFIGURATION PANEL
 * All parameters to tune AI power, reflexes, spatial memory, and tactics
 * are consolidated in this single object.
 * =========================================================================
 */
export const AI_CONFIG = {
  // Master difficulty & power multiplier (0.0 = passive zombie, 1.0 = balanced, 2.0 = master tactician)
  power: 1.3,

  // Base Chase & Wander
  speed: 2.6,
  chaseRange: 34,

  // 1. Predictive Aim & Skillshot Dodging
  dodgeEnabled: true,
  dodgeReactionChance: 0.75, // 75% chance to react and attempt dodging
  dodgeForce: 4.8,           // Lateral strafe impulse speed (m/s)
  dodgeCorridorWidth: 3.8,   // Trajectory danger corridor width (meters)
  dodgeCooldown: 0.75,       // Cooldown between dodge leaps (seconds)

  // 2. Spatial Kill-Zone Memory (Danger Heatmap)
  dangerMemoryEnabled: true,
  dangerAvoidanceForce: 3.8, // Repulsion force pushing away from past kill zones
  dangerRadius: 6.5,         // Radius around past kill spots to avoid (meters)
  dangerDecayTime: 12.0,     // Time memory of a kill-zone persists (seconds)

  // 3. Dynamic Flanking & Surrounding Tactics
  flankEnabled: true,
  flankSpreadAngle: 0.7,     // Lateral angle spread so enemies surround rather than line up
  flankDistance: 8.5         // Distance at which enemies fan out to flank
};

const _toPlayer = new Vector3();
const _moveDir = new Vector3();
const _avoidDir = new Vector3();
const _dodgeDir = new Vector3();
const _perp = new Vector3();

export class EnemyAI {
  /** @param {THREE.Group} enemy */
  constructor(enemy) {
    this.enemy = enemy;
    this.state = 'wander'; // wander | chase
    this.wanderTimer = 0;
    this.dodgeCooldownTimer = 0;
    this.direction = new Vector3(0, 0, 1);
    this.isMoving = false;
    this.isAttacking = false;

    // Unique lateral flank bias (-1.0 to +1.0) so enemies don't queue in single file
    this.flankBias = (Math.random() - 0.5) * 2.0;
  }

  reset() {
    this.state = 'wander';
    this.wanderTimer = 0;
    this.dodgeCooldownTimer = 0;
    this.direction.set(0, 0, 1);
    this.isMoving = false;
    this.isAttacking = false;
    this.flankBias = (Math.random() - 0.5) * 2.0;
  }

  /**
   * Main AI Update Loop
   * @param {number} dt seconds
   * @param {THREE.Vector3} playerPos
   * @param {object} [context] { aim, abilities, dangerZones }
   */
  update(dt, playerPos, context = {}) {
    if (!playerPos) return;

    if (this.dodgeCooldownTimer > 0) {
      this.dodgeCooldownTimer -= dt;
    }

    _toPlayer.subVectors(playerPos, this.enemy.position);
    _toPlayer.y = 0; // Flat distance on XZ plane
    const distance = _toPlayer.length();

    // 1. Switch states based on distance
    if (distance < AI_CONFIG.chaseRange) {
      this.state = 'chase';
    } else {
      this.state = 'wander';
    }

    // 2. Compute Base Steering Direction
    if (this.state === 'chase') {
      if (distance > 0.05) {
        _moveDir.copy(_toPlayer).normalize();
      }

      // Flanking: fan out when in medium range to surround the player
      if (AI_CONFIG.flankEnabled && AI_CONFIG.power > 0 && distance < AI_CONFIG.flankDistance && distance > 2.2) {
        const flankAngle = this.flankBias * AI_CONFIG.flankSpreadAngle * AI_CONFIG.power;
        _moveDir.applyAxisAngle(new Vector3(0, 1, 0), flankAngle);
      }

      this.direction.copy(_moveDir);
    } else if (this.state === 'wander') {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        this.direction.set(Math.sin(angle), 0, Math.cos(angle));
        this.wanderTimer = 2.5 + Math.random() * 2.5;
      }
    }

    // 3. Spatial Kill-Zone Memory Avoidance (Repulsion from past death locations)
    if (AI_CONFIG.dangerMemoryEnabled && AI_CONFIG.power > 0 && context.dangerZones && context.dangerZones.length > 0) {
      _avoidDir.set(0, 0, 0);
      for (const zone of context.dangerZones) {
        const dX = this.enemy.position.x - zone.position.x;
        const dZ = this.enemy.position.z - zone.position.z;
        const distSq = dX * dX + dZ * dZ;
        const radius = AI_CONFIG.dangerRadius;

        if (distSq < radius * radius && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const weight = (1.0 - dist / radius) * (1.0 - zone.age / zone.life);
          _avoidDir.x += (dX / dist) * weight;
          _avoidDir.z += (dZ / dist) * weight;
        }
      }

      if (_avoidDir.lengthSq() > 0.001) {
        _avoidDir.normalize();
        // Blend avoidance force into direction
        this.direction.addScaledVector(_avoidDir, AI_CONFIG.dangerAvoidanceForce * 0.4 * AI_CONFIG.power);
        this.direction.normalize();
      }
    }

    // 4. Predictive Aim & Skillshot Dodging (only flying units perform evasive dashes; ground units walk)
    if (this.enemy.isFlying && AI_CONFIG.dodgeEnabled && AI_CONFIG.power > 0 && this.dodgeCooldownTimer <= 0) {
      this._checkPredictiveDodging(context);
    }

    // 5. Check Attack Range vs Movement
    const attackRange = this.enemy.archetype?.attackRange || 3.0;
    if (this.state === 'chase' && distance <= attackRange) {
      this.isMoving = false;
      this.isAttacking = true;
    } else {
      this.isMoving = true;
      this.isAttacking = false;
    }

    // 6. Apply Movement Step (scaled by archetype speed)
    if (this.isMoving) {
      const baseArchetypeSpeed = this.enemy.archetype?.speed || AI_CONFIG.speed;
      const currentSpeed = (this.state === 'chase' ? baseArchetypeSpeed : baseArchetypeSpeed * 0.45) * (0.5 + 0.5 * AI_CONFIG.power);
      this.enemy.position.addScaledVector(this.direction, currentSpeed * dt);
    }

    // 6. Smooth Facing Rotation & Aerial Banking
    if (this.direction.lengthSq() > 0.001) {
      const targetYaw = Math.atan2(this.direction.x, this.direction.z);
      const currentYaw = this.enemy.rotation.y;
      const delta = MathUtils.euclideanModulo(targetYaw - currentYaw + Math.PI, Math.PI * 2) - Math.PI;
      this.enemy.rotation.y = currentYaw + delta * Math.min(1, dt * (5.0 + 3.0 * AI_CONFIG.power));

      // Aerial banking into turns
      if (this.enemy.isFlying) {
        const targetRoll = MathUtils.clamp(-delta * 2.0, -0.6, 0.6);
        this.enemy.rotation.z += (targetRoll - this.enemy.rotation.z) * Math.min(1, dt * 6.0);
      } else {
        this.enemy.rotation.z = 0;
      }
    }

    // 7. Ground vs Flying Elevation
    if (this.enemy.isFlying) {
      const baseAlt = this.enemy.archetype?.altitude || 3.2;
      const targetAlt = baseAlt + Math.sin((this.enemy.flightTime || 0) * 2.5) * 0.45;
      this.enemy.position.y += (targetAlt - this.enemy.position.y) * Math.min(1, dt * 4.0);
    } else {
      this.enemy.position.y = 0;
    }
  }

  /**
   * Predictive dodge calculation when player aims or casts in enemy's path
   */
  _checkPredictiveDodging(context) {
    // A. Check incoming traveling skillshot
    if (context.abilities && context.abilities.length > 0) {
      for (const ability of context.abilities) {
        if (!ability.isActive || ability.phase !== 'travel') continue;

        const distToHead = this.enemy.position.distanceTo(ability.position);
        if (distToHead < 8.0) {
          // Distance from enemy to trajectory ray
          const distToLine = this._distToRay(this.enemy.position, ability.origin, ability.direction);
          if (distToLine < AI_CONFIG.dodgeCorridorWidth) {
            this._performDodge(ability.origin, ability.direction);
            return;
          }
        }
      }
    }

    // B. Check player active aim indicator
    if (context.aim && context.aim.armed) {
      const distToAimLine = this._distToRay(this.enemy.position, context.aim.origin, context.aim.direction);
      const distFromOrigin = this.enemy.position.distanceTo(context.aim.origin);

      if (distFromOrigin < (context.aim.distance || 18) && distToAimLine < AI_CONFIG.dodgeCorridorWidth * 0.85) {
        // Roll chance to react
        if (Math.random() < AI_CONFIG.dodgeReactionChance * AI_CONFIG.power) {
          this._performDodge(context.aim.origin, context.aim.direction);
        }
      }
    }
  }

  /**
   * Execute lateral dodge impulse
   */
  _performDodge(rayOrigin, rayDir) {
    this.dodgeCooldownTimer = AI_CONFIG.dodgeCooldown / Math.max(0.2, AI_CONFIG.power);

    // Compute perpendicular vector to the ray on XZ plane
    _perp.set(-rayDir.z, 0, rayDir.x).normalize();

    // Pick whichever lateral side is closer to escape
    const sideDot = (this.enemy.position.x - rayOrigin.x) * _perp.x + (this.enemy.position.z - rayOrigin.z) * _perp.z;
    const sign = sideDot >= 0 ? 1 : -1;

    _dodgeDir.copy(_perp).multiplyScalar(sign);
    this.enemy.velocity.addScaledVector(_dodgeDir, AI_CONFIG.dodgeForce * AI_CONFIG.power);
  }

  _distToRay(p, rayOrigin, rayDir) {
    const vX = p.x - rayOrigin.x;
    const vZ = p.z - rayOrigin.z;
    const proj = vX * rayDir.x + vZ * rayDir.z;
    if (proj < 0) return Math.sqrt(vX * vX + vZ * vZ);

    const closeX = rayOrigin.x + rayDir.x * proj;
    const closeZ = rayOrigin.z + rayDir.z * proj;
    const dX = p.x - closeX;
    const dZ = p.z - closeZ;
    return Math.sqrt(dX * dX + dZ * dZ);
  }
}


