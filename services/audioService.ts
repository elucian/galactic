
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

            // Create Global Noise Buffer for Explosions (Optimization)
            const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
            this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
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
      // Note: We do NOT stop battle sounds here to allow launch/landing FX to persist while music is paused.
  }

  resumeMusic() {
      if (this.musicEnabled && this.introAudio && this.introAudio.src) {
          this.introAudio.play().catch(e => console.warn("Resume failed", e));
      }
  }

  // Stop completely resets (used when changing screens where we want silence or cleanup)
  stop() {
      if (this.introAudio) {
          this.introAudio.pause();
          this.introAudio.currentTime = 0;
      }
      // Note: Removed stopBattleSounds() to avoid race conditions with component unmounting/remounting 
      // where the new component starts a sound (like landing thruster) but App.tsx calls stop() after.
      // Components are responsible for cleaning up their own specific SFX via stopBattleSounds or specific stops.
  }

  stopBattleSounds() {
      this.updateReactorHum(false, 0);
      this.stopLaunchSequence();
      this.stopLandingThruster();
  }

  private registerSfx() {
      this.lastSfxTime = Date.now();
      // Aggressive Ducking: Mute reactor hum if an explosion or shot happens
      if (this.reactorGain && this.ctx) {
          this.reactorGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.reactorGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
  }

  playSfx(id: string) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      this.registerSfx();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.sfxGain);
      const now = this.ctx.currentTime;

      if (id === 'click' || id === 'buy') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.exponentialRampToValueAtTime(1800, now + 0.05);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc.start(); osc.stop(now + 0.1);
      } else if (id === 'denied') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, now);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.start(); osc.stop(now + 0.3);
      }
  }

  playWeaponFire(type: string, pan = 0, shipId?: string) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      this.registerSfx();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      
      // Basic routing for oscillator based sounds
      gain.connect(panner);
      panner.connect(this.sfxGain);
      panner.pan.value = Math.max(-1, Math.min(1, pan));

      const now = this.ctx.currentTime;
      
      // 1. FLAME ("WUSH WUSH")
      if (type === 'flame') {
          if (!this.noiseBuffer) return;
          const noise = this.ctx.createBufferSource();
          noise.buffer = this.noiseBuffer;
          
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(600, now);
          filter.frequency.linearRampToValueAtTime(100, now + 0.3); // Muffled sweep down

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

      // 2. POWER SHOT ("PAW PAW")
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
      
      // 3. PHASER SWEEP ("TIEU")
      if (type === 'phaser') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.1); 
          
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          
          osc.start(now);
          osc.stop(now + 0.1);
          return;
      }

      // 4. MISSILE ("FSHHHIW ZBANG")
      if (type === 'missile' || type === 'missile_emp' || type === 'emp' || type === 'mine') {
          // A. Noise
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
          
          // B. Tonal
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.4);
          osc.connect(gain);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.4);
          osc.start(now); osc.stop(now + 0.4);
          return;
      }

      // 5. STANDARD WEAPONS
      osc.connect(gain);
      if (type.includes('laser') || type.includes('electric')) {
          // PEW PEW
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          osc.start(); osc.stop(now + 0.15);
      } else {
          // RAKA PAKA
          osc.type = 'sawtooth'; 
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.08); 
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
          osc.start(); osc.stop(now + 0.12);
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
          // Bright "CRACK" - Higher freq, Highpass filter
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          
          filter.type = 'highpass';
          filter.frequency.value = 150; // Cut low mud

          osc.type = 'sawtooth'; // Sharper sound
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.05); // Fast drop

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

  // --- LAUNCH THRUSTER LOGIC ---
  playLaunchSequence() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
      this.registerSfx();
      this.stopLaunchSequence(); // Clean up prev

      // Noise source
      this.launchOsc = this.ctx.createBufferSource();
      this.launchOsc.buffer = this.noiseBuffer;
      this.launchOsc.loop = true;

      // Filter: Starts low rumbling, opens up
      this.launchFilter = this.ctx.createBiquadFilter();
      this.launchFilter.type = 'lowpass';
      this.launchFilter.frequency.setValueAtTime(100, this.ctx.currentTime);

      // Envelope
      this.launchGain = this.ctx.createGain();
      this.launchGain.gain.setValueAtTime(0, this.ctx.currentTime);

      // Connect
      this.launchOsc.connect(this.launchFilter);
      this.launchFilter.connect(this.launchGain);
      this.launchGain.connect(this.sfxGain);

      this.launchOsc.start();

      // Automation
      const now = this.ctx.currentTime;
      // Volume Ramp
      this.launchGain.gain.linearRampToValueAtTime(0.8, now + 2.0);
      // Frequency Ramp (Engine spool up)
      this.launchFilter.frequency.exponentialRampToValueAtTime(1000, now + 4.0);
  }

  stopLaunchSequence() {
      if (this.launchGain && this.ctx) {
          try {
             this.launchGain.gain.cancelScheduledValues(this.ctx.currentTime);
             this.launchGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
          } catch(e) {}
      }
      if (this.launchOsc) {
          try { this.launchOsc.stop(this.ctx!.currentTime + 0.5); } catch(e) {}
          this.launchOsc = null;
      }
      this.launchFilter = null;
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
      this.landingFilter.frequency.setValueAtTime(200, this.ctx.currentTime);

      this.landingGain = this.ctx.createGain();
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
      const targetGain = Math.max(0, Math.min(1, intensity)) * 0.6; 
      const targetFreq = 150 + (intensity * 600); 

      this.landingGain.gain.setTargetAtTime(targetGain, now, 0.1);
      this.landingFilter.frequency.setTargetAtTime(targetFreq, now, 0.1);
  }

  stopLandingThruster() {
      if (this.landingGain && this.ctx) {
          try {
             this.landingGain.gain.cancelScheduledValues(this.ctx.currentTime);
             this.landingGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
          } catch(e) {}
      }
      if (this.landingOsc) {
          try { this.landingOsc.stop(this.ctx!.currentTime + 0.2); } catch(e) {}
          this.landingOsc = null;
      }
      this.landingFilter = null;
      this.landingGain = null;
  }

  playLandThud() { this.playHullHit('asteroid'); }
}

export const audioService = new AudioService();
