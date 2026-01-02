
// CHECKPOINT: Defender V21.6
// VERSION: V21.6 - Lunar Upscaling
import { ShipConfig, Weapon, Shield, WeaponType, Planet, QuadrantType } from './types';

export const INITIAL_CREDITS = 50000;

export const SHIPS: ShipConfig[] = [
  {
    id: 'vanguard',
    name: 'Vanguard X-1',
    description: 'A balanced fighter suitable for most missions. Standard Earth Union issue.',
    price: 10000,
    maxEnergy: 100,
    maxCargo: 50,
    speed: 5,
    shape: 'arrow',
    canLayMines: false,
    defaultColor: '#10b981'
  },
  {
    id: 'interceptor',
    name: 'Interstelar Wasp',
    description: 'Extremely fast with high energy for laser systems. Low cargo space.',
    price: 25000,
    maxEnergy: 250,
    maxCargo: 30,
    speed: 8,
    shape: 'stealth',
    canLayMines: false,
    defaultColor: '#3b82f6'
  },
  {
    id: 'juggernaut',
    name: 'The Titan',
    description: 'Slow but heavy. Massive cargo and energy. The only ship capable of laying space mines.',
    price: 35000,
    maxEnergy: 400,
    maxCargo: 300,
    speed: 3,
    shape: 'mine-layer',
    canLayMines: true,
    defaultColor: '#f59e0b'
  },
  {
    id: 'wraith',
    name: 'Void Wraith',
    description: 'Experimental ship with high energy capacity but fragile hull.',
    price: 45000,
    maxEnergy: 600,
    maxCargo: 40,
    speed: 6,
    shape: 'wing',
    canLayMines: false,
    defaultColor: '#a855f7'
  },
  {
    id: 'hauler',
    name: 'Terra Hauler',
    description: 'Modified cargo ship. Huge ammo capacity but very slow.',
    price: 15000,
    maxEnergy: 100,
    maxCargo: 600,
    speed: 2,
    shape: 'block',
    canLayMines: false,
    defaultColor: '#94a3b8'
  }
];

export const WEAPONS: Weapon[] = [
  { id: 'gun_basic', name: 'Auto-Cannon', type: WeaponType.PROJECTILE, price: 5000, damage: 10, fireRate: 6, energyCost: 20, cargoWeight: 5, isAmmoBased: false },
  { id: 'laser_red', name: 'Ruby Beam', type: WeaponType.LASER, price: 12000, damage: 15, fireRate: 10, energyCost: 60, cargoWeight: 2, isAmmoBased: false },
  { id: 'missile_seeker', name: 'Stalker Missile', type: WeaponType.MISSILE, price: 1200, damage: 35, fireRate: 1.5, energyCost: 10, cargoWeight: 2, isAmmoBased: true },
  { id: 'mine_rack', name: 'Static Mine', type: WeaponType.MINE, price: 2000, damage: 120, fireRate: 0.5, energyCost: 5, cargoWeight: 5, isAmmoBased: true }
];

export const SHIELDS: Shield[] = [
  { id: 'shield_light', name: 'Plasma Skin', price: 3000, capacity: 100, regenRate: 2, energyCost: 10, visualType: 'forward' },
  { id: 'shield_heavy', name: 'Aegis Core', price: 10000, capacity: 500, regenRate: 5, energyCost: 30, visualType: 'full' }
];

const getBaseSpeed = (radius: number) => (0.0052 / Math.sqrt(radius)) * 1.5;

export interface ExtendedPlanet extends Planet {
  atmosphereColor?: string;
}

export const PLANETS: ExtendedPlanet[] = [
  { 
    id: 'p1', name: 'Gliese Prime', description: 'A lush garden world and key human colony.', 
    difficulty: 1, status: 'friendly', orbitRadius: 60, orbitSpeed: getBaseSpeed(60), orbitDirection: 1, size: 2.5, color: '#064e3b',
    quadrant: QuadrantType.ALFA,
    atmosphereColor: 'rgba(52, 211, 153, 0.3)',
    moons: [
      { id: 'm1_1', name: 'Gliese Alpha', difficulty: 1, angle: 0, distance: 75, color: '#f8fafc', size: 0.8, orbitDirection: 1, inclination: 0 },
      { id: 'm1_2', name: 'Gliese Beta', difficulty: 1, angle: 160, distance: 105, color: '#cbd5e1', size: 0.5, orbitDirection: 1, inclination: 0 }
    ]
  },
  { 
    id: 'p_alfa_3', name: 'Krios IV', description: 'Harsh rocky world used as an outpost.', 
    difficulty: 2, status: 'occupied', orbitRadius: 120, orbitSpeed: getBaseSpeed(120), orbitDirection: 1, size: 2.4, color: '#431407',
    quadrant: QuadrantType.ALFA, 
    moons: [
      { id: 'm_alfa_3_1', name: 'Krios Rock', difficulty: 2, angle: 45, distance: 65, color: '#e2e8f0', size: 0.6, orbitDirection: -1, inclination: 0 },
      { id: 'm_alfa_3_2', name: 'Krios Sentinel', difficulty: 2, angle: 180, distance: 95, color: '#94a3b8', size: 0.5, orbitDirection: 1, inclination: 0 }
    ]
  },
  { 
    id: 'p2', name: 'Novus-7', description: 'A mining world shifted to a safe distance from Sol.', 
    difficulty: 3, status: 'occupied', orbitRadius: 80, orbitSpeed: getBaseSpeed(80), orbitDirection: 1, size: 2.1, color: '#450a0a',
    quadrant: QuadrantType.BETA, moons: [
      { id: 'm_beta_2_1', name: 'Obsidian', difficulty: 3, angle: 0, distance: 60, color: '#f1f5f9', size: 0.6, orbitDirection: 1, inclination: 0 }
    ]
  },
  { 
    id: 'p_beta_3', name: 'Midas Prime', description: 'Rich in gold-based electronics.', 
    difficulty: 4, status: 'occupied', orbitRadius: 140, orbitSpeed: getBaseSpeed(140), orbitDirection: 1, size: 2.6, color: '#3f2b05',
    quadrant: QuadrantType.BETA,
    moons: [{ id: 'm_beta_3_1', name: 'Luster Moon', difficulty: 3, angle: 90, distance: 75, color: '#fffbeb', size: 0.56, orbitDirection: 1, inclination: 0 }]
  },
  { 
    id: 'p_beta_4', name: 'Vesperia', description: 'Cloud world research stations.', 
    difficulty: 4, status: 'siege', orbitRadius: 200, orbitSpeed: getBaseSpeed(200), orbitDirection: -1, size: 2.0, color: '#2e1065',
    quadrant: QuadrantType.BETA, moons: [],
    atmosphereColor: 'rgba(167, 139, 250, 0.3)'
  },
  { 
    id: 'p_beta_5', name: 'Iron Rock', description: 'Industrial graveyard.', 
    difficulty: 2, status: 'occupied', orbitRadius: 260, orbitSpeed: getBaseSpeed(260), orbitDirection: 1, size: 1.8, color: '#334155',
    quadrant: QuadrantType.BETA, moons: []
  },
  { 
    id: 'p_gama_2', name: 'Triton Station', description: 'The outer gateway to the Gama Quadrant.', 
    difficulty: 5, status: 'siege', orbitRadius: 90, orbitSpeed: getBaseSpeed(90), orbitDirection: -1, size: 1.8, color: '#075985',
    quadrant: QuadrantType.GAMA,
    moons: [],
    atmosphereColor: 'rgba(125, 211, 252, 0.2)'
  },
  { 
    id: 'p_gama_3', name: 'Nephthys', description: 'Dark volcanic world.', 
    difficulty: 6, status: 'occupied', orbitRadius: 138, orbitSpeed: getBaseSpeed(138), orbitDirection: 1, size: 2.2, color: '#450a0a',
    quadrant: QuadrantType.GAMA, moons: [],
    atmosphereColor: 'rgba(248, 113, 113, 0.3)'
  },
  { 
    id: 'p3', name: 'Calyx V', description: 'Gigantic crimson gas giant.', 
    difficulty: 0, status: 'occupied', orbitRadius: 194, orbitSpeed: getBaseSpeed(194), orbitDirection: 1, size: 4.8, color: '#b91c1c',
    quadrant: QuadrantType.GAMA, isGasGiant: true, hasRings: true,
    atmosphereColor: 'rgba(239, 68, 68, 0.2)',
    moons: [
      { id: 'm_gama_1', name: 'Aeolus', difficulty: 5, angle: 0, distance: 150, color: '#fdba74', size: 1.0, orbitDirection: 1, inclination: 0 },
      { id: 'm_gama_2', name: 'Boreas', difficulty: 6, angle: 120, distance: 185, color: '#6ee7b7', size: 0.9, orbitDirection: 1, inclination: 0 },
      { id: 'm_gama_3', name: 'Zephyrus', difficulty: 5, angle: 240, distance: 220, color: '#93c5fd', size: 1.1, orbitDirection: -1, inclination: 0 }
    ]
  },
  { 
    id: 'p5', name: 'Xenon Rift', description: 'Nebula mothership origin point.', 
    difficulty: 8, status: 'occupied', orbitRadius: 100, orbitSpeed: getBaseSpeed(100), orbitDirection: 1, size: 2.4, color: '#5b21b6',
    quadrant: QuadrantType.DELTA, moons: []
  },
  { 
    id: 'p_delta_2', name: 'Abyssus', description: 'Pitch black world.', 
    difficulty: 9, status: 'occupied', orbitRadius: 180, orbitSpeed: getBaseSpeed(180), orbitDirection: -1, size: 2.0, color: '#3f3f46',
    quadrant: QuadrantType.DELTA, moons: []
  },
  { 
    id: 'p_delta_3', name: 'Erebus Prime', description: 'A massive gas giant looming in the dark.', 
    difficulty: 10, status: 'siege', orbitRadius: 280, orbitSpeed: getBaseSpeed(280), orbitDirection: 1, size: 5.4, color: '#ef4444',
    quadrant: QuadrantType.DELTA, isGasGiant: true, hasRings: true,
    atmosphereColor: 'rgba(220, 38, 38, 0.4)',
    moons: [
      { id: 'm_delta_3_1', name: 'Umbra', difficulty: 9, angle: 45, distance: 175, color: '#d1d5db', size: 1.0, orbitDirection: 1, inclination: 0 },
      { id: 'm_delta_3_2', name: 'Phobos Delta', difficulty: 10, angle: 180, distance: 215, color: '#fca5a5', size: 1.2, orbitDirection: 1, inclination: 0 }
    ]
  },
  { 
    id: 'p_delta_4', name: 'Styx', description: 'Hostile icy world.', 
    difficulty: 8, status: 'occupied', orbitRadius: 380, orbitSpeed: getBaseSpeed(380), orbitDirection: -1, size: 1.8, color: '#4b5563',
    quadrant: QuadrantType.DELTA, moons: [],
    atmosphereColor: 'rgba(148, 163, 184, 0.2)'
  },
  { 
    id: 'p_delta_6', name: 'Phlegethon', description: 'Rivers of fire.', 
    difficulty: 10, status: 'occupied', orbitRadius: 480, orbitSpeed: getBaseSpeed(480), orbitDirection: -1, size: 1.9, color: '#7f1d1d',
    quadrant: QuadrantType.DELTA, moons: [],
    atmosphereColor: 'rgba(249, 115, 22, 0.3)'
  },
  { 
    id: 'p_delta_7', name: 'Acheron', description: 'The final barrier.', 
    difficulty: 9, status: 'occupied', orbitRadius: 580, orbitSpeed: getBaseSpeed(580), orbitDirection: 1, size: 2.4, color: '#27272a',
    quadrant: QuadrantType.DELTA, moons: []
  }
];
