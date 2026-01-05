
// CHECKPOINT: Defender V84.95
// VERSION: V84.99 - PRECISION MANEUVER JETS
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, Weapon, EquippedWeapon, Planet, QuadrantType, WeaponType, CargoItem } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, EXOTIC_SHIELDS, PLANETS, BOSS_SHIPS, SHIELDS } from '../constants.ts';

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
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; type: 'fire' | 'smoke' | 'spark' | 'debris' | 'shock' | 'fuel' | 'electric' | 'plasma';
}

class Enemy {
  x: number; y: number; hp: number; maxHp: number;
  sh: number = 0; maxSh: number = 0;
  type: 'scout' | 'fighter' | 'heavy' | 'boss';
  config: ExtendedShipConfig;
  lastShot: number = 0;
  color: string;
  vx: number = 0; vy: number = 0;
  rewardThresholds: number[] = [0.7, 0.4, 0.1];
  difficulty: number;
  burnLevel: number = 0; // 0: healthy, 1: smoking, 2: burning
  burnTimer: number = 0;
  
  constructor(x: number, y: number, type: 'scout' | 'fighter' | 'heavy' | 'boss', config: ExtendedShipConfig, difficulty: number) {
    this.difficulty = difficulty;
    
    // Scaling sequence
    const shotCounts = [3, 5, 8, 13, 21, 34, 55, 89, 144, 233]; // Fibonacci-based shot requirements
    const diffIdx = Math.max(0, Math.min(9, Math.floor(difficulty - 1)));
    
    // Level 1 Base HP = 100. Matches player resilience. 
    // Ion Pulse (15 dmg) with 2.23 mult does 33.45 damage. 3 shots = 100.35
    const baseHp = (shotCounts[diffIdx] / 3) * 100;
    
    const hpMap = { scout: baseHp * 0.8, fighter: baseHp, heavy: baseHp * 2.5, boss: 3000 * difficulty };
    const shMap = { scout: 0, fighter: 0, heavy: 0, boss: 800 * difficulty };
    
    this.x = x; this.y = y; this.hp = hpMap[type]; this.maxHp = hpMap[type];
    if (type === 'boss') {
      this.sh = shMap[type]; this.maxSh = shMap[type];
    }
    
    this.type = type; this.config = config;
    this.color = type === 'boss' ? '#a855f7' : (type === 'heavy' ? '#ef4444' : (type === 'fighter' ? '#f97316' : '#60a5fa'));
  }

  updateMovement(px: number, py: number) {
    const baseVy = 4.2;
    if (this.type === 'boss') return;
    this.y += baseVy + this.vy;
    this.x += this.vx;
    if (this.difficulty >= 4) { if (this.y > py - 200) this.vy = -1.5; }
    if (this.difficulty >= 5) { if (this.y > py - 100) { this.vy = -5.0; this.vx += (Math.random() - 0.5) * 4; } }
    if (this.difficulty >= 8) { const dx = px - this.x; this.vx += (dx / 400); }
    this.vx *= 0.95;
    this.vy *= 0.95;
    
    // Auto-burn damage
    if (this.burnLevel === 2) {
      this.hp -= 0.15; // Slow decay until explosion
    }
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
  damage: number = 350; // Powerful ordnance
  isHeavy: boolean = false; isEmp: boolean = false;
  constructor(x: number, y: number, vx: number, vy: number, isHeavy: boolean = false, isEmp: boolean = false) { 
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; 
    this.isHeavy = isHeavy; this.isEmp = isEmp;
    if (isHeavy || isEmp) { 
      this.damage = 1800; 
      this.life = 600; 
    }
  }
}

class Mine {
  x: number; y: number; vx: number; vy: number; 
  damage: number = 999999; 
  isMagnetic: boolean = Math.random() > 0.4;
  target: Enemy | null = null;
  sh: number = 100; 
  constructor(x: number, y: number) { this.x = x; this.y = y; this.vx = 0; this.vy = -1.5; }
  update(enemies: Enemy[]) {
    if (this.isMagnetic) {
      if (!this.target || this.target.hp <= 0) {
        let minDist = 700;
        enemies.forEach(en => {
          const d = Math.sqrt((this.x - en.x)**2 + (this.y - en.y)**2);
          if (d < minDist) { minDist = d; this.target = en; }
        });
      }
      if (this.target) {
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        this.vx += (dx/d) * 0.6; this.vy += (dy/d) * 0.6;
      }
    }
    this.x += this.vx; this.y += this.vy;
    this.vx *= 0.98; this.vy *= 0.98;
    if (!this.isMagnetic) this.vy -= 0.1;
  }
}

type GiftType = 'missile' | 'mine' | 'energy' | 'fuel' | 'weapon' | 'gold' | 'platinum' | 'lithium' | 'repair' | 'shield';

class Gift {
  x: number; y: number; vy: number = 1.8; type: GiftType;
  id?: string; name?: string;
  constructor(x: number, y: number, type: GiftType, id?: string, name?: string) { 
    this.x = x; this.y = y; this.type = type; this.id = id; this.name = name;
  }
}

class Asteroid {
  x: number; y: number; hp: number; vx: number; vy: number;
  rotation: number; rotVel: number; size: number;
  variant: string; color: string;
  faces: any[] = [];
  constructor(x: number, y: number, difficulty: number, isScavenge: boolean = false) {
    this.x = x; this.y = y; 
    const rand = Math.random();
    if (isScavenge) {
        if (rand < 0.4) { this.variant = 'gold'; this.size = 20; this.color = '#fbbf24'; this.hp = 1000; }
        else if (rand < 0.7) { this.variant = 'platinum'; this.size = 20; this.color = '#e2e8f0'; this.hp = 1500; }
        else { this.variant = 'lithium'; this.size = 20; this.color = '#c084fc'; this.hp = 800; }
    } else {
        if (rand < 0.33) { this.variant = 'blue_fuel'; this.size = 25; this.color = '#3b82f6'; this.hp = 500; }
        else if (rand < 0.66) { this.variant = 'gray_mine'; this.size = 25; this.color = '#71717a'; this.hp = 800; }
        else { this.variant = 'brown_missile'; this.size = 25; this.color = '#92400e'; this.hp = 600; }
    }
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = 0.5 + Math.random() * 1.2; 
    this.rotation = Math.random() * Math.PI * 2;
    this.rotVel = (Math.random() - 0.5) * 0.06;
    this.generateFacetedMesh();
  }
  generateFacetedMesh() {
    let numOuter = 8;
    const outerPoints: any[] = [];
    for(let i=0; i<numOuter; i++) { 
        const angle = (i / numOuter) * Math.PI * 2; 
        const r = this.size * (0.8 + Math.random() * 0.4); 
        outerPoints.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r }); 
    }
    for(let i=0; i<outerPoints.length; i++) { 
        this.faces.push({ vertices: [outerPoints[i], outerPoints[(i + 1) % outerPoints.length], {x:0, y:0}], shade: 0.3 + Math.random() * 0.7 }); 
    }
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
    hp: initialIntegrity, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, energy: maxEnergy, score: 0, missiles: activeShip?.fitting?.rocketCount || 0, mines: activeShip?.fitting?.mineCount || 0, fuel: initialFuel, hullPacks: initialHullPacks, boss: null as any, alert: "", scavengeTimer: 0, missionTimer: MISSION_DURATION, isPaused: false
  });

  const onGameOverRef = useRef(onGameOver);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  const stateRef = useRef({
    px: 0, py: 0, integrity: initialIntegrity, fuel: initialFuel, energy: maxEnergy, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, score: 0, hullPacks: initialHullPacks, sh1ShatterTime: 0, sh2ShatterTime: 0, missionStartTime: Date.now(), autoRepair: { active: false, timer: 0, lastTick: 0 },
    bullets: [] as any[], enemyBullets: [] as any[], missiles: [] as Missile[], mines: [] as Mine[], enemies: [] as Enemy[], particles: [] as Particle[], stars: [] as any[], gifts: [] as Gift[], asteroids: [] as Asteroid[], spaceSystems: [] as SpaceSystem[], energyBolts: [] as EnergyBolt[],
    fireflies: Array.from({length: 12}).map(() => ({x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5, size: 2.5 + Math.random()*2.5, color: '#00f2ff'})),
    keys: new Set<string>(), lastFire: 0, lastSpawn: 0, lastAsteroidSpawn: 0, lastBoltSpawn: 0, sunSpawned: false, gameActive: true, frame: 0, missileStock: activeShip?.fitting?.rocketCount || 0, mineStock: activeShip?.fitting?.mineCount || 0, equippedWeapons: [...(activeShip?.fitting?.weapons || [])], bossSpawned: false, bossDead: false, lootPending: false, shake: 0, playerDead: false, playerExploded: false, deathSequenceTimer: 300, scavengeMode: false, scavengeTimeRemaining: 0, starDirection: { vx: 0, vy: 1 }, isMeltdown: false, meltdownTimer: 600, // 10 seconds at 60fps
    missionCargo: [...(activeShip?.fitting?.cargo || [])] as CargoItem[], reloading: { missiles: false, mines: false, fuel: false, repair: false, fuelFilling: false, fuelTarget: 0 }, isPaused: false, pauseStartTime: 0, gamePhase: 'travel' as 'travel' | 'observation' | 'boss_intro' | 'boss_fight', observationTimer: 0, isInitialized: false
  });

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

  const spawnAsteroidLoot = (x: number, y: number, variant: string) => {
    const s = stateRef.current;
    let type: GiftType = 'energy';
    if (variant === 'blue_fuel') type = 'fuel'; else if (variant === 'gray_mine') type = 'mine'; else if (variant === 'brown_missile') type = 'missile'; else if (variant === 'gold') type = 'gold'; else if (variant === 'platinum') type = 'platinum'; else if (variant === 'lithium') type = 'lithium';
    s.gifts.push(new Gift(x, y, type));
  };

  const triggerChainReaction = (x: number, y: number, sourceId: any) => {
    const s = stateRef.current; const radius = 180; const chainDmg = 150 * (1 + (difficulty * 0.25)); 
    s.enemies.forEach(en => { if (en === sourceId) return; const dx = en.x - x, dy = en.y - y; if (Math.sqrt(dx*dx + dy*dy) < radius) applyDamageToEnemy(en, chainDmg, WeaponType.PROJECTILE, true); });
  };

  const createExplosion = (x: number, y: number, isBoss: boolean = false, isMine: boolean = false, isShieldOverload: boolean = false, customSmokeColor?: string) => {
    const s = stateRef.current; const count = isBoss ? 150 : (isMine ? 120 : (isShieldOverload ? 100 : 50)); const now = Date.now();
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
    const smokeCount = isMine ? 60 : 20; 
    for (let i = 0; i < smokeCount; i++) {
        const angle = Math.random() * Math.PI * 2, speed = Math.random() * (isMine ? 7 : 3);
        const color = customSmokeColor || 'rgba(80,80,80,0.35)';
        s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.2 + Math.random(), size: (isMine ? 12 : 8) + Math.random() * 18, color: color, type: 'smoke' });
    }
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, speed = Math.random() * (isBoss ? 18 : (isMine ? 18 : 12));
      const type = Math.random() > 0.85 ? 'debris' : (Math.random() > 0.5 ? 'spark' : 'fire');
      const pColor = vividColors[Math.floor(Math.random() * vividColors.length)];
      s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.6 + Math.random() * 1.0, size: Math.random() * (isBoss ? 4 : 2) + 1, color: pColor, type });
    }
  };

  const applyDamageToEnemy = (en: Enemy, dmg: number, wType?: WeaponType, fromChain: boolean = false) => {
    const s = stateRef.current;
    let finalDmg = dmg;
    
    // MASSIVE DAMAGE OVERHAUL
    // Projectile Multiplier set to 2.23 so Ion Pulse (15) takes 3 shots to kill L1 (100 HP)
    if (wType === WeaponType.LASER || wType === WeaponType.EMP) finalDmg *= 6.0;
    else if (wType === WeaponType.PROJECTILE) finalDmg *= 2.23;

    if (en.sh > 0) { 
        const leftover = Math.max(0, finalDmg - en.sh); 
        en.sh = Math.max(0, en.sh - finalDmg); 
        if (leftover > 0) { en.hp -= leftover; en.burnLevel = 1; }
        audioService.playShieldHit(); 
    }
    else { 
      en.hp -= finalDmg; 
      en.burnLevel = 1; // Any damage makes it smoke
      if (en.hp < en.maxHp * 0.6) en.burnLevel = 2; // Catch fire at < 60% HP

      if (en.hp <= 0) {
        if (!fromChain) triggerChainReaction(en.x, en.y, en);
        const scaling = (1 + (difficulty - 1) * 0.1), baseVal = en.type === 'scout' ? 100 : (en.type === 'boss' ? 0 : 300);
        s.score += Math.floor(baseVal * scaling);
        if (en.type === 'boss' && !s.bossDead) { 
          s.score += Math.floor(10000 * Math.pow(1.3, difficulty - 1));
          en.rewardThresholds.forEach((t, i) => { if (en.hp / en.maxHp < t) { const randomEx = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)]; s.gifts.push(new Gift(en.x + (Math.random()-0.5)*120, en.y + (Math.random()-0.5)*120, 'weapon', randomEx.id, randomEx.name)); en.rewardThresholds.splice(i, 1); } }); 
        } 
      }
    }
  };

  const spawnBossExplosions = (bx: number, by: number) => {
    const s = stateRef.current; s.shake = 100; s.lootPending = true; s.scavengeMode = true; s.scavengeTimeRemaining = 4500;
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

  const drawShip = (ctx: CanvasRenderingContext2D, sInst: any, x: number, y: number, thrust: number, side: number, isBreaking: boolean, rotation: number = 0, isGhost: boolean = false) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(0.5, 0.5); ctx.translate(-50, -50); if (isGhost) ctx.globalAlpha = 0.3;
    const { engines: engineCount, hullShapeType, wingStyle } = sInst.config;
    
    const drawEngine = (ex: number, ey: number) => {
      ctx.fillStyle = sInst.engineColor || '#334155'; ctx.beginPath(); ctx.roundRect(ex - 12, ey - 10, 24, 25, 4); ctx.fill();
      ctx.fillStyle = sInst.nozzleColor || '#171717'; ctx.beginPath(); ctx.moveTo(ex-10, ey+8); ctx.lineTo(ex-12, ey+22); ctx.quadraticCurveTo(ex, ey+28, ex+12, ey+22); ctx.lineTo(ex+10, ey+8); ctx.fill();
      if (thrust > 0) { ctx.fillStyle = sInst.type === 'boss' ? '#a855f7' : '#f97316'; ctx.globalAlpha = 0.4 + Math.random() * 0.4; ctx.beginPath(); ctx.moveTo(ex-8, ey+15); ctx.lineTo(ex+8, ey+15); ctx.lineTo(ex, ey+15+(50 * thrust)+Math.random()*15); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    };
    if (engineCount === 1) drawEngine(50, 82); else if (engineCount >= 4) { [10,35,65,90].forEach(ex => drawEngine(ex, 75)); } else { [25,75].forEach(ex => drawEngine(ex, 75)); }
    ctx.fillStyle = sInst.wingColor || '#64748b'; ctx.beginPath(); if (wingStyle === 'delta') { ctx.moveTo(35, 40); ctx.lineTo(4, 88); ctx.lineTo(50, 78); ctx.moveTo(65, 40); ctx.lineTo(96, 88); ctx.lineTo(50, 78); } else { ctx.ellipse(50, 60, 48, 18, 0, 0, Math.PI * 2); } ctx.fill();
    if (isBreaking) { ctx.fillStyle = '#f87171'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(30, 20); ctx.lineTo(30, -10); ctx.lineTo(35, 20); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(70, 20); ctx.lineTo(70, -10); ctx.lineTo(65, 20); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    if (side !== 0) { ctx.fillStyle = '#38bdf8'; ctx.globalAlpha = 0.9; const wx = side < 0 ? 85 : 15, sDir = side < 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(wx, 55); ctx.lineTo(wx + (sDir * 35), 55); ctx.lineTo(wx, 60); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = sInst.color || '#94a3b8'; ctx.beginPath(); if (hullShapeType === 'triangle') { ctx.moveTo(50, 10); ctx.lineTo(80, 85); ctx.lineTo(20, 85); } else { ctx.roundRect(30, 15, 40, 75, 12); } ctx.fill();
    const renderGun = (gx: number, gy: number, sc: number) => { ctx.save(); ctx.translate(gx, gy); ctx.scale(sc, sc); ctx.fillStyle = sInst.gunColor || '#60a5fa'; ctx.fillRect(-1, -18, 2, 42); ctx.fillStyle = sInst.gunBodyColor || '#1c1917'; ctx.fillRect(-7, -5, 14, 22); ctx.restore(); };
    if (sInst.config.defaultGuns === 1) renderGun(50, 15, 0.35); else { renderGun(25, 45, 0.55); renderGun(75, 45, 0.55); }
    ctx.fillStyle = sInst.cockpitColor || '#38bdf8'; ctx.beginPath(); ctx.ellipse(50, (hullShapeType === 'triangle' ? 58 : 38), 9, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };

  const togglePause = () => { const s = stateRef.current; s.isPaused = !s.isPaused; if (s.isPaused) { s.pauseStartTime = Date.now(); s.keys.clear(); } else s.missionStartTime += (Date.now() - s.pauseStartTime); setStats(p => ({ ...p, isPaused: s.isPaused })); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    if (stateRef.current.px === 0) { stateRef.current.px = window.innerWidth / 2; stateRef.current.py = window.innerHeight * 0.85; }
    const starColors = ['#ffffff', '#fbbf24', '#f87171', '#38bdf8', '#4ade80', '#a855f7', '#f472b6'];
    const generateStars = (w: number, h: number) => { stateRef.current.stars = Array.from({ length: 300 }).map(() => ({ x: Math.random() * w, y: Math.random() * h, s: Math.random() * 2.8, v: 0.15 + Math.random() * 0.6, color: starColors[Math.floor(Math.random() * starColors.length)] })); };
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; generateStars(canvas.width, canvas.height); const s = stateRef.current; s.px = Math.max(35, Math.min(canvas.width - 35, s.px)); s.py = Math.max(35, Math.min(canvas.height - 110, s.py)); s.bullets = []; s.enemyBullets = []; if (s.isInitialized && s.gameActive && !s.playerDead && !s.isPaused) { s.isPaused = true; s.pauseStartTime = Date.now(); s.keys.clear(); setStats(p => ({ ...p, isPaused: true })); } };
    const handleBlur = () => { const s = stateRef.current; if (s.gameActive && !s.playerDead && !s.isPaused) { s.isPaused = true; s.pauseStartTime = Date.now(); s.keys.clear(); setStats(p => ({ ...p, isPaused: true })); } };
    resize(); window.addEventListener('resize', resize); window.addEventListener('blur', handleBlur); stateRef.current.isInitialized = true;
    
    // -------------------------------------------------------------------------
    // KEY HANDLER WITH PREVENT DEFAULT & ALTERNATE KEYS
    // -------------------------------------------------------------------------
    const handleKey = (e: KeyboardEvent, isDown: boolean) => { 
        const s = stateRef.current; 
        
        // Prevent default browser actions for game keys to avoid UI interference
        if (['Tab', 'CapsLock', 'ShiftLeft'].includes(e.code)) {
            e.preventDefault();
        }

        if (isDown) s.keys.add(e.code); else s.keys.delete(e.code); 
        
        // Pause via P only now to free Space/Enter
        if (isDown && s.isPaused && e.code === 'KeyP') { togglePause(); return; }
        if (isDown && e.code === 'KeyP') { togglePause(); return; }
        if (isDown && e.code === 'Escape') { s.gameActive = false; const finalHP = s.isMeltdown ? 25 : Math.max(0, s.integrity); onGameOverRef.current(false, s.score, true, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: finalHP, hullPacks: s.hullPacks, cargo: s.missionCargo }); } 
        
        // Missiles: Backslash OR Tab
        if (isDown && (e.code === 'Backslash' || e.code === 'Tab') && !s.playerDead && !s.isPaused) { 
            e.preventDefault(); 
            if (s.missileStock > 0) { 
                s.missileStock--; 
                const isEmp = ships[0].fitting.weapons.some(w => w.id === 'ord_missile_emp'); 
                s.missiles.push(new Missile(s.px, s.py - 40, (Math.random() - 0.5) * 4, -7.0, false, isEmp)); 
                audioService.playWeaponFire('missile'); 
            } 
        } 
        
        // Mines: Enter OR CapsLock
        if (isDown && (e.code === 'Enter' || e.code === 'CapsLock') && !s.playerDead && !s.isPaused) { 
            e.preventDefault(); 
            if (s.mineStock > 0) { 
                s.mineStock--; 
                s.mines.push(new Mine(s.px, s.py)); 
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
        const missionElapsed = (now - s.missionStartTime) / 1000, missionRemaining = Math.max(0, MISSION_DURATION - missionElapsed), canSpawn = missionElapsed > 5; 
        if (s.gamePhase === 'travel') { if (missionRemaining <= 0) { s.gamePhase = 'observation'; s.observationTimer = 0; setStats(p => ({ ...p, alert: "SECTOR SUN DETECTED - ARRIVING" })); if (!s.sunSpawned) { s.spaceSystems.push(new SpaceSystem(canvas.width, canvas.height, quadrant, currentPlanet.id)); s.sunSpawned = true; } } } 
        else if (s.gamePhase === 'observation') { s.observationTimer++; if (s.observationTimer > 360) { s.gamePhase = 'boss_fight'; s.bossSpawned = true; s.enemies.push(new Enemy(canvas.width/2, -450, 'boss', BOSS_SHIPS[Math.floor(Math.random() * BOSS_SHIPS.length)], difficulty)); setStats(p => ({ ...p, alert: "BOSS INTERCEPTION" })); } }
        if (!s.playerDead && !s.playerExploded) {
            if (isVertical && s.fuel > 0) { if (s.keys.has('KeyW') || s.keys.has('ArrowUp')) s.py -= pSpeed; if (s.keys.has('KeyS') || s.keys.has('ArrowDown')) s.py += pSpeed; s.fuel = Math.max(0, s.fuel - 0.0009); }
            if (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) { s.px -= pSpeed; s.starDirection.vx = 2.4; } else if (s.keys.has('KeyD') || s.keys.has('ArrowRight')) { s.px += pSpeed; s.starDirection.vx = -2.4; } else s.starDirection.vx *= 0.93;
            s.px = Math.max(35, Math.min(canvas.width - 35, s.px)); s.py = Math.max(35, Math.min(canvas.height - 110, s.py)); s.energy = Math.min(maxEnergy, s.energy + 4.0); 
            
            // SYSTEM RELOADING & REFUELING LOGIC
            if (s.fuel < 0.05 && !s.reloading.fuel && !s.isMeltdown) {
                const cargoIdx = s.missionCargo.findIndex(i => i.type === 'fuel');
                if (cargoIdx !== -1) { 
                  s.reloading.fuel = true; 
                  setStats(p => ({ ...p, alert: "INITIATING REFUEL..." })); 
                  setTimeout(() => { 
                    const idx = s.missionCargo.findIndex(i => i.type === 'fuel'); 
                    if (idx !== -1) { 
                      setStats(p => ({ ...p, alert: "TRANSFERRING FUEL..." })); 
                      s.reloading.fuelFilling = true;
                      s.reloading.fuelTarget = Math.min(maxFuelCapacity, s.fuel + 1.0);
                      if (s.missionCargo[idx].quantity > 1) s.missionCargo[idx].quantity--; else s.missionCargo.splice(idx, 1);
                    } else {
                      s.reloading.fuel = false;
                    }
                  }, 5000); // 5s to start
                }
            }
            if (s.reloading.fuelFilling) {
              s.fuel += (1.0 / (20 * 60)); // Gradually fill over 20 seconds at 60fps
              if (s.fuel >= s.reloading.fuelTarget) {
                s.fuel = s.reloading.fuelTarget;
                s.reloading.fuelFilling = false;
                s.reloading.fuel = false;
                setStats(p => ({ ...p, alert: "REFUEL COMPLETE" }));
                setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500);
              }
            }

            if (s.missileStock <= 0 && !s.reloading.missiles && !s.isMeltdown) {
              const cargoIdx = s.missionCargo.findIndex(i => i.type === 'missile');
              if (cargoIdx !== -1) {
                s.reloading.missiles = true;
                setStats(p => ({ ...p, alert: "RELOADING MISSILES..." }));
                setTimeout(() => {
                  const idx = s.missionCargo.findIndex(i => i.type === 'missile');
                  if (idx !== -1) {
                    s.missileStock = Math.min(50, s.missileStock + 10);
                    if (s.missionCargo[idx].quantity > 1) s.missionCargo[idx].quantity--; else s.missionCargo.splice(idx, 1);
                    setStats(p => ({ ...p, alert: "MISSILES LOADED" }));
                    setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500);
                  }
                  s.reloading.missiles = false;
                }, 5000); // 5s reload
              }
            }

            if (s.mineStock <= 0 && !s.reloading.mines && !s.isMeltdown) {
              const cargoIdx = s.missionCargo.findIndex(i => i.type === 'mine');
              if (cargoIdx !== -1) {
                s.reloading.mines = true;
                setStats(p => ({ ...p, alert: "RELOADING MINES..." }));
                setTimeout(() => {
                  const idx = s.missionCargo.findIndex(i => i.type === 'mine');
                  if (idx !== -1) {
                    s.mineStock = Math.min(50, s.mineStock + 10);
                    if (s.missionCargo[idx].quantity > 1) s.missionCargo[idx].quantity--; else s.missionCargo.splice(idx, 1);
                    setStats(p => ({ ...p, alert: "MINES LOADED" }));
                    setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500);
                  }
                  s.reloading.mines = false;
                }, 5000); // 5s reload
              }
            }

            if (s.integrity < 20 && !s.reloading.repair && !s.autoRepair.active && !s.isMeltdown) {
                const cargoIdx = s.missionCargo.findIndex(i => i.type === 'repair');
                if (cargoIdx !== -1) { s.reloading.repair = true; setStats(p => ({ ...p, alert: "REPAIRING..." })); setTimeout(() => { const idx = s.missionCargo.findIndex(i => i.type === 'repair'); if (idx !== -1) { s.integrity = Math.min(100, s.integrity + 20); if (s.missionCargo[idx].quantity > 1) s.missionCargo[idx].quantity--; else s.missionCargo.splice(idx, 1); setStats(p => ({ ...p, alert: "RESTORED" })); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); } s.reloading.repair = false; }, 3000); }
            }
            if (shield && s.sh1 < shield.capacity) { const isBroken = s.sh1 <= 0, t = now - s.sh1ShatterTime; if (!isBroken || t > 10000) { const rv = shield.regenRate * 0.16, rc = shield.energyCost * 0.032; if (s.energy >= rc) { s.sh1 = Math.min(shield.capacity, s.sh1 + rv); s.energy -= rc; if (isBroken && s.sh1 > 0) setStats(p => ({ ...p, alert: "PRIMARY SHIELD REBOOTED" })); } } }
            if (secondShield && s.sh2 < secondShield.capacity) { const isBroken = s.sh2 <= 0, t = now - s.sh2ShatterTime; if (!isBroken || t > 10000) { const rv = secondShield.regenRate * 0.16, rc = secondShield.energyCost * 0.032; if (s.energy >= rc) { s.sh2 = Math.min(secondShield.capacity, s.sh2 + rv); s.energy -= rc; if (isBroken && s.sh2 > 0) setStats(p => ({ ...p, alert: "SECONDARY SHIELD REBOOTED" })); } } }
            if (s.integrity < 10 && s.hullPacks > 0 && !s.autoRepair.active && !s.isMeltdown) { s.autoRepair.active = true; s.autoRepair.timer = 10; s.autoRepair.lastTick = now; s.hullPacks--; setStats(p => ({ ...p, alert: `CRITICAL HULL - AUTO-REPAIR IN: 10s` })); }
            if (s.autoRepair.active) { if (now - s.autoRepair.lastTick > 1000) { s.autoRepair.timer--; s.autoRepair.lastTick = now; if (s.autoRepair.timer > 0) setStats(p => ({ ...p, alert: `CRITICAL HULL - AUTO-REPAIR IN: ${s.autoRepair.timer}s` })); else { s.integrity = Math.min(100, s.integrity + 20); s.autoRepair.active = false; setStats(p => ({ ...p, alert: "RESTORED" })); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); } } }
            
            // REACTOR MELTDOWN SEQUENCE (10 SECONDS)
            if (s.integrity <= 0 && !s.isMeltdown && !s.playerExploded) { 
                s.isMeltdown = true; 
                s.meltdownTimer = 600; 
                setStats(p => ({ ...p, alert: "REACTOR MELTDOWN - ABORT NOW" })); 
            }
            if (s.isMeltdown) {
              s.meltdownTimer--;
              s.fuel = Math.max(0, s.fuel - (maxFuelCapacity / 600)); // Drain fuel in 10s
              s.integrity = Math.max(0, s.integrity - 0.1); // Visual drain
              setStats(p => ({ ...p, alert: `MELTDOWN T-MINUS: ${Math.ceil(s.meltdownTimer/60)}s` }));
              if (s.meltdownTimer <= 0) {
                s.isMeltdown = false;
                s.playerExploded = true;
                s.deathSequenceTimer = 300; // 5 seconds wait
                createExplosion(s.px, s.py, true, false, false, '#f97316');
                audioService.playExplosion(0, 2.5);
              }
              if (s.frame % 2 === 0) {
                s.particles.push({ x: s.px + (Math.random()-0.5)*40, y: s.py + (Math.random()-0.5)*40, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 0.8, color: '#f97316', size: 10, type: 'fire' });
                s.particles.push({ x: s.px + (Math.random()-0.5)*30, y: s.py + (Math.random()-0.5)*30, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 1.0, color: 'rgba(50,50,50,0.6)', size: 15, type: 'smoke' });
              }
            }

            // FIRING: Shift (Left or Right)
            if ((s.keys.has('ShiftLeft') || s.keys.has('ShiftRight')) && s.energy > 5 && s.equippedWeapons.length > 0 && !s.isMeltdown) {
            s.equippedWeapons.forEach((w) => {
                const weaponDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(wd => wd.id === w.id); if (!weaponDef) return;
                if (now - s.lastFire < (weaponDef.fireRate > 30 ? 0 : (1000 / weaponDef.fireRate))) return;
                const gunPositions = activeShip.config.defaultGuns === 1 ? [0] : [-18, 18];
                gunPositions.forEach((xOff, i) => {
                    const baseB: any = { x: s.px + xOff, y: s.py - 35, vx: 0, vy: -24, damage: weaponDef.damage * (1 + (difficulty*0.18)), type: weaponDef.id, beamColor: weaponDef.beamColor || '#fff', timer: 0, target: null, size: 3.5, isBeam: false, xOffset: xOff, wType: weaponDef.type };
                    
                    // Exotic Visual Style Mapping
                    if (weaponDef.id === 'exotic_wave') baseB.visualType = 'ring';
                    else if (weaponDef.id === 'exotic_bolt' || weaponDef.id === 'exotic_mining_laser') baseB.visualType = 'thunder';
                    else if (weaponDef.id === 'exotic_bubbles' || weaponDef.id === 'exotic_nova' || weaponDef.id === 'exotic_gravity') baseB.visualType = 'solid_glow';
                    else if (weaponDef.id === 'exotic_fan' || weaponDef.id === 'exotic_arc' || weaponDef.id === 'exotic_venom') baseB.visualType = 'spindle';
                    else if (weaponDef.id === 'exotic_seeker' || weaponDef.id === 'exotic_plasma_ball' || weaponDef.id === 'exotic_flame') baseB.visualType = 'comet';

                    // Spread Logic - Left gun shoots left angle, Right gun shoots right angle
                    // If single gun, alternate or random narrow cone
                    if (activeShip.config.defaultGuns > 1) {
                        const spreadAngle = 0.15; // Approx 8-9 degrees
                        if (xOff < 0) baseB.vx = -baseB.vy * Math.tan(spreadAngle * -1); // Left gun tilts left
                        else baseB.vx = -baseB.vy * Math.tan(spreadAngle); // Right gun tilts right
                    } else {
                        // Single gun spread logic
                        const maxAngle = 0.2; // +/- 11 degrees
                        baseB.vx = -baseB.vy * Math.tan((Math.random() - 0.5) * maxAngle);
                    }

                    // Specific per-weapon behavior overrides
                    if (weaponDef.id === 'exotic_fan') { 
                        // Enhanced spread for Fan/Scatter weapon
                        baseB.vx *= 2.5; 
                    } 
                    
                    if (weaponDef.id === 'exotic_flame') {
                       baseB.life = 25; 
                       baseB.vy = -18;
                       // Add some flame particles on launch
                       for(let f=0; f<2; f++) s.particles.push({ x: s.px + xOff, y: s.py - 40, vx: (Math.random()-0.5)*3, vy: -5 - Math.random()*5, life: 0.5, color: '#f97316', size: 4 + Math.random()*6, type: 'fire' });
                    }

                    s.bullets.push(baseB);
                });
                s.energy -= (weaponDef.energyCost / 20) * (activeShip.config.defaultGuns);
                audioService.playWeaponFire(weaponDef.type === WeaponType.LASER ? 'laser' : 'cannon'); s.lastFire = now;
            });
            }
        }
        
        // PLAYER PERSISTENT DAMAGE VISUALS
        if (s.integrity < 100 && !s.playerExploded) {
          if (s.frame % 5 === 0) {
            s.particles.push({ x: s.px + (Math.random()-0.5)*15, y: s.py + 10, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2 + 3, life: 0.8, color: 'rgba(60,60,60,0.5)', size: 8 + Math.random()*8, type: 'smoke' });
            if (s.integrity < 60) {
              s.particles.push({ x: s.px + (Math.random()-0.5)*10, y: s.py + 5, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3 + 2, life: 0.5, color: '#ef4444', size: 4 + Math.random()*4, type: 'fire' });
            }
          }
        }

        // DEATH SEQUENCE (POST-EXPLOSION 5 SECONDS)
        if (s.playerExploded) {
            s.deathSequenceTimer--;
            if (s.deathSequenceTimer <= 0) {
                s.playerDead = true;
            }
        }

        s.fireflies.forEach(f => { if (s.frame % 40 === 0) { f.vx += (Math.random()-0.5)*0.3; f.vy += (Math.random()-0.5)*0.3; } f.x += f.vx; f.y += f.vy + s.starDirection.vy*0.3; f.x += s.starDirection.vx*0.15; if (f.y > canvas.height) f.y = -10; if (f.y < -100) f.y = canvas.height; if (f.x < 0) f.x = canvas.width; if (f.x > canvas.width) f.x = 0; if (s.energy < maxEnergy * 0.5 && !s.playerDead && !s.playerExploded) { const d = Math.sqrt((f.x - s.px)**2 + (f.y - s.py)**2); if (d < 45) { s.energy = maxEnergy * 0.8; f.y = -200; audioService.playSfx('buy'); setStats(p => ({ ...p, alert: "RESTORED" })); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); } } });
        if (canSpawn && s.asteroids.length < (s.scavengeMode ? 12 : 5) && now - s.lastAsteroidSpawn > (s.scavengeMode ? 800 : 3500)) { s.asteroids.push(new Asteroid(Math.random() * canvas.width, -180, difficulty, s.scavengeMode)); s.lastAsteroidSpawn = now; }
        if (now - s.lastBoltSpawn > 6500) { s.energyBolts.push(new EnergyBolt(canvas.width, canvas.height)); s.lastBoltSpawn = now; }
        if (s.scavengeMode) { s.scavengeTimeRemaining--; if (s.scavengeTimeRemaining <= 0) { onGameOverRef.current(true, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: s.integrity, hullPacks: s.hullPacks, cargo: s.missionCargo }); return; } }
        if (canSpawn && s.gamePhase === 'travel' && now - s.lastSpawn > (1800 / Math.sqrt(Math.max(1, difficulty)))) { const shipIdx = Math.min(SHIPS.length - 1, Math.floor(Math.random() * (difficulty + 1))); s.enemies.push(new Enemy(Math.random() * (canvas.width - 120) + 60, -150, 'fighter', SHIPS[shipIdx], difficulty)); s.lastSpawn = now; }
        for (let i = s.mines.length - 1; i >= 0; i--) {
            const m = s.mines[i]; m.update(s.enemies); if (m.y < -200 || m.y > canvas.height + 200) s.mines.splice(i, 1);
            else { for (let j = s.enemies.length - 1; j >= 0; j--) { const en = s.enemies[j]; if (Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 55) { applyDamageToEnemy(en, m.damage, WeaponType.MINE); createExplosion(m.x, m.y, false, true, false, m.isMagnetic ? 'rgba(249, 115, 22, 0.6)' : 'rgba(59, 130, 246, 0.6)'); s.mines.splice(i, 1); if (en.hp <= 0) { if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } s.enemies.splice(j, 1); } break; } } }
        }
        for (let j = s.enemies.length - 1; j >= 0; j--) {
            const en = s.enemies[j]; 
            
            // Persistent damage effects (Trail of fire/smoke)
            if (en.burnLevel > 0) {
                if (s.frame % 3 === 0) {
                    s.particles.push({ x: en.x + (Math.random()-0.5)*20, y: en.y + (Math.random()-0.5)*20, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2 + 2, life: 0.6, color: 'rgba(80,80,80,0.4)', size: 8 + Math.random()*8, type: 'smoke' });
                    if (en.burnLevel === 2) {
                        s.particles.push({ x: en.x + (Math.random()-0.5)*15, y: en.y + (Math.random()-0.5)*15, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3 + 1, life: 0.4, color: '#f97316', size: 3 + Math.random()*4, type: 'fire' });
                    }
                }
            }

            for (let k = s.asteroids.length - 1; k >= 0; k--) { const ast = s.asteroids[k]; if (Math.sqrt((en.x - ast.x)**2 + (en.y - ast.y)**2) < ast.size + 45) { if (ast.y > 0) { if (en.type === 'boss') { s.asteroids.splice(k, 1); createImpactEffect(ast.x, ast.y, 'asteroid'); audioService.playExplosion(0, 0.4); continue; } createExplosion(en.x, en.y); triggerChainReaction(en.x, en.y, en); s.enemies.splice(j, 1); s.asteroids.splice(k, 1); audioService.playExplosion(); break; } } }
            if (s.enemies[j] && !s.playerDead && !s.playerExploded) { const d = Math.sqrt((en.x - s.px)**2 + (en.y - s.py)**2); if (en.type === 'boss' && d < 155) { const dx = s.px - en.x, dy = s.py - en.y, push = Math.sqrt(dx*dx + dy*dy); s.px += (dx/push) * 20; s.py += (dy/push) * 20; if (s.sh1 > 0 || s.sh2 > 0) audioService.playShieldHit(); else { s.integrity -= 2; s.shake = 10; } continue; } if (s.sh2 > 0 && d < 105) { createExplosion(en.x, en.y, false, false, true); s.enemies.splice(j, 1); s.sh2 -= 150; if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; } audioService.playShieldHit(); audioService.playExplosion(); continue; } else if (s.sh1 > 0 && d < 85) { createExplosion(en.x, en.y, false, false, true); s.enemies.splice(j, 1); s.sh1 -= 150; if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; } audioService.playShieldHit(); audioService.playExplosion(); continue; } else if (d < 65) { s.integrity -= 25; s.shake = 55; createExplosion(en.x, en.y); s.enemies.splice(j, 1); audioService.playExplosion(); continue; } }
        }
        for (let i = s.asteroids.length - 1; i >= 0; i--) { const a = s.asteroids[i]; a.x += a.vx; a.y += a.vy; a.rotation += a.rotVel; if (!s.playerDead && !s.playerExploded) { const dx = a.x - s.px, dy = a.y - s.py, d = Math.sqrt(dx*dx + dy*dy); if (d < a.size + 40 && a.y > 0) { const aP = (shield?.id === 'sh_omega' && s.sh1 > 0) || (secondShield?.id === 'sh_omega' && s.sh2 > 0), aR = (shield?.id === 'sh_beta' && s.sh1 > 0) || (secondShield?.id === 'sh_beta' && s.sh2 > 0); if (aP || aR) { const bS = aP ? 1.5 : 1.0; a.vx = (dx/d) * bS; a.vy = (dy/d) * bS; if (s.sh2 > 0) { s.sh2 -= aP ? 15 : 20; if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; } } else if (s.sh1 > 0) { s.sh1 -= aP ? 15 : 20; if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; } } audioService.playShieldHit(); } else { if (s.sh2 > 0) { s.sh2 -= 60; if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; } a.vx = (dx/d)*0.5; a.vy = (dy/d)*0.5; } else if (s.sh1 > 0) { s.sh1 -= 60; if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; } a.vx = (dx/d)*0.5; a.vy = (dy/d)*0.5; } else { s.integrity -= 20; s.shake = 40; spawnAsteroidLoot(a.x, a.y, a.variant); s.asteroids.splice(i, 1); createExplosion(a.x, a.y); audioService.playExplosion(); continue; } } } } if (a.y > canvas.height + 300) s.asteroids.splice(i, 1); }
        for (let i = s.gifts.length - 1; i >= 0; i--) { const g = s.gifts[i]; g.y += g.vy; if (Math.abs(g.x-s.px) < 55 && Math.abs(g.y-s.py) < 55) { s.gifts.splice(i, 1); if (g.type === 'energy') { s.energy = maxEnergy * 0.8; setStats(p => ({ ...p, alert: "RESTORED" })); audioService.playSfx('buy'); } else { const cT: CargoItem['type'] = g.type, ex = s.missionCargo.find(it => it.type === cT && it.id === g.id); if (ex) ex.quantity++; else s.missionCargo.push({ instanceId: Math.random().toString(36).substr(2, 9), type: cT, id: g.id, name: g.name || g.type.replace('_', ' ').toUpperCase(), weight: 5, quantity: 1 }); setStats(p => ({ ...p, alert: `SECURED: ${g.type.toUpperCase()}` })); audioService.playSfx('click'); } setTimeout(() => setStats(p => ({ ...p, alert: "" })), 2000); } if (g.y > canvas.height + 150) s.gifts.splice(i, 1); }
        for (let i = s.missiles.length - 1; i >= 0; i--) { 
            const m = s.missiles[i]; if (!m.target || m.target.hp <= 0) { let t = null, md = 25000; if (m.isEmp) { s.enemies.forEach(en => { if (en.sh > 0) { const d = Math.sqrt((m.x-en.x)**2+(m.y-en.y)**2); if (d < md && d < 1200) { md = d; t = en; } } }); } if (!t) { s.enemies.forEach(en => { const d = Math.sqrt((m.x-en.x)**2+(m.y-en.y)**2); if(d < md){ md = d; t = en; } }); } m.target = t; } 
            if (m.target) { const dx = m.target.x - m.x, dy = m.target.y - m.y, d = Math.sqrt(dx*dx+dy*dy); m.vx += (dx/d)*2.66; m.vy += (dy/d)*2.66; } else m.vy -= 0.7;
            s.asteroids.forEach(ast => { const adx = m.x - ast.x, ady = m.y - ast.y, distSq = adx*adx + ady*ady, sr = ast.size + 100; if (distSq < sr*sr) { const d = Math.sqrt(distSq), f = (1 - (d/sr)) * 2.5; m.vx += (adx/d) * f; m.vy += (ady/d) * f; } });
            m.x += m.vx; m.y += m.vy; m.vx *= 0.96; m.vy *= 0.96; m.life--; if (m.life <= 0 || m.y < -700) { createExplosion(m.x, m.y, false, true); s.missiles.splice(i, 1); continue; } 
            let hitT = false; for (let j = s.enemies.length - 1; j >= 0; j--) { const en = s.enemies[j]; if (Math.sqrt((m.x-en.x)**2 + (m.y-en.y)**2) < 40) { applyDamageToEnemy(en, m.damage, m.isEmp ? WeaponType.EMP : WeaponType.MISSILE); createImpactEffect(m.x, m.y, en.sh > 0 ? 'shield' : 'vessel', en.sh > 0 ? (en.type === 'boss' ? '#a855f7' : '#38bdf8') : undefined); createExplosion(m.x, m.y, false, true); s.missiles.splice(i, 1); if (en.hp <= 0) { if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } s.enemies.splice(j, 1); } hitT = true; break; } } 
            if (!hitT) { for (let k = s.asteroids.length - 1; k >= 0; k--) { const ast = s.asteroids[k]; if (ast.y > 0 && Math.sqrt((m.x - ast.x)**2 + (m.y - ast.y)**2) < ast.size + 25) { createImpactEffect(m.x, m.y, 'asteroid'); ast.hp -= m.damage; createExplosion(m.x, m.y); s.missiles.splice(i, 1); if (ast.hp <= 0) { spawnAsteroidLoot(ast.x, ast.y, ast.variant); s.asteroids.splice(k, 1); } hitT = true; break; } } }
        }
        for (let j = s.enemies.length - 1; j >= 0; j--) { 
          const en = s.enemies[j]; if (en.type === 'boss') { en.x = canvas.width/2 + Math.sin(s.frame * 0.02) * (canvas.width * 0.42); en.y = Math.min(en.y + 1.8, 220); } else en.updateMovement(s.px, s.py);
          if (en.hp <= 0 || en.y > canvas.height + 300) { 
            if (en.hp <= 0) {
              createExplosion(en.x, en.y);
              if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); }
            }
            s.enemies.splice(j, 1); continue; 
          } 
          if (now - en.lastShot > 1650 / Math.sqrt(Math.max(1, difficulty)) && en.y > 0) { 
            if (en.type === 'boss') { 
                const wepId = en.config.weaponId;
                const wepDef = EXOTIC_WEAPONS.find(w => w.id === wepId);
                const bColor = wepDef?.beamColor || '#a855f7';
                
                if (wepId === 'exotic_fan') {
                    for(let a = -2; a <= 2; a++) s.enemyBullets.push({ x: en.x, y: en.y + 110, vy: 8 + difficulty, vx: a * 2.5, isExotic: true, bColor });
                } else if (wepId === 'exotic_bubbles') {
                    s.enemyBullets.push({ x: en.x, y: en.y + 110, vy: 6 + difficulty, vx: (Math.random()-0.5)*6, isExotic: true, bColor, isBubble: true });
                } else if (wepId === 'exotic_arc') {
                    const d = Math.sqrt((s.px-en.x)**2 + (s.py-en.y)**2);
                    if (d < 900) s.enemyBullets.push({ x: en.x, y: en.y + 110, isArc: true, bColor });
                } else {
                    s.enemyBullets.push({ x: en.x - 60, y: en.y + 110, vy: 11 + difficulty, isExotic: true, bColor });
                    s.enemyBullets.push({ x: en.x + 60, y: en.y + 110, vy: 11 + difficulty, isExotic: true, bColor });
                    if (difficulty >= 6) s.enemyBullets.push({ x: en.x, y: en.y + 130, vy: 14 + difficulty, isExotic: true, bColor });
                }
            } 
            else { s.enemyBullets.push({ x: en.x, y: en.y + 50, vy: 9.0 + difficulty }); } en.lastShot = now; 
          } 
        }
        for (let i = s.bullets.length - 1; i >= 0; i--) { 
            const b = s.bullets[i]; 
            // Removed Seeker and Arc-Hit Logic - All are dumb-fire projectiles now
            b.y += b.vy; b.x += b.vx; 
            
            if (b.life !== undefined) b.life--; 
            let hitB = false; 
            
            // Visual trails
            if (b.visualType === 'comet' && s.frame % 2 === 0) {
                s.particles.push({ x: b.x, y: b.y, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2 + 2, life: 0.5, color: b.beamColor, size: 4, type: 'plasma' });
            }

            for (let j = s.enemies.length - 1; j >= 0; j--) { 
                const en = s.enemies[j]; 
                const distSq = (b.x-en.x)**2 + (b.y-en.y)**2;
                const hitRadius = en.type === 'boss' ? 70 : 28; // Tighter hull hit radius so bullets visually touch
                if (distSq < hitRadius*hitRadius) { 
                    createImpactEffect(b.x, b.y, en.sh > 0 ? 'shield' : 'vessel', en.sh > 0 ? (en.type === 'boss' ? '#a855f7' : '#38bdf8') : undefined); 
                    applyDamageToEnemy(en, b.damage, b.wType); 
                    hitB = true; break; 
                } 
            } 
            if (!hitB) { for (let j = s.asteroids.length - 1; j >= 0; j--) { const ast = s.asteroids[j]; if (ast.y > 0 && Math.sqrt((b.x - ast.x)**2 + (b.y - ast.y)**2) < ast.size + 30) { createImpactEffect(b.x, b.y, 'asteroid'); let aDmg = b.damage; ast.hp -= aDmg; if (ast.hp <= 0) { spawnAsteroidLoot(ast.x, ast.y, ast.variant); s.asteroids.splice(j, 1); } hitB = true; break; } } } 
            if (hitB || b.y < -250 || b.y > canvas.height + 250 || (b.life !== undefined && b.life <= 0)) s.bullets.splice(i, 1); 
        }
        for (let i = s.enemyBullets.length - 1; i >= 0; i--) { 
            const eb = s.enemyBullets[i]; 
            if (eb.isArc) {
                const dist = Math.sqrt((eb.x-s.px)**2 + (eb.y-s.py)**2);
                if (dist < 900) {
                    let dmg = 0.5; // continuous arc damage
                    if (s.sh2 > 0) s.sh2 -= dmg; else if (s.sh1 > 0) s.sh1 -= dmg; else s.integrity -= dmg;
                }
                s.enemyBullets.splice(i, 1);
                continue;
            }
            eb.y += eb.vy; eb.x += (eb.vx || 0);
            if (!s.playerDead && !s.playerExploded && Math.sqrt((eb.x - s.px)**2 + (eb.y - s.py)**2) < 60) { 
              s.enemyBullets.splice(i, 1); 
              let dmg = eb.isExotic ? 45 : 34; // 3 shots (~34 each) to kill L1 player hull (100)
              createImpactEffect(eb.x, eb.y, (s.sh1 > 0 || s.sh2 > 0) ? 'shield' : 'vessel', (s.sh2 > 0 ? secondShield?.color : (s.sh1 > 0 ? shield?.color : undefined))); 
              if (s.sh2 > 0) { s.sh2 -= dmg * 1.5; if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; } } 
              else if (s.sh1 > 0) { s.sh1 -= dmg * 1.5; if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; } } 
              else { s.integrity -= dmg; s.shake = 15; }
              audioService.playShieldHit(); 
              continue; 
            } 
            for (let j = s.asteroids.length - 1; j >= 0; j--) { const ast = s.asteroids[j]; if (ast.y > 0 && Math.sqrt((eb.x - ast.x)**2 + (eb.y - ast.y)**2) < ast.size + 20) { createImpactEffect(eb.x, eb.y, 'asteroid'); ast.hp -= 40; s.enemyBullets.splice(i, 1); if (ast.hp <= 0) { spawnAsteroidLoot(ast.x, ast.y, ast.variant); s.asteroids.splice(j, 1); } break; } }
            if (eb.y > canvas.height + 250) s.enemyBullets.splice(i, 1); 
        }
        s.stars.forEach(st => { st.y += st.v; st.x += s.starDirection.vx * st.v; if (st.y > canvas.height) { st.y = -10; st.x = Math.random() * canvas.width; } if (st.x < 0) st.x = canvas.width; if (st.x > canvas.width) st.x = 0; });
        if (s.sunSpawned) { const sys = s.spaceSystems[0]; sys.viewProgress = Math.min(1, sys.viewProgress + 0.003); sys.planets.forEach(p => { p.angle += p.speed; if (p.moon) p.moon.angle += p.moon.speed; }); sys.comets.forEach(c => { c.angle += c.speed; c.x = sys.x + Math.cos(c.angle) * c.a; c.y = sys.y + Math.sin(c.angle) * c.b; const dx = c.x - sys.x, dy = c.y - sys.y, d = Math.sqrt(dx*dx + dy*dy); c.tailLength = Math.max(0, 150 - (d / 10)); }); }
        if (s.shake > 0) s.shake *= 0.93;
        if (s.playerDead) { onGameOverRef.current(false, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: 0, bossDefeated: s.bossDead, health: 0, hullPacks: s.hullPacks, cargo: s.missionCargo }); return; }
        if (s.bossDead && !s.scavengeMode && s.enemies.length === 0 && s.gifts.length === 0 && !s.lootPending) { onGameOverRef.current(true, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: s.integrity, hullPacks: s.hullPacks, cargo: s.missionCargo }); return; }
        const bI = s.enemies.find(e => e.type === 'boss'), mR = Math.max(0, MISSION_DURATION - ((now - s.missionStartTime) / 1000));
        setStats(p => ({ ...p, hp: Math.max(0, s.integrity), sh1: Math.max(0, s.sh1), sh2: Math.max(0, s.sh2), energy: s.energy, score: s.score, missiles: s.missileStock, mines: s.mineStock, fuel: s.fuel, hullPacks: s.hullPacks, boss: bI ? { hp: bI.hp, maxHp: bI.maxHp, sh: bI.sh, maxSh: bI.maxSh } : null, scavengeTimer: Math.ceil(s.scavengeTimeRemaining/60), missionTimer: Math.ceil(mR) }));
        for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.02; if (p.life <= 0) s.particles.splice(i, 1); }
      }
      ctx.save(); if (s.shake > 0) ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);
      ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      s.stars.forEach(st => { ctx.fillStyle = st.color; ctx.fillRect(st.x, st.y, st.s, st.s); });
      s.fireflies.forEach(f => { ctx.save(); ctx.globalAlpha = (s.energy < maxEnergy * 0.5) ? 0.95 : 0.08; ctx.shadowBlur = (s.energy < maxEnergy * 0.5) ? 20 : 5; ctx.shadowColor = f.color; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.size/2, 0, Math.PI*2); ctx.fill(); ctx.restore(); });
      s.spaceSystems.forEach(sys => { ctx.save(); const glow = ctx.createRadialGradient(sys.x, sys.y, 0, sys.x, sys.y, sys.sunSize * 5); glow.addColorStop(0, sys.sunColor + '66'); glow.addColorStop(1, 'transparent'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sys.x, sys.y, sys.sunSize*5, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = sys.sunColor; ctx.beginPath(); ctx.arc(sys.x, sys.y, sys.sunSize, 0, Math.PI*2); ctx.fill(); sys.comets.forEach(c => { const dx = c.x - sys.x, dy = c.y - sys.y, angle = Math.atan2(dy, dx), tail = ctx.createLinearGradient(0, 0, Math.cos(angle)*c.tailLength, Math.sin(angle)*c.tailLength); ctx.save(); ctx.translate(c.x, c.y); tail.addColorStop(0, '#fff'); tail.addColorStop(0.5, '#38bdf844'); tail.addColorStop(1, 'transparent'); ctx.strokeStyle = tail; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(angle)*c.tailLength, Math.sin(angle)*c.tailLength); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill(); ctx.restore(); }); sys.planets.forEach(p => { const px = sys.x + Math.cos(p.angle)*p.distance, py = sys.y + Math.sin(p.angle)*p.distance, cs = 4 + (p.baseSize - 4) * sys.viewProgress; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px, py, cs, 0, Math.PI*2); ctx.fill(); if (p.isSelected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.arc(px, py, cs + 5, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); } if (p.moon) { const mx = px + Math.cos(p.moon.angle)*p.moon.distance, my = py + Math.sin(p.moon.angle)*p.moon.distance; ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.arc(mx, my, p.moon.size, 0, Math.PI*2); ctx.fill(); } }); ctx.restore(); });
      s.asteroids.forEach(a => { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rotation); a.faces.forEach(f => { ctx.fillStyle = a.color; ctx.beginPath(); ctx.moveTo(f.vertices[0].x, f.vertices[0].y); f.vertices.forEach(v => ctx.lineTo(v.x, v.y)); ctx.closePath(); ctx.fill(); ctx.fillStyle = `rgba(0,0,0, ${1.0-f.shade})`; ctx.fill(); }); ctx.restore(); });
      s.energyBolts.forEach(eb => { ctx.save(); ctx.translate(eb.x, eb.y); const bg = ctx.createRadialGradient(0,0,0,0,0,30); bg.addColorStop(0,'#fff'); bg.addColorStop(0.2,'#00f2ff'); bg.addColorStop(1,'transparent'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill(); ctx.restore(); });
      s.enemies.forEach(en => { drawShip(ctx, en, en.x, en.y, 0.5, 0, false, Math.PI); if (en.sh > 0) { ctx.strokeStyle = en.type === 'boss' ? '#a855f7' : '#c084fc'; ctx.lineWidth = 3; ctx.setLineDash([8,8]); ctx.beginPath(); ctx.arc(en.x, en.y, en.type === 'boss' ? 120 : 75, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); } });
      for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; ctx.globalAlpha = p.life; ctx.fillStyle = p.color; if (p.type === 'smoke') { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.001, p.size * (1.5 - p.life)), 0, Math.PI*2); ctx.fill(); } else if (p.type === 'debris') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(s.frame * 0.1); ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); ctx.restore(); } else { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.001, p.size), 0, Math.PI*2); ctx.fill(); } ctx.globalAlpha = 1; }
      
      // CUSTOM EXOTIC WEAPON RENDERING
      s.bullets.forEach(b => { 
          if (b.visualType) {
              const sz = b.size || 3;
              const clr = b.beamColor || '#fff';
              ctx.save();
              ctx.shadowBlur = 10;
              ctx.shadowColor = clr;
              
              if (b.visualType === 'ring') {
                  ctx.strokeStyle = clr;
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.arc(b.x, b.y, sz + 2, 0, Math.PI * 2);
                  ctx.stroke();
                  ctx.fillStyle = clr + '44'; // Semi-transparent center
                  ctx.fill();
              }
              else if (b.visualType === 'thunder') {
                  ctx.strokeStyle = clr;
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(b.x, b.y);
                  let currY = b.y;
                  let currX = b.x;
                  for(let k=0; k<4; k++) {
                      currY -= 12; // Length ~48
                      currX += (Math.random() - 0.5) * 8;
                      ctx.lineTo(currX, currY);
                  }
                  ctx.stroke();
              }
              else if (b.visualType === 'spindle') {
                  const len = 35;
                  ctx.fillStyle = clr;
                  ctx.beginPath();
                  ctx.moveTo(b.x, b.y - len); // Tip
                  ctx.quadraticCurveTo(b.x + sz, b.y - len/2, b.x, b.y); // Bottom
                  ctx.quadraticCurveTo(b.x - sz, b.y - len/2, b.x, b.y - len); // Back to top
                  ctx.fill();
              }
              else if (b.visualType === 'comet') {
                  const tailLen = 30;
                  // Tail
                  const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y - tailLen);
                  grad.addColorStop(0, clr);
                  grad.addColorStop(1, 'transparent');
                  ctx.fillStyle = grad;
                  ctx.beginPath();
                  ctx.moveTo(b.x, b.y);
                  ctx.lineTo(b.x + sz/2, b.y - tailLen);
                  ctx.lineTo(b.x - sz/2, b.y - tailLen);
                  ctx.fill();
                  // Head
                  ctx.fillStyle = '#fff';
                  ctx.beginPath();
                  ctx.arc(b.x, b.y, sz, 0, Math.PI * 2);
                  ctx.fill();
              }
              else {
                  // Solid Glow fallback
                  ctx.fillStyle = clr;
                  ctx.beginPath();
                  ctx.arc(b.x, b.y, sz, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.fillStyle = '#fff';
                  ctx.beginPath();
                  ctx.arc(b.x, b.y, sz/2, 0, Math.PI * 2);
                  ctx.fill();
              }
              ctx.restore();
          } else {
              // Standard rendering for normal guns
              if (b.type === 'exotic_arc_hit' && b.target) { ctx.strokeStyle = b.beamColor; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s.px, s.py - 35); ctx.lineTo(b.target.x, b.target.y); ctx.stroke(); } 
              else if (b.isBubble) { ctx.strokeStyle = b.beamColor; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI*2); ctx.stroke(); ctx.fillStyle = b.beamColor + '33'; ctx.fill(); } 
              else if (b.type === 'exotic_plasma_ball') { ctx.fillStyle = b.beamColor; ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 20; ctx.shadowColor = b.beamColor; ctx.fill(); ctx.shadowBlur = 0; } 
              else if (!b.isInvisible) { ctx.fillStyle = b.beamColor || '#fbbf24'; ctx.fillRect(b.x - b.size/2, b.y - b.size * 2, b.size, b.size * 4); } 
          }
      });

      s.enemyBullets.forEach(eb => { 
          if (eb.isArc) {
              ctx.strokeStyle = eb.bColor || '#a855f7'; ctx.lineWidth = 5;
              ctx.beginPath(); ctx.moveTo(eb.x, eb.y); ctx.lineTo(s.px, s.py); ctx.stroke();
          } else if (eb.isBubble) {
              ctx.strokeStyle = eb.bColor || '#a855f7'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(eb.x, eb.y, 10, 0, Math.PI*2); ctx.stroke();
          } else {
              ctx.fillStyle = eb.bColor || (eb.isExotic ? '#a855f7' : '#f87171'); ctx.fillRect(eb.x-2, eb.y, 4, 18); 
          }
      });
      s.missiles.forEach(m => { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI/2); ctx.beginPath(); ctx.roundRect(-4, -12, 8, 24, 4); ctx.fillStyle = m.isEmp ? '#00f2ff' : (m.isHeavy ? '#f97316' : '#ef4444'); ctx.fill(); ctx.restore(); });
      s.mines.forEach(m => { ctx.save(); ctx.translate(m.x, m.y); ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fillStyle = m.isMagnetic ? '#fbbf24' : '#00f2ff'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.stroke(); ctx.restore(); });
      s.gifts.forEach(g => { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(s.frame*0.08); const boxSize = 18; ctx.fillStyle = g.type === 'weapon' ? '#a855f7' : (g.type === 'energy' ? '#00f2ff' : (g.type === 'gold' ? '#fbbf24' : (g.type === 'platinum' ? '#e2e8f0' : (g.type === 'lithium' ? '#c084fc' : (g.type === 'repair' ? '#10b981' : (g.type === 'shield' ? '#f472b6' : '#60a5fa')))))); ctx.fillRect(-boxSize/2, -boxSize/2, boxSize, boxSize); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(-boxSize/2, -boxSize/2, boxSize, boxSize); ctx.fillStyle = '#000'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let l = ''; if (g.type === 'gold') l = 'G'; else if (g.type === 'platinum') l = 'P'; else if (g.type === 'lithium') l = 'L'; else if (g.type === 'missile') l = 'S'; else if (g.type === 'mine') l = 'M'; else if (g.type === 'fuel') l = 'F'; else if (g.type === 'energy') l = 'E'; else if (g.type === 'weapon') l = 'W'; else if (g.type === 'repair') l = 'H'; else if (g.type === 'shield') l = 'S'; ctx.fillText(l, 0, 0); ctx.restore(); });
      if (activeShip && !s.playerExploded) { let cT = 0.5, bK = false; if (s.keys.has('KeyW') || s.keys.has('ArrowUp')) cT = 1.3; else if (s.keys.has('KeyS') || s.keys.has('ArrowDown')) { cT = 0; bK = true; } let side = 0; if (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) side = -1; else if (s.keys.has('KeyD') || s.keys.has('ArrowRight')) side = 1; drawShip(ctx, activeShip, s.px, s.py, cT, side, bK, 0, s.playerDead); }
      const rS = (shV: number, shD: Shield, rad: number) => { if (shV <= 0 || s.playerDead || s.playerExploded) return; ctx.save(); ctx.strokeStyle = shD.color; ctx.lineWidth = 5.0; ctx.beginPath(); ctx.arc(s.px, s.py, rad, Math.PI*1.1, Math.PI*1.9); ctx.stroke(); ctx.restore(); };
      if (shield) rS(s.sh1, shield, 85); if (secondShield) rS(s.sh2, secondShield, 105);
      if (s.isPaused) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = '#fff'; ctx.font = '30px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('SYSTEM PAUSED', canvas.width/2, canvas.height/2); }
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
        <div className={`retro-font text-[24px] ${stats.missionTimer < 20 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{Math.floor(stats.missionTimer / 60)}:{(stats.missionTimer % 60).toString().padStart(2, '0')}</div>
      </div>
      {stateRef.current.gamePhase === 'observation' && (<div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-none bg-blue-950/20 px-8 py-3 rounded-xl border border-blue-500/30 backdrop-blur-sm"><div className="retro-font text-[10px] text-blue-400 uppercase tracking-widest animate-pulse tracking-[0.4em]">PLANETARY ARRIVAL</div></div>)}
      {stateRef.current.scavengeMode && (<div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-none bg-emerald-950/20 px-8 py-3 rounded-xl border border-emerald-500/30 backdrop-blur-sm"><div className="retro-font text-[10px] text-emerald-400 uppercase tracking-widest animate-pulse">SCAVENGE PHASE ACTIVE</div><div className="retro-font text-[18px] text-white">EXTRACTION IN: {stats.scavengeTimer}s</div></div>)}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-end gap-2.5 z-50 pointer-events-none opacity-95 scale-90">
        <div className="flex flex-col items-center gap-1.5"><div className={`retro-font text-[5px] uppercase font-black ${(stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>FUE</div><div className="flex flex-col-reverse gap-0.5 p-1 bg-zinc-950/70 border border-zinc-800/40 rounded">{Array.from({ length: nl }).map((_, i) => (<div key={i} className={`w-3.5 h-1 rounded-xs transition-colors duration-300 ${i < afl ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: i < afl ? ((stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? '#ff004c' : '#00b7ff') : '#18181b', color: (stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? '#ff004c' : '#00b7ff' }} />))}</div><div className={`retro-font text-[6px] font-black ${(stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? 'text-red-500' : 'text-blue-500'}`}>{stats.fuel.toFixed(1)}U</div></div>
        <div className="flex flex-col items-center gap-1.5"><div className={`retro-font text-[5px] uppercase font-black ${ep<50 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>PWR</div><div className="flex flex-col-reverse gap-0.5 p-1 bg-zinc-950/70 border border-zinc-800/40 rounded">{Array.from({ length: nl }).map((_, i) => { const r = i/nl, c = ep<50 ? (ep<25 ? '#ff0000' : '#fbbf24') : (r<0.3 ? '#ff3300' : (r<0.6 ? '#ffff00' : '#00ffd0')); return (<div key={i} className={`w-3.5 h-1 rounded-xs transition-colors duration-300 ${i < ael ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: i < ael ? c : '#18181b', color: c }} />); })}</div><div className={`retro-font text-[6px] font-black ${ep<50 ? 'text-red-500' : 'text-cyan-500'}`}>{Math.floor(ep)}%</div></div>
      </div>
      {stats.boss && (<div className="absolute top-20 left-1/2 -translate-x-1/2 w-[350px] flex flex-col items-center gap-1 z-50 pointer-events-none bg-black/40 p-3 rounded-lg border border-white/5 opacity-95"><div className="retro-font text-[6px] text-purple-400 uppercase tracking-[0.4em] font-black drop-shadow-[0_0_80px_#a855f7]">XENOS PRIMARY</div><div className="w-full flex flex-col gap-1 mt-1.5">{stats.boss.sh > 0 && (<div className="w-full h-1.5 bg-zinc-900/40 border border-purple-900/30 rounded-full overflow-hidden"><div className="h-full bg-purple-500 shadow-[0_0_12px_#a855f7]" style={{ width: `${(stats.boss.sh/stats.boss.maxSh)*100}%` }} /></div>)}<div className="w-full h-2 bg-zinc-900/40 border border-red-900/30 rounded-full overflow-hidden"><div className="h-full bg-red-600 shadow-[0_0_12px_#dc2626]" style={{ width: `${(stats.boss.hp/stats.boss.maxHp)*100}%` }} /></div></div></div>)}
      <div className="absolute top-3 left-5 flex flex-col gap-2.5 pointer-events-none z-50 opacity-100 scale-90 origin-top-left"><div className="flex items-center gap-2.5"><div className={`retro-font text-[6px] uppercase w-8 font-black ${stateRef.current.isMeltdown ? 'text-red-500 animate-pulse drop-shadow-[0_0_5px_#ef4444]' : 'text-lime-400 drop-shadow-[0_0_5px_#a3e635]'}`}>HULL</div><div className="w-40 h-1.5 bg-zinc-950/50 border border-zinc-800/40 rounded-full overflow-hidden"><div className={`h-full ${stateRef.current.isMeltdown ? 'bg-red-500' : 'bg-lime-500'}`} style={{ width: `${stats.hp}%` }} /></div></div>{shield && <div className="flex items-center gap-2.5"><div className="retro-font text-[6px] uppercase w-8 font-black" style={{ color: shield.color }}>SHLD</div><div className="w-40 h-1.5 bg-zinc-950/50 border border-zinc-800/40 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${(stats.sh1/shield.capacity)*100}%`, backgroundColor: shield.color }} /></div></div>}</div>
      <div className="absolute top-3 right-5 text-right flex flex-col gap-1 z-50 scale-90 origin-top-right"><div className="flex flex-col gap-1 opacity-90"><div className="retro-font text-[20px] text-white tabular-nums">{stats.score.toLocaleString()}</div><div className="retro-font text-[6px] text-zinc-300 uppercase tracking-widest font-black">UNITS</div></div></div>
      <div className="absolute bottom-3 left-5 flex flex-col gap-3 pointer-events-none p-3 bg-zinc-950/30 border border-white/5 rounded-lg min-w-[180px] opacity-95 scale-85 origin-bottom-left"><div className="flex flex-col gap-1.5"><span className="retro-font text-[6px] text-red-400 uppercase tracking-widest font-black">MISSIL</span><div className="grid grid-cols-10 gap-1.5 w-fit">{Array.from({ length: stats.missiles }).map((_, i) => (<div key={i} className="w-1.5 h-1.5 rounded-xs bg-red-500 shadow-[0_0_8px_#ef4444]" />))}</div></div><div className="flex flex-col gap-1.5"><span className="retro-font text-[6px] text-lime-400 uppercase tracking-widest font-black">MINES</span><div className="grid grid-cols-10 gap-1.5 w-fit">{Array.from({ length: stats.mines }).map((_, i) => (<div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#00ffa2]" />))}</div></div><div className="flex flex-col gap-1.5 mt-1 border-t border-white/5 pt-2"><span className="retro-font text-[6px] text-amber-400 uppercase tracking-widest font-black">STORAGE</span><div className="flex gap-1.5 w-fit">{Array.from({ length: stats.hullPacks }).map((_, i) => (<div key={i} className="w-2.5 h-2.5 bg-amber-500 border border-amber-300 shadow-[0_0_5px_#f59e0b] flex items-center justify-center text-[5px] text-black font-black">H</div>))}</div></div></div>
      <div className="absolute bottom-5 right-5 flex items-center gap-3 pointer-events-auto z-[100] origin-bottom-right scale-90 md:scale-100">
        <div className={`flex items-center justify-center px-4 h-[52px] min-w-[200px] bg-black/60 border-2 rounded-xl retro-font text-[8px] uppercase backdrop-blur-md shadow-lg transition-colors ${stats.alert ? 'animate-pulse' : ''} ${stateRef.current.isMeltdown || stats.hp < 15 ? 'text-red-500 border-red-500' : 'text-emerald-400 border-emerald-500/40'}`}>{stats.alert || "STATUS: NOMINAL"}</div>
        <button onClick={togglePause} className="h-[52px] px-6 bg-zinc-900/40 border-2 border-zinc-700/60 rounded-xl text-zinc-400 retro-font text-[10px] uppercase hover:bg-zinc-800 hover:text-white transition-all shadow-lg backdrop-blur-md">{stats.isPaused ? 'RESUME' : 'PAUSE'}</button>
        <button onClick={(e) => { const s = stateRef.current, fHP = s.isMeltdown ? 25 : Math.max(0, s.integrity); onGameOverRef.current(false, s.score, true, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: fHP, hullPacks: s.hullPacks, cargo: s.missionCargo }); e.currentTarget.blur(); }} className="h-[52px] px-6 bg-red-600/20 border-2 border-red-500/40 rounded-xl text-red-500 retro-font text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all shadow-lg backdrop-blur-md">ABORT MISSION</button>
      </div>
    </div>
  );
};
export default GameEngine;
