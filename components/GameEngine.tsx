
// CHECKPOINT: Defender V79.3
// VERSION: V79.3 - Tactical Combat Engine Fix
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, Weapon } from '../types';
import { audioService } from '../services/audioService';
import { ExtendedShipConfig, SHIPS, WEAPONS } from '../constants';

interface GameEngineProps {
  ships: Array<{
    config: ExtendedShipConfig;
    fitting: ShipFitting;
    color: string;
    gunColor: string;
  }>;
  shield: Shield | null;
  secondShield?: Shield | null;
  difficulty: number;
  onGameOver: (success: boolean, finalScore: number, wasAborted?: boolean, newAmmo?: { rockets: number, mines: number }) => void;
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; type: 'fire' | 'smoke' | 'spark' | 'debris';
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
  x: number; y: number; vy: number = 0.5; type: 'ammo';
  constructor(x: number, y: number) { this.x = x; this.y = y; this.type = 'ammo'; }
}

const GameEngine: React.FC<GameEngineProps> = ({ ships, shield, secondShield, onGameOver, difficulty }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeShip = ships[0];
  const maxEnergy = activeShip.config.maxEnergy;
  const currentFuel = activeShip.fitting.fuel;
  const hasFuel = currentFuel > 0;

  const [stats, setStats] = useState({ 
    hp: 100, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, energy: maxEnergy,
    score: 0, missiles: activeShip.fitting.rocketCount, mines: activeShip.fitting.mineCount,
    boss: null as { hp: number, maxHp: number, sh: number, maxSh: number } | null
  });

  const stateRef = useRef({
    px: 0, py: 0, hp: 100, sh1: shield?.capacity || 0, sh2: secondShield?.capacity || 0, energy: maxEnergy, score: 0,
    bullets: [] as any[], enemyBullets: [] as any[], missiles: [] as Missile[], mines: [] as Mine[], 
    enemies: [] as Enemy[], particles: [] as Particle[], stars: [] as any[], gifts: [] as Gift[],
    keys: new Set<string>(), lastFire: 0, lastMissile: 0, lastMine: 0, lastSpawn: 0, gameActive: true, frame: 0,
    missileStock: activeShip.fitting.rocketCount, mineStock: activeShip.fitting.mineCount,
    bossSpawned: false, bossDead: false, shake: 0
  });

  const createExplosion = (x: number, y: number, isBoss: boolean = false) => {
    const s = stateRef.current;
    const count = isBoss ? 100 : 30;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = isBoss ? Math.random() * 14 : Math.random() * 7;
      s.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1.0 + Math.random() * 0.5, size: Math.random() * (isBoss ? 10 : 5) + 2,
        color: isBoss ? (Math.random() > 0.4 ? '#f97316' : '#ffffff') : (Math.random() > 0.7 ? '#ffffff' : '#f59e0b'),
        type: 'fire'
      });
      if (isBoss) {
        s.particles.push({
          x, y, vx: Math.cos(angle) * (speed * 0.4), vy: Math.sin(angle) * (speed * 0.4),
          life: 2.0, size: Math.random() * 25 + 15,
          color: 'rgba(50, 50, 50, 0.4)',
          type: 'smoke'
        });
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
    const s = stateRef.current; s.shake = 60;
    for (let i = 0; i < 45; i++) {
      setTimeout(() => {
        const ex = bx + (Math.random() - 0.5) * 450;
        const ey = by + (Math.random() - 0.5) * 450;
        createExplosion(ex, ey, true);
        audioService.playExplosion(0, 2.2);
        s.shake = 35;
      }, i * 65);
    }
    setTimeout(() => { s.gifts.push(new Gift(bx, by)); }, 3600);
  };

  const drawShip = (ctx: CanvasRenderingContext2D, config: ExtendedShipConfig, color: string, x: number, y: number, isThrusting: boolean, rotation: number = 0) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(0.5, 0.5); ctx.translate(-50, -50);
    const { engines: engineCount, hullShapeType, wingStyle } = config;
    const drawEngine = (ex: number, ey: number) => {
      ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.roundRect(ex - 12, ey - 10, 24, 25, 4); ctx.fill();
      if (isThrusting) { 
        ctx.fillStyle = '#f97316'; ctx.globalAlpha = 0.6 + Math.random() * 0.4; 
        ctx.beginPath(); ctx.moveTo(ex - 8, ey + 15); ctx.lineTo(ex + 8, ey + 15); ctx.lineTo(ex, ey + 45 + Math.random() * 20); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; 
      }
    };
    if (engineCount === 1) drawEngine(50, 82); else if (engineCount === 2) { drawEngine(25, 75); drawEngine(75, 75); }
    ctx.fillStyle = '#334155'; ctx.beginPath();
    if (wingStyle === 'delta') { ctx.moveTo(35, 40); ctx.lineTo(5, 85); ctx.lineTo(50, 75); ctx.moveTo(65, 40); ctx.lineTo(95, 85); ctx.lineTo(50, 75); } else { ctx.ellipse(50, 60, 48, 18, 0, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = color; ctx.beginPath();
    if (hullShapeType === 'triangle') { ctx.moveTo(50, 10); ctx.lineTo(80, 85); ctx.lineTo(20, 85); } else { ctx.roundRect(30, 15, 40, 75, 12); }
    ctx.fill();
    ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.ellipse(50, (hullShapeType === 'triangle' ? 58 : 38), 9, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; if (stateRef.current.px === 0) { stateRef.current.px = canvas.width / 2; stateRef.current.py = canvas.height * 0.85; } };
    window.addEventListener('resize', resize); resize();
    stateRef.current.stars = Array.from({ length: 250 }).map(() => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, s: Math.random() * 2, v: 2.5 + Math.random() * 6.5 }));
    
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      if (isDown) stateRef.current.keys.add(e.code); else stateRef.current.keys.delete(e.code);
      if (isDown && e.code === 'Escape') { stateRef.current.gameActive = false; onGameOver(false, stateRef.current.score, true); }
      if (isDown && e.code === 'Tab') { e.preventDefault(); if (stateRef.current.missileStock > 0) { stateRef.current.missileStock--; setStats(p => ({ ...p, missiles: stateRef.current.missileStock })); stateRef.current.missiles.push(new Missile(stateRef.current.px, stateRef.current.py - 40, (Math.random() - 0.5) * 5, -8)); audioService.playWeaponFire('missile'); } }
      if (isDown && e.code === 'CapsLock') { e.preventDefault(); if (stateRef.current.mineStock > 0) { stateRef.current.mineStock--; setStats(p => ({ ...p, mines: stateRef.current.mineStock })); stateRef.current.mines.push(new Mine(stateRef.current.px, stateRef.current.py)); audioService.playWeaponFire('mine'); } }
    };
    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));

    let anim: number;
    const loop = () => {
      const s = stateRef.current; if (!s.gameActive) return; s.frame++; const pSpeed = 9.5;
      const isMoving = s.keys.has('KeyW') || s.keys.has('ArrowUp') || s.keys.has('KeyS') || s.keys.has('ArrowDown') || s.keys.has('KeyA') || s.keys.has('ArrowLeft') || s.keys.has('KeyD') || s.keys.has('ArrowRight');
      
      if (hasFuel) {
        if (s.keys.has('KeyW') || s.keys.has('ArrowUp')) s.py -= pSpeed;
        if (s.keys.has('KeyS') || s.keys.has('ArrowDown')) s.py += pSpeed;
      }
      if (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) s.px -= pSpeed;
      if (s.keys.has('KeyD') || s.keys.has('ArrowRight')) s.px += pSpeed;
      s.px = Math.max(35, Math.min(canvas.width - 35, s.px)); s.py = Math.max(35, Math.min(canvas.height - 35, s.py));
      s.energy = Math.min(maxEnergy, s.energy + 0.4);
      if (shield && s.sh1 < shield.capacity && s.energy > 5) { s.sh1 += 0.5; s.energy -= 0.2; }
      if (secondShield && s.sh2 < secondShield.capacity && s.energy > 5) { s.sh2 += 0.5; s.energy -= 0.2; }

      if ((s.keys.has('Space') || s.keys.has('KeyF')) && Date.now() - s.lastFire > 110 && s.energy > 12 && activeShip.fitting.weapons.length > 0) {
        activeShip.fitting.weapons.forEach((w, idx) => {
          const weaponDef = WEAPONS.find(wd => wd.id === w.id); if (!weaponDef) return;
          const xOff = activeShip.fitting.weapons.length > 1 ? (idx === 0 ? -18 : 18) : 0;
          s.bullets.push({ x: s.px + xOff, y: s.py - 35, vy: -18.5, damage: weaponDef.damage });
        });
        s.energy -= 2.9 * activeShip.fitting.weapons.length;
        audioService.playWeaponFire('cannon'); s.lastFire = Date.now();
      }

      if (s.score >= difficulty * 10000 && !s.bossSpawned) {
        s.bossSpawned = true; s.enemies.push(new Enemy(canvas.width/2, -300, 'boss', SHIPS[SHIPS.length-1], difficulty));
      }

      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.025;
        if (p.type === 'smoke') p.size += 0.3;
        if (p.life <= 0) s.particles.splice(i, 1);
      }

      for (let i = s.missiles.length - 1; i >= 0; i--) {
        const m = s.missiles[i];
        if (!m.target || m.target.hp <= 0) {
          let b = null; let md = 15000;
          s.enemies.forEach(en => { const d = Math.sqrt((m.x-en.x)**2+(m.y-en.y)**2); if(d<md){md=d; b=en;} }); m.target = b;
        }
        if (m.target) {
          const dx = m.target.x - m.x, dy = m.target.y - m.y, d = Math.sqrt(dx*dx+dy*dy);
          m.vx += (dx/d)*2.5; m.vy += (dy/d)*2.5;
          const sp = Math.sqrt(m.vx*m.vx+m.vy*m.vy); if(sp>20){m.vx=(m.vx/sp)*20; m.vy=(m.vy/sp)*20;}
        } else m.vy -= 0.75;
        m.x += m.vx; m.y += m.vy; m.life--;
        if (m.life <= 0 || m.y < -600 || m.x < -600 || m.x > canvas.width + 600) s.missiles.splice(i, 1);
        else {
          for (let j = s.enemies.length - 1; j >= 0; j--) {
            const en = s.enemies[j];
            if (Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 60) {
              applyDamageToEnemy(en, m.damage); s.missiles.splice(i, 1); createExplosion(m.x, m.y); audioService.playExplosion(0, 1.3);
              if (en.hp <= 0) { if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } s.enemies.splice(j, 1); s.score += 450; }
              break;
            }
          }
        }
      }

      for (let i = s.mines.length - 1; i >= 0; i--) {
        const m = s.mines[i]; m.y += m.vy;
        for (let j = s.enemies.length - 1; j >= 0; j--) {
            const en = s.enemies[j];
            if (Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 70) {
                applyDamageToEnemy(en, m.damage); s.mines.splice(i, 1); createExplosion(m.x, m.y); audioService.playExplosion(0, 1.6);
                if (en.hp <= 0) { if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } s.enemies.splice(j, 1); s.score += 650; }
                break;
            }
        }
        if (m.y < -150) s.mines.splice(i, 1);
      }

      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const en = s.enemies[i];
        if (en.type === 'boss') {
          en.y = Math.min(en.y + 1, 150); en.x = canvas.width/2 + Math.sin(s.frame * 0.02) * (canvas.width * 0.35);
          if (s.frame % 18 === 0) s.enemyBullets.push({ x: en.x + (Math.random()-0.5)*150, y: en.y + 110, vy: 12 + difficulty });
          if (en.sh < en.maxSh) en.sh += 0.3;
        } else { en.y += 4.0 + (difficulty * 0.5); en.x += en.evadeX; en.evadeX *= 0.96; }
        if (en.y > canvas.height + 200) { s.enemies.splice(i, 1); continue; }
        if (en.y > 50 && Date.now() - en.lastShot > 1700 / Math.sqrt(difficulty)) {
          s.enemyBullets.push({ x: en.x, y: en.y + 35, vy: 7.5 + difficulty }); en.lastShot = Date.now();
        }
      }

      s.stars.forEach(st => { st.y += st.v; if (st.y > canvas.height) st.y = 0; });
      if (!s.bossSpawned && Date.now() - s.lastSpawn > 1700 / Math.sqrt(difficulty)) {
        s.enemies.push(new Enemy(Math.random() * (canvas.width - 120) + 60, -100, 'fighter', SHIPS[Math.floor(Math.random() * 6)], difficulty));
        s.lastSpawn = Date.now();
      }

      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i]; b.y += b.vy; let hit = false;
        for (let j = s.enemies.length - 1; j >= 0; j--) {
          const en = s.enemies[j];
          if (Math.abs(b.x - en.x) < 55 && Math.abs(b.y - en.y) < 75) {
            applyDamageToEnemy(en, b.damage); hit = true;
            if (en.hp <= 0) { createExplosion(en.x, en.y, en.type==='boss'); if (en.type === 'boss' && !s.bossDead) { s.bossDead = true; spawnBossExplosions(en.x, en.y); } s.enemies.splice(j, 1); s.score += 150; }
            break;
          }
        }
        if (hit || b.y < -150) s.bullets.splice(i, 1);
      }

      for (let i = s.enemyBullets.length - 1; i >= 0; i--) {
        const eb = s.enemyBullets[i]; eb.y += eb.vy;
        if (Math.abs(eb.x - s.px) < 38 && Math.abs(eb.y - s.py) < 38) {
          s.enemyBullets.splice(i, 1); if (s.sh2 > 0) s.sh2 -= 50; else if (s.sh1 > 0) s.sh1 -= 50; else s.hp -= 25;
          audioService.playShieldHit();
        }
        if (eb.y > canvas.height + 150) s.enemyBullets.splice(i, 1);
      }

      if (s.shake > 0) s.shake *= 0.92;
      if (s.hp <= 0) { s.gameActive = false; onGameOver(false, s.score, false, { rockets: s.missileStock, mines: s.mineStock }); return; }
      const currentBoss = s.enemies.find(e => e.type === 'boss');
      setStats({ 
        hp: Math.max(0, s.hp), sh1: Math.max(0, s.sh1), sh2: Math.max(0, s.sh2), energy: s.energy, score: s.score, 
        missiles: s.missileStock, mines: s.mineStock, boss: currentBoss ? { hp: currentBoss.hp, maxHp: currentBoss.maxHp, sh: currentBoss.sh, maxSh: currentBoss.maxSh } : null
      });

      ctx.save(); if (s.shake > 0) ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff'; s.stars.forEach(st => ctx.fillRect(st.x, st.y, st.s, st.s));
      s.enemies.forEach(en => {
        drawShip(ctx, en.config, en.color, en.x, en.y, true, Math.PI);
        if (en.sh > 0) { ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(en.x, en.y, 62, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
      });
      s.particles.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        if (p.type === 'smoke') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); }
        else { ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size); } ctx.globalAlpha = 1.0;
      });
      ctx.fillStyle = '#fbbf24'; s.bullets.forEach(b => ctx.fillRect(b.x - 3, b.y - 15, 6, 25));
      ctx.fillStyle = '#f87171'; s.enemyBullets.forEach(eb => ctx.fillRect(eb.x - 2.5, eb.y, 5, 18));
      
      // GUARANTEED MISSILE DRAWING
      ctx.fillStyle = '#ef4444'; s.missiles.forEach(m => { 
          ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI/2);
          ctx.beginPath(); ctx.roundRect(-4.5, -12, 9, 24, 3); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillRect(-2, 5, 4, 10); ctx.restore();
      });
      // GUARANTEED MINE DRAWING
      s.mines.forEach(m => { 
          ctx.save(); ctx.translate(m.x, m.y);
          ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fillStyle = '#10b981'; ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.strokeStyle = '#064e3b'; ctx.stroke();
          ctx.restore();
      });

      drawShip(ctx, activeShip.config, activeShip.color, s.px, s.py, hasFuel && isMoving, 0);
      if (s.sh1 > 0) { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3.5; ctx.setLineDash([14, 8]); ctx.beginPath(); ctx.arc(s.px, s.py, 72, Math.PI*1.1, Math.PI*1.9); ctx.stroke(); ctx.setLineDash([]); }
      if (s.sh2 > 0) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 7; ctx.shadowBlur = 25; ctx.globalAlpha = 0.3 + Math.abs(Math.sin(s.frame*0.1))*0.5; ctx.beginPath(); ctx.arc(s.px, s.py, 92, Math.PI*1.1, Math.PI*1.9); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1.0; }
      ctx.restore();
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); };
  }, [onGameOver, difficulty, ships, activeShip, shield, secondShield, maxEnergy, hasFuel]);

  const ep = (stats.energy / maxEnergy) * 100, fp = (currentFuel / 3) * 100, nl = 20, ael = Math.ceil((ep/100)*nl), afl = Math.ceil((fp/100)*nl);
  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-end gap-5 z-50 pointer-events-none">
        <div className="flex flex-col items-center gap-3">
          <div className={`retro-font text-[8px] uppercase font-black ${currentFuel<1 ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>FUEL</div>
          <div className="flex flex-col-reverse gap-1.5 p-2 bg-zinc-950/70 border border-zinc-800/40 rounded-lg backdrop-blur-md">
            {Array.from({ length: nl }).map((_, i) => (<div key={i} className={`w-7 h-2 rounded-sm ${i < afl ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: i < afl ? (currentFuel<1?'#ef4444':'#3b82f6') : '#18181b', color: currentFuel<1?'#ef4444':'#3b82f6' }} />))}
          </div>
          <div className={`retro-font text-[9px] font-black ${currentFuel<1 ? 'text-red-500' : 'text-zinc-500'}`}>{currentFuel} U</div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className={`retro-font text-[8px] uppercase font-black ${ep<25 ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`}>PWR</div>
          <div className="flex flex-col-reverse gap-1.5 p-2 bg-zinc-950/70 border border-zinc-800/40 rounded-lg backdrop-blur-md">
            {Array.from({ length: nl }).map((_, i) => { const r = i/nl, c = ep<25 ? '#ef4444' : (r<0.3 ? '#ef4444' : (r<0.6 ? '#f59e0b' : '#10b981')); return (<div key={i} className={`w-7 h-2 rounded-sm ${i < ael ? 'shadow-[0_0_8px_currentColor]' : 'opacity-10'}`} style={{ backgroundColor: i < ael ? c : '#18181b', color: c }} />); })}
          </div>
          <div className={`retro-font text-[9px] font-black ${ep<25 ? 'text-red-500' : 'text-zinc-500'}`}>{Math.floor(ep)}%</div>
        </div>
      </div>
      {stats.boss && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[450px] flex flex-col items-center gap-2 z-50 pointer-events-none bg-black/50 backdrop-blur-md p-5 rounded-xl border border-white/10 shadow-2xl">
          <div className="retro-font text-[10px] text-purple-400 uppercase tracking-[0.5em] font-black">UNKNOWN SIGNATURE DETECTED</div>
          <div className="w-full flex flex-col gap-2 mt-3">
            {stats.boss.sh > 0 && (<div className="w-full h-3 bg-zinc-900 border border-purple-900/40 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-purple-500 shadow-[0_0_15px_#a855f7]" style={{ width: `${(stats.boss.sh/stats.boss.maxSh)*100}%` }} /></div>)}
            <div className="w-full h-3.5 bg-zinc-900 border border-red-900/40 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-red-600 shadow-[0_0_15px_#dc2626]" style={{ width: `${(stats.boss.hp/stats.boss.maxHp)*100}%` }} /></div>
          </div>
        </div>
      )}
      <div className="absolute top-0 left-0 p-10 flex flex-col gap-5 pointer-events-none z-30">
        <div className="flex items-center gap-5"><div className="retro-font text-[9px] text-emerald-500 uppercase w-14 font-black">Hull</div><div className="w-64 h-3 bg-zinc-900/70 border border-zinc-800/40 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 shadow-[0_0_12px_#10b981]" style={{ width: `${stats.hp}%` }} /></div></div>
        {shield && <div className="flex items-center gap-5"><div className="retro-font text-[9px] uppercase w-14 font-black" style={{ color: shield.color }}>{shield.name.split(' ')[0]}</div><div className="w-64 h-3 bg-zinc-900/70 border border-zinc-800/40 rounded-full overflow-hidden"><div className="h-full shadow-[0_0_12px_currentColor]" style={{ width: `${(stats.sh1/shield.capacity)*100}%`, backgroundColor: shield.color }} /></div></div>}
      </div>
      <div className="absolute top-0 right-0 p-10 text-right pointer-events-none z-30 flex flex-col gap-3"><div className="retro-font text-[36px] text-white tabular-nums drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">{stats.score.toLocaleString()}</div><div className="retro-font text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-black opacity-60">Sector Mastery</div></div>
      <div className="absolute bottom-10 left-10 flex flex-col gap-6 pointer-events-none p-7 bg-transparent rounded-2xl border border-white/5 min-w-[280px] backdrop-blur-[2px]">
         <div className="flex flex-col gap-4">
           <span className="retro-font text-[9px] text-red-500/80 uppercase tracking-[0.3em] font-black">Missiles</span>
           <div className="grid grid-cols-10 gap-2.5 w-fit">
             {Array.from({ length: stats.missiles }).map((_, i) => (<div key={i} className="w-3 h-3 rounded-sm bg-red-500 opacity-70 shadow-[0_0_8px_#ef4444]" />))}
           </div>
         </div>
         <div className="flex flex-col gap-4">
           <span className="retro-font text-[9px] text-emerald-500/80 uppercase tracking-[0.3em] font-black">Mines</span>
           <div className="grid grid-cols-10 gap-2.5 w-fit">
             {Array.from({ length: stats.mines }).map((_, i) => (<div key={i} className="w-3 h-3 rounded-full bg-emerald-500 opacity-70 shadow-[0_0_8px_#10b981]" />))}
           </div>
         </div>
      </div>
    </div>
  );
};

export default GameEngine;
