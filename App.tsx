
// CHECKPOINT: Defender V79.9
// VERSION: V79.9 - Exotic Loot Persistence
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GameState, Planet, MissionType, ShipConfig, QuadrantType, OwnedShipInstance, WeaponType, ShipFitting, ShipPart, Weapon, Shield, Moon, EquippedWeapon } from './types';
import { INITIAL_CREDITS, SHIPS, ENGINES, REACTORS, WEAPONS, EXOTIC_WEAPONS, ExtendedShipConfig, SHIELDS, PLANETS, EXPLODING_ORDNANCE, DEFENSE_SYSTEMS } from './constants';
import { audioService } from './services/audioService';
import GameEngine from './components/GameEngine';

const SAVE_KEY = 'galactic_defender_v79_9';
const MAX_FLEET_SIZE = 3;
const REPAIR_COST_PER_PERCENT = 150;
const REFUEL_COST_PER_UNIT = 5000;
const MAX_MISSILES = 50;
const MAX_MINES = 20;
const MAX_FUEL_UNITS = 3;
const DEFAULT_WEAPON_ID = WEAPONS[0].id;

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
        <ellipse cx="50" cy={hullShapeType === 'triangle' ? 58 : 38} rx="8" ry="13" fill={cockpitColor} stroke={activePart === 'cockpit' ? '#fff' : 'transparent'} strokeWidth={2} onClick={() => onPartSelect?.('cockpit')} className="cursor-pointer" />
      </svg>
    </div>
  );
};

const App: React.FC = () => {
  const DEFAULT_SHIP_ID = SHIPS[0].id;

  const createInitialState = (): GameState => {
    const initialOwned = Array.from({ length: MAX_FLEET_SIZE }).map((_, idx) => ({ instanceId: `fleet_slot_${idx}`, shipTypeId: DEFAULT_SHIP_ID }));
    const initialFittings: Record<string, ShipFitting> = {};
    const initialColors: Record<string, string> = {};
    initialOwned.forEach((os) => { 
      initialFittings[os.instanceId] = { weapons: [{ id: DEFAULT_WEAPON_ID, count: 1 }], shieldId: null, secondShieldId: null, flareId: null, reactorLevel: 1, engineType: 'standard', rocketCount: 0, mineCount: 0, wingWeaponId: null, health: 100, ammoPercent: 100, lives: 1, fuel: MAX_FUEL_UNITS }; 
      initialColors[os.instanceId] = SHIPS[0].defaultColor || '#94a3b8'; 
    });
    return {
      credits: INITIAL_CREDITS, selectedShipInstanceId: initialOwned[0].instanceId, ownedShips: initialOwned,
      shipFittings: initialFittings, shipColors: initialColors, shipWingColors: {}, shipCockpitColors: {}, shipBeamColors: {}, shipGunColors: {}, shipGunBodyColors: {}, shipEngineColors: {}, shipBarColors: {}, shipNozzleColors: {},
      currentPlanet: null, currentMoon: null, currentMission: null, currentQuadrant: QuadrantType.ALFA, conqueredMoonIds: [], shipMapPosition: { [QuadrantType.ALFA]: { x: 50, y: 50 }, [QuadrantType.BETA]: { x: 50, y: 50 }, [QuadrantType.GAMA]: { x: 50, y: 50 }, [QuadrantType.DELTA]: { x: 50, y: 50 } }, shipRotation: 0, orbitingEntityId: null, orbitAngle: 0, dockedPlanetId: 'p1', tutorialCompleted: false, settings: { musicVolume: 0.3, sfxVolume: 0.5, musicEnabled: true, sfxEnabled: true, displayMode: 'windowed', autosaveEnabled: true }, taskForceShipIds: [], activeTaskForceIndex: 0, pilotName: 'STRATOS', pilotAvatar: '👨‍🚀', gameInProgress: false, victories: 0, failures: 0, typeColors: {}
    };
  };

  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) try { return { ...createInitialState(), ...JSON.parse(saved) }; } catch(e) { return createInitialState(); }
    return createInitialState();
  });

  const [screen, setScreenState] = useState<'intro' | 'hangar' | 'map' | 'game'>('intro');
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [storeIndex, setStoreIndex] = useState(0);
  const [isLoadoutOpen, setIsLoadoutOpen] = useState(false);
  const [loadoutTab, setLoadoutTab] = useState<'guns' | 'ordnance' | 'defense'>('guns');
  const [activeSlot, setActiveSlot] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => localStorage.setItem(SAVE_KEY, JSON.stringify(gameState)), [gameState]);

  useEffect(() => {
    if (gameState.credits < 5000 && screen === 'hangar') {
        const canFly = (Object.values(gameState.shipFittings) as ShipFitting[]).some(f => f.fuel > 0 && f.weapons.length > 0);
        if (!canFly) setIsGameOver(true);
    }
  }, [gameState.credits, gameState.shipFittings, screen]);

  const selectedFitting = useMemo(() => gameState.selectedShipInstanceId ? gameState.shipFittings[gameState.selectedShipInstanceId] : null, [gameState]);
  const selectedShipConfig = useMemo(() => { if (!gameState.selectedShipInstanceId) return null; const instance = gameState.ownedShips.find(s => s.instanceId === gameState.selectedShipInstanceId); return instance ? SHIPS.find(s => s.id === instance.shipTypeId) || null : null; }, [gameState]);

  const activeShipsForEngine = useMemo(() => {
    if (!gameState.selectedShipInstanceId) return [];
    return gameState.ownedShips
      .filter(os => os.instanceId === gameState.selectedShipInstanceId)
      .map(os => ({
        config: SHIPS.find(s => s.id === os.shipTypeId)!,
        fitting: gameState.shipFittings[os.instanceId],
        color: gameState.shipColors[os.instanceId],
        gunColor: gameState.shipGunColors[os.instanceId]
      }));
  }, [gameState.selectedShipInstanceId, gameState.ownedShips, gameState.shipFittings, gameState.shipColors, gameState.shipGunColors]);

  const handleGameOver = useCallback((success: boolean, finalScore: number, wasAborted?: boolean, payload?: { rockets: number, mines: number, weapons: EquippedWeapon[] }) => {
    setGameState(prev => {
      const sId = prev.selectedShipInstanceId; if (!sId) return prev;
      const fit = prev.shipFittings[sId];
      const newFits = { ...prev.shipFittings };
      if (!wasAborted) {
        const nextHealth = success ? fit.health : Math.max(0, fit.health - 50);
        // Persist exotic loot only if ship is NOT destroyed
        // Fix typo: change DEFAULT_WE_ID to DEFAULT_WEAPON_ID
        const finalWeapons = nextHealth <= 0 ? [{ id: DEFAULT_WEAPON_ID, count: 1 }] : (payload?.weapons || fit.weapons);
        
        newFits[sId] = { 
            ...fit, 
            health: nextHealth, 
            rocketCount: payload?.rockets ?? fit.rocketCount, 
            mineCount: payload?.mines ?? fit.mineCount, 
            fuel: Math.max(0, fit.fuel - 1),
            weapons: finalWeapons 
        };
      }
      return { ...prev, credits: prev.credits + (success ? Math.floor(finalScore / 5) : 0), victories: prev.victories + (success ? 1 : 0), failures: prev.failures + (!success && !wasAborted ? 1 : 0), shipFittings: newFits };
    });
    setScreenState('hangar'); audioService.stop(); audioService.playTrack('command');
  }, []);

  const refuelSelected = () => {
    if (!selectedFitting || !gameState.selectedShipInstanceId || selectedFitting.fuel >= MAX_FUEL_UNITS || gameState.credits < REFUEL_COST_PER_UNIT) { audioService.playSfx('denied'); return; }
    setGameState(p => ({ ...p, credits: p.credits - REFUEL_COST_PER_UNIT, shipFittings: { ...p.shipFittings, [p.selectedShipInstanceId!]: { ...selectedFitting, fuel: MAX_FUEL_UNITS } } }));
    audioService.playSfx('buy');
  };

  const repairSelected = () => {
    if (!selectedFitting || !gameState.selectedShipInstanceId) return;
    const cost = Math.floor((100 - selectedFitting.health) * REPAIR_COST_PER_PERCENT);
    if (cost <= 0 || gameState.credits < cost) { audioService.playSfx('denied'); return; }
    setGameState(p => ({ ...p, credits: p.credits - cost, shipFittings: { ...p.shipFittings, [p.selectedShipInstanceId!]: { ...selectedFitting, health: 100 } } }));
    audioService.playSfx('buy');
  };

  const mountWeaponToSlot = (w: Weapon, slotIdx: number) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedFitting) return;
    const current = selectedFitting.weapons[slotIdx];
    let refund = 0; if (current) { const oldW = [...WEAPONS, ...EXOTIC_WEAPONS].find(xw => xw.id === current.id); if (oldW) refund = oldW.price; }
    const cost = w.price - refund;
    if (gameState.credits < cost) { audioService.playSfx('denied'); return; }
    setGameState(p => {
      const newWeps = [...selectedFitting.weapons]; newWeps[slotIdx] = { id: w.id, count: 1 };
      return { ...p, credits: p.credits - cost, shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, weapons: newWeps } } };
    });
    audioService.playSfx('buy');
  };

  const removeWeaponFromSlot = (slotIdx: number) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedFitting) return;
    const current = selectedFitting.weapons[slotIdx];
    if (!current) return;
    const oldW = [...WEAPONS, ...EXOTIC_WEAPONS].find(xw => xw.id === current.id);
    const refund = oldW ? oldW.price : 0;
    setGameState(p => {
      const newWeps = [...selectedFitting.weapons]; newWeps[slotIdx] = undefined as any;
      return { ...p, credits: p.credits + refund, shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, weapons: newWeps.filter(Boolean) } } };
    });
    audioService.playSfx('click');
  };

  const buyAmmo = (type: 'missile' | 'mine') => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedFitting) return;
    const price = type === 'missile' ? 8000 : 12000;
    const max = type === 'missile' ? MAX_MISSILES : MAX_MINES;
    const current = type === 'missile' ? selectedFitting.rocketCount : selectedFitting.mineCount;
    if (current >= max || gameState.credits < price) { audioService.playSfx('denied'); return; }
    setGameState(p => ({ ...p, credits: p.credits - price, shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, [type === 'missile' ? 'rocketCount' : 'mineCount']: Math.min(max, current + 10) } } }));
    audioService.playSfx('buy');
  };

  const equipShield = (s: Shield, slot: 1 | 2) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedFitting) return;
    const field = slot === 1 ? 'shieldId' : 'secondShieldId';
    const oldId = selectedFitting[field];
    let refund = 0; if (oldId) { const old = SHIELDS.find(x => x.id === oldId); if (old) refund = old.price; }
    const cost = s.price - refund;
    if (gameState.credits < cost) { audioService.playSfx('denied'); return; }
    setGameState(p => ({ ...p, credits: p.credits - cost, shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, [field]: s.id } } }));
    audioService.playSfx('buy');
  };

  const removeShield = (slot: 1 | 2) => {
    const sId = gameState.selectedShipInstanceId; if (!sId || !selectedFitting) return;
    const field = slot === 1 ? 'shieldId' : 'secondShieldId';
    const oldId = selectedFitting[field]; if (!oldId) return;
    const old = SHIELDS.find(x => x.id === oldId); const refund = old ? old.price : 0;
    setGameState(p => ({ ...p, credits: p.credits + refund, shipFittings: { ...p.shipFittings, [sId]: { ...selectedFitting, [field]: null } } }));
    audioService.playSfx('click');
  };

  const replaceShip = (shipTypeId: string) => {
    const tId = gameState.selectedShipInstanceId; if (!tId) return;
    const nS = SHIPS.find(s => s.id === shipTypeId)!;
    if (gameState.credits < nS.price) { audioService.playSfx('denied'); return; }
    setGameState(p => ({
      ...p, credits: p.credits - nS.price,
      ownedShips: p.ownedShips.map(s => s.instanceId === tId ? { ...s, shipTypeId } : s),
      shipFittings: { ...p.shipFittings, [tId]: { weapons: [{ id: DEFAULT_WEAPON_ID, count: 1 }], shieldId: null, secondShieldId: null, flareId: null, reactorLevel: 1, engineType: 'standard', rocketCount: 0, mineCount: 0, wingWeaponId: null, health: 100, ammoPercent: 100, lives: 1, fuel: MAX_FUEL_UNITS } },
      shipColors: { ...p.shipColors, [tId]: nS.defaultColor || '#94a3b8' }
    }));
    audioService.playSfx('buy'); setIsStoreOpen(false);
  };

  const restartGame = () => {
    setGameState(createInitialState());
    setIsGameOver(false);
    setScreenState('intro');
  };

  return (
    <div className="w-full h-full bg-[#0c0a09] text-zinc-100 flex flex-col overflow-hidden relative">
      <StarBackground />
      {screen === 'intro' && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 gap-8 z-10 text-center relative overflow-hidden">
          <div className="absolute top-20 w-[600px] h-[300px] pointer-events-none opacity-20">
             <div className="animate-marquee-vertical flex flex-col gap-10">
                <p className="retro-font text-[10px] text-emerald-500 leading-relaxed uppercase">The galaxy is a dark ocean. After centuries of expansion, humanity reached the far quadrants of Alpha and Delta. But we were not alone. From the rifts, the Xenos Swarm arrived. Every colony planet is a fortress. Every pilot is a guardian. Defend the sectors. Hold the line.</p>
             </div>
          </div>
          <h1 className="retro-font text-3xl md:text-5xl text-emerald-500 uppercase tracking-widest z-20">GALACTIC DEFENDER</h1>
          <div className="flex flex-col gap-4 z-20">
            <button onClick={() => setScreenState('hangar')} className="py-5 px-16 border-2 border-emerald-500 text-xs font-black uppercase tracking-widest hover:bg-emerald-500/10 transition-all">ENGAGE SDI PROTOCOL</button>
            <div className="flex gap-4">
               <button onClick={() => setShowManual(true)} className="flex-grow py-3 px-6 bg-zinc-950/80 border border-zinc-700 text-[10px] uppercase font-black hover:bg-zinc-800 transition-colors">MANUAL</button>
               <button onClick={() => alert("System: V79.9 Exotic Loot active. Persistence verified. Window scaling stable.")} className="flex-grow py-3 px-6 bg-zinc-950/80 border border-zinc-700 text-[10px] uppercase font-black hover:bg-zinc-800 transition-colors">OPTIONS</button>
            </div>
          </div>
          {showManual && (
            <div className="fixed inset-0 z-[9000] bg-black/95 flex items-center justify-center p-10 backdrop-blur-md" onClick={() => setShowManual(false)}>
              <div className="max-w-xl bg-zinc-950 border border-emerald-500/40 p-10 rounded-xl space-y-6" onClick={e => e.stopPropagation()}>
                <h3 className="retro-font text-emerald-500 text-lg uppercase">Flight Manual</h3>
                <div className="space-y-4 text-[12px] uppercase text-zinc-400">
                  <p>• [WASD / ARROWS] TO MANEUVER SHIP</p>
                  <p>• [SPACE] TO FIRE PRIMARY CANNONS</p>
                  <p>• [TAB] TO LAUNCH TRACKING MISSILES</p>
                  <p>• [CAPS LOCK] TO DEPLOY GRAVITY MINES</p>
                  <p>• [ESC] TO ABORT MISSION</p>
                  <p className="text-red-500 mt-4 font-black">LOGISTICS: BOSSES DROP EXOTIC LOOT. THESE WEAPONS PERSIST UNTIL RE-EQUIPPED OR SHIP LOSS.</p>
                </div>
                <button onClick={() => setShowManual(false)} className="w-full py-4 bg-emerald-600/20 border border-emerald-500 text-emerald-500 font-black uppercase text-[10px]">ACKNOWLEDGED</button>
              </div>
            </div>
          )}
        </div>
      )}

      {screen === 'hangar' && (
        <div className="flex-grow flex flex-col p-6 space-y-6 z-10 overflow-hidden">
          <div className="flex-grow flex gap-6 overflow-hidden">
            {gameState.ownedShips.map((instance, idx) => {
              const f = gameState.shipFittings[instance.instanceId];
              const isSelected = gameState.selectedShipInstanceId === instance.instanceId;
              const config = SHIPS.find(s => s.id === instance.shipTypeId)!;
              return (
                <div key={idx} onClick={() => setGameState(p => ({ ...p, selectedShipInstanceId: instance.instanceId }))} className={`flex-grow border-2 p-6 flex flex-col items-center rounded-xl transition-all cursor-pointer ${isSelected ? 'border-emerald-500 bg-emerald-950/20 shadow-xl' : 'border-zinc-800 bg-zinc-950/40 opacity-70 hover:opacity-100'}`}>
                  <div className="w-full flex justify-between items-center mb-4">
                    <span className="retro-font text-[9px] text-emerald-500 uppercase">{config.name}</span>
                    <span className="text-[8px] uppercase text-zinc-500">Fleet Slot {idx + 1}</span>
                  </div>
                  <ShipIcon config={config as any} hullColor={gameState.shipColors[instance.instanceId]} className="w-44 h-44" />
                  <div className="w-full mt-auto space-y-4">
                    <div className="space-y-1"><div className="flex justify-between text-[8px] uppercase"><span>Hull Integrity</span><span>{Math.floor(f.health)}%</span></div><div className="h-2 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${f.health}%` }} /></div></div>
                    <div className="space-y-1"><div className="flex justify-between text-[8px] uppercase"><span>Fuel Reserve</span><span>{f.fuel} Units</span></div><div className="h-2 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${(f.fuel/MAX_FUEL_UNITS)*100}%` }} /></div></div>
                    <div className="grid grid-cols-2 gap-2"><button onClick={(e) => { e.stopPropagation(); setIsLoadoutOpen(true); }} className="py-2 bg-zinc-900 text-[8px] uppercase font-black rounded hover:bg-zinc-800">LOADOUT</button><button onClick={(e) => { e.stopPropagation(); setIsStoreOpen(true); }} className="py-2 bg-zinc-900 text-[8px] uppercase font-black rounded hover:bg-zinc-800">SWAP HULL</button></div>
                  </div>
                </div>
              );
            })}
          </div>
          <footer className="bg-zinc-950/90 p-5 rounded-xl border border-zinc-800 flex justify-between items-center backdrop-blur-md">
            <div className="flex flex-col gap-1"><span className="retro-font text-[9px] text-emerald-500">PILOT: {gameState.pilotName}</span><span className="text-yellow-500 font-black text-sm tabular-nums">${gameState.credits.toLocaleString()} RESOURCES</span></div>
            <div className="flex gap-4">
               <button onClick={repairSelected} disabled={!selectedFitting || selectedFitting.health >= 100} className="px-6 py-3 bg-zinc-900 border border-zinc-700 text-[10px] uppercase font-black hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed">REPAIR SELECTED</button>
               <button onClick={refuelSelected} disabled={!selectedFitting || selectedFitting.fuel >= MAX_FUEL_UNITS} className="px-6 py-3 bg-zinc-900 border border-zinc-700 text-[10px] uppercase font-black hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed">REFUEL SELECTED</button>
               <button onClick={() => setScreenState('map')} disabled={!selectedFitting || selectedFitting.fuel <= 0 || selectedFitting.weapons.length === 0} className="px-12 py-3 bg-emerald-600 border border-emerald-400 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-20 transition-all active:scale-95">START ENGAGEMENT</button>
            </div>
          </footer>
        </div>
      )}

      {isLoadoutOpen && selectedShipConfig && selectedFitting && (
        <div className="fixed inset-0 z-[7000] bg-black/90 flex items-center justify-center p-6 backdrop-blur-xl">
           <div className="w-full max-w-4xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[85vh]">
              <header className="p-4 border-b border-zinc-800 flex justify-between bg-zinc-900/50">
                <div className="flex gap-4">
                  {['guns', 'ordnance', 'defense'].map(t => (<button key={t} onClick={() => setLoadoutTab(t as any)} className={`px-5 py-3 text-[10px] font-black uppercase border-b-2 transition-all ${loadoutTab === t ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-zinc-500'}`}>{t}</button>))}
                </div>
                <button onClick={() => setIsLoadoutOpen(false)} className="px-4 py-2 text-red-500 uppercase font-black text-[9px] hover:bg-red-500/10">EXIT SYSTEM</button>
              </header>
              <div className="p-8 overflow-y-auto flex-grow custom-scrollbar">
                {loadoutTab === 'guns' && (
                  <div className="space-y-8">
                    <div className="flex gap-4">
                      {Array.from({ length: selectedShipConfig.defaultGuns }).map((_, i) => (
                        <button key={i} onClick={() => setActiveSlot(i)} className={`flex-grow p-4 text-[9px] uppercase font-black border transition-all ${activeSlot === i ? 'bg-emerald-500/20 border-emerald-500' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}>
                          Hardpoint {i+1}: {selectedFitting.weapons[i] ? [...WEAPONS, ...EXOTIC_WEAPONS].find(w => w.id === selectedFitting.weapons[i].id)?.name : 'EMPTY'}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {WEAPONS.map(w => {
                        const isEquippedSlot0 = selectedFitting.weapons[0]?.id === w.id;
                        const isEquippedSlot1 = selectedFitting.weapons[1]?.id === w.id;
                        return (
                          <div key={w.id} className="p-5 bg-zinc-900/40 border border-zinc-800 rounded flex justify-between items-center group">
                            <div><div className="text-[11px] font-black uppercase group-hover:text-emerald-400">{w.name}</div><div className="text-[9px] text-yellow-500 mt-1">${w.price.toLocaleString()}</div></div>
                            <div className="flex gap-2">
                               {selectedShipConfig.defaultGuns >= 1 && (
                                 <button onClick={() => isEquippedSlot0 ? removeWeaponFromSlot(0) : mountWeaponToSlot(w, 0)} className={`px-4 py-3 text-[9px] font-black uppercase rounded border transition-all ${isEquippedSlot0 ? 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white' : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-600 hover:text-white'}`}>
                                   {isEquippedSlot0 ? 'REMOVE L' : 'MOUNT L'}
                                 </button>
                               )}
                               {selectedShipConfig.defaultGuns >= 2 && (
                                 <button onClick={() => isEquippedSlot1 ? removeWeaponFromSlot(1) : mountWeaponToSlot(w, 1)} className={`px-4 py-3 text-[9px] font-black uppercase rounded border transition-all ${isEquippedSlot1 ? 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white' : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-600 hover:text-white'}`}>
                                   {isEquippedSlot1 ? 'REMOVE R' : 'MOUNT R'}
                                 </button>
                               )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {loadoutTab === 'ordnance' && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-2 gap-6 mb-4">
                       <div className="p-6 bg-zinc-900 border border-zinc-800 rounded text-center">
                          <div className="retro-font text-[9px] text-zinc-500 mb-2 uppercase">MISSILE STOCK</div>
                          <div className="text-2xl font-black text-white">{selectedFitting.rocketCount} / {MAX_MISSILES}</div>
                       </div>
                       <div className="p-6 bg-zinc-900 border border-zinc-800 rounded text-center">
                          <div className="retro-font text-[9px] text-zinc-500 mb-2 uppercase">MINE STOCK</div>
                          <div className="text-2xl font-black text-white">{selectedFitting.mineCount} / {MAX_MINES}</div>
                       </div>
                    </div>
                    {EXPLODING_ORDNANCE.map(o => {
                      const isMissile = o.id.includes('missile');
                      const current = isMissile ? selectedFitting.rocketCount : selectedFitting.mineCount;
                      const max = isMissile ? MAX_MISSILES : MAX_MINES;
                      return (
                        <div key={o.id} className="p-5 bg-zinc-900/40 border border-zinc-800 rounded flex justify-between items-center">
                          <div><div className="text-[11px] font-black uppercase">{o.name.replace('Rockets', 'Missiles')} (+10 Units)</div><div className="text-[9px] text-yellow-500 mt-1">${o.price.toLocaleString()}</div></div>
                          <button onClick={() => buyAmmo(isMissile ? 'missile' : 'mine')} disabled={current >= max} className="px-8 py-3 bg-red-600/10 border border-red-500/30 text-red-500 text-[9px] font-black uppercase rounded hover:bg-red-600 hover:text-white disabled:opacity-20 transition-all">LOAD +10</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {loadoutTab === 'defense' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                      {SHIELDS.map(s => {
                        const isPrimary = selectedFitting.shieldId === s.id;
                        const isSecondary = selectedFitting.secondShieldId === s.id;
                        return (
                          <div key={s.id} className="p-5 bg-zinc-900/40 border border-zinc-800 rounded flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                              <div><div className="text-[11px] font-black uppercase">{s.name}</div><div className="text-[9px] text-yellow-500 mt-1">${s.price.toLocaleString()}</div></div>
                              <div className="flex gap-2">
                                <button onClick={() => isPrimary ? removeShield(1) : equipShield(s, 1)} className={`px-4 py-2 text-[8px] font-black uppercase rounded border transition-all ${isPrimary ? 'bg-blue-600 text-white border-blue-400' : 'border-blue-500/30 text-blue-500 hover:bg-blue-600/10'}`}>
                                  {isPrimary ? 'REMOVE PRI' : 'PRIMARY'}
                                </button>
                                <button onClick={() => isSecondary ? removeShield(2) : equipShield(s, 2)} className={`px-4 py-2 text-[8px] font-black uppercase rounded border transition-all ${isSecondary ? 'bg-red-600 text-white border-red-400' : 'border-red-500/30 text-red-500 hover:bg-red-600/10'}`}>
                                  {isSecondary ? 'REMOVE SEC' : 'SECONDARY'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {isStoreOpen && (
        <div className="fixed inset-0 z-[8000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-sm"><div className="w-full max-w-4xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[80vh] shadow-2xl"><header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50"><h2 className="retro-font text-emerald-500 text-xs uppercase">Fleet Replacement Portal</h2><button onClick={() => setIsStoreOpen(false)} className="text-zinc-500 hover:text-white uppercase font-black text-[9px]">CANCEL</button></header><div className="flex-grow flex overflow-hidden"><div className="w-1/3 border-r border-zinc-800 overflow-y-auto p-2 space-y-2">{SHIPS.map((s, idx) => (<button key={s.id} onClick={() => setStoreIndex(idx)} className={`w-full p-4 text-left flex flex-col gap-1 rounded border transition-all ${storeIndex === idx ? 'bg-emerald-500/10 border-emerald-500' : 'bg-zinc-900 border-zinc-800'}`}><span className="text-[10px] font-black uppercase text-white">{s.name}</span><span className="text-[9px] font-black text-yellow-500">${s.price.toLocaleString()}</span></button>))}</div><div className="flex-grow p-12 flex flex-col items-center justify-center bg-zinc-950/40 relative text-center"><ShipIcon config={SHIPS[storeIndex]} className="w-64 h-64 mb-10" /><h3 className="retro-font text-sm text-emerald-500 uppercase mb-4">{SHIPS[storeIndex].name}</h3><button onClick={() => replaceShip(SHIPS[storeIndex].id)} disabled={gameState.credits < SHIPS[storeIndex].price} className="w-full max-w-xs py-5 bg-emerald-600 border-2 border-emerald-400 text-white font-black uppercase rounded shadow-lg active:scale-95 transition-all">AUTHORIZE REPLACEMENT</button></div></div></div></div>
      )}

      {screen === 'map' && (
        <div className="flex-grow flex flex-col p-6 space-y-6 z-10">
          <header className="flex justify-between items-center bg-zinc-950/90 p-5 border-2 border-zinc-800 rounded-xl">
             <div className="flex gap-4">
                {Object.values(QuadrantType).map(q => (
                  <button key={q} onClick={() => setGameState(p => ({ ...p, currentQuadrant: q, currentPlanet: null }))} className={`px-5 py-2 text-[10px] font-black uppercase rounded border transition-all ${gameState.currentQuadrant === q ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>{q} SECTOR</button>
                ))}
             </div>
             <button onClick={() => setScreenState('hangar')} className="px-8 py-2 bg-zinc-900 border border-zinc-700 text-[10px] uppercase font-black rounded-lg hover:bg-zinc-800 transition-colors">RETURN TO BASE</button>
          </header>
          <div className="flex-grow flex flex-wrap items-center justify-center gap-16">
             {PLANETS.filter(p => p.quadrant === gameState.currentQuadrant).map(p => (
               <div key={p.id} onClick={() => setGameState(prev => ({ ...prev, currentPlanet: p }))} className={`group p-8 border-2 rounded-xl flex flex-col items-center transition-all cursor-pointer ${gameState.currentPlanet?.id === p.id ? 'border-emerald-500 bg-emerald-500/10 scale-110 shadow-xl' : 'border-zinc-800/40 hover:border-zinc-700 opacity-60 hover:opacity-100'}`}>
                 <div className="w-24 h-24 rounded-full mb-6 shadow-2xl transition-transform group-hover:rotate-6" style={{ backgroundColor: p.color, backgroundImage: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent)` }} />
                 <p className="text-[12px] font-black uppercase text-white mb-2 tracking-widest">{p.name}</p>
                 <p className="text-[9px] uppercase text-zinc-500 font-black">Threat Level {p.difficulty}</p>
               </div>
             ))}
          </div>
          <div className="flex justify-center h-20">
             {gameState.currentPlanet && (<button onClick={() => setScreenState('game')} className="px-20 py-6 bg-emerald-600 border-2 border-emerald-400 text-white text-[14px] font-black uppercase tracking-[0.4em] rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all">ENGAGE {gameState.currentPlanet.name}</button>)}
          </div>
        </div>
      )}

      {screen === 'game' && gameState.selectedShipInstanceId && (
        <div className="flex-grow relative overflow-hidden z-20">
          <GameEngine ships={activeShipsForEngine} shield={SHIELDS.find(s => s.id === gameState.shipFittings[gameState.selectedShipInstanceId!]?.shieldId) || null} secondShield={SHIELDS.find(s => s.id === gameState.shipFittings[gameState.selectedShipInstanceId!]?.secondShieldId) || null} difficulty={gameState.currentPlanet?.difficulty || 1} onGameOver={handleGameOver} />
        </div>
      )}

      {isGameOver && (
        <div className="fixed inset-0 z-[9999] bg-black/98 flex flex-col items-center justify-center p-10 text-center animate-in fade-in zoom-in duration-500">
           <div className="max-w-2xl bg-zinc-950 border border-red-500 p-12 rounded-2xl space-y-10 shadow-[0_0_80px_rgba(239,68,68,0.4)]">
              <h1 className="retro-font text-5xl text-red-500 uppercase tracking-tighter">FINANCIAL COLLAPSE</h1>
              <p className="text-zinc-400 uppercase text-[10px] leading-relaxed tracking-widest">Strategic Defense Initiative is officially bankrupt. No viable assets remain. Sector defenses have failed. Humanity's expansion ends here.</p>
              <div className="space-y-4">
                 <button onClick={restartGame} className="w-full py-6 bg-emerald-600 border border-emerald-400 text-white font-black uppercase rounded text-xs hover:scale-105 active:scale-95 transition-all tracking-[0.3em]">RESTART PROTOCOL</button>
                 <button onClick={() => window.location.reload()} className="w-full py-6 bg-zinc-900 border border-zinc-700 text-zinc-400 font-black uppercase rounded text-xs hover:bg-zinc-800 transition-all tracking-[0.3em]">EXIT TO TERMINAL</button>
              </div>
              <div className="pt-12 border-t border-zinc-800 flex flex-col gap-4">
                 <p className="retro-font text-[9px] text-zinc-600 uppercase">Thank you for playing</p>
                 <p className="text-[8px] text-zinc-700 uppercase tracking-[0.4em]">Check other games: Copyright Sage-Code (c) 2026</p>
              </div>
           </div>
        </div>
      )}
      
      <style>{`
        @keyframes marquee-vertical { 0% { transform: translateY(100%); } 100% { transform: translateY(-100%); } }
        .animate-marquee-vertical { animation: marquee-vertical 45s linear infinite; }
      `}</style>
    </div>
  );
};

export default App;
