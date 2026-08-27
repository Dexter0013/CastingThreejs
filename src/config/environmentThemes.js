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
    global: {
      lightIntensity: 1.05,
      glow: 1.02
    },
    spells: {
      ice: {
        height: 2.9,
        radius: 0.44,
        bend: 0.72,
        colorIce: '#d62438',
        colorDeep: '#420a10',
        colorRim: '#ff9482',
        colorCore: '#9e1927',
        colorFrost: '#fce8eb',
        colorFrostEdge: '#8c2e3a',
        colorSparkleB: '#ff4d29',
        colorShockA: '#ff3700',
        colorShockB: '#ffaa88',
        colorBurstA: '#ff3311',
        colorBurstB: '#ff6633',
        colorBurstC: '#ffffff',
        burstSize: 3.9,
        lightColor: '#ff5533',
        lightIntensity: 10,
        lightRadius: 14
      },
      thunder: {
        sparkSize: 0.18,
        sparkSpeed: 9.5,
        colorSparkA: '#ffffff',
        colorSparkC: '#ff4d79',
        colorMoteC: '#ff1f43',
        colorMuzzleA: '#ff2255',
        colorMuzzleB: '#ff88aa',
        colorMuzzleC: '#ffffff',
        colorCastFlash: '#ff8899',
        colorBurstA: '#ff2255',
        colorBurstB: '#ff6688',
        colorBurstC: '#ffffff',
        burstSize: 3.4,
        lightColor: '#ff4466',
        lightIntensity: 26,
        lightRadius: 18
      },
      meteor: {
        radius: 0.92,
        cuts: 10,
        cutDepth: 0.32,
        colorRock: '#3d251c',
        colorChar: '#120805',
        colorCrack: '#ff3700',
        colorHot: '#ffffff',
        colorBurstA: '#ff2200',
        colorBurstB: '#ff7733',
        colorBurstC: '#ffffff',
        burstSize: 4.8,
        lightColor: '#ff3b1e',
        lightIntensity: 18,
        lightRadius: 16
      },
      beam: {
        radius: 0.84,
        flare: 1.85,
        colorSheath: '#ff2b47',
        colorRim: '#ffa077',
        colorCore: '#ffffff',
        colorCoilA: '#ff8a3c',
        colorBurstA: '#ff4422',
        colorBurstB: '#ffffff',
        lightColor: '#ff6633',
        lightIntensity: 30,
        lightRadius: 20,
        muzzleLightIntensity: 16,
        muzzleLightRadius: 9
      },
      snare: {
        height: 10.2,
        zoneRadius: 4.5,
        columnWidth: 2.0,
        colorCore: '#ff2b47',
        colorFilament: '#ff5533',
        colorInner: '#ff3700',
        colorBurstA: '#ff2255',
        colorBurstB: '#ff7799',
        lightColor: '#ff2255',
        lightIntensity: 25,
        lightRadius: 19
      },
      glacier: {
        ringHeight: 1.62,
        radius: 0.42,
        ringLean: 0.38,
        colorIce: '#cc1a2c',
        colorDeep: '#3b060d',
        colorCore: '#ff6677',
        colorRim: '#ffb3a8',
        colorShockA: '#ff4422',
        colorShockB: '#ffaa88',
        lightColor: '#ff6644',
        lightIntensity: 15,
        lightRadius: 17
      }
    },
    environment: {
      sunIntensity: 3.6,
      sunColor: '#ff4d29',
      sunAzimuth: 0.95,
      sunElevation: 0.45,
      ambientIntensity: 0.45,
      ambientColor: '#3a1520',
      hemiIntensity: 0.6,
      hemiSkyColor: '#ff2a55',
      hemiGroundColor: '#2b0d18',
      rimIntensity: 0.9,
      rimColor: '#ffaa66',
      rimAzimuth: 5.2,
      rimElevation: 0.3,
      envIntensity: 0.75,
      backgroundColor: '#15050a',
      fogEnabled: true,
      fogColor: '#6e2a38',
      fogNear: 45,
      fogFar: 190,
      dustAmount: 1.3,
      shadowBias: -0.0001,
      shadowRadius: 1.6,
      contactShadow: 0.6,
      floorColor: '#1a090e',
      floorTint: '#38121d',
      floorRoughness: 0.88,
      floorSheen: 0.14,
      floorPool: 0.65,
      grassAmount: 0.85,
      grassColor: '#631a22',
      grassColorWarm: '#9e3223',
      grassColorDark: '#170508'
    },
    post: {
      exposure: 1.02,
      bloomStrength: 0.045,
      bloomRadius: 0.52,
      bloomThreshold: 0.85,
      contrast: 1.18,
      saturation: 1.28,
      temperature: 0.22,
      lift: -0.015,
      gain: 1.05,
      vignette: 0.58,
      chromaticAberration: 0.48,
      distortion: 0.06,
      grain: 0.048,
      flashStrength: 1.05
    }
  },

  'Midnight Arctic': {
    name: 'Midnight Arctic',
    icon: '❄️',
    accent: '#a8e8ff',
    description: 'Glacial sub-zero blizzard with pale cyan key and deep indigo fog',
    global: {
      lightIntensity: 0.98,
      glow: 1.0
    },
    spells: {
      ice: {
        height: 3.15,
        radius: 0.48,
        taper: 0.62,
        facets: 8,
        colorIce: '#78d2ff',
        colorDeep: '#0c2e47',
        colorRim: '#f2feff',
        colorCore: '#5096b8',
        colorShockA: '#6ec8ff',
        colorShockB: '#ffffff',
        colorBurstA: '#78d2ff',
        colorBurstB: '#b8f0ff',
        colorBurstC: '#ffffff',
        colorMistA: '#ffffff',
        colorMistB: '#90d4f0',
        colorMistC: '#60b8e0',
        colorMistD: '#1a4870',
        frostSpread: 1.5,
        burstSize: 4.0,
        lightColor: '#9fe8ff',
        lightIntensity: 9.5,
        lightRadius: 14
      },
      thunder: {
        sparkSize: 0.15,
        colorSparkC: '#9fe8ff',
        colorMoteC: '#5ec2ff',
        colorSmokeA: '#1a334a',
        colorMuzzleA: '#38b8ff',
        colorMuzzleB: '#cceeff',
        colorMuzzleC: '#ffffff',
        colorCastFlash: '#cceeff',
        lightColor: '#6ee0ff',
        lightIntensity: 25,
        lightRadius: 17
      },
      meteor: {
        radius: 0.86,
        colorRock: '#263a4a',
        colorChar: '#0d1822',
        colorCrack: '#5cd6ff',
        colorHot: '#ebfaff',
        colorBurstA: '#5cd6ff',
        colorBurstB: '#b8f2ff',
        colorBurstC: '#ffffff',
        burstSize: 4.2,
        lightColor: '#80e5ff',
        lightIntensity: 15,
        lightRadius: 14
      },
      beam: {
        radiusNear: 0.14,
        radius: 0.74,
        colorSheath: '#42b8ff',
        colorRim: '#e0f7ff',
        colorCore: '#ffffff',
        lightColor: '#b8f2ff',
        lightIntensity: 28,
        lightRadius: 19,
        muzzleLightIntensity: 15,
        muzzleLightRadius: 9
      },
      snare: {
        zoneRadius: 4.7,
        height: 8.8,
        colorCore: '#9fe8ff',
        colorFilament: '#60caff',
        lightColor: '#7be3ff',
        lightIntensity: 23,
        lightRadius: 18
      },
      glacier: {
        ringHeight: 1.8,
        skirtHeight: 2.1,
        radius: 0.44,
        colorIce: '#6ec8ff',
        colorDeep: '#0e2638',
        colorCore: '#a8f0ff',
        colorRim: '#ffffff',
        colorShockA: '#78d4ff',
        colorShockB: '#ffffff',
        lightColor: '#a8f0ff',
        lightIntensity: 15,
        lightRadius: 17
      }
    },
    environment: {
      sunIntensity: 2.9,
      sunColor: '#a8e8ff',
      sunAzimuth: 1.2,
      sunElevation: 0.7,
      ambientIntensity: 0.48,
      ambientColor: '#0e1e2d',
      hemiIntensity: 0.65,
      hemiSkyColor: '#68b2e8',
      hemiGroundColor: '#142533',
      rimIntensity: 0.85,
      rimColor: '#ffffff',
      rimAzimuth: 5.6,
      rimElevation: 0.4,
      envIntensity: 0.78,
      backgroundColor: '#081018',
      fogEnabled: true,
      fogColor: '#95d2f0',
      fogNear: 40,
      fogFar: 180,
      dustAmount: 1.3,
      shadowBias: -0.0001,
      shadowRadius: 1.4,
      contactShadow: 0.58,
      floorColor: '#0a1622',
      floorTint: '#162b3d',
      floorRoughness: 0.82,
      floorSheen: 0.22,
      floorPool: 0.75,
      grassAmount: 0.75,
      grassColor: '#1d485c',
      grassColorWarm: '#357591',
      grassColorDark: '#0a1a24'
    },
    post: {
      exposure: 1.0,
      bloomStrength: 0.035,
      bloomRadius: 0.58,
      bloomThreshold: 0.88,
      contrast: 1.10,
      saturation: 0.95,
      temperature: -0.25,
      lift: -0.005,
      gain: 1.02,
      vignette: 0.45,
      chromaticAberration: 0.35,
      distortion: 0.035,
      grain: 0.038,
      flashStrength: 1.0
    }
  },

  'Emerald Necropolis': {
    name: 'Emerald Necropolis',
    icon: '🌿',
    accent: '#52ffa8',
    description: 'Eerie jade glow with poisonous mist and mystical toxic ambiance',
    global: {
      lightIntensity: 0.98,
      glow: 1.04
    },
    spells: {
      ice: {
        height: 2.85,
        radius: 0.43,
        bend: 0.78,
        roughness: 0.14,
        colorIce: '#2fd470',
        colorDeep: '#083318',
        colorRim: '#b8ffd6',
        colorCore: '#1fa34f',
        colorSparkleB: '#4dff88',
        colorShockA: '#2fd470',
        colorShockB: '#b8ffd6',
        colorBurstA: '#38e07a',
        colorBurstB: '#99ffc7',
        colorBurstC: '#ffffff',
        colorMistA: '#d4ffe5',
        colorMistB: '#52ffa8',
        colorMistC: '#2fd470',
        colorMistD: '#083318',
        burstSize: 3.8,
        lightColor: '#4dff9e',
        lightIntensity: 9.5,
        lightRadius: 14
      },
      thunder: {
        sparkSize: 0.17,
        sparkSpeed: 9.5,
        colorSparkC: '#36f082',
        colorMoteC: '#1bb85c',
        colorMuzzleA: '#1fa34f',
        colorMuzzleB: '#a8ffd2',
        colorMuzzleC: '#ffffff',
        colorCastFlash: '#a8ffd2',
        burstSize: 3.3,
        lightColor: '#26e680',
        lightIntensity: 26,
        lightRadius: 18
      },
      meteor: {
        radius: 0.85,
        lumpiness: 0.32,
        colorRock: '#1c281e',
        colorCrack: '#40f57a',
        colorHot: '#d8ffe5',
        colorBurstA: '#36f082',
        colorBurstB: '#99ffc7',
        lightColor: '#70ff54',
        lightIntensity: 15,
        lightRadius: 15
      },
      beam: {
        radius: 0.84,
        flare: 1.8,
        throb: 0.08,
        colorSheath: '#22d96c',
        colorRim: '#99ffc7',
        colorCore: '#f2fff7',
        colorCoilA: '#70ff99',
        lightColor: '#52ffa8',
        lightIntensity: 29,
        lightRadius: 20,
        muzzleLightIntensity: 15,
        muzzleLightRadius: 9
      },
      snare: {
        zoneRadius: 4.9,
        height: 10.0,
        strands: 18,
        colorCore: '#3df284',
        colorFilament: '#22cc66',
        lightColor: '#36f08a',
        lightIntensity: 24,
        lightRadius: 19
      },
      glacier: {
        ringHeight: 1.55,
        radius: 0.41,
        colorIce: '#28cc68',
        colorDeep: '#09361a',
        colorCore: '#70ffaa',
        colorShockA: '#28cc68',
        colorShockB: '#c0ffdb',
        lightColor: '#5effb0',
        lightIntensity: 14,
        lightRadius: 17
      }
    },
    environment: {
      sunIntensity: 2.8,
      sunColor: '#52ffa8',
      sunAzimuth: 0.7,
      sunElevation: 0.55,
      ambientIntensity: 0.46,
      ambientColor: '#0d2417',
      hemiIntensity: 0.6,
      hemiSkyColor: '#2ee685',
      hemiGroundColor: '#091a10',
      rimIntensity: 0.75,
      rimColor: '#a8ffd2',
      rimAzimuth: 5.0,
      rimElevation: 0.35,
      envIntensity: 0.72,
      backgroundColor: '#06120c',
      fogEnabled: true,
      fogColor: '#50c485',
      fogNear: 40,
      fogFar: 180,
      dustAmount: 1.5,
      shadowBias: -0.0001,
      shadowRadius: 1.5,
      contactShadow: 0.55,
      floorColor: '#0d1c13',
      floorTint: '#163321',
      floorRoughness: 0.90,
      floorSheen: 0.18,
      floorPool: 0.70,
      grassAmount: 0.85,
      grassColor: '#1d6e3a',
      grassColorWarm: '#45db6e',
      grassColorDark: '#081c0f'
    },
    post: {
      exposure: 0.98,
      bloomStrength: 0.042,
      bloomRadius: 0.5,
      bloomThreshold: 0.86,
      contrast: 1.14,
      saturation: 1.22,
      temperature: -0.08,
      lift: -0.012,
      gain: 1.04,
      vignette: 0.52,
      chromaticAberration: 0.42,
      distortion: 0.05,
      grain: 0.044,
      flashStrength: 1.0
    }
  },

  'Golden Solstice': {
    name: 'Golden Solstice',
    icon: '🌅',
    accent: '#ffcc66',
    description: 'Radiant desert sunset with rich golden hour brilliance and lavender dusk',
    global: {
      lightIntensity: 1.02,
      glow: 0.98
    },
    spells: {
      ice: {
        height: 2.7,
        radius: 0.43,
        colorIce: '#d99e2b',
        colorDeep: '#4a2c08',
        colorRim: '#fff2b8',
        colorCore: '#f5b838',
        colorSparkleB: '#ffcc44',
        colorShockA: '#ffaa22',
        colorShockB: '#fff2b8',
        colorBurstA: '#ffbb33',
        colorBurstB: '#ffe077',
        colorBurstC: '#ffffff',
        lightColor: '#ffcc55',
        lightIntensity: 9.5,
        lightRadius: 13.5
      },
      thunder: {
        sparkSize: 0.19,
        sparkSpeed: 10.0,
        colorSparkC: '#ffd15c',
        colorMoteC: '#ff9922',
        colorMuzzleA: '#ff8800',
        colorMuzzleB: '#ffe088',
        colorMuzzleC: '#ffffff',
        colorCastFlash: '#ffe088',
        burstSize: 3.6,
        lightColor: '#ffaa33',
        lightIntensity: 27,
        lightRadius: 18
      },
      meteor: {
        radius: 0.90,
        arc: 2.8,
        colorRock: '#4a331c',
        colorCrack: '#ff9900',
        colorHot: '#fffbe8',
        colorBurstA: '#ff7700',
        colorBurstB: '#ffcc44',
        colorBurstC: '#ffffff',
        burstSize: 4.6,
        lightColor: '#ff8822',
        lightIntensity: 17,
        lightRadius: 15
      },
      beam: {
        radius: 0.85,
        flare: 1.8,
        colorSheath: '#ffaa22',
        colorRim: '#fff0a8',
        colorCore: '#ffffff',
        colorCoilA: '#ffe066',
        lightColor: '#ffe066',
        lightIntensity: 30,
        lightRadius: 21,
        muzzleLightIntensity: 16,
        muzzleLightRadius: 9
      },
      snare: {
        zoneRadius: 4.6,
        height: 9.0,
        colorCore: '#ffbe3b',
        colorFilament: '#ff9e1b',
        lightColor: '#ff9933',
        lightIntensity: 23,
        lightRadius: 18
      },
      glacier: {
        ringHeight: 1.48,
        fan: 1.25,
        colorIce: '#cc9223',
        colorDeep: '#402405',
        colorCore: '#ffd966',
        colorShockA: '#ffaa22',
        colorShockB: '#fff0a8',
        lightColor: '#ffd466',
        lightIntensity: 14,
        lightRadius: 16
      }
    },
    environment: {
      sunIntensity: 3.9,
      sunColor: '#ffcc66',
      sunAzimuth: 0.8,
      sunElevation: 0.5,
      ambientIntensity: 0.62,
      ambientColor: '#38261e',
      hemiIntensity: 0.75,
      hemiSkyColor: '#e89568',
      hemiGroundColor: '#3a1c2d',
      rimIntensity: 0.75,
      rimColor: '#ffe0b2',
      rimAzimuth: 5.3,
      rimElevation: 0.28,
      envIntensity: 0.85,
      backgroundColor: '#3a2018',
      fogEnabled: true,
      fogColor: '#d6a560',
      fogNear: 50,
      fogFar: 210,
      dustAmount: 1.2,
      shadowBias: -0.0001,
      shadowRadius: 1.5,
      contactShadow: 0.55,
      floorColor: '#452c16',
      floorTint: '#613e1f',
      floorRoughness: 0.94,
      floorSheen: 0.05,
      floorPool: 0.35,
      grassAmount: 0.8,
      grassColor: '#758c24',
      grassColorWarm: '#b0c732',
      grassColorDark: '#36420c'
    },
    post: {
      exposure: 1.06,
      bloomStrength: 0.038,
      bloomRadius: 0.55,
      bloomThreshold: 0.87,
      contrast: 1.08,
      saturation: 1.15,
      temperature: 0.20,
      lift: -0.008,
      gain: 1.02,
      vignette: 0.38,
      chromaticAberration: 0.30,
      distortion: 0.055,
      grain: 0.036,
      flashStrength: 1.0
    }
  },

  'Cyber Neon Void': {
    name: 'Cyber Neon Void',
    icon: '⚡',
    accent: '#ff2a9d',
    description: 'Synthwave electric magenta key, neon cyan rim, and deep obsidian stage',
    global: {
      lightIntensity: 1.04,
      glow: 1.06
    },
    spells: {
      ice: {
        height: 2.85,
        radius: 0.44,
        facets: 6,
        colorIce: '#db008d',
        colorDeep: '#2b0024',
        colorRim: '#ffb8ec',
        colorCore: '#00f0ff',
        colorSparkleB: '#00f5ff',
        colorShockA: '#00f5ff',
        colorShockB: '#ff80d5',
        colorBurstA: '#ff00a0',
        colorBurstB: '#00f5ff',
        colorBurstC: '#ffffff',
        lightColor: '#ff2ad4',
        lightIntensity: 10,
        lightRadius: 14
      },
      thunder: {
        sparkSize: 0.20,
        sparkSpeed: 10.5,
        colorSparkC: '#00f5ff',
        colorMoteC: '#ff00aa',
        colorMuzzleA: '#ff00aa',
        colorMuzzleB: '#00f5ff',
        colorMuzzleC: '#ffffff',
        colorCastFlash: '#00f5ff',
        burstSize: 3.7,
        lightColor: '#00f5ff',
        lightIntensity: 28,
        lightRadius: 19
      },
      meteor: {
        radius: 0.84,
        cuts: 12,
        colorRock: '#140c1e',
        colorCrack: '#ff00aa',
        colorHot: '#00f5ff',
        colorBurstA: '#ff00aa',
        colorBurstB: '#00f5ff',
        burstSize: 4.4,
        lightColor: '#ff007f',
        lightIntensity: 16,
        lightRadius: 15
      },
      beam: {
        radius: 0.86,
        flare: 1.95,
        throb: 0.12,
        colorSheath: '#ff0094',
        colorRim: '#00f5ff',
        colorCore: '#ffffff',
        colorCoilA: '#00f5ff',
        lightColor: '#00f0ff',
        lightIntensity: 31,
        lightRadius: 21,
        muzzleLightIntensity: 17,
        muzzleLightRadius: 9
      },
      snare: {
        zoneRadius: 4.7,
        height: 10.5,
        strands: 20,
        columnWidth: 2.1,
        colorCore: '#ff00a0',
        colorFilament: '#00f5ff',
        colorInner: '#ff0077',
        lightColor: '#b52aff',
        lightIntensity: 25,
        lightRadius: 19
      },
      glacier: {
        ringHeight: 1.55,
        radius: 0.42,
        colorIce: '#c7007e',
        colorDeep: '#26001d',
        colorCore: '#00f0ff',
        colorRim: '#ff80d5',
        colorShockA: '#ff00a0',
        colorShockB: '#00f5ff',
        lightColor: '#ff33cc',
        lightIntensity: 15,
        lightRadius: 17
      }
    },
    environment: {
      sunIntensity: 3.3,
      sunColor: '#ff2a9d',
      sunAzimuth: 1.1,
      sunElevation: 0.6,
      ambientIntensity: 0.38,
      ambientColor: '#160824',
      hemiIntensity: 0.65,
      hemiSkyColor: '#d9148c',
      hemiGroundColor: '#08192b',
      rimIntensity: 1.15,
      rimColor: '#00f5ff',
      rimAzimuth: 5.4,
      rimElevation: 0.4,
      envIntensity: 0.8,
      backgroundColor: '#0c0414',
      fogEnabled: true,
      fogColor: '#7d3594',
      fogNear: 45,
      fogFar: 185,
      dustAmount: 1.4,
      shadowBias: -0.0001,
      shadowRadius: 1.8,
      contactShadow: 0.65,
      floorColor: '#0e0517',
      floorTint: '#210d33',
      floorRoughness: 0.78,
      floorSheen: 0.30,
      floorPool: 0.85,
      grassAmount: 0.7,
      grassColor: '#3d1259',
      grassColorWarm: '#851ca8',
      grassColorDark: '#0e031a'
    },
    post: {
      exposure: 1.02,
      bloomStrength: 0.055,
      bloomRadius: 0.5,
      bloomThreshold: 0.85,
      contrast: 1.20,
      saturation: 1.35,
      temperature: 0.04,
      lift: -0.018,
      gain: 1.06,
      vignette: 0.58,
      chromaticAberration: 0.52,
      distortion: 0.045,
      grain: 0.048,
      flashStrength: 1.1
    }
  },

  'Volcanic Caldera': {
    name: 'Volcanic Caldera',
    icon: '🌋',
    accent: '#ff6b2b',
    description: 'Smoldering molten orange key, ash fog, and fiery ground rumbles',
    global: {
      lightIntensity: 1.04,
      glow: 1.02
    },
    spells: {
      ice: {
        height: 2.95,
        radius: 0.46,
        bend: 0.74,
        colorIce: '#c7380a',
        colorDeep: '#260802',
        colorRim: '#ffaa66',
        colorCore: '#ff4d00',
        colorSparkleB: '#ff6622',
        colorShockA: '#ff3700',
        colorShockB: '#ffaa66',
        colorBurstA: '#ff4400',
        colorBurstB: '#ff8833',
        colorBurstC: '#ffffff',
        burstSize: 4.1,
        lightColor: '#ff6622',
        lightIntensity: 10,
        lightRadius: 14
      },
      thunder: {
        sparkSize: 0.18,
        colorSparkC: '#ff5511',
        colorMoteC: '#ff2a00',
        colorMuzzleA: '#ff3300',
        colorMuzzleB: '#ff9944',
        colorMuzzleC: '#ffffff',
        colorCastFlash: '#ff9944',
        burstSize: 3.5,
        lightColor: '#ff5011',
        lightIntensity: 27,
        lightRadius: 18
      },
      meteor: {
        radius: 0.96,
        cuts: 14,
        lumpiness: 0.32,
        colorRock: '#26120a',
        colorChar: '#0d0502',
        colorCrack: '#ff3c00',
        colorHot: '#fff0a8',
        colorBurstA: '#ff2200',
        colorBurstB: '#ff7700',
        colorBurstC: '#ffffff',
        burstSize: 5.2,
        lightColor: '#ff4400',
        lightIntensity: 18,
        lightRadius: 16
      },
      beam: {
        radius: 0.90,
        flare: 1.9,
        colorSheath: '#ff3700',
        colorRim: '#ffc04d',
        colorCore: '#ffffff',
        colorCoilA: '#ff7700',
        lightColor: '#ff7722',
        lightIntensity: 31,
        lightRadius: 21,
        muzzleLightIntensity: 16,
        muzzleLightRadius: 9
      },
      snare: {
        zoneRadius: 4.7,
        height: 9.6,
        colorCore: '#ff4400',
        colorFilament: '#ff7711',
        lightColor: '#ff4800',
        lightIntensity: 25,
        lightRadius: 19
      },
      glacier: {
        ringHeight: 1.6,
        radius: 0.45,
        colorIce: '#ab2d05',
        colorDeep: '#240601',
        colorCore: '#ff6611',
        colorShockA: '#ff3700',
        colorShockB: '#ff9944',
        lightColor: '#ff6611',
        lightIntensity: 15,
        lightRadius: 17
      }
    },
    environment: {
      sunIntensity: 3.5,
      sunColor: '#ff6b2b',
      sunAzimuth: 0.9,
      sunElevation: 0.6,
      ambientIntensity: 0.48,
      ambientColor: '#26100a',
      hemiIntensity: 0.62,
      hemiSkyColor: '#e63900',
      hemiGroundColor: '#1a0803',
      rimIntensity: 0.95,
      rimColor: '#ffaa40',
      rimAzimuth: 5.1,
      rimElevation: 0.3,
      envIntensity: 0.75,
      backgroundColor: '#120603',
      fogEnabled: true,
      fogColor: '#944525',
      fogNear: 40,
      fogFar: 180,
      dustAmount: 1.5,
      shadowBias: -0.0001,
      shadowRadius: 1.6,
      contactShadow: 0.6,
      floorColor: '#140905',
      floorTint: '#291007',
      floorRoughness: 0.95,
      floorSheen: 0.12,
      floorPool: 0.65,
      grassAmount: 0.6,
      grassColor: '#451b0d',
      grassColorWarm: '#9c3814',
      grassColorDark: '#120502'
    },
    post: {
      exposure: 1.02,
      bloomStrength: 0.048,
      bloomRadius: 0.5,
      bloomThreshold: 0.86,
      contrast: 1.16,
      saturation: 1.25,
      temperature: 0.25,
      lift: -0.015,
      gain: 1.04,
      vignette: 0.55,
      chromaticAberration: 0.45,
      distortion: 0.075,
      grain: 0.050,
      flashStrength: 1.05
    }
  },

  'Abyssal Twilight': {
    name: 'Abyssal Twilight',
    icon: '🌌',
    accent: '#9d6bff',
    description: 'Mystic celestial violet, starry cosmic haze, and ethereal shadow gradients',
    global: {
      lightIntensity: 0.96,
      glow: 1.02
    },
    spells: {
      ice: {
        height: 2.9,
        radius: 0.43,
        colorIce: '#843be6',
        colorDeep: '#1a0538',
        colorRim: '#dfc2ff',
        colorCore: '#9e52ff',
        colorSparkleB: '#c07aff',
        colorShockA: '#7835e0',
        colorShockB: '#dfc2ff',
        colorBurstA: '#843be6',
        colorBurstB: '#c07aff',
        colorBurstC: '#ffffff',
        lightColor: '#b070ff',
        lightIntensity: 9,
        lightRadius: 13.5
      },
      thunder: {
        sparkSize: 0.17,
        colorSparkC: '#b366ff',
        colorMoteC: '#751aff',
        colorMuzzleA: '#6611ff',
        colorMuzzleB: '#c499ff',
        colorMuzzleC: '#ffffff',
        colorCastFlash: '#c499ff',
        burstSize: 3.4,
        lightColor: '#8a4dff',
        lightIntensity: 25,
        lightRadius: 17
      },
      meteor: {
        radius: 0.85,
        colorRock: '#1e1430',
        colorCrack: '#9d3eff',
        colorHot: '#f0e0ff',
        colorBurstA: '#9d3eff',
        colorBurstB: '#dfa8ff',
        lightColor: '#c555ff',
        lightIntensity: 15,
        lightRadius: 14
      },
      beam: {
        radius: 0.82,
        colorSheath: '#732be8',
        colorRim: '#d8b8ff',
        colorCore: '#f5edff',
        colorCoilA: '#b56eff',
        lightColor: '#9d6bff',
        lightIntensity: 28,
        lightRadius: 19,
        muzzleLightIntensity: 14,
        muzzleLightRadius: 9
      },
      snare: {
        zoneRadius: 4.6,
        height: 9.8,
        colorCore: '#8c35ff',
        colorFilament: '#b060ff',
        lightColor: '#7b38ff',
        lightIntensity: 23,
        lightRadius: 18
      },
      glacier: {
        ringHeight: 1.68,
        radius: 0.43,
        colorIce: '#7835e0',
        colorDeep: '#160430',
        colorCore: '#ad6aff',
        colorRim: '#e4caff',
        colorShockA: '#7835e0',
        colorShockB: '#e4caff',
        lightColor: '#b880ff',
        lightIntensity: 14,
        lightRadius: 16
      }
    },
    environment: {
      sunIntensity: 2.6,
      sunColor: '#9d6bff',
      sunAzimuth: 1.0,
      sunElevation: 0.58,
      ambientIntensity: 0.42,
      ambientColor: '#120d26',
      hemiIntensity: 0.58,
      hemiSkyColor: '#7347d6',
      hemiGroundColor: '#140924',
      rimIntensity: 0.8,
      rimColor: '#d4b8ff',
      rimAzimuth: 5.5,
      rimElevation: 0.36,
      envIntensity: 0.74,
      backgroundColor: '#090514',
      fogEnabled: true,
      fogColor: '#6f4fa6',
      fogNear: 45,
      fogFar: 195,
      dustAmount: 1.3,
      shadowBias: -0.0001,
      shadowRadius: 1.5,
      contactShadow: 0.58,
      floorColor: '#100b1a',
      floorTint: '#211536',
      floorRoughness: 0.86,
      floorSheen: 0.20,
      floorPool: 0.68,
      grassAmount: 0.78,
      grassColor: '#2b1b54',
      grassColorWarm: '#6542a6',
      grassColorDark: '#0b0617'
    },
    post: {
      exposure: 0.96,
      bloomStrength: 0.038,
      bloomRadius: 0.52,
      bloomThreshold: 0.87,
      contrast: 1.14,
      saturation: 1.15,
      temperature: -0.15,
      lift: -0.012,
      gain: 1.03,
      vignette: 0.50,
      chromaticAberration: 0.42,
      distortion: 0.040,
      grain: 0.042,
      flashStrength: 1.0
    }
  },

  'Celestial Dawn': {
    name: 'Celestial Dawn',
    icon: '🌸',
    accent: '#ffd1dc',
    description: 'Serene pastel morning with rose quartz haze, sky blue bounce, and soft gold sun',
    global: {
      lightIntensity: 0.95,
      glow: 0.96
    },
    spells: {
      ice: {
        height: 2.65,
        radius: 0.40,
        colorIce: '#eb8fa8',
        colorDeep: '#3d121e',
        colorRim: '#ffe6ee',
        colorCore: '#ffaec2',
        colorSparkleB: '#ffd1dc',
        colorShockA: '#eb8fa8',
        colorShockB: '#ffe6ee',
        colorBurstA: '#f29bb4',
        colorBurstB: '#ffd0de',
        colorBurstC: '#ffffff',
        lightColor: '#ffd0e0',
        lightIntensity: 8.5,
        lightRadius: 13
      },
      thunder: {
        sparkSize: 0.15,
        colorSparkC: '#b3ddff',
        colorMoteC: '#ffb3c9',
        colorMuzzleA: '#66adff',
        colorMuzzleB: '#ffd0de',
        colorMuzzleC: '#ffffff',
        colorCastFlash: '#ffd0de',
        lightColor: '#90c8ff',
        lightIntensity: 24,
        lightRadius: 16
      },
      meteor: {
        radius: 0.80,
        colorRock: '#3a2d36',
        colorCrack: '#ff8fb0',
        colorHot: '#fff2f6',
        colorBurstA: '#ff8fb0',
        colorBurstB: '#ffe0eb',
        lightColor: '#ffb3c6',
        lightIntensity: 14,
        lightRadius: 13.5
      },
      beam: {
        radius: 0.78,
        colorSheath: '#ff99b8',
        colorRim: '#d6edff',
        colorCore: '#ffffff',
        colorCoilA: '#ffe0eb',
        lightColor: '#ffe0ea',
        lightIntensity: 26,
        lightRadius: 18,
        muzzleLightIntensity: 13,
        muzzleLightRadius: 8.5
      },
      snare: {
        zoneRadius: 4.3,
        height: 8.8,
        colorCore: '#ff94b3',
        colorFilament: '#9ecfff',
        lightColor: '#b0d4ff',
        lightIntensity: 21,
        lightRadius: 17
      },
      glacier: {
        ringHeight: 1.42,
        radius: 0.38,
        colorIce: '#db829c',
        colorDeep: '#380f1b',
        colorCore: '#ffc7d6',
        colorShockA: '#db829c',
        colorShockB: '#ffe6ee',
        lightColor: '#ffd8e8',
        lightIntensity: 13,
        lightRadius: 15
      }
    },
    environment: {
      sunIntensity: 2.9,
      sunColor: '#fff0d0',
      sunAzimuth: 0.75,
      sunElevation: 0.65,
      ambientIntensity: 0.52,
      ambientColor: '#2c2836',
      hemiIntensity: 0.7,
      hemiSkyColor: '#87b5eb',
      hemiGroundColor: '#eb98a0',
      rimIntensity: 0.6,
      rimColor: '#ffd1dc',
      rimAzimuth: 5.3,
      rimElevation: 0.32,
      envIntensity: 0.78,
      backgroundColor: '#282030',
      fogEnabled: true,
      fogColor: '#dcaebc',
      fogNear: 45,
      fogFar: 200,
      dustAmount: 0.9,
      shadowBias: -0.0001,
      shadowRadius: 1.4,
      contactShadow: 0.52,
      floorColor: '#332836',
      floorTint: '#4a3848',
      floorRoughness: 0.90,
      floorSheen: 0.12,
      floorPool: 0.55,
      grassAmount: 0.82,
      grassColor: '#537d45',
      grassColorWarm: '#8da85b',
      grassColorDark: '#213b16'
    },
    post: {
      exposure: 0.98,
      bloomStrength: 0.028,
      bloomRadius: 0.5,
      bloomThreshold: 0.89,
      contrast: 1.05,
      saturation: 1.08,
      temperature: 0.05,
      lift: 0.0,
      gain: 1.0,
      vignette: 0.35,
      chromaticAberration: 0.25,
      distortion: 0.030,
      grain: 0.032,
      flashStrength: 1.0
    }
  },

  'Classic Arcane': {
    name: 'Classic Arcane',
    icon: '✨',
    accent: '#5fd0ff',
    description: 'The standard cinematic fantasy grove stage',
    global: {
      lightIntensity: 1.0,
      glow: 1.0,
      shaderIntensity: 1.0
    },
    spells: {
      ice: { lightColor: '#7fd4ff', lightIntensity: 9, lightRadius: 13 },
      thunder: { lightColor: '#63b8ff', lightIntensity: 26, lightRadius: 17 },
      meteor: { lightColor: '#ff8a3c', lightIntensity: 16, lightRadius: 14 },
      beam: { lightColor: '#7fdcff', lightIntensity: 30, lightRadius: 20 },
      snare: { lightColor: '#a98bff', lightIntensity: 24, lightRadius: 18 },
      glacier: { lightColor: '#7fe2ff', lightIntensity: 14, lightRadius: 16 }
    },
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
      shadowBias: -0.0001,
      shadowRadius: 1.5,
      contactShadow: 0.55,
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
      exposure: 1.05,
      bloomStrength: 0.03,
      bloomRadius: 0.6,
      bloomThreshold: 0.88,
      contrast: 1.12,
      saturation: 1.08,
      temperature: -0.03,
      lift: -0.008,
      gain: 1.0,
      vignette: 0.52,
      chromaticAberration: 0.4,
      distortion: 0.045,
      grain: 0.045,
      flashStrength: 1.0
    }
  }
};

export const THEME_NAMES = Object.keys(ENVIRONMENT_THEMES);

/**
 * Curated sequence of themed biomes and powers for reload chains:
 * 1. ✨ Classic Arcane (Base Boot)
 * 2. 🌅 Golden Solstice
 * 3. 🌸 Celestial Dawn
 * 4. ❄️ Midnight Arctic
 * 5. 🌒 Crimson Eclipse
 * 6. 🌋 Volcanic Caldera
 * 7. 🌿 Emerald Necropolis
 * 8. ⚡ Cyber Neon Void
 * 9. 🌌 Abyssal Twilight
 * 10. ✨ (Transitions back to Classic Arcane)
 */
export const THEME_CHAIN = [
  { theme: 'Golden Solstice', element: 'thunder', label: '🌅 Golden Solstice (Radiant Sun & Storm Lance)' },
  { theme: 'Celestial Dawn', element: 'ice', label: '🌸 Celestial Dawn (Pastel Sunrise & Frost Lance)' },
  { theme: 'Midnight Arctic', element: 'glacier', label: '❄️ Midnight Arctic (Glacial Blizzard & Glacial Crown)' },
  { theme: 'Crimson Eclipse', element: 'meteor', label: '🌒 Crimson Eclipse (Blood Moon & Cinder Fall)' },
  { theme: 'Volcanic Caldera', element: 'snare', label: '🌋 Volcanic Caldera (Molten Caldera & Voltaic Snare)' },
  { theme: 'Emerald Necropolis', element: 'beam', label: '🌿 Emerald Necropolis (Toxic Grove & Nova Beam)' },
  { theme: 'Cyber Neon Void', element: 'thunder', label: '⚡ Cyber Neon Void (Synthwave Void & Storm Lance)' },
  { theme: 'Abyssal Twilight', element: 'glacier', label: '🌌 Abyssal Twilight (Cosmic Void & Glacial Crown)' },
  { theme: 'Classic Arcane', element: 'ice', label: '✨ Classic Arcane (Base Fantasy Grove & Frost Lance)' }
];

const SESSION_KEY_LOADED = 'frost-sandbox.sessionLoaded';
const SESSION_KEY_CHAIN_INDEX = 'frost-sandbox.chainIndex';
const SESSION_KEY_RELOAD_COUNT = 'frost-sandbox.reloadCount';
const SESSION_KEY_ACTIVE_THEME = 'frost-sandbox.activeTheme';

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
 * - On subsequent reloads: triggers the next theme in the Light -> Dawn -> Night -> Default sequence.
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
      sessionStorage.setItem(SESSION_KEY_ACTIVE_THEME, 'Classic Arcane');
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
    sessionStorage.setItem(SESSION_KEY_ACTIVE_THEME, step.theme);

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

  // 1. Reset ability parameters (sizes, colors, lights) and global parameters to defaults first
  // so no previous theme overrides leak or cause over-lighting
  for (const element of ELEMENTS) {
    if (DEFAULT_SETTINGS[element] && settings[element]) {
      applySettings(structuredClone(DEFAULT_SETTINGS[element]), settings[element]);
    }
  }
  if (DEFAULT_SETTINGS.global) {
    applySettings(structuredClone(DEFAULT_SETTINGS.global), settings.global);
  }

  // 2. Apply theme's environment, post-processing, global multipliers, and spell overrides (size/appearance/lighting)
  if (theme.environment) {
    applySettings(theme.environment, settings.environment);
  }
  if (theme.post) {
    applySettings(theme.post, settings.post);
  }
  if (theme.global) {
    applySettings(theme.global, settings.global);
  }
  if (theme.spells) {
    for (const [element, spellOverrides] of Object.entries(theme.spells)) {
      if (settings[element] && spellOverrides) {
        applySettings(spellOverrides, settings[element]);
      }
    }
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
 * Reset environment, abilities, and post processing to factory defaults.
 */
export function resetEnvironmentToDefaults() {
  if (DEFAULT_SETTINGS.environment) {
    applySettings(structuredClone(DEFAULT_SETTINGS.environment), settings.environment);
  }
  if (DEFAULT_SETTINGS.post) {
    applySettings(structuredClone(DEFAULT_SETTINGS.post), settings.post);
  }
  if (DEFAULT_SETTINGS.global) {
    applySettings(structuredClone(DEFAULT_SETTINGS.global), settings.global);
  }
  for (const element of ELEMENTS) {
    if (DEFAULT_SETTINGS[element] && settings[element]) {
      applySettings(structuredClone(DEFAULT_SETTINGS[element]), settings[element]);
    }
  }
}
