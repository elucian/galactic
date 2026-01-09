
import React, { useState, useEffect, useRef } from 'react';
import { Planet, QuadrantType, MissionType } from '../types.ts';
import { PLANETS } from '../constants.ts';
import { getMissionBriefing } from '../services/geminiService.ts';

interface SectorMapProps {
  currentQuadrant: QuadrantType;
  onLaunch: (planet: Planet) => void;
  onBack: () => void;
}

const SectorMap: React.FC<SectorMapProps> = ({ currentQuadrant, onLaunch, onBack }) => {
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [briefing, setBriefing] = useState<string>("");
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);

  const selectedPlanet = PLANETS.find(p => p.id === selectedPlanetId);

  useEffect(() => {
    let animId: number;
    const animate = () => {
      setRotation(prev => prev + 0.0005);
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    if (selectedPlanet) {
      setIsLoadingBriefing(true);
      setBriefing("");
      getMissionBriefing(selectedPlanet.name, MissionType.ATTACK, selectedPlanet.difficulty)
        .then(text => {
          setBriefing(text);
          setIsLoadingBriefing(false);
        })
        .catch(() => {
          setBriefing("Unable to establish secure uplink.");
          setIsLoadingBriefing(false);
        });
    }
  }, [selectedPlanetId]);

  const getQuadrantAngle = (q: QuadrantType) => {
    switch(q) {
      case QuadrantType.ALFA: return 0;
      case QuadrantType.BETA: return Math.PI / 2;
      case QuadrantType.GAMA: return Math.PI;
      case QuadrantType.DELTA: return Math.PI * 1.5;
    }
  };

  const renderOrbits = () => (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
      {[20, 35, 50, 65, 80].map((r, i) => (
        <circle key={i} cx="50%" cy="50%" r={`${r}%`} fill="none" stroke="#10b981" strokeWidth="0.5" strokeDasharray="4 4" />
      ))}
      <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#10b981" strokeWidth="0.5" />
      <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="#10b981" strokeWidth="0.5" />
    </svg>
  );

  return (
    <div className="w-full h-full bg-black relative flex overflow-hidden">
      <div className="flex-grow relative overflow-hidden bg-[radial-gradient(circle_at_center,_#0c4a6e_0%,_#000_70%)]">
        {renderOrbits()}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full blur-[40px] animate-pulse opacity-50" />
        <div className="absolute inset-0 transition-transform duration-1000 ease-out" style={{ transform: `scale(${zoom})` }}>
          {PLANETS.map((planet, i) => {
            const qAngle = getQuadrantAngle(planet.quadrant);
            const offset = (i % 3) * 0.3; 
            const angle = qAngle + 0.2 + offset + rotation;
            const dist = 15 + (planet.orbitRadius / 150) * 30; 
            const left = 50 + Math.cos(angle) * dist;
            const top = 50 + Math.sin(angle) * dist;
            const isSelected = selectedPlanetId === planet.id;

            return (
              <button
                key={planet.id}
                onClick={() => setSelectedPlanetId(planet.id)}
                className={`absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-300 z-10 group ${isSelected ? 'bg-white border-emerald-400 shadow-[0_0_15px_#34d399] scale-150' : 'bg-black border-zinc-600 hover:border-white hover:scale-125'}`}
                style={{ left: `${left}%`, top: `${top}%`, borderColor: planet.color }}
              >
                <div className={`absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <div className="flex flex-col items-start bg-black/80 px-2 py-1 rounded border border-zinc-700">
                    <span className="text-[10px] font-black text-emerald-400 uppercase">{planet.name}</span>
                    <span className="text-[8px] text-zinc-500 uppercase">{planet.quadrant} SEC</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="absolute top-4 left-4 text-emerald-500/20 retro-font text-4xl font-black select-none pointer-events-none">ALFA</div>
        <div className="absolute top-4 right-4 text-amber-500/20 retro-font text-4xl font-black select-none pointer-events-none">BETA</div>
        <div className="absolute bottom-4 left-4 text-blue-500/20 retro-font text-4xl font-black select-none pointer-events-none">DELTA</div>
        <div className="absolute bottom-4 right-4 text-purple-500/20 retro-font text-4xl font-black select-none pointer-events-none">GAMA</div>
      </div>

      <div className={`w-80 border-l-2 border-zinc-800 bg-zinc-950/95 flex flex-col transition-all duration-300 ${selectedPlanet ? 'translate-x-0' : 'translate-x-full absolute right-0 h-full'}`}>
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h2 className="retro-font text-emerald-500 text-xs uppercase">Target Intel</h2>
          <button onClick={onBack} className="text-zinc-500 hover:text-white text-[10px] uppercase font-black">BACK</button>
        </div>
        
        {selectedPlanet ? (
          <div className="p-6 flex flex-col gap-6 flex-grow overflow-y-auto custom-scrollbar">
            <div className="aspect-square w-full rounded-lg border-2 border-zinc-700 relative overflow-hidden flex items-center justify-center bg-black">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_100%)] z-10" />
               <div className="w-32 h-32 rounded-full shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.8)] relative" style={{ backgroundColor: selectedPlanet.color }}>
                  {selectedPlanet.hasRings && <div className="absolute inset-0 border-[4px] border-white/20 rounded-full scale-[1.4] -rotate-12" />}
                  <div className="absolute inset-0 rounded-full shadow-[0_0_30px_currentColor]" style={{ color: selectedPlanet.color }} />
               </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-black text-white uppercase leading-none mb-1">{selectedPlanet.name}</h3>
                <span className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase">SECTOR {selectedPlanet.quadrant} // {selectedPlanet.status}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                 <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                    <div className="text-[8px] text-zinc-500 uppercase">THREAT LEVEL</div>
                    <div className="text-lg text-red-400 font-black">CLASS {selectedPlanet.difficulty}</div>
                 </div>
                 <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                    <div className="text-[8px] text-zinc-500 uppercase">GRAVITY</div>
                    <div className="text-lg text-blue-400 font-black">{(selectedPlanet.size).toFixed(1)} G</div>
                 </div>
              </div>

              <div className="space-y-2">
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Tactical Briefing</span>
                <p className={`text-[10px] leading-relaxed uppercase border-l-2 border-emerald-700 pl-3 ${isLoadingBriefing ? 'animate-pulse text-zinc-600' : 'text-zinc-400'}`}>
                  {isLoadingBriefing ? "Intercepting enemy transmission..." : (briefing || selectedPlanet.description)}
                </p>
              </div>
            </div>

            <div className="mt-auto pt-6 space-y-3">
               <button onClick={() => onLaunch(selectedPlanet)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs rounded shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all">INITIATE MISSION</button>
               <button onClick={() => setSelectedPlanetId(null)} className="w-full py-3 bg-zinc-900 text-zinc-500 hover:text-white font-black uppercase text-[10px] rounded border border-zinc-800">CANCEL LOCK</button>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center text-zinc-600 text-xs font-mono uppercase">Waiting for target lock...</div>
        )}
      </div>
    </div>
  );
};

export default SectorMap;
