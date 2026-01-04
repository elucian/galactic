
// CHECKPOINT: Defender V84.95
// VERSION: V84.99 - PRECISION MANEUVER JETS + GROUND TARGETS
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, Weapon, EquippedWeapon, Planet, QuadrantType, WeaponType, CargoItem } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, PLANETS, BOSS_SHIPS, SHIELDS } from '../constants.ts';

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
  type: 'scout' | 'fighter' | 'heavy' | 'boss' | 'alien_swarm';
  config: ExtendedShipConfig;
  lastShot: number = 0;
  color: string;
  vx: number = 0; vy: number = 0;
  rewardThresholds: number[] = [0.7, 0.4, 0.1];
  pattern: number = Math.random();
  constructor(x: number, y: number, type: 'scout' | 'fighter' | 'heavy' | 'boss' | 'alien_swarm', config: ExtendedShipConfig, difficulty: number) {
    const hpMap = { scout: 80, fighter: 200, heavy: 600, boss: 5000 * difficulty, alien_swarm: 40 };
    const shMap = { scout: 0, fighter: 50, heavy: 200, boss: Math.max(1500, 3000 * (difficulty/2)), alien_swarm: 0 };
    this.x = x; this.y = y; this.hp = hpMap[type]; this.maxHp = hpMap[type];
    if (type === 'boss' || (difficulty >= 4 && shMap[type] > 0)) {
      this.sh = shMap[type]; this.maxSh = shMap[type];
    }
    this.type = type; this.config = config;
    this.color = type === 'boss' ? '#a855f7' : (type === 'heavy' ? '#ef4444' : (type === 'fighter' ? '#f97316' : (type === 'alien_swarm' ? '#10b981' : '#60a5fa')));
  }
}

class GroundStructure {
  x: number; y: number; hp: number; maxHp: number; size: number; color: string; type: 'silo' | 'comm_hub' | 'turret';
  constructor(x: number, y: number, type: 'silo' | 'comm_hub' | 'turret') {
    this.x = x; this.y = y; this.type = type;
    this.size = type === 'silo' ? 45 : (type === 'comm_hub' ? 60 : 35);
    this.hp = type === 'silo' ? 300 : (type === 'comm_hub' ? 600 : 150);
    this.maxHp = this.hp;
    this.color = '#334155';
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
  x: number; y: number; vx: number; vy: number; target: Enemy | GroundStructure | null = null;
  life: number = 600; 
  damage: number = 200; isHeavy: boolean = false; isEmp: boolean = false;
  constructor(x: number, y: number, vx: number, vy: number, isHeavy: boolean = false, isEmp: boolean = false) { 
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; 
    this.isHeavy = isHeavy; this.isEmp = isEmp;
    if (isHeavy) { this.damage = 650; this.life = 600; }
    if (isEmp) { this.damage = 1000; this.life = 600; }
  }
}

class Mine {
  x: number; y: number; vx: number; vy: number; damage: number = 3500;
  isMagnetic: boolean = Math.random() > 0.4;
  target: Enemy | GroundStructure | null = null;
  sh: number = 100; 
  constructor(x: number, y: number) { this.x = x; this.y = y; this.vx = 0; this.vy = -1.5; }
  update(enemies: Enemy[], ground: GroundStructure[]) {
    if (this.isMagnetic) {
      if (!this.target || this.target.hp <= 0) {
        let minDist = 700;
        enemies.forEach(en => {
          const d = Math.sqrt((this.x - en.x)**2 + (this.y - en.y)**2);
          if (d < minDist) { minDist = d; this.target = en; }
        });
        ground.forEach(g => {
          const d = Math.sqrt((this.x - g.x)**2 + (this.y - g.y)**2);
          if (d < minDist) { minDist = d; this.target = g; }
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
    viewProgress: number = 0; // 0 to 1 for zooming in
    planets: any[];
    comets: any[];
    constructor(w: number, h: number, quadrant: QuadrantType, selectedPlanetId: string) {
        this.x = w / 2; this.y = -400; 
        this.isBlackHole = quadrant === QuadrantType.DELTA;
        const colors = { [QuadrantType.ALFA]: '#facc15', [QuadrantType.BETA]: '#f97316', [QuadrantType.GAMA]: '#60a5fa', [QuadrantType.DELTA]: '#000000' };
        this.sunColor = colors[quadrant];
        
        const sectorPlanets = PLANETS.filter(p => p.quadrant === quadrant);
        this.planets = sectorPlanets.map((p, i) => ({
            id: p.id,
            name: p.name,
            distance: 400 + (i * 220),
            baseSize: p.size * 5,
            color: p.color,
            angle: Math.random() * Math.PI * 2,
            speed: 0.0003 + Math.random() * 0.0005,
            isSelected: p.id === selectedPlanetId,
            moon: Math.random() > 0.4 ? { angle: Math.random() * Math.PI * 2, distance: (p.size * 5) + 35, size: 6, speed: 0.015 } : null
        }));

        this.comets = Array.from({length: 2}).map(() => ({
            x: 0, y: 0,
            angle: Math.random() * Math.PI * 2,
            a: 800 + Math.random() * 500, // Semi-major axis
            b: 300 + Math.random() * 200, // Semi-minor axis
            speed: 0.0001 + Math.random() * 0.0002,
            tailLength: 0
        }));
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

  const MISSION_DURATION = (1 +