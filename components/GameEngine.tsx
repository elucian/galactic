
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

// --- INTERFACES & CLASSES ---
interface Projectile {
  x: number; y: number; vx: number; vy: number;
  damage: number; color: string; type: string; life: number;
  isEnemy: boolean; width: number; height: number;
  glow?: boolean; glowIntensity?: number; isMain?: boolean;
  weaponId?: string; isOvercharge?: boolean; isTracer?: boolean; traceColor?: string;
  homingState?: 'searching' | 'tracking' | 'returning' | 'engaging' | 'launching';
  target?: Enemy | null;
  launchTime?: number; headColor?: string; finsColor?: string; turnRate?: number; maxSpeed?: number;
  accel?: number; z?: number;
  angleOffset?: number; growthRate?: number; originalSize?: number;
  isEmp?: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife?: number;
  size: number; color: string; type?: string;
  decay?: number; grow?: number; initialAlpha?: number;
  rotation?: number; spin?: number;
}

interface FloatingText {
  x: number; y: number;
  text: string;
  life: number;
  color: string;
  vy: number;
  size: number;
}

interface Loot {
  x: number; y: number; z: number;
  type: string; id?: string; name?: string; quantity?: number;
  isPulled: boolean; isBeingPulled?: boolean; vx: number; vy: number;
}

class Asteroid {
  x: number; y: number; z: number; hp: number; vx: number; vy: number; vz: number; size: number; color: string; 
  loot: { type: string, id?: string, name?: string; quantity?: number } | null = null;
  vertices: {x:number, y:number, z:number}[]; 
  faces: {indices: number[], normal: {x:number, y:number, z:number}}[];
  ax: number = 0; ay: number = 0; az: number = 0; vax: number; vay: number; vaz: number;

  constructor(w: number, diff: number, quadrant: QuadrantType) {
    this.x = Math.random() * w; this.y = -200; this.z = (Math.random() - 0.5) * 600;
    this.vy = 2 + Math.random() * 2; 
    this.vx = (Math.random() - 0.5) * 6; 
    this.vz = (Math.random() - 0.5);
    this.size = 15 + Math.random() * 25; 
    this.hp = (this.size * 30) + (this.size * this.size);
    this.vax = (Math.random() - 0.5) * 0.05; 
    this.vay = (Math.random() - 0.5) * 0.05; 
    this.vaz = (Math.random() - 0.5) * 0.05; 
    
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
    const variant = ASTEROID_VARIANTS.find(v => v.type === selectedType) || ASTEROID_VARIANTS[2]; 
    this.color = variant.color;

    if (this.size > 30 && Math.random() < 0.1) {
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

    // Icosahedron approximation for 3D rock look
    const t = (1 + Math.sqrt(5)) / 2; 
    const r = 1/t; 
    const p = t;
    const baseVerts = [
        [1,1,1], [1,1,-1], [1,-1,1], [1,-1,-1],
        [-1,1,1], [-1,1,-1], [-1,-1,1], [-1,-1,-1],
        [0, r, p], [0, r, -p], [0, -r, p], [0, -r, -p],
        [r, p, 0], [r, -p, 0], [-r, p, 0], [-r, -p, 0],
        [p, 0, r], [p, 0, -r], [-p, 0, r], [-p, 0, -r]
    ];
    // Add randomness to vertices for "rocky" look
    this.vertices = baseVerts.map(v => ({ 
        x: v[0]*this.size + (Math.random()-0.5)*this.size*0.3, 
        y: v[1]*this.size + (Math.random()-0.5)*this.size*0.3, 
        z: v[2]*this.size + (Math.random()-0.5)*this.size*0.3
    }));
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
        const standardEnergy = 'gun_pulse';
        
        if (this.config.isAlien) {
            const wId = 'gun_photon'; 
            if (this.config.defaultGuns === 1) {
                this.equippedWeapons[0] = { id: wId, count: 1 };
            } else {
                this.equippedWeapons[1] = { id: wId, count: 1 };
                this.equippedWeapons[2] = { id: wId, count: 1 };
            }
        } else {
            this.equippedWeapons[0] = { id: standardEnergy, count: 1 };
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

  update(px: number, py: number, w: number, h: number, incomingFire: Projectile[], worldSpeedFactor: number = 1.0) {
    if (this.vibration > 0) this.vibration = Math.max(0, this.vibration - 1);
    
    if (this.stunnedUntil > 0) this.stunnedUntil--;
    if (this.shieldDisabledUntil > 0) this.shieldDisabledUntil--;

    // Dynamic vertical speed based on player throttle (worldSpeedFactor)
    // Base speed is around 2.8. 
    const verticalSpeed = 2.8 * worldSpeedFactor;

    if (this.stunnedUntil > 0) {
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.vy += 0.5 * worldSpeedFactor; // Gravity affects stun drift
    } else {
        if (this.type === 'boss') {
            if (this.shieldLayers.length > 0 && this.shieldRegen > 0 && this.shieldDisabledUntil <= 0) {
                const top = this.shieldLayers[0];
                if (top.current < top.max) top.current = Math.min(top.max, top.current + this.shieldRegen);
            }
            this.vx = (this.vx + (px - this.x) * 0.002) * 0.96;
            this.vy = (this.vy + (150 - this.y) * 0.01) * 0.92;
        } else {
            this.y += verticalSpeed; 
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

  takeDamage(amount: number, type: string, isMain: boolean, isOvercharge: boolean = false, isEmp: boolean = false): { dmg: number, isShield: boolean } {
      const isBoss = this.type === 'boss';
      let actualDamage = 0;
      let hitShield = false;
      
      if (type === 'bolt') {
          this.stunnedUntil = 60; 
          this.shieldDisabledUntil = 60; 
          this.vibration = 40;
      }

      if (type === 'mine_red' || isEmp || type.includes('emp')) {
          this.shieldLayers = []; 
          if (!isEmp) { 
              const dmg = isBoss ? this.maxHp * 0.4 : 99999;
              this.hp -= dmg;
              actualDamage = dmg;
          } else {
              // EMP shot just breaks shields, minor hull dmg
              this.vibration = 30;
              this.shieldDisabledUntil = 120; // 2 seconds disabled
              this.hp -= 50; 
              actualDamage = 50;
          }
          audioService.playExplosion(0, 2.0); 
          audioService.playShieldHit();
          return { dmg: actualDamage, isShield: false };
      }

      if (type === 'missile' || type === 'mine') {
          let percentage = isBoss ? 0.25 : 0.8;
          if (type === 'mine') percentage = isBoss ? 0.3 : 0.9;
          
          if (this.shieldLayers.length > 0 && this.shieldDisabledUntil <= 0) {
              const layer = this.shieldLayers[0];
              const shieldDmg = layer.max * 0.8; 
              layer.current -= shieldDmg;
              actualDamage = shieldDmg;
              hitShield = true;
              if (layer.current <= 0) { this.shieldLayers.shift(); audioService.playShieldHit(); } 
              else { audioService.playShieldHit(); }
              this.vibration = 30;
          } else {
              actualDamage = this.maxHp * percentage;
              this.hp -= actualDamage;
              this.vibration = 40;
          }
          return { dmg: actualDamage, isShield: hitShield };
      }
      
      if (this.shieldLayers.length > 0 && this.shieldDisabledUntil <= 0) {
          let shieldDmg = amount;
          if (isMain) {
              if (isOvercharge) { 
                  shieldDmg *= 3.0; // Bonus vs Shield for Power Shots
                  this.vibration = 20; 
              } else { 
                  shieldDmg *= 0.5; // Penalty vs Shield for Rapid Fire
              }
          }
          else if (type === 'laser' || type === 'bolt') shieldDmg *= 1.5;
          else if (type === 'projectile' || type === 'star' || type === 'flame') shieldDmg *= 0.3;
          
          if (amount > 50) this.vibration = Math.max(this.vibration, 5);

          const layer = this.shieldLayers[0];
          layer.current -= shieldDmg;
          actualDamage = shieldDmg;
          hitShield = true;
          if (layer.current <= 0) { this.shieldLayers.shift(); audioService.playShieldHit(); } else { audioService.playShieldHit(); }
      } else {
          let dmg = amount;
          if (isMain) {
              if (isOvercharge) {
                  dmg *= 1.0; // Standard damage vs Hull for Power Shots
              } else {
                  dmg *= 3.0; // Increased Bonus vs Hull for Rapid Fire
              }
          } else if (type === 'projectile' || type === 'star') dmg *= 2.0;
          else if (type === 'flame') dmg *= 1.2; 
          this.hp -= dmg;
          actualDamage = dmg;
      }
      
      return { dmg: Math.floor(actualDamage), isShield: hitShield };
  }
}

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
  fontSize: 'small' | 'medium' | 'large' | 'extra-large'; mode?: 'combat' | 'drift'; planetRegistry?: Record<string, PlanetStatusData>; 
}

const LEDMeter = ({ value, max, colorStart, label, vertical = false, reverseColor = false }: { value: number, max: number, colorStart: string, label: string, vertical?: boolean, reverseColor?: boolean }) => {
    const segments = 20; // 20 segments for the bar
    const pct = Math.max(0, Math.min(1, value / max));
    const filled = Math.ceil(pct * segments);

    let activeColor = colorStart;
    
    if (reverseColor) {
        // Reverse Logic (e.g. Heat/Load)
        if (pct > 0.9) activeColor = '#ef4444'; // Red
        else if (pct > 0.7) activeColor = '#facc15'; // Yellow
    } else {
        // Standard Logic (Depleting Resource like Fuel/Energy)
        if (pct < 0.1) activeColor = '#ef4444'; // Red
        else if (pct < 0.3) activeColor = '#facc15'; // Yellow
    }

    return (
        <div className={`flex ${vertical ? 'flex-col items-center h-40' : 'flex-col items-center'} gap-1`}>
            {vertical ? (
                <>
                    <div className="flex flex-col-reverse gap-[1px] bg-black p-[2px] border border-zinc-800 rounded h-full w-5 shadow-inner">
                        {Array.from({ length: segments }).map((_, i) => {
                            const isActive = i < filled;
                            return (
                                <div
                                    key={i}
                                    className="w-full h-[5px] rounded-[1px] transition-colors duration-150"
                                    style={{
                                        backgroundColor: isActive ? activeColor : '#18181b',
                                        boxShadow: isActive ? `0 0 6px ${activeColor}` : 'none',
                                        opacity: isActive ? 1 : 0.5
                                    }}
                                />
                            );
                        })}
                    </div>
                    {/* Compact Single Letter Label */}
                    <div className="w-5 h-5 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded mt-1">
                        <span className="text-[10px] font-black text-white">{label}</span>
                    </div>
                </>
            ) : null}
        </div>
    );
};

const RoundCadran = ({ value, max }: { value: number, max: number }) => {
    const percentage = Math.min(1, Math.max(0, value / max));
    
    // Color Logic: Full=Green, <30%=Yellow, <10%=Red
    let color = '#10b981'; // Green
    if (percentage < 0.1) color = '#ef4444'; // Red
    else if (percentage < 0.3) color = '#facc15'; // Yellow

    const segments = 10;
    const activeSegments = Math.ceil(percentage * segments);
    
    // Config for arc (Increased 25% again per request)
    const radius = 25; 
    const center = { x: 30, y: 30 };
    const strokeWidth = 5; 
    const paths = [];

    // Draw 10 segments in a 180 degree arc (from -180 to 0 degrees)
    for(let i=0; i<segments; i++) {
        // Start from -180 (left) going to 0 (right)
        const startAngle = -180 + (i * (180/segments));
        const endAngle = startAngle + (180/segments) - 4; // -4 gap
        
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        
        const x1 = center.x + radius * Math.cos(startRad);
        const y1 = center.y + radius * Math.sin(startRad);
        const x2 = center.x + radius * Math.cos(endRad);
        const y2 = center.y + radius * Math.sin(endRad);
        
        const d = `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
        const isActive = i < activeSegments;
        
        paths.push(
            <path 
                key={i} 
                d={d} 
                fill="none" 
                stroke={isActive ? color : '#334155'} 
                strokeWidth={strokeWidth} 
                strokeLinecap="round"
                className="transition-colors duration-200"
            />
        );
    }

    // Angular Indicator (Needle)
    const needleAngle = -180 + (percentage * 180);
    const needleRad = (needleAngle * Math.PI) / 180;
    const nx = center.x + (radius - 2) * Math.cos(needleRad);
    const ny = center.y + (radius - 2) * Math.sin(needleRad);

    return (
        <div className="w-16 h-10 flex justify-center items-end mb-1">
            <svg width="60" height="35" viewBox="0 0 60 35">
                {paths}
                <line x1={center.x} y1={center.y} x2={nx} y2={ny} stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
                <circle cx={center.x} cy={center.y} r="2" fill="rgba(255,255,255,0.5)" />
            </svg>
        </div>
    );
};

// Utility Button for HUD
const HudButton = ({ label, subLabel, onClick, onDown, onUp, colorClass, borderClass, active = false, count, maxCount }: any) => {
    return (
        <div className="flex flex-col items-center">
            {count !== undefined && <RoundCadran value={count} max={maxCount || 10} />}
            <button 
                onMouseDown={onDown} onMouseUp={onUp} onMouseLeave={onUp} onTouchStart={onDown} onTouchEnd={onUp} onClick={onClick}
                className={`flex flex-col items-center justify-center p-1 sm:p-2 min-w-[50px] sm:min-w-[60px] h-12 sm:h-14 rounded border-2 select-none transition-all active:scale-95 ${active ? 'bg-zinc-800' : 'bg-zinc-900/80'} ${borderClass}`}
            >
                <span className={`text-[8px] sm:text-[10px] font-black uppercase ${colorClass}`}>{label}</span>
                {subLabel && <span className="text-[6px] sm:text-[8px] font-mono text-zinc-500">{subLabel}</span>}
            </button>
        </div>
    );
}

const GameEngine: React.FC<GameEngineProps> = ({ ships, shield, secondShield, onGameOver, difficulty, currentPlanet, quadrant, fontSize, mode = 'combat' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeShip = ships[0];
  const maxEnergy = activeShip?.config?.maxEnergy || 1000;
  const maxFuel = activeShip?.config?.maxFuel || 1.0;
  const maxWater = activeShip?.config?.maxWater || 100;
  
  const hasAmmoWeapons = activeShip?.fitting.weapons.some(w => {
      if (!w) return false;
      const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === w.id);
      return def?.isAmmoBased;
  });

  const hasGuns = activeShip?.fitting.weapons.some(w => !!w);

  const hudLabel = fontSize === 'small' ? 'text-[8px]' : (fontSize === 'large' ? 'text-[12px]' : 'text-[10px]');
  const hudScore = fontSize === 'small' ? 'text-xl' : (fontSize === 'large' ? 'text-4xl' : 'text-3xl');
  const hudAlertText = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[12px]');

  const [hud, setHud] = useState({ 
    hp: 100, sh1: 0, sh2: 0, energy: maxEnergy, score: 0, missiles: 0, mines: 0, redMines: 0, fuel: 0, water: 0,
    alert: mode === 'drift' ? "DRIFTING" : "SYSTEMS READY", alertType: 'info', 
    timer: mode === 'drift' ? 60 : 120, boss: null as any, cargoCount: 0, isPaused: false,
    chargeLevel: 0,
    swivelMode: false,
    ammoCount: 0,
    ammoType: 'iron',
    isReloading: false,
    overload: 0,
    overdrive: false,
    rescueMode: false
  });
  
  const inputRef = useRef({ main: false, secondary: false });
  const tiltRef = useRef({ beta: 0, gamma: 0 }); 
  const hasTiltRef = useRef(false);

  const state = useRef({
    px: window.innerWidth/2, py: window.innerHeight*0.8, hp: 100, fuel: 0, water: 0, energy: maxEnergy, 
    sh1: 0, sh2: 0, score: 0, time: mode === 'drift' ? 60 : 120, phase: 'travel', bossSpawned: false, bossDead: false,
    enemies: [] as Enemy[], asteroids: [] as Asteroid[], bullets: [] as Projectile[], 
    particles: [] as Particle[], floatingTexts: [] as FloatingText[], loot: [] as Loot[], stars: [] as {x:number, y:number, s:number}[],
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
    failureTimer: 0, 
    movement: { up: false, down: false, left: false, right: false },
    criticalExposure: 0,
    rescueMode: false,
    rescueTimer: 0,
    usingWater: false,
    overload: 0,
    overdrive: false,
    overdriveFirstShot: false,
    charging: false, // New flag for manual shift charge
    shakeX: 0,
    shakeY: 0,
    shakeDecay: 0.9,
    // NEW CAPACITOR LOGIC
    capacitor: 0,
    isCapacitorCharging: false,
    salvoTimer: 0,
    lastSalvoFire: 0,
    // NEW MOVEMENT LOGIC
    currentThrottle: 0, // -1.0 to 1.0 (smooth)
    shipVy: 0,
  });

  useEffect(() => {
      const s = state.current;
      s.hp = activeShip.fitting.health;
      s.fuel = activeShip.fitting.fuel;
      s.water = activeShip.fitting.water || 100;
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

      const handleOrientation = (e: DeviceOrientationEvent) => {
          if (e.beta !== null) {
              hasTiltRef.current = true;
              tiltRef.current.beta = e.beta || 0; 
              tiltRef.current.gamma = e.gamma || 0; 
          }
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('deviceorientation', handleOrientation);
      return () => { 
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('deviceorientation', handleOrientation);
          audioService.stopCharging(); 
          audioService.stopCapacitorCharge();
      };
  }, []);

  const handleTabReload = () => {
      const s = state.current;
      if (s.ammo[s.selectedAmmo] > 0 && s.magazineCurrent < 1000) {
          const needed = 1000 - s.magazineCurrent;
          const take = Math.min(needed, s.ammo[s.selectedAmmo]);
          s.magazineCurrent += take;
          s.ammo[s.selectedAmmo] -= take;
          s.reloadTimer = 0; 
          setHud(h => ({...h, isReloading: false, alert: 'INSTANT RELOAD'}));
          audioService.playSfx('buy');
          return;
      }
      audioService.playSfx('denied');
  };

  useEffect(() => {
    const k = state.current.keys;
    const kd = (e: KeyboardEvent) => { 
        if(e.repeat) return;
        
        if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === '-' || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract')) { e.preventDefault(); }
        if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Backspace') e.preventDefault();
        
        k.add(e.code); 
        
        if(e.code === 'KeyP') { state.current.paused = !state.current.paused; setHud(h => ({...h, isPaused: state.current.paused})); }
        if(e.code === 'Escape') {
            const s = state.current;
            let finalHp = s.hp; let finalFuel = s.fuel;
            if (s.criticalExposure > 0 || s.rescueMode) { finalHp = 10; finalFuel *= 0.5; }
            onGameOver(false, s.score, true, { health: finalHp, fuel: finalFuel, water: s.water, rockets: s.missiles, mines: s.mines, redMineCount: s.redMines, cargo: s.cargo, ammo: s.ammo, magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer });
        }
        if(!state.current.paused && state.current.active && !state.current.rescueMode) {
            if(e.code === 'KeyM' || e.code === 'NumpadAdd' || e.code === 'Backspace') fireMissile();
            if(e.code === 'KeyN' || e.code === 'NumpadEnter' || e.code === 'Enter') fireMine();
            if(e.code === 'KeyB') fireRedMine(); 
            if (e.code === 'Tab') handleTabReload();
            // Removed CapsLock trigger for swivel
            if (e.code === 'Space') inputRef.current.main = true;
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') inputRef.current.secondary = true;
        }
    };
    const ku = (e: KeyboardEvent) => {
        k.delete(e.code);
        if (e.code === 'Space') inputRef.current.main = false;
        if (e.code === 'ControlLeft' || e.code === 'ControlRight') inputRef.current.secondary = false;
    };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const fireSalvoShot = () => {
      const s = state.current;
      const mainWeapon = activeShip.fitting.weapons[0];
      const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null;
      const dmg = (mainDef ? mainDef.damage : 45) * 3.0; // 3x Damage for Salvo Shot
      const color = mainDef ? mainDef.beamColor : '#fff';
      
      // Powerful single shot with spread effect
      const angle = (Math.random() - 0.5) * 0.1;
      s.bullets.push({
          x: s.px, y: s.py - 24, 
          vx: Math.sin(angle) * 15, vy: -Math.cos(angle) * 25, 
          damage: dmg, 
          color: color || '#fff', 
          type: 'laser', 
          life: 50, 
          isEnemy: false, 
          width: 12, height: 60, // Larger visual
          glow: true, glowIntensity: 30, 
          isMain: true, 
          weaponId: mainWeapon?.id || 'gun_pulse',
          isOvercharge: true
      });
      
      s.weaponFireTimes[0] = Date.now();
      audioService.playWeaponFire('mega', 0, activeShip.config.id);
      s.shakeX = 5;
      s.shakeY = 5;
  };

  const fireRapidShot = () => {
      const s = state.current;
      const mainWeapon = activeShip.fitting.weapons[0];
      const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null;
      const fireRate = mainDef ? mainDef.fireRate : 4;
      const delay = 1000 / fireRate;

      if (Date.now() - s.lastRapidFire > delay) {
          let damage = mainDef ? mainDef.damage : 45;
          let weaponId = mainDef ? mainDef.id : 'gun_pulse';
          const crystalColor = (mainDef?.beamColor) || (activeShip.gunColor || activeShip.config.noseGunColor || '#f87171');
          
          if (mainDef?.id === 'exotic_phaser_sweep') {
              const cycleFrames = 30; const sweepFrames = 18; const cycleIndex = Math.floor(s.frame / cycleFrames); const frameInCycle = s.frame % cycleFrames;
              if (frameInCycle < sweepFrames) {
                  const prog = frameInCycle / sweepFrames; const range = 60 * (Math.PI / 180); const start = 0 - (30 * Math.PI / 180);
                  let a = 0; if (cycleIndex % 2 === 0) { a = start + (range * prog); } else { a = (start + range) - (range * prog); }
                  s.bullets.push({ x: s.px, y: s.py - 24, vx: Math.sin(a) * 40, vy: -Math.cos(a) * 40, damage, color: '#facc15', type: 'laser', life: 15, isEnemy: false, width: 3, height: 100, weaponId, glow: true, glowIntensity: 15 });
              }
          } else {
              s.bullets.push({ x: s.px, y: s.py - 24, vx: 0, vy: -30, damage, color: crystalColor, type: 'laser', life: 50, isEnemy: false, width: 4, height: 25, glow: true, glowIntensity: 5, isMain: true, weaponId });
              audioService.playWeaponFire('cannon', 0, activeShip.config.id);
          }
          
          s.weaponFireTimes[0] = Date.now();
          s.weaponHeat[0] = Math.min(100, (s.weaponHeat[0] || 0) + 1.0);
          s.lastRapidFire = Date.now();
      }
  };

  const fireMissile = () => { const s = state.current; if (s.missiles > 0) { const isEmp = s.missiles % 2 !== 0; s.missiles--; s.lastMissileFire = Date.now(); s.bullets.push({ x: s.px, y: s.py, vx: 0, vy: -2, damage: 0, color: isEmp ? '#22d3ee' : '#ef4444', type: isEmp ? 'missile_emp' : 'missile', life: 600, isEnemy: false, width: 12, height: 28, homingState: 'launching', launchTime: s.frame, headColor: isEmp ? '#22d3ee' : '#ef4444', finsColor: isEmp ? '#0ea5e9' : '#ef4444', turnRate: 0.05, maxSpeed: 14, z: 0 }); audioService.playWeaponFire(isEmp ? 'emp' : 'missile'); } };
  const fireMine = () => { const s = state.current; if (s.mines > 0) { const isEmp = s.mines % 2 !== 0; s.mines--; s.lastMineFire = Date.now(); s.mineSide = !s.mineSide; const sideAngle = s.mineSide ? -235 : 55; const rad = (sideAngle * Math.PI) / 180; const spread = (Math.random() - 0.5) * 0.5; const speed = 3 + Math.random(); s.bullets.push({ x: s.px, y: s.py + 20, vx: Math.cos(rad + spread) * speed, vy: Math.sin(rad + spread) * speed, damage: 0, color: isEmp ? '#22d3ee' : '#fbbf24', type: isEmp ? 'mine_emp' : 'mine', life: 600, isEnemy: false, width: 14, height: 14, homingState: 'launching', launchTime: s.frame, turnRate: 0.08, maxSpeed: 10, z: 0 }); audioService.playWeaponFire('mine'); } };
  const fireRedMine = () => { const s = state.current; if (s.redMines > 0) { s.redMines--; s.lastRedMineFire = Date.now(); s.omegaSide = !s.omegaSide; const sideAngle = s.omegaSide ? -235 : 55; const rad = (sideAngle * Math.PI) / 180; const speed = 1.5; s.bullets.push({ x: s.px, y: s.py + 30, vx: Math.cos(rad) * speed, vy: Math.sin(rad) * speed, damage: 0, color: '#ef4444', type: 'mine_red', life: 600, isEnemy: false, width: 20, height: 20, homingState: 'searching', turnRate: 0.05, maxSpeed: 8, z: 0, glow: true, glowIntensity: 30 }); audioService.playWeaponFire('mine'); setHud(h => ({...h, alert: 'OMEGA MINE DEPLOYED', alertType: 'warning'})); } };
  const spawnLoot = (x: number, y: number, z: number, type: string, id?: string, name?: string, quantity: number = 1) => { state.current.loot.push({ x, y, z, type, id, name, quantity, isPulled: false, vx: (Math.random()-0.5), vy: (Math.random()-0.5) }); };
  
  const fireAlienWeapons = () => {
      const s = state.current;
      const mounts = getWingMounts(activeShip.config); 
      const slots = [0, 1, 2];
      const scale = 0.6; 
      let fired = false;
      slots.forEach(slotIdx => {
          const w = activeShip.fitting.weapons[slotIdx];
          if (w && w.id) {
              const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id);
              if (wDef) {
                  const lastFire = s.weaponFireTimes[slotIdx] || 0;
                  const delay = 1000 / wDef.fireRate;
                  if (Date.now() - lastFire < delay) return;
                  if (s.energy < wDef.energyCost) return;
                  
                  let startX = s.px; let startY = s.py;
                  if (slotIdx === 0) { startY = s.py - 30; } else { const mountIdx = slotIdx - 1; const m = mounts[mountIdx]; startX = s.px + (m.x - 50) * scale; startY = s.py + (m.y - 50) * scale; }
                  const damage = wDef.damage; const color = wDef.beamColor || '#fff'; const bulletSpeed = w.id.includes('exotic') ? 12 : 18; 
                  if (wDef.type === WeaponType.LASER) { s.bullets.push({ x: startX, y: startY, vx: 0, vy: -30, damage, color, type: 'laser', life: 50, isEnemy: false, width: 4, height: 25, weaponId: w.id }); } 
                  else { s.bullets.push({ x: startX, y: startY, vx: 0, vy: -bulletSpeed, damage, color, type: 'projectile', life: 60, isEnemy: false, width: 4, height: 16, weaponId: w.id }); }
                  s.weaponFireTimes[slotIdx] = Date.now(); s.energy -= wDef.energyCost; fired = true;
              }
          }
      });
      if (fired) { if (activeShip.fitting.weapons.some(w => w?.id === 'exotic_flamer')) { audioService.playWeaponFire('flame', 0, activeShip.config.id); } else { audioService.playWeaponFire('cannon', 0, activeShip.config.id); } }
  };

  const fireWingWeapons = () => {
      const s = state.current;
      const mounts = getWingMounts(activeShip.config); 
      const wings = [activeShip.fitting.weapons[1], activeShip.fitting.weapons[2]]; 
      let fired = false; 
      wings.forEach((w, i) => { 
          if (w && w.id) { 
              const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id); 
              if (wDef) { 
                  const interval = Math.max(1, Math.floor(60 / wDef.fireRate)); 
                  if (s.frame % interval === 0) { 
                      if (wDef.isAmmoBased) { if (s.magazineCurrent <= 0) return; s.magazineCurrent--; } 
                      else if (s.energy < wDef.energyCost) return; 
                      
                      s.weaponFireTimes[i+1] = Date.now(); 
                      const scale = 0.6; const mx = mounts[i].x; const my = mounts[i].y; 
                      const startX = s.px + (mx - 50) * scale; const startY = s.py + (my - 50) * scale; 
                      const damage = wDef.damage; const color = wDef.beamColor || '#fff'; 
                      s.bullets.push({ x: startX, y: startY, vx: 0, vy: -20, damage, color, type: wDef.type === WeaponType.LASER ? 'laser' : 'projectile', life: 60, isEnemy: false, width: 4, height: 16, weaponId: w.id }); 
                      fired = true; if (!wDef.isAmmoBased) s.energy -= wDef.energyCost; 
                  } 
              } 
          } 
      }); 
      if (fired) audioService.playWeaponFire('cannon', 0, activeShip.config.id); 
  };

  const createExplosion = (x: number, y: number, color: string, count: number, type: 'standard' | 'boss' | 'asteroid' | 'mine' = 'standard') => { 
      const s = state.current;
      s.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, color: '#ffffff', size: type === 'boss' ? 50 : 25 }); 
      for(let i=0; i<count; i++) { 
          const angle = Math.random() * Math.PI * 2; 
          const speed = Math.random() * (type === 'boss' ? 12 : 8) + 2; 
          s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.0 + Math.random() * 0.5, color: Math.random() > 0.5 ? color : '#ffffff', size: Math.random()*3+2 }); 
      }
  };
  
  useEffect(() => {
    const cvs = canvasRef.current; if(!cvs) return;
    const ctx = cvs.getContext('2d'); if(!ctx) return;
    let raf: number;
    const s = state.current;

    const loop = () => {
        if (!s.active) return;
        if (s.paused) { setHud(h => ({...h, isPaused: true})); raf = requestAnimationFrame(loop); return; }

        const width = cvs.width = window.innerWidth;
        const height = cvs.height = window.innerHeight;
        s.frame++;

        const speed = 9;
        
        // --- INPUT & MOVEMENT LOGIC (SMOOTHING) ---
        let targetThrottle = 0;
        let left = s.keys.has('ArrowLeft') || s.keys.has('KeyA') || s.keys.has('Numpad4');
        let right = s.keys.has('ArrowRight') || s.keys.has('KeyD') || s.keys.has('Numpad6');

        if (hasTiltRef.current) {
            if (tiltRef.current.gamma < -10) left = true;
            if (tiltRef.current.gamma > 10) right = true;
            
            // TILT LOGIC:
            // Beta < 25 (Flat/Forward): Accelerate (Throttle 1)
            // Beta > 35 (Upright/Back): Brake (Throttle -1)
            // Beta 25-35: Deadzone (Throttle 0)
            if (tiltRef.current.beta < 25) targetThrottle = 1;
            else if (tiltRef.current.beta > 35) targetThrottle = -1;
            else targetThrottle = 0;
        } else {
            // DESKTOP KEYS
            if (s.keys.has('ArrowUp') || s.keys.has('KeyW') || s.keys.has('Numpad8')) targetThrottle = 1;
            else if (s.keys.has('ArrowDown') || s.keys.has('KeyS') || s.keys.has('Numpad2')) targetThrottle = -1;
        }

        // Interpolate current throttle towards target (Smoothness)
        // Lerp factor 0.1 for nice weight
        s.currentThrottle = s.currentThrottle * 0.9 + targetThrottle * 0.1;
        
        // Snap to 0 if very close
        if (Math.abs(s.currentThrottle) < 0.01) s.currentThrottle = 0;

        // Apply Movement Y based on throttle
        // Throttle > 0: Move Up (Screen Y decreases)
        // Throttle < 0: Move Down (Screen Y increases)
        // Max vertical speed ~8px/frame
        const verticalSpeed = -s.currentThrottle * 8; 
        s.py += verticalSpeed;
        
        // Clamp Y
        s.py = Math.max(50, Math.min(height - 150, s.py));

        // Horizontal Movement
        if (left) s.px -= speed;
        if (right) s.px += speed;
        s.px = Math.max(30, Math.min(width-30, s.px));

        s.movement = { 
            up: s.currentThrottle > 0.1, 
            down: s.currentThrottle < -0.1, 
            left, 
            right 
        };
        
        let isMoving = s.currentThrottle !== 0 || left || right;
        s.usingWater = false; 

        // World Speed Multiplier (Stars/Enemies relative speed)
        // Forward (Throttle > 0) -> Faster World
        // Brake (Throttle < 0) -> Slower World
        let worldSpeedFactor = 1.0;
        if (s.currentThrottle > 0.1) worldSpeedFactor = 1.0 + (s.currentThrottle * 0.5); // Max 1.5x
        if (s.currentThrottle < -0.1) worldSpeedFactor = 1.0 + (s.currentThrottle * 0.5); // Min 0.5x (since throttle is negative)

        if (s.rescueMode) {
            const driftSpeed = 3;
            if (isMoving) {
               // Drift logic overrides normal physics
               if (s.currentThrottle > 0) s.py -= driftSpeed;
               if (s.currentThrottle < 0) s.py += driftSpeed;
               s.px = Math.max(30, Math.min(width-30, s.px)); s.py = Math.max(50, Math.min(height-150, s.py));
            }
            if (s.frame % 3 === 0) s.particles.push({ x: s.px, y: s.py + 10, vx: (Math.random()-0.5)*2, vy: 2 + Math.random()*2, life: 1.0, color: '#555', size: 4 });
        } else {
            if (isMoving) {
                let consumption = 0.005; 
                // Higher consumption for acceleration
                if (s.currentThrottle > 0.1) consumption += 0.002 * s.currentThrottle;
                
                if (s.fuel > 0) { s.fuel = Math.max(0, s.fuel - consumption); s.usingWater = false; } else if (s.water > 0) { s.water = Math.max(0, s.water - (consumption * 0.5)); s.usingWater = true; } else { isMoving = false; }
                if (s.water > 0) s.water = Math.max(0, s.water - 0.01);
            }
            if (s.hp < 30) {
                if (s.frame % 5 === 0) s.particles.push({ x: s.px + (Math.random()-0.5)*20, y: s.py + 10, vx: (Math.random()-0.5)*1, vy: 2, life: 0.8, color: '#777', size: 3 + Math.random()*3 });
                if (s.hp < 15 && s.frame % 10 === 0) s.particles.push({ x: s.px + (Math.random()-0.5)*15, y: s.py, vx: 0, vy: 1, life: 0.5, color: '#f97316', size: 2 });
            }
        }
        
        const isFiring = s.keys.has('Space') || inputRef.current.main;

        // Passive Energy Recharge (Slow)
        if (!s.isCapacitorCharging) {
            s.energy = Math.min(maxEnergy, s.energy + 1.0); // Reduced regeneration
        }
        
        if (!s.rescueMode) {
            // --- MAIN GUN LOGIC ---
            // Passive Charging when NOT firing
            if (!isFiring && s.capacitor < 100) {
                if (s.energy > 0) {
                    s.capacitor = Math.min(100, s.capacitor + 0.5); 
                    
                    // Determine drain based on weapon price
                    const mainWeapon = activeShip.fitting.weapons[0];
                    const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null;
                    const price = mainDef?.price || 2000;
                    // Formula: Expensive guns drain less energy to charge capacitor.
                    // Base drain: 1.5. Min drain: 0.2. Max Price ~100k.
                    // Price 2k -> Drain ~1.46. Price 100k -> Drain 0.2.
                    const drainRate = Math.max(0.2, 1.5 - (price / 80000));

                    s.energy = Math.max(0, s.energy - drainRate);
                    if (!s.isCapacitorCharging) {
                        audioService.startCapacitorCharge();
                        s.isCapacitorCharging = true;
                    }
                } else {
                    if (s.isCapacitorCharging) { audioService.stopCapacitorCharge(); s.isCapacitorCharging = false; }
                }
            } else {
                if (s.isCapacitorCharging) {
                    audioService.stopCapacitorCharge();
                    s.isCapacitorCharging = false;
                }
            }

            // Auto-Refill Energy from Cargo
            if (s.energy < maxEnergy * 0.1) {
                const energyIdx = s.cargo.findIndex(c => c.type === 'energy');
                if (energyIdx >= 0) {
                    const item = s.cargo[energyIdx];
                    item.quantity--;
                    if (item.quantity <= 0) s.cargo.splice(energyIdx, 1);
                    s.energy = Math.min(maxEnergy, s.energy + 500);
                    setHud(h => ({...h, alert: "RESERVE POWER INJECTED", alertType: 'warning'}));
                    audioService.playSfx('buy');
                }
            }

            if (activeShip.config.isAlien) { 
                if (isFiring) fireAlienWeapons();
            } else {
                // New Firing Logic
                // Priority: Salvo (>20 charge) -> Rapid (Empty/Low Charge)
                if (isFiring) {
                    const salvoCost = 20;
                    if (s.capacitor >= salvoCost) {
                        // Rate limiter for Salvo (slower than rapid)
                        // e.g., 4 shots/sec = 15 frames @ 60fps
                        if (s.frame - s.lastSalvoFire > 15) {
                            fireSalvoShot();
                            s.capacitor = Math.max(0, s.capacitor - salvoCost);
                            s.lastSalvoFire = s.frame;
                        }
                    } else {
                        // Fallback to Rapid Fire (Normal rate)
                        fireRapidShot();
                    }
                }
            }
            const firingSecondary = s.keys.has('ControlLeft') || s.keys.has('ControlRight') || inputRef.current.secondary;
            if (firingSecondary && !activeShip.config.isAlien) { fireWingWeapons(); }
        }

        // SCREEN SHAKE UPDATE
        if (s.shakeX > 0) s.shakeX *= s.shakeDecay;
        if (s.shakeY > 0) s.shakeY *= s.shakeDecay;
        if (s.shakeX < 0.5) s.shakeX = 0;
        if (s.shakeY < 0.5) s.shakeY = 0;

        if (s.phase === 'boss') {
            const boss = s.enemies.find(e => e.type === 'boss');
            if (boss && boss.y > height + 100) {
                if (s.failureTimer === 0) setHud(h => ({...h, alert: "MISSION FAILED. RETURN TO BASE.", alertType: 'alert'}));
                s.failureTimer++;
                if (s.failureTimer > 600) { onGameOver(false, s.score, false, { health: s.hp, fuel: s.fuel, water: s.water }); s.active = false; }
            }
            if (s.bossDead) { s.victoryTimer++; if (s.victoryTimer > 180) { onGameOver(true, s.score, false, { health: s.hp, fuel: s.fuel, water: s.water, rockets: s.missiles, mines: s.mines, redMineCount: s.redMines, cargo: s.cargo, ammo: s.ammo, magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer }); s.active = false; } }
        }

        if (s.phase === 'travel') { 
            if (s.enemies.length < 3 + difficulty/2 && Date.now() - s.lastSpawn > 1500 && !s.rescueMode) { 
                let spawnPool = SHIPS.filter(s => !s.isAlien); 
                if (difficulty >= 2) spawnPool = [...spawnPool, ...SHIPS.filter(s => s.isAlien)];
                const selectedShip = spawnPool[Math.floor(Math.random() * spawnPool.length)] || SHIPS[0]; 
                s.enemies.push(new Enemy(Math.random()*width, -50, 'fighter', selectedShip, difficulty, quadrant)); 
                s.lastSpawn = Date.now(); 
            } 
            if (s.asteroids.length < 3 && Math.random() > 0.99 && !s.rescueMode) s.asteroids.push(new Asteroid(width, difficulty, quadrant));
            if (s.time <= 0) { s.phase = 'boss'; s.enemies = []; const bossConfig = BOSS_SHIPS[Math.floor(Math.random() * BOSS_SHIPS.length)]; s.enemies.push(new Enemy(width/2, -200, 'boss', bossConfig, difficulty, quadrant)); setHud(h => ({...h, alert: "BOSS DETECTED", alertType: 'alert'})); } else if (s.frame % 60 === 0) s.time--; 
        }

        s.asteroids.forEach(a => { 
            a.x += a.vx; a.y += a.vy * worldSpeedFactor; a.z += a.vz; 
            a.ax += a.vax; a.ay += a.vay; a.az += a.vaz;
            if (Math.abs(a.z) < 50 && Math.hypot(a.x-s.px, a.y-s.py) < a.size + 30 && !s.rescueMode) {
                takeDamage(20, 'collision');
                a.hp = 0;
                createExplosion(a.x, a.y, '#aaa', 10, 'asteroid');
            }
        }); 
        s.asteroids = s.asteroids.filter(a => a.y < height + 100 && a.hp > 0);

        s.enemies.forEach(e => { 
            if (s.rescueMode) { e.y += 3; if (e.type === 'boss') e.y += 2; } 
            else {
                e.update(s.px, s.py, width, height, s.bullets, worldSpeedFactor); 
                if (difficulty >= 2 && e.type !== 'boss') {
                    const fireInterval = e.config.isAlien ? 120 : 180;
                    if (s.frame % fireInterval === 0 && Math.abs(e.x - s.px) < 300) {
                        const w = e.equippedWeapons[0];
                        if (w) { s.bullets.push({ x: e.x, y: e.y + 20, vx: 0, vy: 5, damage: 10, color: '#ef4444', type: 'projectile', life: 100, isEnemy: true, width: 6, height: 12 }); }
                    }
                }
                if (e.type === 'boss') {
                    if (s.frame % 60 === 0) {
                        s.bullets.push({ x: e.x - 20, y: e.y + 40, vx: (Math.random()-0.5)*2, vy: 6, damage: 20, color: '#a855f7', type: 'projectile', life: 100, isEnemy: true, width: 10, height: 20 });
                        s.bullets.push({ x: e.x + 20, y: e.y + 40, vx: (Math.random()-0.5)*2, vy: 6, damage: 20, color: '#a855f7', type: 'projectile', life: 100, isEnemy: true, width: 10, height: 20 });
                    }
                }
                if (Math.abs(e.z) < 50 && Math.hypot(e.x-s.px, e.y-s.py) < 60) {
                    takeDamage(30, 'collision');
                    if(e.type !== 'boss') e.hp = 0;
                    createExplosion(e.x, e.y, '#f00', 10);
                }
            }
        });
        s.enemies = s.enemies.filter(e => e.hp > 0 && e.y < height + 200);

        s.bullets.forEach(b => { 
            b.x += b.vx; b.y += b.vy; b.life--; 
            if (b.isEnemy && !s.rescueMode) { 
                if (Math.hypot(b.x-s.px, b.y-s.py) < 30) { takeDamage(b.damage, b.type); b.life = 0; createExplosion(b.x, b.y, b.color, 3); } 
            } else if (!b.isEnemy) { 
                let hit = false; 
                s.enemies.forEach(e => { 
                    const hitDist = (b.type.includes('missile') || b.type.includes('mine')) ? (e.type === 'boss' ? 100 : 60) : (e.type === 'boss' ? 80 : 40); 
                    if (Math.hypot(b.x-e.x, b.y-e.y) < hitDist) { 
                        const dmgResult = e.takeDamage(b.damage, b.type as any, !!b.isMain, !!b.isOvercharge, !!b.isEmp); 
                        if (dmgResult.dmg > 0) {
                            s.floatingTexts.push({
                                x: e.x + (Math.random() - 0.5) * 40,
                                y: e.y,
                                text: dmgResult.dmg.toString(),
                                life: 1.0,
                                color: dmgResult.isShield ? '#3b82f6' : '#ef4444',
                                vy: -2 - Math.random(),
                                size: dmgResult.dmg > 100 ? 20 : 14
                            });
                        }
                        hit = true; createExplosion(b.x, b.y, b.color, 2); 
                    } 
                });
                s.asteroids.forEach(a => {
                    if (Math.hypot(b.x-a.x, b.y-a.y) < a.size + 10) {
                        let dmg = b.damage;
                        if (b.isOvercharge) dmg *= 5.0; // Bonus vs Asteroids (Up from 3.0)
                        a.hp -= dmg;
                        if (a.hp <= 0 && a.loot) spawnLoot(a.x, a.y, a.z, a.loot.type, a.loot.id, a.loot.name, a.loot.quantity || 1);
                        hit = true; createExplosion(b.x, b.y, '#888', 5, 'asteroid');
                        s.floatingTexts.push({
                            x: a.x,
                            y: a.y,
                            text: Math.floor(dmg).toString(),
                            life: 0.8,
                            color: '#9ca3af',
                            vy: -1,
                            size: 12
                        });
                    }
                });
                if (hit) b.life = 0;
            }
        }); 
        s.bullets = s.bullets.filter(b => b.life > 0 && b.y > -200 && b.y < height + 200);
        
        // Update Floating Texts
        s.floatingTexts.forEach(ft => {
            ft.y += ft.vy;
            ft.life -= 0.02;
        });
        s.floatingTexts = s.floatingTexts.filter(ft => ft.life > 0);

        // Update Loot
        s.loot.forEach(l => {
            const dx = s.px - l.x;
            const dy = s.py - l.y;
            const dist = Math.hypot(dx, dy);
            
            // Attraction (Increased radius from 150 to 175)
            if (dist < 175) {
                l.isBeingPulled = true;
                // Stronger pull (0.08) and NO gravity to avoid equilibrium trap below ship
                l.x += dx * 0.08;
                l.y += dy * 0.08;
            } else {
                l.isBeingPulled = false;
                // Only apply gravity/drift if NOT being pulled
                l.y += 2 * worldSpeedFactor; 
                l.x += l.vx; 
                l.y += l.vy;
            }
            
            // Collection
            if (dist < 30) {
                l.isPulled = true; // Mark for deletion
                audioService.playSfx('buy');
                
                // Refill Logic
                if (l.type === 'fuel') { s.fuel = Math.min(maxFuel, s.fuel + 1.0); setHud(h => ({...h, alert: "+FUEL", alertType: 'success'})); }
                else if (l.type === 'water') { s.water = Math.min(maxWater, s.water + 20); setHud(h => ({...h, alert: "+WATER", alertType: 'success'})); }
                else if (l.type === 'energy') { s.energy = Math.min(maxEnergy, s.energy + 200); setHud(h => ({...h, alert: "+ENERGY", alertType: 'success'})); }
                else if (l.type === 'repair' || l.type === 'nanite') { s.hp = Math.min(100, s.hp + 10); setHud(h => ({...h, alert: "+HULL REPAIR", alertType: 'success'})); }
                else if (l.type === 'missile') { s.missiles = Math.min(10, s.missiles + 2); }
                else if (l.type === 'mine') { s.mines = Math.min(10, s.mines + 2); }
                else {
                    s.score += 500;
                    s.floatingTexts.push({ x: l.x, y: l.y, text: "+500", life: 1.0, color: '#fbbf24', vy: -3, size: 16 });
                }
            }
        });
        s.loot = s.loot.filter(l => !l.isPulled && (l.y < height + 100 || l.isBeingPulled));

        s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; });
        s.particles = s.particles.filter(p => p.life > 0);

        // DRAWING
        // Apply Screen Shake transform globally
        const shakeX = (Math.random() - 0.5) * s.shakeX;
        const shakeY = (Math.random() - 0.5) * s.shakeY;
        ctx.save();
        ctx.translate(shakeX, shakeY);

        ctx.fillStyle = '#000'; ctx.fillRect(-shakeX, -shakeY, width, height); // Fill slightly larger to cover shake edges
        ctx.fillStyle = '#fff'; s.stars.forEach(st => { st.y += st.s * 0.5 * worldSpeedFactor; if(st.y > height) st.y = 0; ctx.globalAlpha = Math.random() * 0.5 + 0.3; ctx.beginPath(); ctx.arc(st.x, st.y, st.s, 0, Math.PI*2); ctx.fill(); }); ctx.globalAlpha = 1;

        const entities = [...s.asteroids.map(a => ({type: 'ast', z: a.z, obj: a})), ...s.enemies.map(e => ({type: 'enemy', z: e.z, obj: e})), ...s.loot.map(l => ({type: 'loot', z: l.z, obj: l})), {type: 'player', z: 0, obj: null}].sort((a,b) => a.z - b.z);
        const lightVec = { x: 0.8, y: -0.8, z: 0.8 }; const len = Math.hypot(lightVec.x, lightVec.y, lightVec.z); lightVec.x /= len; lightVec.y /= len; lightVec.z /= len;

        entities.forEach(item => {
            const scale = 1 + (item.z / 1000);
            if (item.type === 'ast') {
                const a = item.obj as Asteroid;
                ctx.save();
                ctx.translate(a.x, a.y); ctx.scale(scale, scale); 
                const cosX = Math.cos(a.ax), sinX = Math.sin(a.ax);
                const cosY = Math.cos(a.ay), sinY = Math.sin(a.ay);
                ctx.rotate(a.az); 
                a.faces.forEach(f => { 
                    let nx = f.normal.x; let ny = f.normal.y; let nz = f.normal.z; 
                    let ty = ny*cosX - nz*sinX; let tz = ny*sinX + nz*cosX; ny = ty; nz = tz; 
                    let tx = nx*cosY + nz*sinY; tz = -nx*sinY + nz*cosY; nx = tx; nz = tz; 
                    const cosZ = Math.cos(a.az), sinZ = Math.sin(a.az); 
                    tx = nx*cosZ - ny*sinZ; ty = nx*sinZ + ny*cosZ; nx = tx; ny = ty; 
                    if (nz <= 0) return; 
                    const dot = Math.max(0, nx*lightVec.x + ny*lightVec.y + nz*lightVec.z); 
                    const lightIntensity = 0.2 + (0.8 * dot); 
                    ctx.fillStyle = mixColor('#000000', a.color, lightIntensity); 
                    ctx.strokeStyle = mixColor('#000000', a.color, lightIntensity * 1.2); 
                    ctx.lineWidth = 1; 
                    ctx.beginPath(); 
                    f.indices.forEach((idx, i) => { const v = a.vertices[idx]; let vx = v.x; let vy = v.y; let vz = v.z; let rvy = vy*cosX - vz*sinX; let rvz = vy*sinX + vz*cosX; vy = rvy; vz = rvz; let rvx = vx*cosY + vz*sinY; rvz = -vx*sinY + vz*cosY; vx = rvx; vz = rvz; if (i===0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy); }); 
                    ctx.closePath(); ctx.fill(); ctx.stroke(); 
                });
                ctx.restore();
            } else if (item.type === 'player') {
                ctx.translate(s.px, s.py);
                drawShip(ctx, { config: activeShip.config, fitting: activeShip.fitting, color: activeShip.color, wingColor: activeShip.wingColor, cockpitColor: activeShip.cockpitColor, gunColor: activeShip.gunColor, secondaryGunColor: activeShip.secondaryGunColor, gunBodyColor: activeShip.gunBodyColor, engineColor: activeShip.engineColor, nozzleColor: activeShip.nozzleColor, equippedWeapons: activeShip.fitting.weapons }, true, s.movement, s.usingWater, s.rescueMode);
                if ((s.sh1 > 0 || s.sh2 > 0) && !s.rescueMode) {
                    // Player Shields Reduced 20% (70->56, 80->64)
                    if (s.sh1 > 0) { ctx.save(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3; ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 10; ctx.globalAlpha = Math.min(1, s.sh1 / 250) * 0.6; ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
                    if (s.sh2 > 0) { ctx.save(); ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 3; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 10; ctx.globalAlpha = Math.min(1, s.sh2 / 500) * 0.6; ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
                }
            } else if (item.type === 'enemy') {
                const e = item.obj as Enemy;
                const vibX = e.vibration > 0 ? (Math.random() - 0.5) * e.vibration : 0; const vibY = e.vibration > 0 ? (Math.random() - 0.5) * e.vibration : 0;
                ctx.translate(e.x + vibX, e.y + vibY); ctx.scale(scale, scale); ctx.rotate(Math.PI);
                const alienCols = getAlienColors(quadrant);
                drawShip(ctx, { config: e.config, fitting: null, color: e.type==='boss'?'#a855f7':alienCols.hull, wingColor: e.type==='boss'?'#d8b4fe':alienCols.wing, gunColor: '#ef4444', equippedWeapons: e.equippedWeapons }, false);
                // Enemy Shields Reduced 20% (Base 60->48)
                if (e.shieldLayers.length > 0) { e.shieldLayers.forEach((layer, idx) => { if (layer.current <= 0) return; const radius = 48 + (idx * 8); const opacity = Math.min(1, layer.current / layer.max); ctx.strokeStyle = layer.color; ctx.lineWidth = 3; ctx.shadowColor = layer.color; ctx.shadowBlur = 10; ctx.globalAlpha = opacity; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }); }
            } else if (item.type === 'loot') {
                const l = item.obj as Loot;
                ctx.translate(l.x, l.y); ctx.scale(scale, scale);

                // --- TRACTOR BEAM HIGHLIGHT START ---
                if (l.isBeingPulled) {
                    // Silver Highlight Circle
                    ctx.strokeStyle = 'rgba(192, 210, 255, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.shadowColor = '#fff';
                    ctx.shadowBlur = 5;
                    ctx.beginPath();
                    ctx.arc(0, 0, 22, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    // Arcs
                    ctx.save();
                    const dx = s.px - l.x;
                    const dy = s.py - l.y;
                    const dist = Math.hypot(dx, dy);
                    const angle = Math.atan2(dy, dx);
                    
                    ctx.rotate(angle); // X axis points to Ship
                    
                    const spacing = 15;
                    const count = Math.ceil(dist / spacing);
                    const speed = 4;
                    const offset = (s.frame * speed) % spacing;

                    ctx.lineWidth = 2;
                    
                    for (let i = 0; i <= count; i++) {
                        const d = i * spacing + offset;
                        if (d > 0 && d < dist) {
                            const alpha = Math.min(1, Math.sin((d/dist)*Math.PI)) * 0.6;
                            ctx.strokeStyle = `rgba(135, 206, 250, ${alpha})`;
                            ctx.beginPath();
                            ctx.moveTo(d, -7);
                            ctx.quadraticCurveTo(d - 5, 0, d, 7);
                            ctx.stroke();
                        }
                    }
                    ctx.restore();
                }
                // --- TRACTOR BEAM HIGHLIGHT END ---

                // Draw Loot Box
                ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.rect(-8, -8, 16, 16); ctx.fill(); ctx.shadowBlur = 0;
                
                // Specific Type Colors
                if (l.type === 'water') { 
                    ctx.fillStyle = '#3b82f6'; ctx.fillRect(-8,-8,16,16); 
                } else if (l.type === 'energy') { 
                    ctx.fillStyle = '#22d3ee'; ctx.fillRect(-8,-8,16,16); 
                }

                // Letters (Restored & Centered)
                ctx.font = "900 10px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = (l.type === 'water' || l.type === 'energy') ? '#000' : '#000';
                if (l.type === 'water') ctx.fillStyle = '#fff';

                let letter = "?";
                if (l.type === 'fuel') letter = "F";
                else if (l.type === 'water') letter = "W";
                else if (l.type === 'energy') letter = "E";
                else if (l.type === 'repair' || l.type === 'nanite') letter = "+";
                
                ctx.fillText(letter, 0, 1);
            }
            ctx.setTransform(1, 0, 0, 1, shakeX, shakeY); 
        });

        s.bullets.forEach(b => { 
            ctx.save(); ctx.translate(b.x, b.y); 
            
            if (b.type === 'missile' || b.type === 'missile_emp') {
                // CYLINDRICAL MISSILE
                ctx.scale(1.2, 1.2);
                ctx.rotate(b.vy > 0 ? Math.PI : 0); // Rotate if moving down (enemy)
                
                // Fins
                ctx.fillStyle = b.finsColor || '#ef4444';
                ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-6, 2); ctx.lineTo(-3, 0); ctx.lineTo(-3, 8); ctx.fill();
                ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(6, 2); ctx.lineTo(3, 0); ctx.lineTo(3, 8); ctx.fill();
                
                // Body
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(-3, -6, 6, 14);
                
                // Head
                ctx.fillStyle = b.headColor || '#ef4444';
                ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(0, -10); ctx.lineTo(3, -6); ctx.fill();
                
                // Engine flame
                ctx.fillStyle = '#facc15';
                ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(0, 12 + Math.random()*4); ctx.lineTo(2, 8); ctx.fill();

            } else if (b.type === 'mine' || b.type === 'mine_emp' || b.type === 'mine_red') {
                // SPIKED MINE
                const radius = b.width / 2;
                ctx.fillStyle = b.color;
                
                // Central Body
                ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
                
                // Pulse Core
                ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5 + Math.sin(s.frame * 0.5) * 0.5;
                ctx.beginPath(); ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;

                // Spikes
                ctx.strokeStyle = b.color; ctx.lineWidth = 2;
                const spikeCount = 8;
                const spikeLen = radius + 4;
                for (let i = 0; i < spikeCount; i++) {
                    const a = (Math.PI * 2 / spikeCount) * i + (s.frame * 0.05); // Spin
                    const sx = Math.cos(a) * radius; const sy = Math.sin(a) * radius;
                    const ex = Math.cos(a) * spikeLen; const ey = Math.sin(a) * spikeLen;
                    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
                }

            } else if (b.type === 'laser') { 
                ctx.fillStyle = b.color;
                // Overloaded shots are wider with rounded ends
                if (b.isOvercharge) {
                    ctx.lineCap = 'round';
                    ctx.lineWidth = b.width;
                    ctx.strokeStyle = b.color;
                    ctx.shadowBlur = b.glowIntensity || 10;
                    ctx.shadowColor = b.color;
                    ctx.beginPath(); ctx.moveTo(0, -b.height/2); ctx.lineTo(0, b.height/2); ctx.stroke();
                    // Core
                    ctx.lineWidth = b.width/2;
                    ctx.strokeStyle = '#fff';
                    ctx.shadowBlur = 0;
                    ctx.stroke();
                } else {
                    ctx.fillRect(-b.width/2, -b.height/2, b.width, b.height); 
                }
            } else { 
                // Basic Projectiles
                ctx.fillStyle = b.color;
                ctx.beginPath(); ctx.arc(0,0, b.width/2, 0, Math.PI*2); ctx.fill(); 
            }
            ctx.restore();
        });
        
        s.particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.translate(p.x, p.y);
            ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });

        // DRAW FLOATING TEXTS
        s.floatingTexts.forEach(ft => {
            ctx.save();
            ctx.globalAlpha = ft.life;
            ctx.fillStyle = ft.color;
            ctx.font = `900 ${ft.size}px monospace`;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        });

        ctx.restore(); // Restore from shake translation

        if (s.frame % 10 === 0) { 
            setHud(prev => ({ 
                ...prev, 
                hp: s.hp, sh1: s.sh1, fuel: s.fuel, water: s.water, energy: s.energy, 
                score: s.score, missiles: s.missiles, mines: s.mines, redMines: s.redMines, 
                timer: s.time, boss: s.enemies.find(e => e.type === 'boss'), 
                ammoCount: s.magazineCurrent, isReloading: s.reloadTimer > 0,
                overload: s.capacitor, overdrive: s.overdrive, rescueMode: s.rescueMode
            })); 
        }
        raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const takeDamage = (amt: number, type: string = 'generic') => {
      const s = state.current;
      if (s.rescueMode) return;
      
      // Screen Shake on damage
      s.shakeX = 15;
      s.shakeY = 15;

      let shieldDmg = amt;
      let hullDmg = amt;
      if (s.sh2 > 0) s.sh2 = Math.max(0, s.sh2 - shieldDmg);
      else if (s.sh1 > 0) s.sh1 = Math.max(0, s.sh1 - shieldDmg);
      else {
          s.hp = Math.max(0, s.hp - hullDmg);
          if (s.hp <= 0) {
              const s = state.current;
              s.hp = 0; s.rescueMode = true; 
              s.asteroids = []; s.bullets = [];
              createExplosion(s.px, s.py, '#ef4444', 50, 'boss'); 
              audioService.playExplosion(0, 2.0);
              setHud(h => ({...h, alert: "CRITICAL FAILURE - CAPSULE EJECTED", alertType: 'alert'}));
          }
      }
  };
  
  const drawShip = (ctx: CanvasRenderingContext2D, shipData: any, isPlayer = false, movement?: { up: boolean, down: boolean, left: boolean, right: boolean }, usingWater = false, isRescue = false) => { 
    const { config, color, wingColor, cockpitColor, gunColor, secondaryGunColor, gunBodyColor, engineColor, nozzleColor, fitting, equippedWeapons } = shipData; 
    const scale = isPlayer ? 0.6 : 0.5; 
    ctx.save(); 
    ctx.scale(scale, scale); 
    ctx.translate(-50, -50); 
    const { wingStyle, hullShapeType } = config; 
    const engineLocs = getEngineCoordinates(config); 
    
    if (!isRescue) {
        const baseColor = wingColor || config.defaultColor || '#64748b'; ctx.fillStyle = baseColor; ctx.strokeStyle = baseColor; 
        ctx.beginPath(); 
        if (config.isAlien) {
            ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            if (wingStyle === 'alien-h') { ctx.moveTo(25, 20); ctx.lineTo(25, 75); ctx.moveTo(75, 20); ctx.lineTo(75, 75); ctx.moveTo(25, 48); ctx.lineTo(75, 48); ctx.stroke(); } 
            else if (wingStyle === 'alien-w') { ctx.moveTo(10, 20); ctx.lineTo(35, 75); ctx.lineTo(50, 45); ctx.lineTo(65, 75); ctx.lineTo(90, 20); ctx.stroke(); } 
            else if (wingStyle === 'alien-a') { ctx.moveTo(20, 75); ctx.bezierCurveTo(20, 10, 80, 10, 80, 75); ctx.moveTo(28, 55); ctx.lineTo(72, 55); ctx.stroke(); } 
            else if (wingStyle === 'alien-m') { ctx.moveTo(20, 75); ctx.lineTo(20, 25); ctx.lineTo(50, 55); ctx.lineTo(80, 25); ctx.lineTo(80, 75); ctx.stroke(); }
        } else {
            if (wingStyle === 'delta') { ctx.moveTo(50, 25); ctx.lineTo(10, 80); ctx.lineTo(50, 70); ctx.lineTo(90, 80); ctx.fill(); } 
            else if (wingStyle === 'x-wing') { ctx.beginPath(); ctx.moveTo(50, 48); ctx.quadraticCurveTo(20, 48, 5, 10); ctx.lineTo(25, 10); ctx.quadraticCurveTo(30, 40, 50, 38); ctx.fill(); ctx.beginPath(); ctx.moveTo(50, 48); ctx.quadraticCurveTo(80, 48, 95, 10); ctx.lineTo(75, 10); ctx.quadraticCurveTo(70, 40, 50, 38); ctx.fill(); ctx.beginPath(); ctx.moveTo(50, 48); ctx.lineTo(5, 90); ctx.lineTo(25, 90); ctx.lineTo(50, 55); ctx.fill(); ctx.beginPath(); ctx.moveTo(50, 48); ctx.lineTo(95, 90); ctx.lineTo(75, 90); ctx.lineTo(50, 55); ctx.fill(); } 
            else if (wingStyle === 'pincer') { ctx.ellipse(50, 60, 45, 25, 0, 0, Math.PI * 2); ctx.moveTo(85, 60); ctx.ellipse(50, 60, 30, 15, 0, 0, Math.PI * 2, true); ctx.fill(); } 
            else if (wingStyle === 'curved') { ctx.moveTo(50, 45); ctx.lineTo(10, 50); ctx.arc(10, 56, 6, -Math.PI/2, Math.PI/2, true); ctx.lineTo(50, 65); ctx.moveTo(50, 45); ctx.lineTo(90, 50); ctx.arc(90, 56, 6, -Math.PI/2, Math.PI/2, false); ctx.lineTo(50, 65); ctx.fill(); } 
            else if (wingStyle === 'cylon') { ctx.moveTo(45, 80); ctx.bezierCurveTo(10, 80, 5, 60, 5, 10); ctx.arcTo(15, 10, 20, 40, 6); ctx.quadraticCurveTo(25, 40, 45, 50); ctx.lineTo(45, 80); ctx.moveTo(55, 80); ctx.bezierCurveTo(90, 80, 95, 60, 95, 10); ctx.arcTo(85, 10, 80, 40, 6); ctx.quadraticCurveTo(75, 40, 55, 50); ctx.lineTo(55, 80); ctx.fill(); } 
            else { ctx.moveTo(50, 30); ctx.lineTo(10, 70); ctx.lineTo(50, 60); ctx.lineTo(90, 70); ctx.fill(); }
        }
        
        ctx.fillStyle = color || config.defaultColor || '#94a3b8';
        ctx.beginPath();
        if (wingStyle === 'x-wing') { ctx.ellipse(50, 50, 18, 45, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#64748b'; ctx.fillRect(36, 40, 4, 20); ctx.fillRect(60, 40, 4, 20); }
        else if (hullShapeType === 'none') { }
        else if (hullShapeType === 'triangle') { ctx.moveTo(50, 5); ctx.quadraticCurveTo(80, 80, 50, 90); ctx.quadraticCurveTo(20, 80, 50, 5); }
        else if (hullShapeType === 'block') { ctx.moveTo(40, 10); ctx.lineTo(60, 10); ctx.quadraticCurveTo(70, 10, 75, 30); ctx.lineTo(60, 75); ctx.quadraticCurveTo(50, 80, 40, 75); ctx.lineTo(25, 30); ctx.quadraticCurveTo(30, 10, 40, 10); }
        else if (hullShapeType === 'rounded') { if (ctx.roundRect) ctx.roundRect(30, 10, 40, 80, 20); else { ctx.moveTo(50, 10); ctx.arc(50, 30, 20, Math.PI, 0); ctx.lineTo(70, 70); ctx.arc(50, 70, 20, 0, Math.PI); ctx.lineTo(30, 30); } }
        else if (hullShapeType === 'saucer') ctx.ellipse(50, 50, 30, 30, 0, 0, Math.PI * 2);
        else if (hullShapeType === 'finger') ctx.ellipse(50, 50, 20, 40, 0, 0, Math.PI * 2);
        else if (hullShapeType === 'needle') { ctx.moveTo(50, 0); ctx.quadraticCurveTo(70, 50, 50, 95); ctx.quadraticCurveTo(30, 50, 50, 0); }
        else ctx.ellipse(50, 50, 20, 45, 0, 0, Math.PI * 2);
        ctx.fill();

        const drawEngine = (x: number, y: number, w: number, h: number) => {
            const isAlien = config.isAlien;
            const eColor = isAlien ? '#172554' : (engineColor || '#334155');
            const nColor = isAlien ? '#9ca3af' : (nozzleColor || '#475569');
            const ew = w + 2; const eh = h + 2;
            const drawX = x - ew/2;
            
            ctx.fillStyle = eColor; ctx.beginPath();
            if (isAlien) { ctx.ellipse(x, y + eh/2, ew/2, eh/2, 0, 0, Math.PI * 2); }
            else { const r = 3; if (ctx.roundRect) ctx.roundRect(drawX, y, ew, eh, r); else ctx.rect(drawX, y, ew, eh); }
            ctx.fill();
            
            const nozzleH = isAlien ? 6 : 5; const flare = isAlien ? 4 : 3; const inset = isAlien ? 1 : 0;
            ctx.fillStyle = nColor; ctx.beginPath();
            if (isAlien) { const nozzleStart = y + eh - 2; ctx.moveTo(drawX + inset, nozzleStart); ctx.lineTo(drawX + ew - inset, nozzleStart); ctx.lineTo(drawX + ew + flare, nozzleStart + nozzleH); ctx.lineTo(drawX - flare, nozzleStart + nozzleH); } 
            else { ctx.moveTo(drawX + inset, y + eh); ctx.lineTo(drawX + ew - inset, y + eh); ctx.lineTo(drawX + ew + flare, y + eh + nozzleH); ctx.lineTo(drawX - flare, y + eh + nozzleH); }
            ctx.fill();
            
            if (isPlayer && movement) {
                const nozzleEnd = y + eh + nozzleH;

                // 1. REVERSE THRUSTERS (Braking) - Side Vents firing FORWARD (Up)
                if (movement.down) {
                    ctx.save(); ctx.translate(x, y); 
                    ctx.beginPath();
                    // Left Retro (Firing Up/Left) - Increased size for visibility
                    ctx.moveTo(-ew/2, 2); 
                    ctx.lineTo(-ew * 1.5, -20 - Math.random()*8); 
                    ctx.lineTo(-ew/2, -4);
                    // Right Retro (Firing Up/Right)
                    ctx.moveTo(ew/2, 2); 
                    ctx.lineTo(ew * 1.5, -20 - Math.random()*8); 
                    ctx.lineTo(ew/2, -4);
                    ctx.fillStyle = usingWater ? '#60a5fa' : '#fbbf24'; 
                    ctx.fill(); 
                    ctx.restore();
                }

                // 2. MAIN / IDLE THRUSTER
                if (movement.up) {
                    // MAIN THRUST
                    const thrustLen = 40 + Math.random() * 15;
                    const grad = ctx.createLinearGradient(x, nozzleEnd, x, nozzleEnd + thrustLen);
                    if (usingWater) { 
                        grad.addColorStop(0, '#e0f2fe'); grad.addColorStop(0.3, '#3b82f6'); grad.addColorStop(1, 'rgba(59, 130, 246, 0)'); 
                    } else { 
                        grad.addColorStop(0, '#ffedd5'); grad.addColorStop(0.3, '#f97316'); grad.addColorStop(1, 'rgba(249, 115, 22, 0)'); 
                    }
                    ctx.fillStyle = grad; 
                    ctx.beginPath(); 
                    ctx.moveTo(drawX + inset, nozzleEnd); 
                    ctx.lineTo(drawX + ew - inset, nozzleEnd); 
                    ctx.lineTo(x, nozzleEnd + thrustLen); 
                    ctx.fill();
                } else if (!movement.down) {
                    // IDLE THRUST (Only visible if not thrusting AND not braking)
                    const idleLen = 12 + Math.random() * 3;
                    const idleColor = config.isAlien ? '#a855f7' : (usingWater ? '#93c5fd' : '#60a5fa');
                    
                    ctx.fillStyle = idleColor;
                    ctx.globalAlpha = 0.8;
                    ctx.beginPath(); 
                    ctx.moveTo(drawX + inset + 1, nozzleEnd); 
                    ctx.lineTo(drawX + ew - inset - 1, nozzleEnd); 
                    ctx.lineTo(x, nozzleEnd + idleLen); 
                    ctx.fill(); 
                    ctx.globalAlpha = 1.0;
                }

                // 3. STRAFE THRUSTERS
                const strafeLen = 12 + Math.random() * 6;
                ctx.fillStyle = usingWater ? '#93c5fd' : '#fbbf24';
                if (movement.left) { 
                    // Right engine fires right to push left
                    ctx.beginPath(); 
                    ctx.moveTo(drawX + ew, y + eh/2 - 3); 
                    ctx.lineTo(drawX + ew + strafeLen, y + eh/2); 
                    ctx.lineTo(drawX + ew, y + eh/2 + 3); 
                    ctx.fill(); 
                }
                if (movement.right) { 
                    // Left engine fires left to push right
                    ctx.beginPath(); 
                    ctx.moveTo(drawX, y + eh/2 - 3); 
                    ctx.lineTo(drawX - strafeLen, y + eh/2); 
                    ctx.lineTo(drawX, y + eh/2 + 3); 
                    ctx.fill(); 
                }
            } else if (!isPlayer) {
               const idleLen = 10 + Math.random() * 2;
               ctx.fillStyle = config.isAlien ? '#a855f7' : '#60a5fa';
               ctx.globalAlpha = 0.6;
               ctx.beginPath(); ctx.moveTo(drawX + inset + 1, y + eh + nozzleH); ctx.lineTo(drawX + ew - inset - 1, y + eh + nozzleH); ctx.lineTo(x, y + eh + nozzleH + idleLen); ctx.fill(); ctx.globalAlpha = 1.0;
            }
        };
        engineLocs.forEach(eng => drawEngine(eng.x, eng.y, eng.w, eng.h));
    } else {
        if (isPlayer && movement && (movement.up || movement.down || movement.left || movement.right)) {
            ctx.save();
            const cy = (config.isAlien && wingStyle === 'alien-a') ? 65 : (config.isAlien ? 45 : 38);
            ctx.translate(50, cy + 15);
            ctx.fillStyle = '#fbbf24'; // Gold thruster
            ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(0, 18 + Math.random()*6); ctx.lineTo(4, 0); ctx.fill();
            ctx.restore();
        }
        const cy = (config.isAlien && wingStyle === 'alien-a') ? 65 : (config.isAlien ? 45 : 38);
        ctx.beginPath(); ctx.arc(50, cy, 33, 0, Math.PI*2); 
        ctx.strokeStyle='#ef4444'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10; ctx.stroke();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; ctx.fill(); ctx.shadowBlur = 0;
    }
    
    // COCKPIT RENDERING
    // If Rescue: Use COCKPIT COLOR and COCKPIT SHAPE from config
    const finalCockpitColor = cockpitColor || '#0ea5e9'; // Use specific ship color or default

    ctx.fillStyle = finalCockpitColor; 
    ctx.beginPath();
    if (config.isAlien) { const cy = wingStyle === 'alien-a' ? 65 : 45; ctx.ellipse(50, cy, 8, 20, 0, 0, Math.PI * 2); } 
    else if (wingStyle === 'x-wing') { ctx.ellipse(50, 55, 8, 12, 0, 0, Math.PI * 2); } 
    else { ctx.ellipse(50, 40, 8, 12, 0, 0, Math.PI * 2); }
    ctx.fill();
    
    // Glare
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); 
    if (wingStyle === 'x-wing') { ctx.ellipse(48, 52, 3, 5, -0.2, 0, Math.PI * 2); } 
    else { const cy = (config.isAlien && wingStyle === 'alien-a') ? 65 : (config.isAlien ? 45 : 38); ctx.ellipse(48, cy - 2, 3, 5, -0.2, 0, Math.PI * 2); }
    ctx.fill();

    if (!isRescue) {
        const drawWeapon = (x: number, y: number, id: string | undefined, type: 'primary' | 'secondary') => {
            if (!id) return;
            ctx.save(); ctx.translate(x, y); 
            const isAlien = config.isAlien;
            const isExotic = id?.includes('exotic');
            const scale = isAlien && isExotic ? 1.4 : (isExotic ? 1.0 : 1.45); 
            ctx.scale(scale, scale);
            const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === id);
            const wColor = type === 'secondary' ? (secondaryGunColor || '#38bdf8') : (gunColor || config.noseGunColor || '#ef4444');
            const wBody = gunBodyColor || '#334155';
            
            if (wDef && wDef.type === WeaponType.PROJECTILE && !isExotic) {
                const stdBodyColor = (gunBodyColor && gunBodyColor !== '#334155') ? gunBodyColor : '#451a03'; 
                const barrelColor = '#52525b'; 
                const barrelCount = wDef.barrelCount || 1;
                ctx.fillStyle = stdBodyColor;
                if (id?.includes('vulcan')) { if(ctx.roundRect) {ctx.beginPath(); ctx.roundRect(-4.25, 0, 8.5, 12, 3); ctx.fill();} else ctx.fillRect(-4.25, 0, 8.5, 12); } 
                else if (id?.includes('heavy')) { if(ctx.roundRect) {ctx.beginPath(); ctx.roundRect(-6, 0, 12, 10, 3); ctx.fill();} else ctx.fillRect(-6, 0, 12, 10); } 
                else { if(ctx.roundRect) {ctx.beginPath(); ctx.roundRect(-4.25, 0, 8.5, 10, 3); ctx.fill();} else ctx.fillRect(-4.25, 0, 8.5, 10); }
                if (barrelCount > 1) { const bx = [-3, -1, 1]; bx.forEach((offX) => { ctx.fillStyle = '#a1a1aa'; ctx.fillRect(offX, -24, 2, 24); }); ctx.fillStyle = '#18181b'; ctx.fillRect(-3.5, -25, 7, 2); } 
                else { ctx.fillStyle = barrelColor; ctx.fillRect(-1.5, -16, 3, 16); ctx.fillStyle = '#27272a'; ctx.fillRect(-2, -16, 4, 2); }
            } else {
                const isAlien = config.isAlien;
                const wBody = isAlien ? '#374151' : (gunBodyColor || '#334155'); 
                ctx.fillStyle = wBody;
                if (id?.includes('plasma') || isExotic) { if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-3.6, -14, 7.2, 12, [5, 5, 0, 0]); ctx.fill(); } else { ctx.fillRect(-3.6, -14, 7.2, 12); } } else { ctx.fillRect(-4.25, 0, 8.5, 10); }
                if (id?.includes('plasma') || isExotic) { ctx.fillStyle = wColor; ctx.beginPath(); ctx.arc(0, -8, 3, 0, Math.PI*2); ctx.fill(); } else { ctx.fillStyle = wColor; ctx.fillRect(-2.5, -12, 5, 12); }
            }
            ctx.restore();
        };
        const mainId = equippedWeapons ? equippedWeapons[0]?.id : (config.weaponId || 'gun_bolt');
        if (mainId) {
                if (config.wingStyle === 'alien-h') { drawWeapon(25, 20, mainId, 'primary'); drawWeapon(75, 20, mainId, 'primary'); } 
                else if (config.wingStyle === 'alien-w') { drawWeapon(10, 20, mainId, 'primary'); drawWeapon(90, 20, mainId, 'primary'); } 
                else if (config.wingStyle === 'alien-m') { drawWeapon(20, 25, mainId, 'primary'); drawWeapon(80, 25, mainId, 'primary'); } 
                else if (config.wingStyle === 'alien-a') { drawWeapon(50, 22, mainId, 'primary'); } 
                else if (config.wingStyle === 'x-wing') { drawWeapon(50, 20, mainId, 'primary'); } 
                else { drawWeapon(50, 10, mainId, 'primary'); }
        }
        if (equippedWeapons) {
                const mounts = getWingMounts(config);
                if (equippedWeapons[1]) drawWeapon(mounts[0].x, mounts[0].y, equippedWeapons[1].id, 'secondary');
                if (equippedWeapons[2]) drawWeapon(mounts[1].x, mounts[1].y, equippedWeapons[2].id, 'secondary');
        }
    }
    ctx.restore();
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-black select-none">
        <canvas ref={canvasRef} className="block w-full h-full" />
        
        <div className="absolute inset-0 pointer-events-none p-2 sm:p-4 flex flex-col justify-between z-10">
            <div className="flex justify-between items-start pointer-events-auto relative">
                <div className="flex flex-col gap-1 w-32 sm:w-48">
                    <div className="flex items-center gap-2">
                        <span className={`font-black ${hudLabel} w-8`}>HULL</span>
                        <div className="flex-grow h-2 bg-zinc-800 border border-zinc-700 rounded overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${Math.max(0, hud.hp)}%` }} />
                        </div>
                    </div>
                    {(hud.sh1 > 0 || hud.sh2 > 0) && (
                        <div className="flex items-center gap-2">
                            <span className={`font-black ${hudLabel} w-8`}>SHLD</span>
                            <div className="flex-grow h-2 bg-zinc-800 border border-zinc-700 rounded overflow-hidden flex">
                                {hud.sh1 > 0 && <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${Math.min(100, (hud.sh1/500)*50)}%` }} />}
                                {hud.sh2 > 0 && <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${Math.min(100, (hud.sh2/500)*50)}%` }} />}
                            </div>
                        </div>
                    )}
                </div>

                {!hud.boss && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 flex flex-col items-center bg-black/60 px-6 py-2 rounded-b-xl border-x border-b border-zinc-800/50 backdrop-blur-sm pointer-events-none">
                        <div className="text-3xl font-mono font-black text-red-500 tabular-nums tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] leading-none">
                            {Math.floor(hud.timer / 60).toString().padStart(2, '0')}:{Math.floor(hud.timer % 60).toString().padStart(2, '0')}
                        </div>
                        <div className={`${hudScore} font-black text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] tabular-nums mt-1 leading-none`}>
                            {Math.floor(hud.score).toLocaleString()}
                        </div>
                    </div>
                )}

                <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700 p-2 rounded-lg flex flex-col items-end gap-2 shadow-lg min-w-[100px]">
                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                        <button onClick={(e) => {
                            e.currentTarget.blur();
                            state.current.paused = !state.current.paused;
                            setHud(h => ({...h, isPaused: state.current.paused}));
                        }} className="flex-1 py-2 sm:px-4 bg-zinc-800 border border-zinc-600 text-white text-[10px] font-bold hover:bg-zinc-700 hover:border-white transition-colors uppercase">
                            {hud.isPaused ? "RESUME" : "PAUSE"}
                        </button>
                        <button onClick={(e) => {
                            e.currentTarget.blur();
                            const s = state.current;
                            onGameOver(false, hud.score, true, { health: s.hp, fuel: s.fuel, water: s.water });
                        }} className="flex-1 py-2 sm:px-4 bg-red-900/50 border border-red-600 text-red-200 text-[10px] font-bold hover:bg-red-800 transition-colors uppercase">
                            ABORT
                        </button>
                    </div>
                </div>
            </div>

            {hud.boss && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 w-64 flex flex-col items-center pointer-events-none">
                    <div className="w-full flex justify-between text-[9px] font-black uppercase text-red-500 mb-1">
                        <span>{hud.boss.config.name}</span>
                        <span>{Math.ceil(hud.boss.hp)}</span>
                    </div>
                    <div className="w-full h-3 bg-black border-2 border-red-900 rounded-sm overflow-hidden mb-1 relative z-10">
                        <div className="h-full bg-red-600 transition-all duration-200" style={{ width: `${Math.max(0, (hud.boss.hp / hud.boss.maxHp) * 100)}%` }} />
                    </div>
                    <div className="w-full flex flex-col gap-[1px]">
                        {hud.boss.shieldLayers.map((l: any, i: number) => (
                            <div key={i} className="w-full h-1.5 bg-black border border-zinc-800 relative">
                                <div className="h-full transition-all duration-200 opacity-80" style={{ width: `${(l.current/l.max)*100}%`, backgroundColor: l.color }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* LEFT HUD: LOAD & ENERGY - Now labeled L & E */}
            <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex flex-row gap-[6px] pointer-events-none bg-zinc-950 p-2 border border-zinc-800 rounded">
                <LEDMeter value={hud.overload} max={100} colorStart="#10b981" label="L" vertical={true} reverseColor={true} />
                <LEDMeter value={hud.energy} max={maxEnergy} colorStart="#22d3ee" label="E" vertical={true} />
            </div>

            {/* RIGHT HUD: FUEL & WATER - Now labeled F & W */}
            <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex flex-row gap-[6px] pointer-events-none bg-zinc-950 p-2 border border-zinc-800 rounded">
                <LEDMeter value={hud.fuel} max={maxFuel} colorStart="#f97316" label="F" vertical={true} />
                <LEDMeter value={hud.water} max={maxWater} colorStart="#3b82f6" label="W" vertical={true} />
            </div>

            {/* BOTTOM BAR - Mobile Optimization: Allow wrap if needed, shrink padding/gap */}
            <div className="absolute bottom-2 sm:bottom-4 left-0 right-0 flex justify-center items-end pointer-events-auto">
                <div className="flex flex-wrap sm:flex-nowrap justify-between items-end w-full px-2 sm:px-4 gap-2">
                    
                    {/* LEFT CORNER: MAIN GUN */}
                    <div className="flex items-end gap-2 shrink-0">
                        {hasGuns && !hud.rescueMode && (
                            <HudButton 
                                label="MAIN" 
                                subLabel={hud.overdrive ? "OVERDRIVE" : "AUTO"} 
                                onDown={() => { inputRef.current.main = true; }}
                                onUp={() => { inputRef.current.main = false; }}
                                colorClass={hud.overdrive ? 'text-red-500 animate-pulse' : 'text-emerald-400'}
                                borderClass={hud.overdrive ? 'border-red-500' : 'border-emerald-600'}
                                active={inputRef.current.main}
                            />
                        )}
                    </div>

                    {/* CENTER: ALERT MESSAGE (Can wrap if needed) */}
                    <div className="flex-1 flex justify-center pb-2 order-first sm:order-none w-full sm:w-auto">
                        {hud.alert && (
                            <div className="text-center bg-black/60 border-y border-zinc-500/30 backdrop-blur-sm px-4 py-1 sm:px-6 sm:py-2 max-w-[200px] sm:max-w-none">
                                <span className={`${hudAlertText} font-black uppercase tracking-[0.1em] leading-tight whitespace-pre-wrap ${hud.alertType === 'alert' ? 'text-red-500 animate-pulse' : (hud.alertType === 'warning' ? 'text-amber-500' : 'text-emerald-400')}`}>
                                    {hud.alert}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* RIGHT ORDNANCE CLUSTER - Shrink gaps on mobile */}
                    {!hud.rescueMode && (
                        <div className="flex gap-1 sm:gap-2 items-end shrink-0 justify-end flex-wrap sm:flex-nowrap max-w-[220px] sm:max-w-none">
                            {hud.missiles > 0 && (
                                <HudButton 
                                    label="MISSILE" 
                                    subLabel={`x${hud.missiles}`}
                                    onClick={fireMissile}
                                    colorClass="text-white"
                                    borderClass="border-zinc-700 hover:border-zinc-500"
                                    count={hud.missiles}
                                    maxCount={10}
                                />
                            )}

                            {hud.mines > 0 && (
                                <HudButton 
                                    label="MINE" 
                                    subLabel={`x${hud.mines}`}
                                    onClick={fireMine}
                                    colorClass="text-white"
                                    borderClass="border-zinc-700 hover:border-zinc-500"
                                    count={hud.mines}
                                    maxCount={10}
                                />
                            )}

                            {hasAmmoWeapons && (
                                <HudButton 
                                    label="AMMO" 
                                    subLabel={`${hud.ammoCount}`}
                                    onDown={() => { inputRef.current.secondary = true; }}
                                    onUp={() => { inputRef.current.secondary = false; }}
                                    colorClass={hud.ammoCount < 50 ? 'text-red-500 animate-pulse' : 'text-white'}
                                    borderClass={hud.ammoCount < 50 ? 'border-red-600' : 'border-zinc-700 hover:border-zinc-500'}
                                    active={inputRef.current.secondary}
                                    count={hud.ammoCount}
                                    maxCount={1000}
                                />
                            )}

                            {hud.redMines > 0 && (
                                <HudButton 
                                    label="OMEGA" 
                                    subLabel={`x${hud.redMines}`}
                                    onClick={fireRedMine}
                                    colorClass="text-red-300"
                                    borderClass="border-red-500/50 hover:border-red-500"
                                    count={hud.redMines}
                                    maxCount={5}
                                />
                            )}
                        </div>
                    )}

                </div>
            </div>

            {hud.isReloading && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 border-4 border-t-emerald-500 border-zinc-800 rounded-full animate-spin" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">RELOADING</span>
                    </div>
                </div>
            )}
        </div>

        {hud.isPaused && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 pointer-events-none">
                <div className="text-4xl font-black text-white tracking-[0.5em] border-y-4 border-white py-4 px-12">PAUSED</div>
            </div>
        )}
    </div>
  );
};

export default GameEngine;
