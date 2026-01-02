
// CHECKPOINT: Defender V4.7
// VERSION: V4.7
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
}

export interface Shield {
  id: string;
  name: string;
  price: number;
  capacity: number;
  regenRate: number;
  energyCost: number;
  visualType: 'full' | 'forward';
}

export interface ShipConfig {
  id: string;
  name: string;
  description: string;
  price: number;
  maxEnergy: number;
  maxCargo: number;
  speed: number;
  shape: 'arrow' | 'block' | 'wing' | 'stealth' | 'mine-layer';
  canLayMines: boolean;
  defaultColor?: string;
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

export interface EquippedWeapon {
  id: string;
  count: number;
}

export interface ShipFitting {
  weapons: EquippedWeapon[];
  shieldId: string | null;
}

export interface GameState {
  credits: number;
  selectedShipId: string | null;
  ownedShips: string[];
  shipFittings: Record<string, ShipFitting>; 
  shipColors: Record<string, string>; 
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
