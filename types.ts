
// CHECKPOINT: Defender V71.0
// VERSION: V71.0
export enum MissionType {
  DEFENSE = 'DEFENSE',
  ATTACK = 'ATTACK',
  TRAVEL = 'TRAVEL',
  ORBIT = 'ORBIT',
  COMET = 'COMET'
}

export enum QuadrantType {
  ALFA = 'ALFA',
  BETA = 'BETA',
  GAMA = 'GAMA',
  DELTA = 'DELTA'
}

export enum WeaponType {
  PROJECTILE = 'PROJECTILE',
  LASER = 'LASER',
  ROCKET = 'ROCKET',
  MISSILE = 'MISSILE',
  MINE = 'MINE'
}

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  price: number;
  damage: number;
  fireRate: number;
  energyCost: number;
  cargoWeight: number;
  isAmmoBased: boolean;
  beamColor?: string; 
}

export interface Shield {
  id: string;
  name: string;
  price: number;
  capacity: number;
  regenRate: number;
  energyCost: number;
  visualType: 'full' | 'forward' | 'inner-full';
  color: string;
}

export interface ShipConfig {
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
}

export interface ShipFitting {
  weapons: EquippedWeapon[];
  shieldId: string | null;
  secondShieldId: string | null;
  flareId: string | null;
  reactorLevel: number;
  engineType: 'standard' | 'fusion' | 'afterburner' | 'smoke-trail';
  rocketCount: number;
  mineCount: number;
  wingWeaponId: string | null;
  health: number;
  ammoPercent: number;
  lives: number;
  fuel: number;
}

export interface EquippedWeapon {
  id: string;
  count: number;
}

export interface OwnedShipInstance {
  instanceId: string;
  shipTypeId: string;
}

export type ShipPart = 'hull' | 'wings' | 'cockpit' | 'guns' | 'gun_body' | 'engines' | 'bars' | 'nozzles';

export interface GameState {
  credits: number;
  selectedShipInstanceId: string | null;
  ownedShips: OwnedShipInstance[];
  shipFittings: Record<string, ShipFitting>; 
  shipColors: Record<string, string>; 
  shipWingColors: Record<string, string>; 
  shipCockpitColors: Record<string, string>; 
  shipBeamColors: Record<string, string>;
  shipGunColors: Record<string, string>; 
  shipGunBodyColors: Record<string, string>;
  shipEngineColors: Record<string, string>;
  shipBarColors: Record<string, string>;
  shipNozzleColors: Record<string, string>;
  currentPlanet: Planet | null;
  currentMoon: Moon | null;
  currentMission: MissionType | null;
  currentQuadrant: QuadrantType;
  conqueredMoonIds: string[];
  shipMapPosition: Record<QuadrantType, { x: number; y: number }>;
  shipRotation: number;
  orbitingEntityId: string | null;
  orbitAngle: number;
  dockedPlanetId: string | null;
  tutorialCompleted: boolean;
  settings: GameSettings;
  taskForceShipIds: string[];
  activeTaskForceIndex: number;
  pilotName: string;
  pilotAvatar: string;
  gameInProgress: boolean;
  victories: number;
  failures: number;
  typeColors: Record<string, Record<ShipPart, string>>;
}

export type DisplayMode = 'windowed' | 'fullscreen';

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  displayMode: DisplayMode;
  autosaveEnabled: boolean;
}

export interface Moon {
  id: string;
  name: string;
  difficulty: number;
  angle: number;
  distance: number;
  color?: string;
  size?: number;
  orbitDirection?: number;
  inclination?: number;
}

export interface Planet {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  status: 'occupied' | 'friendly' | 'siege';
  orbitRadius: number;
  orbitSpeed: number;
  orbitDirection?: number;
  size: number;
  moons: Moon[];
  color: string;
  quadrant: QuadrantType;
  isGasGiant?: boolean;
  hasRings?: boolean;
}
