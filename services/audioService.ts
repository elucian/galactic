
class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  private musicVolume: number = 0.3;
  private sfxVolume: number = 0.5;
  private musicEnabled: boolean = true;
  private sfxEnabled: boolean = true;
  
  private introAudio: HTMLAudioElement | null = null;
  private intendedTrack: string | null = null;
  
  private noiseBuffer: AudioBuffer | null = null;

  // Track Mapping
  private tracks: Record<string, string> = {
      'intro': 'https://mthwbpvmznxexpm4.public.blob.vercel-storage.com/music/intro.mp3',
      'command': 'https://mthwbpvmznxexpm4.public.blob.vercel-storage.com/music/hangar.mp3',
      'map': 'https://mthwbpvmznxexpm4.public.blob.vercel-storage.com/music/map.mp3',
      'combat': 'https://mthwbpvmznxexpm4.public.blob.vercel-storage.com/music/combat.mp3'
  };

  private reactorOsc: OscillatorNode | null = null;
  private reactorGain: GainNode | null = null;
  
  // Landing Thruster Nodes
  private landingOsc: AudioBufferSourceNode | null = null;
  private landingGain: GainNode | null = null;
  private landingFilter: BiquadFilterNode | null = null;

  // Re-Entry Wind Nodes
  private windOsc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  // Launch Thruster Nodes
  private launchOsc: AudioBufferSourceNode | null = null;
  private launchGain: GainNode | null = null;
  private launchFilter: BiquadFilterNode | null = null;

  // DUCKING LOGIC
  private lastSfxTime: number = 0;

  init() {
    if (!this.ctx) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (AudioContextClass) {
            this.ctx = new AudioContextClass();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);
            this.updateSfxState();

            // Create Global Pink Noise Buffer (5 seconds)
            // Pink noise (1/f) sounds like deep rumble/wind, unlike white noise (static)
            const bufferSize = this.ctx.sampleRate * 5; 
            this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            
            let b0, b1, b2, b3, b4, b5, b6;
            b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
            
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                data[i] *= 0.11; // Normalize roughly to -1..1
                b6 = white * 0.115926;
            }

            // Fade in/out edges to prevent clicking on loop
            const fadeLen = 500;
            for (let i = 0; i < fadeLen; i++) {
                data[i] *= (i / fadeLen);
                data[bufferSize - 1 - i] *= (i / fadeLen);
            }
        }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(e => {});
    }
    this.updateMusicState();
  }

  private updateMusicState() {
      if (this.introAudio) {
          this.introAudio.volume = this.musicVolume;
          if (this.musicEnabled) {
              if (this.introAudio.paused && this.introAudio.src) {
                  this.introAudio.play().catch(e => { });
              }
          } else {
              this.introAudio.pause();
          }
      } else if (this.musicEnabled && this.intendedTrack && this.musicVolume > 0) {
          this.loadAndPlay(this.intendedTrack);
      }
  }

  private updateSfxState() {
      if (this.sfxGain && this.ctx) {
          const target = this.sfxEnabled ? this.sfxVolume : 0;
          this.sfxGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      }
  }

  setMusicVolume(v: number) { this.musicVolume = v; this.updateMusicState(); }
  setSfxVolume(v: number) { this.sfxVolume = v; this.updateSfxState(); }
  setMusicEnabled(e: boolean) { this.musicEnabled = e; this.updateMusicState(); }
  setSfxEnabled(e: boolean) { this.sfxEnabled = e; this.updateSfxState(); }

  private loadAndPlay(trackId: string) {
      const path = this.tracks[trackId];
      if (!path) return;
      this.stopBattleSounds();

      if (this.introAudio) {
          const currentSrc = this.introAudio.src;
          const fileName = path.split('/').pop() || '';
          if (currentSrc === path || (fileName && currentSrc.includes(fileName))) { 
               if (this.introAudio.paused && this.musicEnabled && this.musicVolume > 0) {
                   this.introAudio.play().catch(e => { });
               }
               return; 
          }
          this.introAudio.pause();
          this.introAudio.src = "";
          this.introAudio = null;
      }

      if (!this.musicEnabled) return;

      const audio = new Audio(path);
      audio.crossOrigin = "anonymous";
      audio.loop = true;
      audio.volume = this.musicVolume;
      audio.play().catch(e => {});
      this.introAudio = audio;
  }

  playTrack(type: string) {
    this.intendedTrack = type;
    if (this.musicEnabled && this.musicVolume > 0) this.loadAndPlay(type);
  }

  // --- PAUSE/RESUME LOGIC ---
  pauseMusic() {
      if (this.introAudio) {
          this.introAudio.pause();
      }
  }

  resumeMusic() {
      if (this.musicEnabled && this.introAudio && this.introAudio.src) {
          this.introAudio.play().catch(e => console.warn("Resume failed", e));
      }
  }

  stop() {
      if (this.introAudio) {
          this.introAudio.pause();
          this.introAudio.currentTime = 0;
      }
      this.stopBattleSounds();
  }

  stopBattleSounds() {
      this.updateReactorHum(false, 0);
      this.stopLaunchSequence();
      this.stopLandingThruster();
      this.stopReEntryWind();
  }

  private registerSfx() {
      this.lastSfxTime = Date.now();
      if (this.reactorGain && this.ctx) {
          this.reactorGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.reactorGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
  }

  playSfx(id: string) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      this.registerSfx();
      const now = this.ctx.currentTime;

      if (id === 'click' || id === 'buy') {
          const osc1 = this.ctx.createOscillator();
          const gain1 = this.ctx.createGain();
          osc1.connect(gain1); gain1.connect(this.sfxGain);
          osc1.type = 'square';
          osc1.frequency.setValueAtTime(800, now);
          gain1.gain.setValueAtTime(0.08, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc1.start(now); osc1.stop(now + 0.04);

          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();
          osc2.connect(gain2); gain2.connect(this.sfxGain);
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(500, now + 0.08);
          gain2.gain.setValueAtTime(0.08, now + 0.08);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          osc2.start(now + 0.08); osc2.stop(now + 0.14);

      } else if (id === 'denied') {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain); gain.connect(this.sfxGain);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, now);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.start(now); osc.stop(now + 0.3);
      }
  }

  playWeaponFire(type: string, pan = 0, shipId?: string) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      this.registerSfx();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      
      gain.connect(panner);
      panner.connect(this.sfxGain);
      panner.pan.value = Math.max(-1, Math.min(1, pan));

      const now = this.ctx.currentTime;
      
      if (type === 'flame') {
          if (!this.noiseBuffer) return;
          const noise = this.ctx.createBufferSource();
          noise.buffer = this.noiseBuffer;
          
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(600, now);
          filter.frequency.linearRampToValueAtTime(100, now + 0.3); 

          const nGain = this.ctx.createGain();
          nGain.gain.setValueAtTime(0.4, now);
          nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

          noise.connect(filter);
          filter.connect(nGain);
          nGain.connect(panner);
          noise.start(now);
          noise.stop(now + 0.3);
          return;
      }

      if (type === 'mega' || type === 'exotic_power') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(40, now + 0.2); 
          
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, now);
          filter.frequency.linearRampToValueAtTime(100, now + 0.2);
          
          osc.disconnect();
          osc.connect(filter);
          filter.connect(gain);
          
          gain.gain.setValueAtTime(0.8, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          
          osc.start(now);
          osc.stop(now + 0.25);
          return;
      }
      
      if (type === 'phaser') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1800, now);
          osc.frequency.exponentialRampToValueAtTime(300, now + 0.15); 
          
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          
          osc.start(now);
          osc.stop(now + 0.15);
          return;
      }

      if (type === 'missile' || type === 'missile_emp' || type === 'emp' || type === 'mine') {
          if (this.noiseBuffer) {
              const noise = this.ctx.createBufferSource();
              noise.buffer = this.noiseBuffer;
              const nFilter = this.ctx.createBiquadFilter();
              nFilter.type = 'bandpass';
              nFilter.Q.value = 1;
              nFilter.frequency.setValueAtTime(200, now);
              nFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.5); 
              const nGain = this.ctx.createGain();
              nGain.gain.setValueAtTime(0.5, now);
              nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
              noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(panner);
              noise.start(now); noise.stop(now + 0.5);
          }
          
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.4);
          osc.connect(gain);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.4);
          osc.start(now); osc.stop(now + 0.4);
          return;
      }

      osc.connect(gain);
      if (type.includes('laser') || type.includes('electric')) {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.exponentialRampToValueAtTime(250, now + 0.12);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
          osc.start(); osc.stop(now + 0.12);
      } else {
          osc.type = 'square'; 
          osc.frequency.setValueAtTime(120, now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.06); 
          
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
          
          osc.start(); osc.stop(now + 0.08);
      }
  }

  playShieldHit() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      this.registerSfx();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(3000, this.ctx.currentTime + 0.05); 
      osc.frequency.linearRampToValueAtTime(1000, this.ctx.currentTime + 0.2); 
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.start(); osc.stop(this.ctx.currentTime + 0.2);
  }

  playHullHit(type: string) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      this.registerSfx();
      const now = this.ctx.currentTime;

      if (type === 'asteroid') {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 150; 
          osc.type = 'sawtooth'; 
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.05); 
          osc.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc.start(); osc.stop(now + 0.1);
      } else {
          const main = this.ctx.createOscillator();
          const ring = this.ctx.createOscillator();
          const mainGain = this.ctx.createGain();
          const ringGain = this.ctx.createGain();
          main.connect(mainGain); mainGain.connect(this.sfxGain);
          ring.connect(ringGain); ringGain.connect(this.sfxGain);
          main.type = 'square';
          main.frequency.setValueAtTime(300, now);
          main.frequency.exponentialRampToValueAtTime(100, now + 0.1);
          mainGain.gain.setValueAtTime(0.4, now);
          mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          ring.type = 'sine';
          ring.frequency.setValueAtTime(1200, now);
          ring.frequency.exponentialRampToValueAtTime(800, now + 0.4); 
          ringGain.gain.setValueAtTime(0.15, now);
          ringGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          main.start(); main.stop(now + 0.1);
          ring.start(); ring.stop(now + 0.4);
      }
  }

  playExplosion(x: number, intensity: number, type: string) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
      this.registerSfx();
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const gain = this.ctx.createGain();
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(50, now + 0.6);
      gain.gain.setValueAtTime(0.8 * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      noise.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.6);

      if (type === 'boss' || type === 'player') {
          const sub = this.ctx.createOscillator();
          const subGain = this.ctx.createGain();
          sub.connect(subGain); subGain.connect(this.sfxGain);
          sub.type = 'sine';
          sub.frequency.setValueAtTime(100, now);
          sub.frequency.exponentialRampToValueAtTime(20, now + 1.0);
          subGain.gain.setValueAtTime(0.8, now);
          subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
          sub.start(now); sub.stop(now + 1.0);
      }
  }

  playAlertSiren() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      this.registerSfx();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.6);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.7);
      osc.start(); osc.stop(this.ctx.currentTime + 0.7);
  }

  updateReactorHum(charging: boolean, level: number) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const musicActive = this.introAudio && !this.introAudio.paused && this.introAudio.volume > 0;
      const recentSfx = Date.now() - this.lastSfxTime < 400; 
      if (musicActive || recentSfx) {
          if (this.reactorGain) {
              this.reactorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
          }
          return;
      }
      if (charging && !this.reactorOsc) {
          this.reactorOsc = this.ctx.createOscillator();
          this.reactorGain = this.ctx.createGain();
          this.reactorOsc.connect(this.reactorGain);
          this.reactorGain.connect(this.sfxGain);
          this.reactorOsc.type = 'sine';
          this.reactorOsc.start();
      }
      if (this.reactorOsc && this.reactorGain) {
          const targetGain = charging ? 0.05 : 0;
          const targetFreq = 100 + (level * 5); 
          this.reactorGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
          this.reactorOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
      }
  }

  // --- RE-ENTRY WIND LOGIC (NEW) ---
  startReEntryWind() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
      this.stopReEntryWind();

      this.windOsc = this.ctx.createBufferSource();
      this.windOsc.buffer = this.noiseBuffer;
      this.windOsc.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.Q.value = 1.0;
      this.windFilter.frequency.setValueAtTime(2000, this.ctx.currentTime); // High freq wind

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.windOsc.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.sfxGain);

      this.windOsc.start();
  }

  updateReEntryWind(intensity: number) {
      if (!this.ctx || !this.windGain || !this.windFilter) return;
      const now = this.ctx.currentTime;
      // High pitch friction sound
      const targetGain = Math.max(0, Math.min(1, intensity)) * 0.5;
      const targetFreq = 1000 + (intensity * 3000); 

      this.windGain.gain.setTargetAtTime(targetGain, now, 0.1);
      this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.1);
  }

  stopReEntryWind() {
      if (this.windGain && this.ctx) {
          try {
             this.windGain.gain.cancelScheduledValues(this.ctx.currentTime);
             this.windGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
             const g = this.windGain;
             setTimeout(() => { try { g.disconnect(); } catch(e){} }, 400);
          } catch(e) {}
      }
      if (this.windOsc) {
          try { this.windOsc.stop(this.ctx!.currentTime + 0.3); } catch(e) {}
          try { this.windOsc.disconnect(); } catch(e) {}
          this.windOsc = null;
      }
      if (this.windFilter) {
          try { this.windFilter.disconnect(); } catch(e) {}
          this.windFilter = null;
      }
      this.windGain = null;
  }

  // --- LAUNCH THRUSTER LOGIC ---
  
  // Launch Bang: Noise burst + Low Sine Drop
  playLaunchBang() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const now = this.ctx.currentTime;
      
      // 1. Noise Burst (Explosion)
      if (this.noiseBuffer) {
          const src = this.ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          const filt = this.ctx.createBiquadFilter();
          filt.type = 'lowpass';
          filt.frequency.setValueAtTime(1000, now);
          filt.frequency.exponentialRampToValueAtTime(100, now + 0.5);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(1.0, now);
          g.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
          src.connect(filt); filt.connect(g); g.connect(this.sfxGain);
          src.start(now); src.stop(now + 0.5);
      }

      // 2. Sub Bass Kick
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.connect(og); og.connect(this.sfxGain);
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
      og.gain.setValueAtTime(1.0, now);
      og.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
  }

  // Launch Roar: Deep sustained rumble distinct from the loop
  playLaunchRoar() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
      const now = this.ctx.currentTime;
      
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(200, now);
      filt.frequency.linearRampToValueAtTime(800, now + 2.0); // Roar opens up
      
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.8, now);
      g.gain.linearRampToValueAtTime(0, now + 3.0); // Fades out as loop takes over
      
      src.connect(filt); filt.connect(g); g.connect(this.sfxGain);
      src.start(now); src.stop(now + 3.0);
  }

  // Orbit Latch: "Pac" sound
  playOrbitLatch() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const now = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(now); osc.stop(now + 0.1);
  }

  playLaunchSequence() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
      this.registerSfx();
      this.stopLaunchSequence(); 

      // Noise source (Pink Noise)
      this.launchOsc = this.ctx.createBufferSource();
      this.launchOsc.buffer = this.noiseBuffer;
      this.launchOsc.loop = true;

      // Filter: Starts HIGHER to be immediately loud/roaring (200Hz)
      this.launchFilter = this.ctx.createBiquadFilter();
      this.launchFilter.type = 'lowpass';
      this.launchFilter.frequency.setValueAtTime(200, this.ctx.currentTime); 

      // Envelope
      this.launchGain = this.ctx.createGain();
      // Start HIGH immediately (0.8) to simulate the roar continuing from the bang
      this.launchGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

      this.launchOsc.connect(this.launchFilter);
      this.launchFilter.connect(this.launchGain);
      this.launchGain.connect(this.sfxGain);

      this.launchOsc.start();

      const now = this.ctx.currentTime;
      // Volume Ramp: Max out quickly to sustain roar
      this.launchGain.gain.linearRampToValueAtTime(1.0, now + 2.0);
      // Frequency Ramp: Slowly open up to simulate higher velocity/atmosphere tear
      this.launchFilter.frequency.exponentialRampToValueAtTime(2000, now + 10.0);
  }

  stopLaunchSequence() {
      if (this.launchGain && this.ctx) {
          try {
             this.launchGain.gain.cancelScheduledValues(this.ctx.currentTime);
             // Short fade out (0.1s) to sharp stop for 'Pac' sound
             this.launchGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
             const g = this.launchGain;
             setTimeout(() => { try { g.disconnect(); } catch(e){} }, 150);
          } catch(e) {}
      }
      if (this.launchOsc) {
          try { this.launchOsc.stop(this.ctx!.currentTime + 0.1); } catch(e) {}
          try { this.launchOsc.disconnect(); } catch(e) {}
          this.launchOsc = null;
      }
      if (this.launchFilter) {
          try { this.launchFilter.disconnect(); } catch(e) {}
          this.launchFilter = null;
      }
      this.launchGain = null;
  }

  // --- LANDING THRUSTER LOGIC ---
  startLandingThruster() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
      this.stopLandingThruster();

      this.landingOsc = this.ctx.createBufferSource();
      this.landingOsc.buffer = this.noiseBuffer;
      this.landingOsc.loop = true;

      this.landingFilter = this.ctx.createBiquadFilter();
      this.landingFilter.type = 'lowpass';
      // Low rumble for landing approach
      this.landingFilter.frequency.setValueAtTime(120, this.ctx.currentTime); 

      this.landingGain = this.ctx.createGain();
      // CRITICAL: Set gain to 0 instantly before connecting to avoid 'crack'
      this.landingGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.landingOsc.connect(this.landingFilter);
      this.landingFilter.connect(this.landingGain);
      this.landingGain.connect(this.sfxGain);

      this.landingOsc.start();
  }

  updateLandingThruster(intensity: number) {
      if (!this.ctx || !this.landingGain || !this.landingFilter) return;
      const now = this.ctx.currentTime;
      // Map intensity (0-1) to volume and frequency
      const targetGain = Math.max(0, Math.min(1, intensity)) * 0.7; 
      const targetFreq = 100 + (intensity * 400); // Keep it low and rumbly

      this.landingGain.gain.setTargetAtTime(targetGain, now, 0.1);
      this.landingFilter.frequency.setTargetAtTime(targetFreq, now, 0.1);
  }

  stopLandingThruster() {
      if (this.landingGain && this.ctx) {
          try {
             this.landingGain.gain.cancelScheduledValues(this.ctx.currentTime);
             this.landingGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
             const g = this.landingGain;
             setTimeout(() => { try { g.disconnect(); } catch(e){} }, 200);
          } catch(e) {}
      }
      if (this.landingOsc) {
          try { this.landingOsc.stop(this.ctx!.currentTime + 0.1); } catch(e) {}
          try { this.landingOsc.disconnect(); } catch(e) {}
          this.landingOsc = null;
      }
      if (this.landingFilter) {
          try { this.landingFilter.disconnect(); } catch(e) {}
          this.landingFilter = null;
      }
      this.landingGain = null;
  }

  // New Dedicated Landing Thud (Low frequency impact)
  playLandThud() { 
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
      const now = this.ctx.currentTime;
      
      // 1. Low Thud (Sine)
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.connect(subGain); subGain.connect(this.sfxGain);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(80, now);
      sub.frequency.exponentialRampToValueAtTime(10, now + 0.3);
      subGain.gain.setValueAtTime(0.8, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      sub.start(now); sub.stop(now + 0.3);

      // 2. Dust Impact (Filtered Noise)
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now); // Muffled
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.5, now);
      nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      
      noise.connect(filter); filter.connect(nGain); nGain.connect(this.sfxGain);
      noise.start(now); noise.stop(now + 0.2);
  }

  playCountdownBeep(isIgnition: boolean) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.sfxGain);
      
      osc.type = isIgnition ? 'square' : 'triangle';
      // High pitch for Ignition (Go!), Mid pitch for count
      osc.frequency.setValueAtTime(isIgnition ? 1200 : 800, now); 
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      
      osc.start(now);
      osc.stop(now + 0.15);
  }

  playSteamRelease() {
    if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
    this.registerSfx();
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(100, now + 1.5);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
    src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
    src.start(now); src.stop(now + 1.5);
  }
}

export const audioService = new AudioService();
