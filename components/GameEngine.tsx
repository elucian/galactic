
// CHECKPOINT: Defender V85.42
// VERSION: V85.42 - BUGFIX & STABILITY
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, Weapon, EquippedWeapon, Planet, QuadrantType, WeaponType, CargoItem } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, EXOTIC_SHIELDS, PLANETS, BOSS_SHIPS, SHIELDS, BOSS_EXOTIC_SHIELDS } from '../constants.ts';

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
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; type: 'fire' | 'smoke' | 'spark' | 'debris' | 'shock' | 'fuel' | 'electric' | 'plasma'; z?: number;
}

// 3D MATH INTERFACES
interface Point3D { x: number; y: number; z: number; }
interface Face3D { indices: number[]; color: string; normal?: Point3D; zDepth?: number; shadeOffset: number; }

class Enemy {
  x: number; y: number; z: number = 0; // Z-Layer: -200 (Low) to 200 (High)
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
  
  // AI States
  aiState: 'attack' | 'evade' | 'formation' = 'attack';
  shieldRegenTimer: number = 0;
  mineTimer: number = 0;
  
  // Boss Specifics
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
    // Randomize Z start layer slightly
    this.z = type === 'boss' ? 0 : (Math.random() - 0.5) * 300; 
    
    this.hp = hpMap[type]; this.maxHp = hpMap[type];
    
    if (type === 'boss') { 
        this.sh = shMap[type]; 
        this.maxSh = shMap[type];
        const shieldType = BOSS_EXOTIC_SHIELDS[Math.floor(Math.random() * BOSS_EXOTIC_SHIELDS.length)];
        this.shieldVisual = shieldType;
        this.shieldImmunity = shieldType.immunity as any;
        this.shieldRegenRate = shieldType.type === 'regen' ? 2.5 : 0.5;
    } else {
        // Regular enemies have weak shields at high levels
        if (difficulty > 5) {
            this.sh = 50 * (difficulty - 4);
            this.maxSh = this.sh;
        }
    }
    
    this.type = type; this.config = config;
    this.color = type === 'boss' ? '#a855f7' : (type === 'heavy' ? '#ef4444' : (type === 'fighter' ? '#f97316' : '#60a5fa'));
  }

  updateAI(px: number, py: number, asteroids: Asteroid[], peers: Enemy[]) {
    // 1. Z-Layer Management
    // Slowly drift back to 0 (Player Plane) for better combat engagement
    if (this.z > 10) this.vz = -0.5;
    else if (this.z < -10) this.vz = 0.5;
    else this.vz = 0;
    this.z += this.vz;

    if (this.type === 'boss') {
        if (this.sh < this.maxSh && this.sh > 0) this.sh += this.shieldRegenRate;
        this.y += 4.2 + this.vy;
        this.x += this.vx;
        return;
    }

    // 2. Base Movement (Gravity / Engine)
    // Intelligent throttle: If player is far below, speed up. If close, brake.
    const distY = py - this.y;
    let baseSpeed = 4.2;
    
    // Brake logic
    if (distY < 300 && distY > 0) baseSpeed = 2.0;
    
    // Reverse thrusters (rare)
    if (Math.random() < 0.01 && distY < 150) baseSpeed = -2.0;

    // 3. Flocking (Separation) - Don't stack
    let sepX = 0, sepY = 0;
    peers.forEach(peer => {
        if (peer === this) return;
        const dx = this.x - peer.x;
        const dy = this.y - peer.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 100 && d > 0) {
            sepX += (dx / d) * 2.5; // Push away
            sepY += (dy / d) * 1.0;
        }
    });

    // 4. Asteroid Avoidance
    let avoidX = 0, avoidY = 0;
    asteroids.forEach(ast => {
        // Only avoid asteroids on similar Z-plane
        if (Math.abs(ast.z - this.z) > 80) return;

        const dx = this.x - ast.x;
        const dy = this.y - ast.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        // Look ahead
        if (d < (ast.size + 150)) {
            avoidX += (dx / d) * 4.0; // Strong lateral push
            avoidY += (dy / d) * 1.5; // Slight vertical adjustment
        }
    });

    // 5. Apply Forces
    this.vx += sepX + avoidX;
    this.vy += sepY + avoidY;

    // Strafe logic (Sine wave motion)
    this.vx += Math.sin(Date.now() * 0.005 + this.x) * 0.2;

    // 6. Limits
    this.vx *= 0.92;
    this.vy *= 0.92;

    this.y += baseSpeed + this.vy;
    this.x += this.vx;

    // 7. Regeneration
    if (this.difficulty >= 4 && this.sh < this.maxSh) {
        this.shieldRegenTimer++;
        if (this.shieldRegenTimer > 120) { // 2s without reset
            this.sh += 0.5;
        }
    }

    // 8. Mine Laying (If player is below and close)
    if (this.config.canLayMines && distY > 100 && distY < 400 && Math.abs(this.x - px) < 100) {
        this.mineTimer++;
        if (this.mineTimer > 300 && Math.random() < 0.05) { // Cooldown
            this.mineTimer = 0;
            return true; // Signal to drop mine
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
  x: number; y: number; vx: number; vy: number; target: Enemy | null = null;
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
  life: number = 600; // 10s at 60fps
  isEMP: boolean = false;
  z: number = 0; // Mines on player layer usually
  
  constructor(x: number, y: number, isEMP: boolean = false, z: number = 0) { 
      this.x = x; this.y = y; this.vx = 0; this.vy = -1.5; 
      this.isEMP = isEMP;
      this.z = z;
      if (isEMP) {
          this.damage = 3500; 
      }
  }
  
  update(enemies: Enemy[]) {
    this.life--;
    if (!this.target || this.target.hp <= 0) {
      let minDist = this.isEMP ? 800 : 400; 
      let candidate: Enemy | null = null;
      enemies.forEach(en => {
        // Z-check for mine tracking? Maybe allow loose tracking
        const d = Math.sqrt((this.x - en.x)**2 + (this.y - en.y)**2);
        if (d < minDist && Math.abs(en.z - this.z) < 100) { minDist = d; candidate = en; }
      });
      this.target = candidate;
    }
    if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0) {
          const force = this.isEMP ? 0.8 : 0.4;
          this.vx += (dx/d) * force;
          this.vy += (dy/d) * force;
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
  constructor(x: number, y: number, type: GiftType, id?: string, name?: string, z: number = 0) { 
    this.x = x; this.y = y; this.z = z; this.type = type; this.id = id; this.name = name;
    this.rotation = Math.random() * Math.PI * 2;
  }
}

class Asteroid {
  x: number; y: number; z: number; hp: number; maxHp: number;
  vx: number; vy: number; vz: number;
  size: number;
  variant: string; color: string;
  gasLeak: boolean = false;
  loot: { type: GiftType, id?: string, name?: string } | null = null;
  
  // 3D Properties
  vertices: Point3D[] = [];
  faces: Face3D[] = [];
  angleX: number; angleY: number; angleZ: number;
  velX: number; velY: number; velZ: number;

  constructor(x: number, y: number, difficulty: number, isScavenge: boolean = false, startFromBottom: boolean = false) {
    this.x = x;
    
    // Z-Layer logic: Can spawn deep (-400) or high (+200)
    // "Asteroids can fly also on different layers and can change layers"
    this.z = (Math.random() - 0.5) * 600; 
    
    // Movement Z (Transition between layers)
    this.vz = (Math.random() - 0.5) * 0.5;

    // Position Y
    this.y = startFromBottom ? 1200 : -150;
    
    // Movement Logic
    // "Asteroids fly slow sometimes sideways but sometimes come from bottom of the screen and move faster, in diagonal"
    if (startFromBottom) {
        this.vy = -(6.0 + Math.random() * 4.0); // Fast Up
        this.vx = (Math.random() - 0.5) * 8.0;  // Diagonal
    } else {
        // Standard Top-Down or Slow Sideways
        if (Math.random() > 0.7) {
            // Sideways drift
            this.vy = 1.0 + Math.random();
            this.vx = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 2.0);
        } else {
            // Standard fall
            this.vy = 2.0 + Math.random() * 3.0;
            this.vx = (Math.random() - 0.5) * 1.5;
        }
    }
    
    // 3D Rotation Init
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
        if (randSize < 0.5) { this.size = 15 + Math.random()*3; this.hp = 300; }
        else { this.size = 25 + Math.random()*3; this.hp = 600; }
    } else if (this.variant === 'brown_missile') {
        this.color = '#92400e';
        if (randSize < 0.3) { this.size = 18 + Math.random()*4; this.hp = 400; }
        else { this.size = 35 + Math.random()*5; this.hp = 1200; }
    } else if (this.variant === 'gray_mine') {
        this.color = '#71717a';
        if (randSize < 0.2) { this.size = 15 + Math.random()*2; this.hp = 300; }
        else if (randSize < 0.6) { this.size = 40 + Math.random()*5; this.hp = 1500; }
        else { this.size = 60 + Math.random()*15; this.hp = 3500; this.color = '#52525b'; }
    } else if (this.variant === 'junk') {
        this.color = '#57534e'; this.size = 28; this.hp = 600;
    } else {
        this.size = 22;
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
    this.generate3DMesh();
  }
  
  generate3DMesh() {
    this.vertices = []; this.faces = [];
    let n = 8;
    if (this.size > 50) n = 14; else if (this.size > 30) n = 12; else if (this.size > 20) n = 10;
    const noise = () => 1.0 + (Math.random() - 0.5) * 0.25; 
    this.vertices.push({ x: 0, y: -this.size * noise(), z: 0 }); 
    const tropicY = this.size * 0.6; const tropicR = this.size * 0.6; const layer1Start = this.vertices.length;
    for(let i=0; i<n; i++) { const theta = (i/n) * Math.PI * 2; const r = tropicR * noise(); this.vertices.push({ x: Math.cos(theta)*r, y: -tropicY*noise(), z: Math.sin(theta)*r }); }
    const layer2Start = this.vertices.length; const eqOffset = (Math.PI / n); 
    for(let i=0; i<n; i++) { const theta = (i/n) * Math.PI * 2 + eqOffset; const r = this.size * noise(); this.vertices.push({ x: Math.cos(theta)*r, y: (Math.random()-0.5)*(this.size*0.1), z: Math.sin(theta)*r }); }
    const layer3Start = this.vertices.length;
    for(let i=0; i<n; i++) { const theta = (i/n) * Math.PI * 2; const r = tropicR * noise(); this.vertices.push({ x: Math.cos(theta)*r, y: tropicY*noise(), z: Math.sin(theta)*r }); }
    const botPoleIdx = this.vertices.length; this.vertices.push({ x: 0, y: this.size * noise(), z: 0 });
    for(let i=0; i<n; i++) { const next = (i+1)%n; const shade = (i % 2 === 0) ? 1.3 : 0.7; this.faces.push({ indices: [0, layer1Start + i, layer1Start + next], color: this.color, shadeOffset: shade }); }
    for(let i=0; i<n; i++) { const next = (i+1)%n; const l1Curr = layer1Start + i, l1Next = layer1Start + next; const l2Curr = layer2Start + i, l2Next = layer2Start + next; const shade = (i % 2 !== 0) ? 1.3 : 0.7; this.faces.push({ indices: [l1Curr, l2Curr, l1Next], color: this.color, shadeOffset: shade }); this.faces.push({ indices: [l1Next, l2Curr, l2Next], color: this.color, shadeOffset: shade }); }
    for(let i=0; i<n; i++) { const next = (i+1)%n; const l2Curr = layer2Start + i, l2Next = layer2Start + next; const l3Curr = layer3Start + i, l3Next = layer3Start + next; const shade = (i % 2 === 0) ? 1.3 : 0.7; this.faces.push({ indices: [l2Curr, l3Curr, l2Next], color: this.color, shadeOffset: shade }); this.faces.push({ indices: [l2Next, l3Curr, l3Next], color: this.color, shadeOffset: shade }); }
    for(let i=0; i<n; i++) { const next = (i+1)%n; const shade = (i % 2 !== 0) ? 1.3 : 0.7; this.faces.push({ indices: [botPoleIdx, layer3Start + next, layer3Start + i], color: this.color, shadeOffset: shade }); }
  }
}

class SpaceSystem {
    x: number; y: number; vy: number = 0.15;
    sunSize: number = 180; sunColor: string; isBlackHole: boolean; 
    viewProgress: number = 0;
    planets: any[];
    comets: any[];
    constructor(w: number, h: number, quadrant: QuadrantType, selectedPlanetId: string) {
        this.x = w / 2; this.y = -400; 
        this.isBlackHole = quadrant === QuadrantType.DELTA;
        const colors = { [QuadrantType.ALFA]: '#facc15', [QuadrantType.BETA]: '#f97316', [QuadrantType.GAMA]: '#60a5fa', [QuadrantType.DELTA]: '#000000' };
        this.sunColor = colors[quadrant];
        const sectorPlanets = PLANETS.filter(p => p.quadrant === quadrant);
        this.planets = sectorPlanets.map((p, i) => ({
            id: p.id, name: p.name, distance: 400 + (i * 220), baseSize: p.size * 5, color: p.color, angle: Math.random() * Math.PI * 2, speed: 0.0003 + Math.random() * 0.0005, isSelected: p.id === selectedPlanetId,
            moon: Math.random() > 0.4 ? { angle: Math.random() * Math.PI * 2, distance: (p.size * 5) + 35, size: 6, speed: 0.015 } : null
        }));
        this.comets = Array.from({length: 2}).map(() => ({ x: 0, y: 0, angle: Math.random() * Math.PI * 2, a: 800 + Math.random() * 500, b: 300 + Math.random() * 200, speed: 0.0001 + Math.random() * 0.0002, tailLength: 0 }));
    }
}

const GameEngine: React.FC<GameEngineProps> = ({ ships, shield, secondShield, onGameOver, difficulty, currentPlanet, quadrant }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  if (!ships || ships.length === 0) return <div className="p-20 text-center text-red-500 font-bold">SYSTEM ERROR</div>;
  const activeShip = ships[0];
  const maxEnergy = activeShip?.config?.maxEnergy || 1000;
  const initialFuel = activeShip?.fitting?.fuel || 0;
  const initialIntegrity = activeShip?.fitting?.health || 100;
  const maxFuelCapacity = activeShip?.config?.maxFuel || 1.0;
  const initialHullPacks = activeShip?.fitting?.hullPacks || 0;
  const MISSION_DURATION = (1 + (difficulty * 2)) * 60; 

  const [stats, setStats] = useState({ 
    hp: initialIntegrity, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, energy: maxEnergy, score: 0, missiles: activeShip?.fitting?.rocketCount || 0, mines: activeShip?.fitting?.mineCount || 0, fuel: initialFuel, hullPacks: initialHullPacks, boss: null as any, alert: "", scavengeTimer: 0, missionTimer: MISSION_DURATION, isPaused: false,
    cargoMissiles: 0, cargoMines: 0, energyDepleted: false, bossDead: false
  });

  const onGameOverRef = useRef(onGameOver);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  const stateRef = useRef({
    px: 0, py: 0, integrity: initialIntegrity, fuel: initialFuel, energy: maxEnergy, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, score: 0, hullPacks: initialHullPacks, sh1ShatterTime: 0, sh2ShatterTime: 0, missionStartTime: Date.now(), autoRepair: { active: false, timer: 0, lastTick: 0 },
    bullets: [] as any[], enemyBullets: [] as any[], missiles: [] as Missile[], mines: [] as Mine[], enemies: [] as Enemy[], particles: [] as Particle[], stars: [] as any[], gifts: [] as Gift[], asteroids: [] as Asteroid[], spaceSystems: [] as SpaceSystem[], energyBolts: [] as EnergyBolt[],
    fireflies: Array.from({length: 12}).map(() => ({x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5, size: 2.5 + Math.random()*2.5, color: '#00f2ff'})),
    keys: new Set<string>(), lastFire: 0, lastSpawn: 0, lastAsteroidSpawn: 0, lastBoltSpawn: 0, sunSpawned: false, gameActive: true, frame: 0, missileStock: activeShip?.fitting?.rocketCount || 0, mineStock: activeShip?.fitting?.mineCount || 0, equippedWeapons: [...(activeShip?.fitting?.weapons || [])], bossSpawned: false, bossDead: false, lootPending: false, shake: 0, playerDead: false, playerExploded: false, deathSequenceTimer: 300, scavengeMode: false, scavengeTimeRemaining: 0, starDirection: { vx: 0, vy: 1 }, isMeltdown: false, meltdownTimer: 600,
    missionCargo: [...(activeShip?.fitting?.cargo || [])] as CargoItem[], reloading: { missiles: false, mines: false, fuel: false, repair: false, fuelFilling: false, fuelTarget: 0, energy: false, energyTimer: 0, energyActive: false }, isPaused: false, pauseStartTime: 0, gamePhase: 'travel' as 'travel' | 'observation' | 'boss_intro' | 'boss_fight', observationTimer: 0, isInitialized: false,
    weaponCooldowns: {} as Record<string, number>,
    charging: { active: false, startTime: 0, level: 0, discharged: false },
    energyDepleted: false,
    lastHitTime: 0,
    gunHeat: 0,
    gunKick: 0,
    crystalExtension: 0,
    asteroidCycleStartTime: Date.now(),
  });

  const getHeatColor = (heat: number) => {
    if (heat < 0.2) return '#1c1917'; // Dark Gray
    if (heat < 0.4) return '#78350f'; // Brown
    if (heat < 0.6) return '#dc2626'; // Red
    if (heat < 0.8) return '#ea580c'; // Orange
    return '#facc15'; // Yellow (capped)
  };

  const getGunAngle = (side: number, time: number, isExotic: boolean) => {
    if (isExotic) return 0;
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
    
    // MINE EXPLOSION: SINGLE PUFF
    if (isMine) {
        const color = customSmokeColor || 'rgba(251, 191, 36, 0.8)';
        s.particles.push({ x, y, vx: 0, vy: 0, life: 1.5, color: color, size: 60, type: 'smoke' });
        s.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, color: '#ffffff', size: 80, type: 'shock' });
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
    
    // Check Immunities
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
        // FIX: CHANGED 'this.shieldRegenTimer' to 'en.shieldRegenTimer'
        if (leftover > 0) { en.hp -= leftover; en.burnLevel = 1; en.shieldRegenTimer = 0; } // Reset regen on hit
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
    const s = stateRef.current; s.shake = 100; s.lootPending = true; s.scavengeMode = true; 
    s.scavengeTimeRemaining = 3600; 
    const iters = 12; 
    for (let i = 0; i < iters; i++) { setTimeout(() => { const ex = bx + (Math.random() - 0.5) * 500, ey = by + (Math.random() - 0.5) * 500; createExplosion(ex, ey, true); audioService.playExplosion(0, 1.8); s.shake = 55; }, i * 60); }
    setTimeout(() => { 
        const randomEx1 = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)], 
              randomEx2 = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)],
              randomExSh = EXOTIC_SHIELDS[Math.floor(Math.random() * EXOTIC_SHIELDS.length)];
        s.gifts.push(new Gift(bx - 60, by, 'weapon', randomEx1.id, randomEx1.name)); 
        s.gifts.push(new Gift(bx + 60, by, 'weapon', randomEx2.id, randomEx2.name)); 
        s.gifts.push(new Gift(bx, by + 40, 'shield', randomExSh.id, randomExSh.name));
        s.lootPending = false; 
    }, 1000);
  };

  // CORE VISUAL: LOCKED (V85.21) - DO NOT MODIFY SHIP RENDERING
  const drawShip = (ctx: CanvasRenderingContext2D, sInst: any, x: number, y: number, thrust: number, side: number, isBreaking: boolean, rotation: number = 0, isPlayer: boolean = false) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(0.5, 0.5); ctx.translate(-50, -50); if (!isPlayer) ctx.globalAlpha = 1;
    const { engines: engineCount, hullShapeType, wingStyle } = sInst.config;
    const gunHeatLevel = isPlayer ? Math.max(stateRef.current.gunHeat, stateRef.current.charging.level) : 0;
    const gunBodyColor = isPlayer ? getHeatColor(gunHeatLevel) : (sInst.gunBodyColor || '#1c1917');

    const drawEngine = (ex: number, ey: number) => {
      ctx.fillStyle = sInst.engineColor || '#334155'; ctx.beginPath(); ctx.roundRect(ex - 12, ey - 10, 24, 25, 4); ctx.fill();
      ctx.fillStyle = sInst.nozzleColor || '#171717'; ctx.beginPath(); ctx.moveTo(ex-10, ey+8); ctx.lineTo(ex-12, ey+22); ctx.quadraticCurveTo(ex, ey+28, ex+12, ey+22); ctx.lineTo(ex+10, ey+8); ctx.fill();
      if (thrust > 0) { ctx.fillStyle = sInst.type === 'boss' ? '#a855f7' : '#f97316'; ctx.globalAlpha = 0.4 + Math.random() * 0.4; ctx.beginPath(); ctx.moveTo(ex-8, ey+15); ctx.lineTo(ex+8, ey+15); ctx.lineTo(ex, ey+15+(50 * thrust)+Math.random()*15); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    };
    if (engineCount === 1) drawEngine(50, 82); else { [25,75].forEach(ex => drawEngine(ex, 75)); }
    ctx.fillStyle = sInst.wingColor || '#64748b'; ctx.beginPath(); if (wingStyle === 'delta') { ctx.moveTo(35, 40); ctx.lineTo(4, 88); ctx.lineTo(50, 78); ctx.moveTo(65, 40); ctx.lineTo(96, 88); ctx.lineTo(50, 78); } else { ctx.ellipse(50, 60, 48, 18, 0, 0, Math.PI * 2); } ctx.fill();
    if (isBreaking) { ctx.fillStyle = '#f87171'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(30, 20); ctx.lineTo(30, -10); ctx.lineTo(35, 20); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(70, 20); ctx.lineTo(70, -10); ctx.lineTo(65, 20); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    if (side !== 0) { ctx.fillStyle = '#38bdf8'; ctx.globalAlpha = 0.9; const wx = side < 0 ? 85 : 15, sDir = side < 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(wx, 55); ctx.lineTo(wx + (sDir * 35), 55); ctx.lineTo(wx, 60); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = sInst.color || '#94a3b8'; 
    ctx.beginPath(); if (hullShapeType === 'triangle') { ctx.moveTo(50, 10); ctx.lineTo(80, 85); ctx.lineTo(20, 85); } else { ctx.roundRect(30, 15, 40, 75, 12); } ctx.fill();
    
    // Gun Rendering - LOCKED
    const renderGun = (gx: number, gy: number, sc: number, gunSide: number) => { 
        const isExotic = EXOTIC_WEAPONS.some(ex => ex.id === sInst.fitting?.weapons[0]?.id);
        const gunAngle = isPlayer ? getGunAngle(gunSide, Date.now(), isExotic) : 0;
        const kick = isPlayer ? stateRef.current.gunKick : 0;
        const crystalExt = isPlayer ? stateRef.current.crystalExtension : 1.0; 
        const extension = kick * 12 + (crystalExt * 10);

        ctx.save(); ctx.translate(gx, gy); ctx.scale(sc, sc); ctx.rotate(gunAngle);
        ctx.fillStyle = gunBodyColor;
        if (isPlayer && gunHeatLevel > 0.2) {
            const intensity = Math.min(1, (gunHeatLevel - 0.2) / 0.8);
            ctx.shadowBlur = 5 + (intensity * 55); 
            if (gunHeatLevel > 0.9) ctx.shadowColor = '#ffffff'; 
            else if (gunHeatLevel > 0.7) ctx.shadowColor = '#facc15'; 
            else if (gunHeatLevel > 0.5) ctx.shadowColor = '#ea580c'; 
            else ctx.shadowColor = '#dc2626'; 
        } else ctx.shadowBlur = 0;
        ctx.fillRect(-9, -17, 18, 34); 
        ctx.shadowBlur = 0; 
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-9, -12, 18, 2); ctx.fillRect(-9, -7, 18, 2); ctx.fillRect(-9, -2, 18, 2); ctx.fillRect(-9, 3, 18, 2);
        ctx.fillStyle = sInst.gunColor || '#60a5fa';
        ctx.beginPath();
        const crystalRefY = -17 - extension; 
        ctx.moveTo(0, crystalRefY - 14); ctx.lineTo(8, crystalRefY); ctx.lineTo(0, -17); ctx.lineTo(-8, crystalRefY); ctx.closePath(); ctx.fill();
        ctx.restore(); 
    };
    if (sInst.config.defaultGuns === 1) { renderGun(50, 15, 0.35, 0); } else { renderGun(25, 45, 0.55, -1); renderGun(75, 45, 0.55, 1); }
    ctx.fillStyle = sInst.cockpitColor || '#38bdf8'; ctx.beginPath(); ctx.ellipse(50, (hullShapeType === 'triangle' ? 58 : 38), 9, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };

  const togglePause = () => { const s = stateRef.current; s.isPaused = !s.isPaused; if (s.isPaused) { s.pauseStartTime = Date.now(); s.keys.clear(); } else s.missionStartTime += (Date.now() - s.pauseStartTime); setStats(p => ({ ...p, isPaused: s.isPaused })); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };

  // CORE MECHANIC: LOCKED (V85.21) - DO NOT MODIFY FIRING LOGIC
  const fireWeapons = (multiplier: number = 1.0, isRapidFire: boolean = false, bypassCooldown: boolean = false, variant: 'normal' | 'mega' | 'heavy_auto' = 'normal') => {
    const s = stateRef.current;
    if (s.energyDepleted || s.energy <= 0 || s.isMeltdown || s.playerDead) return;
    if (s.gunHeat >= 1.0 && !bypassCooldown && variant !== 'mega') return;
    const now = Date.now();
    const numGuns = activeShip.config.defaultGuns;
    let fired = false;
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
        audioService.playWeaponFire(variant === 'mega' ? 'laser' : (weaponDef.type === WeaponType.LASER ? 'laser' : 'cannon'), pan);
        const efficiency = isExotic ? 0.3 : 1.2;
        const powerFactor = (variant === 'mega' ? 10 : (variant === 'heavy_auto' ? 3 : 1));
        s.energy -= (weaponDef.energyCost / 20) * multiplier * efficiency * powerFactor;
        fired = true;
    }
    if (fired) {
        s.gunKick = 1.0;
        if (variant === 'normal') s.gunHeat = Math.min(0.7, s.gunHeat + 0.04); 
        else if (variant === 'mega') s.gunHeat = 1.0; 
        else if (variant === 'heavy_auto') s.gunHeat = Math.min(0.9, s.gunHeat + 0.1);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    if (stateRef.current.px === 0) { stateRef.current.px = window.innerWidth / 2; stateRef.current.py = window.innerHeight * 0.85; }
    
    // RESTRICTED STAR COLORS (White & Yellow)
    const starColors = ['#ffffff', '#fef08a']; 
    
    const generateStars = (w: number, h: number) => { 
        stateRef.current.stars = Array.from({ length: 300 }).map(() => ({ 
            x: Math.random() * w, 
            y: Math.random() * h, 
            s: Math.random() * 2.8, 
            v: 0.15 + Math.random() * 0.6, 
            color: starColors[Math.floor(Math.random() * starColors.length)],
            shimmer: Math.random() > 0.8, // 20% stars shimmer
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
            if (isDown && !s.keys.has('Space')) { s.charging.active = true; s.charging.startTime = now; s.keys.add('Space'); } 
            else if (!isDown) {
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
                // Check for EMP upgrade in cargo
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
        const missionElapsed = (now - s.missionStartTime) / 1000, missionRemaining = Math.max(0, MISSION_DURATION - missionElapsed);
        const canSpawn = missionElapsed > 5;
        
        // FIRING LOGIC LOOP
        const isSpace = s.keys.has('Space');
        const isControl = s.keys.has('ControlLeft') || s.keys.has('ControlRight');
        const isShift = s.keys.has('ShiftLeft') || s.keys.has('ShiftRight');
        const isWeaponActive = isControl || isShift || isSpace;

        if (isWeaponActive) s.crystalExtension = Math.min(1, s.crystalExtension + 0.1);
        else s.crystalExtension = Math.max(0, s.crystalExtension - 0.1);

        if (isSpace) {
            const chargeDur = now - s.charging.startTime;
            s.charging.level = Math.min(1.0, chargeDur / 1500); 
            if (chargeDur >= 1500) fireWeapons(1.0, false, false, 'heavy_auto');
        } else {
            s.charging.level = 0;
            if (isControl || isShift) fireWeapons(1.0, true, false, 'normal');
        }

        s.gunKick *= 0.85;
        if (!isWeaponActive && s.gunHeat > 0) s.gunHeat = Math.max(0, s.gunHeat - 0.015);

        if (s.gamePhase === 'travel') { if (missionRemaining <= 0) { s.gamePhase = 'observation'; s.observationTimer = 0; setStats(p => ({ ...p, alert: "SECTOR SUN DETECTED - ARRIVING" })); if (!s.sunSpawned) { s.spaceSystems.push(new SpaceSystem(canvas.width, canvas.height, quadrant, currentPlanet.id)); s.sunSpawned = true; } } } 
        else if (s.gamePhase === 'observation') { s.observationTimer++; if (s.observationTimer > 360) { s.gamePhase = 'boss_fight'; s.bossSpawned = true; s.enemies.push(new Enemy(canvas.width/2, -450, 'boss', BOSS_SHIPS[Math.floor(Math.random() * BOSS_SHIPS.length)], difficulty)); setStats(p => ({ ...p, alert: "BOSS INTERCEPTION" })); } }
        if (!s.playerDead && !s.playerExploded) {
            if (isVertical && s.fuel > 0) { if (s.keys.has('KeyW') || s.keys.has('ArrowUp')) s.py -= pSpeed; if (s.keys.has('KeyS') || s.keys.has('ArrowDown')) s.py += pSpeed; s.fuel = Math.max(0, s.fuel - 0.0015); }
            if (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) { s.px -= pSpeed; s.starDirection.vx = 2.4; s.fuel = Math.max(0, s.fuel - 0.0005); } else if (s.keys.has('KeyD') || s.keys.has('ArrowRight')) { s.px += pSpeed; s.starDirection.vx = -2.4; s.fuel = Math.max(0, s.fuel - 0.0005); } else s.starDirection.vx *= 0.93;
            s.px = Math.max(35, Math.min(canvas.width - 35, s.px)); s.py = Math.max(35, Math.min(canvas.height - 110, s.py)); 
            
            const isShooting = isWeaponActive;
            const wasHitRecently = (now - s.lastHitTime) < 500;
            
            if (s.energyDepleted) {
                if (s.energy >= maxEnergy) {
                    s.energyDepleted = false;
                    s.energy = maxEnergy;
                    setStats(p => ({ ...p, alert: "REACTOR RESTARTED" }));
                    setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500);
                } else {
                    const regenRate = (isShooting || wasHitRecently) ? 0 : (maxEnergy / 120); 
                    s.energy += regenRate;
                }
            } else {
                if (s.energy <= 0) {
                    s.energy = 0;
                    s.energyDepleted = true;
                    s.charging.active = false; 
                    setStats(p => ({ ...p, alert: "ENERGY DEPLETED - RECHARGING" }));
                    audioService.playSfx('denied');
                } else {
                    s.energy = Math.min(maxEnergy, s.energy + 4.0);
                }
            }

            // AUTO-USE ENERGY BATTERY IF LOW (<20%)
            if ((s.energy / maxEnergy) < 0.2 && !s.reloading.energy && !s.isMeltdown) {
                const battIdx = s.missionCargo.findIndex(i => i.type === 'energy');
                if (battIdx !== -1) {
                    s.reloading.energy = true;
                    s.reloading.energyTimer = 300; // 5 seconds * 60fps
                    setStats(p => ({ ...p, alert: "AUX POWER SEQUENCE INITIATED: 5s" }));
                }
            }

            if (s.reloading.energy) {
                s.reloading.energyTimer--;
                if (s.reloading.energyTimer % 60 === 0 && s.reloading.energyTimer > 0) {
                    setStats(p => ({ ...p, alert: `AUX POWER INJECTION IN: ${s.reloading.energyTimer / 60}s` }));
                }
                if (s.reloading.energyTimer <= 0) {
                    const battIdx = s.missionCargo.findIndex(i => i.type === 'energy');
                    const item = s.missionCargo[battIdx];
                    if (battIdx !== -1 && item) {
                        if (item.quantity > 1) item.quantity--;
                        else s.missionCargo.splice(battIdx, 1);
                        
                        s.energyDepleted = false; // Revive if dead
                        s.reloading.energyActive = true; // Start rapid regeneration
                        s.reloading.energy = false; // Reset trigger
                        audioService.playSfx('buy');
                        setStats(p => ({ ...p, alert: "AUX POWER ENGAGED - RECHARGING" }));
                    } else {
                        s.reloading.energy = false; // Battery lost?
                    }
                }
            }

            // Apply RAPID REGENERATION (2x faster than depletion recharge)
            if (s.reloading.energyActive) {
                const rate = maxEnergy / 60; // Full charge in ~1 sec (60 frames)
                s.energy = Math.min(maxEnergy, s.energy + rate);
                if (s.energy >= maxEnergy) {
                    s.reloading.energyActive = false;
                    setStats(p => ({ ...p, alert: "ENERGY CELLS STABILIZED" }));
                    setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500);
                }
            }

            if (!s.energyDepleted) {
                if (shield && s.sh1 > 0) {
                    const isExotic = EXOTIC_SHIELDS.some(ex => ex.id === shield.id);
                    s.energy -= (shield.energyCost * (isExotic ? 0.01 : 0.04));
                }
                if (secondShield && s.sh2 > 0) {
                    const isExotic = EXOTIC_SHIELDS.some(ex => ex.id === secondShield.id);
                    s.energy -= (secondShield.energyCost * (isExotic ? 0.01 : 0.04));
                }
            }

            // AUTO-REFILL FUEL FROM CARGO
            if (s.fuel <= 0 && !s.reloading.fuel && !s.isMeltdown) {
                const cargoIdx = s.missionCargo.findIndex(i => i.type === 'fuel');
                if (cargoIdx !== -1) {
                    s.reloading.fuel = true;
                    setStats(p => ({ ...p, alert: "TRANSFERRING AUXILIARY FUEL..." }));
                }
            }
            if (s.reloading.fuel) {
                const chargeRate = 0.1 / 60; // 1 unit per 10 sec
                s.fuel = Math.min(maxFuelCapacity, s.fuel + chargeRate);
                if (!s.reloading.fuelFilling) {
                    s.reloading.fuelFilling = true;
                    const idx = s.missionCargo.findIndex(i => i.type === 'fuel');
                    const item = s.missionCargo[idx];
                    if (idx !== -1 && item) {
                        if (item.quantity > 1) item.quantity--; 
                        else s.missionCargo.splice(idx, 1);
                        setTimeout(() => { s.reloading.fuel = false; s.reloading.fuelFilling = false; }, 10000); 
                    } else s.reloading.fuel = false;
                }
            }

            // AUTO-RELOAD MISSILES
            if (s.missileStock <= 0 && !s.reloading.missiles && !s.isMeltdown) { 
                const cargoIdx = s.missionCargo.findIndex(i => i.type === 'missile'); 
                if (cargoIdx !== -1) { 
                    s.reloading.missiles = true; 
                    setStats(p => ({ ...p, alert: "RELOADING MISSILES (10s)..." })); 
                    setTimeout(() => { 
                        const idx = s.missionCargo.findIndex(i => i.type === 'missile'); 
                        const item = s.missionCargo[idx];
                        if (idx !== -1 && item) { 
                            s.missileStock = Math.min(50, s.missileStock + 10); 
                            if (item.quantity > 1) item.quantity--; 
                            else s.missionCargo.splice(idx, 1); 
                            setStats(p => ({ ...p, alert: "MISSILES LOADED" })); 
                            setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); 
                        } 
                        s.reloading.missiles = false; 
                    }, 10000); 
                } 
            }

            // AUTO-RELOAD MINES
            if (s.mineStock <= 0 && !s.reloading.mines && !s.isMeltdown) { 
                const cargoIdx = s.missionCargo.findIndex(i => i.type === 'mine'); 
                if (cargoIdx !== -1) { 
                    s.reloading.mines = true; 
                    setStats(p => ({ ...p, alert: "RELOADING MINES (10s)..." })); 
                    setTimeout(() => { 
                        const idx = s.missionCargo.findIndex(i => i.type === 'mine'); 
                        const item = s.missionCargo[idx];
                        if (idx !== -1 && item) { 
                            s.mineStock = Math.min(50, s.mineStock + 10); 
                            if (item.quantity > 1) item.quantity--; 
                            else s.missionCargo.splice(idx, 1); 
                            setStats(p => ({ ...p, alert: "MINES LOADED" })); 
                            setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); 
                        } 
                        s.reloading.mines = false; 
                    }, 10000); 
                } 
            }

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
        
        // ASTEROID SPAWN LOGIC & CYCLE (1m ON / 3m OFF)
        const cycleTime = (now - s.asteroidCycleStartTime) % 240000; // 4 mins total
        const isAsteroidSeason = cycleTime < 60000; // First minute active
        
        // Capped Alien Count
        const maxAliens = difficulty < 5 ? 4 : 7;
        const currentAlienCount = s.enemies.length;
        const shouldSpawnAlien = isAsteroidSeason ? Math.random() < 0.2 : true; // Aliens hate asteroids

        // Spawn Asteroids only in season
        if (canSpawn && isAsteroidSeason && s.asteroids.length < (s.scavengeMode ? 8 : 12) && now - s.lastAsteroidSpawn > (s.scavengeMode ? 1200 : 800)) { 
            // Some come from bottom (20%), most from top
            const fromBottom = Math.random() < 0.2;
            s.asteroids.push(new Asteroid(Math.random() * canvas.width, -180, difficulty, s.scavengeMode, fromBottom)); 
            s.lastAsteroidSpawn = now; 
        }

        if (canSpawn && s.gamePhase === 'travel' && currentAlienCount < maxAliens && shouldSpawnAlien && now - s.lastSpawn > (1800 / Math.sqrt(Math.max(1, difficulty)))) { 
            const shipIdx = Math.min(SHIPS.length - 1, Math.floor(Math.random() * (difficulty + 1))); 
            s.enemies.push(new Enemy(Math.random() * (canvas.width - 120) + 60, -150, 'fighter', SHIPS[shipIdx], difficulty)); 
            s.lastSpawn = now; 
        }

        for (let i = s.mines.length - 1; i >= 0; i--) { 
            const m = s.mines[i]; 
            m.update(s.enemies); 
            if (m.life <= 0) {
                const smokeColor = m.isEMP ? 'rgba(59, 130, 246, 0.8)' : 'rgba(251, 191, 36, 0.6)';
                createExplosion(m.x, m.y, false, true, false, smokeColor);
                s.mines.splice(i, 1);
            }
            else if (m.y < -200 || m.y > canvas.height + 200) s.mines.splice(i, 1); 
            else { 
                for (let j = s.enemies.length - 1; j >= 0; j--) { 
                    const en = s.enemies[j]; 
                    // Mine proximity check (loose Z check)
                    if (Math.abs(en.z - m.z) < 120 && Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 55) { 
                        const smokeColor = m.isEMP ? 'rgba(59, 130, 246, 0.8)' : 'rgba(251, 191, 36, 0.6)';
                        applyDamageToEnemy(en, m.damage, WeaponType.MINE); 
                        createExplosion(m.x, m.y, false, true, false, smokeColor); 
                        s.mines.splice(i, 1); 
                        if (en.hp <= 0) { 
                            if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } 
                            s.enemies.splice(j, 1); 
                        } 
                        break; 
                    } 
                } 
            } 
        }
        for (let i = s.missiles.length - 1; i >= 0; i--) {
            const m = s.missiles[i];
            
            // Homing Logic
            if (!m.target || m.target.hp <= 0) {
                let close = 1000;
                s.enemies.forEach(e => {
                    const d = Math.sqrt((e.x - m.x)**2 + (e.y - m.y)**2);
                    if (d < close) { close = d; m.target = e; }
                });
            }
            
            if (m.target) {
                const dx = m.target.x - m.x;
                const dy = m.target.y - m.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 0) {
                    m.vx += (dx/dist) * 0.5;
                    m.vy += (dy/dist) * 0.5;
                }
            }
            // Cap speed
            const speed = Math.sqrt(m.vx*m.vx + m.vy*m.vy);
            if (speed > 12) { m.vx *= 0.9; m.vy *= 0.9; }
            
            m.x += m.vx;
            m.y += m.vy;
            m.life--;

            if (s.frame % 2 === 0) s.particles.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 0.4, color: m.isEmp ? '#00f2ff' : '#cbd5e1', size: 3, type: 'smoke' });

            let hit = false;
            for (let j = s.enemies.length - 1; j >= 0; j--) {
                const en = s.enemies[j];
                // Missiles ignore Z for targeting (homing tech) but check range loosely
                if (Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 40) {
                    applyDamageToEnemy(en, m.damage, WeaponType.MISSILE);
                    createExplosion(m.x, m.y, false, false, false, '#fb923c');
                    hit = true;
                    if (en.hp <= 0) {
                        if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); }
                        s.enemies.splice(j, 1);
                    }
                    break;
                }
            }

            if (hit || m.life <= 0 || m.y < -100 || m.y > canvas.height + 100) {
                s.missiles.splice(i, 1);
            }
        }
        for (let j = s.enemies.length - 1; j >= 0; j--) { 
            const en = s.enemies[j]; 
            
            // Advanced AI Update
            const droppedMine = en.updateAI(s.px, s.py, s.asteroids, s.enemies);
            if (droppedMine) {
                // Drop a mine at enemy Z level
                s.mines.push(new Mine(en.x, en.y + 40, false, en.z));
            }

            // ASTEROID COLLISION (Alien crashes into asteroid) - Needs Z check
            for (let k = s.asteroids.length - 1; k >= 0; k--) {
                const ast = s.asteroids[k];
                // Strict Z collision for physical impact
                if (Math.abs(en.z - ast.z) > 60) continue;

                const dist = Math.sqrt((en.x - ast.x)**2 + (en.y - ast.y)**2);
                
                if (en.type === 'boss' && dist < (en.sh > 0 ? 80 : 60) + ast.size) {
                    const angle = Math.atan2(ast.y - en.y, ast.x - en.x);
                    ast.vx += Math.cos(angle) * 15;
                    ast.vy += Math.sin(angle) * 15;
                    ast.velX += (Math.random()-0.5)*0.5;
                    if (en.sh > 0) en.sh -= 1; 
                    createExplosion(ast.x, ast.y, false, false, true, '#ffffff');
                }
                else if (en.type !== 'boss' && dist < 30 + ast.size) {
                    createExplosion(en.x, en.y); 
                    applyDamageToEnemy(en, 500, WeaponType.PROJECTILE, true); 
                    ast.hp -= 500;
                    if (ast.hp <= 0) {
                        createExplosion(ast.x, ast.y, false, false, false, '#888');
                        spawnAsteroidLoot(ast.x, ast.y, ast.loot, ast.z);
                        s.asteroids.splice(k, 1);
                    } else {
                        const angle = Math.atan2(ast.y - en.y, ast.x - en.x);
                        ast.vx += Math.cos(angle) * 3;
                        ast.vy += Math.sin(angle) * 3;
                    }
                }
            }

            if (en.hp <= 0 || en.y > canvas.height + 300) { 
                if (en.hp <= 0) { 
                    createExplosion(en.x, en.y); 
                    if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } 
                } 
                s.enemies.splice(j, 1); 
                continue; 
            } 
            
            if (now - en.lastShot > 1650 / Math.sqrt(Math.max(1, difficulty)) && en.y > 0) { if (en.type === 'boss') { const wepId = en.config.weaponId; const wepDef = EXOTIC_WEAPONS.find(w => w.id === wepId); const bColor = wepDef?.beamColor || '#a855f7'; if (wepId === 'exotic_fan') { for(let a = -2; a <= 2; a++) s.enemyBullets.push({ x: en.x, y: en.y + 110, vy: 8 + difficulty, vx: a * 2.5, isExotic: true, bColor }); } else if (wepId === 'exotic_bubbles') { s.enemyBullets.push({ x: en.x, y: en.y + 110, vy: 6 + difficulty, vx: (Math.random()-0.5)*6, isExotic: true, bColor, isBubble: true }); } else if (wepId === 'exotic_arc') { const d = Math.sqrt((s.px-en.x)**2 + (s.py-en.y)**2); if (d < 900) s.enemyBullets.push({ x: en.x, y: en.y + 110, isArc: true, bColor }); } else { s.enemyBullets.push({ x: en.x - 60, y: en.y + 110, vy: 11 + difficulty, isExotic: true, bColor }); s.enemyBullets.push({ x: en.x + 60, y: en.y + 110, vy: 11 + difficulty, isExotic: true, bColor }); if (difficulty >= 6) s.enemyBullets.push({ x: en.x, y: en.y + 130, vy: 14 + difficulty, isExotic: true, bColor }); } } else { s.enemyBullets.push({ x: en.x, y: en.y + 50, vy: 9.0 + difficulty }); } en.lastShot = now; } 
        }
        for (let i = s.bullets.length - 1; i >= 0; i--) { const b = s.bullets[i]; b.y += b.vy; b.x += b.vx; if (b.life !== undefined) b.life--; let hitB = false; if (b.visualType === 'comet' && s.frame % 2 === 0) { s.particles.push({ x: b.x, y: b.y, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2 + 2, life: 0.5, color: b.beamColor, size: 4, type: 'plasma' }); } for (let j = s.enemies.length - 1; j >= 0; j--) { const en = s.enemies[j]; const distSq = (b.x-en.x)**2 + (b.y-en.y)**2; const hitRadius = en.type === 'boss' ? 70 : 28; if (distSq < hitRadius*hitRadius) { createImpactEffect(b.x, b.y, en.sh > 0 ? 'shield' : 'vessel', en.sh > 0 ? (en.type === 'boss' ? '#a855f7' : '#38bdf8') : undefined); applyDamageToEnemy(en, b.damage, b.wType); hitB = true; break; } } if (!hitB) { for (let j = s.asteroids.length - 1; j >= 0; j--) { const ast = s.asteroids[j]; if (ast.y > 0 && Math.sqrt((b.x - ast.x)**2 + (b.y - ast.y)**2) < ast.size + 30) { createImpactEffect(b.x, b.y, 'asteroid'); 
            // Power Shot Instakill vs Regular Damage
            if (b.variant === 'mega') ast.hp = 0; else ast.hp -= b.damage; 
            
            // Gas Leak Visuals (ONLY IF ASTEROID HAS LOOT)
            if (ast.hp < 200 && ast.hp > 0 && s.frame % 3 === 0 && ast.loot) {
                s.particles.push({ x: ast.x + (Math.random()-0.5)*10, y: ast.y, vx: (Math.random()-0.5)*1, vy: -1, life: 0.6, color: '#a1a1aa', size: 4, type: 'smoke' });
            }

            if (ast.hp <= 0) { spawnAsteroidLoot(ast.x, ast.y, ast.loot, ast.z); s.asteroids.splice(j, 1); } hitB = true; break; } } } if (hitB || b.y < -250 || b.y > canvas.height + 250 || (b.life !== undefined && b.life <= 0)) s.bullets.splice(i, 1); }
        for (let i = s.enemyBullets.length - 1; i >= 0; i--) { const eb = s.enemyBullets[i]; if (eb.isArc) { const dist = Math.sqrt((eb.x-s.px)**2 + (eb.y-s.py)**2); if (dist < 900) { let dmg = 0.5; if (s.sh2 > 0) s.sh2 -= dmg; else if (s.sh1 > 0) s.sh1 -= dmg; else s.integrity -= dmg; } s.enemyBullets.splice(i, 1); continue; } eb.y += eb.vy; eb.x += (eb.vx || 0); if (!s.playerDead && !s.playerExploded && Math.sqrt((eb.x - s.px)**2 + (eb.y - s.py)**2) < 60) { s.enemyBullets.splice(i, 1); let dmg = eb.isExotic ? 45 : 34; createImpactEffect(eb.x, eb.y, (s.sh1 > 0 || s.sh2 > 0) ? 'shield' : 'vessel', (s.sh2 > 0 ? secondShield?.color : (s.sh1 > 0 ? shield?.color : undefined))); s.lastHitTime = now; if (s.sh2 > 0) { s.sh2 -= dmg * 1.5; if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; } } else if (s.sh1 > 0) { s.sh1 -= dmg * 1.5; if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; } } else { s.integrity -= dmg; s.shake = 15; } audioService.playShieldHit(); continue; } 
        // ALIEN BULLET VS ASTEROID (Loose Z)
        for (let j = s.asteroids.length - 1; j >= 0; j--) { const ast = s.asteroids[j]; if (ast.y > 0 && Math.sqrt((eb.x - ast.x)**2 + (eb.y - ast.y)**2) < ast.size + 20) { createImpactEffect(eb.x, eb.y, 'asteroid'); ast.hp -= 40; s.enemyBullets.splice(i, 1); if (ast.hp <= 0) { spawnAsteroidLoot(ast.x, ast.y, ast.loot, ast.z); s.asteroids.splice(j, 1); } break; } } 
        if (eb.y > canvas.height + 250) s.enemyBullets.splice(i, 1); }
        
        s.stars.forEach(st => { st.y += st.v; st.x += s.starDirection.vx * st.v; if (st.y > canvas.height) { st.y = -10; st.x = Math.random() * canvas.width; } if (st.x < 0) st.x = canvas.width; if (st.x > canvas.width) st.x = 0; });
        if (s.sunSpawned) { const sys = s.spaceSystems[0]; sys.viewProgress = Math.min(1, sys.viewProgress + 0.003); sys.planets.forEach(p => { p.angle += p.speed; if (p.moon) p.moon.angle += p.moon.speed; }); sys.comets.forEach(c => { c.angle += c.speed; c.x = sys.x + Math.cos(c.angle) * c.a; c.y = sys.y + Math.sin(c.angle) * c.b; const dx = c.x - sys.x, dy = c.y - sys.y, d = Math.sqrt(dx*dx + dy*dy); c.tailLength = Math.max(0, 150 - (d / 10)); }); }
        if (s.shake > 0) s.shake *= 0.93;
        if (s.playerDead) { onGameOverRef.current(false, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: 0, bossDefeated: s.bossDead, health: 0, hullPacks: s.hullPacks, cargo: s.missionCargo }); return; }
        
        // AUTOPILOT LANDING CHECK
        if (s.scavengeMode) {
            s.scavengeTimeRemaining--;
            if (s.scavengeTimeRemaining <= 0) {
                setStats(p => ({...p, alert: "AUTOPILOT ENGAGED - RETURNING TO BASE"}));
                // Force successful mission end after short delay for message reading
                if (!s.lootPending) {
                    s.lootPending = true; // prevent re-entry
                    setTimeout(() => {
                        onGameOverRef.current(true, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: true, health: s.integrity, hullPacks: s.hullPacks, cargo: s.missionCargo });
                    }, 2000);
                }
            }
        }

        const bI = s.enemies.find(e => e.type === 'boss'), mR = Math.max(0, MISSION_DURATION - ((now - s.missionStartTime) / 1000));
        
        // Calculate cargo stock for UI
        const cMissiles = s.missionCargo.filter(i => i.type === 'missile').reduce((acc, i) => acc + i.quantity, 0);
        const cMines = s.missionCargo.filter(i => i.type === 'mine').reduce((acc, i) => acc + i.quantity, 0);

        setStats(p => ({ ...p, hp: Math.max(0, s.integrity), sh1: Math.max(0, s.sh1), sh2: Math.max(0, s.sh2), energy: s.energy, score: s.score, missiles: s.missileStock, mines: s.mineStock, fuel: s.fuel, hullPacks: s.hullPacks, boss: bI ? { hp: bI.hp, maxHp: bI.maxHp, sh: bI.sh, maxSh: bI.maxSh } : null, scavengeTimer: Math.ceil(s.scavengeTimeRemaining/60), missionTimer: Math.ceil(mR), cargoMissiles: cMissiles, cargoMines: cMines, energyDepleted: s.energyDepleted, bossDead: s.bossDead }));
        for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.02; if (p.life <= 0) s.particles.splice(i, 1); }
        
        // UPDATE ASTEROIDS (Movement + Rotation Physics + Z-Layers + Collisions)
        for (let j = s.asteroids.length - 1; j >= 0; j--) {
            const ast = s.asteroids[j];
            
            ast.x += ast.vx;
            ast.y += ast.vy;
            ast.z += ast.vz; // Move in depth
            
            ast.angleX += ast.velX;
            ast.angleY += ast.velY;
            ast.angleZ += ast.velZ;

            // ASTEROID vs ASTEROID COLLISION
            for (let k = j - 1; k >= 0; k--) {
                const other = s.asteroids[k];
                // Check distance in 3D
                const dx = ast.x - other.x;
                const dy = ast.y - other.y;
                const dz = ast.z - other.z;
                const dist3d = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (dist3d < (ast.size + other.size) * 0.9) {
                    // Collision!
                    createExplosion((ast.x + other.x)/2, (ast.y + other.y)/2, false, false, true, '#888');
                    // Drop loot
                    if (ast.loot) spawnAsteroidLoot(ast.x, ast.y, ast.loot, ast.z);
                    if (other.loot) spawnAsteroidLoot(other.x, other.y, other.loot, other.z);
                    
                    // Destroy both (simple logic as requested)
                    s.asteroids.splice(j, 1);
                    s.asteroids.splice(k, 1);
                    j--; // Adjust index
                    break; 
                }
            }
            if (j < 0) break; // If current ast removed

            // Shield Collision Bounce (Player is at Z=0)
            // Only collide if Asteroid is on middle layer (-50 to 50)
            const shieldRadius = (s.sh2 > 0) ? 48 : (s.sh1 > 0 ? 40 : 0);
            if (shieldRadius > 0 && !s.playerDead && Math.abs(ast.z) < 50) {
                const dx = ast.x - s.px;
                const dy = ast.y - s.py;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const minDist = shieldRadius + ast.size;
                
                if (dist < minDist) {
                    const angle = Math.atan2(dy, dx);
                    ast.vx += Math.cos(angle) * 0.8;
                    ast.vy += Math.sin(angle) * 0.8;
                    const pushOut = minDist - dist;
                    ast.x += Math.cos(angle) * pushOut;
                    ast.y += Math.sin(angle) * pushOut;
                    ast.velX += (Math.random()-0.5)*0.2;
                    ast.velY += (Math.random()-0.5)*0.2;

                    const dmg = 40;
                    if (s.sh2 > 0) { s.sh2 -= dmg; if (s.sh2 < 0) s.sh2 = 0; }
                    else { s.sh1 -= dmg; if (s.sh1 < 0) s.sh1 = 0; }
                    
                    createExplosion(s.px + (dx/dist)*40, s.py + (dy/dist)*40, false, false, true); 
                    audioService.playShieldHit();
                }
            }

            // Increase cleanup boundary for huge asteroids
            const bound = 300;
            // Also cleanup if Z gets too far
            if (ast.y > canvas.height + bound || ast.x < -bound || ast.x > canvas.width + bound || Math.abs(ast.z) > 1000) {
                s.asteroids.splice(j, 1);
            }
        }

        // TRACTOR BEAM LOGIC
        // Base range 200, but if shields active, 2x shield radius (~160 or ~192)
        // Let's make it generous: 2x Shield Radius = ~160. Base = 200.
        // The user said "2 times radius of my shields". Shield is ~40-48. 2x is ~80-100? That's small.
        // Let's assume they mean *extended* range. 
        const shieldR = (s.sh2 > 0 ? 48 : (s.sh1 > 0 ? 40 : 0));
        const tractorRange = shieldR > 0 ? shieldR * 3.5 : 180; // Buffed slightly for gameplay

        s.gifts.forEach(g => {
            if (s.playerDead) {
                g.y += g.vy;
                g.rotation += 0.05; 
                g.isPulled = false;
                return;
            }
            
            const dx = s.px - g.x;
            const dy = s.py - g.y;
            // Loot also has Z, player is Z=0
            const dz = 0 - g.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (dist < tractorRange) {
                if (s.missionCargo.length >= activeShip.config.maxCargo && dist < 50) {
                    if (!g.isPulled) {
                        audioService.playSfx('denied');
                        setStats(p => ({...p, alert: "CARGO HOLD FULL - JETTISON ITEMS"}));
                    }
                    g.isPulled = false;
                    g.y += g.vy;
                    g.rotation += 0.05; 
                } else {
                    g.isPulled = true;
                    if (dist > 0) {
                        // Pull towards player
                        g.x += (dx / dist) * 6;
                        g.y += (dy / dist) * 6;
                        g.z += (dz / dist) * 6; // Pull in Z too
                    }
                    if (dist < 30) {
                        if (s.missionCargo.length < activeShip.config.maxCargo) {
                            const existing = s.missionCargo.find(i => i.type === g.type && i.id === g.id);
                            if (existing) existing.quantity++;
                            else s.missionCargo.push({ instanceId: `loot_${Date.now()}_${Math.random()}`, type: g.type, id: g.id, name: g.name || g.type.toUpperCase(), weight: 1, quantity: 1 });
                            audioService.playSfx('buy');
                            s.gifts = s.gifts.filter(gi => gi !== g);
                            setStats(p => ({...p, alert: `ACQUIRED: ${g.name || g.type.toUpperCase()}`}));
                        }
                    }
                }
            } else {
                g.isPulled = false;
                g.y += g.vy;
                g.rotation += 0.05;
            }
        });
      }
      
      // RENDER LOOP
      ctx.save(); if (s.shake > 0) ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);
      ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      s.stars.forEach(st => { 
          let alpha = 1.0;
          if (st.shimmer) {
              const now = Date.now();
              alpha = 0.4 + (Math.sin((now * 0.005) + st.shimmerPhase) + 1) * 0.3;
          }
          ctx.globalAlpha = alpha;
          ctx.fillStyle = st.color; 
          ctx.fillRect(st.x, st.y, st.s, st.s); 
          ctx.globalAlpha = 1.0;
      });
      s.spaceSystems.forEach(sys => { ctx.save(); const glow = ctx.createRadialGradient(sys.x, sys.y, 0, sys.x, sys.y, sys.sunSize * 5); glow.addColorStop(0, sys.sunColor + '66'); glow.addColorStop(1, 'transparent'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sys.x, sys.y, sys.sunSize*5, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = sys.sunColor; ctx.beginPath(); ctx.arc(sys.x, sys.y, sys.sunSize, 0, Math.PI*2); ctx.fill(); sys.comets.forEach(c => { const dx = c.x - sys.x, dy = c.y - sys.y, angle = Math.atan2(dy, dx), tail = ctx.createLinearGradient(0, 0, Math.cos(angle)*c.tailLength, Math.sin(angle)*c.tailLength); ctx.save(); ctx.translate(c.x, c.y); tail.addColorStop(0, '#fff'); tail.addColorStop(0.5, '#38bdf844'); tail.addColorStop(1, 'transparent'); ctx.strokeStyle = tail; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(angle)*c.tailLength, Math.sin(angle)*c.tailLength); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill(); ctx.restore(); }); sys.planets.forEach(p => { const px = sys.x + Math.cos(p.angle)*p.distance, py = sys.y + Math.sin(p.angle)*p.distance, cs = 4 + (p.baseSize - 4) * sys.viewProgress; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px, py, cs, 0, Math.PI*2); ctx.fill(); if (p.isSelected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.arc(px, py, cs + 5, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); } if (p.moon) { const mx = px + Math.cos(p.moon.angle)*p.moon.distance, my = py + Math.sin(p.moon.angle)*p.moon.distance; ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(mx, my, p.moon.size, 0, Math.PI*2); ctx.fill(); } }); ctx.restore(); });
      
      // Z-SORTING AND RENDERING
      // We must combine Enemies, Asteroids, Loot, and Player into one sorted list to handle depth overlap correctly?
      // Actually, standard Canvas doesn't do Z-buffer. We manually sort.
      // Player is at Z=0.
      
      const renderableItems: any[] = [];
      
      // Add Enemies
      s.enemies.forEach(en => renderableItems.push({ type: 'enemy', z: en.z, obj: en }));
      // Add Asteroids
      s.asteroids.forEach(ast => renderableItems.push({ type: 'asteroid', z: ast.z, obj: ast }));
      // Add Loot
      s.gifts.forEach(g => renderableItems.push({ type: 'loot', z: g.z, obj: g }));
      // Add Player
      if (activeShip && !s.playerExploded) renderableItems.push({ type: 'player', z: 0, obj: activeShip });

      // Sort by Z (ascending: negative/far first, positive/close last)
      renderableItems.sort((a, b) => a.z - b.z);

      // LIGHTING SETUP
      const sunBaseX = s.sunSpawned && s.spaceSystems[0] ? s.spaceSystems[0].x : canvas.width / 2;
      const sunBaseY = s.sunSpawned && s.spaceSystems[0] ? s.spaceSystems[0].y : -1200;
      const orbitRadius = 600;
      const orbitSpeed = 0.002;
      const lightX = sunBaseX + Math.sin(s.frame * orbitSpeed) * orbitRadius;
      const lightY = sunBaseY; 
      const lightZ = 600 + Math.cos(s.frame * orbitSpeed) * 150; 
      const lightSource = { x: lightX, y: lightY, z: lightZ };

      // Render Loop
      renderableItems.forEach(item => {
          const zScale = 1 + (item.z / 1000); // Simple perspective scale
          if (zScale <= 0) return; // Clipped behind camera?

          ctx.save();
          
          if (item.type === 'enemy') {
              const en = item.obj as Enemy;
              // Translate to position, then scale for Z
              ctx.translate(en.x, en.y);
              ctx.scale(zScale, zScale);
              ctx.translate(-en.x, -en.y); // Scale from center
              
              drawShip(ctx, en, en.x, en.y, 0.5, 0, false, Math.PI, false); 
              if (en.sh > 0) { 
                  const shieldColor = en.shieldVisual ? en.shieldVisual.color : (en.type === 'boss' ? '#a855f7' : '#c084fc');
                  const baseRadius = en.type === 'boss' ? 72 : 75; 
                  ctx.save();
                  ctx.strokeStyle = shieldColor;
                  ctx.shadowColor = shieldColor;
                  ctx.shadowBlur = 10;
                  ctx.lineWidth = 2; ctx.setLineDash([5,5]); ctx.beginPath(); ctx.arc(en.x, en.y, baseRadius, 0, Math.PI*2); ctx.stroke();
                  ctx.restore();
              } 
          } 
          else if (item.type === 'player') {
              // Player is always at Z=0 (Scale 1), handled by standard drawShip
              const cT = (s.keys.has('KeyW') || s.keys.has('ArrowUp')) ? 1.3 : ((s.keys.has('KeyS') || s.keys.has('ArrowDown')) ? 0 : 0.5);
              const bK = (s.keys.has('KeyS') || s.keys.has('ArrowDown'));
              const side = (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) ? -1 : ((s.keys.has('KeyD') || s.keys.has('ArrowRight')) ? 1 : 0);
              drawShip(ctx, activeShip, s.px, s.py, cT, side, bK, 0, true);
              
              // Draw Shields on top of player if Z=0 (approx)
              const rS = (shV: number, shD: Shield, rad: number) => { 
                  if (shV <= 0 || s.playerDead || s.playerExploded) return; 
                  ctx.save(); ctx.globalAlpha = 0.6; ctx.shadowBlur = 10; ctx.shadowColor = shD.color; ctx.strokeStyle = shD.color; ctx.lineWidth = 3.0; ctx.beginPath(); 
                  if (shD.visualType === 'forward') { ctx.arc(s.px, s.py, rad, Math.PI*1.2, Math.PI*1.8); } else { ctx.arc(s.px, s.py, rad, 0, Math.PI*2); }
                  ctx.stroke(); ctx.restore(); 
              };
              if (shield) rS(s.sh1, shield, 40); if (secondShield) rS(s.sh2, secondShield, 48);
          }
          else if (item.type === 'asteroid') {
              const a = item.obj as Asteroid;
              // 3D Rendering Code for Asteroid (Using the LightSource)
              const cosX = Math.cos(a.angleX), sinX = Math.sin(a.angleX);
              const cosY = Math.cos(a.angleY), sinY = Math.sin(a.angleY);
              const cosZ = Math.cos(a.angleZ), sinZ = Math.sin(a.angleZ);

              const transformedVerts = a.vertices.map(v => {
                  let y1 = v.y * cosX - v.z * sinX;
                  let z1 = v.y * sinX + v.z * cosX;
                  let x2 = v.x * cosY + z1 * sinY;
                  let z2 = -v.x * sinY + z1 * cosY;
                  let x3 = x2 * cosZ - y1 * sinZ;
                  let y3 = x2 * sinZ + y1 * cosZ;
                  return { x: x3, y: y3, z: z2 };
              });

              const facesToDraw: Face3D[] = [];
              const lx = lightSource.x - a.x, ly = lightSource.y - a.y, lz = lightSource.z - a.z; // Relative to asteroid Z too
              const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz);
              const lightDir = { x: lx/lLen, y: ly/lLen, z: lz/lLen };

              a.faces.forEach(f => {
                  const p0 = transformedVerts[f.indices[0]];
                  const p1 = transformedVerts[f.indices[1]];
                  const p2 = transformedVerts[f.indices[2]];
                  const ax = p1.x - p0.x, ay = p1.y - p0.y, az = p1.z - p0.z;
                  const bx = p2.x - p0.x, by = p2.y - p0.y, bz = p2.z - p0.z;
                  const nx = ay * bz - az * by;
                  const ny = az * bx - ax * bz;
                  const nz = ax * by - ay * bx;
                  const lenN = Math.sqrt(nx*nx + ny*ny + nz*nz);
                  const normal = { x: nx/lenN, y: ny/lenN, z: nz/lenN };
                  if (normal.z < 0) {
                      const zDepth = (p0.z + p1.z + p2.z) / 3;
                      facesToDraw.push({ ...f, normal, zDepth });
                  }
              });
              facesToDraw.sort((f1, f2) => (f1.zDepth || 0) - (f2.zDepth || 0));

              ctx.save();
              ctx.translate(a.x, a.y);
              ctx.scale(zScale, zScale); // APPLY Z SCALE
              
              facesToDraw.forEach(f => {
                  const normal = f.normal!;
                  let intensity = Math.abs(normal.x * lightDir.x + normal.y * lightDir.y + normal.z * lightDir.z);
                  const specular = Math.pow(intensity, 10) * 0.5;
                  ctx.fillStyle = f.color;
                  ctx.beginPath();
                  f.indices.forEach((idx, i) => {
                      const v = transformedVerts[idx];
                      if (i===0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
                  });
                  ctx.closePath();
                  ctx.fill();
                  let finalLight = intensity * f.shadeOffset;
                  finalLight = Math.max(0.15, finalLight);
                  if (finalLight > 1.0) {
                      ctx.fillStyle = `rgba(255,255,255,${(finalLight - 1.0) * 0.6 + specular})`;
                      ctx.fill();
                  } else {
                      ctx.fillStyle = `rgba(0,0,0,${(1.0 - finalLight) * 0.8})`;
                      ctx.fill();
                  }
                  ctx.strokeStyle = `rgba(255,255,255,${0.05 + intensity * 0.1})`;
                  ctx.lineWidth = 0.5;
                  ctx.stroke();
              });
              ctx.restore();
          }
          else if (item.type === 'loot') {
              const g = item.obj as Gift;
              ctx.save(); 
              ctx.translate(g.x, g.y);
              ctx.scale(zScale, zScale);
              ctx.rotate(g.rotation); 
              const boxSize = 18; 
              ctx.fillStyle = g.type === 'weapon' ? '#a855f7' : (g.type === 'energy' ? '#00f2ff' : (g.type === 'gold' ? '#fbbf24' : (g.type === 'platinum' ? '#e2e8f0' : (g.type === 'lithium' ? '#c084fc' : (g.type === 'repair' ? '#10b981' : (g.type === 'shield' ? '#f472b6' : '#60a5fa')))))); 
              ctx.fillRect(-boxSize/2, -boxSize/2, boxSize, boxSize); 
              ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(-boxSize/2, -boxSize/2, boxSize, boxSize); 
              ctx.fillStyle = '#000'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
              let l = ''; if (g.type === 'gold') l = 'G'; else if (g.type === 'platinum') l = 'P'; else if (g.type === 'lithium') l = 'L'; else if (g.type === 'missile') l = 'S'; else if (g.type === 'mine') l = 'M'; else if (g.type === 'fuel') l = 'F'; else if (g.type === 'energy') l = 'E'; else if (g.type === 'weapon') l = 'W'; else if (g.type === 'repair') l = 'H'; else if (g.type === 'shield') l = 'S'; 
              ctx.fillText(l, 0, 0); 
              ctx.restore(); 
              if (g.isPulled) { ctx.save(); ctx.strokeStyle = '#00f2ff'; ctx.globalAlpha = 0.3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(g.x, g.y); ctx.stroke(); ctx.restore(); }
          }

          ctx.restore();
      });

      s.energyBolts.forEach(eb => { ctx.save(); ctx.translate(eb.x, eb.y); const bg = ctx.createRadialGradient(0,0,0,0,0,30); bg.addColorStop(0,'#fff'); bg.addColorStop(0.2,'#00f2ff'); bg.addColorStop(1,'transparent'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill(); ctx.restore(); });
      
      for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; ctx.globalAlpha = p.life; ctx.fillStyle = p.color; if (p.type === 'smoke') { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.001, p.size * (1.5 - p.life)), 0, Math.PI*2); ctx.fill(); } else if (p.type === 'debris') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(s.frame * 0.1); ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); ctx.restore(); } else if (p.type === 'shock') { ctx.lineWidth = 4 * p.life; ctx.strokeStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - p.life) + 10, 0, Math.PI*2); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.001, p.size), 0, Math.PI*2); ctx.fill(); } ctx.globalAlpha = 1; }
      
      // Bullets (Always draw on top layer for now, they are "super fast")
      s.bullets.forEach(b => { 
          const chargeScale = b.chargeLevel || 1.0;
          if (b.variant === 'mega' || b.variant === 'heavy_auto') {
              const w = 3.5; 
              const h = b.variant === 'mega' ? 42 : 28; 
              const angle = Math.atan2(b.vy, b.vx) + Math.PI/2;
              ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(angle); ctx.shadowColor = b.beamColor; ctx.shadowBlur = b.variant === 'mega' ? 10 : 5; ctx.fillStyle = '#ffffff'; ctx.fillRect(-w/2, 0, w, h); ctx.restore();
          } else if (b.visualType) {
              const sz = b.size || 3, clr = b.beamColor || '#fff';
              ctx.save(); ctx.shadowBlur = 10 * chargeScale; ctx.shadowColor = clr;
              if (b.visualType === 'ring') { ctx.strokeStyle = clr; ctx.lineWidth = 2 * chargeScale; ctx.beginPath(); ctx.arc(b.x, b.y, sz + 2, 0, Math.PI * 2); ctx.stroke(); }
              else { ctx.fillStyle = clr; ctx.beginPath(); ctx.arc(b.x, b.y, sz, 0, Math.PI * 2); ctx.fill(); }
              ctx.restore();
          } else {
              if (chargeScale > 1.2) { ctx.save(); ctx.shadowBlur = 10 * chargeScale; ctx.shadowColor = b.beamColor; ctx.fillStyle = '#fff'; ctx.fillRect(b.x - (b.size * 1.5)/2, b.y - b.size * 3, b.size * 1.5, b.size * 6); ctx.restore(); } 
              else { ctx.fillStyle = b.beamColor || '#fbbf24'; ctx.fillRect(b.x - b.size/2, b.y - b.size * 2, b.size, b.size * 4); }
          }
      });
      s.enemyBullets.forEach(eb => { if (eb.isArc) { ctx.strokeStyle = eb.bColor || '#a855f7'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(eb.x, eb.y); ctx.lineTo(s.px, s.py); ctx.stroke(); } else if (eb.isBubble) { ctx.strokeStyle = eb.bColor || '#a855f7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(eb.x, eb.y, 10, 0, Math.PI*2); ctx.stroke(); } else { ctx.fillStyle = eb.bColor || (eb.isExotic ? '#a855f7' : '#f87171'); ctx.fillRect(eb.x-2, eb.y, 4, 18); } });
      s.missiles.forEach(m => { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI/2); ctx.beginPath(); ctx.roundRect(-4, -12, 8, 24, 4); ctx.fillStyle = m.isEmp ? '#00f2ff' : (m.isHeavy ? '#f97316' : '#ef4444'); ctx.fill(); ctx.restore(); });
      s.mines.forEach(m => { 
          // Mine uses simple Z-scaling logic in manual render if we want, but for now drawn standard
          // To make them feel part of the world, apply minimal scale
          const mScale = 1; 
          ctx.save(); ctx.translate(m.x, m.y); ctx.scale(mScale, mScale); ctx.beginPath(); ctx.fillStyle = m.isEMP ? '#3b82f6' : '#fbbf24'; ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill(); 
          if (m.isEMP) { ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 8 + Math.sin(s.frame * 0.2) * 2, 0, Math.PI*2); ctx.stroke(); } else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.stroke(); } ctx.restore(); 
      });

      if (s.isPaused) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,canvas.width,canvas.height); }
      ctx.restore(); anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); window.removeEventListener('blur', handleBlur); window.removeEventListener('keydown', handleKey as any); window.removeEventListener('keyup', handleKey as any); };
  }, [difficulty, activeShip, shield, secondShield, maxEnergy, initialFuel, maxFuelCapacity, initialIntegrity, currentPlanet, quadrant, ships, MISSION_DURATION]);

  const ep = (stats.energy / maxEnergy) * 100, fp = (stats.fuel / maxFuelCapacity) * 100, nl = 15, ael = Math.ceil((ep/100)*nl), afl = Math.ceil((fp/100)*nl);
  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50">
        <div className="retro-font text-[8px] text-zinc-500 uppercase tracking-[0.3em] mb-1">Sector Entry Clock</div>
        <div className={`retro-font text-[10px] ${stats.missionTimer < 20 ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`}>{Math.floor(stats.missionTimer / 60)}:{(stats.missionTimer % 60).toString().padStart(2, '0')}</div>
      </div>
      {stateRef.current.gamePhase === 'observation' && (<div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-none bg-blue-950/20 px-8 py-3 rounded-xl border border-blue-500/30 backdrop-blur-sm"><div className="retro-font text-[10px] text-blue-400 uppercase tracking-widest animate-pulse tracking-[0.4em]">PLANETARY ARRIVAL</div></div>)}
      {stateRef.current.scavengeMode && (<div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-none bg-emerald-950/20 px-8 py-3 rounded-xl border border-emerald-500/30 backdrop-blur-sm"><div className="retro-font text-[10px] text-emerald-400 uppercase tracking-widest animate-pulse">SCAVENGE PHASE ACTIVE</div><div className="retro-font text-[18px] text-white">EXTRACTION IN: {stats.scavengeTimer}s</div></div>)}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-end gap-2.5 z-50 pointer-events-none opacity-95 scale-90">
        <div className="flex flex-col items-center gap-1.5"><div className={`retro-font text-[5px] uppercase font-black ${(stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>FUE</div><div className="flex flex-col-reverse gap-0.5 p-1 bg-zinc-950/70 border border-zinc-800/40 rounded">{Array.from({ length: nl }).map((_, i) => (<div key={i} className={`w-3.5 h-1 rounded-xs transition-colors duration-300 ${i < afl ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: i < afl ? ((stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? '#ff004c' : '#00b7ff') : '#18181b', color: (stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? '#ff004c' : '#00b7ff' }} />))}</div><div className={`retro-font text-[6px] font-black ${(stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? 'text-red-500' : 'text-blue-500'}`}>{stats.fuel.toFixed(1)}U</div></div>
        
        {/* NEW POWER METER LOGIC */}
        <div className="flex flex-col items-center gap-1.5">
            <div className={`retro-font text-[5px] uppercase font-black ${(ep < 20 || stats.energyDepleted) ? 'text-red-500 animate-pulse' : (ep < 50 ? 'text-yellow-400' : 'text-cyan-400')}`}>PWR</div>
            <div className={`flex flex-col-reverse gap-0.5 p-1 bg-zinc-950/70 border border-zinc-800/40 rounded ${stats.energyDepleted ? 'animate-pulse' : ''}`}>
                {Array.from({ length: nl }).map((_, i) => { 
                    const isActive = i < ael;
                    // Blue > 50%, Yellow > 20%, Red < 20%
                    let color = '#00ffd0'; // Default Blue
                    if (ep < 20) color = '#ef4444';
                    else if (ep < 50) color = '#facc15';
                    else color = '#3b82f6';

                    if (stats.energyDepleted) color = '#ef4444'; // Always red if depleted

                    return (<div key={i} className={`w-3.5 h-1 rounded-xs transition-colors duration-200 ${isActive ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: isActive ? color : '#18181b', color: color }} />); 
                })}
            </div>
            <div className={`retro-font text-[6px] font-black ${(ep < 20 || stats.energyDepleted) ? 'text-red-500' : (ep < 50 ? 'text-yellow-500' : 'text-cyan-500')}`}>{stats.energyDepleted ? 'RESET' : `${Math.floor(ep)}%`}</div>
        </div>
      </div>
      {stats.boss && (<div className="absolute top-20 left-1/2 -translate-x-1/2 w-[350px] flex flex-col items-center gap-1 z-50 pointer-events-none bg-black/40 p-3 rounded-lg border border-white/5 opacity-95"><div className="retro-font text-[6px] text-purple-400 uppercase tracking-[0.4em] font-black drop-shadow-[0_0_80px_#a855f7]">XENOS PRIMARY</div><div className="w-full flex flex-col gap-1 mt-1.5">{stats.boss.sh > 0 && (<div className="w-full h-1.5 bg-zinc-900/40 border border-purple-900/30 rounded-full overflow-hidden"><div className="h-full bg-purple-500 shadow-[0_0_12px_#a855f7]" style={{ width: `${(stats.boss.sh/stats.boss.maxSh)*100}%` }} /></div>)}<div className="w-full h-2 bg-zinc-900/40 border border-red-900/30 rounded-full overflow-hidden"><div className="h-full bg-red-600 shadow-[0_0_12px_#dc2626]" style={{ width: `${(stats.boss.hp/stats.boss.maxHp)*100}%` }} /></div></div></div>)}
      <div className="absolute top-3 left-5 flex flex-col gap-2.5 pointer-events-none z-50 opacity-100 scale-90 origin-top-left"><div className="flex items-center gap-2.5"><div className={`retro-font text-[6px] uppercase w-8 font-black ${stateRef.current.isMeltdown ? 'text-red-500 animate-pulse drop-shadow-[0_0_5px_#ef4444]' : 'text-lime-400 drop-shadow-[0_0_5px_#a3e635]'}`}>HULL</div><div className="w-40 h-1.5 bg-zinc-950/50 border border-zinc-800/40 rounded-full overflow-hidden"><div className={`h-full ${stateRef.current.isMeltdown ? 'bg-red-500' : 'bg-lime-500'}`} style={{ width: `${stats.hp}%` }} /></div></div>{shield && <div className="flex items-center gap-2.5"><div className="retro-font text-[6px] uppercase w-8 font-black" style={{ color: shield.color }}>SHLD</div><div className="w-40 h-1.5 bg-zinc-950/50 border border-zinc-800/40 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${(stats.sh1/shield.capacity)*100}%`, backgroundColor: shield.color }} /></div></div>}</div>
      <div className="absolute top-3 right-5 text-right flex flex-col gap-1 z-50 scale-90 origin-top-right"><div className="flex flex-col gap-1 opacity-90"><div className="retro-font text-[12px] text-white tabular-nums">{stats.score.toLocaleString()}</div><div className="retro-font text-[6px] text-zinc-300 uppercase tracking-widest font-black">UNITS</div></div></div>
      
      {/* ORDNANCE INDICATORS (Floating Left) */}
      <div className="absolute bottom-16 left-5 flex flex-col gap-2 pointer-events-none z-[100]">
          {/* Missiles (Red) */}
          <div className="flex items-center gap-2 p-1">
             <div className="flex gap-1">
                 {Array.from({ length: 10 }).map((_, i) => (
                     <div key={`m-${i}`} className={`w-2 h-2 rounded-full ${i < (stats.missiles > 10 ? 10 : stats.missiles) ? 'bg-red-500 shadow-[0_0_5px_#ef4444]' : 'bg-red-950/30 border border-red-900/20'}`} />
                 ))}
             </div>
             <span className="retro-font text-[8px] text-zinc-400 w-12 text-right tabular-nums">{stats.missiles}/{stats.cargoMissiles}</span>
          </div>
          {/* Mines (Yellow) */}
          <div className="flex items-center gap-2 p-1">
             <div className="flex gap-1">
                 {Array.from({ length: 10 }).map((_, i) => (
                     <div key={`n-${i}`} className={`w-2 h-2 rounded-full ${i < (stats.mines > 10 ? 10 : stats.mines) ? 'bg-yellow-500 shadow-[0_0_5px_#eab308]' : 'bg-yellow-950/30 border border-yellow-900/20'}`} />
                 ))}
             </div>
             <span className="retro-font text-[8px] text-zinc-400 w-12 text-right tabular-nums">{stats.mines}/{stats.cargoMines}</span>
          </div>
      </div>

      {/* INDUSTRIAL MODERN BOTTOM BAR */}
      <div className="absolute bottom-5 left-5 right-5 h-8 flex items-center justify-between pointer-events-auto bg-zinc-900/60 rounded-md z-[100]">
          {/* MESSAGE AREA */}
          <div className="flex-grow flex items-center justify-start pl-3 h-full overflow-hidden">
              <span className={`retro-font text-[9px] uppercase tracking-widest truncate ${stats.isPaused ? 'text-white animate-pulse' : (stats.alert ? 'text-amber-400 animate-pulse' : 'text-zinc-500')}`}>
                  {stats.isPaused ? "SYSTEMS PAUSED" : (stats.alert || (stateRef.current.isMeltdown ? "CRITICAL FAILURE" : "SYSTEMS NOMINAL"))}
              </span>
          </div>

          {/* CONTROLS */}
          <div className="flex items-center gap-2 pr-2 h-[80%] shrink-0">
              <button onClick={togglePause} className="h-full px-4 bg-zinc-800 border border-zinc-600 text-zinc-300 retro-font text-[8px] uppercase hover:bg-zinc-700 transition-all rounded-sm">{stats.isPaused ? 'RESUME' : 'PAUSE'}</button>
              
              {/* RETREAT / LAND BUTTON */}
              {stats.bossDead ? (
                  <button onClick={(e) => { const s = stateRef.current; onGameOverRef.current(true, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: true, health: s.integrity, hullPacks: s.hullPacks, cargo: s.missionCargo }); e.currentTarget.blur(); }} className="h-full px-4 bg-emerald-600/20 border border-emerald-500 text-emerald-500 retro-font text-[8px] uppercase hover:bg-emerald-600 hover:text-white transition-all rounded-sm animate-pulse shadow-[0_0_10px_#10b981]">LAND</button>
              ) : (
                  <button onClick={(e) => { const s = stateRef.current, fHP = s.isMeltdown ? 25 : Math.max(0, s.integrity); onGameOverRef.current(false, s.score, true, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: fHP, hullPacks: s.hullPacks, cargo: s.missionCargo }); e.currentTarget.blur(); }} className="h-full px-4 bg-red-900/20 border border-red-800/50 text-red-500 retro-font text-[8px] uppercase hover:bg-red-900 hover:text-white transition-all rounded-sm">RETREAT</button>
              )}
          </div>
      </div>
    </div>
  );
};
export default GameEngine;
