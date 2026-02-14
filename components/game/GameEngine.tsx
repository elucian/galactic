
import { GameEngineState, Projectile } from './types';

export const updateEnemyOrdnance = (b: Projectile, s: GameEngineState, age: number) => {
    // Ordnance Activation Logic
    if (!b.isActivated && b.safeDistance) {
         if (b.isEnemy) {
             // For enemies, activate after 60 frames (1 second) or when clear
             if (age > 60) b.isActivated = true;
         } else {
             // For player, check distance from ship
             const distFromShip = Math.hypot(b.x - s.px, b.y - s.py);
             if (distFromShip > b.safeDistance) b.isActivated = true;
         }
    }

    // --- ENEMY ORDNANCE LOGIC ---
    if (b.isEnemy) {
        if (!s.rescueMode) {
            if (b.type === 'mine_enemy') {
                // MINE PHYSICS UPDATE: STEERING BEHAVIOR
                // 0-60 frames: Initial Drift (Safety phase)
                // 60+ frames: Active Homing
                if (age > 60) {
                    let targetX = s.px;
                    let targetY = s.py;
                    
                    // Retargeting Logic (If mine is old > 4s and player is far)
                    if (age > 240) {
                            const distToPlayer = Math.hypot(b.x - s.px, b.y - s.py);
                            // If player evaded (>300px away), seek nearest enemy ship
                            if (distToPlayer > 300) {
                                let bestAlien = null;
                                let minAlienDist = 1000;
                                
                                s.enemies.forEach(e => {
                                    if (e.type === 'boss') return; // Don't target boss
                                    const d = Math.hypot(e.x - b.x, e.y - b.y);
                                    if (d < minAlienDist && d > 60) { // Don't target self/launcher too close
                                        minAlienDist = d;
                                        bestAlien = e;
                                    }
                                });
                                
                                if (bestAlien) {
                                    targetX = (bestAlien as any).x;
                                    targetY = (bestAlien as any).y;
                                }
                            }
                    }

                    const dx = targetX - b.x;
                    const dy = targetY - b.y;
                    const dist = Math.hypot(dx, dy);
                    
                    // Steering Force (Seek)
                    // Maintains momentum but curves towards target
                    if (dist > 0) {
                        const maxSpeed = 7;
                        const turnRate = 0.025; // Low turn rate creates spiral/curvature
                        
                        const desiredVx = (dx / dist) * maxSpeed;
                        const desiredVy = (dy / dist) * maxSpeed;
                        
                        b.vx += (desiredVx - b.vx) * turnRate;
                        b.vy += (desiredVy - b.vy) * turnRate;
                    }
                    
                    // Visual Rotation (Spin)
                    b.angleOffset = (b.angleOffset || 0) + 0.1;
                }
            } else if (b.type === 'missile_enemy') {
                // MISSILE PHYSICS:
                // 0-10s (600 frames): Powered Flight (Accelerates & Turns)
                // >10s: Engine Burnout (Inertial drift until offscreen/hit)
                if (age < 600) {
                    const targetX = s.px;
                    const targetY = s.py;
                    const dx = targetX - b.x;
                    const dy = targetY - b.y;
                    const dist = Math.hypot(dx, dy);
                    
                    const turnRate = 0.06; 
                    const desiredSpeed = 14; 
                    
                    if (dist > 0) {
                        const tx = (dx / dist) * desiredSpeed;
                        const ty = (dy / dist) * desiredSpeed;
                        b.vx += (tx - b.vx) * turnRate;
                        b.vy += (ty - b.vy) * turnRate;
                    }
                    
                    // Engine active: Thrust Trail (Fire)
                    if (s.frame % 3 === 0) {
                        s.particles.push({ 
                            x: b.x, y: b.y, vx: -b.vx*0.2, vy: -b.vy*0.2, 
                            life: 0.4, size: 3, color: '#fb923c', type: 'fire' 
                        });
                    }
                } else {
                    // Engine Burnout: Inertia Only (No steering, no acceleration)
                    // Visual: Smoke Trail instead of Fire
                    if (s.frame % 5 === 0) {
                        s.particles.push({ 
                            x: b.x, y: b.y, vx: 0, vy: 0, 
                            life: 0.8, size: 2, color: '#52525b', type: 'smoke' 
                        });
                    }
                }
            }
        }
    } 
    // --- PLAYER ORDNANCE LOGIC ---
    else {
        // Player Mines (Magnetic Homing)
        if (['mine', 'mine_emp', 'mine_red'].includes(b.type)) {
            // Phase 1: Stabilization (0 - 0.75s)
            // Apply drag to slow down the initial ejection velocity
            if (age < 45) {
                b.vx *= 0.95;
                b.vy *= 0.95;
                // Slight drift downwards to separate from ship path
                b.vy += 0.05; 
            }
            // Phase 2: Magnetic Attraction (0.75s+)
            else {
                // Find nearest enemy target
                let target = null;
                let minDist = 500; // Magnetic scan range

                for (const e of s.enemies) {
                    if (e.hp <= 0) continue;
                    const d = Math.hypot(e.x - b.x, e.y - b.y);
                    if (d < minDist) {
                        minDist = d;
                        target = e;
                    }
                }

                if (target) {
                    const dx = target.x - b.x;
                    const dy = target.y - b.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist > 0) {
                        const maxSpeed = b.maxSpeed || 10;
                        const turnRate = b.turnRate || 0.05; // Magnetic strength

                        // Apply acceleration towards target
                        b.vx += (dx / dist) * maxSpeed * turnRate;
                        b.vy += (dy / dist) * maxSpeed * turnRate;
                    }
                }

                // Cap speed
                const currentSpeed = Math.hypot(b.vx, b.vy);
                const limit = b.maxSpeed || 10;
                if (currentSpeed > limit) {
                    b.vx = (b.vx / currentSpeed) * limit;
                    b.vy = (b.vy / currentSpeed) * limit;
                }

                // Visual spin
                b.angleOffset = (b.angleOffset || 0) + 0.15;
            }
        }
        // Player Missiles (Active Guidance)
        else if (b.type.includes('missile')) {
             if (age < 600) { // Fuel limit
                 let target = null;
                 let minDist = 800; // Radar range

                 // Prioritize Boss
                 const boss = s.enemies.find(e => e.type === 'boss' && e.hp > 0);
                 if (boss) {
                     target = boss;
                 } else {
                     // Find nearest enemy
                     for (const e of s.enemies) {
                        if (e.hp <= 0) continue;
                        const d = Math.hypot(e.x - b.x, e.y - b.y);
                        // Only target enemies roughly in front or sides, don't turn 180 instantly
                        if (d < minDist && e.y < b.y + 100) { 
                            minDist = d;
                            target = e;
                        }
                    }
                 }

                 if (target) {
                    const dx = target.x - b.x;
                    const dy = target.y - b.y;
                    const dist = Math.hypot(dx, dy);
                    const turnRate = b.turnRate || 0.08;
                    const maxSpeed = b.maxSpeed || 14;

                    if (dist > 0) {
                        const tx = (dx / dist) * maxSpeed;
                        const ty = (dy / dist) * maxSpeed;
                        b.vx += (tx - b.vx) * turnRate;
                        b.vy += (ty - b.vy) * turnRate;
                    }
                 }
                 
                 // Trail
                 if (s.frame % 3 === 0) {
                     s.particles.push({ 
                        x: b.x, y: b.y, vx: -b.vx*0.2, vy: -b.vy*0.2, 
                        life: 0.3, size: 4, color: '#60a5fa', type: 'ion' 
                     });
                 }
             }
        }
    }
};
