
// CHECKPOINT: Defender V79.9
// VERSION: V79.9
import { ShipConfig, Weapon, Shield, WeaponType, Planet, QuadrantType } from './types';

export const INITIAL_CREDITS = 250000;

export interface ExtendedShipConfig extends ShipConfig {
  gunMount: 'wing' | 'hull' | 'strut';
  wingStyle: 'delta' | 'x-wing' | 'parenthesis' | 'curved' | 'pincer' | 'cylon';
  wingCurve: 'forward' | 'backward' | 'neutral';
  hullShapeType: 'trapezoid' | 'triangle' | 'oval' | 'finger' | 'angled-flat' | 'rounded' | 'block';
  extraDetail?: 'reservoir' | 'antenna' | 'both' | 'none';
}

export const SHIPS: ExtendedShipConfig[] = [
  { id: 'vanguard', name: 'Gray Interceptor', description: 'Standard Initiative hull. Reliable and narrow.', price: 5000, maxEnergy: 100, maxCargo: 50, speed: 6, shape: 'arrow', canLayMines: false, defaultColor: '#94a3b8', engines: 1, defaultGuns: 1, noseType: 'rounded', wingConfig: 'rear-heavy', gunMount: 'hull', wingStyle: 'delta', wingCurve: 'backward', hullShapeType: 'triangle', extraDetail: 'none' },
  { id: 'ufo', name: 'Disk Mk. II', description: 'Advanced saucer hull. Purely rounded geometry.', price: 30000, maxEnergy: 150, maxCargo: 40, speed: 7, shape: 'saucer', canLayMines: false, defaultColor: '#64748b', engines: 1, defaultGuns: 1, noseType: 'rounded', wingConfig: 'balanced', gunMount: 'hull', wingStyle: 'parenthesis', wingCurve: 'neutral', hullShapeType: 'oval', extraDetail: 'antenna' },
  { id: 'dragonfly', name: 'V-Dragon', description: 'Front-maneuvering canards. Engines on struts.', price: 45000, maxEnergy: 200, maxCargo: 60, speed: 8, shape: 'dragonfly', canLayMines: false, defaultColor: '#475569', engines: 2, defaultGuns: 2, noseType: 'rounded', wingConfig: 'front-heavy', gunMount: 'wing', wingStyle: 'curved', wingCurve: 'forward', hullShapeType: 'finger', extraDetail: 'reservoir' },
  { id: 'star_t', name: 'Vector T-9', description: 'Heavy chassis with strut-mounted long cannons.', price: 65000, maxEnergy: 250, maxCargo: 50, speed: 7.5, shape: 'star-t', canLayMines: false, defaultColor: '#cbd5e1', engines: 2, defaultGuns: 2, noseType: 'flat', wingConfig: 'rear-heavy', gunMount: 'strut', wingStyle: 'delta', wingCurve: 'backward', hullShapeType: 'trapezoid', extraDetail: 'both' },
  { id: 'rebel_wing', name: 'Aurora-X', description: 'Classic 4-wing strike craft.', price: 85000, maxEnergy: 300, maxCargo: 80, speed: 6.5, shape: 'wing', canLayMines: false, defaultColor: '#64748b', engines: 2, defaultGuns: 2, noseType: 'rounded', wingConfig: 'balanced', gunMount: 'wing', wingStyle: 'x-wing', wingCurve: 'neutral', hullShapeType: 'rounded', extraDetail: 'none' },
  { id: 'frigate_b5', name: 'Sentinel Hub', description: 'Strut-mounted engines and exterior gun platforms.', price: 125000, maxEnergy: 450, maxCargo: 150, speed: 5, shape: 'frigate', canLayMines: true, defaultColor: '#4b5563', engines: 4, defaultGuns: 2, noseType: 'flat', wingConfig: 'front-heavy', gunMount: 'strut', wingStyle: 'curved', wingCurve: 'forward', hullShapeType: 'angled-flat', extraDetail: 'antenna' },
  { id: 'galactica', name: 'Steel Aegis', description: 'Heavy transport with parenthesis wing armor.', price: 160000, maxEnergy: 600, maxCargo: 500, speed: 4, shape: 'block', canLayMines: true, defaultColor: '#334155', engines: 1, defaultGuns: 2, noseType: 'rounded', wingConfig: 'rear-heavy', gunMount: 'hull', wingStyle: 'parenthesis', wingCurve: 'backward', hullShapeType: 'block', extraDetail: 'reservoir' },
  { id: 'enterprise', name: 'USS Sovereign', description: 'Saucer section with detached engine nacelles.', price: 230000, maxEnergy: 800, maxCargo: 200, speed: 5.5, shape: 'mine-layer', canLayMines: true, defaultColor: '#e2e8f0', engines: 2, defaultGuns: 1, noseType: 'rounded', wingConfig: 'balanced', gunMount: 'hull', wingStyle: 'parenthesis', wingCurve: 'neutral', hullShapeType: 'oval', extraDetail: 'antenna' },
  { id: 'dreadnought', name: 'Void Wraith', description: 'Stealth destroyer with external pulse cannons.', price: 380000, maxEnergy: 1200, maxCargo: 1000, speed: 3.5, shape: 'stealth', canLayMines: true, defaultColor: '#1e1e24', engines: 2, defaultGuns: 2, noseType: 'flat', wingConfig: 'front-heavy', gunMount: 'strut', wingStyle: 'cylon', wingCurve: 'backward', hullShapeType: 'angled-flat', extraDetail: 'none' },
  { id: 'obsidian_claw', name: 'Obsidian Claw', description: 'Aggressive pincer wings with anchored outriggers.', price: 450000, maxEnergy: 1500, maxCargo: 300, speed: 7, shape: 'arrow', canLayMines: false, defaultColor: '#0f172a', engines: 3, defaultGuns: 2, noseType: 'rounded', wingConfig: 'front-heavy', gunMount: 'strut', wingStyle: 'pincer', wingCurve: 'forward', hullShapeType: 'finger', extraDetail: 'reservoir' },
  { id: 'titan_forge', name: 'Titan Forge', description: 'Industrial hauler with heavy structural armament.', price: 520000, maxEnergy: 2000, maxCargo: 2500, speed: 3, shape: 'block', canLayMines: true, defaultColor: '#44403c', engines: 1, defaultGuns: 2, noseType: 'flat', wingConfig: 'rear-heavy', gunMount: 'strut', wingStyle: 'delta', wingCurve: 'neutral', hullShapeType: 'trapezoid', extraDetail: 'both' },
  { id: 'phoenix_prime', name: 'Phoenix Prime', description: 'Experimental curved wing geometry.', price: 750000, maxEnergy: 2500, maxCargo: 600, speed: 9, shape: 'dragonfly', canLayMines: false, defaultColor: '#991b1b', engines: 4, defaultGuns: 2, noseType: 'rounded', wingConfig: 'balanced', gunMount: 'wing', wingStyle: 'curved', wingCurve: 'forward', hullShapeType: 'triangle', extraDetail: 'antenna' }
];

export const WEAPONS: Weapon[] = [
  { id: 'gun_bolt', name: 'Ion Pulse', type: WeaponType.PROJECTILE, price: 5000, damage: 15, fireRate: 6, energyCost: 10, cargoWeight: 4, isAmmoBased: false, beamColor: '#60a5fa' },
  { id: 'gun_vulcan', name: 'Rotary Vulcan', type: WeaponType.PROJECTILE, price: 15000, damage: 12, fireRate: 18, energyCost: 20, cargoWeight: 10, isAmmoBased: true, beamColor: '#fbbf24' },
  { id: 'gun_heavy', name: 'Heavy Autocannon', type: WeaponType.PROJECTILE, price: 35000, damage: 45, fireRate: 4, energyCost: 40, cargoWeight: 25, isAmmoBased: true, beamColor: '#f87171' },
  { id: 'gun_plasma', name: 'Plasma Shredder', type: WeaponType.PROJECTILE, price: 85000, damage: 90, fireRate: 8, energyCost: 100, cargoWeight: 30, isAmmoBased: false, beamColor: '#10b981' }
];

export const EXOTIC_WEAPONS: Weapon[] = [
  { id: 'exotic_wave', name: 'Wave Disruptor', type: WeaponType.LASER, price: 0, damage: 60, fireRate: 10, energyCost: 15, cargoWeight: 0, isAmmoBased: false, beamColor: '#f472b6' },
  { id: 'exotic_bolt', name: 'Stormbringer', type: WeaponType.LASER, price: 0, damage: 85, fireRate: 8, energyCost: 25, cargoWeight: 0, isAmmoBased: false, beamColor: '#60a5fa' },
  { id: 'exotic_beam', name: 'Singularity Ray', type: WeaponType.LASER, price: 0, damage: 12, fireRate: 60, energyCost: 5, cargoWeight: 0, isAmmoBased: false, beamColor: '#a855f7' },
  { id: 'exotic_spiral', name: 'Vortex Cannon', type: WeaponType.PROJECTILE, price: 0, damage: 120, fireRate: 5, energyCost: 40, cargoWeight: 0, isAmmoBased: false, beamColor: '#fbbf24' },
  { id: 'exotic_split', name: 'Cinder Rounds', type: WeaponType.PROJECTILE, price: 0, damage: 40, fireRate: 12, energyCost: 20, cargoWeight: 0, isAmmoBased: false, beamColor: '#ef4444' },
  { id: 'exotic_saw', name: 'Rip-Saw Launcher', type: WeaponType.PROJECTILE, price: 0, damage: 150, fireRate: 3, energyCost: 50, cargoWeight: 0, isAmmoBased: false, beamColor: '#94a3b8' },
  { id: 'exotic_grav', name: 'Gravity Spike', type: WeaponType.LASER, price: 0, damage: 200, fireRate: 2, energyCost: 80, cargoWeight: 0, isAmmoBased: false, beamColor: '#38bdf8' },
  { id: 'exotic_plasma', name: 'Nova Blaster', type: WeaponType.LASER, price: 0, damage: 100, fireRate: 7, energyCost: 45, cargoWeight: 0, isAmmoBased: false, beamColor: '#22c55e' },
  { id: 'exotic_flame', name: 'Solar Lance', type: WeaponType.LASER, price: 0, damage: 55, fireRate: 15, energyCost: 10, cargoWeight: 0, isAmmoBased: false, beamColor: '#f97316' },
  { id: 'exotic_acid', name: 'Venom Spore', type: WeaponType.PROJECTILE, price: 0, damage: 30, fireRate: 20, energyCost: 12, cargoWeight: 0, isAmmoBased: false, beamColor: '#84cc16' }
];

export const SHIELDS: Shield[] = [
  { id: 'sh_alpha', name: 'Cobalt Blue Front (Dashed)', price: 10000, capacity: 250, regenRate: 5, energyCost: 20, visualType: 'forward', color: '#3b82f6' },
  { id: 'sh_beta', name: 'Solar Red Glow (Concentric)', price: 25000, capacity: 500, regenRate: 10, energyCost: 40, visualType: 'forward', color: '#ef4444' },
  { id: 'sh_gamma', name: 'Omni-Sphere Crystal', price: 75000, capacity: 1200, regenRate: 25, energyCost: 80, visualType: 'inner-full', color: '#38bdf8' }
];

export const DEFENSE_SYSTEMS = [
  { id: 'df_flares', name: 'Flare Dispenser Mk I', price: 15000, description: 'Anti-missile countermeasure system.' }
];

export const EXPLODING_ORDNANCE = [
  { id: 'ord_missile_light', name: 'Sparrow Missiles', price: 8000, count: 10 },
  { id: 'ord_missile_heavy', name: 'Titan Missiles', price: 25000, count: 10 },
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
  { id: 'p3', name: 'Vulcan Forge', description: 'High-gravity volcanic weapon testing site.', difficulty: 3, status: 'occupied', orbitRadius: 80, orbitSpeed: 0.004, size: 3.2, color: '#991b1b', quadrant: QuadrantType.BETA, moons: [] },
  { id: 'p4', name: 'Tundra Prime', description: 'Frozen wasteland rich in coolant crystals.', difficulty: 4, status: 'siege', orbitRadius: 140, orbitSpeed: 0.002, size: 2.8, color: '#60a5fa', quadrant: QuadrantType.BETA, moons: [] },
  { id: 'p5', name: 'Crystalline Void', description: 'Anomalous sector with refractive gas clouds.', difficulty: 5, status: 'occupied', orbitRadius: 90, orbitSpeed: 0.006, size: 2.1, color: '#a855f7', quadrant: QuadrantType.GAMA, moons: [] },
  { id: 'p6', name: 'Bio-Sphere X', description: 'Lush planet reclaimed by alien fauna.', difficulty: 6, status: 'siege', orbitRadius: 120, orbitSpeed: 0.002, size: 3.5, color: '#10b981', quadrant: QuadrantType.GAMA, moons: [] },
  { id: 'p7', name: 'Dread Shore', description: 'Dark matter refinery on the galactic rim.', difficulty: 8, status: 'occupied', orbitRadius: 70, orbitSpeed: 0.008, size: 4.0, color: '#171717', quadrant: QuadrantType.DELTA, moons: [] },
  { id: 'p8', name: 'Final Frontier', description: 'The absolute edge of colonized space.', difficulty: 10, status: 'siege', orbitRadius: 150, orbitSpeed: 0.001, size: 2.5, color: '#ffffff', quadrant: QuadrantType.DELTA, moons: [] }
];
