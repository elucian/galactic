
// CHECKPOINT: Beta 20
// VERSION: Beta 20 - Ammo Market & Mechanics
import { ShipConfig, Weapon, Shield, WeaponType, Planet, QuadrantType, AmmoType } from './types';

export const INITIAL_CREDITS = 250000;
export const MAX_FLEET_SIZE = 3;

export const AVATARS = [
  { label: 'White', icon: '👨🏻' }, { label: 'Girl', icon: '👩🏼' }, { label: 'Black Man', icon: '👨🏾' }, { label: 'Black Girl', icon: '👩🏾' }, { label: 'Alien', icon: '👽' }
];

export const AMMO_CONFIG: Record<AmmoType, { name: string, damageMult: number, price: number, color: string, traceColor: string }> = {
    iron: { name: 'Iron Heads', damageMult: 1.0, price: 100, color: '#fbbf24', traceColor: 'rgba(251, 191, 36, 0.6)' },
    titanium: { name: 'Titanium Heads', damageMult: 1.5, price: 250, color: '#22d3ee', traceColor: 'rgba(34, 211, 238, 0.6)' },
    cobalt: { name: 'Cobalt Heads', damageMult: 2.0, price: 500, color: '#2563eb', traceColor: 'rgba(37, 99, 235, 0.6)' },
    iridium: { name: 'Iridium Heads', damageMult: 3.0, price: 1000, color: '#d946ef', traceColor: 'rgba(217, 70, 239, 0.6)' },
    tungsten: { name: 'Tungsten Rods', damageMult: 4.0, price: 2000, color: '#94a3b8', traceColor: 'rgba(148, 163, 184, 0.8)' },
    explosive: { name: 'HE Rounds', damageMult: 5.0, price: 3500, color: '#ef4444', traceColor: 'rgba(239, 68, 68, 0.8)' }
};

export const AMMO_MARKET_ITEMS = [
    { id: 'iron', name: 'Iron Rounds', price: 100, type: 'ammo', description: 'Standard kinetic rounds. 1000 count.' },
    { id: 'titanium', name: 'Titanium Rounds', price: 250, type: 'ammo', description: 'Enhanced armor piercing. 1000 count.' },
    { id: 'cobalt', name: 'Cobalt Rounds', price: 500, type: 'ammo', description: 'High velocity shield breakers. 1000 count.' },
    { id: 'iridium', name: 'Iridium Rounds', price: 1000, type: 'ammo', description: 'Maximum damage plasma-infused. 1000 count.' },
    { id: 'tungsten', name: 'Tungsten Rounds', price: 2000, type: 'ammo', description: 'Heavy kinetic penetrators. 1000 count.' },
    { id: 'explosive', name: 'HE Rounds', price: 3500, type: 'ammo', description: 'High Explosive tips. 1000 count.' }
];

export interface ExtendedShipConfig extends ShipConfig {
  gunMount: 'wing' | 'hull' | 'strut';
  wingStyle: 'delta' | 'x-wing' | 'parenthesis' | 'curved' | 'pincer' | 'cylon' | 'fork' | 'diamond' | 'hammer' | 'alien-h' | 'alien-w' | 'alien-a' | 'alien-m';
  wingCurve: 'forward' | 'backward' | 'neutral';
  hullShapeType: 'trapezoid' | 'triangle' | 'oval' | 'finger' | 'angled-flat' | 'rounded' | 'block' | 'needle' | 'saucer' | 'none';
  extraDetail?: 'reservoir' | 'antenna' | 'both' | 'none';
  maxFuel: number;
  landingGearType: 'skids' | 'mechanical' | 'telescopic' | 'insect' | 'magnetic';
  isAlien?: boolean;
  
  // Re-declare base properties to ensure type safety in components
  id: string;
  name: string;
  description: string;
  price: number;
  maxEnergy: number;
  maxCargo: number;
  speed: number;
  shape: 'arrow' | 'block' | 'wing' | 'stealth' | 'mine-layer' | 'saucer' | 'frigate' | 'star-t' | 'dragonfly';
  canLayMines: boolean;
  defaultColor?: string;
  engines: number;
  defaultGuns: number;
  noseType: 'rounded' | 'flat';
  wingConfig: 'front-heavy' | 'rear-heavy' | 'balanced';
  weaponId?: string;
  noseGunDamage: number;
  noseGunCooldown: number;
  noseGunColor: string;
}

// --- LOCKED: SHIP DESIGNS (DO NOT MODIFY WITHOUT EXPLICIT REQUEST) ---
export const SHIPS: ExtendedShipConfig[] = [
  { 
    id: 'vanguard', 
    name: 'Scout Interceptor', 
    description: 'Light single-engine craft.', 
    price: 5000, 
    maxEnergy: 1500, 
    maxCargo: 50, 
    speed: 8, 
    shape: 'arrow', 
    canLayMines: false, 
    defaultColor: '#e2e8f0', // Platinum
    engines: 1, 
    defaultGuns: 3, 
    noseType: 'rounded', 
    wingConfig: 'rear-heavy', 
    gunMount: 'hull', 
    wingStyle: 'delta', 
    wingCurve: 'backward', 
    hullShapeType: 'triangle', 
    extraDetail: 'none', 
    maxFuel: 3.0,
    landingGearType: 'skids',
    noseGunDamage: 40,
    noseGunCooldown: 300,
    noseGunColor: '#3b82f6' // Blue (Energy default)
  },
  { 
    id: 'ranger', 
    name: 'Patrol Corvette', 
    description: 'Reliable twin-engine vessel.', 
    price: 45000, 
    maxEnergy: 3500, 
    maxCargo: 200, 
    speed: 7, 
    shape: 'wing', 
    canLayMines: true, 
    defaultColor: '#0d9488', // Teal
    engines: 2, 
    defaultGuns: 3, 
    noseType: 'flat', 
    wingConfig: 'balanced', 
    gunMount: 'wing', 
    wingStyle: 'x-wing', 
    wingCurve: 'neutral', 
    hullShapeType: 'rounded', 
    extraDetail: 'antenna', 
    maxFuel: 5.0,
    landingGearType: 'mechanical',
    noseGunDamage: 60,
    noseGunCooldown: 250,
    noseGunColor: '#3b82f6' 
  },
  { 
    id: 'striker', 
    name: 'Heavy Fighter', 
    description: 'Combat-focused single-engine.', 
    price: 95000, 
    maxEnergy: 6000, 
    maxCargo: 450, 
    speed: 6.5, 
    shape: 'dragonfly', 
    canLayMines: true, 
    defaultColor: '#d97706', // Industrial Orange
    engines: 1, 
    defaultGuns: 3, 
    noseType: 'rounded', 
    wingConfig: 'front-heavy', 
    gunMount: 'strut', 
    wingStyle: 'curved', 
    wingCurve: 'forward', 
    hullShapeType: 'finger', 
    extraDetail: 'reservoir', 
    maxFuel: 7.0,
    landingGearType: 'telescopic',
    noseGunDamage: 80,
    noseGunCooldown: 200,
    noseGunColor: '#ef4444' 
  },
  { 
    id: 'eclipse', 
    name: 'Stealth Infiltrator', 
    description: 'Tri-engine inverted wing tech.', 
    price: 180000, 
    maxEnergy: 10000, 
    maxCargo: 800, 
    speed: 8.5, 
    shape: 'stealth', 
    canLayMines: true, 
    defaultColor: '#312e81', // Midnight Indigo
    engines: 1, 
    defaultGuns: 3, 
    noseType: 'flat', 
    wingConfig: 'rear-heavy', 
    gunMount: 'hull', 
    wingStyle: 'pincer', 
    wingCurve: 'forward', 
    hullShapeType: 'needle', 
    extraDetail: 'both', 
    maxFuel: 9.0,
    landingGearType: 'insect',
    noseGunDamage: 100,
    noseGunCooldown: 150,
    noseGunColor: '#3b82f6'
  },
  { 
    id: 'behemoth', 
    name: 'Star Dreadnought', 
    description: 'Tri-engine mobile fortress.', 
    price: 450000, 
    maxEnergy: 15000, 
    maxCargo: 2000, 
    speed: 4, 
    shape: 'frigate', 
    canLayMines: true, 
    defaultColor: '#be123c', // Crimson
    engines: 3, 
    defaultGuns: 3, 
    noseType: 'flat', 
    wingConfig: 'balanced', 
    gunMount: 'strut', 
    wingStyle: 'cylon', 
    wingCurve: 'backward', 
    hullShapeType: 'block', 
    extraDetail: 'both', 
    maxFuel: 12.0,
    landingGearType: 'magnetic',
    noseGunDamage: 150,
    noseGunCooldown: 100,
    noseGunColor: '#ef4444' 
  },
  // --- LOCKED: ALIEN SHIP DESIGNS (UPDATED PER REQUEST) ---
  {
    id: 'alien_h', name: 'Xenon H-Class', description: 'Heavy twin-pontoon cruiser.',
    price: 900000, maxEnergy: 20000, maxCargo: 2500, speed: 6, shape: 'block', canLayMines: true,
    defaultColor: '#3f6212', engines: 2, defaultGuns: 2, noseType: 'flat', wingConfig: 'balanced', gunMount: 'hull',
    wingStyle: 'alien-h', wingCurve: 'neutral', hullShapeType: 'none', maxFuel: 15.0, landingGearType: 'mechanical',
    isAlien: true, noseGunDamage: 200, noseGunCooldown: 300, noseGunColor: '#84cc16', weaponId: 'exotic_trident'
  },
  {
    id: 'alien_w', name: 'Xenon W-Class', description: 'Aggressive assault fighter.',
    price: 1100000, maxEnergy: 25000, maxCargo: 2000, speed: 9, shape: 'wing', canLayMines: true,
    defaultColor: '#7c2d12', engines: 2, defaultGuns: 2, noseType: 'flat', wingConfig: 'front-heavy', gunMount: 'wing',
    wingStyle: 'alien-w', wingCurve: 'forward', hullShapeType: 'none', maxFuel: 12.0, landingGearType: 'insect',
    isAlien: true, noseGunDamage: 250, noseGunCooldown: 150, noseGunColor: '#fb923c', weaponId: 'exotic_plasma_jet'
  },
  {
    id: 'alien_a', name: 'Xenon A-Class', description: 'Delta-wing interceptor.',
    price: 1300000, maxEnergy: 18000, maxCargo: 1500, speed: 11, shape: 'arrow', canLayMines: false,
    defaultColor: '#1e3a8a', engines: 2, defaultGuns: 1, noseType: 'flat', wingConfig: 'rear-heavy', gunMount: 'hull',
    wingStyle: 'alien-a', wingCurve: 'backward', hullShapeType: 'none', maxFuel: 10.0, landingGearType: 'skids',
    isAlien: true, noseGunDamage: 220, noseGunCooldown: 120, noseGunColor: '#60a5fa', weaponId: 'exotic_rainbow_cloud'
  },
  {
    id: 'alien_m', name: 'Xenon M-Class', description: 'Twin-peak heavy bomber.',
    price: 1500000, maxEnergy: 30000, maxCargo: 4000, speed: 5, shape: 'frigate', canLayMines: true,
    defaultColor: '#4c1d95', engines: 2, defaultGuns: 2, noseType: 'flat', wingConfig: 'balanced', gunMount: 'strut',
    wingStyle: 'alien-m', wingCurve: 'neutral', hullShapeType: 'none', maxFuel: 20.0, landingGearType: 'magnetic',
    isAlien: true, noseGunDamage: 300, noseGunCooldown: 200, noseGunColor: '#d8b4fe', weaponId: 'exotic_electric'
  }
];
// --- END LOCKED SHIP DESIGNS ---

// --- LOCKED: BOSS SHIP DESIGNS (UPDATED: Valid Weapons) ---
export const BOSS_SHIPS: ExtendedShipConfig[] = [
  { id: 'boss_alpha', name: 'Xenos Overlord', description: 'Heavy command ship.', price: 0, maxEnergy: 5000, maxCargo: 0, speed: 2, shape: 'frigate', canLayMines: true, engines: 6, defaultGuns: 2, noseType: 'flat', wingConfig: 'front-heavy', gunMount: 'strut', wingStyle: 'alien-h', wingCurve: 'forward', hullShapeType: 'none', maxFuel: 100, weaponId: 'exotic_trident', landingGearType: 'magnetic', noseGunDamage: 10, noseGunCooldown: 100, noseGunColor: '#f00', isAlien: true },
  { id: 'boss_beta', name: 'Void Reaver', description: 'Scythe-like wings.', price: 0, maxEnergy: 6000, maxCargo: 0, speed: 3, shape: 'stealth', canLayMines: true, engines: 4, defaultGuns: 1, noseType: 'rounded', wingConfig: 'rear-heavy', gunMount: 'strut', wingStyle: 'alien-a', wingCurve: 'backward', hullShapeType: 'none', maxFuel: 100, weaponId: 'exotic_rainbow_cloud', landingGearType: 'insect', noseGunDamage: 10, noseGunCooldown: 100, noseGunColor: '#f00', isAlien: true },
  { id: 'boss_gamma', name: 'Star Devourer', description: 'Diamond hull titan.', price: 0, maxEnergy: 8000, maxCargo: 0, speed: 1.5, shape: 'star-t', canLayMines: true, engines: 8, defaultGuns: 2, noseType: 'flat', wingConfig: 'balanced', gunMount: 'strut', wingStyle: 'alien-m', wingCurve: 'neutral', hullShapeType: 'none', maxFuel: 100, weaponId: 'exotic_electric', landingGearType: 'mechanical', noseGunDamage: 10, noseGunCooldown: 100, noseGunColor: '#f00', isAlien: true },
];
// --- END LOCKED BOSS DESIGNS ---

// WEAPONS UPDATED: Energy=Blue, Projectile=Red
export const WEAPONS: Weapon[] = [
  // Level 1 Standard Energy
  { id: 'gun_pulse', name: 'Pulse Laser', type: WeaponType.LASER, price: 2000, damage: 25, fireRate: 4, energyCost: 3, cargoWeight: 3, isAmmoBased: false, beamColor: '#3b82f6', barrelCount: 1 },
  // Level 4 High-End Energy
  { id: 'gun_photon', name: 'Photon Emitter', type: WeaponType.LASER, price: 100000, damage: 60, fireRate: 8, energyCost: 5, cargoWeight: 5, isAmmoBased: false, beamColor: '#3b82f6', barrelCount: 1 },
  
  // Standard Projectile (UPDATED: gun_bolt became Ion Emitter / LASER)
  { id: 'gun_bolt', name: 'Ion Emitter', type: WeaponType.LASER, price: 5000, damage: 45, fireRate: 2, energyCost: 10, cargoWeight: 4, isAmmoBased: false, beamColor: '#3b82f6', barrelCount: 1 },
  { id: 'gun_vulcan', name: 'Rotary Vulcan', type: WeaponType.PROJECTILE, price: 15000, damage: 35, fireRate: 4, energyCost: 0, cargoWeight: 10, isAmmoBased: true, beamColor: '#ef4444', barrelCount: 3, defaultAmmo: 'titanium' }, 
  { id: 'gun_heavy', name: 'Heavy Chaingun', type: WeaponType.PROJECTILE, price: 35000, damage: 30, fireRate: 6, energyCost: 0, cargoWeight: 25, isAmmoBased: true, beamColor: '#ef4444', barrelCount: 6, defaultAmmo: 'cobalt' }, 
  { id: 'gun_plasma', name: 'Iron Driver', type: WeaponType.PROJECTILE, price: 85000, damage: 25, fireRate: 8, energyCost: 0, cargoWeight: 30, isAmmoBased: true, beamColor: '#ef4444', barrelCount: 1, defaultAmmo: 'iridium' } 
];

// 9 DISTINCT FANTASY EXOTIC WEAPONS
export const EXOTIC_WEAPONS: Weapon[] = [
  // 1. Solar Flare: Round balls of fire, color based on crystal
  { id: 'exotic_fireball', name: 'Solar Flare', type: WeaponType.PROJECTILE, price: 250000, damage: 300, fireRate: 5, energyCost: 3, cargoWeight: 0, isAmmoBased: false, beamColor: '#f97316', barrelCount: 1 }, 
  
  // 2. Magma Slug: Plasma jets, thin head/tail, fat middle (elongated)
  { id: 'exotic_plasma_jet', name: 'Magma Slug', type: WeaponType.PROJECTILE, price: 275000, damage: 350, fireRate: 4, energyCost: 3, cargoWeight: 0, isAmmoBased: false, beamColor: '#ef4444', barrelCount: 1 }, 
  
  // 3. Arc Generator: Shoots electricity (lightning) - STRONGEST
  { id: 'exotic_electric', name: 'Arc Generator', type: WeaponType.LASER, price: 600000, damage: 600, fireRate: 5, energyCost: 4, cargoWeight: 0, isAmmoBased: false, beamColor: '#00ffff', barrelCount: 3 }, 
  
  // 4. Sonic Ring: Shoots rings of plasma
  { id: 'exotic_wave', name: 'Sonic Ring', type: WeaponType.PROJECTILE, price: 320000, damage: 280, fireRate: 6, energyCost: 3, cargoWeight: 0, isAmmoBased: false, beamColor: '#8b5cf6', barrelCount: 1 }, 
  
  // 5. Void Comet: Round energy ball with gas tail
  { id: 'exotic_comet', name: 'Void Comet', type: WeaponType.PROJECTILE, price: 350000, damage: 450, fireRate: 3, energyCost: 5, cargoWeight: 0, isAmmoBased: false, beamColor: '#d8b4fe', barrelCount: 1 }, 
  
  // 6. Dragon Breath: Flamethrower (Short range, high falloff, high rate) - CHEAPEST
  { id: 'exotic_flamer', name: 'Dragon Breath', type: WeaponType.PROJECTILE, price: 120000, damage: 35, fireRate: 15, energyCost: 2, cargoWeight: 0, isAmmoBased: false, beamColor: '#ef4444', barrelCount: 3 }, 
  
  // 7. Trident Beam: 3 Parallel bullets
  { id: 'exotic_trident', name: 'Trident Beam', type: WeaponType.LASER, price: 420000, damage: 150, fireRate: 5, energyCost: 4, cargoWeight: 0, isAmmoBased: false, beamColor: '#34d399', barrelCount: 3 }, 
  
  // 8. Chaos Spreader: Scatter bullets large angle - Rotating Stars
  { id: 'exotic_scatter', name: 'Chaos Spreader', type: WeaponType.PROJECTILE, price: 450000, damage: 120, fireRate: 8, energyCost: 3, cargoWeight: 0, isAmmoBased: false, beamColor: '#fbbf24', barrelCount: 6 }, 

  // 9. Plasma Rainbow: 6 bullets, 90 deg coverage, Red/Yellow/Blue
  { id: 'exotic_rainbow_cloud', name: 'Plasma Rainbow', type: WeaponType.LASER, price: 550000, damage: 200, fireRate: 6, energyCost: 4, cargoWeight: 0, isAmmoBased: false, beamColor: '#ffffff', barrelCount: 6 }
];

export const SHIELDS: Shield[] = [
  { id: 'sh_alpha', name: 'Cobalt Blue Front', price: 10000, capacity: 250, regenRate: 5, energyCost: 20, visualType: 'forward', color: '#3b82f6' }, 
  { id: 'sh_beta', name: 'Solar Red Glow', price: 25000, capacity: 500, regenRate: 10, energyCost: 40, visualType: 'forward', color: '#ef4444' }, 
  { id: 'sh_gamma', name: 'Omni-Sphere Crystal', price: 75000, capacity: 1200, regenRate: 25, energyCost: 80, visualType: 'inner-full', color: '#38bdf8' }
];

export const EXOTIC_SHIELDS: Shield[] = [
  { id: 'exotic_sh_void', name: 'Void Mantle', price: 500000, capacity: 3500, regenRate: 50, energyCost: 150, visualType: 'inner-full', color: '#a855f7' },
  { id: 'exotic_sh_plasma', name: 'Plasma Aegis', price: 600000, capacity: 2800, regenRate: 80, energyCost: 200, visualType: 'inner-full', color: '#10b981' },
  { id: 'exotic_sh_pulsar', name: 'Pulsar Starfield', price: 750000, capacity: 5000, regenRate: 20, energyCost: 100, visualType: 'inner-full', color: '#fbbf24' }
];

export const BOSS_EXOTIC_SHIELDS = [
  { id: 'boss_sh_kinetic', color: '#f97316', type: 'kinetic', name: 'Kinetic Barrier', immunity: 'kinetic' },
  { id: 'boss_sh_energy', color: '#3b82f6', type: 'energy', name: 'Energy Dampener', immunity: 'energy' },
  { id: 'boss_sh_regen', color: '#a855f7', type: 'regen', name: 'Phased Array', immunity: 'none' },
  { id: 'boss_sh_heavy', color: '#ffffff', type: 'heavy', name: 'Hardened Shell', immunity: 'none' },
  { id: 'boss_sh_reactive', color: '#10b981', type: 'reactive', name: 'Reactive Matrix', immunity: 'none' }
];

export const DEFENSE_SYSTEMS = [
  { id: 'df_flares', name: 'Flare Dispenser Mk I', price: 15000, description: 'Anti-missile countermeasure system.' }
];

export const EXPLODING_ORDNANCE = [
  { id: 'ord_missile_light', name: 'Sparrow Missiles', price: 8000, count: 10 },
  { id: 'ord_missile_heavy', name: 'Titan Missiles', price: 25000, count: 10 },
  { id: 'ord_missile_emp', name: 'EMP Shock Missiles', price: 35000, count: 10 },
  { id: 'ord_mine_plasma', name: 'Plasma Core Mines', price: 45000, count: 10 },
  { id: 'ord_mine_emp', name: 'EMP Auto-Mines', price: 30000, count: 10 },
  // Omega Mine: Powerful red mine
  { id: 'ord_mine_red', name: 'Omega Mine', price: 150000, count: 5 }
];

export const COMMODITIES = [
    { id: 'bot_repair', name: 'Repair Robot', price: 2000, type: 'robot', description: 'Auto-repair drone. Repairs hull using resources. If hull integrity drops below 90%, robots sacrifice themselves to block incoming fire.' },
    { id: 'can_fuel', name: 'Fuel Cell', price: 200, type: 'fuel' },
    { id: 'batt_cell', name: 'Energy Cell', price: 300, type: 'energy' },
    { id: 'pack_repair', name: 'Nanite Pack', price: 500, type: 'repair' },
    { id: 'water', name: 'Water Container', price: 50, type: 'water' },
    { id: 'iron', name: 'Iron Ingot', price: 100, type: 'iron' },
    { id: 'copper', name: 'Copper Spool', price: 200, type: 'copper' },
    { id: 'chromium', name: 'Chromium', price: 500, type: 'chromium' },
    { id: 'titanium', name: 'Titanium', price: 800, type: 'titanium' },
    { id: 'gold', name: 'Gold Bullion', price: 1000, type: 'gold' },
    { id: 'platinum', name: 'Platinum Ingot', price: 2500, type: 'platinum' },
    { id: 'lithium', name: 'Lithium Crystal', price: 4000, type: 'lithium' }
];

export const ENGINES = [
  { id: 'standard', name: 'Solid State', price: 0, boost: 1.0 },
  { id: 'fusion', name: 'Fusion Core', price: 15000, boost: 1.4 },
  { id: 'afterburner', name: 'Nitro Burner', price: 30000, boost: 1.8 }
];

export const PLANETS: Planet[] = [
  { id: 'p1', name: 'New Horizon', description: 'Central hub of the Terran Alliance.', difficulty: 1, status: 'friendly', orbitRadius: 60, orbitSpeed: 0.005, orbitDirection: 1, size: 2.5, color: '#064e3b', quadrant: QuadrantType.ALFA, moons: [] },
  { id: 'p2', name: 'Aegis IV', description: 'Shield production world under threat.', difficulty: 2, status: 'siege', orbitRadius: 100, orbitSpeed: 0.003, size: 2.0, color: '#334155', quadrant: QuadrantType.ALFA, moons: [] },
  { id: 'p3', name: 'Vulcan Forge', description: 'Weapon testing site.', difficulty: 3, status: 'occupied', orbitRadius: 80, orbitSpeed: 0.004, size: 3.2, color: '#991b1b', quadrant: QuadrantType.ALFA, moons: [] },
  { id: 'p4', name: 'Tundra Prime', description: 'Frozen wasteland.', difficulty: 4, status: 'siege', orbitRadius: 140, orbitSpeed: 0.002, size: 2.8, color: '#60a5fa', quadrant: QuadrantType.BETA, moons: [] },
  { id: 'p5', name: 'Crystalline Void', description: 'Anomalous sector.', difficulty: 5, status: 'occupied', orbitRadius: 90, orbitSpeed: 0.006, size: 2.1, color: '#a855f7', quadrant: QuadrantType.BETA, moons: [] },
  { id: 'p6', name: 'Bio-Sphere X', description: 'Reclaimed by alien fauna.', difficulty: 6, status: 'siege', orbitRadius: 120, orbitSpeed: 0.002, size: 3.5, color: '#10b981', quadrant: QuadrantType.BETA, moons: [] },
  { id: 'p9', name: 'Neon Outpost', description: 'Hyper-visual frontier station.', difficulty: 7, status: 'occupied', orbitRadius: 100, orbitSpeed: 0.003, size: 2.5, color: '#e11d48', quadrant: QuadrantType.GAMA, moons: [] },
  { id: 'p7', name: 'Dread Shore', description: 'Dark matter refinery.', difficulty: 8, status: 'occupied', orbitRadius: 70, orbitSpeed: 0.008, size: 4.0, color: '#1e40af', quadrant: QuadrantType.GAMA, moons: [] },
  { id: 'p10', name: 'Prism Core', description: 'Crystallized tectonic world.', difficulty: 9, status: 'siege', orbitRadius: 80, orbitSpeed: 0.005, size: 2.8, color: '#fb7185', quadrant: QuadrantType.GAMA, moons: [] },
  { id: 'p8', name: 'Final Frontier', description: 'Absolute edge of colonized space.', difficulty: 10, status: 'siege', orbitRadius: 150, orbitSpeed: 0.001, size: 2.5, color: '#ffffff', quadrant: QuadrantType.DELTA, moons: [] },
  { id: 'p11', name: 'Singularity Rift', description: 'Gravitational anomaly nexus.', difficulty: 11, status: 'occupied', orbitRadius: 110, orbitSpeed: 0.002, size: 3.2, color: '#4c1d95', quadrant: QuadrantType.DELTA, moons: [] },
  { id: 'p12', name: 'Omega Terminus', description: 'The absolute edge of existence.', difficulty: 12, status: 'siege', orbitRadius: 140, orbitSpeed: 0.001, size: 4.0, color: '#15803d', quadrant: QuadrantType.DELTA, moons: [] }
];
