
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameState, ShipFitting, Planet, QuadrantType, ShipPart, CargoItem, Shield, AmmoType, PlanetStatusData, LeaderboardEntry } from './types.ts';
import { SHIPS, INITIAL_CREDITS, PLANETS, WEAPONS, EXOTIC_WEAPONS, SHIELDS, EXOTIC_SHIELDS, EXPLODING_ORDNANCE, COMMODITIES, ExtendedShipConfig, MAX_FLEET_SIZE, AVATARS, AMMO_CONFIG, AMMO_MARKET_ITEMS } from './constants.ts';
import { audioService } from './services/audioService.ts';
import { backendService } from './services/backendService.ts';
import { StoryScene } from './components/StoryScene.tsx';
import { CommandCenter } from './components/CommandCenter.tsx';
import { CargoDialog } from './components/CargoDialog.tsx';
import { MarketDialog } from './components/MarketDialog.tsx';
import { StoreDialog } from './components/StoreDialog.tsx';
import { LoadoutDialog } from './components/LoadoutDialog.tsx';
import { PaintDialog } from './components/PaintDialog.tsx';
import { MessagesDialog } from './components/MessagesDialog.tsx';
import { OptionsDialog } from './components/OptionsDialog.tsx';
import { ManualDialog } from './components/ManualDialog.tsx';
import SectorMap from './components/SectorMap.tsx';
import LaunchSequence from './components/LaunchSequence.tsx';
import WarpSequence from './components/WarpSequence.tsx';
import GameEngine from './components/GameEngine.tsx';
import LandingScene from './components/LandingScene.tsx';

const SAVE_KEY = 'galactic_defender_beta_25_market'; 
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
      const shipIndex = SHIPS.findIndex(s => s.id === config.id);
      
      if (shipIndex >= 3 && shipIndex <= 4) {
          weapons[0] = { id: 'gun_photon', count: 1 };
      } else {
          weapons[0] = { id: 'gun_pulse', count: 1 };
      }

      initialFittings[os.instanceId] = { 
          weapons, 
          shieldId: null, secondShieldId: null, flareId: null, reactorLevel: 1, engineType: 'standard', 
          rocketCount: 2, 
          mineCount: 2,   
          redMineCount: 0, 
          hullPacks: 0, wingWeaponId: null, 
          health: 100, ammoPercent: 100, lives: 1, fuel: config.maxFuel, cargo: [],
          water: 100, // Initial water
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
      currentPlanet: PLANETS[0], currentMoon: null, currentMission: null, currentQuadrant: QuadrantType.ALFA, conqueredMoonIds: [], shipMapPosition: { [QuadrantType.ALFA]: { x: 50, y: 50 }, [QuadrantType.BETA]: { x: 50, y: 50 }, [QuadrantType.GAMA]: { x: 50, y: 50 }, [QuadrantType.DELTA]: { x: 50, y: 50 } }, shipRotation: 0, orbitingEntityId: null, orbitAngle: 0, dockedPlanetId: 'p1', tutorialCompleted: false, settings: { musicVolume: 0.3, sfxVolume: 0.5, musicEnabled: true, sfxEnabled: true, displayMode: 'windowed', autosaveEnabled: true, showTransitions: false, testMode: false, fontSize: 'medium' }, taskForceShipIds: [], activeTaskForceIndex: 0, pilotName: 'STRATOS', pilotAvatar: '👨🏻', pilotZoom: 1.0, gameInProgress: false, victories: 0, failures: 0, typeColors: {}, reserveByPlanet: {}, 
      marketListingsByPlanet: {}, marketRefreshes: {},
      messages: [{ id: 'init', type: 'activity', category: 'system', pilotName: 'COMMAND', pilotAvatar: '🛰️', text: 'Welcome. Systems online.', timestamp: Date.now() }],
      leaderboard: [],
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
        if (!parsed.leaderboard) parsed.leaderboard = []; // Ensure leaderboard exists
        if (!parsed.marketListingsByPlanet) parsed.marketListingsByPlanet = {};
        if (!parsed.marketRefreshes) parsed.marketRefreshes = {};
        
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
            if (fit.redMineCount === undefined) fit.redMineCount = 0;
            if (fit.water === undefined) fit.water = 100;
        });

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

  // --- MARKET GENERATION LOGIC ---
  const generatePlanetMarket = (planetId: string): CargoItem[] => {
      const planet = PLANETS.find(p => p.id === planetId);
      if (!planet) return [];

      const newListings: CargoItem[] = [];
      const isHabitable = ['#10b981', '#064e3b', '#60a5fa', '#3b82f6'].includes(planet.color);
      const isBarren = !isHabitable;
      const isHighTech = planet.difficulty > 5;
      const isWarZone = planet.difficulty > 8;
      
      const isTestMode = gameState.settings.testMode;

      // 1. COMMODITIES
      COMMODITIES.forEach(c => {
          let chance = 0.5;
          let qtyBase = 10;
          let priceMult = 1.0;

          if (['food', 'water', 'medicine', 'drug'].includes(c.type)) {
              if (isHabitable) { chance = 0.9; qtyBase = 50; priceMult = 0.5; }
              else { chance = 0.3; qtyBase = 5; priceMult = 5.0; }
          } else if (['iron', 'copper', 'gold', 'platinum', 'tungsten'].includes(c.type)) {
              if (isBarren) { chance = 0.8; qtyBase = 40; priceMult = 0.6; }
              else { chance = 0.4; qtyBase = 10; priceMult = 1.5; }
          } else if (['fuel', 'energy'].includes(c.type)) {
              chance = 0.9; qtyBase = 100; // Always available
          }

          if (isTestMode || Math.random() < chance) {
              const qty = isTestMode ? 250 : Math.floor(qtyBase * (0.5 + Math.random()));
              newListings.push({
                  instanceId: `market_${planetId}_${c.id}_${Date.now()}`,
                  id: c.id,
                  type: c.type,
                  name: c.name,
                  quantity: qty,
                  weight: 1,
                  price: Math.floor(c.price * priceMult),
                  description: c.description
              });
          }
      });

      // 2. ORDNANCE (Missiles/Mines)
      EXPLODING_ORDNANCE.forEach(o => {
          const type = o.id.includes('missile') ? 'missile' : 'mine';
          if (!isTestMode && o.id === 'ord_mine_red' && !isHighTech) return; 
          
          if (isTestMode || Math.random() < 0.7) {
              const qty = isTestMode ? 100 : Math.floor(20 + Math.random() * 30);
              newListings.push({
                  instanceId: `market_${planetId}_${o.id}_${Date.now()}`,
                  id: o.id,
                  type: type as any,
                  name: o.name,
                  quantity: qty,
                  weight: 1,
                  price: o.price
              });
          }
      });

      // 3. AMMO
      AMMO_MARKET_ITEMS.forEach(a => {
          if (isTestMode || Math.random() < 0.8) {
              const qty = isTestMode ? 100 : Math.floor(5 + Math.random() * 10); 
              newListings.push({
                  instanceId: `market_${planetId}_${a.id}_${Date.now()}`,
                  id: a.id,
                  type: 'ammo',
                  name: a.name,
                  quantity: qty,
                  weight: 1,
                  price: a.price,
                  description: a.description
              });
          }
      });

      // 4. WEAPONS & SHIELDS
      const gearPool = [...WEAPONS, ...SHIELDS];
      gearPool.forEach(g => {
          const isShield = 'capacity' in g;
          const isHighTier = g.price > 50000;
          
          if (!isTestMode && isHighTier && planet.difficulty < 4) return; 
          
          // Rarity check
          let chance = isHighTier ? 0.3 : 0.7;
          if (isWarZone) chance += 0.2; 

          if (isTestMode || Math.random() < chance) {
              const qty = isTestMode ? 10 : (isHighTier ? Math.floor(1 + Math.random()) : Math.floor(1 + Math.random() * 3));
              const priceMult = isWarZone ? 1.2 : 1.0;
              
              newListings.push({
                  instanceId: `market_${planetId}_${g.id}_${Date.now()}`,
                  id: g.id,
                  type: isShield ? 'shield' : 'weapon',
                  name: g.name,
                  quantity: qty,
                  weight: 1,
                  price: Math.floor(g.price * priceMult),
                  description: 'Defense System'
              });
          }
      });

      // 5. EXOTICS (Very Rare, specific planets)
      const exoticPool = [...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS];
      exoticPool.forEach(e => {
          if (isTestMode || (isHighTech || isWarZone)) {
              if (isTestMode || Math.random() < 0.05) { 
                  newListings.push({
                      instanceId: `market_${planetId}_${e.id}_${Date.now()}`,
                      id: e.id,
                      type: 'id' in e && (e as any).capacity ? 'shield' : 'weapon',
                      name: e.name,
                      quantity: isTestMode ? 10 : 1,
                      weight: 1,
                      price: e.price
                  });
              }
          }
      });

      return newListings;
  };

  // Check and refresh market if needed
  useEffect(() => {
      const dockedId = gameState.dockedPlanetId || 'p1';
      const lastRefresh = gameState.marketRefreshes[dockedId] || 0;
      const now = Date.now();
      const REFRESH_INTERVAL = 3600000; // 1 Hour

      // Check testMode change to force refresh if enabled
      if (gameState.settings.testMode || now - lastRefresh > REFRESH_INTERVAL || !gameState.marketListingsByPlanet[dockedId]) {
          const newListings = generatePlanetMarket(dockedId);
          setGameState(prev => ({
              ...prev,
              marketListingsByPlanet: {
                  ...prev.marketListingsByPlanet,
                  [dockedId]: newListings
              },
              marketRefreshes: {
                  ...prev.marketRefreshes,
                  [dockedId]: now
              }
          }));
      }
  }, [gameState.dockedPlanetId, gameState.marketRefreshes, gameState.settings.testMode]);

  const startNewGame = () => {
      const newState = createInitialState();
      newState.settings = { ...gameState.settings };
      newState.leaderboard = [...gameState.leaderboard];
      newState.pilotName = gameState.pilotName;
      newState.pilotAvatar = gameState.pilotAvatar;
      newState.pilotZoom = gameState.pilotZoom;
      setGameState(newState);
      setScreen('hangar');
      audioService.playTrack('command');
  };

  const resumeGame = () => {
      setScreen('hangar');
      audioService.playTrack('command');
  };

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

  // Initial Backend Sync & Welcome
  useEffect(() => {
      backendService.getLeaderboard().then(lb => {
          setGameState(p => ({ ...p, leaderboard: lb }));
      });
      const hasWelcomed = sessionStorage.getItem('has_welcomed_session');
      if (!hasWelcomed) {
          backendService.registerUser(gameState.pilotName).then(msg => {
              setGameState(p => ({
                  ...p,
                  messages: [{
                      id: `sys_${Date.now()}`,
                      type: 'activity',
                      category: 'system',
                      pilotName: 'SYSTEM',
                      pilotAvatar: '🛰️',
                      text: msg,
                      timestamp: Date.now()
                  }, ...p.messages]
              }));
              sessionStorage.setItem('has_welcomed_session', 'true');
          });
      }
  }, [gameState.pilotName]);

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

  const uiStyles = useMemo(() => {
      const s = gameState.settings.fontSize;
      if (s === 'small') return { btn: 'text-xs', beta: 'text-[8px]', container: 'w-64', spacing: 'gap-3' };
      if (s === 'large') return { btn: 'text-base', beta: 'text-[10px]', container: 'w-80', spacing: 'gap-5' };
      if (s === 'extra-large') return { btn: 'text-lg', beta: 'text-xs', container: 'w-96', spacing: 'gap-6' };
      return { btn: 'text-sm', beta: 'text-[9px]', container: 'w-72', spacing: 'gap-4' };
  }, [gameState.settings.fontSize]);

  const repairSelected = () => {
    if (!gameState.selectedShipInstanceId) return;
    const sId = gameState.selectedShipInstanceId;
    const fit = gameState.shipFittings[sId];
    if (fit.health >= 100) { audioService.playSfx('denied'); triggerSystemMessage("HULL INTEGRITY MAXIMUM", 'neutral'); return; }
    setGameState(prev => {
        const sId = prev.selectedShipInstanceId!; const fit = prev.shipFittings[sId]; const newCargo = [...fit.cargo]; const newReserve = [...(prev.reserveByPlanet[dockedId] || [])];
        let currentHp = fit.health; const hpNeeded = 100 - currentHp; let hpRestored = 0;
        const resourcePriority = ['iron', 'copper', 'chromium', 'titanium', 'gold', 'repair', 'platinum', 'lithium'];
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
    if (!gameState.selectedShipInstanceId || !selectedShipConfig) return;
    const sId = gameState.selectedShipInstanceId;
    const fit = gameState.shipFittings[sId];
    if (fit.fuel >= selectedShipConfig.maxFuel && fit.water >= (selectedShipConfig.maxWater || 100)) { audioService.playSfx('denied'); triggerSystemMessage("ALL SYSTEMS AT MAXIMUM CAPACITY", 'neutral'); return; }
    setGameState(prev => {
        const sId = prev.selectedShipInstanceId!; const fit = prev.shipFittings[sId]; const newCargo = [...fit.cargo]; const newReserve = [...(prev.reserveByPlanet[dockedId] || [])];
        let currentFuel = fit.fuel; const maxFuel = selectedShipConfig.maxFuel; let currentWater = fit.water; const maxWater = selectedShipConfig.maxWater || 100;
        let fueled = false; const FUEL_PER_ITEM = 5.0; const WATER_PER_ITEM = 50.0;
        const processList = (list: CargoItem[]) => {
            for (let i = 0; i < list.length; i++) {
                if (currentFuel >= maxFuel && currentWater >= maxWater) break;
                const item = list[i];
                if (item.type === 'fuel' && currentFuel < maxFuel) { item.quantity--; currentFuel = Math.min(maxFuel, currentFuel + FUEL_PER_ITEM); fueled = true; if (item.quantity <= 0) { list.splice(i, 1); i--; } while (currentFuel < maxFuel && i >= 0 && i < list.length && list[i].type === 'fuel') { if (list[i].quantity > 0) { list[i].quantity--; currentFuel = Math.min(maxFuel, currentFuel + FUEL_PER_ITEM); fueled = true; if (list[i].quantity <= 0) { list.splice(i, 1); i--; } } } }
                if (item.type === 'water' && currentWater < maxWater) { item.quantity--; currentWater = Math.min(maxWater, currentWater + WATER_PER_ITEM); fueled = true; if (item.quantity <= 0) { list.splice(i, 1); i--; } while (currentWater < maxWater && i >= 0 && i < list.length && list[i].type === 'water') { if (list[i].quantity > 0) { list[i].quantity--; currentWater = Math.min(maxWater, currentWater + WATER_PER_ITEM); fueled = true; if (list[i].quantity <= 0) { list.splice(i, 1); i--; } } } }
            }
        };
        processList(newReserve); if (currentFuel < maxFuel || currentWater < maxWater) processList(newCargo);
        if (fueled) { audioService.playSfx('buy'); triggerSystemMessage("REPLENISHMENT COMPLETE", 'success'); return { ...prev, shipFittings: { ...prev.shipFittings, [sId]: { ...fit, fuel: currentFuel, water: currentWater, cargo: newCargo } }, reserveByPlanet: { ...prev.reserveByPlanet, [dockedId]: newReserve } }; } else { audioService.playSfx('denied'); triggerSystemMessage("REPLENISH FAILED: NO FUEL OR WATER CANISTERS", 'error'); return prev; }
    });
  };

  const handleLaunch = () => {
    if (!selectedFitting || !selectedShipConfig) return;
    const launchCost = 1.0;
    if (selectedFitting.fuel < launchCost) { audioService.playSfx('denied'); triggerSystemMessage("LAUNCH ABORTED: INSUFFICIENT FUEL RESERVES", 'error'); return; }
    setLaunchDestination('map'); 
    if (gameState.settings.showTransitions) { setScreen('launch'); } else { setGameState(prev => { const sId = prev.selectedShipInstanceId!; const fit = prev.shipFittings[sId]; return { ...prev, shipFittings: { ...prev.shipFittings, [sId]: { ...fit, fuel: Math.max(0, fit.fuel - launchCost) } } }; }); setScreen('map'); audioService.playTrack('map'); }
  };

  const handleLaunchSequenceComplete = () => { setGameState(prev => { const sId = prev.selectedShipInstanceId!; const fit = prev.shipFittings[sId]; return { ...prev, shipFittings: { ...prev.shipFittings, [sId]: { ...fit, fuel: Math.max(0, fit.fuel - 1.0) } } }; }); if (launchDestination === 'map') { setScreen('map'); audioService.playTrack('map'); } else { setScreen('game'); audioService.playTrack('combat'); } };

  const handleGameOver = async (success: boolean, score: number, aborted: boolean, payload: any) => {
    let rankAchieved: number | null = null;
    let newLeaderboard: LeaderboardEntry[] = [];
    if (success) { rankAchieved = await backendService.submitScore(gameState.pilotName, gameState.credits + score + 5000, gameState.pilotAvatar); newLeaderboard = await backendService.getLeaderboard(); }
    setGameState(prev => {
       const newCredits = prev.credits + score + (success ? 5000 : 0);
       const sId = prev.selectedShipInstanceId!;
       const fitting = prev.shipFittings[sId];
       const updatedFitting = { ...fitting, health: payload?.health ?? 0, fuel: payload?.fuel ?? 0, water: payload?.water ?? fitting.water, rocketCount: payload?.rockets ?? fitting.rocketCount, mineCount: payload?.mines ?? fitting.mineCount, redMineCount: payload?.redMineCount ?? fitting.redMineCount, hullPacks: payload?.hullPacks ?? fitting.hullPacks, cargo: payload?.cargo ?? fitting.cargo, ammo: payload?.ammo ?? fitting.ammo, magazineCurrent: payload?.magazineCurrent ?? fitting.magazineCurrent, reloadTimer: payload?.reloadTimer ?? fitting.reloadTimer };
       const reg = { ...prev.planetRegistry };
       const currentPId = prev.currentPlanet!.id;
       const pEntry = { ...reg[currentPId] };
       let newMessages = [...prev.messages];
       if (success) { pEntry.wins += 1; pEntry.losses = 0; if (pEntry.status !== 'friendly' && pEntry.wins >= 1) { pEntry.status = 'friendly'; pEntry.wins = 0; newMessages.unshift({ id: `win_${Date.now()}`, type: 'activity', category: 'combat', pilotName: 'COMMAND', pilotAvatar: '🛰️', text: `VICTORY IN SECTOR ${prev.currentPlanet?.name}. +${score + 5000} CREDITS AWARDED.`, timestamp: Date.now() }); } else { newMessages.unshift({ id: `win_${Date.now()}`, type: 'activity', category: 'combat', pilotName: 'COMMAND', pilotAvatar: '🛰️', text: `HOSTILES NEUTRALIZED IN SECTOR ${prev.currentPlanet?.name}.`, timestamp: Date.now() }); } if (rankAchieved && rankAchieved <= 20) { newMessages.unshift({ id: `rank_${Date.now()}`, type: 'activity', category: 'system', pilotName: 'FLEET ADMIRALTY', pilotAvatar: '🎖️', text: `CONGRATULATIONS PILOT. YOU HAVE REACHED RANK #${rankAchieved} IN THE GALACTIC LEADERBOARD.`, timestamp: Date.now() }); } } else { if (!aborted) { pEntry.losses += 1; if (pEntry.losses >= 1) { pEntry.losses = 0; const pIndex = PLANETS.findIndex(p => p.id === currentPId); if (pIndex > 0) { const prevPId = PLANETS[pIndex - 1].id; const prevEntry = { ...reg[prevPId] }; let regressionHappened = false; if (prevEntry.status === 'friendly') { prevEntry.status = 'siege'; regressionHappened = true; } else if (prevEntry.status === 'siege') { prevEntry.status = 'occupied'; regressionHappened = true; } if (regressionHappened) { reg[prevPId] = prevEntry; newMessages.unshift({ id: `loss_${Date.now()}`, type: 'activity', category: 'combat', pilotName: 'COMMAND', pilotAvatar: '⚠️', text: `DEFENSE LINE COLLAPSED. ${PLANETS[pIndex-1].name} SECTOR COMPROMISED.`, timestamp: Date.now() }); } } } } } reg[currentPId] = pEntry;
       return { ...prev, credits: newCredits, shipFittings: { ...prev.shipFittings, [sId]: updatedFitting }, gameInProgress: false, planetRegistry: reg, messages: newMessages, leaderboard: newLeaderboard.length > 0 ? newLeaderboard : prev.leaderboard, currentQuadrant: prev.currentPlanet!.quadrant, dockedPlanetId: success ? prev.currentPlanet!.id : prev.dockedPlanetId };
    });
    if (aborted) { const homePlanet = PLANETS.find(p => p.id === (gameState.dockedPlanetId || 'p1')); const homeQuad = homePlanet ? homePlanet.quadrant : QuadrantType.ALFA; const currentQuad = gameState.currentQuadrant; const showTrans = gameState.settings.showTransitions; if (currentQuad !== homeQuad && showTrans) { setWarpDestination('hangar'); setScreen('warp'); } else { setGameState(prev => ({ ...prev, currentQuadrant: homeQuad })); setScreen('hangar'); audioService.playTrack('command'); } } else { if (payload?.health > 0 && gameState.settings.showTransitions && success) { setScreen('landing'); } else { setScreen('hangar'); audioService.playTrack('command'); } }
  };

  const handlePlanetSelection = (planet: Planet) => { const status = gameState.planetRegistry[planet.id]?.status || 'occupied'; const isFriendly = status === 'friendly'; const isSameQuadrant = planet.quadrant === gameState.currentQuadrant; const showTransitions = gameState.settings.showTransitions; const shouldUpdateQuadrantNow = !isSameQuadrant && !showTransitions; setGameState(prev => ({ ...prev, currentPlanet: planet, currentQuadrant: shouldUpdateQuadrantNow ? planet.quadrant : prev.currentQuadrant })); setLaunchDestination('planet'); if (isFriendly) { if (isSameQuadrant) { setScreen('landing'); } else { setWarpDestination('landing'); if (showTransitions) { setScreen('warp'); } else { setScreen('landing'); } } } else { setGameMode('combat'); setWarpDestination('game'); if (isSameQuadrant) { setScreen('game'); audioService.playTrack('combat'); } else { if (showTransitions) { setScreen('warp'); } else { setScreen('game'); audioService.playTrack('combat'); } } } };
  const handleWarpComplete = () => { if (warpDestination === 'hangar') { const homePlanet = PLANETS.find(p => p.id === (gameState.dockedPlanetId || 'p1')); const homeQuad = homePlanet ? homePlanet.quadrant : QuadrantType.ALFA; setGameState(prev => ({ ...prev, currentQuadrant: homeQuad })); setScreen('hangar'); audioService.playTrack('command'); } else if (warpDestination === 'landing') { setGameState(prev => ({ ...prev, currentQuadrant: prev.currentPlanet!.quadrant })); setScreen('landing'); } else { setGameState(prev => ({ ...prev, currentQuadrant: prev.currentPlanet!.quadrant })); setScreen('game'); if (gameMode === 'combat') { audioService.playTrack('combat'); } else { audioService.playTrack('map'); } } };
  const getActiveShieldColor = () => { if (!selectedFitting) return '#3b82f6'; const sId = selectedFitting.shieldId || selectedFitting.secondShieldId; if (!sId) return '#3b82f6'; if (sId === 'dev_god_mode') return '#ffffff'; const sDef = [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === sId); return sDef ? sDef.color : '#3b82f6'; };
  
  const replaceShip = (shipTypeId: string) => {
    const shipConfig = SHIPS.find(s => s.id === shipTypeId); 
    if (!shipConfig || !gameState.selectedShipInstanceId) return; 
    if (gameState.credits < shipConfig.price) { audioService.playSfx('denied'); return; }
    setGameState(prev => {
      const sId = prev.selectedShipInstanceId!; 
      const oldFitting = prev.shipFittings[sId]; 
      const reserve = [...(prev.reserveByPlanet[dockedId] || [])];
      const addToReserve = (id: string, type: any, count: number, name?: string) => { const idx = reserve.findIndex(r => r.id === id); if (idx >= 0) { reserve[idx] = { ...reserve[idx], quantity: reserve[idx].quantity + count }; } else { reserve.push({ instanceId: `res_${Date.now()}_${Math.random()}`, id, type, name: name || id, quantity: count, weight: 1 }); } };
      oldFitting.weapons.forEach((w, i) => { if (i > 0 && w) { const def = [...WEAPONS, ...EXOTIC_WEAPONS].find(d => d.id === w.id); addToReserve(w.id, 'weapon', 1, def?.name); } });
      if (oldFitting.shieldId && oldFitting.shieldId !== 'dev_god_mode') { const def = [...SHIELDS, ...EXOTIC_SHIELDS].find(d => d.id === oldFitting.shieldId); addToReserve(oldFitting.shieldId, 'shield', 1, def?.name); }
      if (oldFitting.secondShieldId && oldFitting.secondShieldId !== 'dev_god_mode') { const def = [...SHIELDS, ...EXOTIC_SHIELDS].find(d => d.id === oldFitting.secondShieldId); addToReserve(oldFitting.secondShieldId, 'shield', 1, def?.name); }
      oldFitting.cargo.forEach(c => { addToReserve(c.id || 'unknown', c.type, c.quantity, c.name); });
      const newOwned = prev.ownedShips.map(os => os.instanceId === sId ? { ...os, shipTypeId } : os); 
      const newFittings = { ...prev.shipFittings };
      const newWeapons = Array(3).fill(null);
      if (shipConfig.isAlien) { const wId = shipConfig.weaponId || 'exotic_plasma_orb'; if (shipConfig.defaultGuns === 1) { newWeapons[0] = { id: wId, count: 1 }; } else { newWeapons[1] = { id: wId, count: 1 }; newWeapons[2] = { id: wId, count: 1 }; } } else { const shipIndex = SHIPS.findIndex(s => s.id === shipTypeId); if (shipIndex >= 3 && shipIndex <= 4) { newWeapons[0] = { id: 'gun_photon', count: 1 }; } else { newWeapons[0] = { id: 'gun_pulse', count: 1 }; } }
      newFittings[sId] = { ...newFittings[sId], health: 100, fuel: shipConfig.maxFuel, water: shipConfig.maxWater || 100, weapons: newWeapons, shieldId: null, secondShieldId: null, rocketCount: 2, mineCount: 2, redMineCount: 0, cargo: [], ammo: { iron: 1000, titanium: 0, cobalt: 0, iridium: 0, tungsten: 0, explosive: 0 }, magazineCurrent: 200, reloadTimer: 0, selectedAmmo: 'iron' };
      return { ...prev, credits: prev.credits - shipConfig.price, ownedShips: newOwned, shipFittings: newFittings, reserveByPlanet: { ...prev.reserveByPlanet, [dockedId]: reserve }, shipColors: { ...prev.shipColors, [sId]: shipConfig.defaultColor || '#94a3b8' } };
    });
    setIsStoreOpen(false); 
    audioService.playSfx('buy');
  };

  const getTransferBatchSize = (type: string) => { if (['missile', 'mine', 'fuel', 'energy', 'water'].includes(type)) return 10; if (['gold', 'platinum', 'lithium', 'iron', 'copper', 'chromium', 'titanium'].includes(type)) return 50; return 1; };
  const moveAllItems = (direction: 'to_reserve' | 'to_ship') => { if (!gameState.selectedShipInstanceId) return; const sId = gameState.selectedShipInstanceId; const config = selectedShipConfig; if (!config) return; setGameState(prev => { const fit = prev.shipFittings[sId]; const reserves = [...(prev.reserveByPlanet[dockedId] || [])]; let cargo = [...fit.cargo]; if (direction === 'to_reserve') { cargo.forEach(item => { const resIdx = reserves.findIndex(r => r.id === item.id); if (resIdx >= 0) { reserves[resIdx] = { ...reserves[resIdx], quantity: reserves[resIdx].quantity + item.quantity }; } else { reserves.push({ ...item, instanceId: `res_${Date.now()}_${Math.random()}` }); } }); cargo = []; } else { let currentLoad = cargo.reduce((acc, i) => acc + i.quantity, 0); const max = config.maxCargo; for (let i = reserves.length - 1; i >= 0; i--) { if (currentLoad >= max) break; const item = reserves[i]; const space = max - currentLoad; const amount = Math.min(item.quantity, space); if (amount > 0) { const cargoIdx = cargo.findIndex(c => c.id === item.id); if (cargoIdx >= 0) { cargo[cargoIdx] = { ...cargo[cargoIdx], quantity: cargo[cargoIdx].quantity + amount }; } else { cargo.push({ ...item, quantity: amount, instanceId: `cargo_${Date.now()}_${Math.random()}` }); } if (item.quantity === amount) { reserves.splice(i, 1); } else { reserves[i] = { ...item, quantity: item.quantity - amount }; } currentLoad += amount; } } } const newFittings = { ...prev.shipFittings, [sId]: { ...fit, cargo } }; const newReserveByPlanet = { ...prev.reserveByPlanet, [dockedId]: reserves }; return { ...prev, shipFittings: newFittings, reserveByPlanet: newReserveByPlanet }; }); audioService.playSfx('click'); setSelectedCargoIdx(null); setSelectedReserveIdx(null); };
  const moveItems = (direction: 'to_reserve' | 'to_ship', all: boolean) => { if (!gameState.selectedShipInstanceId) return; const sId = gameState.selectedShipInstanceId; const config = selectedShipConfig; if (!config) return; let shouldNullCargo = false; let shouldNullReserve = false; const fit = gameState.shipFittings[sId]; const reserves = gameState.reserveByPlanet[dockedId] || []; const cargo = fit.cargo; if (direction === 'to_reserve') { if (selectedCargoIdx === null) return; const item = cargo[selectedCargoIdx]; if (item) { const batchSize = getTransferBatchSize(item.type); const amount = all ? item.quantity : Math.min(item.quantity, batchSize); if (item.quantity === amount) shouldNullCargo = true; } } else { if (selectedReserveIdx === null) return; const item = reserves[selectedReserveIdx]; if (item) { const currentLoad = cargo.reduce((acc, i) => acc + i.quantity, 0); const space = config.maxCargo - currentLoad; if (space > 0) { const batchSize = getTransferBatchSize(item.type); let amount = all ? item.quantity : Math.min(item.quantity, batchSize); amount = Math.min(amount, space); if (item.quantity === amount) shouldNullReserve = true; } } } setGameState(prev => { const fit = prev.shipFittings[sId]; const reserves = [...(prev.reserveByPlanet[dockedId] || [])]; const cargo = [...fit.cargo]; const newFittings = { ...prev.shipFittings }; const newReserveByPlanet = { ...prev.reserveByPlanet }; if (direction === 'to_reserve') { if (selectedCargoIdx === null) return prev; const item = cargo[selectedCargoIdx]; if (!item) return prev; const batchSize = getTransferBatchSize(item.type); const amount = all ? item.quantity : Math.min(item.quantity, batchSize); if (item.quantity === amount) { cargo.splice(selectedCargoIdx, 1); } else { cargo[selectedCargoIdx] = { ...item, quantity: item.quantity - amount }; } const resIdx = reserves.findIndex(r => r.id === item.id); if (resIdx >= 0) { reserves[resIdx] = { ...reserves[resIdx], quantity: reserves[resIdx].quantity + amount }; } else { reserves.push({ ...item, quantity: amount, instanceId: `res_${Date.now()}_${Math.random()}` }); } } else if (direction === 'to_ship') { if (selectedReserveIdx === null) return prev; const item = reserves[selectedReserveIdx]; if (!item) return prev; const currentLoad = cargo.reduce((acc, i) => acc + i.quantity, 0); const space = config.maxCargo - currentLoad; if (space <= 0) { return prev; } const batchSize = getTransferBatchSize(item.type); let amount = all ? item.quantity : Math.min(item.quantity, batchSize); amount = Math.min(amount, space); if (amount <= 0) return prev; if (item.quantity === amount) { reserves.splice(selectedReserveIdx, 1); } else { reserves[selectedReserveIdx] = { ...item, quantity: item.quantity - amount }; } const cargoIdx = cargo.findIndex(c => c.id === item.id); if (cargoIdx >= 0) { cargo[cargoIdx] = { ...cargo[cargoIdx], quantity: cargo[cargoIdx].quantity + amount }; } else { cargo.push({ ...item, quantity: amount, instanceId: `cargo_${Date.now()}_${Math.random()}` }); } } newFittings[sId] = { ...fit, cargo }; newReserveByPlanet[dockedId] = reserves; return { ...prev, shipFittings: newFittings, reserveByPlanet: newReserveByPlanet }; }); audioService.playSfx('click'); if (shouldNullCargo) setSelectedCargoIdx(null); if (shouldNullReserve) setSelectedReserveIdx(null); };
  
  // Updated Market Buy with Quantity Logic and Removal
  const marketBuy = (item: CargoItem, qtyToBuy: number = 1, listingId?: string) => {
      const sId = gameState.selectedShipInstanceId;
      if (!sId) return;
      const shipInst = gameState.ownedShips.find(os => os.instanceId === sId);
      if (!shipInst) return;
      const config = SHIPS.find(s => s.id === shipInst.shipTypeId);
      if (!config) return;
      
      const fit = gameState.shipFittings[sId];
      const totalPrice = (item.price || 0) * qtyToBuy;
      
      if (gameState.credits < totalPrice) { audioService.playSfx('denied'); return; }
      
      const currentCargoCount = fit.cargo.reduce((acc, c) => acc + c.quantity, 0);
      
      // Determine Item Category for space checks
      const isMissile = item.type === 'missile';
      const isMine = item.type === 'mine';
      const isOmega = item.id === 'ord_mine_red';
      const isAmmo = item.type === 'ammo';
      
      if (!isMissile && !isMine && !isOmega && !isAmmo) {
          if (currentCargoCount + qtyToBuy > config.maxCargo) {
              audioService.playSfx('denied'); return;
          }
      }
      
      setGameState(prev => {
          const sId = prev.selectedShipInstanceId!; const fit = prev.shipFittings[sId]; const newCargo = [...fit.cargo];
          let updatedFit = { ...fit };
          
          let itemType = item.type || 'goods'; 
          if ((item as any).damage || ['projectile', 'laser'].includes(item.type?.toLowerCase())) itemType = 'weapon'; 
          if ((item as any).capacity || ['shield'].includes(item.type?.toLowerCase())) itemType = 'shield'; 
          
          let purchased = false;
          let remainingQty = qtyToBuy;

          if (isOmega) {
              const currentRed = updatedFit.redMineCount || 0;
              const space = 5 - currentRed;
              const toAdd = Math.min(remainingQty, space);
              if (toAdd > 0) { updatedFit.redMineCount = currentRed + toAdd; remainingQty -= toAdd; purchased = true; }
          } else if (isMissile) {
              const space = 10 - updatedFit.rocketCount;
              const toAdd = Math.min(remainingQty, space);
              if (toAdd > 0) { updatedFit.rocketCount += toAdd; remainingQty -= toAdd; purchased = true; }
          } else if (isMine) {
              const space = 10 - updatedFit.mineCount;
              const toAdd = Math.min(remainingQty, space);
              if (toAdd > 0) { updatedFit.mineCount += toAdd; remainingQty -= toAdd; purchased = true; }
          }

          if (remainingQty > 0) {
              // ALWAYS add to Cargo array for better inventory management visibility
              const cargoSpace = config.maxCargo - newCargo.reduce((acc, c) => acc + c.quantity, 0);
              const toCargo = Math.min(remainingQty, cargoSpace);
              
              if (toCargo > 0) {
                  const existingIdx = newCargo.findIndex(c => c.id === item.id);
                  if (existingIdx >= 0) { 
                      newCargo[existingIdx] = { ...newCargo[existingIdx], quantity: newCargo[existingIdx].quantity + toCargo }; 
                  } else { 
                      newCargo.push({ instanceId: `buy_${Date.now()}_${item.id}`, type: itemType as any, id: item.id, name: item.name, weight: 1, quantity: toCargo }); 
                  }
                  updatedFit.cargo = newCargo;
                  purchased = true;
                  
                  // Auto-select new ammo type for convenience if ammo bought
                  if (itemType === 'ammo') {
                      updatedFit.selectedAmmo = item.id as AmmoType;
                  }
              }
          }

          if (purchased) {
              // REMOVE FROM MARKET LISTING
              const currentListings = [...(prev.marketListingsByPlanet[dockedId] || [])];
              // Find listing by instanceId if provided, or fallback to first matching ID
              const listingIdx = listingId 
                  ? currentListings.findIndex(l => l.instanceId === listingId)
                  : currentListings.findIndex(l => l.id === item.id);
              
              if (listingIdx >= 0) {
                  const listing = currentListings[listingIdx];
                  if (listing.quantity <= qtyToBuy) {
                      // Depleted: Remove entirely
                      currentListings.splice(listingIdx, 1);
                  } else {
                      // Decrease quantity
                      currentListings[listingIdx] = { ...listing, quantity: listing.quantity - qtyToBuy };
                  }
              }

              audioService.playSfx('buy');
              return { 
                  ...prev, 
                  credits: prev.credits - totalPrice, 
                  shipFittings: { ...prev.shipFittings, [sId]: updatedFit },
                  marketListingsByPlanet: {
                      ...prev.marketListingsByPlanet,
                      [dockedId]: currentListings
                  }
              }; 
          } else {
              audioService.playSfx('denied'); 
              return prev;
          }
      });
  };

  const marketSell = (itemId: string, qtyToSell: number) => { 
      const planet = PLANETS.find(p => p.id === dockedId);
      if (!planet) return;

      setGameState(prev => { 
          const newRes = [...(prev.reserveByPlanet[dockedId] || [])]; 
          const resIdx = newRes.findIndex(r => r.id === itemId);
          
          if (resIdx === -1) return prev;
          
          const item = newRes[resIdx];

          // For selling, we need to find the base price. Since sell items come from Reserve which might not have price info
          // We look up definitions.
          const baseDef = [...WEAPONS, ...SHIELDS, ...EXPLODING_ORDNANCE, ...COMMODITIES, ...EXOTIC_WEAPONS, ...EXOTIC_SHIELDS, ...AMMO_MARKET_ITEMS].find(x => x.id === item.id);
          const basePrice = baseDef?.price || item.price || 1000; 
          
          let multiplier = 0.5; 
          const isHabitable = ['#10b981', '#064e3b', '#60a5fa', '#3b82f6'].includes(planet.color);
          const isBarren = !isHabitable;
          const level = planet.difficulty;

          if (['food', 'water', 'medicine', 'drug'].includes(item.type)) {
              if (isHabitable) multiplier = 0.3; 
              if (isBarren) multiplier = 2.0 + (level * 0.5); 
          }
          else if (['iron','copper','gold','platinum','tungsten','lithium'].includes(item.type)) {
              if (isHabitable) multiplier = 1.5; 
              if (isBarren) multiplier = 0.4; 
          }
          else if (item.type === 'weapon' || item.type === 'shield') {
              if (level > 8) multiplier = 1.2; 
              else multiplier = 0.6;
          }

          const sellPrice = Math.floor(basePrice * multiplier); 
          const totalValue = sellPrice * qtyToSell;

          if (item.quantity > qtyToSell) {
              item.quantity -= qtyToSell;
          } else {
              newRes.splice(resIdx, 1); 
          }
          
          return { ...prev, credits: prev.credits + totalValue, reserveByPlanet: { ...prev.reserveByPlanet, [dockedId]: newRes } }; 
      }); 
      audioService.playSfx('buy'); 
  };

  return (
    <>
      <StarBackground />
      {screen === 'intro' && (
        <div className="relative w-full h-full flex items-center justify-center">
          <StoryScene />
          {/* Main Overlay - Simplified Layout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
            
            {/* Title Block - Static Responsive Sizing */}
            <div className="mb-12 text-center pointer-events-auto">
                <h1 className={`retro-font text-4xl sm:text-6xl md:text-8xl lg:text-9xl text-emerald-500 animate-pulse drop-shadow-[0_0_20px_rgba(16,185,129,0.6)] leading-none text-center flex flex-col items-center`}>
                    GALACTIC
                    <span className={`block mt-2 md:mt-4 text-xl sm:text-3xl md:text-5xl lg:text-6xl text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]`}>FREELANCER</span>
                </h1>
                
            </div>

            {/* Controls - Dynamic UI Sizing based on settings */}
            <div className={`flex flex-col ${uiStyles.spacing} pointer-events-auto ${uiStyles.container}`}>
                {/* 1. START MISSION */}
                <button 
                  onClick={startNewGame}
                  className={`w-full h-14 bg-zinc-900 border-2 border-emerald-500 text-emerald-400 font-black ${uiStyles.btn} tracking-[0.2em] uppercase overflow-hidden hover:bg-emerald-500 hover:text-black transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] flex items-center justify-center`}
                >
                  START MISSION
                </button>

                {/* 2. RESUME MISSION */}
                <button 
                  onClick={resumeGame}
                  className={`w-full h-14 bg-zinc-900 border border-zinc-600 text-zinc-400 font-black ${uiStyles.btn} tracking-[0.15em] uppercase hover:border-emerald-500 hover:text-emerald-400 transition-all duration-300 flex items-center justify-center`}
                >
                  RESUME MISSION
                </button>

                {/* 3. ROW: STORY | OPTIONS */}
                <div className="flex gap-4 w-full">
                    <button 
                      onClick={() => setIsManualOpen(true)}
                      className={`flex-1 h-14 bg-zinc-900 border border-zinc-700 text-zinc-500 font-black ${uiStyles.btn} tracking-[0.1em] uppercase hover:border-zinc-400 hover:text-white transition-all duration-300 flex items-center justify-center`}
                    >
                      STORY
                    </button>

                    <button 
                      onClick={() => setIsOptionsOpen(true)}
                      className={`flex-1 h-14 bg-zinc-900 border border-zinc-700 text-zinc-500 font-black ${uiStyles.btn} tracking-[0.1em] uppercase hover:border-zinc-400 hover:text-white transition-all duration-300 flex items-center justify-center`}
                    >
                      OPTIONS
                    </button>
                </div>
            </div>

            <div className={`mt-12 ${uiStyles.beta} text-zinc-500 font-mono uppercase tracking-[0.4em]`}>Beta 25 - January 2026</div>

          </div>
        </div>
      )}

      {screen === 'hangar' && (
        <CommandCenter 
          gameState={gameState} 
          setGameState={setGameState} 
          dockedPlanetName={PLANETS.find(p => p.id === dockedId)?.name || 'Unknown'} 
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
          setActiveSlotIndex={(i) => { setActiveSlotIndex(i); setGameState(p => ({ ...p, selectedShipInstanceId: p.ownedShips[i].instanceId })); }}
          systemMessage={systemMessage}
        />
      )}

      {screen === 'map' && (
        <SectorMap 
          currentQuadrant={gameState.currentQuadrant} 
          onLaunch={handlePlanetSelection} 
          onBack={() => setScreen('hangar')}
          orbitOffsets={gameState.planetOrbitOffsets}
          universeStartTime={gameState.universeStartTime}
          planetRegistry={gameState.planetRegistry}
          testMode={gameState.settings.testMode}
          onTestLanding={(planet) => {
              setGameState(prev => ({ ...prev, currentPlanet: planet }));
              setScreen('landing');
          }}
        />
      )}

      {screen === 'launch' && gameState.currentPlanet && selectedShipConfig && (
        <LaunchSequence 
          planet={gameState.currentPlanet} 
          shipConfig={selectedShipConfig} 
          shipColors={{ 
              hull: gameState.shipColors[activeShipId], 
              wings: gameState.shipWingColors[activeShipId],
              cockpit: gameState.shipCockpitColors[activeShipId],
              guns: gameState.shipGunColors[activeShipId],
              secondary_guns: gameState.shipSecondaryGunColors[activeShipId],
              gun_body: gameState.shipGunBodyColors[activeShipId],
              engines: gameState.shipEngineColors[activeShipId],
              nozzles: gameState.shipNozzleColors[activeShipId]
          }} 
          onComplete={handleLaunchSequenceComplete} 
          weaponId={activeWeaponId}
          equippedWeapons={gameState.shipFittings[activeShipId].weapons}
          currentFuel={gameState.shipFittings[activeShipId].fuel}
          maxFuel={selectedShipConfig.maxFuel}
        />
      )}

      {screen === 'warp' && selectedShipConfig && (
        <WarpSequence 
            shipConfig={selectedShipConfig} 
            shipColors={{ 
              hull: gameState.shipColors[activeShipId], 
              wings: gameState.shipWingColors[activeShipId],
              cockpit: gameState.shipCockpitColors[activeShipId],
              guns: gameState.shipGunColors[activeShipId],
              gun_body: gameState.shipGunBodyColors[activeShipId],
              engines: gameState.shipEngineColors[activeShipId],
              nozzles: gameState.shipNozzleColors[activeShipId]
            }}
            shieldColor={getActiveShieldColor()} 
            onComplete={handleWarpComplete} 
            weaponId={activeWeaponId}
            equippedWeapons={gameState.shipFittings[activeShipId].weapons}
        />
      )}

      {screen === 'game' && gameState.currentPlanet && (
        <GameEngine 
          ships={[...gameState.ownedShips]
            .sort((a, b) => {
                const selectedId = gameState.selectedShipInstanceId || gameState.ownedShips[0].instanceId;
                if (a.instanceId === selectedId) return -1;
                if (b.instanceId === selectedId) return 1;
                return 0;
            })
            .map(s => {
              const fit = gameState.shipFittings[s.instanceId];
              const conf = SHIPS.find(x => x.id === s.shipTypeId)!;
              return { 
                  config: conf, 
                  fitting: fit, 
                  color: gameState.shipColors[s.instanceId], 
                  wingColor: gameState.shipWingColors[s.instanceId],
                  cockpitColor: gameState.shipCockpitColors[s.instanceId],
                  gunColor: gameState.shipGunColors[s.instanceId],
                  secondaryGunColor: gameState.shipSecondaryGunColors[s.instanceId],
                  gunBodyColor: gameState.shipGunBodyColors[s.instanceId],
                  engineColor: gameState.shipEngineColors[s.instanceId],
                  nozzleColor: gameState.shipNozzleColors[s.instanceId]
              };
          })} 
          shield={selectedFitting?.shieldId === 'dev_god_mode' ? { id: 'dev', capacity: 9999, color: '#fff', name: 'DEV', regenRate: 100, energyCost: 0, visualType: 'full', price: 0 } : (selectedFitting?.shieldId ? [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === selectedFitting.shieldId) || null : null)} 
          secondShield={selectedFitting?.secondShieldId === 'dev_god_mode' ? { id: 'dev', capacity: 9999, color: '#fff', name: 'DEV', regenRate: 100, energyCost: 0, visualType: 'full', price: 0 } : (selectedFitting?.secondShieldId ? [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === selectedFitting.secondShieldId) || null : null)} 
          onGameOver={handleGameOver} 
          difficulty={gameState.currentPlanet.difficulty}
          currentPlanet={gameState.currentPlanet}
          quadrant={gameState.currentQuadrant}
          fontSize={gameState.settings.fontSize || 'medium'}
          mode={gameMode}
          planetRegistry={gameState.planetRegistry}
        />
      )}

      {screen === 'landing' && gameState.currentPlanet && selectedShipConfig && (
          <LandingScene 
              planet={gameState.currentPlanet} 
              shipShape={selectedShipConfig.shape} 
              onComplete={() => { 
                  setScreen('hangar'); 
                  setGameState(p => ({ ...p, dockedPlanetId: p.currentPlanet!.id })); 
                  audioService.playTrack('command'); 
              }} 
              weaponId={activeWeaponId}
              equippedWeapons={gameState.shipFittings[activeShipId].weapons}
              currentFuel={gameState.shipFittings[activeShipId].fuel}
              maxFuel={selectedShipConfig.maxFuel}
          />
      )}

      {/* DIALOGS */}
      <OptionsDialog 
          isOpen={isOptionsOpen} 
          onClose={() => setIsOptionsOpen(false)} 
          gameState={gameState} 
          setGameState={setGameState} 
      />
      <StoreDialog 
          isOpen={isStoreOpen} 
          onClose={() => setIsStoreOpen(false)} 
          inspectedShipId={inspectedShipId} 
          setInspectedShipId={setInspectedShipId} 
          credits={gameState.credits} 
          replaceShip={replaceShip} 
          fontSize={gameState.settings.fontSize || 'medium'}
          testMode={gameState.settings.testMode}
      />
      {selectedFitting && (
          <LoadoutDialog 
              isOpen={isLoadoutOpen} 
              onClose={() => setIsLoadoutOpen(false)} 
              fitting={selectedFitting} 
              shipConfig={selectedShipConfig} 
              loadoutTab={loadoutTab} 
              setLoadoutTab={setLoadoutTab} 
              activeFittingSlot={activeFittingSlot} 
              setActiveFittingSlot={setActiveFittingSlot}
              unmountSlot={(slotIdx, type) => {
                  setGameState(prev => {
                      const sId = prev.selectedShipInstanceId!;
                      const fit = prev.shipFittings[sId];
                      const newCargo = [...fit.cargo];
                      const newFit = { ...fit };
                      
                      if (type === 'weapon') {
                          const w = newFit.weapons[slotIdx];
                          if (w) {
                              newCargo.push({ instanceId: `unmount_${Date.now()}`, type: 'weapon', id: w.id, name: ([...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === w.id)?.name || 'Weapon'), weight: 1, quantity: 1 });
                              newFit.weapons[slotIdx] = null;
                          }
                      } else {
                          const sIdVal = slotIdx === 0 ? newFit.shieldId : newFit.secondShieldId;
                          if (sIdVal) {
                              if (sIdVal !== 'dev_god_mode') {
                                  const sDef = [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === sIdVal);
                                  newCargo.push({ instanceId: `unmount_${Date.now()}`, type: 'shield', id: sIdVal, name: sDef?.name || 'Shield', weight: 1, quantity: 1 });
                              }
                              if (slotIdx === 0) newFit.shieldId = null; else newFit.secondShieldId = null;
                          }
                      }
                      
                      return { ...prev, shipFittings: { ...prev.shipFittings, [sId]: { ...newFit, cargo: newCargo } } };
                  });
                  audioService.playSfx('click');
              }}
              mountFromCargo={(cargoIdx, slotIdx, type) => {
                  setGameState(prev => {
                      const sId = prev.selectedShipInstanceId!;
                      const fit = prev.shipFittings[sId];
                      const newCargo = [...fit.cargo];
                      const item = newCargo[cargoIdx];
                      const newFit = { ...fit };
                      
                      if (type === 'weapon') {
                          const oldW = newFit.weapons[slotIdx];
                          if (oldW) newCargo.push({ instanceId: `swap_${Date.now()}`, type: 'weapon', id: oldW.id, name: ([...WEAPONS, ...EXOTIC_WEAPONS].find(x => x.id === oldW.id)?.name || 'Weapon'), weight: 1, quantity: 1 });
                          newFit.weapons[slotIdx] = { id: item.id!, count: 1 };
                      } else {
                          const oldS = slotIdx === 0 ? newFit.shieldId : newFit.secondShieldId;
                          if (oldS && oldS !== 'dev_god_mode') {
                              const sDef = [...SHIELDS, ...EXOTIC_SHIELDS].find(s => s.id === oldS);
                              newCargo.push({ instanceId: `swap_${Date.now()}`, type: 'shield', id: oldS, name: sDef?.name || 'Shield', weight: 1, quantity: 1 });
                          }
                          if (slotIdx === 0) newFit.shieldId = item.id || null; else newFit.secondShieldId = item.id || null;
                      }
                      
                      if (item.quantity > 1) {
                          newCargo[cargoIdx] = { ...item, quantity: item.quantity - 1 };
                      } else {
                          newCargo.splice(cargoIdx, 1);
                      }
                      
                      return { ...prev, shipFittings: { ...prev.shipFittings, [sId]: { ...newFit, cargo: newCargo } } };
                  });
                  audioService.playSfx('buy');
              }}
              testMode={!!gameState.settings.testMode}
              setGodMode={(slotIdx) => {
                  setGameState(prev => {
                      const sId = prev.selectedShipInstanceId!;
                      const fit = prev.shipFittings[sId];
                      const newFit = { ...fit };
                      if (slotIdx === 0) newFit.shieldId = 'dev_god_mode'; else newFit.secondShieldId = 'dev_god_mode';
                      return { ...prev, shipFittings: { ...prev.shipFittings, [sId]: newFit } };
                  });
                  audioService.playSfx('buy');
              }}
              buyAmmo={() => {}}
              selectAmmo={() => {}}
              fontSize={gameState.settings.fontSize || 'medium'}
          />
      )}
      <PaintDialog 
          isOpen={isPaintOpen} 
          onClose={() => setIsPaintOpen(false)} 
          selectedShipInstanceId={gameState.selectedShipInstanceId || ''} 
          selectedShipConfig={selectedShipConfig} 
          activePart={activePart} 
          setActivePart={setActivePart} 
          gameState={gameState} 
          setPartColor={(c) => {
              const sId = gameState.selectedShipInstanceId!;
              setGameState(p => {
                  const key = activePart === 'hull' ? 'shipColors' : activePart === 'wings' ? 'shipWingColors' : activePart === 'cockpit' ? 'shipCockpitColors' : activePart === 'guns' ? 'shipGunColors' : activePart === 'secondary_guns' ? 'shipSecondaryGunColors' : activePart === 'gun_body' ? 'shipGunBodyColors' : activePart === 'engines' ? 'shipEngineColors' : activePart === 'nozzles' ? 'shipNozzleColors' : 'shipBarColors';
                  return { ...p, [key]: { ...p[key as keyof GameState] as any, [sId]: c } };
              });
          }} 
          updateCustomColor={(idx, c) => setGameState(p => { const n = [...p.customColors]; n[idx] = c; return { ...p, customColors: n }; })} 
          fontSize={gameState.settings.fontSize || 'medium'} 
      />
      <MessagesDialog 
          isOpen={isMessagesOpen} 
          onClose={() => setIsMessagesOpen(false)} 
          messages={gameState.messages} 
          leaderboard={gameState.leaderboard}
          fontSize={gameState.settings.fontSize || 'medium'} 
      />
      {selectedFitting && (
          <CargoDialog 
              isOpen={isCargoOpen} 
              onClose={() => setIsCargoOpen(false)} 
              fitting={selectedFitting} 
              shipConfig={selectedShipConfig} 
              reserves={currentReserves} 
              selectedCargoIdx={selectedCargoIdx} 
              selectedReserveIdx={selectedReserveIdx} 
              setSelectedCargoIdx={setSelectedCargoIdx} 
              setSelectedReserveIdx={setSelectedReserveIdx} 
              onMoveItems={moveItems} 
              onMoveAll={moveAllItems} 
              fontSize={gameState.settings.fontSize || 'medium'}
          />
      )}
      
      <MarketDialog 
        isOpen={isMarketOpen} 
        onClose={() => setIsMarketOpen(false)} 
        marketTab={marketTab} 
        setMarketTab={setMarketTab} 
        currentReserves={currentReserves} 
        credits={gameState.credits} 
        testMode={!!gameState.settings.testMode} 
        marketBuy={marketBuy} 
        marketSell={marketSell} 
        fontSize={gameState.settings.fontSize}
        currentPlanet={dockedPlanet || PLANETS[0]}
        marketListings={gameState.marketListingsByPlanet[dockedId] || []}
        shipFitting={selectedFitting || undefined}
        shipConfig={selectedShipConfig || undefined}
      />
      
      <ManualDialog 
          isOpen={isManualOpen} 
          onClose={() => setIsManualOpen(false)} 
          manualPage={manualPage} 
          setManualPage={setManualPage} 
          fontSize={gameState.settings.fontSize || 'medium'} 
      />
    </>
  );
}
