// src/enemies/Enemy.js
import {
  Group,
  BoxGeometry,
  PlaneGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Mesh,
  Color,
  Vector3,
  DoubleSide
} from 'three';
import { LAYER, setLayerRecursive } from '../core/Layers.js';
import { EnemyAI } from './EnemyAI.js';

const _knockbackDir = new Vector3();
const BASE_EMISSIVE = new Color(0.2, 0.02, 0.02);
const HIT_EMISSIVE = new Color(1.0, 0.9, 0.9);

export class Enemy extends Group {
  constructor() {
    super();
    this.name = 'Enemy';

    // Hitbox / Collider definition (generous radius for dynamic hit detection)
    this.radius = 1.35;
    this.height = 2.0;
    this.maxHealth = 100;
    this.health = 100;
    this.isDead = false;

    // Physics / Knockback
    this.velocity = new Vector3();
    this.hitFlashTimer = 0;

    // Main body box (width: 1.2, height: 2.0, depth: 1.2)
    const bodyGeometry = new BoxGeometry(1.2, 2.0, 1.2);
    this.bodyMaterial = new MeshStandardMaterial({
      color: new Color(0.88, 0.15, 0.15),
      roughness: 0.32,
      metalness: 0.18,
      emissive: BASE_EMISSIVE.clone()
    });
    this.bodyMesh = new Mesh(bodyGeometry, this.bodyMaterial);
    this.bodyMesh.position.y = 1.0; // Sit exactly on ground (y = 0 to 2.0)
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.add(this.bodyMesh);

    // Glowing eyes / visor
    const eyeGeometry = new BoxGeometry(0.7, 0.22, 0.22);
    const eyeMaterial = new MeshBasicMaterial({
      color: new Color(1.0, 0.85, 0.2)
    });
    this.eyeMesh = new Mesh(eyeGeometry, eyeMaterial);
    this.eyeMesh.position.set(0, 1.5, 0.62);
    this.add(this.eyeMesh);

    // Floating 3D Health Bar
    this.healthBarGroup = new Group();
    this.healthBarGroup.position.set(0, 2.35, 0);

    const bgGeo = new PlaneGeometry(1.5, 0.16);
    const bgMat = new MeshBasicMaterial({
      color: new Color(0.08, 0.1, 0.14),
      side: DoubleSide,
      depthTest: false
    });
    const bgMesh = new Mesh(bgGeo, bgMat);
    bgMesh.renderOrder = 30;
    this.healthBarGroup.add(bgMesh);

    const fillGeo = new PlaneGeometry(1.44, 0.1);
    fillGeo.translate(0.72, 0, 0);
    this.fillMaterial = new MeshBasicMaterial({
      color: new Color(0.2, 0.9, 0.3),
      side: DoubleSide,
      depthTest: false
    });
    this.fillMesh = new Mesh(fillGeo, this.fillMaterial);
    this.fillMesh.position.set(-0.72, 0, 0.01);
    this.fillMesh.renderOrder = 31;
    this.healthBarGroup.add(this.fillMesh);

    this.add(this.healthBarGroup);

    // Ensure all meshes are on LAYER.WORLD
    setLayerRecursive(this, LAYER.WORLD);

    this.ai = new EnemyAI(this);
  }

  /**
   * Apply damage and knockback from an impact point.
   * @param {number} amount damage to apply
   * @param {THREE.Vector3} [impactOrigin] source of the hit
   * @param {number} [knockbackForce=5.0] impulse force
   * @returns {boolean} true if dead
   */
  takeDamage(amount, impactOrigin = null, knockbackForce = 5.0) {
    if (this.isDead) return true;

    this.health = Math.max(0, this.health - amount);
    this.hitFlashTimer = 0.16;
    this.bodyMaterial.emissive.copy(HIT_EMISSIVE);

    // Update health bar fill & color
    const pct = this.health / this.maxHealth;
    this.fillMesh.scale.x = Math.max(0.001, pct);
    if (pct < 0.3) {
      this.fillMaterial.color.setHex(0xff3333); // Red
    } else if (pct < 0.6) {
      this.fillMaterial.color.setHex(0xffaa22); // Orange/Yellow
    } else {
      this.fillMaterial.color.setHex(0x33ee55); // Green
    }

    // Apply knockback
    if (impactOrigin) {
      _knockbackDir.subVectors(this.position, impactOrigin);
      _knockbackDir.y = 0;
      if (_knockbackDir.lengthSq() < 1e-4) {
        _knockbackDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      }
      _knockbackDir.normalize();
      this.velocity.addScaledVector(_knockbackDir, knockbackForce);
    }

    if (this.health <= 0) {
      this.isDead = true;
      return true;
    }
    return false;
  }

  /** Update each frame – dt in seconds, playerPos is a Vector3, camera for billboard */
  update(dt, playerPos, camera = null) {
    // Process hit flash decay
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) {
        this.bodyMaterial.emissive.copy(BASE_EMISSIVE);
      } else {
        const t = this.hitFlashTimer / 0.16;
        this.bodyMaterial.emissive.lerpColors(BASE_EMISSIVE, HIT_EMISSIVE, t);
      }
    }

    // Process knockback velocity with friction damping
    if (this.velocity.lengthSq() > 0.01) {
      this.position.addScaledVector(this.velocity, dt);
      this.velocity.multiplyScalar(Math.pow(0.04, dt)); // Fast decay
    } else {
      this.velocity.set(0, 0, 0);
    }

    // AI movement
    this.ai.update(dt, playerPos);

    // Make health bar face the camera
    if (camera) {
      this.healthBarGroup.quaternion.copy(camera.quaternion);
    }
  }

  /** Reset internal state when returned to the pool */
  reset() {
    this.position.set(0, 0, 0);
    this.rotation.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.isDead = false;
    this.hitFlashTimer = 0;
    this.bodyMaterial.emissive.copy(BASE_EMISSIVE);
    this.fillMesh.scale.x = 1.0;
    this.fillMaterial.color.setHex(0x33ee55);
    this.ai.reset();
  }
}

