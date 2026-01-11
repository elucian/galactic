
// [Existing imports]
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
  MINE = 'MINE',
  EMP = 'EMP'
}

export interface CargoItem {
  instanceId: string;
  type: 'missile' | 'mine' | 'fuel' | 'weapon' | 'repair' | 'gold' | 'platinum' | 'lithium' | 'iron' | 'copper' | 'chromium' | 'titanium' | 'shield' | 'energy' | 'goods' | 'gun' | 'projectile' | 'laser';
  id?: string;
  name: string;
  weight: number;
  quantity: number;
  price?: number;
  status?: 'listed' | 'sold';
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
  weaponId?: string;
}

export interface ShipFitting {
  weapons: (EquippedWeapon | null)[];
  shieldId: string | null;
  secondShieldId: string | null;
  flareId: string | null;
  reactorLevel: number;
  engineType: 'standard' | 'fusion' | 'afterburner' | 'smoke-trail';
  rocketCount: number;
  mineCount: number;
  hullPacks: number;
  wingWeaponId: string | null;
  health: number;
  ammoPercent: number;
  lives: number;
  fuel: number;
  cargo: CargoItem[];
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

export interface GameMessage {
  id: string;
  type: 'activity' | 'score';
  pilotName: string;
  pilotAvatar: string;
  text: string;
  score?: number;
  timestamp: number;
}

export interface PlanetStatusData {
  id: string;
  status: 'friendly' | 'siege' | 'occupied';
  wins: number;
  losses: number;
}

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
  customColors: string[];
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
  reserveByPlanet: Record<string, CargoItem[]>;
  marketListingsByPlanet: Record<string, CargoItem[]>;
  messages: GameMessage[];
  planetOrbitOffsets: Record<string, number>;
  universeStartTime: number;
  planetRegistry: Record<string, PlanetStatusData>;
}

export type DisplayMode = 'windowed' | 'fullscreen';

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  displayMode: DisplayMode;
  autosaveEnabled: boolean;
  showTransitions: boolean;
  testMode?: boolean;
  fontSize: 'small' | 'medium' | 'large';
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
