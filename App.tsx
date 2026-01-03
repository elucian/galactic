
// CHECKPOINT: Defender V64.0
// VERSION: V64.0 - Integrated Fleet Persistence & Improved HUD
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GameState, Planet, MissionType, ShipConfig, QuadrantType, OwnedShipInstance, WeaponType, ShipFitting } from './types';
import { INITIAL_CREDITS, SHIPS, ENGINES, REACTORS, WEAPONS, ExtendedShipConfig, SHIELDS, PLANETS } from './constants';
import { audioService } from './services/audioService';
import GameEngine from './components/GameEngine';

const SAVE_KEY = 'galactic_defender_v64_0';
const MAX_FLEET_SIZE = 3;
const REPAIR_COST_PER_PERCENT = 150;

type ShipPart = 'hull' | 'wings' | 'cockpit' | 'guns' | 'gun_body' | 'engines' | 'bars' | 'nozzles';

interface ExtendedGameState extends GameState {
  typeColors: Record<string, Record<ShipPart, string>>;
}

const StarBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    const stars = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      s: Math.random() * 2,
      v: 0.1 + Math.random() * 0.5
    }));
    let anim: number;
    const loop = () => {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      stars.forEach(s => {
        s.y += s.v;
        if (s.y > canvas.height) s.y = 0;
        ctx.fillRect(s.x, s.y, s.s, s.s);
      });
      anim = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none opacity-40" />;
};

export const ShipGuns = ({ count, gunColor = '#60a5fa', gunBodyColor = '#1c1917', activePart, onPartSelect }: { count: number, gunColor?: string, gunBodyColor?: string, activePart?: ShipPart | null, onPartSelect?: (part: ShipPart) => void }) => {
  const s = count === 1 ? 0.35 : 0.55;
  const renderGun = (x: number, y: number) => (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      <g onClick={(e) => { e.stopPropagation(); onPartSelect?.('guns'); }} className="cursor-pointer">
        <rect x="-1" y="-18" width="2" height="42" fill={gunColor} stroke={activePart === 'guns' ? '#fff' : 'transparent'} strokeWidth="2" />
      </g>
      <g onClick={(e) => { e.stopPropagation(); onPartSelect?.('gun_body'); }} className="cursor-pointer">
        <rect x="-7" y="-5" width="14" height="22" fill={gunBodyColor} rx="1" stroke={activePart === 'gun_body' ? '#fff' : 'rgba(0,0,0,0.5)'} strokeWidth="1" />
      </g>
      <g onClick={(e) => { e.stopPropagation(); onPartSelect?.('guns'); }} className="cursor-pointer">
        <rect x="-4" y="-24" width="8" height="20" fill="#334155" rx="1.5" stroke={activePart === 'guns' ? '#fff' : 'transparent'} strokeWidth="1" />
        <rect x="-1" y="-48" width="2" height="32" fill={gunColor} rx="0.5" />
      </g>
    </g>
  );
  return <g>{count === 1 ? renderGun(50, 15) : <>{renderGun(25, 45)}{renderGun(75, 45)}</>}</g>;
};

export const EnginePod = ({ x, y, color = '#334155', nozzleColor = '#171717', showJets = false, activePart, onPartSelect }: { x: number, y: number, color?: string, nozzleColor?: string, showJets?: boolean, activePart?: ShipPart | null, onPartSelect?: (part: ShipPart) => void }) => (
  <g transform={`translate(${x}, ${y})`}>
    <g onClick={(e) => { e.stopPropagation(); onPartSelect?.('engines'); }} className="cursor-pointer">
      <rect x="-14" y="-18" width="28" height="26" rx="8" fill={color} stroke={activePart === 'engines' ? '#fff' : '#000'} strokeWidth={1} />
    </g>
    <g onClick={(e) => { e.stopPropagation(); onPartSelect?.('nozzles'); }} className="cursor-pointer">
      <path d="M-10 8 L-12 22 Q 0 28 12 22 L 10 8 Q 0 11 -10 8" fill={nozzleColor} stroke={activePart === 'nozzles' ? '#fff' : 'transparent'} strokeWidth="1.5" />
    </g>
    {showJets && (
      <g>
        <path d="M-18 24 Q 0 150 18 24 Z" fill="#ef4444" opacity="0.7"><animate attributeName="d" values="M-18 24 Q 0 150 18 24 Z; M-18 24 Q 0 200 18 24 Z; M-18 24 Q 0 150 18 24 Z" dur="0.05s" repeatCount="indefinite" /></path>
        <circle cx="0" cy="24" r="25" fill="rgba(239, 68, 68, 0.4)" filter="blur(10px)"><animate attributeName="r" values="25;35;25" dur="0.05s" repeatCount="indefinite" /></circle>
      </g>
    )}
  </g>
);

export const ShipIcon = ({ config, hullColor = '#94a3b8', wingColor = '#64748b', cockpitColor = '#38bdf8', gunColor = '#60a5fa', gunBodyColor = '#1c1917', engineColor = '#334155', nozzleColor = '#171717', className = '', showJets = false, activePart = null, onPartSelect = () => {} }: { config: ExtendedShipConfig, hullColor?: string, wingColor?: string, cockpitColor?: string, gunColor?: string, gunBodyColor?: string, engineColor?: string, nozzleColor?: string, className?: string, showJets?: boolean, activePart?: ShipPart | null, onPartSelect?: (part: ShipPart) => void }) => {
  const { wingStyle, engines: engineCount, defaultGuns: gunCount, hullShapeType } = config;
  const cockpitY = (hullShapeType === 'triangle') ? 58 : 38;

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <g fill={wingColor} stroke={activePart === 'wings' ? '#fff' : 'transparent'} strokeWidth={2} onClick={(e) => { e.stopPropagation(); onPartSelect('wings'); }} className="cursor-pointer">
          {wingStyle === 'delta' ? <><path d="M35 40 L4 88 Q 25 96 50 78" /><path d="M65 40 L96 88 Q 75 96 50 78" /></> : <ellipse cx="50" cy="60" rx="45" ry="15" />}
        </g>
        {engineCount === 1 ? <EnginePod x={50} y={82} color={engineColor} nozzleColor={nozzleColor} showJets={showJets} activePart={activePart} onPartSelect={onPartSelect} /> : <><EnginePod x={25} y={75} color={engineColor} nozzleColor={nozzleColor} showJets={showJets} activePart={activePart} onPartSelect={onPartSelect} /><EnginePod x={75} y={75} color={engineColor} nozzleColor={nozzleColor} showJets={showJets} activePart={activePart} onPartSelect={onPartSelect} /></>}
        <path d={hullShapeType === 'triangle' ? "M50 10 L78 90 Q 50 95 22 90 Z" : "M30 15 L70 15 L75 85 Q 50 95 25 85 Z"} fill={hullColor} stroke={activePart === 'hull' ? '#fff' : 'rgba(0,0,0,0.3)'} strokeWidth={2} onClick={(e) => { e.stopPropagation(); onPartSelect('hull'); }} className="cursor-pointer" />
        <ShipGuns count={gunCount} gunColor={gunColor} gunBodyColor={gunBodyColor} activePart={activePart} onPartSelect={onPartSelect} />
        <ellipse cx="50" cy={cockpitY} rx="8" ry="13" fill={cockpitColor} stroke={activePart === 'cockpit' ? '#fff' : 'transparent'} strokeWidth={2} onClick={(e) => { e.stopPropagation(); onPartSelect('cockpit'); }} className="cursor-pointer" />
      </svg>
    </div>
  );
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<ExtendedGameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    const base: ExtendedGameState = {
      credits: INITIAL_CREDITS, selectedShipInstanceId: null, ownedShips: [],
      shipFittings: {}, shipColors: {}, shipWingColors: {}, shipCockpitColors: {}, 
      shipBeamColors: {}, shipGunColors: {}, shipGunBodyColors: {}, shipEngineColors: {}, shipBarColors: {}, shipNozzleColors: {},
      currentPlanet: null, currentMoon: null, currentMission: null, 
      currentQuadrant: QuadrantType.ALFA, conqueredMoonIds: [], 
      shipMapPosition: { [QuadrantType.ALFA]: { x: 50, y: 50 }, [QuadrantType.BETA]: { x: 50, y: 50 }, [QuadrantType.GAMA]: { x: 50, y: 50 }, [QuadrantType.DELTA]: { x: 50, y: 50 } }, 
      shipRotation: 0, orbitingEntityId: null, orbitAngle: 0, dockedPlanetId: 'p1', 
      tutorialCompleted: false, settings: { musicVolume: 0.3, sfxVolume: 0.5, musicEnabled: true, sfxEnabled: true, displayMode: 'windowed', autosaveEnabled: true }, 
      taskForceShipIds: [], activeTaskForceIndex: 0, pilotName: 'STRATOS', pilotAvatar: '👨‍🚀', gameInProgress: false, victories: 0, failures: 0,
      typeColors: {}
    };
    if (saved) try { 
      const parsed = JSON.parse(saved); 
      return { ...base, ...parsed };
    } catch(e) { return base; }
    return base;
  });

  const [screen, setScreenState] = useState<'intro' | 'hangar' | 'map' | 'game'>('intro');
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [storeIndex, setStoreIndex] = useState(0);
  const [isPaintOpen, setIsPaintOpen] = useState(false);
  const [isLoadoutOpen, setIsLoadoutOpen] = useState(false);
  const [activePart, setActivePart] = useState<ShipPart>('hull');

  useEffect(() => localStorage.setItem(SAVE_KEY, JSON.stringify(gameState)), [gameState]);

  const cheapestShips = useMemo(() => {
    return [...SHIPS].sort((a, b) => a.price - b.price).slice(0, 3);
  }, []);

  const hangarSlots = useMemo(() => {
    const slots = new Array(MAX_FLEET_SIZE).fill(null);
    gameState.ownedShips.forEach((ship, i) => { if (i < MAX_FLEET_SIZE) slots[i] = ship; });
    return slots;
  }, [gameState.ownedShips]);

  const selectedShipConfig = useMemo(() => {
    if (!gameState.selectedShipInstanceId) return null;
    const instance = gameState.ownedShips.find(s => s.instanceId === gameState.selectedShipInstanceId);
    return instance ? SHIPS.find(s => s.id === instance.shipTypeId) || null : null;
  }, [gameState.selectedShipInstanceId, gameState.ownedShips]);

  const visiblePlanets = useMemo(() => PLANETS.filter(p => p.quadrant === gameState.currentQuadrant), [gameState.currentQuadrant]);

  const isShipFree = (shipId: string) => cheapestShips.some(s => s.id === shipId);

  const buyShip = (shipTypeId: string, isReplacement = false) => {
    const ship = SHIPS.find(s => s.id === shipTypeId)!;
    const isFree = isShipFree(shipTypeId);
    if (!isFree && !isReplacement && gameState.credits < ship.price) { audioService.playSfx('denied'); return; }
    if (gameState.ownedShips.length >= MAX_FLEET_SIZE) { audioService.playSfx('denied'); return; }
    
    const instanceId = `ship_${Date.now()}`;
    const tc = gameState.typeColors[shipTypeId] || {};
    
    setGameState(p => ({
      ...p, credits: (isFree || isReplacement) ? p.credits : p.credits - ship.price, 
      ownedShips: [...p.ownedShips, { instanceId, shipTypeId }],
      selectedShipInstanceId: p.selectedShipInstanceId || instanceId,
      shipFittings: { ...p.shipFittings, [instanceId]: { weapons: isReplacement ? [{ id: WEAPONS[0].id, count: 1 }] : [], shieldId: null, secondShieldId: null, reactorLevel: 1, engineType: 'standard', rocketCount: 10, mineCount: 5, wingWeaponId: null, health: 100, ammoPercent: 100, lives: 3 } },
      shipColors: { ...p.shipColors, [instanceId]: tc.hull || ship.defaultColor || '#94a3b8' },
      shipWingColors: { ...p.shipWingColors, [instanceId]: tc.wings || '#64748b' },
      shipCockpitColors: { ...p.shipCockpitColors, [instanceId]: tc.cockpit || '#38bdf8' },
      shipGunColors: { ...p.shipGunColors, [instanceId]: tc.guns || '#60a5fa' },
      shipGunBodyColors: { ...p.shipGunBodyColors, [instanceId]: tc.gun_body || '#1c1917' },
      shipEngineColors: { ...p.shipEngineColors, [instanceId]: tc.engines || '#334155' },
      shipNozzleColors: { ...p.shipNozzleColors, [instanceId]: tc.nozzles || '#171717' }
    }));
    audioService.playSfx('buy');
    setIsStoreOpen(false);
  };

  const handleGameOver = (success: boolean, finalScore: number, wasAborted: boolean = false) => {
    setGameState(p => {
      let nextOwned = [...p.ownedShips];
      let nextFittings = { ...p.shipFittings };
      if (!success && !wasAborted && p.selectedShipInstanceId) {
        const cf = nextFittings[p.selectedShipInstanceId];
        if (cf) {
          const ul = cf.lives - 1;
          if (ul <= 0) {
            nextOwned = p.ownedShips.filter(s => s.instanceId !== p.selectedShipInstanceId);
            delete nextFittings[p.selectedShipInstanceId];
          } else {
            nextFittings[p.selectedShipInstanceId] = { ...cf, lives: ul, health: 25 };
          }
        }
      }
      const finalShips = nextOwned.length > 0 ? nextOwned : [];
      return {
        ...p, credits: success ? p.credits + finalScore * 2 : p.credits,
        victories: success ? p.victories + 1 : p.victories,
        failures: !success && !wasAborted ? p.failures + 1 : p.failures,
        ownedShips: finalShips, shipFittings: nextFittings,
        selectedShipInstanceId: finalShips.length > 0 ? (finalShips.find(s => s.instanceId === p.selectedShipInstanceId) ? p.selectedShipInstanceId : finalShips[0].instanceId) : null
      };
    });
    setScreenState('hangar');
  };

  const updateTypeColor = (part: ShipPart, color: string) => {
    if (!gameState.selectedShipInstanceId) return;
    const ship = gameState.ownedShips.find(s => s.instanceId === gameState.selectedShipInstanceId)!;
    const typeId = ship.shipTypeId;
    setGameState(p => {
      const utc = { ...p.typeColors, [typeId]: { ...(p.typeColors[typeId] || {}), [part]: color } };
      const nc = { ...p.shipColors }, nwc = { ...p.shipWingColors }, ncc = { ...p.shipCockpitColors }, ngc = { ...p.shipGunColors }, ngbc = { ...p.shipGunBodyColors }, nec = { ...p.shipEngineColors }, nnc = { ...p.shipNozzleColors };
      p.ownedShips.forEach(s => {
        if (s.shipTypeId === typeId) {
          if (part === 'hull') nc[s.instanceId] = color;
          if (part === 'wings') nwc[s.instanceId] = color;
          if (part === 'cockpit') ncc[s.instanceId] = color;
          if (part === 'guns') ngc[s.instanceId] = color;
          if (part === 'gun_body') ngbc[s.instanceId] = color;
          if (part === 'engines') nec[s.instanceId] = color;
          if (part === 'nozzles') nnc[s.instanceId] = color;
        }
      });
      return { ...p, typeColors: utc, shipColors: nc, shipWingColors: nwc, shipCockpitColors: ncc, shipGunColors: ngc, shipGunBodyColors: ngbc, shipEngineColors: nec, shipNozzleColors: nnc };
    });
  };

  return (
    <div className="w-full h-full bg-[#0c0a09] text-zinc-100 font-mono flex flex-col overflow-hidden select-none relative">
      <StarBackground />
      {screen === 'intro' && (
        <div className="flex-grow flex flex-col items-center justify-center p-6 gap-8 z-10 text-center max-w-2xl mx-auto">
          <h1 className="retro-font text-2xl md:text-4xl text-emerald-500 mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] uppercase tracking-widest">Galactic Defender</h1>
          <div className="space-y-4 bg-black/40 p-6 rounded-lg border border-emerald-500/20 backdrop-blur-md">
            <p className="text-[11px] leading-relaxed uppercase tracking-widest text-zinc-400">
              The galaxy is under siege. Most inexpensive ships are provided free to all pilots. 
              Combat is final after three tactical losses. Good luck, commander.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={() => { if (gameState.ownedShips.length === 0) buyShip(cheapestShips[0].id); setScreenState('hangar'); audioService.playSfx('transition'); }} className="py-4 bg-emerald-600/10 border-2 border-emerald-500/40 hover:bg-emerald-500/20 transition-all rounded-[6px] text-[10px] font-black uppercase tracking-[0.4em] shadow-lg">NEW OPERATION</button>
            {gameState.ownedShips.length > 0 && (
              <button onClick={() => { setScreenState('hangar'); audioService.playSfx('transition'); }} className="py-4 bg-blue-600/10 border-2 border-blue-500/40 hover:bg-blue-500/20 transition-all rounded-[6px] text-[10px] font-black uppercase tracking-[0.4em] shadow-lg">RESUME OPERATIONS</button>
            )}
          </div>
        </div>
      )}

      {screen === 'hangar' && (
        <div className="flex-grow flex flex-col p-4 md:p-6 space-y-4 overflow-hidden z-10">
          <header className="flex flex-wrap items-center justify-between gap-4 bg-zinc-950/60 p-4 border-2 border-zinc-800 rounded-[8px] backdrop-blur-md">
             <div className="flex items-center gap-4">
                <div className="text-3xl bg-zinc-900 w-14 h-14 flex items-center justify-center rounded-full border-2 border-emerald-500/20 shadow-lg">{gameState.pilotAvatar}</div>
                <div><h2 className="retro-font text-[10px] text-emerald-500 uppercase leading-none mb-1">Fleet Command</h2><p className="text-[10px] font-black uppercase tracking-widest">{gameState.pilotName}</p></div>
             </div>
             <div className="flex items-center gap-4 border-l-2 border-zinc-800 pl-4">
                <div className="text-center px-4"><div className="text-yellow-500 font-black text-sm md:text-lg">${gameState.credits.toLocaleString()}</div><p className="text-[8px] text-zinc-600 uppercase font-black">Resources</p></div>
                <div className="text-center px-4 border-l border-zinc-800"><div className="text-emerald-500 font-black text-sm md:text-lg">{gameState.victories}</div><p className="text-[8px] text-zinc-600 uppercase font-black">Victories</p></div>
             </div>
             <button onClick={() => setScreenState('intro')} className="px-4 py-2 bg-red-950/20 border border-red-900/40 text-[9px] text-red-400 uppercase font-black rounded">EXIT</button>
          </header>
          <div className="flex-grow flex flex-col md:flex-row items-stretch justify-center gap-4 md:gap-6 overflow-hidden">
            {hangarSlots.map((instance, idx) => (
              <div key={idx} className="flex flex-col w-full h-full md:w-1/3 transition-all relative min-h-0">
                <div className={`flex-grow relative rounded-[10px] border-2 flex flex-col items-center p-6 overflow-hidden ${instance ? 'border-zinc-800 bg-zinc-950/40' : 'border-dashed border-zinc-800 bg-transparent'}`}>
                  {instance ? (
                    <>
                      <button onClick={() => setGameState(p => ({ ...p, selectedShipInstanceId: instance.instanceId }))} className={`absolute top-4 right-4 w-10 h-10 rounded-full border-2 flex items-center justify-center z-50 ${gameState.selectedShipInstanceId === instance.instanceId ? 'bg-emerald-500 border-emerald-300' : 'bg-black/60 border-zinc-700'}`}>
                         <div className={`w-4 h-4 rounded-full ${gameState.selectedShipInstanceId === instance.instanceId ? 'bg-white animate-pulse shadow-[0_0_10px_white]' : 'bg-zinc-800'}`} />
                      </button>
                      <h3 className="w-full retro-font text-[9px] text-emerald-500 uppercase leading-none mb-1">{SHIPS.find(s => s.id === instance.shipTypeId)!.name}</h3>
                      <div className="w-full flex gap-1 mb-2">
                        {[1, 2, 3].map(life => (
                          <div key={life} className={`h-1.5 flex-grow rounded-full ${life <= (gameState.shipFittings[instance.instanceId]?.lives || 3) ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-zinc-800'}`} />
                        ))}
                      </div>
                      <div className="flex-grow w-full flex items-center justify-center p-4 min-h-0">
                        <ShipIcon config={SHIPS.find(s => s.id === instance.shipTypeId) as any} hullColor={gameState.shipColors[instance.instanceId]} wingColor={gameState.shipWingColors[instance.instanceId]} gunColor={gameState.shipGunColors[instance.instanceId]} gunBodyColor={gameState.shipGunBodyColors[instance.instanceId]} cockpitColor={gameState.shipCockpitColors[instance.instanceId]} engineColor={gameState.shipEngineColors[instance.instanceId]} nozzleColor={gameState.shipNozzleColors[instance.instanceId]} className="w-full h-full max-h-[180px] drop-shadow-2xl" />
                      </div>
                    </>
                  ) : ( 
                  <button onClick={() => setIsStoreOpen(true)} className="flex flex-col items-center justify-center gap-6 h-full opacity-40 hover:opacity-100 transition-all">
                    <div className="text-7xl">🛸</div>
                    <p className="retro-font text-[8px] uppercase border border-emerald-500/40 px-4 py-2 rounded">GET SHIP</p>
                  </button> 
                  )}
                </div>
                {instance && (
                  <div className="grid grid-cols-3 gap-1 mt-2">
                    <button onClick={() => { setGameState(p => ({ ...p, selectedShipInstanceId: instance.instanceId })); setIsPaintOpen(true); }} className="py-2 bg-zinc-900 border border-zinc-800 text-[9px] uppercase font-black rounded hover:bg-zinc-800">PAINT</button>
                    <button onClick={() => { setGameState(p => ({ ...p, selectedShipInstanceId: instance.instanceId })); setIsLoadoutOpen(true); }} className="py-2 bg-zinc-900 border border-zinc-700 text-[9px] uppercase font-black rounded hover:bg-zinc-800">EQUIP</button>
                    <button onClick={() => { sellShip(instance.instanceId); audioService.playSfx('buy'); }} className="py-2 bg-red-950/40 border border-red-900/40 text-[9px] text-red-500 uppercase font-black rounded hover:bg-red-900/60">SELL</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <footer className="flex items-center justify-center gap-4 pt-4 border-t-2 border-zinc-800 shrink-0">
             <button onClick={() => setIsStoreOpen(true)} className="flex-1 max-w-[200px] py-4 bg-zinc-900 border-2 border-zinc-800 text-zinc-400 text-[11px] font-black uppercase rounded hover:bg-zinc-800 shadow-lg">SHIPYARD</button>
             <button onClick={() => { repairAllShips(); audioService.playSfx('buy'); }} disabled={repairCost === 0} className="flex-1 max-w-[200px] py-4 border-2 text-[11px] font-black uppercase tracking-widest rounded transition-all bg-yellow-600/10 border-yellow-500/40 text-yellow-500 disabled:opacity-20 shadow-lg">REPAIR {repairCost > 0 ? `($${repairCost})` : ''}</button>
             <button onClick={() => { setScreenState('map'); audioService.playSfx('transition'); }} disabled={gameState.ownedShips.length === 0} className="flex-[2] max-w-[400px] py-4 bg-emerald-600/10 border-2 border-emerald-500/40 text-emerald-400 text-[11px] font-black uppercase tracking-[0.4em] rounded hover:bg-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-20">LAUNCH MISSION</button>
          </footer>
        </div>
      )}

      {isPaintOpen && gameState.selectedShipInstanceId && selectedShipConfig && (
        <div className="fixed inset-0 z-[7000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
           <div className="w-full max-w-4xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[85vh]">
              <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                 <div>
                   <h2 className="retro-font text-emerald-500 text-xs uppercase mb-1">Interactive Customization</h2>
                   <p className="text-[9px] text-zinc-500 uppercase font-black">Click on ship part to select, then pick color.</p>
                 </div>
                 <button onClick={() => setIsPaintOpen(false)} className="px-4 py-2 bg-red-950/20 border border-red-900/40 text-red-500 hover:text-white uppercase font-black text-[9px] rounded">DONE</button>
              </header>
              <div className="flex-grow flex p-6 gap-8 overflow-hidden">
                 <div className="w-3/5 flex items-center justify-center bg-black/60 rounded-lg border border-zinc-800 relative group p-16 shadow-inner">
                    <ShipIcon config={selectedShipConfig as any} hullColor={gameState.shipColors[gameState.selectedShipInstanceId]} wingColor={gameState.shipWingColors[gameState.selectedShipInstanceId]} cockpitColor={gameState.shipCockpitColors[gameState.selectedShipInstanceId]} gunColor={gameState.shipGunColors[gameState.selectedShipInstanceId]} gunBodyColor={gameState.shipGunBodyColors[gameState.selectedShipInstanceId]} engineColor={gameState.shipEngineColors[gameState.selectedShipInstanceId]} nozzleColor={gameState.shipNozzleColors[gameState.selectedShipInstanceId]} activePart={activePart} onPartSelect={setActivePart} className="w-full h-full drop-shadow-[0_0_40px_rgba(16,185,129,0.2)]" />
                 </div>
                 <div className="w-2/5 flex flex-col gap-6 overflow-y-auto custom-scrollbar p-2">
                    <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                      <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-3 border-b border-zinc-800 pb-2 flex justify-between"><span>Selected:</span><span className="text-emerald-500">{activePart?.toUpperCase()}</span></p>
                      <div className="grid grid-cols-5 gap-2">
                        {['#94a3b8','#64748b','#475569','#334155','#1e293b','#f87171','#ef4444','#b91c1c','#fbbf24','#d97706','#10b981','#059669','#3b82f6','#2563eb','#6366f1','#a855f7','#ec4899','#ffffff','#52525b','#171717'].map(c => (
                          <button key={c} onClick={() => { updateTypeColor(activePart, c); audioService.playSfx('click'); }} className={`aspect-square rounded-md border-2 transition-all hover:scale-110 shadow-lg ${ (gameState as any)[(activePart ? {hull:'shipColors',wings:'shipWingColors',cockpit:'shipCockpitColors',guns:'shipGunColors',gun_body:'shipGunBodyColors',engines:'shipEngineColors',nozzles:'shipNozzleColors',bars:'shipBarColors'}[activePart] : 'shipColors')][gameState.selectedShipInstanceId!] === c ? 'border-white scale-110 shadow-[0_0_10px_white]' : 'border-white/10 hover:border-white/50'}`} style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {['hull','wings','cockpit','guns','gun_body','engines','nozzles'].map(p => (
                        <button key={p} onClick={() => setActivePart(p as any)} className={`py-2.5 text-[9px] font-black uppercase rounded border transition-all ${activePart === p ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>{p}</button>
                      ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isLoadoutOpen && gameState.selectedShipInstanceId && (
        <div className="fixed inset-0 z-[7000] bg-black/90 flex items-center justify-center p-6 backdrop-blur-sm">
           <div className="w-full max-w-4xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[80vh] shadow-[0_0_80px_rgba(16,185,129,0.15)]">
              <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                 <h2 className="retro-font text-emerald-500 text-xs uppercase">Tactical Logistics Hub</h2>
                 <button onClick={() => setIsLoadoutOpen(false)} className="text-zinc-500 hover:text-white uppercase font-black text-[9px]">EXIT</button>
              </header>
              <div className="p-8 grid grid-cols-2 gap-12 overflow-y-auto custom-scrollbar">
                 <div className="space-y-6">
                    <h3 className="retro-font text-[9px] text-emerald-500 uppercase border-l-2 border-emerald-500 pl-3 tracking-widest mb-4">Weaponry</h3>
                    <div className="grid grid-cols-1 gap-4">
                       {WEAPONS.map(w => (
                          <div key={w.id} className="p-5 bg-zinc-900/40 border border-zinc-800 rounded-lg flex justify-between items-center group hover:border-emerald-500/40 transition-all shadow-md">
                             <div className="flex-grow"><div className="text-[11px] font-black uppercase text-white mb-1">{w.name}</div><div className="text-[9px] text-yellow-500 font-black mt-2">${w.price.toLocaleString()}</div></div>
                             <button onClick={() => { if (gameState.credits < w.price) { audioService.playSfx('denied'); return; } setGameState(p => ({ ...p, credits: p.credits - w.price, shipFittings: { ...p.shipFittings, [p.selectedShipInstanceId!]: { ...p.shipFittings[p.selectedShipInstanceId!], weapons: [{ id: w.id, count: 1 }] } } })); audioService.playSfx('buy'); }} className="px-6 py-3 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 text-[9px] font-black uppercase rounded hover:bg-emerald-500 hover:text-white shadow-lg">UPGRADE</button>
                          </div>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-6">
                    <h3 className="retro-font text-[9px] text-blue-500 uppercase border-l-2 border-blue-500 pl-3 tracking-widest mb-4">Defense & Ordinance</h3>
                    <div className="grid grid-cols-1 gap-4">
                       {SHIELDS.map(s => (
                          <div key={s.id} className="p-5 bg-zinc-900/40 border border-zinc-800 rounded-lg flex justify-between items-center hover:border-blue-500/40 transition-all shadow-md">
                             <div className="flex-grow"><div className="text-[11px] font-black uppercase text-white mb-1">{s.name}</div><div className="text-[9px] text-yellow-500 font-black mt-2">${s.price.toLocaleString()}</div></div>
                             <button onClick={() => { if (gameState.credits < s.price) { audioService.playSfx('denied'); return; } setGameState(p => ({ ...p, credits: p.credits - s.price, shipFittings: { ...p.shipFittings, [p.selectedShipInstanceId!]: { ...p.shipFittings[p.selectedShipInstanceId!], shieldId: s.id } } })); audioService.playSfx('buy'); }} className="px-6 py-3 bg-blue-600/10 border border-blue-500/30 text-blue-500 text-[9px] font-black uppercase rounded hover:bg-blue-500 hover:text-white shadow-lg">EQUIP SHIELD</button>
                          </div>
                       ))}
                       <div className="p-5 bg-zinc-900/40 border border-zinc-800 rounded-lg flex justify-between items-center hover:border-red-500/40 transition-all shadow-md">
                          <div className="flex-grow"><div className="text-[11px] font-black uppercase text-white mb-1">Guided Missiles Bundle</div><div className="text-[9px] text-yellow-500 font-black mt-2">$8,500</div></div>
                          <button onClick={() => { if (gameState.credits < 8500) { audioService.playSfx('denied'); return; } setGameState(p => ({ ...p, credits: p.credits - 8500, shipFittings: { ...p.shipFittings, [p.selectedShipInstanceId!]: { ...p.shipFittings[p.selectedShipInstanceId!], rocketCount: (p.shipFittings[p.selectedShipInstanceId!]?.rocketCount || 0) + 10 } } })); audioService.playSfx('buy'); }} className="px-6 py-3 bg-red-600/10 border border-red-500/30 text-red-500 text-[9px] font-black uppercase rounded hover:bg-red-500 hover:text-white shadow-lg">REFILL</button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isStoreOpen && (
        <div className="fixed inset-0 z-[6000] bg-black/90 flex items-center justify-center p-6">
          <div className="w-full max-w-4xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[80vh]">
            <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h2 className="retro-font text-emerald-500 text-xs uppercase">Military Shipyard</h2>
              <button onClick={() => setIsStoreOpen(false)} className="text-zinc-500 hover:text-white uppercase font-black text-[9px]">CLOSE</button>
            </header>
            <div className="flex-grow flex overflow-hidden">
              <div className="w-1/3 border-r border-zinc-800 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {SHIPS.map((s, idx) => (
                  <button key={s.id} onClick={() => setStoreIndex(idx)} className={`w-full p-3 text-left flex flex-col gap-1 rounded border transition-all ${storeIndex === idx ? 'bg-emerald-500/10 border-emerald-500 shadow-md' : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800/40'}`}>
                    <span className="text-[10px] font-black uppercase text-white">{s.name}</span>
                    <span className={`text-[9px] font-black ${isShipFree(s.id) ? 'text-emerald-400' : 'text-yellow-500'}`}>{isShipFree(s.id) ? `FREE` : `$${s.price.toLocaleString()}`}</span>
                  </button>
                ))}
              </div>
              <div className="flex-grow p-8 flex flex-col items-center justify-center bg-zinc-950/40 relative text-center">
                <ShipIcon config={SHIPS[storeIndex]} className="w-64 h-64 mb-6 drop-shadow-2xl" />
                <h3 className="retro-font text-sm text-emerald-500 uppercase mb-4">{SHIPS[storeIndex].name}</h3>
                <button onClick={() => buyShip(SHIPS[storeIndex].id)} disabled={(!isShipFree(SHIPS[storeIndex].id) && gameState.credits < SHIPS[storeIndex].price) || gameState.ownedShips.length >= MAX_FLEET_SIZE} className="w-full max-w-xs py-4 mt-6 bg-yellow-600/10 border-2 border-yellow-500/40 text-yellow-500 font-black uppercase rounded shadow-2xl text-xs disabled:opacity-20 hover:bg-yellow-500/20 transition-all">
                  {gameState.ownedShips.length >= MAX_FLEET_SIZE ? 'Hangar Full' : (isShipFree(SHIPS[storeIndex].id) ? 'CLAIM FREE SHIP' : `PURCHASE - $${SHIPS[storeIndex].price.toLocaleString()}`)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === 'map' && (
        <div className="flex-grow flex flex-col p-4 space-y-4 overflow-hidden z-10 animate-in fade-in duration-500 relative">
           <header className="flex items-center justify-between gap-4 bg-zinc-950/90 p-3 border-2 border-zinc-800 rounded-[8px] shrink-0 mt-4 shadow-2xl backdrop-blur-md">
              <h2 className="retro-font text-[8px] text-emerald-500 uppercase">Sector Map</h2>
              <div className="flex gap-1">
                 {[QuadrantType.ALFA, QuadrantType.BETA, QuadrantType.GAMA, QuadrantType.DELTA].map(q => (
                    <button key={q} onClick={() => { setGameState(p => ({ ...p, currentQuadrant: q, currentPlanet: null })); audioService.playSfx('click'); }} className={`px-3 py-1.5 border text-[8px] font-black uppercase rounded transition-all ${gameState.currentQuadrant === q ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>{q}</button>
                 ))}
              </div>
              <button onClick={() => setScreenState('hangar')} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-500 text-[8px] font-black uppercase rounded">BACK</button>
           </header>
           <div className="flex-grow relative bg-zinc-950/20 border-2 border-zinc-800 rounded-[12px] overflow-hidden flex items-center justify-center shadow-inner">
              <div className="flex flex-wrap items-center justify-center gap-12 p-12">
                {visiblePlanets.map(p => (
                  <div key={p.id} onClick={() => { setGameState(prev => ({ ...prev, currentPlanet: p })); audioService.playSfx('click'); }} className={`group p-4 border-2 rounded-[10px] cursor-pointer flex flex-col items-center transition-all ${gameState.currentPlanet?.id === p.id ? 'border-emerald-500 bg-emerald-500/10 scale-105 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'border-zinc-800/40 hover:border-zinc-700'}`}>
                    <div className="w-16 h-16 rounded-full mb-3 shadow-xl transition-transform group-hover:scale-110" style={{ backgroundColor: p.color, boxShadow: `inset -8px -8px 20px rgba(0,0,0,0.6), 0 0 15px ${p.color}44` }} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-white">{p.name}</p>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-6 right-6 z-[100] pointer-events-none">
                 {gameState.currentPlanet && (
                   <button onClick={() => { setScreenState('game'); audioService.playSfx('transition'); }} className="pointer-events-auto px-12 py-5 bg-emerald-600 border-2 border-emerald-400 text-white text-[11px] font-black uppercase tracking-[0.4em] rounded shadow-[0_0_50px_rgba(16,185,129,0.5)] hover:scale-110 transition-all">ENGAGE</button>
                 )}
              </div>
           </div>
        </div>
      )}

      {screen === 'game' && gameState.selectedShipInstanceId && (
        <div className="flex-grow relative overflow-hidden z-20">
          <GameEngine ships={gameState.ownedShips.filter(os => os.instanceId === gameState.selectedShipInstanceId).map(os => ({ config: SHIPS.find(s => s.id === os.shipTypeId)!, fitting: gameState.shipFittings[os.instanceId], color: gameState.shipColors[os.instanceId], gunColor: gameState.shipGunColors[os.instanceId] }))} shield={SHIELDS.find(s => s.id === gameState.shipFittings[gameState.selectedShipInstanceId!]?.shieldId) || null} difficulty={gameState.currentPlanet?.difficulty || 1} onGameOver={handleGameOver} />
        </div>
      )}
    </div>
  );
};

export default App;
