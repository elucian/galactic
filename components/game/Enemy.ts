
import { EquippedWeapon, QuadrantType } from '../../types';
import { ExtendedShipConfig, EXOTIC_SHIELDS, EXOTIC_WEAPONS } from '../../constants';
import { ShieldLayer, Projectile } from './types';
import { calculateDamage } from './utils';
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
        const weaponId = this.config.weaponId || EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)].id;
        
        this.equippedWeapons[0] = { id: weaponId, count: 1 };
        this.equippedWeapons[1] = { id: weaponId, count: 1 };
        this.equippedWeapons[2] = { id: weaponId, count: 1 };

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
            if (this.config.defaultGuns === 1) {
                this.equippedWeapons[0] = { id: wId, count: 1 };
            } else {
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

  update(px: number, py: number, w: number, h: number, incomingFire: Projectile[], worldSpeedFactor: number = 1.0, bulletsRef: Projectile[], difficulty: number, otherEnemies: Enemy[]) {
    this.tick++;
    if (this.vibration > 0) this.vibration = Math.max(0, this.vibration - 1);
    
    if (this.stunnedUntil > 0) this.stunnedUntil--;
    if (this.shieldDisabledUntil > 0) this.shieldDisabledUntil--;

    const verticalSpeed = (this.quadrant === QuadrantType.DELTA && this.type !== 'boss' ? 1.8 : 2.8) * worldSpeedFactor;

    if (this.stunnedUntil > 0) {
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.vy += 0.5 * worldSpeedFactor; 
    } else {
        if (this.type === 'boss') {
            if (this.shieldLayers.length > 0 && this.shieldRegen > 0 && this.shieldDisabledUntil <= 0) {
                const top = this.shieldLayers[0];
                if (top.current < top.max) top.current = Math.min(top.max, top.current + this.shieldRegen);
            }
            if (this.quadrant === QuadrantType.ALFA) {
                this.vx = (this.vx + (px - this.x) * 0.002) * 0.96;
                this.vy = (this.vy + (150 - this.y) * 0.01) * 0.92;
            } else if (this.quadrant === QuadrantType.BETA) {
                const time = this.tick * 0.02;
                const targetX = w/2 + Math.sin(time) * (w * 0.4);
                this.vx = (targetX - this.x) * 0.03;
                this.vy = (this.vy + (180 - this.y) * 0.01) * 0.92;
            } else if (this.quadrant === QuadrantType.GAMA) {
                if (this.tick % 120 < 60) { this.vx = (px - this.x) * 0.05; } else { this.vx *= 0.8; }
                this.vy = (this.vy + (150 - this.y) * 0.01) * 0.92;
            } else if (this.quadrant === QuadrantType.DELTA) {
                const dx = px - this.x;
                if (Math.abs(dx) < 100 && this.tick % 60 === 0) {
                     this.vx = (Math.random() > 0.5 ? 8 : -8) * (Math.random() + 0.5);
                } else if (this.tick % 90 === 0) {
                     this.vx = (Math.random() - 0.5) * 12;
                }
                this.vx *= 0.96;
                this.vy = (this.vy + (180 - this.y) * 0.05) * 0.9;
            }
            
            // Boss Shooting Logic
            if (Math.random() < 0.02) { 
                if (difficulty >= 8 && this.tick % 300 === 0) {
                    bulletsRef.push({ x: this.x - 40, y: this.y + 40, vx: -3, vy: 5, damage: 100, color: '#ef4444', type: 'missile_enemy', life: 400, isEnemy: true, width: 14, height: 28, homingState: 'searching', launchTime: this.tick, headColor: '#ef4444', finsColor: '#991b1b', turnRate: 0.03, maxSpeed: 10, z: 0 });
                    bulletsRef.push({ x: this.x + 40, y: this.y + 40, vx: 3, vy: 5, damage: 100, color: '#ef4444', type: 'missile_enemy', life: 400, isEnemy: true, width: 14, height: 28, homingState: 'searching', launchTime: this.tick, headColor: '#ef4444', finsColor: '#991b1b', turnRate: 0.03, maxSpeed: 10, z: 0 });
                    audioService.playWeaponFire('missile', 0);
                }
                if (difficulty >= 10 && this.tick % 450 === 0) {
                    bulletsRef.push({ x: this.x, y: this.y + 60, vx: 0, vy: 2, damage: 150, color: '#fbbf24', type: 'mine_enemy', life: 600, isEnemy: true, width: 20, height: 20, z: 0 });
                    audioService.playWeaponFire('mine', 0);
                }
            }

        } else {
            // --- PATTERN LOGIC ---
            this.y += verticalSpeed; 

            if (this.movementPattern === 'z') {
                const cycle = Math.floor(this.tick / 60) % 2; 
                this.vx = cycle === 0 ? 3 : -3;
            } else if (this.movementPattern === 'mirror_z') {
                const cycle = Math.floor(this.tick / 60) % 2; 
                this.vx = cycle === 0 ? -3 : 3;
            } else if (this.movementPattern === 'cross_left') {
                this.vx = 2.5; 
            } else if (this.movementPattern === 'cross_right') {
                this.vx = -2.5;
            } else if (this.movementPattern === 'avoid') {
                this.vx += (Math.sin(this.tick * 0.05 + this.squadId) * 0.5);
                const distToPlayer = this.x - px;
                if (Math.abs(distToPlayer) < 200 && this.y < py) {
                     this.vx += (distToPlayer > 0 ? 0.8 : -0.8);
                }
                this.vx *= 0.92;
            } else {
                this.vx = (this.vx + (Math.random() - 0.5) * 0.5) * 0.95; 
            }

            // --- SEPARATION STEERING ---
            const safeDistance = 130; 
            let sepX = 0;
            otherEnemies.forEach(other => {
                if (other === this) return;
                if (other.y < -50) return;
                
                const dist = Math.hypot(this.x - other.x, this.y - other.y);
                if (dist < safeDistance && dist > 0) {
                    const angle = Math.atan2(this.y - other.y, this.x - other.x);
                    const force = (safeDistance - dist) / safeDistance; 
                    sepX += Math.cos(angle) * force * 1.5; 
                }
            });
            this.vx += sepX;

            if (this.x < 50) this.vx += 1;
            if (this.x > w - 50) this.vx -= 1;
            
            if (this.y > h * 0.5 && Math.abs(this.z) < 50) {
                incomingFire.forEach(b => {
                    if (!b.isEnemy && Math.abs(b.y - this.y) < 150 && Math.abs(b.x - this.x) < 50) {
                        this.vx += (this.x < b.x ? -1 : 1) * 0.4; 
                    }
                });
            }
        }
    }
    
    this.x += this.vx; this.y += this.vy;
    
    this.shieldLayers.forEach((l, i) => {
        l.rotation += l.rotSpeed; 
        if (l.wobble > 0) l.wobble = Math.max(0, l.wobble - 0.1);
    });
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

  takeDamage(amount: number, type: string, isMain: boolean, isOvercharge: boolean = false, isEmp: boolean = false, hitAngle: number = 0): { dmg: number, isShield: boolean } {
      const shieldIdx = this.getHitShieldIndex(hitAngle);
      if (shieldIdx !== -1) {
          this.damageShield(shieldIdx, amount, type, isMain, isOvercharge, isEmp);
          return { dmg: amount, isShield: true };
      } else {
          this.damageHull(amount, type, isMain, isOvercharge);
          return { dmg: amount, isShield: false };
      }
  }
}
