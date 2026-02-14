
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, EquippedWeapon, Planet, QuadrantType, CargoItem, PlanetStatusData, AmmoType } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, BOSS_SHIPS, EXOTIC_SHIELDS, SHIELDS } from '../constants.ts';
import { Enemy } from './game/Enemy.ts';
import { Projectile, Particle, Loot, GameEngineState } from './game/types.ts';
import { calculateDamage, getShieldType } from './game/utils.ts';
import { GameHUD } from './game/GameHUD.tsx';
import { fireMissile, fireMine, fireRedMine, firePowerShot, fireNormalShot, fireAlienWeapons, fireWingWeapon, createExplosion, createAreaDamage, takeDamage, applyShieldRamDamage, applyJetDamage, fireBlasterPistol } from './game/CombatMechanics.ts';
import { renderGame } from './game/GameRenderer.ts';
import { ResourceController } from './game/ResourceController.ts';
import { SpawnController } from './game/SpawnController.ts';
import { InputController } from './game/InputController.ts';
import { updateEnemyOrdnance } from './game/GameEngine.tsx';

interface GameEngineProps {
  ships: {
    config: ExtendedShipConfig;
    fitting: ShipFitting;
    color?: string;
    wingColor?: string;
    cockpitColor?: string;
    cockpitHighlightColor?: string;
    gunColor?: string;
    secondaryGunColor?: string;
    gunBodyColor?: string;
    engineColor?: string;
    nozzleColor?: string;
    barColor?: string;
    equippedWeapons?: (EquippedWeapon | null)[];
  }[];
  shield: Shield | null;
  secondShield: Shield | null;
  onGameOver: (success: boolean, score: number, aborted: boolean, payload: any) => void;
  difficulty: number;
  currentPlanet: Planet;
  quadrant: QuadrantType;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  mode?: 'combat' | 'drift';
  planetRegistry?: Record<string, PlanetStatusData>;
  speedMode?: 'slow' | 'normal' | 'fast';
}

export const GameEngine: React.FC<GameEngineProps> = ({ ships, shield, secondShield, onGameOver, difficulty, currentPlanet, quadrant, fontSize, mode = 'combat', speedMode = 'normal' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeShip = ships[0];
  const maxEnergy = activeShip?.config?.maxEnergy || 1000;
  const maxFuel = activeShip?.config?.maxFuel || 1.0;
  const maxWater = activeShip?.config?.maxWater || 100;
  
  const hasAmmoWeapons = activeShip?.fitting.weapons.some(w => {
      if (!w) return false;
      const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === w.id);
      return def?.isAmmoBased;
  });

  const hasGuns = activeShip?.fitting.weapons.some(w => !!w);

  const [hud, setHud] = useState({ 
    hp: 100, sh1: 0, sh2: 0, energy: maxEnergy, score: 0, missiles: 0, mines: 0, redMines: 0, fuel: 0, water: 0,
    alert: mode === 'drift' ? "DRIFTING" : "SYSTEMS READY", alertType: 'info', 
    timer: mode === 'drift' ? 60 : 120, boss: null as any, cargoCount: 0, isPaused: false,
    chargeLevel: 0,
    swivelMode: false,
    ammoCount: 0,
    ammoType: 'iron',
    isReloading: false,
    overload: 0,
    overdrive: false,
    rescueMode: false,
    capacitorLocked: false,
    powerMode: false, 
    shieldsOnline: true,
    activeShield: null as Shield | null,
    activeSecondShield: null as Shield | null,
    bossDead: false 
  });
  
  const [showExitDialog, setShowExitDialog] = useState(false);

  const inputRef = useRef({ main: false, secondary: false });
  const tiltRef = useRef({ beta: 0, gamma: 0 }); 
  const hasTiltRef = useRef(false);
  const targetRef = useRef<{x: number, y: number} | null>(null);

  const state = useRef<GameEngineState>({
    px: window.innerWidth/2, py: window.innerHeight*0.8, hp: 100, fuel: 0, water: 0, energy: maxEnergy, 
    sh1: 0, sh2: 0, score: 0, time: mode === 'drift' ? 60 : 120, phase: 'travel', bossSpawned: false, bossDead: false,
    enemies: [] as Enemy[], asteroids: [] as any[], bullets: [] as Projectile[], 
    particles: [] as Particle[], loot: [] as Loot[], stars: [] as {x:number, y:number, s:number}[],
    keys: new Set<string>(), lastFire: 0, lastSpawn: 0, frame: 0, 
    missiles: activeShip.fitting.rocketCount, mines: activeShip.fitting.mineCount, redMines: activeShip.fitting.redMineCount || 0,
    cargo: [...activeShip.fitting.cargo],
    ammo: { ...activeShip.fitting.ammo }, 
    gunStates: {} as Record<number, { mag: number, reloadTimer: number, maxMag: number }>,
    magazineCurrent: activeShip.fitting.magazineCurrent !== undefined ? activeShip.fitting.magazineCurrent : 200, 
    reloadTimer: activeShip.fitting.reloadTimer || 0,
    selectedAmmo: activeShip.fitting.selectedAmmo,
    weaponFireTimes: {} as {[key: number]: number}, 
    weaponHeat: {} as {[key: number]: number},
    lastMissileFire: 0,
    lastMineFire: 0,
    lastRedMineFire: 0,
    mineSide: false, 
    omegaSide: false,
    paused: false,
    active: true,
    swivelMode: false,
    chargeLevel: 0,
    hasFiredOverload: false,
    lastRapidFire: 0,
    victoryTimer: 0,
    failureTimer: 0, 
    movement: { up: false, down: false, left: false, right: false },
    criticalExposure: 0,
    rescueMode: false,
    rescueTimer: 0,
    usingWater: false,
    overload: 0,
    overdrive: false,
    overdriveFirstShot: false,
    shakeX: 0,
    shakeY: 0,
    shakeDecay: 0.9,
    capacitor: 100,
    salvoTimer: 0,
    lastSalvoFire: 0,
    currentThrottle: 0, 
    shipVy: 0,
    refuelTimer: 0,
    refuelDuration: 600, 
    isRefueling: false,
    refuelType: null as 'fuel' | 'water' | null,
    refuelStartVal: 0,
    isEnergizing: false,
    energizeTimer: 0,
    capacitorLocked: false,
    depletionTime: 0,
    weaponCoolDownTimer: 0,
    missileBurstCount: 0,
    mineBurstCount: 0,
    isExitDialogOpen: false,
    capsLock: false,
    shieldsEnabled: true,
    wasShieldHit: false,
    isShooting: false,
    sh1RegenActive: false,
    sh2RegenActive: false,
    distressTimer: 0,
    waveCounter: 0,
    weapons: [...activeShip.fitting.weapons],
    shieldId: activeShip.fitting.shieldId,
    secondShieldId: activeShip.fitting.secondShieldId
  });

  const finishGame = (success: boolean, aborted: boolean) => {
      const s = state.current;
      s.active = false;
      onGameOver(success, s.score, aborted, { 
          health: s.hp, 
          fuel: s.fuel, 
          water: s.water, 
          rockets: s.missiles, 
          mines: s.mines, 
          redMineCount: s.redMines, 
          cargo: s.cargo, 
          ammo: s.ammo, 
          magazineCurrent: (Object.values(s.gunStates) as any)[0]?.mag || s.magazineCurrent, 
          reloadTimer: s.reloadTimer,
          weapons: s.weapons,
          shieldId: s.shieldId,
          secondShieldId: s.secondShieldId
      });
  };

  const togglePause = (forceVal?: boolean) => {
      const s = state.current;
      if (s.bossDead) {
          finishGame(true, false); 
          return;
      }
      const next = forceVal !== undefined ? forceVal : !s.paused;
      if (s.paused === next) return; 
      s.paused = next;
      setHud(h => ({...h, isPaused: next}));
      if (next) audioService.pauseMusic(); else audioService.resumeMusic();
  };

  const handleAbortOrReturn = () => {
      const s = state.current;
      if (s.bossDead) finishGame(true, true); else finishGame(false, true); 
  };

  const handleExit = () => {
      const s = state.current;
      let finalHp = s.hp; let finalFuel = s.fuel;
      if (s.criticalExposure > 0 || s.rescueMode) { finalHp = 10; finalFuel *= 0.5; }
      onGameOver(false, s.score, true, { 
          health: finalHp, fuel: finalFuel, water: s.water, rockets: s.missiles, mines: s.mines, redMineCount: s.redMines, 
          cargo: s.cargo, ammo: s.ammo, magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer,
          weapons: s.weapons, shieldId: s.shieldId, secondShieldId: s.secondShieldId
      });
      try { if (window.history.length > 1) window.history.back(); else window.close(); } catch (e) { console.warn("Could not close window", e); }
  };

  useEffect(() => {
      const s = state.current;
      s.hp = activeShip.fitting.health;
      s.fuel = activeShip.fitting.fuel;
      s.water = activeShip.fitting.water || 100;
      s.sh1 = shield ? shield.capacity : 0;
      s.sh2 = secondShield ? secondShield.capacity : 0;
      s.missiles = activeShip.fitting.rocketCount;
      s.mines = activeShip.fitting.mineCount;
      s.redMines = activeShip.fitting.redMineCount || 0;
      s.cargo = [...activeShip.fitting.cargo]; 
      s.weapons = [...activeShip.fitting.weapons];
      s.shieldId = activeShip.fitting.shieldId;
      s.secondShieldId = activeShip.fitting.secondShieldId;
      
      s.ammo = { ...activeShip.fitting.ammo };
      activeShip.fitting.cargo.forEach(c => {
          if (c.type === 'ammo') {
              const qty = c.quantity * 1000;
              const type = c.id as AmmoType;
              s.ammo[type] = (s.ammo[type] || 0) + qty;
          }
      });

      activeShip.fitting.weapons.forEach((w, i) => {
          if (w) {
              const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === w.id);
              if (def && def.isAmmoBased) {
                  s.gunStates[i] = { mag: 200, reloadTimer: 0, maxMag: 200 };
              }
          }
      });

      const initStars = () => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          s.stars = Array.from({length: 200}, () => ({
              x: Math.random() * (w + 200) - 100, 
              y: Math.random() * (h + 200) - 100, 
              s: Math.random()*2
          }));
      };
      initStars();
      [0, 1, 2].forEach(i => s.weaponHeat[i] = 0);

      const handleResize = () => { initStars(); if (!s.paused) togglePause(true); };
      const handleOrientation = (e: DeviceOrientationEvent) => {
          if (e.beta !== null) { hasTiltRef.current = true; tiltRef.current.beta = e.beta || 0; tiltRef.current.gamma = e.gamma || 0; }
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('deviceorientation', handleOrientation);
      return () => { 
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('deviceorientation', handleOrientation);
      };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.tagName === 'BUTTON') return;
      if (state.current.paused) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      targetRef.current = { x: e.clientX, y: e.clientY };
  };

  const spawnLoot = (x: number, y: number, z: number, type: string, id?: string, name?: string, quantity: number = 1) => { state.current.loot.push({ x, y, z, type, id, name, quantity, isPulled: false, vx: (Math.random()-0.5), vy: (Math.random()-0.5) }); };
  
  const spawnGarbage = (x: number, y: number, type: string, id: string, name: string) => {
      const s = state.current;
      const angle = Math.random() * Math.PI * 2;
      const spd = 5;
      s.loot.push({
          x: x, y: y, z: 0,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          type: type, id: id, name: name, quantity: 1,
          isPulled: false, isGarbage: true
      });
  };

  useEffect(() => {
      // Use InputController
      return InputController.setup(
          state.current, 
          inputRef, 
          togglePause, 
          setShowExitDialog, 
          setHud,
          () => ResourceController.handleManualRefuel(state.current, maxFuel, setHud),
          () => ResourceController.handleManualRehydrate(state.current, maxWater, setHud),
          () => ResourceController.handleManualReload(state.current, setHud),
          () => ResourceController.handleManualEnergy(state.current, setHud)
      );
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current; if(!cvs) return;
    const ctx = cvs.getContext('2d', { alpha: false }); if(!ctx) return;
    let raf: number;
    const s = state.current;

    const loop = () => {
        if (!s.active) return;
        if (s.paused) { raf = requestAnimationFrame(loop); return; }

        const width = cvs.width = window.innerWidth;
        const height = cvs.height = window.innerHeight;
        s.frame++;

        let speedMult = 1.0;
        if (speedMode === 'slow') speedMult = 0.6;
        if (speedMode === 'fast') speedMult = 1.4;

        const sizeScale = fontSize === 'small' ? 0.8 : (fontSize === 'large' ? 1.25 : (fontSize === 'extra-large' ? 1.5 : 1.0));

        // REGENERATION LOGIC
        const logPrice = Math.log10(Math.max(1000, activeShip.config.price/2));
        const baseRegen = Math.max(0.2, (logPrice * 1.2) - 4.5);
        const isStress = s.wasShieldHit && s.isShooting;
        const reactorOutput = isStress ? baseRegen * 0.5 : baseRegen;
        s.energy = Math.min(maxEnergy, s.energy + reactorOutput);

        // AUTO-INJECT ENERGY LOGIC
        if (s.energy < maxEnergy * 0.05 && !s.isEnergizing && !s.rescueMode) {
            const hasEnergyPack = s.cargo.some(c => c.type === 'energy');
            if (hasEnergyPack) {
                s.isEnergizing = true;
                s.energizeTimer = 0;
                setHud(h => ({...h, alert: "AUTO-INJECTING POWER", alertType: 'warning'}));
                audioService.playSfx('buy');
            }
        }

        // BOSS DEFEATED LOGIC (Auto Land)
        if (s.bossDead) {
            s.victoryTimer++;
            if (s.victoryTimer % 60 === 0) {
                const timeLeft = 20 - Math.floor(s.victoryTimer / 60);
                if (timeLeft <= 5) {
                    setHud((h: any) => ({...h, alert: `AUTO-LAND IN ${timeLeft}s`, alertType: 'info'}));
                }
            }
            if (s.victoryTimer > 1200) { 
                finishGame(true, false); 
                return;
            }
        }

        const currentShieldDef = s.shieldId === 'dev_god_mode' ? { id: 'dev', capacity: 9999, color: '#fff', name: 'DEV', regenRate: 100, energyCost: 0, visualType: 'full' } as Shield : [...SHIELDS, ...EXOTIC_SHIELDS].find(def => def.id === s.shieldId) || null;
        const currentSecondShieldDef = s.secondShieldId === 'dev_god_mode' ? { id: 'dev', capacity: 9999, color: '#fff', name: 'DEV', regenRate: 100, energyCost: 0, visualType: 'full' } as Shield : [...SHIELDS, ...EXOTIC_SHIELDS].find(def => def.id === s.secondShieldId) || null;

        const s1Max = currentShieldDef ? currentShieldDef.capacity : 1;
        const s2Max = currentSecondShieldDef ? currentSecondShieldDef.capacity : 1;
        const s1Pct = s.sh1 / s1Max;
        const s2Pct = s.sh2 / s2Max;
        
        const shieldsHealthy = (currentShieldDef ? s1Pct > 0.2 : true) && (currentSecondShieldDef ? s2Pct > 0.2 : true);
        const capacitorFull = s.capacitor >= 100;
        
        const divertToCapacitor = shieldsHealthy && !capacitorFull;
        const enableShieldRegen = s.shieldsEnabled && !divertToCapacitor;

        if (enableShieldRegen) {
            const processShield = (current: number, def: Shield | null, isActive: boolean): { val: number, active: boolean } => {
                if (!def) return { val: 0, active: false };
                let newActive = isActive;
                if (!newActive && current < def.capacity * 0.5) { newActive = true; }
                if (newActive && current >= def.capacity) { newActive = false; current = def.capacity; }
                if (newActive) {
                    const regenPerFrame = def.regenRate / 30;
                    const costPerFrame  = def.energyCost / 30;
                    if (costPerFrame <= 0) return { val: Math.min(def.capacity, current + regenPerFrame), active: true };
                    if (s.energy >= costPerFrame) { s.energy -= costPerFrame; return { val: Math.min(def.capacity, current + regenPerFrame), active: true }; } 
                    else if (s.energy > 0) { const ratio = s.energy / costPerFrame; s.energy = 0; return { val: Math.min(def.capacity, current + (regenPerFrame * ratio)), active: true }; }
                }
                return { val: current, active: newActive };
            };
            const s1Res = processShield(s.sh1, currentShieldDef, s.sh1RegenActive);
            s.sh1 = s1Res.val; s.sh1RegenActive = s1Res.active;
            const s2Res = processShield(s.sh2, currentSecondShieldDef, s.sh2RegenActive);
            s.sh2 = s2Res.val; s.sh2RegenActive = s2Res.active;
        } else {
            s.sh1RegenActive = false;
            s.sh2RegenActive = false;
        }
        
        s.wasShieldHit = false;
        
        const speed = 9;
        const fuelLimit = maxFuel * 0.1;
        
        // DELEGATE RESOURCE UPDATES
        ResourceController.update(s, maxFuel, maxWater, maxEnergy, currentShieldDef, currentSecondShieldDef, setHud);

        const isDistress = !s.rescueMode && s.fuel <= fuelLimit && s.water <= 0 && !s.isRefueling;
        if (isDistress) {
            s.distressTimer++;
            if (s.frame % 60 === 0) {
                const secondsLeft = 20 - Math.floor(s.distressTimer / 60);
                setHud((h: any) => ({...h, alert: `CRITICAL RESOURCES - AUTO-ABORT IN ${secondsLeft}s`, alertType: 'alert'})); 
                audioService.playAlertSiren();
            }
            if (s.distressTimer > 1200) { 
                finishGame(false, true); 
                return;
            }
        } else {
            s.distressTimer = 0;
        }

        let targetThrottle = 0; let left = false; let right = false;
        const canMove = !isDistress; 
        let keyLeft = false; let keyRight = false; let keyUp = false; let keyDown = false;

        if (canMove) {
            if (s.keys.has('Numpad7')) { keyLeft = true; keyUp = true; }
            if (s.keys.has('Numpad9')) { keyRight = true; keyUp = true; }
            if (s.keys.has('Numpad1')) { keyLeft = true; keyDown = true; }
            if (s.keys.has('Numpad3')) { keyRight = true; keyDown = true; }

            keyLeft = keyLeft || s.keys.has('ArrowLeft') || s.keys.has('Numpad4') || s.keys.has('KeyA');
            keyRight = keyRight || s.keys.has('ArrowRight') || s.keys.has('Numpad6') || s.keys.has('KeyD');
            keyUp = keyUp || s.keys.has('ArrowUp') || s.keys.has('Numpad8') || s.keys.has('KeyW');
            keyDown = keyDown || s.keys.has('ArrowDown') || s.keys.has('ArrowDown') || s.keys.has('Numpad2') || s.keys.has('Numpad5') || s.keys.has('KeyS');

            const isBurnLocked = keyUp && keyDown;
            const isSideBurnLocked = keyLeft && keyRight;

            left = keyLeft && !isSideBurnLocked;
            right = keyRight && !isSideBurnLocked;

            if (left || right || keyUp || keyDown) {
                targetRef.current = null;
            }

            if (hasTiltRef.current) {
                const isLandscape = window.innerWidth > window.innerHeight;
                let tiltVal = isLandscape ? tiltRef.current.beta : tiltRef.current.gamma;
                if (tiltVal < -5) { left = true; s.px -= Math.abs(tiltVal) * 0.2; } else if (tiltVal > 5) { right = true; s.px += Math.abs(tiltVal) * 0.2; }
                if (Math.abs(tiltVal) > 5) { targetRef.current = null; }
            }
            
            if (isBurnLocked) {
                targetThrottle = 0; 
            } else if (keyUp) {
                targetThrottle = 1;
            } else if (keyDown) {
                targetThrottle = -1;
            }
            
            if (isBurnLocked || isSideBurnLocked) {
                applyJetDamage(s, { up: isBurnLocked, down: isBurnLocked, left: isSideBurnLocked, right: isSideBurnLocked }, setHud);
                s.fuel -= 0.05;
            }
            
            if (targetRef.current) {
                const dx = targetRef.current.x - s.px; const dy = targetRef.current.y - s.py; const dist = Math.hypot(dx, dy);
                if (dist < 10) { targetRef.current = null; targetThrottle = 0; } else {
                    const angle = Math.atan2(dy, dx); s.px += Math.cos(angle) * 12; s.py += Math.sin(angle) * 12;
                    const xComp = Math.cos(angle); const yComp = Math.sin(angle);
                    if (xComp < -0.5) left = true; if (xComp > 0.5) right = true;
                    if (yComp < -0.5) targetThrottle = 1; if (yComp > 0.5) targetThrottle = -1; 
                }
            }
        }
        s.currentThrottle = s.currentThrottle * 0.9 + targetThrottle * 0.1;
        if (Math.abs(s.currentThrottle) < 0.01) s.currentThrottle = 0;
        const verticalSpeed = -s.currentThrottle * 8; 
        if (!targetRef.current) s.py += verticalSpeed;
        
        const topForbiddenLimit = height * 0.33;
        const bottomLimit = height - 100;
        s.py = Math.max(topForbiddenLimit, Math.min(bottomLimit, s.py));

        if (canMove) {
            if (left && !targetRef.current) s.px -= speed;
            if (right && !targetRef.current) s.px += speed;
        }
        s.px = Math.max(30, Math.min(width-30, s.px));
        
        s.movement = { 
            up: keyUp || s.currentThrottle > 0.1, 
            down: keyDown || s.currentThrottle < -0.1, 
            left: keyLeft || (left && !keyRight), 
            right: keyRight || (right && !keyLeft) 
        };
        
        let isMoving = s.currentThrottle !== 0 || left || right; 
        s.usingWater = false; 
        let worldSpeedFactor = 1.0;
        if (s.currentThrottle > 0.1) worldSpeedFactor = 1.0 + (s.currentThrottle * 0.5); 
        if (s.currentThrottle < -0.1) worldSpeedFactor = 1.0 + (s.currentThrottle * 0.5); 

        if (s.rescueMode) {
            const driftSpeed = 3;
            if (s.currentThrottle > 0) s.py -= driftSpeed; if (s.currentThrottle < 0) s.py += driftSpeed;
            s.px = Math.max(30, Math.min(width-30, s.px)); 
            s.py = Math.max(topForbiddenLimit, Math.min(height-150, s.py));
            if (s.frame % 8 === 0) { 
                 s.particles.push({ x: s.px, y: s.py + 60, vx: (Math.random()-0.5)*1, vy: 2 + Math.random(), life: 1.2, color: '#9ca3af', size: 5 + Math.random()*5 });
            }
        } else {
            const isIonMode = (s.energy > maxEnergy * 0.1) && (s.water > 0);
            s.usingWater = isIonMode;
            const idleDrain = 0.002;
            if (isIonMode) { s.water = Math.max(0, s.water - (idleDrain * 2)); s.energy = Math.max(0, s.energy - (idleDrain * 10)); } 
            else if (s.fuel > fuelLimit) { s.fuel = Math.max(fuelLimit, s.fuel - idleDrain); }

            if (isMoving) {
                let effort = 0.005; 
                if (Math.abs(s.currentThrottle) > 0.1) effort += 0.002 * Math.abs(s.currentThrottle);
                if (isIonMode) { s.water = Math.max(0, s.water - (effort * 5.0)); s.energy = Math.max(0, s.energy - (effort * 100)); } 
                else if (s.fuel > fuelLimit) { s.fuel = Math.max(fuelLimit, s.fuel - effort); } 
                else { isMoving = false; }
            }
            if (s.hp < 30) {
                if (s.frame % 5 === 0) s.particles.push({ x: s.px + (Math.random()-0.5)*20, y: s.py + 10, vx: (Math.random()-0.5)*1, vy: 2, life: 0.8, color: '#777', size: 3 + Math.random()*3 });
                if (s.hp < 15 && s.frame % 10 === 0) s.particles.push({ x: s.px + (Math.random()-0.5)*15, y: s.py, vx: 0, vy: 1, life: 0.5, color: '#f97316', size: 2 });
            }
        }
        
        const now = Date.now();
        if ((s.keys.has('Tab') || s.keys.has('NumpadAdd')) && !s.rescueMode) {
            if (s.missileBurstCount < 3) {
                if (now - s.lastMissileFire > 1000) {
                    fireMissile(s);
                    s.missileBurstCount++;
                }
            }
        } else {
            s.missileBurstCount = 0;
        }

        if (s.keys.has('ShiftLeft') && !s.rescueMode) {
            if (s.mineBurstCount < 3 && now - s.lastMineFire > 1000) {
                fireMine(s, 'left');
                s.mineBurstCount++;
            }
        } else if (s.keys.has('ShiftRight') && !s.rescueMode) {
            if (s.mineBurstCount < 3 && now - s.lastMineFire > 1000) {
                fireMine(s, 'right');
                s.mineBurstCount++;
            }
        } else {
            s.mineBurstCount = 0;
        }

        const isFiring = (s.keys.has('Space') || inputRef.current.main);
        s.isShooting = isFiring;

        const currentShipConfig = {
            config: activeShip.config,
            fitting: {
                ...activeShip.fitting,
                weapons: s.weapons,
                shieldId: s.shieldId,
                secondShieldId: s.secondShieldId
            },
            gunColor: activeShip.gunColor,
            color: activeShip.color,
            wingColor: activeShip.wingColor,
            cockpitColor: activeShip.cockpitColor,
            cockpitHighlightColor: activeShip.cockpitHighlightColor,
            secondaryGunColor: activeShip.secondaryGunColor,
            gunBodyColor: activeShip.gunBodyColor,
            engineColor: activeShip.engineColor,
            nozzleColor: activeShip.nozzleColor,
            barColor: activeShip.barColor
        };

        if (!s.rescueMode) {
            const capDeficit = 100 - s.capacitor;
            const canRecharge = capDeficit > 0 && !(s.isShooting && s.capsLock && !s.capacitorLocked);
            
            if (canRecharge) {
                const rechargeAmount = 0.5; 
                const mainWeapon = s.weapons[0];
                const wDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null;
                const damageTier = wDef ? wDef.damage / 50 : 1;
                const energyCost = rechargeAmount * 2 * damageTier; 
                
                if (s.energy > (maxEnergy * 0.1) && s.energy >= energyCost) {
                    s.energy -= energyCost;
                    s.capacitor = Math.min(100, s.capacitor + rechargeAmount);
                }
            }

            if (s.capacitorLocked && s.capacitor >= 90) { 
                s.capacitorLocked = false; 
                setHud(h => ({...h, alert: "CAPACITOR ONLINE", alertType: 'success'})); 
            }
            if (s.capacitor <= 0) s.capacitorLocked = true;
            
            if (activeShip.config.isAlien) { 
                if (isFiring) {
                    if (s.capsLock && !s.capacitorLocked) {
                         const capRatio = s.capacitor / 100;
                         const baseDelay = 6; 
                         const addedDelay = 24 * (capRatio * capRatio); 
                         const salvoRate = baseDelay + addedDelay;

                         if (s.frame - s.lastSalvoFire > salvoRate) { 
                             firePowerShot(s, currentShipConfig, setHud, height, sizeScale); 
                             s.lastSalvoFire = s.frame; 
                         }
                    } else {
                         fireAlienWeapons(s, currentShipConfig, sizeScale);
                    }
                }
            } 
            else {
                if (isFiring) {
                    if (s.capsLock && !s.capacitorLocked) {
                        const capRatio = s.capacitor / 100;
                        const baseDelay = 6; 
                        const addedDelay = 24 * (capRatio * capRatio); 
                        const salvoRate = baseDelay + addedDelay;

                        if (s.frame - s.lastSalvoFire > salvoRate) { 
                            firePowerShot(s, currentShipConfig, setHud, height, sizeScale); 
                            s.lastSalvoFire = s.frame; 
                        }
                    } else {
                        fireNormalShot(s, currentShipConfig, sizeScale);
                    }
                }
            }
            
            Object.keys(s.weaponHeat).forEach(k => {
                const idx = parseInt(k);
                if (s.weaponHeat[idx] > 0) {
                    s.weaponHeat[idx] = Math.max(0, s.weaponHeat[idx] - 0.5);
                }
            });

            if (s.keys.has('Numpad0')) fireWingWeapon(s, currentShipConfig, 1, sizeScale);
            if (s.keys.has('NumpadDecimal')) fireWingWeapon(s, currentShipConfig, 2, sizeScale);

            const firingSecondary = inputRef.current.secondary;
            if (firingSecondary && !activeShip.config.isAlien) { 
                fireWingWeapon(s, currentShipConfig, 1, sizeScale);
                fireWingWeapon(s, currentShipConfig, 2, sizeScale);
            }
        } else {
            if (isFiring) {
                fireBlasterPistol(s);
            }
        }

        if (s.shakeX > 0) s.shakeX *= s.shakeDecay; if (s.shakeY > 0) s.shakeY *= s.shakeDecay;
        if (s.shakeX < 0.5) s.shakeX = 0; if (s.shakeY < 0.5) s.shakeY = 0;

        // DELEGATE SPAWNING LOGIC - Pass currentPlanet.id and speedMult
        SpawnController.update(s, width, height, difficulty, quadrant, setHud, currentPlanet.id, speedMult);

        s.asteroids.forEach(a => { 
            a.x += a.vx * speedMult; 
            a.y += a.vy * worldSpeedFactor * speedMult; 
            a.z += a.vz * speedMult; 
            a.ax += a.vax; a.ay += a.vay; a.az += a.vaz;
            if (Math.abs(a.z) < 50 && Math.hypot(a.x-s.px, a.y-s.py) < a.size + (30 * sizeScale) && !s.rescueMode) {
                takeDamage(s, 20, 'collision', currentShieldDef, currentSecondShieldDef, setHud);
                a.hp = 0;
                audioService.playImpact(a.material, 1.0);
                createExplosion(s, a.x, a.y, '#aaa', 10, 'asteroid');
            }
        }); 
        s.asteroids = s.asteroids.filter(a => a.y < height + 100 && a.hp > 0);

        s.enemies.forEach(e => { 
            if (s.rescueMode) { e.y += 3; if (e.type === 'boss') e.y += 2; } 
            else {
                const shieldsActive = s.shieldsEnabled && (s.sh1 > 0 || s.sh2 > 0);
                e.update(s.px, s.py, width, height, s.bullets, worldSpeedFactor, s.bullets, difficulty, s.enemies, speedMult, shieldsActive, s.frame); 
                
                if (e.hp < e.maxHp && e.hp > 0) {
                    if (e.hp < e.maxHp * 0.9 && Math.random() < 0.2) s.particles.push({ x: e.x + (Math.random()-0.5)*30, y: e.y + (Math.random()-0.5)*30, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 0.5 + Math.random()*0.5, size: 3 + Math.random()*4, color: '#52525b', type: 'smoke' });
                    if (e.hp < e.maxHp * 0.5 && Math.random() < 0.3) s.particles.push({ x: e.x + (Math.random()-0.5)*20, y: e.y + (Math.random()-0.5)*20, vx: (Math.random()-0.5), vy: (Math.random()-0.5), life: 0.4 + Math.random()*0.3, size: 2 + Math.random()*3, color: '#ef4444', type: 'fire' });
                }
                
                if (Math.abs(e.z) < 50 && Math.hypot(e.x-s.px, e.y-s.py) < (60 * sizeScale)) {
                    takeDamage(s, 30, 'collision', currentShieldDef, currentSecondShieldDef, setHud);
                    if (e.type === 'boss') { applyShieldRamDamage(s, e, setHud); } else { e.hp = 0; }
                    audioService.playImpact('metal', 1.0);
                    createExplosion(s, e.x, e.y, '#f00', 10);
                }
            }
        });
        
        for (let i = s.enemies.length - 1; i >= 0; i--) {
            const e = s.enemies[i];
            
            // REMOVAL LOGIC: Dead OR Off-screen (Bottom OR Sides)
            const offScreen = e.y > height + 200 || e.x < -200 || e.x > width + 200;
            
            if (e.hp <= 0 || offScreen) {
                if (e.hp <= 0 && !s.rescueMode) {
                    createAreaDamage(s, e.x, e.y, 150, 50, currentShieldDef, currentSecondShieldDef, setHud);
                    if (e.type === 'boss') {
                        s.bossDead = true; s.score += 10000 * difficulty;
                        audioService.playExplosion(e.x, 3.0, 'boss');
                        createExplosion(s, e.x, e.y, '#a855f7', 30, 'boss');
                        setHud(h => ({...h, alert: "BOSS DEFEATED", alertType: 'success'}));
                        for (let k=0; k<2; k++) {
                            const rand = Math.random();
                            let lootType = ''; let lootId = ''; let quantity = 1; let name = '';
                            if (rand < 0.25) { const w = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)]; lootType = 'weapon'; lootId = w.id; name = w.name; } 
                            else if (rand < 0.5) { const sh = EXOTIC_SHIELDS[Math.floor(Math.random() * EXOTIC_SHIELDS.length)]; lootType = 'shield'; lootId = sh.id; name = sh.name; } 
                            else if (rand < 0.75) { lootType = 'missile'; quantity = 50; name = 'Missile Pack'; } 
                            else { lootType = 'mine'; quantity = 50; name = 'Mine Pack'; }
                            if (k === 0) spawnLoot(e.x - 20, e.y, 0, 'energy', 'batt_cell', 'Energy Pack', 5);
                            else spawnLoot(e.x + (k*40)-20, e.y, 0, lootType, lootId, name, quantity);
                        }
                    } else {
                        audioService.playExplosion(e.x, 1.0, 'normal');
                        s.score += 100 * difficulty;
                        
                        // STANDARD LOOT DROPS
                        let equipChance = 0.05;
                        if (quadrant === QuadrantType.ALFA) equipChance = 0.30;
                        else if (quadrant === QuadrantType.BETA) equipChance = 0.20;
                        else if (quadrant === QuadrantType.GAMA) equipChance = 0.10;

                        if (Math.random() < equipChance) {
                            if (Math.random() < 0.5) {
                                let dropSlot = 0;
                                if (quadrant === QuadrantType.ALFA && difficulty === 1) {
                                    if (Math.random() < 0.1) dropSlot = 1;
                                }
                                let wId = e.equippedWeapons[dropSlot]?.id || e.equippedWeapons[0]?.id; 
                                if (!wId) wId = e.equippedWeapons[0]?.id;
                                let wDef = WEAPONS.find(w => w.id === wId);
                                if (!wDef) {
                                    wDef = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
                                }
                                spawnLoot(e.x, e.y, 0, 'weapon', wDef.id, wDef.name, 1);
                            } else {
                                const sDef = SHIELDS[Math.floor(Math.random() * SHIELDS.length)];
                                spawnLoot(e.x, e.y, 0, 'shield', sDef.id, sDef.name, 1);
                            }
                        } else if (Math.random() < 0.4) {
                            if (Math.random() < 0.5) spawnLoot(e.x, e.y, 0, 'energy', 'batt_cell', 'Energy Pack', 1);
                            else { const ammos = ['iron', 'titanium', 'cobalt', 'iridium', 'tungsten', 'explosive']; const selected = ammos[Math.floor(Math.random() * ammos.length)]; spawnLoot(e.x, e.y, 0, 'ammo', selected, 'Ammo Box', 100); }
                        }
                    }
                } else if (e.hp <= 0 && s.rescueMode) {
                    audioService.playExplosion(e.x, 1.0, 'normal');
                    createExplosion(s, e.x, e.y, '#f97316', 15);
                    s.score += 50 * difficulty;
                }
                s.enemies.splice(i, 1);
            }
        }

        s.bullets.forEach(b => { 
            // Handle Defective Mine Drift
            if (b.isDefective) {
                b.vz = (b.vz || 0) + 0.1; // Drift away in Z
                b.opacity = (b.opacity || 1.0) - 0.005; // Fade out
                if (b.opacity <= 0) b.life = 0; // Silent death
                
                // Also drift in X/Y slightly
                b.x += b.vx * 0.1;
                b.y += b.vy * 0.1;
            } else {
                b.x += b.vx; b.y += b.vy; b.life--; 
                if (b.vz !== undefined) b.z = (b.z || 0) + b.vz;
            }
            
            // --- ORDNANCE ACTIVATION LOGIC ---
            if (!b.isEnemy && !b.isActivated && b.safeDistance && !b.isDefective) {
                const distFromShip = Math.hypot(b.x - s.px, b.y - s.py);
                if (distFromShip > b.safeDistance) {
                    b.isActivated = true;
                }
            }
            
            // FRIENDLY FIRE CHECK (Activated Player Ordnance vs Player)
            if (!b.isEnemy && b.isActivated && !b.isDefective && !s.rescueMode) {
                const distToPlayer = Math.hypot(b.x - s.px, b.y - s.py);
                const hitRadius = (30 * sizeScale); // Player hit radius
                
                if (distToPlayer < hitRadius + (b.width / 2)) {
                    // Accidental Collision
                    takeDamage(s, b.damage, b.type, currentShieldDef, currentSecondShieldDef, setHud);
                    b.life = 0;
                    
                    const isOrdnance = ['missile', 'missile_emp', 'mine', 'mine_emp', 'mine_red'].includes(b.type);
                    
                    if (isOrdnance) {
                        createExplosion(s, b.x, b.y, b.color, 20, 'mine');
                        createAreaDamage(s, b.x, b.y, 150, b.damage, currentShieldDef, currentSecondShieldDef, setHud);
                        audioService.playExplosion(0, 1.2, 'mine');
                    } else {
                        createExplosion(s, b.x, b.y, b.color, 3);
                    }
                }
            }

            if (b.weaponId?.includes('exotic') && b.growthRate && b.isOvercharge) {
                let multiplier = 12.0; 
                if (b.weaponId === 'exotic_gravity_wave') multiplier = 14.0;
                else if (b.weaponId === 'exotic_plasma_orb' || b.weaponId === 'exotic_wave') multiplier = 8.0;
                const limitW = (b.initialWidth || 6) * multiplier;
                if (b.type === 'projectile' || b.type === 'laser' || b.type === 'octo_shell') {
                    if (b.width < limitW) {
                        const oldH = b.height;
                        b.width *= b.growthRate;
                        b.height *= b.growthRate;
                        const dh = b.height - oldH;
                        b.y -= dh / 2;
                    }
                }
            }
            
            // ENEMY BULLET LOGIC
            const bulletAge = s.frame - (b.launchTime || 0);

            if (b.isEnemy && !b.isDefective) {
                // BOSS SELF-DAMAGE CHECK
                // Only if bullet has existed for > 60 frames (grace period)
                if (bulletAge > 60 && b.type === 'mine_enemy') {
                    const boss = s.enemies.find(e => e.type === 'boss');
                    if (boss && boss.hp > 0) {
                         const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
                         const hitRadius = 80 * sizeScale; // Boss size approx
                         
                         if (dist < hitRadius) {
                             // Hit Boss
                             boss.hp -= b.damage;
                             b.life = 0;
                             createExplosion(s, b.x, b.y, b.color, 20, 'mine');
                             createAreaDamage(s, b.x, b.y, 150, b.damage, currentShieldDef, currentSecondShieldDef, setHud);
                             audioService.playExplosion(0, 1.2, 'mine');
                         }
                    }
                }

                // FRIENDLY FIRE CHECK (Other Enemies)
                // Updated radius check: If shieldDisabledUntil > 0, reduce hit radius to hull only (35)
                // This prevents bombs from hitting the "phantom" shield radius of the launching bomber
                const safeTime = (b.type === 'bomb' || b.type.includes('mine')) ? 120 : 30; // Increased safety for heavy ordnance
                if (bulletAge > safeTime) {
                    s.enemies.forEach(e => {
                        if (b.life <= 0 || e.type === 'boss') return; // Skip Boss (handled above)
                        if (Math.abs(e.z - (b.z || 0)) < 40) {
                            const dist = Math.hypot(b.x - e.x, b.y - e.y);
                            const shieldActive = e.shieldLayers.length > 0 && e.shieldDisabledUntil <= 0;
                            const hitRadius = (shieldActive ? 50 : 35) * sizeScale;
                            if (dist < hitRadius) {
                                e.damageHull(b.damage, b.type, false, false);
                                createExplosion(s, b.x, b.y, '#f97316', 3, 'smoke');
                                if (b.type !== 'octo_shell') b.life = 0;
                            }
                        }
                    });
                }
            }

            if (b.life <= 0) {
                // Ordnance Explosion Logic
                const isOrdnance = ['missile', 'missile_emp', 'mine', 'mine_emp', 'mine_red', 'missile_enemy', 'mine_enemy', 'octo_shell'].includes(b.type);
                
                if (isOrdnance && !b.isDefective && !b.hasExpired) {
                    // FORCE EXPLOSION for timeout
                    if (b.type === 'octo_shell') {
                        createExplosion(s, b.x, b.y, b.color, 15, 'fireworks');
                        createAreaDamage(s, b.x, b.y, 120, b.damage, currentShieldDef, currentSecondShieldDef, setHud);
                        audioService.playExplosion(0, 1.0, 'emp');
                    } else {
                        const isMine = b.type.includes('mine');
                        createExplosion(s, b.x, b.y, b.color, 20, isMine ? 'mine' : 'standard');
                        createAreaDamage(s, b.x, b.y, 150, b.damage, currentShieldDef, currentSecondShieldDef, setHud);
                        audioService.playExplosion(0, isMine ? 1.2 : 0.8, isMine ? 'mine' : 'normal');
                    }
                }
            }
            if (['missile', 'missile_emp', 'mine', 'mine_emp', 'mine_red', 'missile_enemy', 'mine_enemy'].includes(b.type)) {
                if (b.isDefective) return; 

                const isMissile = b.type.includes('missile');
                const age = s.frame - (b.launchTime || 0);
                
                if (age < 20 && !b.isEnemy) { 
                    if (isMissile) { b.vy -= 0.6; b.vx *= 0.95; } else { b.vx *= 0.99; } 
                } 
                else {
                    updateEnemyOrdnance(b, s, age);
                    
                    // Velocity Clamping & Speed Limits
                    if (isMissile || b.type === 'mine_enemy') { 
                        const currentSpeed = Math.hypot(b.vx, b.vy); 
                        // Missiles accelerate if engine on
                        if (isMissile && age < 600 && currentSpeed < (b.maxSpeed || 16)) { 
                            b.vx *= 1.05; b.vy *= 1.05; 
                        }
                        // Mines accelerate if homing (spiral)
                        if (b.type === 'mine_enemy' && age > 60 && age < 600 && currentSpeed < (b.maxSpeed || 12)) {
                            // Drag handles speed cap naturally, but ensure we don't exceed max physics limits
                        }
                    }
                }
            }
            if (b.isEnemy && !s.rescueMode && !b.isDefective) { 
                const hitRadius = Math.max(30, 30 * sizeScale);
                if (Math.hypot(b.x-s.px, b.y-s.py) < hitRadius) { 
                    takeDamage(s, b.damage, b.type, currentShieldDef, currentSecondShieldDef, setHud); 
                    b.life = 0; 
                    createExplosion(s, b.x, b.y, b.color, 3); 
                } 
            } else if (!b.isEnemy) {
                const interceptionRadius = (b.type.includes('missile') || b.type.includes('mine')) ? 60 : 30; 
                for (const other of s.bullets) {
                    if (other.isEnemy && (other.type.includes('missile') || other.type.includes('mine')) && other.life > 0) {
                         if (Math.hypot(b.x - other.x, b.y - other.y) < interceptionRadius) {
                             other.life = 0; 
                             if (!b.isOvercharge && b.type !== 'laser') b.life = 0;
                             createExplosion(s, other.x, other.y, '#fca5a5', 10, 'smoke');
                             audioService.playImpact('metal', 0.5);
                             if (b.type.includes('missile') || b.type.includes('mine')) {
                                createExplosion(s, b.x, b.y, '#facc15', 20, 'mine');
                                createAreaDamage(s, b.x, b.y, 150, b.damage, currentShieldDef, currentSecondShieldDef, setHud);
                             }
                         }
                    }
                }
                let hit = false; 
                if (b.life > 0) { 
                    s.enemies.forEach(e => { 
                        if (b.life <= 0) return; 
                        
                        const isOrdnance = b.type.includes('missile') || b.type.includes('mine') || b.type === 'bomb';
                        
                        const shieldLayer = e.shieldLayers[0]; 
                        const shieldActive = e.shieldLayers.length > 0 && e.shieldDisabledUntil <= 0;
                        const shieldColor = shieldActive && shieldLayer ? shieldLayer.color : null;
                        
                        let bypassShield = false;
                        
                        // New Logic: Check Shield Type via Helper
                        if (isOrdnance && shieldColor) {
                            // Energy Shields allow Ordnance to Pass Through
                            const sType = getShieldType(shieldColor);
                            if (sType === 'energy') {
                                bypassShield = true;
                            }
                        }

                        const hullRadius = (e.type === 'boss' ? 80 : 40) * sizeScale;
                        const shieldRadius = shieldActive ? (hullRadius + (20 * sizeScale)) : 0; 
                        const zDist = Math.abs((b.z || 0) - e.z);
                        const dist2d = Math.hypot(b.x-e.x, b.y-e.y);
                        
                        // Shield Hit Logic: Only if NOT bypass
                        if (!bypassShield && shieldRadius > 0 && dist2d < shieldRadius + b.width/2 && dist2d > hullRadius - 5 && (!isOrdnance || zDist < 80)) { 
                            let effectiveDamage = b.damage;
                            if (b.weaponId === 'exotic_star_shatter') {
                                if (b.isOvercharge) { const ratio = Math.min(1, Math.max(0, (b.width - 6) / 30)); const multiplier = 4 + (ratio * 16); effectiveDamage = b.damage * multiplier; } 
                                else { const ratio = Math.min(1, b.width / 12); effectiveDamage = b.damage * ratio; }
                            }
                            if (b.weaponId === 'exotic_flamer' && !b.isOvercharge) effectiveDamage *= (b.life / 50); 
    
                            const angleToBullet = Math.atan2(b.y - e.y, b.x - e.x);
                            let normAngle = angleToBullet;
                            if (normAngle < 0) normAngle += Math.PI * 2;
    
                            if (b.type === 'octo_shell') {
                                // Octo shell logic...
                                if (dist2d < (shieldRadius || hullRadius)) {
                                    hit = true;
                                    if (b.isOvercharge) {
                                        createExplosion(s, b.x, b.y, b.color, 40, 'fireworks'); 
                                        audioService.playExplosion(0, 1.5, 'emp'); 
                                        createAreaDamage(s, b.x, b.y, 200, b.damage, currentShieldDef, currentSecondShieldDef, setHud);
                                    } else {
                                        const shieldHitIdx = e.getHitShieldIndex(normAngle);
                                        if (shieldHitIdx !== -1 && dist2d > hullRadius) {
                                             e.damageShield(shieldHitIdx, effectiveDamage, 'projectile', true, false, false);
                                        } else {
                                             e.damageHull(effectiveDamage, 'projectile', true, false);
                                        }
                                        createExplosion(s, b.x, b.y, b.color, 5, 'fireworks');
                                    }
                                }
                            } else {
                                const shieldHitIdx = e.getHitShieldIndex(normAngle);
                                if (shieldHitIdx !== -1) {
                                    e.damageShield(shieldHitIdx, effectiveDamage, b.type, !!b.isMain, !!b.isOvercharge, !!b.isEmp);
                                    hit = true;
                                    createExplosion(s, b.x, b.y, b.color, 2, 'shield_effect'); 
                                    audioService.playImpact('shield', 0.8);
                                }
                            }
                        }
                        
                        // Hull Hit Logic (For Bypass or Shield Penetration)
                        if (!hit && dist2d < hullRadius && (!isOrdnance || zDist < 80)) {
                            let effectiveDamage = b.damage;
                            
                            // Re-calculate damage for bypass if not already done
                            if (bypassShield) {
                                // If bypassed, apply full damage directly to hull
                            } else {
                                if (b.weaponId === 'exotic_star_shatter') {
                                    if (b.isOvercharge) { const ratio = Math.min(1, Math.max(0, (b.width - 6) / 30)); const multiplier = 4 + (ratio * 16); effectiveDamage = b.damage * multiplier; } 
                                    else { const ratio = Math.min(1, b.width / 12); effectiveDamage = b.damage * ratio; }
                                }
                                if (b.weaponId === 'exotic_flamer' && !b.isOvercharge) effectiveDamage *= (b.life / 50); 
                            }

                            if (e.type !== 'boss') {
                                const isMine = b.type.includes('mine');
                                const isMissile = b.type.includes('missile');
                                if ((isMine && Math.random() < 0.3) || (isMissile && Math.random() < 0.2)) {
                                    effectiveDamage = e.maxHp + 500;
                                }
                            }
                            
                            // Apply Damage to Enemy
                            // New Logic: Check if enemy dies from this hit
                            const wasAlive = e.hp > 0;
                            e.damageHull(effectiveDamage, b.type, !!b.isMain, !!b.isOvercharge);
                            const isDead = e.hp <= 0;
                            
                            // Loot Tracking
                            if (wasAlive && isDead) {
                                e.lastHitType = b.type;
                                e.lastHitByEnemy = b.isEnemy; // Usually false here since b is player bullet
                            }

                            hit = true;
                            createExplosion(s, b.x, b.y, '#f97316', 4, 'smoke'); 
                            if (b.type.includes('missile')) { 
                                audioService.playExplosion(0, 0.8, 'normal'); 
                                createAreaDamage(s, b.x, b.y, 100, b.damage / 2, currentShieldDef, currentSecondShieldDef, setHud);
                            } else if (b.type.includes('mine')) { 
                                audioService.playExplosion(0, 1.2, 'mine'); 
                                createAreaDamage(s, b.x, b.y, 150, b.damage, currentShieldDef, currentSecondShieldDef, setHud); 
                            } else if (b.type === 'bomb') {
                                audioService.playExplosion(0, 1.2, 'mine'); 
                                createAreaDamage(s, b.x, b.y, 120, b.damage, currentShieldDef, currentSecondShieldDef, setHud);
                            } else if (b.isEmp || b.type.includes('emp')) {
                                audioService.playExplosion(0, 1.2, 'emp'); 
                            } else {
                                audioService.playImpact('metal', 0.7);
                            }
                        }
                    });
                }
                if (b.life > 0) {
                    s.asteroids.forEach(a => {
                        if (b.life <= 0) return;
                        const hitThreshold = (b.weaponId === 'exotic_flamer' || b.weaponId === 'exotic_rainbow_spread' || b.weaponId === 'exotic_star_shatter' || b.type === 'octo_shell') ? Math.max(a.size + 10, b.width/2) : a.size + 10;
                        if (Math.hypot(b.x-a.x, b.y-a.y) < hitThreshold) {
                            let dmg = calculateDamage(b.damage, b.type, 'hull'); if (b.isOvercharge) dmg *= 5.0; 
                            if (b.weaponId === 'exotic_flamer' && !b.isOvercharge) dmg *= (b.life / 50);
                            if (b.type === 'octo_shell') {
                                 if (b.isOvercharge) {
                                    dmg *= 2.0; hit = true;
                                    createExplosion(s, b.x, b.y, b.color, 40, 'fireworks'); 
                                    audioService.playExplosion(0, 1.5, 'emp'); 
                                    createAreaDamage(s, b.x, b.y, 200, b.damage, currentShieldDef, currentSecondShieldDef, setHud);
                                 } else {
                                    hit = true; createExplosion(s, b.x, b.y, b.color, 5, 'fireworks');
                                 }
                            }
                            a.hp -= dmg; if (a.hp <= 0 && a.loot) spawnLoot(a.x, a.y, a.z, a.loot.type, a.loot.id, a.loot.name, a.loot.quantity || 1);
                            if (!hit) hit = true; 
                            if (dmg > 5 && b.type !== 'octo_shell') { 
                                createExplosion(s, b.x, b.y, '#aaa', 5, 'asteroid');
                                if (b.type.includes('missile')) { 
                                    audioService.playExplosion(0, 0.8, 'normal'); 
                                    createAreaDamage(s, b.x, b.y, 100, b.damage / 2, currentShieldDef, currentSecondShieldDef, setHud);
                                } else if (b.type.includes('mine')) { 
                                    audioService.playExplosion(0, 1.2, 'mine'); 
                                    createAreaDamage(s, b.x, b.y, 150, b.damage, currentShieldDef, currentSecondShieldDef, setHud); 
                                } else if (b.type === 'bomb') {
                                    audioService.playExplosion(0, 1.2, 'mine'); 
                                    createAreaDamage(s, b.x, b.y, 120, b.damage, currentShieldDef, currentSecondShieldDef, setHud); 
                                } else {
                                    audioService.playImpact(a.material === 'ice' ? 'ice' : 'rock', 0.6);
                                }
                            }
                        }
                    });
                }
                if (hit) {
                    const isPiercing = b.weaponId === 'exotic_rainbow_spread' || b.type === 'firework_shell' || (b.type === 'octo_shell' && !b.isOvercharge);
                    if (!isPiercing) {
                        b.life = 0; 
                    }
                }
            }
        });
        s.bullets = s.bullets.filter(b => b.life > 0);
        
        const optimizeCargo = () => {
            const maxCap = activeShip.config.maxCargo;
            const currentLoad = s.cargo.reduce((a,c) => a + c.quantity, 0);
            
            if (currentLoad < maxCap * 0.9) return;
            
            const protectedTypes = ['fuel', 'water', 'energy', 'ammo'];
            
            const candidates = s.cargo
                .map((item, idx) => ({ item, idx }))
                .filter(entry => !protectedTypes.includes(entry.item.type))
                .sort((a, b) => {
                     const valA = (a.item.type === 'weapon' || a.item.type === 'shield') ? 5000 : 100;
                     const valB = (b.item.type === 'weapon' || b.item.type === 'shield') ? 5000 : 100;
                     return valA - valB;
                });

            const targetCap = maxCap * 0.85;
            let current = currentLoad;
            
            const toKeep: CargoItem[] = [];
            
            s.cargo.forEach(c => {
                if (protectedTypes.includes(c.type)) toKeep.push(c);
            });
            
            let capacityUsed = toKeep.reduce((a,c) => a+c.quantity, 0);
            
            const remaining = s.cargo.filter(c => !protectedTypes.includes(c.type));
            remaining.sort((a, b) => {
                 const defA = [...WEAPONS, ...SHIELDS, ...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS].find(x => x.id === a.id);
                 const defB = [...WEAPONS, ...SHIELDS, ...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS].find(x => x.id === b.id);
                 const priceA = defA?.price || 0;
                 const priceB = defB?.price || 0;
                 return priceB - priceA;
            });
            
            remaining.forEach(item => {
                if (capacityUsed + item.quantity <= targetCap) {
                    toKeep.push(item);
                    capacityUsed += item.quantity;
                } else {
                    spawnGarbage(s.px, s.py, item.type, item.id || 'unknown', item.name);
                }
            });
            
            s.cargo = toKeep;
            setHud((h: any) => ({...h, alert: "CARGO OPTIMIZED: JETTISONED SCRAP", alertType: 'warning'}));
        };
        
        const tryAddToCargo = (item: CargoItem, alertName: string) => {
             const maxCap = activeShip.config.maxCargo;
             let currentLoad = s.cargo.reduce((a,c) => a + c.quantity, 0);
             
             if (currentLoad + item.quantity > maxCap * 0.9) {
                 optimizeCargo();
                 currentLoad = s.cargo.reduce((a,c) => a + c.quantity, 0); 
             }
             
             if (currentLoad + item.quantity <= maxCap) {
                  const existing = s.cargo.find(c => c.id === item.id);
                  if (existing) {
                      existing.quantity += item.quantity;
                  } else {
                      s.cargo.push(item);
                  }
                  setHud((h: any) => ({...h, alert: alertName, alertType: 'success'}));
                  return true;
             } else {
                  spawnGarbage(s.px, s.py, item.type, item.id || 'unknown', item.name);
                  setHud((h: any) => ({...h, alert: "CARGO FULL - ITEM JETTISONED", alertType: 'error'}));
                  return false;
             }
        };

        s.loot.forEach(l => {
            const dx = s.px - l.x; const dy = s.py - l.y; const dist = Math.hypot(dx, dy);
            
            if (dist < 175 && !l.isGarbage) { 
                l.isBeingPulled = true; l.x += dx * 0.08; l.y += dy * 0.08; 
            } else { 
                l.isBeingPulled = false; l.y += 2 * worldSpeedFactor; l.x += l.vx; l.y += l.vy; 
            }

            if (dist < 30 && !l.isPulled && !l.isGarbage) {
                l.isPulled = true; 
                let processed = false;

                if (l.type === 'weapon' && l.id) {
                    const newWepDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === l.id);
                    if (newWepDef) {
                        const newDPS = newWepDef.damage * newWepDef.fireRate;
                        let allowedSlots: number[] = [];
                        if (activeShip.config.isAlien) {
                            if (!newWepDef.isAmmoBased) {
                                if (activeShip.config.defaultGuns === 1) allowedSlots = [0];
                                else allowedSlots = [1, 2];
                            }
                        } else {
                            if (newWepDef.isAmmoBased) {
                                allowedSlots = [1, 2]; 
                            } else {
                                allowedSlots = [0]; 
                            }
                        }

                        let equipped = false;
                        for (const slotIdx of allowedSlots) {
                            if (!s.weapons[slotIdx]) {
                                s.weapons[slotIdx] = { id: l.id, count: 1 };
                                if (newWepDef.isAmmoBased) {
                                    s.gunStates[slotIdx] = { mag: 200, reloadTimer: 0, maxMag: 200 };
                                }
                                s.weaponHeat[slotIdx] = 0;
                                audioService.playSfx('buy');
                                setHud((h: any) => ({...h, alert: `EQUIPPED ${newWepDef.name}`, alertType: 'success'}));
                                equipped = true;
                                break;
                            }
                        }

                        if (!equipped && allowedSlots.length > 0) {
                            let worstSlot = -1;
                            let minDPS = Infinity;

                            for (const slotIdx of allowedSlots) {
                                const currentWep = s.weapons[slotIdx];
                                if (currentWep) {
                                    const currentDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === currentWep.id);
                                    const currentDPS = currentDef ? currentDef.damage * currentDef.fireRate : 0;
                                    
                                    if (currentDPS < minDPS) {
                                        minDPS = currentDPS;
                                        worstSlot = slotIdx;
                                    }
                                }
                            }

                            if (worstSlot !== -1 && newDPS > minDPS) {
                                const oldWep = s.weapons[worstSlot]!;
                                const oldDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === oldWep.id);
                                
                                const oldItem: CargoItem = { 
                                    instanceId: `loot_swap_${Date.now()}`, 
                                    type: 'weapon', 
                                    id: oldWep.id, 
                                    name: oldDef?.name || 'Weapon', 
                                    quantity: 1, 
                                    weight: 1 
                                };
                                tryAddToCargo(oldItem, `SWAPPED: ${oldDef?.name} TO CARGO`);

                                s.weapons[worstSlot] = { id: l.id, count: 1 };
                                if (newWepDef.isAmmoBased) {
                                    s.gunStates[worstSlot] = { mag: 200, reloadTimer: 0, maxMag: 200 };
                                }
                                s.weaponHeat[worstSlot] = 0;
                                
                                audioService.playSfx('buy');
                                setHud((h: any) => ({...h, alert: `UPGRADED TO ${newWepDef.name}`, alertType: 'success'}));
                                equipped = true;
                            }
                        }

                        if (equipped) {
                            processed = true;
                        } else {
                             const newItem: CargoItem = { instanceId: `loot_${Date.now()}`, type: 'weapon', id: l.id, name: l.name || 'Unknown', quantity: 1, weight: 1 };
                             tryAddToCargo(newItem, `LOOT STORED: ${l.name}`);
                             processed = true;
                        }
                    }
                }
                else if (l.type === 'shield' && l.id) {
                    const newShieldDef = [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === l.id);
                    if (newShieldDef) {
                        if (s.shieldId === l.id && s.sh1 < newShieldDef.capacity) {
                            s.sh1 = newShieldDef.capacity;
                            audioService.playSfx('buy');
                            setHud((h: any) => ({...h, alert: `SHIELD RECHARGED`, alertType: 'success'}));
                            processed = true;
                        } else if (s.secondShieldId === l.id && s.sh2 < newShieldDef.capacity) {
                            s.sh2 = newShieldDef.capacity;
                            audioService.playSfx('buy');
                            setHud((h: any) => ({...h, alert: `AUX SHIELD RECHARGED`, alertType: 'success'}));
                            processed = true;
                        } else {
                            const newCap = newShieldDef.capacity;
                            if (!s.shieldId) {
                                s.shieldId = l.id;
                                s.sh1 = newCap; 
                                audioService.playSfx('buy');
                                setHud((h: any) => ({...h, alert: `SHIELD EQUIPPED`, alertType: 'success'}));
                                processed = true;
                            } else if (!s.secondShieldId) {
                                s.secondShieldId = l.id;
                                s.sh2 = newCap;
                                audioService.playSfx('buy');
                                setHud((h: any) => ({...h, alert: `SECONDARY SHIELD EQUIPPED`, alertType: 'success'}));
                                processed = true;
                            } else {
                                const s1Def = [...SHIELDS, ...EXOTIC_SHIELDS].find(def => def.id === s.shieldId);
                                const s2Def = [...SHIELDS, ...EXOTIC_SHIELDS].find(def => def.id === s.secondShieldId);
                                const cap1 = s1Def?.capacity || 0;
                                const cap2 = s2Def?.capacity || 0;
                                
                                let replaceSlot = 0; 
                                let minCap = cap1;
                                
                                if (cap2 < cap1) { minCap = cap2; replaceSlot = 2; }
                                else { replaceSlot = 1; }
                                
                                if (newCap > minCap) {
                                    const oldId = replaceSlot === 1 ? s.shieldId : s.secondShieldId;
                                    const oldDef = replaceSlot === 1 ? s1Def : s2Def;
                                    
                                    const oldItem: CargoItem = { 
                                        instanceId: `loot_swap_s_${Date.now()}`, 
                                        type: 'shield', 
                                        id: oldId!, 
                                        name: oldDef?.name || 'Shield', 
                                        quantity: 1, 
                                        weight: 1 
                                    };
                                    tryAddToCargo(oldItem, `SWAPPED: ${oldDef?.name} TO CARGO`);

                                    if (replaceSlot === 1) { s.shieldId = l.id; s.sh1 = newCap; }
                                    else { s.secondShieldId = l.id; s.sh2 = newCap; }
                                    
                                    audioService.playSfx('buy');
                                    setHud((h: any) => ({...h, alert: `SHIELD UPGRADED`, alertType: 'success'}));
                                    processed = true;
                                } else {
                                    const newItem: CargoItem = { instanceId: `loot_s_${Date.now()}`, type: 'shield', id: l.id, name: l.name || 'Unknown', quantity: 1, weight: 1 };
                                    tryAddToCargo(newItem, `LOOT STORED: ${l.name}`);
                                    processed = true;
                                }
                            }
                        }
                    }
                }

                if (!processed) {
                    audioService.playSfx('buy');
                    const newItem: CargoItem = { instanceId: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, type: l.type as any, id: l.id || l.type, name: l.name || l.type.toUpperCase(), quantity: l.quantity || 1, weight: 1 }; 

                    if (l.type === 'fuel') { 
                        tryAddToCargo(newItem, "FUEL CANISTER ACQUIRED");
                    }
                    else if (l.type === 'water') {
                        tryAddToCargo(newItem, "WATER SUPPLY ACQUIRED");
                    }
                    else if (l.type === 'energy') { 
                        tryAddToCargo(newItem, "ENERGY CELL ACQUIRED");
                    }
                    else if (l.type === 'repair' || l.type === 'nanite') { s.hp = Math.min(100, s.hp + 10); setHud((h: any) => ({...h, alert: "+HULL REPAIR", alertType: 'success'})); }
                    else if (l.type === 'missile') { s.missiles = Math.min(10, s.missiles + (l.quantity || 1)); setHud((h: any) => ({...h, alert: `+${l.quantity || 1} MISSILES`, alertType: 'success'})); }
                    else if (l.type === 'mine') { s.mines = Math.min(10, s.mines + (l.quantity || 1)); setHud((h: any) => ({...h, alert: `+${l.quantity || 1} MINES`, alertType: 'success'})); }
                    else if (l.type === 'ammo') { const ammoId = l.id as any; if (ammoId) { s.ammo[ammoId] = (s.ammo[ammoId] || 0) + (l.quantity || 100); setHud((h: any) => ({...h, alert: `+${l.quantity || 100} AMMO UNITS`, alertType: 'success'})); } }
                    else if (l.type === 'weapon' || l.type === 'shield') { 
                        tryAddToCargo(newItem, `LOOT STORED: ${l.name}`);
                    }
                    else if (['gold', 'platinum', 'lithium', 'iron', 'copper', 'chromium', 'titanium', 'tungsten', 'goods', 'robot', 'drug', 'medicine', 'food', 'equipment', 'part', 'luxury'].includes(l.type)) { 
                        tryAddToCargo(newItem, `+${l.quantity} ${l.name || l.type.toUpperCase()}`);
                    }
                    else { s.score += 500; }
                }
            }
        });
        s.loot = s.loot.filter(l => !l.isPulled && l.y < height + 100);
        
        s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; }); s.particles = s.particles.filter(p => p.life > 0);

        renderGame(ctx, s, width, height, currentShipConfig, quadrant, sizeScale);

        if (s.frame % 10 === 0) { 
            let totalMagAmmo = 0; let reloading = false; Object.values(s.gunStates).forEach((g: any) => { totalMagAmmo += g.mag; if (g.reloadTimer > 0) reloading = true; });
            setHud((prev: any) => ({ ...prev, hp: s.hp, sh1: s.sh1, sh2: s.sh2, fuel: s.fuel, water: s.water, energy: s.energy, score: s.score, missiles: s.missiles, mines: s.mines, redMines: s.redMines, timer: s.time, boss: s.enemies.find(e => e.type === 'boss'), ammoCount: totalMagAmmo, isReloading: reloading, overload: s.capacitor, overdrive: s.overdrive, rescueMode: s.rescueMode, capacitorLocked: s.capacitorLocked, powerMode: s.capsLock, shieldsOnline: s.shieldsEnabled, activeShield: currentShieldDef, activeSecondShield: currentSecondShieldDef, bossDead: s.bossDead })); 
        }
        raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
        cancelAnimationFrame(raf);
        audioService.stopBattleSounds();
    };
  }, []);

  return (
    <div 
        className="relative w-full h-full bg-black overflow-hidden cursor-crosshair touch-none select-none"
        onPointerDown={handlePointerDown}
        onClick={() => { if (state.current.paused && !state.current.isExitDialogOpen) togglePause(false); }}
    >
        <canvas ref={canvasRef} className="block w-full h-full" />
        
        <GameHUD 
            hud={hud} 
            shield={hud.activeShield || shield} 
            secondShield={hud.activeSecondShield || secondShield} 
            maxEnergy={maxEnergy} 
            maxFuel={maxFuel} 
            maxWater={maxWater} 
            hasGuns={!!activeShip.fitting.weapons[0]} 
            hasAmmoWeapons={!!activeShip.fitting.weapons[1] || !!activeShip.fitting.weapons[2]} 
            maxAmmoInMags={200}
            fontSize={fontSize}
            onPauseToggle={() => togglePause()}
            onAbort={() => handleAbortOrReturn()}
            onExitDialogClose={() => setShowExitDialog(false)}
            onExitGame={() => handleExit()}
            showExitDialog={showExitDialog}
            fireMissile={() => fireMissile(state.current)}
            fireMine={() => fireMine(state.current)}
            fireRedMine={() => fireRedMine(state.current, setHud)}
            inputRef={inputRef}
        />
    </div>
  );
};
