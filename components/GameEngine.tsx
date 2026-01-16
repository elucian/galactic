
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, EquippedWeapon, Planet, QuadrantType, WeaponType, CargoItem, PlanetStatusData } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, EXOTIC_SHIELDS, BOSS_SHIPS, BOSS_EXOTIC_SHIELDS, AMMO_CONFIG } from '../constants.ts';
import { StarField } from './StarField.tsx';
import { getEngineCoordinates, getWingMounts } from '../utils/drawingUtils.ts';
import { ItemSVG } from './Common.tsx';

// --- CONFIGURATION ---
const ASTEROID_VARIANTS = [
    { color: '#3b82f6', type: 'ice', loot: ['water', 'fuel', 'energy'] }, 
    { color: '#e2e8f0', type: 'platinum', loot: ['platinum', 'titanium', 'silver'] }, 
    { color: '#6b7280', type: 'rock', loot: ['iron', 'copper', 'chromium', 'titanium'] }, 
    { color: '#78350f', type: 'copper', loot: ['copper', 'iron'] }, 
    { color: '#fbbf24', type: 'gold', loot: ['gold', 'copper'] }, 
    { color: '#ef4444', type: 'rust', loot: ['iron', 'copper', 'gold'] }, 
    { color: '#d946ef', type: 'rare', loot: ['lithium', 'iridium', 'platinum'] }, 
];

// --- ENTITY CLASSES ---
interface ShieldLayer {
    color: string;
    max: number;
    current: number;
    rotation: number;
}

class Enemy {
  x: number; y: number; z: number = 0; hp: number; maxHp: number; 
  shieldLayers: ShieldLayer[] = [];
  type: 'scout' | 'fighter' | 'heavy' | 'boss'; config: ExtendedShipConfig; lastShot: number = 0; 
  vx: number = 0; vy: number = 0; shieldRegen: number = 0;
  equippedWeapons: (EquippedWeapon | null)[] = [null, null, null]; 
  vibration: number = 0;
  stunnedUntil: number = 0;
  shieldDisabledUntil: number = 0;

  constructor(x: number, y: number, type: 'scout' | 'fighter' | 'heavy' | 'boss', config: ExtendedShipConfig, diff: number, quadrant: QuadrantType) {
    const hpMult = type === 'boss' ? 5000 : (type === 'heavy' ? 400 : 150);
    this.x = x; this.y = y; this.z = type === 'boss' ? 0 : (Math.random() - 0.5) * 600;
    this.hp = hpMult * (1 + diff * 0.3); this.maxHp = this.hp;
    this.type = type; 
    
    this.config = { ...config };

    if (type === 'boss') {
        this.config.isAlien = true;
        const weaponId = this.config.weaponId || EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)].id;
        
        this.equippedWeapons[0] = { id: weaponId, count: 1 };
        this.equippedWeapons[1] = { id: weaponId, count: 1 };
        this.equippedWeapons[2] = { id: weaponId, count: 1 };

        const shield1 = EXOTIC_SHIELDS[0];
        this.shieldLayers.push({ color: shield1.color, max: shield1.capacity * (1 + diff * 0.1), current: shield1.capacity * (1 + diff * 0.1), rotation: 0 });
        
        const shield2 = EXOTIC_SHIELDS[1];
        this.shieldLayers.push({ color: shield2.color, max: shield2.capacity * (1 + diff * 0.1), current: shield2.capacity * (1 + diff * 0.1), rotation: Math.PI / 2 });

        this.shieldRegen = 2.0 + (diff * 0.2);
    } else {
        this.equippedWeapons = [null, null, null];
        if (this.config.isAlien) {
            // Force standard energy weapon for non-boss aliens
            const wId = 'gun_photon'; // Energy weapon
            const slots = this.config.defaultGuns;
            if (slots === 1) this.equippedWeapons[0] = { id: wId, count: 1 };
            else { this.equippedWeapons[1] = { id: wId, count: 1 }; this.equippedWeapons[2] = { id: wId, count: 1 }; }
        } else {
            const standardEnergy = 'gun_pulse';
            const standardProjectile = 'gun_bolt';
            switch (quadrant) {
                case QuadrantType.ALFA: this.equippedWeapons[0] = { id: standardEnergy, count: 1 }; break;
                case QuadrantType.BETA: if (Math.random() > 0.3) { this.equippedWeapons[1] = { id: standardEnergy, count: 1 }; this.equippedWeapons[2] = { id: standardEnergy, count: 1 }; } else { this.equippedWeapons[0] = { id: standardEnergy, count: 1 }; } break;
                case QuadrantType.GAMA: const roll = Math.random(); if (roll < 0.33) { const slot = Math.random() > 0.5 ? 1 : 2; this.equippedWeapons[slot] = { id: standardProjectile, count: 1 }; } else if (roll < 0.66) { this.equippedWeapons[1] = { id: standardEnergy, count: 1 }; this.equippedWeapons[2] = { id: standardProjectile, count: 1 }; } else { this.equippedWeapons[1] = { id: standardProjectile, count: 1 }; this.equippedWeapons[2] = { id: standardProjectile, count: 1 }; } break;
                case QuadrantType.DELTA: if (Math.random() > 0.5) { this.equippedWeapons[1] = { id: standardEnergy, count: 1 }; this.equippedWeapons[2] = { id: standardEnergy, count: 1 }; } else { this.equippedWeapons[0] = { id: standardProjectile, count: 1 }; this.equippedWeapons[1] = { id: standardEnergy, count: 1 }; this.equippedWeapons[2] = { id: standardEnergy, count: 1 }; } break;
                default: this.equippedWeapons[0] = { id: standardEnergy, count: 1 }; break;
            }
        }

        let shieldCount = 0;
        if (diff >= 4) shieldCount = 2;
        else if (diff >= 2) shieldCount = 1;

        if (shieldCount > 0) {
            const baseShieldCap = 150 * diff;
            const c1 = quadrant === QuadrantType.ALFA ? '#3b82f6' : (quadrant === QuadrantType.BETA ? '#f97316' : '#ef4444');
            this.shieldLayers.push({ color: c1, max: baseShieldCap, current: baseShieldCap, rotation: Math.random() * Math.PI });
            if (shieldCount > 1) {
                const c2 = quadrant === QuadrantType.DELTA ? '#ffffff' : '#a855f7';
                this.shieldLayers.push({ color: c2, max: baseShieldCap * 1.5, current: baseShieldCap * 1.5, rotation: Math.random() * Math.PI });
            }
        }
    }
  }

  update(px: number, py: number, w: number, h: number, incomingFire: Projectile[]) {
    if (this.vibration > 0) this.vibration = Math.max(0, this.vibration - 1);
    
    // Decrement status timers
    if (this.stunnedUntil > 0) this.stunnedUntil--;
    if (this.shieldDisabledUntil > 0) this.shieldDisabledUntil--;

    if (this.stunnedUntil > 0) {
        // Paralyzed state: High drag, no new movement input
        this.vx *= 0.9;
        this.vy *= 0.9;
        // Also drift slightly downward due to gravity failure simulation
        this.vy += 0.5;
    } else {
        // Normal AI
        if (this.type === 'boss') {
            if (this.shieldLayers.length > 0 && this.shieldRegen > 0 && this.shieldDisabledUntil <= 0) {
                const top = this.shieldLayers[0];
                if (top.current < top.max) top.current = Math.min(top.max, top.current + this.shieldRegen);
            }
            this.vx = (this.vx + (px - this.x) * 0.002) * 0.96;
            this.vy = (this.vy + (150 - this.y) * 0.01) * 0.92;
        } else {
            this.y += 2.8; 
            this.vx = (this.vx + (Math.random() - 0.5) * 0.5) * 0.95; 
            const dx = px - this.x;
            
            if (this.y > h * 0.5 && Math.abs(this.z) < 50) {
                if (Math.abs(dx) < 100 && this.y < py) this.vx -= Math.sign(dx) * 0.6; 
                incomingFire.forEach(b => {
                    if (!b.isEnemy && Math.abs(b.y - this.y) < 150 && Math.abs(b.x - this.x) < 50) {
                        this.vx += (this.x < b.x ? -1 : 1) * 0.4; 
                    }
                });
            }
        }
    }
    
    this.x += this.vx; this.y += this.vy;
    
    this.shieldLayers.forEach((l, i) => {
        l.rotation += 0.05 * (i % 2 === 0 ? 1 : -1);
    });
  }

  takeDamage(amount: number, type: string, isMain: boolean, isOvercharge: boolean = false) {
      const isBoss = this.type === 'boss';
      
      // ZEUS THUNDERBOLT STUN & SHIELD DISABLE LOGIC
      if (type === 'bolt') {
          this.stunnedUntil = 60; // 1 Second Paralyze
          this.shieldDisabledUntil = 60; // 1 Second Shield Offline
          this.vibration = 40;
      }

      if (type === 'mine_red') {
          this.shieldLayers = []; 
          const dmg = isBoss ? this.maxHp * 0.4 : 99999;
          this.hp -= dmg;
          this.vibration = 50;
          audioService.playExplosion(0, 2.0); 
          return;
      }
      if (type.includes('emp')) {
          this.shieldLayers = [];
          const percentage = 0.5;
          this.hp -= this.maxHp * percentage;
          this.vibration = 25;
          audioService.playShieldHit();
          return;
      }
      if (type === 'missile' || type === 'mine') {
          let percentage = isBoss ? 0.25 : 0.8;
          if (type === 'mine') percentage = isBoss ? 0.3 : 0.9;
          
          if (this.shieldLayers.length > 0 && this.shieldDisabledUntil <= 0) {
              const layer = this.shieldLayers[0];
              const shieldDmg = layer.max * 0.8; 
              layer.current -= shieldDmg;
              if (layer.current <= 0) { this.shieldLayers.shift(); audioService.playShieldHit(); } 
              else { audioService.playShieldHit(); }
              this.vibration = 30;
          } else {
              this.hp -= this.maxHp * percentage;
              this.vibration = 40;
          }
          return;
      }
      
      // Standard Shield Logic (Bypassed if disabled)
      if (this.shieldLayers.length > 0 && this.shieldDisabledUntil <= 0) {
          let shieldDmg = amount;
          if (isMain) {
              if (isOvercharge) { shieldDmg *= 5.0; this.vibration = 15; } else { shieldDmg *= 2.0; }
          }
          else if (type === 'laser' || type === 'bolt') shieldDmg *= 1.5;
          else if (type === 'projectile' || type === 'star' || type === 'flame') shieldDmg *= 0.3;
          
          if (amount > 50) this.vibration = Math.max(this.vibration, 5);

          const layer = this.shieldLayers[0];
          layer.current -= shieldDmg;
          if (layer.current <= 0) { this.shieldLayers.shift(); audioService.playShieldHit(); } else { audioService.playShieldHit(); }
      } else {
          // Direct Hull Damage (Shields disabled or empty)
          let dmg = amount;
          if (type === 'projectile' || type === 'star') dmg *= 2.0;
          else if (type === 'flame') dmg *= 1.2; 
          this.hp -= dmg;
      }
  }
}

class Asteroid {
  x: number; y: number; z: number; hp: number; vx: number; vy: number; vz: number; size: number; color: string; 
  loot: { type: string, id?: string, name?: string, quantity?: number } | null = null;
  vertices: {x:number, y:number, z:number}[]; 
  faces: {indices: number[], normal: {x:number, y:number, z:number}}[];
  ax: number = 0; ay: number = 0; az: number = 0; vax: number; vay: number; vaz: number;

  constructor(w: number, diff: number, quadrant: QuadrantType) {
    this.x = Math.random() * w; this.y = -200; this.z = (Math.random() - 0.5) * 600;
    this.vy = 2 + Math.random() * 2; 
    this.vx = (Math.random() - 0.5) * 6; 
    this.vz = (Math.random() - 0.5);
    this.size = 8 + Math.random() * 12; 
    this.hp = (this.size * 30) + (this.size * this.size);
    this.vax = (Math.random() - 0.5) * 0.005; 
    this.vay = (Math.random() - 0.5) * 0.005; 
    this.vaz = (Math.random() - 0.5) * 0.005;
    
    let variantPool = [];
    if (quadrant === QuadrantType.ALFA) {
        variantPool = [...Array(4).fill('ice'), ...Array(3).fill('platinum'), 'rock', 'copper'];
    } else if (quadrant === QuadrantType.BETA) {
        variantPool = ['ice', 'ice', 'platinum', 'platinum', 'rock', 'rock', 'copper', 'copper'];
    } else if (quadrant === QuadrantType.GAMA) {
        variantPool = ['platinum', 'platinum', 'rock', 'rock', 'rock', 'rust', 'rust', 'copper'];
    } else if (quadrant === QuadrantType.DELTA) {
        variantPool = ['gold', 'gold', 'gold', 'rare', 'rare', 'platinum', 'platinum', 'ice'];
    } else {
        variantPool = ['rock'];
    }

    const selectedType = variantPool[Math.floor(Math.random() * variantPool.length)];
    const variant = ASTEROID_VARIANTS.find(v => v.type === selectedType) || ASTEROID_VARIANTS[2]; // Fallback to rock
    this.color = variant.color;

    if (this.size > 15 && Math.random() < 0.1) {
        this.loot = null;
    } else {
        const lootType = variant.loot[Math.floor(Math.random() * variant.loot.length)];
        let capType = lootType.charAt(0).toUpperCase() + lootType.slice(1);
        let finalType = lootType;
        if (lootType === 'silver') { finalType = 'platinum'; capType = 'Silver Ore'; }
        if (lootType === 'iridium') { finalType = 'platinum'; capType = 'Iridium Ore'; }
        if (lootType === 'tungsten') { finalType = 'iron'; capType = 'Tungsten Ore'; }
        if (lootType === 'energy') { finalType = 'energy'; capType = 'Energy Cell'; }

        if (['water', 'fuel', 'gold', 'platinum', 'lithium', 'iron', 'copper', 'chromium', 'titanium', 'energy'].includes(finalType)) {
            this.loot = { type: finalType, name: capType, quantity: 1 };
        } else {
            this.loot = { type: 'goods', name: capType, quantity: 1 };
        }
    }

    const t = (1 + Math.sqrt(5)) / 2; // Phi
    const r = 1/t; 
    const p = t;
    const baseVerts = [
        [1,1,1], [1,1,-1], [1,-1,1], [1,-1,-1],
        [-1,1,1], [-1,1,-1], [-1,-1,1], [-1,-1,-1],
        [0, r, p], [0, r, -p], [0, -r, p], [0, -r, -p],
        [r, p, 0], [r, -p, 0], [-r, p, 0], [-r, -p, 0],
        [p, 0, r], [p, 0, -r], [-p, 0, r], [-p, 0, -r]
    ];
    this.vertices = baseVerts.map(v => ({ x: v[0]*this.size, y: v[1]*this.size, z: v[2]*this.size }));
    const indices = [
        [0, 16, 2, 10, 8], [0, 8, 4, 14, 12], [16, 17, 1, 12, 0], [1, 9, 11, 3, 17], 
        [1, 12, 14, 5, 9], [2, 13, 15, 6, 10], [13, 3, 17, 16, 2], [3, 11, 7, 15, 13], 
        [4, 8, 10, 6, 18], [14, 4, 18, 19, 5], [5, 19, 7, 11, 9], [15, 7, 19, 18, 6]
    ];
    this.faces = indices.map(idxList => {
        let nx=0, ny=0, nz=0;
        idxList.forEach(i => { nx += baseVerts[i][0]; ny += baseVerts[i][1]; nz += baseVerts[i][2]; });
        const len = Math.hypot(nx, ny, nz);
        return { indices: idxList, normal: {x: nx/len, y: ny/len, z: nz/len} };
    });
  }
}

interface Projectile { 
    x: number; y: number; vx: number; vy: number; damage: number; color: string; type: string; life: number; 
    isEnemy: boolean; width: number; height: number; glow?: boolean; glowIntensity?: number; isMain?: boolean; 
    weaponId?: string; isTracer?: boolean; traceColor?: string; isOvercharge?: boolean;
    target?: Enemy | null;
    homingState?: 'searching' | 'tracking' | 'returning' | 'engaging' | 'launching';
    z?: number; 
    headColor?: string;
    finsColor?: string;
    turnRate?: number;
    maxSpeed?: number;
    launchTime?: number;
    accel?: number;
    // Special properties for exotic
    angleOffset?: number; // for rotating stars
    growthRate?: number; // for sonic rings
    originalSize?: number; // for sonic rings
}
interface Particle { 
    x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
    type?: 'standard' | 'ring' | 'spark' | 'debris' | 'smoke';
    rotation?: number; // for debris
    spin?: number; // for debris
}
interface Loot { x: number; y: number; z: number; type: string; id?: string; name?: string; quantity?: number; isPulled: boolean; isBeingPulled?: boolean; }

// --- COLOR UTILS ---
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
};
const mixColor = (c1: string, c2: string, weight: number) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const w = Math.min(1, Math.max(0, weight));
    const r = Math.round(rgb1.r * (1 - w) + rgb2.r * w);
    const g = Math.round(rgb1.g * (1 - w) + rgb2.g * w);
    const b = Math.round(rgb1.b * (1 - w) + rgb2.b * w);
    return `rgb(${r},${g},${b})`;
};

const getAlienColors = (q: QuadrantType) => {
    switch(q) {
        case QuadrantType.ALFA: return { hull: '#f97316', wing: '#fdba74' };
        case QuadrantType.BETA: return { hull: '#7f1d1d', wing: '#fca5a5' };
        case QuadrantType.GAMA: return { hull: '#1e3a8a', wing: '#93c5fd' };
        case QuadrantType.DELTA: return { hull: '#334155', wing: '#cbd5e1' };
        default: return { hull: '#f97316', wing: '#fdba74' };
    }
}

// --- COMPONENT ---
interface GameEngineProps {
  ships: Array<{ config: ExtendedShipConfig; fitting: ShipFitting; color: string; wingColor?: string; cockpitColor?: string; gunColor: string; secondaryGunColor?: string; gunBodyColor?: string; engineColor?: string; nozzleColor?: string; }>;
  shield: Shield | null; secondShield?: Shield | null; difficulty: number; currentPlanet: Planet; quadrant: QuadrantType; 
  onGameOver: (success: boolean, finalScore: number, wasAborted?: boolean, payload?: any) => void;
  fontSize: 'small' | 'medium' | 'large'; mode?: 'combat' | 'drift'; planetRegistry?: Record<string, PlanetStatusData>; 
}

const GameEngine: React.FC<GameEngineProps> = ({ ships, shield, secondShield, onGameOver, difficulty, currentPlanet, quadrant, fontSize, mode = 'combat' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeShip = ships[0];
  const maxEnergy = activeShip?.config?.maxEnergy || 1000;
  const maxFuel = activeShip?.config?.maxFuel || 1.0;
  
  // DYNAMIC HUD FONT SIZES
  const hudLabel = fontSize === 'small' ? 'text-[8px]' : (fontSize === 'large' ? 'text-[12px]' : 'text-[10px]');
  const hudValue = fontSize === 'small' ? 'text-lg' : (fontSize === 'large' ? 'text-4xl' : 'text-3xl');
  const hudScore = fontSize === 'small' ? 'text-xl' : (fontSize === 'large' ? 'text-4xl' : 'text-3xl');
  const hudAlertText = fontSize === 'small' ? 'text-[8px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[10px]');
  const hudOrdnance = fontSize === 'small' ? 'text-lg' : (fontSize === 'large' ? 'text-2xl' : 'text-xl');
  const hudTimer = fontSize === 'small' ? 'text-base' : (fontSize === 'large' ? 'text-2xl' : 'text-lg');

  const [hud, setHud] = useState({ 
    hp: 100, sh1: 0, sh2: 0, energy: maxEnergy, score: 0, missiles: 0, mines: 0, redMines: 0, fuel: 0, 
    alert: mode === 'drift' ? "DRIFTING" : "SYSTEMS READY", alertType: 'info', 
    timer: mode === 'drift' ? 60 : 120, boss: null as any, cargoCount: 0, isPaused: false,
    chargeLevel: 0,
    swivelMode: false,
    ammoCount: 0,
    ammoType: 'iron',
    isReloading: false
  });
  
  const state = useRef({
    px: window.innerWidth/2, py: window.innerHeight*0.8, hp: 100, fuel: 0, energy: maxEnergy, 
    sh1: 0, sh2: 0, score: 0, time: mode === 'drift' ? 60 : 120, phase: 'travel', bossSpawned: false, bossDead: false,
    enemies: [] as Enemy[], asteroids: [] as Asteroid[], bullets: [] as Projectile[], 
    particles: [] as Particle[], loot: [] as Loot[], stars: [] as {x:number, y:number, s:number}[],
    keys: new Set<string>(), lastFire: 0, lastSpawn: 0, frame: 0, 
    missiles: activeShip.fitting.rocketCount, mines: activeShip.fitting.mineCount, redMines: activeShip.fitting.redMineCount || 0,
    cargo: [...activeShip.fitting.cargo],
    ammo: { ...activeShip.fitting.ammo }, 
    magazineCurrent: activeShip.fitting.magazineCurrent !== undefined ? activeShip.fitting.magazineCurrent : 200, 
    reloadTimer: activeShip.fitting.reloadTimer || 0,
    selectedAmmo: activeShip.fitting.selectedAmmo,
    weaponFireTimes: {} as {[key: number]: number}, 
    weaponHeat: {} as {[key: number]: number},
    lastMissileFire: 0,
    lastMineFire: 0,
    lastRedMineFire: 0,
    mineSide: false, 
    omegaSide: false,
    paused: false,
    active: true,
    swivelMode: false,
    isCharging: false,
    chargeLevel: 0,
    hasFiredOverload: false,
    lastRapidFire: 0,
    victoryTimer: 0,
    movement: { up: false, down: false, left: false, right: false },
    criticalExposure: 0,
    rescueMode: false,
    rescueTimer: 0
  });

  const hasAmmoWeapons = activeShip.fitting.weapons.some(w => {
      if (!w) return false;
      const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(wd => wd.id === w.id);
      return def?.isAmmoBased;
  });

  useEffect(() => {
      const s = state.current;
      s.hp = activeShip.fitting.health;
      s.fuel = activeShip.fitting.fuel;
      s.sh1 = shield?.capacity || 0;
      s.sh2 = secondShield?.capacity || 0;
      s.missiles = activeShip.fitting.rocketCount;
      s.mines = activeShip.fitting.mineCount;
      s.redMines = activeShip.fitting.redMineCount || 0;
      
      const initStars = () => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          s.stars = Array.from({length: 200}, () => ({
              x: Math.random() * (w + 200) - 100, 
              y: Math.random() * (h + 200) - 100, 
              s: Math.random()*2
          }));
      };
      initStars();

      [0, 1, 2].forEach(i => s.weaponHeat[i] = 0);

      const handleResize = () => {
          initStars();
          s.paused = true;
          setHud(h => ({...h, isPaused: true}));
      };

      window.addEventListener('resize', handleResize);
      return () => { 
          window.removeEventListener('resize', handleResize);
          audioService.stopCharging(); 
      };
  }, []);

  const handleTabReload = () => {
      const s = state.current;
      const magPct = s.magazineCurrent / 200;
      const fuelPct = s.fuel / maxFuel;
      const missPct = s.missiles / 10;
      const minePct = s.mines / 10;

      const levels = [
          { type: 'mag', pct: magPct },
          { type: 'fuel', pct: fuelPct },
          { type: 'missile', pct: missPct },
          { type: 'mine', pct: minePct }
      ].sort((a,b) => a.pct - b.pct);

      for (const lvl of levels) {
          if (lvl.pct >= 1.0) continue; 

          if (lvl.type === 'mag') {
              if (s.ammo[s.selectedAmmo] > 0) {
                  const needed = 1000 - s.magazineCurrent;
                  const take = Math.min(needed, s.ammo[s.selectedAmmo]);
                  s.magazineCurrent += take;
                  s.ammo[s.selectedAmmo] -= take;
                  s.reloadTimer = 0; 
                  setHud(h => ({...h, isReloading: false, alert: 'INSTANT RELOAD'}));
                  audioService.playSfx('buy');
                  return; 
              } else {
                  const ammoIdx = s.cargo.findIndex(c => c.type === 'ammo' && c.id === s.selectedAmmo);
                  if (ammoIdx >= 0) {
                      s.cargo[ammoIdx].quantity--;
                      if (s.cargo[ammoIdx].quantity <= 0) s.cargo.splice(ammoIdx, 1);
                      s.ammo[s.selectedAmmo] += 1000;
                      const needed = 1000 - s.magazineCurrent;
                      const take = Math.min(needed, s.ammo[s.selectedAmmo]);
                      s.magazineCurrent += take;
                      s.ammo[s.selectedAmmo] -= take;
                      setHud(h => ({...h, isReloading: false, alert: 'UNPACK & RELOAD'}));
                      audioService.playSfx('buy');
                      return;
                  }
              }
          } else if (lvl.type === 'fuel') {
              const fuelItemIdx = s.cargo.findIndex(c => c.type === 'fuel');
              if (fuelItemIdx >= 0) {
                  s.cargo[fuelItemIdx].quantity--;
                  if (s.cargo[fuelItemIdx].quantity <= 0) s.cargo.splice(fuelItemIdx, 1);
                  s.fuel = Math.min(maxFuel, s.fuel + 5.0); 
                  setHud(h => ({...h, alert: 'REFUELED'}));
                  audioService.playSfx('buy');
                  return;
              }
          } else if (lvl.type === 'missile') {
              const mIdx = s.cargo.findIndex(c => c.type === 'missile');
              if (mIdx >= 0) {
                  s.cargo[mIdx].quantity--;
                  if (s.cargo[mIdx].quantity <= 0) s.cargo.splice(mIdx, 1);
                  s.missiles = Math.min(10, s.missiles + 10);
                  setHud(h => ({...h, alert: 'MISSILES RESTOCKED'}));
                  audioService.playSfx('buy');
                  return;
              }
          } else if (lvl.type === 'mine') {
              const mIdx = s.cargo.findIndex(c => c.type === 'mine');
              if (mIdx >= 0) {
                  s.cargo[mIdx].quantity--;
                  if (s.cargo[mIdx].quantity <= 0) s.cargo.splice(mIdx, 1);
                  s.mines = Math.min(10, s.mines + 10);
                  setHud(h => ({...h, alert: 'MINES RESTOCKED'}));
                  audioService.playSfx('buy');
                  return;
              }
          }
      }
      audioService.playSfx('denied');
  };

  useEffect(() => {
    const k = state.current.keys;
    const kd = (e: KeyboardEvent) => { 
        if(e.repeat) return;
        if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'NumpadEnter') e.preventDefault();
        k.add(e.code); 
        if(e.code === 'KeyP') {
            state.current.paused = !state.current.paused;
            setHud(h => ({...h, isPaused: state.current.paused}));
        }
        if(e.code === 'Escape') {
            const s = state.current;
            let finalHp = s.hp;
            let finalFuel = s.fuel;
            if (s.criticalExposure > 0 || s.rescueMode) { finalHp = 10; finalFuel *= 0.5; }
            onGameOver(false, s.score, true, { health: finalHp, fuel: finalFuel, rockets: s.missiles, mines: s.mines, redMineCount: s.redMines, cargo: s.cargo, ammo: s.ammo, magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer });
        }
        if(!state.current.paused && state.current.active && !state.current.rescueMode) {
            if(e.code === 'KeyM' || e.code === 'NumpadAdd') fireMissile();
            if(e.code === 'KeyN' || e.code === 'NumpadEnter') fireMine();
            if(e.code === 'KeyB') fireRedMine(); 
            if (e.code === 'Tab') handleTabReload();
            if (e.code === 'CapsLock') { state.current.swivelMode = !state.current.swivelMode; audioService.playSfx('click'); }
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { 
                if (!activeShip.config.isAlien) { // Alien ships do not charge
                    state.current.isCharging = true; 
                    audioService.startCharging(); 
                }
            }
        }
    };
    const ku = (e: KeyboardEvent) => {
        k.delete(e.code);
        if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && state.current.isCharging) {
            if (!state.current.hasFiredOverload) fireOverloadShot(false);
            state.current.isCharging = false;
            state.current.chargeLevel = 0;
            state.current.hasFiredOverload = false;
            audioService.stopCharging();
        }
    };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const fireOverloadShot = (isMax: boolean = true) => { /*...*/ const s=state.current; const chargeMult = s.chargeLevel > 20 ? (s.chargeLevel > 90 ? 10 : 2) : 1; const mainWeapon = activeShip.fitting.weapons[0]; const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null; const baseDamage = mainDef ? mainDef.damage : (activeShip.config.noseGunDamage || 45); const damage = baseDamage * chargeMult; const width = 8; const height = 60; const glowIntensity = isMax ? 30 : 10; const crystalColor = (mainDef?.beamColor) || (activeShip.gunColor || activeShip.config.noseGunColor || '#60a5fa'); const color = isMax ? '#ffffff' : crystalColor; const spawnY = s.py - 24; s.bullets.push({ x: s.px, y: spawnY, vx: 0, vy: -25, damage, color, type: 'laser', life: 60, isEnemy: false, width, height, glow: true, glowIntensity, isMain: true, weaponId: mainWeapon?.id || 'gun_pulse', isOvercharge: true }); s.weaponFireTimes[0] = Date.now(); s.weaponHeat[0] = Math.max(s.weaponHeat[0] || 0, s.chargeLevel); if (isMax) audioService.playWeaponFire('mega', 0, activeShip.config.id); else audioService.playWeaponFire('puff', 0, activeShip.config.id); s.energy -= 10 * chargeMult; };
  
  const fireRapidShot = () => {
      const s = state.current;
      const mainWeapon = activeShip.fitting.weapons[0];
      const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null;
      
      const fireRate = mainDef ? mainDef.fireRate : 4;
      const delay = 1000 / fireRate;

      if (Date.now() - s.lastRapidFire > delay) {
          // Check for Phaser Sweep
          if (mainDef?.id === 'exotic_phaser_sweep') {
              const cycleFrames = 30; // 0.5s at 60fps
              const sweepFrames = 18; // 0.3s
              const cycleIndex = Math.floor(s.frame / cycleFrames);
              const frameInCycle = s.frame % cycleFrames;
              
              if (frameInCycle < sweepFrames) {
                  const prog = frameInCycle / sweepFrames;
                  const range = 60 * (Math.PI / 180); 
                  const start = 0 - (30 * Math.PI / 180);
                  
                  let a = 0;
                  if (cycleIndex % 2 === 0) { // Left to Right
                      a = start + (range * prog);
                  } else { // Right to Left
                      a = (start + range) - (range * prog);
                  }
                  
                  // Use generic damage if def missing, else scaled down per tick
                  const dmg = mainDef.damage; 
                  
                  s.bullets.push({
                      x: s.px, y: s.py - 24,
                      vx: Math.sin(a) * 40, 
                      vy: -Math.cos(a) * 40,
                      damage: dmg,
                      color: '#facc15',
                      type: 'laser',
                      life: 15,
                      isEnemy: false,
                      width: 3, 
                      height: 100,
                      weaponId: mainDef.id,
                      glow: true, glowIntensity: 15
                  });
                  s.energy -= mainDef.energyCost;
              }
          } else if (mainDef?.id === 'exotic_octo_burst') {
              const spread = 12 * (Math.PI / 180);
              const angle = (Math.random() - 0.5) * spread; // -6 to +6 degrees relative to forward
              const baseAngle = -Math.PI / 2; // Forward
              const finalAngle = baseAngle + angle;
              const speed = 20;
              s.bullets.push({
                  x: s.px, y: s.py - 24,
                  vx: Math.cos(finalAngle) * speed,
                  vy: Math.sin(finalAngle) * speed,
                  damage: mainDef.damage,
                  color: '#a855f7',
                  type: 'plasma_jet',
                  life: 60,
                  isEnemy: false,
                  width: 12,
                  height: 40,
                  glow: true, glowIntensity: 15,
                  isMain: true, weaponId: mainDef.id
              });
              s.energy -= mainDef.energyCost;
          } else {
              // Standard Logic
              const baseDamage = mainDef ? mainDef.damage : (activeShip.config.noseGunDamage || 45);
              const damage = baseDamage;
              const crystalColor = (mainDef?.beamColor) || (activeShip.gunColor || activeShip.config.noseGunColor || '#f87171');
              const spawnY = s.py - 24;
              s.bullets.push({ x: s.px, y: spawnY, vx: 0, vy: -30, damage: damage, color: crystalColor, type: 'laser', life: 50, isEnemy: false, width: 4, height: 25, glow: true, glowIntensity: 5, isMain: true, weaponId: mainWeapon?.id || 'gun_pulse' });
              s.energy -= (mainDef?.energyCost || 2);
          }
          
          s.weaponFireTimes[0] = Date.now();
          s.weaponHeat[0] = Math.min(100, (s.weaponHeat[0] || 0) + 1.0);
          audioService.playWeaponFire('cannon', 0, activeShip.config.id);
          s.lastRapidFire = Date.now();
      }
  };

  const fireMissile = () => { const s = state.current; if (s.missiles > 0) { const isEmp = s.missiles % 2 !== 0; s.missiles--; s.lastMissileFire = Date.now(); s.bullets.push({ x: s.px, y: s.py, vx: 0, vy: -2, damage: 0, color: isEmp ? '#22d3ee' : '#ef4444', type: isEmp ? 'missile_emp' : 'missile', life: 600, isEnemy: false, width: 12, height: 28, homingState: 'launching', launchTime: s.frame, headColor: isEmp ? '#22d3ee' : '#ef4444', finsColor: isEmp ? '#0ea5e9' : '#ef4444', turnRate: 0.05, maxSpeed: 14, z: 0 }); audioService.playWeaponFire(isEmp ? 'emp' : 'missile'); } };
  const fireMine = () => { const s = state.current; if (s.mines > 0) { const isEmp = s.mines % 2 !== 0; s.mines--; s.lastMineFire = Date.now(); s.mineSide = !s.mineSide; const sideAngle = s.mineSide ? -235 : 55; const rad = (sideAngle * Math.PI) / 180; const spread = (Math.random() - 0.5) * 0.5; const speed = 3 + Math.random(); s.bullets.push({ x: s.px, y: s.py + 20, vx: Math.cos(rad + spread) * speed, vy: Math.sin(rad + spread) * speed, damage: 0, color: isEmp ? '#22d3ee' : '#fbbf24', type: isEmp ? 'mine_emp' : 'mine', life: 600, isEnemy: false, width: 14, height: 14, homingState: 'launching', launchTime: s.frame, turnRate: 0.08, maxSpeed: 10, z: 0 }); audioService.playWeaponFire('mine'); } };
  const fireRedMine = () => { const s = state.current; if (s.redMines > 0) { s.redMines--; s.lastRedMineFire = Date.now(); s.omegaSide = !s.omegaSide; const sideAngle = s.omegaSide ? -235 : 55; const rad = (sideAngle * Math.PI) / 180; const speed = 1.5; s.bullets.push({ x: s.px, y: s.py + 30, vx: Math.cos(rad) * speed, vy: Math.sin(rad) * speed, damage: 0, color: '#ef4444', type: 'mine_red', life: 600, isEnemy: false, width: 20, height: 20, homingState: 'searching', turnRate: 0.05, maxSpeed: 8, z: 0, glow: true, glowIntensity: 30 }); audioService.playWeaponFire('mine'); setHud(h => ({...h, alert: 'OMEGA MINE DEPLOYED', alertType: 'warning'})); } };
  const spawnLoot = (x: number, y: number, z: number, type: string, id?: string, name?: string, quantity: number = 1) => { state.current.loot.push({ x, y, z, type, id, name, quantity, isPulled: false }); };
  
  // Logic for Alien Ship Firing - Multi-slot support from specific mounts
  const fireAlienWeapons = () => {
      const s = state.current;
      const mounts = getWingMounts(activeShip.config); 
      // Mapping: Slot 0 = Nose (Manual), Slot 1 = Left Wing, Slot 2 = Right Wing
      const slots = [0, 1, 2];
      const scale = 0.6; // Same scale as Wing Weapons logic in loop

      let fired = false;

      slots.forEach(slotIdx => {
          const w = activeShip.fitting.weapons[slotIdx];
          if (w && w.id) {
              const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id);
              if (wDef) {
                  // Check Cooldown
                  const lastFire = s.weaponFireTimes[slotIdx] || 0;
                  const delay = 1000 / wDef.fireRate;
                  if (Date.now() - lastFire < delay) return;

                  // Energy Check
                  if (s.energy < wDef.energyCost) return;

                  // Determine Spawn Point
                  let startX = s.px;
                  let startY = s.py;

                  if (slotIdx === 0) {
                      // Nose/Hull Mount
                      startY = s.py - 30;
                  } else {
                      // Wing Mounts
                      const mountIdx = slotIdx - 1; // 0 for slot 1, 1 for slot 2
                      const m = mounts[mountIdx];
                      // getWingMounts returns 0-100 coords relative to ship center (50,50)
                      // Transform to world coords: px + (mx - 50)*scale
                      startX = s.px + (m.x - 50) * scale;
                      startY = s.py + (m.y - 50) * scale;
                  }

                  // Create Bullet
                  const damage = wDef.damage;
                  const color = wDef.beamColor || '#fff';
                  const bulletSpeed = w.id.includes('exotic') ? 12 : 18;
                  const angleRad = 0; // Forward -90 deg logically, but 0 rad in this ref frame (relative to ship, which is 0 rad forward here for alien?)
                  // Wait, alien ship logic doesn't rotate bullets usually, they just fly straight up (vy < 0).
                  // So angleRad 0 implies straight up in firing logic logic usually means cos(0) or sin(0).
                  // For aliens, angleRad = 0 usually means straight forward in bullet creation loop below.

                  // EXOTIC LOGIC (Reuse from loop)
                  if (w.id === 'exotic_star_shatter') {
                      const count = 12;
                      const arc = Math.PI / 2; // 90 degrees
                      const startAngle = angleRad - (arc / 2);
                      const step = arc / (count - 1);
                      for(let k=0; k<count; k++) {
                          const a = startAngle + (k * step);
                          s.bullets.push({ x: startX, y: startY, vx: Math.sin(a) * bulletSpeed, vy: -Math.cos(a) * bulletSpeed, damage: damage/3, color, type: 'star', life: 60, isEnemy: false, width: 8, height: 8, weaponId: w.id, angleOffset: Math.random()*Math.PI });
                      }
                  } else if (w.id === 'exotic_flamer') {
                      const spread = 30 * (Math.PI/180); const a = angleRad + (Math.random()-0.5) * spread; 
                      // 3/4 screen range approx 90 life
                      s.bullets.push({ x: startX, y: startY, vx: Math.sin(a) * (bulletSpeed*0.6), vy: -Math.cos(a) * (bulletSpeed*0.6), damage: damage, color: Math.random()>0.5 ? '#ef4444' : '#facc15', type: 'flame', life: 90, isEnemy: false, width: 12, height: 12, weaponId: w.id });
                  } else if (w.id === 'exotic_rainbow_spread') {
                      // Symmetric Colors: Y, R, P, P, R, Y
                      const colors = ['#facc15', '#ef4444', '#a855f7', '#a855f7', '#ef4444', '#facc15']; 
                      for(let k=0; k<6; k++) { 
                          const side = k < 3 ? -1 : 1;
                          const range = 35; 
                          const step = k % 3;
                          const deg = 10 + (step * (range/2));
                          const a = angleRad + (side * deg * (Math.PI/180));
                          let dmg = damage;
                          if (colors[k] === '#a855f7') dmg *= 2.0; // Purple very powerful
                          else if (colors[k] === '#ef4444') dmg *= 1.2; // Red
                          else dmg *= 0.8; // Yellow
                          s.bullets.push({ x: startX, y: startY, vx: Math.sin(a) * bulletSpeed, vy: -Math.cos(a) * bulletSpeed, damage: dmg, color: colors[k], type: 'projectile', life: 80, isEnemy: false, width: 10, height: 10, weaponId: w.id, glow: true, glowIntensity: 10 }); 
                      }
                  } else if (w.id === 'exotic_electric') {
                      // Zeus Thunderbolt: Short Flying Segment
                      s.bullets.push({ 
                          x: startX, y: startY, 
                          vx: Math.sin(angleRad) * (bulletSpeed*2), 
                          vy: -Math.cos(angleRad) * (bulletSpeed*2), 
                          damage: damage, 
                          color: '#00ffff', 
                          type: 'bolt', 
                          life: 50, // Finite life to travel
                          isEnemy: false, 
                          width: 3, 
                          height: 40, // Short segment
                          weaponId: w.id 
                      });
                  } else if (w.id === 'exotic_octo_burst') {
                      const spread = 12 * (Math.PI / 180);
                      const angle = (Math.random() - 0.5) * spread; // -6 to +6 degrees relative to forward
                      const a = angleRad + angle;
                      s.bullets.push({
                          x: startX, y: startY,
                          vx: Math.sin(a) * (bulletSpeed * 1.5), 
                          vy: -Math.cos(a) * (bulletSpeed * 1.5),
                          damage: damage,
                          color: '#a855f7',
                          type: 'plasma_jet',
                          life: 60,
                          isEnemy: false,
                          width: 12, height: 40,
                          weaponId: w.id,
                          glow: true, glowIntensity: 15
                      });
                  } else if (w.id === 'exotic_wave') {
                      s.bullets.push({ x: startX, y: startY, vx: Math.sin(angleRad) * bulletSpeed, vy: -Math.cos(angleRad) * bulletSpeed, damage: damage, color: '#8b5cf6', type: 'ring', life: 60, isEnemy: false, width: 10, height: 10, weaponId: w.id, growthRate: 1.5, originalSize: 10 });
                  } else if (w.id === 'exotic_gravity_wave') {
                      s.bullets.push({ x: startX, y: startY, vx: Math.sin(angleRad) * bulletSpeed, vy: -Math.cos(angleRad) * bulletSpeed, damage: damage, color: '#10b981', type: 'wave', life: 60, isEnemy: false, width: 40, height: 10, weaponId: w.id, glow: true, glowIntensity: 20 });
                  } else if (w.id === 'exotic_plasma_orb') {
                      // Extended Range
                      s.bullets.push({ x: startX, y: startY, vx: Math.sin(angleRad) * bulletSpeed, vy: -Math.cos(angleRad) * bulletSpeed, damage: damage, color: '#f472b6', type: 'projectile', life: 100, isEnemy: false, width: 20, height: 20, weaponId: w.id, glow: true, glowIntensity: 20 });
                  } else if (w.id === 'exotic_phaser_sweep') {
                      // Sweep Logic
                      const cycleFrames = 30; // 0.5s at 60fps
                      const sweepFrames = 18; // 0.3s
                      const cycleIndex = Math.floor(s.frame / cycleFrames);
                      const frameInCycle = s.frame % cycleFrames;
                      
                      if (frameInCycle < sweepFrames) {
                          const prog = frameInCycle / sweepFrames;
                          const range = 60 * (Math.PI / 180); 
                          const start = angleRad - (30 * Math.PI / 180);
                          
                          let a = 0;
                          if (cycleIndex % 2 === 0) { // Left to Right
                              a = start + (range * prog);
                          } else { // Right to Left
                              a = (start + range) - (range * prog);
                          }
                          s.bullets.push({
                              x: startX, y: startY,
                              vx: Math.sin(a) * 40, 
                              vy: -Math.cos(a) * 40,
                              damage: damage,
                              color: '#facc15',
                              type: 'laser',
                              life: 15,
                              isEnemy: false,
                              width: 3, 
                              height: 100,
                              weaponId: w.id,
                              glow: true, glowIntensity: 15
                          });
                      }
                  } else {
                      s.bullets.push({ x: startX, y: startY, vx: Math.sin(angleRad) * bulletSpeed, vy: -Math.cos(angleRad) * bulletSpeed, damage, color, type: wDef.type === WeaponType.LASER ? 'laser' : 'projectile', life: 60, isEnemy: false, width: 4, height: 16, weaponId: w.id });
                  }

                  s.weaponFireTimes[slotIdx] = Date.now();
                  s.energy -= wDef.energyCost;
                  fired = true;
              }
          }
      });

      if (fired) {
          // Play specific sound for Flamer
          if (activeShip.fitting.weapons.some(w => w?.id === 'exotic_flamer')) {
              audioService.playWeaponFire('flame', 0, activeShip.config.id);
          } else {
              audioService.playWeaponFire('cannon', 0, activeShip.config.id);
          }
      }
  };

  const createExplosion = (x: number, y: number, color: string, count: number, type: 'standard' | 'boss' | 'asteroid' | 'mine' = 'standard') => { 
      const s = state.current;
      s.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, color: '#ffffff', size: type === 'boss' ? 50 : 25 }); 
      for(let i=0; i<count; i++) { 
          const angle = Math.random() * Math.PI * 2; 
          const speed = Math.random() * (type === 'boss' ? 12 : 8) + 2; 
          s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.0 + Math.random() * 0.5, color: Math.random() > 0.5 ? color : '#ffffff', size: Math.random()*3+2 }); 
      }
      if (type === 'boss') {
          for(let i=0; i<3; i++) { s.particles.push({ x, y, vx: 0, vy: 0, life: 0.8 + (i * 0.2), color: color, size: 10 + (i*5), type: 'ring' }); }
          for(let i=0; i<30; i++) { const angle = Math.random() * Math.PI * 2; const speed = 15 + Math.random() * 10; s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.6, color: '#ffff00', size: 2, type: 'spark' }); }
      } else if (type === 'asteroid') {
          for(let i=0; i<8; i++) { const angle = Math.random() * Math.PI * 2; const speed = 2 + Math.random() * 4; s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.2, color: color, size: 6 + Math.random() * 6, type: 'debris', rotation: Math.random()*Math.PI, spin: (Math.random()-0.5)*0.2 }); }
      } else if (type === 'mine') {
          s.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, color: color, size: 5, type: 'ring' });
      }
      for(let i=0; i<12; i++) { const angle = (i / 12) * Math.PI * 2; const speed = 6; s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.6, color: color, size: 4 }); } 
  };
  
  useEffect(() => {
    const cvs = canvasRef.current; if(!cvs) return;
    const ctx = cvs.getContext('2d'); if(!ctx) return;
    let raf: number;
    const s = state.current;

    const triggerRescueMode = (s: any) => {
        s.hp = 0; s.rescueMode = true; s.enemies = []; s.asteroids = []; s.bullets = [];
        createExplosion(s.px, s.py, '#ef4444', 50, 'boss'); audioService.playExplosion(0, 2.0);
        setHud(h => ({...h, alert: "CRITICAL FAILURE - CAPSULE EJECTED", alertType: 'alert'}));
    }

    const loop = () => {
        if (!s.active) return;
        if (s.paused) { setHud(h => ({...h, isPaused: true})); raf = requestAnimationFrame(loop); return; }

        const width = cvs.width = window.innerWidth;
        const height = cvs.height = window.innerHeight;
        s.frame++;

        [0, 1, 2].forEach(i => { if (s.weaponHeat[i] > 0) s.weaponHeat[i] = Math.max(0, s.weaponHeat[i] - 0.05); });
        
        if (!s.rescueMode) {
            if (s.hp < 50 && s.hp > 0) {
                 if (s.frame % (s.hp < 30 ? 5 : 20) === 0) { s.particles.push({ x: s.px + (Math.random()-0.5)*20, y: s.py + (Math.random()-0.5)*10, vx: (Math.random()-0.5)*2, vy: -2 - Math.random(), life: 1.0, color: s.hp < 30 ? '#27272a' : '#71717a', size: 5 + Math.random()*5 }); }
            }
            if (s.hp < 30 && s.hp > 0) {
                if (s.frame % 4 === 0) { s.particles.push({ x: s.px + (Math.random()-0.5)*25, y: s.py + (Math.random()-0.5)*25, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 0.4, color: Math.random() > 0.5 ? '#ef4444' : '#facc15', size: 4, type: 'spark' }); }
                if (s.frame % 20 === 0) { const a = Math.random() * Math.PI * 2; s.particles.push({ x: s.px, y: s.py, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 0.5, color: '#cffafe', size: 3 }); }
                s.criticalExposure++;
                if (s.frame % 60 === 0) { audioService.playAlertSiren(); }
                if (s.criticalExposure > 900) { triggerRescueMode(s); }
            } else { s.criticalExposure = 0; }
            if (s.hp <= 0) { triggerRescueMode(s); } 
        }

        if (s.rescueMode) {
            s.rescueTimer++; s.px += (Math.random() - 0.5) * 0.2; s.py += (Math.random() - 0.5) * 0.2;
            if (s.frame % 60 === 0) setHud(h => ({...h, alert: `RESCUE ARRIVAL IN ${(5 - s.rescueTimer/60).toFixed(0)}s`, alertType: 'info'}));
            if (s.rescueTimer > 300) { onGameOver(false, s.score, false, { health: 0 }); s.active = false; return; }
        }

        if (s.fuel > 0) { if (s.hp < 20) s.fuel = Math.max(0, s.fuel - 0.05); else if (s.hp < 50) s.fuel = Math.max(0, s.fuel - 0.01); }
        if (s.reloadTimer > 0) { if (Date.now() - s.reloadTimer > 10000) { if (s.ammo[s.selectedAmmo] <= 0) { const ammoIdx = s.cargo.findIndex(c => c.type === 'ammo' && c.id === s.selectedAmmo); if (ammoIdx >= 0) { s.cargo[ammoIdx].quantity--; if (s.cargo[ammoIdx].quantity <= 0) s.cargo.splice(ammoIdx, 1); s.ammo[s.selectedAmmo] += 1000; } } const needed = 1000 - s.magazineCurrent; const canTake = Math.min(needed, s.ammo[s.selectedAmmo] || 0); s.magazineCurrent += canTake; s.ammo[s.selectedAmmo] -= canTake; s.reloadTimer = 0; setHud(h => ({...h, isReloading: false})); } } else if (s.magazineCurrent <= 0 && ((s.ammo[s.selectedAmmo] || 0) > 0 || s.cargo.some(c => c.type === 'ammo' && c.id === s.selectedAmmo))) { s.reloadTimer = Date.now(); setHud(h => ({...h, isReloading: true})); }
        if (s.missiles < 10 && Date.now() - s.lastMissileFire > 10000) { const mIdx = s.cargo.findIndex(c => c.type === 'missile'); if (mIdx >= 0 && s.frame % 60 === 0) { s.cargo[mIdx].quantity--; if (s.cargo[mIdx].quantity <= 0) s.cargo.splice(mIdx, 1); s.missiles++; setHud(h => ({...h, alert: 'RELOADING MISSILES'})); } }
        if (s.mines < 10 && Date.now() - s.lastMineFire > 10000) { const mIdx = s.cargo.findIndex(c => c.type === 'mine'); if (mIdx >= 0 && s.frame % 60 === 0) { s.cargo[mIdx].quantity--; if (s.cargo[mIdx].quantity <= 0) s.cargo.splice(mIdx, 1); s.mines++; setHud(h => ({...h, alert: 'RELOADING MINES'})); } }
        const robotCount = s.cargo.reduce((acc, c) => c.type === 'robot' ? acc + c.quantity : acc, 0);
        if (robotCount > 0 && s.hp < 100 && !s.rescueMode) { const repairInterval = Math.max(5, Math.floor(120 / robotCount)); if (s.frame % repairInterval === 0) { const repairResources = { iron: 2, copper: 4, chromium: 10, titanium: 16, gold: 20, repair: 25, platinum: 50, lithium: 80 }; const resIdx = s.cargo.findIndex(c => repairResources[c.type as keyof typeof repairResources]); if (resIdx >= 0) { const item = s.cargo[resIdx]; const heal = repairResources[item.type as keyof typeof repairResources] || 1; item.quantity--; if (item.quantity <= 0) s.cargo.splice(resIdx, 1); s.hp = Math.min(100, s.hp + heal); } } }

        const speed = 9;
        const up = s.keys.has('ArrowUp') || s.keys.has('KeyW') || s.keys.has('Numpad8');
        const down = s.keys.has('ArrowDown') || s.keys.has('KeyS') || s.keys.has('Numpad2');
        const left = s.keys.has('ArrowLeft') || s.keys.has('KeyA') || s.keys.has('Numpad4');
        const right = s.keys.has('ArrowRight') || s.keys.has('KeyD') || s.keys.has('Numpad6');
        s.movement = { up, down, left, right };
        if (!s.rescueMode) {
            if (up) { s.py -= speed; s.fuel = Math.max(0, s.fuel - 0.005); } 
            if (down) s.py += speed;
            if (left) { s.px -= speed; s.fuel = Math.max(0, s.fuel - 0.002); }
            if (right) { s.px += speed; s.fuel = Math.max(0, s.fuel - 0.002); }
            s.px = Math.max(30, Math.min(width-30, s.px));
            s.py = Math.max(50, Math.min(height-100, s.py));
        }
        
        const isAction = s.keys.has('Space') || s.keys.has('ControlLeft') || s.keys.has('ControlRight') || s.keys.has('ShiftLeft') || s.keys.has('ShiftRight');
        s.energy = Math.min(maxEnergy, s.energy + (isAction ? 1 : 5));
        
        // FIRING LOGIC
        if (s.keys.has('Space') && s.energy > 5 && !s.rescueMode) {
            if (activeShip.config.isAlien) {
                fireAlienWeapons();
            } else {
                fireRapidShot();
            }
        }
        
        if (s.isCharging && s.energy > 5 && !s.rescueMode) { s.chargeLevel = Math.min(100, s.chargeLevel + 3.5); s.energy -= 0.5; if (s.chargeLevel >= 100 && !s.hasFiredOverload) { fireOverloadShot(true); s.hasFiredOverload = true; s.lastFire = Date.now(); audioService.stopCharging(); s.chargeLevel = 0; s.hasFiredOverload = false; } }
        
        // Wing Guns (Control) - Standard Ship Only (Alien logic integrated into Space)
        if ((s.keys.has('ControlLeft') || s.keys.has('ControlRight')) && !s.rescueMode && !activeShip.config.isAlien) { 
            const mounts = getWingMounts(activeShip.config); 
            const wings = [activeShip.fitting.weapons[1], activeShip.fitting.weapons[2]]; 
            let fired = false; 
            const speed = 18; 
            const exoticSpeed = 12; 
            wings.forEach((w, i) => { 
                if (w && w.id) { 
                    const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id); 
                    if (wDef) { 
                        const interval = Math.max(1, Math.floor(60 / wDef.fireRate)); 
                        if (s.frame % interval === 0) { 
                            if (wDef.isAmmoBased) { if (s.magazineCurrent <= 0) return; s.magazineCurrent--; } 
                            else if (s.energy < wDef.energyCost) return; 
                            s.weaponFireTimes[i+1] = Date.now(); 
                            const heatInc = wDef.isAmmoBased ? 0.5 : 1.0; 
                            s.weaponHeat[i+1] = Math.min(100, (s.weaponHeat[i+1] || 0) + heatInc); 
                            const baseAngle = (s.swivelMode && wDef.isAmmoBased) ? Math.sin(s.frame * 0.1) * 13 : 0; 
                            const currentAngleDeg = i === 0 ? baseAngle : -baseAngle; 
                            const angleRad = (currentAngleDeg * Math.PI) / 180; 
                            const scale = 0.6; 
                            const mx = mounts[i].x; 
                            const my = mounts[i].y; 
                            const muzzleY = my - 15; 
                            const startX = s.px + (mx - 50) * scale; 
                            const startY = s.py + (muzzleY - 50) * scale; 
                            const isExotic = w.id.includes('exotic'); 
                            const bulletSpeed = isExotic ? exoticSpeed : speed; 
                            let damage = wDef.damage; 
                            let color = wDef.beamColor || '#fff'; 
                            let traceColor = undefined; 
                            let isTracer = false; 
                            
                            if (wDef.isAmmoBased) { 
                                const ammoConfig = AMMO_CONFIG[s.selectedAmmo]; 
                                damage *= ammoConfig.damageMult; 
                                color = ammoConfig.color; 
                                traceColor = ammoConfig.traceColor; 
                                isTracer = true; 
                                s.particles.push({ x: startX, y: startY, vx: (Math.random()-0.5)*2 - Math.sin(angleRad)*5, vy: (Math.random()-0.5)*2 + Math.cos(angleRad)*5, life: 0.4, color: '#a1a1aa', size: 3 }); 
                                s.particles.push({ x: startX, y: startY, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 0.15, color: '#fca5a5', size: 2 }); 
                            } 
                            
                            // STANDARD EXOTIC LOGIC (Same as Alien Fire Logic, reused)
                            if (w.id === 'exotic_star_shatter') {
                                const count = 12;
                                const arc = Math.PI / 2; // 90 degrees
                                const startAngle = angleRad - (arc / 2);
                                const step = arc / (count - 1);
                                for(let k=0; k<count; k++) {
                                    const a = startAngle + (k * step);
                                    s.bullets.push({ x: startX, y: startY, vx: Math.sin(a) * bulletSpeed, vy: -Math.cos(a) * bulletSpeed, damage: damage/3, color, type: 'star', life: 60, isEnemy: false, width: 8, height: 8, weaponId: w.id, angleOffset: Math.random()*Math.PI });
                                }
                            } else if (w.id === 'exotic_flamer') {
                                const spread = 30 * (Math.PI/180); const a = angleRad + (Math.random()-0.5) * spread; 
                                s.bullets.push({ x: startX, y: startY, vx: Math.sin(a) * (bulletSpeed*0.6), vy: -Math.cos(a) * (bulletSpeed*0.6), damage: damage, color: Math.random()>0.5 ? '#ef4444' : '#facc15', type: 'flame', life: 100, isEnemy: false, width: 12, height: 12, weaponId: w.id });
                            } else if (w.id === 'exotic_rainbow_spread') {
                                const colors = ['#facc15', '#ef4444', '#a855f7', '#a855f7', '#ef4444', '#facc15']; 
                                for(let k=0; k<6; k++) { 
                                    const side = k < 3 ? -1 : 1; const range = 35; const step = k % 3; const deg = 10 + (step * (range/2)); const a = angleRad + (side * deg * (Math.PI/180)); 
                                    let dmg = damage;
                                    if (colors[k] === '#a855f7') dmg *= 2.0;
                                    else if (colors[k] === '#ef4444') dmg *= 1.2;
                                    else dmg *= 0.8;
                                    s.bullets.push({ x: startX, y: startY, vx: Math.sin(a) * bulletSpeed, vy: -Math.cos(a) * bulletSpeed, damage: dmg, color: colors[k], type: 'projectile', life: 80, isEnemy: false, width: 10, height: 10, weaponId: w.id, glow: true, glowIntensity: 10 }); 
                                }
                            } else if (w.id === 'exotic_electric') {
                                // Zeus Thunderbolt: Short Flying Segment
                                s.bullets.push({ 
                                    x: startX, y: startY, 
                                    vx: Math.sin(angleRad) * (bulletSpeed*2), 
                                    vy: -Math.cos(angleRad) * (bulletSpeed*2), 
                                    damage: damage, 
                                    color: '#00ffff', 
                                    type: 'bolt', 
                                    life: 50, // Finite life to travel
                                    isEnemy: false, 
                                    width: 3, 
                                    height: 40, // Short segment
                                    weaponId: w.id 
                                });
                            } else if (w.id === 'exotic_octo_burst') {
                                const spread = 12 * (Math.PI / 180);
                                const angle = (Math.random() - 0.5) * spread; // -6 to +6 degrees relative to forward
                                const a = angleRad + angle; // Add to existing mount angle (usually 0 for straight)
                                s.bullets.push({
                                    x: startX, y: startY,
                                    vx: Math.sin(a) * (bulletSpeed * 1.5), 
                                    vy: -Math.cos(a) * (bulletSpeed * 1.5),
                                    damage: damage,
                                    color: '#a855f7',
                                    type: 'plasma_jet',
                                    life: 60,
                                    isEnemy: false,
                                    width: 12, height: 40,
                                    weaponId: w.id,
                                    glow: true, glowIntensity: 15
                                });
                            } else if (w.id === 'exotic_wave') {
                                s.bullets.push({ x: startX, y: startY, vx: Math.sin(angleRad) * bulletSpeed, vy: -Math.cos(angleRad) * bulletSpeed, damage: damage, color: '#8b5cf6', type: 'ring', life: 60, isEnemy: false, width: 10, height: 10, weaponId: w.id, growthRate: 1.5, originalSize: 10 });
                            } else if (w.id === 'exotic_gravity_wave') {
                                s.bullets.push({ x: startX, y: startY, vx: Math.sin(angleRad) * bulletSpeed, vy: -Math.cos(angleRad) * bulletSpeed, damage: damage, color: '#10b981', type: 'wave', life: 60, isEnemy: false, width: 40, height: 10, weaponId: w.id, glow: true, glowIntensity: 20 });
                            } else if (w.id === 'exotic_plasma_orb') {
                                s.bullets.push({ x: startX, y: startY, vx: Math.sin(angleRad) * bulletSpeed, vy: -Math.cos(angleRad) * bulletSpeed, damage: damage, color: '#f472b6', type: 'projectile', life: 100, isEnemy: false, width: 20, height: 20, weaponId: w.id, glow: true, glowIntensity: 20 });
                            } else if (w.id === 'exotic_phaser_sweep') {
                                const cycleFrames = 30; // 0.5s at 60fps
                                const sweepFrames = 18; // 0.3s
                                const cycleIndex = Math.floor(s.frame / cycleFrames);
                                const frameInCycle = s.frame % cycleFrames;
                                
                                if (frameInCycle < sweepFrames) {
                                    const prog = frameInCycle / sweepFrames;
                                    const range = 60 * (Math.PI / 180); 
                                    const start = angleRad - (30 * Math.PI / 180);
                                    
                                    let a = 0;
                                    if (cycleIndex % 2 === 0) { // Left to Right
                                        a = start + (range * prog);
                                    } else { // Right to Left
                                        a = (start + range) - (range * prog);
                                    }
                                    s.bullets.push({
                                        x: startX, y: startY,
                                        vx: Math.sin(a) * 40, 
                                        vy: -Math.cos(a) * 40,
                                        damage: damage,
                                        color: '#facc15',
                                        type: 'laser',
                                        life: 15,
                                        isEnemy: false,
                                        width: 3, 
                                        height: 100,
                                        weaponId: w.id,
                                        glow: true, glowIntensity: 15
                                    });
                                }
                            } else { 
                                s.bullets.push({ x: startX, y: startY, vx: Math.sin(angleRad) * bulletSpeed, vy: -Math.cos(angleRad) * bulletSpeed, damage, color, type: wDef.type === WeaponType.LASER ? 'laser' : 'projectile', life: 60, isEnemy: false, width: 4, height: 16, weaponId: w.id, isTracer, traceColor }); 
                            } 
                            
                            fired = true; 
                            if (!wDef.isAmmoBased) s.energy -= wDef.energyCost; 
                        } 
                    } 
                } 
            }); 
            if (fired) { 
                if (activeShip.fitting.weapons.some(w => w?.id === 'exotic_flamer')) {
                    audioService.playWeaponFire('flame', 0, activeShip.config.id);
                } else {
                    audioService.playWeaponFire('cannon', 0, activeShip.config.id); 
                }
            } 
        }

        if (s.phase === 'travel') { if (s.enemies.length < 3 + difficulty/2 && Date.now() - s.lastSpawn > 1500 && !s.rescueMode) { let spawnPool = SHIPS.filter(s => !s.isAlien); if (difficulty >= 4) spawnPool = [...spawnPool, ...SHIPS.filter(s => s.id === 'alien_h')]; if (difficulty >= 7) spawnPool = [...spawnPool, ...SHIPS.filter(s => s.id === 'alien_w')]; if (difficulty >= 9) spawnPool = [...spawnPool, ...SHIPS.filter(s => s.id === 'alien_a' || s.id === 'alien_m')]; const selectedShip = spawnPool.length > 0 ? spawnPool[Math.floor(Math.random() * spawnPool.length)] : SHIPS[0]; s.enemies.push(new Enemy(Math.random()*width, -50, 'fighter', selectedShip, difficulty, quadrant)); s.lastSpawn = Date.now(); } if (s.asteroids.length < 3 && Math.random() > 0.99) { s.asteroids.push(new Asteroid(width, difficulty, quadrant)); } if (s.time <= 0) { s.phase = 'boss'; s.enemies = []; const bossConfig = BOSS_SHIPS[Math.floor(Math.random() * BOSS_SHIPS.length)]; s.enemies.push(new Enemy(width/2, -200, 'boss', bossConfig, difficulty, quadrant)); setHud(h => ({...h, alert: "BOSS DETECTED", alertType: 'alert'})); } else if (s.frame % 60 === 0) s.time--; } else if (s.phase === 'boss') { if (s.bossDead) { s.victoryTimer++; if (s.victoryTimer > 180) { onGameOver(true, s.score, false, { health: s.hp, fuel: s.fuel, rockets: s.missiles, mines: s.mines, redMineCount: s.redMines, cargo: s.cargo, ammo: s.ammo, magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer }); s.active = false; } } }
        s.asteroids.forEach(a => { a.x += a.vx; a.y += a.vy; a.z += a.vz; a.ax += a.vax; a.ay += a.vay; a.az += a.vaz; if (Math.abs(a.z) < 50 && Math.hypot(a.x-s.px, a.y-s.py) < a.size + 30 && !s.rescueMode) { takeDamage(20, 'collision'); a.hp = 0; createExplosion(a.x, a.y, '#aaa', 10, 'asteroid'); } });
        s.asteroids = s.asteroids.filter(a => a.y < height + 100 && a.hp > 0);
        s.enemies.forEach(e => { 
            e.update(s.px, s.py, width, height, s.bullets); 
            
            // Dynamic Fire Rate Logic
            let fireDelay = e.config.isAlien ? 3000 : 1500;
            if (e.type === 'boss') {
                const w = e.equippedWeapons[0];
                const def = w ? [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id) : null;
                if (def) {
                    // Boss fires at 50% weapon spec (fireRate is shots/sec, so delay is 1000/rate * 2)
                    fireDelay = (1000 / def.fireRate) * 2;
                } else {
                    fireDelay = 800; // Fallback
                }
            }

            // CHECK STUN STATUS BEFORE FIRING
            if (e.stunnedUntil > 0) {
                // If stunned, maybe emit sparks instead of firing
                if (s.frame % 10 === 0) {
                    s.particles.push({ x: e.x + (Math.random()-0.5)*30, y: e.y + (Math.random()-0.5)*30, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 0.3, color: '#00ffff', size: 2, type: 'spark' });
                }
            } else if (Date.now() - e.lastShot > fireDelay && !s.rescueMode) { 
                const mounts = getWingMounts(e.config); 
                const scale = 0.5; 
                let slotsToFire = [0, 1, 2]; 
                if (e.type === 'boss') { if (Math.random() < 0.5) slotsToFire = [0]; else slotsToFire = [1, 2]; } 
                slotsToFire.forEach(i => { 
                    const w = e.equippedWeapons[i]; 
                    if (!w) return; 
                    const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id); 
                    if (!wDef) return; 
                    let sx = e.x, sy = e.y + 20; 
                    if (i === 0) sy = e.y + 30; 
                    else { 
                        const m = mounts[i-1]; 
                        if (m) { sx = e.x - (m.x - 50) * scale; sy = e.y - (m.y - 50) * scale; } 
                    } 
                    let damage = e.type === 'boss' ? 30 : 10; 
                    damage = wDef.damage * 0.3; 
                    const color = wDef.beamColor || '#ef4444'; 
                    if (wDef.isAmmoBased) { s.particles.push({ x: sx, y: sy, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 0.2, color: '#fca5a5', size: 3 }); } 
                    
                    // Enemy Firing Logic for Exotics (UPDATED SPREAD)
                    if (wDef.id === 'exotic_star_shatter') { 
                        const count = 12; 
                        const arc = Math.PI / 2; // 90 degrees
                        const baseAngle = Math.PI / 2;
                        const startAngle = baseAngle - (arc / 2);
                        const step = arc / (count - 1);
                        
                        for(let k=0; k<count; k++) { 
                            const a = startAngle + (k * step);
                            s.bullets.push({ x: sx, y: sy, vx: Math.cos(a)*6, vy: Math.sin(a)*6, damage, color, type: 'star', life: 60, isEnemy: true, width: 8, height: 8, weaponId: wDef.id, angleOffset: Math.random() }); 
                        } 
                    }
                    else if (wDef.id === 'exotic_flamer') { 
                        const a = Math.PI/2 + (Math.random()-0.5)*0.5; 
                        s.bullets.push({ x: sx, y: sy, vx: Math.cos(a)*5, vy: Math.sin(a)*5, damage, color: Math.random()>0.5?'#ef4444':'#facc15', type: 'flame', life: 30, isEnemy: true, width: 10, height: 10, weaponId: wDef.id }); 
                    }
                    else if (wDef.id === 'exotic_rainbow_spread') { 
                        const colors = ['#facc15', '#ef4444', '#a855f7', '#a855f7', '#ef4444', '#facc15']; 
                        for(let k=0; k<6; k++) { 
                            const side = k < 3 ? -1 : 1;
                            const range = 35; 
                            const step = k % 3;
                            const deg = 10 + (step * (range/2));
                            const a = Math.PI/2 + (side * deg * (Math.PI/180)); 
                            s.bullets.push({ x: sx, y: sy, vx: Math.cos(a)*6, vy: Math.sin(a)*6, damage, color: colors[k], type: 'projectile', life: 60, isEnemy: true, width: 10, height: 10, weaponId: wDef.id, glow: true }); 
                        } 
                    }
                    else if (wDef.id === 'exotic_octo_burst') { 
                        const spread = 12 * (Math.PI / 180);
                        const angle = (Math.random() - 0.5) * spread; // -6 to +6 degrees relative to forward
                        const a = (Math.PI/2) + angle; 
                        s.bullets.push({ x: sx, y: sy, vx: Math.cos(a)*12, vy: Math.sin(a)*12, damage, color: '#a855f7', type: 'plasma_jet', life: 60, isEnemy: true, width: 12, height: 40, weaponId: wDef.id, glow: true }); 
                    }
                    else if (wDef.id === 'exotic_electric') {
                        // Short arcs for enemy
                        s.bullets.push({ x: sx, y: sy, vx: 0, vy: 8, damage, color: '#00ffff', type: 'bolt', life: 8, isEnemy: true, width: 3, height: 40, weaponId: wDef.id });
                    }
                    else if (wDef.id === 'exotic_phaser_sweep') {
                        const cycleFrames = 30; // 0.5s at 60fps
                        const sweepFrames = 18; // 0.3s
                        const cycleIndex = Math.floor(s.frame / cycleFrames);
                        const frameInCycle = s.frame % cycleFrames;
                        
                        if (frameInCycle < sweepFrames) {
                            const prog = frameInCycle / sweepFrames;
                            const range = 60 * (Math.PI / 180); 
                            const start = (Math.PI/2) - (30 * Math.PI / 180); // Pointing down
                            
                            let a = 0;
                            if (cycleIndex % 2 === 0) { // L -> R relative to enemy (enemy down is +Y)
                                a = start + (range * prog);
                            } else {
                                a = (start + range) - (range * prog);
                            }
                            s.bullets.push({
                                x: sx, y: sy,
                                vx: Math.cos(a) * 40, // Down is +Y
                                vy: Math.sin(a) * 40,
                                damage: damage,
                                color: '#facc15',
                                type: 'laser',
                                life: 15,
                                isEnemy: true,
                                width: 3, 
                                height: 100,
                                weaponId: wDef.id,
                                glow: true, glowIntensity: 15
                            });
                        }
                    }
                    else { 
                        s.bullets.push({ x: sx, y: sy, vx: 0, vy: 8, damage, color, type: wDef.type === WeaponType.LASER ? 'laser' : 'projectile', life: 100, isEnemy: true, width: 6, height: 12, weaponId: wDef.id }); 
                    } 
                }); 
                e.lastShot = Date.now(); 
            } 
            if (Math.abs(e.z) < 50 && Math.hypot(e.x-s.px, e.y-s.py) < 60 && !s.rescueMode) { takeDamage(30, 'collision'); if(e.type !== 'boss') e.hp = 0; createExplosion(e.x, e.y, '#f00', 10); } 
        });
        const deadEnemies = s.enemies.filter(e => e.hp <= 0);
        deadEnemies.forEach(e => { createExplosion(e.x, e.y, '#fbbf24', 30, e.type === 'boss' ? 'boss' : 'standard'); if (e.type === 'boss') { s.bossDead = true; const bossScore = 10000 * difficulty; s.score += bossScore; setHud(h => ({...h, alert: `BOSS DESTROYED: +${bossScore}`})); const exotic = EXOTIC_WEAPONS[Math.floor(Math.random()*EXOTIC_WEAPONS.length)]; spawnLoot(e.x, e.y, 0, 'weapon', exotic.id, exotic.name); if (Math.random() > 0.5) { const shield = EXOTIC_SHIELDS[Math.floor(Math.random()*EXOTIC_SHIELDS.length)]; spawnLoot(e.x + 20, e.y + 20, 0, 'shield', shield.id, shield.name); } if (Math.random() > 0.7) { const rand = Math.random(); if (rand < 0.33) { spawnLoot(e.x - 20, e.y, 0, 'ammo', s.selectedAmmo, 'MEGA AMMO', 10000); } else if (rand < 0.66) { spawnLoot(e.x - 20, e.y, 0, 'missile', undefined, 'MEGA MISSILES', 100); } else { spawnLoot(e.x - 20, e.y, 0, 'mine', undefined, 'MEGA MINES', 100); } } } else { s.score += 100; const roll = Math.random(); if (roll > 0.5) { const drops = ['ammo', 'ammo', 'missile', 'mine']; const drop = drops[Math.floor(Math.random() * drops.length)]; if (drop === 'ammo') spawnLoot(e.x, e.y, e.z, 'ammo', s.selectedAmmo, 'Ammo', 200); else spawnLoot(e.x, e.y, e.z, drop, undefined, drop.charAt(0).toUpperCase() + drop.slice(1), 5); } } });
        s.enemies = s.enemies.filter(e => e.hp > 0 && e.y < height + 200);

        s.bullets.forEach(b => {
            // GRAVITY WAVE / SONIC RING DEFLECTION
            if ((b.type === 'wave' || b.type === 'ring') && b.life > 0) {
                // Find enemy bullets if this is player's wave, or player's bullets if enemy's wave
                const opposing = s.bullets.filter(other => other !== b && other.isEnemy !== b.isEnemy && other.life > 0 && other.type !== 'wave' && other.type !== 'ring');
                opposing.forEach(other => {
                    const dist = Math.hypot(other.x - b.x, other.y - b.y);
                    if (dist < b.width + 10) {
                        // Deflect: Reverse Velocity and slightly scatter
                        other.vx = -other.vx + (Math.random() - 0.5) * 4;
                        other.vy = -other.vy + (Math.random() - 0.5) * 4;
                        // Transfer ownership to make it damage the original shooter
                        other.isEnemy = !other.isEnemy; 
                        // Reset life to ensure it travels back
                        other.life = 60;
                        // Visual
                        createExplosion(other.x, other.y, b.type === 'wave' ? '#10b981' : '#8b5cf6', 3);
                    }
                });
            }

            // DRAGON BREATH GROWTH
            if (b.type === 'flame') {
                b.width += 1.5;
                b.height += 1.5;
            }

            if (b.target && b.target.hp > 0 && b.target.shieldLayers.length > 0) { const isExplosive = b.type === 'missile' || b.type === 'mine'; if (isExplosive) { const empPartner = s.bullets.find(other => other !== b && other.target === b.target && (other.type.includes('emp'))); if (empPartner) { const myDist = Math.hypot(b.x - b.target.x, b.y - b.target.y); const empDist = Math.hypot(empPartner.x - empPartner.target!.x, empPartner.y - empPartner.target!.y); if (myDist < empDist + 50) { b.vx *= 0.9; b.vy *= 0.9; if (s.frame % 5 === 0) { s.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, color: '#fbbf24', size: 2 }); } } } } }
            if (b.type === 'missile' || b.type === 'missile_emp') { if (b.homingState === 'launching') { if (s.frame % 3 === 0) { s.particles.push({ x: b.x, y: b.y + b.height/2, vx: (Math.random()-0.5)*0.5, vy: 2 + Math.random(), life: 0.3, color: '#9ca3af', size: 2 }); } b.vy -= 0.05; if ((s.frame - (b.launchTime || 0)) > 60) b.homingState = 'searching'; } else if (b.homingState === 'searching') { let bestT = null; let minD = Infinity; s.enemies.forEach(e => { const dist = Math.hypot(e.x - b.x, e.y - b.y); let dAngle = Math.abs(Math.atan2(e.y - b.y, e.x - b.x) - (-Math.PI/2)); if (dAngle > Math.PI) dAngle = 2*Math.PI - dAngle; if (dAngle < Math.PI/2 && dist < minD && e.hp > 0) { minD = dist; bestT = e; } }); if (bestT) { b.target = bestT; b.homingState = 'tracking'; } else { b.vy -= 0.1; } } else if (b.target && b.homingState === 'tracking') { const t = b.target; if (t.hp <= 0) { b.target = null; b.homingState = 'searching'; } else { const dx = t.x - b.x; const dy = t.y - b.y; const targetAngle = Math.atan2(dy, dx); let currentAngle = Math.atan2(b.vy, b.vx); let angleDiff = targetAngle - currentAngle; if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI; if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI; const turnRate = b.turnRate || 0.05; if (Math.abs(angleDiff) > turnRate) { currentAngle += Math.sign(angleDiff) * turnRate; } else { currentAngle = targetAngle; } const speed = Math.min(b.maxSpeed || 14, Math.hypot(b.vx, b.vy) + 0.2); b.vx = Math.cos(currentAngle) * speed; b.vy = Math.sin(currentAngle) * speed; b.z = (b.z || 0) + (t.z - (b.z || 0)) * 0.1; } } s.asteroids.forEach(a => { const dx = b.x - a.x; const dy = b.y - a.y; const d = Math.hypot(dx, dy); if (d < a.size + 80) { const force = (a.size + 80 - d) / 20; b.vx += (dx/d) * force; b.vy += (dy/d) * force; } }); } 
            else if (b.type === 'mine' || b.type === 'mine_emp' || b.type === 'mine_red') { if (b.homingState === 'launching') { b.vx *= 0.96; b.vy *= 0.96; if ((s.frame - (b.launchTime || 0)) > 60) b.homingState = 'searching'; } else if (b.homingState === 'searching') { let bestT = null; let minD = Infinity; s.enemies.forEach(e => { const dist = Math.hypot(e.x - b.x, e.y - b.y); if (dist < 300 && e.hp > 0) { if (dist < minD) { minD = dist; bestT = e; } } }); if (bestT) { b.target = bestT; b.homingState = 'engaging'; } else { b.vx *= 0.99; b.vy *= 0.99; } } if (b.target && b.homingState === 'engaging') { if (b.target.hp <= 0) { b.target = null; b.homingState = 'searching'; } else { const t = b.target; const dx = t.x - b.x; const dy = t.y - b.y; const dist = Math.hypot(dx, dy); const pullStrength = 0.3; b.vx += (dx/dist) * pullStrength; b.vy += (dy/dist) * pullStrength; const speed = Math.hypot(b.vx, b.vy); const maxS = b.maxSpeed || 8; if (speed > maxS) { b.vx = (b.vx/speed) * maxS; b.vy = (b.vy/speed) * maxS; } } } }
            else if (b.type === 'ring') {
                if (b.growthRate) {
                    b.width += b.growthRate;
                    b.height += b.growthRate;
                }
            }
            
            b.x += b.vx; b.y += b.vy; b.life--; // Removed boundary bounce check
            
            if (b.isEnemy && !s.rescueMode) { 
                if (Math.hypot(b.x-s.px, b.y-s.py) < 30) { takeDamage(b.damage, b.type); b.life = 0; createExplosion(b.x, b.y, b.color, 3); } 
            } else if (!b.isEnemy) { 
                let hit = false; 
                s.enemies.forEach(e => { 
                    const hitDist = (b.type.includes('missile') || b.type.includes('mine')) ? (e.type === 'boss' ? 100 : 60) : (e.type === 'boss' ? 80 : 40); 
                    if (Math.hypot(b.x-e.x, b.y-e.y) < hitDist) { 
                        let damage = b.damage;
                        if (b.type === 'flame' && b.life > 80) damage *= 4.0; // High intensity flame up close
                        
                        e.takeDamage(damage, b.type as any, !!b.isMain, !!b.isOvercharge); 
                        hit = true; 
                        
                        // BOLT EFFECT: Electric Paralysis Sparks
                        if (b.type === 'bolt') {
                            for(let k=0; k<5; k++) {
                                s.particles.push({ 
                                    x: e.x + (Math.random()-0.5)*30, 
                                    y: e.y + (Math.random()-0.5)*30, 
                                    vx: (Math.random()-0.5)*5, 
                                    vy: (Math.random()-0.5)*5, 
                                    life: 0.4, 
                                    color: '#00ffff', 
                                    size: 2, 
                                    type: 'spark' 
                                });
                            }
                        }

                        if (b.type.includes('mine')) {
                            s.enemies.forEach(otherE => {
                                if (otherE !== e && Math.hypot(otherE.x - b.x, otherE.y - b.y) < 150) {
                                    otherE.takeDamage(b.damage * 0.5, b.type as any, false);
                                }
                            });
                            createExplosion(b.x, b.y, b.type === 'mine_red' ? '#ef4444' : b.color, 20, 'mine');
                        } else {
                            createExplosion(b.x, b.y, b.color, 2); 
                        }
                    } 
                }); 
                if (hit) {
                    if (b.type !== 'wave') b.life = 0; // Wave penetrates, everything else hits (Bolt included per user request "stop when reach an obstacle")
                }
                else if (b.type.includes('mine') && b.target && (b.target.x < -100 || b.target.x > width+100 || b.target.y < -100)) { b.target.takeDamage(9999, 'mine', false); b.life = 0; s.score += 500; setHud(h => ({...h, alert: "OFF-SCREEN KILL +500"})); } 
                s.asteroids.forEach(a => { if (Math.hypot(b.x-a.x, b.y-a.y) < a.size + 10) { let dmg = b.damage; if (b.isMain) dmg *= 5.0; a.hp -= dmg; if (b.type !== 'wave') b.life = 0; createExplosion(b.x, b.y, '#888', 5, 'asteroid'); if (a.hp <= 0 && a.loot) { spawnLoot(a.x, a.y, a.z, a.loot.type, a.loot.id, a.loot.name, a.loot.quantity || 1); } } }); 
            }
        });
        s.bullets = s.bullets.filter(b => { if (b.life <= 0) return false; if (b.type.includes('mine') && b.homingState === 'engaging') return true; return b.y > -200 && b.y < height + 200 && b.x > -100 && b.x < width + 100; }); // Added boundary filter here

        s.loot.forEach(l => { const d = Math.hypot(l.x - s.px, l.y - s.py); if (d < 200 && !s.rescueMode) { l.isBeingPulled = true; l.x += (s.px - l.x) * 0.05; l.y += (s.py - l.y) * 0.05; if (d < 40) { l.isPulled = true; const qty = l.quantity || 1; if (l.type === 'ammo') { const amount = qty > 1 ? qty : 50; s.magazineCurrent = Math.min(1000, s.magazineCurrent + amount); s.ammo[s.selectedAmmo] += amount; audioService.playSfx('buy'); setHud(h => ({...h, alert: `+${amount} ${l.name?.toUpperCase()}`})); } else if (l.type === 'missile') { s.missiles += qty; audioService.playSfx('buy'); setHud(h => ({...h, alert: `+${qty} MISSILES`})); } else if (l.type === 'mine') { s.mines += qty; audioService.playSfx('buy'); setHud(h => ({...h, alert: `+${qty} MINES`})); } else { const existing = s.cargo.find(c => c.type === l.type && c.id === l.id); if (existing) existing.quantity += qty; else s.cargo.push({ instanceId: Date.now().toString(), type: l.type as any, id: l.id, name: l.name || l.type, quantity: qty, weight: 1 }); audioService.playSfx('buy'); setHud(h => ({...h, alert: `GOT ${l.name || l.type.toUpperCase()}`})); } } } else { l.isBeingPulled = false; l.y += 2; } });
        s.loot = s.loot.filter(l => !l.isPulled && l.y < height + 100);

        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff'; s.stars.forEach(st => { st.y += st.s * 0.5; if(st.y > height) st.y = 0; ctx.globalAlpha = Math.random() * 0.5 + 0.3; ctx.beginPath(); ctx.arc(st.x, st.y, st.s, 0, Math.PI*2); ctx.fill(); }); ctx.globalAlpha = 1;

        const entities = [...s.asteroids.map(a => ({type: 'ast', z: a.z, obj: a})), ...s.enemies.map(e => ({type: 'enemy', z: e.z, obj: e})), ...s.loot.map(l => ({type: 'loot', z: l.z, obj: l})), {type: 'player', z: 0, obj: null}].sort((a,b) => a.z - b.z);
        const lightVec = { x: 0.8, y: -0.8, z: 0.8 }; const len = Math.hypot(lightVec.x, lightVec.y, lightVec.z); lightVec.x /= len; lightVec.y /= len; lightVec.z /= len;

        entities.forEach(item => { const scale = 1 + (item.type === 'ast' ? (item.obj as Asteroid).z / 1000 : (item.type === 'enemy' ? (item.obj as Enemy).z / 1000 : 0)); if (scale <= 0) return; ctx.save(); if (item.type === 'ast') { const a = item.obj as Asteroid; ctx.translate(a.x, a.y); ctx.scale(scale, scale); const cosX = Math.cos(a.ax), sinX = Math.sin(a.ax); const cosY = Math.cos(a.ay), sinY = Math.sin(a.ay); ctx.rotate(a.az); a.faces.forEach(f => { let nx = f.normal.x; let ny = f.normal.y; let nz = f.normal.z; let ty = ny*cosX - nz*sinX; let tz = ny*sinX + nz*cosX; ny = ty; nz = tz; let tx = nx*cosY + nz*sinY; tz = -nx*sinY + nz*cosY; nx = tx; nz = tz; const cosZ = Math.cos(a.az), sinZ = Math.sin(a.az); tx = nx*cosZ - ny*sinZ; ty = nx*sinZ + ny*cosZ; nx = tx; ny = ty; if (nz <= 0) return; const dot = Math.max(0, nx*lightVec.x + ny*lightVec.y + nz*lightVec.z); const lightIntensity = 0.2 + (0.8 * dot); ctx.fillStyle = mixColor('#000000', a.color, lightIntensity); ctx.strokeStyle = mixColor('#000000', a.color, lightIntensity * 1.2); ctx.lineWidth = 1; ctx.beginPath(); f.indices.forEach((idx, i) => { const v = a.vertices[idx]; let vx = v.x; let vy = v.y; let vz = v.z; let rvy = vy*cosX - vz*sinX; let rvz = vy*sinX + vz*cosX; vy = rvy; vz = rvz; let rvx = vx*cosY + vz*sinY; rvz = -vx*sinY + vz*cosY; vx = rvx; vz = rvz; if (i===0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy); }); ctx.closePath(); ctx.fill(); ctx.stroke(); }); } else if (item.type === 'enemy') { const e = item.obj as Enemy; const vibX = e.vibration > 0 ? (Math.random() - 0.5) * e.vibration : 0; const vibY = e.vibration > 0 ? (Math.random() - 0.5) * e.vibration : 0; ctx.translate(e.x + vibX, e.y + vibY); ctx.scale(scale, scale); ctx.rotate(Math.PI); const alienCols = getAlienColors(quadrant); drawShip(ctx, { config: e.config, fitting: null, color: e.type==='boss'?'#a855f7':alienCols.hull, wingColor: e.type==='boss'?'#d8b4fe':alienCols.wing, gunColor: '#ef4444', equippedWeapons: e.equippedWeapons }, false); 
        // SHIELD RENDERING (Check disabled state)
        if (e.shieldDisabledUntil <= 0) {
            e.shieldLayers.forEach((layer, idx) => { if (layer.current <= 0) return; const radius = 60 + (idx * 8); const opacity = Math.min(1, layer.current / layer.max); ctx.strokeStyle = layer.color; ctx.lineWidth = 3; ctx.shadowColor = layer.color; ctx.shadowBlur = 10; ctx.globalAlpha = opacity; ctx.beginPath(); for(let k=0; k<3; k++) { const startAngle = layer.rotation + (k * (Math.PI*2)/3); ctx.moveTo(Math.cos(startAngle)*radius, Math.sin(startAngle)*radius); ctx.arc(0, 0, radius, startAngle, startAngle + ((Math.PI*2)/3 * 0.7)); } ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; });
        } else {
            // Disabled Shield Effect: Flickering Ghost
            if (s.frame % 6 < 3) {
                e.shieldLayers.forEach((layer, idx) => { if (layer.current <= 0) return; const radius = 60 + (idx * 8); ctx.strokeStyle = layer.color; ctx.lineWidth = 1; ctx.globalAlpha = 0.2; ctx.setLineDash([5, 10]); ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; });
            }
        }
        } else if (item.type === 'player' && !s.rescueMode) { ctx.translate(s.px, s.py); drawShip(ctx, { config: activeShip.config, fitting: activeShip.fitting, color: activeShip.color, wingColor: activeShip.wingColor, cockpitColor: activeShip.cockpitColor, gunColor: activeShip.gunColor, secondaryGunColor: activeShip.secondaryGunColor, gunBodyColor: activeShip.gunBodyColor, engineColor: activeShip.engineColor, nozzleColor: activeShip.nozzleColor }, true, s.movement); } else if (item.type === 'player' && s.rescueMode) {
            ctx.translate(s.px, s.py);
            const wobble = Math.sin(s.frame * 0.05) * 0.1;
            ctx.rotate(wobble);
            const w = 12; const h = 18;
            const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 20);
            grad.addColorStop(0, '#e2e8f0'); grad.addColorStop(0.5, '#94a3b8'); grad.addColorStop(1, '#475569');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.arc(0, -5, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(-1, -6, 1.5, 0, Math.PI * 2); ctx.fill();
            if (s.frame % 30 < 15) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, -h - 2, 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
        } else if (item.type === 'loot') { const l = item.obj as Loot; ctx.translate(l.x, l.y); ctx.scale(scale, scale); let boxSize = 16; let fontSizePx = 10; if (fontSize === 'medium') { boxSize = 22; fontSizePx = 14; } if (fontSize === 'large') { boxSize = 32; fontSizePx = 20; } const half = boxSize / 2; if (l.isBeingPulled) { const relX = s.px - l.x; const relY = s.py - l.y; const dist = Math.hypot(relX, relY); const angle = Math.atan2(relY, relX); ctx.save(); ctx.rotate(angle); const time = s.frame * 0.1; const ringRadius = 25 + Math.sin(time) * 3; ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.shadowBlur = 8; ctx.shadowColor = '#22d3ee'; ctx.beginPath(); ctx.arc(0, 0, ringRadius, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; const startX = ringRadius; const endX = dist; const waveSpeed = 8; const period = 16; const offset = (s.frame * waveSpeed) % period; ctx.shadowBlur = 4; ctx.shadowColor = '#22d3ee'; ctx.strokeStyle = 'rgba(165, 243, 252, 0.6)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let x = startX + offset; x < endX; x += period) { if (x > endX) continue; const t = (x - startX) / (endX - startX); let alpha = 0.8; if (t > 0.9) alpha *= ((1 - t) / 0.1); ctx.globalAlpha = alpha; const currentW = 10 + (2 * Math.sin(x * 0.1)); const curveDepth = currentW * 0.6; ctx.beginPath(); ctx.moveTo(x - curveDepth, -currentW/2); ctx.quadraticCurveTo(x + curveDepth, 0, x - curveDepth, currentW/2); ctx.stroke(); } ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore(); } if (l.type === 'ammo') { ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.rect(-half, -half, boxSize, boxSize); ctx.fill(); ctx.fillStyle = '#000'; ctx.font = `bold ${fontSizePx}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('B', 0, 1); } else if (l.type === 'missile') { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.rect(-half, -half, boxSize, boxSize); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `bold ${fontSizePx}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', 0, 1); } else if (l.type === 'mine') { ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.rect(-half, -half, boxSize, boxSize); ctx.fill(); ctx.fillStyle = '#000'; ctx.font = `bold ${fontSizePx}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('X', 0, 1); } else if (l.type === 'robot') { ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.rect(-half, -half, boxSize, boxSize); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `bold ${fontSizePx}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R', 0, 1); } else if (l.type === 'water') { ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(0, 0, half, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `bold ${fontSizePx}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H2O', 0, 1); } else if (l.type === 'energy') { ctx.fillStyle = '#8b5cf6'; ctx.beginPath(); ctx.rect(-half, -half, boxSize, boxSize); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `bold ${fontSizePx}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚡', 0, 1); } else { ctx.fillStyle = l.type === 'gold' ? '#fbbf24' : (l.type === 'platinum' ? '#e2e8f0' : '#a855f7'); ctx.fillRect(-half, -half, boxSize, boxSize); ctx.fillStyle = '#fff'; ctx.font = `bold ${fontSizePx}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l.type.substring(0,1).toUpperCase(), 0, 1); } } ctx.restore(); });
        
        s.bullets.forEach(b => { 
            ctx.save(); 
            ctx.translate(b.x, b.y); 
            if (b.glow) { ctx.shadowColor = b.color; ctx.shadowBlur = b.glowIntensity || 10; } 
            ctx.fillStyle = b.color; 
            
            if (b.type.includes('missile')) { 
                const angle = Math.atan2(b.vy, b.vx) + Math.PI/2; ctx.rotate(angle); const grad = ctx.createLinearGradient(-4, 0, 4, 0); grad.addColorStop(0, '#cbd5e1'); grad.addColorStop(0.5, '#f8fafc'); grad.addColorStop(1, '#94a3b8'); ctx.fillStyle = grad; ctx.fillRect(-4, -b.height/2 + 4, 8, b.height - 8); ctx.fillStyle = b.headColor || b.color; ctx.beginPath(); ctx.arc(0, -b.height/2 + 4, 4, Math.PI, 0); ctx.fill(); ctx.fillStyle = b.finsColor || b.color; ctx.beginPath(); ctx.moveTo(-4, b.height/2 - 8); ctx.lineTo(-10, b.height/2); ctx.lineTo(-4, b.height/2); ctx.fill(); ctx.beginPath(); ctx.moveTo(4, b.height/2 - 8); ctx.lineTo(10, b.height/2); ctx.lineTo(4, b.height/2); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(-2, b.height/2); ctx.lineTo(0, b.height/2 + (Math.random()*6 + 4)); ctx.lineTo(2, b.height/2); ctx.fill(); 
            } else if (b.type.includes('mine')) { 
                ctx.rotate(s.frame * 0.1); ctx.beginPath(); const spikes = 8; const outer = b.width/2; const inner = b.width/4; for(let i=0; i<spikes*2; i++){ const r = (i%2 === 0) ? outer : inner; const a = (Math.PI*2 * i) / (spikes*2); ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); } ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5 + Math.sin(s.frame*0.5)*0.5; ctx.beginPath(); ctx.arc(0,0, 3, 0, Math.PI*2); ctx.fill(); 
            } else if (b.type === 'star') {
                ctx.rotate((b.angleOffset || 0) + s.frame * 0.2);
                ctx.beginPath();
                const points = 5;
                const outer = b.width;
                const inner = b.width * 0.4;
                for(let i=0; i<points*2; i++){
                    const r = (i%2 === 0) ? outer : inner;
                    const a = (Math.PI*2 * i) / (points*2);
                    ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
                }
                ctx.closePath();
                ctx.fill();
            } else if (b.type === 'ring') {
                ctx.strokeStyle = b.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0,0, b.width/2, 0, Math.PI*2);
                ctx.stroke();
            } else if (b.type === 'bolt') {
                // ZEUS THUNDERBOLT VISUALS - Short Flying Segment
                const angle = Math.atan2(b.vy, b.vx) + Math.PI/2;
                ctx.rotate(angle);
                
                // Shiny Core
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00ffff'; 
                ctx.shadowBlur = 15;
                
                // Draw Zig Zag Path
                ctx.beginPath();
                
                // Draw vertically relative to rotated context
                // From -halfLength to +halfLength
                const halfLen = b.height / 2;
                const segments = 6;
                const step = b.height / segments;
                let currentY = -halfLen;
                let currentX = 0;
                
                ctx.moveTo(currentX, currentY);
                
                for(let k=1; k<=segments; k++) {
                    currentY += step;
                    currentX = (Math.random() - 0.5) * 12; // Jaggedness
                    ctx.lineTo(currentX, currentY);
                    
                    // Branching Sparks
                    if (Math.random() > 0.6) {
                        const branchLen = 10 + Math.random() * 15;
                        const branchX = currentX + (Math.random() > 0.5 ? 1 : -1) * branchLen;
                        const branchY = currentY + (Math.random() - 0.5) * 10;
                        
                        // Draw Branch
                        ctx.moveTo(currentX, currentY);
                        ctx.lineTo(branchX, branchY);
                        // Reset cursor to main path
                        ctx.moveTo(currentX, currentY); 
                    }
                }
                
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else if (b.type === 'plasma_jet') {
                const angle = Math.atan2(b.vy, b.vx) + Math.PI/2;
                ctx.rotate(angle);
                // Core
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                // Draw a diamond/spindle shape: Fat middle, thin ends
                // b.width is the fat middle, b.height is the length
                ctx.moveTo(0, -b.height/2); // Tip (Top)
                ctx.quadraticCurveTo(b.width/2, 0, 0, b.height/2); // Right side to bottom
                ctx.quadraticCurveTo(-b.width/2, 0, 0, -b.height/2); // Left side to top
                ctx.fill();
                
                // Outer glow stroke to define shape clearly
                ctx.shadowBlur = 0; 
                ctx.strokeStyle = b.color;
                ctx.lineWidth = 2;
                ctx.stroke();
                
            } else if (b.type === 'wave') {
                const angle = Math.atan2(b.vy, b.vx) + Math.PI/2;
                ctx.rotate(angle);
                ctx.strokeStyle = b.color;
                ctx.lineWidth = 3;
                if (b.glow) { ctx.shadowColor = b.color; ctx.shadowBlur = b.glowIntensity || 10; }
                ctx.beginPath();
                ctx.arc(0, 20, 30, Math.PI * 1.2, Math.PI * 1.8);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 30, 20, Math.PI * 1.2, Math.PI * 1.8);
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else if (b.type === 'flame') {
                // FLAMER VISUALS: Transparent Wind-like
                ctx.globalAlpha = Math.max(0, (b.life / 100) * 0.4); // Reduced max alpha from 1.0 to 0.4
                ctx.beginPath(); ctx.arc(0,0, b.width, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
            } else if (b.type === 'laser') { 
                // PHASER / LASER VISUALS: Rotation Support
                // Align rectangle with velocity vector
                const angle = Math.atan2(b.vy, b.vx) + Math.PI/2;
                ctx.rotate(angle);
                ctx.fillRect(-b.width/2, -b.height/2, b.width, b.height); 
            } else { 
                // Standard Projectile
                ctx.beginPath(); ctx.ellipse(0, 0, b.width/2, b.height/2, 0, 0, Math.PI*2); ctx.fill(); 
            } 
            ctx.restore(); 
        });
        
        s.particles.forEach(p => { 
            p.x += p.vx; p.y += p.vy; 
            
            if (p.type === 'ring') {
                p.size += 4; // Expand
                p.life -= 0.05;
                if (p.life > 0) {
                    ctx.save();
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = (p.lineWidth || 2) * p.life;
                    ctx.globalAlpha = p.life * 0.8;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            } else if (p.type === 'spark') {
                p.vx *= 0.9; p.vy *= 0.9;
                p.life -= 0.03;
                if (p.life > 0) {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, 2, 2);
                    ctx.globalAlpha = 1;
                }
            } else if (p.type === 'debris') {
                p.rotation = (p.rotation || 0) + (p.spin || 0);
                p.life -= 0.015;
                if (p.life > 0) {
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rotation);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.life;
                    ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
                    ctx.restore();
                }
            } else {
                p.life -= 0.02; 
                if (p.life > 0) { 
                    ctx.globalAlpha = p.life; 
                    ctx.fillStyle = p.color; 
                    ctx.beginPath(); 
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); 
                    ctx.fill(); 
                    ctx.globalAlpha = 1; 
                } 
            }
        });
        s.particles = s.particles.filter(p => p.life > 0);

        if (s.frame % 10 === 0) {
            let alertText = hud.alert;
            let alertType = hud.alertType;
            
            if (s.rescueMode) {}
            else if (s.hp < 30) { alertText = `RED ALERT: CORE MELTDOWN IMMINENT\nDETONATION IN ${(15 - s.criticalExposure/60).toFixed(0)}s`; alertType = "alert"; }
            else if (s.fuel <= 1.0) { alertText = "CRITICAL: FUEL DEPLETED\nRETURN TO BASE"; alertType = "warning"; } 
            
            setHud(prev => ({ ...prev, hp: s.hp, sh1: s.sh1, fuel: s.fuel, energy: s.energy, score: s.score, missiles: s.missiles, mines: s.mines, redMines: s.redMines, timer: s.time, cargoCount: s.cargo.length, chargeLevel: s.chargeLevel, boss: s.enemies.find(e => e.type === 'boss'), swivelMode: s.swivelMode, ammoCount: s.magazineCurrent, ammoType: s.selectedAmmo, isReloading: s.reloadTimer > 0, alert: alertText, alertType: alertType as any }));
        }
        raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const takeDamage = (amt: number, type: string = 'generic') => { /* ... unchanged ... */ const s = state.current; if (s.hp < 90) { const robotIdx = s.cargo.findIndex(c => c.type === 'robot'); if (robotIdx >= 0) { s.cargo[robotIdx].quantity--; if (s.cargo[robotIdx].quantity <= 0) s.cargo.splice(robotIdx, 1); audioService.playSfx('denied'); setHud(h => ({...h, alert: "ROBOT SACRIFICED", alertType: 'warning'})); return; } } let shieldDmg = amt; let hullDmg = amt; if (type.includes('missile') || type.includes('mine')) { const isEmp = type.includes('emp'); hullDmg = 100 * (isEmp ? 0.35 : 0.5); const pct = isEmp ? 1.0 : 0.5; const maxS1 = shield?.capacity || 0; const maxS2 = secondShield?.capacity || 0; if (s.sh2 > 0) shieldDmg = maxS2 * pct; else if (s.sh1 > 0) shieldDmg = maxS1 * pct; } if (s.sh2 > 0) s.sh2 = Math.max(0, s.sh2 - shieldDmg); else if (s.sh1 > 0) s.sh1 = Math.max(0, s.sh1 - shieldDmg); else s.hp = Math.max(0, s.hp - hullDmg); };
  
  // drawShip function (Unchanged from prev version but included for completeness)
  const drawShip = (ctx: CanvasRenderingContext2D, shipData: any, isPlayer = false, movement?: { up: boolean, down: boolean, left: boolean, right: boolean }) => { /* ... Same as existing drawShip ... */ const { config, color, wingColor, cockpitColor, gunColor, secondaryGunColor, gunBodyColor, engineColor, nozzleColor, fitting, equippedWeapons } = shipData; const scale = isPlayer ? 0.6 : 0.5; ctx.save(); ctx.scale(scale, scale); ctx.translate(-50, -50); const { wingStyle, hullShapeType } = config; const engineLocs = getEngineCoordinates(config); if (config.isAlien) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); const ovalY = wingStyle === 'alien-a' ? 55 : 45; ctx.ellipse(50, ovalY, 12, 35, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } const baseColor = wingColor || config.defaultColor || '#64748b'; ctx.fillStyle = baseColor; ctx.strokeStyle = baseColor; if (wingStyle === 'cylon') ctx.filter = 'brightness(0.7)'; else if (!wingColor || wingColor === color) ctx.filter = 'brightness(0.85)'; ctx.beginPath(); if (config.isAlien) { ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (wingStyle === 'alien-h') { ctx.moveTo(25, 20); ctx.lineTo(25, 75); ctx.moveTo(75, 20); ctx.lineTo(75, 75); ctx.moveTo(25, 48); ctx.lineTo(75, 48); ctx.stroke(); } else if (wingStyle === 'alien-w') { ctx.moveTo(10, 20); ctx.lineTo(35, 75); ctx.lineTo(50, 45); ctx.lineTo(65, 75); ctx.lineTo(90, 20); ctx.stroke(); } else if (wingStyle === 'alien-a') { ctx.moveTo(20, 75); ctx.bezierCurveTo(20, 10, 80, 10, 80, 75); ctx.moveTo(28, 55); ctx.lineTo(72, 55); ctx.stroke(); } else if (wingStyle === 'alien-m') { ctx.moveTo(20, 75); ctx.lineTo(20, 25); ctx.lineTo(50, 55); ctx.lineTo(80, 25); ctx.lineTo(80, 75); ctx.stroke(); } } else { if (wingStyle === 'delta') { ctx.moveTo(50, 25); ctx.lineTo(10, 80); ctx.lineTo(50, 70); ctx.lineTo(90, 80); ctx.fill(); } else if (wingStyle === 'x-wing') { ctx.beginPath(); ctx.moveTo(50, 48); ctx.quadraticCurveTo(20, 48, 5, 10); ctx.lineTo(25, 10); ctx.quadraticCurveTo(30, 40, 50, 38); ctx.fill(); ctx.beginPath(); ctx.moveTo(50, 48); ctx.quadraticCurveTo(80, 48, 95, 10); ctx.lineTo(75, 10); ctx.quadraticCurveTo(70, 40, 50, 38); ctx.fill(); ctx.beginPath(); ctx.moveTo(50, 48); ctx.lineTo(5, 90); ctx.lineTo(25, 90); ctx.lineTo(50, 55); ctx.fill(); ctx.beginPath(); ctx.moveTo(50, 48); ctx.lineTo(95, 90); ctx.lineTo(75, 90); ctx.lineTo(50, 55); ctx.fill(); } else if (wingStyle === 'pincer') { ctx.ellipse(50, 60, 45, 25, 0, 0, Math.PI * 2); ctx.moveTo(85, 60); ctx.ellipse(50, 60, 30, 15, 0, 0, Math.PI * 2, true); ctx.fill(); } else if (wingStyle === 'curved') { ctx.moveTo(50, 45); ctx.lineTo(10, 50); ctx.arc(10, 56, 6, -Math.PI/2, Math.PI/2, true); ctx.lineTo(50, 65); ctx.moveTo(50, 45); ctx.lineTo(90, 50); ctx.arc(90, 56, 6, -Math.PI/2, Math.PI/2, false); ctx.lineTo(50, 65); ctx.fill(); } else if (wingStyle === 'cylon') { ctx.moveTo(45, 80); ctx.bezierCurveTo(10, 80, 5, 60, 5, 10); ctx.arcTo(15, 10, 20, 40, 6); ctx.quadraticCurveTo(25, 40, 45, 50); ctx.lineTo(45, 80); ctx.moveTo(55, 80); ctx.bezierCurveTo(90, 80, 95, 60, 95, 10); ctx.arcTo(85, 10, 80, 40, 6); ctx.quadraticCurveTo(75, 40, 55, 50); ctx.lineTo(55, 80); ctx.fill(); } else { ctx.moveTo(50, 30); ctx.lineTo(10, 70); ctx.lineTo(50, 60); ctx.lineTo(90, 70); ctx.fill(); } } ctx.filter = 'none'; ctx.fillStyle = color || config.defaultColor || '#94a3b8'; ctx.beginPath(); if (wingStyle === 'x-wing') { ctx.ellipse(50, 50, 18, 45, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#64748b'; ctx.fillRect(36, 40, 4, 20); ctx.fillRect(60, 40, 4, 20); } else if (hullShapeType === 'none') { } else if (hullShapeType === 'triangle') { ctx.moveTo(50, 5); ctx.quadraticCurveTo(80, 80, 50, 90); ctx.quadraticCurveTo(20, 80, 50, 5); } else if (hullShapeType === 'block') { ctx.moveTo(40, 10); ctx.lineTo(60, 10); ctx.quadraticCurveTo(70, 10, 75, 30); ctx.lineTo(60, 75); ctx.quadraticCurveTo(50, 80, 40, 75); ctx.lineTo(25, 30); ctx.quadraticCurveTo(30, 10, 40, 10); } else if (hullShapeType === 'rounded') { if (ctx.roundRect) ctx.roundRect(30, 10, 40, 80, 20); else { ctx.moveTo(50, 10); ctx.arc(50, 30, 20, Math.PI, 0); ctx.lineTo(70, 70); ctx.arc(50, 70, 20, 0, Math.PI); ctx.lineTo(30, 30); } } else if (hullShapeType === 'saucer') ctx.ellipse(50, 50, 30, 30, 0, 0, Math.PI * 2); else if (hullShapeType === 'finger') ctx.ellipse(50, 50, 20, 40, 0, 0, Math.PI * 2); else if (hullShapeType === 'needle') { ctx.moveTo(50, 0); ctx.quadraticCurveTo(70, 50, 50, 95); ctx.quadraticCurveTo(30, 50, 50, 0); } else ctx.ellipse(50, 50, 20, 45, 0, 0, Math.PI * 2); ctx.fill(); if (isPlayer && movement) { ctx.save(); engineLocs.forEach(eng => { const nozzleH = config.isAlien ? 6 : 5; const jetY = eng.y + eng.h + nozzleH; const jetW = eng.w * 0.8; const jetX = eng.x - (jetW / 2); const length = movement.up ? 60 + Math.random() * 20 : 20 + Math.random() * 5; ctx.beginPath(); ctx.moveTo(jetX, jetY); ctx.lineTo(jetX + jetW/2, jetY + length); ctx.lineTo(jetX + jetW, jetY); const grad = ctx.createLinearGradient(jetX, jetY, jetX, jetY + length); grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.2, '#60a5fa'); grad.addColorStop(0.6, '#3b82f6'); grad.addColorStop(1, 'rgba(59, 130, 246, 0)'); ctx.fillStyle = grad; ctx.globalAlpha = movement.up ? 0.9 : 0.6; ctx.fill(); }); if (movement.down) { const retroLocs = [{x: 35, y: 30}, {x: 65, y: 30}]; retroLocs.forEach(loc => { ctx.beginPath(); ctx.moveTo(loc.x, loc.y); ctx.lineTo(loc.x - 3, loc.y - 15 - Math.random()*5); ctx.lineTo(loc.x + 3, loc.y - 15 - Math.random()*5); ctx.fillStyle = '#facc15'; ctx.globalAlpha = 0.8; ctx.fill(); }); } if (movement.left) { const rightSide = [{x: 85, y: 45}, {x: 85, y: 65}]; rightSide.forEach(loc => { ctx.beginPath(); ctx.moveTo(loc.x, loc.y); ctx.lineTo(loc.x + 25 + Math.random()*5, loc.y - 4); ctx.lineTo(loc.x + 25 + Math.random()*5, loc.y + 4); const grad = ctx.createLinearGradient(loc.x, loc.y, loc.x + 30, loc.y); grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, '#cbd5e1'); grad.addColorStop(1, 'rgba(203, 213, 225, 0)'); ctx.fillStyle = grad; ctx.globalAlpha = 0.9; ctx.fill(); }); } if (movement.right) { const leftSide = [{x: 15, y: 45}, {x: 15, y: 65}]; leftSide.forEach(loc => { ctx.beginPath(); ctx.moveTo(loc.x, loc.y); ctx.lineTo(loc.x - 25 - Math.random()*5, loc.y - 4); ctx.lineTo(loc.x - 25 - Math.random()*5, loc.y + 4); const grad = ctx.createLinearGradient(loc.x, loc.y, loc.x - 30, loc.y); grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, '#cbd5e1'); grad.addColorStop(1, 'rgba(203, 213, 225, 0)'); ctx.fillStyle = grad; ctx.globalAlpha = 0.9; ctx.fill(); }); } ctx.restore(); } const drawEngineRect = (x: number, y: number, w: number, h: number) => { const isAlien = config.isAlien; const eColor = isAlien ? '#172554' : (engineColor || '#334155'); const nColor = isAlien ? '#9ca3af' : (nozzleColor || '#475569'); const ew = w + 2; const eh = h + 2; const drawX = x - ew/2; ctx.fillStyle = eColor; ctx.beginPath(); if (isAlien) { ctx.ellipse(x, y + eh/2, ew/2, eh/2, 0, 0, Math.PI * 2); } else { const r = 3; if (ctx.roundRect) ctx.roundRect(drawX, y, ew, eh, r); else ctx.rect(drawX, y, ew, eh); } ctx.fill(); ctx.fillStyle = nColor; const nozzleH = isAlien ? 6 : 5; const flare = isAlien ? 4 : 3; const inset = isAlien ? 1 : 0; ctx.beginPath(); if (isAlien) { const nozzleStart = y + eh - 2; ctx.moveTo(drawX + inset, nozzleStart); ctx.lineTo(drawX + ew - inset, nozzleStart); ctx.lineTo(drawX + ew + flare, nozzleStart + nozzleH); ctx.lineTo(drawX - flare, nozzleStart + nozzleH); } else { ctx.moveTo(drawX + inset, y + eh); ctx.lineTo(drawX + ew - inset, y + eh); ctx.lineTo(drawX + ew + flare, y + eh + nozzleH); ctx.lineTo(drawX - flare, y + eh + nozzleH); } ctx.fill(); }; engineLocs.forEach(eng => drawEngineRect(eng.x, eng.y, eng.w, eng.h)); ctx.fillStyle = cockpitColor || '#0ea5e9'; ctx.beginPath(); if (config.isAlien) { const cy = wingStyle === 'alien-a' ? 65 : 45; ctx.ellipse(50, cy, 8, 20, 0, 0, Math.PI * 2); } else if (wingStyle === 'x-wing') { ctx.ellipse(50, 55, 8, 12, 0, 0, Math.PI * 2); } else { ctx.ellipse(50, 40, 8, 12, 0, 0, Math.PI * 2); } ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); if (wingStyle === 'x-wing') { ctx.ellipse(48, 52, 3, 5, -0.2, 0, Math.PI * 2); } else { const cy = (config.isAlien && wingStyle === 'alien-a') ? 65 : (config.isAlien ? 45 : 38); ctx.ellipse(48, cy - 2, 3, 5, -0.2, 0, Math.PI * 2); } ctx.fill(); if (config.isAlien) { ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.lineCap = 'round'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8; const cy = wingStyle === 'alien-a' ? 65 : 45; const gap = 8; ctx.beginPath(); ctx.ellipse(50, cy, 8 + gap, 20 + gap, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.setLineDash([]); } const drawWeapon = (x: number, y: number, id: string | undefined, type: 'primary' | 'secondary', slotIndex: number) => { ctx.save(); const def = id ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === id) : null; let recoilY = 0; let heatFactor = 0; let showFlash = false; let isFiring = false; if (isPlayer) { const lastFire = state.current.weaponFireTimes[slotIndex] || 0; const timeSinceFire = Date.now() - lastFire; if (def?.isAmmoBased) { if (timeSinceFire < 80) showFlash = true; if (timeSinceFire < 200) isFiring = true; const heatVal = state.current.weaponHeat[slotIndex] || 0; heatFactor = Math.min(1, heatVal / 50); } else { if (timeSinceFire < 200) isFiring = true; } } ctx.translate(x, y + recoilY); if (isPlayer && state.current.swivelMode && def?.isAmmoBased) { const baseAngle = Math.sin(state.current.frame * 0.1) * 13; const rotDeg = slotIndex === 1 ? baseAngle : (slotIndex === 2 ? -baseAngle : 0); ctx.rotate((rotDeg * Math.PI) / 180); } const isSecondary = type === 'secondary'; const isAlien = config.isAlien; const isExotic = id?.includes('exotic'); const isStandardProjectile = def && def.type === 'PROJECTILE' && !isExotic; const scale = isAlien && isExotic ? 1.4 : (isExotic ? 1.0 : 1.45); ctx.scale(scale, scale); if (isStandardProjectile && def) { const stdBodyColor = (gunBodyColor && gunBodyColor !== '#334155') ? gunBodyColor : '#451a03'; let barrelColor = '#52525b'; if (heatFactor > 0.2) { barrelColor = mixColor('#52525b', '#ef4444', (heatFactor - 0.2) * 1.2); } const isRotary = (def.barrelCount || 1) > 1; ctx.fillStyle = stdBodyColor; if (id?.includes('vulcan')) { if(ctx.roundRect) {ctx.beginPath(); ctx.roundRect(-4.25, 0, 8.5, 12, 3); ctx.fill();} else ctx.fillRect(-4.25, 0, 8.5, 12); } else if (id?.includes('heavy')) { if(ctx.roundRect) {ctx.beginPath(); ctx.roundRect(-6, 0, 12, 10, 3); ctx.fill();} else ctx.fillRect(-6, 0, 12, 10); } else { if(ctx.roundRect) {ctx.beginPath(); ctx.roundRect(-4.25, 0, 8.5, 10, 3); ctx.fill();} else ctx.fillRect(-4.25, 0, 8.5, 10); } if (isRotary) { const rotOffset = isFiring ? (Date.now() / 50) % 3 : 0; const bw = 2; const bl = 24; const bx = [-3, -1, 1]; bx.forEach((offX, i) => { const brightness = Math.abs(Math.sin((i + rotOffset) * (Math.PI/1.5))); const cVal = Math.floor(82 + (brightness * 100)); const baseBar = `rgb(${cVal},${cVal},${cVal})`; const finalBar = heatFactor > 0.2 ? mixColor(baseBar, '#ef4444', (heatFactor - 0.2)) : baseBar; ctx.fillStyle = finalBar; ctx.fillRect(offX, -bl, bw, bl); }); ctx.fillStyle = '#18181b'; ctx.fillRect(-3.5, -bl-1, 7, 2); } else { ctx.fillStyle = barrelColor; ctx.fillRect(-1.5, -16, 3, 16); ctx.fillStyle = '#27272a'; ctx.fillRect(-2, -16, 4, 2); const holeCount = 4; const holeStart = -12; const holeSpacing = 3; for(let i=0; i<holeCount; i++) { const hy = holeStart + (i * holeSpacing); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, hy, 0.8, 0, Math.PI*2); ctx.fill(); if (isFiring && isPlayer) { const ventScale = Math.random() * 0.5 + 0.5; ctx.fillStyle = i % 2 === 0 ? '#facc15' : '#ef4444'; ctx.beginPath(); ctx.arc(-2, hy, 1 * ventScale, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(2, hy, 1 * ventScale, 0, Math.PI*2); ctx.fill(); } } } if (showFlash) { ctx.save(); const flashY = isRotary ? -26 : -18; ctx.translate(0, flashY); ctx.fillStyle = Math.random() > 0.5 ? '#facc15' : '#ef4444'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, 2); ctx.lineTo(0, 0); ctx.lineTo(-4, 2); ctx.fill(); ctx.restore(); } } else { let baseGunColor = isSecondary ? (secondaryGunColor || '#38bdf8') : (gunColor || config.noseGunColor || '#ef4444'); const gunBody = config.isAlien ? '#374151' : (gunBodyColor || '#334155'); ctx.fillStyle = gunBody; if (id?.includes('plasma') || isExotic) { if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-3.6, -14, 7.2, 12, [5, 5, 0, 0]); ctx.fill(); } else { ctx.fillRect(-3.6, -14, 7.2, 12); } ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -8, 3, 0, Math.PI*2); ctx.fill(); if (isFiring) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -8, 2, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; } } else { ctx.fillRect(-4.25, 0, 8.5, 10); ctx.fillStyle = baseGunColor; ctx.fillRect(-2.5, -12, 5, 12); if (isFiring) { ctx.save(); ctx.shadowColor = baseGunColor; ctx.shadowBlur = 15; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-1.5, -11, 3, 10); ctx.restore(); } } } ctx.restore(); }; const weaponsList = equippedWeapons || (fitting ? fitting.weapons : null); const mainId = weaponsList ? (weaponsList[0]?.id || null) : (config.weaponId || 'gun_bolt'); if (mainId) { if (wingStyle === 'alien-h') { drawWeapon(25, 20, mainId, 'primary', 0); drawWeapon(75, 20, mainId, 'primary', 0); } else if (wingStyle === 'alien-w') { drawWeapon(10, 20, mainId, 'primary', 0); drawWeapon(90, 20, mainId, 'primary', 0); } else if (wingStyle === 'alien-m') { drawWeapon(20, 25, mainId, 'primary', 0); drawWeapon(80, 25, mainId, 'primary', 0); } else if (wingStyle === 'alien-a') { drawWeapon(50, 22, mainId, 'primary', 0); } else if (wingStyle === 'x-wing') { drawWeapon(50, 20, mainId, 'primary', 0); } else { drawWeapon(50, 10, mainId, 'primary', 0); } } if (weaponsList) { const mounts = getWingMounts(config); if (weaponsList[1]) drawWeapon(mounts[0].x, mounts[0].y, weaponsList[1]?.id, 'secondary', 1); if (weaponsList[2]) drawWeapon(mounts[1].x, mounts[1].y, weaponsList[2]?.id, 'secondary', 2); } if (isPlayer && (shield || secondShield)) { const drawShieldRing = (s: Shield | null, radius: number) => { if (!s) return; const vType = s.visualType; ctx.save(); ctx.strokeStyle = s.color; ctx.lineWidth = 4; ctx.shadowColor = s.color; ctx.shadowBlur = 10; ctx.globalAlpha = 0.5; ctx.beginPath(); if (vType === 'forward') { ctx.arc(50, 50, radius, -Math.PI * 0.8, -Math.PI * 0.2); } else { ctx.arc(50, 50, radius, 0, Math.PI * 2); } ctx.stroke(); ctx.restore(); }; if (shield) drawShieldRing(shield, 66); if (secondShield) drawShieldRing(secondShield, 77); } ctx.restore(); };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden cursor-crosshair">
        <canvas ref={canvasRef} className="absolute inset-0 z-10" />
        
        {/* HUD - Top Center Score */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center z-20 pointer-events-none">
            <span className={`${hudLabel} font-black text-emerald-500 uppercase tracking-widest`}>SCORE</span>
            <span className={`${hudScore} font-black text-white drop-shadow-[0_0_10px_rgba(16,185,129,0.5)] tabular-nums`}>{hud.score.toLocaleString()}</span>
            
            {/* MISSION TIMER */}
            <div className={`mt-2 px-3 py-1 rounded bg-zinc-900/80 border ${hud.timer <= 30 ? 'border-red-500 animate-pulse' : 'border-zinc-700'}`}>
                <span className={`${hudTimer} font-mono font-bold ${hud.timer <= 30 ? 'text-red-500' : 'text-zinc-300'}`}>
                    {Math.floor(hud.timer / 60)}:{(hud.timer % 60).toString().padStart(2, '0')}
                </span>
            </div>
        </div>

        {/* HUD - Left Bars */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20 pointer-events-none w-48">
            <div className="flex flex-col gap-1">
                <div className={`flex justify-between ${hudLabel} font-black text-zinc-400`}><span>HULL</span><span>{Math.ceil(hud.hp)}%</span></div>
                <div className="h-2 bg-zinc-900 border border-zinc-700"><div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${hud.hp}%`}}/></div>
            </div>
            <div className="flex flex-col gap-1">
                <div className={`flex justify-between ${hudLabel} font-black text-zinc-400`}><span>FUEL</span><span>{Math.floor((hud.fuel/maxFuel)*100)}%</span></div>
                <div className={`h-2 bg-zinc-900 border border-zinc-700 ${hud.fuel <= 1.0 ? 'animate-pulse' : ''}`}><div className={`h-full transition-all duration-300 ${hud.fuel <= 1.0 ? 'bg-red-600' : 'bg-amber-500'}`} style={{width: `${(hud.fuel/maxFuel)*100}%`}}/></div>
            </div>
            {shield && (
                <div className="flex flex-col gap-1">
                    <div className={`flex justify-between ${hudLabel} font-black text-zinc-400`}><span>SHIELD</span><span>{Math.floor((hud.sh1/(shield?.capacity||1))*100)}%</span></div>
                    <div className="h-2 bg-zinc-900 border border-zinc-700"><div className="h-full bg-blue-500 transition-all duration-300" style={{width: `${Math.min(100, (hud.sh1/(shield?.capacity||1))*100)}%`}}/></div>
                </div>
            )}
        </div>

        {/* HUD - Right Bars */}
        <div className="absolute top-1/2 right-4 transform -translate-y-1/2 flex gap-3 z-20 pointer-events-none h-64">
            <div className="flex flex-col items-center gap-1">
                <span className={`${hudLabel} font-black text-blue-400 -rotate-90 mb-2`}>PWR</span>
                <div className="flex-grow w-4 bg-zinc-900 border border-zinc-700 relative flex flex-col-reverse p-0.5 gap-[2px]">
                    {Array.from({length: 20}).map((_, i) => (
                        <div key={i} className={`w-full h-[4.5%] ${i < (hud.energy/maxEnergy)*20 ? 'bg-blue-500 shadow-[0_0_5px_#3b82f6]' : 'bg-zinc-800'}`} />
                    ))}
                </div>
            </div>
            {hasAmmoWeapons && (
                <div className="flex flex-col items-center gap-1">
                    <span className={`${hudLabel} font-black text-yellow-400 -rotate-90 mb-2`}>MAG</span>
                    <div className="flex-grow w-4 bg-zinc-900 border border-zinc-700 relative flex flex-col-reverse p-0.5 gap-[2px]">
                        {Array.from({length: 20}).map((_, i) => (
                            <div key={i} className={`w-full h-[4.5%] ${i < (hud.ammoCount/1000)*20 ? 'bg-yellow-500 shadow-[0_0_5px_#eab308]' : 'bg-zinc-800'} ${hud.isReloading ? 'animate-pulse bg-red-500' : ''}`} />
                        ))}
                    </div>
                    {hud.isReloading && <span className={`absolute bottom-[-20px] ${hudLabel} font-black text-red-500 animate-pulse`}>RELOAD</span>}
                </div>
            )}
        </div>

        {/* HUD - Bottom Left Ordnance Counters */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none flex flex-row gap-4">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center rounded">
                    <ItemSVG type="missile" color="#ef4444" size={18} />
                </div>
                <div className="flex flex-col">
                    <span className={`${hudLabel} font-black text-zinc-400 uppercase`}>MISSILES</span>
                    <span className={`${hudOrdnance} font-black text-white leading-none`}>{hud.missiles}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center rounded">
                    <ItemSVG type="mine" color="#fbbf24" size={18} />
                </div>
                <div className="flex flex-col">
                    <span className={`${hudLabel} font-black text-zinc-400 uppercase`}>MINES</span>
                    <span className={`${hudOrdnance} font-black text-white leading-none`}>{hud.mines}</span>
                </div>
            </div>
            {hud.redMines > 0 && (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-zinc-900 border border-red-500/50 flex items-center justify-center rounded shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                        <ItemSVG type="mine" color="#ef4444" size={18} />
                    </div>
                    <div className="flex flex-col">
                        <span className={`${hudLabel} font-black text-red-400 uppercase animate-pulse`}>OMEGA</span>
                        <span className={`${hudOrdnance} font-black text-white leading-none`}>{hud.redMines}</span>
                    </div>
                </div>
            )}
        </div>

        {/* HUD - Bottom Center Message Panel */}
        {hud.alert && (
            <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 border-x-4 bg-zinc-950/90 backdrop-blur-sm z-40 pointer-events-none transition-all duration-300 min-w-[200px] max-w-[300px] text-center flex flex-col justify-center ${hud.alertType === 'warning' ? 'border-amber-500 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : (hud.alertType === 'alert' ? 'border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse' : 'border-emerald-500 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]')}`}>
                <span className={`${hudAlertText} font-black uppercase tracking-[0.2em] whitespace-pre-wrap leading-tight`}>{hud.alert}</span>
            </div>
        )}

        {/* HUD - Bottom Right Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[60] pointer-events-none">
            <div className="pointer-events-auto flex gap-2">
                <button onClick={() => {
                    state.current.paused = !state.current.paused;
                    setHud(h => ({...h, isPaused: state.current.paused}));
                }} className="px-4 py-2 bg-zinc-800 border border-zinc-600 text-white text-xs font-bold hover:bg-zinc-700 shadow-lg min-w-[80px]">
                    {hud.isPaused ? "RESUME" : "PAUSE"}
                </button>
                <button onClick={() => {
                    const s = state.current;
                    const finalHp = s.criticalExposure > 0 || s.rescueMode ? 10 : s.hp;
                    const finalFuel = s.criticalExposure > 0 || s.rescueMode ? s.fuel * 0.5 : s.fuel;
                    
                    onGameOver(false, hud.score, true, { 
                        health: finalHp, 
                        fuel: finalFuel, 
                        rockets: s.missiles, 
                        mines: s.mines, 
                        redMineCount: s.redMines, 
                        cargo: s.cargo, 
                        ammo: s.ammo, 
                        magazineCurrent: s.magazineCurrent, 
                        reloadTimer: s.reloadTimer 
                    })
                }} className={`px-4 py-2 border text-xs font-bold shadow-lg transition-all ${state.current.criticalExposure > 0 || state.current.rescueMode ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-red-900/50 border-red-600 text-red-200 hover:bg-red-800'}`}>
                    {state.current.criticalExposure > 0 || state.current.rescueMode ? 'EJECT NOW' : 'ABORT'}
                </button>
            </div>
        </div>

        {hud.isPaused && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="text-4xl font-black text-white tracking-[0.5em] animate-pulse">PAUSED</div>
            </div>
        )}
        
        {hud.boss && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-1/3 z-20 pointer-events-none">
                <div className={`flex justify-between ${hudLabel} font-black text-purple-400 mb-1`}><span>BOSS INTEGRITY</span><span>{Math.floor(hud.boss.hp)}/{hud.boss.maxHp}</span></div>
                <div className="h-4 bg-zinc-900 border border-purple-500/50 relative overflow-hidden mb-2">
                    <div className="absolute inset-0 bg-purple-900/30" />
                    <div className="h-full bg-purple-600 transition-all duration-200" style={{width: `${Math.max(0, (hud.boss.hp/hud.boss.maxHp)*100)}%`}} />
                </div>
                
                {(() => {
                    // Calculate Total Shield Status
                    const shieldCurrent = hud.boss.shieldLayers.reduce((acc: number, l: any) => acc + l.current, 0);
                    const shieldMax = hud.boss.shieldLayers.reduce((acc: number, l: any) => acc + l.max, 0);
                    if (shieldMax <= 0) return null;
                    
                    return (
                        <>
                            <div className={`flex justify-between ${hudLabel} font-black text-cyan-400 mb-1`}>
                                <span>SHIELD MATRIX</span>
                                <span>{Math.floor(shieldCurrent)}/{Math.floor(shieldMax)}</span>
                            </div>
                            <div className="h-2 bg-zinc-900 border border-cyan-500/50 relative overflow-hidden">
                                <div className="absolute inset-0 bg-cyan-900/30" />
                                <div className="h-full bg-cyan-500 transition-all duration-200" style={{width: `${Math.max(0, (shieldCurrent/shieldMax)*100)}%`}} />
                            </div>
                        </>
                    );
                })()}
            </div>
        )}
    </div>
  );
};

export default GameEngine;
