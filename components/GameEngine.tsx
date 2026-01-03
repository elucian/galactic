
// CHECKPOINT: Defender V64.0
// VERSION: V64.0 - Tactical HUD & Immediate Abort
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting } from '../types';
import { audioService } from '../services/audioService';
import { ExtendedShipConfig, SHIPS } from '../constants';

interface GameEngineProps {
  ships: Array<{
    config: ExtendedShipConfig;
    fitting: ShipFitting;
    color: string;
    gunColor: string;
  }>;
  shield: Shield | null;
  difficulty: number;
  onGameOver: (success: boolean, finalScore: number, wasAborted?: boolean) => void;
}

class Enemy {
  x: number; y: number; hp: number; maxHp: number;
  type: 'scout' | 'fighter' | 'heavy';
  config: ExtendedShipConfig;
  lastShot: number = 0;
  color: string;
  evadeX: number = 0; evadeY: number = 0;
  constructor(x: number, y: number, type: 'scout' | 'fighter' | 'heavy', config: ExtendedShipConfig) {
    const hpMap = { scout: 80, fighter: 200, heavy: 600 };
    this.x = x; this.y = y; this.hp = hpMap[type]; this.maxHp = hpMap[type];
    this.type = type;
    this.config = config;
    this.color = type === 'heavy' ? '#ef4444' : (type === 'fighter' ? '#f97316' : '#60a5fa');
  }
}

class Missile {
  x: number; y: number; vx: number; vy: number; target: Enemy | null = null;
  life: number = 240; damage: number = 150;
  constructor(x: number, y: number, vx: number, vy: number) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
  }
}

const GameEngine: React.FC<GameEngineProps> = ({ ships, shield, onGameOver, difficulty }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeShip = ships[0];
  const [stats, setStats] = useState({ 
    hp: 100, 
    sh: shield?.capacity || 0, 
    score: 0, 
    missiles: activeShip.fitting.rocketCount 
  });

  const [touchPos, setTouchPos] = useState({ x: 0, y: 0, active: false });

  const stateRef = useRef({
    px: 0, py: 0,
    hp: 100, sh: shield?.capacity || 0,
    score: 0,
    bullets: [] as any[],
    enemyBullets: [] as any[],
    missiles: [] as Missile[],
    enemies: [] as Enemy[],
    explosions: [] as any[],
    stars: [] as any[],
    keys: new Set<string>(),
    lastFire: 0,
    lastMissile: 0,
    lastSpawn: 0,
    gameActive: true,
    frame: 0,
    touchVector: { x: 0, y: 0 },
    missileStock: activeShip.fitting.rocketCount
  });

  const drawShip = (ctx: CanvasRenderingContext2D, config: ExtendedShipConfig, color: string, x: number, y: number, isThrusting: boolean, rotation: number = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(0.5, 0.5);
    ctx.translate(-50, -50);
    const { wingStyle, engines: engineCount, hullShapeType } = config;
    const drawEngine = (ex: number, ey: number) => {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.roundRect(ex - 12, ey - 10, 24, 25, 4); ctx.fill();
      if (isThrusting) {
        ctx.fillStyle = '#f97316';
        ctx.globalAlpha = 0.6 + Math.random() * 0.4;
        ctx.beginPath(); ctx.moveTo(ex - 8, ey + 15); ctx.lineTo(ex + 8, ey + 15); ctx.lineTo(ex, ey + 45 + Math.random() * 20); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }
    };
    if (engineCount === 1) drawEngine(50, 80);
    else if (engineCount === 2) { drawEngine(25, 75); drawEngine(75, 75); }
    else { drawEngine(20, 75); drawEngine(50, 85); drawEngine(80, 75); }
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    if (wingStyle === 'delta') { ctx.moveTo(35, 40); ctx.lineTo(5, 85); ctx.lineTo(50, 75); ctx.moveTo(65, 40); ctx.lineTo(95, 85); ctx.lineTo(50, 75); }
    else { ctx.ellipse(50, 60, 48, 18, 0, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    if (hullShapeType === 'triangle') { ctx.moveTo(50, 10); ctx.lineTo(80, 85); ctx.lineTo(20, 85); }
    else { ctx.roundRect(30, 15, 40, 75, 12); }
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.ellipse(50, (hullShapeType === 'triangle' ? 58 : 38), 9, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (stateRef.current.px === 0) {
        stateRef.current.px = canvas.width / 2;
        stateRef.current.py = canvas.height * 0.85;
      }
    };
    window.addEventListener('resize', resize);
    resize();
    stateRef.current.stars = Array.from({ length: 200 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      s: Math.random() * 2,
      v: 2 + Math.random() * 6
    }));
    
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      if (isDown) stateRef.current.keys.add(e.code);
      else stateRef.current.keys.delete(e.code);
      if (isDown && e.code === 'Escape') {
        stateRef.current.gameActive = false;
        onGameOver(false, stateRef.current.score, true);
      }
      if (isDown && e.code === 'Tab') {
        e.preventDefault(); 
        fireMissile();
      }
    };
    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));

    const fireMissile = () => {
      const s = stateRef.current;
      if (s.missileStock > 0 && Date.now() - s.lastMissile > 500) {
        s.missileStock--;
        setStats(p => ({ ...p, missiles: s.missileStock }));
        const m = new Missile(s.px, s.py - 40, (Math.random() - 0.5) * 4, -8);
        s.missiles.push(m);
        audioService.playWeaponFire('missile');
        s.lastMissile = Date.now();
      }
    };

    let anim: number;
    const loop = () => {
      const s = stateRef.current;
      if (!s.gameActive) return;
      s.frame++;
      const pSpeed = 9;
      
      if (s.keys.has('KeyW') || s.keys.has('ArrowUp')) s.py -= pSpeed;
      if (s.keys.has('KeyS') || s.keys.has('ArrowDown')) s.py += pSpeed;
      if (s.keys.has('KeyA') || s.keys.has('ArrowLeft')) s.px -= pSpeed;
      if (s.keys.has('KeyD') || s.keys.has('ArrowRight')) s.px += pSpeed;
      if (s.touchVector.x !== 0 || s.touchVector.y !== 0) {
        s.px += s.touchVector.x * pSpeed;
        s.py += s.touchVector.y * pSpeed;
      }
      s.px = Math.max(30, Math.min(canvas.width - 30, s.px));
      s.py = Math.max(30, Math.min(canvas.height - 30, s.py));

      if ((s.keys.has('Space') || s.keys.has('KeyS')) && Date.now() - s.lastFire > 110) {
        const gc = activeShip.config.defaultGuns;
        if (gc >= 2) {
          s.bullets.push({ x: s.px - 18, y: s.py - 35, vy: -18, damage: 40 });
          s.bullets.push({ x: s.px + 18, y: s.py - 35, vy: -18, damage: 40 });
        } else s.bullets.push({ x: s.px, y: s.py - 35, vy: -18, damage: 40 });
        audioService.playWeaponFire('cannon');
        s.lastFire = Date.now();
      }

      s.missiles.forEach((m, idx) => {
        if (!m.target || m.target.hp <= 0) {
          let c = null; let md = 3000;
          s.enemies.forEach(en => {
            const d = Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2);
            if (d < md) { md = d; c = en; }
          });
          m.target = c;
        }
        if (m.target) {
          const dx = m.target.x - m.x, dy = m.target.y - m.y, dist = Math.sqrt(dx*dx + dy*dy);
          m.vx += (dx/dist) * 1.2; m.vy += (dy/dist) * 1.2;
          const sp = Math.sqrt(m.vx*m.vx + m.vy*m.vy);
          if (sp > 16) { m.vx = (m.vx/sp)*16; m.vy = (m.vy/sp)*16; }
        } else m.vy -= 0.5;
        m.x += m.vx; m.y += m.vy; m.life--;
        if (m.life <= 0) s.missiles.splice(idx, 1);
        s.enemies.forEach((en, ei) => {
          if (Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 45) {
            en.hp -= m.damage; s.explosions.push({ x: m.x, y: m.y, life: 1.2 });
            audioService.playExplosion(0, 0.8); s.missiles.splice(idx, 1);
            if (en.hp <= 0) { s.enemies.splice(ei, 1); s.score += 300; setStats(p => ({ ...p, score: s.score })); }
          }
        });
      });

      s.enemies.forEach((en, i) => {
        const nm = s.missiles.find(m => Math.sqrt((m.x - en.x)**2 + (m.y - en.y)**2) < 220);
        if (nm) { const sx = en.x - nm.x; en.evadeX = (sx / (Math.abs(sx) || 1)) * (6 + difficulty * 0.5); en.y += 1.5; }
        else { en.evadeX *= 0.95; en.y += 3.5 + (difficulty * 0.2); }
        en.x += en.evadeX;
        if (en.y > canvas.height + 150) s.enemies.splice(i, 1);
        if (en.y > 50 && Date.now() - en.lastShot > 2500 / Math.sqrt(difficulty)) {
          if (en.config.defaultGuns >= 2) { s.enemyBullets.push({ x: en.x - 14, y: en.y + 35, vy: 8 + difficulty }); s.enemyBullets.push({ x: en.x + 14, y: en.y + 35, vy: 8 + difficulty }); }
          else s.enemyBullets.push({ x: en.x, y: en.y + 35, vy: 8 + difficulty });
          en.lastShot = Date.now();
        }
      });

      s.stars.forEach(st => { st.y += st.v; if (st.y > canvas.height) st.y = 0; });
      if (Date.now() - s.lastSpawn > 1600 / Math.sqrt(difficulty)) {
        const types: ('scout' | 'fighter' | 'heavy')[] = ['scout', 'fighter', 'heavy'];
        const t = types[Math.min(2, Math.floor(Math.random() * (difficulty > 3 ? 3 : 2)))];
        let cfg = SHIPS[Math.floor(Math.random() * SHIPS.length)];
        s.enemies.push(new Enemy(Math.random() * (canvas.width - 100) + 50, -100, t, cfg));
        s.lastSpawn = Date.now();
      }

      s.bullets.forEach((b, bi) => {
        b.y += b.vy; if (b.y < -100) s.bullets.splice(bi, 1);
        s.enemies.forEach((en, ei) => {
          if (Math.abs(b.x - en.x) < 40 && Math.abs(b.y - en.y) < 40) {
            en.hp -= b.damage; s.bullets.splice(bi, 1);
            if (en.hp <= 0) { s.explosions.push({ x: en.x, y: en.y, life: 1.0 }); audioService.playExplosion(0, 0.6); s.enemies.splice(ei, 1); s.score += 150; setStats(p => ({ ...p, score: s.score })); }
          }
        });
      });

      s.enemyBullets.forEach((eb, ebi) => {
        eb.y += eb.vy; if (eb.y > canvas.height + 100) s.enemyBullets.splice(ebi, 1);
        if (Math.abs(eb.x - s.px) < 32 && Math.abs(eb.y - s.py) < 32) {
          s.enemyBullets.splice(ebi, 1);
          if (s.sh > 0) s.sh -= 35; else s.hp -= 20;
          setStats(p => ({ ...p, hp: Math.max(0, s.hp), sh: Math.max(0, s.sh), score: s.score, missiles: s.missileStock }));
          audioService.playShieldHit();
        }
      });

      s.explosions.forEach((ex, i) => { ex.life -= 0.05; if (ex.life <= 0) s.explosions.splice(i, 1); });
      if (s.hp <= 0) { s.gameActive = false; onGameOver(false, s.score); return; }
      if (s.score >= 5000 + (difficulty * 5000)) { s.gameActive = false; onGameOver(true, s.score); return; }

      ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff'; s.stars.forEach(st => ctx.fillRect(st.x, st.y, st.s, st.s));
      s.enemies.forEach(en => drawShip(ctx, en.config, en.color, en.x, en.y, true, Math.PI));
      
      s.missiles.forEach(m => {
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI/2);
        ctx.fillStyle = '#fff'; ctx.fillRect(-4, -10, 8, 20); ctx.fillStyle = '#ef4444'; ctx.fillRect(-4, -12, 8, 5);
        const fSize = 15 + Math.random() * 15; const grad = ctx.createLinearGradient(0, 10, 0, 10 + fSize);
        grad.addColorStop(0, '#f97316'); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(5, 10); ctx.lineTo(0, 10 + fSize); ctx.fill();
        ctx.restore();
      });

      ctx.fillStyle = '#fbbf24'; s.bullets.forEach(b => { ctx.fillRect(b.x - 3, b.y - 15, 6, 25); ctx.fillStyle = 'rgba(251, 191, 36, 0.4)'; ctx.fillRect(b.x - 5, b.y - 5, 10, 30); ctx.fillStyle = '#fbbf24'; });
      ctx.fillStyle = '#f87171'; s.enemyBullets.forEach(eb => ctx.fillRect(eb.x - 2, eb.y, 4, 15));
      s.explosions.forEach(ex => { ctx.fillStyle = `rgba(255, 165, 0, ${ex.life})`; ctx.beginPath(); ctx.arc(ex.x, ex.y, (1 - ex.life) * 120, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(255, 255, 255, ${ex.life * 0.5})`; ctx.beginPath(); ctx.arc(ex.x, ex.y, (1 - ex.life) * 60, 0, Math.PI * 2); ctx.fill(); });
      
      drawShip(ctx, activeShip.config, activeShip.color, s.px, s.py, true, 0);
      if (s.sh > 0) { ctx.strokeStyle = '#38bdf8'; ctx.setLineDash([8, 4]); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.px, s.py, 60, 0, Math.PI * 2); ctx.stroke(); }
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); };
  }, [onGameOver, difficulty, ships, activeShip]);

  const handleJoystick = (e: React.TouchEvent) => {
    const t = e.touches[0]; const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const nx = (t.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const ny = (t.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    stateRef.current.touchVector = { x: nx, y: ny };
    setTouchPos({ x: t.clientX - rect.left - rect.width/2, y: t.clientY - rect.top - rect.height/2, active: true });
  };

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* HUD - REPOSITIONED TO BOTTOM PANEL */}
      <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-between items-end pointer-events-none z-30 bg-gradient-to-t from-black/80 to-transparent">
        <div className="space-y-4">
           <div className="flex items-center gap-4">
             <div className="retro-font text-[10px] text-emerald-500 uppercase w-12">HULL</div>
             <div className="w-64 h-2.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden shadow-inner">
               <div className="h-full bg-emerald-500 shadow-[0_0_15px_#10b981] transition-all duration-300" style={{ width: `${stats.hp}%` }} />
             </div>
           </div>
           {shield && (
             <div className="flex items-center gap-4">
               <div className="retro-font text-[10px] text-blue-500 uppercase w-12">CORE</div>
               <div className="w-64 h-2.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden shadow-inner">
                 <div className="h-full bg-blue-500 shadow-[0_0_15px_#3b82f6] transition-all duration-300" style={{ width: `${(stats.sh / shield.capacity) * 100}%` }} />
               </div>
             </div>
           )}
           <div className="flex items-center gap-4">
             <div className="retro-font text-[10px] text-red-500 uppercase w-12">MSL</div>
             <div className="flex gap-1.5">
               {Array.from({ length: Math.min(10, stats.missiles) }).map((_, i) => (
                 <div key={i} className="w-2 h-4 bg-red-600 rounded-sm shadow-[0_0_5px_rgba(220,38,38,0.5)]" />
               ))}
               {stats.missiles > 10 && <span className="text-[10px] text-red-500 font-black">+{stats.missiles - 10}</span>}
             </div>
           </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
           <div className="retro-font text-[32px] text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] tabular-nums">{stats.score.toLocaleString()}</div>
           <button onClick={() => { stateRef.current.gameActive = false; onGameOver(false, stateRef.current.score, true); }} className="pointer-events-auto px-6 py-2 bg-red-950/40 border-2 border-red-500/60 text-red-500 retro-font text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all rounded shadow-lg">ABORT [ESC]</button>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-between p-12 pb-32">
         <div 
           className="pointer-events-auto w-40 h-40 rounded-full border-4 border-emerald-500/20 bg-black/40 backdrop-blur-md relative"
           onTouchMove={handleJoystick}
           onTouchEnd={() => { stateRef.current.touchVector = { x: 0, y: 0 }; setTouchPos({ x: 0, y: 0, active: false }); }}
         >
           <div className="absolute w-16 h-16 bg-emerald-500/80 rounded-full border-2 border-white/40 shadow-[0_0_20px_rgba(16,185,129,0.4)]" style={{ left: `calc(50% + ${Math.min(60, Math.max(-60, touchPos.x))}px)`, top: `calc(50% + ${Math.min(60, Math.max(-60, touchPos.y))}px)`, transform: 'translate(-50%, -50%)' }} />
         </div>

         <div className="flex gap-8 pointer-events-auto items-end">
            <div className="flex flex-col items-center gap-2">
              <span className="retro-font text-[8px] text-red-500/60">MISSILE</span>
              <button onPointerDown={() => { const s = stateRef.current; if (s.missileStock > 0 && Date.now() - s.lastMissile > 500) { s.missileStock--; setStats(p => ({ ...p, missiles: s.missileStock })); s.missiles.push(new Missile(s.px, s.py - 40, (Math.random()-0.5)*4, -8)); audioService.playWeaponFire('missile'); s.lastMissile = Date.now(); } }} className="w-20 h-20 rounded-2xl bg-red-600/20 border-2 border-red-500 text-red-500 retro-font text-[12px] active:bg-red-600 active:text-white transition-all shadow-lg active:scale-90">TAB</button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="retro-font text-[8px] text-emerald-500/60">CANNON</span>
              <button onPointerDown={() => stateRef.current.keys.add('KeyS')} onPointerUp={() => stateRef.current.keys.delete('KeyS')} className="w-24 h-24 rounded-full bg-emerald-600/20 border-2 border-emerald-500 text-emerald-500 retro-font text-[14px] active:bg-emerald-600 active:text-white transition-all shadow-xl active:scale-90">S</button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default GameEngine;
