
import React, { useRef, useEffect, useState } from 'react';
import { Shield, ShipFitting, EquippedWeapon, Planet, QuadrantType, WeaponType, CargoItem, PlanetStatusData, AmmoType } from '../types.ts';
import { audioService } from '../services/audioService.ts';
import { ExtendedShipConfig, SHIPS, WEAPONS, EXOTIC_WEAPONS, BOSS_SHIPS, EXOTIC_SHIELDS } from '../constants.ts';
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
    shieldsOnline: true 
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
    // Initialize regen flags
    sh1RegenActive: false,
    sh2RegenActive: false,
    distressTimer: 0
  });

  const togglePause = (forceVal?: boolean) => {
      const s = state.current;
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

  const handleExit = () => {
      const s = state.current;
      let finalHp = s.hp; let finalFuel = s.fuel;
      if (s.criticalExposure > 0 || s.rescueMode) { finalHp = 10; finalFuel *= 0.5; }
      
      onGameOver(false, s.score, true, { health: finalHp, fuel: finalFuel, water: s.water, rockets: s.missiles, mines: s.mines, redMineCount: s.redMines, cargo: s.cargo, ammo: s.ammo, magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer });
      
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
      s.hp = activeShip.fitting.health;
      s.fuel = activeShip.fitting.fuel;
      s.water = activeShip.fitting.water || 100;
      s.sh1 = shield?.capacity || 0;
      s.sh2 = secondShield?.capacity || 0;
      s.missiles = activeShip.fitting.rocketCount;
      s.mines = activeShip.fitting.mineCount;
      s.redMines = activeShip.fitting.redMineCount || 0;
      s.cargo = [...activeShip.fitting.cargo]; 
      
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
          const wId = activeShip.fitting.weapons[key]?.id;
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
        // Logarithmic scaling: Drastically reduces energy for starter ships (approx 1.0/frame), 
        // while allowing top-tier ships to reach high regeneration (approx 4.0+/frame).
        const logPrice = Math.log10(Math.max(1000, activeShip.config.price/2));
        const baseRegen = Math.max(0.2, (logPrice * 1.2) - 4.5);

        const isStress = s.wasShieldHit && s.isShooting;
        
        // Reactor Output: Reduced efficiency under combat stress
        const reactorOutput = isStress ? baseRegen * 0.5 : baseRegen;
        s.energy = Math.min(maxEnergy, s.energy + reactorOutput);

        // Shield Regeneration: Consumes Energy based on Shield Specs
        if (s.shieldsEnabled) {
            const processShield = (current: number, def: Shield | null, isActive: boolean): { val: number, active: boolean } => {
                if (!def) return { val: 0, active: false };
                
                let newActive = isActive;
                
                // Trigger condition: Drop below 50%
                if (!newActive && current < def.capacity * 0.5) {
                    newActive = true;
                }
                
                // Stop condition: Full
                if (newActive && current >= def.capacity) {
                    newActive = false;
                    current = def.capacity;
                }
                
                if (newActive) {
                    // Rates per frame (assuming ~60 FPS)
                    const regenPerFrame = def.regenRate / 30;
                    const costPerFrame  = def.energyCost / 30;
                    
                    if (costPerFrame <= 0) {
                         return { val: Math.min(def.capacity, current + regenPerFrame), active: true };
                    }
                    
                    if (s.energy >= costPerFrame) {
                        s.energy -= costPerFrame;
                        return { val: Math.min(def.capacity, current + regenPerFrame), active: true };
                    } else if (s.energy > 0) {
                        // Partial regen if energy is critical
                        const ratio = s.energy / costPerFrame;
                        s.energy = 0;
                        return { val: Math.min(def.capacity, current + (regenPerFrame * ratio)), active: true };
                    }
                }
                
                return { val: current, active: newActive };
            };

            const s1Res = processShield(s.sh1, shield, s.sh1RegenActive);
            s.sh1 = s1Res.val;
            s.sh1RegenActive = s1Res.active;

            const s2Res = processShield(s.sh2, secondShield, s.sh2RegenActive);
            s.sh2 = s2Res.val;
            s.sh2RegenActive = s2Res.active;
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
                    
                    // 1. Fill Shield 1
                    if (shield && s.sh1 < shield.capacity) {
                        const needed = shield.capacity - s.sh1;
                        const take = Math.min(needed, remaining);
                        s.sh1 += take;
                        remaining -= take;
                    }
                    
                    // 2. Fill Shield 2
                    if (remaining > 0 && secondShield && s.sh2 < secondShield.capacity) {
                        const needed = secondShield.capacity - s.sh2;
                        const take = Math.min(needed, remaining);
                        s.sh2 += take;
                        remaining -= take;
                    }
                    
                    // 3. Fill Reactor
                    if (remaining > 0 && s.energy < maxEnergy) {
                        const needed = maxEnergy - s.energy;
                        const take = Math.min(needed, remaining);
                        s.energy += take;
                        remaining -= take;
                    }
                    
                    // 4. Fill Capacitor
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
            
            // Alert logic
            if (s.frame % 60 === 0) {
                const secondsLeft = 20 - Math.floor(s.distressTimer / 60);
                setHud(h => ({...h, alert: `CRITICAL RESOURCES - AUTO-ABORT IN ${secondsLeft}s`, alertType: 'alert'})); 
                audioService.playAlertSiren();
            }
            
            // Trigger Abort (20 seconds * 60 frames = 1200)
            if (s.distressTimer > 1200) { 
                s.active = false;
                // Abort logic: Success = false, Aborted = true. State passed back preserves ships.
                onGameOver(false, s.score, true, { 
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
                    weapons: activeShip.fitting.weapons,
                    shieldId: activeShip.fitting.shieldId,
                    secondShieldId: activeShip.fitting.secondShieldId
                });
                return;
            }
        } else {
            s.distressTimer = 0;
        }

        let targetThrottle = 0; let left = false; let right = false;
        
        const canMove = !isDistress; // Unlocked control during refueling

        // Define directional keys for visual feedback
        let keyLeft = false;
        let keyRight = false;
        let keyUp = false;
        let keyDown = false;

        if (canMove) {
            // DIAGONAL LOGIC MAP
            if (s.keys.has('Numpad7')) { keyLeft = true; keyUp = true; }
            if (s.keys.has('Numpad9')) { keyRight = true; keyUp = true; }
            if (s.keys.has('Numpad1')) { keyLeft = true; keyDown = true; }
            if (s.keys.has('Numpad3')) { keyRight = true; keyDown = true; }

            keyLeft = keyLeft || s.keys.has('ArrowLeft') || s.keys.has('Numpad4') || s.keys.has('KeyA');
            keyRight = keyRight || s.keys.has('ArrowRight') || s.keys.has('Numpad6') || s.keys.has('KeyD');
            keyUp = keyUp || s.keys.has('ArrowUp') || s.keys.has('Numpad8') || s.keys.has('KeyW');
            keyDown = keyDown || s.keys.has('ArrowDown') || s.keys.has('ArrowDown') || s.keys.has('Numpad2') || s.keys.has('Numpad5') || s.keys.has('KeyS');

            // Simultaneous Key Check for "Stationary Burn"
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
                targetThrottle = 0; // Cancel movement
            } else if (keyUp) {
                targetThrottle = 1;
            } else if (keyDown) {
                targetThrottle = -1;
            }
            
            // Apply Jet Damage if locked
            if (isBurnLocked || isSideBurnLocked) {
                applyJetDamage(s, { 
                    up: isBurnLocked, 
                    down: isBurnLocked, 
                    left: isSideBurnLocked, 
                    right: isSideBurnLocked 
                }, setHud);
                
                // Consumes extra fuel
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
        
        // Pass both key state AND throttle for immediate visual feedback + smooth physics
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
            // Determine Ion/Fuel Mode based on resources
            const isIonMode = (s.energy > maxEnergy * 0.1) && (s.water > 0);
            s.usingWater = isIonMode;

            // Permanent idle drain (simulating reactor/engine hold)
            const idleDrain = 0.002;
            if (isIonMode) {
                // Idle Water/Energy Drain
                s.water = Math.max(0, s.water - (idleDrain * 2)); 
                s.energy = Math.max(0, s.energy - (idleDrain * 10)); 
            } else if (s.fuel > fuelLimit) {
                // Idle Fuel Drain
                s.fuel = Math.max(fuelLimit, s.fuel - idleDrain); 
            }

            if (isMoving) {
                let effort = 0.005; 
                if (Math.abs(s.currentThrottle) > 0.1) effort += 0.002 * Math.abs(s.currentThrottle);

                if (isIonMode) {
                    s.water = Math.max(0, s.water - (effort * 5.0)); 
                    s.energy = Math.max(0, s.energy - (effort * 100)); 
                } else if (s.fuel > fuelLimit) {
                    s.fuel = Math.max(fuelLimit, s.fuel - effort); 
                } else {
                    isMoving = false; 
                }
            }
            if (s.hp < 30) {
                if (s.frame % 5 === 0) s.particles.push({ x: s.px + (Math.random()-0.5)*20, y: s.py + 10, vx: (Math.random()-0.5)*1, vy: 2, life: 0.8, color: '#777', size: 3 + Math.random()*3 });
                if (s.hp < 15 && s.frame % 10 === 0) s.particles.push({ x: s.px + (Math.random()-0.5)*15, y: s.py, vx: 0, vy: 1, life: 0.5, color: '#f97316', size: 2 });
            }
        }
        
        const now = Date.now();
        // Updated Missile Logic: Tab OR NumpadAdd
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

        // Updated Mine Logic: Directional
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

        if (!s.rescueMode) {
            Object.keys(s.gunStates).forEach(keyStr => {
                const key = parseInt(keyStr); const gun = s.gunStates[key];
                const wId = activeShip.fitting.weapons[key]?.id;
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
            
            // CAPACITOR RECHARGE LOGIC
            // Consumes Reactor Energy to recharge Capacitor
            // Only recharge if not actively firing Power Shot (to allow drain)
            const capDeficit = 100 - s.capacitor;
            const canRecharge = capDeficit > 0 && !(s.isShooting && s.capsLock && !s.capacitorLocked);
            
            if (canRecharge) {
                // Recharge Speed: Linear
                const rechargeAmount = 0.5; 
                // Cost varies based on ship config? User said "between 10% to 100% of energy... depending on ship and gun".
                // We'll simplify: Heavier weapons cost more to recharge capacitor.
                const mainWeapon = activeShip.fitting.weapons[0];
                const wDef = mainWeapon ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === mainWeapon.id) : null;
                const damageTier = wDef ? wDef.damage / 50 : 1;
                const energyCost = rechargeAmount * 2 * damageTier; 
                
                // Only recharge if generator has reserve (>10%)
                if (s.energy > (maxEnergy * 0.1) && s.energy >= energyCost) {
                    s.energy -= energyCost;
                    s.capacitor = Math.min(100, s.capacitor + rechargeAmount);
                }
            }

            // UNLOCK LOGIC: Require 90% charge to re-enable Power Shot if locked
            if (s.capacitorLocked && s.capacitor >= 90) { 
                s.capacitorLocked = false; 
                setHud(h => ({...h, alert: "CAPACITOR ONLINE", alertType: 'success'})); 
            }
            if (s.capacitor <= 0) s.capacitorLocked = true;
            
            
            // ALIENS: Check for Power Shot logic (Test Mode Bypass)
            const isTestMode = shield && shield.id === 'dev' || secondShield && secondShield.id === 'dev' || activeShip.fitting.shieldId === 'dev_god_mode';
            
            if (activeShip.config.isAlien) { 
                if (isFiring) {
                    if (s.capsLock && !s.capacitorLocked) {
                         const capRatio = s.capacitor / 100;
                         const baseDelay = 6; 
                         const addedDelay = 24 * (capRatio * capRatio); 
                         const salvoRate = baseDelay + addedDelay;

                         if (s.frame - s.lastSalvoFire > salvoRate) { 
                             firePowerShot(s, activeShip, setHud, cvs.height, sizeScale); 
                             s.lastSalvoFire = s.frame; 
                         }
                    } else {
                         fireAlienWeapons(s, activeShip, sizeScale);
                    }
                }
            } 
            else {
                // FIRING LOGIC
                if (isFiring) {
                    if (s.capsLock && !s.capacitorLocked) {
                        // Power Mode: Uses Capacitor
                        const capRatio = s.capacitor / 100;
                        const baseDelay = 6; 
                        const addedDelay = 24 * (capRatio * capRatio); 
                        const salvoRate = baseDelay + addedDelay;

                        if (s.frame - s.lastSalvoFire > salvoRate) { 
                            firePowerShot(s, activeShip, setHud, cvs.height, sizeScale); 
                            s.lastSalvoFire = s.frame; 
                        }
                    } else {
                        // Normal Mode or Fallback (Generator Fed)
                        fireNormalShot(s, activeShip, sizeScale);
                    }
                }
            }
            
            Object.keys(s.weaponHeat).forEach(k => {
                const idx = parseInt(k);
                if (s.weaponHeat[idx] > 0) {
                    s.weaponHeat[idx] = Math.max(0, s.weaponHeat[idx] - 0.5);
                }
            });

            // UPDATED: Fire Wing Weapons via Numpad
            if (s.keys.has('Numpad0')) fireWingWeapon(s, activeShip, 1, sizeScale);
            if (s.keys.has('NumpadDecimal')) fireWingWeapon(s, activeShip, 2, sizeScale);

            const firingSecondary = inputRef.current.secondary;
            if (firingSecondary && !activeShip.config.isAlien) { 
                fireWingWeapon(s, activeShip, 1, sizeScale);
                fireWingWeapon(s, activeShip, 2, sizeScale);
            }
        } else {
            // RESCUE MODE LOGIC - Personal Blaster
            if (isFiring) {
                fireBlasterPistol(s);
            }
        }

        // REPAIR LOGIC
        if (s.hp < 100 && !s.rescueMode) {
            // Robot Repair (Faster, Resource Consuming) - Checks every 60 frames (approx 1s)
            if (s.frame % 60 === 0) {
                const hasRobot = s.cargo.some(c => c.type === 'robot');
                if (hasRobot) {
                    // Try to consume resources in order of commonality/value
                    const resourceTypes = ['iron', 'copper', 'chromium', 'titanium', 'gold', 'platinum', 'lithium'];
                    const resIdx = s.cargo.findIndex(c => resourceTypes.includes(c.type));
                    if (resIdx >= 0) {
                        const res = s.cargo[resIdx];
                        const repairVals: Record<string, number> = { iron: 2, copper: 4, chromium: 10, titanium: 16, gold: 20, platinum: 50, lithium: 80 };
                        const heal = repairVals[res.type] || 2;
                        
                        s.hp = Math.min(100, s.hp + heal);
                        res.quantity--;
                        if (res.quantity <= 0) s.cargo.splice(resIdx, 1);
                        
                        setHud(h => ({...h, alert: `AUTOREPAIR: -1 ${res.name.toUpperCase()}`, alertType: 'success'}));
                        audioService.playSfx('buy');
                    }
                }
            }
            
            // Nanite Repair (Slower, Pack Consuming) - Checks every 240 frames (approx 4s)
            if (s.frame % 240 === 0) {
                const naniteIdx = s.cargo.findIndex(c => c.type === 'repair');
                if (naniteIdx >= 0) {
                    const nanite = s.cargo[naniteIdx];
                    s.hp = Math.min(100, s.hp + 15); // Heals 15 HP
                    nanite.quantity--;
                    if (nanite.quantity <= 0) s.cargo.splice(naniteIdx, 1);
                    
                    setHud(h => ({...h, alert: "NANITE REPAIR: -1 PACK", alertType: 'success'}));
                    audioService.playSfx('buy');
                }
            }
        }

        if (s.shakeX > 0) s.shakeX *= s.shakeDecay; if (s.shakeY > 0) s.shakeY *= s.shakeDecay;
        if (s.shakeX < 0.5) s.shakeX = 0; if (s.shakeY < 0.5) s.shakeY = 0;

        if (s.phase === 'boss') {
            const boss = s.enemies.find(e => e.type === 'boss');
            if (boss && boss.y > height + 100) {
                if (s.failureTimer === 0) setHud(h => ({...h, alert: "MISSION FAILED. RETURN TO BASE.", alertType: 'alert'}));
                s.failureTimer++;
                if (s.failureTimer > 600) { onGameOver(false, s.score, false, { health: s.hp, fuel: s.fuel, water: s.water, cargo: s.cargo }); s.active = false; }
            }
            if (s.bossDead) { s.victoryTimer++; if (s.victoryTimer > 180) { onGameOver(true, s.score, false, { health: s.hp, fuel: s.fuel, water: s.water, rockets: s.missiles, mines: s.mines, redMineCount: s.redMines, cargo: s.cargo, ammo: s.ammo, magazineCurrent: s.magazineCurrent, reloadTimer: s.reloadTimer }); s.active = false; } }
        }

        if (s.phase === 'travel') { 
            let maxEnemies = 4; 
            if (quadrant === QuadrantType.GAMA) maxEnemies = 5;
            if (quadrant === QuadrantType.DELTA) maxEnemies = 6;

            const canSpawn = s.enemies.length < maxEnemies;

            if (canSpawn && Date.now() - s.lastSpawn > 1500 && !s.rescueMode) { 
                let spawnPool: ExtendedShipConfig[] = [];
                let isRareAlien = false;

                // SHIP SELECTION LOGIC based on Quadrant
                // Alpha (Diff 1-3): Vanguard (0), Ranger (1)
                // Beta (Diff 4-6): Ranger (1), Eclipse (2)
                // Gamma (Diff 7-9): Eclipse (2), Striker (3)
                // Delta (Diff 10-12): Striker (3), Behemoth (4)
                
                let shipIndexBase = 0;
                if (quadrant === QuadrantType.ALFA) shipIndexBase = 0;
                else if (quadrant === QuadrantType.BETA) shipIndexBase = 1;
                else if (quadrant === QuadrantType.GAMA) shipIndexBase = 2;
                else if (quadrant === QuadrantType.DELTA) shipIndexBase = 3;

                // Rare Alien Injection (Gamma & Delta only)
                if (quadrant === QuadrantType.GAMA || quadrant === QuadrantType.DELTA) {
                    const alienChance = quadrant === QuadrantType.DELTA ? 0.15 : 0.05;
                    if (Math.random() < alienChance) {
                        spawnPool = SHIPS.filter(s => s.isAlien);
                        isRareAlien = true;
                    }
                }

                if (!isRareAlien) {
                    const shipA = SHIPS[shipIndexBase];
                    const shipB = SHIPS[Math.min(SHIPS.length - 1, shipIndexBase + 1)]; // Ensure no overflow, though logic caps at 3+1=4 (Behemoth)
                    
                    // Probability Shift: 
                    // Level 1 of Quadrant -> Mostly Ship A
                    // Level 3 of Quadrant -> Mostly Ship B
                    const progress = (difficulty - 1) % 3; // 0, 1, 2
                    const chanceB = 0.2 + (progress * 0.3); // 0.2, 0.5, 0.8
                    
                    if (Math.random() < chanceB) {
                        spawnPool = [shipB];
                    } else {
                        spawnPool = [shipA];
                    }
                }

                const selectedShip = spawnPool[Math.floor(Math.random() * spawnPool.length)] || SHIPS[0]; 
                
                let spawnBatch = 1;
                
                if (isRareAlien) {
                    spawnBatch = 1; // Solo
                } else {
                    if (quadrant === QuadrantType.GAMA) spawnBatch = 2; 
                    if (quadrant === QuadrantType.DELTA) spawnBatch = Math.random() > 0.5 ? 2 : 1;
                }

                if (s.enemies.length + spawnBatch > maxEnemies) spawnBatch = maxEnemies - s.enemies.length;

                if (spawnBatch > 0) {
                    const squadId = Math.floor(Math.random() * 100000);
                    
                    if (quadrant === QuadrantType.GAMA && spawnBatch === 2 && !isRareAlien) {
                        const leftEnemy = new Enemy(width * 0.25, -50, 'fighter', selectedShip, difficulty, quadrant, squadId, 0, 'z');
                        const rightEnemy = new Enemy(width * 0.75, -50, 'fighter', selectedShip, difficulty, quadrant, squadId, 0, 'mirror_z');
                        s.enemies.push(leftEnemy, rightEnemy);
                    } 
                    else if (quadrant === QuadrantType.DELTA && !isRareAlien) {
                        for(let i=0; i<spawnBatch; i++) {
                             const side = Math.random() > 0.5 ? 'left' : 'right';
                             const startX = side === 'left' ? 50 : width - 50;
                             const pattern = side === 'left' ? 'cross_left' : 'cross_right';
                             s.enemies.push(new Enemy(startX, -50 - (i*60), 'fighter', selectedShip, difficulty, quadrant, squadId, 0, pattern));
                        }
                    }
                    else {
                        const startX = Math.random() * (width - 200) + 100;
                        for(let i=0; i<spawnBatch; i++) {
                            const offset = i * 60; 
                            s.enemies.push(new Enemy(startX + offset, -50 - (Math.abs(offset)*0.5), 'fighter', selectedShip, difficulty, quadrant, squadId, offset)); 
                        }
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
                takeDamage(s, 20, 'collision', shield, secondShield, setHud);
                a.hp = 0;
                audioService.playImpact(a.material, 1.0);
                createExplosion(s, a.x, a.y, '#aaa', 10, 'asteroid');
            }
        }); 
        s.asteroids = s.asteroids.filter(a => a.y < height + 100 && a.hp > 0);

        s.enemies.forEach(e => { 
            if (s.rescueMode) { e.y += 3; if (e.type === 'boss') e.y += 2; } 
            else {
                // Pass shield active status to enemy
                const shieldsActive = s.shieldsEnabled && (s.sh1 > 0 || s.sh2 > 0);
                e.update(s.px, s.py, width, height, s.bullets, worldSpeedFactor, s.bullets, difficulty, s.enemies, speedMult, shieldsActive); 
                
                if (e.hp < e.maxHp && e.hp > 0) {
                    if (e.hp < e.maxHp * 0.9 && Math.random() < 0.2) s.particles.push({ x: e.x + (Math.random()-0.5)*30, y: e.y + (Math.random()-0.5)*30, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 0.5 + Math.random()*0.5, size: 3 + Math.random()*4, color: '#52525b', type: 'smoke' });
                    if (e.hp < e.maxHp * 0.5 && Math.random() < 0.3) s.particles.push({ x: e.x + (Math.random()-0.5)*20, y: e.y + (Math.random()-0.5)*20, vx: (Math.random()-0.5), vy: (Math.random()-0.5), life: 0.4 + Math.random()*0.3, size: 2 + Math.random()*3, color: '#ef4444', type: 'fire' });
                }
                
                if (Math.abs(e.z) < 50 && Math.hypot(e.x-s.px, e.y-s.py) < (60 * sizeScale)) {
                    takeDamage(s, 30, 'collision', shield, secondShield, setHud);
                    
                    // NEW: Shield Ramming Logic (Damage boss if player shields are up)
                    if (e.type === 'boss') {
                        applyShieldRamDamage(s, e, setHud);
                    } else {
                        e.hp = 0; // Standard enemy dies on ram
                    }
                    
                    audioService.playImpact('metal', 1.0);
                    createExplosion(s, e.x, e.y, '#f00', 10);
                }
            }
        });
        
        for (let i = s.enemies.length - 1; i >= 0; i--) {
            const e = s.enemies[i];
            if (e.hp <= 0 || e.y > height + 200) {
                if (e.hp <= 0 && !s.rescueMode) {
                    createAreaDamage(s, e.x, e.y, 150, 50, shield, secondShield, setHud);
                    if (e.type === 'boss') {
                        s.bossDead = true; s.score += 10000 * difficulty;
                        audioService.playExplosion(e.x, 3.0, 'boss');
                        createExplosion(s, e.x, e.y, '#a855f7', 30, 'boss');
                        setHud(h => ({...h, alert: "BOSS DEFEATED", alertType: 'success'}));
                        
                        for (let k=0; k<2; k++) {
                            const rand = Math.random();
                            let lootType = ''; let lootId = ''; let quantity = 1; let name = '';
                            if (rand < 0.25) { 
                                const w = EXOTIC_WEAPONS[Math.floor(Math.random() * EXOTIC_WEAPONS.length)]; 
                                lootType = 'weapon'; lootId = w.id; name = w.name; 
                            } else if (rand < 0.5) { 
                                const sh = EXOTIC_SHIELDS[Math.floor(Math.random() * EXOTIC_SHIELDS.length)]; 
                                lootType = 'shield'; lootId = sh.id; name = sh.name; 
                            } else if (rand < 0.75) { 
                                lootType = 'missile'; quantity = 50; name = 'Missile Pack'; 
                            } else { 
                                lootType = 'mine'; quantity = 50; name = 'Mine Pack'; 
                            }
                            // Spawn Boss Loot with ID 'batt_cell' for energy if applicable
                            if (k === 0) spawnLoot(e.x - 20, e.y, 0, 'energy', 'batt_cell', 'Energy Pack', 5);
                            else spawnLoot(e.x + (k*40)-20, e.y, 0, lootType, lootId, name, quantity);
                        }
                    } else {
                        audioService.playExplosion(e.x, 1.0, 'normal');
                        s.score += 100 * difficulty;
                        
                        // NEW LOOT LOGIC
                        // 10% Chance to drop equipped weapon
                        if (Math.random() < 0.1 && e.equippedWeapons[0]) {
                            const wId = e.equippedWeapons[0].id;
                            const wDef = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === wId);
                            if (wDef) {
                                spawnLoot(e.x, e.y, 0, 'weapon', wId, wDef.name, 1);
                            }
                        } else if (Math.random() < 0.4) { // 40% Chance for other supplies
                            if (Math.random() < 0.5) {
                                spawnLoot(e.x, e.y, 0, 'energy', 'batt_cell', 'Energy Pack', 1);
                            } else {
                                const ammos = ['iron', 'titanium', 'cobalt', 'iridium', 'tungsten', 'explosive'];
                                const selected = ammos[Math.floor(Math.random() * ammos.length)];
                                spawnLoot(e.x, e.y, 0, 'ammo', selected, 'Ammo Box', 100);
                            }
                        }
                    }
                } else if (e.hp <= 0 && s.rescueMode) {
                    // Score even in rescue mode if killed
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
            
            if (b.weaponId?.includes('exotic')) {
                if (b.growthRate && b.isOvercharge) {
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

                if (b.weaponId === 'exotic_flamer') {
                    const maxW = b.isOvercharge ? 250 : 100;
                    if (b.width < maxW && b.growthRate) {
                        b.width *= b.growthRate;
                        b.height *= b.growthRate;
                    }

                    const dist = Math.max(0, s.py - b.y);
                    const p = Math.min(1, dist / 800);

                    if (p < 0.15) b.color = '#3b82f6';      
                    else if (p < 0.25) b.color = '#ffffff'; 
                    else if (p < 0.45) b.color = '#facc15'; 
                    else if (p < 0.70) b.color = '#f97316'; 
                    else b.color = '#ef4444';               
                    
                    if (p > 0.75) {
                        b.opacity = Math.max(0, 1 - ((p - 0.75) * 4));
                    } else {
                        b.opacity = 1;
                    }
                }

                if (b.weaponId === 'exotic_octo_burst') {
                    if (s.frame % 2 === 0) { 
                        s.particles.push({
                            x: b.x + (Math.random()-0.5)*b.width,
                            y: b.y + (Math.random()-0.5)*b.height,
                            vx: (Math.random()-0.5)*1,
                            vy: (Math.random()-0.5)*1, 
                            life: 0.6,
                            color: b.isMulticolor && Math.random() > 0.5 ? OCTO_COLORS[Math.floor(Math.random() * OCTO_COLORS.length)] : b.color,
                            size: Math.random() * 3 + 1,
                            type: 'sparkle' 
                        });
                    }
                }
            }

            if (b.type === 'firework_shell' && b.detonationY !== undefined) {
                if (Math.random() > 0.5) s.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.5, size: 2, color: '#fbbf24' });
                if (b.y <= b.detonationY) { b.life = 0; createExplosion(s, b.x, b.y, b.color, 25, 'fireworks'); createAreaDamage(s, b.x, b.y, 120, b.damage, shield, secondShield, setHud); audioService.playExplosion(0, 0.8, 'mine'); }
            }
            
            if (b.type === 'octo_shell') {
                if (b.isOvercharge && b.detonationY !== undefined && b.y <= b.detonationY) {
                    b.life = 0;
                    if (b.isMulticolor) {
                        for(let i=0; i<3; i++) {
                             createExplosion(s, b.x + (Math.random()-0.5)*20, b.y + (Math.random()-0.5)*20, OCTO_COLORS[Math.floor(Math.random()*OCTO_COLORS.length)], 15, 'fireworks');
                        }
                    } else {
                        createExplosion(s, b.x, b.y, b.color, 30, 'fireworks'); 
                    }
                    
                    audioService.playExplosion(0, 1.2, 'mine'); 
                    
                    s.enemies.forEach(e => {
                        if (e.hp <= 0) return;
                        const dist = Math.hypot(e.x - b.x, e.y - b.y);
                        if (dist < 200) {
                            const dmg = calculateDamage(b.damage, 'explosion', 'hull');
                            e.damageHull(dmg, 'explosion', true, true);
                            
                            if (e.shieldLayers.length > 0 && Math.random() > 0.5) {
                                e.shieldDisabledUntil = 300; 
                                createExplosion(s, e.x, e.y, '#3b82f6', 10, 'standard'); 
                            }
                        }
                    });
                }
            }

            if (['missile', 'missile_emp', 'mine', 'mine_emp', 'mine_red', 'missile_enemy', 'mine_enemy'].includes(b.type)) {
                const isMissile = b.type.includes('missile');
                const age = s.frame - (b.launchTime || 0);
                if (age < 20) { if (isMissile) { b.vy -= (b.isEnemy ? -0.4 : 0.6); b.vx *= 0.95; } else { b.vx *= 0.99; } } 
                else {
                    if (b.isEnemy) {
                        if (!s.rescueMode) {
                            // MINE MAGNET LOGIC: If a player mine exists, track it instead
                            let targetX = s.px;
                            let targetY = s.py;
                            const mineMagnet = s.bullets.find(t => !t.isEnemy && t.type.includes('mine') && t.life > 0);
                            
                            if (mineMagnet) {
                                targetX = mineMagnet.x;
                                targetY = mineMagnet.y;
                                // If very close to mine, explode
                                if (Math.hypot(b.x - targetX, b.y - targetY) < 30) {
                                    b.life = 0; // Missile/Mine dies
                                    mineMagnet.life = 0; // Player Mine detonates
                                    createExplosion(s, b.x, b.y, '#facc15', 20, 'mine');
                                    createAreaDamage(s, b.x, b.y, 150, mineMagnet.damage, shield, secondShield, setHud); // Mine damage
                                    audioService.playExplosion(0, 1.2, 'mine');
                                }
                            }

                            const dx = targetX - b.x; const dy = targetY - b.y; const dist = Math.hypot(dx, dy);
                            // Adjusted homing parameters for mine_enemy vs missile_enemy
                            const isEnemyMine = b.type === 'mine_enemy';
                            const turnRate = b.turnRate || (isEnemyMine ? 0.03 : 0.05); 
                            const desiredSpeed = b.maxSpeed || (isEnemyMine ? 7 : 10);
                            const tx = (dx / dist) * desiredSpeed; const ty = (dy / dist) * desiredSpeed;
                            b.vx += (tx - b.vx) * turnRate; b.vy += (ty - b.vy) * turnRate;
                        }
                    } else {
                        if (!b.target || b.target.hp <= 0 || b.target.y > height + 200 || b.target.y < -200) {
                            b.target = null; let best = null; let bestScore = -Infinity; let searchDir = isMissile ? (Math.hypot(b.vx, b.vy) > 1 ? Math.atan2(b.vy, b.vx) : -Math.PI/2) : (b.vx > 0 ? 0 : Math.PI);
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
                        if (b.target) {
                            const dx = b.target.x - b.x; const dy = b.target.y - b.y; const dz = b.target.z - (b.z || 0); const dist = Math.hypot(dx, dy, dz);
                            const turnRate = isMissile ? 0.18 : 0.08; const desiredSpeed = isMissile ? 15 : 8;
                            const tx = (dx / dist) * desiredSpeed; const ty = (dy / dist) * desiredSpeed; const tz = (dz / dist) * desiredSpeed;
                            b.vx += (tx - b.vx) * turnRate; b.vy += (ty - b.vy) * turnRate; b.vz = (b.vz || 0) + (tz - (b.vz || 0)) * turnRate;
                        }
                    }
                    if (isMissile || b.type === 'mine_enemy') { const speed = Math.hypot(b.vx, b.vy); if (speed < (b.maxSpeed || 16)) { b.vx *= 1.05; b.vy *= 1.05; } }
                }
            }
            if (b.weaponId === 'exotic_gravity_wave' && b.growthRate) {
                s.bullets.forEach(other => { if (other.isEnemy && Math.abs(other.x - b.x) < b.width && Math.abs(other.y - b.y) < b.height) { other.isEnemy = false; other.vx = (Math.random()-0.5) * 5; other.vy = -Math.abs(other.vy) - 5; other.color = b.color; other.damage *= 2; createExplosion(s, other.x, other.y, b.color, 1); } });
            }

            if (!b.isEnemy && (b.type === 'laser' || b.weaponId?.includes('exotic'))) {
                s.bullets.forEach(enemyB => {
                    if (enemyB.life > 0 && enemyB.isEnemy && (enemyB.type.includes('missile') || enemyB.type.includes('mine'))) {
                        const dist = Math.hypot(b.x - enemyB.x, b.y - enemyB.y);
                        if (dist < 30) {
                            enemyB.life = 0;
                            createExplosion(s, enemyB.x, enemyB.y, '#f97316', 15, 'mine');
                            createAreaDamage(s, enemyB.x, enemyB.y, 80, 50, shield, secondShield, setHud);
                            audioService.playExplosion(0, 0.8, 'mine');
                            if (!b.isOvercharge && b.width < 20) b.life = 0;
                        }
                    }
                });
            }

            if (b.isEnemy && !s.rescueMode) { 
                if (Math.hypot(b.x-s.px, b.y-s.py) < (30 * sizeScale)) { takeDamage(s, b.damage, b.type, shield, secondShield, setHud); b.life = 0; createExplosion(s, b.x, b.y, b.color, 3); } 
            } else if (!b.isEnemy) { 
                
                // INTERCEPT ENEMY MISSILES (COLLISION)
                s.bullets.forEach(enemyB => {
                    if (enemyB.life > 0 && enemyB.isEnemy && enemyB.type.includes('missile')) {
                        // Projectile vs Missile collision check
                        const dist = Math.hypot(b.x - enemyB.x, b.y - enemyB.y);
                        if (dist < 30) {
                            enemyB.life = 0; // Destroy missile
                            b.life = 0;      // Destroy bullet (unless piercing?)
                            createExplosion(s, enemyB.x, enemyB.y, '#fca5a5', 10, 'smoke');
                            audioService.playImpact('metal', 0.5);
                        }
                    }
                });

                let hit = false; 
                s.enemies.forEach(e => { 
                    const isOrdnance = b.type.includes('missile') || b.type.includes('mine');
                    const hullRadius = (e.type === 'boss' ? 80 : 40) * sizeScale;
                    const shieldRadius = e.shieldLayers.length > 0 ? (hullRadius + (20 * sizeScale)) : 0; 
                    const zDist = Math.abs((b.z || 0) - e.z);

                    const dist2d = Math.hypot(b.x-e.x, b.y-e.y);
                    
                    if (dist2d < (shieldRadius || hullRadius) + 20 && (!isOrdnance || zDist < 80)) { 
                        let effectiveDamage = b.damage;
                        if (b.weaponId === 'exotic_star_shatter') {
                            if (b.isOvercharge) { const ratio = Math.min(1, Math.max(0, (b.width - 6) / 30)); const multiplier = 4 + (ratio * 16); effectiveDamage = b.damage * multiplier; } 
                            else { const ratio = Math.min(1, b.width / 12); effectiveDamage = b.damage * ratio; }
                        }
                        
                        if (b.weaponId === 'exotic_flamer' && !b.isOvercharge) {
                            effectiveDamage *= (b.life / 50); 
                        }

                        const angleToBullet = Math.atan2(b.y - e.y, b.x - e.x);
                        let normAngle = angleToBullet;
                        if (normAngle < 0) normAngle += Math.PI * 2;

                        if (b.type === 'octo_shell') {
                            if (dist2d < (shieldRadius || hullRadius)) {
                                hit = true;
                                if (b.isOvercharge) {
                                    createExplosion(s, b.x, b.y, b.color, 40, 'fireworks'); 
                                    audioService.playExplosion(0, 1.5, 'emp'); 
                                    createAreaDamage(s, b.x, b.y, 200, b.damage, shield, secondShield, setHud);
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
                                if (b.isEmp || b.type.includes('emp') || b.type.includes('red')) { 
                                    audioService.playExplosion(0, 1.2, 'emp'); 
                                } 
                                else if (b.type.includes('missile')) { 
                                    audioService.playExplosion(0, 0.8, 'normal'); 
                                    createAreaDamage(s, b.x, b.y, 100, b.damage / 2, shield, secondShield, setHud);
                                } 
                                else if (b.type.includes('mine')) { 
                                    audioService.playExplosion(0, 1.2, 'mine'); 
                                    createAreaDamage(s, b.x, b.y, 150, b.damage, shield, secondShield, setHud); 
                                }
                                else {
                                    audioService.playImpact('metal', 0.7);
                                }
                            }
                        }
                    } 
                });
                
                s.asteroids.forEach(a => {
                    const hitThreshold = (b.weaponId === 'exotic_flamer' || b.weaponId === 'exotic_rainbow_spread' || b.weaponId === 'exotic_star_shatter' || b.type === 'octo_shell') ? Math.max(a.size + 10, b.width/2) : a.size + 10;
                    if (Math.hypot(b.x-a.x, b.y-a.y) < hitThreshold) {
                        let dmg = calculateDamage(b.damage, b.type, 'hull'); if (b.isOvercharge) dmg *= 5.0; 
                        
                        if (b.weaponId === 'exotic_flamer' && !b.isOvercharge) {
                            dmg *= (b.life / 50);
                        }

                        if (b.type === 'octo_shell') {
                             if (b.isOvercharge) {
                                dmg *= 2.0;
                                hit = true;
                                createExplosion(s, b.x, b.y, b.color, 40, 'fireworks'); 
                                audioService.playExplosion(0, 1.5, 'emp'); 
                                createAreaDamage(s, b.x, b.y, 200, b.damage, shield, secondShield, setHud);
                             } else {
                                hit = true;
                                createExplosion(s, b.x, b.y, b.color, 5, 'fireworks');
                             }
                        }

                        a.hp -= dmg; if (a.hp <= 0 && a.loot) spawnLoot(a.x, a.y, a.z, a.loot.type, a.loot.id, a.loot.name, a.loot.quantity || 1);
                        if (!hit) hit = true; 
                        
                        if (dmg > 5 && b.type !== 'octo_shell') { 
                            createExplosion(s, b.x, b.y, '#aaa', 5, 'asteroid');
                            if (b.type.includes('missile')) { 
                                audioService.playExplosion(0, 0.8, 'normal'); 
                                createAreaDamage(s, b.x, b.y, 100, b.damage / 2, shield, secondShield, setHud);
                            } 
                            else if (b.type.includes('mine')) { 
                                audioService.playExplosion(0, 1.2, 'mine'); 
                                createAreaDamage(s, b.x, b.y, 150, b.damage, shield, secondShield, setHud); 
                            } 
                            else {
                                audioService.playImpact(a.material === 'ice' ? 'ice' : 'rock', 0.6);
                            }
                        }
                    }
                });
                
                if (hit && b.weaponId !== 'exotic_rainbow_spread' && b.type !== 'firework_shell' && (b.type !== 'octo_shell' || b.isOvercharge)) b.life = 0;
            }
        }); 
        s.bullets = s.bullets.filter(b => {
            if (b.life <= 0) {
                // If projectile died (life 0) and was explosive type, explode now
                if (b.type.includes('missile') || b.type.includes('mine')) {
                    // Create explosion effect for expired missiles/mines
                    // Missiles that missed target still explode visually
                    if (b.type.includes('missile')) {
                        createExplosion(s, b.x, b.y, b.color, 10, 'fireworks');
                        audioService.playExplosion(0, 0.5, 'normal');
                    }
                    
                    if (b.type.includes('mine')) {
                        createAreaDamage(s, b.x, b.y, 150, b.damage, shield, secondShield, setHud); 
                        createExplosion(s, b.x, b.y, b.color, 5);
                        if (b.type.includes('emp') || b.type.includes('red')) { audioService.playExplosion(0, 1.2, 'emp'); } 
                        else { audioService.playExplosion(0, 1.2, 'mine'); }
                    }
                }
                return false;
            }
            return b.y > -200 && b.y < height + 200;
        });
        
        s.loot.forEach(l => {
            const dx = s.px - l.x; const dy = s.py - l.y; const dist = Math.hypot(dx, dy);
            if (dist < 175) { l.isBeingPulled = true; l.x += dx * 0.08; l.y += dy * 0.08; } 
            else { l.isBeingPulled = false; l.y += 2 * worldSpeedFactor; l.x += l.vx; l.y += l.vy; }
            if (dist < 30 && !l.isPulled) {
                l.isPulled = true; audioService.playSfx('buy');
                if (l.type === 'fuel') { 
                    const id = l.id || 'can_fuel';
                    const name = l.name || 'Fuel Cell';
                    const qty = l.quantity || 1;
                    const existing = s.cargo.find(c => c.id === id || c.type === 'fuel');
                    if (existing) existing.quantity += qty;
                    else s.cargo.push({ instanceId: `loot_${Date.now()}_f`, type: 'fuel', id, name, quantity: qty, weight: 1 });
                    setHud(h => ({...h, alert: "FUEL CANISTER ACQUIRED", alertType: 'success'}));
                }
                else if (l.type === 'water') { 
                    const id = l.id || 'water';
                    const name = l.name || 'Water Container';
                    const qty = l.quantity || 20; 
                    const existing = s.cargo.find(c => c.id === id || c.type === 'water');
                    if (existing) existing.quantity += qty;
                    else s.cargo.push({ instanceId: `loot_${Date.now()}_w`, type: 'water', id, name, quantity: qty, weight: 1 });
                    setHud(h => ({...h, alert: "WATER SUPPLY ACQUIRED", alertType: 'success'}));
                }
                else if (l.type === 'energy') { 
                    const id = l.id || 'batt_cell';
                    const name = l.name || 'Energy Cell';
                    const qty = l.quantity || 1;
                    const existing = s.cargo.find(c => c.id === id || c.type === 'energy');
                    if (existing) existing.quantity += qty;
                    else s.cargo.push({ instanceId: `loot_${Date.now()}_e`, type: 'energy', id, name, quantity: qty, weight: 1 });
                    setHud(h => ({...h, alert: "ENERGY CELL ACQUIRED", alertType: 'success'}));
                }
                else if (l.type === 'repair' || l.type === 'nanite') { s.hp = Math.min(100, s.hp + 10); setHud(h => ({...h, alert: "+HULL REPAIR", alertType: 'success'})); }
                else if (l.type === 'missile') { s.missiles = Math.min(10, s.missiles + (l.quantity || 1)); setHud(h => ({...h, alert: `+${l.quantity || 1} MISSILES`, alertType: 'success'})); }
                else if (l.type === 'mine') { s.mines = Math.min(10, s.mines + (l.quantity || 1)); setHud(h => ({...h, alert: `+${l.quantity || 1} MINES`, alertType: 'success'})); }
                else if (l.type === 'ammo') { const ammoId = l.id as any; if (ammoId) { s.ammo[ammoId] = (s.ammo[ammoId] || 0) + (l.quantity || 100); setHud(h => ({...h, alert: `+${l.quantity || 100} AMMO UNITS`, alertType: 'success'})); } }
                else if (l.type === 'weapon' || l.type === 'shield') { const newItem: CargoItem = { instanceId: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, type: l.type as any, id: l.id, name: l.name || 'Unknown', quantity: l.quantity || 1, weight: 1 }; s.cargo.push(newItem); setHud(h => ({...h, alert: `LOOT ACQUIRED: ${l.name}`, alertType: 'success'})); }
                else if (['gold', 'platinum', 'lithium', 'iron', 'copper', 'chromium', 'titanium', 'tungsten', 'goods', 'robot', 'drug', 'medicine', 'food', 'equipment', 'part', 'luxury'].includes(l.type)) { const itemId = l.id || l.type; const qty = l.quantity || 1; const existingItem = s.cargo.find(c => c.id === itemId); if (existingItem) { existingItem.quantity += qty; } else { s.cargo.push({ instanceId: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, type: l.type as any, id: itemId, name: l.name || itemId.toUpperCase(), quantity: qty, weight: 1 }); } setHud(h => ({...h, alert: `+${qty} ${l.name || l.type.toUpperCase()}`, alertType: 'success'})); }
                else { s.score += 500; }
            }
        });
        s.loot = s.loot.filter(l => !l.isPulled && l.y < height + 100);
        
        s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; }); s.particles = s.particles.filter(p => p.life > 0);

        renderGame(ctx, s, width, height, activeShip, quadrant, sizeScale);

        if (s.frame % 10 === 0) { 
            let totalMagAmmo = 0; let reloading = false; Object.values(s.gunStates).forEach((g: any) => { totalMagAmmo += g.mag; if (g.reloadTimer > 0) reloading = true; });
            setHud(prev => ({ ...prev, hp: s.hp, sh1: s.sh1, sh2: s.sh2, fuel: s.fuel, water: s.water, energy: s.energy, score: s.score, missiles: s.missiles, mines: s.mines, redMines: s.redMines, timer: s.time, boss: s.enemies.find(e => e.type === 'boss'), ammoCount: totalMagAmmo, isReloading: reloading, overload: s.capacitor, overdrive: s.overdrive, rescueMode: s.rescueMode, capacitorLocked: s.capacitorLocked, powerMode: s.capsLock, shieldsOnline: s.shieldsEnabled })); 
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
            shield={shield} 
            secondShield={secondShield} 
            maxEnergy={maxEnergy} 
            maxFuel={maxFuel} 
            maxWater={maxWater} 
            hasGuns={!!activeShip.fitting.weapons[0]} 
            hasAmmoWeapons={!!activeShip.fitting.weapons[1] || !!activeShip.fitting.weapons[2]} 
            maxAmmoInMags={200}
            fontSize={fontSize}
            onPauseToggle={() => togglePause()}
            onAbort={() => {
                const s = state.current;
                onGameOver(false, s.score, true, {
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
                    weapons: activeShip.fitting.weapons,
                    shieldId: activeShip.fitting.shieldId,
                    secondShieldId: activeShip.fitting.secondShieldId
                });
            }}
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
