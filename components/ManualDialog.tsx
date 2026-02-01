
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
  const maxPages = 6;

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
                      <section>
                          <h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Flight Systems</h3>
                          <ul className="list-disc pl-4 space-y-2">
                              <li><span className="text-emerald-400">Arrow Keys / Numpad</span>: Navigation Thrusters</li>
                              <li><span className="text-emerald-400">Spacebar</span>: Main Energy Weapons (Auto-fire)</li>
                              <li><span className="text-blue-400">Ctrl / Numpad 0 / .</span>: Secondary Weapons (Ammo Based)</li>
                              <li><span className="text-purple-400">Caps Lock</span>: Capacitor Overdrive (Power Shot)</li>
                              <li><span className="text-purple-400">S Key</span>: Toggle Shields (Silent Running)</li>
                              <li><span className="text-zinc-400">P Key</span>: Pause Simulation</li>
                          </ul>
                      </section>
                      <section>
                          <h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1 mt-4">Ordnance & Systems</h3>
                          <ul className="list-disc pl-4 space-y-2">
                              <li><span className="text-red-400">Tab / Numpad +</span>: Launch Homing Missile</li>
                              <li><span className="text-amber-400">Shift</span>: Deploy Mine (Directional)</li>
                              <li><span className="text-amber-400">Enter</span>: Deploy Dual Mines</li>
                              <li><span className="text-red-500 font-bold">B Key</span>: Omega Mine (Mass Destruction)</li>
                              <li><span className="text-blue-300">F / H / E / R</span>: Manual Inject (Fuel, Water, Energy, Reload)</li>
                          </ul>
                      </section>
                      <div className="mt-4 p-2 bg-zinc-900/50 border border-zinc-700/50 rounded text-center">
                          <p className="text-zinc-500 italic text-[9px]">"Manual injection requires resources in Cargo Hold"</p>
                      </div>
                  </>
              );
          case 3: // SECRET PROTOCOLS: ENERGY
              return (
                  <div className="space-y-6">
                      <section>
                          <h3 className="text-purple-400 font-black mb-4 border-b border-purple-900/50 pb-2">CLASSIFIED PROTOCOLS: ENERGY</h3>
                          <ul className="list-none space-y-4">
                              <li className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-white font-bold">CAPACITOR OVERDRIVE</span>
                                      <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded border border-purple-700">CAPSLOCK</span>
                                  </div>
                                  <p className="text-zinc-400">Locks capacitor output to "Weapon Mode". Main guns fire high-yield Power Shots automatically. <span className="text-red-400">Warning: Drains Energy rapidly.</span></p>
                              </li>
                              <li className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-white font-bold">SILENT RUNNING</span>
                                      <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded border border-purple-700">S KEY</span>
                                  </div>
                                  <p className="text-zinc-400">Toggles Shields ON/OFF. Disabling shields eliminates their passive energy drain, allowing significantly faster Capacitor recharge for offensive strikes.</p>
                              </li>
                              <li className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-white font-bold">TACTICAL PAUSE</span>
                                      <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded border border-purple-700">P KEY</span>
                                  </div>
                                  <p className="text-zinc-400">Freezes the battle simulation to assess tactical positioning or take a break.</p>
                              </li>
                          </ul>
                      </section>
                  </div>
              );
          case 4: // SECRET PROTOCOLS: ORDNANCE
              return (
                  <div className="space-y-6">
                      <section>
                          <h3 className="text-red-400 font-black mb-4 border-b border-red-900/50 pb-2">CLASSIFIED PROTOCOLS: ORDNANCE</h3>
                          <ul className="list-none space-y-4">
                              <li className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-white font-bold">OMEGA DROP</span>
                                      <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-700">B KEY</span>
                                  </div>
                                  <p className="text-zinc-400">Deploys the <span className="text-red-400 font-bold">Omega Mine</span>. Requires Red Mine inventory. Creates a massive area-of-effect blast that clears most screens.</p>
                              </li>
                              <li className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-white font-bold">DUAL DEPLOYMENT</span>
                                      <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-700">ENTER</span>
                                  </div>
                                  <p className="text-zinc-400">Releases two standard mines simultaneously from both wing mounts, creating a pincer trap for pursuing hostiles.</p>
                              </li>
                              <li className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-white font-bold">WING INDEPENDENT FIRE</span>
                                      <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-700">NUMPAD 0 / .</span>
                                  </div>
                                  <p className="text-zinc-400">Manually triggers left (0) or right (.) auxiliary wing weapons without firing the main gun. Critical for conserving main reactor energy while maintaining suppression.</p>
                              </li>
                          </ul>
                      </section>
                  </div>
              );
          case 5: // STRATEGY
              return (
                  <>
                      <section><h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Command Directive</h3>
                          <div className="bg-emerald-900/20 border border-emerald-500/30 p-3 rounded mb-4">
                              <p className="text-emerald-300 font-bold mb-2">Before battle, equip your spaceship with items from the galactic market.</p>
                              <ul className="list-disc pl-4 space-y-1 text-emerald-100/80">
                                  <li>Make sure you have a <span className="text-blue-300">Shield Generator</span> installed.</li>
                                  <li>Stockpile <span className="text-blue-300">Water</span> and <span className="text-orange-300">Fuel</span> for long engagements.</li>
                                  <li>Ensure sufficient <span className="text-amber-300">Ammo</span> for ballistic weapons.</li>
                                  <li>Load <span className="text-red-300">Ordnance</span> (Missiles/Mines) for heavy targets.</li>
                              </ul>
                              <p className="text-emerald-300 font-bold mt-2">Be prepared for any battle. Make commerce and defend our galaxy.</p>
                          </div>
                      </section>
                      <section><h3 className="text-white font-black mb-2 border-b border-zinc-800 pb-1">Combat Intel</h3><ul className="list-disc pl-4 space-y-2"><li><span className="text-yellow-400">Scavenging</span>: Destroyed asteroids drop resources. Use your tractor beam (automatic when close) to collect Gold, Platinum, and Ordnance.</li><li><span className="text-yellow-400">Boss Encounters</span>: Capital ships have massive shielding. Use EMP mines to strip shields before unleashing missiles.</li><li><span className="text-yellow-400">Market Economy</span>: Buy low, sell high. Resource prices fluctuate between systems.</li></ul></section>
                  </>
              );
          case 6: // CREDITS
              return (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                      <div>
                          <h3 className="text-emerald-500 font-black text-xl mb-2">GALACTIC DEFENDER</h3>
                          <p className="text-zinc-500 text-[10px]">VERSION BETA 35 (TEST)</p>
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
                  {manualPage === 3 && "Secret Protocols I"}
                  {manualPage === 4 && "Secret Protocols II"}
                  {manualPage === 5 && "Tactical Data"}
                  {manualPage === 6 && "System Credits"}
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
