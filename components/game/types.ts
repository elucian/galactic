
import { Enemy } from './Enemy'; 

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
