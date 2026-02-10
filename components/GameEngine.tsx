
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, EquippedWeapon, Planet, QuadrantType, WeaponType, CargoItem, PlanetStatusData, AmmoType } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, BOSS_SHIPS, EXOTIC_SHIELDS, SHIELDS } from '../constants.ts';
import { getEngineCoordinates, getWingMounts } from '../utils/drawingUtils.ts';
import { Enemy } from './game/Enemy.ts';
import { Projectile, Particle, Loot, GameEngineState } from './game/types.ts';
import { Asteroid } from './game/Asteroid.ts';
import { calculateDamage, OCTO_COLORS } from './game/utils.ts';
import { GameHUD } from './game/GameHUD.tsx';
import { fireMissile, fireMine, fireRedMine, firePowerShot, fireNormalShot, fireAlienWeapons, fireWingWeapon, createExplosion, createAreaDamage, takeDamage, applyShieldRamDamage, applyJetDamage, fireBlasterPistol } from './game/CombatMechanics.ts';
import { renderGame } from './game/GameRenderer.ts';

interface GameEngineProps {
  ships: {
    config: ExtendedShipConfig;
    fitting: ShipFitting;
    color?: string;
    wingColor?: string;
    cockpitColor?: string;
    gunColor?: string;
    secondaryGunColor?: string;
    gunBodyColor?: string;
    engineColor?: string;
    nozzleColor?: string;
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

const GameEngine: React.FC<GameEngineProps> = ({ ships, shield, secondShield, onGameOver, difficulty, currentPlanet, quadrant, fontSize, mode = 'combat', speedMode = 'normal' }) => {
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

  const maxAmmoInMags = activeShip.fitting.weapons.reduce((acc, w) => {
      if (!w) return acc;
      const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === w.id);
      return acc + (def?.isAmmoBased ? 200 : 0);
  }, 0);

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
    bossDead: false // Add bossDead state for HUD
  });
  
  const [showExitDialog, setShowExitDialog] = useState(false);

  const inputRef = useRef({ main: false, secondary: false });
  const tiltRef = useRef({ beta: 0, gamma: 0 }); 
  const hasTiltRef = useRef(false);
  const targetRef = useRef<{x: number, y: number} | null>(null);

  const state = useRef<GameEngineState>({
    px: window.innerWidth/2, py: window.innerHeight*0.8, hp: 100, fuel: 0, water: 0, energy: maxEnergy, 
    sh1: 0, sh2: 0, score: 0, time: mode === 'drift' ? 60 : 120, phase: 'travel', bossSpawned: false, bossDead: false,
    enemies: [] as Enemy[], asteroids: [] as Asteroid[], bullets: [] as Projectile[], 
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
    refuelDuration: 600, // Default to auto 10s
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
    // Dynamic Equipment Init
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
          magazineCurrent: Object.values(s.gunStates)[0]?.mag || s.magazineCurrent, 
          reloadTimer: s.reloadTimer,
          weapons: s.weapons,
          shieldId: s.shieldId,
          secondShieldId: s.secondShieldId
      });
  };

  const togglePause = (forceVal?: boolean) => {
      const s = state.current;
      
      // BOSS VICTORY: PAUSE becomes LAND
      if (s.bossDead) {
          finishGame(true, false); // Land (Not Aborted)
          return;
      }

      const next = forceVal !== undefined ? forceVal : !s.paused;
      
      if (s.paused === next) return; 
      
      s.paused = next;
      setHud(h => ({...h, isPaused: next}));
      
      if (next) {
          audioService.pauseMusic();
      } else {
          audioService.resumeMusic();
      }
  };

  const handleAbortOrReturn = () => {
      const s = state.current;
      if (s.bossDead) {
          // BOSS VICTORY: ABORT becomes RETURN
          finishGame(true, true); // Success, but Aborted means Skip Landing Scene (Return)
      } else {
          finishGame(false, true); // Failed/Aborted
      }
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
      
      try {
          if (window.history.length > 1) {
              window.history.back();
          } else {
              window.close();
          }
      } catch (e) {
          console.warn("Could not close window", e);
      }
  };

  useEffect(() => {
      const s = state.current;
      // Re-sync props on mount (or restart) if needed, though useRef holds initial
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

      const handleResize = () => { 
          initStars(); 
          if (!s.paused) togglePause(true); 
      };
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

  // --- MANUAL ACTIONS ---
  const handleManualRefuel = () => {
      const s = state.current;
      if (s.isRefueling) return;
      const hasFuel = s.cargo.some(c => c.type === 'fuel');
      if (hasFuel) {
          s.isRefueling = true; 
          s.refuelType = 'fuel'; 
          s.refuelStartVal = s.fuel;
          s.refuelDuration = 600; // 10s duration
          s.refuelTimer = 0;
          setHud(h => ({...h, alert: "MANUAL REFUEL INITIATED", alertType: 'info'})); 
          audioService.playSfx('buy');
      } else {
          setHud(h => ({...h, alert: "FUEL SUPPLY MISSING", alertType: 'error'}));
          audioService.playSfx('denied');
      }
  };

  const handleManualRehydrate = () => {
      const s = state.current;
      if (s.isRefueling) return;
      const hasWater = s.cargo.some(c => c.type === 'water');
      if (hasWater) {
          s.isRefueling = true; 
          s.refuelType = 'water'; 
          s.refuelStartVal = s.water;
          s.refuelDuration = 600; // 10s duration
          s.refuelTimer = 0;
          setHud(h => ({...h, alert: "MANUAL REHYDRATION INITIATED", alertType: 'info'})); 
          audioService.playSfx('buy');
      } else {
          setHud(h => ({...h, alert: "WATER SUPPLY MISSING", alertType: 'error'}));
          audioService.playSfx('denied');
      }
  };

  const handleManualReload = () => {
      const s = state.current;
      if (s.rescueMode) return;
      
      let reloadTriggered = false;
      Object.keys(s.gunStates).forEach(keyStr => {
          const key = parseInt(keyStr); 
          const gun = s.gunStates[key];
          const wId = s.weapons[key]?.id; // Use dynamic weapons
          const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === wId);
          
          if (!wDef || !wDef.isAmmoBased) return;
          
          // Allow reload if magazine isn't full and not currently reloading
          if (gun.mag < gun.maxMag && gun.reloadTimer === 0) {
              const defType = wDef.defaultAmmo || 'iron';
              const hasAmmo = (s.ammo[defType] || 0) > 0 || Object.values(s.ammo).some((v: number) => v > 0);
              
              if (hasAmmo) { 
                  // Manual reload takes 3 seconds (3000ms)
                  gun.reloadTimer = Date.now() + 3000; 
                  reloadTriggered = true;
              }
          }
      });

      if (reloadTriggered) {
          setHud(h => ({...h, alert: "MANUAL RELOAD CYCLE STARTED", alertType: 'warning'}));
          audioService.playSfx('click');
      } else {
          audioService.playSfx('denied');
      }
  };

  const handleManualEnergy = () => {
      const s = state.current;
      if (s.isEnergizing || s.rescueMode) return;
      
      const energyIdx = s.cargo.findIndex(c => c.type === 'energy');
      if (energyIdx >= 0) {
          s.isEnergizing = true;
          s.energizeTimer = 0;
          setHud(h => ({...h, alert: "ENERGY INJECTION SEQUENCE", alertType: 'info'}));
          audioService.playSfx('buy');
      } else {
          setHud(h => ({...h, alert: "ENERGY CELLS MISSING", alertType: 'error'}));
          audioService.playSfx('denied');
      }
  };

  // Helper to spawn garbage (jettisoned items)
  const spawnGarbage = (x: number, y: number, type: string, id: string, name: string) => {
      const s = state.current;
      const angle = Math.random() * Math.PI * 2;
      const speed = 5;
      s.loot.push({
          x: x, y: y, z: 0,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          type: type, id: id, name: name, quantity: 1,
          isPulled: false, isGarbage: true
      });
  };

  useEffect(() => {
    const k = state.current.keys;
    const kd = (e: KeyboardEvent) => { 
        if(e.repeat) return;
        
        const caps = e.getModifierState("CapsLock");
        state.current.capsLock = caps;
        
        if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === '-' || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract')) { e.preventDefault(); }
        if (e.code === 'Tab') { e.preventDefault(); } 
        
        k.add(e.code); 
        if(e.code === 'KeyP') { togglePause(); }
        if(e.code === 'Escape') {
            const s = state.current;
            if (s.isExitDialogOpen) { s.isExitDialogOpen = false; setShowExitDialog(false); togglePause(false); } 
            else { s.isExitDialogOpen = true; setShowExitDialog(true); togglePause(true); }
        }
        
        // Manual System Controls
        if (e.code === 'KeyF') handleManualRefuel();
        if (e.code === 'KeyH') handleManualRehydrate();
        if (e.code === 'KeyR') handleManualReload();
        if (e.code === 'KeyE') handleManualEnergy();
        
        if (e.code === 'KeyS') {
            const s = state.current;
            s.shieldsEnabled = !s.shieldsEnabled;
            setHud(h => ({...h, alert: s.shieldsEnabled ? "SHIELDS ONLINE" : "SHIELDS OFFLINE", alertType: s.shieldsEnabled ? 'success' : 'warning'}));
            audioService.playSfx('click');
        }

        if(!state.current.paused && state.current.active) {
            // Missile/Mine triggers
            if (!state.current.rescueMode) {
                if(e.code === 'KeyB') fireRedMine(state.current, setHud); 
                if(e.code === 'KeyN' || e.code === 'NumpadEnter' || e.code === 'Enter') fireMine(state.current, 'both');
            }
            
            if (e.code === 'Space') inputRef.current.main = true;
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') inputRef.current.secondary = true;
        }
    };
    const ku = (e: KeyboardEvent) => {
        k.delete(e.code);
        
        const caps = e.getModifierState("CapsLock");
        state.current.capsLock = caps;

        if (e.code === 'Space') inputRef.current.main = false;
        if (e.code === 'ControlLeft' || e.code === 'ControlRight') inputRef.current.secondary = false;
        if (e.code === 'Tab' || e.code === 'NumpadAdd') { state.current.missileBurstCount = 0; }
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { state.current.mineBurstCount = 0; }
    };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
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

        // SCALE FACTOR FOR INTERFACE SIZE
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
                    setHud(h => ({...h, alert: `AUTO-LAND IN ${timeLeft}s`, alertType: 'info'}));
                }
            }
            if (s.victoryTimer > 1200) { // 20s
                finishGame(true, false); // Success, Land (Aborted=False)
                return;
            }
        }

        // Resolve Shields dynamically
        const currentShieldDef = s.shieldId === 'dev_god_mode' ? { id: 'dev', capacity: 9999, color: '#fff', name: 'DEV', regenRate: 100, energyCost: 0, visualType: 'full' } as Shield : [...SHIELDS, ...EXOTIC_SHIELDS].find(def => def.id === s.shieldId) || null;
        const currentSecondShieldDef = s.secondShieldId === 'dev_god_mode' ? { id: 'dev', capacity: 9999, color: '#fff', name: 'DEV', regenRate: 100, energyCost: 0, visualType: 'full' } as Shield : [...SHIELDS, ...EXOTIC_SHIELDS].find(def => def.id === s.secondShieldId) || null;

        // Smart Power Diversion: Prioritize Capacitor if Shields are Healthy (>20%)
        const s1Max = currentShieldDef ? currentShieldDef.capacity : 1;
        const s2Max = currentSecondShieldDef ? currentSecondShieldDef.capacity : 1;
        const s1Pct = s.sh1 / s1Max;
        const s2Pct = s.sh2 / s2Max;
        
        // Check if shields are "safe" (>20%)
        const shieldsHealthy = (currentShieldDef ? s1Pct > 0.2 : true) && (currentSecondShieldDef ? s2Pct > 0.2 : true);
        const capacitorFull = s.capacitor >= 100;
        
        // If shields are healthy and capacitor needs charge, stop shield regen to divert power
        const divertToCapacitor = shieldsHealthy && !capacitorFull;
        const enableShieldRegen = s.shieldsEnabled && !divertToCapacitor;

        // Shield Regeneration
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
            // Ensure regen flags are reset if we are diverting power
            s.sh1RegenActive = false;
            s.sh2RegenActive = false;
        }
        
        s.wasShieldHit = false;
        
        const speed = 9;
        const fuelLimit = maxFuel * 0.1;
        
        if (s.isRefueling) {
            s.refuelTimer++;
            const DURATION = s.refuelDuration || 600; // Default 10s if not set
            const progress = s.refuelTimer / DURATION;
            if (s.refuelType === 'fuel') {
                const target = Math.min(maxFuel, s.fuel + 1.0); 
                s.fuel = s.refuelStartVal + (progress * (target - s.refuelStartVal));
            } else {
                const target = Math.min(maxWater, s.water + 20); 
                s.water = s.refuelStartVal + (progress * (target - s.refuelStartVal));
            }
            if (s.refuelTimer >= DURATION) {
                s.isRefueling = false; s.refuelTimer = 0;
                const cargoIdx = s.cargo.findIndex(c => c.type === s.refuelType);
                if (cargoIdx >= 0) {
                    s.cargo[cargoIdx].quantity--;
                    if (s.cargo[cargoIdx].quantity <= 0) s.cargo.splice(cargoIdx, 1);
                    setHud(h => ({...h, alert: s.refuelType === 'fuel' ? "REFUELING COMPLETE" : "REHYDRATION COMPLETE", alertType: 'success'}));
                    audioService.playSfx('buy');
                } else { setHud(h => ({...h, alert: "ERROR: SUPPLY MISSING", alertType: 'error'})); }
            } else if (s.refuelTimer % 30 === 0) {
                setHud(h => ({...h, alert: s.refuelType === 'fuel' ? `REFUELING... ${Math.floor(progress*100)}%` : `REHYDRATING... ${Math.floor(progress*100)}%`, alertType: 'warning'}));
            }
        } else {
            // AUTOMATIC CRITICAL TRIGGER (10 seconds / 600 frames)
            const criticalFuel = s.fuel < maxFuel * 0.1;
            const criticalWater = s.water < maxWater * 0.1;
            if (criticalFuel || criticalWater) {
                if (criticalWater) {
                    const hasWater = s.cargo.some(c => c.type === 'water');
                    if (hasWater) {
                        s.isRefueling = true; s.refuelType = 'water'; s.refuelStartVal = s.water; s.refuelDuration = 600;
                        setHud(h => ({...h, alert: "INITIATING AUTO-REHYDRATION", alertType: 'warning'})); audioService.playSfx('buy'); 
                    } else if (s.frame % 180 === 0) { setHud(h => ({...h, alert: "CRITICAL WATER - OUT OF SUPPLY", alertType: 'error'})); }
                } else if (criticalFuel) {
                    const hasFuel = s.cargo.some(c => c.type === 'fuel');
                    if (hasFuel) {
                        s.isRefueling = true; s.refuelType = 'fuel'; s.refuelStartVal = s.fuel; s.refuelDuration = 600;
                        setHud(h => ({...h, alert: "INITIATING AUTO-REFUEL", alertType: 'warning'})); audioService.playSfx('buy');
                    } else if (s.frame % 180 === 0) {
                        setHud(h => ({...h, alert: "CRITICAL FUEL - ABORT IMMEDIATELY", alertType: 'error'})); audioService.playAlertSiren();
                    }
                }
            }
        }

        // ENERGY INJECTION LOGIC
        if (s.isEnergizing) {
            s.energizeTimer++;
            const DURATION = 180; // 3 Seconds
            const progress = s.energizeTimer / DURATION;
            
            if (s.energizeTimer >= DURATION) {
                s.isEnergizing = false; s.energizeTimer = 0;
                
                const energyIdx = s.cargo.findIndex(c => c.type === 'energy');
                if (energyIdx >= 0) {
                    s.cargo[energyIdx].quantity--;
                    if (s.cargo[energyIdx].quantity <= 0) s.cargo.splice(energyIdx, 1);
                    
                    let remaining = 500; // Battery amount
                    
                    if (currentShieldDef && s.sh1 < currentShieldDef.capacity) {
                        const needed = currentShieldDef.capacity - s.sh1;
                        const take = Math.min(needed, remaining);
                        s.sh1 += take; remaining -= take;
                    }
                    if (remaining > 0 && currentSecondShieldDef && s.sh2 < currentSecondShieldDef.capacity) {
                        const needed = currentSecondShieldDef.capacity - s.sh2;
                        const take = Math.min(needed, remaining);
                        s.sh2 += take; remaining -= take;
                    }
                    if (remaining > 0 && s.energy < maxEnergy) {
                        const needed = maxEnergy - s.energy;
                        const take = Math.min(needed, remaining);
                        s.energy += take; remaining -= take;
                    }
                    if (remaining > 0) {
                        s.capacitor = Math.min(100, s.capacitor + (remaining / 5)); // approx scaling
                    }

                    setHud(h => ({...h, alert: "SYSTEMS RECHARGED", alertType: 'success'}));
                    audioService.playSfx('buy');
                }
            } else if (s.energizeTimer % 30 === 0) {
                setHud(h => ({...h, alert: `INJECTING POWER... ${Math.floor(progress*100)}%`, alertType: 'info'}));
            }
        }

        const isDistress = !s.rescueMode && s.fuel <= fuelLimit && s.water <= 0 && !s.isRefueling;
        
        if (isDistress) {
            s.distressTimer++;
            if (s.frame % 60 === 0) {
                const secondsLeft = 20 - Math.floor(s.distressTimer / 60);
                setHud(h => ({...h, alert: `CRITICAL RESOURCES - AUTO-ABORT IN ${secondsLeft}s`, alertType: 'alert'})); 
                audioService.playAlertSiren();
            }
            if (s.distressTimer > 1200) { 
                finishGame(false, true); // Failed/Aborted
                return;
            }
        } else {
            s.distressTimer = 0;
        }

        let targetThrottle = 0; let left = false; let right = false;
        
        const canMove = !isDistress; // Unlocked control during refueling

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
        
        // FORBIDDEN ZONE: Player cannot enter top 1/3 of screen
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
            gunColor: activeShip.gunColor
        };

        if (!s.rescueMode) {
            Object.keys(s.gunStates).forEach(keyStr => {
                const key = parseInt(keyStr); const gun = s.gunStates[key];
                const wId = s.weapons[key]?.id;
                const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === wId);
                if (!wDef || !wDef.isAmmoBased) return;
                if (gun.mag <= 0 && gun.reloadTimer === 0) {
                    const defType = wDef.defaultAmmo || 'iron';
                    let hasAmmo = (s.ammo[defType] || 0) > 0;
                    if (!hasAmmo) { const anyAmmo = Object.keys(s.ammo).some(k => (s.ammo[k as AmmoType] || 0) > 0); if (anyAmmo) hasAmmo = true; }
                    if (hasAmmo) { gun.reloadTimer = Date.now() + 10000; setHud(h => ({...h, alert: "RELOADING WEAPON SYSTEMS...", alertType: 'warning'})); } 
                    else { if (s.frame % 300 === 0) { setHud(h => ({...h, alert: "AMMUNITION DEPLETED", alertType: 'error'})); } }
                }
                if (gun.reloadTimer > 0 && Date.now() > gun.reloadTimer) {
                    const defType = wDef.defaultAmmo || 'iron';
                    let typeToUse = (s.ammo[defType] || 0) > 0 ? defType : null;
                    if (!typeToUse) { typeToUse = Object.keys(s.ammo).find(k => (s.ammo[k as AmmoType] || 0) > 0) as AmmoType || null; }
                    if (typeToUse) { const amount = Math.min(gun.maxMag, s.ammo[typeToUse]); s.ammo[typeToUse] -= amount; gun.mag += amount; gun.reloadTimer = 0; audioService.playSfx('buy'); setHud(h => ({...h, alert: "WEAPONS RELOADED", alertType: 'success'})); } else { gun.reloadTimer = 0; }
                }
            });
            
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

        // REPAIR LOGIC
        if (s.hp < 100 && !s.rescueMode) {
            if (s.cargo.some(c => c.id === 'bot_repair')) {
                // If we have bots, use resources
                const hasIron = s.cargo.some(c => c.type === 'iron');
                const hasCopper = s.cargo.some(c => c.type === 'copper');
                if ((hasIron || hasCopper) && s.energy > 50) {
                    if (s.frame % 60 === 0) {
                        s.hp = Math.min(100, s.hp + 1);
                        s.energy -= 20;
                        const metal = s.cargo.find(c => c.type === 'iron' || c.type === 'copper');
                        if (metal) {
                            metal.quantity--;
                            if (metal.quantity <= 0) s.cargo = s.cargo.filter(c => c !== metal);
                        }
                    }
                }
            }
        }

        if (s.shakeX > 0) s.shakeX *= s.shakeDecay; if (s.shakeY > 0) s.shakeY *= s.shakeDecay;
        if (s.shakeX < 0.5) s.shakeX = 0; if (s.shakeY < 0.5) s.shakeY = 0;

        // ... (Boss/Spawn logic remains same) ...
        if (s.phase === 'travel') { 
            let maxEnemies = 4; 
            if (quadrant === QuadrantType.GAMA) maxEnemies = 5;
            if (quadrant === QuadrantType.DELTA) maxEnemies = 6;

            const canSpawn = s.enemies.length < maxEnemies;

            if (canSpawn && Date.now() - s.lastSpawn > 1500 && !s.rescueMode) { 
               let spawnPool: ExtendedShipConfig[] = [];
                let isRareAlien = false;
                let shipIndexBase = 0;
                if (quadrant === QuadrantType.ALFA) shipIndexBase = 0;
                else if (quadrant === QuadrantType.BETA) shipIndexBase = 1;
                else if (quadrant === QuadrantType.GAMA) shipIndexBase = 2;
                else if (quadrant === QuadrantType.DELTA) shipIndexBase = 3;

                if (quadrant === QuadrantType.GAMA || quadrant === QuadrantType.DELTA) {
                    const alienChance = quadrant === QuadrantType.DELTA ? 0.15 : 0.05;
                    if (Math.random() < alienChance) {
                        spawnPool = SHIPS.filter(s => s.isAlien);
                        isRareAlien = true;
                    }
                }

                if (!isRareAlien) {
                    const shipA = SHIPS[shipIndexBase];
                    const shipB = SHIPS[Math.min(SHIPS.length - 1, shipIndexBase + 1)]; 
                    const progress = (difficulty - 1) % 3; 
                    const chanceB = 0.2 + (progress * 0.3); 
                    if (Math.random() < chanceB) spawnPool = [shipB]; else spawnPool = [shipA];
                }

                const selectedShip = spawnPool[Math.floor(Math.random() * spawnPool.length)] || SHIPS[0]; 
                let spawnBatch = 1;
                if (isRareAlien) spawnBatch = 1; 
                else {
                    if (quadrant === QuadrantType.GAMA) spawnBatch = 2; 
                    if (quadrant === QuadrantType.DELTA) spawnBatch = Math.random() > 0.5 ? 2 : 1;
                }
                if (s.enemies.length + spawnBatch > maxEnemies) spawnBatch = maxEnemies - s.enemies.length;

                if (spawnBatch > 0) {
                    const squadId = Math.floor(Math.random() * 100000);
                    const startX = Math.random() * (width - 200) + 100;
                    for(let i=0; i<spawnBatch; i++) {
                        const offset = i * 60; 
                        s.enemies.push(new Enemy(startX + offset, -50 - (Math.abs(offset)*0.5), 'fighter', selectedShip, difficulty, quadrant, squadId, offset)); 
                    }
                    s.lastSpawn = Date.now(); 
                }
            } 
            if (s.asteroids.length < 3 && Math.random() > 0.99 && !s.rescueMode) s.asteroids.push(new Asteroid(width, difficulty, quadrant));
            if (s.time <= 0) { s.phase = 'boss'; s.enemies = []; const bossConfig = BOSS_SHIPS[Math.floor(Math.random() * BOSS_SHIPS.length)]; s.enemies.push(new Enemy(width/2, -200, 'boss', bossConfig, difficulty, quadrant)); setHud(h => ({...h, alert: "BOSS DETECTED", alertType: 'alert'})); } else if (s.frame % 60 === 0) s.time--; 
        }

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
                e.update(s.px, s.py, width, height, s.bullets, worldSpeedFactor, s.bullets, difficulty, s.enemies, speedMult, shieldsActive); 
                
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
            if (e.hp <= 0 || e.y > height + 200) {
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
                        
                        // Drop Rates
                        let equipChance = 0.05;
                        if (quadrant === QuadrantType.ALFA) equipChance = 0.30;
                        else if (quadrant === QuadrantType.BETA) equipChance = 0.20;
                        else if (quadrant === QuadrantType.GAMA) equipChance = 0.10;

                        if (Math.random() < equipChance) {
                            if (Math.random() < 0.5) {
                                // WEAPON DROP MODIFICATION HERE
                                let dropSlot = 0;
                                if (quadrant === QuadrantType.ALFA && difficulty === 1) {
                                    // 10% Chance for Secondary (Slot 1)
                                    if (Math.random() < 0.1) dropSlot = 1;
                                }

                                let wId = e.equippedWeapons[dropSlot]?.id;
                                if (!wId) wId = e.equippedWeapons[0]?.id; // Fallback

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
            b.x += b.vx; b.y += b.vy; b.life--; 
            if (b.vz !== undefined) b.z = (b.z || 0) + b.vz;
            // Exotic growth...
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
            
            // AUTODESTRUCT
            if (b.life <= 0) {
                const isOrdnance = ['missile', 'missile_emp', 'mine', 'mine_emp', 'mine_red', 'missile_enemy', 'mine_enemy', 'octo_shell'].includes(b.type);
                if (isOrdnance) {
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
            
            // --- MISSILE TRACKING ---
            if (['missile', 'missile_emp', 'mine', 'mine_emp', 'mine_red', 'missile_enemy', 'mine_enemy'].includes(b.type)) {
                const isMissile = b.type.includes('missile');
                const age = s.frame - (b.launchTime || 0);
                if (age < 20) { if (isMissile) { b.vy -= (b.isEnemy ? -0.4 : 0.6); b.vx *= 0.95; } else { b.vx *= 0.99; } } 
                else {
                    if (b.isEnemy) {
                        if (!s.rescueMode) {
                            let targetX = s.px;
                            let targetY = s.py;
                            const mineMagnet = s.bullets.find(t => !t.isEnemy && t.type.includes('mine') && t.life > 0);
                            
                            if (mineMagnet) {
                                targetX = mineMagnet.x;
                                targetY = mineMagnet.y;
                                if (Math.hypot(b.x - targetX, b.y - targetY) < 30) {
                                    b.life = 0; 
                                    mineMagnet.life = 0; 
                                    createExplosion(s, b.x, b.y, '#facc15', 20, 'mine');
                                    createAreaDamage(s, b.x, b.y, 150, mineMagnet.damage, shield, secondShield, setHud); 
                                    audioService.playExplosion(0, 1.2, 'mine');
                                }
                            }

                            const dx = targetX - b.x; const dy = targetY - b.y; const dist = Math.hypot(dx, dy);
                            const isEnemyMine = b.type === 'mine_enemy';
                            const turnRate = b.turnRate || (isEnemyMine ? 0.03 : 0.05); 
                            const desiredSpeed = b.maxSpeed || (isEnemyMine ? 7 : 10);
                            const tx = (dx / dist) * desiredSpeed; const ty = (dy / dist) * desiredSpeed;
                            b.vx += (tx - b.vx) * turnRate; b.vy += (ty - b.vy) * turnRate;
                        }
                    } else {
                        // PLAYER MISSILE LOGIC
                        
                        // 1. Validate Targets
                        if (b.targetProjectile && b.targetProjectile.life <= 0) b.targetProjectile = null;
                        if (b.target && b.target.hp <= 0) b.target = null;

                        // 2. Search if no target
                        if (!b.targetProjectile && !b.target) {
                            // Priority: Enemy Ordnance
                            let bestOrd = null;
                            let minOrdDist = 800; // Increased search range
                            
                            for (const other of s.bullets) {
                                if (other.isEnemy && (other.type.includes('missile') || other.type.includes('mine')) && other.life > 0) {
                                    const d = Math.hypot(other.x - b.x, other.y - b.y);
                                    if (d < minOrdDist) {
                                        minOrdDist = d;
                                        bestOrd = other;
                                    }
                                }
                            }
                            
                            if (bestOrd) {
                                b.targetProjectile = bestOrd;
                            } else {
                                let best = null; let bestScore = -Infinity; 
                                let searchDir = isMissile ? (Math.hypot(b.vx, b.vy) > 1 ? Math.atan2(b.vy, b.vx) : -Math.PI/2) : (b.vx > 0 ? 0 : Math.PI);
                                const cone = isMissile ? (Math.PI / 2.5) : (Math.PI / 1.5); 
                                s.enemies.forEach(e => {
                                    if (e.hp <= 0) return;
                                    const dx = e.x - b.x; const dy = e.y - b.y; const dz = e.z - (b.z || 0); const dist3d = Math.hypot(dx, dy, dz);
                                    if (dist3d > 900) return;
                                    const angleToEnemy = Math.atan2(dy, dx); let diff = angleToEnemy - searchDir;
                                    while (diff <= -Math.PI) diff += 2*Math.PI; while (diff > Math.PI) diff -= 2*Math.PI;
                                    if (Math.abs(diff) < cone) { const score = (5000 / (dist3d + 1)) + (20 / (Math.abs(diff) + 0.1)); if (score > bestScore) { bestScore = score; best = e; } }
                                });
                                if (best) b.target = best;
                            }
                        }
                        
                        // 3. Steer towards target
                        let tx = 0, ty = 0, tz = 0;
                        let hasTarget = false;
                        
                        if (b.targetProjectile) {
                            tx = b.targetProjectile.x;
                            ty = b.targetProjectile.y;
                            tz = b.targetProjectile.z || 0;
                            hasTarget = true;
                        } else if (b.target) {
                            tx = b.target.x;
                            ty = b.target.y;
                            tz = b.target.z - (b.z || 0);
                            hasTarget = true;
                        }

                        if (hasTarget) {
                            const dx = tx - b.x; const dy = ty - b.y; const dz = tz; const dist = Math.hypot(dx, dy, dz);
                            const turnRate = isMissile ? 0.18 : 0.08; const desiredSpeed = isMissile ? 15 : 8;
                            const ttx = (dx / dist) * desiredSpeed; const tty = (dy / dist) * desiredSpeed; const ttz = (dz / dist) * desiredSpeed;
                            b.vx += (ttx - b.vx) * turnRate; b.vy += (tty - b.vy) * turnRate; b.vz = (b.vz || 0) + (ttz - (b.vz || 0)) * turnRate;
                        }
                    }
                    if (isMissile || b.type === 'mine_enemy') { const speed = Math.hypot(b.vx, b.vy); if (speed < (b.maxSpeed || 16)) { b.vx *= 1.05; b.vy *= 1.05; } }
                }
            }
            
            // --- COLLISION LOGIC ---

            if (b.isEnemy && !s.rescueMode) { 
                // ENEMY MISSILE HITTING PLAYER
                const hitRadius = Math.max(30, 30 * sizeScale);
                if (Math.hypot(b.x-s.px, b.y-s.py) < hitRadius) { 
                    takeDamage(s, b.damage, b.type, currentShieldDef, currentSecondShieldDef, setHud); 
                    b.life = 0; // Destroy enemy missile
                    createExplosion(s, b.x, b.y, b.color, 3); 
                } 
            } else if (!b.isEnemy) {
                // PLAYER BULLET LOGIC
                
                // 1. Intercept Enemy Ordnance (Any player bullet can hit enemy ordnance)
                const interceptionRadius = (b.type.includes('missile') || b.type.includes('mine')) ? 60 : 30; // Easier for missiles to intercept
                for (const other of s.bullets) {
                    if (other.isEnemy && (other.type.includes('missile') || other.type.includes('mine')) && other.life > 0) {
                         if (Math.hypot(b.x - other.x, b.y - other.y) < interceptionRadius) {
                             other.life = 0; // Kill enemy ordnance
                             // Unless it's a penetrating laser or power shot, kill player bullet
                             if (!b.isOvercharge && b.type !== 'laser') b.life = 0;
                             
                             createExplosion(s, other.x, other.y, '#fca5a5', 10, 'smoke');
                             audioService.playImpact('metal', 0.5);
                             
                             // If player missile intercepted, explode properly
                             if (b.type.includes('missile') || b.type.includes('mine')) {
                                createExplosion(s, b.x, b.y, '#facc15', 20, 'mine');
                                createAreaDamage(s, b.x, b.y, 150, b.damage, currentShieldDef, currentSecondShieldDef, setHud);
                             }
                         }
                    }
                }

                // 2. Hit Enemy Ships
                let hit = false; 
                if (b.life > 0) { // Only check if bullet didn't die intercepting
                    s.enemies.forEach(e => { 
                        if (b.life <= 0) return; // Skip if bullet died
                        const isOrdnance = b.type.includes('missile') || b.type.includes('mine');
                        const hullRadius = (e.type === 'boss' ? 80 : 40) * sizeScale;
                        const shieldRadius = e.shieldLayers.length > 0 ? (hullRadius + (20 * sizeScale)) : 0; 
                        const zDist = Math.abs((b.z || 0) - e.z);
    
                        const dist2d = Math.hypot(b.x-e.x, b.y-e.y);
                        
                        if (dist2d < (shieldRadius || hullRadius) + 20 && (!isOrdnance || zDist < 80)) { 
                            let effectiveDamage = b.damage;
                            // Special weapon scaling logic...
                            if (b.weaponId === 'exotic_star_shatter') {
                                if (b.isOvercharge) { const ratio = Math.min(1, Math.max(0, (b.width - 6) / 30)); const multiplier = 4 + (ratio * 16); effectiveDamage = b.damage * multiplier; } 
                                else { const ratio = Math.min(1, b.width / 12); effectiveDamage = b.damage * ratio; }
                            }
                            if (b.weaponId === 'exotic_flamer' && !b.isOvercharge) effectiveDamage *= (b.life / 50); 
    
                            const angleToBullet = Math.atan2(b.y - e.y, b.x - e.x);
                            let normAngle = angleToBullet;
                            if (normAngle < 0) normAngle += Math.PI * 2;
    
                            if (b.type === 'octo_shell') {
                                if (dist2d < (shieldRadius || hullRadius)) {
                                    hit = true;
                                    // Octo Logic...
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
                                // Standard Hit Logic
                                if (shieldRadius > 0 && dist2d < shieldRadius + b.width/2 && dist2d > hullRadius - 5) {
                                    const shieldHitIdx = e.getHitShieldIndex(normAngle);
                                    if (shieldHitIdx !== -1) {
                                        e.damageShield(shieldHitIdx, effectiveDamage, b.type, !!b.isMain, !!b.isOvercharge, !!b.isEmp);
                                        hit = true;
                                        createExplosion(s, b.x, b.y, b.color, 2, 'shield_effect'); 
                                        audioService.playImpact('shield', 0.8);
                                    }
                                }
    
                                if (!hit && dist2d < hullRadius) {
                                    // Instakill chance for ordnance vs small fighters
                                    if (e.type !== 'boss') {
                                        const isMine = b.type.includes('mine');
                                        const isMissile = b.type.includes('missile');
                                        if ((isMine && Math.random() < 0.3) || (isMissile && Math.random() < 0.2)) {
                                            effectiveDamage = e.maxHp + 500;
                                        }
                                    }
    
                                    e.damageHull(effectiveDamage, b.type, !!b.isMain, !!b.isOvercharge);
                                    hit = true;
                                    createExplosion(s, b.x, b.y, '#f97316', 4, 'smoke'); 
                                    
                                    // Area Damage Trigger for Explosives
                                    if (b.type.includes('missile')) { 
                                        audioService.playExplosion(0, 0.8, 'normal'); 
                                        createAreaDamage(s, b.x, b.y, 100, b.damage / 2, currentShieldDef, currentSecondShieldDef, setHud);
                                    } else if (b.type.includes('mine')) { 
                                        audioService.playExplosion(0, 1.2, 'mine'); 
                                        createAreaDamage(s, b.x, b.y, 150, b.damage, currentShieldDef, currentSecondShieldDef, setHud); 
                                    } else if (b.isEmp || b.type.includes('emp')) {
                                        audioService.playExplosion(0, 1.2, 'emp'); 
                                    } else {
                                        audioService.playImpact('metal', 0.7);
                                    }
                                }
                            }
                        } 
                    });
                }
                
                // 3. Hit Asteroids
                if (b.life > 0) {
                    s.asteroids.forEach(a => {
                        if (b.life <= 0) return;
                        const hitThreshold = (b.weaponId === 'exotic_flamer' || b.weaponId === 'exotic_rainbow_spread' || b.weaponId === 'exotic_star_shatter' || b.type === 'octo_shell') ? Math.max(a.size + 10, b.width/2) : a.size + 10;
                        if (Math.hypot(b.x-a.x, b.y-a.y) < hitThreshold) {
                            let dmg = calculateDamage(b.damage, b.type, 'hull'); if (b.isOvercharge) dmg *= 5.0; 
                            
                            if (b.weaponId === 'exotic_flamer' && !b.isOvercharge) dmg *= (b.life / 50);
                            
                            // Octo Special
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
                                } else {
                                    audioService.playImpact(a.material === 'ice' ? 'ice' : 'rock', 0.6);
                                }
                            }
                        }
                    });
                }
                
                // FINAL DESTRUCTION CHECK
                // Force destruction for non-piercing weapons if hit occurred
                if (hit) {
                    const isPiercing = b.weaponId === 'exotic_rainbow_spread' || b.type === 'firework_shell' || (b.type === 'octo_shell' && !b.isOvercharge);
                    if (!isPiercing) {
                        b.life = 0; // DIE.
                    }
                }
            }
        });
        s.bullets = s.bullets.filter(b => b.life > 0);
        
        // --- LOOT LOGIC WITH SMART UPGRADE ---
        s.loot.forEach(l => {
            const dx = s.px - l.x; const dy = s.py - l.y; const dist = Math.hypot(dx, dy);
            
            // Tractor beam ignores garbage
            if (dist < 175 && !l.isGarbage) { 
                l.isBeingPulled = true; l.x += dx * 0.08; l.y += dy * 0.08; 
            } else { 
                l.isBeingPulled = false; l.y += 2 * worldSpeedFactor; l.x += l.vx; l.y += l.vy; 
            }

            if (dist < 30 && !l.isPulled && !l.isGarbage) {
                l.isPulled = true; 
                
                let processed = false;

                // SMART UPGRADE: WEAPONS
                if (l.type === 'weapon' && l.id) {
                    const newWepDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === l.id);
                    if (newWepDef) {
                        const newDPS = newWepDef.damage * newWepDef.fireRate;
                        
                        // Determine allowed slots based on ship type and weapon type
                        let allowedSlots: number[] = [];
                        if (activeShip.config.isAlien) {
                            if (!newWepDef.isAmmoBased) {
                                if (activeShip.config.defaultGuns === 1) allowedSlots = [0];
                                else allowedSlots = [1, 2];
                            }
                        } else {
                            // Human Ships
                            if (newWepDef.isAmmoBased) {
                                allowedSlots = [1, 2]; // Mechanical slots
                            } else {
                                allowedSlots = [0]; // Energy slot
                            }
                        }

                        let equipped = false;

                        // 1. Try to fill empty allowed slots
                        for (const slotIdx of allowedSlots) {
                            if (!s.weapons[slotIdx]) {
                                s.weapons[slotIdx] = { id: l.id, count: 1 };
                                if (newWepDef.isAmmoBased) {
                                    s.gunStates[slotIdx] = { mag: 200, reloadTimer: 0, maxMag: 200 };
                                }
                                s.weaponHeat[slotIdx] = 0;
                                audioService.playSfx('buy');
                                setHud(h => ({...h, alert: `EQUIPPED ${newWepDef.name}`, alertType: 'success'}));
                                equipped = true;
                                break;
                            }
                        }

                        // 2. If no empty slot, try to upgrade inferior weapon
                        if (!equipped && allowedSlots.length > 0) {
                            let worstSlot = -1;
                            let minDPS = Infinity;

                            for (const slotIdx of allowedSlots) {
                                const currentWep = s.weapons[slotIdx];
                                if (currentWep) {
                                    const currentDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === currentWep.id);
                                    const currentDPS = currentDef ? currentDef.damage * currentDef.fireRate : 0;
                                    
                                    // Found a weaker weapon?
                                    if (currentDPS < minDPS) {
                                        minDPS = currentDPS;
                                        worstSlot = slotIdx;
                                    }
                                }
                            }

                            if (worstSlot !== -1 && newDPS > minDPS) {
                                const oldWep = s.weapons[worstSlot]!;
                                const oldDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === oldWep.id);
                                
                                // Eject old weapon
                                spawnGarbage(s.px, s.py, 'weapon', oldWep.id, oldDef?.name || 'Weapon');
                                
                                // Equip new weapon
                                s.weapons[worstSlot] = { id: l.id, count: 1 };
                                if (newWepDef.isAmmoBased) {
                                    s.gunStates[worstSlot] = { mag: 200, reloadTimer: 0, maxMag: 200 };
                                }
                                s.weaponHeat[worstSlot] = 0;
                                
                                audioService.playSfx('buy');
                                setHud(h => ({...h, alert: `UPGRADED TO ${newWepDef.name}`, alertType: 'success'}));
                                equipped = true;
                            }
                        }

                        if (equipped) {
                            processed = true;
                        } else {
                            // Valid weapon type but no slot or not better -> Jettison new item
                            spawnGarbage(l.x, l.y, 'weapon', l.id, l.name || 'Weapon');
                            processed = true;
                        }
                    }
                }
                
                // SMART UPGRADE: SHIELDS
                else if (l.type === 'shield' && l.id) {
                    const newShieldDef = [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === l.id);
                    if (newShieldDef) {
                        const newCap = newShieldDef.capacity;
                        
                        // Check empty slots
                        if (!s.shieldId) {
                            s.shieldId = l.id;
                            s.sh1 = newCap; // Full charge on equip
                            audioService.playSfx('buy');
                            setHud(h => ({...h, alert: `SHIELD EQUIPPED`, alertType: 'success'}));
                            processed = true;
                        } else if (!s.secondShieldId) {
                            s.secondShieldId = l.id;
                            s.sh2 = newCap;
                            audioService.playSfx('buy');
                            setHud(h => ({...h, alert: `SECONDARY SHIELD EQUIPPED`, alertType: 'success'}));
                            processed = true;
                        } else {
                            // Compare
                            const s1Def = [...SHIELDS, ...EXOTIC_SHIELDS].find(def => def.id === s.shieldId);
                            const s2Def = [...SHIELDS, ...EXOTIC_SHIELDS].find(def => def.id === s.secondShieldId);
                            const cap1 = s1Def?.capacity || 0;
                            const cap2 = s2Def?.capacity || 0;
                            
                            let replaceSlot = 0; // 1 or 2
                            let minCap = cap1;
                            
                            if (cap2 < cap1) { minCap = cap2; replaceSlot = 2; }
                            else { replaceSlot = 1; }
                            
                            if (newCap > minCap) {
                                // Swap
                                const oldId = replaceSlot === 1 ? s.shieldId : s.secondShieldId;
                                const oldDef = replaceSlot === 1 ? s1Def : s2Def;
                                spawnGarbage(s.px, s.py, 'shield', oldId!, oldDef?.name || 'Shield');
                                
                                if (replaceSlot === 1) { s.shieldId = l.id; s.sh1 = newCap; }
                                else { s.secondShieldId = l.id; s.sh2 = newCap; }
                                
                                audioService.playSfx('buy');
                                setHud(h => ({...h, alert: `SHIELD UPGRADED`, alertType: 'success'}));
                                processed = true;
                            } else {
                                spawnGarbage(l.x, l.y, 'shield', l.id, l.name || 'Shield');
                                processed = true;
                            }
                        }
                    }
                }

                if (!processed) {
                    audioService.playSfx('buy');
                    // Standard loot behavior
                    if (l.type === 'fuel') { 
                        // ... existing fuel logic ...
                        const id = l.id || 'can_fuel'; const qty = l.quantity || 1;
                        const existing = s.cargo.find(c => c.id === id || c.type === 'fuel');
                        if (existing) existing.quantity += qty;
                        else s.cargo.push({ instanceId: `loot_${Date.now()}_f`, type: 'fuel', id, name: l.name || 'Fuel Cell', quantity: qty, weight: 1 });
                        setHud(h => ({...h, alert: "FUEL CANISTER ACQUIRED", alertType: 'success'}));
                    }
                    // ... (rest of loot types)
                    else if (l.type === 'water') {
                        const id = l.id || 'water'; const qty = l.quantity || 20; 
                        const existing = s.cargo.find(c => c.id === id || c.type === 'water');
                        if (existing) existing.quantity += qty;
                        else s.cargo.push({ instanceId: `loot_${Date.now()}_w`, type: 'water', id, name: l.name || 'Water', quantity: qty, weight: 1 });
                        setHud(h => ({...h, alert: "WATER SUPPLY ACQUIRED", alertType: 'success'}));
                    }
                    else if (l.type === 'energy') { 
                        const id = l.id || 'batt_cell'; const qty = l.quantity || 1;
                        const existing = s.cargo.find(c => c.id === id || c.type === 'energy');
                        if (existing) existing.quantity += qty;
                        else s.cargo.push({ instanceId: `loot_${Date.now()}_e`, type: 'energy', id, name: l.name || 'Cell', quantity: qty, weight: 1 });
                        setHud(h => ({...h, alert: "ENERGY CELL ACQUIRED", alertType: 'success'}));
                    }
                    else if (l.type === 'repair' || l.type === 'nanite') { s.hp = Math.min(100, s.hp + 10); setHud(h => ({...h, alert: "+HULL REPAIR", alertType: 'success'})); }
                    else if (l.type === 'missile') { s.missiles = Math.min(10, s.missiles + (l.quantity || 1)); setHud(h => ({...h, alert: `+${l.quantity || 1} MISSILES`, alertType: 'success'})); }
                    else if (l.type === 'mine') { s.mines = Math.min(10, s.mines + (l.quantity || 1)); setHud(h => ({...h, alert: `+${l.quantity || 1} MINES`, alertType: 'success'})); }
                    else if (l.type === 'ammo') { const ammoId = l.id as any; if (ammoId) { s.ammo[ammoId] = (s.ammo[ammoId] || 0) + (l.quantity || 100); setHud(h => ({...h, alert: `+${l.quantity || 100} AMMO UNITS`, alertType: 'success'})); } }
                    else if (l.type === 'weapon' || l.type === 'shield') { 
                        // Fallback for non-upgradeable duplicates or different types not handled by smart logic
                        const newItem: CargoItem = { instanceId: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, type: l.type as any, id: l.id, name: l.name || 'Unknown', quantity: l.quantity || 1, weight: 1 }; 
                        s.cargo.push(newItem); 
                        setHud(h => ({...h, alert: `LOOT STORED: ${l.name}`, alertType: 'success'})); 
                    }
                    else if (['gold', 'platinum', 'lithium', 'iron', 'copper', 'chromium', 'titanium', 'tungsten', 'goods', 'robot', 'drug', 'medicine', 'food', 'equipment', 'part', 'luxury'].includes(l.type)) { const itemId = l.id || l.type; const qty = l.quantity || 1; const existingItem = s.cargo.find(c => c.id === itemId); if (existingItem) { existingItem.quantity += qty; } else { s.cargo.push({ instanceId: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, type: l.type as any, id: itemId, name: l.name || itemId.toUpperCase(), quantity: qty, weight: 1 }); } setHud(h => ({...h, alert: `+${qty} ${l.name || l.type.toUpperCase()}`, alertType: 'success'})); }
                    else { s.score += 500; }
                }
            }
        });
        s.loot = s.loot.filter(l => !l.isPulled && l.y < height + 100);
        
        // Helper to eject garbage
        function spawnGarbage(x: number, y: number, type: string, id: string, name: string) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 6;
            s.loot.push({
                x, y, z: 0,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                type, id, name, quantity: 1,
                isPulled: false, isGarbage: true
            });
        }

        s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; }); s.particles = s.particles.filter(p => p.life > 0);

        renderGame(ctx, s, width, height, currentShipConfig, quadrant, sizeScale);

        if (s.frame % 10 === 0) { 
            let totalMagAmmo = 0; let reloading = false; Object.values(s.gunStates).forEach((g: any) => { totalMagAmmo += g.mag; if (g.reloadTimer > 0) reloading = true; });
            setHud(prev => ({ ...prev, hp: s.hp, sh1: s.sh1, sh2: s.sh2, fuel: s.fuel, water: s.water, energy: s.energy, score: s.score, missiles: s.missiles, mines: s.mines, redMines: s.redMines, timer: s.time, boss: s.enemies.find(e => e.type === 'boss'), ammoCount: totalMagAmmo, isReloading: reloading, overload: s.capacitor, overdrive: s.overdrive, rescueMode: s.rescueMode, capacitorLocked: s.capacitorLocked, powerMode: s.capsLock, shieldsOnline: s.shieldsEnabled, activeShield: currentShieldDef, activeSecondShield: currentSecondShieldDef, bossDead: s.bossDead })); 
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

export default GameEngine;
