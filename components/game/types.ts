
import { Enemy } from './Enemy'; 
import { CargoItem, AmmoType } from '../../types';
import { Asteroid } from './Asteroid';

export interface Projectile {
  x: number; y: number; vx: number; vy: number;
  damage: number; color: string; type: string; life: number;
  isEnemy: boolean; width: number; height: number;
  glow?: boolean; glowIntensity?: number; isMain?: boolean;
  weaponId?: string; isOvercharge?: boolean; isTracer?: boolean; traceColor?: string;
  homingState?: 'searching' | 'tracking' | 'returning' | 'engaging' | 'launching';
  target?: Enemy | null;
  targetLostCounter?: number;
  launchTime?: number; headColor?: string; finsColor?: string; turnRate?: number; maxSpeed?: number;
  accel?: number; z?: number; vz?: number;
  angleOffset?: number; growthRate?: number; originalSize?: number;
  isEmp?: boolean;
  detonationY?: number; 
  initialWidth?: number; 
  initialHeight?: number; 
  opacity?: number; 
  isMulticolor?: boolean; 
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife?: number;
  size: number; color: string; type?: string;
  decay?: number; grow?: number; initialAlpha?: number;
  rotation?: number; spin?: number;
}

export interface Loot {
  x: number; y: number; z: number;
  type: string; id?: string; name?: string; quantity?: number;
  isPulled: boolean; isBeingPulled?: boolean; vx: number; vy: number;
}

export interface ShieldLayer {
    color: string;
    max: number;
    current: number;
    rotation: number;
    wobble: number;
    type: 'full' | 'front' | 'tri' | 'hex';
    rotSpeed: number;
}

export interface GameEngineState {
    px: number; py: number; hp: number; fuel: number; water: number; energy: number;
    sh1: number; sh2: number; score: number; time: number; phase: 'travel' | 'boss';
    bossSpawned: boolean; bossDead: boolean;
    enemies: Enemy[]; asteroids: Asteroid[]; bullets: Projectile[];
    particles: Particle[]; loot: Loot[]; stars: {x:number, y:number, s:number}[];
    keys: Set<string>; lastFire: number; lastSpawn: number; frame: number;
    missiles: number; mines: number; redMines: number;
    cargo: CargoItem[];
    ammo: Record<AmmoType, number>;
    gunStates: Record<number, { mag: number, reloadTimer: number, maxMag: number }>;
    magazineCurrent: number;
    reloadTimer: number;
    selectedAmmo: AmmoType;
    weaponFireTimes: {[key: number]: number};
    weaponHeat: {[key: number]: number};
    lastMissileFire: number;
    lastMineFire: number;
    lastRedMineFire: number;
    mineSide: boolean;
    omegaSide: boolean;
    paused: boolean;
    active: boolean;
    swivelMode: boolean;
    chargeLevel: number;
    hasFiredOverload: boolean;
    lastRapidFire: number;
    victoryTimer: number;
    failureTimer: number;
    movement: { up: boolean, down: boolean, left: boolean, right: boolean };
    criticalExposure: number;
    rescueMode: boolean;
    rescueTimer: number;
    usingWater: boolean;
    overload: number;
    overdrive: boolean;
    overdriveFirstShot: boolean;
    shakeX: number;
    shakeY: number;
    shakeDecay: number;
    capacitor: number;
    salvoTimer: number;
    lastSalvoFire: number;
    currentThrottle: number;
    shipVy: number;
    refuelTimer: number;
    isRefueling: boolean;
    refuelType: 'fuel' | 'water' | null;
    refuelStartVal: number;
    capacitorLocked: boolean;
    depletionTime: number;
    weaponCoolDownTimer: number;
    missileBurstCount: number;
    mineBurstCount: number;
    isExitDialogOpen: boolean;
    capsLock: boolean;
    shieldsEnabled: boolean;
    wasShieldHit: boolean;
    isShooting: boolean;
}
