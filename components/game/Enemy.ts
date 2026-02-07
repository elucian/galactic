
import { EquippedWeapon, QuadrantType, WeaponType } from '../../types';
import { ExtendedShipConfig, EXOTIC_SHIELDS, EXOTIC_WEAPONS, WEAPONS } from '../../constants';
import { ShieldLayer, Projectile } from './types';
import { calculateDamage, OCTO_COLORS } from './utils';
import { audioService } from '../../services/audioService';

export class Enemy {
  x: number; y: number; z: number = 0; hp: number; maxHp: number; 
  shieldLayers: ShieldLayer[] = [];
  type: 'scout' | 'fighter' | 'heavy' | 'boss'; config: ExtendedShipConfig; lastShot: number = 0; 
  vx: number = 0; vy: number = 0; shieldRegen: number = 0;
  equippedWeapons: (EquippedWeapon | null)[] = [null, null, null]; 
  vibration: number = 0;
  stunnedUntil: number = 0;
  shieldDisabledUntil: number = 0;
  tick: number = 0;
  squadId: number = 0;
  squadOffset: number = 0;
  quadrant: QuadrantType;
  baseX: number = 0;
  movementPattern: 'sine' | 'z' | 'mirror_z' | 'cross_left' | 'cross_right' | 'avoid' | 'boss_trick';
  
  // Boss Specifics
  missileAmmo: number = 0;
  mineAmmo: number = 0;
  lastPx: number = 0;
  stationaryTimer: number = 0;
  attackMode: boolean = false;
  
  // New AI Properties
  maneuverState: 'idle' | 'charge' | 'flank' | 'retreat' | 'recover' = 'idle';
  maneuverTimer: number = 0;
  targetX: number = 0;
  targetY: number = 0;
  
  // Resource System for Boss
  fuel: number = 0;
  maxFuel: number = 0;
  energy: number = 0;
  maxEnergy: number = 0;
  water: number = 0; // For cooling/regen if needed, simplified for AI to Energy/Fuel focus
  isThrusting: boolean = false;

  constructor(x: number, y: number, type: 'scout' | 'fighter' | 'heavy' | 'boss', config: ExtendedShipConfig, diff: number, quadrant: QuadrantType, squadId: number = 0, squadOffset: number = 0, pattern?: string) {
    const hpMult = type === 'boss' ? 5000 : (type === 'heavy' ? 400 : 150);
    this.x = x; this.y = y; this.z = type === 'boss' ? 0 : (Math.random() - 0.5) * 600;
    this.baseX = x;
    this.hp = hpMult * (1 + diff * 0.3); this.maxHp = this.hp;
    this.type = type; 
    this.quadrant = quadrant;
    this.squadId = squadId;
    this.squadOffset = squadOffset;
    
    // Assign Movement Pattern
    if (pattern) {
        this.movementPattern = pattern as any;
    } else {
        if (quadrant === QuadrantType.DELTA) {
             this.movementPattern = Math.random() > 0.5 ? 'cross_left' : 'cross_right';
        } else if (quadrant === QuadrantType.GAMA) {
             this.movementPattern = Math.random() > 0.5 ? 'z' : 'mirror_z';
        } else {
             this.movementPattern = 'sine';
        }
    }
    
    this.config = { ...config };

    if (type === 'boss') {
        this.movementPattern = 'boss_trick';
        this.config.isAlien = true;
        
        // Initialize Resources based on Difficulty
        // Fuel scales with difficulty to allow longer fights in harder sectors
        this.maxFuel = 10 + (diff * 2); 
        this.fuel = this.maxFuel;
        
        this.maxEnergy = 2000 + (diff * 500);
        this.energy = this.maxEnergy;
        
        // Inventory Scaling (5-20 missiles, 10-30 mines)
        this.missileAmmo = Math.min(20, 5 + Math.floor(diff * 1.5));
        this.mineAmmo = Math.min(30, 10 + Math.floor(diff * 2));

        // --- BOSS WEAPON & SHIP LOGIC ---
        let weaponOptions: string[] = [];
        
        // Weapon Selection based on Quadrant
        if (quadrant === QuadrantType.ALFA) {
            weaponOptions = ['exotic_plasma_orb', 'exotic_flamer'];
        } else if (quadrant === QuadrantType.BETA) {
            weaponOptions = ['exotic_plasma_orb', 'exotic_flamer', 'exotic_octo_burst'];
        } else if (quadrant === QuadrantType.GAMA) {
            weaponOptions = ['exotic_gravity_wave', 'exotic_octo_burst', 'exotic_wave'];
        } else if (quadrant === QuadrantType.DELTA) {
            // Delta / Level 12 uses A-Class
            if (diff >= 12) {
                this.config.wingStyle = 'alien-a';
                this.config.name = 'Omega A-Type';
                this.config.defaultGuns = 1; // Center mount only
            }
            weaponOptions = ['exotic_electric', 'exotic_rainbow_spread', 'exotic_phaser_sweep', 'exotic_star_shatter'];
        }

        const selectedId = weaponOptions[Math.floor(Math.random() * weaponOptions.length)];
        this.config.weaponId = selectedId;
        
        // Weapon Slot Assignment Rules
        if (this.config.wingStyle === 'alien-a') {
            // A-Class: SINGLE weapon (Center)
            this.equippedWeapons[0] = { id: selectedId, count: 1 };
            this.equippedWeapons[1] = null;
            this.equippedWeapons[2] = null;
        } else {
            // H, M, W Class: DUAL weapons (Wings)
            this.equippedWeapons[0] = null;
            this.equippedWeapons[1] = { id: selectedId, count: 1 };
            this.equippedWeapons[2] = { id: selectedId, count: 1 };
        }

        let addShields = true;
        if (quadrant === QuadrantType.ALFA && diff <= 1) {
            addShields = false;
        }

        if (addShields) {
            // Boss Shield Configuration
            let s1Type: 'full'|'front'|'tri'|'hex' = 'full';
            let s1Rot = 0;
            let s2Type: 'full'|'front'|'tri'|'hex' = 'full';
            let s2Rot = 0.02;

            if (diff >= 12 || quadrant === QuadrantType.DELTA) {
                // Level 12 Boss / Delta: Hex Rotating + Full Continuous
                s1Type = 'hex'; s1Rot = 0.05;
                s2Type = 'full'; s2Rot = 0;
            } else if (quadrant === QuadrantType.GAMA) {
                // Gama Boss: Front Arc + Tri Rotating
                s1Type = 'front'; s1Rot = 0;
                s2Type = 'tri'; s2Rot = -0.03;
            } else if (quadrant === QuadrantType.BETA) {
                // Beta Boss: Front Arc + Front Arc
                s1Type = 'front'; s1Rot = 0;
                s2Type = 'front'; s2Rot = 0; 
            }

            const shield1 = EXOTIC_SHIELDS[0];
            const shield2 = EXOTIC_SHIELDS[1];

            this.shieldLayers.push({ color: shield1.color, max: shield1.capacity * (1 + diff * 0.1), current: shield1.capacity * (1 + diff * 0.1), rotation: 0, wobble: 0, type: s1Type, rotSpeed: s1Rot });
            if (s2Type !== s1Type || quadrant !== QuadrantType.BETA) {
                this.shieldLayers.push({ color: shield2.color, max: shield2.capacity * (1 + diff * 0.1), current: shield2.capacity * (1 + diff * 0.1), rotation: Math.PI / 2, wobble: 0, type: s2Type, rotSpeed: s2Rot });
            }

            this.shieldRegen = 2.0 + (diff * 0.2);
        } else {
            this.shieldRegen = 0;
        }

    } else {
        // Standard Enemy Config
        const standardEnergy = 'gun_pulse';
        if (this.config.isAlien) {
            const wId = 'gun_photon'; 
            if (this.config.defaultGuns === 1 || this.config.wingStyle === 'alien-a') {
                this.equippedWeapons[0] = { id: wId, count: 1 };
                this.equippedWeapons[1] = null;
                this.equippedWeapons[2] = null;
            } else {
                this.equippedWeapons[0] = null;
                this.equippedWeapons[1] = { id: wId, count: 1 };
                this.equippedWeapons[2] = { id: wId, count: 1 };
            }
        } else {
            this.equippedWeapons[0] = { id: standardEnergy, count: 1 };
        }

        // Shield Logic by Quadrant
        const baseShieldCap = 150 * diff;
        
        if (quadrant === QuadrantType.BETA) {
            // Beta: Single Arc Shield in Front
            const c1 = '#ef4444'; // Red
            this.shieldLayers.push({ color: c1, max: baseShieldCap, current: baseShieldCap, rotation: 0, wobble: 0, type: 'front', rotSpeed: 0 });
        } else if (quadrant === QuadrantType.GAMA) {
            // Gama: Arc Front + (Full OR Tri Rotating)
            const c1 = '#3b82f6'; // Blue
            const c2 = '#f97316'; // Orange
            this.shieldLayers.push({ color: c1, max: baseShieldCap, current: baseShieldCap, rotation: 0, wobble: 0, type: 'front', rotSpeed: 0 });
            
            const secondType = Math.random() > 0.5 ? 'full' : 'tri';
            const rot = secondType === 'tri' ? 0.03 : 0;
            this.shieldLayers.push({ color: c2, max: baseShieldCap * 0.8, current: baseShieldCap * 0.8, rotation: Math.random() * Math.PI, wobble: 0, type: secondType, rotSpeed: rot });
        } else if (quadrant === QuadrantType.DELTA) {
            // Delta: Two Rotating Shields (Tri+Tri or Tri+Hex)
            const c1 = '#a855f7'; // Purple
            const c2 = '#ffffff'; // White
            
            const type1 = Math.random() > 0.5 ? 'tri' : 'hex';
            const type2 = Math.random() > 0.5 ? 'tri' : 'hex';
            
            this.shieldLayers.push({ color: c1, max: baseShieldCap * 1.5, current: baseShieldCap * 1.5, rotation: 0, wobble: 0, type: type1, rotSpeed: 0.04 });
            this.shieldLayers.push({ color: c2, max: baseShieldCap * 1.2, current: baseShieldCap * 1.2, rotation: Math.PI/3, wobble: 0, type: type2, rotSpeed: -0.03 });
        } else if (diff >= 4) {
            // Alfa High Level fallback
            this.shieldLayers.push({ color: '#3b82f6', max: baseShieldCap, current: baseShieldCap, rotation: 0, wobble: 0, type: 'full', rotSpeed: 0 });
        }
    }
  }

  update(px: number, py: number, w: number, h: number, incomingFire: Projectile[], worldSpeedFactor: number = 1.0, bulletsRef: Projectile[], difficulty: number, otherEnemies: Enemy[], speedMult: number = 1.0, playerShieldsActive: boolean = false) {
    this.tick++;
    if (this.vibration > 0) this.vibration = Math.max(0, this.vibration - 1);
    
    if (this.stunnedUntil > 0) this.stunnedUntil--;
    if (this.shieldDisabledUntil > 0) this.shieldDisabledUntil--;

    const verticalSpeed = (this.quadrant === QuadrantType.DELTA && this.type !== 'boss' ? 1.8 : 2.8) * worldSpeedFactor * speedMult;

    if (this.stunnedUntil > 0) {
        this.vx *= 0.9;
        this.vy *= 0.9;
        const drift = this.type === 'boss' ? 0.1 : 0.5;
        this.vy += drift * worldSpeedFactor; 
        this.isThrusting = false;
    } else {
        if (this.type === 'boss') {
            if (this.shieldLayers.length > 0 && this.shieldRegen > 0 && this.shieldDisabledUntil <= 0) {
                const top = this.shieldLayers[0];
                if (top.current < top.max) {
                    // Regen costs energy
                    if (this.energy > 0.5) {
                        top.current = Math.min(top.max, top.current + this.shieldRegen);
                        this.energy -= 0.1;
                    }
                }
            }

            const hasShields = this.shieldLayers.some(l => l.current > 0);
            
            // --- RESOURCE MANAGEMENT & MOVEMENT ---
            
            // If out of fuel, drift slowly
            if (this.fuel <= 0) {
                this.isThrusting = false;
                this.vx *= 0.98; // Gradual slow down
                this.vy = (this.vy * 0.98) + 0.05; // Slight gravity drift
            } else {
                // FUEL IS AVAILABLE - EXECUTE AI
                
                let desiredVx = 0;
                let desiredVy = 0;
                let dodging = false;
                
                // 1. Sector Constraints & AI Logic
                if (this.quadrant === QuadrantType.ALFA) {
                    // ALPHA: Strict Top-Down constraint. Side-to-Side only.
                    this.targetY = h * 0.15; // Stay near top
                    
                    // Lazy tracking X
                    const dx = px - this.x;
                    desiredVx = dx * 0.05; // Gentle seeking
                    
                    // Ensure Y stays at top
                    const dy = this.targetY - this.y;
                    desiredVy = dy * 0.1;
                } else {
                    // BETA+ : Advanced Maneuvers
                    this.maneuverTimer--;
                    
                    // State Transitions
                    if (this.maneuverTimer <= 0) {
                        if (this.maneuverState === 'idle') {
                            const roll = Math.random();
                            if (roll < 0.4) {
                                this.maneuverState = 'charge';
                                this.maneuverTimer = 180; // 3s
                            } else if (roll < 0.7) {
                                this.maneuverState = 'flank';
                                this.maneuverTimer = 120; // 2s
                                this.targetX = this.x < w/2 ? w - 100 : 100;
                            } else {
                                this.maneuverState = 'idle';
                                this.maneuverTimer = 60;
                            }
                        } 
                        else if (this.maneuverState === 'charge') {
                            this.maneuverState = 'retreat';
                            this.maneuverTimer = 120;
                        }
                        else if (this.maneuverState === 'flank' || this.maneuverState === 'retreat') {
                            this.maneuverState = 'idle';
                            this.maneuverTimer = 60;
                        }
                    }

                    // Execute State
                    if (this.maneuverState === 'idle') {
                        this.targetY = h * 0.15;
                        const dx = px - this.x;
                        desiredVx = dx * 0.03;
                    } 
                    else if (this.maneuverState === 'charge') {
                        this.targetY = h * 0.5; // Advance to mid-screen
                        const dx = px - this.x;
                        desiredVx = dx * 0.05; // Aggressive track
                    }
                    else if (this.maneuverState === 'retreat') {
                        this.targetY = h * 0.15;
                        // Move sideways while retreating to avoid fire
                        desiredVx = (this.x < w/2 ? -1 : 1) * 3;
                    }
                    else if (this.maneuverState === 'flank') {
                        this.targetY = h * 0.25;
                        const dx = this.targetX - this.x;
                        desiredVx = dx * 0.05;
                    }

                    const dy = this.targetY - this.y;
                    desiredVy = dy * 0.05;
                }

                // 2. Collision Avoidance (Player Hull & Shields)
                // Boss actively avoids crashing into player
                const distToPlayer = Math.hypot(this.x - px, this.y - py);
                const avoidRadius = playerShieldsActive ? 250 : 200;
                
                if (distToPlayer < avoidRadius) {
                    dodging = true;
                    // Push away vector
                    const pushX = this.x - px;
                    const pushY = this.y - py;
                    const mag = Math.max(1, Math.hypot(pushX, pushY));
                    
                    // Stronger push if closer
                    const strength = 5 * (1 - (distToPlayer / avoidRadius));
                    
                    desiredVx += (pushX / mag) * strength * 2;
                    desiredVy += (pushY / mag) * strength * 2;
                    
                    this.fuel -= 0.05; // Evasion costs fuel
                }

                // Apply Physics
                const accel = 0.08;
                this.vx = this.vx + (desiredVx - this.vx) * accel;
                this.vy = this.vy + (desiredVy - this.vy) * accel;
                
                // Visual Jets Trigger
                this.isThrusting = (Math.abs(desiredVx) > 0.5 || desiredVy > 0.5 || dodging);
            }

            // 3. Screen Clamping
            const margin = 60;
            if (this.x < margin) { this.x = margin; this.vx *= -0.5; }
            if (this.x > w - margin) { this.x = w - margin; this.vx *= -0.5; }
            
            // Hard Y Clamp for Alpha to ensure "No Forward" rule is respected physically
            let limitY = h * 0.6;
            if (this.quadrant === QuadrantType.ALFA) limitY = h * 0.25;
            
            if (this.y < margin) { this.y = margin; this.vy *= -0.5; }
            if (this.y > limitY) { this.y = limitY; this.vy *= -0.5; }

            // --- BOSS FIRING LOGIC ---
            
            // Determine Fire Rate (Delta is 20% faster)
            const baseInterval = 60;
            const interval = this.quadrant === QuadrantType.DELTA ? Math.floor(baseInterval * 0.8) : baseInterval;

            // Ordnance Logic (Missiles / Mines)
            // Only fire if inventory exists
            // Boss saves ordnance for when player is vulnerable or far
            const distToPlayer = Math.hypot(px - this.x, py - this.y);
            const playerVulnerable = distToPlayer > 300; 

            // Missile Launch
            if (this.missileAmmo > 0 && this.tick % 180 === 0 && playerVulnerable) {
                // Fire Missile
                bulletsRef.push({ 
                    x: this.x, y: this.y + 40, vx: 0, vy: 5, 
                    damage: 150, color: '#ef4444', type: 'missile_enemy', life: 400, isEnemy: true, 
                    width: 12, height: 24, homingState: 'searching', launchTime: this.tick, 
                    headColor: '#ef4444', finsColor: '#7f1d1d', turnRate: 0.04, maxSpeed: 9, z: 0 
                });
                this.missileAmmo--;
                audioService.playWeaponFire('missile', 0);
            }

            // Mine Logic (Delta Only or Advanced)
            if (this.mineAmmo > 0 && this.tick % 120 === 0 && this.quadrant === QuadrantType.DELTA) {
                // Fire mine horizontally towards player
                const dir = px > this.x ? 1 : -1;
                bulletsRef.push({ 
                    x: this.x + (dir * 40), 
                    y: this.y + 20, 
                    vx: dir * 8, 
                    vy: 0, 
                    damage: 200, 
                    color: '#fbbf24', 
                    type: 'mine_enemy', 
                    life: 600, 
                    isEnemy: true, 
                    width: 24, 
                    height: 24, 
                    z: 0,
                    homingState: 'searching', 
                    turnRate: 0.03, 
                    maxSpeed: 7,
                    launchTime: this.tick
                });
                this.mineAmmo--;
                audioService.playWeaponFire('mine', 0);
            }

            // Standard/Exotic Weapon Fire
            if (this.tick % interval === 0) {
                const fireWeapon = (slot: number) => {
                    const wDef = this.equippedWeapons[slot] ? [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === this.equippedWeapons[slot]!.id) : null;
                    if (!wDef) return;

                    // Energy Cost Check
                    const cost = 2.0; 
                    if (this.energy < cost) return; 
                    this.energy -= cost;

                    // Determine Angles - Single Shot vs Spread
                    let angles = [0];
                    let speed = 15;
                    
                    // Exotic logic for Boss
                    if (wDef.id.includes('exotic')) {
                        if (this.config.wingStyle === 'alien-a' && slot === 0) {
                            angles = [-15, 0, 15];
                        } else {
                            angles = [0];
                        }
                    }

                    const originX = slot === 0 ? this.x : (slot === 1 ? this.x - 30 : this.x + 30);
                    const originY = this.y + 40;

                    angles.forEach(deg => {
                        const rad = deg * (Math.PI / 180);
                        const bvx = Math.sin(rad) * speed;
                        const bvy = Math.cos(rad) * speed; 

                        if (wDef.id === 'exotic_octo_burst') {
                             bulletsRef.push({ x: originX, y: originY, vx: bvx, vy: bvy, damage: wDef.damage, color: OCTO_COLORS[0], type: 'octo_shell', life: 80, isEnemy: true, width: 8, height: 8, glow: true, glowIntensity: 15, weaponId: wDef.id });
                        } 
                        else if (wDef.id === 'exotic_rainbow_spread') {
                             bulletsRef.push({ x: originX, y: originY, vx: bvx, vy: bvy, damage: wDef.damage, color: '#fff', type: 'projectile', life: 70, isEnemy: true, width: 6, height: 12, weaponId: wDef.id });
                        }
                        else {
                             bulletsRef.push({ x: originX, y: originY, vx: bvx, vy: bvy, damage: wDef.damage, color: wDef.beamColor || '#f00', type: 'projectile', life: 60, isEnemy: true, width: 6, height: 16, weaponId: wDef.id });
                        }
                    });
                }

                if (this.config.wingStyle === 'alien-a') {
                    if (this.equippedWeapons[0]) fireWeapon(0);
                } else {
                    if (this.equippedWeapons[1]) fireWeapon(1);
                    if (this.equippedWeapons[2]) fireWeapon(2);
                }
                
                audioService.playWeaponFire('exotic_single', 0);
            }

        } else {
            // --- STANDARD ENEMY LOGIC ---
            this.isThrusting = true; // Standard enemies always burn
            this.y += verticalSpeed; 

            if (this.movementPattern === 'z') { const cycle = Math.floor(this.tick / 60) % 2; this.vx = cycle === 0 ? 3 : -3; } 
            else if (this.movementPattern === 'mirror_z') { const cycle = Math.floor(this.tick / 60) % 2; this.vx = cycle === 0 ? -3 : 3; } 
            else if (this.movementPattern === 'cross_left') { this.vx = 2.5; } 
            else if (this.movementPattern === 'cross_right') { this.vx = -2.5; } 
            else if (this.movementPattern === 'avoid') { this.vx += (Math.sin(this.tick * 0.05 + this.squadId) * 0.5); const distToPlayer = this.x - px; if (Math.abs(distToPlayer) < 200 && this.y < py) { this.vx += (distToPlayer > 0 ? 0.8 : -0.8); } this.vx *= 0.92; } 
            else { this.vx = (this.vx + (Math.random() - 0.5) * 0.5) * 0.95; }

            // Separation
            const safeDistance = 130; let sepX = 0; otherEnemies.forEach(other => { if (other === this) return; if (other.y < -50) return; const dist = Math.hypot(this.x - other.x, this.y - other.y); if (dist < safeDistance && dist > 0) { const angle = Math.atan2(this.y - other.y, this.x - other.x); const force = (safeDistance - dist) / safeDistance; sepX += Math.cos(angle) * force * 1.5; } if (this.quadrant === QuadrantType.DELTA) { if (Math.abs(this.x - other.x) < 50 && Math.abs(this.y - other.y) < 50) { const avoidSpeed = 2.0 * speedMult; this.y += (this.y > other.y ? avoidSpeed : -avoidSpeed); } } }); this.vx += sepX;
            if (this.x < 50) this.vx += 1; if (this.x > w - 50) this.vx -= 1;
            
            // Dodge Fire
            if (this.y > h * 0.5 && Math.abs(this.z) < 50) { incomingFire.forEach(b => { if (!b.isEnemy && Math.abs(b.y - this.y) < 150 && Math.abs(b.x - this.x) < 50) { this.vx += (this.x < b.x ? -1 : 1) * 0.4; } }); }
        }
    }
    
    this.x += this.vx * speedMult; 
    if (this.type === 'boss') { this.y += this.vy * speedMult; } 
    this.shieldLayers.forEach((l, i) => { l.rotation += l.rotSpeed; if (l.wobble > 0) l.wobble = Math.max(0, l.wobble - 0.1); });
  }

  damageHull(amount: number, type: string, isMain: boolean, isOvercharge: boolean) {
      const isBoss = this.type === 'boss';
      if (type === 'bolt') {
          this.stunnedUntil = 60; 
          this.shieldDisabledUntil = 60; 
      }

      const hullDmg = calculateDamage(amount, type, 'hull');
      let finalHullDmg = hullDmg;
      
      if (isMain) {
          if (isOvercharge) finalHullDmg *= 1.0; 
          else finalHullDmg *= 3.0;
      } else if (type === 'projectile' || type === 'star') {
          finalHullDmg *= 2.0;
      } else if (type === 'flame') {
          finalHullDmg *= 1.2;
      }

      if (isBoss) finalHullDmg *= 0.25;
      this.hp -= finalHullDmg;
  }

  damageShield(layerIdx: number, amount: number, type: string, isMain: boolean, isOvercharge: boolean, isEmp: boolean) {
      const layer = this.shieldLayers[layerIdx];
      const shieldDmg = calculateDamage(amount, type, 'shield', layer.color);
      let finalShieldDmg = shieldDmg;
      
      if (isMain) {
          if (isOvercharge) finalShieldDmg *= 3.0;
          else finalShieldDmg *= 0.5;
      }
      if (isEmp) finalShieldDmg *= 5.0;

      layer.current -= finalShieldDmg;
      layer.wobble = 1.0; 
      
      if (layer.current <= 0) { 
          this.shieldLayers.splice(layerIdx, 1); 
      }
  }

  getHitShieldIndex(hitAngle: number): number {
      if (this.shieldDisabledUntil > 0) return -1;
      
      for (let i = this.shieldLayers.length - 1; i >= 0; i--) {
          const layer = this.shieldLayers[i];
          if (layer.current <= 0) continue;

          if (layer.type === 'full') return i;

          let localAngle = (hitAngle - layer.rotation) % (Math.PI * 2);
          if (localAngle < 0) localAngle += Math.PI * 2;

          const frontCenter = Math.PI / 2; 

          if (layer.type === 'front') {
              const arcRad = (140 * Math.PI) / 180;
              const halfArc = arcRad / 2;
              let diff = Math.abs(localAngle - frontCenter);
              if (diff > Math.PI) diff = (Math.PI * 2) - diff;
              if (diff < halfArc) return i;
          } else if (layer.type === 'tri') {
              const period = (Math.PI * 2) / 3; 
              const segSize = Math.PI / 2; 
              const phase = localAngle % period;
              if (phase < segSize) return i;
          } else if (layer.type === 'hex') {
              const period = (Math.PI * 2) / 6; 
              const segSize = Math.PI / 4; 
              const phase = localAngle % period;
              if (phase < segSize) return i;
          }
      }
      return -1;
  }
}
