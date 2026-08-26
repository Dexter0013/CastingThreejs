import { settings, ELEMENTS, CAST_ANIMATIONS, applySettings, DEFAULT_SETTINGS } from './settings.js';

const STORAGE_KEY_RANDOMIZE = 'frost-sandbox.randomizeOnReload';
const STORAGE_KEY_ACTIVE_THEME = 'frost-sandbox.activeTheme';

/**
 * Curated, visually stunning atmospheric environment themes.
 * Each theme defines harmonized directional/ambient/rim/hemisphere lighting,
 * atmospheric fog, ground & grass colors, and post-processing color grading.
 */
export const ENVIRONMENT_THEMES = {
  'Crimson Eclipse': {
    name: 'Crimson Eclipse',
    icon: '🌒',
    accent: '#ff4d29',
    description: 'Blood moon twilight with ominous crimson shadows and warm contrast',
    environment: {
      sunIntensity: 3.6,
      sunColor: '#ff4d29',
      sunAzimuth: 0.95,
      sunElevation: 0.45,
      ambientIntensity: 0.48,
      ambientColor: '#3a1520',
      hemiIntensity: 0.65,
      hemiSkyColor: '#ff2a55',
      hemiGroundColor: '#2b0d18',
      rimIntensity: 0.85,
      rimColor: '#ffaa66',
      rimAzimuth: 5.2,
      rimElevation: 0.3,
      envIntensity: 0.75,
      backgroundColor: '#15050a',
      fogEnabled: true,
      fogColor: '#200812',
      fogNear: 35,
      fogFar: 180,
      dustAmount: 1.2,
      floorColor: '#1c0d12',
      floorTint: '#38141e',
      floorRoughness: 0.9,
      floorSheen: 0.12,
      floorPool: 0.6,
      grassAmount: 0.85,
      grassColor: '#5c1d24',
      grassColorWarm: '#943828',
      grassColorDark: '#120508'
    },
    post: {
      exposure: 1.05,
      bloomStrength: 0.85,
      bloomRadius: 0.45,
      bloomThreshold: 0.75,
      contrast: 1.18,
      saturation: 1.35,
      temperature: 0.22,
      lift: -0.015,
      gain: 1.08,
      vignette: 0.55,
      chromaticAberration: 0.45,
      grain: 0.045
    }
  },

  'Midnight Arctic': {
    name: 'Midnight Arctic',
    icon: '❄️',
    accent: '#a8e8ff',
    description: 'Glacial sub-zero blizzard with pale cyan key and deep indigo fog',
    environment: {
      sunIntensity: 3.0,
      sunColor: '#a8e8ff',
      sunAzimuth: 1.2,
      sunElevation: 0.7,
      ambientIntensity: 0.55,
      ambientColor: '#0e1e2d',
      hemiIntensity: 0.7,
      hemiSkyColor: '#68b2e8',
      hemiGroundColor: '#142533',
      rimIntensity: 0.95,
      rimColor: '#ffffff',
      rimAzimuth: 5.6,
      rimElevation: 0.4,
      envIntensity: 0.8,
      backgroundColor: '#081018',
      fogEnabled: true,
      fogColor: '#0a1520',
      fogNear: 40,
      fogFar: 200,
      dustAmount: 1.1,
      floorColor: '#0e1822',
      floorTint: '#1a2d3d',
      floorRoughness: 0.88,
      floorSheen: 0.15,
      floorPool: 0.65,
      grassAmount: 0.75,
      grassColor: '#1b4353',
      grassColorWarm: '#2d6a80',
      grassColorDark: '#09161e'
    },
    post: {
      exposure: 1.0,
      bloomStrength: 0.95,
      bloomRadius: 0.5,
      bloomThreshold: 0.7,
      contrast: 1.12,
      saturation: 0.95,
      temperature: -0.28,
      lift: -0.005,
      gain: 1.02,
      vignette: 0.45,
      chromaticAberration: 0.35,
      grain: 0.04
    }
  },

  'Emerald Necropolis': {
    name: 'Emerald Necropolis',
    icon: '🌿',
    accent: '#52ffa8',
    description: 'Eerie jade glow with poisonous mist and mystical toxic ambiance',
    environment: {
      sunIntensity: 3.2,
      sunColor: '#52ffa8',
      sunAzimuth: 0.7,
      sunElevation: 0.55,
      ambientIntensity: 0.5,
      ambientColor: '#0d2417',
      hemiIntensity: 0.65,
      hemiSkyColor: '#2ee685',
      hemiGroundColor: '#091a10',
      rimIntensity: 0.8,
      rimColor: '#a8ffd2',
      rimAzimuth: 5.0,
      rimElevation: 0.35,
      envIntensity: 0.75,
      backgroundColor: '#06120c',
      fogEnabled: true,
      fogColor: '#081a12',
      fogNear: 30,
      fogFar: 160,
      dustAmount: 1.3,
      floorColor: '#102017',
      floorTint: '#163324',
      floorRoughness: 0.92,
      floorSheen: 0.1,
      floorPool: 0.55,
      grassAmount: 0.85,
      grassColor: '#1f683a',
      grassColorWarm: '#4cd66f',
      grassColorDark: '#0b1c11'
    },
    post: {
      exposure: 1.02,
      bloomStrength: 1.05,
      bloomRadius: 0.48,
      bloomThreshold: 0.72,
      contrast: 1.15,
      saturation: 1.25,
      temperature: -0.1,
      lift: -0.01,
      gain: 1.05,
      vignette: 0.5,
      chromaticAberration: 0.4,
      grain: 0.042
    }
  },

  'Golden Solstice': {
    name: 'Golden Solstice',
    icon: '🌅',
    accent: '#ffcc66',
    description: 'Radiant desert sunset with rich golden hour brilliance and lavender dusk',
    environment: {
      sunIntensity: 3.8,
      sunColor: '#ffcc66',
      sunAzimuth: 0.8,
      sunElevation: 0.5,
      ambientIntensity: 0.6,
      ambientColor: '#38261e',
      hemiIntensity: 0.8,
      hemiSkyColor: '#e89568',
      hemiGroundColor: '#3a1c2d',
      rimIntensity: 0.7,
      rimColor: '#ffe0b2',
      rimAzimuth: 5.3,
      rimElevation: 0.28,
      envIntensity: 0.85,
      backgroundColor: '#3a2018',
      fogEnabled: false,
      fogColor: '#40241e',
      fogNear: 60,
      fogFar: 240,
      dustAmount: 0.9,
      floorColor: '#422b18',
      floorTint: '#5c3d23',
      floorRoughness: 0.91,
      floorSheen: 0.08,
      floorPool: 0.5,
      grassAmount: 0.8,
      grassColor: '#6e8529',
      grassColorWarm: '#a6b83b',
      grassColorDark: '#313e11'
    },
    post: {
      exposure: 1.05,
      bloomStrength: 0.8,
      bloomRadius: 0.42,
      bloomThreshold: 0.78,
      contrast: 1.1,
      saturation: 1.2,
      temperature: 0.25,
      lift: -0.008,
      gain: 1.0,
      vignette: 0.38,
      chromaticAberration: 0.3,
      grain: 0.038
    }
  },

  'Cyber Neon Void': {
    name: 'Cyber Neon Void',
    icon: '⚡',
    accent: '#ff2a9d',
    description: 'Synthwave electric magenta key, neon cyan rim, and deep obsidian stage',
    environment: {
      sunIntensity: 3.4,
      sunColor: '#ff2a9d',
      sunAzimuth: 1.1,
      sunElevation: 0.6,
      ambientIntensity: 0.45,
      ambientColor: '#160824',
      hemiIntensity: 0.7,
      hemiSkyColor: '#d9148c',
      hemiGroundColor: '#08192b',
      rimIntensity: 1.2,
      rimColor: '#00f5ff',
      rimAzimuth: 5.4,
      rimElevation: 0.4,
      envIntensity: 0.8,
      backgroundColor: '#0c0414',
      fogEnabled: true,
      fogColor: '#10051d',
      fogNear: 35,
      fogFar: 170,
      dustAmount: 1.4,
      floorColor: '#12091c',
      floorTint: '#221235',
      floorRoughness: 0.85,
      floorSheen: 0.2,
      floorPool: 0.7,
      grassAmount: 0.7,
      grassColor: '#33144d',
      grassColorWarm: '#732099',
      grassColorDark: '#0d0417'
    },
    post: {
      exposure: 1.08,
      bloomStrength: 1.25,
      bloomRadius: 0.55,
      bloomThreshold: 0.65,
      contrast: 1.25,
      saturation: 1.45,
      temperature: 0.05,
      lift: -0.02,
      gain: 1.1,
      vignette: 0.6,
      chromaticAberration: 0.55,
      grain: 0.05
    }
  },

  'Volcanic Caldera': {
    name: 'Volcanic Caldera',
    icon: '🌋',
    accent: '#ff6b2b',
    description: 'Smoldering molten orange key, ash fog, and fiery ground rumbles',
    environment: {
      sunIntensity: 3.5,
      sunColor: '#ff6b2b',
      sunAzimuth: 0.9,
      sunElevation: 0.6,
      ambientIntensity: 0.5,
      ambientColor: '#26100a',
      hemiIntensity: 0.65,
      hemiSkyColor: '#e63900',
      hemiGroundColor: '#1a0803',
      rimIntensity: 0.9,
      rimColor: '#ffaa40',
      rimAzimuth: 5.1,
      rimElevation: 0.3,
      envIntensity: 0.75,
      backgroundColor: '#120603',
      fogEnabled: true,
      fogColor: '#1a0a06',
      fogNear: 25,
      fogFar: 150,
      dustAmount: 1.5,
      floorColor: '#170e0b',
      floorTint: '#2b140c',
      floorRoughness: 0.93,
      floorSheen: 0.08,
      floorPool: 0.55,
      grassAmount: 0.6,
      grassColor: '#3d1c10',
      grassColorWarm: '#8c3815',
      grassColorDark: '#0d0604'
    },
    post: {
      exposure: 1.04,
      bloomStrength: 1.1,
      bloomRadius: 0.5,
      bloomThreshold: 0.7,
      contrast: 1.2,
      saturation: 1.3,
      temperature: 0.3,
      lift: -0.015,
      gain: 1.06,
      vignette: 0.58,
      chromaticAberration: 0.45,
      grain: 0.05
    }
  },

  'Abyssal Twilight': {
    name: 'Abyssal Twilight',
    icon: '🌌',
    accent: '#9d6bff',
    description: 'Mystic celestial violet, starry cosmic haze, and ethereal shadow gradients',
    environment: {
      sunIntensity: 3.1,
      sunColor: '#9d6bff',
      sunAzimuth: 1.0,
      sunElevation: 0.58,
      ambientIntensity: 0.5,
      ambientColor: '#120d26',
      hemiIntensity: 0.68,
      hemiSkyColor: '#7347d6',
      hemiGroundColor: '#140924',
      rimIntensity: 0.85,
      rimColor: '#d4b8ff',
      rimAzimuth: 5.5,
      rimElevation: 0.36,
      envIntensity: 0.78,
      backgroundColor: '#090514',
      fogEnabled: true,
      fogColor: '#0d081a',
      fogNear: 35,
      fogFar: 180,
      dustAmount: 1.25,
      floorColor: '#130f1e',
      floorTint: '#241838',
      floorRoughness: 0.9,
      floorSheen: 0.14,
      floorPool: 0.6,
      grassAmount: 0.78,
      grassColor: '#281e4a',
      grassColorWarm: '#5c4099',
      grassColorDark: '#0a0712'
    },
    post: {
      exposure: 1.02,
      bloomStrength: 0.9,
      bloomRadius: 0.46,
      bloomThreshold: 0.74,
      contrast: 1.14,
      saturation: 1.2,
      temperature: -0.15,
      lift: -0.01,
      gain: 1.04,
      vignette: 0.48,
      chromaticAberration: 0.4,
      grain: 0.042
    }
  },

  'Celestial Dawn': {
    name: 'Celestial Dawn',
    icon: '🌸',
    accent: '#ffd1dc',
    description: 'Serene pastel morning with rose quartz haze, sky blue bounce, and soft gold sun',
    environment: {
      sunIntensity: 3.2,
      sunColor: '#fff0d0',
      sunAzimuth: 0.75,
      sunElevation: 0.65,
      ambientIntensity: 0.6,
      ambientColor: '#2c2836',
      hemiIntensity: 0.75,
      hemiSkyColor: '#87b5eb',
      hemiGroundColor: '#eb98a0',
      rimIntensity: 0.65,
      rimColor: '#ffd1dc',
      rimAzimuth: 5.3,
      rimElevation: 0.32,
      envIntensity: 0.8,
      backgroundColor: '#282030',
      fogEnabled: false,
      fogColor: '#2d2433',
      fogNear: 50,
      fogFar: 220,
      dustAmount: 0.8,
      floorColor: '#332a35',
      floorTint: '#4a3848',
      floorRoughness: 0.91,
      floorSheen: 0.07,
      floorPool: 0.45,
      grassAmount: 0.82,
      grassColor: '#537843',
      grassColorWarm: '#89a85b',
      grassColorDark: '#223b18'
    },
    post: {
      exposure: 1.0,
      bloomStrength: 0.7,
      bloomRadius: 0.4,
      bloomThreshold: 0.8,
      contrast: 1.05,
      saturation: 1.1,
      temperature: 0.05,
      lift: 0.0,
      gain: 1.0,
      vignette: 0.35,
      chromaticAberration: 0.25,
      grain: 0.035
    }
  },

  'Classic Arcane': {
    name: 'Classic Arcane',
    icon: '✨',
    accent: '#5fd0ff',
    description: 'The standard cinematic fantasy grove stage',
    environment: {
      sunIntensity: 3.2,
      sunColor: '#fff2d8',
      sunAzimuth: 0.85,
      sunElevation: 0.65,
      ambientIntensity: 0.55,
      ambientColor: '#ffe8c0',
      hemiIntensity: 0.7,
      hemiSkyColor: '#87ceeb',
      hemiGroundColor: '#c8a060',
      rimIntensity: 0.45,
      rimColor: '#fff8e7',
      rimAzimuth: 5.45,
      rimElevation: 0.35,
      envIntensity: 0.7,
      backgroundColor: '#87ceeb',
      fogEnabled: false,
      fogColor: '#c8b090',
      fogNear: 60,
      fogFar: 220,
      dustAmount: 0.85,
      floorColor: '#5a3e28',
      floorTint: '#6b4c32',
      floorRoughness: 0.92,
      floorSheen: 0.06,
      floorPool: 0.5,
      grassAmount: 0.82,
      grassColor: '#4f852b',
      grassColorWarm: '#82a832',
      grassColorDark: '#274b17'
    },
    post: {
      exposure: 1.0,
      bloomStrength: 0.75,
      bloomRadius: 0.4,
      bloomThreshold: 0.85,
      contrast: 1.05,
      saturation: 1.1,
      temperature: -0.03,
      lift: -0.008,
      gain: 1.0,
      vignette: 0.4,
      chromaticAberration: 0.35,
      grain: 0.045
    }
  }
};

export const THEME_NAMES = Object.keys(ENVIRONMENT_THEMES);

/**
 * Curated sequence of themed biomes and powers for reload chains.
 * Cycles through unique environments and finishes by returning back to the base theme!
 */
export const THEME_CHAIN = [
  { theme: 'Crimson Eclipse', element: 'meteor', label: 'Blood Moon & Cinder Fall' },
  { theme: 'Midnight Arctic', element: 'glacier', label: 'Glacial Blizzard & Crown' },
  { theme: 'Emerald Necropolis', element: 'beam', label: 'Toxic Grove & Nova Beam' },
  { theme: 'Golden Solstice', element: 'thunder', label: 'Sunset Dusk & Storm Lance' },
  { theme: 'Cyber Neon Void', element: 'snare', label: 'Synthwave Void & Voltaic Snare' },
  { theme: 'Volcanic Caldera', element: 'meteor', label: 'Molten Caldera & Cinder Fall' },
  { theme: 'Abyssal Twilight', element: 'glacier', label: 'Cosmic Violet & Glacial Crown' },
  { theme: 'Celestial Dawn', element: 'beam', label: 'Pastel Sunrise & Nova Beam' },
  { theme: 'Classic Arcane', element: 'ice', label: 'Base Theme (Classic Arcane & Frost Lance)' }
];

const SESSION_KEY_LOADED = 'frost-sandbox.sessionLoaded';
const SESSION_KEY_CHAIN_INDEX = 'frost-sandbox.chainIndex';
const SESSION_KEY_RELOAD_COUNT = 'frost-sandbox.reloadCount';

/**
 * Inspect the current session reload state.
 */
export function getSessionReloadState() {
  try {
    const isLoaded = sessionStorage.getItem(SESSION_KEY_LOADED);
    const count = parseInt(sessionStorage.getItem(SESSION_KEY_RELOAD_COUNT) || '0', 10);
    const index = parseInt(sessionStorage.getItem(SESSION_KEY_CHAIN_INDEX) || '0', 10);
    return {
      isInitial: !isLoaded,
      reloadCount: count,
      chainIndex: index
    };
  } catch {
    return { isInitial: true, reloadCount: 0, chainIndex: 0 };
  }
}

/**
 * Handle game load lifecycle:
 * - On initial load: keeps the base theme ('Classic Arcane') and default spell ('ice').
 * - On subsequent reloads: triggers the next theme in the sequence chain.
 */
export function advanceSessionThemeChain() {
  try {
    const isLoaded = sessionStorage.getItem(SESSION_KEY_LOADED);
    let count = parseInt(sessionStorage.getItem(SESSION_KEY_RELOAD_COUNT) || '0', 10);
    let index = parseInt(sessionStorage.getItem(SESSION_KEY_CHAIN_INDEX) || '0', 10);

    if (!isLoaded) {
      // First boot of the session -> keep base theme
      sessionStorage.setItem(SESSION_KEY_LOADED, 'true');
      sessionStorage.setItem(SESSION_KEY_RELOAD_COUNT, '0');
      sessionStorage.setItem(SESSION_KEY_CHAIN_INDEX, '0');
      applyEnvironmentTheme('Classic Arcane');
      const baseTheme = ENVIRONMENT_THEMES['Classic Arcane'];
      return {
        isInitial: true,
        themeName: 'Classic Arcane',
        description: baseTheme?.description || 'The standard cinematic fantasy grove stage',
        icon: baseTheme?.icon || '✨',
        accent: baseTheme?.accent || '#5fd0ff',
        element: 'ice',
        reloadCount: 0,
        label: 'Base Theme (Classic Arcane & Frost Lance)'
      };
    }

    // Subsequent reload -> advance theme chain
    count += 1;
    const step = THEME_CHAIN[index % THEME_CHAIN.length];
    const nextIndex = (index + 1) % THEME_CHAIN.length;

    sessionStorage.setItem(SESSION_KEY_RELOAD_COUNT, String(count));
    sessionStorage.setItem(SESSION_KEY_CHAIN_INDEX, String(nextIndex));

    applyEnvironmentTheme(step.theme);
    const loadedTheme = ENVIRONMENT_THEMES[step.theme];

    // Optionally randomize cast animation gesture
    if (settings[step.element] && CAST_ANIMATIONS.length) {
      settings[step.element].castAnim = CAST_ANIMATIONS[Math.floor(Math.random() * CAST_ANIMATIONS.length)];
    }

    return {
      isInitial: false,
      themeName: step.theme,
      description: loadedTheme?.description || '',
      icon: loadedTheme?.icon || '✨',
      accent: loadedTheme?.accent || '#5fd0ff',
      element: step.element,
      reloadCount: count,
      label: step.label
    };
  } catch (err) {
    console.warn('[EnvironmentThemes] error in theme chain', err);
    return {
      isInitial: true,
      themeName: 'Classic Arcane',
      description: 'The standard cinematic fantasy grove stage',
      icon: '✨',
      accent: '#5fd0ff',
      element: 'ice',
      reloadCount: 0,
      label: 'Classic Arcane'
    };
  }
}

/**
 * Reset session reload chain so next reload acts as an initial base load.
 */
export function resetSessionChain() {
  try {
    sessionStorage.removeItem(SESSION_KEY_LOADED);
    sessionStorage.removeItem(SESSION_KEY_RELOAD_COUNT);
    sessionStorage.removeItem(SESSION_KEY_CHAIN_INDEX);
  } catch {}
  resetEnvironmentToDefaults();
}

/**
 * Check if "Randomize on reload" is turned on in localStorage.
 * Defaults to true so refreshing the game naturally triggers the theme chains.
 */
export function isRandomizeOnReloadEnabled() {
  try {
    const val = localStorage.getItem(STORAGE_KEY_RANDOMIZE);
    if (val === null) return true;
    return val === 'true';
  } catch {
    return true;
  }
}

/**
 * Save "Randomize on reload" toggle state.
 */
export function setRandomizeOnReloadEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY_RANDOMIZE, String(enabled));
  } catch (error) {
    console.warn('[EnvironmentThemes] could not save randomize setting', error);
  }
}

/**
 * Apply a named or custom environment theme into live `settings`.
 * Preserves object identities so shaders and passes continue reading live values.
 */
export function applyEnvironmentTheme(themeOrName) {
  const theme = typeof themeOrName === 'string' ? ENVIRONMENT_THEMES[themeOrName] : themeOrName;
  if (!theme) return false;

  if (theme.environment) {
    applySettings(theme.environment, settings.environment);
  }
  if (theme.post) {
    applySettings(theme.post, settings.post);
  }

  try {
    const themeName = typeof themeOrName === 'string' ? themeOrName : themeOrName?.name;
    if (themeName) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_THEME, themeName);
      sessionStorage.setItem(STORAGE_KEY_ACTIVE_THEME, themeName);
    }
  } catch {
    // Ignore storage errors
  }

  return true;
}

/**
 * Pick a random environment theme from the curated library and apply it.
 * @returns {{ name: string, description: string }}
 */
export function applyRandomEnvironment() {
  const names = THEME_NAMES;
  const chosenName = names[Math.floor(Math.random() * names.length)];
  const theme = ENVIRONMENT_THEMES[chosenName];
  applyEnvironmentTheme(theme);
  return { name: chosenName, description: theme.description };
}

/**
 * Pick a random power from ELEMENTS and optionally randomize its gesture.
 * @returns {string} The chosen element id
 */
export function getRandomPower() {
  const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
  // Randomize the cast gesture animation for extra variety
  if (settings[element] && CAST_ANIMATIONS.length) {
    const anim = CAST_ANIMATIONS[Math.floor(Math.random() * CAST_ANIMATIONS.length)];
    settings[element].castAnim = anim;
  }
  return element;
}

/**
 * Randomize all elements' cast animations and return a random primary element.
 */
export function randomizeAllPowers() {
  for (const el of ELEMENTS) {
    if (settings[el] && CAST_ANIMATIONS.length) {
      settings[el].castAnim = CAST_ANIMATIONS[Math.floor(Math.random() * CAST_ANIMATIONS.length)];
    }
  }
  return getRandomPower();
}

/**
 * Reset environment and post processing to factory defaults.
 */
export function resetEnvironmentToDefaults() {
  if (DEFAULT_SETTINGS.environment) {
    applySettings(structuredClone(DEFAULT_SETTINGS.environment), settings.environment);
  }
  if (DEFAULT_SETTINGS.post) {
    applySettings(structuredClone(DEFAULT_SETTINGS.post), settings.post);
  }
}
