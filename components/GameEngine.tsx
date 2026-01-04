
// CHECKPOINT: Defender V84.50
// VERSION: V84.91 - COLLISION & BOUNDARY REFINEMENT
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, Weapon, EquippedWeapon, Planet, QuadrantType, WeaponType, CargoItem } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, PLANETS, BOSS_SHIPS, SHIELDS } from '../constants.ts';

const MISSION_DURATION_SECONDS = 300; 

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
  constructor(x: number, y: number, type: 'scout' | 'fighter' | 'heavy' | 'boss', config: ExtendedShipConfig, difficulty: number) {
    const hpMap = { scout: 80, fighter: 200, heavy: 600, boss: 5000 * difficulty };
    const shMap = { scout: 0, fighter: 50, heavy: 200, boss: Math.max(1500, 3000 * (difficulty/2)) };
    this.x = x; this.y = y; this.hp = hpMap[type]; this.maxHp = hpMap[type];
    if (type === 'boss' || (difficulty >= 4 && shMap[type] > 0)) {
      this.sh = shMap[type]; this.maxSh = shMap[type];
    }
    this.type = type; this.config = config;
    this.color = type === 'boss' ? '#a855f7' : (type === 'heavy' ? '#ef4444' : (type === 'fighter' ? '#f97316' : '#60a5fa'));
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
  life: number = 800; damage: number = 200; isHeavy: boolean = false; isEmp: boolean = false;
  constructor(x: number, y: number, vx: number, vy: number, isHeavy: boolean = false, isEmp: boolean = false) { 
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; 
    this.isHeavy = isHeavy; this.isEmp = isEmp;
    if (isHeavy) { this.damage = 650; this.life = 1200; }
    if (isEmp) { this.damage = 1000; this.life = 1000; }
  }
}

class Mine {
  x: number; y: number; vx: number; vy: number; damage: number = 3500;
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

type GiftType = 'missile' | 'mine' | 'energy' | 'fuel' | 'weapon' | 'gold' | 'platinum' | 'lithium' | 'repair';

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
        // Post-Boss Loot
        if (rand < 0.4) { this.variant = 'gold'; this.size = 20; this.color = '#fbbf24'; this.hp = 1000; }
        else if (rand < 0.7) { this.variant = 'platinum'; this.size = 20; this.color = '#e2e8f0'; this.hp = 1500; }
        else { this.variant = 'lithium'; this.size = 20; this.color = '#c084fc'; this.hp = 800; }
    } else {
        // Pre-Boss Survival
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
    sunSize: number = 320; sunColor: string; isBlackHole: boolean; planetViewProgress: number = 0; 
    planets: any[];
    constructor(w: number, h: number, quadrant: QuadrantType, selectedPlanet: Planet) {
        this.x = Math.random() * w; this.y = -800; this.isBlackHole = quadrant === QuadrantType.DELTA;
        const colors = { [QuadrantType.ALFA]: '#facc15', [QuadrantType.BETA]: '#f97316', [QuadrantType.GAMA]: '#60a5fa', [QuadrantType.DELTA]: '#000000' };
        this.sunColor = colors[quadrant];
        const sectorPlanets = PLANETS.filter(p => p.quadrant === quadrant);
        this.planets = sectorPlanets.map((p, i) => ({ name: p.name, distance: (this.sunSize * 3.5) + (i * 250), size: p.size * 12, color: p.color, angle: Math.random() * Math.PI * 2, speed: 0.0004 + Math.random() * 0.0008, isSelected: p.id === selectedPlanet.id }));
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

  const [stats, setStats] = useState({ 
    hp: initialIntegrity, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, energy: maxEnergy,
    score: 0, missiles: activeShip?.fitting?.rocketCount || 0, mines: activeShip?.fitting?.mineCount || 0,
    fuel: initialFuel, hullPacks: initialHullPacks, boss: null as any, alert: "", scavengeTimer: 0,
    missionTimer: MISSION_DURATION_SECONDS, isPaused: false
  });

  const onGameOverRef = useRef(onGameOver);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  const stateRef = useRef({
    px: 0, py: 0, integrity: initialIntegrity, fuel: initialFuel, energy: maxEnergy, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, score: 0,
    hullPacks: initialHullPacks,
    sh1ShatterTime: 0, sh2ShatterTime: 0,
    missionStartTime: Date.now(),
    autoRepair: { active: false, timer: 0, lastTick: 0 },
    bullets: [] as any[], enemyBullets: [] as any[], missiles: [] as Missile[], mines: [] as Mine[], 
    enemies: [] as Enemy[], particles: [] as Particle[], stars: [] as any[], gifts: [] as Gift[],
    asteroids: [] as Asteroid[], spaceSystems: [] as SpaceSystem[], energyBolts: [] as EnergyBolt[],
    fireflies: Array.from({length: 12}).map(() => ({x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5, size: 2.5 + Math.random()*2.5, color: '#00f2ff'})),
    keys: new Set<string>(), lastFire: 0, lastSpawn: 0, lastAsteroidSpawn: 0, lastBoltSpawn: 0,
    sunSpawned: false, gameActive: true, frame: 0, missileStock: activeShip?.fitting?.rocketCount || 0, mineStock: activeShip?.fitting?.mineCount || 0,
    equippedWeapons: [...(activeShip?.fitting?.weapons || [])], bossSpawned: false, bossDead: false, lootPending: false, shake: 0, playerDead: false,
    scavengeMode: false, scavengeTimeRemaining: 0, starDirection: { vx: 0, vy: 1 },
    isMeltdown: false,
    missionCargo: [...(activeShip?.fitting?.cargo || [])] as CargoItem[],
    reloading: { missiles: false, mines: false, fuel: false, repair: false },
    isPaused: false,
    pauseStartTime: 0
  });

  const createImpactEffect = (x: number, y: number, type: 'asteroid' | 'vessel' | 'shield', color?: string) => {
    const s = stateRef.current;
    if (type === 'asteroid') {
        s.particles.push({ x, y, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, life: 0.6, color: 'rgba(200,200,200,0.45)', size: 4 + Math.random()*10, type: 'smoke' });
        for(let i=0; i<4; i++) {
            s.particles.push({ x, y, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6, life: 0.4 + Math.random()*0.3, color: '#4b5563', size: 1.5 + Math.random()*2, type: 'debris' });
        }
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
    if (variant === 'blue_fuel') type = 'fuel';
    else if (variant === 'gray_mine') type = 'mine';
    else if (variant === 'brown_missile') type = 'missile';
    else if (variant === 'gold') type = 'gold';
    else if (variant === 'platinum') type = 'platinum';
    else if (variant === 'lithium') type = 'lithium';
    s.gifts.push(new Gift(x, y, type));
  };

  const triggerChainReaction = (x: number, y: number, sourceId: any) => {
    const s = stateRef.current;
    const radius = 180;
    const chainDmg = 150 * (1 + (difficulty * 0.25)); 
    s.enemies.forEach(en => {
        if (en === sourceId) return;
        const dx = en.x - x, dy = en.y - y;
        if (Math.sqrt(dx*dx + dy*dy) < radius) {
            applyDamageToEnemy(en, chainDmg, WeaponType.PROJECTILE, true);
        }
    });
  };

  const createExplosion = (x: number, y: number, isBoss: boolean = false, isMine: boolean = false, isShieldOverload: boolean = false) => {
    const s = stateRef.current;
    const count = isBoss ? 350 : (isMine ? 150 : (isShieldOverload ? 100 : 50));
    const now = Date.now();
    
    if (!s.playerDead) {
        const dx = x - s.px, dy = y - s.py;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 220) {
            let dmg = (isBoss ? 80 : (isMine ? 50 : 25)) * (1 - (d/280));
            dmg *= 0.6; 
            const activeRed = (shield?.id === 'sh_beta' && s.sh1 > 0) || (secondShield?.id === 'sh_beta' && s.sh2 > 0);
            if (activeRed) dmg *= 0.05; 
            
            if (s.sh2 > 0) { 
                s.sh2 -= dmg * 3; 
                if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; } 
            } else if (s.sh1 > 0) { 
                s.sh1 -= dmg * 3; 
                if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; }
            } else s.integrity -= dmg;

            if (dmg > 2) { s.shake = 30; audioService.playShieldHit(); }
        }
    }

    const vividColors = ['#ff0000', '#00ff00', '#3b82f6', '#facc15', '#f472b6', '#ffffff', '#00f2ff', '#a855f7'];
    const smokeCount = isMine ? 40 : 20;
    for (let i = 0; i < smokeCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (isMine ? 5 : 3);
        s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.2 + Math.random(), size: 8 + Math.random() * 18, color: 'rgba(80,80,80,0.35)', type: 'smoke' });
    }
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isBoss ? 24 : (isMine ? 18 : 12));
      const type = Math.random() > 0.85 ? 'debris' : (Math.random() > 0.5 ? 'spark' : 'fire');
      const pColor = vividColors[Math.floor(Math.random() * vividColors.length)];
      s.particles.push({ 
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, 
        life: 0.6 + Math.random() * 1.0, 
        size: Math.random() * (isBoss ? 4 : 2) + 1, 
        color: pColor, 
        type 
      });
    }
  };

  const applyDamageToEnemy = (en: Enemy, dmg: number, wType?: WeaponType, fromChain: boolean = false) => {
    const s = stateRef.current;
    let finalDmg = dmg;
    if (wType === WeaponType.LASER && en.sh <= 0) { finalDmg *= 3.0; }

    if (en.sh > 0) { const leftover = Math.max(0, finalDmg - en.sh); en.sh = Math.max(0, en.sh - finalDmg); if (leftover > 0) en.hp -= leftover; }
    else { 
      en.hp -= finalDmg; 
      if (en.hp <= 0) {
        if (!fromChain) triggerChainReaction(en.x, en.y, en);
        if (en.type === 'boss' && !s.bossDead) { 
          en.rewardThresholds.forEach((t, i) => { 
            if (en.hp / en.maxHp < t) { 
              const randomEx = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)]; 
              s.gifts.push(new Gift(en.x + (Math.random()-0.5)*120, en.y + (Math.random()-0.5)*120, 'weapon', randomEx.id, randomEx.name)); 
              en.rewardThresholds.splice(i, 1); 
            } 
          }); 
        } 
      }
    }
  };

  const spawnBossExplosions = (bx: number, by: number) => {
    const s = stateRef.current; s.shake = 100; s.lootPending = true; s.scavengeMode = true; s.scavengeTimeRemaining = 4500;
    for (let i = 0; i < 90; i++) { 
        setTimeout(() => { 
            const ex = bx + (Math.random() - 0.5) * 700; 
            const ey = by + (Math.random() - 0.5) * 700; 
            createExplosion(ex, ey, true); 
            audioService.playExplosion(0, 2.5); 
            s.shake = 65; 
        }, i * 40); 
    }
    setTimeout(() => { 
        const randomEx1 = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)]; 
        const randomEx2 = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)]; 
        s.gifts.push(new Gift(bx - 60, by, 'weapon', randomEx1.id, randomEx1.name)); 
        s.gifts.push(new Gift(bx + 60, by, 'weapon', randomEx2.id, randomEx2.name)); 
        s.lootPending = false; 
    }, 4500);
  };

  const drawShip = (ctx: CanvasRenderingContext2D, sInst: any, x: number, y: number, isThrusting: boolean, rotation: number = 0, isGhost: boolean = false) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(0.5, 0.5); ctx.translate(-50, -50); if (isGhost) ctx.globalAlpha = 0.3;
    const { engines: engineCount, hullShapeType, wingStyle } = sInst.config;
    const drawEngine = (ex: number, ey: number) => {
      ctx.fillStyle = sInst.engineColor || '#334155'; ctx.beginPath(); ctx.roundRect(ex - 12, ey - 10, 24, 25, 4); ctx.fill();
      ctx.fillStyle = sInst.nozzleColor || '#171717'; ctx.beginPath(); ctx.moveTo(ex-10, ey+8); ctx.lineTo(ex-12, ey+22); ctx.quadraticCurveTo(ex, ey+28, ex+12, ey+22); ctx.lineTo(ex+10, ey+8); ctx.fill();
      if (isThrusting) { ctx.fillStyle = sInst.type === 'boss' ? '#a855f7' : '#f97316'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(ex-8, ey+15); ctx.lineTo(ex+8, ey+15); ctx.lineTo(ex, ey+50+Math.random()*25); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    };
    if (engineCount === 1) drawEngine(50, 82); else if (engineCount >= 4) { [10,35,65,90].forEach(ex => drawEngine(ex, 75)); } else { [25,75].forEach(ex => drawEngine(ex, 75)); }
    ctx.fillStyle = sInst.wingColor || '#64748b'; ctx.beginPath(); if (wingStyle === 'delta') { ctx.moveTo(35, 40); ctx.lineTo(4, 88); ctx.lineTo(50, 78); ctx.moveTo(65, 40); ctx.lineTo(96, 88); ctx.lineTo(50, 78); } else { ctx.ellipse(50, 60, 48, 18, 0, 0, Math.PI * 2); } ctx.fill();
    ctx.fillStyle = sInst.color || '#94a3b8'; ctx.beginPath(); if (hullShapeType === 'triangle') { ctx.moveTo(50, 10); ctx.lineTo(80, 85); ctx.lineTo(20, 85); } else { ctx.roundRect(30, 15, 40, 75, 12); } ctx.fill();
    const renderGun = (gx: number, gy: number, sc: number) => { ctx.save(); ctx.translate(gx, gy); ctx.scale(sc, sc); ctx.fillStyle = sInst.gunColor || '#60a5fa'; ctx.fillRect(-1, -18, 2, 42); ctx.fillStyle = sInst.gunBodyColor || '#1c1917'; ctx.fillRect(-7, -5, 14, 22); ctx.restore(); };
    if (sInst.config.defaultGuns === 1) renderGun(50, 15, 0.35); else { renderGun(25, 45, 0.55); renderGun(75, 45, 0.55); }
    ctx.fillStyle = sInst.cockpitColor || '#38bdf8'; ctx.beginPath(); ctx.ellipse(50, (hullShapeType === 'triangle' ? 58 : 38), 9, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };

  const togglePause = () => {
    const s = stateRef.current;
    s.isPaused = !s.isPaused;
    if (s.isPaused) s.pauseStartTime = Date.now();
    else s.missionStartTime += (Date.now() - s.pauseStartTime);
    setStats(p => ({ ...p, isPaused: s.isPaused }));
    // Prevent button focus staying active
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    if (stateRef.current.px === 0) { stateRef.current.px = window.innerWidth / 2; stateRef.current.py = window.innerHeight * 0.85; }
    
    const starColors = ['#ffffff', '#fbbf24', '#f87171', '#38bdf8', '#4ade80', '#a855f7', '#f472b6'];
    const generateStars = (w: number, h: number) => {
        stateRef.current.stars = Array.from({ length: 300 }).map(() => ({ 
            x: Math.random() * w, 
            y: Math.random() * h, 
            s: Math.random() * 2.8, 
            v: 0.15 + Math.random() * 0.6, 
            color: starColors[Math.floor(Math.random() * starColors.length)] 
        }));
    };

    const resize = () => { 
        canvas.width = window.innerWidth; 
        canvas.height = window.innerHeight; 
        generateStars(canvas.width, canvas.height);
        const s = stateRef.current;
        s.px = Math.max(35, Math.min(canvas.width - 35, s.px));
        s.py = Math.max(35, Math.min(canvas.height - 110, s.py));
        s.bullets = []; s.enemyBullets = [];
    }; resize();
    window.addEventListener('resize', resize);
    
    const handleKey = (e: KeyboardEvent, isDown: boolean) => { 
        const s = stateRef.current;
        if (isDown) s.keys.add(e.code); else s.keys.delete(e.code); 
        
        // Handle Space to Resume when paused
        if (isDown && s.isPaused && (e.code === 'Space' || e.code === 'KeyP')) {
           togglePause();
           return;
        }

        if (isDown && e.code === 'KeyP') { togglePause(); return; }
        if (isDown && e.code === 'Escape') { 
            s.gameActive = false; 
            const finalHP = s.isMeltdown ? 25 : Math.max(0, s.integrity);
            onGameOverRef.current(false, s.score, true, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: finalHP, hullPacks: s.hullPacks, cargo: s.missionCargo }); 
        } 
        if (isDown && e.code === 'Tab' && !s.playerDead && !s.isPaused) { 
            e.preventDefault(); 
            if (s.missileStock > 0) { 
                s.missileStock--; 
                const isEmp = ships[0].fitting.weapons.some(w => w.id === 'ord_missile_emp');
                s.missiles.push(new Missile(s.px, s.py - 40, (Math.random() - 0.5) * 6, -10, false, isEmp)); 
                audioService.playWeaponFire('missile'); 
            }
        } 
        if (isDown && e.code === 'CapsLock' && !s.playerDead && !s.isPaused) { 
            e.preventDefault(); 
            if (s.mineStock > 0) { s.mineStock--; s.mines.push(new Mine(s.px, s.py)); audioService.playWeaponFire('mine'); } 
        } 
    };
    
    window.addEventListener('keydown', (e) => handleKey(e, true)); window.addEventListener('keyup', (e) => handleKey(e, false));
    generateStars(window.innerWidth, window.innerHeight);

    let anim: number;
    const loop = () => {
      const s = stateRef.current; if (!s.gameActive) return; s.frame++; const pSpeed = 10.5; const now = Date.now();
      const isVertical = !s.playerDead && (s.keys.has('KeyW') || s.keys.has('ArrowUp') || s.keys.has('KeyS') || s.keys.has('ArrowDown'));

      if (!s.isPaused) {
        const missionElapsed = (now - s.missionStartTime) / 1000;
        const missionRemaining = Math.max(0, MISSION_DURATION_SECONDS - missionElapsed);
        if (missionRemaining <= 0) {
            s.gameActive = false;
            onGameOverRef.current(true, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: s.integrity, hullPacks: s.hullPacks, cargo: s.missionCargo });
            return;
        }

        if (!s.playerDead) {
            if (isVertical && s.fuel > 0) { if (s.keys.has('KeyW') || s.keys.has('ArrowUp')) s.py -= pSpeed; if (s.keys.has('KeyS') || s.keys.has('ArrowDown')) s.py += pSpeed; s.fuel = Math.max(0, s.fuel - 0.0009); }
            if (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) { s.px -= pSpeed; s.starDirection.vx = 2.4; } else if (s.keys.has('KeyD') || s.keys.has('ArrowRight')) { s.px += pSpeed; s.starDirection.vx = -2.4; } else s.starDirection.vx *= 0.93;
            s.px = Math.max(35, Math.min(canvas.width - 35, s.px)); s.py = Math.max(35, Math.min(canvas.height - 110, s.py));
            s.energy = Math.min(maxEnergy, s.energy + 4.0); 

            // JIT AUTOMATIC REFUEL
            if (s.fuel < 0.05 && !s.reloading.fuel && !s.isMeltdown) {
            const cargoIdx = s.missionCargo.findIndex(i => i.type === 'fuel');
            if (cargoIdx !== -1) {
                s.reloading.fuel = true;
                setStats(p => ({ ...p, alert: "REFUELING..." }));
                setTimeout(() => {
                    const idx = s.missionCargo.findIndex(i => i.type === 'fuel');
                    if (idx !== -1) {
                        s.fuel = Math.min(maxFuelCapacity, s.fuel + 1.5);
                        if (s.missionCargo[idx].quantity > 1) s.missionCargo[idx].quantity--;
                        else s.missionCargo.splice(idx, 1);
                        setStats(p => ({ ...p, alert: "FUEL RESTORED" }));
                        setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500);
                    }
                    s.reloading.fuel = false;
                }, 3000);
            }
            }

            // JIT AUTOMATIC REPAIR
            if (s.integrity < 20 && !s.reloading.repair && !s.autoRepair.active && !s.isMeltdown) {
                const cargoIdx = s.missionCargo.findIndex(i => i.type === 'repair');
                if (cargoIdx !== -1) {
                    s.reloading.repair = true;
                    setStats(p => ({ ...p, alert: "REPAIRING..." }));
                    setTimeout(() => {
                        const idx = s.missionCargo.findIndex(i => i.type === 'repair');
                        if (idx !== -1) {
                            s.integrity = Math.min(100, s.integrity + 20);
                            if (s.missionCargo[idx].quantity > 1) s.missionCargo[idx].quantity--;
                            else s.missionCargo.splice(idx, 1);
                            setStats(p => ({ ...p, alert: "RESTORED" }));
                            setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500);
                        }
                        s.reloading.repair = false;
                    }, 3000);
                }
            }

            // JIT AUTOMATIC MISSILE RELOAD
            if (s.missileStock <= 0 && !s.reloading.missiles) {
                const cargoIdx = s.missionCargo.findIndex(i => i.type === 'missile');
                if (cargoIdx !== -1) {
                    s.reloading.missiles = true;
                    setStats(p => ({ ...p, alert: "RELOADING..." }));
                    setTimeout(() => {
                        const idx = s.missionCargo.findIndex(i => i.type === 'missile');
                        if (idx !== -1) {
                            s.missileStock += 10;
                            if (s.missionCargo[idx].quantity > 1) s.missionCargo[idx].quantity--;
                            else s.missionCargo.splice(idx, 1);
                            setStats(p => ({ ...p, alert: "RESTORED" }));
                            setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500);
                        }
                        s.reloading.missiles = false;
                    }, 3000);
                }
            }

            // JIT AUTOMATIC MINE RELOAD
            if (s.mineStock <= 0 && !s.reloading.mines) {
                const cargoIdx = s.missionCargo.findIndex(i => i.type === 'mine');
                if (cargoIdx !== -1) {
                    s.reloading.mines = true;
                    setStats(p => ({ ...p, alert: "RELOADING..." }));
                    setTimeout(() => {
                        const idx = s.missionCargo.findIndex(i => i.type === 'mine');
                        if (idx !== -1) {
                            s.mineStock += 10;
                            if (s.missionCargo[idx].quantity > 1) s.missionCargo[idx].quantity--;
                            else s.missionCargo.splice(idx, 1);
                            setStats(p => ({ ...p, alert: "RESTORED" }));
                            setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500);
                        }
                        s.reloading.mines = false;
                    }, 3000);
                }
            }

            // Shield Regeneration Logic
            if (shield && s.sh1 < shield.capacity) {
                const isBroken = s.sh1 <= 0;
                const timeSinceShatter = now - s.sh1ShatterTime;
                if (!isBroken || timeSinceShatter > 10000) {
                    const regenVal = shield.regenRate * 0.016 * 10;
                    const regenCost = shield.energyCost * 0.016 * 2;
                    if (s.energy >= regenCost) {
                        s.sh1 = Math.min(shield.capacity, s.sh1 + regenVal);
                        s.energy -= regenCost;
                        if (isBroken && s.sh1 > 0) setStats(p => ({ ...p, alert: "PRIMARY SHIELD REBOOTED" }));
                    }
                }
            }
            if (secondShield && s.sh2 < secondShield.capacity) {
                const isBroken = s.sh2 <= 0;
                const timeSinceShatter = now - s.sh2ShatterTime;
                if (!isBroken || timeSinceShatter > 10000) {
                    const regenVal = secondShield.regenRate * 0.016 * 10;
                    const regenCost = secondShield.energyCost * 0.016 * 2;
                    if (s.energy >= regenCost) {
                        s.sh2 = Math.min(secondShield.capacity, s.sh2 + regenVal);
                        s.energy -= regenCost;
                        if (isBroken && s.sh2 > 0) setStats(p => ({ ...p, alert: "SECONDARY SHIELD REBOOTED" }));
                    }
                }
            }

            if (s.integrity < 10 && s.hullPacks > 0 && !s.autoRepair.active && !s.isMeltdown) {
                s.autoRepair.active = true; s.autoRepair.timer = 10; s.autoRepair.lastTick = now; s.hullPacks--;
                setStats(p => ({ ...p, alert: `CRITICAL HULL - AUTO-REPAIR IN: 10s` }));
            }

            if (s.autoRepair.active) {
                if (now - s.autoRepair.lastTick > 1000) {
                    s.autoRepair.timer--; s.autoRepair.lastTick = now;
                    if (s.autoRepair.timer > 0) setStats(p => ({ ...p, alert: `CRITICAL HULL - AUTO-REPAIR IN: ${s.autoRepair.timer}s` }));
                    else { s.integrity = Math.min(100, s.integrity + 20); s.autoRepair.active = false; setStats(p => ({ ...p, alert: "RESTORED" })); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500); }
                }
            }

            if (s.integrity <= 0 && !s.isMeltdown) { s.isMeltdown = true; setStats(p => ({ ...p, alert: "REACTOR MELTDOWN - ABORT NOW" })); }
            if (s.isMeltdown) {
                s.fuel -= 0.005;
                if (s.frame % 2 === 0) s.particles.push({ x: s.px + (Math.random()-0.5)*30, y: s.py + (Math.random()-0.5)*30, vx: (Math.random()-0.5)*4, vy: 2 + Math.random()*4, life: 1.0, color: '#f97316', size: 8 + Math.random()*12, type: 'fire' });
                if (s.fuel <= 0) { s.playerDead = true; createExplosion(s.px, s.py, true); audioService.playExplosion(0, 3.5); s.shake = 95; }
            }

            if ((s.keys.has('Space') || s.keys.has('KeyF')) && s.energy > 5 && s.equippedWeapons.length > 0) {
            s.equippedWeapons.forEach((w, idx) => {
                const weaponDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(wd => wd.id === w.id); if (!weaponDef) return;
                if (now - s.lastFire < (weaponDef.fireRate > 30 ? 0 : (1000 / weaponDef.fireRate))) return;
                const gunPositions = activeShip.config.defaultGuns === 1 ? [0] : [-18, 18];
                gunPositions.forEach(xOff => {
                    const baseB: any = { x: s.px + xOff, y: s.py - 35, vx: 0, vy: -24, damage: weaponDef.damage * (1 + (difficulty*0.18)), type: weaponDef.id, beamColor: weaponDef.beamColor || '#fff', timer: 0, target: null, size: 3.5, isBeam: false, xOffset: xOff, wType: weaponDef.type };
                    if (weaponDef.id === 'exotic_mining_laser') {
                        let bestAst = null, minDist = 1200;
                        s.asteroids.forEach(ast => {
                            if (ast.y > 0) {
                                const d = Math.sqrt((baseB.x-ast.x)**2 + (baseB.y-ast.y)**2);
                                if (d < minDist) { minDist = d; bestAst = ast; }
                            }
                        });
                        if (bestAst) {
                            const dx = bestAst.x - baseB.x, dy = bestAst.y - baseB.y, d = Math.sqrt(dx*dx+dy*dy);
                            baseB.vx = (dx/d) * 22; baseB.vy = (dy/d) * 22;
                        }
                        s.bullets.push(baseB);
                    }
                    else if (weaponDef.id === 'exotic_fan') { for(let a = -2; a <= 2; a++) s.bullets.push({ ...baseB, vx: a * 3.5, vy: -20, size: 2.5 }); } 
                    else if (weaponDef.id === 'exotic_bubbles') s.bullets.push({ ...baseB, vx: (Math.random()-0.5)*8, vy: -12, size: 6, isBubble: true });
                    else if (weaponDef.id === 'exotic_seeker') s.bullets.push({ ...baseB, isSeeker: true, size: 2.5 });
                    else if (weaponDef.id === 'exotic_flame') { for(let f=0; f<3; f++) s.particles.push({ x: s.px + xOff, y: s.py - 40, vx: (Math.random()-0.5)*5, vy: -8 - Math.random()*8, life: 0.6, color: '#f97316', size: 6 + Math.random()*12, type: 'fire' }); s.bullets.push({ ...baseB, vy: -15, life: 15, size: 20, isInvisible: true }); } 
                    else if (weaponDef.id === 'exotic_arc') { 
                    let target = null; let md = 750; s.enemies.forEach(en => { const d = Math.sqrt((baseB.x-en.x)**2+(baseB.y-en.y)**2); if(d<md){md=d; target=en;} }); 
                    if (target) { applyDamageToEnemy(target, baseB.damage, WeaponType.LASER); baseB.type = 'exotic_arc_hit'; baseB.target = target; s.bullets.push(baseB); } 
                    }
                    else if (weaponDef.id === 'exotic_plasma_ball') { baseB.vy = -8; baseB.size = 28; s.bullets.push(baseB); }
                    else s.bullets.push(baseB);
                });
                s.energy -= (weaponDef.energyCost / 20) * (activeShip.config.defaultGuns);
                audioService.playWeaponFire(weaponDef.type === WeaponType.LASER ? 'laser' : 'cannon'); s.lastFire = now;
            });
            }
        }

        const energyOnYellow = s.energy < maxEnergy * 0.5;
        s.fireflies.forEach(f => { 
            if (s.frame % 40 === 0) { f.vx += (Math.random()-0.5)*0.3; f.vy += (Math.random()-0.5)*0.3; }
            f.x += f.vx; f.y += f.vy + s.starDirection.vy*0.3; f.x += s.starDirection.vx*0.15; 
            if (f.y > canvas.height) f.y = -10; if (f.y < -100) f.y = canvas.height;
            if (f.x < 0) f.x = canvas.width; if (f.x > canvas.width) f.x = 0; 
            if (energyOnYellow && !s.playerDead) {
                const dx = f.x - s.px, dy = f.y - s.py;
                if (Math.sqrt(dx*dx + dy*dy) < 45) {
                    s.energy = maxEnergy * 0.8; f.y = -200; audioService.playSfx('buy');
                    setStats(p => ({ ...p, alert: "RESTORED" }));
                    setTimeout(() => setStats(p => ({ ...p, alert: "" })), 1500);
                }
            }
        });

        const maxAst = s.scavengeMode ? 12 : 5;
        const astInterval = s.scavengeMode ? 800 : 3500;
        if (s.asteroids.length < maxAst && now - s.lastAsteroidSpawn > astInterval) { s.asteroids.push(new Asteroid(Math.random() * canvas.width, -180, difficulty, s.scavengeMode)); s.lastAsteroidSpawn = now; }
        if (now - s.lastBoltSpawn > 6500) { s.energyBolts.push(new EnergyBolt(canvas.width, canvas.height)); s.lastBoltSpawn = now; }
        if (s.scavengeMode) { s.scavengeTimeRemaining--; if (s.scavengeTimeRemaining <= 0) { onGameOverRef.current(true, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: s.integrity, hullPacks: s.hullPacks, cargo: s.missionCargo }); return; } }
        
        const spawnTimer = 1400 / Math.sqrt(Math.max(1, difficulty));
        if (!s.bossSpawned && !s.scavengeMode && now - s.lastSpawn > spawnTimer) { s.enemies.push(new Enemy(Math.random() * (canvas.width - 120) + 60, -150, 'fighter', SHIPS[Math.floor(Math.random() * SHIPS.length)], difficulty)); s.lastSpawn = now; }
        if (s.score >= difficulty * 10000 && !s.bossSpawned) { s.bossSpawned = true; s.enemies.push(new Enemy(canvas.width/2, -450, 'boss', BOSS_SHIPS[Math.floor(Math.random() * BOSS_SHIPS.length)], difficulty)); if (!s.sunSpawned) { s.spaceSystems.push(new SpaceSystem(canvas.width, canvas.height, quadrant, currentPlanet)); s.sunSpawned = true; } }

        for (let i = s.mines.length - 1; i >= 0; i--) {
            const m = s.mines[i]; m.update(s.enemies);
            if (m.y < -200 || m.y > canvas.height + 200) s.mines.splice(i, 1);
            else {
                for (let j = s.enemies.length - 1; j >= 0; j--) {
                    const en = s.enemies[j];
                    if (Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 60) {
                        const finalDamage = en.sh > 0 ? 2000 : 90000000;
                        applyDamageToEnemy(en, finalDamage, WeaponType.MINE);
                        createExplosion(m.x, m.y, false, true); s.mines.splice(i, 1);
                        if (en.hp <= 0) { if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } s.enemies.splice(j, 1); s.score += 200; }
                        break;
                    }
                }
            }
        }

        for (let j = s.enemies.length - 1; j >= 0; j--) {
            const en = s.enemies[j];
            for (let k = s.asteroids.length - 1; k >= 0; k--) {
                const ast = s.asteroids[k];
                const dist = Math.sqrt((en.x - ast.x)**2 + (en.y - ast.y)**2);
                if (dist < ast.size + 45) {
                    if (ast.y > 0) {
                        // V84.91 FIX: Asteroids destroyed by contact with enemy ships no longer yield loot.
                        createExplosion(en.x, en.y); triggerChainReaction(en.x, en.y, en);
                        if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); }
                        s.enemies.splice(j, 1); s.asteroids.splice(k, 1); audioService.playExplosion(); break;
                    }
                }
            }
            if (s.enemies[j] && !s.playerDead) {
                const d = Math.sqrt((en.x - s.px)**2 + (en.y - s.py)**2);
                if (s.sh2 > 0 && d < 105) { 
                    createExplosion(en.x, en.y, false, false, true); s.enemies.splice(j, 1); s.sh2 -= 150; 
                    if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; }
                    s.score += 75; audioService.playShieldHit(); audioService.playExplosion(); continue; 
                } 
                else if (s.sh1 > 0 && d < 85) { 
                    createExplosion(en.x, en.y, false, false, true); s.enemies.splice(j, 1); s.sh1 -= 150; 
                    if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; }
                    s.score += 75; audioService.playShieldHit(); audioService.playExplosion(); continue; 
                } 
                else if (d < 65) { s.integrity -= 25; s.shake = 55; createExplosion(en.x, en.y); s.enemies.splice(j, 1); audioService.playExplosion(); continue; }
            }
        }

        for (let i = s.asteroids.length - 1; i >= 0; i--) { 
            const a = s.asteroids[i]; a.x += a.vx; a.y += a.vy; a.rotation += a.rotVel; 
            if (!s.playerDead) { 
                const dx = a.x - s.px, dy = a.y - s.py;
                const d = Math.sqrt(dx*dx + dy*dy); 
                if (d < a.size + 40) { 
                    if (a.y > 0) {
                        const activePurple = (shield?.id === 'sh_omega' && s.sh1 > 0) || (secondShield?.id === 'sh_omega' && s.sh2 > 0);
                        const activeRed = (shield?.id === 'sh_beta' && s.sh1 > 0) || (secondShield?.id === 'sh_beta' && s.sh2 > 0);
                        if (activePurple || activeRed) {
                            const bounceSpeed = activePurple ? 1.5 : 1.0;
                            a.vx = (dx/d) * bounceSpeed; a.vy = (dy/d) * bounceSpeed;
                            if (s.sh2 > 0) { s.sh2 -= activePurple ? 15 : 20; if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; } } 
                            else if (s.sh1 > 0) { s.sh1 -= activePurple ? 15 : 20; if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; } }
                            audioService.playShieldHit();
                        } else { 
                            if (s.sh2 > 0) { s.sh2 -= 60; if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; } a.vx = (dx/d)*0.5; a.vy = (dy/d)*0.5; }
                            else if (s.sh1 > 0) { s.sh1 -= 60; if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; } a.vx = (dx/d)*0.5; a.vy = (dy/d)*0.5; }
                            else {
                                s.integrity -= 20; s.shake = 40; 
                                spawnAsteroidLoot(a.x, a.y, a.variant);
                                s.asteroids.splice(i, 1); 
                                createExplosion(a.x, a.y); audioService.playExplosion(); continue; 
                            }
                        }
                    }
                } 
            } 
            if (a.y > canvas.height + 300) s.asteroids.splice(i, 1); 
        }

        for (let i = s.gifts.length - 1; i >= 0; i--) { 
            const g = s.gifts[i]; g.y += g.vy; 
            if (Math.abs(g.x-s.px) < 55 && Math.abs(g.y-s.py) < 55) { 
            s.gifts.splice(i, 1); 
            if (g.type === 'energy') { s.energy = maxEnergy * 0.8; setStats(p => ({ ...p, alert: "RESTORED" })); audioService.playSfx('buy'); }
            else {
                const cType: CargoItem['type'] = g.type;
                const existing = s.missionCargo.find(item => item.type === cType && item.id === g.id);
                if (existing) {
                    existing.quantity++;
                } else {
                    s.missionCargo.push({ 
                        instanceId: Math.random().toString(36).substr(2, 9), 
                        type: cType, 
                        id: g.id, 
                        name: g.name || g.type.replace('_', ' ').toUpperCase(), 
                        weight: 5,
                        quantity: 1
                    });
                }
                setStats(p => ({ ...p, alert: `SECURED: ${g.type.toUpperCase()}` }));
                audioService.playSfx('click');
            }
            setTimeout(() => setStats(p => ({ ...p, alert: "" })), 2000); 
            } 
            if (g.y > canvas.height + 150) s.gifts.splice(i, 1); 
        }

        for (let i = s.missiles.length - 1; i >= 0; i--) { 
            const m = s.missiles[i]; 
            if (!m.target || m.target.hp <= 0) { 
                let target = null; let md = 25000;
                if (m.isEmp) {
                    s.enemies.forEach(en => {
                        if (en.sh > 0) {
                            const d = Math.sqrt((m.x-en.x)**2+(m.y-en.y)**2);
                            if (d < md && d < 1200) { md = d; target = en; }
                        }
                    });
                }
                if (!target) {
                    md = 25000;
                    s.enemies.forEach(en => { const d = Math.sqrt((m.x-en.x)**2+(m.y-en.y)**2); if(d<md){md=d; target=en;} }); 
                }
                m.target = target; 
            } 
            if (m.target) { const dx = m.target.x - m.x, dy = m.target.y - m.y, d = Math.sqrt(dx*dx+dy*dy); m.vx += (dx/d)*3.8; m.vy += (dy/d)*3.8; } else m.vy -= 1.0; 
            m.x += m.vx; m.y += m.vy; m.life--; 
            if (m.life <= 0 || m.y < -700) s.missiles.splice(i, 1); 
            else { 
                for (let j = s.enemies.length - 1; j >= 0; j--) { 
                    if (Math.sqrt((m.x-s.enemies[j].x)**2 + (m.y-s.enemies[j].y)**2) < 80) { 
                        const dmg = m.isEmp ? (s.enemies[j].sh > 0 ? 5000 : m.damage) : m.damage;
                        applyDamageToEnemy(s.enemies[j], dmg, m.isEmp ? WeaponType.EMP : WeaponType.MISSILE); 
                        createImpactEffect(m.x, m.y, s.enemies[j].sh > 0 ? 'shield' : 'vessel', s.enemies[j].sh > 0 ? (s.enemies[j].type === 'boss' ? '#a855f7' : '#38bdf8') : undefined);
                        createExplosion(m.x, m.y, false, true); s.missiles.splice(i, 1); 
                        if (s.enemies[j].hp <= 0) { if (s.enemies[j].type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(s.enemies[j].x, s.enemies[j].y); } s.enemies.splice(j, 1); s.score += 150; } break; 
                    } 
                } 
                if (s.missiles[i]) {
                    for (let k = s.asteroids.length - 1; k >= 0; k--) {
                    const ast = s.asteroids[k]; if (ast.y > 0 && Math.sqrt((m.x - ast.x)**2 + (m.y - ast.y)**2) < ast.size + 25) { 
                        createImpactEffect(m.x, m.y, 'asteroid');
                        spawnAsteroidLoot(ast.x, ast.y, ast.variant);
                        createExplosion(m.x, m.y); s.missiles.splice(i, 1); s.asteroids.splice(k, 1); break; 
                    }
                    }
                }
            } 
        }

        for (let j = s.enemies.length - 1; j >= 0; j--) { const en = s.enemies[j]; if (en.type === 'boss') { en.x = canvas.width/2 + Math.sin(s.frame * 0.02) * (canvas.width * 0.42); en.y = Math.min(en.y + 1.8, 220); } else { en.y += (4.2 + (difficulty * 0.55)) + en.vy; en.x += en.vx; en.vx *= 0.93; en.vy *= 0.93; } if (en.y > canvas.height + 300) { s.enemies.splice(j, 1); continue; } if (now - en.lastShot > 1550 / Math.sqrt(Math.max(1, difficulty)) && en.y > 0) { if (en.type === 'boss') { s.enemyBullets.push({ x: en.x - 60, y: en.y + 110, vy: 11 + difficulty, isExotic: true }); s.enemyBullets.push({ x: en.x + 60, y: en.y + 110, vy: 11 + difficulty, isExotic: true }); } else { s.enemyBullets.push({ x: en.x, y: en.y + 50, vy: 9.0 + difficulty }); } en.lastShot = now; } }
        
        for (let i = s.bullets.length - 1; i >= 0; i--) { 
            const b = s.bullets[i]; 
            if (b.type === 'exotic_arc_hit' && b.target) { b.x = b.target.x; b.y = b.target.y; } 
            else if (b.isSeeker) {
                let target = null; let md = 600; s.enemies.forEach(en => { const d = Math.sqrt((b.x-en.x)**2+(b.y-en.y)**2); if(d<md){md=d; target=en;} });
                if (target) { const dx = target.x - b.x, dy = target.y - b.y, d = Math.sqrt(dx*dx+dy*dy); b.vx += (dx/d)*2.5; b.vy += (dy/d)*2.5; }
                b.y += b.vy; b.x += b.vx;
            }
            else { b.y += b.vy; b.x += b.vx; } 
            if (b.life !== undefined) b.life--; let hit = false; 
            if (b.type === 'exotic_plasma_ball' && s.frame % 2 === 0) s.particles.push({ x: b.x, y: b.y, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6, life: 0.8, color: b.beamColor, size: 6, type: 'plasma' }); 
            else if (b.type === 'exotic_arc_hit') { b.timer++; if (b.timer > 16) { s.bullets.splice(i, 1); continue; } } 
            for (let j = s.enemies.length - 1; j >= 0; j--) { 
                if (Math.abs(b.x - s.enemies[j].x) < 70 && Math.abs(b.y - s.enemies[j].y) < 70) { 
                    createImpactEffect(b.x, b.y, s.enemies[j].sh > 0 ? 'shield' : 'vessel', s.enemies[j].sh > 0 ? (s.enemies[j].type === 'boss' ? '#a855f7' : '#38bdf8') : undefined);
                    applyDamageToEnemy(s.enemies[j], b.damage, b.wType); hit = true; break; 
                } 
            } 
            if (!hit) { 
                for (let j = s.asteroids.length - 1; j >= 0; j--) { 
                    const ast = s.asteroids[j]; 
                    if (ast.y > 0 && Math.abs(b.x - ast.x) < ast.size + 30 && Math.abs(b.y - ast.y) < ast.size + 30) { 
                        createImpactEffect(b.x, b.y, 'asteroid');
                        let aDmg = b.damage;
                        if (b.type === 'exotic_mining_laser') aDmg *= 5.0; 
                        ast.hp -= aDmg; 
                        if (ast.hp <= 0) { 
                            spawnAsteroidLoot(ast.x, ast.y, ast.variant);
                            s.asteroids.splice(j, 1); 
                        } 
                        hit = true; break; 
                    } 
                } 
            } 
            if (hit || b.y < -250 || b.y > canvas.height + 250 || (b.life !== undefined && b.life <= 0)) s.bullets.splice(i, 1); 
        }

        for (let i = s.enemyBullets.length - 1; i >= 0; i--) { 
            const eb = s.enemyBullets[i]; eb.y += eb.vy; 
            if (!s.playerDead && Math.abs(eb.x - s.px) < 60 && Math.abs(eb.y - s.py) < 60) { 
                s.enemyBullets.splice(i, 1); let dmg = eb.isExotic ? 20 : 10; 
                createImpactEffect(eb.x, eb.y, (s.sh1 > 0 || s.sh2 > 0) ? 'shield' : 'vessel', (s.sh2 > 0 ? secondShield?.color : (s.sh1 > 0 ? shield?.color : undefined)));
                if (s.sh2 > 0) { 
                    s.sh2 -= dmg * 1.5; 
                    if (s.sh2 <= 0) { s.sh2 = 0; s.sh2ShatterTime = now; }
                } else if (s.sh1 > 0) { 
                    s.sh1 -= dmg * 1.5; 
                    if (s.sh1 <= 0) { s.sh1 = 0; s.sh1ShatterTime = now; }
                } else s.integrity -= dmg;
                audioService.playShieldHit(); 
                continue;
            } 
            for (let j = s.asteroids.length - 1; j >= 0; j--) {
                const ast = s.asteroids[j];
                if (ast.y > 0 && Math.abs(eb.x - ast.x) < ast.size + 20 && Math.abs(eb.y - ast.y) < ast.size + 20) {
                    createImpactEffect(eb.x, eb.y, 'asteroid');
                    ast.hp -= 40; 
                    s.enemyBullets.splice(i, 1);
                    if (ast.hp <= 0) {
                        spawnAsteroidLoot(ast.x, ast.y, ast.variant);
                        s.asteroids.splice(j, 1);
                    }
                    break;
                }
            }
            if (eb.y > canvas.height + 250) s.enemyBullets.splice(i, 1); 
        }
        s.stars.forEach(st => { st.y += st.v; st.x += s.starDirection.vx * st.v; if (st.y > canvas.height) { st.y = -10; st.x = Math.random() * canvas.width; } if (st.x < 0) st.x = canvas.width; if (st.x > canvas.width) st.x = 0; });
        if (s.sunSpawned) s.spaceSystems[0].planetViewProgress = Math.min(1, s.spaceSystems[0].planetViewProgress + 0.002);
        if (s.shake > 0) s.shake *= 0.93;
        if (s.playerDead) { onGameOverRef.current(false, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: 0, bossDefeated: s.bossDead, health: 0, hullPacks: s.hullPacks, cargo: s.missionCargo }); return; }
        if (s.bossDead && !s.scavengeMode && s.enemies.length === 0 && s.gifts.length === 0 && !s.lootPending) { onGameOverRef.current(true, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: s.integrity, hullPacks: s.hullPacks, cargo: s.missionCargo }); return; }
        const bInst = s.enemies.find(e => e.type === 'boss');
        const mRemaining = Math.max(0, MISSION_DURATION_SECONDS - ((now - s.missionStartTime) / 1000));
        setStats(p => ({ ...p, hp: Math.max(0, s.integrity), sh1: Math.max(0, s.sh1), sh2: Math.max(0, s.sh2), energy: s.energy, score: s.score, missiles: s.missileStock, mines: s.mineStock, fuel: s.fuel, hullPacks: s.hullPacks, boss: bInst ? { hp: bInst.hp, maxHp: bInst.maxHp, sh: bInst.sh, maxSh: bInst.maxSh } : null, scavengeTimer: Math.ceil(s.scavengeTimeRemaining/60), missionTimer: Math.ceil(mRemaining) }));

        for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.02; if (p.life <= 0) { s.particles.splice(i, 1); continue; } }
      }

      ctx.save(); if (s.shake > 0) ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake);
      ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      s.stars.forEach(st => { ctx.fillStyle = st.color; ctx.fillRect(st.x, st.y, st.s, st.s); });
      s.fireflies.forEach(f => { ctx.save(); ctx.globalAlpha = (s.energy < maxEnergy * 0.5) ? 0.95 : 0.08; ctx.shadowBlur = (s.energy < maxEnergy * 0.5) ? 20 : 5; ctx.shadowColor = f.color; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.size/2, 0, Math.PI*2); ctx.fill(); ctx.restore(); });
      s.spaceSystems.forEach(sys => { ctx.save(); const glow = ctx.createRadialGradient(sys.x, sys.y, 0, sys.x, sys.y, sys.sunSize * 10); glow.addColorStop(0, sys.sunColor + '44'); glow.addColorStop(0.3, sys.sunColor + '11'); glow.addColorStop(1, 'transparent'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sys.x, sys.y, sys.sunSize*10, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = sys.sunColor; ctx.beginPath(); ctx.arc(sys.x, sys.y, sys.sunSize, 0, Math.PI*2); ctx.fill(); sys.planets.forEach(p => { const px = sys.x + Math.cos(p.angle)*p.distance; const py = sys.y + Math.sin(p.angle)*p.distance; const viewScale = p.isSelected ? (0.15 + sys.planetViewProgress*0.85) : 1.0; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px, py, Math.max(0.001, p.size*viewScale), 0, Math.PI*2); ctx.fill(); if (p.isSelected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.arc(px, py, Math.max(0.001, (p.size+10)*viewScale), 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); } }); ctx.restore(); });
      s.asteroids.forEach(a => { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rotation); a.faces.forEach(f => { ctx.fillStyle = a.color; ctx.beginPath(); ctx.moveTo(f.vertices[0].x, f.vertices[0].y); f.vertices.forEach(v => ctx.lineTo(v.x, v.y)); ctx.closePath(); ctx.fill(); ctx.fillStyle = `rgba(0,0,0, ${1.0-f.shade})`; ctx.fill(); }); ctx.restore(); });
      s.energyBolts.forEach(eb => { ctx.save(); ctx.translate(eb.x, eb.y); const bg = ctx.createRadialGradient(0,0,0,0,0,30); bg.addColorStop(0,'#fff'); bg.addColorStop(0.2,'#00f2ff'); bg.addColorStop(1,'transparent'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill(); ctx.restore(); });
      s.enemies.forEach(en => { drawShip(ctx, en, en.x, en.y, true, Math.PI); if (en.sh > 0) { ctx.strokeStyle = en.type === 'boss' ? '#a855f7' : '#c084fc'; ctx.lineWidth = 3; ctx.setLineDash([8,8]); ctx.beginPath(); ctx.arc(en.x, en.y, en.type === 'boss' ? 120 : 75, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); } });
      for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; ctx.globalAlpha = p.life; ctx.fillStyle = p.color; if (p.type === 'smoke') { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.001, p.size * (1.5 - p.life)), 0, Math.PI*2); ctx.fill(); } else if (p.type === 'debris') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(s.frame * 0.1); ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); ctx.restore(); } else { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.001, p.size), 0, Math.PI*2); ctx.fill(); } ctx.globalAlpha = 1; }
      
      s.bullets.forEach(b => { 
          if (b.type === 'exotic_arc_hit' && b.target) { ctx.strokeStyle = b.beamColor; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s.px, s.py - 35); ctx.lineTo(b.target.x, b.target.y); ctx.stroke(); } 
          else if (b.isBubble) { ctx.strokeStyle = b.beamColor; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI*2); ctx.stroke(); ctx.fillStyle = b.beamColor + '33'; ctx.fill(); }
          else if (b.type === 'exotic_plasma_ball') { ctx.fillStyle = b.beamColor; ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 20; ctx.shadowColor = b.beamColor; ctx.fill(); ctx.shadowBlur = 0; } 
          else if (!b.isInvisible) { ctx.fillStyle = b.beamColor || '#fbbf24'; ctx.fillRect(b.x - b.size/2, b.y - b.size * 2, b.size, b.size * 4); } 
      });
      s.enemyBullets.forEach(eb => { ctx.fillStyle = eb.isExotic ? '#a855f7' : '#f87171'; ctx.fillRect(eb.x-2, eb.y, 4, 18); });
      s.missiles.forEach(m => { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI/2); ctx.beginPath(); ctx.roundRect(-4, -12, 8, 24, 4); ctx.fillStyle = m.isEmp ? '#00f2ff' : (m.isHeavy ? '#f97316' : '#ef4444'); ctx.fill(); ctx.restore(); });
      s.mines.forEach(m => { ctx.save(); ctx.translate(m.x, m.y); ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fillStyle = m.isMagnetic ? '#fbbf24' : '#00f2ff'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.stroke(); ctx.restore(); });
      s.gifts.forEach(g => { 
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(s.frame*0.08); const boxSize = 18; 
        ctx.fillStyle = g.type === 'weapon' ? '#a855f7' : (g.type === 'energy' ? '#00f2ff' : (g.type === 'gold' ? '#fbbf24' : (g.type === 'platinum' ? '#e2e8f0' : (g.type === 'lithium' ? '#c084fc' : (g.type === 'repair' ? '#10b981' : '#60a5fa'))))); 
        ctx.fillRect(-boxSize/2, -boxSize/2, boxSize, boxSize); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(-boxSize/2, -boxSize/2, boxSize, boxSize); 
        ctx.fillStyle = '#000'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
        let letter = ''; 
        if (g.type === 'gold') letter = 'G'; else if (g.type === 'platinum') letter = 'P'; else if (g.type === 'lithium') letter = 'L';
        else if (g.type === 'missile') letter = 'S'; 
        else if (g.type === 'mine') letter = 'M'; else if (g.type === 'fuel') letter = 'F'; 
        else if (g.type === 'energy') letter = 'E'; else if (g.type === 'weapon') letter = 'W'; 
        else if (g.type === 'repair') letter = 'H';
        ctx.fillText(letter, 0, 0); ctx.restore(); 
      });
      if (activeShip) drawShip(ctx, activeShip, s.px, s.py, s.fuel > 0 && isVertical, 0, s.playerDead);
      const renderShield = (shVal: number, shDef: Shield, radius: number) => { if (shVal <= 0 || s.playerDead) return; ctx.save(); ctx.strokeStyle = shDef.color; ctx.lineWidth = 5.0; ctx.beginPath(); ctx.arc(s.px, s.py, radius, Math.PI*1.1, Math.PI*1.9); ctx.stroke(); ctx.restore(); };
      if (shield) renderShield(s.sh1, shield, 85); if (secondShield) renderShield(s.sh2, secondShield, 105);
      if (s.isPaused) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = '#fff'; ctx.font = '30px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText('SYSTEM PAUSED', canvas.width/2, canvas.height/2); }
      ctx.restore(); anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); window.removeEventListener('keydown', handleKey as any); window.removeEventListener('keyup', handleKey as any); };
  }, [difficulty, activeShip, shield, secondShield, maxEnergy, initialFuel, maxFuelCapacity, initialIntegrity, currentPlanet, quadrant, ships]);

  const ep = (stats.energy / maxEnergy) * 100, fp = (stats.fuel / maxFuelCapacity) * 100, nl = 15, ael = Math.ceil((ep/100)*nl), afl = Math.ceil((fp/100)*nl);
  
  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50">
        <div className="retro-font text-[8px] text-zinc-500 uppercase tracking-[0.3em] mb-1">Sector Defense Clock</div>
        <div className={`retro-font text-[24px] ${stats.missionTimer < 20 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {Math.floor(stats.missionTimer / 60)}:{(stats.missionTimer % 60).toString().padStart(2, '0')}
        </div>
      </div>
      {stateRef.current.scavengeMode && (<div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-none bg-emerald-950/20 px-8 py-3 rounded-xl border border-emerald-500/30 backdrop-blur-sm"><div className="retro-font text-[10px] text-emerald-400 uppercase tracking-widest animate-pulse">SCAVENGE PHASE ACTIVE</div><div className="retro-font text-[18px] text-white">EXTRACTION IN: {stats.scavengeTimer}s</div></div>)}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-end gap-2.5 z-50 pointer-events-none opacity-95 scale-90">
        <div className="flex flex-col items-center gap-1.5">
          <div className={`retro-font text-[5px] uppercase font-black ${(stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>FUE</div>
          <div className="flex flex-col-reverse gap-0.5 p-1 bg-zinc-950/70 border border-zinc-800/40 rounded">
            {Array.from({ length: nl }).map((_, i) => (<div key={i} className={`w-3.5 h-1 rounded-xs transition-colors duration-300 ${i < afl ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: i < afl ? ((stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? '#ff004c' : '#00b7ff') : '#18181b', color: (stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? '#ff004c' : '#00b7ff' }} />))}
          </div>
          <div className={`retro-font text-[6px] font-black ${(stats.fuel < (maxFuelCapacity * 0.2) || stateRef.current.isMeltdown) ? 'text-red-500' : 'text-blue-500'}`}>{stats.fuel.toFixed(1)}U</div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className={`retro-font text-[5px] uppercase font-black ${ep<50 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>PWR</div>
          <div className="flex flex-col-reverse gap-0.5 p-1 bg-zinc-950/70 border border-zinc-800/40 rounded">
            {Array.from({ length: nl }).map((_, i) => { const r = i/nl, c = ep<50 ? (ep<25 ? '#ff0000' : '#fbbf24') : (r<0.3 ? '#ff3300' : (r<0.6 ? '#ffff00' : '#00ffd0')); return (<div key={i} className={`w-3.5 h-1 rounded-xs transition-colors duration-300 ${i < ael ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: i < ael ? c : '#18181b', color: c }} />); })}
          </div>
          <div className={`retro-font text-[6px] font-black ${ep<50 ? 'text-red-500' : 'text-cyan-500'}`}>{Math.floor(ep)}%</div>
        </div>
      </div>
      {stats.boss && (<div className="absolute top-20 left-1/2 -translate-x-1/2 w-[350px] flex flex-col items-center gap-1 z-50 pointer-events-none bg-black/40 p-3 rounded-lg border border-white/5 opacity-95">
          <div className="retro-font text-[6px] text-purple-400 uppercase tracking-[0.4em] font-black drop-shadow-[0_0_80px_#a855f7]">XENOS PRIMARY</div>
          <div className="w-full flex flex-col gap-1 mt-1.5">
            {stats.boss.sh > 0 && (<div className="w-full h-1.5 bg-zinc-900/40 border border-purple-900/30 rounded-full overflow-hidden"><div className="h-full bg-purple-500 shadow-[0_0_12px_#a855f7]" style={{ width: `${(stats.boss.sh/stats.boss.maxSh)*100}%` }} /></div>)}
            <div className="w-full h-2 bg-zinc-900/40 border border-red-900/30 rounded-full overflow-hidden"><div className="h-full bg-red-600 shadow-[0_0_12px_#dc2626]" style={{ width: `${(stats.boss.hp/stats.boss.maxHp)*100}%` }} /></div>
          </div>
        </div>)}
      <div className="absolute top-3 left-5 flex flex-col gap-2.5 pointer-events-none z-50 opacity-100 scale-90 origin-top-left">
        <div className="flex items-center gap-2.5"><div className={`retro-font text-[6px] uppercase w-8 font-black ${stateRef.current.isMeltdown ? 'text-red-500 animate-pulse drop-shadow-[0_0_5px_#ef4444]' : 'text-lime-400 drop-shadow-[0_0_5px_#a3e635]'}`}>HULL</div><div className="w-40 h-1.5 bg-zinc-950/50 border border-zinc-800/40 rounded-full overflow-hidden"><div className={`h-full ${stateRef.current.isMeltdown ? 'bg-red-500' : 'bg-lime-500'}`} style={{ width: `${stats.hp}%` }} /></div></div>
        {shield && <div className="flex items-center gap-2.5"><div className="retro-font text-[6px] uppercase w-8 font-black" style={{ color: shield.color }}>SHLD</div><div className="w-40 h-1.5 bg-zinc-950/50 border border-zinc-800/40 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${(stats.sh1/shield.capacity)*100}%`, backgroundColor: shield.color }} /></div></div>}
      </div>
      <div className="absolute top-3 right-5 text-right flex flex-col gap-1 z-50 scale-90 origin-top-right"><div className="flex flex-col gap-1 opacity-90"><div className="retro-font text-[20px] text-white tabular-nums">{stats.score.toLocaleString()}</div><div className="retro-font text-[6px] text-zinc-300 uppercase tracking-widest font-black">UNITS</div></div></div>
      <div className="absolute bottom-3 left-5 flex flex-col gap-3 pointer-events-none p-3 bg-zinc-950/30 border border-white/5 rounded-lg min-w-[180px] opacity-95 scale-85 origin-bottom-left">
         <div className="flex flex-col gap-1.5"><span className="retro-font text-[6px] text-red-400 uppercase tracking-widest font-black">MISSIL</span><div className="grid grid-cols-10 gap-1.5 w-fit">{Array.from({ length: stats.missiles }).map((_, i) => (<div key={i} className="w-1.5 h-1.5 rounded-xs bg-red-500 shadow-[0_0_8px_#ef4444]" />))}</div></div>
         <div className="flex flex-col gap-1.5"><span className="retro-font text-[6px] text-lime-400 uppercase tracking-widest font-black">MINES</span><div className="grid grid-cols-10 gap-1.5 w-fit">{Array.from({ length: stats.mines }).map((_, i) => (<div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#00ffa2]" />))}</div></div>
         <div className="flex flex-col gap-1.5 mt-1 border-t border-white/5 pt-2"><span className="retro-font text-[6px] text-amber-400 uppercase tracking-widest font-black">STORAGE</span><div className="flex gap-1.5 w-fit">{Array.from({ length: stats.hullPacks }).map((_, i) => (<div key={i} className="w-2.5 h-2.5 bg-amber-500 border border-amber-300 shadow-[0_0_5px_#f59e0b] flex items-center justify-center text-[5px] text-black font-black">H</div>))}</div></div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="absolute bottom-5 right-5 flex items-center gap-3 pointer-events-auto z-[100] origin-bottom-right scale-90 md:scale-100">
        <div className={`flex items-center justify-center px-4 h-[52px] min-w-[200px] bg-black/60 border-2 rounded-xl retro-font text-[8px] uppercase backdrop-blur-md shadow-lg transition-colors ${stats.alert ? 'animate-pulse' : ''} ${stateRef.current.isMeltdown || stats.hp < 15 ? 'text-red-500 border-red-500' : 'text-emerald-400 border-emerald-500/40'}`}>
            {stats.alert || "STATUS: NOMINAL"}
        </div>
        
        <button onClick={togglePause} className="h-[52px] px-6 bg-zinc-900/40 border-2 border-zinc-700/60 rounded-xl text-zinc-400 retro-font text-[10px] uppercase hover:bg-zinc-800 hover:text-white transition-all shadow-lg backdrop-blur-md">
            {stats.isPaused ? 'RESUME' : 'PAUSE'}
        </button>

        <button onClick={(e) => {
            const s = stateRef.current;
            const finalHP = s.isMeltdown ? 25 : Math.max(0, s.integrity);
            onGameOverRef.current(false, s.score, true, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: finalHP, hullPacks: s.hullPacks, cargo: s.missionCargo });
            e.currentTarget.blur();
        }} className="h-[52px] px-6 bg-red-600/20 border-2 border-red-500/40 rounded-xl text-red-500 retro-font text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all shadow-lg backdrop-blur-md">
            ABORT MISSION
        </button>
      </div>
    </div>
  );
};

export default GameEngine;
