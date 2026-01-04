
// CHECKPOINT: Defender V84.70
// VERSION: V84.85 - DUAL PANEL LOADOUT
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GameState, Planet, MissionType, ShipConfig, QuadrantType, OwnedShipInstance, WeaponType, ShipFitting, ShipPart, Weapon, Shield, Moon, EquippedWeapon, CargoItem } from './types.ts';
import { INITIAL_CREDITS, SHIPS, ENGINES, REACTORS, WEAPONS, EXOTIC_WEAPONS, ExtendedShipConfig, SHIELDS, PLANETS, EXPLODING_ORDNANCE, DEFENSE_SYSTEMS } from './constants.ts';
import { audioService } from './services/audioService.ts';
import GameEngine from './components/GameEngine.tsx';

const SAVE_KEY = 'galactic_defender_v84_70';
const MAX_FLEET_SIZE = 3;
const REPAIR_COST_PER_PERCENT = 150;
const REFUEL_COST_PER_UNIT = 5000;
const MAX_MISSILES = 50;
const MAX_MINES = 50; 
const DEFAULT_WEAPON_ID = WEAPONS[0].id;
const DEFAULT_SHIP_ID = 'vanguard';

const AVATARS = [
  { label: 'White', icon: '👨🏻' },
  { label: 'Girl', icon: '👩🏼' },
  { label: 'Black Man', icon: '👨🏾' },
  { label: 'Black Girl', icon: '👩🏾' },
  { label: 'Alien', icon: '👽' }
];

const StarBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize); resize();
    const stars = Array.from({ length: 250 }).map(() => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, s: Math.random() * 2, v: 0.1 + Math.random() * 0.4 }));
    let anim: number;
    const loop = () => { ctx.fillStyle = '#010103'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#fff'; stars.forEach(s => { s.y += s.v; if (s.y > canvas.height) s.y = 0; ctx.fillRect(s.x, s.y, s.s, s.s); }); anim = requestAnimationFrame(loop); };
    loop();
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none opacity-60 z-0" />;
};

export const EnginePod = ({ x, y, color = '#334155', nozzleColor = '#171717', showJets = false, activePart, onPartSelect }: { x: number, y: number, color?: string, nozzleColor?: string, showJets?: boolean, activePart?: ShipPart | null, onPartSelect?: (part: ShipPart) => void }) => (
  <g transform={`translate(${x}, ${y})`}>
    <g onClick={(e) => { e.stopPropagation(); onPartSelect?.('engines'); }} className="cursor-pointer"><rect x="-14" y="-18" width="28" height="26" rx="8" fill={color} stroke={activePart === 'engines' ? '#fff' : '#000'} strokeWidth={1} /></g>
    <g onClick={(e) => { e.stopPropagation(); onPartSelect?.('nozzles'); }} className="cursor-pointer"><path d="M-10 8 L-12 22 Q 0 28 12 22 L 10 8 Q 0 11 -10 8" fill={nozzleColor} stroke={activePart === 'nozzles' ? '#fff' : 'transparent'} strokeWidth="1.5" /></g>
    {showJets && (<g><path d="M-18 24 Q 0 150 18 24 Z" fill="#ef4444" opacity="0.7"><animate attributeName="d" values="M-18 24 Q 0 150 18 24 Z; M-18 24 Q 0 200 18 24 Z; M-18 24 Q 0 150 18 24 Z" dur="0.05s" repeatCount="indefinite" /></path></g>)}
  </g>
);

export const ShipGuns = ({ count, gunColor = '#60a5fa', gunBodyColor = '#1c1917', activePart, onPartSelect }: { count: number, gunColor?: string, gunBodyColor?: string, activePart?: ShipPart | null, onPartSelect?: (part: ShipPart) => void }) => {
  const s = count === 1 ? 0.35 : 0.55;
  const renderGun = (x: number, y: number) => (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      <g onClick={(e) => { e.stopPropagation(); onPartSelect?.('guns'); }} className="cursor-pointer"><rect x="-1" y="-18" width="2" height="42" fill={gunColor} stroke={activePart === 'guns' ? '#fff' : 'transparent'} strokeWidth="2" /></g>
      <g onClick={(e) => { e.stopPropagation(); onPartSelect?.('gun_body'); }} className="cursor-pointer"><rect x="-7" y="-5" width="14" height="22" fill={gunBodyColor} rx="1" stroke={activePart === 'gun_body' ? '#fff' : 'rgba(0,0,0,0.5)'} strokeWidth="1" /></g>
      <g onClick={(e) => { e.stopPropagation(); onPartSelect?.('guns'); }} className="cursor-pointer"><rect x="-4" y="-24" width="8" height="20" fill="#334155" rx="1.5" stroke={activePart === 'guns' ? '#fff' : 'transparent'} strokeWidth="1" /><rect x="-1" y="-48" width="2" height="32" fill={gunColor} rx="0.5" /></g>
    </g>
  );
  return <g>{count === 1 ? renderGun(50, 15) : <>{renderGun(25, 45)}{renderGun(75, 45)}</>}</g>;
};

export const ShipIcon = ({ config, hullColor = '#94a3b8', wingColor = '#64748b', cockpitColor = '#38bdf8', gunColor = '#60a5fa', gunBodyColor = '#1c1917', engineColor = '#334155', nozzleColor = '#171717', className = '', showJets = false, activePart = null, onPartSelect = () => {} }: { config: ExtendedShipConfig, hullColor?: string, wingColor?: string, cockpitColor?: string, gunColor?: string, gunBodyColor?: string, engineColor?: string, nozzleColor?: string, className?: string, showJets?: boolean, activePart?: ShipPart | null, onPartSelect?: (part: ShipPart) => void }) => {
  const { wingStyle, engines: engineCount, defaultGuns: gunCount, hullShapeType } = config;
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <g fill={wingColor} stroke={activePart === 'wings' ? '#fff' : 'transparent'} strokeWidth={2} onClick={() => onPartSelect?.('wings')} className="cursor-pointer">
          {wingStyle === 'delta' ? <><path d="M35 40 L4 88 Q 25 96 50 78" /><path d="M65 40 L96 88 Q 75 96 50 78" /></> : <ellipse cx="50" cy="60" rx="45" ry="15" />}
        </g>
        {engineCount === 1 ? <EnginePod x={50} y={82} color={engineColor} nozzleColor={nozzleColor} showJets={showJets} activePart={activePart} onPartSelect={onPartSelect} /> : <><EnginePod x={25} y={75} color={engineColor} nozzleColor={nozzleColor} showJets={showJets} activePart={activePart} onPartSelect={onPartSelect} /><EnginePod x={75} y={75} color={engineColor} nozzleColor={nozzleColor} showJets={showJets} activePart={activePart} onPartSelect={onPartSelect} /></>}
        <path d={hullShapeType === 'triangle' ? "M50 10 L78 90 Q 50 95 22 90 Z" : "M30 15 L70 15 L75 85 Q 50 95 25 85 Z"} fill={hullColor} stroke={activePart === 'hull' ? '#fff' : 'rgba(0,0,0,0.3)'} strokeWidth={2} onClick={() => onPartSelect?.('hull')} className="cursor-pointer" />
        <ShipGuns count={gunCount} gunColor={gunColor} gunBodyColor={gunBodyColor} activePart={activePart} onPartSelect={onPartSelect} />
        <ellipse cx="50" cy={hullShapeType === 'triangle' ? 58 : 38} rx="8" ry="14" fill={cockpitColor} stroke={activePart === 'cockpit' ? '#fff' : 'transparent'} strokeWidth={2} onClick={() => onPartSelect?.('cockpit')} className="cursor-pointer" />
      </svg>
    </div>
  );
};

const App: React.FC = () => {
  const createInitialState = (): GameState => {
    const initialOwned = Array.from({ length: MAX_FLEET_SIZE }).map((_, idx) => ({ instanceId: `fleet_slot_${idx}`, shipTypeId: DEFAULT_SHIP_ID }));
    const initialFittings: Record<string, ShipFitting> = {};
    const initialColors: Record<string, string> = {};
    initialOwned.forEach((os) => { 
      const config = SHIPS.find(s => s.id === os.shipTypeId)!;
      initialFittings[os.instanceId] = { weapons: [{ id: DEFAULT_WEAPON_ID, count: 1 }], shieldId: null, secondShieldId: null, flareId: null, reactorLevel: 1, engineType: 'standard', rocketCount: 0, mineCount: 0, hullPacks: 0, wingWeaponId: null, health: 100, ammoPercent: 100, lives: 1, fuel: config.maxFuel, cargo: [] }; 
      initialColors[os.instanceId] = config.defaultColor || '#94a3b8'; 
    });
    return {
      credits: INITIAL_CREDITS, selectedShipInstanceId: initialOwned[0].instanceId, ownedShips: initialOwned,
      shipFittings: initialFittings, shipColors: initialColors, shipWingColors: {}, shipCockpitColors: {}, shipBeamColors: {}, shipGunColors: {}, shipGunBodyColors: {}, shipEngineColors: {}, shipBarColors: {}, shipNozzleColors: {},
      currentPlanet: null, currentMoon: null, currentMission: null, currentQuadrant: QuadrantType.ALFA, conqueredMoonIds: [], shipMapPosition: { [QuadrantType.ALFA]: { x: 50, y: 50 }, [QuadrantType.BETA]: { x: 50, y: 50 }, [QuadrantType.GAMA]: { x: 50, y: 50 }, [QuadrantType.DELTA]: { x: 50, y: 50 } }, shipRotation: 0, orbitingEntityId: null, orbitAngle: 0, dockedPlanetId: 'p1', tutorialCompleted: false, settings: { musicVolume: 0.3, sfxVolume: 0.5, musicEnabled: true, sfxEnabled: true, displayMode: 'windowed', autosaveEnabled: true }, taskForceShipIds: [], activeTaskForceIndex: 0, pilotName: 'STRATOS', pilotAvatar: '👨🏻', gameInProgress: false, victories: 0, failures: 0, typeColors: {}, reserve: []
    };
  };

  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) try { return { ...createInitialState(), ...JSON.parse(saved) }; } catch(e) { return createInitialState(); }
    return createInitialState();
  });

  const [screen, setScreenState] = useState<'intro' | 'hangar' | 'map' | 'game'>('intro');
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [inspectedShipId, setInspectedShipId] = useState<string>(DEFAULT_SHIP_ID);
  const [isLoadoutOpen, setIsLoadoutOpen] = useState(false);
  const [loadoutSnapshot, setLoadoutSnapshot] = useState<{ credits: number, fitting: ShipFitting } | null>(null);
  const [isPaintOpen, setIsPaintOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isCargoOpen, setIsCargoOpen] = useState(false);
  const [activePart, setActivePart] = useState<ShipPart>('hull');
  const [loadoutTab, setLoadoutTab] = useState<'guns' | 'ordnance' | 'defense'>('guns');
  const [activeSlot, setActiveSlot] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    audioService.updateVolume(gameState.settings.musicVolume);
    audioService.setEnabled(gameState.settings.musicEnabled);
  }, [gameState]);

  const selectedFitting = useMemo(() => gameState.selectedShipInstanceId ? gameState.shipFittings[gameState.selectedShipInstanceId] : null, [gameState]);
  const selectedShipConfig = useMemo(() => { if (!gameState.selectedShipInstanceId) return null; const instance = gameState.ownedShips.find(s => s.instanceId === gameState.selectedShipInstanceId); return instance ? SHIPS.find(s => s.id === instance.shipTypeId) || null : null; }, [gameState]);

  const isStalemate = useMemo(() => {
    if (!selectedFitting) return false;
    return gameState.credits < 5000 && selectedFitting.health <= 0;
  }, [gameState.credits, selectedFitting]);

  const activeShipsForEngine = useMemo(() => {
    if (!gameState.selectedShipInstanceId) return [];
    const sId = gameState.selectedShipInstanceId;
    const inst = gameState.ownedShips.find(os => os.instanceId === sId);
    if (!inst) return [];
    return [{
        config: SHIPS.find(s => s.id === inst.shipTypeId)!,
        fitting: gameState.shipFittings[sId],
        color: gameState.shipColors[sId] || '#94a3b8',
        wingColor: gameState.shipWingColors[sId],
        cockpitColor: gameState.shipCockpitColors[sId],
        gunColor: gameState.shipGunColors[sId] || '#60a5fa',
        gunBodyColor: gameState.shipGunBodyColors[sId],
        engineColor: gameState.shipEngineColors[sId],
        nozzleColor: gameState.shipNozzleColors[sId]
    }];
  }, [gameState.selectedShipInstanceId, gameState.ownedShips, gameState.shipFittings, gameState.shipColors, gameState.shipWingColors, gameState.shipCockpitColors, gameState.shipGunColors, gameState.shipGunBodyColors, gameState.shipEngineColors, gameState.shipNozzleColors]);

  const handleGameOver = useCallback((success: boolean, finalScore: number, wasAborted?: boolean, payload?: { rockets: number, mines: number, weapons: EquippedWeapon[], fuel: number, bossDefeated?: boolean, health: number, hullPacks: number, cargo: CargoItem[] }) => {
    setGameState(prev => {
      const sId = prev.selectedShipInstanceId; if (!sId) return prev;
      const fit = prev.shipFittings[sId];
      const newFits = { ...prev.shipFittings };
      const totalReward = finalScore * (payload?.bossDefeated ? 2 : 1);

      const nextHealth = payload?.health !== undefined ? payload.health : fit.health;
      const nextFuel = payload?.fuel !== undefined ? payload.fuel : fit.fuel;
      const nextHullPacks = payload?.hullPacks !== undefined ? payload.hullPacks : fit.hullPacks;

      // Merge mission cargo into ship cargo with stacking
      let currentShipCargo = [...fit.cargo];
      if (payload?.cargo) {
          payload.cargo.forEach(newItem => {
              const existing = currentShipCargo.find(item => item.type === newItem.type && item.id === newItem.id);
              if (existing) existing.quantity += newItem.quantity;
              else currentShipCargo.push({...newItem});
          });
      }

      newFits[sId] = { 
          ...fit, 
          health: nextHealth, 
          fuel: nextFuel, 
          rocketCount: payload?.rockets ?? fit.rocketCount, 
          mineCount: payload?.mines ?? fit.mineCount, 
          hullPacks: nextHullPacks,
          weapons: payload?.weapons || fit.weapons,
          cargo: currentShipCargo
      };

      return { ...prev, credits: prev.credits + totalReward, victories: prev.victories + (success ? 1 : 0), failures: prev.failures + (!success && !wasAborted ? 1 : 0), shipFittings: newFits };
    });
    setScreenState('hangar'); audioService.stop(); audioService.playTrack('command');
  }, []);

  const cargoToReserve = (itemIdx: number) => {
    const sId = gameState.selectedShipInstanceId; if (!sId) return;
    const fit = gameState.shipFittings[sId];
    const item = fit.cargo[itemIdx];
    
    setGameState(p => {
        let newReserve = [...p.reserve];
        const existing = newReserve.find(r => r.type === item.type && r.id === item.id);
        if (existing) existing.quantity += item.quantity;
        else newReserve.push({...item});

        const newCargo = [...fit.cargo]; newCargo.splice(itemIdx, 1);
        return { ...p, reserve: newReserve, shipFittings: { ...p.shipFittings, [sId]: { ...fit, cargo: newCargo } } };
    });
    audioService.playSfx('click');
  };

  const reserveToCargo = (itemIdx: number) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedShipConfig) return;
    const fit = gameState.shipFittings[sId];
    const item = gameState.reserve[itemIdx];

    setGameState(p => {
        const existingInCargo = fit.cargo.find(c => c.type === item.type && c.id === item.id);
        const totalUniqueItems = existingInCargo ? fit.cargo.length : fit.cargo.length + 1;
        if (totalUniqueItems > selectedShipConfig.maxCargo) { audioService.playSfx('denied'); return p; }

        let newCargo = [...fit.cargo];
        if (existingInCargo) existingInCargo.quantity += item.quantity;
        else newCargo.push({...item});

        const newReserve = [...gameState.reserve]; newReserve.splice(itemIdx, 1);
        audioService.playSfx('click');
        return { ...p, reserve: newReserve, shipFittings: { ...p.shipFittings, [sId]: { ...fit, cargo: newCargo } } };
    });
  };

  const sellItem = (from: 'cargo' | 'reserve', idx: number) => {
    const sId = gameState.selectedShipInstanceId;
    let list = from === 'cargo' && sId ? [...gameState.shipFittings[sId].cargo] : [...gameState.reserve];
    const item = list[idx];
    const value = 1000 * item.quantity;
    list.splice(idx, 1);
    setGameState(p => ({
        ...p,
        credits: p.credits + value,
        reserve: from === 'reserve' ? list : p.reserve,
        shipFittings: from === 'cargo' && sId ? { ...p.shipFittings, [sId]: { ...p.shipFittings[sId], cargo: list } } : p.shipFittings
    }));
    audioService.playSfx('buy');
  };

  const useCargoItem = (from: 'cargo' | 'reserve', idx: number) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedShipConfig) return;
    const fit = gameState.shipFittings[sId];
    let list = from === 'cargo' ? [...fit.cargo] : [...gameState.reserve];
    const item = list[idx];
    
    // Decrement or remove
    if (item.quantity > 1) item.quantity--;
    else list.splice(idx, 1);

    const update = (changes: Partial<ShipFitting>) => {
        setGameState(p => ({
            ...p,
            reserve: from === 'reserve' ? list : p.reserve,
            shipFittings: { ...p.shipFittings, [sId]: { ...p.shipFittings[sId], ...changes, cargo: from === 'cargo' ? list : p.shipFittings[sId].cargo } }
        }));
        audioService.playSfx('buy');
    };

    if (item.type === 'fuel') update({ fuel: Math.min(selectedShipConfig.maxFuel, fit.fuel + 1.5) });
    else if (item.type === 'repair') update({ health: Math.min(100, fit.health + 20) });
    else if (item.type === 'missile') update({ rocketCount: Math.min(MAX_MISSILES, fit.rocketCount + 10) });
    else if (item.type === 'mine') update({ mineCount: Math.min(MAX_MINES, fit.mineCount + 10) });
    else if (item.type === 'weapon' && item.id) {
        const newWeps = [...fit.weapons]; newWeps[0] = { id: item.id, count: 1 };
        update({ weapons: newWeps });
    } else {
        // Just consume if not a functional item (e.g. materials)
        setGameState(p => ({
            ...p,
            reserve: from === 'reserve' ? list : p.reserve,
            shipFittings: { ...p.shipFittings, [sId]: { ...p.shipFittings[sId], cargo: from === 'cargo' ? list : p.shipFittings[sId].cargo } }
        }));
    }
  };

  const refuelSelected = () => {
    const sId = gameState.selectedShipInstanceId;
    if (!selectedFitting || !sId || !selectedShipConfig || selectedFitting.health <= 0 || selectedFitting.fuel >= selectedShipConfig.maxFuel) { 
        audioService.playSfx('denied'); 
        return; 
    }

    // PRIORITY 1: Cargo Hold Fuel
    const fuelIdxCargo = selectedFitting.cargo.findIndex(i => i.type === 'fuel');
    if (fuelIdxCargo !== -1) {
        useCargoItem('cargo', fuelIdxCargo);
        return;
    }

    // PRIORITY 2: Fleet Reserve Fuel
    const fuelIdxReserve = gameState.reserve.findIndex(i => i.type === 'fuel');
    if (fuelIdxReserve !== -1) {
        useCargoItem('reserve', fuelIdxReserve);
        return;
    }

    // PRIORITY 3: Credits
    if (gameState.credits < REFUEL_COST_PER_UNIT) { audioService.playSfx('denied'); return; }
    const max = selectedShipConfig.maxFuel;
    const nextAmount = Math.min(max, selectedFitting.fuel + 1.0);
    setGameState(p => ({ 
        ...p, 
        credits: p.credits - REFUEL_COST_PER_UNIT, 
        shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, fuel: nextAmount } } 
    }));
    audioService.playSfx('buy');
  };

  const repairSelected = () => {
    const sId = gameState.selectedShipInstanceId;
    if (!selectedFitting || !sId || selectedFitting.health >= 100 || selectedFitting.health <= 0) { 
        audioService.playSfx('denied'); 
        return; 
    }

    // PRIORITY 1: Cargo Hold Kits
    const kitIdxCargo = selectedFitting.cargo.findIndex(i => i.type === 'repair');
    if (kitIdxCargo !== -1) {
        useCargoItem('cargo', kitIdxCargo);
        return;
    }

    // PRIORITY 2: Fleet Reserve Kits
    const kitIdxReserve = gameState.reserve.findIndex(i => i.type === 'repair');
    if (kitIdxReserve !== -1) {
        useCargoItem('reserve', kitIdxReserve);
        return;
    }

    // PRIORITY 3: Shipyard Credits
    if (gameState.credits <= 0) { audioService.playSfx('denied'); return; }
    const neededPercent = 100 - selectedFitting.health, fullCost = Math.floor(neededPercent * REPAIR_COST_PER_PERCENT);
    if (gameState.credits >= fullCost) {
        setGameState(p => ({ 
            ...p, 
            credits: p.credits - fullCost, 
            shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, health: 100 } } 
        }));
    } else { 
        const added = gameState.credits / REPAIR_COST_PER_PERCENT; 
        setGameState(p => ({ 
            ...p, 
            credits: 0, 
            shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, health: Math.min(100, selectedFitting.health + added) } } 
        })); 
    }
    audioService.playSfx('buy');
  };

  const openLoadout = () => {
    if (!selectedFitting) return;
    setLoadoutSnapshot({ credits: gameState.credits, fitting: JSON.parse(JSON.stringify(selectedFitting)) });
    setIsLoadoutOpen(true);
  };

  const acceptLoadout = () => {
    setLoadoutSnapshot(null);
    setIsLoadoutOpen(false);
    audioService.playSfx('click');
  };

  const cancelLoadout = () => {
    if (loadoutSnapshot && gameState.selectedShipInstanceId) {
        setGameState(p => ({
            ...p,
            credits: loadoutSnapshot.credits,
            shipFittings: { ...p.shipFittings, [p.selectedShipInstanceId!]: loadoutSnapshot.fitting }
        }));
    }
    setLoadoutSnapshot(null);
    setIsLoadoutOpen(false);
    audioService.playSfx('click');
  };

  const setPartColor = (color: string) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || (selectedFitting && selectedFitting.health <= 0)) return;
    const fieldMap: Record<ShipPart, keyof GameState> = { hull: 'shipColors', wings: 'shipWingColors', cockpit: 'shipCockpitColors', guns: 'shipGunColors', gun_body: 'shipGunBodyColors', engines: 'shipEngineColors', nozzles: 'shipNozzleColors', bars: 'shipBarColors' };
    const field = fieldMap[activePart]; if (!field) return;
    setGameState(p => ({ ...p, [field]: { ...(p[field] as any), [sId]: color } }));
    audioService.playSfx('click');
  };

  const mountWeaponToSlot = (w: Weapon, slotIdx: number) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedFitting || selectedFitting.health <= 0) return;
    const current = selectedFitting.weapons[slotIdx];
    let refund = 0; if (current) { const oldW = [...WEAPONS, ...EXOTIC_WEAPONS].find(xw => xw.id === current.id); if (oldW) refund = oldW.price; }
    if (gameState.credits < (w.price - refund)) { audioService.playSfx('denied'); return; }
    setGameState(p => { const newWeps = [...selectedFitting.weapons]; newWeps[slotIdx] = { id: w.id, count: 1 }; return { ...p, credits: p.credits - (w.price - refund), shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, weapons: newWeps } } }; });
    audioService.playSfx('buy');
  };

  const removeWeaponFromSlot = (slotIdx: number) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedFitting || selectedFitting.health <= 0) return;
    const current = selectedFitting.weapons[slotIdx]; if (!current) return;
    const oldW = [...WEAPONS, ...EXOTIC_WEAPONS].find(xw => xw.id === current.id);
    setGameState(p => { const newWeps = [...selectedFitting.weapons]; newWeps[slotIdx] = undefined as any; return { ...p, credits: p.credits + (oldW ? oldW.price : 0), shipFittings: { ...p.shipFittings, [sId]: { ...p.shipFittings[sId], weapons: newWeps.filter(Boolean) } } }; });
    audioService.playSfx('click');
  };

  const buyAmmo = (type: 'missile' | 'mine') => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedFitting || selectedFitting.health <= 0) return;
    const price = type === 'missile' ? 8000 : 12000, max = type === 'missile' ? MAX_MISSILES : MAX_MINES, current = type === 'missile' ? selectedFitting.rocketCount : selectedFitting.mineCount;
    if (current >= max || gameState.credits < price) { audioService.playSfx('denied'); return; }
    setGameState(p => ({ ...p, credits: p.credits - price, shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, [type === 'missile' ? 'rocketCount' : 'mineCount']: Math.min(max, current + 10) } } }));
    audioService.playSfx('buy');
  };

  const equipShield = (s: Shield, slot: 1 | 2) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedFitting || selectedFitting.health <= 0) return;
    const field = slot === 1 ? 'shieldId' : 'secondShieldId', oldId = selectedFitting[field];
    let refund = 0; if (oldId) { const old = SHIELDS.find(x => x.id === oldId); if (old) refund = old.price; }
    if (gameState.credits < (s.price - refund)) { audioService.playSfx('denied'); return; }
    setGameState(p => ({ ...p, credits: p.credits - (s.price - refund), shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, [field]: s.id } } }));
    audioService.playSfx('buy');
  };

  const removeShield = (slot: 1 | 2) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedFitting || selectedFitting.health <= 0) return;
    const field = slot === 1 ? 'shieldId' : 'secondShieldId', oldId = selectedFitting[field]; if (!oldId) return;
    const old = SHIELDS.find(x => x.id === oldId);
    setGameState(p => ({ ...p, credits: p.credits + (old ? old.price : 0), shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, [field]: null } } }));
    audioService.playSfx('click');
  };

  const replaceShip = (shipTypeId: string) => {
    const tId = gameState.selectedShipInstanceId; if (!tId) return;
    const nS = SHIPS.find(s => s.id === shipTypeId)!;
    if (gameState.credits < nS.price) { audioService.playSfx('denied'); return; }
    setGameState(p => ({ 
      ...p, 
      credits: p.credits - nS.price, 
      ownedShips: p.ownedShips.map(s => s.instanceId === tId ? { ...s, shipTypeId } : s), 
      shipFittings: { 
        ...p.shipFittings, 
        [tId]: { ...p.shipFittings[tId], health: 100, fuel: nS.maxFuel, weapons: [{ id: DEFAULT_WEAPON_ID, count: 1 }], shieldId: null, secondShieldId: null } 
      }, 
      shipColors: { ...p.shipColors, [tId]: nS.defaultColor || '#94a3b8' } 
    }));
    audioService.playSfx('buy'); setIsStoreOpen(false);
  };

  const restartGame = () => { setGameState(createInitialState()); setIsGameOver(false); setScreenState('intro'); };
  const hasHistory = useMemo(() => gameState.credits !== INITIAL_CREDITS || gameState.victories > 0 || gameState.failures > 0 || gameState.conqueredMoonIds.length > 0, [gameState]);

  return (
    <div className="w-full h-full bg-[#0c0a09] text-zinc-100 flex flex-col overflow-hidden relative">
      <StarBackground />
      <div className="fixed inset-0 z-[10000] bg-black flex landscape:hidden flex-col items-center justify-center p-10 text-center gap-10">
         <StarBackground />
         <h1 className="retro-font text-2xl text-emerald-500 uppercase tracking-widest z-10">GALACTIC DEFENDER</h1>
         <div className="w-[90vw] md:w-[600px] h-[30vh] overflow-hidden opacity-80 z-10"><div className="animate-marquee-vertical flex flex-col gap-10"><p className="retro-font text-[10px] text-yellow-400 leading-relaxed uppercase">Humanity has colonized the void. Tactical defense is our only survival. Secure the sectors. Hold the line, Pilot.</p></div></div>
         <div className="flex flex-col items-center gap-6 z-20"><div className="text-4xl animate-bounce">🔄</div><p className="retro-font text-[12px] text-emerald-500 animate-pulse uppercase leading-loose">PLEASE ROTATE YOUR DEVICE<br/>TO PLAY THE GAME</p></div>
      </div>

      {screen === 'intro' && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 gap-8 z-10 text-center relative overflow-hidden">
          <div className="absolute top-10 w-[90vw] md:w-[600px] h-[35vh] md:h-[300px] pointer-events-none opacity-50 z-0"><div className="animate-marquee-vertical flex flex-col gap-10"><p className="retro-font text-[10px] text-yellow-400 leading-relaxed uppercase">The galaxy is a dark ocean. After centuries of expansion, humanity reached the far quadrants of Alpha and Delta. But we were not alone. From the rifts, the Xenos Swarm arrived. Every colony planet is a fortress. Every pilot is a guardian. Defend the sectors. Hold the line.</p></div></div>
          <h1 className="retro-font text-3xl md:text-5xl text-emerald-500 uppercase tracking-widest z-20 px-4 mt-20">GALACTIC DEFENDER</h1>
          <div className="flex flex-col gap-4 z-20">
            <button onClick={() => setScreenState('hangar')} className="py-5 px-16 border-2 border-emerald-500 text-xs font-black uppercase tracking-widest hover:bg-emerald-500/10 transition-all">
               {hasHistory ? 'RESUME MISSION' : 'COMMENCE MISSION'}
            </button>
            <div className="flex gap-4">
               <button onClick={() => setShowManual(true)} className="flex-grow py-3 px-6 bg-zinc-950/80 border border-zinc-700 text-[10px] uppercase font-black hover:bg-zinc-800 transition-colors">MANUAL</button>
               <button onClick={() => setIsOptionsOpen(true)} className="flex-grow py-3 px-6 bg-zinc-950/80 border border-zinc-700 text-[10px] uppercase font-black hover:bg-zinc-800 transition-colors">OPTIONS</button>
            </div>
          </div>
          {showManual && (<div className="fixed inset-0 z-[9000] bg-black/95 flex items-center justify-center p-10 backdrop-blur-md" onClick={() => setShowManual(false)}><div className="max-w-xl bg-zinc-950 border border-emerald-500/40 p-10 rounded-xl space-y-6" onClick={e => e.stopPropagation()}><h3 className="retro-font text-emerald-500 text-lg uppercase">Flight Manual</h3><div className="space-y-4 text-[12px] uppercase text-zinc-400"><p>• [WASD / ARROWS] TO MANEUVER SHIP</p><p>• [SPACE] TO FIRE PRIMARY CANNONS</p><p>• [TAB] TO LAUNCH TRACKING MISSILES</p><p>• [CAPS LOCK] TO DEPLOY KINETIC SHOCK MINES</p><p>• [ESC] TO ABORT MISSION</p></div><button onClick={() => setShowManual(false)} className="w-full py-4 bg-emerald-600/20 border border-emerald-500 text-emerald-500 font-black uppercase text-[10px]">ACKNOWLEDGED</button></div></div>)}
        </div>
      )}

      {isOptionsOpen && (
        <div className="fixed inset-0 z-[9500] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
           <div className="w-full max-w-xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-2xl">
              <header className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                 <h2 className="retro-font text-emerald-400 text-[10px] uppercase">Strategic Systems Config</h2>
                 <button onClick={() => setIsOptionsOpen(false)} className="text-zinc-500 hover:text-white text-[9px] uppercase font-black">EXIT</button>
              </header>
              <div className="p-4 space-y-4">
                 <div className="space-y-3">
                    <label className="text-[9px] uppercase font-black text-zinc-500 tracking-widest">Audio Protocols</label>
                    <div className="space-y-4 bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/50">
                       <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-end">
                             <span className="text-[10px] font-black uppercase text-zinc-300">Tactical FX</span>
                             <span className="text-[9px] font-black text-emerald-400">{Math.round(gameState.settings.sfxVolume * 100)}%</span>
                          </div>
                          <input type="range" min="0" max="1" step="0.05" value={gameState.settings.sfxVolume} onChange={e => setGameState(p => ({ ...p, settings: { ...p.settings, sfxVolume: parseFloat(e.target.value) } }))} className="w-full accent-emerald-500 bg-zinc-800 h-1 rounded-full appearance-none cursor-pointer" />
                       </div>
                       <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] font-black uppercase text-zinc-300">Music Link</span>
                          <button onClick={() => setGameState(p => ({ ...p, settings: { ...p.settings, musicEnabled: !p.settings.musicEnabled } }))} className={`px-6 py-1.5 text-[8px] font-black uppercase rounded border transition-all ${gameState.settings.musicEnabled ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500' : 'bg-zinc-900 border-zinc-700 text-zinc-600'}`}>
                             {gameState.settings.musicEnabled ? 'ACTIVE' : 'OFFLINE'}
                          </button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isCargoOpen && gameState.selectedShipInstanceId && selectedShipConfig && (
        <div className="fixed inset-0 z-[9000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl">
           <div className="w-full max-w-6xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[85vh] shadow-2xl">
              <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                 <div className="flex items-center gap-8">
                    <h2 className="retro-font text-emerald-500 text-xs uppercase">Cargo & Logistics Hub</h2>
                    <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center gap-3">
                       <span className="text-[11px] font-black text-emerald-400 tabular-nums">${Math.floor(gameState.credits).toLocaleString()}</span>
                    </div>
                 </div>
                 <button onClick={() => setIsCargoOpen(false)} className="px-8 py-2 bg-emerald-600/10 border border-emerald-500 text-emerald-500 uppercase font-black text-[10px] hover:bg-emerald-600 hover:text-white transition-all rounded">CLOSE TERMINAL</button>
              </header>
              <div className="flex-grow flex overflow-hidden">
                 <div className="w-1/2 p-6 flex flex-col gap-4 border-r border-zinc-800">
                    <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded border border-zinc-800">
                        <div className="flex flex-col"><span className="text-[8px] uppercase font-black text-zinc-500">SHIP HOLD: {selectedShipConfig.name}</span><span className="text-[10px] font-black text-white">{selectedFitting?.cargo.length} / {selectedShipConfig.maxCargo} UNIQUE SLOTS</span></div>
                        <div className="flex gap-2"><div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(selectedFitting?.cargo.length! / selectedShipConfig.maxCargo) * 100}%` }} /></div></div>
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pr-2">
                       {selectedFitting?.cargo.map((item, i) => (
                          <div key={item.instanceId} className="flex justify-between items-center p-3 bg-zinc-900/30 border border-zinc-800 hover:border-emerald-500/30 transition-colors group">
                             <div className="flex items-center gap-4">
                                <div className="w-8 h-8 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded text-[10px] font-black text-emerald-400">{item.type.charAt(0).toUpperCase()}</div>
                                <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-white">{item.name} x {item.quantity}</span><span className="text-[7px] font-black text-zinc-500">QUANTITY STORED</span></div>
                             </div>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => useCargoItem('cargo', i)} className="px-3 py-1 bg-blue-600 text-white text-[8px] font-black uppercase rounded">USE</button>
                                <button onClick={() => cargoToReserve(i)} className="px-3 py-1 bg-zinc-700 text-white text-[8px] font-black uppercase rounded">RESERVE</button>
                                <button onClick={() => sellItem('cargo', i)} className="px-3 py-1 bg-emerald-600 text-white text-[8px] font-black uppercase rounded">SELL ALL</button>
                             </div>
                          </div>
                       ))}
                       {selectedFitting?.cargo.length === 0 && <div className="h-full flex items-center justify-center text-[9px] uppercase font-black text-zinc-600 italic">No inventory detected in ship hold.</div>}
                    </div>
                 </div>
                 <div className="w-1/2 p-6 flex flex-col gap-4 bg-black/40">
                    <div className="flex flex-col bg-zinc-900/50 p-4 rounded border border-zinc-800">
                        <span className="text-[8px] uppercase font-black text-zinc-500">FLEET GLOBAL RESERVE</span>
                        <span className="text-[10px] font-black text-emerald-400">UNLIMITED CAPACITY STORAGE</span>
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pr-2">
                       {gameState.reserve.map((item, i) => (
                          <div key={item.instanceId} className="flex justify-between items-center p-3 bg-zinc-900/30 border border-zinc-800 hover:border-emerald-500/30 transition-colors group">
                             <div className="flex items-center gap-4">
                                <div className="w-8 h-8 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded text-[10px] font-black text-amber-400">{item.type.charAt(0).toUpperCase()}</div>
                                <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-white">{item.name} x {item.quantity}</span><span className="text-[7px] font-black text-zinc-500">SECURE STORAGE</span></div>
                             </div>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => reserveToCargo(i)} className="px-3 py-1 bg-emerald-600 text-white text-[8px] font-black uppercase rounded">TO SHIP</button>
                                <button onClick={() => useCargoItem('reserve', i)} className="px-3 py-1 bg-blue-600 text-white text-[8px] font-black uppercase rounded">CONSUME</button>
                                <button onClick={() => sellItem('reserve', i)} className="px-3 py-1 bg-red-600 text-white text-[8px] font-black uppercase rounded">LIQUIDATE</button>
                             </div>
                          </div>
                       ))}
                       {gameState.reserve.length === 0 && <div className="h-full flex items-center justify-center text-[9px] uppercase font-black text-zinc-600 italic">Fleet reserve is empty. Secure mission loot to populate storage.</div>}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {screen === 'hangar' && (
        <div className="flex-grow flex flex-col p-6 space-y-4 z-10 overflow-hidden">
          <div className="flex-grow flex gap-4 overflow-hidden">
            {gameState.ownedShips.map((instance, idx) => {
              const f = gameState.shipFittings[instance.instanceId];
              const isSelected = gameState.selectedShipInstanceId === instance.instanceId;
              const config = SHIPS.find(s => s.id === instance.shipTypeId)!;
              const priS = f.shieldId ? SHIELDS.find(x => x.id === f.shieldId) : null;
              const secS = f.secondShieldId ? SHIELDS.find(x => x.id === f.secondShieldId) : null;
              return (
                <div key={idx} onClick={() => setGameState(p => ({ ...p, selectedShipInstanceId: instance.instanceId }))} className={`flex-1 border-2 p-4 flex flex-col items-center rounded-xl transition-all cursor-pointer relative ${isSelected ? 'border-emerald-500 bg-emerald-950/20 shadow-xl' : 'border-zinc-800 bg-zinc-950/40 opacity-70 hover:opacity-100'}`}>
                  <div className="w-full flex justify-between items-center mb-2 shrink-0"><span className="retro-font text-[8px] text-emerald-500 uppercase truncate pr-2">{config.name}</span><span className="text-[7px] uppercase text-zinc-500">Slot {idx + 1}</span></div>
                  
                  {/* Container for responsive ship icon with shield HUD overlays - Centered vertically between top and bottom stats */}
                  <div className="flex-grow w-full flex items-center justify-center relative overflow-visible min-h-0">
                     <div className="relative z-10">
                        <ShipIcon 
                           config={config as any} 
                           hullColor={gameState.shipColors[instance.instanceId]} 
                           wingColor={gameState.shipWingColors[instance.instanceId]} 
                           cockpitColor={gameState.shipCockpitColors[instance.instanceId]} 
                           gunColor={gameState.shipGunColors[instance.instanceId]} 
                           gunBodyColor={gameState.shipGunBodyColors[instance.instanceId]} 
                           engineColor={gameState.shipEngineColors[instance.instanceId]} 
                           nozzleColor={gameState.shipNozzleColors[instance.instanceId]} 
                           className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 transition-all" 
                        />
                        {/* pulsing holographic shield indicators matching equipped shield colors */}
                        {priS && <div className="absolute inset-0 border-2 rounded-full scale-[1.2] animate-pulse opacity-40 pointer-events-none" style={{ borderColor: priS.color, boxShadow: `0 0 10px ${priS.color}` }} />}
                        {secS && <div className="absolute inset-0 border-[1.5px] rounded-full scale-[1.35] opacity-25 pointer-events-none" style={{ borderColor: secS.color }} />}
                     </div>
                  </div>

                  <div className="w-full mt-auto space-y-1.5 shrink-0">
                    <div className="space-y-1"><div className="flex justify-between text-[7px] uppercase font-black"><span>Hull</span><span className={f.health <= 0 ? "text-red-500" : ""}>{f.health <= 0 ? "TOTALED" : `${Math.floor(f.health)}%`}</span></div><div className="h-1 bg-zinc-900 rounded-full overflow-hidden"><div className={`h-full ${f.health <= 0 ? 'bg-red-600' : 'bg-emerald-500'}`} style={{ width: `${f.health}%` }} /></div></div>
                    <div className="space-y-1"><div className="flex justify-between text-[7px] uppercase font-black"><span>Fuel</span><span>{f.fuel.toFixed(1)}U</span></div><div className="h-1 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${(f.fuel/config.maxFuel)*100}%` }} /></div></div>
                    
                    <div className="flex flex-col gap-0.5 border-t border-zinc-800/40 pt-1">
                       <div className="flex justify-between text-[6px] uppercase font-black text-zinc-500"><span>Defenses</span><span className={priS ? "text-emerald-400" : "text-zinc-700"}>{priS ? 'ACTIVE' : 'OFFLINE'}</span></div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <button onClick={(e) => { e.stopPropagation(); setIsStoreOpen(true); }} className="py-1 bg-zinc-900 text-[8px] uppercase font-black rounded hover:bg-zinc-800 border border-zinc-800">SHIPYARD</button>
                      <button onClick={(e) => { e.stopPropagation(); openLoadout(); }} disabled={f.health <= 0} className="py-1 bg-zinc-900 text-[8px] uppercase font-black rounded hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30">LOADOUT</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <footer className="bg-zinc-950/90 p-3 sm:p-4 rounded-xl border-2 border-zinc-800 flex justify-between items-center backdrop-blur-md shadow-2xl shrink-0 overflow-hidden">
            <div onClick={() => setScreenState('intro')} className="flex items-center gap-2 sm:gap-3 bg-zinc-900/60 p-1 pr-2 sm:pr-4 rounded-lg border border-zinc-800 group hover:border-emerald-500/30 transition-colors cursor-pointer shrink-0">
               <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xl sm:text-2xl bg-zinc-950 rounded border border-zinc-700 group-hover:border-emerald-500/50 transition-colors">{gameState.pilotAvatar}</div>
               <div className="hidden sm:flex flex-col"><span className="text-[6px] uppercase font-black text-zinc-500">Pilot</span><span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">{gameState.pilotName}</span></div>
            </div>
            
            {/* Centered Budget Display */}
            <div className="flex flex-col gap-0.5 items-center justify-center flex-1 px-1 min-w-0"><span className="retro-font text-[5px] sm:text-[6px] text-emerald-500 uppercase">BUDGET</span><span className="text-emerald-400 font-black text-[10px] sm:text-[14px] tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">${Math.floor(gameState.credits).toLocaleString()}</span></div>
            
            <div className="flex gap-0.5 sm:gap-1.5 shrink-0 overflow-visible items-center">
               <button onClick={() => setIsCargoOpen(true)} className="px-1.5 py-2.5 sm:px-4 sm:py-3 bg-emerald-950/30 border border-emerald-500/40 text-[7px] sm:text-[9px] uppercase font-black text-emerald-400 hover:bg-emerald-500/20 transition-all rounded shadow-sm">CARGO</button>
               <button onClick={repairSelected} disabled={!selectedFitting || selectedFitting.health >= 100 || selectedFitting.health <= 0} className="px-1.5 py-2.5 sm:px-4 sm:py-3 bg-zinc-900 border border-zinc-700 text-[7px] sm:text-[9px] uppercase font-black hover:bg-zinc-800 disabled:opacity-30 transition-all rounded shadow-sm">REPAIR</button>
               <button onClick={refuelSelected} disabled={!selectedFitting || !selectedShipConfig || selectedFitting.health <= 0 || selectedFitting.fuel >= selectedShipConfig.maxFuel} className="px-1.5 py-2.5 sm:px-4 sm:py-3 bg-zinc-900 border border-zinc-700 text-[7px] sm:text-[9px] uppercase font-black hover:bg-zinc-800 disabled:opacity-30 transition-all rounded shadow-sm">REFUEL</button>
               <button onClick={() => setIsPaintOpen(true)} disabled={!gameState.selectedShipInstanceId || (selectedFitting && selectedFitting.health <= 0)} className="px-1.5 py-2.5 sm:px-4 sm:py-3 bg-zinc-900 border border-zinc-700 text-[7px] sm:text-[9px] uppercase font-black hover:bg-zinc-800 transition-all rounded shadow-sm">PAINT</button>
               
               {isStalemate ? (
                 <button onClick={restartGame} className="px-2 py-2.5 sm:px-6 sm:py-3 bg-red-600 border border-red-400 text-white text-[7px] sm:text-[9px] font-black uppercase tracking-widest shadow-lg rounded-md animate-pulse">REBOOT</button>
               ) : (
                 <button onClick={() => setScreenState('map')} disabled={!selectedFitting || selectedFitting.fuel <= 0 || selectedFitting.health <= 0 || selectedFitting.weapons.length === 0} className="px-2 py-2.5 sm:px-6 sm:py-3 bg-emerald-600 border-2 border-emerald-400 text-white text-[7px] sm:text-[9px] font-black uppercase tracking-widest shadow-lg rounded-md disabled:opacity-30 w-auto">LANCH</button>
               )}
            </div>
          </footer>
        </div>
      )}

      {isPaintOpen && gameState.selectedShipInstanceId && selectedShipConfig && (
        <div className="fixed inset-0 z-[9950] bg-black/95 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md">
           <div className="w-full max-w-5xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[90vh] sm:h-[85vh] shadow-2xl">
              <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50"><div className="flex gap-4 sm:gap-8"><h2 className="retro-font text-emerald-500 text-xs uppercase">Paint System</h2><div className="hidden sm:flex gap-4">{['hull', 'wings', 'cockpit', 'guns', 'gun_body', 'engines', 'nozzles'].map(p => (<button key={p} onClick={() => setActivePart(p as any)} className={`text-[9px] uppercase font-black transition-all ${activePart === p ? 'text-emerald-400 underline decoration-2 underline-offset-4' : 'text-zinc-500 hover:text-white'}`}>{p.replace('_', ' ')}</button>))}</div></div><button onClick={() => setIsPaintOpen(false)} className="px-4 py-2 text-red-500 uppercase font-black text-[9px] hover:bg-red-500/10">CLOSE</button></header>
              <div className="flex-grow flex flex-col sm:flex-row overflow-hidden">
                 <div className="flex-grow p-4 sm:p-12 flex flex-col items-center justify-center relative bg-black/40 border-b sm:border-b-0 sm:border-r border-zinc-900"><div className="absolute top-4 left-4 text-[7px] sm:text-[8px] text-emerald-500/40 uppercase tracking-widest font-black">INTERACTIVE PREVIEW</div><ShipIcon config={selectedShipConfig} className="w-48 h-48 sm:w-96 sm:h-96 drop-shadow-[0_0_80px_rgba(16,185,129,0.1)]" activePart={activePart} onPartSelect={(p) => setActivePart(p)} hullColor={gameState.shipColors[gameState.selectedShipInstanceId]} wingColor={gameState.shipWingColors[gameState.selectedShipInstanceId]} cockpitColor={gameState.shipCockpitColors[gameState.selectedShipInstanceId]} gunColor={gameState.shipGunColors[gameState.selectedShipInstanceId]} gunBodyColor={gameState.shipGunBodyColors[gameState.selectedShipInstanceId]} engineColor={gameState.shipEngineColors[gameState.selectedShipInstanceId]} nozzleColor={gameState.shipNozzleColors[gameState.selectedShipInstanceId]} showJets={true} /></div>
                 <div className="w-full sm:w-1/3 p-4 sm:p-8 flex flex-col gap-4 sm:gap-8 bg-zinc-900/20"><div className="space-y-1"><label className="text-[9px] font-black uppercase text-zinc-400">Target</label><div className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter">{activePart.replace('_', ' ')}</div></div><div className="space-y-3"><div className="grid grid-cols-5 gap-2">{['#94a3b8', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#171717', '#4ade80', '#00f2ff', '#fbbf24', '#f87171', '#a855f7', '#d946ef'].map(c => (<button key={c} onClick={() => setPartColor(c)} className={`w-full aspect-square rounded border-2 transition-all hover:scale-110 active:scale-90 ${ (gameState[('ship' + activePart.charAt(0).toUpperCase() + activePart.slice(1) + 'Colors') as keyof GameState]?.[gameState.selectedShipInstanceId!] === c) ? 'border-white' : 'border-black/20'}`} style={{ backgroundColor: c }} />))}</div></div><div className="mt-auto hidden sm:block p-4 bg-emerald-500/5 border border-emerald-500/20 rounded"><p className="text-[9px] text-emerald-400 leading-relaxed uppercase font-black">Changes apply instantly to tactical systems.</p></div></div>
              </div>
           </div>
        </div>
      )}

      {isLoadoutOpen && selectedShipConfig && selectedFitting && (
        <div className="fixed inset-0 z-[9900] bg-black/95 flex items-center justify-center p-4 sm:p-6 backdrop-blur-2xl">
           <div className="w-full max-w-4xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[90vh] sm:h-[85vh] shadow-2xl">
              <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                 <div className="flex gap-1 sm:gap-2">
                    {['guns', 'ordnance', 'defense'].map(t => (
                       <button key={t} onClick={() => setLoadoutTab(t as any)} className={`px-2 sm:px-5 py-2 sm:py-3 text-[9px] sm:text-[10px] font-black uppercase border-b-2 transition-all ${loadoutTab === t ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-zinc-500'}`}>
                          {t}
                       </button>
                    ))}
                 </div>
                 <div className="flex items-center gap-2 sm:gap-6">
                    <div className="hidden sm:flex flex-col text-right">
                       <span className="text-[14px] font-black text-emerald-400 tabular-nums shadow-emerald-500/20 shadow-sm">${Math.floor(gameState.credits).toLocaleString()}</span>
                    </div>
                    <div className="flex gap-1">
                       <button onClick={acceptLoadout} className="px-3 sm:px-5 py-1.5 sm:py-2.5 bg-emerald-600/10 border border-emerald-500 text-emerald-500 uppercase font-black text-[8px] sm:text-[9px] hover:bg-emerald-600 hover:text-white transition-all rounded">SAVE</button>
                       <button onClick={cancelLoadout} className="px-3 sm:px-5 py-1.5 sm:py-2.5 bg-red-600/10 border border-red-500/40 text-red-500 uppercase font-black text-[8px] sm:text-[9px] hover:bg-red-600 hover:text-white transition-all rounded">BACK</button>
                    </div>
                 </div>
              </header>
              <div className="p-4 sm:p-8 overflow-y-auto flex-grow custom-scrollbar space-y-4">
                
                {/* STATUS PANELS FOR LOADOUT */}
                {loadoutTab === 'guns' && (
                  <div className={`grid ${selectedShipConfig.defaultGuns > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-6`}>
                    {Array.from({ length: selectedShipConfig.defaultGuns }).map((_, i) => {
                      const weapon = [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === selectedFitting.weapons[i]?.id);
                      return (
                        <div key={i} className={`flex items-center h-16 px-4 border rounded-lg ${i === 0 ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-blue-950/40 border-blue-500/30'}`}>
                          <span className={`retro-font text-[8px] uppercase ${i === 0 ? 'text-emerald-400' : 'text-blue-400'} truncate`}>
                            HPT {i+1}: {weapon?.name || 'EMPTY'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {loadoutTab === 'ordnance' && (
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="flex items-center h-16 px-4 bg-amber-950/40 border border-amber-500/30 rounded-lg">
                      <span className="retro-font text-[8px] uppercase text-amber-400 truncate">MISSILES: {selectedFitting.rocketCount} / {MAX_MISSILES}</span>
                    </div>
                    <div className="flex items-center h-16 px-4 bg-red-950/40 border border-red-500/30 rounded-lg">
                      <span className="retro-font text-[8px] uppercase text-red-400 truncate">MINES: {selectedFitting.mineCount} / {MAX_MINES}</span>
                    </div>
                  </div>
                )}

                {loadoutTab === 'defense' && (
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[{id: selectedFitting.shieldId, label: 'PRI'}, {id: selectedFitting.secondShieldId, label: 'SEC'}].map((slot, i) => {
                      const sh = SHIELDS.find(s => s.id === slot.id);
                      return (
                        <div key={i} className={`flex items-center h-16 px-4 border rounded-lg ${i === 0 ? 'bg-cyan-950/40 border-cyan-500/30' : 'bg-fuchsia-950/40 border-fuchsia-500/30'}`}>
                          <span className={`retro-font text-[8px] uppercase ${i === 0 ? 'text-cyan-400' : 'text-fuchsia-400'} truncate`}>
                            {slot.label} CORE: {sh?.name || 'OFFLINE'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* CONTENT LISTS (SHOP) */}
                {loadoutTab === 'guns' && (
                  <div className="space-y-1.5">
                    {WEAPONS.map(w => { 
                      const eqL = selectedFitting.weapons[0]?.id === w.id, eqR = selectedFitting.weapons[1]?.id === w.id; 
                      return (
                        <div key={w.id} className="grid grid-cols-[1fr_80px_120px] sm:grid-cols-[1fr_120px_220px] items-center gap-2 sm:gap-4 p-2 sm:p-4 bg-zinc-900/40 border border-zinc-800 rounded group hover:border-zinc-700 transition-colors">
                          <div className="text-[9px] sm:text-[11px] font-black uppercase group-hover:text-emerald-400 truncate pr-2">{w.name}</div>
                          <div className="text-[9px] sm:text-[11px] text-yellow-500 font-bold tabular-nums">${w.price.toLocaleString()}</div>
                          <div className="flex gap-1 justify-end">
                            {selectedShipConfig.defaultGuns >= 1 && (<button onClick={() => eqL ? removeWeaponFromSlot(0) : mountWeaponToSlot(w, 0)} className={`flex-grow py-1.5 sm:py-2 text-[7px] sm:text-[9px] font-black uppercase rounded border transition-all ${eqL ? 'border-red-500 text-red-500' : 'border-emerald-500/30 text-emerald-500'}`}>{eqL ? 'RM L' : 'MT L'}</button>)}
                            {selectedShipConfig.defaultGuns >= 2 && (<button onClick={() => eqR ? removeWeaponFromSlot(1) : mountWeaponToSlot(w, 1)} className={`flex-grow py-1.5 sm:py-2 text-[7px] sm:text-[9px] font-black uppercase rounded border transition-all ${eqR ? 'border-red-500 text-red-500' : 'border-emerald-500/30 text-emerald-500'}`}>{eqR ? 'RM R' : 'MT R'}</button>)}
                          </div>
                        </div>
                      ); 
                    })}
                  </div>
                )}

                {loadoutTab === 'ordnance' && (
                  <div className="space-y-1">
                    {EXPLODING_ORDNANCE.map(o => { 
                      const isM = o.id.includes('missile'), curr = isM ? selectedFitting.rocketCount : selectedFitting.mineCount, max = isM ? MAX_MISSILES : MAX_MINES; 
                      return (
                        <div key={o.id} className="grid grid-cols-[1fr_80px_90px] sm:grid-cols-[1fr_100px_120px] items-center gap-2 sm:gap-3 px-3 py-1.5 sm:py-2 bg-zinc-900/40 border border-zinc-800 rounded hover:border-zinc-600 transition-colors">
                          <div className="text-[8px] sm:text-[9px] font-black uppercase text-zinc-300 truncate">{o.name}</div>
                          <div className="text-[8px] sm:text-[9px] text-yellow-600 font-bold tabular-nums">${o.price.toLocaleString()}</div>
                          <button onClick={() => buyAmmo(isM ? 'missile' : 'mine')} disabled={curr >= max} className="py-1 sm:py-1.5 bg-red-600/10 border border-red-500/30 text-red-500 text-[7px] sm:text-[8px] font-black uppercase rounded hover:bg-red-600 hover:text-white disabled:opacity-10">+10</button>
                        </div>
                      ); 
                    })}
                  </div>
                )}

                {loadoutTab === 'defense' && (
                  <div className="space-y-1.5">
                    {SHIELDS.map(s => { 
                      const eq1 = selectedFitting.shieldId === s.id, eq2 = selectedFitting.secondShieldId === s.id; 
                      return (
                        <div key={s.id} className="grid grid-cols-[1fr_80px_160px] sm:grid-cols-[1fr_120px_240px] items-center gap-2 sm:gap-4 p-2 sm:p-4 bg-zinc-900/40 border border-zinc-800 rounded group hover:border-zinc-700 transition-colors">
                          <div className="text-[9px] sm:text-[11px] font-black uppercase group-hover:text-emerald-400 truncate">{s.name}</div>
                          <div className="text-[9px] sm:text-[11px] text-yellow-500 font-bold tabular-nums">${s.price.toLocaleString()}</div>
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => eq1 ? removeShield(1) : equipShield(s, 1)} className={`flex-grow py-1.5 sm:py-2 text-[7px] sm:text-[8px] font-black uppercase rounded border transition-all ${eq1 ? 'bg-blue-600 border-blue-400' : 'border-blue-500/30 text-blue-500'}`}>{eq1 ? 'RM PR' : 'PRI'}</button>
                            <button onClick={() => eq2 ? removeShield(2) : equipShield(s, 2)} className={`flex-grow py-1.5 sm:py-2 text-[7px] sm:text-[8px] font-black uppercase rounded border transition-all ${eq2 ? 'border-red-500 text-red-500' : 'border-emerald-500/30 text-emerald-500'}`}>{eq2 ? 'RM SC' : 'SEC'}</button>
                          </div>
                        </div>
                      ); 
                    })}
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {isStoreOpen && (<div className="fixed inset-0 z-[9900] bg-black/95 flex items-center justify-center p-4 sm:p-6 backdrop-blur-2xl"><div className="w-full max-w-4xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[90vh] sm:h-[80vh] shadow-2xl"><header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50"><div className="flex items-center gap-4 sm:gap-6"><h2 className="retro-font text-emerald-500 text-[10px] sm:text-xs uppercase">SHIPYARD</h2><div className="px-3 sm:px-4 py-1 sm:py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center gap-2 sm:gap-3"><span className="text-[9px] sm:text-[11px] font-black text-emerald-400 tabular-nums">${Math.floor(gameState.credits).toLocaleString()}</span></div></div><button onClick={() => setIsStoreOpen(false)} className="text-zinc-500 hover:text-white uppercase font-black text-[9px]">CLOSE</button></header><div className="flex-grow flex flex-col sm:flex-row overflow-hidden"><div className="w-full sm:w-1/3 border-b sm:border-b-0 sm:border-r border-zinc-800 overflow-y-auto p-2 space-y-1.5">{SHIPS.map((s) => (<button key={s.id} onClick={() => setInspectedShipId(s.id)} className={`w-full p-2.5 sm:p-4 text-left flex flex-col gap-0.5 rounded border transition-all ${inspectedShipId === s.id ? 'bg-emerald-500/10 border-emerald-500 shadow-lg' : 'bg-zinc-900 border-zinc-800 opacity-70'}`}><span className="text-[9px] sm:text-[10px] font-black uppercase text-white">{s.name}</span><span className="text-[8px] sm:text-[9px] font-black text-yellow-500 tabular-nums">${s.price.toLocaleString()}</span></button>))}</div><div className="flex-grow p-6 sm:p-12 flex flex-col items-center justify-center bg-zinc-950/40 text-center"><ShipIcon config={SHIPS.find(s => s.id === inspectedShipId) || SHIPS[0]} className="w-40 h-40 sm:w-64 sm:h-64 mb-6 sm:mb-10" /><h3 className="retro-font text-xs sm:text-sm text-emerald-500 uppercase mb-2 sm:mb-4">{SHIPS.find(s => s.id === inspectedShipId)?.name}</h3><div className="mb-4 sm:mb-8 space-y-0.5"><p className="text-[9px] sm:text-[10px] uppercase text-zinc-500">{SHIPS.find(s => s.id === inspectedShipId)?.description}</p></div><button onClick={() => replaceShip(inspectedShipId)} disabled={gameState.credits < (SHIPS.find(s => s.id === inspectedShipId)?.price || 0)} className="w-full max-w-xs py-4 sm:py-5 bg-emerald-600 border-2 border-emerald-400 text-white font-black uppercase rounded shadow-lg disabled:opacity-20 transition-all text-[10px] sm:text-xs">REPLACE SHIP</button></div></div></div></div>)}
      {screen === 'map' && (
        <div className="flex-grow flex flex-col p-4 sm:p-6 space-y-4 sm:space-y-6 z-10 overflow-hidden">
          <header className="flex flex-col sm:flex-row gap-2 justify-between items-center bg-zinc-950/90 p-3 sm:p-5 border-2 border-zinc-800 rounded-xl shrink-0">
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-4 w-full sm:w-auto pb-1 sm:pb-0">
              {Object.values(QuadrantType).map(q => (
                <button key={q} onClick={() => setGameState(p => ({ ...p, currentQuadrant: q, currentPlanet: null }))} className={`flex-shrink-0 px-2.5 py-1.5 sm:px-4 sm:py-2 text-[7px] sm:text-[10px] font-black uppercase rounded border transition-all ${gameState.currentQuadrant === q ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>{q}</button>
              ))}
            </div>
            <button onClick={() => setScreenState('hangar')} className="w-auto px-4 py-2 bg-zinc-900 border border-zinc-700 text-[8px] sm:text-[10px] uppercase font-black rounded-lg hover:bg-zinc-800 transition-colors">RETURN TO BASE</button>
          </header>
          <div className="flex-grow flex flex-wrap items-center justify-center gap-4 sm:gap-12 overflow-y-auto content-center">
            {PLANETS.filter(p => p.quadrant === gameState.currentQuadrant).map(p => (
              <div key={p.id} onClick={() => setGameState(prev => ({ ...prev, currentPlanet: p }))} className={`group p-3 sm:p-6 border-2 rounded-xl flex flex-col items-center transition-all cursor-pointer ${gameState.currentPlanet?.id === p.id ? 'border-emerald-500 bg-emerald-500/10 scale-105 shadow-xl' : 'border-zinc-800/40 hover:border-zinc-700 opacity-60 hover:opacity-100'}`}>
                {/* Planet Sphere - Fully Opaque (solid color) as requested */}
                <div className="w-12 h-12 sm:w-24 sm:h-24 rounded-full mb-3 sm:mb-6 shadow-2xl transition-transform group-hover:rotate-6 opacity-100" style={{ backgroundColor: p.color, backgroundImage: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent)` }} />
                <p className="text-[10px] sm:text-[12px] font-black uppercase text-white mb-0.5 tracking-widest text-center">{p.name}</p>
                <p className="text-[7px] sm:text-[9px] uppercase text-zinc-500 font-black">LVL {p.difficulty}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-center shrink-0 p-2">
            {gameState.currentPlanet && (
              <button 
                onClick={() => setScreenState('game')} 
                disabled={!selectedFitting || selectedFitting.fuel <= 0 || selectedFitting.health <= 0 || selectedFitting.weapons.length === 0} 
                className="w-auto px-8 py-3 sm:px-12 sm:py-6 bg-emerald-600 border-2 border-emerald-400 text-white text-[10px] sm:text-[14px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] rounded-xl shadow-xl active:scale-95 transition-all disabled:opacity-30"
              >
                DEFEND PLANET
              </button>
            )}
          </div>
        </div>
      )}
      {screen === 'game' && gameState.selectedShipInstanceId && gameState.currentPlanet && (<div className="flex-grow relative overflow-hidden z-20"><GameEngine ships={activeShipsForEngine as any} shield={SHIELDS.find(s => s.id === gameState.shipFittings[gameState.selectedShipInstanceId!]?.shieldId) || null} secondShield={SHIELDS.find(s => s.id === gameState.shipFittings[gameState.selectedShipInstanceId!]?.secondShieldId) || null} difficulty={gameState.currentPlanet.difficulty} currentPlanet={gameState.currentPlanet} quadrant={gameState.currentQuadrant} onGameOver={handleGameOver} /></div>)}
      {isGameOver && (<div className="fixed inset-0 z-[9999] bg-black/98 flex flex-col items-center justify-center p-10 text-center animate-in fade-in zoom-in duration-500"><div className="max-w-2xl bg-zinc-950 border border-red-500 p-12 rounded-2xl space-y-10 shadow-[0_0_80px_rgba(239,68,68,0.4)]"><h1 className="retro-font text-5xl text-red-500 uppercase tracking-tighter">FINANCIAL COLLAPSE</h1><p className="text-zinc-400 uppercase text-[10px] leading-relaxed tracking-widest">Strategic Defense Initiative is officially bankrupt. No viable assets remain. Sector defenses have failed. Humanity's expansion ends here.</p><div className="space-y-4"><button onClick={restartGame} className="w-full py-6 bg-emerald-600 border border-emerald-400 text-white font-black uppercase rounded text-xs hover:scale-105 active:scale-95 transition-all tracking-[0.3em]">RESTART PROTOCOL</button><button onClick={() => window.location.reload()} className="w-full py-6 bg-zinc-900 border border-zinc-700 text-zinc-400 font-black uppercase rounded text-xs hover:bg-zinc-800 transition-all tracking-[0.3em]">EXIT TO TERMINAL</button></div><div className="pt-12 border-t border-zinc-800 flex flex-col gap-4"><p className="retro-font text-[9px] text-zinc-600 uppercase">Thank you for playing</p><p className="text-[8px] text-zinc-700 uppercase tracking-[0.4em]">Check other games: Copyright Sage-Code (c) 2026</p></div></div></div>)}
      <style>{`@keyframes marquee-vertical { 0% { transform: translateY(100%); } 100% { transform: translateY(-100%); } } .animate-marquee-vertical { animation: marquee-vertical 45s linear infinite; }`}</style>
    </div>
  );
};

export default App;
