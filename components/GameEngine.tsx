
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, EquippedWeapon, Planet, QuadrantType, WeaponType, CargoItem, PlanetStatusData, AmmoType } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, EXOTIC_SHIELDS, BOSS_SHIPS, AMMO_CONFIG } from '../constants.ts';
import { getEngineCoordinates, getWingMounts } from '../utils/drawingUtils.ts';

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

const FIRE_COLORS = ['#ef4444', '#f97316', '#facc15', '#ffffff', '#fbbf24'];
const DRAGON_COLORS = ['#ef4444', '#facc15', '#3b82f6', '#f97316', '#ffffff'];
const OCTO_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#ef4444', '#a855f7'];

// --- DAMAGE MECHANICS HELPERS ---
const calculateDamage = (baseDamage: number, type: string, targetType: 'hull' | 'shield', shieldColor?: string) => {
    // 1. Determine Damage Profile (Power vs Disruption)
    let powerMult = 1.0;
    let disruptionMult = 1.0;

    if (type === 'laser' || type === 'bolt' || type === 'gun_bolt' || type === 'exotic_phaser_sweep' || type === 'exotic_electric') {
        // ENERGY WEAPONS: Low Power (Hull), High Disruption (Shield)
        powerMult = 0.4;
        disruptionMult = 1.5;
    } else if (type === 'projectile' || type === 'cannon' || type === 'gun_vulcan' || type === 'gun_heavy' || type === 'gun_repeater' || type === 'gun_plasma' || type === 'gun_hyper') {
        // PROJECTILE WEAPONS: High Power (Hull), Low Disruption (Shield)
        powerMult = 1.2;
        disruptionMult = 0.4;
    } else if (type.includes('missile') || type.includes('mine') || type === 'rocket' || type === 'firework_shell' || type === 'octo_shell') {
        // EXPLOSIVES: Balanced, slightly higher raw output usually defined in constants
        powerMult = 1.0;
        disruptionMult = 1.0;
        if (type.includes('emp')) {
            powerMult = 0.0;
            disruptionMult = 5.0; // EMP Special
        }
    } else if (type === 'explosion') {
        // Area Damage (Standard)
        powerMult = 1.0;
        disruptionMult = 1.0;
    } else {
        // Exotic / Unknown (Balanced)
        powerMult = 1.0;
        disruptionMult = 1.0;
    }

    // 2. Apply Resistance if hitting a shield
    if (targetType === 'shield' && shieldColor) {
        let pRes = 1.0; // Damage taken multiplier (Lower is better resistance)
        let dRes = 1.0;

        if (shieldColor === '#ef4444') { 
            // RED SHIELD: Resistant to Disruption, Vulnerable to Power (Bullets)
            dRes = 0.5; 
            pRes = 1.5; 
        } else if (shieldColor === '#3b82f6') {
            // BLUE SHIELD: Resistant to Power (Bullets), Vulnerable to Disruption
            pRes = 0.5;
            dRes = 1.5;
        } 
        // Other colors (Orange, Purple, White) are balanced (1.0)

        // Calculate final shield damage
        // Damage to shield is a sum of Power component and Disruption component
        const powerComponent = (baseDamage * powerMult) * pRes;
        const disruptionComponent = (baseDamage * disruptionMult) * dRes;
        
        return powerComponent + disruptionComponent;
    } else {
        // Hitting Hull / Asteroid
        // Only Power component damages Hull
        return baseDamage * powerMult;
    }
};

// --- INTERFACES & CLASSES ---
interface Projectile {
  x: number; y: number; vx: number; vy: number;
  damage: number; color: string; type: string; life: number;
  isEnemy: boolean; width: number; height: number;
  glow?: boolean; glowIntensity?: number; isMain?: boolean;
  weaponId?: string; isOvercharge?: boolean; isTracer?: boolean; traceColor?: string;
  homingState?: 'searching' | 'tracking' | 'returning' | 'engaging' | 'launching';
  target?: Enemy | null;
  targetLostCounter?: number;
  launchTime?: number; headColor?: string; finsColor?: string; turnRate?: number; maxSpeed?: number;
  accel?: number; z?: number; vz?: number; // Added vz for 3D steering
  angleOffset?: number; growthRate?: number; originalSize?: number;
  isEmp?: boolean;
  detonationY?: number; // For fireworks/octo-burst
  initialWidth?: number; // For limiting growth
  initialHeight?: number; // For limiting growth
  opacity?: number; // For transparency effects
  isMulticolor?: boolean; // For fireworks
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife?: number;
  size: number; color: string; type?: string;
  decay?: number; grow?: number; initialAlpha?: number;
  rotation?: number; spin?: number;
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
    // Smaller asteroids: 12 to 27
    this.size = 12 + Math.random() * 15; 
    this.hp = (this.size * 30) + (this.size * this.size);
    this.vax = (Math.random() - 0.5) * 0.05; 
    this.vay = (Math.random() - 0.5) * 0.05; 
    this.vaz = (Math.random() - 0.5) * 0.05; 
    
    let variantPool = [];
    // Increased frequency of 'ice' (blue) asteroids by ~40% across all quadrants
    if (quadrant === QuadrantType.ALFA) {
        variantPool = [...Array(6).fill('ice'), ...Array(3).fill('platinum'), 'rock', 'copper'];
    } else if (quadrant === QuadrantType.BETA) {
        variantPool = ['ice', 'ice', 'ice', 'ice', 'platinum', 'platinum', 'rock', 'rock', 'copper', 'copper'];
    } else if (quadrant === QuadrantType.GAMA) {
        variantPool = ['ice', 'ice', 'ice', 'platinum', 'platinum', 'rock', 'rock', 'rock', 'rust', 'rust', 'copper'];
    } else if (quadrant === QuadrantType.DELTA) {
        variantPool = ['gold', 'gold', 'gold', 'rare', 'rare', 'platinum', 'platinum', 'ice', 'ice', 'ice'];
    } else {
        variantPool = ['rock', 'ice'];
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
    wobble: number; // Added for visual effect
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

        // BOSS SHIELD LOGIC
        // Alpha Sector: Only Level 2 & 3 planets (diff > 1) get shields.
        // Other Sectors: Always get shields.
        let addShields = true;
        if (quadrant === QuadrantType.ALFA && diff <= 1) {
            addShields = false;
        }

        if (addShields) {
            const shield1 = EXOTIC_SHIELDS[0];
            this.shieldLayers.push({ color: shield1.color, max: shield1.capacity * (1 + diff * 0.1), current: shield1.capacity * (1 + diff * 0.1), rotation: 0, wobble: 0 });
            
            const shield2 = EXOTIC_SHIELDS[1];
            this.shieldLayers.push({ color: shield2.color, max: shield2.capacity * (1 + diff * 0.1), current: shield2.capacity * (1 + diff * 0.1), rotation: Math.PI / 2, wobble: 0 });

            this.shieldRegen = 2.0 + (diff * 0.2);
        } else {
            this.shieldRegen = 0;
        }

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
        // ALPHA SECTOR: SHIELD FREE FOR REGULAR ENEMIES
        if (quadrant !== QuadrantType.ALFA) {
            if (diff >= 4) shieldCount = 2;
            else if (diff >= 2) shieldCount = 1;
        }

        if (shieldCount > 0) {
            const baseShieldCap = 150 * diff;
            const c1 = quadrant === QuadrantType.ALFA ? '#3b82f6' : (quadrant === QuadrantType.BETA ? '#f97316' : '#ef4444');
            this.shieldLayers.push({ color: c1, max: baseShieldCap, current: baseShieldCap, rotation: Math.random() * Math.PI, wobble: 0 });
            if (shieldCount > 1) {
                const c2 = quadrant === QuadrantType.DELTA ? '#ffffff' : '#a855f7';
                this.shieldLayers.push({ color: c2, max: baseShieldCap * 1.5, current: baseShieldCap * 1.5, rotation: Math.random() * Math.PI, wobble: 0 });
            }
        }
    }
  }

  update(px: number, py: number, w: number, h: number, incomingFire: Projectile[], worldSpeedFactor: number = 1.0) {
    if (this.vibration > 0) this.vibration = Math.max(0, this.vibration - 1);
    
    if (this.stunnedUntil > 0) this.stunnedUntil--;
    if (this.shieldDisabledUntil > 0) this.shieldDisabledUntil--;

    const verticalSpeed = 2.8 * worldSpeedFactor;

    if (this.stunnedUntil > 0) {
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.vy += 0.5 * worldSpeedFactor; 
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
        // Decay shield wobble
        if (l.wobble > 0) l.wobble = Math.max(0, l.wobble - 0.1);
    });
  }

  takeDamage(amount: number, type: string, isMain: boolean, isOvercharge: boolean = false, isEmp: boolean = false): { dmg: number, isShield: boolean } {
      const isBoss = this.type === 'boss';
      let hitShield = false;
      let appliedHullDmg = 0;

      // Special handling for Stun/Bolt before calculations
      if (type === 'bolt') {
          this.stunnedUntil = 60; 
          this.shieldDisabledUntil = 60; 
      }

      // Check Shield Presence
      if (this.shieldLayers.length > 0 && this.shieldDisabledUntil <= 0) {
          hitShield = true;
          const layer = this.shieldLayers[0];
          
          // Calculate specific damage to shield based on type and shield color
          const shieldDmg = calculateDamage(amount, type, 'shield', layer.color);
          
          // Apply overload multiplier
          let finalShieldDmg = shieldDmg;
          if (isMain) {
              if (isOvercharge) finalShieldDmg *= 3.0;
              else finalShieldDmg *= 0.5; // Main gun normal shots slightly weaker vs strong shields
          }
          if (isEmp) finalShieldDmg *= 5.0; // Extra massive for EMP flagged shots

          layer.current -= finalShieldDmg;
          
          // Trigger visual wobble on shield hit instead of sound
          layer.wobble = 1.0; 
          
          // Audio handled in bullet loop for cleaner logic or here?
          // Bullet loop handles it now to use specific types
          if (layer.current <= 0) { 
              this.shieldLayers.shift(); 
          }
      } else {
          // Check Hull Damage (Direct)
          // Calculate hull specific damage
          const hullDmg = calculateDamage(amount, type, 'hull');
          
          let finalHullDmg = hullDmg;
          if (isMain) {
              if (isOvercharge) finalHullDmg *= 1.0; 
              else finalHullDmg *= 3.0; // Main gun rapid fire tears hull
          } else if (type === 'projectile' || type === 'star') {
              finalHullDmg *= 2.0;
          } else if (type === 'flame') {
              finalHullDmg *= 1.2;
          }

          // Boss resistance scale
          if (isBoss) finalHullDmg *= 0.25;

          this.hp -= finalHullDmg;
          appliedHullDmg = finalHullDmg;
          
          // Play specific Hull Hit Sound happens in bullet loop usually
          // But if damage source is environmental (collision), we play it here
      }
      
      return { dmg: Math.floor(appliedHullDmg), isShield: hitShield };
  }
}

// ... [Existing Color Utils and Helpers] ...
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

// ... [Existing HUD Components: LEDMeter, RoundCadran, HudButton] ...
const LEDMeter = ({ value, max, colorStart, label, vertical = false, reverseColor = false }: { value: number, max: number, colorStart: string, label: string, vertical?: boolean, reverseColor?: boolean }) => {
    const segments = 20; 
    const pct = Math.max(0, Math.min(1, value / max));
    const filled = Math.ceil(pct * segments);

    let activeColor = colorStart;
    
    if (reverseColor) {
        if (pct > 0.9) activeColor = '#ef4444'; 
        else if (pct > 0.7) activeColor = '#facc15'; 
    } else {
        if (pct < 0.1) activeColor = '#ef4444'; 
        else if (pct < 0.3) activeColor = '#facc15'; 
    }

    return (
        <div className={`flex ${vertical ? 'flex-col items-center h-40' : 'flex-row items-center w-full'} gap-1`}>
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
                    <div className="w-5 h-5 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded mt-1">
                        <span className="text-[10px] font-black text-white">{label}</span>
                    </div>
                </>
            ) : (
                <>
                    <div className="w-5 h-5 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded mr-1">
                        <span className="text-[10px] font-black text-white">{label}</span>
                    </div>
                    <div className="flex flex-row gap-[1px] bg-black p-[2px] border border-zinc-800 rounded w-24 sm:w-32 h-4 shadow-inner">
                        {Array.from({ length: segments }).map((_, i) => {
                            const isActive = i < filled;
                            return (
                                <div
                                    key={i}
                                    className="h-full flex-1 rounded-[1px] transition-colors duration-150"
                                    style={{
                                        backgroundColor: isActive ? activeColor : '#18181b',
                                        boxShadow: isActive ? `0 0 6px ${activeColor}` : 'none',
                                        opacity: isActive ? 1 : 0.5
                                    }}
                                />
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

const RoundCadran = ({ value, max }: { value: number, max: number }) => {
    const percentage = Math.min(1, Math.max(0, value / max));
    let color = '#10b981'; 
    if (percentage < 0.1) color = '#ef4444'; 
    else if (percentage < 0.3) color = '#facc15'; 

    const segments = 10;
    const activeSegments = Math.ceil(percentage * segments);
    const radius = 25; 
    const center = { x: 30, y: 30 };
    const strokeWidth = 5; 
    const paths = [];

    for(let i=0; i<segments; i++) {
        const startAngle = -180 + (i * (180/segments));
        const endAngle = startAngle + (180/segments) - 4; 
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const x1 = center.x + radius * Math.cos(startRad);
        const y1 = center.y + radius * Math.sin(startRad);
        const x2 = center.x + radius * Math.cos(endRad);
        const y2 = center.y + radius * Math.sin(endRad);
        const d = `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
        const isActive = i < activeSegments;
        
        paths.push(
            <path key={i} d={d} fill="none" stroke={isActive ? color : '#334155'} strokeWidth={strokeWidth} strokeLinecap="round" className="transition-colors duration-200" />
        );
    }

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

const HudButton = ({ label, subLabel, onClick, onDown, onUp, colorClass, borderClass, active = false, count, maxCount }: any) => {
    return (
        <div className="flex flex-col items-center pointer-events-auto">
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

interface GameEngineProps {
  ships: {
    config: ExtendedShipConfig;
    fitting: ShipFitting;
    color?: string;
    wingColor?: string;
    cockpitColor?: string;
    gunColor?: string;
    secondaryGunColor?: string;
    gunBodyColor?: string;
    engineColor?: string;
    nozzleColor?: string;
    equippedWeapons?: (EquippedWeapon | null)[];
  }[];
  shield: Shield | null;
  secondShield: Shield | null;
  onGameOver: (success: boolean, score: number, aborted: boolean, payload: any) => void;
  difficulty: number;
  currentPlanet: Planet;
  quadrant: QuadrantType;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  mode?: 'combat' | 'drift';
  planetRegistry?: Record<string, PlanetStatusData>;
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

  const maxAmmoInMags = activeShip.fitting.weapons.reduce((acc, w) => {
      if (!w) return acc;
      const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === w.id);
      return acc + (def?.isAmmoBased ? 200 : 0);
  }, 0);

  const hasGuns = activeShip?.fitting.weapons.some(w => !!w);

  const hudLabel = fontSize === 'small' ? 'text-[8px]' : (fontSize === 'large' ? 'text-[12px]' : 'text-[10px]');
  const hudScore = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-lg' : 'text-sm');
  const hudTimer = fontSize === 'small' ? 'text-xs' : (fontSize === 'large' ? 'text-xl' : 'text-base');
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
    rescueMode: false,
    capacitorLocked: false
  });
  
  const inputRef = useRef({ main: false, secondary: false });
  const tiltRef = useRef({ beta: 0, gamma: 0 }); 
  const hasTiltRef = useRef(false);
  const targetRef = useRef<{x: number, y: number} | null>(null);

  const state = useRef({
    px: window.innerWidth/2, py: window.innerHeight*0.8, hp: 100, fuel: 0, water: 0, energy: maxEnergy, 
    sh1: 0, sh2: 0, score: 0, time: mode === 'drift' ? 60 : 120, phase: 'travel', bossSpawned: false, bossDead: false,
    enemies: [] as Enemy[], asteroids: [] as Asteroid[], bullets: [] as Projectile[], 
    particles: [] as Particle[], loot: [] as Loot[], stars: [] as {x:number, y:number, s:number}[],
    keys: new Set<string>(), lastFire: 0, lastSpawn: 0, frame: 0, 
    missiles: activeShip.fitting.rocketCount, mines: activeShip.fitting.mineCount, redMines: activeShip.fitting.redMineCount || 0,
    cargo: [...activeShip.fitting.cargo],
    ammo: { ...activeShip.fitting.ammo }, 
    gunStates: {} as Record<number, { mag: number, reloadTimer: number, maxMag: number }>,
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
    shakeX: 0,
    shakeY: 0,
    shakeDecay: 0.9,
    capacitor: 0,
    salvoTimer: 0,
    lastSalvoFire: 0,
    currentThrottle: 0, 
    shipVy: 0,
    refuelTimer: 0, // 0 to 600 (10 seconds)
    isRefueling: false,
    refuelType: null as 'fuel' | 'water' | null,
    refuelStartVal: 0,
    // Capacitor Lock Logic
    capacitorLocked: false,
    depletionTime: 0,
    // Cooldown Logic
    weaponCoolDownTimer: 0,
    // Burst Logic
    missileBurstCount: 0,
    mineBurstCount: 0
  });

  // Centralized Pause Logic
  const togglePause = (forceVal?: boolean) => {
      const s = state.current;
      const next = forceVal !== undefined ? forceVal : !s.paused;
      
      if (s.paused === next) return; // No change
      
      s.paused = next;
      setHud(h => ({...h, isPaused: next}));
      
      if (next) {
          audioService.pauseMusic();
      } else {
          audioService.resumeMusic();
      }
  };

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
      s.cargo = [...activeShip.fitting.cargo]; 
      
      s.ammo = { ...activeShip.fitting.ammo };
      activeShip.fitting.cargo.forEach(c => {
          if (c.type === 'ammo') {
              const qty = c.quantity * 1000;
              const type = c.id as AmmoType;
              s.ammo[type] = (s.ammo[type] || 0) + qty;
          }
      });

      activeShip.fitting.weapons.forEach((w, i) => {
          if (w) {
              const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === w.id);
              if (def && def.isAmmoBased) {
                  s.gunStates[i] = { mag: 200, reloadTimer: 0, maxMag: 200 };
              }
          }
      });

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
          if (!s.paused) togglePause(true); 
      };
      const handleOrientation = (e: DeviceOrientationEvent) => {
          if (e.beta !== null) { hasTiltRef.current = true; tiltRef.current.beta = e.beta || 0; tiltRef.current.gamma = e.gamma || 0; }
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('deviceorientation', handleOrientation);
      return () => { 
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('deviceorientation', handleOrientation);
      };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.tagName === 'BUTTON') return;
      
      // If paused, ignore movement logic
      if (state.current.paused) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      targetRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleTabReload = () => {};

  const fireMissile = () => { const s = state.current; if (s.missiles > 0) { const isEmp = s.missiles % 2 !== 0; s.missiles--; s.lastMissileFire = Date.now(); s.bullets.push({ x: s.px, y: s.py, vx: 0, vy: -3, vz: 0, damage: 200, color: isEmp ? '#22d3ee' : '#ef4444', type: isEmp ? 'missile_emp' : 'missile', life: 600, isEnemy: false, width: 12, height: 28, homingState: 'launching', launchTime: s.frame, headColor: isEmp ? '#22d3ee' : '#ef4444', finsColor: isEmp ? '#0ea5e9' : '#ef4444', turnRate: 0.05, maxSpeed: 14, z: 0 }); audioService.playWeaponFire(isEmp ? 'emp' : 'missile'); } };
  const fireMine = () => { const s = state.current; if (s.mines > 0) { const isEmp = s.mines % 2 !== 0; s.mines--; s.lastMineFire = Date.now(); s.mineSide = !s.mineSide; const speed = 5; const vx = s.mineSide ? -speed : speed; s.bullets.push({ x: s.px, y: s.py + 20, vx: vx, vy: 0, vz: 0, damage: 250, color: isEmp ? '#22d3ee' : '#fbbf24', type: isEmp ? 'mine_emp' : 'mine', life: 600, isEnemy: false, width: 14, height: 14, homingState: 'launching', launchTime: s.frame, turnRate: 0.08, maxSpeed: 10, z: 0 }); audioService.playWeaponFire('mine'); } };
  const fireRedMine = () => { const s = state.current; if (s.redMines > 0) { s.redMines--; s.lastRedMineFire = Date.now(); s.omegaSide = !s.omegaSide; const speed = 4; const vx = s.omegaSide ? -speed : speed; s.bullets.push({ x: s.px, y: s.py + 30, vx: vx, vy: 0, vz: 0, damage: 600, color: '#ef4444', type: 'mine_red', life: 600, isEnemy: false, width: 20, height: 20, homingState: 'launching', launchTime: s.frame, turnRate: 0.05, maxSpeed: 8, z: 0, glow: true, glowIntensity: 30 }); audioService.playWeaponFire('mine'); setHud(h => ({...h, alert: 'OMEGA MINE DEPLOYED', alertType: 'warning'})); } };
  const spawnLoot = (x: number, y: number, z: number, type: string, id?: string, name?: string, quantity: number = 1) => { state.current.loot.push({ x, y, z, type, id, name, quantity, isPulled: false, vx: (Math.random()-0.5), vy: (Math.random()-0.5) }); };
  const createExplosion = (x: number, y: number, color: string, count: number, type: 'standard' | 'boss' | 'asteroid' | 'mine' | 'fireworks' = 'standard') => { const s = state.current; s.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, color: '#ffffff', size: type === 'boss' ? 50 : 25 }); for(let i=0; i<count; i++) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * (type === 'boss' ? 12 : 8) + 2; 
    let pColor = color;
    if (type === 'fireworks') {
        if (Math.random() > 0.5) pColor = OCTO_COLORS[Math.floor(Math.random() * OCTO_COLORS.length)];
    }
    s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.0 + Math.random() * 0.5, color: Math.random() > 0.5 ? pColor : '#ffffff', size: Math.random()*3+2 }); } };
  const createAreaDamage = (x: number, y: number, radius: number, damage: number, sourceId?: string) => { const s = state.current; s.enemies.forEach(e => { if (e.hp > 0) { const dist = Math.hypot(e.x - x, e.y - y); if (dist < radius) { const factor = 1 - (dist / radius); const dmg = damage * factor; if (dmg > 5) { e.takeDamage(dmg, 'explosion', false); createExplosion(e.x, e.y, '#f97316', 2); } } } }); if (!s.rescueMode) { const dist = Math.hypot(s.px - x, s.py - y); if (dist < radius) { const factor = 1 - (dist / radius); const dmg = damage * factor * 0.5; if (dmg > 5) { takeDamage(dmg, 'explosion'); } } } };
  
  const getCapacitorBeamState = (chargeLevel: number) => {
      // Logic for Energy Beams: Full Charge = Blue/White/Long. Weak = Red/Short.
      // Charge 0-100
      let color = '#ef4444'; // Red (Low)
      let lengthMult = 1.0; 
      
      if (chargeLevel > 80) {
          color = '#e0f2fe'; // White/Blue (High)
          lengthMult = 2.5;
      } else if (chargeLevel > 40) {
          color = '#facc15'; // Yellow (Med)
          lengthMult = 1.8;
      } else {
          lengthMult = 1.0; // Short
      }
      return { color, lengthMult };
  };

  const fireSalvoShot = () => { 
      const s = state.current; 
      const mainWeapon = activeShip.fitting.weapons[0]; 
      const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null; 
      const baseDamage = mainDef ? mainDef.damage : 45; 
      const dmg = baseDamage * 10.0; 
      
      let powerCost = 10;
      if (mainDef?.id === 'exotic_star_shatter') powerCost = 100/12; 
      // Phaser Sweep Power shot consumes less per shot but rapid fire
      if (mainDef?.id === 'exotic_phaser_sweep') powerCost = 25; // 4 shots = 100 charge.

      // New Logic: Power Shots use Capacitor ONLY. Do not touch Reactor Energy.
      // Locked logic: Cannot fire if locked.
      if (s.capacitorLocked) return;
      if (s.capacitor < powerCost) return;

      // EXPONENTIAL GROWTH FACTOR Calculation:
      // Target: 12x increase over ~40 frames
      // 1.06 ^ 40 ~= 10.28
      const EXP_GROWTH_RATE = 1.06;

      if (mainDef?.id.includes('exotic')) {
          const isStar = mainDef.id === 'exotic_star_shatter';
          const isRainbow = mainDef.id === 'exotic_rainbow_spread';
          const isFlamer = mainDef.id === 'exotic_flamer';
          const isWave = mainDef.id === 'exotic_wave';
          const isGravity = mainDef.id === 'exotic_gravity_wave';
          const isOrb = mainDef.id === 'exotic_plasma_orb';
          const isElectric = mainDef.id === 'exotic_electric';
          const isOcto = mainDef.id === 'exotic_octo_burst';
          const isPhaser = mainDef.id === 'exotic_phaser_sweep';

          // Initialize with SMALL sizes like normal shots, then grow exponentially
          // Prompt requirement: "start smaller... grow exponential"
          let w = 6;
          let h = 16;
          let grow = EXP_GROWTH_RATE; 
          let speed = 20; 
          const life = 60;
          let color = mainDef.beamColor || '#fff';
          let type = 'projectile';
          let detY = undefined;
          let isMulti = false;

          // Specific "Seeds" & Behaviors
          // Reduce speeds by ~20%
          if (isOrb) { 
              w = 8; h = 8; speed = 16; 
              grow = 1.05; // Slightly faster growth for round 8x target
          }
          else if (isWave) { 
              w = 10; h = 6; speed = 16; 
              grow = 1.05; // Round 8x target
          }
          else if (isGravity) { 
              w = 10; h = 6; speed = 16; 
              grow = 1.06; // Faster growth for ark 14x target
          }
          else if (isStar) { w = 12; h = 12; speed = 18; grow = 1.045; } // Larger start, 12x exponential growth over life
          else if (isRainbow) { w = 10; h = 4; speed = 14; }
          else if (isFlamer) { 
              w = 30; h = 30; speed = 20; // Bigger start
              grow = 1.03; // Growth
              color = '#3b82f6'; // Start Blue (Hot)
          }
          else if (isElectric) { 
              type = 'laser';
              w = 4; h = 20; speed = 28;
          }
          else if (isOcto) { 
              // Fireworks logic (Big Comet Bolt)
              type = 'octo_shell';
              w = 12; h = 12; grow = 0; speed = 12; 
              color = OCTO_COLORS[Math.floor(Math.random() * OCTO_COLORS.length)];
              // Octo Power Shot: Explode randomly starting at least 1/2 screen height away
              // Probabilistic distribution peaking at 3/4 screen height distance
              const hCanvas = canvasRef.current?.height || window.innerHeight;
              const distRatio = 0.5 + ((Math.random() + Math.random()) / 2) * 0.5; // range 0.5 to 1.0, center 0.75
              const dist = hCanvas * distRatio;
              detY = s.py - dist;
              isMulti = Math.random() > 0.7; // Some shots are multicolor
          }
          else if (isPhaser) { 
              type = 'laser';
              w = 5; h = 120; speed = 32; // 3x length of normal (40*3)
              color = '#d946ef'; // Pink Power Shot
          }

          // FIX: Start at nose of spaceship (s.py - 30 - h/2)
          // Since bullets are drawn centered, y must be offset by half height so bottom matches nose
          const spawnY = s.py - 30 - (h / 2);

          s.bullets.push({
              x: s.px, y: spawnY,
              vx: 0, vy: -speed, 
              damage: dmg,
              color: color,
              type: type,
              life: life,
              isEnemy: false,
              width: w,
              height: h,
              weaponId: mainDef.id,
              isOvercharge: true,
              isMain: true,
              growthRate: grow, // Exponential multiplier
              initialWidth: w, // Store initial sizes for limits
              initialHeight: h,
              glow: true,
              glowIntensity: 30, // STRONG GLOW FOR ALL POWER SHOTS
              detonationY: detY,
              isMulticolor: isMulti
          });
          
          if (isPhaser) audioService.playWeaponFire('exotic_power', 0); // Reuse power shot sound as it fits beam energy
          else audioService.playWeaponFire('exotic_power', 0);
      } else { 
          // Standard Mega Shot (Beam Logic) - Also applies growth
          const beamState = getCapacitorBeamState(s.capacitor);
          const baseW = 4; 
          const baseH = 25 * beamState.lengthMult; 
          // New Power Beam Logic: 1.4x Width, 3x Length compared to normal
          const width = baseW * 1.4; 
          const height = baseH * 3; 
          const color = beamState.color;

          // FIX: Start at nose of spaceship
          const spawnY = s.py - 30 - (height / 2);

          s.bullets.push({ 
              x: s.px, y: spawnY, vx: 0, vy: -35, damage: dmg, color: color, type: 'laser', life: 50, isEnemy: false, width: width, height: height, glow: true, glowIntensity: 20, isMain: true, weaponId: mainWeapon?.id || 'gun_pulse', isOvercharge: true,
              growthRate: EXP_GROWTH_RATE, initialWidth: width, initialHeight: height
          }); 
          audioService.playWeaponFire('mega', 0, activeShip.config.id);
      } 
      
      // Consume Capacitor
      s.capacitor = Math.max(0, s.capacitor - powerCost);
      
      // Depletion Lockout Logic
      if (s.capacitor < 5) {
          s.capacitorLocked = true;
          s.depletionTime = Date.now();
          setHud(h => ({...h, alert: "CAPACITOR DEPLETED - RECHARGING", alertType: 'warning'}));
      }
      
      s.weaponFireTimes[0] = Date.now(); 
      s.weaponHeat[0] = Math.min(100, (s.weaponHeat[0] || 0) + 1.0); 
      s.lastRapidFire = Date.now(); 
  };

  const fireRapidShot = () => { 
      const s = state.current; 
      
      // Cooldown Check
      if (s.weaponCoolDownTimer > s.frame) {
          return;
      }

      const mainWeapon = activeShip.fitting.weapons[0]; 
      const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null; 
      const fireRate = (mainDef?.id === 'exotic_rainbow_spread' || mainDef?.id === 'exotic_star_shatter') ? 6 : (mainDef ? mainDef.fireRate : 4); 
      const delay = 1000 / fireRate; 
      
      if (Date.now() - s.lastRapidFire > delay) { 
          if (mainDef && mainDef.isAmmoBased) { 
              // Ammo logic unchanged
              const gun = s.gunStates[0]; 
              if (!gun || gun.mag <= 0) return; 
              gun.mag--; 
          } else { 
              // ENERGY CONSUMPTION LOGIC (Standard Fire)
              // Cost per shot scales with Damage (Power).
              // Factor: 0.5 for Standard, 0.2 for Exotic (Significant efficiency bonus).
              // Example: 
              // - Pulse Laser (38 dmg): 38 * 0.5 = 19 energy/shot. @ 4/sec = 76/sec. Sustainable on Vanguard.
              // - Photon Emitter (90 dmg): 90 * 0.5 = 45 energy/shot. @ 8/sec = 360/sec. Drains Vanguard fast.
              
              const isExotic = mainDef?.id.includes('exotic');
              const baseDamage = mainDef ? mainDef.damage : 45;
              const efficiencyFactor = isExotic ? 0.2 : 0.5;
              
              const energyCostPerShot = baseDamage * efficiencyFactor;

              if (s.energy < energyCostPerShot) {
                  // EMPTY: Check Reserves
                  const hasReserves = s.cargo.some(c => c.type === 'energy');
                  if (!hasReserves) {
                      // TRIGGER COOL-OFF (10s)
                      s.weaponCoolDownTimer = s.frame + 600; // 600 frames = 10s @ 60fps
                      setHud(h => ({...h, alert: "ENERGY DEPLETED - COOLING DOWN (10s)", alertType: 'error'}));
                      audioService.playSfx('denied'); // Power down sound
                  }
                  return; 
              }
              
              s.energy -= energyCostPerShot; 
          } 
          
          let damage = mainDef ? mainDef.damage : 45; 
          let weaponId = mainDef ? mainDef.id : 'gun_pulse'; 
          let crystalColor = (mainDef?.beamColor) || (activeShip.gunColor || activeShip.config.noseGunColor || '#f87171'); 
          
          if (mainDef?.id.includes('exotic')) {
              // IMPRECISE SPRAY FOR ALL EXOTIC NORMAL SHOTS
              const sprayAngleDeg = (Math.random() * 30) - 15; // -15 to +15 degree deviation
              const sprayRad = sprayAngleDeg * (Math.PI / 180);
              const speed = 20;
              
              if (mainDef.id === 'exotic_flamer') {
                  // Use flame sound and random colors
                  crystalColor = '#3b82f6'; // Start Blue (Hot)
              } else if (mainDef.id === 'exotic_octo_burst') {
                  crystalColor = OCTO_COLORS[Math.floor(Math.random() * OCTO_COLORS.length)];
              } else if (mainDef.id !== 'exotic_phaser_sweep') {
                  // Default sound for other exotics EXCEPT phaser
                  audioService.playWeaponFire('exotic_single', 0);
              }

              // Default dimensions for most exotic normals
              let w = 6; 
              let h = 12;

              // --- RAINBOW NOVA NORMAL SHOT OVERRIDE ---
              if (mainDef.id === 'exotic_rainbow_spread') {
                  w = 16; // Radius 8 -> Diameter 16
                  h = 4;  // Thickness of ring
              }
              
              // --- DRAGON BREATH OVERRIDE ---
              if (mainDef.id === 'exotic_flamer') {
                  w = 12; h = 12; // Round blob
              }
              
              // --- PHASER OVERRIDE ---
              if (mainDef.id === 'exotic_phaser_sweep') {
                  h = 40; // Reduced from 80
                  w = 3.5;
              }

              if (mainDef.id === 'exotic_octo_burst') {
                  // Normal Fire Octo: Bright fireworks comet, no detonation
                  s.bullets.push({
                      x: s.px, y: s.py - 30, // Start slightly above ship
                      vx: Math.sin(sprayRad) * 12, // Slower for flak look
                      vy: -12, 
                      damage: damage,
                      color: crystalColor,
                      type: 'octo_shell',
                      life: 80,
                      isEnemy: false,
                      width: 8, height: 8,
                      glow: true,
                      glowIntensity: 20,
                      isMain: true,
                      weaponId,
                      growthRate: 0,
                      detonationY: undefined // Normal shots do NOT explode
                  });
                  audioService.playWeaponFire('missile', 0);
              } else if (mainDef.id === 'exotic_phaser_sweep') {
                  // PHASER SWEEP SPECIFIC LOGIC
                  // Apply nose origin fix here too for consistency
                  const spawnY = s.py - 30 - (h / 2);
                   s.bullets.push({ 
                      x: s.px, y: spawnY, 
                      vx: Math.sin(sprayRad) * speed, 
                      vy: -Math.cos(sprayRad) * speed, 
                      damage, 
                      color: crystalColor, // Red from config
                      type: 'laser', 
                      life: 50, 
                      isEnemy: false, 
                      width: w, 
                      height: h, 
                      glow: true, 
                      glowIntensity: 5, 
                      isMain: true, 
                      weaponId,
                      growthRate: 0 
                  });
                  audioService.playWeaponFire('phaser', 0);
              } else {
                  const growth = (mainDef.id === 'exotic_flamer') ? 1.025 : 0; 
                  
                  // STAR SHATTER Normal Shot Override: Increase diameter by 40% (4 -> 6)
                  if (mainDef.id === 'exotic_star_shatter') { w = 6; h = 6; }

                  s.bullets.push({ 
                      x: s.px, y: s.py - 24, 
                      vx: Math.sin(sprayRad) * speed, 
                      vy: -Math.cos(sprayRad) * speed, 
                      damage, 
                      color: crystalColor, 
                      type: 'projectile', 
                      life: 50, 
                      isEnemy: false, 
                      width: w, 
                      height: h, 
                      glow: true, 
                      glowIntensity: 5, 
                      isMain: true, 
                      weaponId,
                      growthRate: growth // Enable growth for Flamer
                  });
                  
                  if (mainDef.id === 'exotic_flamer') {
                      audioService.playWeaponFire('flame', 0);
                  }
              }
          } else { 
              // Standard Weapon Straight Shot
              s.bullets.push({ x: s.px, y: s.py - 24, vx: 0, vy: -30, damage, color: crystalColor, type: 'laser', life: 50, isEnemy: false, width: 4, height: 25, glow: true, glowIntensity: 5, isMain: true, weaponId }); 
              audioService.playWeaponFire(mainDef?.type === WeaponType.LASER ? 'laser' : 'cannon', 0, activeShip.config.id); 
          } 
          
          s.weaponFireTimes[0] = Date.now(); 
          s.weaponHeat[0] = Math.min(100, (s.weaponHeat[0] || 0) + 1.0); 
          s.lastRapidFire = Date.now(); 
      } 
  };
  const fireAlienWeapons = () => { const s = state.current; const mounts = getWingMounts(activeShip.config); const slots = [0, 1, 2]; const scale = 0.6; let fired = false; slots.forEach(slotIdx => { const w = activeShip.fitting.weapons[slotIdx]; if (w && w.id) { const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id); if (wDef) { const lastFire = s.weaponFireTimes[slotIdx] || 0; const delay = 1000 / wDef.fireRate; if (Date.now() - lastFire < delay) return; if (s.energy < wDef.energyCost) return; let startX = s.px; let startY = s.py; if (slotIdx === 0) { startY = s.py - 30; } else { const mountIdx = slotIdx - 1; const m = mounts[mountIdx]; startX = s.px + (m.x - 50) * scale; startY = s.py + (m.y - 50) * scale; } const damage = wDef.damage; const color = wDef.beamColor || '#fff'; const bulletSpeed = w.id.includes('exotic') ? 10 : 18; if (wDef.id === 'exotic_gravity_wave') { const angles = [-15, 0, 15]; angles.forEach(deg => { const rad = deg * (Math.PI / 180); s.bullets.push({ x: startX, y: startY, vx: Math.sin(rad) * 8, vy: -Math.cos(rad) * 8, damage, color: '#60a5fa', type: 'projectile', life: 80, isEnemy: false, width: 20, height: 20, weaponId: w.id, growthRate: 0.5 }); }); } else if (wDef.type === WeaponType.LASER) { s.bullets.push({ x: startX, y: startY, vx: 0, vy: -30, damage, color, type: 'laser', life: 50, isEnemy: false, width: 4, height: 25, weaponId: w.id }); } else { s.bullets.push({ x: startX, y: startY, vx: 0, vy: -bulletSpeed, damage, color, type: 'projectile', life: 60, isEnemy: false, width: 4, height: 16, weaponId: w.id }); } s.weaponFireTimes[slotIdx] = Date.now(); s.energy -= wDef.energyCost; fired = true; } } }); if (fired) { if (activeShip.fitting.weapons.some(w => w?.id === 'exotic_flamer')) { audioService.playWeaponFire('flame', 0, activeShip.config.id); } else { audioService.playWeaponFire('cannon', 0, activeShip.config.id); } } };
  const fireWingWeapons = () => { const s = state.current; const mounts = getWingMounts(activeShip.config); const wings = [activeShip.fitting.weapons[1], activeShip.fitting.weapons[2]]; let fired = false; wings.forEach((w, i) => { const slotIdx = i + 1; if (w && w.id) { const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id); if (wDef) { const interval = Math.max(1, Math.floor(60 / wDef.fireRate)); if (s.frame % interval === 0) { if (wDef.isAmmoBased) { const gun = s.gunStates[slotIdx]; if (!gun || gun.mag <= 0) return; gun.mag--; } else if (s.energy < wDef.energyCost) return; s.weaponFireTimes[slotIdx] = Date.now(); const scale = 0.6; const mx = mounts[i].x; const my = mounts[i].y; const startX = s.px + (mx - 50) * scale; const startY = s.py + (my - 50) * scale; const damage = wDef.damage; const color = wDef.beamColor || '#fff'; if (wDef.id === 'exotic_gravity_wave') { const angles = [-15, 0, 15]; angles.forEach(deg => { const rad = deg * (Math.PI / 180); s.bullets.push({ x: startX, y: startY, vx: Math.sin(rad) * 8, vy: -Math.cos(rad) * 8, damage, color: '#60a5fa', type: 'projectile', life: 80, isEnemy: false, width: 20, height: 20, weaponId: w.id, growthRate: 0.5 }); }); } else { s.bullets.push({ x: startX, y: startY, vx: 0, vy: -20, damage, color, type: wDef.type === WeaponType.LASER ? 'laser' : 'projectile', life: 60, isEnemy: false, width: 4, height: 16, weaponId: w.id }); } fired = true; if (!wDef.isAmmoBased) s.energy -= wDef.energyCost; } } } }); if (fired) audioService.playWeaponFire('cannon', 0, activeShip.config.id); };

  useEffect(() => {
    const k = state.current.keys;
    const kd = (e: KeyboardEvent) => { 
        if(e.repeat) return;
        if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === '-' || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract')) { e.preventDefault(); }
        if (e.code === 'Tab') { e.preventDefault(); } // Prevent navigation
        
        k.add(e.code); 
        
        if(e.code === 'KeyP') { togglePause(); }
        if(e.code === 'Escape') {
            const s = state.current;
            let finalHp = s.hp; let finalFuel = s.fuel;
            if (s.criticalExposure > 0 || s.rescueMode) { finalHp = 10; finalFuel *= 0.5; }
            onGameOver(false, s.score, true, { health: finalHp, fuel: finalFuel, water: s.water, rockets: s.missiles, mines: s.mines, redMineCount: s.redMines, cargo: s.cargo, ammo: s.ammo, magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer });
        }
        if(!state.current.paused && state.current.active && !state.current.rescueMode) {
            // Keep Manual Red Mine
            if(e.code === 'KeyB') fireRedMine(); 
            // Manual Mine Drop (Single)
            if(e.code === 'KeyN' || e.code === 'NumpadEnter' || e.code === 'Enter') fireMine();
            
            if (e.code === 'Space') inputRef.current.main = true;
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') inputRef.current.secondary = true;
        }
    };
    const ku = (e: KeyboardEvent) => {
        k.delete(e.code);
        if (e.code === 'Space') inputRef.current.main = false;
        if (e.code === 'ControlLeft' || e.code === 'ControlRight') inputRef.current.secondary = false;
        
        // Reset burst counters on keyup for hold logic
        if (e.code === 'Tab') { state.current.missileBurstCount = 0; }
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { state.current.mineBurstCount = 0; }
    };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  useEffect(() => {
    // ... game loop setup ...
    const cvs = canvasRef.current; if(!cvs) return;
    const ctx = cvs.getContext('2d'); if(!ctx) return;
    let raf: number;
    const s = state.current;

    const loop = () => {
        // ... (Update logic same as previous) ...
        if (!s.active) return;
        
        // --- PAUSE HANDLING ---
        if (s.paused) { 
            // Loop keeps running to maintain animation frame, but logic is skipped
            // We do NOT update the HUD here to avoid render loops/corruption
            raf = requestAnimationFrame(loop); 
            return; 
        }

        const width = cvs.width = window.innerWidth;
        const height = cvs.height = window.innerHeight;
        s.frame++;

        const regenRate = 2.0 + (activeShip.config.price / 100000);
        s.energy = Math.min(maxEnergy, s.energy + regenRate);

        const speed = 9;
        
        // ... (Auto Refuel Logic Remains Same) ...
        // ... (Input/Movement Logic Remains Same) ...
        // Keeping only relevant collision updates to save tokens, assuming other logic is identical to provided input
        
        const fuelLimit = maxFuel * 0.1;
        // ... Auto Refuel logic ...
        if (s.isRefueling) {
            s.refuelTimer++;
            const DURATION = 600; 
            const progress = s.refuelTimer / DURATION;
            if (s.refuelType === 'fuel') {
                const target = Math.min(maxFuel, s.fuel + 1.0); 
                s.fuel = s.refuelStartVal + (progress * (target - s.refuelStartVal));
            } else {
                const target = Math.min(maxWater, s.water + 20); 
                s.water = s.refuelStartVal + (progress * (target - s.refuelStartVal));
            }
            if (s.refuelTimer >= DURATION) {
                s.isRefueling = false; s.refuelTimer = 0;
                const cargoIdx = s.cargo.findIndex(c => c.type === s.refuelType);
                if (cargoIdx >= 0) {
                    s.cargo[cargoIdx].quantity--;
                    if (s.cargo[cargoIdx].quantity <= 0) s.cargo.splice(cargoIdx, 1);
                    setHud(h => ({...h, alert: s.refuelType === 'fuel' ? "REFUELING COMPLETE" : "REHYDRATION COMPLETE", alertType: 'success'}));
                    audioService.playSfx('buy');
                } else { setHud(h => ({...h, alert: "ERROR: SUPPLY MISSING", alertType: 'error'})); }
            } else if (s.refuelTimer % 60 === 0) {
                setHud(h => ({...h, alert: s.refuelType === 'fuel' ? `REFUELING... ${Math.floor(progress*100)}%` : `REHYDRATING... ${Math.floor(progress*100)}%`, alertType: 'warning'}));
            }
        } else {
            const criticalFuel = s.fuel < maxFuel * 0.1;
            const criticalWater = s.water < maxWater * 0.1;
            if (criticalFuel || criticalWater) {
                if (criticalWater) {
                    const hasWater = s.cargo.some(c => c.type === 'water');
                    if (hasWater) {
                        s.isRefueling = true; s.refuelType = 'water'; s.refuelStartVal = s.water;
                        setHud(h => ({...h, alert: "INITIATING AUTO-REHYDRATION", alertType: 'warning'})); audioService.playSfx('buy'); 
                    } else if (s.frame % 180 === 0) { setHud(h => ({...h, alert: "CRITICAL WATER - OUT OF SUPPLY", alertType: 'error'})); }
                } else if (criticalFuel) {
                    const hasFuel = s.cargo.some(c => c.type === 'fuel');
                    if (hasFuel) {
                        s.isRefueling = true; s.refuelType = 'fuel'; s.refuelStartVal = s.fuel;
                        setHud(h => ({...h, alert: "INITIATING AUTO-REFUEL", alertType: 'warning'})); audioService.playSfx('buy');
                    } else if (s.frame % 180 === 0) {
                        setHud(h => ({...h, alert: "CRITICAL FUEL - ABORT IMMEDIATELY", alertType: 'error'})); audioService.playAlertSiren();
                    }
                }
            }
        }

        const isDistress = !s.rescueMode && s.fuel <= fuelLimit && s.water <= 0 && !s.isRefueling;
        if (isDistress && s.frame % 180 === 0) { setHud(h => ({...h, alert: "CRITICAL FUEL - ABORT IMMEDIATELY", alertType: 'alert'})); audioService.playAlertSiren(); }

        // --- MOVEMENT LOGIC ---
        let targetThrottle = 0; let left = false; let right = false;
        if (!isDistress && !s.isRefueling) {
            left = s.keys.has('ArrowLeft') || s.keys.has('KeyA') || s.keys.has('Numpad4');
            right = s.keys.has('ArrowRight') || s.keys.has('KeyD') || s.keys.has('Numpad6');
            const up = s.keys.has('ArrowUp') || s.keys.has('KeyW') || s.keys.has('Numpad8');
            const down = s.keys.has('ArrowDown') || s.keys.has('KeyS') || s.keys.has('Numpad2');

            // --- MOVEMENT OVERRIDE FIX ---
            // If any movement keys are pressed, cancel mouse target
            if (left || right || up || down) {
                targetRef.current = null;
            }

            if (hasTiltRef.current) {
                const isLandscape = window.innerWidth > window.innerHeight;
                let tiltVal = isLandscape ? tiltRef.current.beta : tiltRef.current.gamma;
                if (tiltVal < -5) { left = true; s.px -= Math.abs(tiltVal) * 0.2; } else if (tiltVal > 5) { right = true; s.px += Math.abs(tiltVal) * 0.2; }
                if (Math.abs(tiltVal) > 5) { targetRef.current = null; }
            }
            if (up) targetThrottle = 1;
            else if (down) targetThrottle = -1;
            
            if (targetRef.current) {
                const dx = targetRef.current.x - s.px; const dy = targetRef.current.y - s.py; const dist = Math.hypot(dx, dy);
                if (dist < 10) { targetRef.current = null; targetThrottle = 0; } else {
                    const angle = Math.atan2(dy, dx); s.px += Math.cos(angle) * 12; s.py += Math.sin(angle) * 12;
                    const xComp = Math.cos(angle); const yComp = Math.sin(angle);
                    if (xComp < -0.5) left = true; if (xComp > 0.5) right = true;
                    if (yComp < -0.5) targetThrottle = 1; if (yComp > 0.5) targetThrottle = -1; 
                }
            }
        }
        s.currentThrottle = s.currentThrottle * 0.9 + targetThrottle * 0.1;
        if (Math.abs(s.currentThrottle) < 0.01) s.currentThrottle = 0;
        const verticalSpeed = -s.currentThrottle * 8; 
        if (!targetRef.current) s.py += verticalSpeed;
        s.py = Math.max(50, Math.min(height - 150, s.py));
        if (!isDistress && !s.isRefueling) {
            // Note: Manual keys move physics here if not using mouse target
            if (left && !targetRef.current) s.px -= speed;
            if (right && !targetRef.current) s.px += speed;
        }
        s.px = Math.max(30, Math.min(width-30, s.px));
        s.movement = { up: s.currentThrottle > 0.2, down: s.currentThrottle < -0.2, left, right };
        let isMoving = s.currentThrottle !== 0 || left || right; s.usingWater = false; 
        let worldSpeedFactor = 1.0;
        if (s.currentThrottle > 0.1) worldSpeedFactor = 1.0 + (s.currentThrottle * 0.5); 
        if (s.currentThrottle < -0.1) worldSpeedFactor = 1.0 + (s.currentThrottle * 0.5); 

        if (s.rescueMode) {
            const driftSpeed = 3;
            if (s.currentThrottle > 0) s.py -= driftSpeed; if (s.currentThrottle < 0) s.py += driftSpeed;
            s.px = Math.max(30, Math.min(width-30, s.px)); s.py = Math.max(50, Math.min(height-150, s.py));
            if (s.frame % 8 === 0) { 
                 s.particles.push({ x: s.px, y: s.py + 60, vx: (Math.random()-0.5)*1, vy: 2 + Math.random(), life: 1.2, color: '#9ca3af', size: 5 + Math.random()*5 });
            }
        } else {
            if (isMoving && !s.isRefueling) {
                let effort = 0.005; if (Math.abs(s.currentThrottle) > 0.1) effort += 0.002 * Math.abs(s.currentThrottle);
                if (s.water > 0) { s.usingWater = true; s.water = Math.max(0, s.water - (effort * 10.0)); } 
                else if (s.fuel > fuelLimit) { s.usingWater = false; s.fuel = Math.max(fuelLimit, s.fuel - effort); } 
                else { isMoving = false; }
            }
            if (s.hp < 30) {
                if (s.frame % 5 === 0) s.particles.push({ x: s.px + (Math.random()-0.5)*20, y: s.py + 10, vx: (Math.random()-0.5)*1, vy: 2, life: 0.8, color: '#777', size: 3 + Math.random()*3 });
                if (s.hp < 15 && s.frame % 10 === 0) s.particles.push({ x: s.px + (Math.random()-0.5)*15, y: s.py, vx: 0, vy: 1, life: 0.5, color: '#f97316', size: 2 });
            }
        }
        
        // --- BURST FIRE LOGIC ---
        const now = Date.now();
        // Missile (Tab) - Hold for burst (max 3, 1 per sec)
        if (s.keys.has('Tab') && !s.isRefueling && !s.rescueMode) {
            if (s.missileBurstCount < 3) {
                // Allows first shot immediately if last fire was old
                if (now - s.lastMissileFire > 1000) {
                    fireMissile();
                    s.missileBurstCount++;
                    // Note: fireMissile updates s.lastMissileFire internally
                }
            }
        } else {
            // Reset burst count when key released
            s.missileBurstCount = 0;
        }

        // Mine (Shift) - Hold for burst (max 3, 1 per sec)
        if ((s.keys.has('ShiftLeft') || s.keys.has('ShiftRight')) && !s.isRefueling && !s.rescueMode) {
            if (s.mineBurstCount < 3) {
                if (now - s.lastMineFire > 1000) {
                    fireMine();
                    s.mineBurstCount++;
                    // Note: fireMine updates s.lastMineFire internally
                }
            }
        } else {
            s.mineBurstCount = 0;
        }

        const isFiring = (s.keys.has('Space') || inputRef.current.main) && !s.isRefueling;
        // ... (Firing logic, ammo, capacitor code remains identical - omitted for brevity unless collision logic follows) ...
        
        if (!s.rescueMode) {
            // ... Gun/Capacitor logic ...
            // Simplified insertion:
            Object.keys(s.gunStates).forEach(keyStr => {
                const key = parseInt(keyStr); const gun = s.gunStates[key];
                const wId = activeShip.fitting.weapons[key]?.id;
                const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === wId);
                if (!wDef || !wDef.isAmmoBased) return;
                if (gun.mag <= 0 && gun.reloadTimer === 0) {
                    const defType = wDef.defaultAmmo || 'iron';
                    let hasAmmo = (s.ammo[defType] || 0) > 0;
                    if (!hasAmmo) { const anyAmmo = Object.keys(s.ammo).some(k => (s.ammo[k as AmmoType] || 0) > 0); if (anyAmmo) hasAmmo = true; }
                    if (hasAmmo) { gun.reloadTimer = Date.now() + 10000; setHud(h => ({...h, alert: "RELOADING WEAPON SYSTEMS...", alertType: 'warning'})); } 
                    else { if (s.frame % 300 === 0) { setHud(h => ({...h, alert: "AMMUNITION DEPLETED", alertType: 'error'})); } }
                }
                if (gun.reloadTimer > 0 && Date.now() > gun.reloadTimer) {
                    const defType = wDef.defaultAmmo || 'iron';
                    let typeToUse = (s.ammo[defType] || 0) > 0 ? defType : null;
                    if (!typeToUse) { typeToUse = Object.keys(s.ammo).find(k => (s.ammo[k as AmmoType] || 0) > 0) as AmmoType || null; }
                    if (typeToUse) { const amount = Math.min(gun.maxMag, s.ammo[typeToUse]); s.ammo[typeToUse] -= amount; gun.mag += amount; gun.reloadTimer = 0; audioService.playSfx('buy'); setHud(h => ({...h, alert: "WEAPONS RELOADED", alertType: 'success'})); } else { gun.reloadTimer = 0; }
                }
            });
            // Capacitor logic
            const regenRate = 2.0 + (activeShip.config.price / 100000); // Recalculated locally for ref
            const canCharge = s.capacitor < 100 && !isFiring && !s.rescueMode; 
            let isCharging = false;
            if (canCharge) {
                const requiredDrain = regenRate * 2.5; let actualDrain = requiredDrain; let actualCharge = 0.5;
                if (s.energy < requiredDrain) { const ratio = Math.max(0, s.energy / requiredDrain); actualDrain = s.energy; actualCharge = 0.5 * ratio; }
                if (actualDrain > 0) { s.energy = Math.max(0, s.energy - actualDrain); s.capacitor = Math.min(100, s.capacitor + actualCharge); isCharging = true; }
            }
            if (s.capacitorLocked && s.capacitor > 30) { s.capacitorLocked = false; setHud(h => ({...h, alert: "CAPACITOR ONLINE", alertType: 'success'})); }
            audioService.updateReactorHum(isCharging, s.capacitor);
            if (s.energy < maxEnergy * 0.1) {
                const energyIdx = s.cargo.findIndex(c => c.type === 'energy');
                if (energyIdx >= 0) { const item = s.cargo[energyIdx]; item.quantity--; if (item.quantity <= 0) s.cargo.splice(energyIdx, 1); s.energy = Math.min(maxEnergy, s.energy + 500); setHud(h => ({...h, alert: "RESERVE POWER INJECTED", alertType: 'warning'})); audioService.playSfx('buy'); }
            }
            
            if (activeShip.config.isAlien) { if (isFiring) fireAlienWeapons(); } 
            else {
                if (isFiring) {
                    const wId = activeShip.fitting.weapons[0]?.id;
                    let powerCost = 10; if (wId === 'exotic_star_shatter') powerCost = 100/12; 
                    const isPowerReady = !s.capacitorLocked && s.capacitor >= powerCost;
                    if (isPowerReady) {
                        let salvoRate = 15;
                        if (wId === 'exotic_phaser_sweep') salvoRate = 15; // 4 shots/sec
                        if (wId === 'exotic_flamer') salvoRate = 8; 
                        // STAR SHATTER POWER SHOT: 6 shots/sec (10 frames)
                        if (wId === 'exotic_star_shatter') salvoRate = 10; 
                        if (s.frame - s.lastSalvoFire > salvoRate) { fireSalvoShot(); s.lastSalvoFire = s.frame; }
                    } else { fireRapidShot(); }
                }
            }
            const firingSecondary = s.keys.has('ControlLeft') || s.keys.has('ControlRight') || inputRef.current.secondary;
            if (firingSecondary && !activeShip.config.isAlien && !s.isRefueling) { fireWingWeapons(); }
        }

        if (s.shakeX > 0) s.shakeX *= s.shakeDecay; if (s.shakeY > 0) s.shakeY *= s.shakeDecay;
        if (s.shakeX < 0.5) s.shakeX = 0; if (s.shakeY < 0.5) s.shakeY = 0;

        if (s.phase === 'boss') {
            const boss = s.enemies.find(e => e.type === 'boss');
            if (boss && boss.y > height + 100) {
                if (s.failureTimer === 0) setHud(h => ({...h, alert: "MISSION FAILED. RETURN TO BASE.", alertType: 'alert'}));
                s.failureTimer++;
                if (s.failureTimer > 600) { onGameOver(false, s.score, false, { health: s.hp, fuel: s.fuel, water: s.water, cargo: s.cargo }); s.active = false; }
            }
            if (s.bossDead) { s.victoryTimer++; if (s.victoryTimer > 180) { onGameOver(true, s.score, false, { health: s.hp, fuel: s.fuel, water: s.water, rockets: s.missiles, mines: s.mines, redMineCount: s.redMines, cargo: s.cargo, ammo: s.ammo, magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer }); s.active = false; } }
        }

        if (s.phase === 'travel') { 
            if (s.enemies.length < 3 + difficulty/2 && Date.now() - s.lastSpawn > 1500 && !s.rescueMode) { 
                let spawnPool = SHIPS.filter(s => !s.isAlien); if (difficulty >= 2) spawnPool = [...spawnPool, ...SHIPS.filter(s => s.isAlien)];
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
                // Specific Asteroid Crack Sound (Impact)
                audioService.playHullHit('asteroid');
                createExplosion(a.x, a.y, '#aaa', 10, 'asteroid');
            }
        }); 
        s.asteroids = s.asteroids.filter(a => a.y < height + 100 && a.hp > 0);

        s.enemies.forEach(e => { 
            if (s.rescueMode) { e.y += 3; if (e.type === 'boss') e.y += 2; } 
            else {
                e.update(s.px, s.py, width, height, s.bullets, worldSpeedFactor); 
                // ... Damage visual logic ...
                if (e.hp < e.maxHp && e.hp > 0) {
                    if (e.hp < e.maxHp * 0.9 && Math.random() < 0.2) s.particles.push({ x: e.x + (Math.random()-0.5)*30, y: e.y + (Math.random()-0.5)*30, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 0.5 + Math.random()*0.5, size: 3 + Math.random()*4, color: '#52525b', type: 'smoke' });
                    if (e.hp < e.maxHp * 0.5 && Math.random() < 0.3) s.particles.push({ x: e.x + (Math.random()-0.5)*20, y: e.y + (Math.random()-0.5)*20, vx: (Math.random()-0.5), vy: (Math.random()-0.5), life: 0.4 + Math.random()*0.3, size: 2 + Math.random()*3, color: '#ef4444', type: 'fire' });
                }
                if (difficulty >= 2 && e.type !== 'boss') {
                    const fireInterval = e.config.isAlien ? 120 : 180;
                    if (s.frame % fireInterval === 0 && Math.abs(e.x - s.px) < 300) {
                        const w = e.equippedWeapons[0]; if (w) { s.bullets.push({ x: e.x, y: e.y + 20, vx: 0, vy: 5, damage: 10, color: '#ef4444', type: 'projectile', life: 100, isEnemy: true, width: 6, height: 12 }); }
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
                    audioService.playHullHit('metal'); // Metal clank
                    createExplosion(e.x, e.y, '#f00', 10);
                }
            }
        });
        
        for (let i = s.enemies.length - 1; i >= 0; i--) {
            const e = s.enemies[i];
            if (e.hp <= 0 || e.y > height + 200) {
                if (e.hp <= 0 && !s.rescueMode) {
                    createAreaDamage(e.x, e.y, 150, 50);
                    if (e.type === 'boss') {
                        s.bossDead = true; s.score += 10000 * difficulty;
                        audioService.playExplosion(e.x, 3.0, 'boss');
                        createExplosion(e.x, e.y, '#a855f7', 30, 'boss');
                        setHud(h => ({...h, alert: "BOSS DEFEATED", alertType: 'success'}));
                        // ... Loot spawn logic ...
                        const rand = Math.random(); let lootType = ''; let lootId = ''; let quantity = 1; let name = '';
                        if (rand < 0.2) { const w = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)]; lootType = 'weapon'; lootId = w.id; name = w.name; } 
                        else if (rand < 0.4) { const sh = EXOTIC_SHIELDS[Math.floor(Math.random() * EXOTIC_SHIELDS.length)]; lootType = 'shield'; lootId = sh.id; name = sh.name; } 
                        else if (rand < 0.6) { lootType = 'missile'; quantity = 100; name = 'Missile Pack'; } 
                        else if (rand < 0.8) { lootType = 'mine'; quantity = 100; name = 'Mine Pack'; } 
                        else { const ammos = ['iridium', 'tungsten', 'explosive']; const selected = ammos[Math.floor(Math.random() * ammos.length)]; lootType = 'ammo'; lootId = selected; quantity = 5000; name = 'Heavy Ammo Crate'; }
                        spawnLoot(e.x, e.y, 0, lootType, lootId, name, quantity);
                    } else {
                        audioService.playExplosion(e.x, 1.0, 'normal');
                        s.score += 100 * difficulty;
                    }
                }
                s.enemies.splice(i, 1);
            }
        }

        s.bullets.forEach(b => { 
            // ... Bullet update logic ...
            b.x += b.vx; b.y += b.vy; b.life--; 
            if (b.vz !== undefined) b.z = (b.z || 0) + b.vz;
            
            // --- EXOTIC GROWTH & EFFECTS ---
            if (b.weaponId?.includes('exotic')) {
                // Growth logic
                if (b.growthRate && b.isOvercharge) {
                    let multiplier = 12.0; 
                    if (b.weaponId === 'exotic_gravity_wave') multiplier = 14.0;
                    else if (b.weaponId === 'exotic_plasma_orb' || b.weaponId === 'exotic_wave') multiplier = 8.0;

                    const limitW = (b.initialWidth || 6) * multiplier;
                    
                    if (b.type === 'projectile' || b.type === 'laser' || b.type === 'octo_shell') {
                        if (b.width < limitW) {
                            const oldH = b.height;
                            b.width *= b.growthRate;
                            b.height *= b.growthRate;
                            const dh = b.height - oldH;
                            b.y -= dh / 2;
                        }
                    }
                }

                // FLAMER EFFECTS (Dragon Breath)
                if (b.weaponId === 'exotic_flamer') {
                    // Growth for Flamer (Both Normal and Power)
                    const maxW = b.isOvercharge ? 250 : 100;
                    if (b.width < maxW && b.growthRate) {
                        b.width *= b.growthRate;
                        b.height *= b.growthRate;
                    }

                    // Color & Transparency Gradient based on Distance from Ship
                    const dist = Math.max(0, s.py - b.y);
                    const p = Math.min(1, dist / 800);

                    // Heat Gradient: Blue -> White -> Yellow -> Orange -> Red
                    if (p < 0.15) b.color = '#3b82f6';      // Blue
                    else if (p < 0.25) b.color = '#ffffff'; // White
                    else if (p < 0.45) b.color = '#facc15'; // Yellow
                    else if (p < 0.70) b.color = '#f97316'; // Orange
                    else b.color = '#ef4444';               // Red
                    
                    // Transparency at 3/4 of screen (p > 0.75)
                    if (p > 0.75) {
                        b.opacity = Math.max(0, 1 - ((p - 0.75) * 4));
                    } else {
                        b.opacity = 1;
                    }
                }

                // OCTO BURST EFFECTS (Comet Trail)
                if (b.weaponId === 'exotic_octo_burst') {
                    if (s.frame % 2 === 0) { // Optimize frequency
                        s.particles.push({
                            x: b.x + (Math.random()-0.5)*b.width,
                            y: b.y + (Math.random()-0.5)*b.height,
                            vx: (Math.random()-0.5)*1,
                            vy: (Math.random()-0.5)*1, // Smoke drifts
                            life: 0.6,
                            color: b.isMulticolor && Math.random() > 0.5 ? OCTO_COLORS[Math.floor(Math.random() * OCTO_COLORS.length)] : b.color,
                            size: Math.random() * 3 + 1,
                            type: 'sparkle' 
                        });
                    }
                }
            }

            if (b.type === 'firework_shell' && b.detonationY !== undefined) {
                if (Math.random() > 0.5) s.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.5, size: 2, color: '#fbbf24' });
                if (b.y <= b.detonationY) { b.life = 0; createExplosion(b.x, b.y, b.color, 25, 'fireworks'); createAreaDamage(b.x, b.y, 120, b.damage); audioService.playExplosion(0, 0.8, 'mine'); }
            }
            
            // OCTO SHELL LOGIC (Random Detonation for Power Only)
            if (b.type === 'octo_shell') {
                // If it reaches detonation altitude (Power shot only)
                if (b.isOvercharge && b.detonationY !== undefined && b.y <= b.detonationY) {
                    b.life = 0;
                    // FIREWORKS EXPLOSION
                    // Pass specific colors for fireworks if multicolor
                    if (b.isMulticolor) {
                        for(let i=0; i<3; i++) {
                             createExplosion(b.x + (Math.random()-0.5)*20, b.y + (Math.random()-0.5)*20, OCTO_COLORS[Math.floor(Math.random()*OCTO_COLORS.length)], 15, 'fireworks');
                        }
                    } else {
                        createExplosion(b.x, b.y, b.color, 30, 'fireworks'); 
                    }
                    
                    audioService.playExplosion(0, 1.2, 'mine'); 
                    
                    // AOE Damage & Shield Disable
                    s.enemies.forEach(e => {
                        if (e.hp <= 0) return;
                        const dist = Math.hypot(e.x - b.x, e.y - b.y);
                        if (dist < 200) {
                            const dmg = calculateDamage(b.damage, 'explosion', 'hull');
                            e.takeDamage(dmg, 'explosion', true, true, false);
                            
                            // 50% Chance to disable shields
                            if (e.shieldLayers.length > 0 && Math.random() > 0.5) {
                                e.shieldDisabledUntil = 300; // 5 seconds
                                createExplosion(e.x, e.y, '#3b82f6', 10, 'standard'); // Blue sparks for shield break
                            }
                        }
                    });
                }
            }

            if (['missile', 'missile_emp', 'mine', 'mine_emp', 'mine_red'].includes(b.type)) {
                // ... Homing logic (omitted for brevity, identical) ...
                const isMissile = b.type.includes('missile');
                const age = s.frame - (b.launchTime || 0);
                if (age < 20) { if (isMissile) { b.vy -= 0.6; b.vx *= 0.95; } else { b.vx *= 0.99; } } 
                else {
                    if (!b.target || b.target.hp <= 0 || b.target.y > height + 200 || b.target.y < -200) {
                        b.target = null; let best = null; let bestScore = -Infinity; let searchDir = isMissile ? (Math.hypot(b.vx, b.vy) > 1 ? Math.atan2(b.vy, b.vx) : -Math.PI/2) : (b.vx > 0 ? 0 : Math.PI);
                        const cone = isMissile ? (Math.PI / 2.5) : (Math.PI / 1.5); 
                        s.enemies.forEach(e => {
                            if (e.hp <= 0) return;
                            const dx = e.x - b.x; const dy = e.y - b.y; const dz = e.z - (b.z || 0); const dist3d = Math.hypot(dx, dy, dz);
                            if (dist3d > 900) return;
                            const angleToEnemy = Math.atan2(dy, dx); let diff = angleToEnemy - searchDir;
                            while (diff <= -Math.PI) diff += 2*Math.PI; while (diff > Math.PI) diff -= 2*Math.PI;
                            if (Math.abs(diff) < cone) { const score = (5000 / (dist3d + 1)) + (20 / (Math.abs(diff) + 0.1)); if (score > bestScore) { bestScore = score; best = e; } }
                        });
                        if (best) b.target = best;
                    }
                    if (b.target) {
                        const dx = b.target.x - b.x; const dy = b.target.y - b.y; const dz = b.target.z - (b.z || 0); const dist = Math.hypot(dx, dy, dz);
                        const turnRate = isMissile ? 0.18 : 0.08; const desiredSpeed = isMissile ? 15 : 8;
                        const tx = (dx / dist) * desiredSpeed; const ty = (dy / dist) * desiredSpeed; const tz = (dz / dist) * desiredSpeed;
                        b.vx += (tx - b.vx) * turnRate; b.vy += (ty - b.vy) * turnRate; b.vz = (b.vz || 0) + (tz - (b.vz || 0)) * turnRate;
                    }
                    s.asteroids.forEach(a => { if (a.hp > 0) { const dx = b.x - a.x; const dy = b.y - a.y; const dist = Math.hypot(dx, dy); const avoidRad = a.size + 80; if (dist < avoidRad) { const force = (avoidRad - dist) / avoidRad; const repulsion = isMissile ? 2.5 : 1.5; b.vx += (dx / dist) * force * repulsion; b.vy += (dy / dist) * force * repulsion; } } });
                    if (isMissile) { const speed = Math.hypot(b.vx, b.vy); if (speed < (b.maxSpeed || 16)) { b.vx *= 1.05; b.vy *= 1.05; } }
                }
            }
            // ... Gravity wave collision ...
            if (b.weaponId === 'exotic_gravity_wave' && b.growthRate) {
                s.bullets.forEach(other => { if (other.isEnemy && Math.abs(other.x - b.x) < b.width && Math.abs(other.y - b.y) < b.height) { other.isEnemy = false; other.vx = (Math.random()-0.5) * 5; other.vy = -Math.abs(other.vy) - 5; other.color = b.color; other.damage *= 2; createExplosion(other.x, other.y, b.color, 1); } });
            }

            if (b.isEnemy && !s.rescueMode) { 
                if (Math.hypot(b.x-s.px, b.y-s.py) < 30) { takeDamage(b.damage, b.type); b.life = 0; createExplosion(b.x, b.y, b.color, 3); } 
            } else if (!b.isEnemy) { 
                let hit = false; 
                s.enemies.forEach(e => { 
                    const isOrdnance = b.type.includes('missile') || b.type.includes('mine');
                    const hitDist = isOrdnance ? (e.type === 'boss' ? 100 : 60) : (e.type === 'boss' ? 80 : 40); 
                    // OCTO SHELL (POWER) has larger hit box
                    let hitThreshold = (b.weaponId === 'exotic_flamer' || b.weaponId === 'exotic_rainbow_spread' || b.weaponId === 'exotic_star_shatter' || b.type === 'octo_shell') ? Math.max(hitDist, b.width/2) : hitDist;
                    const dist2d = Math.hypot(b.x-e.x, b.y-e.y); const zDist = Math.abs((b.z || 0) - e.z);

                    if (dist2d < hitThreshold && (!isOrdnance || zDist < 80)) { 
                        let effectiveDamage = b.damage;
                        if (b.weaponId === 'exotic_star_shatter') {
                            if (b.isOvercharge) { const ratio = Math.min(1, Math.max(0, (b.width - 6) / 30)); const multiplier = 4 + (ratio * 16); effectiveDamage = b.damage * multiplier; } 
                            else { const ratio = Math.min(1, b.width / 12); effectiveDamage = b.damage * ratio; }
                        }
                        
                        // FLAMER DAMAGE FALLOFF
                        if (b.weaponId === 'exotic_flamer' && !b.isOvercharge) {
                            effectiveDamage *= (b.life / 50); 
                        }

                        // OCTO BURST IMPACT (Normal or Power before Detonation)
                        if (b.type === 'octo_shell') {
                            hit = true;
                            if (b.isOvercharge) {
                                // Power shot hit something directly before detonating
                                createExplosion(b.x, b.y, b.color, 40, 'fireworks'); 
                                audioService.playExplosion(0, 1.5, 'emp'); 
                                createAreaDamage(b.x, b.y, 200, b.damage);
                            } else {
                                // Normal Shot Direct Hit
                                e.takeDamage(effectiveDamage, 'projectile', true, false, false);
                                createExplosion(b.x, b.y, b.color, 5, 'fireworks');
                            }
                        } else {
                            e.takeDamage(effectiveDamage, b.type as any, !!b.isMain, !!b.isOvercharge, !!b.isEmp); 
                            hit = true; 
                            createExplosion(b.x, b.y, b.color, 2);
                            
                            // NEW AUDIO LOGIC FOR IMPACTS & AOE for Ordnance
                            if (b.isEmp || b.type.includes('emp') || b.type.includes('red')) { 
                                audioService.playExplosion(0, 1.2, 'emp'); 
                                // Red mines AOE handled on death
                            } 
                            else if (b.type.includes('missile')) { 
                                audioService.playExplosion(0, 0.8, 'normal'); 
                                // ADDED: Missile AOE on impact
                                createAreaDamage(b.x, b.y, 100, b.damage / 2);
                            } 
                            else if (b.type.includes('mine')) { 
                                audioService.playExplosion(0, 1.2, 'mine'); 
                                // Mine AOE on impact
                                createAreaDamage(b.x, b.y, 150, b.damage); 
                            }
                        }
                    } 
                });
                
                // Asteroid Collision
                s.asteroids.forEach(a => {
                    const hitThreshold = (b.weaponId === 'exotic_flamer' || b.weaponId === 'exotic_rainbow_spread' || b.weaponId === 'exotic_star_shatter' || b.type === 'octo_shell') ? Math.max(a.size + 10, b.width/2) : a.size + 10;
                    if (Math.hypot(b.x-a.x, b.y-a.y) < hitThreshold) {
                        let dmg = calculateDamage(b.damage, b.type, 'hull'); if (b.isOvercharge) dmg *= 5.0; 
                        
                        // FLAMER DAMAGE FALLOFF
                        if (b.weaponId === 'exotic_flamer' && !b.isOvercharge) {
                            dmg *= (b.life / 50);
                        }

                        // OCTO BURST POWER SHOT ON ASTEROID
                        if (b.type === 'octo_shell') {
                             if (b.isOvercharge) {
                                dmg *= 2.0;
                                hit = true;
                                createExplosion(b.x, b.y, b.color, 40, 'fireworks'); 
                                audioService.playExplosion(0, 1.5, 'emp'); 
                                createAreaDamage(b.x, b.y, 200, b.damage);
                             } else {
                                hit = true;
                                createExplosion(b.x, b.y, b.color, 5, 'fireworks');
                             }
                        }

                        a.hp -= dmg; if (a.hp <= 0 && a.loot) spawnLoot(a.x, a.y, a.z, a.loot.type, a.loot.id, a.loot.name, a.loot.quantity || 1);
                        if (!hit) hit = true; 
                        
                        if (dmg > 5 && b.type !== 'octo_shell') { // Octo handled above
                            createExplosion(b.x, b.y, '#aaa', 5, 'asteroid');
                            const isEnergy = b.type === 'laser' || b.type === 'bolt' || b.weaponId?.includes('exotic');
                            if (b.type.includes('missile')) { 
                                audioService.playExplosion(0, 0.8, 'normal'); 
                                createAreaDamage(b.x, b.y, 100, b.damage / 2);
                            } 
                            else if (b.type.includes('mine')) { 
                                audioService.playExplosion(0, 1.2, 'mine'); 
                                createAreaDamage(b.x, b.y, 150, b.damage); 
                            } 
                            else {
                                // Asteroid Hit Sound
                                audioService.playHullHit('asteroid');
                            }
                        }
                    }
                });
                
                if (hit && b.weaponId !== 'exotic_rainbow_spread' && b.type !== 'firework_shell' && (b.type !== 'octo_shell' || b.isOvercharge)) b.life = 0;
            }
        }); 
        s.bullets = s.bullets.filter(b => {
            if (b.life <= 0) {
                if (b.type.includes('mine')) {
                    // Use bullet damage for mine AOE on timeout/death
                    createAreaDamage(b.x, b.y, 150, b.damage); 
                    createExplosion(b.x, b.y, b.color, 5);
                    if (b.type.includes('emp') || b.type.includes('red')) { audioService.playExplosion(0, 1.2, 'emp'); } 
                    else { audioService.playExplosion(0, 1.2, 'mine'); }
                }
                return false;
            }
            return b.y > -200 && b.y < height + 200;
        });
        
        // ... Loot and Particles update logic (identical) ...
        s.loot.forEach(l => {
            const dx = s.px - l.x; const dy = s.py - l.y; const dist = Math.hypot(dx, dy);
            if (dist < 175) { l.isBeingPulled = true; l.x += dx * 0.08; l.y += dy * 0.08; } 
            else { l.isBeingPulled = false; l.y += 2 * worldSpeedFactor; l.x += l.vx; l.y += l.vy; }
            if (dist < 30) {
                l.isPulled = true; audioService.playSfx('buy');
                if (l.type === 'fuel') { s.fuel = Math.min(maxFuel, s.fuel + 1.0); setHud(h => ({...h, alert: "+FUEL", alertType: 'success'})); }
                else if (l.type === 'water') { s.water = Math.min(maxWater, s.water + 20); setHud(h => ({...h, alert: "+WATER", alertType: 'success'})); }
                else if (l.type === 'energy') { s.energy = Math.min(maxEnergy, s.energy + 200); setHud(h => ({...h, alert: "+ENERGY", alertType: 'success'})); }
                else if (l.type === 'repair' || l.type === 'nanite') { s.hp = Math.min(100, s.hp + 10); setHud(h => ({...h, alert: "+HULL REPAIR", alertType: 'success'})); }
                else if (l.type === 'missile') { s.missiles = Math.min(10, s.missiles + (l.quantity || 1)); setHud(h => ({...h, alert: `+${l.quantity || 1} MISSILES`, alertType: 'success'})); }
                else if (l.type === 'mine') { s.mines = Math.min(10, s.mines + (l.quantity || 1)); setHud(h => ({...h, alert: `+${l.quantity || 1} MINES`, alertType: 'success'})); }
                else if (l.type === 'ammo') { const ammoId = l.id as any; if (ammoId) { s.ammo[ammoId] = (s.ammo[ammoId] || 0) + ((l.quantity || 1) * 1000); setHud(h => ({...h, alert: `+${l.quantity || 1} AMMO UNITS`, alertType: 'success'})); } }
                else if (l.type === 'weapon' || l.type === 'shield') { const newItem: CargoItem = { instanceId: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, type: l.type as any, id: l.id, name: l.name || 'Unknown', quantity: l.quantity || 1, weight: 1 }; s.cargo.push(newItem); setHud(h => ({...h, alert: `LOOT ACQUIRED: ${l.name}`, alertType: 'success'})); }
                else if (['gold', 'platinum', 'lithium', 'iron', 'copper', 'chromium', 'titanium', 'tungsten', 'goods', 'robot', 'drug', 'medicine', 'food', 'equipment', 'part', 'luxury'].includes(l.type)) { const itemId = l.id || l.type; const qty = l.quantity || 1; const existingItem = s.cargo.find(c => c.id === itemId); if (existingItem) { existingItem.quantity += qty; } else { s.cargo.push({ instanceId: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, type: l.type as any, id: itemId, name: l.name || itemId.toUpperCase(), quantity: qty, weight: 1 }); } setHud(h => ({...h, alert: `+${qty} ${l.name || l.type.toUpperCase()}`, alertType: 'success'})); }
                else { s.score += 500; }
            }
        });
        s.loot = s.loot.filter(l => !l.isPulled && (l.y < height + 100 || l.isBeingPulled));
        s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; }); s.particles = s.particles.filter(p => p.life > 0);

        // ... Draw Loop (identical) ...
        const shakeX = (Math.random() - 0.5) * s.shakeX; const shakeY = (Math.random() - 0.5) * s.shakeY;
        ctx.save(); ctx.translate(shakeX, shakeY);
        ctx.fillStyle = '#000'; ctx.fillRect(-shakeX, -shakeY, width, height); 
        ctx.fillStyle = '#fff'; s.stars.forEach(st => { st.y += st.s * 0.5 * worldSpeedFactor; if(st.y > height) st.y = 0; ctx.globalAlpha = Math.random() * 0.5 + 0.3; ctx.beginPath(); ctx.arc(st.x, st.y, st.s, 0, Math.PI*2); ctx.fill(); }); ctx.globalAlpha = 1;
        const entities = [...s.asteroids.map(a => ({type: 'ast', z: a.z, obj: a})), ...s.enemies.map(e => ({type: 'enemy', z: e.z, obj: e})), ...s.loot.map(l => ({type: 'loot', z: l.z, obj: l})), {type: 'player', z: 0, obj: null}].sort((a,b) => a.z - b.z);
        const lightVec = { x: 0.8, y: -0.8, z: 0.8 }; const len = Math.hypot(lightVec.x, lightVec.y, lightVec.z); lightVec.x /= len; lightVec.y /= len; lightVec.z /= len;
        
        // ... (Render Entities logic - same as before) ...
        entities.forEach(item => {
            const scale = 1 + (item.z / 1000);
            if (item.type === 'ast') {
                const a = item.obj as Asteroid;
                ctx.save(); ctx.translate(a.x, a.y); ctx.scale(scale, scale); 
                const cosX = Math.cos(a.ax), sinX = Math.sin(a.ax); const cosY = Math.cos(a.ay), sinY = Math.sin(a.ay); ctx.rotate(a.az); 
                a.faces.forEach(f => { let nx = f.normal.x; let ny = f.normal.y; let nz = f.normal.z; let ty = ny*cosX - nz*sinX; let tz = ny*sinX + nz*cosX; ny = ty; nz = tz; let tx = nx*cosY + nz*sinY; tz = -nx*sinY + nz*cosY; nx = tx; nz = tz; const cosZ = Math.cos(a.az), sinZ = Math.sin(a.az); tx = nx*cosZ - ny*sinZ; ty = nx*sinZ + ny*cosZ; nx = tx; ny = ty; if (nz <= 0) return; const dot = Math.max(0, nx*lightVec.x + ny*lightVec.y + nz*lightVec.z); const lightIntensity = 0.2 + (0.8 * dot); ctx.fillStyle = mixColor('#000000', a.color, lightIntensity); ctx.strokeStyle = mixColor('#000000', a.color, lightIntensity * 1.2); ctx.lineWidth = 1; ctx.beginPath(); f.indices.forEach((idx, i) => { const v = a.vertices[idx]; let vx = v.x; let vy = v.y; let vz = v.z; let rvy = vy*cosX - vz*sinX; let rvz = vy*sinX + vz*cosX; vy = rvy; vz = rvz; let rvx = vx*cosY + vz*sinY; rvz = -vx*sinY + vz*cosY; vx = rvx; vz = rvz; if (i===0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy); }); ctx.closePath(); ctx.fill(); ctx.stroke(); }); ctx.restore();
            } else if (item.type === 'player') {
                ctx.translate(s.px, s.py); drawShip(ctx, { config: activeShip.config, fitting: activeShip.fitting, color: activeShip.color, wingColor: activeShip.wingColor, cockpitColor: activeShip.cockpitColor, gunColor: activeShip.gunColor, secondaryGunColor: activeShip.secondaryGunColor, gunBodyColor: activeShip.gunBodyColor, engineColor: activeShip.engineColor, nozzleColor: activeShip.nozzleColor, equippedWeapons: activeShip.fitting.weapons }, true, s.movement, s.usingWater, s.rescueMode);
                if ((s.sh1 > 0 || s.sh2 > 0) && !s.rescueMode) { if (s.sh1 > 0) { ctx.save(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3; ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 10; ctx.globalAlpha = Math.min(1, s.sh1 / 250) * 0.6; ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } if (s.sh2 > 0) { ctx.save(); ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 3; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 10; ctx.globalAlpha = Math.min(1, s.sh2 / 500) * 0.6; ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } }
            } else if (item.type === 'enemy') {
                const e = item.obj as Enemy; ctx.translate(e.x, e.y); ctx.scale(scale, scale); ctx.rotate(Math.PI); const alienCols = getAlienColors(quadrant); drawShip(ctx, { config: e.config, fitting: null, color: e.type==='boss'?'#a855f7':alienCols.hull, wingColor: e.type==='boss'?'#d8b4fe':alienCols.wing, gunColor: '#ef4444', equippedWeapons: e.equippedWeapons }, false);
                if (e.shieldLayers.length > 0) { e.shieldLayers.forEach((layer, idx) => { if (layer.current <= 0) return; const radius = 48 + (idx * 8); const opacity = Math.min(1, layer.current / layer.max); ctx.strokeStyle = layer.color; ctx.lineWidth = 3; ctx.shadowColor = layer.color; ctx.shadowBlur = 10; ctx.globalAlpha = opacity; if (layer.wobble > 0.01) { ctx.beginPath(); const steps = 40; const wobbleFreq = 8; const wobbleAmp = 5 * layer.wobble; const timeOffset = s.frame * 0.5; for(let i=0; i<=steps; i++) { const angle = (i / steps) * Math.PI * 2; const rOff = Math.sin(angle * wobbleFreq + timeOffset) * wobbleAmp; const r = radius + rOff; const x = Math.cos(angle) * r; const y = Math.sin(angle) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); } ctx.shadowBlur = 0; ctx.globalAlpha = 1; }); }
            } else if (item.type === 'loot') {
                // ... Loot render (omitted) ...
                const l = item.obj as Loot; ctx.translate(l.x, l.y); ctx.scale(scale, scale); if (l.isBeingPulled) { ctx.strokeStyle = 'rgba(192, 210, 255, 0.8)'; ctx.lineWidth = 2; ctx.shadowColor = '#fff'; ctx.shadowBlur = 5; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; ctx.save(); const dx = s.px - l.x; const dy = s.py - l.y; const dist = Math.hypot(dx, dy); const angle = Math.atan2(dy, dx); ctx.rotate(angle); const spacing = 15; const count = Math.ceil(dist / spacing); const speed = 4; const offset = (s.frame * speed) % spacing; ctx.lineWidth = 2; for (let i = 0; i <= count; i++) { const d = i * spacing + offset; if (d > 0 && d < dist) { const alpha = Math.min(1, Math.sin((d/dist)*Math.PI)) * 0.6; ctx.strokeStyle = `rgba(135, 206, 250, ${alpha})`; ctx.beginPath(); ctx.moveTo(d, -7); ctx.quadraticCurveTo(d - 5, 0, d, 7); ctx.stroke(); } } ctx.restore(); } ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.rect(-8, -8, 16, 16); ctx.fill(); ctx.shadowBlur = 0; if (l.type === 'water') { ctx.fillStyle = '#3b82f6'; ctx.fillRect(-8,-8,16,16); } else if (l.type === 'energy') { ctx.fillStyle = '#22d3ee'; ctx.fillRect(-8,-8,16,16); } ctx.font = "900 10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = (l.type === 'water' || l.type === 'energy') ? '#000' : '#000'; if (l.type === 'water') ctx.fillStyle = '#fff'; let letter = "?"; if (l.type === 'fuel') letter = "F"; else if (l.type === 'water') letter = "W"; else if (l.type === 'energy') letter = "E"; else if (l.type === 'repair' || l.type === 'nanite') letter = "+"; else if (l.type === 'missile') letter = "M"; else if (l.type === 'mine') letter = "X"; else if (l.type === 'ammo') letter = "A"; else if (l.type === 'weapon') letter = "G"; else if (l.type === 'shield') letter = "S"; ctx.fillText(letter, 0, 1);
            }
            ctx.setTransform(1, 0, 0, 1, shakeX, shakeY); 
        });

        // ... Bullets and Particles Render ...
        s.bullets.forEach(b => { 
            const scale = 1 + (b.z || 0) / 1000; ctx.save(); ctx.translate(b.x, b.y); ctx.scale(scale, scale);
            if (b.type === 'missile' || b.type === 'missile_emp') { ctx.scale(1.2, 1.2); const angle = Math.atan2(b.vy, b.vx) + Math.PI/2; ctx.rotate(angle); ctx.fillStyle = b.finsColor || '#ef4444'; ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-6, 2); ctx.lineTo(-3, 0); ctx.lineTo(-3, 8); ctx.fill(); ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(6, 2); ctx.lineTo(3, 0); ctx.lineTo(3, 8); ctx.fill(); ctx.fillStyle = '#94a3b8'; ctx.fillRect(-3, -6, 6, 14); ctx.fillStyle = b.headColor || '#ef4444'; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(0, -10); ctx.lineTo(3, -6); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(0, 12 + Math.random()*4); ctx.lineTo(2, 8); ctx.fill(); } 
            else if (b.type === 'mine' || b.type === 'mine_emp' || b.type === 'mine_red') { const radius = b.width / 2; ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5 + Math.sin(s.frame * 0.5) * 0.5; ctx.beginPath(); ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = b.color; ctx.lineWidth = 2; const spikeCount = 8; const spikeLen = radius + 4; for (let i = 0; i < spikeCount; i++) { const a = (Math.PI * 2 / spikeCount) * i + (s.frame * 0.05); const sx = Math.cos(a) * radius; const sy = Math.sin(a) * radius; const ex = Math.cos(a) * spikeLen; const ey = Math.sin(a) * spikeLen; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); } }
            else if (b.type === 'octo_shell') { 
                ctx.save(); 
                ctx.fillStyle = b.color;
                ctx.shadowColor = b.color;
                ctx.shadowBlur = b.glowIntensity || 20; // High glow
                ctx.beginPath();
                ctx.arc(0, 0, b.width/2, 0, Math.PI*2);
                ctx.fill();
                // Inner white core
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(0, 0, b.width/4, 0, Math.PI*2);
                ctx.fill();
                
                // Hot comet glow
                if (!b.isOvercharge) {
                   ctx.fillStyle = 'rgba(255,255,255,0.4)';
                   ctx.beginPath();
                   ctx.arc(0, 0, b.width*0.8, 0, Math.PI*2);
                   ctx.fill();
                }

                ctx.restore();
            } 
            else if (b.weaponId === 'exotic_octo_burst') { 
                // Legacy check fallback if weaponId present but type is standard projectile
                ctx.save(); 
                ctx.translate(b.x, b.y);
                ctx.fillStyle = b.color;
                ctx.shadowColor = b.color;
                ctx.shadowBlur = b.glowIntensity || 20; // High glow
                ctx.beginPath();
                ctx.arc(0, 0, b.width/2, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(0, 0, b.width/4, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
            } 
            else if (b.weaponId === 'exotic_gravity_wave') { ctx.strokeStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 15; ctx.lineCap = 'round'; const count = 5; const spacing = 6; for(let i=0; i<count; i++) { const arcW = b.width * (1 - i * 0.15); const yOff = i * spacing; ctx.globalAlpha = Math.max(0, 0.8 - (i * 0.15)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, yOff, arcW/2, Math.PI * (7/6), Math.PI * (11/6)); ctx.stroke(); } ctx.globalAlpha = 1; ctx.shadowBlur = 0; } 
            else if (b.weaponId === 'exotic_star_shatter') { 
                ctx.fillStyle = b.isOvercharge ? '#ffffff' : '#fbbf24'; 
                ctx.shadowColor = b.isOvercharge ? '#facc15' : '#f97316'; 
                
                // DYNAMIC SHADOW BLUR SCALING WITH SIZE
                // Original was 30. Now max width is ~144. Scale blur relative to width.
                const blurScale = b.width / 4; 
                ctx.shadowBlur = b.isOvercharge ? Math.min(100, 20 + blurScale) : 10; 
                
                const rot = s.frame * 0.15 + (b.x * 0.01); 
                ctx.rotate(rot); 
                ctx.beginPath(); 
                
                // Dynamic Rays: 6 to 64
                const baseSpikes = 6;
                const maxSpikes = 64;
                const ratio = (b.width - (b.initialWidth || 4)) / ((b.initialWidth || 4) * 2); // approx 0 to 1
                const spikes = Math.floor(Math.min(maxSpikes, Math.max(baseSpikes, baseSpikes + (ratio * (maxSpikes - baseSpikes)))));
                
                const outer = b.width; 
                const inner = b.width * 0.4; 
                
                for(let i=0; i<spikes; i++) { 
                    const angleStep = Math.PI / spikes;
                    const angle = i * 2 * Math.PI / spikes;
                    
                    let x = Math.cos(angle) * outer; 
                    let y = -Math.sin(angle) * outer; 
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); 
                    
                    x = Math.cos(angle + angleStep) * inner; 
                    y = -Math.sin(angle + angleStep) * inner; 
                    ctx.lineTo(x, y); 
                } 
                ctx.closePath(); 
                ctx.fill(); 
                ctx.shadowBlur = 0; 
            } 
            else if (b.weaponId === 'exotic_flamer') {
                ctx.globalAlpha = b.opacity !== undefined ? b.opacity : 1.0;
                
                // Draw Multicolor Blob
                ctx.fillStyle = b.color;
                ctx.shadowColor = b.color;
                ctx.shadowBlur = b.isOvercharge ? 30 : b.width; 
                
                ctx.beginPath();
                ctx.arc(0, 0, b.width/2, 0, Math.PI*2);
                ctx.fill();
                
                // Inner White Core (Simulate intense heat)
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = (b.opacity !== undefined ? b.opacity : 1.0) * 0.6;
                ctx.beginPath();
                ctx.arc(0, 0, b.width/4, 0, Math.PI*2);
                ctx.fill();
                
                ctx.globalAlpha = 1.0;
                ctx.shadowBlur = 0;
            }
            else if (b.weaponId === 'exotic_rainbow_spread') { 
                const radius = b.width / 2; 
                const thickness = b.height; 
                const maxRad = b.isOvercharge ? 300 : 100; // Increased scale for power
                const opacity = Math.max(0.1, 1.0 - (radius / maxRad)); 
                ctx.globalAlpha = opacity; 
                
                if (b.isOvercharge) {
                    ctx.shadowColor = '#ffffff';
                    ctx.shadowBlur = 30; // Glow for power shot
                    // POWER: Rainbow Circles (Concentric)
                    const colors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
                    colors.forEach((c, i) => {
                        const r = radius - (i * 3); 
                        if (r > 0) {
                            ctx.beginPath();
                            ctx.arc(0, 0, r, 0, Math.PI * 2);
                            ctx.strokeStyle = c;
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                    });
                    ctx.shadowBlur = 0;
                } else {
                    // NORMAL: Soot Arcs (Dark Grey)
                    const rot = Math.atan2(b.vy, b.vx);
                    ctx.rotate(rot);
                    ctx.strokeStyle = '#52525b'; 
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, radius, -Math.PI/2, Math.PI/2);
                    ctx.stroke();
                    ctx.strokeStyle = '#27272a';
                    ctx.beginPath();
                    ctx.arc(0, 0, radius * 0.7, -Math.PI/2, Math.PI/2);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1; 
            } 
            else if (b.weaponId === 'exotic_electric') { ctx.strokeStyle = '#00ffff'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = b.isOvercharge ? 30 : 10; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -b.height/2); let ly = -b.height/2; while(ly < b.height/2) { ly += 5; ctx.lineTo((Math.random()-0.5)*b.width, ly); } ctx.stroke(); ctx.shadowBlur = 0; } 
            else if (b.weaponId === 'exotic_wave') { ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.shadowColor = b.color; ctx.shadowBlur = b.isOvercharge ? 30 : 5; ctx.beginPath(); ctx.arc(0, 0, b.width, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, b.width * 0.6, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; } 
            else if (b.weaponId === 'exotic_plasma_orb') { const grad = ctx.createRadialGradient(0,0, b.width*0.2, 0,0, b.width); grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, b.color); grad.addColorStop(1, 'transparent'); ctx.fillStyle = grad; ctx.shadowColor = b.color; ctx.shadowBlur = b.isOvercharge ? 30 : 0; ctx.beginPath(); ctx.arc(0,0, b.width, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; } 
            else if (b.type === 'laser') { if (Math.abs(b.vx) > 0.1) { const angle = Math.atan2(b.vy, b.vx) + Math.PI/2; ctx.rotate(angle); } ctx.fillStyle = b.color; if (b.isOvercharge) { ctx.lineCap = 'round'; ctx.lineWidth = b.width; ctx.strokeStyle = b.color; ctx.shadowBlur = b.glowIntensity || 10; ctx.shadowColor = b.color; ctx.beginPath(); ctx.moveTo(0, -b.height/2); ctx.lineTo(0, b.height/2); ctx.stroke(); ctx.lineWidth = b.width/2; ctx.strokeStyle = '#fff'; ctx.shadowBlur = 0; ctx.stroke(); } else { ctx.fillRect(-b.width/2, -b.height/2, b.width, b.height); } } 
            else if (b.type === 'firework_shell') { const trailLen = 20; const trailGrad = ctx.createLinearGradient(0,0,0, trailLen); trailGrad.addColorStop(0, '#ffffff'); trailGrad.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = trailGrad; ctx.fillRect(-1, 0, 2, trailLen); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0, 2, 0, Math.PI*2); ctx.fill(); } 
            else { const angle = Math.atan2(b.vy, b.vx) - Math.PI/2; ctx.rotate(angle); const trailLen = 30 + Math.random() * 10; const trailWidth = b.width; const trailGrad = ctx.createLinearGradient(0, 0, 0, -trailLen); trailGrad.addColorStop(0, 'rgba(200, 200, 200, 0.8)'); trailGrad.addColorStop(0.5, 'rgba(150, 150, 150, 0.4)'); trailGrad.addColorStop(1, 'rgba(100, 100, 100, 0)'); ctx.fillStyle = trailGrad; ctx.beginPath(); ctx.moveTo(-trailWidth/2, 0); ctx.lineTo(trailWidth/2, 0); ctx.lineTo(0, -trailLen); ctx.fill(); const headGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, b.width/2); headGrad.addColorStop(0, '#e2e8f0'); headGrad.addColorStop(1, '#78350f'); ctx.fillStyle = headGrad; ctx.beginPath(); ctx.arc(0, 0, b.width/2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-b.width/4, -b.width/4, b.width/6, 0, Math.PI*2); ctx.fill(); } ctx.restore(); 
        });
        
        s.particles.forEach(p => { ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.translate(p.x, p.y); ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
        if (targetRef.current) { ctx.save(); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; const tSize = 15; const tx = targetRef.current.x; const ty = targetRef.current.y; const rot = s.frame * 0.1; ctx.translate(tx, ty); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(-tSize, -tSize/2); ctx.lineTo(-tSize, -tSize); ctx.lineTo(-tSize/2, -tSize); ctx.moveTo(tSize, -tSize/2); ctx.lineTo(tSize, -tSize); ctx.lineTo(tSize/2, -tSize); ctx.moveTo(-tSize, tSize/2); ctx.lineTo(-tSize, tSize); ctx.lineTo(-tSize/2, tSize); ctx.moveTo(tSize, tSize/2); ctx.lineTo(tSize, tSize); ctx.lineTo(tSize/2, tSize); ctx.stroke(); ctx.fillStyle = `rgba(16, 185, 129, ${0.5 + Math.sin(s.frame * 0.2) * 0.3})`; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
        ctx.restore();

        if (s.frame % 10 === 0) { 
            let totalMagAmmo = 0; let reloading = false; Object.values(s.gunStates).forEach((g: any) => { totalMagAmmo += g.mag; if (g.reloadTimer > 0) reloading = true; });
            setHud(prev => ({ ...prev, hp: s.hp, sh1: s.sh1, fuel: s.fuel, water: s.water, energy: s.energy, score: s.score, missiles: s.missiles, mines: s.mines, redMines: s.redMines, timer: s.time, boss: s.enemies.find(e => e.type === 'boss'), ammoCount: totalMagAmmo, isReloading: reloading, overload: s.capacitor, overdrive: s.overdrive, rescueMode: s.rescueMode, capacitorLocked: s.capacitorLocked })); 
        }
        raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
        cancelAnimationFrame(raf);
        // FORCE STOP BATTLE SOUNDS ON UNMOUNT (ABORT/LEAVE)
        audioService.stopBattleSounds();
    };
  }, []);

  const takeDamage = (amt: number, type: string = 'generic') => {
      const s = state.current;
      if (s.rescueMode) return;
      s.shakeX = 15; s.shakeY = 15;
      let activeShieldColor = ''; if (s.sh1 > 0 && shield) activeShieldColor = shield.color; else if (s.sh2 > 0 && secondShield) activeShieldColor = secondShield.color;
      let finalDmg = 0;
      if (s.sh1 > 0 || s.sh2 > 0) {
          finalDmg = calculateDamage(amt, type, 'shield', activeShieldColor);
          if (s.sh1 > 0) { s.sh1 = Math.max(0, s.sh1 - finalDmg); } else { s.sh2 = Math.max(0, s.sh2 - finalDmg); }
      } else {
          finalDmg = calculateDamage(amt, type, 'hull'); s.hp = Math.max(0, s.hp - finalDmg);
          if (s.hp <= 0) {
              const s = state.current; s.hp = 0; s.rescueMode = true; s.asteroids = []; s.bullets = [];
              audioService.updateReactorHum(false, 0); // Stop reactor
              createExplosion(s.px, s.py, '#ef4444', 50, 'boss'); 
              audioService.playExplosion(0, 2.0, 'player'); // Specific Player Death Sound
              setHud(h => ({...h, alert: "CRITICAL FAILURE - CAPSULE EJECTED", alertType: 'alert'}));
          }
      }
  };
  
  // ... (drawShip and render logic identical to previous, keeping component intact) ...
  const drawShip = (ctx: CanvasRenderingContext2D, shipData: any, isPlayer = false, movement?: { up: boolean, down: boolean, left: boolean, right: boolean }, usingWater = false, isRescue = false) => { 
    const { config, color, wingColor, cockpitColor, gunColor, secondaryGunColor, gunBodyColor, engineColor, nozzleColor, fitting, equippedWeapons } = shipData; 
    const scale = isPlayer ? 0.6 : 0.5; 
    ctx.save(); 
    ctx.scale(scale, scale); 
    ctx.translate(-50, -50); 
    
    // --- CAPSULE MODE ---
    if (isRescue) {
        ctx.save();
        ctx.translate(50, 50);
        
        // Hull (Egg Shape)
        ctx.fillStyle = '#e2e8f0'; // Light Grey/White
        ctx.beginPath();
        ctx.ellipse(0, 5, 20, 28, 0, 0, Math.PI * 2); 
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cockpit Glass (Large)
        ctx.fillStyle = cockpitColor || '#0ea5e9';
        ctx.beginPath();
        ctx.ellipse(0, -2, 12, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Glint
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(-4, -6, 3, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Small Engine at bottom
        ctx.fillStyle = engineColor || '#334155';
        ctx.fillRect(-6, 28, 12, 6);
        
        // Tiny Jet
        if (movement?.up) {
             ctx.fillStyle = '#f97316';
             ctx.beginPath();
             ctx.moveTo(-4, 34);
             ctx.lineTo(0, 48); // Longer flame when thrusting
             ctx.lineTo(4, 34);
             ctx.fill();
        } else {
             // Idle flame
             ctx.fillStyle = '#f97316';
             ctx.globalAlpha = 0.6;
             ctx.beginPath();
             ctx.moveTo(-3, 34);
             ctx.lineTo(0, 40);
             ctx.lineTo(3, 34);
             ctx.fill();
        }

        ctx.restore();
        ctx.restore();
        return;
    }

    const { wingStyle, hullShapeType } = config; 
    const engineLocs = getEngineCoordinates(config); 
    
    if (isPlayer && movement && movement.down && !isRescue) {
        const mounts = getWingMounts(config); 
        drawRetro(ctx, mounts[0].x, mounts[0].y, -45, usingWater);
        drawRetro(ctx, mounts[1].x, mounts[1].y, 45, usingWater);
    }

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
                if (movement.up) {
                    const thrustLen = 40 + Math.random() * 15;
                    const grad = ctx.createLinearGradient(x, nozzleEnd, x, nozzleEnd + thrustLen);
                    if (usingWater) { grad.addColorStop(0, '#e0f2fe'); grad.addColorStop(0.3, '#3b82f6'); grad.addColorStop(1, 'rgba(59, 130, 246, 0)'); } 
                    else { grad.addColorStop(0, '#ffedd5'); grad.addColorStop(0.3, '#f97316'); grad.addColorStop(1, 'rgba(249, 115, 22, 0)'); }
                    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(drawX + inset, nozzleEnd); ctx.lineTo(drawX + ew - inset, nozzleEnd); ctx.lineTo(x, nozzleEnd + thrustLen); ctx.fill();
                } else if (!movement.down) {
                    const idleLen = 12 + Math.random() * 3;
                    const idleColor = config.isAlien ? '#a855f7' : (usingWater ? '#93c5fd' : '#60a5fa');
                    ctx.fillStyle = idleColor; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(drawX + inset + 1, nozzleEnd); ctx.lineTo(drawX + ew - inset - 1, nozzleEnd); ctx.lineTo(x, nozzleEnd + idleLen); ctx.fill(); ctx.globalAlpha = 1.0;
                }
                const strafeLen = 12 + Math.random() * 6;
                ctx.fillStyle = usingWater ? '#93c5fd' : '#fbbf24';
                if (movement.left) { ctx.beginPath(); ctx.moveTo(drawX + ew, y + eh/2 - 3); ctx.lineTo(drawX + ew + strafeLen, y + eh/2); ctx.lineTo(drawX + ew, y + eh/2 + 3); ctx.fill(); }
                if (movement.right) { ctx.beginPath(); ctx.moveTo(drawX, y + eh/2 - 3); ctx.lineTo(drawX - strafeLen, y + eh/2); ctx.lineTo(drawX, y + eh/2 + 3); ctx.fill(); }
            } else if (!isPlayer) {
               const idleLen = 10 + Math.random() * 2;
               ctx.fillStyle = config.isAlien ? '#a855f7' : '#60a5fa';
               ctx.globalAlpha = 0.6;
               ctx.beginPath(); ctx.moveTo(drawX + inset + 1, y + eh + nozzleH); ctx.lineTo(drawX + ew - inset - 1, y + eh + nozzleH); ctx.lineTo(x, y + eh + nozzleH + idleLen); ctx.fill(); ctx.globalAlpha = 1.0;
            }
        };
        engineLocs.forEach(eng => drawEngine(eng.x, eng.y, eng.w, eng.h));
    } else {
        const cy = (config.isAlien && wingStyle === 'alien-a') ? 65 : (config.isAlien ? 45 : 38);
        ctx.save();
        ctx.beginPath(); ctx.arc(50, cy, 33, 0, Math.PI*2); ctx.strokeStyle='#3b82f6'; ctx.lineWidth = 3; ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 20; ctx.setLineDash([8, 6]); ctx.stroke();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; ctx.fill(); ctx.restore();
        const isThrusting = isPlayer && movement && (movement.up || movement.down || movement.left || movement.right);
        const jetLen = isThrusting ? 55 + Math.random()*10 : 35 + Math.random()*5; 
        ctx.save(); ctx.translate(50, cy + 28); ctx.fillStyle = '#f97316'; ctx.shadowColor = '#f97316'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, jetLen); ctx.lineTo(6, 0); ctx.fill(); ctx.restore();
    }
    
    const finalCockpitColor = cockpitColor || '#0ea5e9'; 
    ctx.fillStyle = finalCockpitColor; ctx.beginPath();
    if (config.isAlien) { const cy = wingStyle === 'alien-a' ? 65 : 45; ctx.ellipse(50, cy, 8, 20, 0, 0, Math.PI * 2); } 
    else if (wingStyle === 'x-wing') { ctx.ellipse(50, 55, 8, 12, 0, 0, Math.PI * 2); } 
    else { ctx.ellipse(50, 40, 8, 12, 0, 0, Math.PI * 2); }
    ctx.fill();
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

  const drawRetro = (ctx: CanvasRenderingContext2D, x: number, y: number, angleDeg: number, usingWater: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      const rad = (angleDeg * Math.PI) / 180;
      ctx.rotate(rad);
      const flicker = 0.8 + Math.random() * 0.4;
      const len = 30 * flicker; 
      const w = 6; 
      ctx.beginPath(); ctx.moveTo(-w/2, 0); ctx.lineTo(0, -len); ctx.lineTo(w/2, 0); ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, -len);
      if (usingWater) { grad.addColorStop(0, '#e0f2fe'); grad.addColorStop(0.4, '#3b82f6'); grad.addColorStop(1, 'rgba(59, 130, 246, 0)'); } 
      else { grad.addColorStop(0, '#fff'); grad.addColorStop(0.2, '#fbbf24'); grad.addColorStop(1, 'rgba(251, 191, 36, 0)'); }
      ctx.fillStyle = grad; ctx.globalAlpha = 0.9; ctx.fill();
      ctx.restore();
  };

  return (
    <div 
        className="relative w-full h-full bg-black overflow-hidden cursor-crosshair touch-none select-none"
        onPointerDown={handlePointerDown}
        onClick={() => { if (state.current.paused) togglePause(false); }}
    >
        <canvas ref={canvasRef} className="block w-full h-full" />
        
        {/* HUD LAYOUT */}
        <div className="absolute inset-0 pointer-events-none p-2 sm:p-4 flex flex-col justify-between z-10">
            {/* PAUSE OVERLAY */}
            {hud.isPaused && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                    <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-widest drop-shadow-lg mb-4 animate-pulse">GAME PAUSED</h2>
                    <p className="text-sm md:text-xl text-emerald-400 font-mono uppercase tracking-[0.2em] bg-black/80 px-4 py-2 rounded border border-emerald-500/50">Press P to Resume</p>
                </div>
            )}

            {/* TOP BAR */}
            <div className="flex justify-between items-start pointer-events-auto relative z-[60]">
                <div className="flex flex-col gap-1 w-32 sm:w-48">
                    <div className="flex flex-col gap-1">
                        {/* HP BAR (HORIZONTAL) */}
                        <LEDMeter value={hud.hp} max={100} colorStart="#10b981" label="H" vertical={false} />
                        {/* SHIELD BARS (HORIZONTAL) */}
                        {hud.sh1 > 0 && <LEDMeter value={hud.sh1} max={shield?.capacity || 100} colorStart={shield?.color || '#3b82f6'} label="S" vertical={false} />}
                        {hud.sh2 > 0 && <LEDMeter value={hud.sh2} max={secondShield?.capacity || 100} colorStart={secondShield?.color || '#a855f7'} label="S" vertical={false} />}
                    </div>
                </div>

                {!hud.boss && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 flex flex-col items-center bg-black/60 px-6 py-2 rounded-b-xl border-x border-b border-zinc-800/50 backdrop-blur-sm pointer-events-none">
                        <div className={`${hudTimer} font-mono font-black text-red-500 tabular-nums tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] leading-none`}>
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
                            e.stopPropagation();
                            e.currentTarget.blur();
                            togglePause();
                        }} className="flex-1 py-2 sm:px-4 bg-zinc-800 border border-zinc-600 text-white text-[10px] font-bold hover:bg-zinc-700 hover:border-white transition-colors uppercase">
                            {hud.isPaused ? "RESUME" : "PAUSE"}
                        </button>
                        <button onClick={(e) => {
                            e.stopPropagation();
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

            {/* LEFT HUD: CAPACITOR (C) & ENERGY (E) */}
            <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex flex-row gap-[6px] pointer-events-none bg-zinc-950 p-2 border border-zinc-800 rounded">
                {!hud.rescueMode && <LEDMeter value={hud.overload} max={100} colorStart={hud.capacitorLocked ? '#52525b' : '#10b981'} label={hud.capacitorLocked ? "LCK" : "C"} vertical={true} reverseColor={true} />}
                <LEDMeter value={hud.energy} max={maxEnergy} colorStart="#22d3ee" label="E" vertical={true} />
            </div>

            {/* RIGHT HUD: FUEL & WATER - F & W */}
            <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex flex-row gap-[6px] pointer-events-none bg-zinc-950 p-2 border border-zinc-800 rounded">
                <LEDMeter value={hud.fuel} max={maxFuel} colorStart="#f97316" label="F" vertical={true} />
                <LEDMeter value={hud.water} max={maxWater} colorStart="#3b82f6" label="W" vertical={true} />
            </div>

            {/* BOTTOM BAR - Mobile Optimization: Allow wrap if needed, shrink padding/gap */}
            <div className="absolute bottom-2 sm:bottom-4 left-0 right-0 flex justify-center items-end pointer-events-auto">
                <div className="flex justify-between items-end w-full px-2 sm:px-4 gap-2">
                    
                    {/* LEFT CORNER: MAIN GUN & AMMO */}
                    <div className="flex items-end gap-2 shrink-0">
                        {hasGuns && !hud.rescueMode && (
                            <HudButton 
                                label={hud.capacitorLocked ? "LOCK" : "MAIN"} 
                                subLabel={hud.overdrive ? "OVERDRIVE" : (hud.capacitorLocked ? "RECHARGE" : "AUTO")} 
                                onDown={() => { if(!hud.capacitorLocked) inputRef.current.main = true; }}
                                onUp={() => { inputRef.current.main = false; }}
                                colorClass={hud.capacitorLocked ? 'text-zinc-500' : (hud.overdrive ? 'text-red-500 animate-pulse' : 'text-emerald-400')}
                                borderClass={hud.capacitorLocked ? 'border-zinc-700 bg-zinc-950' : (hud.overdrive ? 'border-red-500' : 'border-emerald-600')}
                                active={inputRef.current.main}
                            />
                        )}
                        
                        {hasAmmoWeapons && !hud.rescueMode && (
                             <HudButton 
                                label="AMMO" 
                                subLabel={hud.isReloading ? "RELOAD" : "AUTO"}
                                onDown={() => { inputRef.current.secondary = true; }}
                                onUp={() => { inputRef.current.secondary = false; }}
                                colorClass={hud.isReloading ? 'text-amber-500 animate-pulse' : 'text-blue-400'}
                                borderClass={hud.isReloading ? 'border-amber-600' : 'border-blue-600'}
                                active={inputRef.current.secondary}
                                count={hud.ammoCount}
                                maxCount={maxAmmoInMags > 0 ? maxAmmoInMags : 1}
                            />
                        )}
                    </div>

                    {/* CENTER: ALERT MESSAGE */}
                    <div className="flex-1 flex justify-center pb-2 w-full sm:w-auto">
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

                            {hud.redMines > 0 && (
                                <HudButton 
                                    label="OMEGA" 
                                    subLabel={`x${hud.redMines}`}
                                    onClick={fireRedMine}
                                    colorClass="text-red-500 animate-pulse"
                                    borderClass="border-red-900 hover:border-red-500"
                                    count={hud.redMines}
                                    maxCount={5}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default GameEngine;
