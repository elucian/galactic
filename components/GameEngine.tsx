import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, Weapon, EquippedWeapon, Planet, QuadrantType, WeaponType, CargoItem } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, EXOTIC_SHIELDS, PLANETS, BOSS_SHIPS, SHIELDS, BOSS_EXOTIC_SHIELDS } from '../constants.ts';

// [Keep interfaces and classes (Particle, Point3D, Face3D, Enemy, EnergyBolt, Missile, Mine, Gift, Asteroid, SpaceSystem) unchanged]
interface GameEngineProps {
  ships: Array<{
    config: ExtendedShipConfig;
    fitting: ShipFitting;
    color: string;
    wingColor?: string;
    cockpitColor?: string;
    gunColor: string;
    gunBodyColor?: string;
    engineColor?: string;
    nozzleColor?: string;
  }>;
  shield: Shield | null;
  secondShield?: Shield | null;
  difficulty: number;
  currentPlanet: Planet;
  quadrant: QuadrantType;
  onGameOver: (success: boolean, finalScore: number, wasAborted?: boolean, payload?: { rockets: number, mines: number, weapons: EquippedWeapon[], fuel: number, bossDefeated?: boolean, health: number, hullPacks: number, cargo: CargoItem[] }) => void;
  fontSize: 'small' | 'medium' | 'large';
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; type: 'fire' | 'smoke' | 'spark' | 'debris' | 'shock' | 'fuel' | 'electric' | 'plasma'; z?: number;
}

interface Point3D { x: number; y: number; z: number; }
interface Face3D { indices: number[]; color: string; normal?: Point3D; zDepth?: number; shadeOffset: number; }

class Enemy {
  x: number; y: number; z: number = 0; 
  hp: number; maxHp: number;
  sh: number = 0; maxSh: number = 0;
  type: 'scout' | 'fighter' | 'heavy' | 'boss';
  config: ExtendedShipConfig;
  lastShot: number = 0;
  color: string;
  vx: number = 0; vy: number = 0; vz: number = 0;
  difficulty: number;
  burnLevel: number = 0; 
  burnTimer: number = 0;
  
  aiState: 'attack' | 'evade' | 'formation' = 'attack';
  shieldRegenTimer: number = 0;
  mineTimer: number = 0;
  
  shieldRegenRate: number = 0;
  shieldImmunity: 'kinetic' | 'energy' | 'none' = 'none';
  shieldVisual: any = null;
  
  constructor(x: number, y: number, type: 'scout' | 'fighter' | 'heavy' | 'boss', config: ExtendedShipConfig, difficulty: number) {
    this.difficulty = difficulty;
    const shotCounts = [3, 5, 8, 13, 21, 34, 55, 89, 144, 233]; 
    const diffIdx = Math.max(0, Math.min(9, Math.floor(difficulty - 1)));
    const baseHp = (shotCounts[diffIdx] / 3) * 100;
    const bossBaseHp = 8000 + (difficulty * 1000); 

    const hpMap = { scout: baseHp * 0.8, fighter: baseHp, heavy: baseHp * 2.5, boss: bossBaseHp };
    const shMap = { scout: 0, fighter: 0, heavy: 0, boss: 2000 + (difficulty * 500) };
    
    this.x = x; this.y = y; 
    this.z = type === 'boss' ? 0 : (Math.random() - 0.5) * 800; 
    this.vz = (Math.random() - 0.5) * 0.5;
    
    this.hp = hpMap[type]; this.maxHp = hpMap[type];
    
    if (type === 'boss') { 
        this.sh = shMap[type]; 
        this.maxSh = shMap[type];
        const shieldType = BOSS_EXOTIC_SHIELDS[Math.floor(Math.random() * BOSS_EXOTIC_SHIELDS.length)];
        this.shieldVisual = shieldType;
        this.shieldImmunity = shieldType.immunity as any;
        this.shieldRegenRate = shieldType.type === 'regen' ? 2.5 : 0.5;
    } else {
        if (difficulty > 5) {
            this.sh = 50 * (difficulty - 4);
            this.maxSh = this.sh;
        }
    }
    
    this.type = type; this.config = config;
    this.color = type === 'boss' ? '#a855f7' : (type === 'heavy' ? '#ef4444' : (type === 'fighter' ? '#f97316' : '#60a5fa'));
  }

  updateAI(px: number, py: number, asteroids: Asteroid[], peers: Enemy[]) {
    if (this.type === 'boss') {
        if (this.z > 5) this.vz = -0.5;
        else if (this.z < -5) this.vz = 0.5;
        else this.vz = 0;
    } else {
        if (this.z > 400) this.vz -= 0.05;
        else if (this.z < -400) this.vz += 0.05;
    }
    this.z += this.vz;

    if (this.type === 'boss') {
        if (this.sh < this.maxSh && this.sh > 0) this.sh += this.shieldRegenRate;
        
        // --- BOSS AI ENHANCEMENT: Dodge and Move ---
        const dx = px - this.x;
        const distToPlayer = Math.abs(dx);
        
        // Base tracking
        this.vx += dx * 0.003; 
        
        // Evasion Logic: If player is aiming at boss (dx is small), dodge laterally
        const isTargeted = distToPlayer < 100;
        if (isTargeted) {
             // Move AWAY from the player's center to dodge fire
             // If player is left (dx > 0), move right (add vx). If player is right, move left.
             const dodgeDir = dx > 0 ? -1 : 1; 
             this.vx += dodgeDir * 0.4;
        }

        // Keep moving (Hit and Run)
        // If getting too close to edges, bounce back harder
        if (this.x < 150) this.vx += 0.3;
        if (this.x > window.innerWidth - 150) this.vx -= 0.3;

        this.vx *= 0.95; 
        
        let targetY = 150 + Math.sin(Date.now() * 0.001) * 80;
        if (this.y > 350) targetY = 100;
        const dy = targetY - this.y;
        this.vy += dy * 0.01;
        this.vy *= 0.92;
        
        this.x += this.vx;
        this.y += this.vy;
        
        // Clamp screen
        if (this.x < 0) { this.x = 0; this.vx *= -1; }
        if (this.x > window.innerWidth) { this.x = window.innerWidth; this.vx *= -1; }
        
        return;
    }

    const distY = py - this.y;
    let baseSpeed = 4.2;
    if (distY < 300 && distY > 0) baseSpeed = 2.0;
    if (Math.random() < 0.01 && distY < 150) baseSpeed = -2.0;

    let sepX = 0, sepY = 0;
    peers.forEach(peer => {
        if (peer === this) return;
        const dx = this.x - peer.x;
        const dy = this.y - peer.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 100 && d > 0) {
            sepX += (dx / d) * 2.5;
            sepY += (dy / d) * 1.0;
        }
    });

    let avoidX = 0, avoidY = 0;
    asteroids.forEach(ast => {
        const zDist = Math.abs(ast.z - this.z);
        if (this.difficulty >= 4 && zDist < 120) {
            const dx = this.x - ast.x;
            const isBelow = ast.y > this.y && ast.y < this.y + 400; 
            if (isBelow && Math.abs(dx) < 80) {
                const isFastLateral = Math.abs(ast.vx) > 3;
                const isFastVertical = Math.abs(ast.vy) > 6;
                if (!isFastLateral && !isFastVertical) {
                    const dir = this.z < ast.z ? -1 : 1; 
                    this.vz += dir * 0.15;
                }
            }
        }
        if (zDist > 80) return;
        const dx = this.x - ast.x;
        const dy = this.y - ast.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < (ast.size + 150)) {
            avoidX += (dx / d) * 4.0;
            avoidY += (dy / d) * 1.5;
        }
    });

    this.vx += sepX + avoidX;
    this.vy += sepY + avoidY;
    this.vx += Math.sin(Date.now() * 0.005 + this.x) * 0.2;
    this.vx *= 0.92;
    this.vy *= 0.92;

    this.y += baseSpeed + this.vy;
    this.x += this.vx;

    if (this.difficulty >= 4 && this.sh < this.maxSh) {
        this.shieldRegenTimer++;
        if (this.shieldRegenTimer > 120) {
            this.sh += 0.5;
        }
    }

    if (this.config.canLayMines && distY > 100 && distY < 400 && Math.abs(this.x - px) < 100) {
        this.mineTimer++;
        if (this.mineTimer > 300 && Math.random() < 0.05) {
            this.mineTimer = 0;
            return true;
        }
    }
    return false;
  }
}

class EnergyBolt {
    x: number; y: number; vx: number; vy: number;
    timer: number = Math.random() * 100;
    phaseX: number = Math.random() * Math.PI * 2;
    phaseY: number = Math.random() * Math.PI * 2;
    constructor(w: number, h: number) {
        this.x = Math.random() * w; this.y = -100;
        this.vx = (Math.random() - 0.5) * 2; this.vy = 1.0 + Math.random() * 1.5;
    }
    update() {
        this.timer += 0.04;
        this.x += this.vx + Math.sin(this.timer + this.phaseX) * 3.5;
        this.y += this.vy + Math.cos(this.timer * 0.8 + this.phaseY) * 2.5;
    }
}

class Missile {
  x: number; y: number; z: number = 0; vx: number; vy: number; vz: number = 0; target: Enemy | null = null;
  life: number = 600; 
  damage: number = 350; 
  isHeavy: boolean = false; isEmp: boolean = false;
  constructor(x: number, y: number, vx: number, vy: number, isHeavy: boolean = false, isEmp: boolean = false) { 
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; 
    this.isHeavy = isHeavy; this.isEmp = isEmp;
    if (isHeavy || isEmp) { this.damage = 1800; this.life = 600; }
  }
}

class Mine {
  x: number; y: number; vx: number; vy: number; 
  damage: number = 2500; 
  target: Enemy | null = null;
  life: number = 600; 
  isEMP: boolean = false;
  z: number = 0;
  constructor(x: number, y: number, isEMP: boolean = false, z: number = 0) { 
      this.x = x; this.y = y; this.vx = 0; this.vy = -1.5; 
      this.isEMP = isEMP;
      this.z = z;
      if (isEMP) { this.damage = 3500; }
  }
  update(enemies: Enemy[]) {
    this.life--;
    if (!this.target || this.target.hp <= 0) {
      let minDist = 2000; 
      let candidate: Enemy | null = null;
      enemies.forEach(en => {
        const dx = this.x - en.x;
        const dy = this.y - en.y;
        const dz = this.z - en.z;
        const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d < minDist) { minDist = d; candidate = en; }
      });
      this.target = candidate;
    }
    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const dz = this.target.z - this.z;
      const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (d > 0) {
          const force = this.isEMP ? 0.8 : 0.4;
          this.vx += (dx/d) * force;
          this.vy += (dy/d) * force;
          this.z += (dz/d) * force * 2.0; 
      }
    }
    this.x += this.vx; this.y += this.vy;
    this.vx *= 0.96; this.vy *= 0.96;
  }
}

type GiftType = 'missile' | 'mine' | 'energy' | 'fuel' | 'weapon' | 'gold' | 'platinum' | 'lithium' | 'repair' | 'shield';

class Gift {
  x: number; y: number; z: number; vy: number = 1.8; type: GiftType;
  id?: string; name?: string;
  isPulled: boolean = false;
  rotation: number = 0;
  quantity?: number;
  constructor(x: number, y: number, type: GiftType, id?: string, name?: string, z: number = 0, quantity?: number) { 
    this.x = x; this.y = y; this.z = z; this.type = type; this.id = id; this.name = name;
    this.rotation = Math.random() * Math.PI * 2;
    this.quantity = quantity;
  }
}

class Asteroid {
  x: number; y: number; z: number; hp: number; maxHp: number;
  vx: number; vy: number; vz: number;
  size: number;
  variant: string; color: string;
  gasLeak: boolean = false;
  loot: { type: GiftType, id?: string, name?: string } | null = null;
  vertices: Point3D[] = [];
  faces: Face3D[] = [];
  angleX: number; angleY: number; angleZ: number;
  velX: number; velY: number; velZ: number;

  constructor(x: number, y: number, difficulty: number, isScavenge: boolean = false, startFromBottom: boolean = false) {
    this.x = x;
    this.z = (Math.random() - 0.5) * 600; 
    this.vz = (Math.random() - 0.5) * 0.5;
    this.y = startFromBottom ? 1200 : -150;
    
    if (startFromBottom) {
        this.vy = -(6.0 + Math.random() * 4.0); 
        this.vx = (Math.random() - 0.5) * 8.0;
    } else {
        if (Math.random() > 0.7) {
            this.vy = 1.0 + Math.random();
            this.vx = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 2.0);
        } else {
            this.vy = 2.0 + Math.random() * 3.0;
            this.vx = (Math.random() - 0.5) * 1.5;
        }
    }
    
    this.angleX = Math.random() * Math.PI * 2;
    this.angleY = Math.random() * Math.PI * 2;
    this.angleZ = Math.random() * Math.PI * 2;
    const sSpd = 0.03;
    this.velX = (Math.random() - 0.5) * sSpd;
    this.velY = (Math.random() - 0.5) * sSpd;
    this.velZ = (Math.random() - 0.5) * sSpd;

    const randType = Math.random();
    let baseVariant = 'junk';
    if (isScavenge) {
        if (randType < 0.4) baseVariant = 'gold'; 
        else if (randType < 0.7) baseVariant = 'platinum'; 
        else baseVariant = 'lithium'; 
    } else {
        if (randType < 0.15) baseVariant = 'blue_fuel'; 
        else if (randType < 0.45) baseVariant = 'brown_missile'; 
        else if (randType < 0.65) baseVariant = 'gray_mine'; 
        else baseVariant = 'junk';
    }
    this.variant = baseVariant;

    const randSize = Math.random();
    if (this.variant === 'blue_fuel') {
        this.color = '#3b82f6';
        if (randSize < 0.5) { this.size = 7 + Math.random()*2; this.hp = 150; } 
        else { this.size = 12 + Math.random()*2; this.hp = 300; } 
    } else if (this.variant === 'brown_missile') {
        this.color = '#92400e';
        if (randSize < 0.3) { this.size = 9 + Math.random()*2; this.hp = 200; } 
        else { this.size = 17 + Math.random()*3; this.hp = 600; } 
    } else if (this.variant === 'gray_mine') {
        this.color = '#71717a';
        if (randSize < 0.2) { this.size = 7 + Math.random()*2; this.hp = 150; } 
        else if (randSize < 0.6) { this.size = 20 + Math.random()*3; this.hp = 750; } 
        else { this.size = 30 + Math.random()*8; this.hp = 1750; this.color = '#52525b'; } 
    } else if (this.variant === 'junk') {
        this.color = '#57534e'; this.size = 14; this.hp = 300; 
    } else {
        this.size = 11; 
        if (this.variant === 'gold') { this.color = '#fbbf24'; this.hp = 1000; }
        else if (this.variant === 'platinum') { this.color = '#e2e8f0'; this.hp = 1500; }
        else { this.color = '#c084fc'; this.hp = 800; }
    }
    
    const r = Math.random();
    if (this.variant === 'blue_fuel') { this.loot = r < 0.8 ? { type: 'energy' } : { type: 'fuel' }; } 
    else if (this.variant === 'brown_missile') { 
        if (r < 0.5) this.loot = { type: 'missile' };
        else if (r < 0.6) this.loot = { type: 'gold', name: 'Gold' };
        else if (r < 0.65) this.loot = { type: 'platinum', name: 'Chrome' };
        else if (r < 0.70) this.loot = { type: 'lithium', name: 'Lithium' };
        else this.loot = { type: 'mine' };
    } else if (this.variant === 'gray_mine') { this.loot = r < 0.5 ? { type: 'mine' } : null; } 
    else if (this.variant === 'gold') { this.loot = r < 0.5 ? { type: 'gold', name: 'Gold' } : null; } 
    else if (this.variant === 'platinum') { this.loot = r < 0.5 ? { type: 'platinum', name: 'Platinum' } : null; } 
    else if (this.variant === 'lithium') { this.loot = r < 0.5 ? { type: 'lithium', name: 'Lithium' } : null; } 
    else { this.loot = r > 0.9 ? { type: 'energy' } : null; }

    this.maxHp = this.hp;
    this.generateFacetedMesh();
  }
  
  generateFacetedMesh() {
    const t = (1.0 + Math.sqrt(5.0)) / 2.0;
    const s = this.size;
    const baseVerts = [
      {x: -1, y: t, z: 0}, {x: 1, y: t, z: 0}, {x: -1, y: -t, z: 0}, {x: 1, y: -t, z: 0},
      {x: 0, y: -1, z: t}, {x: 0, y: 1, z: t}, {x: 0, y: -1, z: -t}, {x: 0, y: 1, z: -t},
      {x: t, y: 0, z: -1}, {x: t, y: 0, z: 1}, {x: -t, y: 0, z: -1}, {x: -t, y: 0, z: 1}
    ];
    this.vertices = baseVerts.map(v => ({ x: v.x * s * (0.8 + Math.random() * 0.4), y: v.y * s * (0.8 + Math.random() * 0.4), z: v.z * s * (0.8 + Math.random() * 0.4) }));
    const indices = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    indices.forEach(idx => { this.faces.push({ indices: idx, color: this.color, shadeOffset: 0.5 + Math.random() * 0.5 }); });
  }
}

class SpaceSystem {
    // REFACTORED: Now serves as a dynamic orbit simulator
    orbitAngle: number = 0;
    sunColor: string;
    quadrant: QuadrantType;
    otherPlanets: any[];
    
    constructor(w: number, h: number, quadrant: QuadrantType, currentPlanetId: string) {
        this.quadrant = quadrant;
        const colors = { [QuadrantType.ALFA]: '#facc15', [QuadrantType.BETA]: '#ef4444', [QuadrantType.GAMA]: '#60a5fa', [QuadrantType.DELTA]: '#000000' };
        this.sunColor = colors[quadrant];
        
        // Generate other planets to show in background
        const sectorPlanets = PLANETS.filter(p => p.quadrant === quadrant && p.id !== currentPlanetId);
        // Pick 2 random others to feature
        const chosen = sectorPlanets.sort(() => 0.5 - Math.random()).slice(0, 2);
        
        this.otherPlanets = chosen.map(p => ({
            color: p.color,
            size: p.size * 2, // Relative background size
            offset: Math.random() * Math.PI * 2,
            distance: 400 + Math.random() * 300,
            yOffset: (Math.random() - 0.5) * 300
        }));
    }
    
    update() {
        this.orbitAngle += 0.0005; // Slow rotation of the "view"
    }
}

const GameEngine: React.FC<GameEngineProps> = ({ ships, shield, secondShield, onGameOver, difficulty, currentPlanet, quadrant, fontSize }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  if (!ships || ships.length === 0) return <div className="p-20 text-center text-red-500 font-bold">SYSTEM ERROR</div>;
  const activeShip = ships[0];
  const maxEnergy = activeShip?.config?.maxEnergy || 1000;
  const initialFuel = activeShip?.fitting?.fuel || 0;
  const initialIntegrity = activeShip?.fitting?.health || 100;
  const maxFuelCapacity = activeShip?.config?.maxFuel || 1.0;
  const initialHullPacks = activeShip?.fitting?.hullPacks || 0;
  
  const fs = fontSize || 'medium';
  const hudText = fs === 'small' ? 'text-[11px]' : (fs === 'large' ? 'text-[15px]' : 'text-[13px]');
  const barText = fs === 'small' ? 'text-[9px]' : (fs === 'large' ? 'text-[13px]' : 'text-[11px]');
  const btnText = fs === 'small' ? 'text-[9px]' : (fs === 'large' ? 'text-[13px]' : 'text-[11px]');
  const lootFont = fs === 'small' ? 'bold 12px Arial' : (fs === 'large' ? 'bold 20px Arial' : 'bold 16px Arial');

  const gameEntityScale = fs === 'small' ? 0.5 : (fs === 'large' ? 0.8 : 0.65);
  const projectileScale = fs === 'small' ? 1.0 : (fs === 'large' ? 1.5 : 1.25);

  const gaugeW = fs === 'small' ? 'w-4' : (fs === 'large' ? 'w-10' : 'w-6');
  const gaugeH = fs === 'small' ? 'h-1' : (fs === 'large' ? 'h-2.5' : 'h-1.5');
  const gaugeGap = fs === 'small' ? 'gap-2' : (fs === 'large' ? 'gap-5' : 'gap-3');
  const ledGap = fs === 'small' ? 'gap-0.5' : (fs === 'large' ? 'gap-1' : 'gap-0.5');
  
  const topBarW = fs === 'small' ? 'w-44' : (fs === 'large' ? 'w-72' : 'w-56');
  const topBarH = fs === 'small' ? 'h-2' : (fs === 'large' ? 'h-5' : 'h-3.5');
  const hudGap = fs === 'small' ? 'gap-2' : (fs === 'large' ? 'gap-6' : 'gap-4');
  
  const btnPad = fs === 'small' ? 'px-4' : (fs === 'large' ? 'px-8' : 'px-6');
  const bottomBarHeight = fs === 'small' ? 'h-8' : (fs === 'large' ? 'h-14' : 'h-10');

  const MISSION_DURATION = 120 + (difficulty - 1) * 20; // Reduced travel time to fit new phases

  const [stats, setStats] = useState({ 
    hp: initialIntegrity, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, energy: maxEnergy, score: 0, missiles: activeShip?.fitting?.rocketCount || 0, mines: activeShip?.fitting?.mineCount || 0, fuel: initialFuel, hullPacks: initialHullPacks, boss: null as any, alert: "", scavengeTimer: 0, missionTimer: MISSION_DURATION, isPaused: false,
    cargoMissiles: 0, cargoMines: 0, energyDepleted: false, bossDead: false
  });

  const onGameOverRef = useRef(onGameOver);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  const stateRef = useRef({
    px: 0, py: 0, integrity: initialIntegrity, fuel: initialFuel, energy: maxEnergy, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, score: 0, hullPacks: initialHullPacks, sh1ShatterTime: 0, sh2ShatterTime: 0, missionTime: 0, autoRepair: { active: false, timer: 0, lastTick: 0 },
    bullets: [] as any[], enemyBullets: [] as any[], missiles: [] as Missile[], mines: [] as Mine[], enemies: [] as Enemy[], particles: [] as Particle[], stars: [] as any[], gifts: [] as Gift[], asteroids: [] as Asteroid[], spaceSystems: [] as SpaceSystem[], energyBolts: [] as EnergyBolt[],
    fireflies: Array.from({length: 12}).map(() => ({x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5, size: 2.5 + Math.random()*2.5, color: '#00f2ff'})),
    keys: new Set<string>(), lastFire: 0, lastSpawn: 0, lastAsteroidSpawn: 0, lastBoltSpawn: 0, sunSpawned: false, gameActive: true, frame: 0, missileStock: activeShip?.fitting?.rocketCount || 0, mineStock: activeShip?.fitting?.mineCount || 0, equippedWeapons: [...(activeShip?.fitting?.weapons || [])], bossSpawned: false, bossDead: false, lootPending: false, shake: 0, playerDead: false, playerExploded: false, deathSequenceTimer: 300, 
    // Phases: 'travel' -> 'scavenge' -> 'gap' -> 'observation' -> 'boss_fight'
    gamePhase: 'travel' as 'travel' | 'scavenge' | 'gap' | 'observation' | 'boss_fight', 
    scavengeTimeRemaining: 0, 
    gapTimer: 0,
    starDirection: { vx: 0, vy: 1 }, isMeltdown: false, meltdownTimer: 600,
    missionCargo: [...(activeShip?.fitting?.cargo || [])] as CargoItem[], reloading: { missiles: false, mines: false, fuel: false, repair: false, fuelFilling: false, fuelTarget: 0, energy: false, energyTimer: 0, energyActive: false }, isPaused: false, pauseStartTime: 0, observationTimer: 0, isInitialized: false,
    weaponCooldowns: {} as Record<string, number>,
    charging: { active: false, startTime: 0, level: 0, discharged: false },
    energyDepleted: false,
    lastHitTime: 0,
    gunHeat: 0,
    gunKick: 0,
    crystalExtension: 0,
    asteroidCycleStartTime: Date.now(),
    warpFactor: 1.0,
    missionDurationConsumed: 0,
    isOverdrive: false,
    cargoMissiles: 0,
    cargoMines: 0,
    hasOverheated: false,
    orbitVisuals: { sunScale: 1, planetScale: 1, planetX: 0, planetY: 0 }
  });

  const getHeatColor = (heat: number) => {
    if (heat < 0.2) return '#1c1917'; 
    if (heat < 0.4) return '#78350f'; 
    if (heat < 0.6) return '#dc2626'; 
    if (heat < 0.8) return '#ea580c'; 
    return '#facc15'; 
  };

  const getBarrelColor = (heat: number) => {
    if (heat < 0.2) return '#4b5563'; 
    if (heat < 0.5) return '#b91c1c'; 
    if (heat < 0.8) return '#ea580c'; 
    return '#ffffff'; 
  };

  const getGunAngle = (side: number, time: number, isExotic: boolean) => {
    const swiveling = stateRef.current.keys.has('ControlLeft') || stateRef.current.keys.has('ControlRight');
    if (!swiveling) return 0;
    const rad = Math.PI / 180;
    const oscillation = Math.sin(time / 1500 * Math.PI * 2) * 10 * rad;
    if (side === 0) return oscillation;
    if (side === -1) return oscillation;
    return -oscillation;
  };

  const createImpactEffect = (x: number, y: number, type: 'asteroid' | 'vessel' | 'shield', color?: string) => {
    const s = stateRef.current;
    if (type === 'asteroid') {
        s.particles.push({ x, y, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, life: 0.6, color: 'rgba(200,200,200,0.45)', size: 4 + Math.random()*10, type: 'smoke' });
        for(let i=0; i<4; i++) s.particles.push({ x, y, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6, life: 0.4 + Math.random()*0.3, color: '#4b5563', size: 1.5 + Math.random()*2, type: 'debris' });
    } else if (type === 'vessel') {
        for(let i=0; i<6; i++) {
            s.particles.push({ x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 0.3, color: '#facc15', size: 1.2, type: 'spark' });
        }
        s.particles.push({ x, y, vx: 0, vy: 0, life: 0.2, color: '#fff', size: 8, type: 'fire' });
    } else if (type === 'shield') {
        for(let i=0; i<5; i++) {
            s.particles.push({ x, y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 0.35, color: color || '#38bdf8', size: 2.2, type: 'plasma' });
        }
    }
  };

  const spawnAsteroidLoot = (x: number, y: number, loot: { type: GiftType, id?: string, name?: string } | null, z: number = 0) => {
    if (!loot) return;
    const s = stateRef.current;
    s.gifts.push(new Gift(x, y, loot.type, loot.id, loot.name, z));
  };

  const triggerChainReaction = (x: number, y: number, sourceId: any) => {
    const s = stateRef.current; const radius = 180; const chainDmg = 150 * (1 + (difficulty * 0.25)); 
    s.enemies.forEach(en => { if (en === sourceId) return; const dx = en.x - x, dy = en.y - y; if (Math.sqrt(dx*dx + dy*dy) < radius) applyDamageToEnemy(en, chainDmg, WeaponType.PROJECTILE, true); });
  };

  const createExplosion = (x: number, y: number, isBoss: boolean = false, isMine: boolean = false, isShieldOverload: boolean = false, customSmokeColor?: string) => {
    const s = stateRef.current; 
    if (isMine) {
        for(let i=0; i<8; i++) {
            s.particles.push({ x: x + (Math.random()-0.5)*20, y: y + (Math.random()-0.5)*20, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 0.7, color: Math.random() > 0.5 ? '#facc15' : '#ef4444', size: 30 + Math.random()*20, type: 'fire' });
        }
        for(let i=0; i<10; i++) {
            s.particles.push({ x, y, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, life: 1.5, color: 'rgba(50,50,50,0.8)', size: 40 + Math.random()*30, type: 'smoke' });
        }
        s.particles.push({ x, y, vx: 0, vy: 0, life: 0.3, color: '#ffffff', size: 90, type: 'shock' });
        return;
    }

    const count = isBoss ? 150 : (isShieldOverload ? 100 : 50); const now = Date.now();
    if (!s.playerDead && !s.playerExploded) {
        const dx = x - s.px, dy = y - s.py, d = Math.sqrt(dx*dx + dy*dy);
        if (d < 220) {
            let dmg = (isBoss ? 80 : (isMine ? 50 : 25)) * (1 - (d/280)); dmg *= 0.6; 
            const activeRed = (shield?.id === 'sh_beta' && s.sh1 > 0) || (secondShield?.id === 'sh_beta' && s.sh2 > 0);
            if (activeRed) dmg *= 0.05; 
            if (s.sh2 > 0) { s.sh2 -= dmg * 3; if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; } } 
            else if (s.sh1 > 0) { s.sh1 -= dmg * 3; if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; } } 
            else s.integrity -= dmg;
            if (dmg > 2) { s.shake = 30; audioService.playShieldHit(); }
        }
    }
    const vividColors = ['#ff0000', '#00ff00', '#3b82f6', '#facc15', '#f472b6', '#ffffff', '#00f2ff', '#a855f7'];
    const smokeCount = 20; 
    for (let i = 0; i < smokeCount; i++) {
        const angle = Math.random() * Math.PI * 2, speed = Math.random() * 3;
        const color = customSmokeColor || 'rgba(80,80,80,0.35)';
        s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.2 + Math.random(), size: 8 + Math.random() * 18, color: color, type: 'smoke' });
    }
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, speed = Math.random() * (isBoss ? 18 : 12);
      const type = Math.random() > 0.85 ? 'debris' : (Math.random() > 0.5 ? 'spark' : 'fire');
      const pColor = vividColors[Math.floor(Math.random() * vividColors.length)];
      s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.6 + Math.random() * 1.0, size: Math.random() * (isBoss ? 4 : 2) + 1, color: pColor, type });
    }
  };

  const applyDamageToEnemy = (en: Enemy, dmg: number, wType?: WeaponType, fromChain: boolean = false) => {
    const s = stateRef.current;
    
    if (en.sh > 0) {
        if (en.shieldImmunity === 'kinetic' && (wType === WeaponType.MISSILE || wType === WeaponType.MINE || wType === WeaponType.ROCKET)) {
            for(let i=0; i<3; i++) s.particles.push({ x: en.x, y: en.y + 60, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 0.4, color: '#f97316', size: 2, type: 'spark' });
            return;
        }
        if (en.shieldImmunity === 'energy' && (wType === WeaponType.LASER || wType === WeaponType.PROJECTILE)) {
            for(let i=0; i<3; i++) s.particles.push({ x: en.x, y: en.y + 60, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 0.4, color: '#3b82f6', size: 2, type: 'spark' });
            return;
        }
    }

    let finalDmg = dmg;
    if (wType === WeaponType.LASER || wType === WeaponType.EMP) finalDmg *= 6.0;
    else if (wType === WeaponType.PROJECTILE) finalDmg *= 2.23;

    if (en.sh > 0) { 
        const leftover = Math.max(0, finalDmg - en.sh); 
        en.sh = Math.max(0, en.sh - finalDmg); 
        if (leftover > 0) { en.hp -= leftover; en.burnLevel = 1; en.shieldRegenTimer = 0; } 
        audioService.playShieldHit(); 
    }
    else { 
      en.hp -= finalDmg; 
      en.burnLevel = 1; 
      if (en.hp < en.maxHp * 0.6) en.burnLevel = 2; 
      if (en.hp <= 0) {
        if (!fromChain) triggerChainReaction(en.x, en.y, en);
        const scaling = (1 + (difficulty - 1) * 0.1), baseVal = en.type === 'scout' ? 100 : (en.type === 'boss' ? 0 : 300);
        s.score += Math.floor(baseVal * scaling);
        if (en.type === 'boss' && !s.bossDead) { 
          s.score += Math.floor(10000 * Math.pow(1.3, difficulty - 1));
        } 
      }
    }
  };

  const spawnBossExplosions = (bx: number, by: number) => {
    const s = stateRef.current; 
    s.shake = 100; 
    
    // NEW LOGIC: When boss dies, immediate Victory Sequence (Landing)
    // No more scavenge phase AFTER boss.
    setStats(p => ({...p, alert: "TARGET NEUTRALIZED - ORBIT SECURED"}));
    
    const iters = 15; 
    for (let i = 0; i < iters; i++) { 
        setTimeout(() => { 
            const ex = bx + (Math.random() - 0.5) * 500, ey = by + (Math.random() - 0.5) * 500; 
            createExplosion(ex, ey, true); 
            audioService.playExplosion(0, 1.8); 
            s.shake = 55; 
        }, i * 100); 
    }
    
    // Drop the boss loot anyway (as a reward, even if we leave soon)
    if (Math.random() > 0.5) {
        const randomEx1 = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)];
        s.gifts.push(new Gift(bx, by, 'weapon', randomEx1.id, randomEx1.name)); 
    } else {
        s.gifts.push(new Gift(bx, by, 'gold', undefined, 'War Trophy'));
    }

    // Trigger Game Over (Victory) after explosions
    setTimeout(() => {
        onGameOverRef.current(true, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: true, health: s.integrity, hullPacks: s.hullPacks, cargo: s.missionCargo });
    }, 2500);
  };

  const drawShip = (ctx: CanvasRenderingContext2D, sInst: any, x: number, y: number, thrust: number, side: number, isBreaking: boolean, rotation: number = 0, isPlayer: boolean = false, warpFactor: number = 1.0, isOverdrive: boolean = false, scale: number = 0.5) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale); ctx.translate(-50, -50); if (!isPlayer) ctx.globalAlpha = 1;
    const { engines: engineCount, hullShapeType, wingStyle } = sInst.config;
    const gunHeatLevel = isPlayer ? Math.max(stateRef.current.gunHeat, stateRef.current.charging.level) : 0;
    const isOverheated = isPlayer ? stateRef.current.hasOverheated : false;
    
    let gunBodyColor = sInst.gunBodyColor || '#1c1917';
    if (isPlayer) {
        if (isOverheated) {
            gunBodyColor = '#3f2c22'; 
        } else if (gunHeatLevel > 0.4) {
            gunBodyColor = '#7f1d1d'; 
        }
    }

    const drawEngine = (ex: number, ey: number) => {
      if (isOverdrive && isPlayer) {
          const grad = ctx.createLinearGradient(ex, ey - 18, ex, ey + 8);
          grad.addColorStop(0, '#dc2626'); 
          grad.addColorStop(1, '#facc15'); 
          ctx.fillStyle = grad;
          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = 15;
      } else {
          ctx.fillStyle = sInst.engineColor || '#334155';
          ctx.shadowBlur = 0;
      }
      ctx.beginPath(); 
      if (ctx.roundRect) ctx.roundRect(ex - 9.6, ey - 8, 19.2, 20, 3);
      else ctx.rect(ex - 9.6, ey - 8, 19.2, 20);
      ctx.fill();
      ctx.shadowBlur = 0; 

      ctx.fillStyle = sInst.nozzleColor || '#171717'; 
      ctx.beginPath(); 
      // Smaller Nozzle (0.8x)
      ctx.moveTo(ex-8, ey+8); 
      ctx.lineTo(ex-9.6, ey+19.2); 
      ctx.quadraticCurveTo(ex, ey+24, ex+9.6, ey+19.2); 
      ctx.lineTo(ex+8, ey+8); 
      ctx.fill();
      
      if (thrust > 0) { 
          if (isOverdrive && isPlayer) {
              ctx.fillStyle = '#00f2ff'; 
              ctx.shadowColor = '#00f2ff';
              ctx.shadowBlur = 20;
          } else {
              ctx.fillStyle = sInst.type === 'boss' ? '#a855f7' : '#f97316'; 
              ctx.shadowBlur = 0;
          }
          
          ctx.globalAlpha = 0.4 + Math.random() * 0.4; 
          ctx.beginPath(); 
          const jetLen = (50 * thrust) * warpFactor;
          ctx.moveTo(ex-8, ey+15); ctx.lineTo(ex+8, ey+15); ctx.lineTo(ex, ey+15+jetLen+Math.random()*15); ctx.closePath(); ctx.fill(); 
          ctx.globalAlpha = 1; 
          ctx.shadowBlur = 0;
      }
    };
    if (engineCount === 1) drawEngine(50, 82); else { [25,75].forEach(ex => drawEngine(ex, 75)); }
    ctx.fillStyle = sInst.wingColor || '#64748b'; ctx.beginPath(); if (wingStyle === 'delta') { ctx.moveTo(35, 40); ctx.lineTo(4, 88); ctx.lineTo(50, 78); ctx.moveTo(65, 40); ctx.lineTo(96, 88); ctx.lineTo(50, 78); } else { ctx.ellipse(50, 60, 48, 18, 0, 0, Math.PI * 2); } ctx.fill();
    if (isBreaking) { ctx.fillStyle = '#f87171'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(30, 20); ctx.lineTo(30, -10); ctx.lineTo(35, 20); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(70, 20); ctx.lineTo(70, -10); ctx.lineTo(65, 20); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    if (side !== 0) { ctx.fillStyle = '#38bdf8'; ctx.globalAlpha = 0.9; const wx = side < 0 ? 85 : 15, sDir = side < 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(wx, 55); ctx.lineTo(wx + (sDir * 35), 55); ctx.lineTo(wx, 60); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = sInst.color || '#94a3b8'; 
    ctx.beginPath(); if (hullShapeType === 'triangle') { ctx.moveTo(50, 10); ctx.lineTo(80, 85); ctx.lineTo(20, 85); } else { if (ctx.roundRect) ctx.roundRect(30, 15, 40, 75, 12); else ctx.rect(30, 15, 40, 75); } ctx.fill();
    
    const renderGun = (gx: number, gy: number, sc: number, gunSide: number) => { 
        const isExotic = EXOTIC_WEAPONS.some(ex => ex.id === sInst.fitting?.weapons[0]?.id);
        const gunAngle = isPlayer ? getGunAngle(gunSide, Date.now(), isExotic) : 0;
        const kick = isPlayer ? stateRef.current.gunKick : 0;
        const crystalExt = isPlayer ? stateRef.current.crystalExtension : 1.0; 
        
        const recoil = kick * 10;
        const extension = crystalExt * 15;
        const netMovement = extension - recoil;

        // Larger Gun Body (1.2 * 1.1 = 1.32)
        ctx.save(); ctx.translate(gx, gy); ctx.scale(sc * 1.32, sc * 1.32); ctx.rotate(gunAngle);
        
        if (isPlayer) {
            ctx.fillStyle = getBarrelColor(gunHeatLevel);
            if (gunHeatLevel > 0.5) {
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = (gunHeatLevel - 0.5) * 10; // Reduced blur to avoid bubble look
            }
        } else {
            ctx.fillStyle = sInst.gunColor || '#60a5fa';
        }
        
        const barrelY = -18 - netMovement; 
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-4, barrelY, 8, 22, 2); // Smaller radius to look less like a ball
        else ctx.rect(-4, barrelY, 8, 22);
        ctx.fill();
        ctx.shadowBlur = 0; 

        ctx.fillStyle = gunBodyColor;
        if (isPlayer && gunHeatLevel > 0.6 && !isOverheated) {
             ctx.shadowColor = '#dc2626';
             ctx.shadowBlur = 10;
        }
        ctx.fillRect(-9, -10, 18, 30); 
        ctx.shadowBlur = 0; 
        
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-9, -6, 18, 2); ctx.fillRect(-9, -1, 18, 2); ctx.fillRect(-9, 4, 18, 2); ctx.fillRect(-9, 9, 18, 2);
        
        if (isPlayer && gunHeatLevel > 0.6 && !isOverheated && Math.random() > 0.85) {
             stateRef.current.particles.push({
                 x: gx + sInst.x + (Math.random()-0.5)*10, 
                 y: gy + sInst.y - 10,
                 vx: (Math.random()-0.5), 
                 vy: -2 - Math.random(), 
                 life: 0.8, 
                 color: 'rgba(80, 80, 80, 0.4)', 
                 size: 2 + Math.random()*3, 
                 type: 'smoke' 
             });
        }

        ctx.restore(); 
    };
    if (sInst.config.defaultGuns === 1) { renderGun(50, 15, 0.35, 0); } else { renderGun(25, 45, 0.55, -1); renderGun(75, 45, 0.55, 1); }
    ctx.fillStyle = sInst.cockpitColor || '#38bdf8'; ctx.beginPath(); ctx.ellipse(50, (hullShapeType === 'triangle' ? 58 : 38), 9, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };

  const togglePause = () => { const s = stateRef.current; s.isPaused = !s.isPaused; if (s.isPaused) { s.pauseStartTime = Date.now(); s.keys.clear(); } setStats(p => ({ ...p, isPaused: s.isPaused })); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };

  const fireWeapons = (multiplier: number = 1.0, isRapidFire: boolean = false, bypassCooldown: boolean = false, variant: 'normal' | 'mega' | 'heavy_auto' = 'normal') => {
    const s = stateRef.current;
    if (s.energyDepleted || s.energy <= 0 || s.isMeltdown || s.playerDead) return;
    if (s.warpFactor > 1.5) return; 
    if (s.gunHeat >= 1.0 && !bypassCooldown && variant !== 'mega') return;
    
    const now = Date.now();
    const numGuns = activeShip.config.defaultGuns;
    let fired = false;
    let isKineticFire = false;

    for (let i = 0; i < numGuns; i++) {
        const w = s.equippedWeapons[i]; if (!w) continue;
        const weaponDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(wd => wd.id === w.id); if (!weaponDef) continue;
        let rateDivisor = 1.0; if (variant === 'heavy_auto') rateDivisor = 0.5; 
        const cooldown = 1000 / (weaponDef.fireRate * rateDivisor);
        const cooldownKey = `slot_${i}`;
        if (!bypassCooldown && now - (s.weaponCooldowns[cooldownKey] || 0) < cooldown) continue;
        s.weaponCooldowns[cooldownKey] = now;
        const xOff = numGuns === 1 ? 0 : (i === 0 ? -12.5 : 12.5);
        let damageMult = multiplier; let sizeMult = 1.0;
        if (variant === 'mega') damageMult = 10.0; else if (variant === 'heavy_auto') damageMult = 3.0; else sizeMult = 1.0;
        const isExotic = EXOTIC_WEAPONS.some(ex => ex.id === weaponDef.id);
        const gunSide = numGuns === 1 ? 0 : (i === 0 ? -1 : 1);
        const angle = getGunAngle(gunSide, now, isExotic);
        const speed = 24; const vx = Math.sin(angle) * speed; const vy = -Math.cos(angle) * speed;
        const baseB: any = { x: s.px + xOff, y: s.py - 35, vx: vx, vy: vy, damage: weaponDef.damage * damageMult * (1 + (difficulty*0.18)), type: weaponDef.id, beamColor: weaponDef.beamColor || '#fff', timer: 0, target: null, size: 3.5 * sizeMult, isBeam: false, xOffset: xOff, wType: weaponDef.type, power: multiplier, variant: variant };
        if (weaponDef.id === 'exotic_wave') baseB.visualType = 'ring';
        else if (weaponDef.id === 'exotic_bolt' || weaponDef.id === 'exotic_mining_laser') baseB.visualType = 'thunder';
        else if (weaponDef.id === 'exotic_bubbles' || weaponDef.id === 'exotic_nova' || weaponDef.id === 'exotic_gravity') baseB.visualType = 'solid_glow';
        else if (weaponDef.id === 'exotic_fan' || weaponDef.id === 'exotic_arc' || weaponDef.id === 'exotic_venom') baseB.visualType = 'spindle';
        else if (weaponDef.id === 'exotic_seeker' || weaponDef.id === 'exotic_plasma_ball' || weaponDef.id === 'exotic_flame') baseB.visualType = 'comet';
        s.bullets.push(baseB);
        const pan = xOff < 0 ? -0.4 : 0.4;
        
        let sfxType: 'laser' | 'cannon' | 'rocket' | 'emp' | 'mega' | 'missile' | 'mine' = 'cannon';
        if (variant === 'mega') sfxType = 'mega';
        else if (weaponDef.type === WeaponType.LASER) sfxType = 'laser';
        else if (weaponDef.type === WeaponType.ROCKET) sfxType = 'rocket';
        else if (weaponDef.type === WeaponType.EMP) sfxType = 'emp';
        else if (weaponDef.type === WeaponType.MISSILE) sfxType = 'missile';
        
        audioService.playWeaponFire(sfxType, pan);
        
        const efficiency = isExotic ? 0.3 : 1.2;
        const powerFactor = (variant === 'mega' ? 10 : (variant === 'heavy_auto' ? 3 : 1));
        s.energy -= (weaponDef.energyCost / 20) * multiplier * efficiency * powerFactor;
        fired = true;

        if (weaponDef.type === WeaponType.PROJECTILE || weaponDef.type === WeaponType.MISSILE) {
            isKineticFire = true;
            const muzzleX = s.px + xOff + (Math.sin(angle) * 40); 
            const muzzleY = s.py - 35 - (Math.cos(angle) * 40);
            
            // Flame
            stateRef.current.particles.push({
                x: muzzleX, y: muzzleY, 
                vx: s.starDirection.vx * 0.5 + (Math.random()-0.5), 
                vy: -2,
                life: 0.15, color: '#ffff00', size: 6 + Math.random() * 4, type: 'fire'
            });
            // Smoke
            stateRef.current.particles.push({
                x: muzzleX, y: muzzleY,
                vx: (Math.random()-0.5)*0.5, vy: 1, 
                life: 0.4, color: 'rgba(100,100,100,0.3)', size: 4, type: 'smoke'
            });
        }
    }
    if (fired) {
        // Stronger recoil for projectile
        s.gunKick = isKineticFire ? 1.8 : 1.0;
        if (variant === 'normal') s.gunHeat = Math.min(1.0, s.gunHeat + 0.005); 
        else if (variant === 'mega') s.gunHeat = 1.0; 
        else if (variant === 'heavy_auto') s.gunHeat = Math.min(1.0, s.gunHeat + 0.1);
        
        if (s.gunHeat >= 1.0) s.hasOverheated = true;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    if (stateRef.current.px === 0) { stateRef.current.px = window.innerWidth / 2; stateRef.current.py = window.innerHeight * 0.85; }
    
    const starColors = ['#ffffff', '#fef08a']; 
    
    const generateStars = (w: number, h: number) => { 
        stateRef.current.stars = Array.from({ length: 300 }).map(() => ({ 
            x: Math.random() * w, 
            y: Math.random() * h, 
            s: Math.random() * 2.8, 
            v: 0.15 + Math.random() * 0.6, 
            color: starColors[Math.floor(Math.random() * starColors.length)],
            shimmer: Math.random() > 0.8, 
            shimmerPhase: Math.random() * Math.PI * 2
        })); 
    };
    
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; generateStars(canvas.width, canvas.height); const s = stateRef.current; s.px = Math.max(35, Math.min(canvas.width - 35, s.px)); s.py = Math.max(35, Math.min(canvas.height - 110, s.py)); s.bullets = []; s.enemyBullets = []; if (s.isInitialized && s.gameActive && !s.playerDead && !s.isPaused) { s.isPaused = true; s.pauseStartTime = Date.now(); s.keys.clear(); setStats(p => ({ ...p, isPaused: true })); } };
    const handleBlur = () => { const s = stateRef.current; if (s.gameActive && !s.playerDead && !s.isPaused) { s.isPaused = true; s.pauseStartTime = Date.now(); s.keys.clear(); setStats(p => ({ ...p, isPaused: true })); } };
    resize(); window.addEventListener('resize', resize); window.addEventListener('blur', handleBlur); stateRef.current.isInitialized = true;
    
    const handleKey = (e: KeyboardEvent, isDown: boolean) => { 
        const s = stateRef.current; 
        const now = Date.now();
        if (['Tab', 'CapsLock', 'ShiftLeft', 'Space'].includes(e.code)) e.preventDefault();
        if (e.code === 'Space') {
            if (isDown && !s.keys.has('Space')) { 
                s.charging.active = true; 
                s.charging.startTime = now; 
                s.keys.add('Space'); 
                audioService.startCharging();
            } 
            else if (!isDown) {
                audioService.stopCharging();
                if (s.charging.active) {
                    const dur = now - s.charging.startTime;
                    if (dur < 1500) { const ratio = Math.min(1.0, dur / 1500); const power = 1.0 + (ratio * 9.0); fireWeapons(power, false, true, 'mega'); }
                }
                s.charging.active = false; s.keys.delete('Space');
            }
            return;
        }
        if (isDown) s.keys.add(e.code); else s.keys.delete(e.code); 
        if (isDown && s.isPaused && e.code === 'KeyP') { togglePause(); return; }
        if (isDown && e.code === 'KeyP') { togglePause(); return; }
        if (isDown && e.code === 'Escape') { s.gameActive = false; const finalHP = s.isMeltdown ? 25 : Math.max(0, s.integrity); onGameOverRef.current(false, s.score, true, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: finalHP, hullPacks: s.hullPacks, cargo: s.missionCargo }); } 
        if (isDown && (e.code === 'Backslash' || e.code === 'Tab') && !s.playerDead && !s.isPaused) { if (s.missileStock > 0) { s.missileStock--; const isEmp = ships[0].fitting.weapons.some(w => w.id === 'ord_missile_emp'); s.missiles.push(new Missile(s.px, s.py - 40, (Math.random() - 0.5) * 4, -7.0, false, isEmp)); audioService.playWeaponFire('missile'); } } 
        if (isDown && (e.code === 'Enter' || e.code === 'CapsLock') && !s.playerDead && !s.isPaused) { 
            if (s.mineStock > 0) { 
                s.mineStock--; 
                const hasEmpTech = ships[0].fitting.cargo.some(c => c.id === 'ord_mine_emp');
                s.mines.push(new Mine(s.px, s.py, hasEmpTech)); 
                audioService.playWeaponFire('mine'); 
            } 
        } 
    };
    
    window.addEventListener('keydown', (e) => handleKey(e, true)); window.addEventListener('keyup', (e) => handleKey(e, false));
    let anim: number;
    const loop = () => {
      const s = stateRef.current; if (!s.gameActive) return; s.frame++; const pSpeed = 10.5, now = Date.now();
      const isVertical = !s.playerDead && (s.keys.has('KeyW') || s.keys.has('ArrowUp') || s.keys.has('KeyS') || s.keys.has('ArrowDown'));
      if (!s.isPaused) {
        const isTryingToWarp = s.keys.has('KeyW') || s.keys.has('ArrowUp');
        const topLimit = 135; 
        const isInWarpZone = s.py < (canvas.height * 0.4); 
        const fuelPct = s.fuel / maxFuelCapacity;
        const canTurbo = fuelPct > 0.2; 
        let targetWarp = 1.0;
        s.isOverdrive = false; 
        if (isTryingToWarp && isInWarpZone && s.fuel > 0 && canTurbo) { targetWarp = 4.0; s.py = Math.max(topLimit, s.py - pSpeed); s.fuel = Math.max(0, s.fuel - 0.00225); s.shake = 5; s.isOverdrive = true; } else { targetWarp = 1.0; }
        if (s.py < topLimit) s.py = topLimit;
        s.warpFactor += (targetWarp - s.warpFactor) * 0.1;
        const deltaMs = 16.66;
        
        // --- GAME PHASE LOGIC UPDATE ---
        // Flow: Travel -> Harvest (Scavenge) -> Gap -> Arrival -> Boss
        
        if (s.gamePhase === 'travel') {
            s.missionDurationConsumed += (deltaMs * s.warpFactor) / 1000;
            if (s.missionDurationConsumed >= MISSION_DURATION) {
                s.gamePhase = 'scavenge';
                s.scavengeTimeRemaining = 1200; // 20 seconds at 60fps
                setStats(p => ({...p, alert: "ENTERING DEBRIS FIELD - HARVEST PROTOCOL"}));
            }
        } else if (s.gamePhase === 'scavenge') {
            s.scavengeTimeRemaining--;
            // Scavenge handled below in spawn logic
            if (s.scavengeTimeRemaining <= 0) {
                s.gamePhase = 'gap';
                s.gapTimer = 600; // 10 seconds
                setStats(p => ({...p, alert: "APPROACHING PLANETARY ORBIT"}));
            }
        } else if (s.gamePhase === 'gap') {
            s.gapTimer--;
            if (s.gapTimer <= 0) {
                s.gamePhase = 'observation';
                s.observationTimer = 0;
                setStats(p => ({...p, alert: "PLANETARY ARRIVAL"}));
                if (!s.sunSpawned) { 
                    s.spaceSystems.push(new SpaceSystem(canvas.width, canvas.height, quadrant, currentPlanet.id)); 
                    s.sunSpawned = true; 
                }
            }
        } else if (s.gamePhase === 'observation') {
            s.observationTimer++;
            if (s.observationTimer > 360) { // 6 seconds of looking at planet
                s.gamePhase = 'boss_fight';
                s.bossSpawned = true;
                s.enemies.push(new Enemy(canvas.width/2, -450, 'boss', BOSS_SHIPS[Math.floor(Math.random() * BOSS_SHIPS.length)], difficulty));
                setStats(p => ({ ...p, alert: "BOSS INTERCEPTION" }));
            }
        }

        const isSpace = s.keys.has('Space');
        const isControl = s.keys.has('ControlLeft') || s.keys.has('ControlRight');
        const isShift = s.keys.has('ShiftLeft') || s.keys.has('ShiftRight');
        const isWeaponActive = isControl || isShift || isSpace;
        if (isWeaponActive) s.crystalExtension = Math.min(1, s.crystalExtension + 0.1); else s.crystalExtension = Math.max(0, s.crystalExtension - 0.1);
        if (isSpace) { const chargeDur = now - s.charging.startTime; s.charging.level = Math.min(1.0, chargeDur / 1500); if (chargeDur >= 1500) { audioService.stopCharging(); fireWeapons(1.0, false, false, 'heavy_auto'); } } else { s.charging.level = 0; if (isControl || isShift) fireWeapons(1.0, true, false, 'normal'); }
        s.gunKick *= 0.85;
        if (!isWeaponActive && s.gunHeat > 0) {
            s.gunHeat = Math.max(0, s.gunHeat - 0.015);
            if (s.gunHeat <= 0) s.hasOverheated = false;
        }
        
        if (!s.playerDead && !s.playerExploded) {
            if (s.fuel <= 0) { s.py += 0.8; } else if (isVertical) { if (s.keys.has('KeyW') || s.keys.has('ArrowUp')) { if (!s.isOverdrive) { s.py -= pSpeed; s.fuel = Math.max(0, s.fuel - 0.0015); } } if (s.keys.has('KeyS') || s.keys.has('ArrowDown')) s.py += pSpeed; }
            if (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) { s.px -= pSpeed; s.starDirection.vx = 2.4; s.fuel = Math.max(0, s.fuel - 0.0005); } else if (s.keys.has('KeyD') || s.keys.has('ArrowRight')) { s.px += pSpeed; s.starDirection.vx = -2.4; s.fuel = Math.max(0, s.fuel - 0.0005); } else s.starDirection.vx *= 0.93;
            s.px = Math.max(35, Math.min(canvas.width - 35, s.px)); s.py = Math.max(35, Math.min(canvas.height - 110, s.py)); 
            const isShooting = isWeaponActive;
            const wasHitRecently = (now - s.lastHitTime) < 500;
            if (s.energyDepleted) { if (s.energy >= maxEnergy) { s.energyDepleted = false; s.energy = maxEnergy; setStats(p => ({ ...p, alert: "REACTOR RESTARTED" })); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); } else { const regenRate = (isShooting || wasHitRecently) ? 0 : (maxEnergy / 120); s.energy += regenRate; } } else { if (s.energy <= 0) { s.energy = 0; s.energyDepleted = true; s.charging.active = false; setStats(p => ({ ...p, alert: "ENERGY DEPLETED - RECHARGING" })); audioService.playSfx('denied'); } else { s.energy = Math.min(maxEnergy, s.energy + 4.0); } }
            if ((s.energy / maxEnergy) < 0.2 && !s.reloading.energy && !s.isMeltdown) { const battIdx = s.missionCargo.findIndex(i => i.type === 'energy'); if (battIdx !== -1) { s.reloading.energy = true; s.reloading.energyTimer = 300; setStats(p => ({ ...p, alert: "AUX POWER SEQUENCE INITIATED: 5s" })); } }
            if (s.reloading.energy) { s.reloading.energyTimer--; if (s.reloading.energyTimer % 60 === 0 && s.reloading.energyTimer > 0) { setStats(p => ({ ...p, alert: `AUX POWER INJECTION IN: ${s.reloading.energyTimer / 60}s` })); } if (s.reloading.energyTimer <= 0) { const battIdx = s.missionCargo.findIndex(i => i.type === 'energy'); const item = s.missionCargo[battIdx]; if (battIdx !== -1 && item) { if (item.quantity > 1) item.quantity--; else s.missionCargo.splice(battIdx, 1); s.energyDepleted = false; s.reloading.energyActive = true; s.reloading.energy = false; audioService.playSfx('buy'); setStats(p => ({ ...p, alert: "AUX POWER ENGAGED - RECHARGING" })); } else s.reloading.energy = false; } }
            if (s.reloading.energyActive) { const rate = maxEnergy / 60; s.energy = Math.min(maxEnergy, s.energy + rate); if (s.energy >= maxEnergy) { s.reloading.energyActive = false; setStats(p => ({ ...p, alert: "ENERGY CELLS STABILIZED" })); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); } }
            if (!s.energyDepleted) { if (shield && s.sh1 > 0) { const isExotic = EXOTIC_SHIELDS.some(ex => ex.id === shield.id); s.energy -= (shield.energyCost * (isExotic ? 0.01 : 0.04)); } if (secondShield && s.sh2 > 0) { const isExotic = EXOTIC_SHIELDS.some(ex => ex.id === secondShield.id); s.energy -= (secondShield.energyCost * (isExotic ? 0.01 : 0.04)); } }
            if (s.fuel <= 0 && !s.reloading.fuel && !s.isMeltdown) { const cargoIdx = s.missionCargo.findIndex(i => i.type === 'fuel'); if (cargoIdx !== -1) { s.reloading.fuel = true; setStats(p => ({ ...p, alert: "TRANSFERRING AUXILIARY FUEL..." })); } }
            if (s.reloading.fuel) { const chargeRate = 0.1 / 60; s.fuel = Math.min(maxFuelCapacity, s.fuel + chargeRate); if (!s.reloading.fuelFilling) { s.reloading.fuelFilling = true; const idx = s.missionCargo.findIndex(i => i.type === 'fuel'); const item = s.missionCargo[idx]; if (idx !== -1 && item) { if (item.quantity > 1) item.quantity--; else s.missionCargo.splice(idx, 1); setTimeout(() => { s.reloading.fuel = false; s.reloading.fuelFilling = false; }, 10000); } else s.reloading.fuel = false; } }
            if (s.missileStock <= 0 && !s.reloading.missiles && !s.isMeltdown) { const cargoIdx = s.missionCargo.findIndex(i => i.type === 'missile'); if (cargoIdx !== -1) { s.reloading.missiles = true; setStats(p => ({ ...p, alert: "RELOADING MISSILES (10s)..." })); setTimeout(() => { const idx = s.missionCargo.findIndex(i => i.type === 'missile'); const item = s.missionCargo[idx]; if (idx !== -1 && item) { s.missileStock = Math.min(50, s.missileStock + 10); if (item.quantity > 1) item.quantity--; else s.missionCargo.splice(idx, 1); setStats(p => ({ ...p, alert: "MISSILES LOADED" })); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); } s.reloading.missiles = false; }, 10000); } }
            if (s.mineStock <= 0 && !s.reloading.mines && !s.isMeltdown) { const cargoIdx = s.missionCargo.findIndex(i => i.type === 'mine'); if (cargoIdx !== -1) { s.reloading.mines = true; setStats(p => ({ ...p, alert: "RELOADING MINES (10s)..." })); setTimeout(() => { const idx = s.missionCargo.findIndex(i => i.type === 'mine'); const item = s.missionCargo[idx]; if (idx !== -1 && item) { s.mineStock = Math.min(50, s.mineStock + 10); if (item.quantity > 1) item.quantity--; else s.missionCargo.splice(idx, 1); setStats(p => ({ ...p, alert: "MINES LOADED" })); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); } s.reloading.mines = false; }, 10000); } }
            if (s.integrity < 20 && !s.reloading.repair && !s.autoRepair.active && !s.isMeltdown) { const cargoIdx = s.missionCargo.findIndex(i => i.type === 'repair'); if (cargoIdx !== -1) { s.reloading.repair = true; setStats(p => ({ ...p, alert: "REPAIRING..." })); setTimeout(() => { const idx = s.missionCargo.findIndex(i => i.type === 'repair'); const item = s.missionCargo[idx]; if (idx !== -1 && item) { s.integrity = Math.min(100, s.integrity + 20); if (item.quantity > 1) item.quantity--; else s.missionCargo.splice(idx, 1); setStats(p => ({ ...p, alert: "RESTORED" })); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); } s.reloading.repair = false; }, 3000); } }
            if (shield && s.sh1 < shield.capacity && !s.energyDepleted) { const isBroken = s.sh1 <= 0, t = now - s.sh1ShatterTime; if (!isBroken || t > 10000) { const rv = shield.regenRate * 0.16, rc = shield.energyCost * 0.032; if (s.energy >= rc) { s.sh1 = Math.min(shield.capacity, s.sh1 + rv); s.energy -= rc; if (isBroken && s.sh1 > 0) setStats(p => ({ ...p, alert: "PRIMARY SHIELD REBOOTED" })); } } }
            if (secondShield && s.sh2 < secondShield.capacity && !s.energyDepleted) { const isBroken = s.sh2 <= 0, t = now - s.sh2ShatterTime; if (!isBroken || t > 10000) { const rv = secondShield.regenRate * 0.16, rc = secondShield.energyCost * 0.032; if (s.energy >= rc) { s.sh2 = Math.min(secondShield.capacity, s.sh2 + rv); s.energy -= rc; if (isBroken && s.sh2 > 0) setStats(p => ({ ...p, alert: "SECONDARY SHIELD REBOOTED" })); } } }
            if (s.integrity < 10 && s.hullPacks > 0 && !s.autoRepair.active && !s.isMeltdown) { s.autoRepair.active = true; s.autoRepair.timer = 10; s.autoRepair.lastTick = now; s.hullPacks--; setStats(p => ({ ...p, alert: `CRITICAL HULL - AUTO-REPAIR IN: 10s` })); }
            if (s.autoRepair.active) { if (now - s.autoRepair.lastTick > 1000) { s.autoRepair.timer--; s.autoRepair.lastTick = now; if (s.autoRepair.timer > 0) setStats(p => ({ ...p, alert: `CRITICAL HULL - AUTO-REPAIR IN: ${s.autoRepair.timer}s` })); else { s.integrity = Math.min(100, s.integrity + 20); s.autoRepair.active = false; setStats(p => ({ ...p, alert: "RESTORED" })); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); } } }
            if (s.integrity <= 0 && !s.isMeltdown && !s.playerExploded) { s.isMeltdown = true; s.meltdownTimer = 600; setStats(p => ({ ...p, alert: "REACTOR MELTDOWN - ABORT NOW" })); }
            if (s.isMeltdown) { s.meltdownTimer--; s.fuel = Math.max(0, s.fuel - (maxFuelCapacity / 600)); s.integrity = Math.max(0, s.integrity - 0.1); setStats(p => ({ ...p, alert: `MELTDOWN T-MINUS: ${Math.ceil(s.meltdownTimer/60)}s` })); if (s.meltdownTimer <= 0) { s.isMeltdown = false; s.playerExploded = true; s.deathSequenceTimer = 300; createExplosion(s.px, s.py, true, false, false, '#f97316'); audioService.playExplosion(0, 2.5); } if (s.frame % 2 === 0) { s.particles.push({ x: s.px + (Math.random()-0.5)*40, y: s.py + (Math.random()-0.5)*40, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 0.8, color: '#f97316', size: 10, type: 'fire' }); s.particles.push({ x: s.px + (Math.random()-0.5)*30, y: s.py + (Math.random()-0.5)*30, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 1.0, color: 'rgba(50,50,50,0.6)', size: 15, type: 'smoke' }); } }
        }
        
        if (s.integrity < 100 && !s.playerExploded) { if (s.frame % 5 === 0) { s.particles.push({ x: s.px + (Math.random()-0.5)*15, y: s.py + 10, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2 + 3, life: 0.8, color: 'rgba(60,60,60,0.5)', size: 8 + Math.random()*8, type: 'smoke' }); if (s.integrity < 60) { s.particles.push({ x: s.px + (Math.random()-0.5)*10, y: s.py + 5, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3 + 2, life: 0.5, color: '#ef4444', size: 4 + Math.random()*4, type: 'fire' }); } } }
        if (s.playerExploded) { s.deathSequenceTimer--; if (s.deathSequenceTimer <= 0) { s.playerDead = true; } }
        
        // --- SPAWN LOGIC PER PHASE ---
        const isTravel = s.gamePhase === 'travel';
        const isScavenge = s.gamePhase === 'scavenge';
        const isGap = s.gamePhase === 'gap';
        const isArrival = s.gamePhase === 'observation';
        const isBoss = s.gamePhase === 'boss_fight';

        // Spawn Asteroids
        if ((isTravel || isScavenge) && s.asteroids.length < (isScavenge ? 10 : 8) && now - s.lastAsteroidSpawn > (isScavenge ? 800 : 2000)) { 
            const fromBottom = Math.random() < 0.2; 
            s.asteroids.push(new Asteroid(Math.random() * canvas.width, -180, difficulty, isScavenge, fromBottom)); 
            s.lastAsteroidSpawn = now; 
        }
        
        // Spawn Enemies (Only in Travel)
        const maxAliens = difficulty < 5 ? 4 : 7;
        if (isTravel && s.enemies.length < maxAliens && now - s.lastSpawn > (1800 / Math.sqrt(Math.max(1, difficulty)))) { 
            const shipIdx = Math.min(SHIPS.length - 1, Math.floor(Math.random() * (difficulty + 1))); 
            s.enemies.push(new Enemy(Math.random() * (canvas.width - 120) + 60, -150, 'fighter', SHIPS[shipIdx], difficulty)); 
            s.lastSpawn = now; 
        }

        // Logic Updates
        for (let i = s.mines.length - 1; i >= 0; i--) { const m = s.mines[i]; m.update(s.enemies); if (m.life <= 0) { createExplosion(m.x, m.y, false, true, false); s.mines.splice(i, 1); } else if (m.y < -200 || m.y > canvas.height + 200) s.mines.splice(i, 1); else { for (let j = s.enemies.length - 1; j >= 0; j--) { const en = s.enemies[j]; if (Math.abs(en.z - m.z) < 120 && Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 55) { applyDamageToEnemy(en, m.damage, WeaponType.MINE); createExplosion(m.x, m.y, false, true, false); s.mines.splice(i, 1); if (en.hp <= 0) { if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } s.enemies.splice(j, 1); } break; } } } }
        for (let i = s.missiles.length - 1; i >= 0; i--) { const m = s.missiles[i]; if (!m.target || m.target.hp <= 0) { let close = 1000; s.enemies.forEach(e => { const d = Math.sqrt((e.x - m.x)**2 + (e.y - m.y)**2); if (d < close) { close = d; m.target = e; } }); } if (m.target) { const dx = m.target.x - m.x; const dy = m.target.y - m.y; const dz = m.target.z - m.z; const dist = Math.sqrt(dx*dx + dy*dy); if (dist > 0) { m.vx += (dx/dist) * 0.5; m.vy += (dy/dist) * 0.5; m.z += dz * 0.05; } } const speed = Math.sqrt(m.vx*m.vx + m.vy*m.vy); if (speed > 12) { m.vx *= 0.9; m.vy *= 0.9; } m.x += m.vx; m.y += m.vy; m.life--; if (s.frame % 3 === 0) s.particles.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 0.6, color: 'rgba(100,100,100,0.5)', size: 4, type: 'smoke' }); let hit = false; for (let j = s.enemies.length - 1; j >= 0; j--) { const en = s.enemies[j]; if (Math.abs(m.z - en.z) < 100 && Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 40) { applyDamageToEnemy(en, m.damage, WeaponType.MISSILE); createExplosion(m.x, m.y, false, false, false, '#fb923c'); hit = true; if (en.hp <= 0) { if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } s.enemies.splice(j, 1); } break; } } if (hit || m.life <= 0 || m.y < -100 || m.y > canvas.height + 100) { s.missiles.splice(i, 1); } }
        for (let j = s.enemies.length - 1; j >= 0; j--) { const en = s.enemies[j]; en.y += (s.warpFactor - 1) * 3; const droppedMine = en.updateAI(s.px, s.py, s.asteroids, s.enemies); if (droppedMine) { s.mines.push(new Mine(en.x, en.y + 40, false, en.z)); } const distToP = Math.sqrt((en.x - s.px)**2 + (en.y - s.py)**2); if (Math.abs(en.z) < 60 && distToP < 50 && !s.playerDead && !s.playerExploded) { createExplosion(en.x, en.y, en.type === 'boss'); en.hp = 0; const ramDmg = 50; if (s.sh2 > 0) { s.sh2 = Math.max(0, s.sh2 - ramDmg * 1.5); if (s.sh2 <= 0) s.sh2ShatterTime = now; } else if (s.sh1 > 0) { s.sh1 = Math.max(0, s.sh1 - ramDmg * 1.5); if (s.sh1 <= 0) s.sh1ShatterTime = now; } else { s.integrity -= ramDmg; s.shake = 20; } audioService.playShieldHit(); } for (let k = s.asteroids.length - 1; k >= 0; k--) { const ast = s.asteroids[k]; if (Math.abs(en.z - ast.z) > 60) continue; const dist = Math.sqrt((en.x - ast.x)**2 + (en.y - ast.y)**2); if (en.type === 'boss' && dist < (en.sh > 0 ? 80 : 60) + ast.size) { const angle = Math.atan2(ast.y - en.y, ast.x - en.x); ast.vx += Math.cos(angle) * 15; ast.vy += Math.sin(angle) * 15; ast.velX += (Math.random()-0.5)*0.5; if (en.sh > 0) en.sh -= 1; createExplosion(ast.x, ast.y, false, false, true, '#ffffff'); } else if (en.type !== 'boss' && dist < 30 + ast.size) { createExplosion(en.x, en.y); applyDamageToEnemy(en, 500, WeaponType.PROJECTILE, true); ast.hp -= 500; if (ast.hp <= 0) { createExplosion(ast.x, ast.y, false, false, false, '#888'); spawnAsteroidLoot(ast.x, ast.y, ast.loot, ast.z); s.asteroids.splice(k, 1); } else { const angle = Math.atan2(ast.y - en.y, ast.x - en.x); ast.vx += Math.cos(angle) * 3; ast.vy += Math.sin(angle) * 3; } } } if (en.hp <= 0 || en.y > canvas.height + 300) { if (en.hp <= 0) { createExplosion(en.x, en.y); if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } } s.enemies.splice(j, 1); continue; } if (now - en.lastShot > 1650 / Math.sqrt(Math.max(1, difficulty)) && en.y > 0 && Math.abs(en.z) < 60) { if (en.type === 'boss') { const wepId = en.config.weaponId; const wepDef = EXOTIC_WEAPONS.find(w => w.id === wepId); const bColor = wepDef?.beamColor || '#a855f7'; if (wepId === 'exotic_fan') { for(let a = -2; a <= 2; a++) s.enemyBullets.push({ x: en.x, y: en.y + 110, vy: 8 + difficulty, vx: a * 2.5, isExotic: true, bColor }); } else if (wepId === 'exotic_bubbles') { s.enemyBullets.push({ x: en.x, y: en.y + 110, vy: 6 + difficulty, vx: (Math.random()-0.5)*6, isExotic: true, bColor, isBubble: true }); } else if (wepId === 'exotic_arc') { const d = Math.sqrt((s.px-en.x)**2 + (s.py-en.y)**2); if (d < 900) s.enemyBullets.push({ x: en.x, y: en.y + 110, isArc: true, bColor }); } else { s.enemyBullets.push({ x: en.x - 60, y: en.y + 110, vy: 11 + difficulty, isExotic: true, bColor }); s.enemyBullets.push({ x: en.x + 60, y: en.y + 110, vy: 11 + difficulty, isExotic: true, bColor }); if (difficulty >= 6) s.enemyBullets.push({ x: en.x, y: en.y + 130, vy: 14 + difficulty, isExotic: true, bColor }); } } else { s.enemyBullets.push({ x: en.x, y: en.y + 50, vy: 9.0 + difficulty }); } en.lastShot = now; } }
        for (let i = s.bullets.length - 1; i >= 0; i--) { const b = s.bullets[i]; b.y += b.vy; b.x += b.vx; if (b.life !== undefined) b.life--; let hitB = false; if (b.visualType === 'comet' && s.frame % 2 === 0) { s.particles.push({ x: b.x, y: b.y, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2 + 2, life: 0.5, color: b.beamColor, size: 4, type: 'plasma' }); } for (let j = s.enemies.length - 1; j >= 0; j--) { const en = s.enemies[j]; const distSq = (b.x-en.x)**2 + (b.y-en.y)**2; const hitRadius = en.type === 'boss' ? 70 : 28; if (distSq < hitRadius*hitRadius) { createImpactEffect(b.x, b.y, en.sh > 0 ? 'shield' : 'vessel', en.sh > 0 ? (en.type === 'boss' ? '#a855f7' : '#38bdf8') : undefined); applyDamageToEnemy(en, b.damage, b.wType); hitB = true; break; } } if (!hitB) { for (let j = s.asteroids.length - 1; j >= 0; j--) { const ast = s.asteroids[j]; if (ast.y > 0 && Math.sqrt((b.x - ast.x)**2 + (b.y - ast.y)**2) < ast.size + 30) { createImpactEffect(b.x, b.y, 'asteroid'); if (b.variant === 'mega') ast.hp = 0; else ast.hp -= b.damage; if (ast.hp < 200 && ast.hp > 0 && s.frame % 3 === 0 && ast.loot) { s.particles.push({ x: ast.x + (Math.random()-0.5)*10, y: ast.y, vx: (Math.random()-0.5)*1, vy: -1, life: 0.6, color: '#a1a1aa', size: 4, type: 'smoke' }); } if (ast.hp <= 0) { spawnAsteroidLoot(ast.x, ast.y, ast.loot, ast.z); s.asteroids.splice(j, 1); } hitB = true; break; } } } if (hitB || b.y < -250 || b.y > canvas.height + 250 || (b.life !== undefined && b.life <= 0)) s.bullets.splice(i, 1); }
        for (let i = s.enemyBullets.length - 1; i >= 0; i--) { const eb = s.enemyBullets[i]; if (eb.isArc) { const dist = Math.sqrt((eb.x-s.px)**2 + (eb.y-s.py)**2); if (dist < 900) { let dmg = 0.5; if (s.sh2 > 0) s.sh2 -= dmg; else if (s.sh1 > 0) s.sh1 -= dmg; else s.integrity -= dmg; } s.enemyBullets.splice(i, 1); continue; } eb.y += eb.vy; eb.x += (eb.vx || 0); if (!s.playerDead && !s.playerExploded && Math.sqrt((eb.x - s.px)**2 + (eb.y - s.py)**2) < 60) { s.enemyBullets.splice(i, 1); let dmg = eb.isExotic ? 45 : 34; createImpactEffect(eb.x, eb.y, (s.sh1 > 0 || s.sh2 > 0) ? 'shield' : 'vessel', (s.sh2 > 0 ? secondShield?.color : (s.sh1 > 0 ? shield?.color : undefined))); s.lastHitTime = now; if (s.sh2 > 0) { s.sh2 -= dmg * 1.5; if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; } } else if (s.sh1 > 0) { s.sh1 -= dmg * 1.5; if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; } } else { s.integrity -= dmg; s.shake = 15; } audioService.playShieldHit(); continue; } for (let j = s.asteroids.length - 1; j >= 0; j--) { const ast = s.asteroids[j]; if (ast.y > 0 && Math.sqrt((eb.x - ast.x)**2 + (eb.y - ast.y)**2) < ast.size + 20) { createImpactEffect(eb.x, eb.y, 'asteroid'); ast.hp -= 40; s.enemyBullets.splice(i, 1); if (ast.hp <= 0) { spawnAsteroidLoot(ast.x, ast.y, ast.loot, ast.z); s.asteroids.splice(j, 1); } break; } } if (eb.y > canvas.height + 250) s.enemyBullets.splice(i, 1); }
        s.stars.forEach(st => { st.y += st.v * s.warpFactor; st.x += s.starDirection.vx * st.v; if (st.y > canvas.height) { st.y = -10; st.x = Math.random() * canvas.width; } if (st.x < 0) st.x = canvas.width; if (st.x > canvas.width) st.x = 0; });
        
        // --- SPACE SYSTEM UPDATE ---
        if (s.sunSpawned) { 
            const sys = s.spaceSystems[0]; 
            sys.update();
        }

        if (s.shake > 0) s.shake *= 0.93;
        if (s.playerDead) { onGameOverRef.current(false, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: 0, bossDefeated: s.bossDead, health: 0, hullPacks: s.hullPacks, cargo: s.missionCargo }); return; }
        
        const bI = s.enemies.find(e => e.type === 'boss'), mR = Math.max(0, MISSION_DURATION - s.missionDurationConsumed);
        const cMissiles = s.missionCargo.filter(i => i.type === 'missile').reduce((acc, i) => acc + i.quantity, 0);
        const cMines = s.missionCargo.filter(i => i.type === 'mine').reduce((acc, i) => acc + i.quantity, 0);
        setStats(p => ({ ...p, hp: Math.max(0, s.integrity), sh1: Math.max(0, s.sh1), sh2: Math.max(0, s.sh2), energy: s.energy, score: s.score, missiles: s.missileStock, mines: s.mineStock, fuel: s.fuel, hullPacks: s.hullPacks, boss: bI ? { hp: bI.hp, maxHp: bI.maxHp, sh: bI.sh, maxSh: bI.maxSh } : null, scavengeTimer: Math.ceil(s.scavengeTimeRemaining/60), missionTimer: Math.ceil(mR), cargoMissiles: cMissiles, cargoMines: cMines, energyDepleted: s.energyDepleted, bossDead: s.bossDead }));
        for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; p.x += p.vx; p.y += p.vy + (s.warpFactor - 1) * 3; p.life -= 0.02; if (p.life <= 0) s.particles.splice(i, 1); }
        for (let j = s.asteroids.length - 1; j >= 0; j--) { const ast = s.asteroids[j]; ast.x += ast.vx; ast.y += ast.vy * s.warpFactor; ast.z += ast.vz; ast.angleX += ast.velX; ast.angleY += ast.velY; ast.angleZ += ast.velZ; for (let k = j - 1; k >= 0; k--) { const other = s.asteroids[k]; const dx = ast.x - other.x; const dy = ast.y - other.y; const dz = ast.z - other.z; const dist3d = Math.sqrt(dx*dx + dy*dy + dz*dz); if (dist3d < (ast.size + other.size) * 0.9) { createExplosion((ast.x + other.x)/2, (ast.y + other.y)/2, false, false, true, '#888'); if (ast.loot) spawnAsteroidLoot(ast.x, ast.y, ast.loot, ast.z); if (other.loot) spawnAsteroidLoot(other.x, other.y, other.loot, other.z); s.asteroids.splice(j, 1); s.asteroids.splice(k, 1); j--; break; } } if (j < 0) break; const shieldRadius = (s.sh2 > 0) ? 48 : (s.sh1 > 0 ? 40 : 0); if (shieldRadius > 0 && !s.playerDead && Math.abs(ast.z) < 50) { const dx = ast.x - s.px; const dy = ast.y - s.py; const dist = Math.sqrt(dx*dx + dy*dy); const minDist = shieldRadius + ast.size; if (dist < minDist) { const angle = Math.atan2(dy, dx); ast.vx += Math.cos(angle) * 0.8; ast.vy += Math.sin(angle) * 0.8; const pushOut = minDist - dist; ast.x += Math.cos(angle) * pushOut; ast.y += Math.sin(angle) * pushOut; ast.velX += (Math.random()-0.5)*0.2; ast.velY += (Math.random()-0.5)*0.2; const dmg = 40; if (s.sh2 > 0) { s.sh2 -= dmg; if (s.sh2 < 0) s.sh2 = 0; } else { s.sh1 -= dmg; if (s.sh1 < 0) s.sh1 = 0; } createExplosion(s.px + (dx/dist)*40, s.py + (dy/dist)*40, false, false, true); audioService.playShieldHit(); } } const bound = 300; if (ast.y > canvas.height + bound || ast.x < -bound || ast.x > canvas.width + bound || Math.abs(ast.z) > 1000) s.asteroids.splice(j, 1); }
        const shieldR = (s.sh2 > 0 ? 48 : (s.sh1 > 0 ? 40 : 0)); const tractorRange = shieldR > 0 ? shieldR * 4.5 : 240; 
        s.gifts.forEach(g => { if (s.playerDead) { g.y += g.vy; g.rotation += 0.05; g.isPulled = false; return; } const dx = s.px - g.x; const dy = s.py - g.y; const dz = 0 - g.z; const distXY = Math.sqrt(dx * dx + dy * dy); const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz); if (distXY < tractorRange && Math.abs(g.z) < 1000) { if (s.missionCargo.length >= activeShip.config.maxCargo && dist3D < 60) { if (!g.isPulled) { audioService.playSfx('denied'); setStats(p => ({...p, alert: "CARGO HOLD FULL - JETTISON ITEMS"})); } g.isPulled = false; g.y += g.vy; g.rotation += 0.05; } else { g.isPulled = true; if (dist3D > 1) { const pullSpeed = 12.0; g.x += (dx / dist3D) * pullSpeed; g.y += (dy / dist3D) * pullSpeed; g.z += (dz / dist3D) * pullSpeed; } if (dist3D < 50) { if (s.missionCargo.length < activeShip.config.maxCargo) { const existing = s.missionCargo.find(i => i.type === g.type && i.id === g.id); if (existing) existing.quantity++; else s.missionCargo.push({ instanceId: `loot_${Date.now()}_${Math.random()}`, type: g.type, id: g.id, name: g.name || g.type.toUpperCase(), weight: 1, quantity: 1 }); audioService.playSfx('buy'); s.gifts = s.gifts.filter(gi => gi !== g); setStats(p => ({...p, alert: `ACQUIRED: ${g.name || g.type.toUpperCase()}`})); } } } } else { g.isPulled = false; g.y += g.vy * s.warpFactor; g.rotation += 0.05; } });
      }
      
      // RENDER LOOP
      ctx.save(); if (s.shake > 0) ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);
      ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      s.stars.forEach(st => { let alpha = 1.0; if (st.shimmer) { const now = Date.now(); alpha = 0.4 + (Math.sin((now * 0.005) + st.shimmerPhase) + 1) * 0.3; } ctx.globalAlpha = alpha; ctx.fillStyle = st.color; ctx.fillRect(st.x, st.y, st.s, st.s); ctx.globalAlpha = 1.0; });
      
      // --- PLANETARY ORBIT BACKGROUND RENDERING ---
      if (s.gamePhase === 'observation' || s.gamePhase === 'boss_fight') {
          // Render Main Planet
          const p = s.orbitVisuals;
          // Calculate pan based on time to simulate orbit
          const orbitTime = Date.now() * 0.0001;
          const planetY = canvas.height * 0.6 + Math.sin(orbitTime) * 50; 
          
          ctx.save();
          // Draw Planet
          const planetRadius = canvas.width * 0.35; // Large size
          const px = canvas.width / 2;
          const py = planetY;
          
          const planetGrad = ctx.createRadialGradient(px - planetRadius * 0.3, py - planetRadius * 0.3, 0, px, py, planetRadius);
          planetGrad.addColorStop(0, currentPlanet.color);
          planetGrad.addColorStop(0.8, '#000000');
          ctx.fillStyle = planetGrad;
          ctx.beginPath();
          ctx.arc(px, py, planetRadius, 0, Math.PI * 2);
          ctx.fill();
          
          // Atmosphere Glow
          ctx.shadowColor = currentPlanet.color;
          ctx.shadowBlur = 50;
          ctx.beginPath();
          ctx.arc(px, py, planetRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          
          ctx.restore();

          // Render Space System (Sun/Planets) in background relative to orbit
          if (s.sunSpawned) {
              const sys = s.spaceSystems[0];
              const sysX = canvas.width / 2 + Math.cos(sys.orbitAngle) * (canvas.width * 0.6);
              const sysY = -100 + Math.sin(sys.orbitAngle * 0.5) * 100;
              
              // Draw Sun
              const sunSize = 80 + Math.sin(sys.orbitAngle * 3) * 20; // Pulsing distance effect
              ctx.save();
              const sunGlow = ctx.createRadialGradient(sysX, sysY, 0, sysX, sysY, sunSize * 2);
              sunGlow.addColorStop(0, sys.sunColor + '88');
              sunGlow.addColorStop(1, 'transparent');
              ctx.fillStyle = sunGlow;
              ctx.beginPath(); ctx.arc(sysX, sysY, sunSize * 2, 0, Math.PI * 2); ctx.fill();
              
              ctx.fillStyle = sys.sunColor;
              ctx.beginPath(); ctx.arc(sysX, sysY, sunSize, 0, Math.PI * 2); ctx.fill();
              ctx.restore();

              // Draw Other Planets passing by
              sys.otherPlanets.forEach(op => {
                  const opAngle = sys.orbitAngle + op.offset;
                  const opX = canvas.width / 2 + Math.cos(opAngle) * op.distance;
                  const opY = -50 + Math.sin(opAngle) * 100 + op.yOffset;
                  
                  if (opY > -100 && opY < canvas.height + 100) {
                      ctx.fillStyle = op.color;
                      ctx.beginPath();
                      ctx.arc(opX, opY, op.size, 0, Math.PI * 2);
                      ctx.fill();
                  }
              });
          }
      } else if (s.sunSpawned) {
          // Fallback if not in orbit mode but sun spawned (unlikely with new flow but safe)
          const sys = s.spaceSystems[0];
          // ... standard rendering ...
      }
      
      const renderableItems: any[] = []; s.enemies.forEach(en => renderableItems.push({ type: 'enemy', z: en.z, obj: en })); s.asteroids.forEach(ast => renderableItems.push({ type: 'asteroid', z: ast.z, obj: ast })); s.gifts.forEach(g => renderableItems.push({ type: 'loot', z: g.z, obj: g })); if (activeShip && !s.playerExploded) renderableItems.push({ type: 'player', z: 0, obj: activeShip }); renderableItems.sort((a, b) => a.z - b.z);
      const sunBaseX = s.sunSpawned && s.spaceSystems[0] ? (canvas.width / 2 + Math.cos(s.spaceSystems[0].orbitAngle) * (canvas.width * 0.6)) : canvas.width / 2; 
      const sunBaseY = -1200; 
      const lightSource = { x: sunBaseX, y: sunBaseY, z: 600 };

      renderableItems.forEach(item => {
          const zScale = 1 + (item.z / 1000); if (zScale <= 0) return;
          ctx.save();
          if (item.type === 'enemy') { const en = item.obj as Enemy; ctx.translate(en.x, en.y); ctx.scale(zScale, zScale); ctx.translate(-en.x, -en.y); drawShip(ctx, en, en.x, en.y, 0.5, 0, false, Math.PI, false, s.warpFactor, false, gameEntityScale); if (en.sh > 0) { const shieldColor = en.shieldVisual ? en.shieldVisual.color : (en.type === 'boss' ? '#a855f7' : '#c084fc'); const baseRadius = en.type === 'boss' ? 72 : 75; ctx.save(); ctx.strokeStyle = shieldColor; ctx.shadowColor = shieldColor; ctx.shadowBlur = 10; ctx.lineWidth = 2; ctx.setLineDash([5,5]); ctx.beginPath(); ctx.arc(en.x, en.y, baseRadius * (gameEntityScale/0.5), 0, Math.PI*2); ctx.stroke(); ctx.restore(); } } 
          else if (item.type === 'player') { const cT = (s.fuel > 0) ? ((s.keys.has('KeyW') || s.keys.has('ArrowUp')) ? 1.3 : ((s.keys.has('KeyS') || s.keys.has('ArrowDown')) ? 0 : 0.5)) : 0; const bK = (s.keys.has('KeyS') || s.keys.has('ArrowDown')); const side = (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) ? -1 : ((s.keys.has('KeyD') || s.keys.has('ArrowRight')) ? 1 : 0); drawShip(ctx, activeShip, s.px, s.py, cT, side, bK, 0, true, s.warpFactor, s.isOverdrive, gameEntityScale); const rS = (shV: number, shD: Shield, rad: number) => { if (shV <= 0 || s.playerDead || s.playerExploded) return; ctx.save(); ctx.globalAlpha = 0.6; ctx.shadowBlur = 10; ctx.shadowColor = shD.color; ctx.strokeStyle = shD.color; ctx.lineWidth = 3.0; ctx.beginPath(); if (shD.visualType === 'forward') { ctx.arc(s.px, s.py, rad * (gameEntityScale/0.5), Math.PI*1.2, Math.PI*1.8); } else { ctx.arc(s.px, s.py, rad * (gameEntityScale/0.5), 0, Math.PI*2); } ctx.stroke(); ctx.restore(); }; if (shield) rS(s.sh1, shield, 40); if (secondShield) rS(s.sh2, secondShield, 48); }
          else if (item.type === 'asteroid') { const a = item.obj as Asteroid; const cosX = Math.cos(a.angleX), sinX = Math.sin(a.angleX); const cosY = Math.cos(a.angleY), sinY = Math.sin(a.angleY); const cosZ = Math.cos(a.angleZ), sinZ = Math.sin(a.angleZ); const transformedVerts = a.vertices.map(v => { let y1 = v.y * cosX - v.z * sinX; let z1 = v.y * sinX + v.z * cosX; let x2 = v.x * cosY + z1 * sinY; let z2 = -v.x * sinY + z1 * cosY; let x3 = x2 * cosZ - y1 * sinZ; let y3 = x2 * sinZ + y1 * cosZ; return { x: x3, y: y3, z: z2 }; }); const facesToDraw: Face3D[] = []; const lx = lightSource.x - a.x, ly = lightSource.y - a.y, lz = lightSource.z - a.z; const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz); const lightDir = { x: lx/lLen, y: ly/lLen, z: lz/lLen }; a.faces.forEach(f => { const p0 = transformedVerts[f.indices[0]], p1 = transformedVerts[f.indices[1]], p2 = transformedVerts[f.indices[2]]; const ax = p1.x - p0.x, ay = p1.y - p0.y, az = p1.z - p0.z; const bx = p2.x - p0.x, by = p2.y - p0.y, bz = p2.z - p0.z; const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const lenN = Math.sqrt(nx*nx + ny*ny + nz*nz); const normal = { x: nx/lenN, y: ny/lenN, z: nz/lenN }; if (normal.z < 0) { const zDepth = (p0.z + p1.z + p2.z) / 3; facesToDraw.push({ ...f, normal, zDepth }); } }); facesToDraw.sort((f1, f2) => (f1.zDepth || 0) - (f2.zDepth || 0)); ctx.save(); ctx.translate(a.x, a.y); ctx.scale(zScale, zScale); facesToDraw.forEach(f => { const normal = f.normal!; let intensity = Math.abs(normal.x * lightDir.x + normal.y * lightDir.y + normal.z * lightDir.z); const specular = Math.pow(intensity, 10) * 0.5; ctx.fillStyle = f.color; ctx.beginPath(); f.indices.forEach((idx, i) => { const v = transformedVerts[idx]; if (i===0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); }); ctx.closePath(); ctx.fill(); let finalLight = intensity * f.shadeOffset; finalLight = Math.max(0.15, finalLight); if (finalLight > 1.0) { ctx.fillStyle = `rgba(255,255,255,${(finalLight - 1.0) * 0.6 + specular})`; ctx.fill(); } else { ctx.fillStyle = `rgba(0,0,0,${(1.0 - finalLight) * 0.8})`; ctx.fill(); } ctx.strokeStyle = `rgba(255,255,255,${0.05 + intensity * 0.1})`; ctx.lineWidth = 0.5; ctx.stroke(); }); ctx.restore(); }
          else if (item.type === 'loot') { const g = item.obj as Gift; ctx.save(); ctx.translate(g.x, g.y); ctx.scale(zScale, zScale); ctx.rotate(g.rotation); const boxSize = 18; ctx.fillStyle = g.type === 'weapon' ? '#a855f7' : (g.type === 'energy' ? '#00f2ff' : (g.type === 'gold' ? '#fbbf24' : (g.type === 'platinum' ? '#e2e8f0' : (g.type === 'lithium' ? '#c084fc' : (g.type === 'repair' ? '#10b981' : (g.type === 'shield' ? '#f472b6' : '#60a5fa')))))); ctx.fillRect(-boxSize/2, -boxSize/2, boxSize, boxSize); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(-boxSize/2, -boxSize/2, boxSize, boxSize); ctx.fillStyle = '#000'; ctx.font = lootFont; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let l = ''; if (g.type === 'gold') l = 'G'; else if (g.type === 'platinum') l = 'P'; else if (g.type === 'lithium') l = 'L'; else if (g.type === 'missile') l = 'S'; else if (g.type === 'mine') l = 'M'; else if (g.type === 'fuel') l = 'F'; else if (g.type === 'energy') l = 'E'; else if (g.type === 'weapon') l = 'W'; else if (g.type === 'repair') l = 'H'; else if (g.type === 'shield') l = 'S'; ctx.fillText(l, 0, 0); ctx.restore(); if (g.isPulled) { ctx.save(); ctx.strokeStyle = '#00f2ff'; ctx.globalAlpha = 0.3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(g.x, g.y); ctx.stroke(); ctx.restore(); } }
          ctx.restore();
      });

      s.energyBolts.forEach(eb => { ctx.save(); ctx.translate(eb.x, eb.y); const bg = ctx.createRadialGradient(0,0,0,0,0,30); bg.addColorStop(0,'#fff'); bg.addColorStop(0.2,'#00f2ff'); bg.addColorStop(1,'transparent'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill(); ctx.restore(); });
      for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; ctx.globalAlpha = p.life; ctx.fillStyle = p.color; if (p.type === 'smoke') { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.001, p.size * (1.5 - p.life)), 0, Math.PI*2); ctx.fill(); } else if (p.type === 'debris') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(s.frame * 0.1); ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); ctx.restore(); } else if (p.type === 'shock') { ctx.lineWidth = 4 * p.life; ctx.strokeStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - p.life) + 10, 0, Math.PI*2); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.001, p.size), 0, Math.PI*2); ctx.fill(); } ctx.globalAlpha = 1; }
      s.bullets.forEach(b => { const chargeScale = b.chargeLevel || 1.0; if (b.variant === 'mega' || b.variant === 'heavy_auto') { const w = 3.5; const h = b.variant === 'mega' ? 42 : 28; const angle = Math.atan2(b.vy, b.vx) + Math.PI/2; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(angle); ctx.shadowColor = b.beamColor; ctx.shadowBlur = b.variant === 'mega' ? 10 : 5; ctx.fillStyle = '#ffffff'; ctx.fillRect(-w/2, 0, w, h); ctx.restore(); } else if (b.visualType) { const sz = b.size || 3, clr = b.beamColor || '#fff'; ctx.save(); ctx.shadowBlur = 10 * chargeScale; ctx.shadowColor = clr; if (b.visualType === 'ring') { ctx.strokeStyle = clr; ctx.lineWidth = 2 * chargeScale; ctx.beginPath(); ctx.arc(b.x, b.y, sz + 2, 0, Math.PI * 2); ctx.stroke(); } else if (b.visualType === 'thunder') { ctx.strokeStyle = clr; ctx.lineWidth = (b.variant === 'mega' ? 3 : 1.5) * 1.2; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(b.x, b.y); const len = b.variant === 'mega' ? 80 : 50; const zig = 8; let cx = b.x, cy = b.y; for(let k=0; k<5; k++) { cx += (Math.random()-0.5)*zig; cy -= len/5; ctx.lineTo(cx, cy); if (Math.random() > 0.6) { ctx.moveTo(cx, cy); ctx.lineTo(cx+(Math.random()-0.5)*20, cy-15); ctx.moveTo(cx, cy); } } ctx.stroke(); } else if (b.visualType === 'solid_glow' || b.visualType === 'comet') { const isOverload = b.variant === 'mega' || b.variant === 'heavy_auto'; const rad = sz * (isOverload ? 1.5 : 1); ctx.shadowBlur = isOverload ? 20 : 10; ctx.fillStyle = clr; ctx.beginPath(); ctx.arc(b.x, b.y, rad, 0, Math.PI * 2); ctx.fill(); } else { ctx.fillStyle = clr; ctx.beginPath(); ctx.arc(b.x, b.y, sz, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } else { if (chargeScale > 1.2) { ctx.save(); ctx.shadowBlur = 10 * chargeScale; ctx.shadowColor = b.beamColor; ctx.fillStyle = '#fff'; ctx.fillRect(b.x - (b.size * 1.5)/2, b.y - b.size * 3, b.size * 1.5, b.size * 6); ctx.restore(); } else { ctx.fillStyle = b.beamColor || '#fbbf24'; ctx.fillRect(b.x - b.size/2, b.y - b.size * 2, b.size, b.size * 4); } } });
      s.enemyBullets.forEach(eb => { if (eb.isArc) { ctx.strokeStyle = eb.bColor || '#a855f7'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(eb.x, eb.y); ctx.lineTo(s.px, s.py); ctx.stroke(); } else if (eb.isBubble) { ctx.strokeStyle = eb.bColor || '#a855f7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(eb.x, eb.y, 10, 0, Math.PI*2); ctx.stroke(); } else { ctx.fillStyle = eb.bColor || (eb.isExotic ? '#a855f7' : '#f87171'); ctx.fillRect(eb.x-2, eb.y, 4, 18); } });
      s.missiles.forEach(m => { ctx.save(); const mScale = (1 + (m.z / 1000)) * projectileScale; ctx.translate(m.x, m.y); ctx.scale(mScale, mScale); ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI/2); const hullC = activeShip.color || '#94a3b8'; const wingC = activeShip.wingColor || '#64748b'; const engC = activeShip.engineColor || '#334155'; const cockC = activeShip.cockpitColor || '#38bdf8'; ctx.fillStyle = wingC; ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(-12, 18); ctx.lineTo(-4, 16); ctx.moveTo(4, 8); ctx.lineTo(12, 18); ctx.lineTo(4, 16); ctx.fill(); ctx.fillStyle = engC; ctx.fillRect(-3, 14, 6, 4); ctx.fillStyle = hullC; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-4, -12, 8, 26, 3); else ctx.rect(-4, -12, 8, 26); ctx.fill(); ctx.fillStyle = cockC; ctx.fillRect(-4, -8, 8, 2); ctx.fillRect(-4, -4, 8, 2); if (s.frame % 4 < 2) { ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(-2, 18); ctx.lineTo(0, 24 + Math.random()*6); ctx.lineTo(2, 18); ctx.fill(); } ctx.restore(); });
      s.mines.forEach(m => { const mScale = (1 + (m.z / 1000)) * projectileScale; ctx.save(); ctx.translate(m.x, m.y); ctx.scale(mScale, mScale); ctx.beginPath(); ctx.fillStyle = m.isEMP ? '#3b82f6' : '#fbbf24'; ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill(); if (m.isEMP) { ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 8 + Math.sin(s.frame * 0.2) * 2, 0, Math.PI*2); ctx.stroke(); } else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.stroke(); } ctx.restore(); });
      if (s.isPaused) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,canvas.width,canvas.height); }
      ctx.restore(); anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); window.removeEventListener('blur', handleBlur); window.removeEventListener('keydown', handleKey as any); window.removeEventListener('keyup', handleKey as any); };
  }, [difficulty, activeShip, shield, secondShield, maxEnergy, initialFuel, maxFuelCapacity, initialIntegrity, currentPlanet, quadrant, ships, MISSION_DURATION, fontSize]);

  // [UI render code remains unchanged]
  const ep = (stats.energy / maxEnergy) * 100, fp = (stats.fuel / maxFuelCapacity) * 100, nl = 15, ael = Math.ceil((ep/100)*nl), afl = Math.ceil((fp/100)*nl);
  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {/* ... [Rest of JSX remains exactly as it was] ... */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50">
        <div className={`retro-font ${barText} text-zinc-500 uppercase tracking-[0.3em] mb-1`}>Sector Entry Clock</div>
        <div className={`retro-font ${hudText} ${stats.missionTimer < 20 ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`}>{Math.floor(stats.missionTimer / 60)}:{(stats.missionTimer % 60).toString().padStart(2, '0')}</div>
      </div>
      {stateRef.current.gamePhase === 'observation' && (<div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-none bg-blue-950/20 px-8 py-3 rounded-xl border border-blue-500/30 backdrop-blur-sm"><div className={`retro-font ${barText} text-blue-400 uppercase tracking-widest animate-pulse tracking-[0.4em]`}>PLANETARY ARRIVAL</div></div>)}
      {stateRef.current.gamePhase === 'scavenge' && (<div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-none bg-emerald-950/20 px-8 py-3 rounded-xl border border-emerald-500/30 backdrop-blur-sm"><div className={`retro-font ${barText} text-emerald-400 uppercase tracking-widest animate-pulse`}>SCAVENGE PHASE ACTIVE</div><div className={`retro-font ${hudText} text-white`}>HARVEST WINDOW: {stats.scavengeTimer}s</div></div>)}
      <div className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-end ${gaugeGap} z-50 pointer-events-none opacity-95 scale-90`}>
        <div className="flex flex-col items-center gap-1.5"><div className={`retro-font ${btnText} uppercase font-black ${(stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>FUE</div><div className={`flex flex-col-reverse ${ledGap} p-1 bg-zinc-950/70 border border-zinc-800/40 rounded`}>{Array.from({ length: nl }).map((_, i) => (<div key={i} className={`${gaugeW} ${gaugeH} rounded-xs transition-colors duration-300 ${i < afl ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: i < afl ? ((stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? '#ff004c' : '#00b7ff') : '#18181b', color: (stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? '#ff004c' : '#00b7ff' }} />))}</div><div className={`retro-font ${btnText} font-black ${(stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? 'text-red-500' : 'text-blue-500'}`}>{stats.fuel.toFixed(1)}U</div></div>
        
        <div className="flex flex-col items-center gap-1.5">
            <div className={`retro-font ${btnText} uppercase font-black ${(ep < 20 || stats.energyDepleted) ? 'text-red-500 animate-pulse' : (ep < 50 ? 'text-yellow-400' : 'text-cyan-400')}`}>PWR</div>
            <div className={`flex flex-col-reverse ${ledGap} p-1 bg-zinc-950/70 border border-zinc-800/40 rounded ${stats.energyDepleted ? 'animate-pulse' : ''}`}>
                {Array.from({ length: nl }).map((_, i) => { 
                    const isActive = i < ael;
                    let color = '#00ffd0'; 
                    if (ep < 20) color = '#ef4444';
                    else if (ep < 50) color = '#facc15';
                    else color = '#3b82f6';
                    if (stats.energyDepleted) color = '#ef4444'; 
                    return (<div key={i} className={`${gaugeW} ${gaugeH} rounded-xs transition-colors duration-200 ${isActive ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: isActive ? color : '#18181b', color: color }} />); 
                })}
            </div>
            <div className={`retro-font ${btnText} font-black ${(ep < 20 || stats.energyDepleted) ? 'text-red-500' : (ep < 50 ? 'text-yellow-500' : 'text-cyan-500')}`}>{stats.energyDepleted ? 'RESET' : `${Math.floor(ep)}%`}</div>
        </div>
      </div>
      {stats.boss && (<div className="absolute top-20 left-1/2 -translate-x-1/2 w-[350px] flex flex-col items-center gap-1 z-50 pointer-events-none bg-black/40 p-3 rounded-lg border border-white/5 opacity-95"><div className="retro-font text-[6px] text-purple-400 uppercase tracking-[0.4em] font-black drop-shadow-[0_0_80px_#a855f7]">XENOS PRIMARY</div><div className="w-full flex flex-col gap-1 mt-1.5">{stats.boss.sh > 0 && (<div className="w-full h-1.5 bg-zinc-900/40 border border-purple-900/30 rounded-full overflow-hidden"><div className="h-full bg-purple-500 shadow-[0_0_12px_#a855f7]" style={{ width: `${(stats.boss.sh/stats.boss.maxSh)*100}%` }} /></div>)}<div className="w-full h-2 bg-zinc-900/40 border border-red-900/30 rounded-full overflow-hidden"><div className="h-full bg-red-600 shadow-[0_0_12px_#dc2626]" style={{ width: `${(stats.boss.hp/stats.boss.maxHp)*100}%` }} /></div></div></div>)}
      <div className={`absolute top-3 left-5 flex flex-col ${hudGap} pointer-events-none z-50 opacity-100 scale-90 origin-top-left`}><div className="flex items-center gap-2.5"><div className={`retro-font ${barText} uppercase pr-1 font-black ${stateRef.current.isMeltdown ? 'text-red-500 animate-pulse drop-shadow-[0_0_5px_#ef4444]' : 'text-lime-400 drop-shadow-[0_0_5px_#a3e635]'}`}>HULL</div><div className={`${topBarW} ${topBarH} bg-zinc-950/50 border border-zinc-800/40 rounded-full overflow-hidden`}><div className={`h-full ${stateRef.current.isMeltdown ? 'bg-red-500' : 'bg-lime-500'}`} style={{ width: `${stats.hp}%` }} /></div></div>{shield && <div className="flex items-center gap-2.5"><div className={`retro-font ${barText} uppercase pr-1 font-black`} style={{ color: shield.color }}>SHLD</div><div className={`${topBarW} ${topBarH} bg-zinc-950/50 border border-zinc-800/40 rounded-full overflow-hidden`}><div className="h-full" style={{ width: `${(stats.sh1/shield.capacity)*100}%`, backgroundColor: shield.color }} /></div></div>}</div>
      <div className="absolute top-3 right-5 text-right flex flex-col gap-1 z-50 scale-90 origin-top-right"><div className="flex flex-col gap-1 opacity-90"><div className={`retro-font ${hudText} text-white tabular-nums`}>{stats.score.toLocaleString()}</div><div className={`retro-font ${barText} text-zinc-300 uppercase tracking-widest font-black`}>UNITS</div></div></div>
      
      <div className="absolute bottom-16 left-5 flex flex-col gap-2 pointer-events-none z-[100]">
          <div className="flex items-center gap-2 p-1">
             <div className="flex gap-1">
                 {Array.from({ length: 10 }).map((_, i) => (
                     <div key={`m-${i}`} className={`w-2 h-2 rounded-full ${i < (stats.missiles > 10 ? 10 : stats.missiles) ? 'bg-red-500 shadow-[0_0_5px_#ef4444]' : 'bg-red-950/30 border border-red-900/20'}`} />
                 ))}
             </div>
             <span className={`retro-font ${barText} text-zinc-400 w-12 text-right tabular-nums`}>{stats.missiles}/{stats.cargoMissiles}</span>
          </div>
          <div className="flex items-center gap-2 p-1">
             <div className="flex gap-1">
                 {Array.from({ length: 10 }).map((_, i) => (
                     <div key={`n-${i}`} className={`w-2 h-2 rounded-full ${i < (stats.mines > 10 ? 10 : stats.mines) ? 'bg-yellow-500 shadow-[0_0_5px_#eab308]' : 'bg-yellow-950/30 border border-yellow-900/20'}`} />
                 ))}
             </div>
             <span className={`retro-font ${barText} text-zinc-400 w-12 text-right tabular-nums`}>{stats.mines}/{stats.cargoMines}</span>
          </div>
      </div>

      <div className={`absolute bottom-5 left-5 right-5 ${bottomBarHeight} flex items-center justify-between pointer-events-auto bg-zinc-900/60 rounded-md z-[100]`}>
          <div className="flex-grow flex items-center justify-start pl-3 h-full overflow-hidden">
              <span className={`retro-font ${barText} uppercase tracking-widest truncate ${stats.isPaused ? 'text-white animate-pulse' : (stats.alert ? 'text-amber-400 animate-pulse' : 'text-zinc-500')}`}>
                  {stats.isPaused ? "SYSTEMS PAUSED" : (stats.alert || (stateRef.current.isMeltdown ? "CRITICAL FAILURE" : (stateRef.current.warpFactor > 1.5 ? "TURBO ENGAGED - WEAPONS OFFLINE" : "SYSTEMS NOMINAL")))}
              </span>
          </div>

          <div className="flex items-center gap-2 pr-2 h-[80%] shrink-0">
              <button onClick={togglePause} className={`h-full ${btnPad} bg-zinc-800 border border-zinc-600 text-zinc-300 retro-font ${btnText} uppercase hover:bg-zinc-700 transition-all rounded-sm`}>{stats.isPaused ? 'RESUME' : 'PAUSE'}</button>
              
              {stats.bossDead ? (
                  <button onClick={(e) => { const s = stateRef.current; onGameOverRef.current(true, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: true, health: s.integrity, hullPacks: s.hullPacks, cargo: s.missionCargo }); e.currentTarget.blur(); }} className={`h-full ${btnPad} bg-emerald-600/20 border border-emerald-500 text-emerald-500 retro-font ${btnText} uppercase hover:bg-emerald-600 hover:text-white transition-all rounded-sm animate-pulse shadow-[0_0_10px_#10b981]`}>LAND</button>
              ) : (
                  <button onClick={(e) => { const s = stateRef.current, fHP = s.isMeltdown ? 25 : Math.max(0, s.integrity); onGameOverRef.current(false, s.score, true, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: fHP, hullPacks: s.hullPacks, cargo: s.missionCargo }); e.currentTarget.blur(); }} className={`h-full ${btnPad} bg-red-900/20 border border-red-800/50 text-red-500 retro-font ${btnText} uppercase hover:bg-red-900 hover:text-white transition-all rounded-sm`}>RETREAT</button>
              )}
          </div>
      </div>
    </div>
  );
};

export default GameEngine;