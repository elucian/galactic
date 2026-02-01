
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

  private currentTheme: string = 'music'; // Default folder

  // Base URL for assets
  private readonly baseUrl = 'https://mthwbpvmznxexpm4.public.blob.vercel-storage.com';

  // Track Mapping
  private tracks: Record<string, string> = {
      'intro': `${this.baseUrl}/music/intro.mp3`,
      'command': `${this.baseUrl}/music/hangar.mp3`,
      'map': `${this.baseUrl}/music/map.mp3`,
      'combat': `${this.baseUrl}/music/combat.mp3`,
  };

  private reactorOsc: OscillatorNode | null = null;
  private reactorGain: GainNode | null = null;
  
  private lastSfxTime: number = 0;

  // Procedural Loops State
  private launchNodes: any = null;
  private landingNodes: any = null;
  private reEntryNodes: any = null;
  private warpNodes: any = null;

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

            // GENERATE PURE WHITE NOISE BUFFER (5 seconds)
            const bufferSize = this.ctx.sampleRate * 5; 
            this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1); 
            }
        }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(e => {});
    }
    this.updateMusicState();
  }

  setTheme(theme: string) {
      // Map theme names to folder names
      let folder = 'music'; // Default 'Retro'
      if (theme === 'classic') folder = 'Classic';
      if (theme === 'modern') folder = 'Modern';
      
      if (this.currentTheme !== folder) {
          this.currentTheme = folder;
          this.updateTrackPaths();
          
          // Reload current track if playing
          if (this.intendedTrack && this.musicEnabled) {
              this.loadAndPlay(this.intendedTrack);
          }
      }
  }

  private updateTrackPaths() {
      const folder = this.currentTheme;
      this.tracks = {
          'intro': `${this.baseUrl}/${folder}/intro.mp3`,
          'command': `${this.baseUrl}/${folder}/hangar.mp3`,
          'map': `${this.baseUrl}/${folder}/map.mp3`,
          'combat': `${this.baseUrl}/${folder}/combat.mp3`,
      };
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

  private getFileName(trackId: string): string {
      switch(trackId) {
          case 'intro': return 'intro.mp3';
          case 'command': return 'hangar.mp3';
          case 'map': return 'map.mp3';
          case 'combat': return 'combat.mp3';
          default: return 'intro.mp3';
      }
  }

  private loadAndPlay(trackId: string) {
      const path = this.tracks[trackId];
      if (!path) return;
      
      if (this.introAudio) {
          const currentSrc = this.introAudio.src;
          // Check if same URL (same file and same theme folder)
          if (currentSrc === path) { 
               if (this.introAudio.paused && this.musicEnabled && this.musicVolume > 0) {
                   this.introAudio.play().catch(e => { });
               }
               return; 
          }
          this.introAudio.volume = 0;
          this.introAudio.pause();
          this.introAudio.removeAttribute('src');
          this.introAudio.load();
          this.introAudio = null;
      }

      if (!this.musicEnabled || this.musicVolume <= 0) return;

      const audio = new Audio(path);
      audio.crossOrigin = "anonymous";
      audio.loop = true;
      audio.volume = this.musicVolume;

      // Fallback Logic: If themed music fails, load from default 'music' folder
      audio.onerror = () => {
          // If we are NOT already using the default 'music' folder, try fallback
          if (this.currentTheme !== 'music') {
              const fallbackPath = `${this.baseUrl}/music/${this.getFileName(trackId)}`;
              
              // Only retry if we haven't already retried to this path
              if (audio.src !== fallbackPath) {
                  console.warn(`Audio theme '${this.currentTheme}' file missing for ${trackId}. Falling back to default.`);
                  audio.src = fallbackPath;
                  audio.play().catch(e => {});
                  return; // Allow fallback attempt
              }
          }
          
          // Critical Failure: Default failed or Fallback failed
          console.warn(`Audio track ${trackId} failed to load. Muting music.`);
          this.setMusicVolume(0);
          this.setMusicEnabled(false);
      };

      audio.play().catch(e => {});
      this.introAudio = audio;
  }

  playTrack(type: string) {
    this.intendedTrack = type;
    if (this.musicEnabled && this.musicVolume > 0) this.loadAndPlay(type);
  }

  pauseMusic() { if (this.introAudio) this.introAudio.pause(); }
  resumeMusic() { if (this.musicEnabled && this.introAudio && this.introAudio.src) this.introAudio.play().catch(e => console.warn("Resume failed", e)); }

  stop() {
      if (this.introAudio) {
          this.introAudio.volume = 0;
          this.introAudio.pause();
          this.introAudio.removeAttribute('src');
          this.introAudio.load();
          this.introAudio = null;
      }
      this.intendedTrack = null; 
      this.stopBattleSounds();
  }

  stopBattleSounds() {
      this.updateReactorHum(false, 0);
      this.stopLaunchSequence();
      this.stopLandingThruster();
      this.stopReEntryWind();
      this.stopWarpHum(false);
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
          gain1.gain.setValueAtTime(0, now);
          gain1.gain.linearRampToValueAtTime(0.08, now + 0.01);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc1.start(now); osc1.stop(now + 0.04);

          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();
          osc2.connect(gain2); gain2.connect(this.sfxGain);
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(500, now + 0.08);
          gain2.gain.setValueAtTime(0, now + 0.08);
          gain2.gain.linearRampToValueAtTime(0.08, now + 0.09);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          osc2.start(now + 0.08); osc2.stop(now + 0.14);

      } else if (id === 'denied') {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain); gain.connect(this.sfxGain);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
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
          noise.connect(filter); filter.connect(nGain); nGain.connect(panner);
          noise.start(now); noise.stop(now + 0.3);
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
          osc.disconnect(); osc.connect(filter); filter.connect(gain);
          gain.gain.setValueAtTime(0.8, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          osc.start(now); osc.stop(now + 0.25);
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

  // UPDATED: High-fidelity impact sounds
  playImpact(material: 'rock' | 'metal' | 'ice' | 'shield', intensity: number = 1.0) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      this.registerSfx();
      const now = this.ctx.currentTime;
      
      const vol = Math.min(1.0, 0.3 * intensity);

      if (material === 'shield') {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain); gain.connect(this.sfxGain);
          
          const mod = this.ctx.createOscillator();
          const modGain = this.ctx.createGain();
          mod.connect(modGain);
          modGain.connect(osc.frequency);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          
          mod.type = 'sine';
          mod.frequency.setValueAtTime(50, now);
          modGain.gain.setValueAtTime(200, now);
          modGain.gain.exponentialRampToValueAtTime(1, now + 0.2);

          gain.gain.setValueAtTime(vol * 0.8, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          
          osc.start(now); osc.stop(now + 0.2);
          mod.start(now); mod.stop(now + 0.2);
          
      } else if (material === 'metal') {
          if (this.noiseBuffer) {
              const noise = this.ctx.createBufferSource();
              noise.buffer = this.noiseBuffer;
              const filter = this.ctx.createBiquadFilter();
              filter.type = 'bandpass';
              filter.frequency.setValueAtTime(1000, now);
              filter.Q.value = 1.0;
              const nGain = this.ctx.createGain();
              nGain.gain.setValueAtTime(vol, now);
              nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
              noise.connect(filter); filter.connect(nGain); nGain.connect(this.sfxGain);
              noise.start(now); noise.stop(now + 0.1);
          }
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain); gain.connect(this.sfxGain);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.linearRampToValueAtTime(380, now + 0.15);
          gain.gain.setValueAtTime(vol * 0.6, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          osc.start(now); osc.stop(now + 0.2);

      } else if (material === 'rock') {
          if (this.noiseBuffer) {
              const noise = this.ctx.createBufferSource();
              noise.buffer = this.noiseBuffer;
              const filter = this.ctx.createBiquadFilter();
              filter.type = 'lowpass';
              filter.frequency.setValueAtTime(300, now);
              const nGain = this.ctx.createGain();
              nGain.gain.setValueAtTime(vol * 1.2, now);
              nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
              noise.connect(filter); filter.connect(nGain); nGain.connect(this.sfxGain);
              noise.start(now); noise.stop(now + 0.15);
          }

      } else if (material === 'ice') {
          if (this.noiseBuffer) {
              const noise = this.ctx.createBufferSource();
              noise.buffer = this.noiseBuffer;
              const filter = this.ctx.createBiquadFilter();
              filter.type = 'highpass';
              filter.frequency.setValueAtTime(3000, now);
              const nGain = this.ctx.createGain();
              nGain.gain.setValueAtTime(vol * 0.8, now);
              nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
              noise.connect(filter); filter.connect(nGain); nGain.connect(this.sfxGain);
              noise.start(now); noise.stop(now + 0.1);
          }
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain); gain.connect(this.sfxGain);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2500, now);
          gain.gain.setValueAtTime(vol * 0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc.start(now); osc.stop(now + 0.1);
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

  // --- RE-ENTRY WIND ---
  startReEntryWind() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
      this.stopReEntryWind();
      const now = this.ctx.currentTime;
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, now);
      filter.Q.value = 1.0;
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
      
      this.reEntryNodes = { noise, gain, filter };
  }

  updateReEntryWind(intensity: number) {
      if (!this.reEntryNodes || !this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = 400 + (intensity * 800);
      const vol = intensity * 0.4;
      
      this.reEntryNodes.filter.frequency.setTargetAtTime(freq, now, 0.2);
      this.reEntryNodes.gain.gain.setTargetAtTime(vol, now, 0.2);
  }

  stopReEntryWind() {
      if (this.reEntryNodes && this.ctx) {
          this.reEntryNodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
          const nodes = this.reEntryNodes;
          setTimeout(() => { nodes.noise.stop(); }, 500);
      }
      this.reEntryNodes = null;
  }

  // --- LAUNCH ENGINE ---
  playLaunchSequence() {
      this.stopLaunchSequence(); 
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      if (this.ctx.state !== 'running') {
          this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;
      const seqMaster = this.ctx.createGain();
      seqMaster.gain.value = 1.0; 
      seqMaster.connect(this.sfxGain);

      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(50, now);
      osc1.frequency.linearRampToValueAtTime(180, now + 10); 
      
      const rumbleFilter = this.ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 400; 

      const rumbleGain = this.ctx.createGain();
      rumbleGain.gain.value = 1.0; 
      
      osc1.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(seqMaster);
      osc1.start(now);

      if (!this.noiseBuffer) {
          const bufferSize = this.ctx.sampleRate * 2;
          this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = this.noiseBuffer;
      noiseNode.loop = true;
      
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(100, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(800, now + 8); 
      
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.value = 0.3; 
      
      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(seqMaster);
      noiseNode.start(now);

      this.launchNodes = { 
          osc1, 
          noiseNode, 
          masterGain: seqMaster 
      };
  }

  stopLaunchSequence() {
      if (this.launchNodes && this.ctx) {
          const now = this.ctx.currentTime;
          const { masterGain, osc1, noiseNode } = this.launchNodes;
          
          if (masterGain) {
              masterGain.gain.cancelScheduledValues(now);
              masterGain.gain.setValueAtTime(masterGain.gain.value, now);
              masterGain.gain.linearRampToValueAtTime(0, now + 0.2);
          }
          
          setTimeout(() => {
              if (osc1) osc1.stop();
              if (noiseNode) noiseNode.stop();
              if (masterGain) masterGain.disconnect();
          }, 250);
      }
      this.launchNodes = null;
  }

  // --- WARP SOUND: WOUP WOUP EFFECT ---
  // Uses LFO modulated filter to create resonant "woup woup" sweep
  playWarpHum() {
      this.stopWarpHum(false);
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      if (this.ctx.state !== 'running') {
          this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;

      // Master Gain for Warp
      const master = this.ctx.createGain();
      master.connect(this.sfxGain);
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(0.5, now + 0.5); // Fast Fade in

      // 1. Source Oscillator (Deep Drone)
      const carrier = this.ctx.createOscillator();
      carrier.type = 'sawtooth';
      carrier.frequency.setValueAtTime(55, now); // Low reactor rumble (55Hz)
      // Slight pitch variance to make it dynamic
      carrier.frequency.linearRampToValueAtTime(80, now + 2.0);
      carrier.frequency.linearRampToValueAtTime(45, now + 4.0);

      // 2. Filter for "Woup" sound (Resonant Lowpass)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 6; // High resonance for "Woup" vowel-like sound
      filter.frequency.setValueAtTime(400, now); // Base cutoff center

      // 3. LFO for "Woup" modulation (Modulates Filter Frequency)
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(3, now); // Start slow (woup... woup)
      // Speed up during acceleration
      lfo.frequency.exponentialRampToValueAtTime(10, now + 2.0); // (wupwupwup)
      // Slow down during deceleration
      lfo.frequency.linearRampToValueAtTime(2, now + 4.5); // (wap... wap)

      // LFO Depth (How much it sweeps the filter)
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(300, now); // Sweep range +/- 300Hz around 400Hz

      // Wiring
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      
      carrier.connect(filter);
      filter.connect(master);

      // Start
      carrier.start(now);
      lfo.start(now);

      // Store references
      this.warpNodes = { master, carrier, lfo, lfoGain };
  }

  stopWarpHum(playTail: boolean = false) {
      if (this.warpNodes && this.ctx && this.sfxEnabled) {
          const now = this.ctx.currentTime;
          const { master, carrier, lfo, hissSrc, hissGain } = this.warpNodes; 

          if (playTail) {
              // --- START TAIL SEQUENCE (Gradual Stop + Steam) ---
              if (master && carrier && lfo) {
                  master.gain.cancelScheduledValues(now);
                  master.gain.setValueAtTime(master.gain.value, now);
                  master.gain.exponentialRampToValueAtTime(0.001, now + 2.0); 

                  carrier.frequency.cancelScheduledValues(now);
                  carrier.frequency.setValueAtTime(carrier.frequency.value, now);
                  carrier.frequency.exponentialRampToValueAtTime(20, now + 2.0);

                  lfo.frequency.cancelScheduledValues(now);
                  lfo.frequency.setValueAtTime(lfo.frequency.value, now);
                  lfo.frequency.linearRampToValueAtTime(0.5, now + 2.0);
              }

              // Create Steam/Hiss (Woush sh sh)
              let newHissSrc = null;
              let newHissGain = null;
              
              if (this.noiseBuffer) {
                  newHissSrc = this.ctx.createBufferSource();
                  newHissSrc.buffer = this.noiseBuffer;
                  newHissSrc.loop = true;
                  
                  const hissFilter = this.ctx.createBiquadFilter();
                  hissFilter.type = 'highpass';
                  hissFilter.frequency.value = 800;

                  newHissGain = this.ctx.createGain();
                  newHissSrc.connect(hissFilter);
                  hissFilter.connect(newHissGain);
                  newHissGain.connect(this.sfxGain);

                  newHissGain.gain.setValueAtTime(0, now);
                  newHissGain.gain.linearRampToValueAtTime(0.4, now + 0.5); // Attack
                  newHissGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5); // Decay

                  newHissSrc.start(now);
                  newHissSrc.stop(now + 2.6);
              }

              // Update stored nodes to include hiss so it can be killed if needed
              this.warpNodes = { ...this.warpNodes, hissSrc: newHissSrc, hissGain: newHissGain };

              // Cleanup timeout
              setTimeout(() => {
                  if (this.warpNodes && this.warpNodes.master === master) {
                      if (carrier) carrier.stop();
                      if (lfo) lfo.stop();
                      if (master) master.disconnect();
                      this.warpNodes = null;
                  }
              }, 2600);

          } else {
              // --- IMMEDIATE STOP (Clean Kill) ---
              if (master) {
                  master.gain.cancelScheduledValues(now);
                  master.gain.setValueAtTime(master.gain.value, now);
                  master.gain.linearRampToValueAtTime(0, now + 0.1);
              }
              
              if (hissGain) {
                  hissGain.gain.cancelScheduledValues(now);
                  hissGain.gain.linearRampToValueAtTime(0, now + 0.1);
              }
              
              setTimeout(() => {
                  if (carrier) carrier.stop();
                  if (lfo) lfo.stop();
                  if (hissSrc) hissSrc.stop();
                  if (master) master.disconnect();
                  if (hissGain) hissGain.disconnect();
              }, 150);
              
              this.warpNodes = null;
          }
      } else {
          this.warpNodes = null;
      }
  }

  // --- LANDING THRUSTER ---
  startLandingThruster() {
      this.stopLandingThruster(); 
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      osc.type = 'triangle'; 
      osc.frequency.setValueAtTime(100, now); 

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(10, now); 
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 20; 

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0, now);

      osc.connect(oscGain);
      oscGain.connect(this.sfxGain);
      osc.start(now);

      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = this.noiseBuffer;
      noiseSrc.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass'; 
      noiseFilter.frequency.value = 1000; 

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);

      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);
      noiseSrc.start(now);

      this.landingNodes = { osc, oscGain, lfo, noiseSrc, noiseGain };
  }

  updateLandingThruster(intensity: number) {
      if (!this.landingNodes || !this.ctx) return;
      const now = this.ctx.currentTime;
      
      const targetPitch = 80 + (intensity * 100);
      const targetVol = intensity * 0.8; 
      
      this.landingNodes.osc.frequency.setTargetAtTime(targetPitch, now, 0.1);
      this.landingNodes.oscGain.gain.setTargetAtTime(targetVol, now, 0.1);
      
      this.landingNodes.lfo.frequency.setTargetAtTime(10 + (intensity * 20), now, 0.1);

      const hissVol = intensity * 0.1; 
      this.landingNodes.noiseGain.gain.setTargetAtTime(hissVol, now, 0.1);
  }

  stopLandingThruster() {
      if (this.landingNodes && this.ctx) {
          const now = this.ctx.currentTime;
          const { oscGain, noiseGain, osc, noiseSrc, lfo } = this.landingNodes;
          
          if (oscGain) oscGain.gain.setTargetAtTime(0, now, 0.2);
          if (noiseGain) noiseGain.gain.setTargetAtTime(0, now, 0.2);
          
          setTimeout(() => {
              if (osc) osc.stop();
              if (lfo) lfo.stop();
              if (noiseSrc) noiseSrc.stop();
          }, 250);
      }
      this.landingNodes = null;
  }

  // --- ONE-SHOT SFX ---

  playLaunchBang() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const now = this.ctx.currentTime;
      
      if (this.noiseBuffer) {
          const src = this.ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2000, now);
          
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.8, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
          
          src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
          src.start(now); src.stop(now + 0.8);
      }

      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.connect(g); g.connect(this.sfxGain);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5); 
      
      g.gain.setValueAtTime(1.0, now);
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      
      osc.start(now); osc.stop(now + 0.5);
  }

  playLandingIgnition() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const now = this.ctx.currentTime;
      
      if (this.noiseBuffer) {
          const src = this.ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass'; 
          filter.frequency.setValueAtTime(800, now);
          
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.4, now + 0.05); 
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          
          src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
          src.start(now); src.stop(now + 0.3);
      }

      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; 
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.3);
      
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.5, now + 0.05); 
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(now); osc.stop(now + 0.3);
  }

  playLandThud() { 
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const now = this.ctx.currentTime;
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.connect(subGain); subGain.connect(this.sfxGain);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(60, now);
      sub.frequency.exponentialRampToValueAtTime(10, now + 0.2);
      
      subGain.gain.setValueAtTime(0, now);
      subGain.gain.linearRampToValueAtTime(0.7, now + 0.02); 
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      
      sub.start(now); sub.stop(now + 0.2);
  }

  playSteamRelease() {
    if (!this.ctx || !this.sfxGain || !this.sfxEnabled || !this.noiseBuffer) return;
    this.registerSfx();
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass'; 
    filter.frequency.setValueAtTime(1000, now); 
    const gain = this.ctx.createGain();
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.1); 
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
    
    src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
    src.start(now); src.stop(now + 1.2);
  }

  playCountdownBeep(isIgnition: boolean) {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.type = isIgnition ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(isIgnition ? 1200 : 800, now); 
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      
      osc.start(now); osc.stop(now + 0.15);
  }

  playOrbitLatch() {
      if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth'; 
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
      const g = this.ctx.createGain();
      
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.4, now + 0.01); 
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      
      osc.connect(filter); filter.connect(g); g.connect(this.sfxGain);
      osc.start(now); osc.stop(now + 0.1);
  }
}

export const audioService = new AudioService();
