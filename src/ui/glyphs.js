/**
 * Ability sigils for the HUD — drawn inline so they inherit `currentColor` (the
 * slot's `--accent`) and need no image assets.
 *
 * A 100×100 box, stroke only, so the mark reads the same at 34px in the ability
 * slot as it does scaled up.
 */

const WRAP = (body) =>
  `<svg class="glyph-svg" viewBox="0 0 100 100" aria-hidden="true" fill="none"
     stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/**
 * Ice — a six-fold snowflake over a rising lance.
 *
 * Three axes at 60°, each with a pair of barbs, and a heavier vertical that runs
 * past the star into a point: the star says frost, the point says skillshot.
 */
const ICE = WRAP(`
  <path d="M50 12V88"/>
  <path d="M17.5 30.5L82.5 69.5"/>
  <path d="M82.5 30.5L17.5 69.5"/>
  <path d="M50 24L41 33M50 24L59 33"/>
  <path d="M50 76L41 67M50 76L59 67"/>
  <path d="M27.5 36.5L27.7 49.2M27.5 36.5L38.5 30.4"/>
  <path d="M72.5 63.5L72.3 50.8M72.5 63.5L61.5 69.6"/>
  <path d="M72.5 36.5L72.3 49.2M72.5 36.5L61.5 30.4"/>
  <path d="M27.5 63.5L27.7 50.8M27.5 63.5L38.5 69.6"/>
`);

/**
 * Thunder — a bolt struck through a pair of arcs.
 *
 * The zigzag is drawn on the same diagonal the cast travels on, and the two
 * open arcs behind it read as the discharge spreading off it. Stroke only, like
 * the snowflake, so the two slots sit at the same visual weight.
 */
const THUNDER = WRAP(`
  <path d="M60 10L30 52H49L40 90L72 45H52L60 10Z"/>
  <path d="M23 26C13 36 11 52 17 65"/>
  <path d="M84 34C90 47 88 63 78 73"/>
`);

/** Keyed by the ids in `ELEMENTS`. */
export const ELEMENT_SIGILS = { ice: ICE, thunder: THUNDER };
