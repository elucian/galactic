// CHECKPOINT: Defender V85.10
// VERSION: V85.10 - STRAIGHT FIRE & INDEPENDENT RATES
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
  burnLevel: number = 0; 
  burnTimer: number = 0;
  
  constructor(x: number, y: number, type: 'scout' | 'fighter' | 'heavy' | 'boss', config: ExtendedShipConfig, difficulty: number) {
    this.difficulty = difficulty;
    const shotCounts = [3, 5, 8, 13, 21, 34, 55, 89, 144, 233]; 
    const diffIdx = Math.max(0, Math.min(9, Math.floor(difficulty - 1)));
    const baseHp = (shotCounts[diffIdx] / 3) * 100;
    const hpMap = { scout: baseHp * 0.8, fighter: baseHp, heavy: baseHp * 2.5, boss: 3000 * difficulty };
    const shMap = { scout: 0, fighter: 0, heavy: 0, boss: 800 * difficulty };
    this.x = x; this.y = y; this.hp = hpMap[type]; this.maxHp = hpMap[type];
    if (type === 'boss') { this.sh = shMap[type]; this.maxSh = shMap[type]; }
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
    if (this.burnLevel === 2) this.hp -= 0.15;
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
    keys: new Set<string>(), lastFire: 0, lastSpawn: 0, lastAsteroidSpawn: 0, lastBoltSpawn: 0, sunSpawned: false, gameActive: true, frame: 0, missileStock: activeShip?.fitting?.rocketCount || 0, mineStock: activeShip?.fitting?.mineCount || 0, equippedWeapons: [...(activeShip?.fitting?.weapons || [])], bossSpawned: false, bossDead: false, lootPending: false, shake: 0, playerDead: false, playerExploded: false, deathSequenceTimer: 300, scavengeMode: false, scavengeTimeRemaining: 0, starDirection: { vx: 0, vy: 1 }, isMeltdown: false, meltdownTimer: 600,
    missionCargo: [...(activeShip?.fitting?.cargo || [])] as CargoItem[], reloading: { missiles: false, mines: false, fuel: false, repair: false, fuelFilling: false, fuelTarget: 0 }, isPaused: false, pauseStartTime: 0, gamePhase: 'travel' as 'travel' | 'observation' | 'boss_intro' | 'boss_fight', observationTimer: 0, isInitialized: false,
    charging: { active: false, startTime: 0, level: 0, discharged: false },
    weaponCooldowns: {} as Record<string, number>
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
      en.burnLevel = 1; 
      if (en.hp < en.maxHp * 0.6) en.burnLevel = 2; 
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
    const chargeLevel = stateRef.current.charging.level;
    if (chargeLevel > 0) {
        ctx.shadowBlur = 15 + (chargeLevel * 40) + (Math.sin(stateRef.current.frame * 0.8) * 15);
        ctx.shadowColor = `rgba(255, 255, 255, ${0.5 + chargeLevel * 0.5})`;
        if (chargeLevel > 0.8) {
            ctx.fillStyle = `rgba(255,255,255,${(chargeLevel-0.8)*2})`;
            ctx.beginPath(); ctx.arc(50, 50, 70, 0, Math.PI * 2); ctx.fill();
        }
    }
    const drawEngine = (ex: number, ey: number) => {
      ctx.fillStyle = sInst.engineColor || '#334155'; ctx.beginPath(); ctx.roundRect(ex - 12, ey - 10, 24, 25, 4); ctx.fill();
      ctx.fillStyle = sInst.nozzleColor || '#171717'; ctx.beginPath(); ctx.moveTo(ex-10, ey+8); ctx.lineTo(ex-12, ey+22); ctx.quadraticCurveTo(ex, ey+28, ex+12, ey+22); ctx.lineTo(ex+10, ey+8); ctx.fill();
      if (thrust > 0) { ctx.fillStyle = sInst.type === 'boss' ? '#a855f7' : '#f97316'; ctx.globalAlpha = 0.4 + Math.random() * 0.4; ctx.beginPath(); ctx.moveTo(ex-8, ey+15); ctx.lineTo(ex+8, ey+15); ctx.lineTo(ex, ey+15+(50 * thrust)+Math.random()*15); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    };
    if (engineCount === 1) drawEngine(50, 82); else { [25,75].forEach(ex => drawEngine(ex, 75)); }
    ctx.fillStyle = sInst.wingColor || '#64748b'; ctx.beginPath(); if (wingStyle === 'delta') { ctx.moveTo(35, 40); ctx.lineTo(4, 88); ctx.lineTo(50, 78); ctx.moveTo(65, 40); ctx.lineTo(96, 88); ctx.lineTo(50, 78); } else { ctx.ellipse(50, 60, 48, 18, 0, 0, Math.PI * 2); } ctx.fill();
    if (isBreaking) { ctx.fillStyle = '#f87171'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(30, 20); ctx.lineTo(30, -10); ctx.lineTo(35, 20); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(70, 20); ctx.lineTo(70, -10); ctx.lineTo(65, 20); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    if (side !== 0) { ctx.fillStyle = '#38bdf8'; ctx.globalAlpha = 0.9; const wx = side < 0 ? 85 : 15, sDir = side < 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(wx, 55); ctx.lineTo(wx + (sDir * 35), 55); ctx.lineTo(wx, 60); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = chargeLevel > 0.5 ? '#fff' : (sInst.color || '#94a3b8'); 
    ctx.beginPath(); if (hullShapeType === 'triangle') { ctx.moveTo(50, 10); ctx.lineTo(80, 85); ctx.lineTo(20, 85); } else { ctx.roundRect(30, 15, 40, 75, 12); } ctx.fill();
    const renderGun = (gx: number, gy: number, sc: number) => { 
        ctx.save(); ctx.translate(gx, gy); ctx.scale(sc, sc); 
        ctx.fillStyle = chargeLevel > 0 ? '#fff' : (sInst.gunColor || '#60a5fa'); 
        ctx.fillRect(-1, -18, 2, 42); 
        ctx.fillStyle = chargeLevel > 0 ? `rgba(255,255,255,${0.5 + chargeLevel * 0.5})` : (sInst.gunBodyColor || '#1c1917'); 
        ctx.fillRect(-7, -5, 14, 22); ctx.restore(); 
    };
    if (sInst.config.defaultGuns === 1) renderGun(50, 15, 0.35); else { renderGun(25, 45, 0.55); renderGun(75, 45, 0.55); }
    ctx.fillStyle = sInst.cockpitColor || '#38bdf8'; ctx.beginPath(); ctx.ellipse(50, (hullShapeType === 'triangle' ? 58 : 38), 9, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };

  const fireWeapons = (multiplier: number = 1.0, isRapidFire: boolean = false) => {
    const s = stateRef.current;
    if (s.energy <= 5 || s.equippedWeapons.length === 0 || s.isMeltdown || s.playerDead) return;
    const now = Date.now();
    let fired = false;
    const numGuns = activeShip.config.defaultGuns;

    // Independent per-slot fire cycle
    for (let i = 0; i < numGuns; i++) {
        const w = s.equippedWeapons[i];
        if (!w) continue;

        const weaponDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(wd => wd.id === w.id);
        if (!weaponDef) continue;

        // Individual cooldown key per visual port
        const cooldown = 1000 / (weaponDef.fireRate * (isRapidFire ? 1.0 : 1.0));
        const cooldownKey = `slot_${i}`;
        const lastFireAtSlot = s.weaponCooldowns[cooldownKey] || 0;
        
        if (now - lastFireAtSlot < cooldown) continue;
        s.weaponCooldowns[cooldownKey] = now;

        // Visual port mapping: -12.5px and +12.5px from logical center (scale 0.5)
        const xOff = numGuns === 1 ? 0 : (i === 0 ? -12.5 : 12.5);
        
        const sizeMult = 1 + (multiplier - 1) * 0.5; 
        const speedMult = 1 + (multiplier - 1) * 0.3;
        
        const baseB: any = { 
            x: s.px + xOff, 
            y: s.py - 35, 
            vx: 0, // FIXED: SHOOT STRAIGHT
            vy: -24 * speedMult, 
            damage: weaponDef.damage * multiplier * (1 + (difficulty*0.18)), 
            type: weaponDef.id, 
            beamColor: weaponDef.beamColor || '#fff', 
            timer: 0, 
            target: null, 
            size: 3.5 * sizeMult, 
            isBeam: false, 
            xOffset: xOff, 
            wType: weaponDef.type, 
            chargeLevel: multiplier 
        };

        // Exotic Visual Style Mapping
        if (weaponDef.id === 'exotic_wave') baseB.visualType = 'ring';
        else if (weaponDef.id === 'exotic_bolt' || weaponDef.id === 'exotic_mining_laser') baseB.visualType = 'thunder';
        else if (weaponDef.id === 'exotic_bubbles' || weaponDef.id === 'exotic_nova' || weaponDef.id === 'exotic_gravity') baseB.visualType = 'solid_glow';
        else if (weaponDef.id === 'exotic_fan' || weaponDef.id === 'exotic_arc' || weaponDef.id === 'exotic_venom') baseB.visualType = 'spindle';
        else if (weaponDef.id === 'exotic_seeker' || weaponDef.id === 'exotic_plasma_ball' || weaponDef.id === 'exotic_flame') baseB.visualType = 'comet';

        // Keep Fan spread as it is a specific weapon mechanic, not a gun logic error
        if (weaponDef.id === 'exotic_fan') {
            const spreadAngle = i === 0 ? -0.15 : 0.15;
            baseB.vx = -baseB.vy * Math.tan(spreadAngle);
        }

        if (weaponDef.id === 'exotic_flame') {
            baseB.life = 25 * (1 + multiplier * 0.2); baseB.vy = -18 * speedMult;
            for(let f=0; f<(2 * multiplier); f++) s.particles.push({ x: s.px + xOff, y: s.py - 40, vx: (Math.random()-0.5)*3, vy: -5 - Math.random()*5, life: 0.5, color: '#f97316', size: (4 + Math.random()*6) * sizeMult, type: 'fire' });
        }

        s.bullets.push(baseB);
        const pan = xOff < 0 ? -0.4 : 0.4;
        audioService.playWeaponFire(weaponDef.type === WeaponType.LASER ? 'laser' : 'cannon', pan);
        s.energy -= (weaponDef.energyCost / 20);
        fired = true;
    }
    if (fired) s.lastFire = now;
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    if (stateRef.current.px === 0) { stateRef.current.px = window.innerWidth / 2; stateRef.current.py = window.innerHeight * 0.85; }
    const starColors = ['#ffffff', '#fbbf24', '#f87171', '#38bdf8', '#4ade80', '#a855f7', '#f472b6'];
    const generateStars = (w: number, h: number) => { stateRef.current.stars = Array.from({ length: 300 }).map(() => ({ x: Math.random() * w, y: Math.random() * h, s: Math.random() * 2.8, v: 0.15 + Math.random() * 0.6, color: starColors[Math.floor(Math.random() * starColors.length)] })); };
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; generateStars(canvas.width, canvas.height); const s = stateRef.current; s.px = Math.max(35, Math.min(canvas.width - 35, s.px)); s.py = Math.max(35, Math.min(canvas.height - 110, s.py)); s.bullets = []; s.enemyBullets = []; };
    const handleBlur = () => { const s = stateRef.current; if (s.gameActive && !s.playerDead && !s.isPaused) { s.isPaused = true; s.pauseStartTime = Date.now(); s.keys.clear(); setStats(p => ({ ...p, isPaused: true })); } };
    resize(); window.addEventListener('resize', resize); window.addEventListener('blur', handleBlur); stateRef.current.isInitialized = true;
    const handleKey = (e: KeyboardEvent, isDown: boolean) => { 
        const s = stateRef.current; 
        if (['Tab', 'CapsLock', 'ShiftLeft', 'Space'].includes(e.code)) e.preventDefault();
        if (e.code === 'Space') {
            if (isDown && !s.keys.has('Space')) {
                fireWeapons(1.0, false);
                s.charging.active = true; s.charging.startTime = Date.now(); s.charging.level = 0; s.charging.discharged = false;
                s.keys.add(e.code);
            } else if (!isDown) {
                if (s.charging.active && !s.charging.discharged) {
                    const duration = Date.now() - s.charging.startTime;
                    if (duration > 250) {
                        const ratio = Math.min(1, (duration - 250) / 1750);
                        fireWeapons(1 + (ratio * 9), false);
                    }
                }
                s.charging.active = false; s.keys.delete(e.code);
            }
            return;
        }
        if (isDown) s.keys.add(e.code); else s.keys.delete(e.code);
        if (isDown && e.code === 'KeyP') { s.isPaused = !s.isPaused; setStats(p => ({ ...p, isPaused: s.isPaused })); }
        if (isDown && e.code === 'Escape') { s.gameActive = false; onGameOverRef.current(false, s.score, true); } 
        if (isDown && (e.code === 'Backslash' || e.code === 'Tab') && !s.playerDead && !s.isPaused) { if (s.missileStock > 0) { s.missileStock--; s.missiles.push(new Missile(s.px, s.py - 40, (Math.random() - 0.5) * 4, -7.0)); audioService.playWeaponFire('missile'); } } 
        if (isDown && (e.code === 'Enter' || e.code === 'CapsLock') && !s.playerDead && !s.isPaused) { if (s.mineStock > 0) { s.mineStock--; s.mines.push(new Mine(s.px, s.py)); audioService.playWeaponFire('mine'); } } 
    };
    window.addEventListener('keydown', (e) => handleKey(e, true)); window.addEventListener('keyup', (e) => handleKey(e, false));
    let anim: number;
    const loop = () => {
      const s = stateRef.current; if (!s.gameActive) return; s.frame++; const pSpeed = 10.5, now = Date.now();
      if (!s.isPaused) {
        const missionElapsed = (now - s.missionStartTime) / 1000, missionRemaining = Math.max(0, MISSION_DURATION - missionElapsed), canSpawn = missionElapsed > 5; 
        if (s.gamePhase === 'travel') { if (missionRemaining <= 0) { s.gamePhase = 'observation'; s.observationTimer = 0; if (!s.sunSpawned) { s.spaceSystems.push(new SpaceSystem(canvas.width, canvas.height, quadrant, currentPlanet.id)); s.sunSpawned = true; } } } 
        else if (s.gamePhase === 'observation') { s.observationTimer++; if (s.observationTimer > 360) { s.gamePhase = 'boss_fight'; s.bossSpawned = true; s.enemies.push(new Enemy(canvas.width/2, -450, 'boss', BOSS_SHIPS[Math.floor(Math.random() * BOSS_SHIPS.length)], difficulty)); } }
        if (s.charging.active && !s.charging.discharged) {
            const ratio = Math.min(1, Math.max(0, (now - s.charging.startTime - 250) / 1750));
            s.charging.level = ratio; s.shake = Math.max(s.shake, s.charging.level * 5);
            if (ratio >= 1.0) { fireWeapons(10.0, false); s.charging.active = false; s.charging.level = 0; s.charging.discharged = true; s.shake = 20; }
        } else s.charging.level = 0;
        if (!s.playerDead && !s.playerExploded) {
            const isVertical = (s.keys.has('KeyW') || s.keys.has('ArrowUp') || s.keys.has('KeyS') || s.keys.has('ArrowDown'));
            if (isVertical && s.fuel > 0) { if (s.keys.has('KeyW') || s.keys.has('ArrowUp')) s.py -= pSpeed; if (s.keys.has('KeyS') || s.keys.has('ArrowDown')) s.py += pSpeed; s.fuel = Math.max(0, s.fuel - 0.0009); }
            if (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) { s.px -= pSpeed; s.starDirection.vx = 2.4; } else if (s.keys.has('KeyD') || s.keys.has('ArrowRight')) { s.px += pSpeed; s.starDirection.vx = -2.4; } else s.starDirection.vx *= 0.93;
            s.px = Math.max(35, Math.min(canvas.width - 35, s.px)); s.py = Math.max(35, Math.min(canvas.height - 110, s.py)); s.energy = Math.min(maxEnergy, s.energy + 4.0); 
            if (s.fuel < 0.05 && !s.reloading.fuel && !s.isMeltdown) {
                const cargoIdx = s.missionCargo.findIndex(i => i.type === 'fuel');
                if (cargoIdx !== -1) { s.reloading.fuel = true; setTimeout(() => { const idx = s.missionCargo.findIndex(i => i.type === 'fuel'); if (idx !== -1) { s.reloading.fuelFilling = true; s.reloading.fuelTarget = Math.min(maxFuelCapacity, s.fuel + 1.0); if (s.missionCargo[idx].quantity > 1) s.missionCargo[idx].quantity--; else s.missionCargo.splice(idx, 1); } else s.reloading.fuel = false; }, 5000); }
            }
            if (s.reloading.fuelFilling) { s.fuel += (1.0 / (20 * 60)); if (s.fuel >= s.reloading.fuelTarget) { s.fuel = s.reloading.fuelTarget; s.reloading.fuelFilling = false; s.reloading.fuel = false; } }
            // Centralized rapid fire check
            if ((s.keys.has('ShiftLeft') || s.keys.has('ShiftRight')) && !s.isMeltdown) fireWeapons(1.0, true);
        }
        s.fireflies.forEach(f => { f.x += f.vx; f.y += f.vy + s.starDirection.vy*0.3; if (f.y > canvas.height) f.y = -10; if (f.x < 0) f.x = canvas.width; if (f.x > canvas.width) f.x = 0; });
        if (canSpawn && s.asteroids.length < (s.scavengeMode ? 12 : 5) && now - s.lastAsteroidSpawn > (s.scavengeMode ? 800 : 3500)) { s.asteroids.push(new Asteroid(Math.random() * canvas.width, -180, difficulty, s.scavengeMode)); s.lastAsteroidSpawn = now; }
        if (canSpawn && s.gamePhase === 'travel' && now - s.lastSpawn > (1800 / Math.sqrt(Math.max(1, difficulty)))) { s.enemies.push(new Enemy(Math.random() * (canvas.width - 120) + 60, -150, 'fighter', SHIPS[Math.floor(Math.random() * (difficulty + 1))], difficulty)); s.lastSpawn = now; }
        for (let i = s.bullets.length - 1; i >= 0; i--) { 
            const b = s.bullets[i]; b.y += b.vy; b.x += b.vx; 
            let hitB = false; 
            for (let j = s.enemies.length - 1; j >= 0; j--) { 
                const en = s.enemies[j], distSq = (b.x-en.x)**2 + (b.y-en.y)**2, hitRadius = en.type === 'boss' ? 70 : 28;
                if (distSq < hitRadius*hitRadius) { createImpactEffect(b.x, b.y, en.sh > 0 ? 'shield' : 'vessel', en.sh > 0 ? (en.type === 'boss' ? '#a855f7' : '#38bdf8') : undefined); applyDamageToEnemy(en, b.damage, b.wType); hitB = true; break; } 
            } 
            if (hitB || b.y < -250 || b.y > canvas.height + 250) s.bullets.splice(i, 1); 
        }
        s.stars.forEach(st => { st.y += st.v; st.x += s.starDirection.vx * st.v; if (st.y > canvas.height) { st.y = -10; st.x = Math.random() * canvas.width; } if (st.x < 0) st.x = canvas.width; if (st.x > canvas.width) st.x = 0; });
        if (s.sunSpawned) { const sys = s.spaceSystems[0]; sys.viewProgress = Math.min(1, sys.viewProgress + 0.003); sys.planets.forEach(p => { p.angle += p.speed; }); }
        const bI = s.enemies.find(e => e.type === 'boss'), mR = Math.max(0, MISSION_DURATION - ((now - s.missionStartTime) / 1000));
        setStats(p => ({ ...p, hp: Math.max(0, s.integrity), sh1: Math.max(0, s.sh1), sh2: Math.max(0, s.sh2), energy: s.energy, score: s.score, missiles: s.missileStock, mines: s.mineStock, fuel: s.fuel, boss: bI ? { hp: bI.hp, maxHp: bI.maxHp, sh: bI.sh, maxSh: bI.maxSh } : null, missionTimer: Math.ceil(mR) }));
        for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.02; if (p.life <= 0) s.particles.splice(i, 1); }
      }
      ctx.save(); if (s.shake > 0) ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);
      ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      s.stars.forEach(st => { ctx.fillStyle = st.color; ctx.fillRect(st.x, st.y, st.s, st.s); });
      s.spaceSystems.forEach(sys => { ctx.save(); const glow = ctx.createRadialGradient(sys.x, sys.y, 0, sys.x, sys.y, sys.sunSize * 5); glow.addColorStop(0, sys.sunColor + '66'); glow.addColorStop(1, 'transparent'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sys.x, sys.y, sys.sunSize*5, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = sys.sunColor; ctx.beginPath(); ctx.arc(sys.x, sys.y, sys.sunSize, 0, Math.PI*2); ctx.fill(); ctx.restore(); });
      s.enemies.forEach(en => { drawShip(ctx, en, en.x, en.y, 0.5, 0, false, Math.PI); });
      s.bullets.forEach(b => { 
          const chargeScale = b.chargeLevel || 1.0;
          if (b.visualType) {
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
      if (activeShip && !s.playerExploded) drawShip(ctx, activeShip, s.px, s.py, 0.5, 0, false, 0, s.playerDead); 
      if (s.isPaused) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = '#fff'; ctx.font = '30px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('SYSTEM PAUSED', canvas.width/2, canvas.height/2); }
      ctx.restore(); anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); window.removeEventListener('blur', handleBlur); window.removeEventListener('keydown', handleKey as any); window.removeEventListener('keyup', handleKey as any); };
  }, [difficulty, activeShip, shield, secondShield, maxEnergy, initialFuel, maxFuelCapacity, initialIntegrity, currentPlanet, quadrant, ships, MISSION_DURATION]);

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50">
        <div className={`retro-font text-[24px] ${stats.missionTimer < 20 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{Math.floor(stats.missionTimer / 60)}:{(stats.missionTimer % 60).toString().padStart(2, '0')}</div>
      </div>
      <div className="absolute bottom-5 right-5 flex items-center gap-3 z-[100]">
        <button onClick={() => { stateRef.current.isPaused = !stateRef.current.isPaused; setStats(p => ({ ...p, isPaused: stateRef.current.isPaused })); }} className="h-[52px] px-6 bg-zinc-900/40 border-2 border-zinc-700/60 rounded-xl text-zinc-400 retro-font text-[10px] uppercase">{stats.isPaused ? 'RESUME' : 'PAUSE'}</button>
      </div>
    </div>
  );
};
export default GameEngine;