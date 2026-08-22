// src/enemies/Enemy.js
import {
  Group,
  BoxGeometry,
  OctahedronGeometry,
  ConeGeometry,
  TorusGeometry,
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
const HIT_EMISSIVE = new Color(1.0, 0.95, 0.95);

/**
 * Archetype Definitions: Stats, Dimensions, and Visual Profiles
 */
export const ENEMY_ARCHETYPES = {
  // Ground Types
  brute: {
    name: 'Brute Golem',
    category: 'ground',
    maxHealth: 220,
    speed: 2.1,
    knockbackResistance: 0.4,
    radius: 1.6,
    height: 2.4,
    altitude: 0,
    attackRange: 3.8,
    attackCooldown: 1.2,
    attackDamage: 35,
    attackType: 'Heavy Slam',
    color: new Color(0.85, 0.12, 0.12),
    accentColor: new Color(1.0, 0.6, 0.1),
    emissive: new Color(0.3, 0.04, 0.02)
  },
  runner: {
    name: 'Runner Skirmisher',
    category: 'ground',
    maxHealth: 80,
    speed: 4.0,
    knockbackResistance: 1.1,
    radius: 1.2,
    height: 1.7,
    altitude: 0,
    attackRange: 3.4,
    attackCooldown: 0.85,
    attackDamage: 18,
    attackType: 'Cyber Strike',
    color: new Color(0.9, 0.35, 0.1),
    accentColor: new Color(0.2, 0.9, 1.0),
    emissive: new Color(0.25, 0.08, 0.02)
  },
  // Flying Types
  drone: {
    name: 'Aerial Drone',
    category: 'flying',
    maxHealth: 90,
    speed: 3.4,
    knockbackResistance: 0.85,
    radius: 1.35,
    height: 1.4,
    altitude: 3.2,
    attackRange: 22.0,
    attackCooldown: 1.5,
    attackDamage: 20,
    attackType: 'Plasma Bolt',
    projSpeed: 18.0,
    color: new Color(0.15, 0.7, 0.9),
    accentColor: new Color(0.3, 1.0, 0.8),
    emissive: new Color(0.04, 0.2, 0.25)
  },
  specter: {
    name: 'Sky Specter',
    category: 'flying',
    maxHealth: 110,
    speed: 3.8,
    knockbackResistance: 0.8,
    radius: 1.4,
    height: 1.5,
    altitude: 4.4,
    attackRange: 24.0,
    attackCooldown: 1.6,
    attackDamage: 26,
    attackType: 'Astral Shock',
    projSpeed: 20.0,
    color: new Color(0.65, 0.18, 0.85),
    accentColor: new Color(1.0, 0.3, 0.9),
    emissive: new Color(0.2, 0.04, 0.28)
  }
};

export class Enemy extends Group {
  constructor(type = 'runner') {
    super();
    this.type = type;
    this.name = `Enemy:${type}`;

    const archetype = ENEMY_ARCHETYPES[type] || ENEMY_ARCHETYPES.runner;
    this.archetype = archetype;
    this.isFlying = archetype.category === 'flying';

    // Stats & Hitboxes
    this.radius = archetype.radius;
    this.height = archetype.height;
    this.maxHealth = archetype.maxHealth;
    this.health = this.maxHealth;
    this.isDead = false;

    // Physics & Hit Reactions
    this.velocity = new Vector3();
    this.hitFlashTimer = 0;
    this.flightTime = Math.random() * 10;
    this.attackCooldownTimer = 0.2; // Immediate first strike ready

    // Build procedural 3D visual hierarchy based on archetype
    this.visualRoot = new Group();
    this.add(this.visualRoot);

    this.bodyMaterial = new MeshStandardMaterial({
      color: archetype.color,
      roughness: 0.32,
      metalness: 0.22,
      emissive: archetype.emissive.clone()
    });

    this.accentMaterial = new MeshBasicMaterial({
      color: archetype.accentColor
    });

    this._buildMesh(type);

    // Floating 3D Health Bar
    this.healthBarGroup = new Group();
    const barHeight = this.isFlying ? this.height * 0.7 + 0.5 : this.height + 0.35;
    this.healthBarGroup.position.set(0, barHeight, 0);

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

  _buildMesh(type) {
    if (type === 'brute') {
      // Massive armored monolith with heavy shoulder pauldrons
      const bodyGeo = new BoxGeometry(1.5, 2.4, 1.5);
      const body = new Mesh(bodyGeo, this.bodyMaterial);
      body.position.y = 1.2;
      body.castShadow = true;
      body.receiveShadow = true;
      this.visualRoot.add(body);

      // Pauldrons
      const pauldronGeo = new BoxGeometry(1.9, 0.5, 1.7);
      const pauldron = new Mesh(pauldronGeo, this.bodyMaterial);
      pauldron.position.y = 2.0;
      pauldron.castShadow = true;
      this.visualRoot.add(pauldron);

      // Glowing magma visor
      const visorGeo = new BoxGeometry(0.9, 0.25, 0.3);
      const visor = new Mesh(visorGeo, this.accentMaterial);
      visor.position.set(0, 1.85, 0.8);
      this.visualRoot.add(visor);

    } else if (type === 'runner') {
      // Slender agile scout with angled back wings
      const bodyGeo = new BoxGeometry(0.9, 1.7, 0.9);
      const body = new Mesh(bodyGeo, this.bodyMaterial);
      body.position.y = 0.85;
      body.castShadow = true;
      body.receiveShadow = true;
      this.visualRoot.add(body);

      // Cyber Visor
      const visorGeo = new BoxGeometry(0.65, 0.2, 0.25);
      const visor = new Mesh(visorGeo, this.accentMaterial);
      visor.position.set(0, 1.35, 0.5);
      this.visualRoot.add(visor);

    } else if (type === 'drone') {
      // Floating Octahedral Core + Spinning Torus Ring
      const coreGeo = new OctahedronGeometry(0.85, 0);
      const core = new Mesh(coreGeo, this.bodyMaterial);
      core.castShadow = true;
      this.visualRoot.add(core);

      const ringGeo = new TorusGeometry(1.25, 0.08, 8, 24);
      this.ringMesh = new Mesh(ringGeo, this.accentMaterial);
      this.ringMesh.rotation.x = Math.PI / 2;
      this.visualRoot.add(this.ringMesh);

    } else if (type === 'specter') {
      // Winged Aerial Shard (Cone Chassis + Lateral Fin Wings)
      const shardGeo = new ConeGeometry(0.7, 1.8, 4);
      const shard = new Mesh(shardGeo, this.bodyMaterial);
      shard.rotation.x = Math.PI / 2; // Point forward
      shard.castShadow = true;
      this.visualRoot.add(shard);

      const wingGeo = new BoxGeometry(2.4, 0.08, 0.8);
      const wings = new Mesh(wingGeo, this.accentMaterial);
      wings.position.set(0, 0, -0.2);
      this.visualRoot.add(wings);
    }
  }

  /**
   * Apply damage and knockback from an impact point.
   */
  takeDamage(amount, impactOrigin = null, knockbackForce = 5.0) {
    if (this.isDead) return true;

    this.health = Math.max(0, this.health - amount);
    this.hitFlashTimer = 0.16;
    this.bodyMaterial.emissive.copy(HIT_EMISSIVE);

    // Update health bar fill & color
    this.updateHealthBar();

    // Apply knockback (weighted by archetype resistance)
    if (impactOrigin) {
      _knockbackDir.subVectors(this.position, impactOrigin);
      if (!this.isFlying) _knockbackDir.y = 0;
      if (_knockbackDir.lengthSq() < 1e-4) {
        _knockbackDir.set(Math.random() - 0.5, this.isFlying ? 0.2 : 0, Math.random() - 0.5);
      }
      _knockbackDir.normalize();
      const impulse = knockbackForce * this.archetype.knockbackResistance;
      this.velocity.addScaledVector(_knockbackDir, impulse);
    }

    if (this.health <= 0) {
      this.isDead = true;
      return true;
    }
    return false;
  }

  /** Update 3D health bar visual fill and color */
  updateHealthBar() {
    const pct = Math.max(0, Math.min(1, this.health / Math.max(1, this.maxHealth)));
    this.fillMesh.scale.x = Math.max(0.001, pct);
    if (pct < 0.3) {
      this.fillMaterial.color.setHex(0xff2222);
    } else if (pct < 0.6) {
      this.fillMaterial.color.setHex(0xffaa22);
    } else {
      this.fillMaterial.color.setHex(0x33ee55);
    }
  }

  /**
   * Update each frame
   */
  update(dt, playerPos, camera = null, context = {}) {
    this.flightTime += dt;

    // Hit flash decay
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) {
        this.bodyMaterial.emissive.copy(this.archetype.emissive);
      } else {
        const t = this.hitFlashTimer / 0.16;
        this.bodyMaterial.emissive.lerpColors(this.archetype.emissive, HIT_EMISSIVE, t);
      }
    }

    // Knockback velocity physics with fast damping
    if (this.velocity.lengthSq() > 0.01) {
      this.position.addScaledVector(this.velocity, dt);
      this.velocity.multiplyScalar(Math.pow(0.05, dt));
    } else {
      this.velocity.set(0, 0, 0);
    }

    // Drone rotor animation
    if (this.ringMesh) {
      this.ringMesh.rotation.z += dt * 4.0;
    }

    // AI steering
    this.ai.update(dt, playerPos, context);

    // Billboarding health bar directly to camera (accounting for parent rotation)
    if (camera) {
      this.healthBarGroup.quaternion.copy(this.quaternion).invert().multiply(camera.quaternion);
    }
  }

  /** Reset internal state when recycled to pool */
  reset() {
    this.position.set(0, this.isFlying ? this.archetype.altitude : 0, 0);
    this.rotation.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.isDead = false;
    this.hitFlashTimer = 0;
    this.attackCooldownTimer = 0.2;
    this.bodyMaterial.emissive.copy(this.archetype.emissive);
    this.updateHealthBar();
    this.ai.reset();
  }
}


