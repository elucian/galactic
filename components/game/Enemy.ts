
import { EquippedWeapon, QuadrantType, WeaponType } from '../../types';
import { ExtendedShipConfig, EXOTIC_SHIELDS, EXOTIC_WEAPONS, WEAPONS } from '../../constants';
import { ShieldLayer, Projectile, Particle } from './types';
import { calculateDamage, OCTO_COLORS } from './utils';
import { audioService } from '../../services/audioService';
import { getWingMounts } from '../../utils/drawingUtils';

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
  
  // AI Properties
  maneuverState: 'idle' | 'charge' | 'flank' | 'retreat' | 'recover' = 'idle';
  maneuverTimer: number = 0;
  targetX: number = 0;
  targetY: number = 0;
  targetZ: number = 0; 
  
  fuel: number = 0;
  maxFuel: number = 0;
  energy: number = 0;
  maxEnergy: number = 0;
  water: number = 0; 
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

    // --- WEAPON CONFIGURATION ---
    // Strict Rules:
    // 1. ALL Enemies (Alien or Standard): Max 2 weapons.
    // 2. Alien Ships: Energy/Exotic ONLY.
    //    - Alien A: Nose (Slot 0).
    //    - Alien M, W, H: Wings (Slot 1 & 2).
    // 3. Standard Ships:
    //    - Mechanical: Wings ONLY (Slot 1 & 2).
    //    - Energy: Nose (Slot 0) OR Wings (Slot 1 & 2).
    
    this.equippedWeapons = [null, null, null];

    if (type === 'boss') {
        // Boss Logic (Alien Ships by definition)
        this.movementPattern = 'boss_trick';
        this.config.isAlien = true;
        
        this.maxFuel = 10 + (diff * 2); this.fuel = this.maxFuel;
        this.maxEnergy = 2000 + (diff * 500); this.energy = this.maxEnergy;
        
        this.missileAmmo = Math.min(20, 5 + Math.floor(diff * 1.5));
        this.mineAmmo = Math.min(30, 10 + Math.floor(diff * 2));

        let weaponOptions: string[] = [];
        if (quadrant === QuadrantType.ALFA) weaponOptions = ['exotic_plasma_orb', 'exotic_flamer'];
        else if (quadrant === QuadrantType.BETA) weaponOptions = ['exotic_plasma_orb', 'exotic_flamer', 'exotic_octo_burst'];
        else if (quadrant === QuadrantType.GAMA) weaponOptions = ['exotic_gravity_wave', 'exotic_octo_burst', 'exotic_wave'];
        else weaponOptions = ['exotic_electric', 'exotic_rainbow_spread', 'exotic_phaser_sweep', 'exotic_star_shatter'];

        const selectedId = weaponOptions[Math.floor(Math.random() * weaponOptions.length)];
        
        if (this.config.wingStyle === 'alien-a') {
            this.equippedWeapons[0] = { id: selectedId, count: 1 };
        } else {
            this.equippedWeapons[1] = { id: selectedId, count: 1 };
            this.equippedWeapons[2] = { id: selectedId, count: 1 };
        }

        // Boss Shields
        let s1Type: 'full'|'front'|'tri'|'hex' = 'full';
        let s2Type: 'full'|'front'|'tri'|'hex' = 'full';
        const shield1 = EXOTIC_SHIELDS[0];
        const shield2 = EXOTIC_SHIELDS[1];
        
        if (diff >= 12 || quadrant === QuadrantType.DELTA) { s1Type = 'hex'; s2Type = 'full'; } 
        else if (quadrant === QuadrantType.GAMA) { s1Type = 'front'; s2Type = 'tri'; } 
        else { s1Type = 'front'; s2Type = 'front'; }

        if (diff > 1 || quadrant !== QuadrantType.ALFA) {
            this.shieldLayers.push({ color: shield1.color, max: shield1.capacity * (1 + diff*0.1), current: shield1.capacity * (1 + diff*0.1), rotation: 0, wobble: 0, type: s1Type, rotSpeed: 0.05 });
            if (s2Type !== s1Type || quadrant !== QuadrantType.BETA) {
                this.shieldLayers.push({ color: shield2.color, max: shield2.capacity * (1 + diff*0.1), current: shield2.capacity * (1 + diff*0.1), rotation: Math.PI/2, wobble: 0, type: s2Type, rotSpeed: -0.03 });
            }
            this.shieldRegen = 2.0 + (diff * 0.2);
        }

    } else {
        // Standard / Alien Fighters
        if (this.config.isAlien) {
            // Aliens: ENERGY ONLY. Max 2 weapons.
            const exotics = EXOTIC_WEAPONS.map(w => w.id);
            const useExotic = diff >= 7 && (quadrant === QuadrantType.GAMA || quadrant === QuadrantType.DELTA) && Math.random() < 0.2;
            const weaponId = useExotic ? exotics[Math.floor(Math.random() * exotics.length)] : (diff >= 5 ? 'gun_photon' : 'gun_pulse');

            if (this.config.wingStyle === 'alien-a') {
                this.equippedWeapons[0] = { id: weaponId, count: 1 };
            } else {
                this.equippedWeapons[1] = { id: weaponId, count: 1 };
                this.equippedWeapons[2] = { id: weaponId, count: 1 };
            }
        } else {
            // Standard Ships: MECH or ENERGY
            let weaponMode: 'mech' | 'energy' = 'mech';
            if (quadrant === QuadrantType.ALFA) weaponMode = 'mech';
            else if (quadrant === QuadrantType.BETA) weaponMode = 'energy';
            else weaponMode = Math.random() > 0.5 ? 'mech' : 'energy';

            if (weaponMode === 'mech') {
                // MECH: Wings Only (Slots 1 & 2). 
                const weaponId = diff >= 5 ? 'gun_heavy' : 'gun_vulcan';
                this.equippedWeapons[1] = { id: weaponId, count: 1 };
                this.equippedWeapons[2] = { id: weaponId, count: 1 };
                this.equippedWeapons[0] = null; // Ensure Slot 0 is null
            } else {
                // ENERGY: Nose (Slot 0) OR Wings (Slots 1 & 2)
                const weaponId = diff >= 5 ? 'gun_photon' : 'gun_pulse';
                if (Math.random() > 0.5) {
                    this.equippedWeapons[0] = { id: weaponId, count: 1 }; // Nose
                    this.equippedWeapons[1] = null;
                    this.equippedWeapons[2] = null;
                } else {
                    this.equippedWeapons[1] = { id: weaponId, count: 1 }; // Wings
                    this.equippedWeapons[2] = { id: weaponId, count: 1 };
                    this.equippedWeapons[0] = null;
                }
            }
        }

        // Shields
        const baseShieldCap = 150 * diff;
        if (quadrant === QuadrantType.BETA) {
            this.shieldLayers.push({ color: '#ef4444', max: baseShieldCap, current: baseShieldCap, rotation: 0, wobble: 0, type: 'front', rotSpeed: 0 });
        } else if (quadrant === QuadrantType.GAMA) {
            this.shieldLayers.push({ color: '#3b82f6', max: baseShieldCap, current: baseShieldCap, rotation: 0, wobble: 0, type: 'front', rotSpeed: 0 });
            this.shieldLayers.push({ color: '#f97316', max: baseShieldCap * 0.8, current: baseShieldCap * 0.8, rotation: Math.PI, wobble: 0, type: 'tri', rotSpeed: 0.03 });
        } else if (quadrant === QuadrantType.DELTA) {
            this.shieldLayers.push({ color: '#a855f7', max: baseShieldCap * 1.5, current: baseShieldCap * 1.5, rotation: 0, wobble: 0, type: 'tri', rotSpeed: 0.04 });
            this.shieldLayers.push({ color: '#ffffff', max: baseShieldCap * 1.2, current: baseShieldCap * 1.2, rotation: Math.PI/3, wobble: 0, type: 'hex', rotSpeed: -0.03 });
        } else if (diff >= 4) {
            this.shieldLayers.push({ color: '#3b82f6', max: baseShieldCap, current: baseShieldCap, rotation: 0, wobble: 0, type: 'full', rotSpeed: 0 });
        }
    }
  }

  update(px: number, py: number, w: number, h: number, incomingFire: Projectile[], worldSpeedFactor: number = 1.0, bulletsRef: Projectile[], particlesRef: Particle[], difficulty: number, otherEnemies: Enemy[], speedMult: number = 1.0, playerShieldsActive: boolean = false) {
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
        // --- HELPER: SPAWN BULLET ---
        const spawnBullet = (x: number, y: number, wDef: any, speed: number, angles: number[]) => {
            angles.forEach(deg => {
                const rad = deg * (Math.PI / 180);
                const bvx = Math.sin(rad) * speed;
                const bvy = Math.cos(rad) * speed; 

                // Muzzle Flash
                if (wDef.type === WeaponType.PROJECTILE || wDef.id.includes('flamer') || wDef.id.includes('vulcan') || wDef.id.includes('heavy')) {
                    particlesRef.push({
                        x: x, y: y + 10, vx: 0, vy: 2, life: 0.2, size: 6, color: '#facc15', type: 'fire'
                    });
                }

                if (wDef.id === 'exotic_octo_burst') {
                    bulletsRef.push({ x, y, vx: bvx, vy: bvy, damage: wDef.damage, color: OCTO_COLORS[0], type: 'octo_shell', life: 80, isEnemy: true, width: 8, height: 8, glow: true, glowIntensity: 15, weaponId: wDef.id });
                } 
                else if (wDef.id === 'exotic_rainbow_spread') {
                    bulletsRef.push({ x, y, vx: bvx, vy: bvy, damage: wDef.damage, color: '#fff', type: 'projectile', life: 70, isEnemy: true, width: 6, height: 12, weaponId: wDef.id });
                }
                else {
                    const bType = wDef.type === WeaponType.LASER ? 'laser' : 'projectile';
                    bulletsRef.push({ x, y, vx: bvx, vy: bvy, damage: wDef.damage, color: wDef.beamColor || '#f00', type: bType, life: 60, isEnemy: true, width: 6, height: 16, weaponId: wDef.id });
                }
            });
            
            // Audio Trigger
            let sfx = 'cannon';
            if (wDef.type === WeaponType.LASER) sfx = 'laser';
            if (wDef.id.includes('exotic')) sfx = 'exotic_plasma';
            audioService.playWeaponFire(sfx, 0);
        };

        if (this.type === 'boss') {
            // ... Boss Logic ...
            if (this.shieldLayers.length > 0 && this.shieldRegen > 0 && this.shieldDisabledUntil <= 0) {
                const top = this.shieldLayers[0];
                if (top.current < top.max && this.energy > 0.5) {
                    top.current = Math.min(top.max, top.current + this.shieldRegen);
                    this.energy -= 0.1;
                }
            }

            if (this.quadrant !== QuadrantType.ALFA) {
                const distToPlayer = Math.hypot(this.x - px, this.y - py);
                if (playerShieldsActive && distToPlayer < 350) {
                    if (Math.abs(this.targetZ) < 10) this.targetZ = Math.random() > 0.5 ? 200 : -200;
                } else if (distToPlayer > 450) {
                    this.targetZ = 0;
                }
                this.z += (this.targetZ - this.z) * 0.05;
            }

            if (this.fuel <= 0) {
                this.isThrusting = false;
                this.vx *= 0.98;
                this.vy = (this.vy * 0.98) + 0.05;
            } else {
                let desiredVx = 0;
                let desiredVy = 0;
                let dodging = false;
                
                this.maneuverTimer--;
                if (this.maneuverTimer <= 0) {
                    if (this.maneuverState === 'idle') {
                        const roll = Math.random();
                        if (roll < 0.4) { this.maneuverState = 'charge'; this.maneuverTimer = 180; }
                        else if (roll < 0.7) { this.maneuverState = 'flank'; this.maneuverTimer = 120; this.targetX = this.x < w/2 ? w - 100 : 100; }
                        else { this.maneuverState = 'idle'; this.maneuverTimer = 60; }
                    } else if (this.maneuverState === 'charge') {
                        this.maneuverState = 'retreat'; this.maneuverTimer = 120;
                    } else if (this.maneuverState === 'flank' || this.maneuverState === 'retreat') {
                        this.maneuverState = 'idle'; this.maneuverTimer = 60;
                    }
                }

                if (this.quadrant === QuadrantType.ALFA) {
                    this.targetY = h * 0.15; 
                    desiredVx = (px - this.x) * 0.05; 
                    desiredVy = (this.targetY - this.y) * 0.1;
                } else {
                    if (this.maneuverState === 'idle') { this.targetY = h * 0.15; desiredVx = (px - this.x) * 0.03; } 
                    else if (this.maneuverState === 'charge') { this.targetY = h * 0.5; desiredVx = (px - this.x) * 0.05; }
                    else if (this.maneuverState === 'retreat') { this.targetY = h * 0.15; desiredVx = (this.x < w/2 ? -1 : 1) * 3; }
                    else if (this.maneuverState === 'flank') { this.targetY = h * 0.25; desiredVx = (this.targetX - this.x) * 0.05; }
                    desiredVy = (this.targetY - this.y) * 0.05;
                }

                const distToPlayer = Math.hypot(this.x - px, this.y - py);
                const avoidRadius = playerShieldsActive ? 250 : 200;
                
                if (Math.abs(this.z) < 50 && distToPlayer < avoidRadius) {
                    dodging = true;
                    const pushX = this.x - px;
                    const pushY = this.y - py;
                    const mag = Math.max(1, Math.hypot(pushX, pushY));
                    const strength = 5 * (1 - (distToPlayer / avoidRadius));
                    desiredVx += (pushX / mag) * strength * 2;
                    desiredVy += (pushY / mag) * strength * 2;
                    this.fuel -= 0.05; 
                }

                const accel = 0.08;
                this.vx = this.vx + (desiredVx - this.vx) * accel;
                this.vy = this.vy + (desiredVy - this.vy) * accel;
                this.isThrusting = (Math.abs(desiredVx) > 0.5 || desiredVy > 0.5 || dodging);
            }

            const margin = 60;
            if (this.x < margin) { this.x = margin; this.vx *= -0.5; }
            if (this.x > w - margin) { this.x = w - margin; this.vx *= -0.5; }
            
            let limitY = h * 0.6;
            if (this.quadrant === QuadrantType.ALFA) limitY = h * 0.25;
            if (this.y < margin) { this.y = margin; this.vy *= -0.5; }
            if (this.y > limitY) { this.y = limitY; this.vy *= -0.5; }

            // Boss Fire
            const baseInterval = 60;
            const interval = this.quadrant === QuadrantType.DELTA ? Math.floor(baseInterval * 0.8) : baseInterval;
            
            if (this.missileAmmo > 0 && this.tick % 180 === 0 && Math.hypot(px - this.x, py - this.y) > 300) {
                bulletsRef.push({ 
                    x: this.x, y: this.y + 40, vx: 0, vy: 5, 
                    damage: 150, color: '#ef4444', type: 'missile_enemy', life: 400, isEnemy: true, 
                    width: 12, height: 24, homingState: 'searching', launchTime: this.tick, 
                    headColor: '#ef4444', finsColor: '#7f1d1d', turnRate: 0.04, maxSpeed: 9, z: 0 
                });
                this.missileAmmo--;
                audioService.playWeaponFire('missile', 0);
            }

            if (this.mineAmmo > 0 && this.tick % 120 === 0 && this.quadrant === QuadrantType.DELTA) {
                const dir = px > this.x ? 1 : -1;
                bulletsRef.push({ 
                    x: this.x + (dir * 40), y: this.y + 20, vx: dir * 8, vy: 0, damage: 200, color: '#fbbf24', type: 'mine_enemy', life: 600, isEnemy: true, width: 24, height: 24, z: 0, homingState: 'searching', turnRate: 0.03, maxSpeed: 7, launchTime: this.tick
                });
                this.mineAmmo--;
                audioService.playWeaponFire('mine', 0);
            }

            if (this.tick % interval === 0) {
                const fireWeapon = (slot: number) => {
                    const wDef = this.equippedWeapons[slot] ? [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === this.equippedWeapons[slot]!.id) : null;
                    if (!wDef) return;
                    if (this.energy < 2.0) return; 
                    this.energy -= 2.0;

                    let angles = [0];
                    if (this.config.wingStyle === 'alien-a' && slot === 0) angles = [-15, 0, 15];
                    
                    // Logic to find firing point
                    let originX = this.x;
                    let originY = this.y + 40; 
                    const shipScale = 0.5;

                    if (slot > 0) {
                        const mounts = getWingMounts(this.config);
                        const mount = mounts[slot - 1]; 
                        if (mount) {
                            // Convert Visual Coords (Center 50,50) to World
                            // Local (mx, my). Ship rotated 180 degrees.
                            // Visual pos = Center - (Offset * Scale)
                            // Offset = mx - 50, my - 50.
                            const dx = mount.x - 50;
                            const dy = mount.y - 50;
                            originX = this.x - (dx * shipScale);
                            originY = this.y - (dy * shipScale);
                        }
                    } else {
                        // Slot 0 (Nose)
                        // Local Nose Y ~ 20. Rotated 180 = -30 relative to center visually.
                        // Wait, rotate 180: Top (0) becomes Bottom.
                        // Visual Y increases downwards.
                        // If ship is at (0,0), nose at (0, -30) rotated 180 becomes (0, +30).
                        originY = this.y + (30 * shipScale);
                    }

                    spawnBullet(originX, originY, wDef, 15, angles);
                }

                if (this.config.wingStyle === 'alien-a') {
                    if (this.equippedWeapons[0]) fireWeapon(0);
                } else {
                    if (this.equippedWeapons[1]) fireWeapon(1);
                    if (this.equippedWeapons[2]) fireWeapon(2);
                }
            }

        } else {
            // --- STANDARD ENEMY LOGIC ---
            this.isThrusting = true;
            this.y += verticalSpeed; 

            if (this.movementPattern === 'z') { const cycle = Math.floor(this.tick / 60) % 2; this.vx = cycle === 0 ? 3 : -3; } 
            else if (this.movementPattern === 'mirror_z') { const cycle = Math.floor(this.tick / 60) % 2; this.vx = cycle === 0 ? -3 : 3; } 
            else if (this.movementPattern === 'cross_left') { this.vx = 2.5; } 
            else if (this.movementPattern === 'cross_right') { this.vx = -2.5; } 
            else if (this.movementPattern === 'avoid') { this.vx += (Math.sin(this.tick * 0.05 + this.squadId) * 0.5); const distToPlayer = this.x - px; if (Math.abs(distToPlayer) < 200 && this.y < py) { this.vx += (distToPlayer > 0 ? 0.8 : -0.8); } this.vx *= 0.92; } 
            else { this.vx = (this.vx + (Math.random() - 0.5) * 0.5) * 0.95; }

            let desiredZ = 0;
            const safeDistance = 140; 
            let sepX = 0; 
            let sepZ = 0;

            const distToPlayer = Math.hypot(this.x - px, this.y - py);
            const collisionThreshold = 220; 
            
            if (distToPlayer < collisionThreshold && this.y < py + 100 && Math.abs(this.x - px) < 80) {
                 const avoidDir = (this.squadId % 2 === 0) ? 1 : -1;
                 desiredZ = avoidDir * 200; 
            }

            otherEnemies.forEach(other => { 
                if (other === this) return; 
                if (other.y < -50) return; 
                const dist = Math.hypot(this.x - other.x, this.y - other.y); 
                if (dist < safeDistance && dist > 0) { 
                    const angle = Math.atan2(this.y - other.y, this.x - other.x); 
                    const force = (safeDistance - dist) / safeDistance; 
                    sepX += Math.cos(angle) * force * 2.0; 
                    if (Math.abs(this.z - other.z) < 60) sepZ += (this.z > other.z ? 1 : -1) * force * 10;
                } 
                if (this.quadrant === QuadrantType.DELTA) { 
                    if (Math.abs(this.x - other.x) < 50 && Math.abs(this.y - other.y) < 50) { 
                        const avoidSpeed = 2.0 * speedMult; 
                        this.y += (this.y > other.y ? avoidSpeed : -avoidSpeed); 
                    } 
                } 
            }); 
            
            this.vx += sepX;
            if (this.x < 50) this.vx += 1; if (this.x > w - 50) this.vx -= 1;
            
            if (this.y > h * 0.5 && Math.abs(this.z) < 50) { 
                incomingFire.forEach(b => { 
                    if (!b.isEnemy && Math.abs(b.y - this.y) < 150 && Math.abs(b.x - this.x) < 50) { 
                        this.vx += (this.x < b.x ? -1 : 1) * 0.4; 
                    } 
                }); 
            }

            this.targetZ = desiredZ + sepZ;
            this.z += (this.targetZ - this.z) * 0.05;

            // --- STANDARD FIRE PATTERN ---
            let fireInterval = 180; 
            if (this.quadrant === QuadrantType.BETA) fireInterval = 140;
            if (this.quadrant === QuadrantType.GAMA) fireInterval = 90; 
            if (this.quadrant === QuadrantType.DELTA) fireInterval = 45; 
            if (this.config.isAlien) fireInterval = Math.floor(fireInterval * 0.8);

            // Fire Logic
            if (Math.abs(this.x - px) < 300) {
                this.equippedWeapons.forEach((w, slotIdx) => {
                    if (!w) return;
                    
                    const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id);
                    if (!wDef) return;

                    const isExotic = wDef.id.includes('exotic');
                    if (isExotic && this.tick % (fireInterval * 2) !== 0) return;
                    if (!isExotic && this.tick % fireInterval !== 0) return;

                    let shouldFire = true;
                    if (slotIdx === 1 || slotIdx === 2) {
                        const pattern = Math.floor(this.tick / fireInterval) % 3;
                        if (pattern === 0) shouldFire = (slotIdx === 1); 
                        else if (pattern === 1) shouldFire = (slotIdx === 2); 
                        else shouldFire = true;
                    }

                    if (shouldFire) {
                        const shipScale = 0.5;
                        let originX = this.x;
                        let originY = this.y + 20;

                        if (slotIdx === 0) {
                            // Nose (Slot 0)
                            // Standard Ship Nose: ~30px offset from center when rotated 180 (Bottom)
                            originY = this.y + (30 * shipScale);
                        } else {
                            // Wings (Slot 1 & 2)
                            const mounts = getWingMounts(this.config);
                            const mount = mounts[slotIdx - 1]; 
                            if (mount) {
                                // Transform Local to World (Rotated 180)
                                const dx = mount.x - 50;
                                const dy = mount.y - 50;
                                originX = this.x - (dx * shipScale);
                                originY = this.y - (dy * shipScale);
                            }
                        }

                        spawnBullet(originX, originY, wDef, isExotic ? 12 : 8, [0]);
                    }
                });
            }
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
