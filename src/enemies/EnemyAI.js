// src/enemies/EnemyAI.js
import { Vector3, MathUtils } from 'three';

const _toPlayer = new Vector3();

export class EnemyAI {
  /** @param {THREE.Group} enemy */
  constructor(enemy) {
    this.enemy = enemy;
    this.state = 'wander'; // wander | chase
    this.wanderTimer = 0;
    this.speed = 2.5; // units per second
    this.chaseRange = 30; // start chasing when player is within this distance
    this.direction = new Vector3(0, 0, 1);
  }

  reset() {
    this.state = 'wander';
    this.wanderTimer = 0;
    this.direction.set(0, 0, 1);
  }

  /** @param {number} dt seconds */
  /** @param {THREE.Vector3} playerPos */
  update(dt, playerPos) {
    if (!playerPos) return;

    _toPlayer.subVectors(playerPos, this.enemy.position);
    _toPlayer.y = 0; // Flat distance on XZ plane
    const distance = _toPlayer.length();

    // Switch states based on distance
    if (distance < this.chaseRange && distance > 0.8) {
      this.state = 'chase';
    } else {
      this.state = 'wander';
    }

    if (this.state === 'chase' && distance > 0.8) {
      _toPlayer.normalize();
      this.direction.copy(_toPlayer);
      this.enemy.position.addScaledVector(this.direction, this.speed * dt);
    } else if (this.state === 'wander') {
      // Wander: change direction every ~3-5 seconds
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        this.direction.set(Math.sin(angle), 0, Math.cos(angle));
        this.wanderTimer = 2.5 + Math.random() * 2.5;
      }
      this.enemy.position.addScaledVector(this.direction, this.speed * 0.4 * dt);
    }

    // Orient enemy towards movement direction
    if (this.direction.lengthSq() > 0.001) {
      const targetYaw = Math.atan2(this.direction.x, this.direction.z);
      // Smoothly rotate towards heading
      const currentYaw = this.enemy.rotation.y;
      const delta = MathUtils.euclideanModulo(targetYaw - currentYaw + Math.PI, Math.PI * 2) - Math.PI;
      this.enemy.rotation.y = currentYaw + delta * Math.min(1, dt * 6);
    }

    // Keep enemy grounded
    this.enemy.position.y = 0;
  }
}

