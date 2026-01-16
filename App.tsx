
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import GameEngine from './components/GameEngine.tsx';
import SectorMap from './components/SectorMap.tsx';
import LaunchSequence from './components/LaunchSequence.tsx';
import WarpSequence from './components/WarpSequence.tsx'; 
import LandingScene from './components/LandingScene.tsx';
import { CommandCenter } from './components/CommandCenter.tsx';
import { ShipIcon } from './components/ShipIcon.tsx';
import { CargoDialog } from './components/CargoDialog.tsx';
import { MarketDialog } from './components/MarketDialog.tsx';
import { StoreDialog } from './components/StoreDialog.tsx';
import { LoadoutDialog } from './components/LoadoutDialog.tsx';
import { PaintDialog } from './components/PaintDialog.tsx';
import { MessagesDialog } from './components/MessagesDialog.tsx';
import { OptionsDialog } from './components/OptionsDialog.tsx';
import { ManualDialog } from './components/ManualDialog.tsx';
import { StoryScene } from './components/StoryScene.tsx';
import { audioService } from './services/audioService.ts';
import { GameState, MissionType, QuadrantType, ShipFitting, CargoItem, EquippedWeapon, DisplayMode, GameMessage, GameSettings, Planet, Moon, ShipPart, Shield, PlanetStatusData, AmmoType } from './types.ts';
import { SHIPS, INITIAL_CREDITS, PLANETS, WEAPONS, EXOTIC_WEAPONS, SHIELDS, EXOTIC_SHIELDS, EXPLODING_ORDNANCE, COMMODITIES, ExtendedShipConfig, MAX_FLEET_SIZE, AVATARS, AMMO_CONFIG } from './constants.ts';

const SAVE_KEY = 'galactic_defender_beta_21'; 
const REPAIR_COST_PER_PERCENT = 150;
const REFUEL_COST_PER_UNIT = 5000;
const DEFAULT_SHIP_ID = 'vanguard';

const StarBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize); resize();
    const stars = Array.from({ length: 250 }).map(() => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, s: Math.random() * 2, v: 0.1 + Math.random() * 0.4 }));
    let anim: number;
    const loop = () => { ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#fff'; stars.forEach(s => { s.y += s.v; if (s.y > canvas.height) s.y = 0; ctx.fillRect(s.x, s.y, s.s, s.s); }); anim = requestAnimationFrame(loop); };
    loop(); return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none opacity-60 z-0" />;
};

export default function App() {
  const createInitialState = (): GameState => {
    const initialOwned = Array.from({ length: MAX_FLEET_SIZE }).map((_, idx) => ({ instanceId: `fleet_slot_${idx}`, shipTypeId: DEFAULT_SHIP_ID }));
    const initialFittings: Record<string, ShipFitting> = {};
    const initialColors: Record<string, string> = {};
    
    initialOwned.forEach((os, idx) => { 
      const config = SHIPS.find(s => s.id === os.shipTypeId)!;
      const weapons = Array(3).fill(null);
      
      // Default Weapon Allocation:
      // First 3 ships (index 0,1,2 in SHIPS list) get Level 1 Pulse Laser
      // Last 2 ships (index 3,4 in SHIPS list) get Level 4 Photon Emitter
      // Here we check against config ID to determine default loadout if matching standard ships
      const shipIndex = SHIPS.findIndex(s => s.id === config.id);
      
      if (shipIndex >= 3 && shipIndex <= 4) {
          weapons[0] = { id: 'gun_photon', count: 1 }; // High Level
      } else {
          weapons[0] = { id: 'gun_pulse', count: 1 }; // Low Level
      }

      initialFittings[os.instanceId] = { 
          weapons, 
          shieldId: null, secondShieldId: null, flareId: null, reactorLevel: 1, engineType: 'standard', 
          rocketCount: 2, // Updated to 2
          mineCount: 2,   // Updated to 2
          redMineCount: 0, // Init Omega Mines
          hullPacks: 0, wingWeaponId: null, 
          health: 100, ammoPercent: 100, lives: 1, fuel: config.maxFuel, cargo: [],
          ammo: { iron: 1000, titanium: 0, cobalt: 0, iridium: 0, tungsten: 0, explosive: 0 },
          magazineCurrent: 200, 
          reloadTimer: 0,
          selectedAmmo: 'iron'
      }; 
      initialColors[os.instanceId] = config.defaultColor || '#94a3b8'; 
    });
    
    const initialOffsets: Record<string, number> = {};
    const initialRegistry: Record<string, PlanetStatusData> = {};
    
    PLANETS.forEach((p, i) => {
      initialOffsets[p.id] = Math.random() * Math.PI * 2;
      initialRegistry[p.id] = { id: p.id, status: i === 0 ? 'friendly' : p.status, wins: 0, losses: 0 };
    });

    return {
      credits: INITIAL_CREDITS, selectedShipInstanceId: initialOwned[0].instanceId, ownedShips: initialOwned,
      shipFittings: initialFittings, shipColors: initialColors, shipWingColors: {}, shipCockpitColors: {}, shipBeamColors: {}, shipGunColors: {}, shipSecondaryGunColors: {}, shipGunBodyColors: {}, shipEngineColors: {}, shipBarColors: {}, shipNozzleColors: {},
      customColors: ['#3f3f46', '#71717a', '#a1a1aa', '#52525b', '#27272a', '#18181b', '#09090b', '#000000'],
      currentPlanet: PLANETS[0], currentMoon: null, currentMission: null, currentQuadrant: QuadrantType.ALFA, conqueredMoonIds: [], shipMapPosition: { [QuadrantType.ALFA]: { x: 50, y: 50 }, [QuadrantType.BETA]: { x: 50, y: 50 }, [QuadrantType.GAMA]: { x: 50, y: 50 }, [QuadrantType.DELTA]: { x: 50, y: 50 } }, shipRotation: 0, orbitingEntityId: null, orbitAngle: 0, dockedPlanetId: 'p1', tutorialCompleted: false, settings: { musicVolume: 0.3, sfxVolume: 0.5, musicEnabled: true, sfxEnabled: true, displayMode: 'windowed', autosaveEnabled: true, showTransitions: false, testMode: false, fontSize: 'medium' }, taskForceShipIds: [], activeTaskForceIndex: 0, pilotName: 'STRATOS', pilotAvatar: '👨🏻', pilotZoom: 1.0, gameInProgress: false, victories: 0, failures: 0, typeColors: {}, reserveByPlanet: {}, marketListingsByPlanet: {},
      messages: [{ id: 'init', type: 'activity', pilotName: 'COMMAND', pilotAvatar: '🛰️', text: 'Welcome. Systems online.', timestamp: Date.now() }],
      planetOrbitOffsets: initialOffsets,
      universeStartTime: Date.now(),
      planetRegistry: initialRegistry
    };
  };

  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) try { 
        const parsed = JSON.parse(saved);
        if (!parsed.settings.fontSize) parsed.settings.fontSize = 'medium';
        if (!parsed.customColors) parsed.customColors = ['#3f3f46', '#71717a', '#a1a1aa', '#52525b', '#27272a', '#18181b', '#09090b', '#000000'];
        if (!parsed.planetRegistry) {
            const reg: Record<string, PlanetStatusData> = {};
            PLANETS.forEach((p, i) => { reg[p.id] = { id: p.id, status: i === 0 ? 'friendly' : p.status, wins: 0, losses: 0 }; });
            parsed.planetRegistry = reg;
        }
        if (!parsed.planetOrbitOffsets) {
            const offs: Record<string, number> = {};
            PLANETS.forEach(p => offs[p.id] = Math.random() * Math.PI * 2);
            parsed.planetOrbitOffsets = offs;
            parsed.universeStartTime = Date.now();
        }
        
        Object.keys(parsed.shipFittings).forEach(fid => {
            const fit = parsed.shipFittings[fid];
            if (!fit.ammo) {
                fit.ammo = { iron: 1000, titanium: 0, cobalt: 0, iridium: 0, tungsten: 0, explosive: 0 };
                fit.selectedAmmo = 'iron';
            }
            if (fit.magazineCurrent === undefined) fit.magazineCurrent = 200;
            if (fit.reloadTimer === undefined) fit.reloadTimer = 0;
            if (fit.redMineCount === undefined) fit.redMineCount = 0; // Migrated
        });

        // Init pilotZoom
        if (parsed.pilotZoom === undefined) parsed.pilotZoom = 1.0;

        return { ...createInitialState(), ...parsed }; 
    } catch(e) { return createInitialState(); }
    return createInitialState();
  });

  const [screen, setScreen] = useState<'intro' | 'hangar' | 'map' | 'launch' | 'game' | 'landing' | 'warp'>('intro');
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [activeFittingSlot, setActiveFittingSlot] = useState(0);
  const [launchDestination, setLaunchDestination] = useState<'map' | 'planet'>('map');
  const [gameMode, setGameMode] = useState<'combat' | 'drift'>('combat');
  const [warpDestination, setWarpDestination] = useState<'game' | 'hangar' | 'landing'>('game'); 

  const [systemMessage, setSystemMessage] = useState<{text: string, type: 'neutral'|'success'|'error'|'warning'}>({ text: 'SYSTEMS NOMINAL', type: 'neutral' });
  const messageTimeoutRef = useRef<number | null>(null);

  const triggerSystemMessage = (text: string, type: 'neutral'|'success'|'error'|'warning' = 'neutral') => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      setSystemMessage({ text, type });
      if (type !== 'neutral') {
          messageTimeoutRef.current = window.setTimeout(() => {
              setSystemMessage({ text: 'SYSTEMS NOMINAL', type: 'neutral' });
          }, 3500);
      }
  };

  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [isLoadoutOpen, setIsLoadoutOpen] = useState(false);
  const [isPaintOpen, setIsPaintOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [isCargoOpen, setIsCargoOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  
  const [inspectedShipId, setInspectedShipId] = useState<string>(DEFAULT_SHIP_ID);
  const [activePart, setActivePart] = useState<ShipPart>('hull');
  const [loadoutTab, setLoadoutTab] = useState<'guns' | 'defense'>('guns');
  const [marketTab, setMarketTab] = useState<'buy' | 'sell'>('buy');
  
  const [selectedCargoIdx, setSelectedCargoIdx] = useState<number | null>(null);
  const [selectedReserveIdx, setSelectedReserveIdx] = useState<number | null>(null);
  const [manualPage, setManualPage] = useState(1);
  const touchStart = useRef<number | null>(null);

  const selectedFitting = useMemo(() => gameState.selectedShipInstanceId ? gameState.shipFittings[gameState.selectedShipInstanceId] : null, [gameState]);
  const selectedShipConfig = useMemo(() => { if (!gameState.selectedShipInstanceId) return null; const instance = gameState.ownedShips.find(s => s.instanceId === gameState.selectedShipInstanceId); return instance ? SHIPS.find(s => s.id === instance.shipTypeId) || null : null; }, [gameState]);
  const activeShipId = gameState.selectedShipInstanceId || gameState.ownedShips[0].instanceId;
  const activeWeaponId = gameState.shipFittings[activeShipId]?.weapons[0]?.id || 'gun_pulse';
  
  const dockedId = gameState.dockedPlanetId || 'p1';
  const dockedPlanet = PLANETS.find(p => p.id === dockedId);
  const currentReserves = useMemo(() => gameState.reserveByPlanet[dockedId] || [], [gameState.reserveByPlanet, dockedId]);

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    audioService.updateVolume(gameState.settings.musicVolume);
    audioService.setEnabled(gameState.settings.musicEnabled);
  }, [gameState]);

  useEffect(() => {
    const handleInteraction = () => { audioService.init(); window.removeEventListener('click', handleInteraction); };
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  useEffect(() => {
    if (screen === 'intro') audioService.playTrack('intro');
    else if (screen === 'hangar') audioService.playTrack('command');
    else if (screen === 'map') audioService.playTrack('map');
    else if (screen === 'game') audioService.playTrack('combat');
    else audioService.stop();
  }, [screen]);

  // [Helper Functions]
  const repairSelected = () => {
    if (!gameState.selectedShipInstanceId) return;
    const sId = gameState.selectedShipInstanceId;
    const fit = gameState.shipFittings[sId];
    if (fit.health >= 100) { audioService.playSfx('denied'); triggerSystemMessage("HULL INTEGRITY MAXIMUM", 'neutral'); return; }
    setGameState(prev => {
        const sId = prev.selectedShipInstanceId!; const fit = prev.shipFittings[sId]; const newCargo = [...fit.cargo]; const newReserve = [...(prev.reserveByPlanet[dockedId] || [])];
        let currentHp = fit.health; const hpNeeded = 100 - currentHp; let hpRestored = 0;
        const resourcePriority = ['iron', 'copper', 'chromium', 'titanium', 'gold', 'repair', 'platinum', 'lithium'];
        // Updated repair value for 'repair' (Nanite Pack) to 50%
        const repairValues: Record<string, number> = { iron: 2, copper: 4, chromium: 10, titanium: 16, gold: 20, repair: 50, platinum: 50, lithium: 80 };
        const processList = (list: CargoItem[]) => {
            let totalRestored = 0;
            for (const type of resourcePriority) {
                if (totalRestored >= hpNeeded) break;
                for (let i = 0; i < list.length; i++) {
                    const item = list[i];
                    if (item.type === type) {
                        const value = repairValues[type];
                        const remaining = hpNeeded - totalRestored;
                        const needed = Math.ceil(remaining / value);
                        const take = Math.min(item.quantity, needed);
                        item.quantity -= take;
                        totalRestored += take * value;
                        if (item.quantity <= 0) { list.splice(i, 1); i--; }
                        if (totalRestored >= hpNeeded) break;
                    }
                }
            }
            return totalRestored;
        };
        hpRestored += processList(newReserve); if (hpRestored < hpNeeded) hpRestored += processList(newCargo);
        if (hpRestored > 0) { audioService.playSfx('buy'); const finalHp = Math.min(100, currentHp + hpRestored); triggerSystemMessage(`REPAIRS COMPLETE: +${hpRestored}% INTEGRITY`, 'success'); return { ...prev, shipFittings: { ...prev.shipFittings, [sId]: { ...fit, health: finalHp, cargo: newCargo } }, reserveByPlanet: { ...prev.reserveByPlanet, [dockedId]: newReserve } }; } else { audioService.playSfx('denied'); triggerSystemMessage("REPAIR FAILED: REQUIRE METALS, GOLD OR NANITES", 'error'); return prev; }
    });
  };

  const refuelSelected = () => {
    // ... [Refuel logic]
    if (!gameState.selectedShipInstanceId || !selectedShipConfig) return;
    const sId = gameState.selectedShipInstanceId;
    const fit = gameState.shipFittings[sId];
    if (fit.fuel >= selectedShipConfig.maxFuel) { audioService.playSfx('denied'); triggerSystemMessage("FUEL TANKS AT MAXIMUM CAPACITY", 'neutral'); return; }
    setGameState(prev => {
        const sId = prev.selectedShipInstanceId!; const fit = prev.shipFittings[sId]; const newCargo = [...fit.cargo]; const newReserve = [...(prev.reserveByPlanet[dockedId] || [])];
        let currentFuel = fit.fuel; const maxFuel = selectedShipConfig.maxFuel; let fueled = false; const FUEL_PER_ITEM = 5.0;
        const consumeFuel = (list: CargoItem[]) => {
            for (let i = 0; i < list.length; i++) {
                if (currentFuel >= maxFuel) break;
                const item = list[i];
                if (item.type === 'fuel') { item.quantity--; currentFuel = Math.min(maxFuel, currentFuel + FUEL_PER_ITEM); fueled = true; if (item.quantity <= 0) { list.splice(i, 1); i--; } while (currentFuel < maxFuel && i >= 0 && i < list.length && list[i].type === 'fuel') { if (list[i].quantity > 0) { list[i].quantity--; currentFuel = Math.min(maxFuel, currentFuel + FUEL_PER_ITEM); fueled = true; if (list[i].quantity <= 0) { list.splice(i, 1); i--; } } } }
            }
        };
        consumeFuel(newReserve); if (currentFuel < maxFuel) consumeFuel(newCargo);
        if (fueled) { audioService.playSfx('buy'); triggerSystemMessage("REFUELING COMPLETE", 'success'); return { ...prev, shipFittings: { ...prev.shipFittings, [sId]: { ...fit, fuel: currentFuel, cargo: newCargo } }, reserveByPlanet: { ...prev.reserveByPlanet, [dockedId]: newReserve } }; } else { audioService.playSfx('denied'); triggerSystemMessage("REFUEL FAILED: NO FUEL CANISTERS DETECTED", 'error'); return prev; }
    });
  };

  const handleLaunch = () => {
    if (!selectedFitting || !selectedShipConfig) return;
    const launchCost = 1.0;
    if (selectedFitting.fuel < launchCost) { audioService.playSfx('denied'); triggerSystemMessage("LAUNCH ABORTED: INSUFFICIENT FUEL RESERVES", 'error'); return; }
    
    setLaunchDestination('map'); 
    
    // Defer fuel deduction if transition is enabled, so cinematic shows full fuel bar
    if (gameState.settings.showTransitions) { 
        setScreen('launch'); 
    } else { 
        // Immediate deduction if no transition
        setGameState(prev => { 
            const sId = prev.selectedShipInstanceId!; 
            const fit = prev.shipFittings[sId]; 
            return { 
                ...prev, 
                shipFittings: { 
                    ...prev.shipFittings, 
                    [sId]: { ...fit, fuel: Math.max(0, fit.fuel - launchCost) } 
                } 
            }; 
        });
        setScreen('map'); 
        audioService.playTrack('map'); 
    }
  };

  const handleLaunchSequenceComplete = () => { 
      // Deduct fuel NOW after cinematic completes
      setGameState(prev => { 
          const sId = prev.selectedShipInstanceId!; 
          const fit = prev.shipFittings[sId]; 
          return { 
              ...prev, 
              shipFittings: { 
                  ...prev.shipFittings, 
                  [sId]: { ...fit, fuel: Math.max(0, fit.fuel - 1.0) } 
              } 
          }; 
      });

      if (launchDestination === 'map') { 
          setScreen('map'); 
          audioService.playTrack('map'); 
      } else { 
          setScreen('game'); 
          audioService.playTrack('combat'); 
      } 
  };

  const handleGameOver = (success: boolean, score: number, aborted: boolean, payload: any) => {
    setGameState(prev => {
       const newCredits = prev.credits + score + (success ? 5000 : 0);
       const sId = prev.selectedShipInstanceId!;
       const fitting = prev.shipFittings[sId];
       // Preserve state including ammo
       const updatedFitting = { 
           ...fitting, 
           health: payload?.health ?? 0, 
           fuel: payload?.fuel ?? 0, 
           rocketCount: payload?.rockets ?? fitting.rocketCount, 
           mineCount: payload?.mines ?? fitting.mineCount, 
           redMineCount: payload?.redMineCount ?? fitting.redMineCount,
           hullPacks: payload?.hullPacks ?? fitting.hullPacks, 
           cargo: payload?.cargo ?? fitting.cargo,
           ammo: payload?.ammo ?? fitting.ammo, 
           magazineCurrent: payload?.magazineCurrent ?? fitting.magazineCurrent,
           reloadTimer: payload?.reloadTimer ?? fitting.reloadTimer
       };
       const reg = { ...prev.planetRegistry };
       const currentPId = prev.currentPlanet!.id;
       const pEntry = { ...reg[currentPId] };
       let newMessages = [...prev.messages];

       if (success) {
           pEntry.wins += 1; pEntry.losses = 0; 
           // WIN CONDITION: 1 Win = Friendly
           if (pEntry.status !== 'friendly' && pEntry.wins >= 1) { 
               pEntry.status = 'friendly'; 
               pEntry.wins = 0; 
               newMessages.unshift({ id: `msg_${Date.now()}`, type: 'activity', pilotName: 'COMMAND', pilotAvatar: '🛰️', text: `SECTOR ${prev.currentPlanet?.name} LIBERATED. LANDING AUTHORIZED.`, timestamp: Date.now() }); 
           }
       } else {
           if (!aborted) {
               pEntry.losses += 1;
               // LOSS CONDITION: 1 Loss = Regression
               if (pEntry.losses >= 1) {
                   pEntry.losses = 0;
                   const pIndex = PLANETS.findIndex(p => p.id === currentPId);
                   if (pIndex > 0) {
                       const prevPId = PLANETS[pIndex - 1].id;
                       const prevEntry = { ...reg[prevPId] };
                       let regressionHappened = false;
                       if (prevEntry.status === 'friendly') { prevEntry.status = 'siege'; regressionHappened = true; } else if (prevEntry.status === 'siege') { prevEntry.status = 'occupied'; regressionHappened = true; }
                       if (regressionHappened) { reg[prevPId] = prevEntry; newMessages.unshift({ id: `msg_${Date.now()}`, type: 'activity', pilotName: 'COMMAND', pilotAvatar: '⚠️', text: `DEFENSE LINE COLLAPSED. ${PLANETS[pIndex-1].name} SECTOR COMPROMISED.`, timestamp: Date.now() }); }
                   }
               }
           }
       }
       reg[currentPId] = pEntry;
       return { ...prev, credits: newCredits, shipFittings: { ...prev.shipFittings, [sId]: updatedFitting }, gameInProgress: false, planetRegistry: reg, messages: newMessages, currentQuadrant: prev.currentPlanet!.quadrant, dockedPlanetId: success ? prev.currentPlanet!.id : prev.dockedPlanetId };
    });

    if (aborted) {
        // RETREAT: Just return to hangar, do not play destruction/landing
        const homePlanet = PLANETS.find(p => p.id === (gameState.dockedPlanetId || 'p1'));
        const homeQuad = homePlanet ? homePlanet.quadrant : QuadrantType.ALFA;
        const currentQuad = gameState.currentQuadrant;
        const showTrans = gameState.settings.showTransitions;
        if (currentQuad !== homeQuad && showTrans) { setWarpDestination('hangar'); setScreen('warp'); } else { setGameState(prev => ({ ...prev, currentQuadrant: homeQuad })); setScreen('hangar'); audioService.playTrack('command'); }
    } else {
        if (payload?.health > 0 && gameState.settings.showTransitions && success) { setScreen('landing'); } else { setScreen('hangar'); audioService.playTrack('command'); }
    }
  };

  const handlePlanetSelection = (planet: Planet) => { const status = gameState.planetRegistry[planet.id]?.status || 'occupied'; const isFriendly = status === 'friendly'; const isSameQuadrant = planet.quadrant === gameState.currentQuadrant; const showTransitions = gameState.settings.showTransitions; const shouldUpdateQuadrantNow = !isSameQuadrant && !showTransitions; setGameState(prev => ({ ...prev, currentPlanet: planet, currentQuadrant: shouldUpdateQuadrantNow ? planet.quadrant : prev.currentQuadrant })); setLaunchDestination('planet'); if (isFriendly) { if (isSameQuadrant) { setScreen('landing'); } else { setWarpDestination('landing'); if (showTransitions) { setScreen('warp'); } else { setScreen('landing'); } } } else { setGameMode('combat'); setWarpDestination('game'); if (isSameQuadrant) { setScreen('game'); audioService.playTrack('combat'); } else { if (showTransitions) { setScreen('warp'); } else { setScreen('game'); audioService.playTrack('combat'); } } } };
  const handleWarpComplete = () => { if (warpDestination === 'hangar') { const homePlanet = PLANETS.find(p => p.id === (gameState.dockedPlanetId || 'p1')); const homeQuad = homePlanet ? homePlanet.quadrant : QuadrantType.ALFA; setGameState(prev => ({ ...prev, currentQuadrant: homeQuad })); setScreen('hangar'); audioService.playTrack('command'); } else if (warpDestination === 'landing') { setGameState(prev => ({ ...prev, currentQuadrant: prev.currentPlanet!.quadrant })); setScreen('landing'); } else { setGameState(prev => ({ ...prev, currentQuadrant: prev.currentPlanet!.quadrant })); setScreen('game'); if (gameMode === 'combat') { audioService.playTrack('combat'); } else { audioService.playTrack('map'); } } };
  const getActiveShieldColor = () => { if (!selectedFitting) return '#3b82f6'; const sId = selectedFitting.shieldId || selectedFitting.secondShieldId; if (!sId) return '#3b82f6'; if (sId === 'dev_god_mode') return '#ffffff'; const sDef = [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === sId); return sDef ? sDef.color : '#3b82f6'; };
  const replaceShip = (shipTypeId: string) => {
    const shipConfig = SHIPS.find(s => s.id === shipTypeId); if (!shipConfig || !gameState.selectedShipInstanceId) return; if (gameState.credits < shipConfig.price) { audioService.playSfx('denied'); return; }
    setGameState(prev => {
      const sId = prev.selectedShipInstanceId!; const oldFitting = prev.shipFittings[sId]; const reserve = [...(prev.reserveByPlanet[dockedId] || [])];
      const addToReserve = (id: string, type: any, count: number, name?: string) => { const ex = reserve.find(r => r.id === id); if (ex) ex.quantity += count; else reserve.push({ instanceId: `res_${Date.now()}_${Math.random()}`, id, type, name: name || id, quantity: count, weight: 1 }); };
      oldFitting.weapons.forEach((w, i) => { if (i > 0 && w) { const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === w.id); addToReserve(w.id, 'weapon', 1, def?.name); } });
      if (oldFitting.shieldId && oldFitting.shieldId !== 'dev_god_mode') { const def = [...SHIELDS, ...EXOTIC_SHIELDS].find(d => d.id === oldFitting.shieldId); addToReserve(oldFitting.shieldId, 'shield', 1, def?.name); }
      if (oldFitting.secondShieldId && oldFitting.secondShieldId !== 'dev_god_mode') { const def = [...SHIELDS, ...EXOTIC_SHIELDS].find(d => d.id === oldFitting.secondShieldId); addToReserve(oldFitting.secondShieldId, 'shield', 1, def?.name); }
      oldFitting.cargo.forEach(c => { addToReserve(c.id || 'unknown', c.type, c.quantity, c.name); });
      const newOwned = prev.ownedShips.map(os => os.instanceId === sId ? { ...os, shipTypeId } : os); const newFittings = { ...prev.shipFittings };
      
      const newWeapons = Array(3).fill(null);
      
      // Determine default loadout based on ship type
      if (shipConfig.isAlien) {
          const wId = shipConfig.weaponId || 'exotic_plasma_orb';
          // A-Class Alien gets 1 weapon (Main Slot)
          if (shipConfig.defaultGuns === 1) {
              newWeapons[0] = { id: wId, count: 1 };
          } 
          // Other Aliens get 2 weapons (Wing Slots)
          else {
              newWeapons[1] = { id: wId, count: 1 };
              newWeapons[2] = { id: wId, count: 1 };
          }
      } else {
          // Standard Ships Logic
          const shipIndex = SHIPS.findIndex(s => s.id === shipTypeId);
          if (shipIndex >= 3 && shipIndex <= 4) {
              newWeapons[0] = { id: 'gun_photon', count: 1 };
          } else {
              newWeapons[0] = { id: 'gun_pulse', count: 1 };
          }
      }

      newFittings[sId] = { ...newFittings[sId], health: 100, fuel: shipConfig.maxFuel, weapons: newWeapons, shieldId: null, secondShieldId: null, rocketCount: 2, mineCount: 2, redMineCount: 0, cargo: [], ammo: { iron: 1000, titanium: 0, cobalt: 0, iridium: 0, tungsten: 0, explosive: 0 }, magazineCurrent: 200, reloadTimer: 0, selectedAmmo: 'iron' };
      return { ...prev, credits: prev.credits - shipConfig.price, ownedShips: newOwned, shipFittings: newFittings, reserveByPlanet: { ...prev.reserveByPlanet, [dockedId]: reserve }, shipColors: { ...prev.shipColors, [sId]: shipConfig.defaultColor || '#94a3b8' } };
    });
    setIsStoreOpen(false); audioService.playSfx('buy');
  };
  const getTransferBatchSize = (type: string) => { if (['missile', 'mine', 'fuel', 'energy'].includes(type)) return 10; if (['gold', 'platinum', 'lithium', 'iron', 'copper', 'chromium', 'titanium'].includes(type)) return 50; return 1; };
  const moveAllItems = (direction: 'to_reserve' | 'to_ship') => { if (!gameState.selectedShipInstanceId) return; const sId = gameState.selectedShipInstanceId; const config = selectedShipConfig; if (!config) return; setGameState(prev => { const fit = prev.shipFittings[sId]; const reserves = [...(prev.reserveByPlanet[dockedId] || [])]; let cargo = [...fit.cargo]; if (direction === 'to_reserve') { cargo.forEach(item => { const resIdx = reserves.findIndex(r => r.id === item.id); if (resIdx >= 0) { reserves[resIdx] = { ...reserves[resIdx], quantity: reserves[resIdx].quantity + item.quantity }; } else { reserves.push({ ...item, instanceId: `res_${Date.now()}_${Math.random()}` }); } }); cargo = []; } else { let currentLoad = cargo.reduce((acc, i) => acc + i.quantity, 0); const max = config.maxCargo; for (let i = reserves.length - 1; i >= 0; i--) { if (currentLoad >= max) break; const item = reserves[i]; const space = max - currentLoad; const amount = Math.min(item.quantity, space); if (amount > 0) { const cargoIdx = cargo.findIndex(c => c.id === item.id); if (cargoIdx >= 0) { cargo[cargoIdx] = { ...cargo[cargoIdx], quantity: cargo[cargoIdx].quantity + amount }; } else { cargo.push({ ...item, quantity: amount, instanceId: `cargo_${Date.now()}_${Math.random()}` }); } if (item.quantity === amount) { reserves.splice(i, 1); } else { reserves[i] = { ...item, quantity: item.quantity - amount }; } currentLoad += amount; } } } const newFittings = { ...prev.shipFittings, [sId]: { ...fit, cargo } }; const newReserveByPlanet = { ...prev.reserveByPlanet, [dockedId]: reserves }; return { ...prev, shipFittings: newFittings, reserveByPlanet: newReserveByPlanet }; }); audioService.playSfx('click'); setSelectedCargoIdx(null); setSelectedReserveIdx(null); };
  const moveItems = (direction: 'to_reserve' | 'to_ship', all: boolean) => { if (!gameState.selectedShipInstanceId) return; const sId = gameState.selectedShipInstanceId; const config = selectedShipConfig; if (!config) return; let shouldNullCargo = false; let shouldNullReserve = false; const fit = gameState.shipFittings[sId]; const reserves = gameState.reserveByPlanet[dockedId] || []; const cargo = fit.cargo; if (direction === 'to_reserve') { if (selectedCargoIdx === null) return; const item = cargo[selectedCargoIdx]; if (item) { const batchSize = getTransferBatchSize(item.type); const amount = all ? item.quantity : Math.min(item.quantity, batchSize); if (item.quantity === amount) shouldNullCargo = true; } } else { if (selectedReserveIdx === null) return; const item = reserves[selectedReserveIdx]; if (item) { const currentLoad = cargo.reduce((acc, i) => acc + i.quantity, 0); const space = config.maxCargo - currentLoad; if (space > 0) { const batchSize = getTransferBatchSize(item.type); let amount = all ? item.quantity : Math.min(item.quantity, batchSize); amount = Math.min(amount, space); if (item.quantity === amount) shouldNullReserve = true; } } } setGameState(prev => { const fit = prev.shipFittings[sId]; const reserves = [...(prev.reserveByPlanet[dockedId] || [])]; const cargo = [...fit.cargo]; const newFittings = { ...prev.shipFittings }; const newReserveByPlanet = { ...prev.reserveByPlanet }; if (direction === 'to_reserve') { if (selectedCargoIdx === null) return prev; const item = cargo[selectedCargoIdx]; if (!item) return prev; const batchSize = getTransferBatchSize(item.type); const amount = all ? item.quantity : Math.min(item.quantity, batchSize); if (item.quantity === amount) { cargo.splice(selectedCargoIdx, 1); } else { cargo[selectedCargoIdx] = { ...item, quantity: item.quantity - amount }; } const resIdx = reserves.findIndex(r => r.id === item.id); if (resIdx >= 0) { reserves[resIdx] = { ...reserves[resIdx], quantity: reserves[resIdx].quantity + amount }; } else { reserves.push({ ...item, quantity: amount, instanceId: `res_${Date.now()}_${Math.random()}` }); } } else if (direction === 'to_ship') { if (selectedReserveIdx === null) return prev; const item = reserves[selectedReserveIdx]; if (!item) return prev; const currentLoad = cargo.reduce((acc, i) => acc + i.quantity, 0); const space = config.maxCargo - currentLoad; if (space <= 0) { return prev; } const batchSize = getTransferBatchSize(item.type); let amount = all ? item.quantity : Math.min(item.quantity, batchSize); amount = Math.min(amount, space); if (amount <= 0) return prev; if (item.quantity === amount) { reserves.splice(selectedReserveIdx, 1); } else { reserves[selectedReserveIdx] = { ...item, quantity: item.quantity - amount }; } const cargoIdx = cargo.findIndex(c => c.id === item.id); if (cargoIdx >= 0) { cargo[cargoIdx] = { ...cargo[cargoIdx], quantity: cargo[cargoIdx].quantity + amount }; } else { cargo.push({ ...item, quantity: amount, instanceId: `cargo_${Date.now()}_${Math.random()}` }); } } newFittings[sId] = { ...fit, cargo }; newReserveByPlanet[dockedId] = reserves; return { ...prev, shipFittings: newFittings, reserveByPlanet: newReserveByPlanet }; }); audioService.playSfx('click'); if (shouldNullCargo) setSelectedCargoIdx(null); if (shouldNullReserve) setSelectedReserveIdx(null); };
  
  const marketBuy = (item: any) => {
      const sId = gameState.selectedShipInstanceId;
      if (!sId) return;
      const shipInst = gameState.ownedShips.find(os => os.instanceId === sId);
      if (!shipInst) return;
      const config = SHIPS.find(s => s.id === shipInst.shipTypeId);
      if (!config) return;
      
      const fit = gameState.shipFittings[sId];
      if (gameState.credits < item.price) { audioService.playSfx('denied'); return; }
      
      const qtyToBuy = item._buyAmount || 1;
      const currentCargoCount = fit.cargo.reduce((acc, c) => acc + c.quantity, 0);
      
      // Calculate remaining space only if going to cargo
      // Ordnance might fit in active slots first
      // Check for Omega Mine specific logic
      if (currentCargoCount >= config.maxCargo && !((item.type === 'missile' && fit.rocketCount < 10) || (item.type === 'mine' && fit.mineCount < 10) || (item.id === 'ord_mine_red' && (fit.redMineCount || 0) < 5))) {
          // If pure cargo item and full
          if (!['missile', 'mine'].includes(item.type) && item.id !== 'ord_mine_red') {
             audioService.playSfx('denied'); return; 
          }
      }
      
      setGameState(prev => {
          const sId = prev.selectedShipInstanceId!; const fit = prev.shipFittings[sId]; const newCargo = [...fit.cargo];
          let updatedFit = { ...fit };
          
          let itemType = item.type || 'goods'; 
          if (item.damage || ['projectile', 'laser', 'gun'].includes(item.type?.toLowerCase())) itemType = 'weapon'; 
          if (item.capacity || ['shield'].includes(item.type?.toLowerCase())) itemType = 'shield'; 
          
          let purchased = false;
          let remainingQty = qtyToBuy;

          // Special Handling for Ordnance: Fill active slots first
          if (item.id === 'ord_mine_red') {
              const currentRed = updatedFit.redMineCount || 0;
              const space = 5 - currentRed;
              const toAdd = Math.min(remainingQty, space);
              if (toAdd > 0) {
                  updatedFit.redMineCount = currentRed + toAdd;
                  remainingQty -= toAdd;
                  purchased = true;
              }
          } else if (item.type === 'missile') {
              const space = 10 - updatedFit.rocketCount;
              const toAdd = Math.min(remainingQty, space);
              if (toAdd > 0) {
                  updatedFit.rocketCount += toAdd;
                  remainingQty -= toAdd;
                  purchased = true;
              }
          } else if (item.type === 'mine') {
              const space = 10 - updatedFit.mineCount;
              const toAdd = Math.min(remainingQty, space);
              if (toAdd > 0) {
                  updatedFit.mineCount += toAdd;
                  remainingQty -= toAdd;
                  purchased = true;
              }
          }

          // Add remaining quantity to Cargo
          if (remainingQty > 0) {
              const cargoSpace = config.maxCargo - newCargo.reduce((acc, c) => acc + c.quantity, 0);
              const toCargo = Math.min(remainingQty, cargoSpace);
              
              if (toCargo > 0) {
                  const existingIdx = newCargo.findIndex(c => c.id === item.id);
                  if (existingIdx >= 0) { 
                      newCargo[existingIdx] = { ...newCargo[existingIdx], quantity: newCargo[existingIdx].quantity + toCargo }; 
                  } else { 
                      newCargo.push({ instanceId: `buy_${Date.now()}_${item.id}`, type: itemType, id: item.id, name: item.name, weight: 1, quantity: toCargo }); 
                  }
                  updatedFit.cargo = newCargo;
                  purchased = true;
                  
                  // NEW: Ammo Logic - Purchasing specific ammo sets it as active preference
                  if (item.type === 'ammo') {
                      updatedFit.selectedAmmo = item.id;
                  }
              } else if (!purchased) {
                  // If we didn't buy anything active AND couldn't fit in cargo
                  return prev;
              }
          }

          if (purchased) {
              audioService.playSfx('buy');
              return { ...prev, credits: prev.credits - item.price, shipFittings: { ...prev.shipFittings, [sId]: updatedFit } }; 
          } else {
              audioService.playSfx('denied'); // Cargo full
              return prev;
          }
      });
  };

  const marketSell = (resIdx: number) => { setGameState(prev => { const newRes = [...(prev.reserveByPlanet[dockedId] || [])]; const item = newRes[resIdx]; const basePrice = [...WEAPONS, ...SHIELDS, ...EXPLODING_ORDNANCE, ...COMMODITIES, ...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS].find(x => x.id === item.id)?.price || 1000; const sellPrice = Math.floor(basePrice * 0.8); if (item.quantity > 1) item.quantity--; else newRes.splice(resIdx, 1); return { ...prev, credits: prev.credits + sellPrice, reserveByPlanet: { ...prev.reserveByPlanet, [dockedId]: newRes } }; }); audioService.playSfx('buy'); };
  
  const mountFromCargo = (cargoIdx: number, slotIdx: number, type: 'weapon' | 'shield') => { 
    if (!gameState.selectedShipInstanceId) return; 
    setGameState(prev => { 
        const sId = prev.selectedShipInstanceId!; 
        const fit = prev.shipFittings[sId]; 
        let newCargo = [...fit.cargo]; 
        
        // 1. Get Source Item from Cargo
        const sourceItem = newCargo[cargoIdx];
        if (!sourceItem) return prev; 
        
        // 2. Remove/Decrement Source Item from Cargo
        if (sourceItem.quantity > 1) { 
            newCargo[cargoIdx] = { ...sourceItem, quantity: sourceItem.quantity - 1 }; 
        } else { 
            newCargo.splice(cargoIdx, 1); 
        } 
        
        // 3. Identify Existing Item in Slot
        let unmountId: string | null = null; 
        if (type === 'weapon') { 
            unmountId = fit.weapons[slotIdx]?.id || null; 
        } else { 
            unmountId = slotIdx === 0 ? fit.shieldId : fit.secondShieldId; 
            if (unmountId === 'dev_god_mode') unmountId = null; 
        } 
        
        // 4. Move Existing Item to Cargo (Unmount)
        if (unmountId) { 
            const def = [...WEAPONS, ...EXOTIC_WEAPONS, ...SHIELDS, ...EXOTIC_SHIELDS].find(x => x.id === unmountId); 
            const existingCargoIdx = newCargo.findIndex(c => c.id === unmountId); 
            if (existingCargoIdx >= 0) { 
                newCargo[existingCargoIdx] = { ...newCargo[existingCargoIdx], quantity: newCargo[existingCargoIdx].quantity + 1 }; 
            } else { 
                newCargo.push({ 
                    instanceId: `unmt_${Date.now()}_${Math.random()}`, 
                    type: type, 
                    id: unmountId, 
                    name: def?.name || 'Item', 
                    weight: 1, 
                    quantity: 1 
                }); 
            } 
        } 
        
        // 5. Update Slot with New Item
        const newFits = { ...prev.shipFittings }; 
        if (type === 'weapon') { 
            const newWeps = [...fit.weapons]; 
            newWeps[slotIdx] = { id: sourceItem.id!, count: 1 }; 
            newFits[sId] = { ...fit, weapons: newWeps, cargo: newCargo }; 
        } else { 
            const key = slotIdx === 0 ? 'shieldId' : 'secondShieldId'; 
            newFits[sId] = { ...fit, [key]: sourceItem.id!, cargo: newCargo }; 
        } 
        
        return { ...prev, shipFittings: newFits }; 
    }); 
    audioService.playSfx('click'); 
  };

  const unmountSlot = (slotIdx: number, type: 'weapon' | 'shield') => { 
    if (!gameState.selectedShipInstanceId) return; 
    setGameState(prev => { 
        const sId = prev.selectedShipInstanceId!; 
        const fit = prev.shipFittings[sId], newCargo = [...fit.cargo]; 
        
        const id = type === 'weapon' ? fit.weapons[slotIdx]?.id : (slotIdx === 0 ? fit.shieldId : fit.secondShieldId); 
        if (!id) return prev; 
        
        const def = [...WEAPONS, ...EXOTIC_WEAPONS, ...SHIELDS, ...EXOTIC_SHIELDS].find(x => x.id === id); 
        const existingIdx = newCargo.findIndex(c => c.id === id); 
        
        if (existingIdx >= 0) { 
            newCargo[existingIdx] = { ...newCargo[existingIdx], quantity: newCargo[existingIdx].quantity + 1 }; 
        } else { 
            newCargo.push({ 
                instanceId: `unmt_${Date.now()}`, 
                type: type, 
                id, 
                name: def?.name || 'Item', 
                weight: 1, 
                quantity: 1 
            }); 
        } 
        
        const newFits = { ...prev.shipFittings }; 
        if (type === 'weapon') { 
            const newWeps = [...fit.weapons]; 
            newWeps[slotIdx] = null; 
            newFits[sId] = { ...fit, weapons: newWeps, cargo: newCargo }; 
        } else { 
            const key = slotIdx === 0 ? 'shieldId' : 'secondShieldId'; 
            newFits[sId] = { ...fit, [key]: null, cargo: newCargo }; 
        } 
        return { ...prev, shipFittings: newFits }; 
    }); 
    audioService.playSfx('click'); 
  };

  const setPartColor = (color: string) => { if (!gameState.selectedShipInstanceId) return; const sId = gameState.selectedShipInstanceId; let colorKey: keyof GameState | undefined; switch (activePart) { case 'hull': colorKey = 'shipColors'; break; case 'wings': colorKey = 'shipWingColors'; break; case 'cockpit': colorKey = 'shipCockpitColors'; break; case 'guns': colorKey = 'shipGunColors'; break; case 'secondary_guns': colorKey = 'shipSecondaryGunColors'; break; case 'gun_body': colorKey = 'shipGunBodyColors'; break; case 'engines': colorKey = 'shipEngineColors'; break; case 'nozzles': colorKey = 'shipNozzleColors'; break; default: return; } if (colorKey) { setGameState(prev => ({ ...prev, [colorKey!]: { ...((prev[colorKey!] as Record<string, string>) || {}), [sId]: color } })); audioService.playSfx('click'); } };
  const updateCustomColor = (index: number, newColor: string) => { setGameState(prev => { const oldColor = prev.customColors[index]; const newCustomColors = [...prev.customColors]; newCustomColors[index] = newColor; const updateMap = (map: Record<string, string>) => { const newMap = { ...map }; let changed = false; Object.keys(newMap).forEach(key => { if (newMap[key] === oldColor) { newMap[key] = newColor; changed = true; } }); return changed ? newMap : map; }; return { ...prev, customColors: newCustomColors, shipColors: updateMap(prev.shipColors), shipWingColors: updateMap(prev.shipWingColors), shipCockpitColors: updateMap(prev.shipCockpitColors), shipGunColors: updateMap(prev.shipGunColors), shipSecondaryGunColors: updateMap(prev.shipSecondaryGunColors), shipGunBodyColors: updateMap(prev.shipGunBodyColors), shipEngineColors: updateMap(prev.shipEngineColors), shipNozzleColors: updateMap(prev.shipNozzleColors), }; }); };
  const setGodMode = (slotIdx: number) => { if (!gameState.selectedShipInstanceId) return; setGameState(prev => { const sId = prev.selectedShipInstanceId!; const fit = prev.shipFittings[sId]; const newFits = { ...prev.shipFittings }; const key = slotIdx === 0 ? 'shieldId' : 'secondShieldId'; newFits[sId] = { ...fit, [key]: 'dev_god_mode' }; return { ...prev, shipFittings: newFits }; }); audioService.playSfx('click'); };
  const buyAmmo = (type: AmmoType) => { if (!gameState.selectedShipInstanceId) return; const cost = AMMO_CONFIG[type].price; if (gameState.credits < cost) { audioService.playSfx('denied'); triggerSystemMessage(`INSUFFICIENT CREDITS FOR ${type.toUpperCase()}`, 'error'); return; } setGameState(prev => { const sId = prev.selectedShipInstanceId!; const fit = prev.shipFittings[sId]; const newAmmo = { ...fit.ammo, [type]: (fit.ammo[type] || 0) + 1000 }; return { ...prev, credits: prev.credits - cost, shipFittings: { ...prev.shipFittings, [sId]: { ...fit, ammo: newAmmo } } }; }); audioService.playSfx('buy'); };
  const selectAmmo = (type: AmmoType) => { if (!gameState.selectedShipInstanceId) return; setGameState(prev => { const sId = prev.selectedShipInstanceId!; return { ...prev, shipFittings: { ...prev.shipFittings, [sId]: { ...prev.shipFittings[sId], selectedAmmo: type } } }; }); audioService.playSfx('click'); };

  return (
    <div className="w-full h-full bg-black text-white font-sans overflow-hidden select-none relative">
      {screen !== 'intro' && screen !== 'hangar' && <StarBackground />}
      
      {screen === 'intro' && (
        <div className="fixed inset-0 flex flex-col items-center justify-center p-6 z-10 text-center overflow-hidden">
          <div className="fixed inset-0 z-0"><StoryScene /></div>
          <div className="z-10 flex flex-col items-center">
              <h1 className="retro-font text-3xl md:text-5xl text-emerald-500/50 uppercase tracking-widest mb-10 z-10 leading-tight drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">GALACTIC<br/>FREELANCER</h1>
              <div className="flex flex-col gap-4 z-10 w-64">
                <button onClick={() => { setScreen('hangar'); audioService.playTrack('command'); }} className="py-4 bg-black/50 backdrop-blur-sm border-2 border-emerald-500 text-emerald-500 font-black uppercase tracking-widest hover:bg-emerald-900/40 hover:text-white transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">START MISSION</button>
                <button onClick={() => { setScreen('hangar'); audioService.playTrack('command'); }} className="py-3 bg-black/50 backdrop-blur-sm border border-zinc-500 text-zinc-400 font-black uppercase hover:bg-zinc-800/60 hover:border-zinc-300 hover:text-white transition-all">RESUME MISSION</button>
                <div className="flex gap-4">
                    <button onClick={() => { setIsManualOpen(true); setManualPage(1); }} className="flex-1 py-3 bg-black/50 backdrop-blur-sm border border-zinc-600 text-zinc-500 font-black uppercase hover:bg-zinc-800/60 hover:text-white transition-all text-[10px]">MANUAL</button>
                    <button onClick={() => setIsOptionsOpen(true)} className="flex-1 py-3 bg-black/50 backdrop-blur-sm border border-zinc-600 text-zinc-500 font-black uppercase hover:bg-zinc-800/60 hover:text-white transition-all text-[10px]">OPTIONS</button>
                </div>
              </div>
          </div>
        </div>
      )}

      {screen === 'hangar' && (
        <CommandCenter 
            gameState={gameState} 
            setGameState={setGameState} 
            dockedPlanetName={dockedPlanet?.name || "Unknown"} 
            onLaunch={handleLaunch} 
            onRepair={repairSelected} 
            onRefuel={refuelSelected} 
            setScreen={setScreen} 
            setIsOptionsOpen={setIsOptionsOpen} 
            setIsStoreOpen={setIsStoreOpen} 
            setIsLoadoutOpen={setIsLoadoutOpen} 
            setIsPaintOpen={setIsPaintOpen} 
            setIsMessagesOpen={setIsMessagesOpen} 
            setIsMarketOpen={setIsMarketOpen} 
            setIsCargoOpen={setIsCargoOpen}
            activeSlotIndex={activeSlotIndex}
            setActiveSlotIndex={setActiveSlotIndex}
            systemMessage={systemMessage}
        />
      )}

      <CargoDialog isOpen={isCargoOpen} onClose={() => setIsCargoOpen(false)} fitting={selectedFitting!} shipConfig={selectedShipConfig} reserves={currentReserves} selectedCargoIdx={selectedCargoIdx} selectedReserveIdx={selectedReserveIdx} setSelectedCargoIdx={setSelectedCargoIdx} setSelectedReserveIdx={setSelectedReserveIdx} onMoveItems={moveItems} onMoveAll={moveAllItems} fontSize={gameState.settings.fontSize} />
      <MarketDialog isOpen={isMarketOpen} onClose={() => setIsMarketOpen(false)} marketTab={marketTab} setMarketTab={setMarketTab} currentReserves={currentReserves} credits={gameState.credits} testMode={!!gameState.settings.testMode} marketBuy={marketBuy} marketSell={marketSell} fontSize={gameState.settings.fontSize} />
      <StoreDialog isOpen={isStoreOpen} onClose={() => setIsStoreOpen(false)} inspectedShipId={inspectedShipId} setInspectedShipId={setInspectedShipId} credits={gameState.credits} replaceShip={replaceShip} fontSize={gameState.settings.fontSize} testMode={!!gameState.settings.testMode} />
      <LoadoutDialog isOpen={isLoadoutOpen} onClose={() => setIsLoadoutOpen(false)} fitting={selectedFitting!} shipConfig={selectedShipConfig} loadoutTab={loadoutTab} setLoadoutTab={setLoadoutTab} activeFittingSlot={activeFittingSlot} setActiveFittingSlot={setActiveFittingSlot} unmountSlot={unmountSlot} mountFromCargo={mountFromCargo} testMode={!!gameState.settings.testMode} setGodMode={setGodMode} buyAmmo={buyAmmo} selectAmmo={selectAmmo} fontSize={gameState.settings.fontSize} />
      <PaintDialog isOpen={isPaintOpen} onClose={() => setIsPaintOpen(false)} selectedShipInstanceId={gameState.selectedShipInstanceId!} selectedShipConfig={selectedShipConfig} activePart={activePart} setActivePart={setActivePart} gameState={gameState} setPartColor={setPartColor} updateCustomColor={updateCustomColor} fontSize={gameState.settings.fontSize} />
      <MessagesDialog isOpen={isMessagesOpen} onClose={() => setIsMessagesOpen(false)} messages={gameState.messages} fontSize={gameState.settings.fontSize} />
      <OptionsDialog isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} gameState={gameState} setGameState={setGameState} />
      <ManualDialog isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} manualPage={manualPage} setManualPage={setManualPage} fontSize={gameState.settings.fontSize} />

      {screen === 'map' && (
        <SectorMap 
            currentQuadrant={gameState.currentQuadrant} 
            orbitOffsets={gameState.planetOrbitOffsets} 
            universeStartTime={gameState.universeStartTime} 
            planetRegistry={gameState.planetRegistry}
            onLaunch={handlePlanetSelection} 
            onBack={() => setScreen('hangar')} 
            testMode={!!gameState.settings.testMode}
            onTestLanding={(planet) => {
                setGameState(prev => ({ ...prev, currentPlanet: planet, currentQuadrant: planet.quadrant }));
                setScreen('landing');
            }}
        />
      )}
      
      {screen === 'launch' && gameState.currentPlanet && (
        <LaunchSequence 
            planet={dockedPlanet || gameState.currentPlanet} 
            shipConfig={selectedShipConfig || SHIPS[0]} 
            shipColors={{ hull: gameState.shipColors[activeShipId], wings: gameState.shipWingColors[activeShipId], cockpit: gameState.shipCockpitColors[activeShipId], guns: gameState.shipGunColors[activeShipId], secondary_guns: gameState.shipSecondaryGunColors[activeShipId], gun_body: gameState.shipGunBodyColors[activeShipId], engines: gameState.shipEngineColors[activeShipId], nozzles: gameState.shipNozzleColors[activeShipId] }} 
            onComplete={handleLaunchSequenceComplete}
            testMode={!!gameState.settings.testMode}
            weaponId={activeWeaponId}
            equippedWeapons={selectedFitting?.weapons}
            currentFuel={selectedFitting?.fuel || 0}
            maxFuel={selectedShipConfig?.maxFuel || 100}
        />
      )}

      {screen === 'warp' && (
        <WarpSequence
            shipConfig={selectedShipConfig || SHIPS[0]}
            shipColors={{ hull: gameState.shipColors[activeShipId], wings: gameState.shipWingColors[activeShipId], cockpit: gameState.shipCockpitColors[activeShipId], guns: gameState.shipGunColors[activeShipId], secondary_guns: gameState.shipSecondaryGunColors[activeShipId], gun_body: gameState.shipGunBodyColors[activeShipId], engines: gameState.shipEngineColors[activeShipId], nozzles: gameState.shipNozzleColors[activeShipId] }}
            shieldColor={getActiveShieldColor()}
            onComplete={handleWarpComplete}
            weaponId={activeWeaponId}
            equippedWeapons={selectedFitting?.weapons}
        />
      )}

      {screen === 'game' && gameState.currentPlanet && (
        <GameEngine
          ships={gameState.ownedShips.filter(os => os.instanceId === gameState.selectedShipInstanceId).map(os => ({
             config: SHIPS.find(s => s.id === os.shipTypeId)!,
             fitting: gameState.shipFittings[os.instanceId],
             color: gameState.shipColors[os.instanceId],
             wingColor: gameState.shipWingColors[os.instanceId],
             cockpitColor: gameState.shipCockpitColors[os.instanceId],
             gunColor: gameState.shipGunColors[os.instanceId],
             secondaryGunColor: gameState.shipSecondaryGunColors[os.instanceId],
             gunBodyColor: gameState.shipGunBodyColors[os.instanceId],
             engineColor: gameState.shipEngineColors[os.instanceId],
             nozzleColor: gameState.shipNozzleColors[os.instanceId]
          }))}
          shield={(() => {
              const id = selectedFitting?.shieldId;
              if (id === 'dev_god_mode') return { id: 'dev_god_mode', name: 'Developer Aegis', price: 0, capacity: 999999, regenRate: 1000, energyCost: 0, visualType: 'full', color: '#ffffff' } as Shield;
              return id ? [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === id) || null : null;
          })()}
          secondShield={(() => {
              const id = selectedFitting?.secondShieldId;
              if (id === 'dev_god_mode') return { id: 'dev_god_mode', name: 'Developer Aegis', price: 0, capacity: 999999, regenRate: 1000, energyCost: 0, visualType: 'full', color: '#ffffff' } as Shield;
              return id ? [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === id) || null : null;
          })()}
          difficulty={gameState.currentPlanet.difficulty}
          currentPlanet={gameState.currentPlanet}
          quadrant={gameState.currentQuadrant}
          onGameOver={handleGameOver}
          fontSize={gameState.settings.fontSize}
          mode={gameMode} 
          planetRegistry={gameState.planetRegistry}
        />
      )}
      {screen === 'landing' && gameState.currentPlanet && (
        <LandingScene 
            planet={gameState.currentPlanet} 
            shipShape={selectedShipConfig?.shape || 'arrow'} 
            onComplete={() => { 
                setGameState(prev => {
                    const sId = prev.selectedShipInstanceId!;
                    const fit = prev.shipFittings[sId];
                    // Deduct landing fuel cost (30% of launch cost = 0.3)
                    const newFuel = Math.max(0, fit.fuel - 0.3);
                    
                    return {
                        ...prev, 
                        dockedPlanetId: prev.currentPlanet!.id,
                        shipFittings: {
                            ...prev.shipFittings,
                            [sId]: { ...fit, fuel: newFuel }
                        }
                    };
                });
                setScreen('hangar'); 
                audioService.playTrack('command'); 
            }}
            weaponId={activeWeaponId}
            equippedWeapons={selectedFitting?.weapons}
            currentFuel={selectedFitting?.fuel || 0}
            maxFuel={selectedShipConfig?.maxFuel || 100}
        />
      )}
    </div>
  );
}
