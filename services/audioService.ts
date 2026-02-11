
import { QuadrantType } from '../types';

const THEME_TRACKS = {
    active: {
        combat: 'https://audio.jukehost.co.uk/BCVuKwzsaGrIAxF0f9qWSsn12cZRvXAa',
        command: 'https://audio.jukehost.co.uk/4qDUYKMPFFJBHGOoSZCplXiTOCxc0MqG',
        intro: 'https://audio.jukehost.co.uk/nG2IbB7rvgudhgBpEFQpbVmJuB63oHKk',
        map: 'https://audio.jukehost.co.uk/vol5UySmAxBIacpCD1YNAJZW0JRSeIvA',
        victory: 'https://audio.jukehost.co.uk/85T6AXXtiiJ4p4tvwfDj1sEDeOrJaJd4'
    },
    serene: {
        combat: 'https://audio.jukehost.co.uk/NoGgEM2cQJuXjzMJdnI8oYUmltNOLbQ9',
        command: 'https://audio.jukehost.co.uk/3ZZqwmK9g6scMKkC5JIplNdkKh7Ikpw7',
        intro: 'https://audio.jukehost.co.uk/ZbdDlfYKm0RdJBOcpHVOmUxpiqUH1shZ',
        map: 'https://audio.jukehost.co.uk/EjdyyAlswTSkbuvGUoYJ1yveztHJbkhe',
        victory: 'https://audio.jukehost.co.uk/lD2vEr4u5Dh7mNMvRREOGSoDg02OZqai'
    },
    heroic: {
        combat: 'https://audio.jukehost.co.uk/qS0yc9NdOoENDLS7nvQnj64jQYOKO6Y5',
        command: 'https://audio.jukehost.co.uk/cdC0OXuBSnoNBj27KiS3Hqmx9lHOzLPp',
        intro: 'https://audio.jukehost.co.uk/FUtiaNWv0HP4mkYD16g14AtpcOmvGGwA',
        map: 'https://audio.jukehost.co.uk/BWMGHCLEPlh2DUHTUerwIy73EMc3g0vo',
        victory: 'https://audio.jukehost.co.uk/F37VhVCJmIMudh3fqhExbuLDrekGXRRU'
    }
};

// --- MAIN SERVICE ---

class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  // Music State
  private currentAudio: HTMLAudioElement | null = null;
  private currentTrackId: string | null = null; // Stores the logical scene name (e.g., 'command', 'combat')
  private currentTheme: 'active' | 'serene' | 'heroic' = 'active';
  private musicVolume = 0.3;
  private sfxVolume = 0.5;
  private musicEnabled = true;
  private sfxEnabled = true;
  private trackCache: Record<string, HTMLAudioElement> = {};
  
  // SFX Buffers & Nodes
  private whiteNoise: AudioBuffer | null = null;
  private brownNoise: AudioBuffer | null = null; // For deep rumbles (Engines/Explosions)
  
  // Active SFX Loops
  private reEntryNodes: any = null;
  private landingNodes: any = null;
  private warpNodes: any = null;
  private launchNodes: any = null;

  init() {
      if (!this.ctx) {
          const AC = (window.AudioContext || (window as any).webkitAudioContext);
          if (AC) {
              this.ctx = new AC();
              this.masterGain = this.ctx.createGain();
              this.masterGain.connect(this.ctx.destination);
              
              this.sfxGain = this.ctx.createGain();
              this.sfxGain.connect(this.masterGain);
              
              // Master Dynamics Compressor to glue sounds together
              const limiter = this.ctx.createDynamicsCompressor();
              limiter.threshold.value = -8;
              limiter.knee.value = 30;
              limiter.ratio.value = 12;
              limiter.attack.value = 0.003;
              limiter.release.value = 0.25;
              
              this.masterGain.disconnect();
              this.masterGain.connect(limiter);
              limiter.connect(this.ctx.destination);
              
              // Generate Noise Buffers
              this.whiteNoise = this.createNoiseBuffer('white');
              this.brownNoise = this.createNoiseBuffer('brown');

              this.updateVolumes();
          }
      }
      if (this.ctx?.state === 'suspended') {
          this.ctx.resume().catch(() => {});
      }
  }

  private createNoiseBuffer(type: 'white' | 'brown'): AudioBuffer {
      const size = this.ctx!.sampleRate * 2; // 2 seconds
      const buffer = this.ctx!.createBuffer(1, size, this.ctx!.sampleRate);
      const data = buffer.getChannelData(0);
      
      if (type === 'white') {
          for (let i = 0; i < size; i++) {
              data[i] = Math.random() * 2 - 1;
          }
      } else {
          // Brown noise generation (Integrated White Noise)
          let lastOut = 0;
          for (let i = 0; i < size; i++) {
              const white = Math.random() * 2 - 1;
              lastOut = (lastOut + (0.02 * white)) / 1.02;
              data[i] = lastOut * 3.5; // Compensate gain
          }
      }
      return buffer;
  }

  // --- REUSABLE TURBINE GENERATOR ---
  private createTurbineSound() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return null;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(50, t);
      
      let noise = null;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.value = 0.3; // Mix level for noise

      if (this.whiteNoise) {
          noise = this.ctx.createBufferSource();
          noise.buffer = this.whiteNoise;
          noise.loop = true;
          noise.connect(noiseGain);
          noise.start(t);
      }

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 6; // High Q creates the "whistle"
      filter.frequency.setValueAtTime(200, t);

      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0, t);

      osc.connect(filter);
      noiseGain.connect(filter);
      
      filter.connect(masterGain);
      masterGain.connect(this.sfxGain);
      
      osc.start(t);
      
      return { osc, noise, filter, masterGain };
  }

  setTheme(t: 'active' | 'serene' | 'heroic') { 
      if (this.currentTheme === t) return;
      this.currentTheme = t;
      
      // If music is playing, switch track immediately
      if (this.currentTrackId && this.currentAudio && !this.currentAudio.paused) {
          const trackId = this.currentTrackId; // Preserve current logical track
          // Temporarily nullify currentTrackId to force playTrack to re-evaluate
          this.currentTrackId = null; 
          this.playTrack(trackId);
      }
  }

  setQuadrant(q: QuadrantType) { }

  setMusicVolume(v: number) { 
      this.musicVolume = v; 
      if (this.currentAudio) {
          this.currentAudio.volume = this.musicEnabled ? this.musicVolume : 0;
      }
  }

  setSfxVolume(v: number) { 
      this.sfxVolume = v; 
      this.updateVolumes(); 
  }

  setMusicEnabled(e: boolean) { 
      this.musicEnabled = e; 
      if (this.currentAudio) {
          this.currentAudio.volume = e ? this.musicVolume : 0;
          if (e && this.currentAudio.paused) this.currentAudio.play().catch(() => {});
          else if (!e && !this.currentAudio.paused) this.currentAudio.pause();
      } else if (e && this.currentTrackId) {
          this.playTrack(this.currentTrackId);
      }
  }

  setSfxEnabled(e: boolean) { 
      this.sfxEnabled = e; 
      this.updateVolumes(); 
  }

  private updateVolumes() {
      if(this.ctx && this.sfxGain) {
          const t = this.ctx.currentTime;
          this.sfxGain.gain.setTargetAtTime(this.sfxEnabled ? this.sfxVolume : 0, t, 0.1);
      }
  }

  playTrack(scene: string) {
      let trackKey = scene;
      if (scene === 'hangar') trackKey = 'command';
      if (scene === 'game') trackKey = 'combat';
      
      const themeData = THEME_TRACKS[this.currentTheme];
      if (!themeData || !themeData[trackKey as keyof typeof themeData]) return;

      const url = themeData[trackKey as keyof typeof themeData];

      if (this.currentTrackId === trackKey && this.currentAudio && !this.currentAudio.paused && this.currentAudio.src === url) return;

      this.stopMusic();

      this.currentTrackId = trackKey;

      if (!this.trackCache[url]) {
          this.trackCache[url] = new Audio(url);
          this.trackCache[url].loop = true;
          this.trackCache[url].preload = 'auto';
      }

      const audio = this.trackCache[url];
      this.currentAudio = audio;
      
      if (audio.paused || audio.currentTime > 0) {
           audio.currentTime = 0; 
      }
      
      audio.volume = this.musicEnabled ? this.musicVolume : 0;
      
      if (this.musicEnabled) {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
              playPromise.catch(error => {
                  console.warn("Audio auto-play prevented:", error);
              });
          }
      }
  }
  
  pauseMusic() { if (this.currentAudio) this.currentAudio.pause(); }
  resumeMusic() { if (this.currentAudio && this.musicEnabled) this.currentAudio.play().catch(() => {}); }
  
  stopMusic() {
      if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
          this.currentAudio = null;
      }
  }
  
  stop() { 
      this.stopMusic(); 
      this.currentTrackId = null; 
      this.stopBattleSounds(); 
  }

  // --- HIGH QUALITY SFX ---

  playSfx(id: string) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.connect(g); g.connect(this.sfxGain);
      
      if (id === 'click') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, t);
          osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
          g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          osc.start(t); osc.stop(t + 0.05);
      } else if (id === 'buy') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(600, t); osc.frequency.linearRampToValueAtTime(1000, t + 0.1);
          g.gain.setValueAtTime(0.1, t); g.gain.linearRampToValueAtTime(0, t + 0.15);
          osc.start(t); osc.stop(t + 0.15);
      } else if (id === 'denied') {
          osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, t);
          osc.frequency.linearRampToValueAtTime(100, t + 0.2);
          g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.start(t); osc.stop(t + 0.2);
      }
  }
  
  playWeaponFire(type: string, pan = 0, variantId?: string) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const t = this.ctx.currentTime;
      
      const masterG = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      masterG.connect(panner); panner.connect(this.sfxGain);

      const detune = (Math.random() - 0.5) * 100; 

      if (type.includes('laser') || type.includes('mega')) {
           const osc = this.ctx.createOscillator();
           const g = this.ctx.createGain();
           osc.connect(g); g.connect(masterG);
           
           osc.type = 'square'; 
           osc.detune.value = detune;
           
           if (type === 'mega') {
               osc.frequency.setValueAtTime(300, t); 
               osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
               g.gain.setValueAtTime(0.2, t); 
               g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
               osc.start(t); osc.stop(t + 0.3);
           } else {
               osc.frequency.setValueAtTime(880, t); 
               osc.frequency.exponentialRampToValueAtTime(110, t + 0.15);
               g.gain.setValueAtTime(0.08, t); 
               g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
               osc.start(t); osc.stop(t + 0.15);
           }
      } 
      else if (type === 'cannon') {
          // MECHANICAL WEAPON DISCRIMINATION
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.connect(g); g.connect(masterG);
          
          let noise = null;
          let noiseG = null;

          if (variantId === 'gun_vulcan' || variantId === 'gun_shredder') {
              // VULCAN: Trr Trr (Fast Sawtooth)
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(150, t);
              osc.frequency.linearRampToValueAtTime(100, t + 0.08);
              g.gain.setValueAtTime(0.12, t);
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
              osc.start(t); osc.stop(t + 0.08);
          } 
          else if (variantId === 'gun_repeater') {
              // REPEATER: Raka (Square)
              osc.type = 'square';
              osc.frequency.setValueAtTime(180, t);
              osc.frequency.linearRampToValueAtTime(80, t + 0.12);
              g.gain.setValueAtTime(0.1, t);
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
              osc.start(t); osc.stop(t + 0.12);
          }
          else if (variantId === 'gun_heavy') {
              // HEAVY: Dum Dum (Low Square + Noise)
              osc.type = 'square';
              osc.frequency.setValueAtTime(100, t);
              osc.frequency.linearRampToValueAtTime(40, t + 0.2);
              g.gain.setValueAtTime(0.15, t);
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
              osc.start(t); osc.stop(t + 0.2);
              
              if (this.brownNoise) {
                  noise = this.ctx.createBufferSource();
                  noise.buffer = this.brownNoise;
                  noiseG = this.ctx.createGain();
                  noise.connect(noiseG); noiseG.connect(masterG);
                  noiseG.gain.setValueAtTime(0.1, t);
                  noiseG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                  noise.start(t); noise.stop(t + 0.1);
              }
          }
          else if (variantId === 'gun_plasma') {
              // DRIVER: Pac Pac (Metallic Triangle)
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(600, t);
              osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);
              g.gain.setValueAtTime(0.15, t);
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
              osc.start(t); osc.stop(t + 0.05);
          }
          else if (variantId === 'gun_hyper') {
              // HYPER: Brrt (Short High Sawtooth)
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(200, t);
              osc.frequency.linearRampToValueAtTime(50, t + 0.05);
              g.gain.setValueAtTime(0.1, t);
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
              osc.start(t); osc.stop(t + 0.05);
          }
          else if (variantId === 'gun_rail_titan') {
              // RAILGUN: Zap (High Sweep + Crack)
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(1200, t);
              osc.frequency.exponentialRampToValueAtTime(100, t + 0.25);
              g.gain.setValueAtTime(0.15, t);
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
              osc.start(t); osc.stop(t + 0.25);
              
              if (this.whiteNoise) {
                  noise = this.ctx.createBufferSource();
                  noise.buffer = this.whiteNoise;
                  noiseG = this.ctx.createGain();
                  noise.connect(noiseG); noiseG.connect(masterG);
                  noiseG.gain.setValueAtTime(0.1, t);
                  noiseG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                  noise.start(t); noise.stop(t + 0.1);
              }
          }
          else if (variantId === 'gun_doomsday') {
              // DOOMSDAY: Thud (Deep Brown Noise)
              if (this.brownNoise) {
                  noise = this.ctx.createBufferSource();
                  noise.buffer = this.brownNoise;
                  noiseG = this.ctx.createGain();
                  
                  const filter = this.ctx.createBiquadFilter();
                  filter.type = 'lowpass';
                  filter.frequency.setValueAtTime(200, t);
                  filter.frequency.linearRampToValueAtTime(50, t + 0.4);
                  
                  noise.connect(filter); filter.connect(noiseG); noiseG.connect(masterG);
                  
                  noiseG.gain.setValueAtTime(0.3, t);
                  noiseG.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                  noise.start(t); noise.stop(t + 0.4);
              }
          }
          else {
              // Default Cannon
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(200, t); 
              osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
              g.gain.setValueAtTime(0.1, t); 
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
              osc.start(t); osc.stop(t + 0.1);
          }
      }
      else if (type.includes('missile') || type.includes('mine')) {
           if (this.whiteNoise) {
               const src = this.ctx.createBufferSource();
               src.buffer = this.whiteNoise;
               const filt = this.ctx.createBiquadFilter();
               filt.type = 'lowpass';
               filt.frequency.setValueAtTime(1000, t);
               filt.frequency.linearRampToValueAtTime(100, t + 0.4);
               
               const g = this.ctx.createGain();
               g.gain.setValueAtTime(0.15, t);
               g.gain.linearRampToValueAtTime(0, t + 0.4);
               
               src.connect(filt); filt.connect(g); g.connect(masterG);
               src.start(t); src.stop(t + 0.4);
           }
      } 
      else { 
           // Catch all / exotic defaults
           const osc = this.ctx.createOscillator();
           const g = this.ctx.createGain();
           osc.connect(g); g.connect(masterG);
           
           osc.type = 'triangle';
           osc.frequency.setValueAtTime(200, t); 
           osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
           
           g.gain.setValueAtTime(0.1, t); 
           g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
           
           osc.start(t); osc.stop(t + 0.1);
      }
  }
  
  playExplosion(x: number, intensity: number, type: string) {
       if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
       const t = this.ctx.currentTime;
       
       const masterG = this.ctx.createGain();
       masterG.connect(this.sfxGain);
       
       if (this.brownNoise) {
           const src = this.ctx.createBufferSource();
           src.buffer = this.brownNoise;
           
           const filt = this.ctx.createBiquadFilter();
           filt.type = 'lowpass'; 
           filt.frequency.setValueAtTime(800, t); 
           filt.frequency.exponentialRampToValueAtTime(50, t + 0.8); 
           
           const g = this.ctx.createGain();
           g.gain.setValueAtTime(intensity * 0.5, t); 
           g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
           
           src.connect(filt); filt.connect(g); g.connect(masterG);
           src.start(t); src.stop(t + 0.9);
       }

       if (this.whiteNoise) {
           const src = this.ctx.createBufferSource();
           src.buffer = this.whiteNoise;
           
           const filt = this.ctx.createBiquadFilter();
           filt.type = 'highpass'; 
           filt.frequency.setValueAtTime(1000, t);
           filt.frequency.linearRampToValueAtTime(100, t + 0.1);
           
           const g = this.ctx.createGain();
           g.gain.setValueAtTime(intensity * 0.3, t); 
           g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
           
           src.connect(filt); filt.connect(g); g.connect(masterG);
           src.start(t); src.stop(t + 0.2);
       }

       const osc = this.ctx.createOscillator();
       const oscG = this.ctx.createGain();
       osc.connect(oscG); oscG.connect(masterG);
       
       osc.frequency.setValueAtTime(150, t);
       osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
       
       oscG.gain.setValueAtTime(intensity * 0.4, t);
       oscG.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
       
       osc.start(t); osc.stop(t + 0.3);
  }

  playImpact(mat: string, intensity: number) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.connect(g); g.connect(this.sfxGain);
      
      if (mat === 'shield') {
           osc.type = 'sine'; 
           osc.frequency.setValueAtTime(2000, t); 
           osc.frequency.exponentialRampToValueAtTime(500, t + 0.1);
           g.gain.setValueAtTime(0.1 * intensity, t); 
           g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      } else {
           osc.type = 'square'; 
           osc.frequency.setValueAtTime(150, t);
           osc.frequency.exponentialRampToValueAtTime(50, t + 0.05);
           g.gain.setValueAtTime(0.15 * intensity, t); 
           g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      }
      osc.start(t); osc.stop(t + 0.2);
  }

  playAlertSiren() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.connect(g); g.connect(this.sfxGain);
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.linearRampToValueAtTime(660, t + 0.3);
      
      g.gain.setValueAtTime(0.1, t);
      g.gain.linearRampToValueAtTime(0, t + 0.3);
      
      osc.start(t); osc.stop(t + 0.3);
  }

  // --- CONTINUOUS LOOPS ---

  startReEntryWind() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.whiteNoise || this.reEntryNodes) return;
      const t = this.ctx.currentTime;
      
      const src = this.ctx.createBufferSource();
      src.buffer = this.whiteNoise;
      src.loop = true;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass'; 
      filter.frequency.value = 200;
      filter.Q.value = 1;
      
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      
      src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
      src.start(t);
      this.reEntryNodes = { src, filter, gain };
  }

  updateReEntryWind(intensity: number) {
      if (this.reEntryNodes && this.ctx) {
          const t = this.ctx.currentTime;
          this.reEntryNodes.filter.frequency.setTargetAtTime(200 + (intensity * 1200), t, 0.1);
          this.reEntryNodes.gain.gain.setTargetAtTime(intensity * 0.15, t, 0.1);
      }
  }

  stopReEntryWind() {
      if (this.reEntryNodes && this.ctx) {
          this.reEntryNodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
          const n = this.reEntryNodes;
          setTimeout(() => { try { n.src.stop(); } catch(e){} }, 200);
          this.reEntryNodes = null;
      }
  }
  
  startLandingThruster() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.brownNoise || this.landingNodes) return;
      const t = this.ctx.currentTime;
      
      // Rumble
      const src = this.ctx.createBufferSource();
      src.buffer = this.brownNoise;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; 
      filter.frequency.value = 100;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
      src.start(t);
      
      // Turbine
      const turbine = this.createTurbineSound();
      
      this.landingNodes = { src, filter, gain, turbine };
  }

  updateLandingThruster(intensity: number) {
      if (this.landingNodes && this.ctx) {
          const t = this.ctx.currentTime;
          // Rumble Update
          this.landingNodes.filter.frequency.setTargetAtTime(100 + (intensity * 400), t, 0.1);
          this.landingNodes.gain.gain.setTargetAtTime(intensity * 0.4, t, 0.1);
          
          // Turbine Update
          if (this.landingNodes.turbine) {
              const turb = this.landingNodes.turbine;
              const freq = 200 + (intensity * 2800); // 200Hz to 3000Hz sweep
              turb.filter.frequency.setTargetAtTime(freq, t, 0.15); 
              turb.masterGain.gain.setTargetAtTime(intensity * 0.15, t, 0.1);
          }
      }
  }

  stopLandingThruster() {
      if (this.landingNodes && this.ctx) {
          const t = this.ctx.currentTime;
          this.landingNodes.gain.gain.setTargetAtTime(0, t, 0.2);
          
          if (this.landingNodes.turbine) {
              this.landingNodes.turbine.masterGain.gain.setTargetAtTime(0, t, 0.2);
          }
          
          const n = this.landingNodes;
          setTimeout(() => { 
              try { n.src.stop(); } catch(e){} 
              if (n.turbine) {
                  try { 
                      n.turbine.osc.stop(); 
                      if(n.turbine.noise) n.turbine.noise.stop();
                  } catch(e){}
              }
          }, 300);
          this.landingNodes = null;
      }
  }

  playWarpHum() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || this.warpNodes) return;
      const t = this.ctx.currentTime;
      
      const masterG = this.ctx.createGain();
      masterG.connect(this.sfxGain);
      masterG.gain.value = 0;
      masterG.gain.linearRampToValueAtTime(0.3, t + 2.0); 

      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(50, t);
      osc1.frequency.linearRampToValueAtTime(120, t + 4.0); 
      
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.detune.value = 15; 
      osc2.frequency.setValueAtTime(52, t);
      osc2.frequency.linearRampToValueAtTime(124, t + 4.0);

      let rumbleNode = null;
      if (this.brownNoise) {
          rumbleNode = this.ctx.createBufferSource();
          rumbleNode.buffer = this.brownNoise;
          rumbleNode.loop = true;
          rumbleNode.start(t);
      }

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, t);
      filter.frequency.exponentialRampToValueAtTime(2000, t + 4.0);
      filter.Q.value = 2; 

      osc1.connect(filter);
      osc2.connect(filter);
      if (rumbleNode) rumbleNode.connect(filter);
      
      filter.connect(masterG);
      
      osc1.start(t);
      osc2.start(t);
      
      this.warpNodes = { osc1, osc2, rumbleNode, masterG, filter };
  }

  stopWarpHum(tail: boolean) {
      if (this.warpNodes && this.ctx) {
          const t = this.ctx.currentTime;
          const decay = tail ? 2.0 : 0.2;
          
          this.warpNodes.filter.frequency.cancelScheduledValues(t);
          this.warpNodes.filter.frequency.setTargetAtTime(50, t, decay * 0.5);
          
          this.warpNodes.masterG.gain.cancelScheduledValues(t);
          this.warpNodes.masterG.gain.setTargetAtTime(0, t, decay * 0.2);
          
          const n = this.warpNodes;
          setTimeout(() => { 
              try { 
                  n.osc1.stop(); 
                  n.osc2.stop(); 
                  if(n.rumbleNode) n.rumbleNode.stop(); 
              } catch(e){} 
          }, decay * 1000 + 100);
          
          this.warpNodes = null;
      }
  }

  playLaunchSequence() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.brownNoise) return;
      const t = this.ctx.currentTime;
      
      // Rumble
      const src = this.ctx.createBufferSource();
      src.buffer = this.brownNoise;
      src.loop = true; 
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(100, t);
      filter.frequency.linearRampToValueAtTime(800, t + 5.0); 
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 2.0);
      gain.gain.linearRampToValueAtTime(0, t + 6.0); 
      
      src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
      src.start(t); src.stop(t + 6.0);
      
      // Turbine Spool Up
      const turbine = this.createTurbineSound();
      if (turbine) {
          turbine.filter.frequency.setValueAtTime(200, t);
          turbine.filter.frequency.exponentialRampToValueAtTime(4000, t + 5.5); // Spool up
          
          turbine.masterGain.gain.setValueAtTime(0, t);
          turbine.masterGain.gain.linearRampToValueAtTime(0.2, t + 1.5); // Fade in
          turbine.masterGain.gain.linearRampToValueAtTime(0, t + 6.0); // Fade out
          
          turbine.osc.stop(t + 6.0);
          if (turbine.noise) turbine.noise.stop(t + 6.0);
      }
      
      this.launchNodes = { src, gain, turbine };
  }

  stopLaunchSequence() {
      if (this.launchNodes && this.ctx) {
          try { this.launchNodes.src.stop(); } catch(e){}
          if (this.launchNodes.turbine) {
              try { 
                  this.launchNodes.turbine.osc.stop();
                  if (this.launchNodes.turbine.noise) this.launchNodes.turbine.noise.stop();
              } catch(e){}
          }
          this.launchNodes = null;
      }
  }

  playLaunchBang() { 
      this.playExplosion(0, 1.5, 'standard'); 
  }
  
  playLandingIgnition() { 
      this.playExplosion(0, 0.8, 'standard'); 
  }
  
  playLandThud() { 
      this.playImpact('metal', 1.5); 
      if (this.ctx && this.sfxGain) {
          const t = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.connect(g); g.connect(this.sfxGain);
          osc.frequency.setValueAtTime(80, t);
          osc.frequency.exponentialRampToValueAtTime(10, t + 0.3);
          g.gain.setValueAtTime(0.5, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.start(t); osc.stop(t + 0.3);
      }
  }
  
  playSteamRelease() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.whiteNoise) return;
      const t = this.ctx.currentTime;
      
      const src = this.ctx.createBufferSource();
      src.buffer = this.whiteNoise;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass'; 
      filter.frequency.value = 1200;
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      
      src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
      src.start(t); src.stop(t + 1.5);
  }
  
  playCountdownBeep(ign: boolean) { 
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.sfxGain);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(ign ? 1500 : 800, t);
      
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      
      osc.start(t); osc.stop(t + 0.1);
  }
  
  playOrbitLatch() { this.playSfx('click'); }
  
  stopBattleSounds() {
      this.stopLaunchSequence();
      this.stopLandingThruster();
      this.stopReEntryWind();
      this.stopWarpHum(false);
  }
}

export const audioService = new AudioService();
