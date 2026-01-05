
// CHECKPOINT: Defender V85.00
// VERSION: V85.00 - OVERLOAD MECHANICS
import { ShipConfig, Weapon, Shield, WeaponType, Planet, QuadrantType } from './types';

export const INITIAL_CREDITS = 250000;

export interface ExtendedShipConfig extends ShipConfig {
  gunMount: 'wing' | 'hull' | 'strut';
  wingStyle: 'delta' | 'x-wing' | 'parenthesis' | 'curved' | 'pincer' | 'cylon' | 'fork' | 'diamond' | 'hammer';
  wingCurve: 'forward' | 'backward' | 'neutral';
  hullShapeType: 'trapezoid' | 'triangle' | 'oval' | 'finger' | 'angled-flat' | 'rounded' | 'block' | 'needle';
  extraDetail?: 'reservoir' | 'antenna' | 'both' | 'none';
  maxFuel: number;
  // Explicitly redeclare properties to ensure visibility if inheritance has issues
  id: string;
  maxEnergy: number;
  engines: number;
  defaultGuns: number;
  defaultColor?: string;
  weaponId?: string;
}

export const SHIPS: ExtendedShipConfig[] = [
  { id: 'vanguard', name: 'Gray Interceptor', description: 'Standard Initiative hull.', price: 5000, maxEnergy: 1500, maxCargo: 50, speed: 6, shape: 'arrow', canLayMines: false, defaultColor: '#94a3b8', engines: 1, defaultGuns: 1, noseType: 'rounded', wingConfig: 'rear-heavy', gunMount: 'hull', wingStyle: 'delta', wingCurve: 'backward', hullShapeType: 'triangle', extraDetail: 'none', maxFuel: 1.0 },
  { id: 'ufo', name: 'Disk Mk. II', description: 'Advanced saucer hull.', price: 30000, maxEnergy: 3000, maxCargo: 40, speed: 7, shape: 'saucer', canLayMines: false, defaultColor: '#64748b', engines: 1, defaultGuns: 1, noseType: 'rounded', wingConfig: 'balanced', gunMount: 'hull', wingStyle: 'parenthesis', wingCurve: 'neutral', hullShapeType: 'oval', extraDetail: 'antenna', maxFuel: 2.0 },
  { id: 'dragonfly', name: 'V-Dragon', description: 'Front-maneuvering canards.', price: 45000, maxEnergy: 4500, maxCargo: 60, speed: 8, shape: 'dragonfly', canLayMines: false, defaultColor: '#475569', engines: 2, defaultGuns: 2, noseType: 'rounded', wingConfig: 'front-heavy', gunMount: 'wing', wingStyle: 'curved', wingCurve: 'forward', hullShapeType: 'finger', extraDetail: 'reservoir', maxFuel: 3.0 },
  { id: 'star_t', name: 'Vector T-9', description: 'Heavy chassis.', price: 65000, maxEnergy: 6000, maxCargo: 50, speed: 7.5, shape: 'star-t', canLayMines: false, defaultColor: '#cbd5e1', engines: 2, defaultGuns: 2, noseType: 'flat', wingConfig: 'rear-heavy', gunMount: 'strut', wingStyle: 'delta', wingCurve: 'backward', hullShapeType: 'trapezoid', extraDetail: 'both', maxFuel: 4.0 },
  { id: 'rebel_wing', name: 'Aurora-X', description: 'Classic strike craft.', price: 85000, maxEnergy: 8000, maxCargo: 80, speed: 6.5, shape: 'wing', canLayMines: false, defaultColor: '#64748b', engines: 2, defaultGuns: 2, noseType: 'rounded', wingConfig: 'balanced', gunMount: 'wing', wingStyle: 'x-wing', wingCurve: 'neutral', hullShapeType: 'rounded', extraDetail: 'none', maxFuel: 5.0 },
  { id: 'frigate_b5', name: 'Sentinel Hub', description: 'Exterior gun platforms.', price: 125000, maxEnergy: 12000, maxCargo: 150, speed: 5, shape: 'frigate', canLayMines: true, defaultColor: '#4b5563', engines: 4, defaultGuns: 2, noseType: 'flat', wingConfig: 'front-heavy', gunMount: 'strut', wingStyle: 'curved', wingCurve: 'forward', hullShapeType: 'angled-flat', extraDetail: 'antenna', maxFuel: 6.0 },
  { id: 'galactica', name: 'Steel Aegis', description: 'Heavy transport.', price: 160000, maxEnergy: 1500, maxCargo: 500, speed: 4, shape: 'block', canLayMines: true, defaultColor: '#334155', engines: 1, defaultGuns: 2, noseType: 'rounded', wingConfig: 'rear-heavy', gunMount: 'hull', wingStyle: 'parenthesis', wingCurve: 'backward', hullShapeType: 'block', extraDetail: 'reservoir', maxFuel: 7.0 },
  { id: 'enterprise', name: 'USS Sovereign', description: 'Saucer section.', price: 230000, maxEnergy: 20000, maxCargo: 200, speed: 5.5, shape: 'mine-layer', canLayMines: true, defaultColor: '#e2e8f0', engines: 2, defaultGuns: 1, noseType: 'rounded', wingConfig: 'balanced', gunMount: 'hull', wingStyle: 'parenthesis', wingCurve: 'neutral', hullShapeType: 'oval', extraDetail: 'antenna', maxFuel: 8.0 },
  { id: 'dreadnought', name: 'Void Wraith', description: 'Stealth destroyer.', price: 380000, maxEnergy: 25000, maxCargo: 1000, speed: 3.5, shape: 'stealth', canLayMines: true, defaultColor: '#1e1e24', engines: 2, defaultGuns: 2, noseType: 'flat', wingConfig: 'front-heavy', gunMount: 'strut', wingStyle: 'cylon', wingCurve: 'backward', hullShapeType: 'angled-flat', extraDetail: 'none', maxFuel: 9.0 },
  { id: 'obsidian_claw', name: 'Obsidian Claw', description: 'Aggressive pincer wings.', price: 450000, maxEnergy: 30000, maxCargo: 300, speed: 7, shape: 'arrow', canLayMines: false, defaultColor: '#0f172a', engines: 3, defaultGuns: 2, noseType: 'rounded', wingConfig: 'front-heavy', gunMount: 'strut', wingStyle: 'pincer', wingCurve: 'forward', hullShapeType: 'finger', extraDetail: 'reservoir', maxFuel: 10.0 },
  { id: 'titan_forge', name: 'Titan Forge', description: 'Industrial hauler.', price: 520000, maxEnergy: 35000, maxCargo: 2500, speed: 3, shape: 'block', canLayMines: true, defaultColor: '#44403c', engines: 1, defaultGuns: 2, noseType: 'flat', wingConfig: 'rear-heavy', gunMount: 'strut', wingStyle: 'delta', wingCurve: 'neutral', hullShapeType: 'trapezoid', extraDetail: 'both', maxFuel: 10.0 },
  { id: 'phoenix_prime', name: 'Phoenix Prime', description: 'Experimental curved wing.', price: 750000, maxEnergy: 50000, maxCargo: 600, speed: 9, shape: 'dragonfly', canLayMines: false, defaultColor: '#991b1b', engines: 4, defaultGuns: 2, noseType: 'rounded', wingConfig: 'balanced', gunMount: 'wing', wingStyle: 'curved', wingCurve: 'forward', hullShapeType: 'triangle', extraDetail: 'antenna', maxFuel: 10.0 }
];

export const BOSS_SHIPS: ExtendedShipConfig[] = [
  { id: 'boss_alpha', name: 'Xenos Overlord', description: 'Heavy command ship.', price: 0, maxEnergy: 5000, maxCargo: 0, speed: 2, shape: 'frigate', canLayMines: true, engines: 6, defaultGuns: 2, noseType: 'flat', wingConfig: 'front-heavy', gunMount: 'strut', wingStyle: 'cylon', wingCurve: 'forward', hullShapeType: 'angled-flat', maxFuel: 100, weaponId: 'exotic_bubbles' },
  { id: 'boss_beta', name: 'Void Reaver', description: 'Scythe-like wings.', price: 0, maxEnergy: 6000, maxCargo: 0, speed: 3, shape: 'stealth', canLayMines: true, engines: 4, defaultGuns: 2, noseType: 'rounded', wingConfig: 'rear-heavy', gunMount: 'strut', wingStyle: 'pincer', wingCurve: 'backward', hullShapeType: 'needle', maxFuel: 100, weaponId: 'exotic_venom' },
  { id: 'boss_gamma', name: 'Star Devourer', description: 'Diamond hull titan.', price: 0, maxEnergy: 8000, maxCargo: 0, speed: 1.5, shape: 'star-t', canLayMines: true, engines: 8, defaultGuns: 2, noseType: 'flat', wingConfig: 'balanced', gunMount: 'strut', wingStyle: 'diamond', wingCurve: 'neutral', hullShapeType: 'trapezoid', maxFuel: 100, weaponId: 'exotic_fan' },
  { id: 'boss_delta', name: 'Eclipse Hammer', description: 'Brute force design.', price: 0, maxEnergy: 10000, maxCargo: 0, speed: 1, shape: 'block', canLayMines: true, engines: 2, defaultGuns: 2, noseType: 'flat', wingConfig: 'rear-heavy', gunMount: 'hull', wingStyle: 'hammer', wingCurve: 'neutral', hullShapeType: 'block', maxFuel: 100, weaponId: 'exotic_seeker' },
  { id: 'boss_epsilon', name: 'Neural Scourge', description: 'Organic-looking curves.', price: 0, maxEnergy: 4500, maxCargo: 0, speed: 5, shape: 'dragonfly', canLayMines: true, engines: 4, defaultGuns: 2, noseType: 'rounded', wingConfig: 'front-heavy', gunMount: 'wing', wingStyle: 'curved', wingCurve: 'forward', hullShapeType: 'finger', maxFuel: 100, weaponId: 'exotic_flame' },
  { id: 'boss_zeta', name: 'Obsidian Monolith', description: 'Tall vertical hull.', price: 0, maxEnergy: 12000, maxCargo: 0, speed: 0.8, shape: 'frigate', canLayMines: true, engines: 4, defaultGuns: 2, noseType: 'flat', wingConfig: 'rear-heavy', gunMount: 'strut', wingStyle: 'delta', wingCurve: 'backward', hullShapeType: 'trapezoid', maxFuel: 100, weaponId: 'exotic_nova' },
  { id: 'boss_eta', name: 'Kraken Dread', description: 'Multi-forked wing system.', price: 0, maxEnergy: 9000, maxCargo: 0, speed: 2.5, shape: 'wing', canLayMines: true, engines: 10, defaultGuns: 2, noseType: 'rounded', wingConfig: 'balanced', gunMount: 'wing', wingStyle: 'fork', wingCurve: 'forward', hullShapeType: 'rounded', maxFuel: 100, weaponId: 'exotic_plasma_ball' },
  { id: 'boss_theta', name: 'Wraith Wing', description: 'Almost invisible geometry.', price: 0, maxEnergy: 5500, maxCargo: 0, speed: 6, shape: 'stealth', canLayMines: true, engines: 2, defaultGuns: 1, noseType: 'rounded', wingConfig: 'front-heavy', gunMount: 'hull', wingStyle: 'cylon', wingCurve: 'backward', hullShapeType: 'needle', maxFuel: 100, weaponId: 'exotic_mining_laser' },
  { id: 'boss_iota', name: 'Solar Fortress', description: 'Glow-heavy plating.', price: 0, maxEnergy: 15000, maxCargo: 0, speed: 0.5, shape: 'saucer', canLayMines: true, engines: 1, defaultGuns: 2, noseType: 'rounded', wingConfig: 'balanced', gunMount: 'hull', wingStyle: 'parenthesis', wingCurve: 'neutral', hullShapeType: 'oval', maxFuel: 100, weaponId: 'exotic_arc' },
  { id: 'boss_kappa', name: 'Final Nemesis', description: 'The absolute threat.', price: 0, maxEnergy: 25000, maxCargo: 0, speed: 2, shape: 'star-t', canLayMines: true, engines: 12, defaultGuns: 2, noseType: 'flat', wingConfig: 'front-heavy', gunMount: 'strut', wingStyle: 'x-wing', wingCurve: 'forward', hullShapeType: 'needle', maxFuel: 100, weaponId: 'exotic_gravity' },
];

// REGULAR WEAPONS: 2, 4, 6, 8 per second
export const WEAPONS: Weapon[] = [
  { id: 'gun_bolt', name: 'Ion Pulse', type: WeaponType.PROJECTILE, price: 5000, damage: 25, fireRate: 2, energyCost: 10, cargoWeight: 4, isAmmoBased: false, beamColor: '#60a5fa' },
  { id: 'gun_heavy', name: 'Heavy Autocannon', type: WeaponType.PROJECTILE, price: 35000, damage: 45, fireRate: 4, energyCost: 40, cargoWeight: 25, isAmmoBased: true, beamColor: '#f87171' },
  { id: 'gun_plasma', name: 'Plasma Shredder', type: WeaponType.PROJECTILE, price: 85000, damage: 70, fireRate: 6, energyCost: 100, cargoWeight: 30, isAmmoBased: false, beamColor: '#10b981' },
  { id: 'gun_vulcan', name: 'Rotary Vulcan', type: WeaponType.PROJECTILE, price: 15000, damage: 15, fireRate: 8, energyCost: 20, cargoWeight: 10, isAmmoBased: true, beamColor: '#fbbf24' },
];

// EXOTIC WEAPONS: 3 to 12 per second. HIGHER LEVEL = FASTER + STRONGER
export const EXOTIC_WEAPONS: Weapon[] = [
  // TIER 1: SIMPLE (3-5 Shots/s, Lower Power)
  { id: 'exotic_bubbles', name: 'Void Sphere', type: WeaponType.PROJECTILE, price: 0, damage: 55, fireRate: 3, energyCost: 15, cargoWeight: 0, isAmmoBased: false, beamColor: '#00ffff' }, // Cyan
  { id: 'exotic_venom', name: 'Bio-Plasma', type: WeaponType.PROJECTILE, price: 0, damage: 60, fireRate: 4, energyCost: 20, cargoWeight: 0, isAmmoBased: false, beamColor: '#39ff14' }, // Neon Green
  { id: 'exotic_fan', name: 'Scatter Spindle', type: WeaponType.PROJECTILE, price: 0, damage: 65, fireRate: 5, energyCost: 35, cargoWeight: 0, isAmmoBased: false, beamColor: '#ffff00' }, // Yellow
  
  // TIER 2: MODERATE (6-8 Shots/s, Medium Power)
  { id: 'exotic_seeker', name: 'Neutron Dart', type: WeaponType.PROJECTILE, price: 0, damage: 80, fireRate: 6, energyCost: 25, cargoWeight: 0, isAmmoBased: false, beamColor: '#ff00ff' }, // Magenta
  { id: 'exotic_flame', name: 'Inferno Jet', type: WeaponType.PROJECTILE, price: 0, damage: 85, fireRate: 7, energyCost: 20, cargoWeight: 0, isAmmoBased: false, beamColor: '#ff4500' }, // OrangeRed
  { id: 'exotic_nova', name: 'Star Shard', type: WeaponType.PROJECTILE, price: 0, damage: 95, fireRate: 8, energyCost: 60, cargoWeight: 0, isAmmoBased: false, beamColor: '#ffffff' }, // White
  
  // TIER 3: COMPLEX (9-10 Shots/s, High Power)
  { id: 'exotic_plasma_ball', name: 'Magma Bolt', type: WeaponType.PROJECTILE, price: 0, damage: 120, fireRate: 9, energyCost: 130, cargoWeight: 0, isAmmoBased: false, beamColor: '#ff8c00' }, // DarkOrange
  { id: 'exotic_mining_laser', name: 'Proton Lance', type: WeaponType.LASER, price: 0, damage: 150, fireRate: 9.5, energyCost: 45, cargoWeight: 0, isAmmoBased: false, beamColor: '#00bfff' }, // DeepSkyBlue
  { id: 'exotic_wave', name: 'Plasma Ring', type: WeaponType.LASER, price: 0, damage: 180, fireRate: 10, energyCost: 35, cargoWeight: 0, isAmmoBased: false, beamColor: '#9400d3' }, // DarkViolet
  
  // TIER 4: SOPHISTICATED (11-12 Shots/s, Extreme Power)
  { id: 'exotic_arc', name: 'Arc Lash', type: WeaponType.LASER, price: 0, damage: 220, fireRate: 11, energyCost: 110, cargoWeight: 0, isAmmoBased: false, beamColor: '#1e90ff' }, // DodgerBlue
  { id: 'exotic_bolt', name: 'Zeus Thunderbolt', type: WeaponType.LASER, price: 0, damage: 280, fireRate: 11.5, energyCost: 65, cargoWeight: 0, isAmmoBased: false, beamColor: '#4169e1' }, // RoyalBlue
  { id: 'exotic_gravity', name: 'Singularity Shot', type: WeaponType.LASER, price: 0, damage: 350, fireRate: 12, energyCost: 180, cargoWeight: 0, isAmmoBased: false, beamColor: '#dda0dd' }, // Plum
];

export const SHIELDS: Shield[] = [
  { id: 'sh_alpha', name: 'Cobalt Blue Front', price: 10000, capacity: 250, regenRate: 5, energyCost: 20, visualType: 'forward', color: '#3b82f6' }, 
  { id: 'sh_beta', name: 'Solar Red Glow', price: 25000, capacity: 500, regenRate: 10, energyCost: 40, visualType: 'forward', color: '#ef4444' }, 
  { id: 'sh_gamma', name: 'Omni-Sphere Crystal', price: 75000, capacity: 1200, regenRate: 25, energyCost: 80, visualType: 'inner-full', color: '#38bdf8' },
  { id: 'sh_omega', name: 'Nova Kinetic Shell', price: 150000, capacity: 2000, regenRate: 35, energyCost: 120, visualType: 'inner-full', color: '#d946ef' }
];

export const EXOTIC_SHIELDS: Shield[] = [
  { id: 'exotic_sh_void', name: 'Void Mantle', price: 0, capacity: 3500, regenRate: 50, energyCost: 150, visualType: 'inner-full', color: '#a855f7' },
  { id: 'exotic_sh_plasma', name: 'Plasma Aegis', price: 0, capacity: 2800, regenRate: 80, energyCost: 200, visualType: 'inner-full', color: '#10b981' },
  { id: 'exotic_sh_pulsar', name: 'Pulsar Starfield', price: 0, capacity: 5000, regenRate: 20, energyCost: 100, visualType: 'inner-full', color: '#fbbf24' }
];

export const DEFENSE_SYSTEMS = [
  { id: 'df_flares', name: 'Flare Dispenser Mk I', price: 15000, description: 'Anti-missile countermeasure system.' }
];

export const EXPLODING_ORDNANCE = [
  { id: 'ord_missile_light', name: 'Sparrow Missiles', price: 8000, count: 10 },
  { id: 'ord_missile_heavy', name: 'Titan Missiles', price: 25000, count: 10 },
  { id: 'ord_missile_emp', name: 'EMP Shock Missiles', price: 35000, count: 10 },
  { id: 'ord_mine_std', name: 'Gravity Mines', price: 12000, count: 10 },
  { id: 'ord_mine_plasma', name: 'Plasma Core Mines', price: 45000, count: 10 }
];

export const ENGINES = [
  { id: 'standard', name: 'Solid State', price: 0, boost: 1.0 },
  { id: 'fusion', name: 'Fusion Core', price: 15000, boost: 1.4 },
  { id: 'afterburner', name: 'Nitro Burner', price: 30000, boost: 1.8 }
];

export const REACTORS = [
  { id: 1, name: 'Core Mk I', price: 0, capacity: 100 },
  { id: 2, name: 'Core Mk II', price: 20000, capacity: 250 }
];

export const PLANETS: Planet[] = [
  { id: 'p1', name: 'New Horizon', description: 'Central hub of the Terran Alliance.', difficulty: 1, status: 'friendly', orbitRadius: 60, orbitSpeed: 0.005, orbitDirection: 1, size: 2.5, color: '#064e3b', quadrant: QuadrantType.ALFA, moons: [] },
  { id: 'p2', name: 'Aegis IV', description: 'Shield production world under threat.', difficulty: 2, status: 'siege', orbitRadius: 100, orbitSpeed: 0.003, size: 2.0, color: '#334155', quadrant: QuadrantType.ALFA, moons: [] },
  { id: 'p3', name: 'Vulcan Forge', description: 'Weapon testing site.', difficulty: 3, status: 'occupied', orbitRadius: 80, orbitSpeed: 0.004, size: 3.2, color: '#991b1b', quadrant: QuadrantType.ALFA, moons: [] },
  
  { id: 'p4', name: 'Tundra Prime', description: 'Frozen wasteland.', difficulty: 4, status: 'siege', orbitRadius: 140, orbitSpeed: 0.002, size: 2.8, color: '#60a5fa', quadrant: QuadrantType.BETA, moons: [] },
  { id: 'p5', name: 'Crystalline Void', description: 'Anomalous sector.', difficulty: 5, status: 'occupied', orbitRadius: 90, orbitSpeed: 0.006, size: 2.1, color: '#a855f7', quadrant: QuadrantType.BETA, moons: [] },
  { id: 'p6', name: 'Bio-Sphere X', description: 'Reclaimed by alien fauna.', difficulty: 6, status: 'siege', orbitRadius: 120, orbitSpeed: 0.002, size: 3.5, color: '#10b981', quadrant: QuadrantType.BETA, moons: [] },
  
  { id: 'p9', name: 'Neon Outpost', description: 'Hyper-visual frontier station.', difficulty: 7, status: 'occupied', orbitRadius: 100, orbitSpeed: 0.003, size: 2.5, color: '#e11d48', quadrant: QuadrantType.GAMA, moons: [] },
  { id: 'p7', name: 'Dread Shore', description: 'Dark matter refinery.', difficulty: 8, status: 'occupied', orbitRadius: 70, orbitSpeed: 0.008, size: 4.0, color: '#171717', quadrant: QuadrantType.GAMA, moons: [] },
  { id: 'p10', name: 'Prism Core', description: 'Crystallized tectonic world.', difficulty: 9, status: 'siege', orbitRadius: 80, orbitSpeed: 0.005, size: 2.8, color: '#fb7185', quadrant: QuadrantType.GAMA, moons: [] },
  
  { id: 'p8', name: 'Final Frontier', description: 'Absolute edge of colonized space.', difficulty: 10, status: 'siege', orbitRadius: 150, orbitSpeed: 0.001, size: 2.5, color: '#ffffff', quadrant: QuadrantType.DELTA, moons: [] },
  { id: 'p11', name: 'Singularity Rift', description: 'Gravitational anomaly nexus.', difficulty: 11, status: 'occupied', orbitRadius: 110, orbitSpeed: 0.002, size: 3.2, color: '#4c1d95', quadrant: QuadrantType.DELTA, moons: [] },
  { id: 'p12', name: 'Omega Terminus', description: 'The absolute edge of existence.', difficulty: 12, status: 'siege', orbitRadius: 140, orbitSpeed: 0.001, size: 4.0, color: '#1e293b', quadrant: QuadrantType.DELTA, moons: [] }
];