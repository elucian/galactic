
import React from 'react';

interface ManualDialogProps {
  isOpen: boolean;
  onClose: () => void;
  manualPage: number;
  setManualPage: (p: number) => void;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
}

export const ManualDialog: React.FC<ManualDialogProps> = ({ isOpen, onClose, manualPage, setManualPage, fontSize }) => {
  if (!isOpen) return null;

  const titleSize = fontSize === 'small' ? 'text-[11px]' : (fontSize === 'large' ? 'text-[16px]' : 'text-[13px]');
  const btnSize = fontSize === 'small' ? 'text-[10px]' : (fontSize === 'large' ? 'text-[14px]' : 'text-[12px]');
  const maxPages = 4;

  const renderContent = () => {
      switch(manualPage) {
          case 1: // STORY (Expanded Text)
              return (
                  <div className="space-y-6">
                      <section>
                          <h3 className="text-emerald-500 font-black mb-4 border-b border-emerald-900/50 pb-2 text-lg">THE FRONTIER PROTOCOL</h3>
                          <p className="text-zinc-300 mb-4 text-justify">
                              The "Stellar Bloom" was humanity's crowning achievement. Faster-than-light travel opened the floodgates to the Outer Rim, and we built paradises on a hundred worlds, believing we were the masters of the void. But the silence between the stars was not empty; it was waiting. We ventured too greedily into the deep dark of Sector Delta and woke something ancient. The first transmission we received wasn't a greeting—it was a scream from the colony on Aegis IV before it went silent forever.
                          </p>
                          <p className="text-zinc-300 mb-4 text-justify">
                              It started with the "Hollow Worlds"—frontier outposts that went dark overnight. Reconnaissance drones returned images of surfaces stripped of all organic matter, oceans drained, and atmospheres ignited. No distress signals, no survivors. Just cold, dead rock left spinning in the dark. The enemy doesn't just conquer; they harvest. They are dismantling our civilization piece by piece to fuel their war machine.
                          </p>
                          <p className="text-zinc-300 mb-4 text-justify">
                              The <span className="text-red-400 font-bold">Xenos Coalition</span> is not a civilization as we understand it. They are a galactic immune system, and we are the infection. They are a bio-mechanical hive mind that constructs massive Dyson Swarms from the bones of conquered planets. Intelligence reports suggest they are building a singularity weapon around a dying star in the Deep Core, powered by the biomass of our fallen colonies.
                          </p>
                          <p className="text-zinc-300 text-justify">
                              The Galactic Defense Initiative (GDI) is shattered. The main fleet was decimated at the Battle of the Red Giants. You are a Commander of the <span className="text-blue-400 font-bold">Vanguard Division</span>, leading a task force of the few remaining combat-ready interceptors. You are the shield for the defenseless, the sword in the dark. Your mission is to disrupt their supply lines, break their blockade, and buy humanity enough time to evacuate the Core Systems. Good luck, Commander.
                          </p>
                      </section>
                      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded">
                          <p className="text-zinc-400 italic">"They have numbers. They have technology. They have no fear. But they also have no soul. That is where we will break them."</p>
                          <p className="text-zinc-500 text-right mt-2">- Admiral Vance, Last Transmission from Aegis IV</p>
                      </div>
                  </div>
              );
          case 2: // CONTROLS
              return (
                  <>
                      <section><h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Flight Systems</h3><ul className="list-disc pl-4 space-y-2"><li><span className="text-emerald-400">WASD / Arrows</span>: Navigation Thrusters</li><li><span className="text-emerald-400">Spacebar</span>: Main Cannons (Auto-fire)</li><li><span className="text-emerald-400">Hold Spacebar</span>: Charge Mega-Shot (Consumes Energy)</li><li><span className="text-emerald-400">Tab / Backslash</span>: Launch Missile (Homing)</li><li><span className="text-emerald-400">Enter / CapsLock</span>: Deploy Mine (Proximity)</li></ul></section>
                      <section><h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Ship Status</h3><ul className="list-disc pl-4 space-y-2"><li><span className="text-blue-400">Energy Reactor</span>: Powers weapons and shields. Regenerates over time. Heavy fire drains this rapidly.</li><li><span className="text-amber-400">Fuel Reserves</span>: Consumed by movement. If depleted, you drift helplessly. Refuel at stations or collect blue canisters.</li><li><span className="text-red-400">Hull Integrity</span>: Your life. Reaches 0% = Critical Failure. Repair using Nanite Packs or at docking bays.</li></ul></section>
                  </>
              );
          case 3: // STRATEGY
              return (
                  <>
                      <section><h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Advanced Maneuvers</h3><ul className="list-disc pl-4 space-y-2"><li><span className="text-purple-400">Turbo Warp</span>: Press UP while at the top of the screen to engage warp speed. Consumes fuel rapidly but speeds up travel time.</li><li><span className="text-purple-400">Shield Harmonics</span>: Shields absorb damage but drain energy. Different shield colors offer no resistance bonus yet, but look cool.</li></ul></section>
                      <section><h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Combat Intel</h3><ul className="list-disc pl-4 space-y-2"><li><span className="text-yellow-400">Scavenging</span>: Destroyed asteroids drop resources. Use your tractor beam (automatic when close) to collect Gold, Platinum, and Ordnance.</li><li><span className="text-yellow-400">Boss Encounters</span>: Capital ships have massive shielding. Use EMP mines to strip shields before unleashing missiles.</li><li><span className="text-yellow-400">Market Economy</span>: Buy low, sell high. Resource prices fluctuate between systems.</li></ul></section>
                  </>
              );
          case 4: // CREDITS
              return (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                      <div>
                          <h3 className="text-emerald-500 font-black text-xl mb-2">GALACTIC DEFENDER</h3>
                          <p className="text-zinc-500 text-[10px]">VERSION BETA 34</p>
                      </div>
                      
                      <div className="space-y-2">
                          <p className="text-zinc-400 text-[10px] uppercase font-black">Developed By</p>
                          <div className="text-white text-lg font-black tracking-widest border-2 border-white p-4 inline-block bg-zinc-900">
                              SAGE-CODE LABORATORY
                          </div>
                      </div>

                      <div className="space-y-2">
                          <p className="text-zinc-400 text-[10px] uppercase font-black">Powered By</p>
                          <div className="flex items-center justify-center gap-2 text-blue-400 font-black text-lg">
                              <span>✦</span> GOOGLE GEMINI API <span>✦</span>
                          </div>
                      </div>

                      <div className="mt-8 pt-8 border-t border-zinc-800 w-full">
                          <p className="text-zinc-600 italic">"Ad Astra Per Aspera"</p>
                      </div>
                  </div>
              );
          default: return null;
      }
  };

  return (
    <div className="fixed inset-0 z-[9500] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
       <div className="w-full max-w-2xl bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-2xl h-[80vh]">
          <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h2 className={`retro-font text-emerald-400 ${titleSize} uppercase`}>
                  {manualPage === 1 && "Mission Background"}
                  {manualPage === 2 && "Flight Controls"}
                  {manualPage === 3 && "Tactical Data"}
                  {manualPage === 4 && "System Credits"}
                  <span className="ml-4 text-zinc-600 text-[10px] font-mono tracking-widest">PG {manualPage}/{maxPages}</span>
              </h2>
              <button onClick={onClose} className={`text-zinc-500 ${btnSize} font-black hover:text-white`}>DONE</button>
          </header>
          <div className="flex-grow p-6 overflow-y-auto custom-scrollbar text-zinc-300 text-[10px] uppercase font-mono leading-relaxed relative bg-black/40">
              {renderContent()}
          </div>
          <footer className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
              <button onClick={() => setManualPage(Math.max(1, manualPage - 1))} disabled={manualPage === 1} className={`px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 font-black ${btnSize} rounded uppercase ${manualPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-700'}`}>&lt; PREV</button>
              <div className="flex gap-2">
                  {Array.from({length: maxPages}).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full transition-colors duration-300 ${manualPage === i + 1 ? 'bg-emerald-500 scale-125' : 'bg-zinc-700'}`} />
                  ))}
              </div>
              <button onClick={() => setManualPage(Math.min(maxPages, manualPage + 1))} disabled={manualPage === maxPages} className={`px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 font-black ${btnSize} rounded uppercase ${manualPage === maxPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-700'}`}>NEXT &gt;</button>
          </footer>
       </div>
    </div>
  );
};
