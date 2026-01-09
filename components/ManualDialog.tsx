
import React from 'react';

interface ManualDialogProps {
  isOpen: boolean;
  onClose: () => void;
  manualPage: number;
  setManualPage: (p: number) => void;
  fontSize: 'small' | 'medium' | 'large';
}

export const ManualDialog: React.FC<ManualDialogProps> = ({ isOpen, onClose, manualPage, setManualPage, fontSize }) => {
  if (!isOpen) return null;

  const titleSize = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');

  return (
    <div className="fixed inset-0 z-[9500] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
       <div className="w-full max-w-2xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-2xl h-[80vh]">
          <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h2 className={`retro-font text-emerald-400 ${titleSize} uppercase`}>Field Manual {manualPage}/2</h2>
              <button onClick={onClose} className={`text-zinc-500 ${btnSize} font-black hover:text-white`}>DONE</button>
          </header>
          <div className="flex-grow p-6 overflow-y-auto custom-scrollbar space-y-6 text-zinc-300 text-[10px] uppercase font-mono leading-relaxed relative">
              {manualPage === 1 ? (
                  <>
                      <section><h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Flight Controls</h3><ul className="list-disc pl-4 space-y-2"><li><span className="text-emerald-400">WASD / Arrows</span>: Navigation Thrusters</li><li><span className="text-emerald-400">Spacebar</span>: Main Cannons (Auto-fire)</li><li><span className="text-emerald-400">Hold Spacebar</span>: Charge Mega-Shot (Consumes Energy)</li><li><span className="text-emerald-400">Tab / Backslash</span>: Launch Missile (Homing)</li><li><span className="text-emerald-400">Enter / CapsLock</span>: Deploy Mine (Proximity)</li></ul></section>
                      <section><h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Ship Systems</h3><ul className="list-disc pl-4 space-y-2"><li><span className="text-blue-400">Energy Reactor</span>: Powers weapons and shields. Regenerates over time. Using turbo or heavy weapons drains this fast.</li><li><span className="text-amber-400">Fuel Reserves</span>: Consumed by movement. If depleted, you drift helplessly. Refuel at stations or collect blue canisters.</li><li><span className="text-red-400">Hull Integrity</span>: Your life. Reaches 0% = Critical Failure. Repair using Nanite Packs or at docking bays.</li></ul></section>
                  </>
              ) : (
                  <>
                      <section><h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Advanced Maneuvers</h3><ul className="list-disc pl-4 space-y-2"><li><span className="text-purple-400">Turbo Warp</span>: Press UP while at the top of the screen to engage warp speed. Consumes fuel rapidly but speeds up travel time.</li><li><span className="text-purple-400">Gun Swivel</span>: Hold CTRL while firing to angle your shots outwards. Useful for hitting wide formations.</li><li><span className="text-purple-400">Shield Management</span>: Shields absorb damage but drain energy to recharge. Matching shield color to enemy fire reduces damage taken.</li></ul></section>
                      <section><h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Combat Intel</h3><ul className="list-disc pl-4 space-y-2"><li><span className="text-yellow-400">Scavenging</span>: Destroyed asteroids drop resources. Use your tractor beam (automatic when close) to collect Gold, Platinum, and Ordnance.</li><li><span className="text-yellow-400">Boss Encounters</span>: Capital ships have massive shielding. Use EMP mines to strip shields before unleashing missiles.</li><li><span className="text-yellow-400">Exotic Tech</span>: Rare weapons found in the market offer unique firing patterns. Test them to find your style.</li></ul></section>
                  </>
              )}
          </div>
          <footer className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
              <button onClick={() => setManualPage(Math.max(1, manualPage - 1))} disabled={manualPage === 1} className={`px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 font-black ${btnSize} rounded uppercase ${manualPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-700'}`}>&lt; PREV</button>
              <div className="flex gap-1">
                  <div className={`w-2 h-2 rounded-full ${manualPage === 1 ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                  <div className={`w-2 h-2 rounded-full ${manualPage === 2 ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
              </div>
              <button onClick={() => setManualPage(Math.min(2, manualPage + 1))} disabled={manualPage === 2} className={`px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 font-black ${btnSize} rounded uppercase ${manualPage === 2 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-700'}`}>NEXT &gt;</button>
          </footer>
       </div>
    </div>
  );
};
