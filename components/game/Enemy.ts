
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
  
  // Visual State for Firing
  weaponFireTimes: Record<number, number> = {};
  weaponHeat: Record<number, number> = {};

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
  
  // Burst Fire Properties
  burstRemaining: number = 0; 
  burstTimer: number = 0;
  burstSlot: number = 0;
  
  // Cooldown to ensure mutually exclusive firing and pauses
  globalWeaponCooldown: number = 0;
  
  isOrdnanceShip: boolean = false; 
  hasFiredInitialSalvo: boolean = false;
  hasFiredBottomMines: boolean = false;

  // Resource System for Boss
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

    if (type === 'boss') {
        this.movementPattern = 'boss_trick';
        this.config.isAlien = true;
        
        this.maxFuel = 10 + (diff * 2); 
        this.fuel = this.maxFuel;
        this.maxEnergy = 2000 + (diff * 500);
        this.energy = this.maxEnergy;
        
        this.missileAmmo = Math.min(20, 5 + Math.floor(diff * 1.5));
        this.mineAmmo = Math.min(30, 10 + Math.floor(diff * 2));

        let weaponOptions: string[] = [];
        if (quadrant === QuadrantType.ALFA) weaponOptions = ['exotic_plasma_orb', 'exotic_flamer'];
        else if (quadrant === QuadrantType.BETA) weaponOptions = ['exotic_plasma_orb', 'exotic_flamer', 'exotic_octo_burst'];
        else if (quadrant === QuadrantType.GAMA) weaponOptions = ['exotic_gravity_wave', 'exotic_octo_burst', 'exotic_wave'];
        else if (quadrant === QuadrantType.DELTA) {
            if (diff >= 12) {
                this.config.wingStyle = 'alien-a';
                this.config.name = 'Omega A-Type';
                this.config.defaultGuns = 1; 
            }
            weaponOptions = ['exotic_electric', 'exotic_rainbow_spread', 'exotic_phaser_sweep', 'exotic_star_shatter'];
        }

        const selectedId = weaponOptions[Math.floor(Math.random() * weaponOptions.length)];
        this.config.weaponId = selectedId;
        
        if (this.config.wingStyle === 'alien-a') {
            this.equippedWeapons[0] = { id: selectedId, count: 1 };
        } else {
            this.equippedWeapons[1] = { id: selectedId, count: 1 };
            this.equippedWeapons[2] = { id: selectedId, count: 1 };
        }

        let addShields = true;
        if (quadrant === QuadrantType.ALFA && diff <= 1) addShields = false;

        if (addShields) {
            let s1Type: 'full'|'front'|'tri'|'hex' = 'full';
            let s1Rot = 0;
            let s2Type: 'full'|'front'|'tri'|'hex' = 'full';
            let s2Rot = 0.02;

            if (diff >= 12 || quadrant === QuadrantType.DELTA) {
                s1Type = 'hex'; s1Rot = 0.05;
                s2Type = 'full'; s2Rot = 0;
            } else if (quadrant === QuadrantType.GAMA) {
                s1Type = 'front'; s1Rot = 0;
                s2Type = 'tri'; s2Rot = -0.03;
            } else if (quadrant === QuadrantType.BETA) {
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
        }

    } else {
        // --- STANDARD ENEMY WEAPON SETUP ---
        this.equippedWeapons = [null, null, null];

        // DETERMINE WEAPON TIER BASED ON DIFFICULTY
        let tier = 0;
        if (diff >= 10) tier = 3;
        else if (diff >= 7) tier = 2;
        else if (diff >= 4) tier = 1;

        const energyWeapons = ['gun_pulse', 'gun_bolt', 'gun_photon', 'gun_photon'];
        const kineticWeapons = ['gun_vulcan', 'gun_repeater', 'gun_heavy', 'gun_plasma'];

        // Chance to be a Bomber (Ordnance Ship) - No guns, just mines/missiles
        const bomberChance = this.config.isAlien ? 0.25 : 0.1;
        const isOrdnanceOnly = Math.random() < bomberChance; 
        
        if (isOrdnanceOnly) {
            this.isOrdnanceShip = true;
            this.mineAmmo = 20 + Math.floor(diff * 2);
            this.missileAmmo = 5 + Math.floor(diff);
        } 
        else {
            this.isOrdnanceShip = false;
            
            // WEAPON SELECTION
            // Slot 0: Energy
            // Slot 1 & 2: Kinetic
            
            let mainWepId = 'gun_pulse';
            let kineticWepId = 'gun_vulcan';

            if (this.config.isAlien) {
                // Exotic/Alien Weapons
                let wOptions = [...EXOTIC_WEAPONS.filter(w => w.price < 500000)]; 
                const selected = wOptions[Math.floor(Math.random() * wOptions.length)] || EXOTIC_WEAPONS[0];
                mainWepId = selected.id;
                kineticWepId = selected.id; // Aliens often use uniform loadouts
            } else {
                // Standard Human Weapons
                mainWepId = energyWeapons[tier] || 'gun_pulse';
                kineticWepId = kineticWeapons[tier] || 'gun_vulcan';
            }

            // Setup Slots
            this.equippedWeapons[0] = { id: mainWepId, count: 1 };
            
            if (this.config.defaultGuns > 1 || this.config.wingStyle !== 'alien-a') {
                this.equippedWeapons[1] = { id: kineticWepId, count: 1 };
                this.equippedWeapons[2] = { id: kineticWepId, count: 1 };
            }
        }

        // Shield Logic by Quadrant
        const baseShieldCap = 150 * diff;
        if (quadrant === QuadrantType.BETA) {
            this.shieldLayers.push({ color: '#ef4444', max: baseShieldCap, current: baseShieldCap, rotation: 0, wobble: 0, type: 'front', rotSpeed: 0 });
        } else if (quadrant === QuadrantType.GAMA) {
            this.shieldLayers.push({ color: '#3b82f6', max: baseShieldCap, current: baseShieldCap, rotation: 0, wobble: 0, type: 'front', rotSpeed: 0 });
            const secondType = Math.random() > 0.5 ? 'full' : 'tri';
            const rot = secondType === 'tri' ? 0.03 : 0;
            this.shieldLayers.push({ color: '#f97316', max: baseShieldCap * 0.8, current: baseShieldCap * 0.8, rotation: Math.random() * Math.PI, wobble: 0, type: secondType, rotSpeed: rot });
        } else if (quadrant === QuadrantType.DELTA) {
            const type1 = Math.random() > 0.5 ? 'tri' : 'hex';
            const type2 = Math.random() > 0.5 ? 'tri' : 'hex';
            this.shieldLayers.push({ color: '#a855f7', max: baseShieldCap * 1.5, current: baseShieldCap * 1.5, rotation: 0, wobble: 0, type: type1, rotSpeed: 0.04 });
            this.shieldLayers.push({ color: '#ffffff', max: baseShieldCap * 1.2, current: baseShieldCap * 1.2, rotation: Math.PI/3, wobble: 0, type: type2, rotSpeed: -0.03 });
        } else if (diff >= 4) {
            this.shieldLayers.push({ color: '#3b82f6', max: baseShieldCap, current: baseShieldCap, rotation: 0, wobble: 0, type: 'full', rotSpeed: 0 });
        }
    }
  }

  fire(slot: number, bulletsRef: Projectile[], globalFrame: number) {
      const w = this.equippedWeapons[slot];
      if (!w) return;
      const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id);
      if (!def) return;
      
      const isLaser = def.type === WeaponType.LASER;
      const isExotic = def.id.includes('exotic');
      
      let speed = isLaser ? 20 : 12; 
      let width = isLaser ? 4 : 6;
      let height = isLaser ? 25 : 16;
      let type = isLaser ? 'laser' : 'projectile';
      let color = def.beamColor || '#f00';

      if (isExotic) {
          speed = 15;
          if (def.id === 'exotic_plasma_orb') { width = 10; height = 10; speed = 14; }
          else if (def.id === 'exotic_flamer') { width = 12; height = 12; speed = 16; color = '#3b82f6'; }
          else if (def.id === 'exotic_octo_burst') { width = 10; height = 10; type = 'octo_shell'; color = OCTO_COLORS[0]; }
          else if (def.id === 'exotic_wave') { width = 12; height = 6; }
          else if (def.id === 'exotic_electric') { type = 'laser'; width = 3; height = 20; color = '#00ffff'; speed = 25; }
      }

      bulletsRef.push({ 
          x: this.x + (slot===1?-25:(slot===2?25:0)),
          y: this.y + 20, 
          vx: 0, 
          vy: speed, 
          damage: def.damage, 
          color: color, 
          type: type, 
          life: 100, 
          isEnemy: true, 
          width: width, 
          height: height,
          glow: isLaser || isExotic,
          glowIntensity: isLaser ? 10 : (isExotic ? 20 : 0),
          weaponId: def.id,
          launchTime: globalFrame // Use global frame
      });
      
      if (isExotic) audioService.playWeaponFire('exotic_single', 0);
      else audioService.playWeaponFire(isLaser ? 'laser' : 'cannon', 0, def.id); 

      this.weaponFireTimes[slot] = Date.now();
      this.weaponHeat[slot] = 100;
  }

  update(px: number, py: number, w: number, h: number, incomingFire: Projectile[], worldSpeedFactor: number = 1.0, bulletsRef: Projectile[], difficulty: number, otherEnemies: Enemy[], speedMult: number = 1.0, playerShieldsActive: boolean = false, globalFrame: number) {
    this.tick++;
    if (this.vibration > 0) this.vibration = Math.max(0, this.vibration - 1);
    
    if (this.stunnedUntil > 0) this.stunnedUntil--;
    if (this.shieldDisabledUntil > 0) this.shieldDisabledUntil--;
    
    if (this.globalWeaponCooldown > 0) this.globalWeaponCooldown--;

    Object.keys(this.weaponHeat).forEach(k => {
        const key = parseInt(k);
        if (this.weaponHeat[key] > 0) {
            this.weaponHeat[key] = Math.max(0, this.weaponHeat[key] - 5);
        }
    });

    const verticalSpeed = (this.quadrant === QuadrantType.DELTA && this.type !== 'boss' ? 1.8 : 2.8) * worldSpeedFactor * speedMult;

    const distToPlayer = Math.hypot(this.x - px, this.y - py);
    const avoidanceRadius = (this.type === 'boss' ? 120 : 60) + 80; 

    if (distToPlayer < avoidanceRadius) {
        if (Math.abs(this.z) < 20) {
            this.targetZ = Math.random() > 0.5 ? 200 : -200;
        }
    } else {
        if (this.type !== 'boss' || distToPlayer > 450) {
            this.targetZ = 0;
        }
    }
    this.z += (this.targetZ - this.z) * 0.05;


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
                if (top.current < top.max && this.energy > 0.5) {
                    top.current = Math.min(top.max, top.current + this.shieldRegen);
                    this.energy -= 0.1;
                }
            }

            if (this.fuel <= 0) {
                this.isThrusting = false; this.vx *= 0.98; this.vy = (this.vy * 0.98) + 0.05;
            } else {
                let desiredVx = 0; let desiredVy = 0; let dodging = false;
                
                this.maneuverTimer--;
                if (this.maneuverTimer <= 0) {
                    if (this.maneuverState === 'idle') {
                        const roll = Math.random();
                        if (roll < 0.4) { this.maneuverState = 'charge'; this.maneuverTimer = 180; } 
                        else if (roll < 0.7) { 
                            this.maneuverState = 'flank'; 
                            this.maneuverTimer = 120; 
                            this.targetX = this.x < w/2 ? w - 150 : 150; 
                        } 
                        else { this.maneuverState = 'idle'; this.maneuverTimer = 60; }
                    } else if (this.maneuverState === 'charge') { this.maneuverState = 'retreat'; this.maneuverTimer = 120; }
                    else if (this.maneuverState === 'flank' || this.maneuverState === 'retreat') { this.maneuverState = 'idle'; this.maneuverTimer = 60; }
                }

                if (this.maneuverState === 'idle') { 
                    this.targetY = h * 0.15; 
                    const dx = px - this.x; 
                    desiredVx = dx * 0.02; 
                } 
                else if (this.maneuverState === 'charge') { 
                    this.targetY = h * 0.5; 
                    const dx = px - this.x; 
                    desiredVx = dx * 0.03; 
                }
                else if (this.maneuverState === 'retreat') { 
                    this.targetY = h * 0.15; 
                    desiredVx = (w/2 - this.x) * 0.03;
                }
                else if (this.maneuverState === 'flank') { 
                    this.targetY = h * 0.25; 
                    const dx = this.targetX - this.x; 
                    desiredVx = dx * 0.04; 
                }
                const dy = this.targetY - this.y; 
                desiredVy = dy * 0.05;

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
                
                const maxSpeed = 8.0; 
                const accel = 0.05; 
                
                this.vx = this.vx + (desiredVx - this.vx) * accel;
                if (this.vx > maxSpeed) this.vx = maxSpeed;
                if (this.vx < -maxSpeed) this.vx = -maxSpeed;
                
                this.vy = this.vy + (desiredVy - this.vy) * accel;
                this.isThrusting = (Math.abs(desiredVx) > 0.5 || desiredVy > 0.5 || dodging);
            }
            
            const edgeMargin = 80;
            if (this.x < edgeMargin) { this.x = edgeMargin; this.vx *= -0.2; }
            if (this.x > w - edgeMargin) { this.x = w - edgeMargin; this.vx *= -0.2; }
            
            let limitY = h * 0.66; 
            if (this.quadrant === QuadrantType.ALFA) limitY = Math.min(limitY, h * 0.4); 

            if (this.y < edgeMargin) { this.y = edgeMargin; this.vy *= -0.5; }
            if (this.y > limitY) { this.y = limitY; this.vy *= -0.5; }

            if (this.globalWeaponCooldown <= 0) {
                const canFireMissile = this.missileAmmo > 0 && distToPlayer > 150;
                const canFireMine = this.mineAmmo > 0 && this.quadrant === QuadrantType.DELTA;
                
                const pMissile = canFireMissile ? 0.02 : 0;
                const pMine = canFireMine ? 0.03 : 0;
                const pGuns = 0.05; 
                
                const roll = Math.random();
                
                if (roll < pMissile) {
                    bulletsRef.push({ x: this.x, y: this.y + 40, vx: 0, vy: 5, damage: 150, color: '#ef4444', type: 'missile_enemy', life: 400, isEnemy: true, width: 12, height: 24, homingState: 'searching', launchTime: globalFrame, headColor: '#ef4444', finsColor: '#7f1d1d', turnRate: 0.04, maxSpeed: 9, z: 0 });
                    this.missileAmmo--;
                    audioService.playWeaponFire('missile', 0);
                    this.globalWeaponCooldown = 120; 
                } 
                else if (roll < pMissile + pMine) {
                    const isDefective = Math.random() < 0.2;
                    const dir = px > this.x ? 1 : -1;
                    bulletsRef.push({ x: this.x + (dir * 40), y: this.y + 20, vx: dir * 8, vy: 0, damage: 200, color: '#fbbf24', type: 'mine_enemy', life: 600, isEnemy: true, width: 24, height: 24, z: 0, homingState: 'searching', turnRate: 0.03, maxSpeed: 7, launchTime: globalFrame, isDefective });
                    this.mineAmmo--;
                    audioService.playWeaponFire('mine', 0);
                    this.globalWeaponCooldown = 120; 
                }
                else if (roll < pMissile + pMine + pGuns) {
                    const fireWeapon = (slot: number) => {
                        const wDef = this.equippedWeapons[slot] ? [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === this.equippedWeapons[slot]!.id) : null;
                        if (!wDef) return;
                        const cost = 2.0; if (this.energy < cost) return; this.energy -= cost;
                        let angles = [0]; let speed = 15;
                        if (wDef.id.includes('exotic')) { if (this.config.wingStyle === 'alien-a' && slot === 0) { angles = [-15, 0, 15]; } else { angles = [0]; } }
                        const originX = slot === 0 ? this.x : (slot === 1 ? this.x - 30 : this.x + 30); const originY = this.y + 40;
                        angles.forEach(deg => {
                            const rad = deg * (Math.PI / 180); const bvx = Math.sin(rad) * speed; const bvy = Math.cos(rad) * speed; 
                            if (wDef.id === 'exotic_octo_burst') { bulletsRef.push({ x: originX, y: originY, vx: bvx, vy: bvy, damage: wDef.damage, color: OCTO_COLORS[0], type: 'octo_shell', life: 80, isEnemy: true, width: 8, height: 8, glow: true, glowIntensity: 15, weaponId: wDef.id, launchTime: globalFrame }); } 
                            else if (wDef.id === 'exotic_rainbow_spread') { bulletsRef.push({ x: originX, y: originY, vx: bvx, vy: bvy, damage: wDef.damage, color: '#fff', type: 'projectile', life: 70, isEnemy: true, width: 6, height: 12, weaponId: wDef.id, launchTime: globalFrame }); }
                            else { bulletsRef.push({ x: originX, y: originY, vx: bvx, vy: bvy, damage: wDef.damage, color: wDef.beamColor || '#f00', type: 'projectile', life: 60, isEnemy: true, width: 6, height: 16, weaponId: wDef.id, launchTime: globalFrame }); }
                        });
                        this.weaponFireTimes[slot] = Date.now();
                        this.weaponHeat[slot] = 100;
                    }
                    if (this.config.wingStyle === 'alien-a') { if (this.equippedWeapons[0]) fireWeapon(0); } else { if (this.equippedWeapons[1]) fireWeapon(1); if (this.equippedWeapons[2]) fireWeapon(2); }
                    audioService.playWeaponFire('exotic_single', 0);
                    this.globalWeaponCooldown = 30; 
                }
            }

        } else {
            this.isThrusting = true; 
            this.y += verticalSpeed; 
            if (this.movementPattern === 'z') { const cycle = Math.floor(this.tick / 60) % 2; this.vx = cycle === 0 ? 3 : -3; } 
            else if (this.movementPattern === 'mirror_z') { const cycle = Math.floor(this.tick / 60) % 2; this.vx = cycle === 0 ? -3 : 3; } 
            else if (this.movementPattern === 'cross_left') { this.vx = 2.5; } 
            else if (this.movementPattern === 'cross_right') { this.vx = -2.5; } 
            else if (this.movementPattern === 'avoid') { this.vx += (Math.sin(this.tick * 0.05 + this.squadId) * 0.5); const distToPlayer = this.x - px; if (Math.abs(distToPlayer) < 200 && this.y < py) { this.vx += (distToPlayer > 0 ? 0.8 : -0.8); } this.vx *= 0.92; } 
            else { this.vx = (this.vx + (Math.random() - 0.5) * 0.5) * 0.95; }
            const safeDistance = 130; let sepX = 0; otherEnemies.forEach(other => { if (other === this) return; if (other.y < -50) return; const dist = Math.hypot(this.x - other.x, this.y - other.y); if (dist < safeDistance && dist > 0) { const angle = Math.atan2(this.y - other.y, this.x - other.x); const force = (safeDistance - dist) / safeDistance; sepX += Math.cos(angle) * force * 1.5; } if (this.quadrant === QuadrantType.DELTA) { if (Math.abs(this.x - other.x) < 50 && Math.abs(this.y - other.y) < 50) { const avoidSpeed = 2.0 * speedMult; this.y += (this.y > other.y ? avoidSpeed : -avoidSpeed); } } }); this.vx += sepX;
            
            const intenseCombat = incomingFire.length > 5;
            const margin = intenseCombat ? 50 : 150; 
            
            if (this.x < margin) { this.x = margin; this.vx += 1.0; }
            if (this.x > w - margin) { this.x = w - margin; this.vx -= 1.0; }
            
            if (this.y > h * 0.5 && Math.abs(this.z) < 50) { incomingFire.forEach(b => { if (!b.isEnemy && Math.abs(b.y - this.y) < 150 && Math.abs(b.x - this.x) < 50) { this.vx += (this.x < b.x ? -1 : 1) * 0.4; } }); }

            const fireLimitY = h * 0.66;
            const inFiringZone = this.y < fireLimitY;
            
            const distToPlayer = Math.hypot(this.x - px, this.y - py);
            const safetyRadius = 150; 
            const isSafeRange = distToPlayer > safetyRadius;

            if (this.isOrdnanceShip) {
                const screenPct = this.y / h;
                
                // 1. Top Screen Missile - Only in top 25% (STRICT)
                // Ensures fair play: Missile must be launched visibly from top.
                if (this.y > 0 && screenPct < 0.25 && !this.hasFiredInitialSalvo && this.globalWeaponCooldown <= 0) {
                    this.hasFiredInitialSalvo = true;
                    if (this.missileAmmo > 0) {
                        // Chance for double launch on high difficulty
                        const count = difficulty >= 8 && Math.random() > 0.5 ? 2 : 1;
                        for(let i=0; i<count; i++) {
                            const offset = count === 1 ? 0 : (i === 0 ? -15 : 15);
                            bulletsRef.push({ 
                                x: this.x + offset, 
                                y: this.y + 40, 
                                vx: 0, 
                                vy: 5, 
                                damage: 150, 
                                color: '#ef4444', 
                                type: 'missile_enemy', 
                                life: 900, // 15s lifespan to allow for 10s tracking + 5s drift
                                isEnemy: true, 
                                width: 12, 
                                height: 24, 
                                homingState: 'searching', 
                                launchTime: globalFrame, 
                                headColor: '#ef4444', 
                                finsColor: '#7f1d1d', 
                                turnRate: 0.04, 
                                maxSpeed: 10, // Slightly faster to compensate for limited turn
                                z: 0 
                            });
                        }
                        this.missileAmmo -= count;
                        audioService.playWeaponFire('missile', 0);
                        this.globalWeaponCooldown = 120;
                    }
                }

                // 2. Bottom 1/3 Mines - Only in bottom 33% (STRICT)
                if (screenPct > 0.66 && !this.hasFiredBottomMines && this.globalWeaponCooldown <= 0) {
                    this.hasFiredBottomMines = true;
                    const mineCount = (difficulty >= 5 || Math.random() > 0.5) ? 2 : 1;
                    
                    for(let i=0; i<mineCount; i++) {
                        // Direction: if 1 mine, random side. If 2, spread both ways.
                        const dir = mineCount === 1 ? (Math.random() > 0.5 ? 1 : -1) : (i===0 ? -1 : 1);
                        
                        // Increase life to 1200 (20s) to allow for 10s tracking timeout + subsequent drift
                        bulletsRef.push({ 
                            x: this.x + (dir * 40), 
                            y: this.y + 20, 
                            vx: dir * 6, 
                            vy: 2,       
                            damage: 200, 
                            color: '#fbbf24', 
                            type: 'mine_enemy', 
                            life: 1200, 
                            isEnemy: true, 
                            width: 24, 
                            height: 24, 
                            z: 0, 
                            homingState: 'searching', 
                            turnRate: 0.02, 
                            maxSpeed: 7, 
                            launchTime: globalFrame,
                            isDefective: false
                        });
                    }
                    this.mineAmmo -= mineCount;
                    audioService.playWeaponFire('mine', 0);
                    this.globalWeaponCooldown = 60;
                }
            } 
            else {
                if (this.burstRemaining > 0 && this.globalWeaponCooldown <= 0) {
                    this.burstTimer--;
                    if (this.burstTimer <= 0) {
                        if (this.burstSlot === 99) {
                            if (this.equippedWeapons[1]) this.fire(1, bulletsRef, globalFrame);
                            if (this.equippedWeapons[2]) this.fire(2, bulletsRef, globalFrame);
                        } else {
                            this.fire(this.burstSlot, bulletsRef, globalFrame);
                        }
                        this.burstRemaining--;
                        this.burstTimer = 8; 
                        
                        if (this.burstRemaining <= 0) this.globalWeaponCooldown = 60;
                    }
                }

                let fireInterval = Math.max(40, 140 - (difficulty * 6));
                if (this.config.isAlien) fireInterval = Math.floor(fireInterval * 0.8);

                if (this.tick % fireInterval === 0 && inFiringZone && isSafeRange && this.globalWeaponCooldown <= 0 && this.burstRemaining <= 0) {
                    
                    if (Math.random() < 0.9) {
                        const roll = Math.random();
                        let pEnergy = 0.7;
                        let pMech = 0.2;

                        if (this.quadrant === QuadrantType.GAMA) { pEnergy = 0.6; pMech = 0.3; } 
                        if (this.quadrant === QuadrantType.DELTA) { pEnergy = 0.5; pMech = 0.3; } 

                        if (roll < pEnergy) {
                            if (this.equippedWeapons[0]) {
                                this.fire(0, bulletsRef, globalFrame);
                                this.globalWeaponCooldown = 30; 
                            } else {
                                if (this.equippedWeapons[1] || this.equippedWeapons[2]) {
                                    const w1 = this.equippedWeapons[1];
                                    const def = w1 ? [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w1.id) : null;
                                    if (def && def.type === WeaponType.PROJECTILE && !def.id.includes('exotic')) {
                                        this.burstRemaining = 3;
                                        this.burstSlot = 99; 
                                        this.burstTimer = 0;
                                    } else {
                                        if (this.equippedWeapons[1]) this.fire(1, bulletsRef, globalFrame);
                                        if (this.equippedWeapons[2]) this.fire(2, bulletsRef, globalFrame);
                                        this.globalWeaponCooldown = 40;
                                    }
                                }
                            }
                        } else if (roll < pEnergy + pMech) {
                            const w1 = this.equippedWeapons[1];
                            const w2 = this.equippedWeapons[2];
                            const anyMech = w1 || w2;
                            
                            if (anyMech) {
                                const def = w1 ? [...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w1.id) : null;
                                if (def && def.type === WeaponType.PROJECTILE && !def.id.includes('exotic')) {
                                    this.burstRemaining = 3;
                                    this.burstSlot = 99; 
                                    this.burstTimer = 0;
                                } else {
                                    if (w1) this.fire(1, bulletsRef, globalFrame);
                                    if (w2) this.fire(2, bulletsRef, globalFrame);
                                    this.globalWeaponCooldown = 40;
                                }
                            } else {
                                if (this.equippedWeapons[0]) {
                                    this.fire(0, bulletsRef, globalFrame);
                                    this.globalWeaponCooldown = 30;
                                }
                            }
                        } else {
                            bulletsRef.push({ 
                                x: this.x, y: this.y + 20, vx: 0, vy: 6, 
                                damage: 120 * (1 + difficulty * 0.1), 
                                color: '#ef4444', type: 'missile_enemy', 
                                life: 600, isEnemy: true, width: 12, height: 24, 
                                homingState: 'searching', launchTime: globalFrame, 
                                headColor: '#ef4444', finsColor: '#7f1d1d',
                                turnRate: 0.035, maxSpeed: 9, z: 0
                            });
                            audioService.playWeaponFire('missile', 0);
                            this.globalWeaponCooldown = 90; 
                        }
                    }
                }
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
