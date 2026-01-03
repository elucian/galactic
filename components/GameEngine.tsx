
// CHECKPOINT: Defender V80.31
// VERSION: V80.31 - Time-based Destruction
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, Weapon, EquippedWeapon } from '../types';
import { audioService } from '../services/audioService';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS } from '../constants';

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
  onGameOver: (success: boolean, finalScore: number, wasAborted?: boolean, payload?: { rockets: number, mines: number, weapons: EquippedWeapon[], fuel: number, bossDefeated?: boolean, health: number }) => void;
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; type: 'fire' | 'smoke' | 'spark' | 'debris' | 'shock' | 'fuel';
}

class Enemy {
  x: number; y: number; hp: number; maxHp: number;
  sh: number = 0; maxSh: number = 0;
  type: 'scout' | 'fighter' | 'heavy' | 'boss';
  config: ExtendedShipConfig;
  lastShot: number = 0;
  color: string;
  evadeX: number = 0; evadeY: number = 0;
  constructor(x: number, y: number, type: 'scout' | 'fighter' | 'heavy' | 'boss', config: ExtendedShipConfig, difficulty: number) {
    const hpMap = { scout: 80, fighter: 200, heavy: 600, boss: 5000 * difficulty };
    const shMap = { scout: 0, fighter: 50, heavy: 200, boss: 3000 * difficulty };
    this.x = x; this.y = y; this.hp = hpMap[type]; this.maxHp = hpMap[type];
    if (type === 'boss' || (difficulty >= 4 && shMap[type] > 0)) {
      this.sh = shMap[type]; this.maxSh = shMap[type];
    }
    this.type = type; this.config = config;
    this.color = type === 'boss' ? '#a855f7' : (type === 'heavy' ? '#ef4444' : (type === 'fighter' ? '#f97316' : '#60a5fa'));
  }
}

class Missile {
  x: number; y: number; vx: number; vy: number; target: Enemy | null = null;
  life: number = 800; damage: number = 200;
  constructor(x: number, y: number, vx: number, vy: number) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; }
}

class Mine {
  x: number; y: number; vx: number; vy: number; damage: number = 350; zigDir: number = 1; zigTimer: number = 0;
  constructor(x: number, y: number) { this.x = x; this.y = y; this.vx = 0; this.vy = -4.5; }
}

class Gift {
  x: number; y: number; vy: number = 2.5; type: 'ammo' | 'weapon';
  id?: string; name?: string;
  constructor(x: number, y: number, type: 'ammo' | 'weapon', id?: string, name?: string) { 
    this.x = x; this.y = y; this.type = type; this.id = id; this.name = name;
  }
}

const GameEngine: React.FC<GameEngineProps> = ({ ships, shield, secondShield, onGameOver, difficulty }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  if (!ships || ships.length === 0) return <div className="p-20 text-center">SYSTEM ERROR: NO SHIP DATA</div>;
  
  const activeShip = ships[0];
  const maxEnergy = activeShip?.config?.maxEnergy || 100;
  const initialFuel = activeShip?.fitting?.fuel || 0;
  const initialIntegrity = activeShip?.fitting?.health || 100;
  const maxFuelCapacity = activeShip?.config?.maxFuel || 1.0;

  const [stats, setStats] = useState({ 
    hp: initialIntegrity, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, energy: maxEnergy,
    score: 0, missiles: activeShip?.fitting?.rocketCount || 0, mines: activeShip?.fitting?.mineCount || 0,
    fuel: initialFuel,
    boss: null as { hp: number, maxHp: number, sh: number, maxSh: number } | null,
    alert: ""
  });

  const onGameOverRef = useRef(onGameOver);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  const stateRef = useRef({
    px: 0, py: 0, hp: 100, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, energy: maxEnergy, score: 0,
    integrity: initialIntegrity, // This is the persistent health value
    fuel: initialFuel,
    bullets: [] as any[], enemyBullets: [] as any[], missiles: [] as Missile[], mines: [] as Mine[], 
    enemies: [] as Enemy[], particles: [] as Particle[], stars: [] as any[], gifts: [] as Gift[],
    keys: new Set<string>(), lastFire: 0, lastMissile: 0, lastMine: 0, lastSpawn: 0, gameActive: true, frame: 0,
    missileStock: activeShip?.fitting?.rocketCount || 0, mineStock: activeShip?.fitting?.mineCount || 0,
    equippedWeapons: [...(activeShip?.fitting?.weapons || [])],
    bossSpawned: false, bossDead: false, lootPending: false, shake: 0,
    playerDead: false, deathTimer: 0, deathIntegrityStart: initialIntegrity, deathFuelStart: initialFuel,
    lastW: window.innerWidth || 1024, lastH: window.innerHeight || 768
  });

  const createExplosion = (x: number, y: number, isBoss: boolean = false, isMine: boolean = false) => {
    const s = stateRef.current;
    const count = isBoss ? 120 : (isMine ? 80 : 30);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = isBoss ? Math.random() * 16 : (isMine ? Math.random() * 12 : Math.random() * 7);
      s.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1.0 + Math.random() * 0.5, size: Math.random() * (isBoss ? 12 : (isMine ? 8 : 5)) + 2,
        color: isBoss ? (Math.random() > 0.4 ? '#f97316' : '#ffffff') : (isMine ? '#00f2ff' : (Math.random() > 0.7 ? '#ffffff' : '#f59e0b')),
        type: 'fire'
      });
      if (isBoss || isMine) {
        s.particles.push({
          x, y, vx: Math.cos(angle) * (speed * 0.3), vy: Math.sin(angle) * (speed * 0.3),
          life: 2.5, size: Math.random() * 30 + 15, color: isMine ? 'rgba(0, 242, 255, 0.15)' : 'rgba(60, 60, 60, 0.4)', type: 'smoke'
        });
      }
    }
    if (isMine) {
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        s.particles.push({ x, y, vx: Math.cos(angle) * 18, vy: Math.sin(angle) * 18, life: 0.9, color: '#ffffff', size: 5, type: 'shock' });
      }
    }
  };

  const applyDamageToEnemy = (en: Enemy, dmg: number) => {
    if (en.sh > 0) {
      const leftover = Math.max(0, dmg - en.sh);
      en.sh = Math.max(0, en.sh - dmg);
      if (leftover > 0) en.hp -= leftover;
    } else {
      en.hp -= dmg;
    }
  };

  const spawnBossExplosions = (bx: number, by: number) => {
    const s = stateRef.current; s.shake = 65; s.lootPending = true;
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const ex = bx + (Math.random() - 0.5) * 480;
        const ey = by + (Math.random() - 0.5) * 480;
        createExplosion(ex, ey, true);
        audioService.playExplosion(0, 2.3);
        s.shake = 40;
      }, i * 60);
    }
    setTimeout(() => { 
        if (Math.random() > 0.5) {
            s.gifts.push(new Gift(bx, by, 'ammo'));
        } else {
            const randomExotic = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)];
            s.gifts.push(new Gift(bx, by, 'weapon', randomExotic.id, randomExotic.name));
        }
        s.lootPending = false;
    }, 3600);
  };

  const drawShip = (ctx: CanvasRenderingContext2D, sInst: any, x: number, y: number, isThrusting: boolean, rotation: number = 0, isGhost: boolean = false) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(0.5, 0.5); ctx.translate(-50, -50);
    if (isGhost) ctx.globalAlpha = 0.3;
    const config = sInst.config;
    const { engines: engineCount, hullShapeType, wingStyle } = config;
    
    const hullColor = sInst.color || '#94a3b8';
    const wingColor = sInst.wingColor || '#64748b';
    const cockpitColor = sInst.cockpitColor || '#38bdf8';
    const engineColor = sInst.engineColor || '#334155';
    const nozzleColor = sInst.nozzleColor || '#171717';
    const gunColor = sInst.gunColor || '#60a5fa';
    const gunBodyColor = sInst.gunBodyColor || '#1c1917';

    const drawEngine = (ex: number, ey: number) => {
      ctx.fillStyle = engineColor; ctx.beginPath(); ctx.roundRect(ex - 12, ey - 10, 24, 25, 4); ctx.fill();
      ctx.fillStyle = nozzleColor; ctx.beginPath(); ctx.moveTo(ex-10, ey+8); ctx.lineTo(ex-12, ey+22); ctx.quadraticCurveTo(ex, ey+28, ex+12, ey+22); ctx.lineTo(ex+10, ey+8); ctx.fill();
      if (isThrusting) { 
        ctx.fillStyle = '#f97316'; ctx.globalAlpha = (isGhost ? 0.2 : 0.6) + Math.random() * 0.4; 
        ctx.beginPath(); ctx.moveTo(ex - 8, ey + 15); ctx.lineTo(ex + 8, ey + 15); ctx.lineTo(ex, ey + 45 + Math.random() * 20); ctx.closePath(); ctx.fill(); if(!isGhost) ctx.globalAlpha = 1; 
      }
    };
    if (engineCount === 1) drawEngine(50, 82); else if (engineCount === 2) { drawEngine(25, 75); drawEngine(75, 75); }
    
    ctx.fillStyle = wingColor; ctx.beginPath();
    if (wingStyle === 'delta') { ctx.moveTo(35, 40); ctx.lineTo(5, 85); ctx.lineTo(50, 75); ctx.moveTo(65, 40); ctx.lineTo(95, 85); ctx.lineTo(50, 75); } else { ctx.ellipse(50, 60, 48, 18, 0, 0, Math.PI * 2); }
    ctx.fill();
    
    ctx.fillStyle = hullColor; ctx.beginPath();
    if (hullShapeType === 'triangle') { ctx.moveTo(50, 10); ctx.lineTo(80, 85); ctx.lineTo(20, 85); } else { ctx.roundRect(30, 15, 40, 75, 12); }
    ctx.fill();

    const renderGun = (gx: number, gy: number, sc: number) => {
        ctx.save(); ctx.translate(gx, gy); ctx.scale(sc, sc);
        ctx.fillStyle = gunColor; ctx.fillRect(-1, -18, 2, 42);
        ctx.fillStyle = gunBodyColor; ctx.fillRect(-7, -5, 14, 22);
        ctx.fillStyle = '#334155'; ctx.fillRect(-4, -24, 8, 20);
        ctx.fillStyle = gunColor; ctx.fillRect(-1, -48, 2, 32);
        ctx.restore();
    };
    if (config.defaultGuns === 1) renderGun(50, 15, 0.35); else { renderGun(25, 45, 0.55); renderGun(75, 45, 0.55); }

    ctx.fillStyle = cockpitColor; ctx.beginPath(); ctx.ellipse(50, (hullShapeType === 'triangle' ? 58 : 38), 9, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    
    if (stateRef.current.px === 0) {
      stateRef.current.px = window.innerWidth / 2;
      stateRef.current.py = window.innerHeight * 0.85;
      stateRef.current.lastW = window.innerWidth;
      stateRef.current.lastH = window.innerHeight;
    }

    const resize = () => { 
      const currentW = window.innerWidth;
      const currentH = window.innerHeight;
      if (currentW <= 0 || currentH <= 0) return;
      const lastW = stateRef.current.lastW;
      const lastH = stateRef.current.lastH;
      const nx = stateRef.current.px / lastW;
      const ny = stateRef.current.py / lastH;
      canvas.width = currentW; canvas.height = currentH;
      if (isFinite(nx) && isFinite(ny) && lastW > 0 && lastH > 0) {
        stateRef.current.px = nx * currentW;
        stateRef.current.py = ny * currentH;
      } else {
        stateRef.current.px = currentW / 2;
        stateRef.current.py = currentH * 0.85;
      }
      stateRef.current.stars.forEach(st => { st.x = Math.random() * currentW; st.y = Math.random() * currentH; });
      stateRef.current.lastW = currentW;
      stateRef.current.lastH = currentH;
      stateRef.current.px = Math.max(35, Math.min(canvas.width - 35, stateRef.current.px));
      stateRef.current.py = Math.max(35, Math.min(canvas.height - 35, stateRef.current.py));
    };
    
    window.addEventListener('resize', resize); resize();
    stateRef.current.stars = Array.from({ length: 250 }).map(() => ({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, s: Math.random() * 2, v: 2.5 + Math.random() * 6.5 }));
    
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      if (isDown) stateRef.current.keys.add(e.code); else stateRef.current.keys.delete(e.code);
      if (isDown && e.code === 'Escape') { 
        stateRef.current.gameActive = false; 
        onGameOverRef.current(false, stateRef.current.score, true, { rockets: stateRef.current.missileStock, mines: stateRef.current.mineStock, weapons: stateRef.current.equippedWeapons, fuel: stateRef.current.fuel, bossDefeated: stateRef.current.bossDead, health: stateRef.current.integrity }); 
      }
      if (isDown && e.code === 'Tab' && !stateRef.current.playerDead) { e.preventDefault(); if (stateRef.current.missileStock > 0) { stateRef.current.missileStock--; setStats(p => ({ ...p, missiles: stateRef.current.missileStock })); stateRef.current.missiles.push(new Missile(stateRef.current.px, stateRef.current.py - 40, (Math.random() - 0.5) * 5, -8)); audioService.playWeaponFire('missile'); } }
      if (isDown && e.code === 'CapsLock' && !stateRef.current.playerDead) { e.preventDefault(); if (stateRef.current.mineStock > 0) { stateRef.current.mineStock--; setStats(p => ({ ...p, mines: stateRef.current.mineStock })); stateRef.current.mines.push(new Mine(stateRef.current.px, stateRef.current.py)); audioService.playWeaponFire('mine'); } }
    };

    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));

    let anim: number;
    const loop = () => {
      const s = stateRef.current; if (!s.gameActive) return; s.frame++; const pSpeed = 9.5;
      const hasFuelInTank = s.fuel > 0;
      const isMoving = !s.playerDead && (s.keys.has('KeyW') || s.keys.has('ArrowUp') || s.keys.has('KeyS') || s.keys.has('ArrowDown') || s.keys.has('KeyA') || s.keys.has('ArrowLeft') || s.keys.has('KeyD') || s.keys.has('ArrowRight'));
      const isVertical = !s.playerDead && (s.keys.has('KeyW') || s.keys.has('ArrowUp') || s.keys.has('KeyS') || s.keys.has('ArrowDown'));

      if (!s.playerDead) {
        if (isVertical && hasFuelInTank) {
          if (s.keys.has('KeyW') || s.keys.has('ArrowUp')) s.py -= pSpeed;
          if (s.keys.has('KeyS') || s.keys.has('ArrowDown')) s.py += pSpeed;
          s.fuel = Math.max(0, s.fuel - 0.0008); 
        }
        if (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) s.px -= pSpeed;
        if (s.keys.has('KeyD') || s.keys.has('ArrowRight')) s.px += pSpeed;
        
        s.px = Math.max(35, Math.min(canvas.width - 35, s.px)); 
        s.py = Math.max(35, Math.min(canvas.height - 35, s.py));
        s.energy = Math.min(maxEnergy, s.energy + 0.4);
        if (shield && s.sh1 < shield.capacity && s.energy > 5) { s.sh1 += 0.5; s.energy -= 0.2; }
        if (secondShield && s.sh2 < secondShield.capacity && s.energy > 5) { s.sh2 += 0.5; s.energy -= 0.2; }

        if ((s.keys.has('Space') || s.keys.has('KeyF')) && Date.now() - s.lastFire > 110 && s.energy > 12 && s.equippedWeapons.length > 0) {
          s.equippedWeapons.forEach((w, idx) => {
            const weaponDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(wd => wd.id === w.id); if (!weaponDef) return;
            const xOff = s.equippedWeapons.length > 1 ? (idx === 0 ? -18 : 18) : 0;
            const customBeamColor = activeShip.gunColor || activeShip.cockpitColor || weaponDef.beamColor;
            if (weaponDef.id === 'exotic_wave') s.bullets.push({ x: s.px + xOff, y: s.py - 35, vy: -15, damage: weaponDef.damage, type: 'wave', t: s.frame, beamColor: customBeamColor }); 
            else if (weaponDef.id === 'exotic_bolt') s.bullets.push({ x: s.px + xOff, y: s.py - 35, vy: -20, damage: weaponDef.damage, type: 'bolt', beamColor: customBeamColor }); 
            else if (weaponDef.id === 'exotic_beam') s.bullets.push({ x: s.px + xOff, y: s.py - 35, vy: -25, damage: weaponDef.damage, type: 'beam', beamColor: customBeamColor }); 
            else if (weaponDef.id === 'exotic_spiral') s.bullets.push({ x: s.px + xOff, y: s.py - 35, vy: -12, damage: weaponDef.damage, type: 'spiral', t: s.frame, beamColor: customBeamColor }); 
            else if (weaponDef.id === 'exotic_split') { s.bullets.push({ x: s.px + xOff, y: s.py - 35, vx: -4, vy: -18, damage: weaponDef.damage, type: 'std', beamColor: customBeamColor }); s.bullets.push({ x: s.px + xOff, y: s.py - 35, vx: 0, vy: -18, damage: weaponDef.damage, type: 'std', beamColor: customBeamColor }); s.bullets.push({ x: s.px + xOff, y: s.py - 35, vx: 4, vy: -18, damage: weaponDef.damage, type: 'std', beamColor: customBeamColor }); } 
            else if (weaponDef.id === 'exotic_saw') s.bullets.push({ x: s.px + xOff, y: s.py - 35, vy: -10, damage: weaponDef.damage, type: 'saw', t: s.frame, beamColor: customBeamColor }); 
            else if (weaponDef.id === 'exotic_grav') s.bullets.push({ x: s.px + xOff, y: s.py - 35, vy: -6, damage: weaponDef.damage, type: 'grav', beamColor: customBeamColor }); 
            else if (weaponDef.id === 'exotic_flame') { for(let i=0; i<3; i++) s.bullets.push({ x: s.px + xOff + (Math.random()-0.5)*15, y: s.py - 35, vx: (Math.random()-0.5)*4, vy: -15 - Math.random()*10, damage: weaponDef.damage/3, type: 'fire', life: 25, beamColor: customBeamColor }); } 
            else s.bullets.push({ x: s.px + xOff, y: s.py - 35, vx: 0, vy: -18.5, damage: weaponDef.damage, type: 'std', beamColor: customBeamColor });
          });
          s.energy -= 2.9 * s.equippedWeapons.length;
          audioService.playWeaponFire('cannon'); s.lastFire = Date.now();
        }
      }

      // FUEL LEAK & DECAY LOGIC (Always bind to integrity)
      if (s.integrity < 100) {
           const damageFactor = (100 - s.integrity) / 100;
           if (Math.random() < damageFactor * 0.5) {
               s.particles.push({
                 x: s.px + (Math.random()-0.5)*20, y: s.py + 15, vx: (Math.random()-0.5)*2, vy: 5 + Math.random()*5,
                 life: 1.0, size: 5 + Math.random()*10, color: 'rgba(30, 30, 30, 0.7)', type: 'smoke'
               });
           }
           if (s.integrity < 50 && Math.random() < damageFactor * 0.3) {
               s.particles.push({
                 x: s.px + (Math.random()-0.5)*15, y: s.py + 10, vx: (Math.random()-0.5)*3, vy: 8 + Math.random()*8,
                 life: 0.8, size: 4 + Math.random()*8, color: Math.random() > 0.5 ? '#f59e0b' : '#ef4444', type: 'fire'
               });
           }
      }

      if (s.score >= difficulty * 10000 && !s.bossSpawned) { s.bossSpawned = true; s.enemies.push(new Enemy(canvas.width/2, -300, 'boss', SHIPS[SHIPS.length-1], difficulty)); }

      for (let i = s.particles.length - 1; i >= 0; i--) { const p = s.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= (p.type === 'shock' ? 0.05 : 0.025); if (p.type === 'smoke') p.size += 0.3; if (p.life <= 0) s.particles.splice(i, 1); }

      for (let i = s.missiles.length - 1; i >= 0; i--) {
        const m = s.missiles[i]; if (!m.target || m.target.hp <= 0) { let b = null; let md = 15000; s.enemies.forEach(en => { const d = Math.sqrt((m.x-en.x)**2+(m.y-en.y)**2); if(d<md){md=d; b=en;} }); m.target = b; }
        if (m.target) { const dx = m.target.x - m.x, dy = m.target.y - m.y, d = Math.sqrt(dx*dx+dy*dy); m.vx += (dx/d)*2.5; m.vy += (dy/d)*2.5; const sp = Math.sqrt(m.vx*m.vx+m.vy*m.vy); if(sp>20){m.vx=(m.vx/sp)*20; m.vy=(m.vy/sp)*20;} } else m.vy -= 0.75;
        m.x += m.vx; m.y += m.vy; m.life--; if (m.life <= 0 || m.y < -600 || m.x < -600 || m.x > canvas.width + 600) s.missiles.splice(i, 1);
        else { for (let j = s.enemies.length - 1; j >= 0; j--) { const en = s.enemies[j]; if (Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 60) { applyDamageToEnemy(en, m.damage); s.missiles.splice(i, 1); createExplosion(m.x, m.y); audioService.playExplosion(0, 1.3); if (en.hp <= 0) { if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } s.enemies.splice(j, 1); s.score += 450; } break; } } }
      }

      for (let i = s.mines.length - 1; i >= 0; i--) {
        const m = s.mines[i]; m.y += m.vy;
        for (let j = s.enemies.length - 1; j >= 0; j--) {
            const en = s.enemies[j];
            if (Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 70) {
                const AOE_RADIUS = 220;
                s.enemies.forEach(otherEn => {
                  const dist = Math.sqrt((m.x - otherEn.x)**2 + (m.y - otherEn.y)**2);
                  if (dist < AOE_RADIUS) { applyDamageToEnemy(otherEn, m.damage * (1 - (dist / AOE_RADIUS))); }
                });
                s.mines.splice(i, 1); createExplosion(m.x, m.y, false, true); audioService.playExplosion(0, 1.6);
                for (let k = s.enemies.length - 1; k >= 0; k--) {
                  if (s.enemies[k].hp <= 0) {
                    if (s.enemies[k].type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(s.enemies[k].x, s.enemies[k].y); }
                    s.enemies.splice(k, 1); s.score += 650;
                  }
                }
                break;
            }
        }
        if (m.y < -150) s.mines.splice(i, 1);
      }

      for (let i = s.gifts.length - 1; i >= 0; i--) {
        const g = s.gifts[i]; g.y += g.vy;
        if (Math.abs(g.x - s.px) < 45 && Math.abs(g.y - s.py) < 45 && !s.playerDead) {
          s.gifts.splice(i, 1);
          if (g.type === 'ammo') { s.missileStock = Math.min(50, s.missileStock + 15); s.mineStock = Math.min(50, s.mineStock + 15); setStats(p => ({ ...p, alert: "AMMO RESTOCKED" })); } 
          else if (g.type === 'weapon' && g.id) { s.equippedWeapons = [{ id: g.id, count: 1 }]; setStats(p => ({ ...p, alert: `EXOTIC PICKUP: ${g.name}` })); }
          audioService.playSfx('buy'); setTimeout(() => setStats(p => ({ ...p, alert: "" })), 3000);
        }
        if (g.y > canvas.height + 100) s.gifts.splice(i, 1);
      }

      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const en = s.enemies[i];
        if (en.type === 'boss') { en.y = Math.min(en.y + 1, 150); en.x = canvas.width/2 + Math.sin(s.frame * 0.02) * (canvas.width * 0.35); if (en.y > 0 && en.y < canvas.height - 100 && s.frame % 18 === 0) s.enemyBullets.push({ x: en.x + (Math.random()-0.5)*150, y: en.y + 110, vy: 12 + difficulty }); if (en.sh < en.maxSh) en.sh += 0.3; } 
        else { en.y += 4.0 + (difficulty * 0.5); en.x += en.evadeX; en.evadeX *= 0.96; }
        
        if (!s.playerDead && Math.sqrt((s.px - en.x)**2 + (s.py - en.y)**2) < 55) {
            const hasKinetic = (shield?.id === 'sh_omega' || secondShield?.id === 'sh_omega');
            if (s.sh1 > 0 || s.sh2 > 0) {
               const playerDmg = hasKinetic ? 10 : 150;
               const enemyDmg = hasKinetic ? 5000 : 150;
               if (s.sh2 > 0) s.sh2 = Math.max(0, s.sh2 - playerDmg); else s.sh1 = Math.max(0, s.sh1 - playerDmg);
               applyDamageToEnemy(en, enemyDmg);
               s.shake = hasKinetic ? 15 : 35;
               if (hasKinetic) audioService.playSfx('buy'); 
            } else {
               s.hp = 0; 
            }
        }

        if (en.hp <= 0) { 
            if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); }
            createExplosion(en.x, en.y, en.type === 'boss');
            s.enemies.splice(i, 1); s.score += 150; continue; 
        }

        if (en.y > canvas.height + 200) { s.enemies.splice(i, 1); continue; }
        if (en.y > 50 && en.y < canvas.height - 150 && Date.now() - en.lastShot > 1700 / Math.sqrt(difficulty)) { s.enemyBullets.push({ x: en.x, y: en.y + 35, vy: 7.5 + difficulty }); en.lastShot = Date.now(); }
      }

      s.stars.forEach(st => { st.y += st.v; if (st.y > canvas.height) st.y = 0; });
      if (!s.bossSpawned && Date.now() - s.lastSpawn > 1700 / Math.sqrt(difficulty)) { s.enemies.push(new Enemy(Math.random() * (canvas.width - 120) + 60, -100, 'fighter', SHIPS[Math.floor(Math.random() * 6)], difficulty)); s.lastSpawn = Date.now(); }

      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i]; if (b.type === 'wave') b.x = s.px + Math.sin(s.frame * 0.2) * 60; if (b.type === 'spiral') { b.x += Math.cos(s.frame * 0.4) * 8; b.y += Math.sin(s.frame * 0.4) * 8; } if (b.life !== undefined) { b.life--; if(b.life <= 0) { s.bullets.splice(i, 1); continue; } }
        b.y += b.vy; b.x += (b.vx || 0); let hit = false;
        for (let j = s.enemies.length - 1; j >= 0; j--) { const en = s.enemies[j]; const hitSize = b.type === 'grav' ? 80 : 55; if (Math.abs(b.x - en.x) < hitSize && Math.abs(b.y - en.y) < hitSize) { applyDamageToEnemy(en, b.damage); hit = true; if (en.hp <= 0) { createExplosion(en.x, en.y, en.type==='boss'); if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } s.enemies.splice(j, 1); s.score += 150; } break; } }
        if ((hit && b.type !== 'grav' && b.type !== 'saw') || b.y < -150 || b.x < -150 || b.x > canvas.width + 150) s.bullets.splice(i, 1);
      }

      for (let i = s.enemyBullets.length - 1; i >= 0; i--) { 
        const eb = s.enemyBullets[i]; eb.y += eb.vy; 
        if (!s.playerDead && Math.abs(eb.x - s.px) < 38 && Math.abs(eb.y - s.py) < 38) { 
            s.enemyBullets.splice(i, 1); 
            if (s.sh2 > 0) s.sh2 -= 50; else if (s.sh1 > 0) s.sh1 -= 50; else s.hp -= 8; 
            audioService.playShieldHit(); 
        } 
        if (eb.y > canvas.height + 150) s.enemyBullets.splice(i, 1); 
      }

      if (s.shake > 0) s.shake *= 0.92;
      
      // DESTRUCTION SEQUENCE START
      if (s.hp <= 0 && !s.playerDead) { 
          s.playerDead = true; 
          s.deathTimer = 180; 
          s.deathIntegrityStart = s.integrity;
          s.deathFuelStart = s.fuel;
          createExplosion(s.px, s.py, true); 
          audioService.playExplosion(0, 2.8); 
          s.shake = 65; 
      }

      if (s.playerDead) { 
          s.deathTimer--; 
          const destructionProgress = 1 - (s.deathTimer / 180); // 0 to 1
          
          // RULE: After explosion, spaceship becomes damaged 25% and loses the entire fuel reserve.
          // This penalty takes time. If aborted, we return the current values.
          s.integrity = Math.max(0, s.deathIntegrityStart - (25 * destructionProgress));
          s.fuel = Math.max(0, s.deathFuelStart * (1 - destructionProgress));
          
          if (s.deathTimer % 12 === 0 && s.deathTimer > 40) { 
              createExplosion(s.px + (Math.random()-0.5)*120, s.py + (Math.random()-0.5)*120); 
              audioService.playExplosion(0, 1.4); 
          } 
          if (s.deathTimer <= 0) { 
              s.gameActive = false; 
              onGameOverRef.current(false, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: 0, bossDefeated: s.bossDead, health: s.integrity }); 
              return; 
          } 
      }

      if (s.bossDead && s.enemies.length === 0 && s.gifts.length === 0 && !s.lootPending) { s.gameActive = false; onGameOverRef.current(true, s.score, false, { rockets: s.missileStock, mines: s.mineStock, weapons: s.equippedWeapons, fuel: s.fuel, bossDefeated: s.bossDead, health: s.integrity }); return; }
      
      const currentBoss = s.enemies.find(e => e.type === 'boss');
      setStats(p => ({ ...p, hp: Math.max(0, s.integrity), sh1: Math.max(0, s.sh1), sh2: Math.max(0, s.sh2), energy: s.energy, score: s.score, missiles: s.missileStock, mines: s.mineStock, fuel: s.fuel, boss: currentBoss ? { hp: currentBoss.hp, maxHp: currentBoss.maxHp, sh: currentBoss.sh, maxSh: currentBoss.maxSh } : null }));

      ctx.save(); if (s.shake > 0) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff'; s.stars.forEach(st => ctx.fillRect(st.x, st.y, st.s, st.s));
      s.enemies.forEach(en => { drawShip(ctx, en, en.x, en.y, true, Math.PI); if (en.sh > 0) { ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(en.x, en.y, 62, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); } });
      s.particles.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; if (p.type === 'smoke') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); } else if (p.type === 'shock') { ctx.fillRect(p.x - p.size, p.y - p.size, p.size*2, p.size*2); } else { ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size); } ctx.globalAlpha = 1.0; });
      s.bullets.forEach(b => { ctx.fillStyle = b.beamColor || '#fbbf24'; if (b.type === 'bolt') { ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + (Math.random()-0.5)*15, b.y + 10); ctx.lineTo(b.x, b.y + 20); ctx.strokeStyle = b.beamColor; ctx.stroke(); } else if (b.type === 'beam') { ctx.fillRect(b.x - 4, b.y, 8, 40); } else if (b.type === 'saw') { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(s.frame * 0.6); ctx.beginPath(); for(let i=0; i<8; i++) { const r = i%2?30:15; ctx.lineTo(Math.cos(i*Math.PI/4)*r, Math.sin(i*Math.PI/4)*r); } ctx.closePath(); ctx.fill(); ctx.restore(); } else if (b.type === 'grav') { ctx.beginPath(); ctx.arc(b.x, b.y, 35, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke(); } else if (b.type === 'fire') { ctx.globalAlpha = b.life / 25; ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0; } else { ctx.fillRect(b.x - 3, b.y - 15, 6, 25); } });
      ctx.fillStyle = '#f87171'; s.enemyBullets.forEach(eb => ctx.fillRect(eb.x - 2.5, eb.y, 5, 18));
      ctx.fillStyle = '#ef4444'; s.missiles.forEach(m => { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI/2); ctx.beginPath(); ctx.roundRect(-4.5, -12, 9, 24, 3); ctx.fill(); ctx.restore(); });
      s.mines.forEach(m => { ctx.save(); ctx.translate(m.x, m.y); ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fillStyle = '#00f2ff'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); });
      s.gifts.forEach(g => { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(s.frame * 0.05); ctx.fillStyle = g.type === 'ammo' ? '#fbbf24' : '#a855f7'; ctx.fillRect(-15, -15, 30, 30); ctx.strokeStyle = '#fff'; ctx.strokeRect(-15, -15, 30, 30); ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText(g.type === 'ammo' ? 'A' : 'W', -4, 4); ctx.restore(); });

      if (activeShip) drawShip(ctx, activeShip, s.px, s.py, hasFuelInTank && isMoving, 0, s.playerDead);
      
      const renderShield = (shVal: number, shDef: Shield, radius: number) => {
        if (shVal <= 0 || s.playerDead) return;
        ctx.save();
        if (shDef.id === 'sh_omega') {
            ctx.strokeStyle = shDef.color;
            ctx.lineWidth = 4;
            ctx.setLineDash([]); 
            ctx.shadowBlur = 15;
            ctx.shadowColor = shDef.color;
            ctx.beginPath(); ctx.arc(s.px, s.py, radius, 0, Math.PI * 2); ctx.stroke();
            const grad = ctx.createRadialGradient(s.px, s.py, radius - 15, s.px, s.py, radius);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(0.8, shDef.color + '11');
            grad.addColorStop(1, shDef.color + '44');
            ctx.fillStyle = grad;
            ctx.fill();
        } else {
            ctx.strokeStyle = shDef.color;
            ctx.lineWidth = 3.5;
            if (shDef.id === 'sh_alpha') ctx.setLineDash([14, 8]);
            ctx.beginPath(); ctx.arc(s.px, s.py, radius, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
            if (shDef.id === 'sh_beta') { ctx.beginPath(); ctx.arc(s.px, s.py, radius - 8, Math.PI*1.1, Math.PI*1.9); ctx.stroke(); }
        }
        ctx.restore();
      };

      if (shield) renderShield(s.sh1, shield, 72);
      if (secondShield) renderShield(s.sh2, secondShield, 92);
      
      ctx.restore();
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); window.removeEventListener('keydown', handleKey as any); window.removeEventListener('keyup', handleKey as any); };
  }, [difficulty, activeShip, shield, secondShield, maxEnergy, initialFuel, maxFuelCapacity, initialIntegrity]);

  const ep = (stats.energy / maxEnergy) * 100, fp = (stats.fuel / maxFuelCapacity) * 100, nl = 15, ael = Math.ceil((ep/100)*nl), afl = Math.ceil((fp/100)*nl);
  
  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {stats.alert && (<div className="absolute top-1/3 left-1/2 -translate-x-1/2 retro-font text-emerald-400 text-xs animate-bounce bg-black/60 px-6 py-3 border border-emerald-500/30 rounded-lg backdrop-blur-md z-[100]">{stats.alert}</div>)}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-end gap-2.5 z-50 pointer-events-none opacity-95 scale-90">
        <div className="flex flex-col items-center gap-1.5">
          <div className={`retro-font text-[5px] uppercase font-black ${stats.fuel < (maxFuelCapacity * 0.2) ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>FUE</div>
          <div className="flex flex-col-reverse gap-0.5 p-1 bg-zinc-950/70 border border-zinc-800/40 rounded backdrop-blur-sm">
            {Array.from({ length: nl }).map((_, i) => (<div key={i} className={`w-3.5 h-1 rounded-xs transition-colors duration-300 ${i < afl ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: i < afl ? (stats.fuel < (maxFuelCapacity * 0.2) ? '#ff004c' : '#00b7ff') : '#18181b', color: stats.fuel < (maxFuelCapacity * 0.2) ? '#ff004c' : '#00b7ff' }} />))}
          </div>
          <div className={`retro-font text-[6px] font-black ${stats.fuel < (maxFuelCapacity * 0.2) ? 'text-red-500' : 'text-blue-500'}`}>{stats.fuel.toFixed(1)}U</div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className={`retro-font text-[5px] uppercase font-black ${ep<25 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>PWR</div>
          <div className="flex flex-col-reverse gap-0.5 p-1 bg-zinc-950/70 border border-zinc-800/40 rounded backdrop-blur-sm">
            {Array.from({ length: nl }).map((_, i) => { const r = i/nl, c = ep<25 ? '#ff0000' : (r<0.3 ? '#ff3300' : (r<0.6 ? '#ffff00' : '#00ffd0')); return (<div key={i} className={`w-3.5 h-1 rounded-xs transition-colors duration-300 ${i < ael ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: i < ael ? c : '#18181b', color: c }} />); })}
          </div>
          <div className={`retro-font text-[6px] font-black ${ep<25 ? 'text-red-500' : 'text-cyan-500'}`}>{Math.floor(ep)}%</div>
        </div>
      </div>
      {stats.boss && (<div className="absolute top-14 left-1/2 -translate-x-1/2 w-[350px] flex flex-col items-center gap-1 z-50 pointer-events-none bg-transparent p-3 rounded-lg border border-white/5 backdrop-blur-[1px] opacity-95">
          <div className="retro-font text-[6px] text-purple-400 uppercase tracking-[0.4em] font-black drop-shadow-[0_0_8px_#a855f7]">XENOS PRIMARY</div>
          <div className="w-full flex flex-col gap-1 mt-1.5">
            {stats.boss.sh > 0 && (<div className="w-full h-1.5 bg-zinc-900/40 border border-purple-900/30 rounded-full overflow-hidden"><div className="h-full bg-purple-500 shadow-[0_0_12px_#a855f7]" style={{ width: `${(stats.boss.sh/stats.boss.maxSh)*100}%` }} /></div>)}
            <div className="w-full h-2 bg-zinc-900/40 border border-red-900/30 rounded-full overflow-hidden"><div className="h-full bg-red-600 shadow-[0_0_12px_#dc2626]" style={{ width: `${(stats.boss.hp/stats.boss.maxHp)*100}%` }} /></div>
          </div>
        </div>)}
      <div className="absolute top-3 left-5 flex flex-col gap-2.5 pointer-events-none z-50 opacity-100 scale-90 origin-top-left">
        <div className="flex items-center gap-2.5"><div className="retro-font text-[6px] text-lime-400 uppercase w-8 font-black drop-shadow-[0_0_5px_#a3e635]">HULL</div><div className="w-40 h-1.5 bg-zinc-950/50 border border-zinc-800/40 rounded-full overflow-hidden"><div className="h-full bg-lime-500 shadow-[0_0_12px_#84cc16]" style={{ width: `${stats.hp}%` }} /></div></div>
        {shield && <div className="flex items-center gap-2.5"><div className="retro-font text-[6px] uppercase w-8 font-black" style={{ color: shield.color, textShadow: `0 0 8px ${shield.color}` }}>SHLD</div><div className="w-40 h-1.5 bg-zinc-950/50 border border-zinc-800/40 rounded-full overflow-hidden"><div className="h-full shadow-[0_0_12px_currentColor]" style={{ width: `${(stats.sh1/shield.capacity)*100}%`, backgroundColor: shield.color }} /></div></div>}
      </div>
      <div className="absolute top-3 right-5 text-right flex flex-col gap-1 z-50 scale-90 origin-top-right"><div className="flex flex-col gap-1 opacity-90"><div className="retro-font text-[20px] text-white tabular-nums drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">{stats.score.toLocaleString()}</div><div className="retro-font text-[6px] text-zinc-300 uppercase tracking-widest font-black">UNITS</div></div></div>
      <div className="absolute bottom-3 left-5 flex flex-col gap-3 pointer-events-none p-3 bg-zinc-950/30 border border-white/5 rounded-lg min-w-[180px] backdrop-blur-[2px] opacity-95 scale-85 origin-bottom-left">
         <div className="flex flex-col gap-1.5"><span className="retro-font text-[6px] text-red-400 uppercase tracking-widest font-black drop-shadow-[0_0_5px_#f87171]">MISSIL</span><div className="grid grid-cols-10 gap-1.5 w-fit">{Array.from({ length: stats.missiles }).map((_, i) => (<div key={i} className="w-1.5 h-1.5 rounded-xs bg-red-500 shadow-[0_0_8px_#ef4444]" />))}</div></div>
         <div className="flex flex-col gap-1.5"><span className="retro-font text-[6px] text-lime-400 uppercase tracking-widest font-black drop-shadow-[0_0_5px_#a3e635]">MINES</span><div className="grid grid-cols-10 gap-1.5 w-fit">{Array.from({ length: stats.mines }).map((_, i) => (<div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#00ffa2]" />))}</div></div>
      </div>
      <button onClick={() => onGameOverRef.current(false, stateRef.current.score, true, { rockets: stateRef.current.missileStock, mines: stateRef.current.mineStock, weapons: stateRef.current.equippedWeapons, fuel: stateRef.current.fuel, bossDefeated: stateRef.current.bossDead, health: stateRef.current.integrity })} className="absolute bottom-5 right-5 py-3 px-8 bg-red-600/20 border-2 border-red-500/40 rounded-xl text-red-500 retro-font text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all pointer-events-auto z-[100] shadow-lg backdrop-blur-md">ABORT MISSION</button>
    </div>
  );
};

export default GameEngine;
