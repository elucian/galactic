
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, Planet, QuadrantType, ShipFitting, AmmoType, PlanetStatusData } from '../types.ts';
import { ExtendedShipConfig, WEAPONS, EXOTIC_WEAPONS } from '../constants.ts';
import { GameEngineState, Projectile, Particle, Loot } from './game/types.ts';
import { Enemy } from './game/Enemy.ts';
import { Asteroid } from './game/Asteroid.ts';
import { renderGame } from './game/GameRenderer.ts';
import { GameHUD } from './game/GameHUD.tsx';
import { fireMissile, fireMine, fireRedMine, firePowerShot, fireNormalShot, fireAlienWeapons, createExplosion, takeDamage, createAreaDamage, applyShieldRamDamage, applyJetDamage } from './game/CombatMechanics.ts';
import { audioService } from '../services/audioService.ts';

interface GameEngineProps {
  ships: { config: ExtendedShipConfig, fitting: ShipFitting, color: string, wingColor?: string, cockpitColor?: string, gunColor?: string, secondaryGunColor?: string, gunBodyColor?: string, engineColor?: string, nozzleColor?: string }[];
  shield: Shield | null;
  secondShield: Shield | null;
  onGameOver: (success: boolean, score: number, aborted: boolean, payload: any) => void;
  difficulty: number;
  currentPlanet: Planet;
  quadrant: QuadrantType;
  fontSize: string;
  mode: 'combat' | 'drift';
  planetRegistry?: Record<string, PlanetStatusData>;
  speedMode?: 'slow' | 'normal' | 'fast';
}

const GameEngine: React.FC<GameEngineProps> = ({ ships, shield, secondShield, onGameOver, difficulty, currentPlanet, quadrant, fontSize, mode, planetRegistry, speedMode = 'normal' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game Loop State (Mutable Ref for performance)
  const stateRef = useRef<GameEngineState>({
    px: 0, py: 0, hp: 100, fuel: 100, water: 100, energy: 1000,
    sh1: 0, sh2: 0, score: 0, time: 0, phase: 'travel',
    bossSpawned: false, bossDead: false,
    enemies: [], asteroids: [], bullets: [], particles: [], loot: [], stars: [],
    keys: new Set(), lastFire: 0, lastSpawn: 0, frame: 0,
    missiles: 0, mines: 0, redMines: 0,
    cargo: [], ammo: { iron: 0, titanium: 0, cobalt: 0, iridium: 0, tungsten: 0, explosive: 0 },
    gunStates: {}, magazineCurrent: 0, reloadTimer: 0, selectedAmmo: 'iron',
    weaponFireTimes: {}, weaponHeat: {},
    lastMissileFire: 0, lastMineFire: 0, lastRedMineFire: 0,
    mineSide: false, omegaSide: false, paused: false, active: true,
    swivelMode: false, chargeLevel: 0, hasFiredOverload: false, lastRapidFire: 0,
    victoryTimer: 0, failureTimer: 0,
    movement: { up: false, down: false, left: false, right: false },
    criticalExposure: 0, rescueMode: false, rescueTimer: 0, usingWater: false,
    overload: 0, overdrive: false, overdriveFirstShot: false,
    shakeX: 0, shakeY: 0, shakeDecay: 0.9, capacitor: 100,
    salvoTimer: 0, lastSalvoFire: 0, currentThrottle: 0, shipVy: 0,
    refuelTimer: 0, refuelDuration: 0, isRefueling: false, refuelType: null, refuelStartVal: 0,
    isEnergizing: false, energizeTimer: 0, capacitorLocked: false, depletionTime: 0,
    weaponCoolDownTimer: 0, missileBurstCount: 0, mineBurstCount: 0,
    isExitDialogOpen: false, capsLock: false, shieldsEnabled: true, wasShieldHit: false, isShooting: false,
    sh1RegenActive: false, sh2RegenActive: false
  });

  // Input Ref to bridge React Events and Game Loop
  const inputRef = useRef({ main: false, secondary: false });

  // HUD State (React State for UI)
  const [hud, setHud] = useState({
    hp: 100, sh1: 0, sh2: 0, score: 0, timer: 0,
    isPaused: false, alert: '', alertType: '',
    fuel: 100, water: 100, energy: 1000, overload: 0,
    boss: null as any, powerMode: false, ammoCount: 0, isReloading: false,
    missiles: 0, mines: 0, redMines: 0,
    capacitorLocked: false, rescueMode: false,
    shieldsOnline: true
  });

  const [showExitDialog, setShowExitDialog] = useState(false);

  // Initialization
  useEffect(() => {
    const s = stateRef.current;
    s.px = window.innerWidth / 2;
    s.py = window.innerHeight * 0.8;
    
    // Load Ship Stats
    const activeFit = ships[0].fitting;
    const activeConfig = ships[0].config;
    
    s.hp = activeFit.health;
    s.fuel = activeFit.fuel;
    s.water = activeFit.water || 100;
    s.missiles = activeFit.rocketCount;
    s.mines = activeFit.mineCount;
    s.redMines = activeFit.redMineCount || 0;
    s.cargo = activeFit.cargo;
    s.ammo = activeFit.ammo;
    s.magazineCurrent = activeFit.magazineCurrent || 200;
    s.reloadTimer = activeFit.reloadTimer || 0;
    
    if (shield) s.sh1 = shield.capacity;
    if (secondShield) s.sh2 = secondShield.capacity;
    
    // Init Stars
    for (let i = 0; i < 150; i++) {
        s.stars.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, s: Math.random() * 2 });
    }

    // Input Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'p' || e.key === 'P') {
            s.paused = !s.paused;
            setHud(h => ({ ...h, isPaused: s.paused }));
        }
        if (e.key === 'Escape') {
            s.paused = true;
            s.isExitDialogOpen = true;
            setShowExitDialog(true);
            setHud(h => ({ ...h, isPaused: true }));
        }
        if (s.paused) return;

        s.keys.add(e.key.toLowerCase());
        if (e.code === 'Space') inputRef.current.main = true;
        if (e.key === 'Control' || e.key === '.' || e.key === '0') inputRef.current.secondary = true;
        
        if (e.key === 'Tab' || e.key === '+') fireMissile(s);
        if (e.key === 'Shift') fireMine(s, 'toggle');
        if (e.key === 'Enter') fireMine(s, 'both');
        if (e.key === 'b' || e.key === 'B') fireRedMine(s, setHud);
        
        if (e.key === 'f' || e.key === 'F') { /* Manual Fuel logic if needed */ }
        if (e.key === 'h' || e.key === 'H') { /* Manual Heal logic if needed */ }
        if (e.key === 'e' || e.key === 'E') { /* Manual Energy logic if needed */ }
        if (e.key === 'r' || e.key === 'R') { s.reloadTimer = 180; audioService.playSfx('click'); } // Manual Reload
        
        if (e.getModifierState("CapsLock")) { s.capsLock = true; } else { s.capsLock = false; }
        
        if (e.key === 's' || e.key === 'S') { 
            s.shieldsEnabled = !s.shieldsEnabled;
            setHud(h => ({...h, alert: s.shieldsEnabled ? "SHIELDS ONLINE" : "SILENT RUNNING", alertType: s.shieldsEnabled ? 'success' : 'warning'}));
            audioService.playSfx('click');
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        s.keys.delete(e.key.toLowerCase());
        if (e.code === 'Space') inputRef.current.main = false;
        if (e.key === 'Control' || e.key === '.' || e.key === '0') inputRef.current.secondary = false;
        if (!e.getModifierState("CapsLock")) { s.capsLock = false; }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let animationId: number;
    const activeShip = ships[0]; // Currently active ship

    const loop = () => {
        const s = stateRef.current;
        if (!s.active) return;

        if (s.paused) {
            animationId = requestAnimationFrame(loop);
            return;
        }

        s.frame++;
        const width = canvas.width;
        const height = canvas.height;
        const speedMult = speedMode === 'fast' ? 1.5 : (speedMode === 'slow' ? 0.8 : 1.0);

        // --- PLAYER MOVEMENT ---
        if (!s.rescueMode) {
            let dx = 0; let dy = 0;
            const moveSpeed = (activeShip.config.speed || 8) * (s.shieldsEnabled ? 1.0 : 1.2); 
            
            if (s.keys.has('arrowleft') || s.keys.has('a')) dx -= moveSpeed;
            if (s.keys.has('arrowright') || s.keys.has('d')) dx += moveSpeed;
            if (s.keys.has('arrowup') || s.keys.has('w')) dy -= moveSpeed;
            if (s.keys.has('arrowdown') || s.keys.has('s') && !s.keys.has('s')) dy += moveSpeed; // Conflict with Shield Toggle 'S' handled by keydown event
            
            // Allow arrow keys always
            if (s.keys.has('arrowdown')) dy += moveSpeed;

            s.px += dx; s.py += dy;
            s.px = Math.max(20, Math.min(width - 20, s.px));
            s.py = Math.max(20, Math.min(height - 20, s.py));

            s.movement.up = dy < 0; s.movement.down = dy > 0;
            s.movement.left = dx < 0; s.movement.right = dx > 0;
            
            if (s.movement.up) s.currentThrottle = Math.min(1, s.currentThrottle + 0.05);
            else if (s.movement.down) s.currentThrottle = Math.max(-0.5, s.currentThrottle - 0.05);
            else s.currentThrottle *= 0.95;

            // Jet Damage Logic against Boss
            if (s.bossSpawned && s.phase === 'boss') {
                applyJetDamage(s, s.movement, setHud);
            }
        } else {
            // Rescue Capsule Drift
            s.py -= 1;
            s.rescueTimer++;
            if (s.rescueTimer > 300) {
                // End game after drift
                s.active = false;
                onGameOver(false, s.score, false, null);
                return;
            }
        }

        // --- RESOURCES & REGEN ---
        if (!s.rescueMode) {
            if (s.fuel > 0) s.fuel -= (0.01 + Math.abs(s.currentThrottle) * 0.02);
            else { 
                // Fuel Empty: Damage
                if (s.frame % 60 === 0) takeDamage(s, 5, 'environment', shield, secondShield, setHud); 
                setHud(h => ({...h, alert: "FUEL CRITICAL", alertType: 'alert'}));
            }

            if (s.water > 0) {
                s.water -= 0.005;
                if (s.shieldsEnabled) s.water -= 0.005; // Shield cooling
            } else {
                if (s.frame % 120 === 0) takeDamage(s, 2, 'heat', shield, secondShield, setHud);
            }

            // Energy Regen
            const regenRate = s.shieldsEnabled ? 0.5 : 1.5; // Faster regen if shields off
            if (s.energy < activeShip.config.maxEnergy) s.energy += regenRate;
            
            // Capacitor Logic
            if (s.capacitorLocked) {
                s.capacitor += 0.2;
                if (s.capacitor >= 90) s.capacitorLocked = false;
            } else if (s.capacitor < 100) {
                s.capacitor += (s.shieldsEnabled ? 0.05 : 0.2); // Slower charge if shields up
            }

            // Shield Regen
            if (s.shieldsEnabled && !s.wasShieldHit) {
                if (s.sh1 < (shield?.capacity || 0) && s.energy > 5) {
                    s.sh1 += (shield?.regenRate || 0) * 0.05;
                    s.energy -= 0.2;
                }
                if (s.sh2 < (secondShield?.capacity || 0) && s.energy > 5) {
                    s.sh2 += (secondShield?.regenRate || 0) * 0.05;
                    s.energy -= 0.2;
                }
            }
            if (s.wasShieldHit && s.frame % 60 === 0) s.wasShieldHit = false; // Reset hit flag after 1s
        }

        // --- WEAPONS FIRE ---
        if (!s.rescueMode) {
            if (inputRef.current.main) {
                if (s.capsLock && !s.capacitorLocked) firePowerShot(s, activeShip, setHud, height);
                else fireNormalShot(s, activeShip);
            }
            if (inputRef.current.secondary) {
                fireAlienWeapons(s, activeShip); // Or standard secondary logic depending on ship type
            }
        }

        // --- ASTEROIDS & SPAWNING ---
        const worldSpeedFactor = 1.0 + (s.currentThrottle * 0.5);
        
        if (s.phase === 'travel' && !s.bossSpawned) {
            // Asteroid Spawn - Significantly reduced rate
            if (Math.random() < 0.005 * difficulty) {
                s.asteroids.push(new Asteroid(width, difficulty, quadrant));
            }
            
            // Enemy Spawn
            if (s.frame - s.lastSpawn > (120 - difficulty * 5) && s.enemies.length < (3 + difficulty)) {
                s.lastSpawn = s.frame;
                const ex = Math.random() * width;
                s.enemies.push(new Enemy(ex, -50, 'fighter', activeShip.config, difficulty, quadrant));
            }

            // Boss Spawn Condition
            if (s.time > 45 && s.enemies.length === 0 && !s.bossSpawned) {
                s.phase = 'boss';
                s.bossSpawned = true;
                s.enemies.push(new Enemy(width/2, -200, 'boss', activeShip.config, difficulty, quadrant));
                audioService.playAlertSiren();
                setHud((h: any) => ({...h, alert: "WARNING: CARRIER DETECTED", alertType: 'alert'}));
            }
        }

        // --- UPDATES ---
        s.time += 1/60;
        
        // Asteroids
        s.asteroids.forEach(a => {
            a.y += a.vy * worldSpeedFactor * speedMult;
            a.x += a.vx * speedMult;
            a.ax += a.vax; a.ay += a.vay; a.az += a.vaz;
        });
        s.asteroids = s.asteroids.filter(a => a.y < height + 100 && a.hp > 0);

        // Enemies
        s.enemies.forEach(e => { 
            if (s.rescueMode) { e.y += 3; if (e.type === 'boss') e.y += 2; } 
            else {
                // Pass shield active status to enemy
                const shieldsActive = s.shieldsEnabled && (s.sh1 > 0 || s.sh2 > 0);
                e.update(s.px, s.py, width, height, s.bullets, worldSpeedFactor, s.bullets, s.particles, difficulty, s.enemies, speedMult, shieldsActive); 
                
                if (e.hp < e.maxHp && e.hp > 0) {
                    // Apply shield ram damage if applicable
                    if (Math.abs(e.x - s.px) < 60 && Math.abs(e.y - s.py) < 60) {
                        applyShieldRamDamage(s, e, setHud);
                    }
                }
            }
        });
        s.enemies = s.enemies.filter(e => {
            if (e.y > height + 100) return false;
            if (e.hp <= 0) {
                if (e.type === 'boss') { 
                    s.bossDead = true; 
                    s.victoryTimer = 180; 
                    createExplosion(s, e.x, e.y, '#a855f7', 100, 'boss');
                    audioService.playExplosion(0, 3.0, 'boss');
                } else {
                    s.score += (e.type === 'heavy' ? 500 : 100);
                    createExplosion(s, e.x, e.y, '#ef4444', 15);
                    audioService.playExplosion(0, 0.8, 'standard');
                    // Drop Loot
                    if (Math.random() > 0.7) {
                        s.loot.push({ x: e.x, y: e.y, z: 0, type: 'fuel', id: 'can_fuel', quantity: 1, isPulled: false, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2 });
                    }
                }
                return false;
            }
            return true;
        });

        // Bullets & Collision
        s.bullets.forEach(b => {
            b.x += b.vx; b.y += b.vy; b.life--;
            
            // Player Bullet hitting Enemy
            if (!b.isEnemy) {
                s.enemies.forEach(e => {
                    if (Math.abs(b.x - e.x) < 40 && Math.abs(b.y - e.y) < 40 && b.life > 0) {
                        // Check shields first
                        const hitAngle = Math.atan2(b.y - e.y, b.x - e.x);
                        const shieldIdx = e.getHitShieldIndex(hitAngle);
                        
                        if (shieldIdx >= 0) {
                            const shieldColor = e.shieldLayers[shieldIdx]?.color || '#ffffff';
                            e.damageShield(shieldIdx, b.damage, b.type, !!b.isMain, !!b.isOvercharge, !!b.isEmp);
                            createExplosion(s, b.x, b.y, shieldColor, 3, 'shield_effect');
                            audioService.playImpact('shield', 0.3);
                        } else {
                            e.damageHull(b.damage, b.type, !!b.isMain, !!b.isOvercharge);
                            createExplosion(s, b.x, b.y, '#f97316', 2);
                            audioService.playImpact('hull', 0.2);
                        }
                        
                        if (!b.isMain && b.type !== 'laser') b.life = 0; // Destroy projectile
                    }
                });
                
                s.asteroids.forEach(a => {
                    if (Math.hypot(b.x - a.x, b.y - a.y) < a.size + 10 && b.life > 0) {
                        a.hp -= b.damage;
                        createExplosion(s, b.x, b.y, '#cbd5e1', 3);
                        b.life = 0;
                        if (a.hp <= 0) {
                            audioService.playExplosion(0, 0.5, 'asteroid');
                            if (a.loot) {
                                s.loot.push({ x: a.x, y: a.y, z: a.z, type: a.loot.type, id: a.loot.id, quantity: a.loot.quantity, isPulled: false, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2 });
                            }
                        }
                    }
                });
            } 
            // Enemy Bullet hitting Player
            else if (!s.rescueMode) {
                if (Math.hypot(b.x - s.px, b.y - s.py) < 30 && b.life > 0) {
                    takeDamage(s, b.damage, b.type, shield, secondShield, setHud);
                    createExplosion(s, b.x, b.y, s.shieldsEnabled && (s.sh1>0||s.sh2>0) ? '#3b82f6' : '#ef4444', 5, 'player');
                    b.life = 0;
                }
            }
        });
        s.bullets = s.bullets.filter(b => b.life > 0 && b.y > -50 && b.y < height + 50 && b.x > -50 && b.x < width + 50);

        // Loot Collection
        s.loot.forEach(l => {
            l.x += l.vx; l.y += l.vy;
            const dist = Math.hypot(l.x - s.px, l.y - s.py);
            if (dist < 150) {
                l.isBeingPulled = true;
                l.vx += (s.px - l.x) * 0.05;
                l.vy += (s.py - l.y) * 0.05;
            }
            if (dist < 30) {
                l.quantity = 0; // Mark for removal
                // Add to Cargo
                const existing = s.cargo.find(c => c.id === l.id);
                if (existing) existing.quantity += (l.quantity || 1);
                else s.cargo.push({ instanceId: `loot_${Date.now()}`, type: l.type as any, id: l.id, name: l.name || l.type, quantity: l.quantity || 1, weight: 1 });
                
                // Instant effects
                if (l.type === 'fuel') s.fuel = Math.min(activeShip.config.maxFuel, s.fuel + 10);
                if (l.type === 'energy') s.energy = Math.min(activeShip.config.maxEnergy, s.energy + 200);
                if (l.type === 'water') s.water = Math.min(activeShip.config.maxWater || 100, s.water + 20);
                if (l.type === 'repair') s.hp = Math.min(100, s.hp + 20);
                
                s.score += 50;
                audioService.playSfx('buy');
            }
        });
        s.loot = s.loot.filter(l => l.quantity !== 0 && l.y < height + 100);

        // Particles
        s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; });
        s.particles = s.particles.filter(p => p.life > 0);

        // Victory / Failure Check
        if (s.victoryTimer > 0) {
            s.victoryTimer--;
            if (s.victoryTimer === 0) {
                s.active = false;
                onGameOver(true, s.score, false, {
                    health: s.hp, fuel: s.fuel, water: s.water,
                    rockets: s.missiles, mines: s.mines, redMineCount: s.redMines,
                    cargo: s.cargo, ammo: s.ammo,
                    magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer
                });
            }
        }

        // HUD Update (Throttled)
        if (s.frame % 5 === 0) {
            setHud(h => ({
                ...h,
                hp: s.hp, sh1: s.sh1, sh2: s.sh2, score: s.score, timer: s.time,
                fuel: s.fuel, water: s.water, energy: s.energy, overload: s.capacitor,
                missiles: s.missiles, mines: s.mines, redMines: s.redMines,
                boss: s.bossSpawned && !s.bossDead ? s.enemies.find(e=>e.type==='boss') : null,
                powerMode: s.capsLock,
                ammoCount: s.gunStates[1]?.mag || 0,
                isReloading: s.reloadTimer > 0,
                capacitorLocked: s.capacitorLocked,
                rescueMode: s.rescueMode,
                shieldsOnline: s.shieldsEnabled
            }));
        }

        // Render
        renderGame(ctx, s, width, height, { ...activeShip, color: ships[0].color }, quadrant); // Use ship[0] color for consistent rendering

        animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [ships, shield, secondShield, difficulty, quadrant, speedMode, onGameOver]);

  const getPayload = () => {
        const s = stateRef.current;
        return {
            health: s.hp,
            fuel: s.fuel,
            water: s.water,
            rockets: s.missiles,
            mines: s.mines,
            redMineCount: s.redMines,
            cargo: s.cargo,
            ammo: s.ammo,
            magazineCurrent: s.magazineCurrent,
            reloadTimer: s.reloadTimer
        };
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black overflow-hidden font-mono select-none">
        <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />
        <GameHUD 
            hud={hud} 
            shield={shield} 
            secondShield={secondShield}
            maxEnergy={ships[0].config.maxEnergy}
            maxFuel={ships[0].config.maxFuel}
            maxWater={ships[0].config.maxWater || 100}
            hasGuns={true}
            hasAmmoWeapons={ships[0].fitting.weapons.some(w => w && [...WEAPONS].find(def => def.id === w.id)?.isAmmoBased)}
            maxAmmoInMags={100} // Simplified max ammo for HUD
            fontSize={fontSize}
            onPauseToggle={() => { stateRef.current.paused = !stateRef.current.paused; setHud(h => ({...h, isPaused: stateRef.current.paused})); }}
            onAbort={() => { 
                const s = stateRef.current;
                s.active = false; 
                onGameOver(false, s.score, true, getPayload()); 
            }}
            onExitDialogClose={() => { stateRef.current.isExitDialogOpen = false; setShowExitDialog(false); stateRef.current.paused = false; setHud(h => ({...h, isPaused: false})); }}
            onExitGame={() => { 
                const s = stateRef.current;
                s.active = false; 
                onGameOver(false, 0, true, getPayload()); 
            }}
            showExitDialog={showExitDialog}
            fireMissile={() => fireMissile(stateRef.current)}
            fireMine={() => fireMine(stateRef.current)}
            fireRedMine={() => fireRedMine(stateRef.current, setHud)}
            inputRef={inputRef}
        />
    </div>
  );
};

export default GameEngine;
