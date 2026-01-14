
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, EquippedWeapon, Planet, QuadrantType, WeaponType, CargoItem, PlanetStatusData } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, EXOTIC_SHIELDS, BOSS_SHIPS, BOSS_EXOTIC_SHIELDS, AMMO_CONFIG } from '../constants.ts';
import { StarField } from './StarField.tsx';
import { getEngineCoordinates, getWingMounts } from '../utils/drawingUtils.ts';

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
  equippedWeapons: (EquippedWeapon | null)[] = [null, null, null]; // [Main, Left, Right]
  vibration: number = 0;

  constructor(x: number, y: number, type: 'scout' | 'fighter' | 'heavy' | 'boss', config: ExtendedShipConfig, diff: number, quadrant: QuadrantType) {
    const hpMult = type === 'boss' ? 5000 : (type === 'heavy' ? 400 : 150);
    this.x = x; this.y = y; this.z = type === 'boss' ? 0 : (Math.random() - 0.5) * 600;
    this.hp = hpMult * (1 + diff * 0.3); this.maxHp = this.hp;
    this.type = type; 
    
    // Copy config to avoid mutating reference
    this.config = { ...config };

    if (type === 'boss') {
        // Boss: Force isAlien to true to enable the "personal small shield" visual in ShipIcon if desired,
        // though our new BOSS_SHIPS have isAlien: true by default.
        this.config.isAlien = true;

        // Select ONE random exotic weapon for boss to ensure consistency (No mixing types)
        const selectedExotic = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)];

        // Main + 2 Wings all use the SAME Exotic weapon
        this.equippedWeapons[0] = { id: selectedExotic.id, count: 1 };
        this.equippedWeapons[1] = { id: selectedExotic.id, count: 1 };
        this.equippedWeapons[2] = { id: selectedExotic.id, count: 1 };

        // BOSS SHIELDS: 2 Layers of Strongest Shields + Native Regen
        // Layer 1: High Capacity Exotic
        const shield1 = EXOTIC_SHIELDS[0];
        this.shieldLayers.push({ 
            color: shield1.color, 
            max: shield1.capacity * (1 + diff * 0.1), 
            current: shield1.capacity * (1 + diff * 0.1), 
            rotation: 0 
        });
        
        // Layer 2: Another Strong Exotic
        const shield2 = EXOTIC_SHIELDS[1];
        this.shieldLayers.push({ 
            color: shield2.color, 
            max: shield2.capacity * (1 + diff * 0.1), 
            current: shield2.capacity * (1 + diff * 0.1), 
            rotation: Math.PI / 2 
        });

        this.shieldRegen = 2.0 + (diff * 0.2);
    } else {
        this.equippedWeapons = [null, null, null];

        // Standard Aliens (Spawned via difficulty)
        if (this.config.isAlien) {
            // Use the config's native weapon and slot setup
            // 1 Slot = Spread (Center), 2 Slots = Focused (Wings)
            const wId = this.config.weaponId || 'exotic_plasma_jet';
            const slots = this.config.defaultGuns; // 1 or 2
            
            if (slots === 1) {
                 this.equippedWeapons[0] = { id: wId, count: 1 };
            } else {
                 this.equippedWeapons[1] = { id: wId, count: 1 };
                 this.equippedWeapons[2] = { id: wId, count: 1 };
            }
        } else {
            // Standard Human Ships behaving as Aliens (Quadrant-specific loadouts)
            const standardEnergy = 'gun_pulse';
            const standardProjectile = 'gun_bolt';

            switch (quadrant) {
                case QuadrantType.ALFA:
                    // Alfa: One standard energy weapon in the nose
                    this.equippedWeapons[0] = { id: standardEnergy, count: 1 };
                    break;

                case QuadrantType.BETA:
                    // Beta: Some use two standard energy on wings
                    if (Math.random() > 0.3) {
                        this.equippedWeapons[1] = { id: standardEnergy, count: 1 };
                        this.equippedWeapons[2] = { id: standardEnergy, count: 1 };
                    } else {
                        this.equippedWeapons[0] = { id: standardEnergy, count: 1 };
                    }
                    break;

                case QuadrantType.GAMA:
                    // Gamma: Mixed projectile/energy on wings
                    const roll = Math.random();
                    if (roll < 0.33) {
                        const slot = Math.random() > 0.5 ? 1 : 2;
                        this.equippedWeapons[slot] = { id: standardProjectile, count: 1 };
                    } else if (roll < 0.66) {
                        this.equippedWeapons[1] = { id: standardEnergy, count: 1 };
                        this.equippedWeapons[2] = { id: standardProjectile, count: 1 };
                    } else {
                        this.equippedWeapons[1] = { id: standardProjectile, count: 1 };
                        this.equippedWeapons[2] = { id: standardProjectile, count: 1 };
                    }
                    break;

                case QuadrantType.DELTA:
                    // Delta: Two or three weapons
                    if (Math.random() > 0.5) {
                        this.equippedWeapons[1] = { id: standardEnergy, count: 1 };
                        this.equippedWeapons[2] = { id: standardEnergy, count: 1 };
                    } else {
                        this.equippedWeapons[0] = { id: standardProjectile, count: 1 };
                        this.equippedWeapons[1] = { id: standardEnergy, count: 1 };
                        this.equippedWeapons[2] = { id: standardEnergy, count: 1 };
                    }
                    break;
                    
                default:
                    this.equippedWeapons[0] = { id: standardEnergy, count: 1 };
                    break;
            }
        }

        // PROGRESSIVE SHIELD LOGIC
        // Level 1: No Shields
        // Level 2-3: 1 Shield Layer
        // Level 4+: 2 Shield Layers
        
        let shieldCount = 0;
        if (diff >= 4) shieldCount = 2;
        else if (diff >= 2) shieldCount = 1;

        if (shieldCount > 0) {
            const baseShieldCap = 150 * diff;
            
            // Layer 1
            const c1 = quadrant === QuadrantType.ALFA ? '#3b82f6' : (quadrant === QuadrantType.BETA ? '#f97316' : '#ef4444');
            this.shieldLayers.push({ color: c1, max: baseShieldCap, current: baseShieldCap, rotation: Math.random() * Math.PI });

            // Layer 2 (Stronger)
            if (shieldCount > 1) {
                const c2 = quadrant === QuadrantType.DELTA ? '#ffffff' : '#a855f7';
                this.shieldLayers.push({ color: c2, max: baseShieldCap * 1.5, current: baseShieldCap * 1.5, rotation: Math.random() * Math.PI });
            }
        }
    }
  }

  update(px: number, py: number, w: number, h: number, incomingFire: Projectile[]) {
    // Decay vibration
    if (this.vibration > 0) this.vibration = Math.max(0, this.vibration - 1);

    if (this.type === 'boss') {
        if (this.shieldLayers.length > 0 && this.shieldRegen > 0) {
            // Regenerate the innermost (active) layer
            const top = this.shieldLayers[0];
            if (top.current < top.max) top.current = Math.min(top.max, top.current + this.shieldRegen);
        }
        this.vx = (this.vx + (px - this.x) * 0.002) * 0.96;
        this.vy = (this.vy + (150 - this.y) * 0.01) * 0.92;
    } else {
        this.y += 3.5; 
        this.vx = (this.vx + (Math.random() - 0.5) * 0.5) * 0.95; 
        const dx = px - this.x;
        
        if (this.y > h * 0.5 && Math.abs(this.z) < 50) {
            if (Math.abs(dx) < 100 && this.y < py) this.vx -= Math.sign(dx) * 0.8;
            incomingFire.forEach(b => {
                if (!b.isEnemy && Math.abs(b.y - this.y) < 150 && Math.abs(b.x - this.x) < 50) {
                    this.vx += (this.x < b.x ? -1 : 1) * 0.5; 
                }
            });
        }
    }
    this.x += this.vx; this.y += this.vy;
    
    this.shieldLayers.forEach((l, i) => {
        l.rotation += 0.05 * (i % 2 === 0 ? 1 : -1);
    });
  }

  takeDamage(amount: number, type: string, isMain: boolean, isOvercharge: boolean = false) {
      // OMEGA MINE LOGIC (RED MINE)
      if (type === 'mine_red') {
          if (this.type === 'boss') {
              // Boss: Reduce HP 50% and Eliminate Shield
              this.shieldLayers = []; // Eliminate shields
              const dmg = this.maxHp * 0.5;
              this.hp -= dmg;
              this.vibration = 30;
              audioService.playExplosion(0, 2.0); // Heavy impact sound
          } else {
              // Non-Boss: Instant Kill
              this.hp = -9999;
              this.vibration = 50;
          }
          return;
      }

      if (this.shieldLayers.length > 0) {
          let shieldDmg = amount;
          
          if (type.includes('missile') || type.includes('mine')) {
              const isEmp = type.includes('emp');
              // 1 EMP = 100% Shield (Instant disable), 2 Normal = 100% Shield (50% each)
              const percentage = isEmp ? 1.0 : 0.5;
              shieldDmg = this.shieldLayers[0].max * percentage;
              
              // Force vibration on heavy impact
              this.vibration = isEmp ? 15 : 10;
          }
          else if (isMain) {
              if (isOvercharge) {
                  // EMP Effect: Massive damage to shields
                  shieldDmg *= 5.0; 
                  this.vibration = 15;
              } else {
                  shieldDmg *= 2.0; 
              }
          }
          else if (type === 'laser' || type === 'trident') shieldDmg *= 1.5;
          else if (type === 'projectile' || type === 'scatter' || type === 'flame') shieldDmg *= 0.3;
          
          if (amount > 50) this.vibration = Math.max(this.vibration, 5);

          const layer = this.shieldLayers[0];
          layer.current -= shieldDmg;
          if (layer.current <= 0) {
              this.shieldLayers.shift(); 
              audioService.playShieldHit(); 
          } else {
              audioService.playShieldHit();
          }
      } else {
          // HULL DAMAGE LOGIC
          if (type.includes('missile') || type.includes('mine')) {
              const isEmp = type.includes('emp');
              // 1 Normal = 50% Hull, 1 EMP = 35% Hull
              const percentage = isEmp ? 0.35 : 0.5;
              this.hp -= this.maxHp * percentage;
              this.vibration = 20;
          } else {
              let dmg = amount;
              if (type === 'projectile' || type === 'scatter') dmg *= 2.0;
              else if (type === 'flame') dmg *= 1.2; 
              this.hp -= dmg;
          }
      }
  }
}

class Asteroid {
  x: number; y: number; z: number; hp: number; vx: number; vy: number; vz: number; size: number; color: string; 
  loot: { type: string, id?: string, name?: string } | null = null;
  vertices: {x:number, y:number, z:number}[]; faces: {indices: number[], color: string}[];
  ax: number = 0; ay: number = 0; az: number = 0; vax: number; vay: number; vaz: number;
  constructor(w: number, diff: number, isRich: boolean) {
    this.x = Math.random() * w; this.y = -200; this.z = (Math.random() - 0.5) * 600;
    this.vy = 2 + Math.random() * 2; 
    this.vx = (Math.random() - 0.5) * 8; 
    this.vz = (Math.random() - 0.5);
    this.size = 12 + Math.random() * 25; 
    this.hp = (this.size * 30) + (this.size * this.size);
    this.vax = Math.random() * 0.05; this.vay = Math.random() * 0.05; this.vaz = Math.random() * 0.05;
    const r = Math.random();
    if (isRich && r > 0.6) { this.color = '#fbbf24'; this.loot = { type: 'gold', name: 'Gold' }; }
    else if (r > 0.8) { this.color = '#ef4444'; this.loot = { type: 'missile' }; }
    else if (r > 0.9) { this.color = '#3b82f6'; this.loot = { type: 'ammo', id: 'iron', name: 'Bullets' }; } 
    else { this.color = '#78716c'; this.loot = null; }
    const t = (1 + Math.sqrt(5)) / 2;
    const verts = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];
    this.vertices = verts.map(v => ({ x: v[0]*this.size, y: v[1]*this.size, z: v[2]*this.size }));
    this.faces = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]].map(i => ({ indices: i, color: this.color }));
  }
}

interface Projectile { 
    x: number; y: number; vx: number; vy: number; damage: number; color: string; type: string; life: number; 
    isEnemy: boolean; width: number; height: number; glow?: boolean; glowIntensity?: number; isMain?: boolean; 
    weaponId?: string; isTracer?: boolean; traceColor?: string; isOvercharge?: boolean;
    // Smart Ordnance Props
    target?: Enemy | null;
    homingState?: 'searching' | 'tracking' | 'returning' | 'engaging' | 'launching';
    z?: number; // Visual Z-level
    headColor?: string;
    finsColor?: string;
    turnRate?: number;
    maxSpeed?: number;
    launchTime?: number;
    accel?: number;
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }
interface Loot { x: number; y: number; z: number; type: string; id?: string; name?: string; isPulled: boolean; isBeingPulled?: boolean; }

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

// Helper for alien colors
const getAlienColors = (q: QuadrantType) => {
    switch(q) {
        case QuadrantType.ALFA: return { hull: '#f97316', wing: '#fdba74' }; // Orange, Light Orange
        case QuadrantType.BETA: return { hull: '#7f1d1d', wing: '#fca5a5' }; // Dark Red, Light Red
        case QuadrantType.GAMA: return { hull: '#1e3a8a', wing: '#93c5fd' }; // Dark Blue, Light Blue
        case QuadrantType.DELTA: return { hull: '#334155', wing: '#cbd5e1' }; // Dark Gray, Silver
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
  
  // UI & State
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
    active: true, paused: false, meltdown: false, victoryTimer: 0,
    chargeLevel: 0, isCharging: false, hasFiredOverload: false, lastRapidFire: 0,
    swivelMode: false, swivelAngle: 0,
    // Ammo & Reload
    ammo: { ...activeShip.fitting.ammo }, // This is CARGO ammo
    magazineCurrent: activeShip.fitting.magazineCurrent !== undefined ? activeShip.fitting.magazineCurrent : 200, // Gun ammo
    reloadTimer: activeShip.fitting.reloadTimer || 0,
    selectedAmmo: activeShip.fitting.selectedAmmo,
    weaponFireTimes: {} as {[key: number]: number}, // Slot index -> Timestamp
    weaponHeat: {} as {[key: number]: number}, // Slot index -> 0-100 Heat
    lastMissileFire: 0,
    lastMineFire: 0,
    lastRedMineFire: 0,
    mineSide: false, // Track side for mines: false=Right, true=Left
    omegaSide: false // Track side for Omega mines
  });

  // Helper to check if ship has ammo weapons
  const hasAmmoWeapons = activeShip.fitting.weapons.some(w => {
      if (!w) return false;
      const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(wd => wd.id === w.id);
      return def?.isAmmoBased;
  });

  // init state from props
  useEffect(() => {
      const s = state.current;
      s.hp = activeShip.fitting.health;
      s.fuel = activeShip.fitting.fuel;
      s.sh1 = shield?.capacity || 0;
      s.sh2 = secondShield?.capacity || 0;
      s.missiles = activeShip.fitting.rocketCount;
      s.mines = activeShip.fitting.mineCount;
      s.redMines = activeShip.fitting.redMineCount || 0;
      s.stars = Array.from({length: 150}, () => ({x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, s: Math.random()*2}));
      // Init heat
      [0, 1, 2].forEach(i => s.weaponHeat[i] = 0);
      return () => { audioService.stopCharging(); };
  }, []);

  // [Existing handleTabReload remains unchanged]
  const handleTabReload = () => {
      const s = state.current;
      // Smart Reload: Check levels
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
          if (lvl.pct >= 1.0) continue; // Already full

          if (lvl.type === 'mag') {
              // Reload from Cargo Ammo
              if (s.ammo[s.selectedAmmo] > 0) {
                  const needed = 1000 - s.magazineCurrent;
                  const take = Math.min(needed, s.ammo[s.selectedAmmo]);
                  s.magazineCurrent += take;
                  s.ammo[s.selectedAmmo] -= take;
                  s.reloadTimer = 0; // Bypass timer
                  setHud(h => ({...h, isReloading: false, alert: 'INSTANT RELOAD'}));
                  audioService.playSfx('buy');
                  return; 
              } else {
                  // Try unpack from cargo immediately if TAB used
                  const ammoIdx = s.cargo.findIndex(c => c.type === 'ammo' && c.id === s.selectedAmmo);
                  if (ammoIdx >= 0) {
                      s.cargo[ammoIdx].quantity--;
                      if (s.cargo[ammoIdx].quantity <= 0) s.cargo.splice(ammoIdx, 1);
                      s.ammo[s.selectedAmmo] += 1000;
                      // Now reload
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
      // If nothing happened
      audioService.playSfx('denied');
  };

  // Controls
  useEffect(() => {
    const k = state.current.keys;
    const kd = (e: KeyboardEvent) => { 
        if(e.repeat) return;
        
        if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'NumpadEnter') {
            e.preventDefault();
        }

        k.add(e.code); 
        
        if(e.code === 'KeyP') state.current.paused = !state.current.paused;
        if(e.code === 'Escape') {
            onGameOver(false, state.current.score, true, { 
                health: state.current.hp, 
                fuel: state.current.fuel, 
                rockets: state.current.missiles, 
                mines: state.current.mines, 
                redMineCount: state.current.redMines, // Save red mine count
                cargo: state.current.cargo, 
                ammo: state.current.ammo, 
                magazineCurrent: state.current.magazineCurrent, 
                reloadTimer: state.current.reloadTimer 
            });
        }
        
        if(!state.current.paused && state.current.active) {
            if(e.code === 'KeyM' || e.code === 'NumpadAdd') fireMissile();
            if(e.code === 'KeyN' || e.code === 'NumpadEnter') fireMine();
            if(e.code === 'KeyB') fireRedMine(); // New Red Mine Key
            if (e.code === 'Tab') handleTabReload();
            if (e.code === 'CapsLock') { state.current.swivelMode = !state.current.swivelMode; audioService.playSfx('click'); }
            // NEW MAPPING: Shift is Overcharge (Charge)
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { state.current.isCharging = true; audioService.startCharging(); }
        }
    };
    const ku = (e: KeyboardEvent) => {
        k.delete(e.code);
        // NEW MAPPING: Release Shift to fire overload
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

  const fireOverloadShot = (isMax: boolean = true) => {
      const s = state.current;
      const chargeMult = s.chargeLevel > 20 ? (s.chargeLevel > 90 ? 10 : 2) : 1;
      
      const mainWeapon = activeShip.fitting.weapons[0];
      const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null;
      const baseDamage = mainDef ? mainDef.damage : (activeShip.config.noseGunDamage || 45);
      
      const damage = baseDamage * chargeMult;
      const width = 8; const height = 60;
      const glowIntensity = isMax ? 30 : 10;
      const crystalColor = (mainDef?.beamColor) || (activeShip.gunColor || activeShip.config.noseGunColor || '#60a5fa');
      const color = isMax ? '#ffffff' : crystalColor;
      
      // Calculate precise position (Main gun at local 50, 10 relative to 0-100)
      // Visual scaling in drawShip is 0.6. Offset from center (50,50) is (0,-40).
      // Screen space offset = -40 * 0.6 = -24.
      const spawnY = s.py - 24;

      s.bullets.push({ 
          x: s.px, y: spawnY, vx: 0, vy: -25, 
          damage, color, type: 'laser', life: 60, isEnemy: false, 
          width, height, glow: true, glowIntensity, isMain: true, 
          weaponId: mainWeapon?.id || 'gun_pulse',
          isOvercharge: true // Mark as EMP Overcharge
      });
      
      // Slot 0 fired
      s.weaponFireTimes[0] = Date.now();
      // Heat generation logic for main gun
      // If fully charged (100), set heat to 100.
      s.weaponHeat[0] = Math.max(s.weaponHeat[0] || 0, s.chargeLevel);

      if (isMax) audioService.playWeaponFire('mega', 0, activeShip.config.id);
      else audioService.playWeaponFire('puff', 0, activeShip.config.id);
      s.energy -= 10 * chargeMult;
  };

  const fireRapidShot = () => {
      const s = state.current;
      
      const mainWeapon = activeShip.fitting.weapons[0];
      const mainDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null;
      const baseDamage = mainDef ? mainDef.damage : (activeShip.config.noseGunDamage || 45);
      
      // Calculate delay based on equipped weapon fire rate
      const fireRate = mainDef ? mainDef.fireRate : 4; 
      const delay = 1000 / fireRate; 

      if (Date.now() - s.lastRapidFire > delay) {
          const damage = baseDamage; 
          const crystalColor = (mainDef?.beamColor) || (activeShip.gunColor || activeShip.config.noseGunColor || '#f87171');
          const spawnY = s.py - 24; // Precise alignment

          s.bullets.push({ 
              x: s.px, y: spawnY, vx: 0, vy: -30, 
              damage: damage, color: crystalColor, type: 'laser', life: 50, 
              isEnemy: false, width: 4, height: 25, glow: true, glowIntensity: 5, isMain: true, weaponId: mainWeapon?.id || 'gun_pulse'
          });
          
          // Slot 0 fired
          s.weaponFireTimes[0] = Date.now();
          // Fast heating for rapid fire
          s.weaponHeat[0] = Math.min(100, (s.weaponHeat[0] || 0) + 1.0); // Slow heat accumulation for red hot effect

          audioService.playWeaponFire('cannon', 0, activeShip.config.id);
          s.energy -= (mainDef?.energyCost || 2); 
          s.lastRapidFire = Date.now();
      }
  };

  const fireMissile = () => {
      const s = state.current;
      if (s.missiles > 0) {
          // Alternating Logic: If count is even, use Normal. If odd, use EMP.
          const isEmp = s.missiles % 2 !== 0; 
          
          s.missiles--;
          s.lastMissileFire = Date.now();
          
          // 20% larger: width 8 -> 9.6 (~10), height 20 -> 24
          // Start slow ahead (vy = -2)
          s.bullets.push({ 
              x: s.px, y: s.py, 
              vx: 0, vy: -2, 
              damage: 0, // Damage handled by takeDamage type logic
              color: isEmp ? '#22d3ee' : '#ef4444', 
              type: isEmp ? 'missile_emp' : 'missile', 
              life: 600, 
              isEnemy: false, 
              width: 10, height: 24, // Upscaled
              homingState: 'launching',
              launchTime: s.frame,
              headColor: isEmp ? '#22d3ee' : '#ef4444',
              finsColor: isEmp ? '#0ea5e9' : '#ef4444',
              turnRate: 0.15,
              maxSpeed: 14,
              z: 0 
          });
          audioService.playWeaponFire(isEmp ? 'emp' : 'missile');
      }
  };

  const fireMine = () => {
      const s = state.current;
      if (s.mines > 0) {
          // Launch 2 at once if available
          const launchCount = s.mines >= 2 ? 2 : 1;
          
          // Toggle Side for this volley
          s.mineSide = !s.mineSide;
          
          // 145 degrees from Vertical Up (-90 deg).
          // Left: -90 - 145 = -235 deg (125 deg)
          // Right: -90 + 145 = 55 deg
          const sideAngle = s.mineSide ? -235 : 55;
          const rad = (sideAngle * Math.PI) / 180;
          const speed = 3;

          for(let i=0; i<launchCount; i++) {
              // Get current EMP status based on count before decrement
              const isEmp = s.mines % 2 !== 0;
              s.mines--;
              s.lastMineFire = Date.now();
              
              // Add slight spread if launching 2
              const spread = i === 0 ? 0 : (s.mineSide ? -0.2 : 0.2); // slight angle offset for second mine

              s.bullets.push({ 
                  x: s.px, y: s.py + 20, 
                  vx: Math.cos(rad + spread) * speed, 
                  vy: Math.sin(rad + spread) * speed, 
                  damage: 0, 
                  color: isEmp ? '#22d3ee' : '#fbbf24', 
                  type: isEmp ? 'mine_emp' : 'mine', 
                  life: 1200, 
                  isEnemy: false, 
                  width: 14, height: 14,
                  homingState: 'launching',
                  launchTime: s.frame,
                  turnRate: 0.08,
                  maxSpeed: 10,
                  z: 0
              });
          }
          audioService.playWeaponFire('mine'); // One sound for the volley
      }
  };

  const fireRedMine = () => {
      const s = state.current;
      if (s.redMines > 0) {
          s.redMines--;
          s.lastRedMineFire = Date.now();
          s.omegaSide = !s.omegaSide; // Toggle side
          
          // Use same 145 degree logic but slower speed
          const sideAngle = s.omegaSide ? -235 : 55;
          const rad = (sideAngle * Math.PI) / 180;
          const speed = 1.5;

          // Omega Mine: Powerful, Slow moving, Tracking
          s.bullets.push({ 
              x: s.px, y: s.py + 30, 
              vx: Math.cos(rad) * speed, 
              vy: Math.sin(rad) * speed, 
              damage: 0, // Damage handled by takeDamage type logic
              color: '#ef4444', 
              type: 'mine_red', 
              life: 1500, 
              isEnemy: false, 
              width: 20, height: 20,
              homingState: 'searching',
              turnRate: 0.05,
              maxSpeed: 8,
              z: 0,
              glow: true,
              glowIntensity: 30
          });
          audioService.playWeaponFire('mine');
          setHud(h => ({...h, alert: 'OMEGA MINE DEPLOYED', alertType: 'warning'}));
      }
  };

  const spawnLoot = (x: number, y: number, z: number, type: string, id?: string, name?: string) => {
      state.current.loot.push({ x, y, z, type, id, name, isPulled: false });
  };

  const createExplosion = (x: number, y: number, color: string, count: number) => {
      for(let i=0; i<count; i++) state.current.particles.push({ x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 1.0, color, size: Math.random()*3+1 });
  };

  // Main Loop
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

        // Heat Decay (Slow down decay to allow red-hot buildup over 30s)
        [0, 1, 2].forEach(i => {
            if (s.weaponHeat[i] > 0) {
                // 30 seconds to overheat -> slow decay
                s.weaponHeat[i] = Math.max(0, s.weaponHeat[i] - 0.05); 
            }
        });

        // Reload Logic (10 seconds)
        if (s.reloadTimer > 0) {
            if (Date.now() - s.reloadTimer > 10000) {
                // Check if loose ammo is empty but cargo has packs
                if (s.ammo[s.selectedAmmo] <= 0) {
                    const ammoIdx = s.cargo.findIndex(c => c.type === 'ammo' && c.id === s.selectedAmmo);
                    if (ammoIdx >= 0) {
                        s.cargo[ammoIdx].quantity--;
                        if (s.cargo[ammoIdx].quantity <= 0) s.cargo.splice(ammoIdx, 1);
                        s.ammo[s.selectedAmmo] += 1000;
                    }
                }

                // Reload Complete
                const reloadAmount = 1000; 
                const needed = 1000 - s.magazineCurrent;
                const canTake = Math.min(needed, s.ammo[s.selectedAmmo] || 0);
                
                s.magazineCurrent += canTake;
                s.ammo[s.selectedAmmo] -= canTake;
                s.reloadTimer = 0;
                setHud(h => ({...h, isReloading: false}));
            }
        } else if (s.magazineCurrent <= 0 && ((s.ammo[s.selectedAmmo] || 0) > 0 || s.cargo.some(c => c.type === 'ammo' && c.id === s.selectedAmmo))) {
            // Auto-start reload
            s.reloadTimer = Date.now();
            setHud(h => ({...h, isReloading: true}));
        }

        // Auto-Reload Mines/Missiles Logic (10s after last shot)
        if (s.missiles < 10 && Date.now() - s.lastMissileFire > 10000) {
            const mIdx = s.cargo.findIndex(c => c.type === 'missile');
            if (mIdx >= 0) {
                if (s.frame % 60 === 0) { 
                    s.cargo[mIdx].quantity--;
                    if (s.cargo[mIdx].quantity <= 0) s.cargo.splice(mIdx, 1);
                    s.missiles++;
                    setHud(h => ({...h, alert: 'RELOADING MISSILES'}));
                }
            }
        }
        if (s.mines < 10 && Date.now() - s.lastMineFire > 10000) {
            const mIdx = s.cargo.findIndex(c => c.type === 'mine');
            if (mIdx >= 0) {
                if (s.frame % 60 === 0) {
                    s.cargo[mIdx].quantity--;
                    if (s.cargo[mIdx].quantity <= 0) s.cargo.splice(mIdx, 1);
                    s.mines++;
                    setHud(h => ({...h, alert: 'RELOADING MINES'}));
                }
            }
        }

        // ROBOT AUTO REPAIR LOGIC
        const robotCount = s.cargo.reduce((acc, c) => c.type === 'robot' ? acc + c.quantity : acc, 0);
        if (robotCount > 0 && s.hp < 100) {
            const repairInterval = Math.max(5, Math.floor(120 / robotCount));
            if (s.frame % repairInterval === 0) {
                const repairResources = { iron: 2, copper: 4, chromium: 10, titanium: 16, gold: 20, repair: 25, platinum: 50, lithium: 80 };
                const resIdx = s.cargo.findIndex(c => repairResources[c.type as keyof typeof repairResources]);
                if (resIdx >= 0) {
                    const item = s.cargo[resIdx];
                    const heal = repairResources[item.type as keyof typeof repairResources] || 1;
                    
                    item.quantity--;
                    if (item.quantity <= 0) s.cargo.splice(resIdx, 1);
                    
                    s.hp = Math.min(100, s.hp + heal);
                }
            }
        }

        // Movement & Fuel
        const speed = 9;
        const up = s.keys.has('ArrowUp') || s.keys.has('KeyW') || s.keys.has('Numpad8');
        const down = s.keys.has('ArrowDown') || s.keys.has('KeyS') || s.keys.has('Numpad2');
        const left = s.keys.has('ArrowLeft') || s.keys.has('KeyA') || s.keys.has('Numpad4');
        const right = s.keys.has('ArrowRight') || s.keys.has('KeyD') || s.keys.has('Numpad6');
        if (up) { s.py -= speed; s.fuel = Math.max(0, s.fuel - 0.005); } 
        if (down) s.py += speed;
        if (left) { s.px -= speed; s.fuel = Math.max(0, s.fuel - 0.002); }
        if (right) { s.px += speed; s.fuel = Math.max(0, s.fuel - 0.002); }
        s.px = Math.max(30, Math.min(width-30, s.px));
        // Restrict ship nozzle from hitting the bottom HUD text area (height - 100px)
        s.py = Math.max(50, Math.min(height-100, s.py));

        const isAction = s.keys.has('Space') || s.keys.has('ControlLeft') || s.keys.has('ControlRight') || s.keys.has('ShiftLeft') || s.keys.has('ShiftRight');
        s.energy = Math.min(maxEnergy, s.energy + (isAction ? 1 : 5));

        // NEW MAPPING: Space is Rapid Fire
        if (s.keys.has('Space') && s.energy > 5) {
            // Updated rapid fire logic to use equipped weapon rate
            fireRapidShot(); 
        }

        // NEW MAPPING: Shift is Charge (Overload)
        if (s.isCharging && s.energy > 5) {
            // Target ~2 shots per second continuous charge/fire cycle if held
            // To fire every 0.5s (30 frames), charge must go 0->100 in 30 frames.
            // 100 / 30 = 3.33 per frame.
            s.chargeLevel = Math.min(100, s.chargeLevel + 3.5); 
            
            s.energy -= 0.5;
            // No particles here anymore
            
            if (s.chargeLevel >= 100 && !s.hasFiredOverload) { 
                fireOverloadShot(true); 
                s.hasFiredOverload = true; 
                s.lastFire = Date.now(); 
                audioService.stopCharging(); 
                // Reset immediately to allow rapid charge firing
                s.chargeLevel = 0;
                s.hasFiredOverload = false;
            }
        }

        // Secondary Fire
        if ((s.keys.has('ControlLeft') || s.keys.has('ControlRight'))) {
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
                            
                            // Ammo Check
                            if (wDef.isAmmoBased) {
                                if (s.magazineCurrent <= 0) return; 
                                s.magazineCurrent--;
                            } else if (s.energy < wDef.energyCost) {
                                return; 
                            }

                            // Record fire time
                            s.weaponFireTimes[i+1] = Date.now();
                            // Standard guns heat up slower than energy? No, standard gets red hot after 50 shots.
                            // 50 shots * 2 heat = 100.
                            const heatInc = wDef.isAmmoBased ? 0.5 : 1.0; 
                            s.weaponHeat[i+1] = Math.min(100, (s.weaponHeat[i+1] || 0) + heatInc);

                            const baseAngle = (s.swivelMode && wDef.isAmmoBased) ? Math.sin(s.frame * 0.1) * 13 : 0;
                            const currentAngleDeg = i === 0 ? baseAngle : -baseAngle;
                            const angleRad = (currentAngleDeg * Math.PI) / 180;
                            
                            // Visual Scaling
                            const scale = 0.6;
                            // Mount position from 0-100 coord space
                            const mx = mounts[i].x; 
                            const my = mounts[i].y;
                            // Calculate Muzzle Offset (Approx 15 units up in local space)
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
                                
                                // Smoke & Fire Particles for Projectiles ONLY
                                s.particles.push({ 
                                    x: startX, y: startY, 
                                    vx: (Math.random()-0.5)*2 - Math.sin(angleRad)*5, 
                                    vy: (Math.random()-0.5)*2 + Math.cos(angleRad)*5, 
                                    life: 0.4, color: '#a1a1aa', size: 3 
                                });
                                s.particles.push({ 
                                    x: startX, y: startY, 
                                    vx: (Math.random()-0.5)*4, 
                                    vy: (Math.random()-0.5)*4, 
                                    life: 0.15, color: '#fca5a5', size: 2 
                                });
                            }

                            if (w.id === 'exotic_trident') {
                                for (let k = -1; k <= 1; k++) {
                                    s.bullets.push({ x: startX + (k * 10), y: startY, vx: Math.sin(angleRad) * bulletSpeed, vy: -Math.cos(angleRad) * bulletSpeed, damage, color, type: 'trident', life: 60, isEnemy: false, width: 4, height: 20, weaponId: w.id });
                                }
                            } else if (w.id === 'exotic_scatter') {
                                const spread = (Math.random() - 0.5) * 1.5; 
                                const finalAngle = angleRad + spread;
                                s.bullets.push({ x: startX, y: startY, vx: Math.sin(finalAngle) * bulletSpeed, vy: -Math.cos(finalAngle) * bulletSpeed, damage, color, type: 'scatter', life: 40, isEnemy: false, width: 6, height: 12, weaponId: w.id });
                            } else if (w.id === 'exotic_flamer') {
                                const spread = (Math.random() - 0.5) * 0.5;
                                s.bullets.push({ x: startX, y: startY, vx: Math.sin(angleRad + spread) * (bulletSpeed * 0.5), vy: -Math.cos(angleRad + spread) * (bulletSpeed * 0.5), damage, color, type: 'flame', life: 30, isEnemy: false, width: 10, height: 10, weaponId: w.id });
                            } else if (w.id === 'exotic_electric') {
                                s.bullets.push({ x: startX, y: startY, vx: Math.sin(angleRad) * (bulletSpeed * 1.5), vy: -Math.cos(angleRad) * (bulletSpeed * 1.5), damage, color, type: 'laser', life: 30, isEnemy: false, width: 6, height: 100, weaponId: w.id });
                            } else if (w.id === 'exotic_rainbow_cloud') {
                                const angles = [-45, -27, -9, 9, 27, 45];
                                const colors = ['#facc15', '#ef4444', '#3b82f6', '#3b82f6', '#ef4444', '#facc15']; // Yellow, Red, Blue, Blue, Red, Yellow
                                const damages = [damage*0.5, damage*0.8, damage*1.2, damage*1.2, damage*0.8, damage*0.5]; // Weak sides, strong center
                                
                                angles.forEach((deg, idx) => {
                                    const rad = (deg * Math.PI) / 180;
                                    // Add base angle rotation if swivel
                                    const finalAngle = angleRad + rad;
                                    
                                    s.bullets.push({ 
                                        x: startX, y: startY, 
                                        vx: Math.sin(finalAngle) * bulletSpeed * 0.8, // Slightly slower clouds
                                        vy: -Math.cos(finalAngle) * bulletSpeed * 0.8, 
                                        damage: damages[idx], 
                                        color: colors[idx], 
                                        type: 'flame', // Reusing flame type for cloud look
                                        life: 40, 
                                        isEnemy: false, 
                                        width: 8, height: 8, 
                                        weaponId: w.id 
                                    });
                                });
                            } else {
                                s.bullets.push({ 
                                    x: startX, y: startY, 
                                    vx: Math.sin(angleRad) * bulletSpeed, vy: -Math.cos(angleRad) * bulletSpeed, 
                                    damage, color, 
                                    type: wDef.type === WeaponType.LASER ? 'laser' : 'projectile', 
                                    life: 60, isEnemy: false, width: 4, height: 16, weaponId: w.id,
                                    isTracer, traceColor
                                });
                            }
                            fired = true;
                            if (!wDef.isAmmoBased) s.energy -= wDef.energyCost;
                        }
                    }
                }
            });
            if (fired) { audioService.playWeaponFire('cannon', 0, activeShip.config.id); }
        }

        // Spawning
        if (s.phase === 'travel') {
            if (s.enemies.length < 3 + difficulty/2 && Date.now() - s.lastSpawn > 1500) { 
                
                // --- ENEMY SPAWN POOL LOGIC ---
                // Base: Standard Human Ships
                let spawnPool = SHIPS.filter(s => !s.isAlien);
                
                // Difficulty 4+: Add Alien H (Tanky)
                if (difficulty >= 4) {
                    spawnPool = [...spawnPool, ...SHIPS.filter(s => s.id === 'alien_h')];
                }
                
                // Difficulty 7+: Add Alien W (Assault)
                if (difficulty >= 7) {
                    spawnPool = [...spawnPool, ...SHIPS.filter(s => s.id === 'alien_w')];
                }
                
                // Difficulty 9+: Add Alien A (Fast) and Alien M (Heavy Bomber)
                if (difficulty >= 9) {
                    spawnPool = [...spawnPool, ...SHIPS.filter(s => s.id === 'alien_a' || s.id === 'alien_m')];
                }
                
                // Select a random ship config from the difficulty-adjusted pool
                const selectedShip = spawnPool.length > 0 
                    ? spawnPool[Math.floor(Math.random() * spawnPool.length)]
                    : SHIPS[0]; 

                s.enemies.push(new Enemy(Math.random()*width, -50, 'fighter', selectedShip, difficulty, quadrant)); 
                s.lastSpawn = Date.now(); 
            }
            if (s.asteroids.length < 3 && Math.random() > 0.985) { s.asteroids.push(new Asteroid(width, difficulty, Math.random() > 0.7)); }
            if (s.time <= 0) { 
                s.phase = 'boss'; 
                s.enemies = []; 
                // Select random BOSS ship from updated BOSS_SHIPS
                const bossConfig = BOSS_SHIPS[Math.floor(Math.random() * BOSS_SHIPS.length)];
                s.enemies.push(new Enemy(width/2, -200, 'boss', bossConfig, difficulty, quadrant)); 
                setHud(h => ({...h, alert: "BOSS DETECTED", alertType: 'alert'})); 
            } 
            else if (s.frame % 60 === 0) s.time--;
        } else if (s.phase === 'boss') {
            if (s.bossDead) { s.victoryTimer++; if (s.victoryTimer > 180) { onGameOver(true, s.score, false, { health: s.hp, fuel: s.fuel, rockets: s.missiles, mines: s.mines, redMineCount: s.redMines, cargo: s.cargo, ammo: s.ammo, magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer }); s.active = false; } }
        }

        // Update Entities
        s.asteroids.forEach(a => {
            a.x += a.vx; a.y += a.vy; a.z += a.vz; a.ax += a.vax; a.ay += a.vay; a.az += a.vaz;
            if (Math.abs(a.z) < 50 && Math.hypot(a.x-s.px, a.y-s.py) < a.size + 30) { takeDamage(20, 'collision'); a.hp = 0; createExplosion(a.x, a.y, '#aaa', 5); }
        });
        s.asteroids = s.asteroids.filter(a => a.y < height + 100 && a.hp > 0);

        s.enemies.forEach(e => {
            e.update(s.px, s.py, width, height, s.bullets);
            
            // Firing Logic for Enemy Weapons
            if (Date.now() - e.lastShot > (e.type === 'boss' ? 800 : 1500)) {
                const mounts = getWingMounts(e.config);
                const scale = 0.5; // Scale for enemy ships is 0.5 in drawShip
                
                // Determine active slots based on enemy type
                let slotsToFire = [0, 1, 2];
                if (e.type === 'boss') {
                    // Boss logic: Middle (0) OR Wings (1 & 2), never mixed in a single volley
                    // 50% chance for each mode
                    if (Math.random() < 0.5) slotsToFire = [0];
                    else slotsToFire = [1, 2];
                }

                // Fire all active slots
                slotsToFire.forEach(i => {
                    const w = e.equippedWeapons[i];
                    if (!w) return;
                    const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id);
                    if (!wDef) return;

                    // Calculate spawn position
                    let sx = e.x;
                    let sy = e.y + 20; // Default nose-ish

                    if (i === 0) {
                        // Slot 0 (Nose)
                        sy = e.y + 30; // Roughly nose tip downwards
                    } else {
                        // Slot 1 & 2 (Wings)
                        const m = mounts[i-1];
                        if (m) {
                            const ox = (m.x - 50) * scale;
                            const oy = (m.y - 50) * scale;
                            sx = e.x - ox; 
                            sy = e.y - oy;
                        }
                    }

                    // Bullets travel DOWN (positive VY)
                    let damage = e.type === 'boss' ? 30 : 10;
                    damage = wDef.damage * 0.3;
                    const color = wDef.beamColor || '#ef4444';
                    
                    // Add Muzzle Flash particle for Ammo Weapons
                    if (wDef.isAmmoBased) {
                        s.particles.push({ 
                            x: sx, y: sy, 
                            vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, 
                            life: 0.2, color: '#fca5a5', size: 3 
                        });
                    }

                    if (wDef.id === 'exotic_rainbow_cloud') {
                        // Special handling for enemy rainbow cloud
                        const bulletSpeed = 8;
                        const angles = [-45, -27, -9, 9, 27, 45];
                        const colors = ['#facc15', '#ef4444', '#3b82f6', '#3b82f6', '#ef4444', '#facc15']; 
                        
                        angles.forEach((deg, idx) => {
                            const rad = (deg * Math.PI) / 180;
                            // Angle 0 is straight down (PI/2)
                            const baseAngle = Math.PI / 2;
                            const finalAngle = baseAngle + rad;
                            
                            s.bullets.push({ 
                                x: sx, y: sy, 
                                vx: Math.cos(finalAngle) * bulletSpeed * 0.8, 
                                vy: Math.sin(finalAngle) * bulletSpeed * 0.8, 
                                damage: damage, 
                                color: colors[idx], 
                                type: 'flame', 
                                life: 40, 
                                isEnemy: true, 
                                width: 8, height: 8, 
                                weaponId: wDef.id 
                            });
                        });
                    } else {
                        s.bullets.push({ 
                            x: sx, y: sy, 
                            vx: 0, vy: 8, 
                            damage, color, 
                            type: wDef.type === WeaponType.LASER ? 'laser' : 'projectile', 
                            life: 100, isEnemy: true, width: 6, height: 12, 
                            weaponId: wDef.id 
                        });
                    }
                });
                
                e.lastShot = Date.now();
            }

            if (Math.abs(e.z) < 50 && Math.hypot(e.x-s.px, e.y-s.py) < 60) { takeDamage(30, 'collision'); if(e.type !== 'boss') e.hp = 0; createExplosion(e.x, e.y, '#f00', 10); }
        });
        const deadEnemies = s.enemies.filter(e => e.hp <= 0);
        deadEnemies.forEach(e => {
            createExplosion(e.x, e.y, '#fbbf24', 20);
            if (e.type === 'boss') { 
                s.bossDead = true; 
                s.score += 5000; 
                const exotic = EXOTIC_WEAPONS[Math.floor(Math.random()*EXOTIC_WEAPONS.length)];
                spawnLoot(e.x, e.y, 0, 'weapon', exotic.id, exotic.name); 
            }
            else { 
                s.score += 100; 
                if(Math.random()>0.7) spawnLoot(e.x, e.y, e.z, 'ammo', s.selectedAmmo, 'Ammo'); 
            } 
        });
        s.enemies = s.enemies.filter(e => e.hp > 0 && e.y < height + 200);

        s.bullets.forEach(b => {
            // Intelligent Projectile Logic
            if (b.type === 'missile' || b.type === 'missile_emp') {
                if (b.homingState === 'launching') {
                    // Launch phase visual effects
                    if (s.frame % 2 === 0) {
                        s.particles.push({ 
                            x: b.x, y: b.y + b.height/2, 
                            vx: (Math.random()-0.5), vy: 2 + Math.random()*2, 
                            life: 0.1, color: '#facc15', size: 3 
                        });
                        s.particles.push({ 
                            x: b.x, y: b.y + b.height/2, 
                            vx: (Math.random()-0.5)*0.5, vy: 1, 
                            life: 0.6, color: 'rgba(200,200,200,0.2)', size: 4 
                        });
                    }
                    
                    // Fly straight ahead for 1.5s
                    // Slight initial acceleration to clear ship
                    b.vy -= 0.02; 
                    
                    if ((s.frame - (b.launchTime || 0)) > 90) { // 1.5s (60fps * 1.5)
                        b.homingState = 'searching';
                    }
                } else if (b.homingState === 'searching') {
                    // Find Target
                    let bestT = null; let minD = Infinity;
                    s.enemies.forEach(e => {
                        const dist = Math.hypot(e.x - b.x, e.y - b.y);
                        const angleToEnemy = Math.atan2(e.y - b.y, e.x - b.x);
                        let dAngle = Math.abs(angleToEnemy - (-Math.PI/2));
                        if (dAngle > Math.PI) dAngle = 2*Math.PI - dAngle;
                        if (dAngle < Math.PI/3 && dist < minD && e.hp > 0) { minD = dist; bestT = e; }
                    });
                    
                    if (bestT) { 
                        b.target = bestT; 
                        b.homingState = 'tracking'; 
                    } else {
                        // Keep flying straight if no target
                        b.vy -= 0.1;
                    }
                } else if (b.target && b.homingState === 'tracking') {
                    // Accelerate towards target
                    const t = b.target;
                    if (t.hp <= 0) { b.target = null; b.homingState = 'searching'; }
                    else {
                        const dx = t.x - b.x; const dy = t.y - b.y;
                        const dist = Math.hypot(dx, dy);
                        const speed = b.maxSpeed || 14;
                        const turnRate = b.turnRate || 0.15;
                        
                        const desiredVx = (dx / dist) * speed;
                        const desiredVy = (dy / dist) * speed;
                        
                        b.vx += (desiredVx - b.vx) * turnRate;
                        b.vy += (desiredVy - b.vy) * turnRate;
                        
                        // Accelerate speed itself over time? 
                        // The current logic moves TOWARDS maxSpeed.
                        
                        b.z = (b.z || 0) + (t.z - (b.z || 0)) * 0.1;
                    }
                }
                
                s.asteroids.forEach(a => {
                    const dx = b.x - a.x; const dy = b.y - a.y;
                    const d = Math.hypot(dx, dy);
                    if (d < a.size + 80) {
                        const force = (a.size + 80 - d) / 15;
                        b.vx += (dx/d) * force;
                        b.vy += (dy/d) * force;
                    }
                });
            } 
            else if (b.type === 'mine' || b.type === 'mine_emp' || b.type === 'mine_red') {
                if (b.homingState === 'launching') {
                    // Decelerate initial launch velocity
                    b.vx *= 0.96; 
                    b.vy *= 0.96;
                    
                    if ((s.frame - (b.launchTime || 0)) > 90) { // 1.5s
                        b.homingState = 'searching';
                    }
                } else if (b.homingState === 'searching') {
                    // Drift while searching
                    let bestT = null; let minD = Infinity;
                    s.enemies.forEach(e => {
                        const dist = Math.hypot(e.x - b.x, e.y - b.y);
                        // Omega mine tracks anything, standard mines have limited FOV?
                        // Let's make mines track proximity
                        if (dist < 400 && e.hp > 0) { // Detection range
                             if (dist < minD) { minD = dist; bestT = e; }
                        }
                    });
                    if (bestT) { b.target = bestT; b.homingState = 'engaging'; }
                }
                
                if (b.target && b.homingState === 'engaging') {
                    if (b.target.hp <= 0) { b.target = null; b.homingState = 'returning'; }
                    else {
                        const t = b.target;
                        const dx = t.x - b.x; const dy = t.y - b.y;
                        const dist = Math.hypot(dx, dy);
                        const speed = b.maxSpeed || 10;
                        const turnRate = b.turnRate || 0.08;
                        b.vx += ((dx/dist)*speed - b.vx) * turnRate;
                        b.vy += ((dy/dist)*speed - b.vy) * turnRate;
                    }
                } else if (b.homingState === 'returning') {
                    // Return to ship? Or just drift
                    const dx = s.px - b.x; const dy = s.py - b.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < 100) b.homingState = 'searching';
                    else {
                        const speed = 8;
                        b.vx += ((dx/dist)*speed - b.vx) * 0.05;
                        b.vy += ((dy/dist)*speed - b.vy) * 0.05;
                    }
                }
                
                s.asteroids.forEach(a => {
                    const dx = b.x - a.x; const dy = b.y - a.y;
                    const d = Math.hypot(dx, dy);
                    if (d < a.size + 100) {
                        const force = (a.size + 100 - d) / 10;
                        b.vx += (dx/d) * force;
                        b.vy += (dy/d) * force;
                    }
                });
            }

            b.x += b.vx; b.y += b.vy; b.life--;
            
            if (!b.isEnemy && !['missile', 'mine', 'missile_emp', 'mine_emp', 'mine_red'].includes(b.type)) {
                if (b.type.includes('missile') || b.type.includes('mine')) { 
                    s.asteroids.forEach(ast => {
                        const dx = ast.x - b.x;
                        const dy = ast.y - b.y;
                        const dist = Math.hypot(dx, dy);
                        if (dist < ast.size + 50) {
                            b.vx -= Math.sign(dx) * 0.5;
                        }
                    });
                }
            }

            if (b.isEnemy) {
                if (Math.hypot(b.x-s.px, b.y-s.py) < 30) { takeDamage(b.damage, b.type); b.life = 0; createExplosion(b.x, b.y, b.color, 3); }
            } else {
                let hit = false;
                s.enemies.forEach(e => {
                    const hitDist = (b.type.includes('missile') || b.type.includes('mine')) 
                        ? (e.type === 'boss' ? 100 : 60)
                        : (e.type === 'boss' ? 80 : 40);

                    if (Math.hypot(b.x-e.x, b.y-e.y) < hitDist) {
                        e.takeDamage(b.damage, b.type as any, !!b.isMain, !!b.isOvercharge);
                        hit = true;
                        if (b.type === 'mine_red') createExplosion(b.x, b.y, '#ef4444', 30);
                        else createExplosion(b.x, b.y, b.color, 2);
                    }
                });
                
                if (hit) {
                    b.life = 0;
                } else if (b.type.includes('mine') && b.target && (b.target.x < -100 || b.target.x > width+100 || b.target.y < -100)) {
                    b.target.takeDamage(9999, 'mine', false);
                    b.life = 0; 
                    s.score += 500; 
                    setHud(h => ({...h, alert: "OFF-SCREEN KILL +500"}));
                }

                s.asteroids.forEach(a => {
                    if (Math.hypot(b.x-a.x, b.y-a.y) < a.size + 10) {
                        let dmg = b.damage;
                        if (b.isMain) dmg *= 5.0; 
                        
                        a.hp -= dmg; 
                        b.life = 0; 
                        createExplosion(b.x, b.y, '#888', 3);
                        if (a.hp <= 0 && a.loot) spawnLoot(a.x, a.y, a.z, a.loot.type, a.loot.id, a.loot.name);
                    }
                });
            }
        });
        s.bullets = s.bullets.filter(b => {
            if (b.life <= 0) return false;
            if (b.type.includes('mine') && b.homingState === 'engaging') return true; 
            return b.y > -200 && b.y < height + 200;
        });

        s.loot.forEach(l => {
            const d = Math.hypot(l.x - s.px, l.y - s.py);
            if (d < 200) { 
                l.isBeingPulled = true; // Flag for tractor beam visual
                l.x += (s.px - l.x) * 0.05; 
                l.y += (s.py - l.y) * 0.05; 
                if (d < 40) { 
                    l.isPulled = true; 
                    if (l.type === 'ammo') {
                        s.magazineCurrent = Math.min(1000, s.magazineCurrent + 50);
                        s.ammo[s.selectedAmmo] += 50; 
                        audioService.playSfx('buy'); 
                        setHud(h => ({...h, alert: `+50 ${l.name?.toUpperCase()}`}));
                    } else {
                        const existing = s.cargo.find(c => c.type === l.type && c.id === l.id); 
                        if (existing) existing.quantity++; 
                        else s.cargo.push({ instanceId: Date.now().toString(), type: l.type as any, id: l.id, name: l.name || l.type, quantity: 1, weight: 1 }); 
                        audioService.playSfx('buy'); 
                        setHud(h => ({...h, alert: `GOT ${l.name || l.type.toUpperCase()}`})); 
                    }
                } 
            } else {
                l.isBeingPulled = false;
                l.y += 2;
            }
        });
        s.loot = s.loot.filter(l => !l.isPulled && l.y < height + 100);

        // Render
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#fff'; s.stars.forEach(st => { st.y += st.s * 0.5; if(st.y > height) st.y = 0; ctx.globalAlpha = Math.random() * 0.5 + 0.3; ctx.beginPath(); ctx.arc(st.x, st.y, st.s, 0, Math.PI*2); ctx.fill(); }); ctx.globalAlpha = 1;

        const entities = [...s.asteroids.map(a => ({type: 'ast', z: a.z, obj: a})), ...s.enemies.map(e => ({type: 'enemy', z: e.z, obj: e})), ...s.loot.map(l => ({type: 'loot', z: l.z, obj: l})), {type: 'player', z: 0, obj: null}].sort((a,b) => a.z - b.z);
        entities.forEach(item => {
            const scale = 1 + (item.type === 'ast' ? (item.obj as Asteroid).z / 1000 : (item.type === 'enemy' ? (item.obj as Enemy).z / 1000 : 0));
            if (scale <= 0) return;
            ctx.save();
            if (item.type === 'ast') {
                const a = item.obj as Asteroid; ctx.translate(a.x, a.y); ctx.scale(scale, scale); ctx.rotate(a.ax);
                a.faces.forEach(f => { const shade = 0.5 + (f.indices[0] % 5) * 0.1; ctx.fillStyle = shade > 0.8 ? '#fff' : a.color; ctx.globalAlpha = shade; ctx.beginPath(); f.indices.forEach((idx, i) => { const v = a.vertices[idx]; if (i===0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); }); ctx.fill(); });
            } else if (item.type === 'enemy') {
                const e = item.obj as Enemy; 
                // Apply vibration if hit
                const vibX = e.vibration > 0 ? (Math.random() - 0.5) * e.vibration : 0;
                const vibY = e.vibration > 0 ? (Math.random() - 0.5) * e.vibration : 0;
                
                ctx.translate(e.x + vibX, e.y + vibY); 
                ctx.scale(scale, scale); 
                ctx.rotate(Math.PI);
                
                // Determine Enemy Color based on Quadrant
                let enemyColor = '#ef4444'; // Default Red
                let wingColor = '#ef4444';
                
                if (e.type !== 'boss') {
                    const alienCols = getAlienColors(quadrant);
                    enemyColor = alienCols.hull;
                    wingColor = alienCols.wing;
                } else {
                    enemyColor = '#a855f7'; // Boss Purple default
                    wingColor = '#d8b4fe';
                }

                drawShip(ctx, { 
                    config: e.config, 
                    fitting: null, 
                    color: enemyColor,
                    wingColor: wingColor,
                    gunColor: '#ef4444',
                    equippedWeapons: e.equippedWeapons // Pass actual weapons
                }, false);
                
                e.shieldLayers.forEach((layer, idx) => {
                    if (layer.current <= 0) return;
                    const radius = 60 + (idx * 8); 
                    const opacity = Math.min(1, layer.current / layer.max);
                    
                    ctx.strokeStyle = layer.color;
                    ctx.lineWidth = 3;
                    ctx.shadowColor = layer.color;
                    ctx.shadowBlur = 10;
                    ctx.globalAlpha = opacity;
                    
                    const segments = 3;
                    const arcLen = (Math.PI * 2) / segments * 0.7; 
                    const rotation = layer.rotation;
                    
                    ctx.beginPath();
                    for(let k=0; k<segments; k++) {
                        const startAngle = rotation + (k * (Math.PI*2)/segments);
                        ctx.moveTo(Math.cos(startAngle)*radius, Math.sin(startAngle)*radius);
                        ctx.arc(0, 0, radius, startAngle, startAngle + arcLen);
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 1;
                });

            } else if (item.type === 'player') {
                ctx.translate(s.px, s.py); 
                drawShip(ctx, { 
                    config: activeShip.config,
                    fitting: activeShip.fitting,
                    color: activeShip.color,
                    wingColor: activeShip.wingColor,
                    cockpitColor: activeShip.cockpitColor,
                    gunColor: activeShip.gunColor,
                    secondaryGunColor: activeShip.secondaryGunColor,
                    gunBodyColor: activeShip.gunBodyColor,
                    engineColor: activeShip.engineColor,
                    nozzleColor: activeShip.nozzleColor
                }, true);
            } else if (item.type === 'loot') {
                const l = item.obj as Loot; 
                ctx.translate(l.x, l.y); 
                ctx.scale(scale, scale); 

                // Dynamic Size Logic based on fontSize prop
                let boxSize = 16;
                let fontSizePx = 10;
                if (fontSize === 'medium') { boxSize = 22; fontSizePx = 14; }
                if (fontSize === 'large') { boxSize = 32; fontSizePx = 20; }
                const half = boxSize / 2;

                // Tractor Beam Visual Effect
                if (l.isBeingPulled) {
                    const dx = s.px - l.x;
                    const dy = s.py - l.y;
                    const dist = Math.hypot(dx, dy);
                    const angle = Math.atan2(dy, dx);
                    
                    ctx.save();
                    ctx.rotate(angle); 
                    
                    // Beam Cone
                    const grad = ctx.createLinearGradient(0, 0, dist, 0);
                    grad.addColorStop(0, 'rgba(56, 189, 248, 0.1)'); 
                    grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
                    
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    const wStart = boxSize * 0.8;
                    const wEnd = 10; // Point at ship
                    
                    ctx.moveTo(0, -wStart/2);
                    ctx.lineTo(dist, -wEnd/2);
                    ctx.lineTo(dist, wEnd/2);
                    ctx.lineTo(0, wStart/2);
                    ctx.fill();

                    // Wave Arcs (Moving from Loot towards Ship)
                    ctx.strokeStyle = 'rgba(125, 211, 252, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.shadowColor = '#38bdf8';
                    ctx.shadowBlur = 5;
                    
                    const flowSpeed = 3;
                    const waveSpacing = 15;
                    const offset = (s.frame * flowSpeed) % waveSpacing;
                    
                    for (let x = offset; x < dist; x += waveSpacing) {
                        const progress = x / dist;
                        const currentW = (wStart * (1 - progress)) + (wEnd * progress);
                        const h = currentW / 2;
                        
                        ctx.globalAlpha = Math.sin(progress * Math.PI); 
                        
                        ctx.beginPath();
                        ctx.moveTo(x, -h);
                        ctx.quadraticCurveTo(x - 5, 0, x, h); 
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                    ctx.restore();
                }

                if (l.type === 'ammo') {
                    ctx.fillStyle = '#facc15';
                    ctx.beginPath(); ctx.rect(-half, -half, boxSize, boxSize); ctx.fill();
                    ctx.fillStyle = '#000'; 
                    ctx.font = `bold ${fontSizePx}px monospace`; 
                    ctx.textAlign = 'center'; 
                    ctx.textBaseline = 'middle';
                    ctx.fillText('B', 0, 1);
                } else if (l.type === 'robot') {
                    ctx.fillStyle = '#10b981';
                    ctx.beginPath(); ctx.rect(-half, -half, boxSize, boxSize); ctx.fill();
                    ctx.fillStyle = '#fff'; 
                    ctx.font = `bold ${fontSizePx}px monospace`; 
                    ctx.textAlign = 'center'; 
                    ctx.textBaseline = 'middle';
                    ctx.fillText('R', 0, 1);
                } else if (l.type === 'water') {
                    ctx.fillStyle = '#3b82f6';
                    ctx.beginPath(); ctx.arc(0, 0, half, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#fff'; 
                    ctx.font = `bold ${fontSizePx}px monospace`; 
                    ctx.textAlign = 'center'; 
                    ctx.textBaseline = 'middle';
                    ctx.fillText('H2O', 0, 1);
                } else {
                    ctx.fillStyle = l.type === 'gold' ? '#fbbf24' : '#a855f7'; 
                    ctx.fillRect(-half, -half, boxSize, boxSize); 
                    ctx.fillStyle = '#fff'; 
                    ctx.font = `bold ${fontSizePx}px monospace`; 
                    ctx.textAlign = 'center'; 
                    ctx.textBaseline = 'middle';
                    ctx.fillText(l.type.substring(0,1).toUpperCase(), 0, 1);
                }
            }
            ctx.restore();
        });

        s.bullets.forEach(b => {
            ctx.save();
            ctx.translate(b.x, b.y);
            
            if (b.type.includes('missile')) {
                // CYLINDRICAL MISSILE RENDERING
                const rotation = Math.atan2(b.vy, b.vx) + Math.PI/2;
                ctx.rotate(rotation);
                const scale = 1.0 + ((b.z || 0)/1000); 
                ctx.scale(scale, scale);

                const isEmp = b.type.includes('emp');

                // Body (Cylinder)
                const grad = ctx.createLinearGradient(-3, 0, 3, 0);
                grad.addColorStop(0, '#cbd5e1'); 
                grad.addColorStop(0.5, '#ffffff');
                grad.addColorStop(1, '#94a3b8'); 
                ctx.fillStyle = grad;
                ctx.fillRect(-3, -10, 6, 16);

                // Head
                ctx.fillStyle = b.headColor || (isEmp ? '#22d3ee' : '#ef4444');
                ctx.beginPath();
                ctx.moveTo(-3, -10);
                ctx.lineTo(3, -10);
                ctx.lineTo(0, -16);
                ctx.fill();

                // Fins
                ctx.fillStyle = b.finsColor || (isEmp ? '#0ea5e9' : '#ef4444');
                ctx.beginPath();
                ctx.moveTo(-3, 6); ctx.lineTo(-6, 10); ctx.lineTo(-3, 4); 
                ctx.moveTo(3, 6); ctx.lineTo(6, 10); ctx.lineTo(3, 4);
                ctx.fill();

                // Thruster
                ctx.fillStyle = isEmp ? '#3b82f6' : '#facc15';
                ctx.beginPath(); ctx.arc(0, 6, 2, 0, Math.PI*2); ctx.fill();
            }
            else if (b.type.includes('mine')) {
                // MINE RENDERING
                const scale = 1.0 + ((b.z || 0)/1000);
                ctx.scale(scale, scale);
                const rotation = s.frame * 0.1;
                ctx.rotate(rotation);

                // Core
                ctx.fillStyle = b.color; 
                ctx.shadowBlur = b.glowIntensity || 10; ctx.shadowColor = b.color;
                const size = b.width / 2; // radius
                ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
                
                // Spikes
                ctx.fillStyle = b.type === 'mine_red' ? '#7f1d1d' : '#3f3f46'; 
                for(let i=0; i<8; i++) {
                    const ang = (i * Math.PI * 2) / 8;
                    ctx.save();
                    ctx.rotate(ang);
                    ctx.fillRect(-1, -size - 4, 2, 6);
                    ctx.restore();
                }
                
                // Blink light
                if (s.frame % (b.type === 'mine_red' ? 10 : 20) < (b.type === 'mine_red' ? 5 : 10)) {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.arc(0,0, b.type === 'mine_red' ? 4 : 2,0,Math.PI*2); ctx.fill();
                }
                ctx.shadowBlur = 0;
            }
            else if (b.weaponId === 'exotic_fireball') {
                ctx.fillStyle = b.color;
                ctx.shadowBlur = 10; ctx.shadowColor = b.color;
                ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
            } 
            else if (b.weaponId === 'exotic_plasma_jet') {
                if (b.vx !== 0 || b.vy !== 0) ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI/2);
                ctx.fillStyle = b.color;
                ctx.shadowBlur = 8; ctx.shadowColor = b.color;
                ctx.beginPath(); ctx.ellipse(0, 0, 6, 25, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fca5a5'; ctx.beginPath(); ctx.ellipse(0, 0, 3, 18, 0, 0, Math.PI*2); ctx.fill();
            }
            else if (b.weaponId === 'exotic_electric') {
                if (b.vx !== 0 || b.vy !== 0) ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI/2);
                ctx.strokeStyle = b.color;
                ctx.shadowBlur = 15; ctx.shadowColor = b.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                const boltLen = 100;
                ctx.moveTo(0, -boltLen/2);
                const segments = 8;
                const segLen = boltLen / segments;
                for(let i=1; i<=segments; i++) {
                    ctx.lineTo((Math.random()-0.5)*15, (-boltLen/2) + i*segLen);
                }
                ctx.stroke();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
                ctx.stroke();
            }
            else if (b.weaponId === 'exotic_wave') {
                ctx.strokeStyle = b.color;
                ctx.lineWidth = 3;
                ctx.shadowBlur = 10; ctx.shadowColor = b.color;
                ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.stroke();
            }
            else if (b.weaponId === 'exotic_comet') {
                ctx.fillStyle = 'rgba(168, 85, 247, 0.4)'; 
                ctx.beginPath(); ctx.ellipse(0, 20, 6, 25, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = b.color;
                ctx.shadowBlur = 20; ctx.shadowColor = b.color;
                ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
            }
            else if (b.weaponId === 'exotic_flamer' || b.type === 'flame') {
                const lifePct = b.life / 30.0;
                const size = 5 + (1-lifePct) * 20;
                ctx.fillStyle = b.color;
                ctx.globalAlpha = lifePct;
                ctx.beginPath(); ctx.arc(0, 0, Math.max(0, size), 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
            }
            else if (b.weaponId === 'exotic_scatter' || b.type === 'scatter') {
                ctx.save();
                ctx.rotate(b.life * 0.5); 
                ctx.fillStyle = b.color;
                ctx.shadowBlur = 10; ctx.shadowColor = b.color;
                ctx.beginPath();
                for(let i=0; i<12; i++) {
                    const r = i % 2 === 0 ? 10 : 4; 
                    const a = (i * Math.PI) / 6;
                    ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
                }
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
                ctx.restore();
            }
            else if (b.weaponId === 'exotic_rainbow_cloud') {
                const lifePct = b.life / 40.0;
                const size = b.width * (1 + (1 - lifePct) * 0.5); // Grow slightly
                ctx.fillStyle = b.color;
                ctx.globalAlpha = lifePct * 0.7; // Transparent clouds
                ctx.shadowBlur = 5; ctx.shadowColor = b.color;
                ctx.beginPath(); ctx.arc(0, 0, Math.max(0, size), 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
            }
            else {
                if (!b.isEnemy && (b.vx !== 0 || b.vy !== 0)) ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI/2);
                
                if (b.isTracer) {
                    ctx.fillStyle = b.traceColor || 'rgba(255,255,255,0.5)';
                    ctx.beginPath();
                    ctx.moveTo(-b.width/2, b.height/2);
                    ctx.lineTo(0, b.height * 2.5); 
                    ctx.lineTo(b.width/2, b.height/2);
                    ctx.fill();
                }

                if (b.glow) { ctx.shadowBlur = b.glowIntensity || 15; ctx.shadowColor = b.color; }
                ctx.fillStyle = b.color;
                ctx.fillRect(-b.width/2, -b.height/2, b.width, b.height);
            }
            ctx.shadowBlur = 0;
            ctx.restore();
        });

        s.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.life -= 0.05;
            ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI*2); ctx.fill();
        });
        s.particles = s.particles.filter(p => p.life > 0);
        ctx.globalAlpha = 1;

        if (s.frame % 10 === 0) {
            let alertText = hud.alert;
            let alertType = hud.alertType;
            
            // Fuel Warning Check
            if (s.fuel <= 1.0) {
                alertText = "CRITICAL: FUEL DEPLETED - RETURN TO BASE";
                alertType = "warning";
            }

            setHud(prev => ({
                ...prev, hp: s.hp, sh1: s.sh1, fuel: s.fuel, energy: s.energy, 
                score: s.score, missiles: s.missiles, mines: s.mines, redMines: s.redMines,
                timer: s.time, cargoCount: s.cargo.length, chargeLevel: s.chargeLevel,
                boss: s.enemies.find(e => e.type === 'boss'), swivelMode: s.swivelMode,
                ammoCount: s.magazineCurrent, ammoType: s.selectedAmmo, isReloading: s.reloadTimer > 0,
                alert: alertText, alertType: alertType as any
            }));
        }
        raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const takeDamage = (amt: number, type: string = 'generic') => {
      const s = state.current;
      
      // Robot Sacrifice Logic
      if (s.hp < 90) { // If hull integrity drops below 90%, robots sacrifice themselves
          const robotIdx = s.cargo.findIndex(c => c.type === 'robot');
          if (robotIdx >= 0) {
              s.cargo[robotIdx].quantity--;
              if (s.cargo[robotIdx].quantity <= 0) s.cargo.splice(robotIdx, 1);
              audioService.playSfx('denied'); // Using denied sound as a "clank" shield
              setHud(h => ({...h, alert: "ROBOT SACRIFICED", alertType: 'warning'}));
              return; // Damage fully negated
          }
      }

      let shieldDmg = amt;
      let hullDmg = amt;

      if (type.includes('missile') || type.includes('mine')) {
          const isEmp = type.includes('emp');
          // Hull Damage: Normal = 50% maxHp, EMP = 35% maxHp
          // Player Max HP is always 100% in UI terms
          hullDmg = 100 * (isEmp ? 0.35 : 0.5);
          
          // Shield Damage: 1 EMP = 100% Capacity, 1 Normal = 50% Capacity
          const pct = isEmp ? 1.0 : 0.5;
          const maxS1 = shield?.capacity || 0;
          const maxS2 = secondShield?.capacity || 0;
          
          // Apply to the active shield layer max capacity
          if (s.sh2 > 0) shieldDmg = maxS2 * pct;
          else if (s.sh1 > 0) shieldDmg = maxS1 * pct;
      }

      if (s.sh2 > 0) s.sh2 = Math.max(0, s.sh2 - shieldDmg); 
      else if (s.sh1 > 0) s.sh1 = Math.max(0, s.sh1 - shieldDmg); 
      else s.hp = Math.max(0, s.hp - hullDmg);
      
      if (s.hp <= 0) onGameOver(false, s.score, false);
  };

  const drawShip = (ctx: CanvasRenderingContext2D, shipData: any, isPlayer = false) => {
      // [drawShip implementation remains unchanged]
      const { config, color, wingColor, cockpitColor, gunColor, secondaryGunColor, gunBodyColor, engineColor, nozzleColor, fitting, equippedWeapons } = shipData;
      const scale = isPlayer ? 0.6 : 0.5;
      
      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(-50, -50); 

      const { wingStyle, hullShapeType } = config;
      const engineLocs = getEngineCoordinates(config);

      if (config.isAlien) {
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          const ovalY = wingStyle === 'alien-a' ? 55 : 45;
          ctx.ellipse(50, ovalY, 12, 35, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
      }

      const baseColor = wingColor || config.defaultColor || '#64748b';
      ctx.fillStyle = baseColor;
      ctx.strokeStyle = baseColor;
      if (wingStyle === 'cylon') ctx.filter = 'brightness(0.7)';
      else if (!wingColor || wingColor === color) ctx.filter = 'brightness(0.85)';

      ctx.beginPath();
      if (config.isAlien) {
          ctx.lineWidth = 14; 
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
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
      ctx.filter = 'none';

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

      if (isPlayer) {
          ctx.save();
          engineLocs.forEach(eng => {
              const nozzleH = config.isAlien ? 6 : 5;
              const jetY = eng.y + eng.h + nozzleH;
              const jetW = eng.w * 0.8;
              const jetX = eng.x - (jetW / 2);
              const length = 40;
              
              ctx.beginPath();
              ctx.moveTo(jetX, jetY);
              ctx.lineTo(jetX + jetW/2, jetY + length);
              ctx.lineTo(jetX + jetW, jetY);
              
              const grad = ctx.createLinearGradient(jetX, jetY, jetX, jetY + length);
              grad.addColorStop(0, '#ffffff'); 
              grad.addColorStop(0.2, '#60a5fa'); 
              grad.addColorStop(0.6, '#3b82f6'); 
              grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
              
              ctx.fillStyle = grad;
              ctx.globalAlpha = 0.9;
              ctx.fill();
          });
          ctx.restore();
      }

      const drawEngineRect = (x: number, y: number, w: number, h: number) => {
          const isAlien = config.isAlien;
          const eColor = isAlien ? '#172554' : (engineColor || '#334155');
          const nColor = isAlien ? '#9ca3af' : (nozzleColor || '#475569');
          const ew = w + 2; const eh = h + 2;
          const drawX = x - ew/2;
          
          ctx.fillStyle = eColor;
          ctx.beginPath();
          if (isAlien) { ctx.ellipse(x, y + eh/2, ew/2, eh/2, 0, 0, Math.PI * 2); }
          else { const r = 3; if (ctx.roundRect) ctx.roundRect(drawX, y, ew, eh, r); else ctx.rect(drawX, y, ew, eh); }
          ctx.fill();

          ctx.fillStyle = nColor;
          const nozzleH = isAlien ? 6 : 5; const flare = isAlien ? 4 : 3; const inset = isAlien ? 1 : 0;
          ctx.beginPath();
          if (isAlien) {
              const nozzleStart = y + eh - 2;
              ctx.moveTo(drawX + inset, nozzleStart); ctx.lineTo(drawX + ew - inset, nozzleStart); ctx.lineTo(drawX + ew + flare, nozzleStart + nozzleH); ctx.lineTo(drawX - flare, nozzleStart + nozzleH); 
          } else {
              ctx.moveTo(drawX + inset, y + eh); ctx.lineTo(drawX + ew - inset, y + eh); ctx.lineTo(drawX + ew + flare, y + eh + nozzleH); ctx.lineTo(drawX - flare, y + eh + nozzleH); 
          }
          ctx.fill();
      };
      engineLocs.forEach(eng => drawEngineRect(eng.x, eng.y, eng.w, eng.h));

      ctx.fillStyle = cockpitColor || '#0ea5e9';
      ctx.beginPath();
      if (config.isAlien) { const cy = wingStyle === 'alien-a' ? 65 : 45; ctx.ellipse(50, cy, 8, 20, 0, 0, Math.PI * 2); } 
      else if (wingStyle === 'x-wing') { ctx.ellipse(50, 55, 8, 12, 0, 0, Math.PI * 2); } 
      else { ctx.ellipse(50, 40, 8, 12, 0, 0, Math.PI * 2); }
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); 
      if (wingStyle === 'x-wing') { ctx.ellipse(48, 52, 3, 5, -0.2, 0, Math.PI * 2); } 
      else { const cy = (config.isAlien && wingStyle === 'alien-a') ? 65 : (config.isAlien ? 45 : 38); ctx.ellipse(48, cy - 2, 3, 5, -0.2, 0, Math.PI * 2); }
      ctx.fill();

      if (config.isAlien) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.lineCap = 'round'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
          const cy = wingStyle === 'alien-a' ? 65 : 45;
          const gap = 8;
          ctx.beginPath(); ctx.ellipse(50, cy, 8 + gap, 20 + gap, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
          ctx.setLineDash([]);
      }

      const drawWeapon = (x: number, y: number, id: string | undefined, type: 'primary' | 'secondary', slotIndex: number) => {
          ctx.save();
          const def = id ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === id) : null;
          
          let recoilY = 0;
          let heatFactor = 0;
          let showFlash = false;
          let isFiring = false;
          
          if (isPlayer) {
              const lastFire = state.current.weaponFireTimes[slotIndex] || 0;
              const timeSinceFire = Date.now() - lastFire;
              if (def?.isAmmoBased) {
                  // Removed recoil animation for standard ammo weapons
                  if (timeSinceFire < 80) showFlash = true;
                  if (timeSinceFire < 200) isFiring = true;
                  const heatVal = state.current.weaponHeat[slotIndex] || 0;
                  heatFactor = Math.min(1, heatVal / 50); 
              } else {
                  if (timeSinceFire < 200) isFiring = true;
              }
          }

          ctx.translate(x, y + recoilY);
          
          // Apply Swivel Rotation for Player Secondary Guns if Active
          if (isPlayer && state.current.swivelMode && def?.isAmmoBased) {
              // Calculate current swivel angle matching the firing logic (approx +/- 13 deg)
              // Logic uses: Math.sin(s.frame * 0.1) * 13
              // Left Wing (Slot 1) = +Angle
              // Right Wing (Slot 2) = -Angle
              const baseAngle = Math.sin(state.current.frame * 0.1) * 13;
              const rotDeg = slotIndex === 1 ? baseAngle : (slotIndex === 2 ? -baseAngle : 0);
              const rotRad = (rotDeg * Math.PI) / 180;
              ctx.rotate(rotRad);
          }
          
          const isSecondary = type === 'secondary';
          const isAlien = config.isAlien;
          const isExotic = id?.includes('exotic');
          const isStandardProjectile = def && def.type === 'PROJECTILE' && !isExotic;

          const scale = isAlien && isExotic ? 1.4 : (isExotic ? 1.0 : 1.45); 
          ctx.scale(scale, scale);

          if (isStandardProjectile && def) {
              const stdBodyColor = (gunBodyColor && gunBodyColor !== '#334155') ? gunBodyColor : '#451a03'; 
              let barrelColor = '#52525b';
              if (heatFactor > 0.2) {
                  barrelColor = mixColor('#52525b', '#ef4444', (heatFactor - 0.2) * 1.2);
              }

              const barrelCount = def.barrelCount || 1;
              const isRotary = barrelCount > 1;

              ctx.fillStyle = stdBodyColor;
              if (id?.includes('vulcan')) { if(ctx.roundRect) {ctx.beginPath(); ctx.roundRect(-4.25, 0, 8.5, 12, 3); ctx.fill();} else ctx.fillRect(-4.25, 0, 8.5, 12); } 
              else if (id?.includes('heavy')) { if(ctx.roundRect) {ctx.beginPath(); ctx.roundRect(-6, 0, 12, 10, 3); ctx.fill();} else ctx.fillRect(-6, 0, 12, 10); } 
              else { if(ctx.roundRect) {ctx.beginPath(); ctx.roundRect(-4.25, 0, 8.5, 10, 3); ctx.fill();} else ctx.fillRect(-4.25, 0, 8.5, 10); }

              if (isRotary) {
                  const rotOffset = isFiring ? (Date.now() / 50) % 3 : 0;
                  const bw = 2; const bl = 24; const bx = [-3, -1, 1];
                  bx.forEach((offX, i) => {
                      const brightness = Math.abs(Math.sin((i + rotOffset) * (Math.PI/1.5))); 
                      const cVal = Math.floor(82 + (brightness * 100));
                      const baseBar = `rgb(${cVal},${cVal},${cVal})`;
                      const finalBar = heatFactor > 0.2 ? mixColor(baseBar, '#ef4444', (heatFactor - 0.2)) : baseBar;
                      ctx.fillStyle = finalBar;
                      ctx.fillRect(offX, -bl, bw, bl); 
                  });
                  ctx.fillStyle = '#18181b'; ctx.fillRect(-3.5, -bl-1, 7, 2);
              } else {
                  ctx.fillStyle = barrelColor;
                  ctx.fillRect(-1.5, -16, 3, 16);
                  ctx.fillStyle = '#27272a'; 
                  ctx.fillRect(-2, -16, 4, 2);
                  const holeCount = 4;
                  const holeStart = -12;
                  const holeSpacing = 3;
                  for(let i=0; i<holeCount; i++) {
                      const hy = holeStart + (i * holeSpacing);
                      ctx.fillStyle = '#000';
                      ctx.beginPath(); ctx.arc(0, hy, 0.8, 0, Math.PI*2); ctx.fill();
                      if (isFiring && isPlayer) {
                          const ventScale = Math.random() * 0.5 + 0.5;
                          ctx.fillStyle = i % 2 === 0 ? '#facc15' : '#ef4444';
                          ctx.beginPath(); ctx.arc(-2, hy, 1 * ventScale, 0, Math.PI*2); ctx.fill();
                          ctx.beginPath(); ctx.arc(2, hy, 1 * ventScale, 0, Math.PI*2); ctx.fill();
                      }
                  }
              }

              if (showFlash) {
                  ctx.save(); 
                  const flashY = isRotary ? -26 : -18;
                  ctx.translate(0, flashY); 
                  ctx.fillStyle = Math.random() > 0.5 ? '#facc15' : '#ef4444'; 
                  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, 2); ctx.lineTo(0, 0); ctx.lineTo(-4, 2); ctx.fill(); 
                  ctx.restore();
              }

          } else {
              let baseGunColor = isSecondary ? (secondaryGunColor || '#38bdf8') : (gunColor || config.noseGunColor || '#ef4444');
              const gunBody = config.isAlien ? '#374151' : (gunBodyColor || '#334155');

              ctx.fillStyle = gunBody;
              if (id?.includes('plasma') || isExotic) { 
                  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-3.6, -14, 7.2, 12, [5, 5, 0, 0]); ctx.fill(); } else { ctx.fillRect(-3.6, -14, 7.2, 12); } 
                  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -8, 3, 0, Math.PI*2); ctx.fill(); 
                  if (isFiring) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -8, 2, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; }
              } else { 
                  ctx.fillRect(-4.25, 0, 8.5, 10); 
                  ctx.fillStyle = baseGunColor; 
                  ctx.fillRect(-2.5, -12, 5, 12); 
                  if (isFiring) {
                      ctx.save();
                      ctx.shadowColor = baseGunColor;
                      ctx.shadowBlur = 15;
                      ctx.fillStyle = 'rgba(255,255,255,0.8)';
                      ctx.fillRect(-1.5, -11, 3, 10); 
                      ctx.restore();
                  }
              }
          }
          ctx.restore();
      };

      const weaponsList = equippedWeapons || (fitting ? fitting.weapons : null);
      const mainId = weaponsList && weaponsList[0] ? weaponsList[0].id : (config.weaponId || 'gun_bolt');
      if (mainId) {
          if (wingStyle === 'alien-h') { drawWeapon(25, 20, mainId, 'primary', 0); drawWeapon(75, 20, mainId, 'primary', 0); } 
          else if (wingStyle === 'alien-w') { drawWeapon(10, 20, mainId, 'primary', 0); drawWeapon(90, 20, mainId, 'primary', 0); } 
          else if (wingStyle === 'alien-m') { drawWeapon(20, 25, mainId, 'primary', 0); drawWeapon(80, 25, mainId, 'primary', 0); } 
          else if (wingStyle === 'alien-a') { drawWeapon(50, 22, mainId, 'primary', 0); } 
          else if (wingStyle === 'x-wing') { drawWeapon(50, 20, mainId, 'primary', 0); } 
          else { drawWeapon(50, 10, mainId, 'primary', 0); }
      }

      if (weaponsList) {
          const mounts = getWingMounts(config);
          if (weaponsList[1]) drawWeapon(mounts[0].x, mounts[0].y, weaponsList[1]?.id, 'secondary', 1);
          if (weaponsList[2]) drawWeapon(mounts[1].x, mounts[1].y, weaponsList[2]?.id, 'secondary', 2);
      }

      if (isPlayer && (shield || secondShield)) {
          const drawShieldRing = (s: Shield | null, radius: number) => {
              if (!s) return;
              const vType = s.visualType;
              
              ctx.save();
              ctx.strokeStyle = s.color; 
              ctx.lineWidth = 4; // Thicker
              ctx.shadowColor = s.color; 
              ctx.shadowBlur = 10; 
              ctx.globalAlpha = 0.5; // Semitransparent
              
              ctx.beginPath(); 
              if (vType === 'forward') {
                  // Forward arc centered at -PI/2 (Up)
                  ctx.arc(50, 50, radius, -Math.PI * 0.8, -Math.PI * 0.2);
              } else {
                  ctx.arc(50, 50, radius, 0, Math.PI * 2); 
              }
              ctx.stroke();
              ctx.restore();
          };
          // Increased radius by 10%
          if (shield) drawShieldRing(shield, 66);
          if (secondShield) drawShieldRing(secondShield, 77);
      }

      ctx.restore();
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden cursor-crosshair">
        <canvas ref={canvasRef} className="absolute inset-0 z-10" />
        
        {/* HUD Elements */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20 pointer-events-none w-48">
            <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-black text-zinc-400"><span>HULL</span><span>{Math.ceil(hud.hp)}%</span></div>
                <div className="h-2 bg-zinc-900 border border-zinc-700"><div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${hud.hp}%`}}/></div>
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-black text-zinc-400"><span>FUEL</span><span>{Math.floor((hud.fuel/maxFuel)*100)}%</span></div>
                <div className={`h-2 bg-zinc-900 border border-zinc-700 ${hud.fuel <= 1.0 ? 'animate-pulse' : ''}`}><div className={`h-full transition-all duration-300 ${hud.fuel <= 1.0 ? 'bg-red-600' : 'bg-amber-500'}`} style={{width: `${(hud.fuel/maxFuel)*100}%`}}/></div>
            </div>
            {shield && (
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] font-black text-zinc-400"><span>SHIELD</span><span>{Math.floor((hud.sh1/(shield?.capacity||1))*100)}%</span></div>
                    <div className="h-2 bg-zinc-900 border border-zinc-700"><div className="h-full bg-blue-500 transition-all duration-300" style={{width: `${Math.min(100, (hud.sh1/(shield?.capacity||1))*100)}%`}}/></div>
                </div>
            )}
        </div>

        <div className="absolute top-1/2 right-4 transform -translate-y-1/2 flex gap-3 z-20 pointer-events-none h-64">
            <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-black text-blue-400 -rotate-90 mb-2">PWR</span>
                <div className="flex-grow w-4 bg-zinc-900 border border-zinc-700 relative flex flex-col-reverse p-0.5 gap-[2px]">
                    {Array.from({length: 20}).map((_, i) => (
                        <div key={i} className={`w-full h-[4.5%] ${i < (hud.energy/maxEnergy)*20 ? 'bg-blue-500 shadow-[0_0_5px_#3b82f6]' : 'bg-zinc-800'}`} />
                    ))}
                </div>
            </div>
            {hasAmmoWeapons && (
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-black text-yellow-400 -rotate-90 mb-2">MAG</span>
                    <div className="flex-grow w-4 bg-zinc-900 border border-zinc-700 relative flex flex-col-reverse p-0.5 gap-[2px]">
                        {Array.from({length: 20}).map((_, i) => (
                            <div key={i} className={`w-full h-[4.5%] ${i < (hud.ammoCount/1000)*20 ? 'bg-yellow-500 shadow-[0_0_5px_#eab308]' : 'bg-zinc-800'} ${hud.isReloading ? 'animate-pulse bg-red-500' : ''}`} />
                        ))}
                    </div>
                    {hud.isReloading && <span className="absolute bottom-[-20px] text-[8px] font-black text-red-500 animate-pulse">RELOAD</span>}
                </div>
            )}
        </div>

        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20 pointer-events-none">
            <div className="pointer-events-auto flex gap-2">
                <button onClick={() => state.current.paused = !state.current.paused} className="px-4 py-2 bg-zinc-800 border border-zinc-600 text-white text-xs font-bold hover:bg-zinc-700">PAUSE</button>
                <button onClick={() => onGameOver(false, hud.score, true, { 
                    health: state.current.hp, 
                    fuel: state.current.fuel, 
                    rockets: state.current.missiles, 
                    mines: state.current.mines, 
                    redMineCount: state.current.redMines,
                    cargo: state.current.cargo, 
                    ammo: state.current.ammo, 
                    magazineCurrent: state.current.magazineCurrent, 
                    reloadTimer: state.current.reloadTimer 
                })} className="px-4 py-2 bg-red-900/50 border border-red-600 text-white text-xs font-bold hover:bg-red-800">RETREAT</button>
            </div>
        </div>

        <div className="absolute bottom-4 left-4 flex gap-4 z-20 pointer-events-none">
            <div className="bg-zinc-900/80 border border-zinc-700 p-2 rounded flex flex-col items-center min-w-[60px]">
                <span className="text-[9px] font-black text-zinc-500">MISSILES</span>
                <span className="text-xl font-black text-white">{hud.missiles}</span>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-700 p-2 rounded flex flex-col items-center min-w-[60px]">
                <span className="text-[9px] font-black text-zinc-500">MINES</span>
                <span className="text-xl font-black text-white">{hud.mines}</span>
            </div>
            <div className="bg-red-950/80 border border-red-600/50 p-2 rounded flex flex-col items-center min-w-[60px]">
                <span className="text-[9px] font-black text-red-400">OMEGA</span>
                <span className="text-xl font-black text-white">{hud.redMines}</span>
            </div>
        </div>

        <div className="absolute top-4 right-4 text-right z-20 pointer-events-none flex flex-col items-end">
            <div className="text-2xl font-black text-white drop-shadow-md">{hud.score.toLocaleString()}</div>
            <div className="mt-2">
                {hud.boss ? (<div className="w-48 h-3 bg-red-900 border border-red-500"><div className="h-full bg-red-500" style={{width: `${(hud.boss.hp/hud.boss.maxHp)*100}%`}}/></div>) : (<div className="text-xl font-black text-emerald-500 drop-shadow-md">{Math.ceil(hud.timer)}s</div>)}
            </div>
        </div>

        {hud.alert && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none text-center w-full max-w-lg px-4 flex items-end justify-center min-h-[4rem]">
                <div className={`text-sm md:text-base font-black uppercase tracking-widest drop-shadow-[0_0_15px_rgba(0,0,0,1)] leading-tight whitespace-pre-line ${hud.alertType === 'warning' || hud.alertType === 'error' ? 'text-red-500 animate-pulse' : (hud.alertType === 'alert' ? 'text-orange-500 animate-pulse' : 'text-emerald-400')}`}>{hud.alert}</div>
            </div>
        )}
    </div>
  );
};

export default GameEngine;
