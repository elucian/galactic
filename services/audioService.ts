
import { QuadrantType } from '../types';

const TRACK_URLS = {
    combat: 'https://audio.jukehost.co.uk/BCVuKwzsaGrIAxF0f9qWSsn12cZRvXAa',
    command: 'https://audio.jukehost.co.uk/4qDUYKMPFFJBHGOoSZCplXiTOCxc0MqG',
    intro: 'https://audio.jukehost.co.uk/nG2IbB7rvgudhgBpEFQpbVmJuB63oHKk',
    map: 'https://audio.jukehost.co.uk/vol5UySmAxBIacpCD1YNAJZW0JRSeIvA',
    victory: 'https://audio.jukehost.co.uk/85T6AXXtiiJ4p4tvwfDj1sEDeOrJaJd4'
};

const CACHE_NAME = 'galactic-music-v1';

// --- MAIN SERVICE ---

class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  // Music State
  private currentAudio: HTMLAudioElement | null = null;
  private currentTrackId: string | null = null;
  private musicVolume = 0.3;
  private sfxVolume = 0.5;
  private musicEnabled = true;
  private sfxEnabled = true;
  private trackCache: Record<string, HTMLAudioElement> = {};
  private blobCache: Record<string, string> = {}; // In-memory blob URLs
  private loadingPromises: Map<string, Promise<string>> = new Map(); // Deduplication for in-flight requests
  
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
              this.cleanupOldCaches();
          }
      }
      if (this.ctx?.state === 'suspended') {
          this.ctx.resume().catch(() => {});
      }
  }

  private async cleanupOldCaches() {
      if ('caches' in window) {
          const keys = await caches.keys();
          for (const key of keys) {
              if (key.startsWith('galactic-music-') && key !== CACHE_NAME) {
                  console.log('Deleting old cache:', key);
                  await caches.delete(key);
              }
          }
      }
  }

  preload() {
      Object.values(TRACK_URLS).forEach(url => {
          this.getAudioSource(url).catch(() => {});
      });
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

  setTheme(t: 'active' | 'serene' | 'heroic') { }
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

  private async getAudioSource(url: string): Promise<string> {
      // 1. Check Memory Cache
      if (this.blobCache[url]) return this.blobCache[url];

      // 2. Check Deduplication Map
      if (this.loadingPromises.has(url)) {
          return this.loadingPromises.get(url)!;
      }

      const loadTask = (async () => {
          // 3. Check Browser Cache Storage
          if ('caches' in window) {
              try {
                  const cache = await caches.open(CACHE_NAME);
                  const cachedResponse = await cache.match(url);
                  
                  if (cachedResponse) {
                      const blob = await cachedResponse.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      this.blobCache[url] = blobUrl;
                      return blobUrl;
                  }
              } catch (e) {
                  console.warn('Cache check error:', e);
              }
          }

          // 4. Fetch and Cache
          try {
              const response = await fetch(url);
              if (response.ok) {
                  // Clone BEFORE blob() to ensure stream is available for both
                  if ('caches' in window) {
                      const cacheResponse = response.clone();
                      const cache = await caches.open(CACHE_NAME);
                      // Handle put errors silently (e.g. QuotaExceeded, NetworkError)
                      cache.put(url, cacheResponse).catch(e => {
                          console.warn('Cache put failed:', e);
                      });
                  }

                  const blob = await response.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  this.blobCache[url] = blobUrl;
                  return blobUrl;
              }
          } catch (e) {
              console.warn('Network fetch failed, streaming directly:', e);
          }

          // 5. Fallback
          return url;
      })();

      this.loadingPromises.set(url, loadTask);
      
      try {
          return await loadTask;
      } finally {
          this.loadingPromises.delete(url);
      }
  }

  async playTrack(scene: string) {
      let trackKey = scene;
      if (scene === 'hangar') trackKey = 'command';
      if (scene === 'game') trackKey = 'combat';
      
      if (!TRACK_URLS[trackKey as keyof typeof TRACK_URLS]) return;
      
      const url = TRACK_URLS[trackKey as keyof typeof TRACK_URLS];

      // If we are already playing this track, ensure volume is correct and return
      if (this.currentTrackId === trackKey && this.currentAudio) {
          if (this.currentAudio.paused && this.musicEnabled) {
              this.currentAudio.play().catch(() => {});
          }
          return;
      }

      this.stopMusic();
      this.currentTrackId = trackKey;

      try {
          const src = await this.getAudioSource(url);
          
          // Check if track changed while awaiting
          if (this.currentTrackId !== trackKey) return;

          if (!this.trackCache[url]) {
              this.trackCache[url] = new Audio(src);
              this.trackCache[url].loop = true;
          } else if (this.trackCache[url].src !== src) {
              // Update src if it was a blob update
              this.trackCache[url].src = src;
          }

          const audio = this.trackCache[url];
          this.currentAudio = audio;
          
          // Reset if paused/ended
          if (audio.paused) audio.currentTime = 0;
          audio.volume = this.musicEnabled ? this.musicVolume : 0;
          
          if (this.musicEnabled) {
              const playPromise = audio.play();
              if (playPromise !== undefined) {
                  playPromise.catch(error => {
                      // Autoplay prevented
                  });
              }
          }
      } catch (e) {
          console.error("Failed to play track:", e);
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
  
  playWeaponFire(type: string, pan = 0, shipId?: string) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const t = this.ctx.currentTime;
      
      const masterG = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      masterG.connect(panner); panner.connect(this.sfxGain);

      // "Raka Taka" - Mechanical Machine Gun (Cannon / Vulcan / Projectile)
      if (type === 'cannon') {
          // 1. The Thud (Sawtooth punch)
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(120, t);
          osc.frequency.exponentialRampToValueAtTime(60, t + 0.08); // Fast pitch drop
          
          const oscG = this.ctx.createGain();
          oscG.gain.setValueAtTime(0.25, t);
          oscG.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
          
          osc.connect(oscG); oscG.connect(masterG);
          osc.start(t); osc.stop(t + 0.1);

          // 2. The Crack (Filtered Noise)
          if (this.whiteNoise) {
              const src = this.ctx.createBufferSource();
              src.buffer = this.whiteNoise;
              const filt = this.ctx.createBiquadFilter();
              filt.type = 'highpass';
              filt.frequency.value = 1500; // Crisp high end
              
              const noiseG = this.ctx.createGain();
              noiseG.gain.setValueAtTime(0.15, t);
              noiseG.gain.exponentialRampToValueAtTime(0.01, t + 0.05); // Very short snap
              
              src.connect(filt); filt.connect(noiseG); noiseG.connect(masterG);
              src.start(t); src.stop(t + 0.1);
          }
          return;
      }

      // "Fsiu Fshiu" - Fire (Exotic Flamer)
      if (type === 'exotic_flame') {
          if (this.whiteNoise) {
              const src = this.ctx.createBufferSource();
              src.buffer = this.whiteNoise;
              
              const filt = this.ctx.createBiquadFilter();
              filt.type = 'bandpass';
              filt.frequency.setValueAtTime(200, t);
              filt.frequency.linearRampToValueAtTime(1200, t + 0.3); // Rise like a jet/fire
              filt.Q.value = 1;

              const g = this.ctx.createGain();
              g.gain.setValueAtTime(0, t);
              g.gain.linearRampToValueAtTime(0.3, t + 0.1);
              g.gain.linearRampToValueAtTime(0, t + 0.4);
              
              src.connect(filt); filt.connect(g); g.connect(masterG);
              src.start(t); src.stop(t + 0.5);
          }
          return;
      }

      // "Vij Bvij" - Plasma / Gravity (Exotic Plasma)
      if (type === 'exotic_plasma' || type === 'exotic_gravity') {
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300, t);
          osc.frequency.linearRampToValueAtTime(700, t + 0.15); // Slide Up
          
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.2, t);
          g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
          
          osc.connect(g); g.connect(masterG);
          osc.start(t); osc.stop(t + 0.3);
          return;
      }

      // "Strak Stak" - Shatter / Wave (Exotic Wave)
      if (type === 'exotic_shatter' || type === 'exotic_wave') {
          const osc = this.ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(800, t); 
          
          // Fast pitch modulation for "Strak" distortion
          osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);

          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.25, t);
          g.gain.exponentialRampToValueAtTime(0.01, t + 0.1); 
          
          osc.connect(g); g.connect(masterG);
          osc.start(t); osc.stop(t + 0.15);
          return;
      }

      // "Sfrr Sfrr" - Electric / Rainbow (Exotic Electric)
      if (type === 'exotic_rainbow' || type === 'exotic_electric') {
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(100, t); // Low buzz
          
          // Random Detune for electric "frizz"
          osc.detune.setValueAtTime(Math.random() * 200, t);

          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.2, t);
          g.gain.linearRampToValueAtTime(0, t + 0.25);
          
          // Mix some high noise
          if (this.whiteNoise) {
              const nSrc = this.ctx.createBufferSource();
              nSrc.buffer = this.whiteNoise;
              const nFilt = this.ctx.createBiquadFilter();
              nFilt.type = 'highpass'; nFilt.frequency.value = 3000;
              const nGain = this.ctx.createGain();
              nGain.gain.setValueAtTime(0.1, t);
              nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
              nSrc.connect(nFilt); nFilt.connect(nGain); nGain.connect(masterG);
              nSrc.start(t); nSrc.stop(t+0.2);
          }

          osc.connect(g); g.connect(masterG);
          osc.start(t); osc.stop(t + 0.3);
          return;
      }

      // "Piu Piu" - Laser (Standard)
      if (type.includes('laser') || type.includes('mega')) {
           const osc = this.ctx.createOscillator();
           const g = this.ctx.createGain();
           osc.connect(g); g.connect(masterG);
           
           osc.type = 'square'; 
           
           if (type === 'mega') {
               // Deep powerful laser
               osc.frequency.setValueAtTime(300, t); 
               osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
               g.gain.setValueAtTime(0.2, t); 
               g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
               osc.start(t); osc.stop(t + 0.3);
           } else {
               // Standard Pew
               osc.frequency.setValueAtTime(880, t); 
               osc.frequency.exponentialRampToValueAtTime(110, t + 0.15);
               g.gain.setValueAtTime(0.08, t); 
               g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
               osc.start(t); osc.stop(t + 0.15);
           }
      } 
      else if (type.includes('missile') || type.includes('mine')) {
           // White noise burst for launch woosh
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
           // Projectile Fallback
           // Should ideally call 'cannon' but this handles generic calls
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
       
       // 1. Rumble Layer (Brown Noise) - The Body
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

       // 2. Crackle Layer (White Noise) - The Initial Impact
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

       // 3. Sub-Bass Thump (Sine Drop) - The Shockwave
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
           // High glass ping
           osc.type = 'sine'; 
           osc.frequency.setValueAtTime(2000, t); 
           osc.frequency.exponentialRampToValueAtTime(500, t + 0.1);
           g.gain.setValueAtTime(0.1 * intensity, t); 
           g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      } else {
           // Dull metal thud
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
          // Wind gets higher pitched and louder
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
      
      // Use Brown Noise for powerful engine rumble
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
      this.landingNodes = { src, filter, gain };
  }

  updateLandingThruster(intensity: number) {
      if (this.landingNodes && this.ctx) {
          const t = this.ctx.currentTime;
          // Engine rumble opens up filter
          this.landingNodes.filter.frequency.setTargetAtTime(100 + (intensity * 400), t, 0.1);
          this.landingNodes.gain.gain.setTargetAtTime(intensity * 0.4, t, 0.1);
      }
  }

  stopLandingThruster() {
      if (this.landingNodes && this.ctx) {
          this.landingNodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
          const n = this.landingNodes;
          setTimeout(() => { try { n.src.stop(); } catch(e){} }, 300);
          this.landingNodes = null;
      }
  }

  // Improved Warp Sound: Dual Oscillators + Noise + Filter Sweep
  playWarpHum() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || this.warpNodes) return;
      const t = this.ctx.currentTime;
      
      const masterG = this.ctx.createGain();
      masterG.connect(this.sfxGain);
      masterG.gain.value = 0;
      masterG.gain.linearRampToValueAtTime(0.3, t + 2.0); // Slow fade in

      // Osc 1: Deep Drone
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(50, t);
      osc1.frequency.linearRampToValueAtTime(120, t + 4.0); // Pitch up
      
      // Osc 2: Detuned Drone (Interference)
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.detune.value = 15; // Cents
      osc2.frequency.setValueAtTime(52, t);
      osc2.frequency.linearRampToValueAtTime(124, t + 4.0);

      // Rumble Noise
      let rumbleNode = null;
      if (this.brownNoise) {
          rumbleNode = this.ctx.createBufferSource();
          rumbleNode.buffer = this.brownNoise;
          rumbleNode.loop = true;
          rumbleNode.start(t);
      }

      // Filter: Starts closed, opens up like a turbine
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, t);
      filter.frequency.exponentialRampToValueAtTime(2000, t + 4.0);
      filter.Q.value = 2; // Resonance for turbine whine

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
          
          // Filter closes down
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
      
      const src = this.ctx.createBufferSource();
      src.buffer = this.brownNoise;
      src.loop = true; // Loop for duration
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(100, t);
      filter.frequency.linearRampToValueAtTime(800, t + 5.0); // Engine building power
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 2.0);
      gain.gain.linearRampToValueAtTime(0, t + 6.0); // Fade out
      
      src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
      src.start(t); src.stop(t + 6.0);
      
      this.launchNodes = { src, gain };
  }

  stopLaunchSequence() {
      if (this.launchNodes && this.ctx) {
          try { this.launchNodes.src.stop(); } catch(e){}
          this.launchNodes = null;
      }
  }

  playLaunchBang() { 
      // Heavy initial explosion for ignition
      this.playExplosion(0, 1.5, 'standard'); 
  }
  
  playLandingIgnition() { 
      // Quick blast
      this.playExplosion(0, 0.8, 'standard'); 
  }
  
  playLandThud() { 
      // Deep metal thud
      this.playImpact('metal', 1.5); 
      // Add a bass thump
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
