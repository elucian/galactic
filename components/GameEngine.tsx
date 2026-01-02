
// CHECKPOINT: Defender V7.8
// VERSION: V7.8 - Sector-Specific AI & Aesthetics
import React, { useRef, useEffect, useState } from 'react';
import { ShipConfig, Weapon, Shield, MissionType, WeaponType, QuadrantType } from '../types';
import { audioService } from '../services/audioService';

interface GameEngineProps {
  ship: ShipConfig;
  weapons: (Weapon & { count: number })[];
  shield: Shield | null;
  missionType: MissionType;
  difficulty: number;
  quadrant: QuadrantType;
  onGameOver: (success: boolean) => void;
  isFullScreen: boolean;
  playerColor: string;
}

const NATIVE_WIDTH = 600;
const NATIVE_HEIGHT = 640;

class Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
  constructor(x: number, y: number, color: string, vx?: number, vy?: number, size?: number) {
    this.x = x; this.y = y;
    this.vx = vx ?? (Math.random() - 0.5) * 4;
    this.vy = vy ?? (Math.random() - 0.5) * 4;
    this.life = 1.0;
    this.color = color;
    this.size = size ?? 2;
  }
  update() { this.x += this.vx; this.y += this.vy; this.life -= 0.03; }
}

class Entity {
  x: number; y: number; w: number; h: number; hp: number; maxHp: number;
  constructor(x: number, y: number, w: number, h: number, hp: number) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.hp = hp; this.maxHp = hp;
  }
  getBounds() { return { x: this.x - this.w/2, y: this.y - this.h/2, w: this.w, h: this.h }; }
}

class Bullet extends Entity {
  vx: number; vy: number; damage: number; color: string; isEnemy: boolean;
  type: WeaponType;
  target: Enemy | null = null;
  angle: number;
  speed: number;

  constructor(x: number, y: number, vx: number, vy: number, damage: number, color: string, type: WeaponType, isEnemy = false, target: Enemy | null = null) {
    super(x, y, 4, 12, 1);
    this.vx = vx; this.vy = vy; this.damage = damage; this.color = color; this.isEnemy = isEnemy;
    this.type = type;
    this.target = target;
    this.speed = Math.hypot(vx, vy);
    this.angle = Math.atan2(vy, vx);
  }

  update() {
    if (this.type === WeaponType.MISSILE && this.target && this.target.hp > 0) {
      const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      let diff = targetAngle - this.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.angle += diff * 0.12;
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
    }
    this.x += this.vx;
    this.y += this.vy;
  }
}

class Enemy extends Entity {
  type: 'scout' | 'interceptor' | 'bomber' | 'rock';
  vx: number = 0;
  vy: number = 2;
  fireTimer: number = 0;
  startX: number;
  sineOffset: number = Math.random() * Math.PI * 2;
  rotation: number = Math.random() * Math.PI * 2;
  rotationSpeed: number = (Math.random() - 0.5) * 0.04;
  vertices: { x: number, y: number }[] = [];
  color: string = "#27272a";
  quadrant: QuadrantType;

  constructor(x: number, y: number, difficulty: number, quadrant: QuadrantType, isRock = false) {
    const types: ('scout' | 'interceptor' | 'bomber')[] = ['scout', 'interceptor', 'bomber'];
    const type = isRock ? 'rock' : types[Math.floor(Math.random() * 3)];
    const hp = type === 'rock' ? 80 * difficulty : (type === 'bomber' ? 60 * difficulty : (type === 'interceptor' ? 30 * difficulty : 20 * difficulty));
    const size = type === 'rock' ? 40 + Math.random() * 40 : (type === 'bomber' ? 45 : 30);
    super(x, y, size, size, hp);
    this.type = type;
    this.startX = x;
    this.quadrant = quadrant;
    this.vy = type === 'rock' ? 1.5 + Math.random() * 1.5 : (type === 'bomber' ? 0.8 : (type === 'interceptor' ? 3.0 : 2.0));
    this.fireTimer = Math.random() * 100;

    if (type === 'rock') {
      const vCount = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < vCount; i++) {
        const angle = (i / vCount) * Math.PI * 2;
        const r = (size / 2) * (0.6 + Math.random() * 0.7);
        this.vertices.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      }
      const shades = ["#18181b", "#27272a", "#3f3f46", "#451a03", "#1e1b4b"];
      this.color = shades[Math.floor(Math.random() * shades.length)];
    }
  }

  update(others: Enemy[], difficulty: number): Bullet | null {
    let firedBullet = null;

    // Separation Steering Logic (Avoid collisions)
    // Only non-alfa ships or non-formation ships really need side-steering if users want it fair
    // But the request says ALFA ships do NOT move side to side, so we skip steering logic for ALFA.
    if (this.type !== 'rock' && this.quadrant !== QuadrantType.ALFA) {
      let sepX = 0;
      let count = 0;
      others.forEach(other => {
        if (other === this || other.type === 'rock') return;
        const dist = Math.hypot(this.x - other.x, this.y - other.y);
        const minDist = (this.w + other.w) * 0.8;
        if (dist < minDist && dist > 0) {
          sepX += (this.x - other.x) / dist;
          count++;
        }
      });
      if (count > 0) {
        this.vx += (sepX / count) * 0.2;
      }
      this.vx *= 0.95; 
      this.x += this.vx;
      this.x = Math.max(this.w / 2, Math.min(NATIVE_WIDTH - this.w / 2, this.x));
    }

    // Level-specific behavior
    if (this.type === 'rock') {
      this.rotation += this.rotationSpeed;
    } else if (this.type === 'interceptor') {
      // Linear only in ALFA or low difficulty
      if (difficulty > 3 && this.quadrant !== QuadrantType.ALFA) {
        this.x = this.startX + Math.sin(this.y * 0.05 + this.sineOffset) * 60;
      }
    } else if (this.type === 'bomber') {
      this.fireTimer++;
      const fireThreshold = this.quadrant === QuadrantType.ALFA ? 300 : 150 + (10 / (difficulty || 1)) * 100;
      if (this.fireTimer > fireThreshold) {
        this.fireTimer = 0;
        firedBullet = new Bullet(this.x, this.y, 0, 5, 10, '#f87171', WeaponType.PROJECTILE, true);
        const pan = (this.x / NATIVE_WIDTH) * 2 - 1;
        audioService.playWeaponFire('cannon', pan);
      }
    }
    
    this.y += this.vy;
    return firedBullet;
  }
}

const GameEngine: React.FC<GameEngineProps> = ({ ship, weapons, shield, missionType, difficulty, quadrant, onGameOver, playerColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [playerSh, setPlayerSh] = useState(shield?.capacity || 100); 
  const [bossHp, setBossHp] = useState<number | null>(null);
  const [isAbortDialogOpen, setIsAbortDialogOpen] = useState(false);
  const [displayScale, setDisplayScale] = useState(1);

  const stateRef = useRef({
    px: NATIVE_WIDTH / 2, py: NATIVE_HEIGHT - 100, pvx: 0, pvy: 0,
    mx: NATIVE_WIDTH / 2, my: NATIVE_HEIGHT - 100, useMouse: false,
    bullets: [] as Bullet[], enemies: [] as Enemy[], particles: [] as Particle[],
    stars: [] as { x: number, y: number, speed: number, size: number }[], keys: {} as Record<string, boolean>,
    weaponLastFire: 0, lastEnemy: 0, bossFireTimer: 0,
    gameOver: false, hp: 100, sh: shield?.capacity || 100, maxSh: shield?.capacity || 100,
    shieldFlash: 0, missionProgress: 0, totalToKill: missionType === MissionType.ATTACK ? 20 * difficulty : 40 * difficulty,
    boss: null as Entity | null
  });

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      setDisplayScale(Math.min(clientWidth / NATIVE_WIDTH, clientHeight / NATIVE_HEIGHT, 1.2));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    if (missionType === MissionType.COMET) {
      stateRef.current.boss = new Entity(NATIVE_WIDTH / 2, -150, 100, 60, 8000 * difficulty);
      setBossHp(100);
    }
    for(let i=0; i<100; i++) { stateRef.current.stars.push({ x: Math.random() * NATIVE_WIDTH, y: Math.random() * NATIVE_HEIGHT, speed: 0.5 + Math.random() * 4.5, size: 1 + Math.random() * 2 }); }
  }, [missionType, difficulty]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      if (e.key === 'Escape') { setIsAbortDialogOpen(prev => !prev); return; }
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
      }
      stateRef.current.keys[e.key] = true; 
      stateRef.current.useMouse = false;
    };
    const handleKeyUp = (e: KeyboardEvent) => { stateRef.current.keys[e.key] = false; };
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = NATIVE_WIDTH / rect.width;
      const scaleY = NATIVE_HEIGHT / rect.height;
      stateRef.current.mx = (e.clientX - rect.left) * scaleX;
      stateRef.current.my = (e.clientY - rect.top) * scaleY;
      stateRef.current.useMouse = true;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => { 
      window.removeEventListener('keydown', handleKeyDown); 
      window.removeEventListener('keyup', handleKeyUp); 
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationFrameId: number;

    const damagePlayer = (amount: number, hitShield: boolean = false) => {
      const state = stateRef.current;
      if (hitShield || state.sh > 0) { 
         state.sh -= amount; 
         if (state.sh < 0) { 
           if (!hitShield) state.hp += state.sh; 
           state.sh = 0; 
         } 
         audioService.playShieldHit();
      } else { 
         state.hp -= amount; 
      }
      setPlayerHp(state.hp); setPlayerSh(Math.floor(state.sh));
    };

    const loop = () => {
      const state = stateRef.current;
      if (state.gameOver || isAbortDialogOpen) return;

      // Integrated Controls
      if (state.useMouse) {
        state.px += (state.mx - state.px) * 0.15;
        state.py += (state.my - state.py) * 0.15;
      } else {
        const keys = state.keys;
        const accel = 0.6;
        const drag = 0.9;
        if (keys['w'] || keys['ArrowUp']) state.pvy -= accel;
        if (keys['s'] || keys['ArrowDown']) state.pvy += accel;
        if (keys['a'] || keys['ArrowLeft']) state.pvx -= accel;
        if (keys['d'] || keys['ArrowRight']) state.pvx += accel;
        state.pvx *= drag; state.pvy *= drag;
        state.px += state.pvx; state.py += state.pvy;
      }

      state.px = Math.max(35, Math.min(NATIVE_WIDTH - 35, state.px));
      state.py = Math.max(60, Math.min(NATIVE_HEIGHT - 35, state.py));

      // Firing Default Yellow Energy Beam
      const now = Date.now();
      if (state.keys[' '] && now - state.weaponLastFire > 180) {
        state.bullets.push(new Bullet(state.px, state.py - 30, 0, -14, 45, '#facc15', WeaponType.LASER, false));
        audioService.playWeaponFire('laser');
        state.weaponLastFire = now;
      }

      // Boss logic
      if (state.boss) {
        if (state.boss.y < 160) state.boss.y += 0.4;
        setBossHp(Math.ceil((state.boss.hp / state.boss.maxHp) * 100));
        
        // Alfa Boss Firing (UFO Energy Balls) - Every 10 seconds
        if (quadrant === QuadrantType.ALFA) {
            state.bossFireTimer++;
            if (state.bossFireTimer > 600) { // approx 10s at 60fps
                state.bossFireTimer = 0;
                // Shoot a large ball
                const ball = new Bullet(state.boss.x, state.boss.y + 20, 0, 4, 35, '#a855f7', WeaponType.PROJECTILE, true);
                ball.w = 15; ball.h = 15; // Larger hitbox
                state.bullets.push(ball);
                audioService.playWeaponFire('cannon');
            }
        }
      }

      // Spawn logic
      const spawnRate = missionType === MissionType.COMET ? 400 : (1200 / (difficulty * 0.8));
      const adjustedSpawnRate = quadrant === QuadrantType.ALFA ? spawnRate * 2.5 : spawnRate; // Reduced number of events in Alfa

      if (now - state.lastEnemy > adjustedSpawnRate) {
        if (quadrant === QuadrantType.ALFA) {
           // Formation: 3 ships in a row
           const xCenter = Math.random() * (NATIVE_WIDTH - 120) + 60;
           for (let i = -1; i <= 1; i++) {
             state.enemies.push(new Enemy(xCenter + i * 40, -100, difficulty, quadrant, missionType === MissionType.COMET));
           }
        } else {
           state.enemies.push(new Enemy(Math.random() * (NATIVE_WIDTH - 40) + 20, -100, difficulty, quadrant, missionType === MissionType.COMET));
        }
        state.lastEnemy = now;
      }

      // Collisions & Updates
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i]; b.update();
        if (b.y < -100 || b.y > NATIVE_HEIGHT + 100) { state.bullets.splice(i, 1); continue; }
        
        if (!b.isEnemy) {
          if (state.boss && Math.hypot(b.x - state.boss.x, b.y - state.boss.y) < 50) {
            state.boss.hp -= b.damage; state.bullets.splice(i, 1);
            if (state.boss.hp <= 0) { onGameOver(true); state.gameOver = true; }
            continue;
          }
          for (let j = state.enemies.length - 1; j >= 0; j--) {
            const e = state.enemies[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < e.w/2) {
              e.hp -= b.damage; state.bullets.splice(i, 1);
              if (e.hp <= 0) { state.enemies.splice(j, 1); setScore(s => s + 200); state.missionProgress++; }
              break;
            }
          }
        } else {
          const distToPlayer = Math.hypot(b.x - state.px, b.y - state.py);
          const isFromFront = b.y < state.py;
          const hitbox = b.w > 4 ? b.w : 22; // Boss energy ball has larger hitbox
          if (state.sh > 0 && isFromFront && distToPlayer < 52 && distToPlayer > 35) {
             state.bullets.splice(i, 1);
             damagePlayer(b.damage, true);
             state.shieldFlash = 12;
          } else if (distToPlayer < hitbox) {
             state.bullets.splice(i, 1);
             damagePlayer(b.damage);
          }
        }
      }

      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        const enemyBullet = e.update(state.enemies, difficulty); 
        if (enemyBullet) state.bullets.push(enemyBullet);
        if (Math.hypot(e.x - state.px, e.y - state.py) < 40) { 
          damagePlayer(30); state.enemies.splice(i, 1); 
        } else if (e.y > NATIVE_HEIGHT + 100) {
          state.enemies.splice(i, 1);
        }
      }

      state.stars.forEach(s => { s.y += s.speed; if (s.y > NATIVE_HEIGHT) s.y = -10; });

      if (missionType !== MissionType.COMET && state.missionProgress >= state.totalToKill) { onGameOver(true); state.gameOver = true; }
      if (state.hp <= 0) { onGameOver(false); state.gameOver = true; }

      // Rendering
      ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
      ctx.fillStyle = '#fff';
      state.stars.forEach(s => { ctx.globalAlpha = s.size / 6; ctx.fillRect(s.x, s.y, s.size, s.size); });
      ctx.globalAlpha = 1;

      // Rendering Enemies
      state.enemies.forEach(e => {
        ctx.save(); ctx.translate(e.x, e.y);
        if (quadrant === QuadrantType.ALFA && e.type !== 'rock') {
            // Spherical ships for ALFA
            const grad = ctx.createRadialGradient(-e.w/4, -e.h/4, 2, 0, 0, e.w/2);
            grad.addColorStop(0, '#60a5fa');
            grad.addColorStop(1, '#1e3a8a');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(0, 0, e.w/2, 0, Math.PI*2); ctx.fill();
            // Port holes
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.arc(0, 0, e.w/4, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = e.type === 'rock' ? e.color : '#3b82f6';
            ctx.rotate(Math.PI); ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(-15, -15); ctx.lineTo(15, -15); ctx.fill();
        }
        ctx.restore();
      });

      // Rendering Boss
      if (state.boss) {
        ctx.save();
        ctx.translate(state.boss.x, state.boss.y);
        if (quadrant === QuadrantType.ALFA) {
            // Fix: define localTime for boss lights animation
            const localTime = performance.now() / 1000;
            // UFO Style Boss
            // Main body
            ctx.fillStyle = '#4b5563';
            ctx.beginPath();
            ctx.ellipse(0, 0, 70, 25, 0, 0, Math.PI * 2);
            ctx.fill();
            // Dome
            ctx.fillStyle = 'rgba(147, 197, 253, 0.6)';
            ctx.beginPath();
            ctx.arc(0, -10, 30, Math.PI, 0);
            ctx.fill();
            // Lights
            for(let i=0; i<8; i++) {
                const ang = (i / 8) * Math.PI * 2 + (localTime * 2);
                ctx.fillStyle = i % 2 === 0 ? '#facc15' : '#ef4444';
                ctx.beginPath();
                ctx.arc(Math.cos(ang) * 55, Math.sin(ang) * 15, 3, 0, Math.PI*2);
                ctx.fill();
            }
        } else {
            ctx.fillStyle = '#60a5fa33'; ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
      }

      // Rendering Bullets
      state.bullets.forEach(b => { 
        ctx.save();
        if (b.color === '#facc15') { // Player weapon
          ctx.shadowBlur = 10; ctx.shadowColor = '#facc15';
          ctx.fillStyle = '#fff'; ctx.fillRect(b.x-2, b.y-10, 4, 20);
        } else if (b.color === '#a855f7') { // Boss Energy Ball
          const grad = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.w);
          grad.addColorStop(0, '#fff');
          grad.addColorStop(0.3, '#d8b4fe');
          grad.addColorStop(1, '#a855f7');
          ctx.fillStyle = grad;
          ctx.shadowBlur = 15; ctx.shadowColor = '#a855f7';
          ctx.beginPath(); ctx.arc(b.x, b.y, b.w, 0, Math.PI*2); ctx.fill();
        } else {
          ctx.fillStyle = b.color; ctx.fillRect(b.x-2, b.y-5, 4, 10);
        }
        ctx.restore();
      });
      
      // Default Frontal Shield Rendering
      if (state.sh > 0) {
        ctx.save();
        ctx.translate(state.px, state.py);
        ctx.beginPath();
        ctx.arc(0, 0, 48, Math.PI, 0); 
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.shadowBlur = state.shieldFlash > 0 ? 25 : 12;
        ctx.shadowColor = '#ef4444';
        const grad = ctx.createRadialGradient(0, 0, 32, 0, 0, 48);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0.15)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.stroke();
        if (state.shieldFlash > 0) state.shieldFlash--;
        ctx.restore();
      }

      // Ship Rendering
      ctx.fillStyle = playerColor; ctx.beginPath(); 
      ctx.moveTo(state.px, state.py - 30); 
      ctx.lineTo(state.px - 25, state.py + 25); 
      ctx.lineTo(state.px, state.py + 15); 
      ctx.lineTo(state.px + 25, state.py + 25); 
      ctx.fill();

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAbortDialogOpen, missionType, difficulty, onGameOver, playerColor, quadrant]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 overflow-hidden relative">
      <div 
        style={{ width: NATIVE_WIDTH, height: NATIVE_HEIGHT, transform: `scale(${displayScale})`, transformOrigin: 'center center' }}
        className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-black"
      >
        <canvas ref={canvasRef} width={NATIVE_WIDTH} height={NATIVE_HEIGHT} className="block w-full h-full" />
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between pointer-events-none select-none">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-zinc-800 rounded-full border border-zinc-700 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${playerHp}%` }} />
              </div>
              <span className="retro-font text-[8px] text-emerald-400">HP</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-zinc-800 rounded-full border border-zinc-700 overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${stateRef.current.maxSh > 0 ? (playerSh / stateRef.current.maxSh) * 100 : 0}%` }} />
              </div>
              <span className="retro-font text-[8px] text-blue-400">SH</span>
            </div>
          </div>
          <div className="text-right">
            <div className="retro-font text-lg text-emerald-400">{score.toString().padStart(6, '0')}</div>
          </div>
        </div>
        {bossHp !== null && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-64 h-3 bg-zinc-950 border border-red-900 rounded-full overflow-hidden">
             <div className="h-full bg-red-600" style={{ width: `${bossHp}%` }} />
          </div>
        )}
      </div>
      {isAbortDialogOpen && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border-2 border-zinc-800 p-8 rounded shadow-2xl text-center space-y-6 max-w-xs w-full">
            <h3 className="retro-font text-sm text-red-500 uppercase tracking-widest">Abort Combat?</h3>
            <div className="flex gap-4">
              <button onClick={() => setIsAbortDialogOpen(false)} className="flex-1 py-3 bg-zinc-800 text-white retro-font text-[8px] uppercase">No</button>
              <button onClick={() => onGameOver(false)} className="flex-1 py-3 bg-red-600 text-white retro-font text-[8px] uppercase">Yes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameEngine;
