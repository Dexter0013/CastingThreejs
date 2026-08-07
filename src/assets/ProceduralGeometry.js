import {
  BufferGeometry,
  BufferAttribute,
  Float32BufferAttribute,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Sphere,
  Vector3
} from 'three';
import { hash11 } from '../utils/math.js';

/**
 * CPU-side procedural geometry.
 *
 * The project ships no mesh assets beyond the character, so the ice crystals are
 * generated here. A crystal is cheap enough to rebuild — a six-sided one is 108
 * triangles — that the *shape* sliders in the editor regenerate it outright
 * instead of approximating themselves in a vertex shader. That is what lets the
 * facet count, the taper and the surface roughness stay live controls, including
 * while the simulation is paused.
 *
 * Everything is deterministic in `seed`: the same seed always yields the same
 * crystal, so a rebuild mid-cast reshapes the field without reshuffling it.
 */

const TAU = Math.PI * 2;

/**
 * Height / radius profile of a crystal, sampled at the ring heights below.
 * `t` is the fraction of the way to the tip; the returned radius is a fraction
 * of the base radius.
 */
const RING_HEIGHTS = [0, 0.22, 0.5, 0.75, 0.92];

function profileRadius(t, taper) {
  return taper + (1 - taper) * Math.pow(1 - t, 1.15);
}

/**
 * A single ice crystal: a tapered, faceted, slightly bent prism.
 *
 * Unit space — base ring on y = 0 with a circumscribed radius of 0.5, apex at
 * y = 1. An instance therefore scales footprint and height independently, and
 * `local.y` reads straight off as "how far up this crystal am I", which is what
 * the rime banding in `materials/IceMaterial.js` keys off.
 *
 * @param {object} options
 * @param {number} [options.seed]      deterministic shape seed
 * @param {number} [options.sides]     facet count around the prism (5–8 read best)
 * @param {number} [options.taper]     tip radius as a fraction of the base
 * @param {number} [options.roughness] how far facets are pushed off a clean prism
 * @param {number} [options.bend]      sideways curve from base to tip
 */
export function createCrystalGeometry({
  seed = 1,
  sides = 6,
  taper = 0.13,
  roughness = 0.28,
  bend = 0.22
} = {}) {
  const facets = Math.max(3, Math.round(sides));
  const tipRadius = Math.min(0.9, Math.max(0.01, taper));

  // One fixed bend direction per crystal, so a whole field leans convincingly
  // instead of every spike curving the same way.
  const bendAngle = hash11(seed * 1.77) * TAU;
  const bendX = Math.cos(bendAngle);
  const bendZ = Math.sin(bendAngle);

  /** Lateral drift of the crystal's axis at height `t`. */
  const axisOffset = (t) => bend * 0.5 * Math.pow(t, 1.6);

  // --- rings -------------------------------------------------------------
  // Angles are jittered once and shared by every ring, so the facets stay
  // continuous edges up the crystal rather than twisting into a screw.
  const angles = [];
  for (let i = 0; i < facets; i++) {
    const jitter = (hash11(seed * 3.13 + i * 7.7) - 0.5) * (TAU / facets) * 0.55 * roughness * 3;
    angles.push((i / facets) * TAU + jitter);
  }

  const rings = RING_HEIGHTS.map((t, ringIndex) => {
    const baseR = profileRadius(t, tipRadius) * 0.5;
    const drift = axisOffset(t);
    // Height wobble keeps the shoulder lines from stacking into clean bands.
    const y = t + (hash11(seed * 5.9 + ringIndex * 2.3) - 0.5) * 0.06 * roughness * (t > 0 ? 1 : 0);

    return angles.map((angle, i) => {
      // Irregularity grows toward the tip: a crystal is roughly round where it
      // leaves the ground and increasingly ragged where it was torn.
      const wobble = 1 + (hash11(seed * 11.1 + ringIndex * 13.7 + i * 3.9) - 0.5) * roughness * 1.3 * (0.35 + 0.65 * t);
      const r = Math.max(0.002, baseR * wobble);
      return [Math.cos(angle) * r + bendX * drift, y, Math.sin(angle) * r + bendZ * drift];
    });
  });

  // The apex is offset a little off-axis so the tip reads as chipped rather
  // than as the vertex of a cone.
  const apexDrift = axisOffset(1);
  const apex = [
    bendX * apexDrift + (hash11(seed * 17.3) - 0.5) * 0.09 * roughness,
    1,
    bendZ * apexDrift + (hash11(seed * 19.7) - 0.5) * 0.09 * roughness
  ];
  const floorCentre = [0, 0, 0];

  // --- triangles ---------------------------------------------------------
  const positions = [];
  const push = (p) => positions.push(p[0], p[1], p[2]);

  for (let ring = 0; ring < rings.length - 1; ring++) {
    const lower = rings[ring];
    const upper = rings[ring + 1];
    for (let i = 0; i < facets; i++) {
      const j = (i + 1) % facets;
      push(lower[i]); push(lower[j]); push(upper[i]);
      push(lower[j]); push(upper[j]); push(upper[i]);
    }
  }

  const top = rings[rings.length - 1];
  const base = rings[0];
  for (let i = 0; i < facets; i++) {
    const j = (i + 1) % facets;
    push(top[i]); push(top[j]); push(apex); // the point
    push(floorCentre); push(base[j]); push(base[i]); // the underside
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  // Non-indexed + per-face normals: this is what makes the facets crisp.
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A short, wide crystal shard — the ankle-height rubble that fills in around the
 * main spikes. Same unit space, so it instances through the identical path.
 */
export function createShardGeometry(seed = 5, sides = 5) {
  return createCrystalGeometry({
    seed: seed * 2.7 + 41,
    sides,
    taper: 0.22,
    roughness: 0.55,
    bend: 0.35
  });
}

/**
 * The strip a lightning filament is drawn on — a flat ladder of quads, in
 * *parameter* space rather than world space.
 *
 * Every vertex carries `position = (t, side, 0)`, where `t` runs 0 → 1 from the
 * caster's hand to the impact point and `side` is ±1 across the ribbon. There
 * are no metres in here at all: `materials/LightningMaterial.js` turns that pair
 * into a world position every frame, so one strip serves a bolt of any length,
 * any shape and any width, and the whole path stays a live slider.
 *
 * One instance is one filament, and `aStrand` is simply its index — the shader
 * derives the filament's seed, its place in the fan and its width from it.
 *
 * @param {number} nodes   samples along the bolt; the kink detail ceiling
 * @param {number} strands instance capacity (the live count is `instanceCount`)
 */
export function createBoltRibbonGeometry(nodes = 72, strands = 24) {
  const steps = Math.max(2, Math.round(nodes));
  const count = Math.max(1, Math.round(strands));

  const positions = new Float32Array(steps * 2 * 3);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const o = i * 6;
    positions[o + 0] = t;
    positions[o + 1] = -1;
    positions[o + 3] = t;
    positions[o + 4] = 1;
  }

  const indices = new Uint16Array((steps - 1) * 6);
  for (let i = 0; i < steps - 1; i++) {
    const a = i * 2;
    const o = i * 6;
    indices[o + 0] = a;
    indices[o + 1] = a + 1;
    indices[o + 2] = a + 2;
    indices[o + 3] = a + 1;
    indices[o + 4] = a + 3;
    indices[o + 5] = a + 2;
  }

  const strandIndex = new Float32Array(count);
  for (let i = 0; i < count; i++) strandIndex[i] = i;

  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aStrand', new InstancedBufferAttribute(strandIndex, 1));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.instanceCount = count;
  // The bolt is built in world space in the vertex shader, so the geometry's own
  // bounds are meaningless — cull it manually instead (the ability sets
  // `frustumCulled = false`).
  geometry.boundingSphere = new Sphere(new Vector3(), 1e4);
  return geometry;
}
