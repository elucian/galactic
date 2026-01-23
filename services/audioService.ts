
class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null; // Dedicated SFX bus
  
  private musicVolume: number = 0.3;
  private sfxVolume: number = 0.5;
  private musicEnabled: boolean = true;
  private sfxEnabled: boolean = true;
  
  // Background Music State
  private introAudio: HTMLAudioElement | null = null;
  private intendedTrack: string | null = null; // Track we *want* to be playing
  
  // Track Mapping - Using Vercel Blob Storage
  private tracks: Record<string, string> = {
      'intro': 'https://mthwbpvmznxexpm4.public.blob.vercel-storage.com/music/intro.mp3',
      'command': 'https://mthwbpvmznxexpm4.public.blob.vercel-storage.com/music/hangar.mp3',
      'map': 'https://mthwbpvmznxexpm4.public.blob.vercel-storage.com/music/map.mp3',
      'combat': 'https://mthwbpvmznxexpm4.public.blob.vercel-storage.com/music/combat.mp3'
  };

  private activeNodes: Set<AudioNode> = new Set();
  
  // Launch Sound State
  private launchGain: GainNode | null = null;

  // Landing Sound State
  private landingThrusterOsc: AudioBufferSourceNode | null = null;
  private landingThrusterGain: GainNode | null = null;
  private landingThrusterFilter: BiquadFilterNode | null = null;
  private ambienceNodes: AudioNode[] = [];

  // Reactor Sound State
  private reactorOsc: OscillatorNode | null = null;
  private reactorGain: GainNode | null = null;
  private reactorLfo: OscillatorNode | null = null;

  // Called explicitly on user interaction (click) by App.tsx
  init() {
    // 1. Create AudioContext if it doesn't exist
    if (!this.ctx) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (AudioContextClass) {
            this.ctx = new AudioContextClass();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            
            // Create dedicated SFX bus
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);
            
            // Apply initial volumes
            this.updateSfxState();
        }
    }

    // 2. Resume Context if suspended (Browser Autoplay Policy)
    if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(e => console.debug("AudioContext resume failed", e));
    }

    // 3. Retry playing background music if it was blocked or pending
    this.updateMusicState();
  }

  private createPanner(x: number): StereoPannerNode | null {
    if (!this.ctx) return null;
    const panner = this.ctx.createStereoPanner();
    const panValue = Math.max(-1, Math.min(1, x));
    panner.pan.setValueAtTime(panValue, this.ctx.currentTime);
    return panner;
  }

  private updateMusicState() {
      if (this.introAudio) {
          this.introAudio.volume = this.musicVolume;
          if (this.musicEnabled) {
              if (this.introAudio.paused && this.introAudio.src) {
                  this.introAudio.play().catch(e => { /* Autoplay block expected */ });
              }
          } else {
              this.introAudio.pause();
          }
      } else if (this.musicEnabled && this.intendedTrack && this.musicVolume > 0) {
          // If enabled, intended, and no audio yet, load it
          this.loadAndPlay(this.intendedTrack);
      }
  }

  private updateSfxState() {
      if (this.sfxGain && this.ctx) {
          const target = this.sfxEnabled ? this.sfxVolume : 0;
          this.sfxGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      }
  }

  setMusicVolume(v: number) {
    this.musicVolume = v;
    this.updateMusicState();
  }

  setSfxVolume(v: number) {
    this.sfxVolume = v;
    this.updateSfxState();
  }

  setMusicEnabled(e: boolean) {
    this.musicEnabled = e;
    this.updateMusicState();
  }

  setSfxEnabled(e: boolean) {
    this.sfxEnabled = e;
    this.updateSfxState();
  }

  // Internal helper to actually load the file
  private loadAndPlay(trackId: string) {
      const path = this.tracks[trackId];
      if (!path) return;

      // Check if we are already playing this track
      if (this.introAudio) {
          const currentSrc = this.introAudio.src;
          const fileName = path.split('/').pop() || '';
          
          if (currentSrc === path || (fileName && currentSrc.includes(fileName))) { 
               if (this.introAudio.paused && this.musicEnabled && this.musicVolume > 0) {
                   this.introAudio.play().catch(e => { });
               }
               return; 
          }
          
          this.introAudio.onerror = null;
          this.introAudio.onended = null;
          this.introAudio.pause();
          this.introAudio.src = "";
          this.introAudio.load();
          this.introAudio = null;
      }

      if (!this.musicEnabled) return;

      const audio = new Audio(path);
      audio.crossOrigin = "anonymous";
      audio.loop = true;
      audio.volume = this.musicVolume;
      
      audio.onerror = (e) => {
          if (this.introAudio === audio) {
              console.warn(`Error loading audio file: ${path}`, e);
          }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
          playPromise.catch(error => {});
      }
      
      this.introAudio = audio;
  }

  playTrack(type: 'intro' | 'command' | 'map' | 'combat') {
    this.intendedTrack = type;
    if (this.musicEnabled && this.musicVolume > 0) {
        this.loadAndPlay(type);
    }
  }

  stop() {
    this.intendedTrack = null;
    if (this.introAudio) {
      this.introAudio.onerror = null;
      this.introAudio.pause();
      this.introAudio = null;
    }
  }

  // --- SFX Methods ---

  playHullHit(type: 'energy' | 'projectile') {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dest = this.sfxGain;

    if (type === 'energy') {
        // "Frr" - Frying Sound (Frying fish in pan)
        // BufferSource white noise with Bandpass and crackle envelope
        const bSize = ctx.sampleRate * 0.4; // 400ms duration
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        
        const noise = ctx.createBufferSource();
        noise.buffer = b;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, t);
        filter.Q.value = 1;

        const gain = ctx.createGain();
        // Crackle envelope: Random jitter in volume
        gain.gain.setValueAtTime(0.4, t);
        for(let i=0; i<8; i++) {
             gain.gain.linearRampToValueAtTime(Math.random() * 0.3 + 0.1, t + (i*0.05));
        }
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        noise.start(t);

    } else {
        // Projectile: "Slamp" or "Tiaw"
        if (Math.random() > 0.5) {
            // "Tiaw" - Ricochet (Metallic Ping Sweep)
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.exponentialRampToValueAtTime(1800, t + 0.15); // Rapid upward sweep "Ti-"
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            
            osc.connect(gain);
            gain.connect(dest);
            osc.start(t);
            osc.stop(t + 0.2);
        } else {
            // "Slamp" - Metallic Thud (Low noise burst + Square punch)
            const noise = ctx.createBufferSource();
            const bSize = ctx.sampleRate * 0.15;
            const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
            const d = b.getChannelData(0);
            for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
            noise.buffer = b;
            
            const nFilter = ctx.createBiquadFilter();
            nFilter.type = 'lowpass';
            nFilter.frequency.value = 400; // Muffled slam
            const nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0.8, t);
            nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            
            noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(dest);
            noise.start(t);
            
            // Metallic ring component
            const metal = ctx.createOscillator();
            metal.type = 'square';
            metal.frequency.setValueAtTime(150, t);
            metal.frequency.exponentialRampToValueAtTime(80, t + 0.1);
            const mGain = ctx.createGain();
            mGain.gain.setValueAtTime(0.4, t);
            mGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            
            metal.connect(mGain); mGain.connect(dest);
            metal.start(t); metal.stop(t + 0.15);
        }
    }
  }

  startLandingThruster() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5 + (white * 0.05); 
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 100; 

    const gain = ctx.createGain();
    gain.gain.value = 0;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain); // Connect to SFX bus
    
    noise.start();
    
    this.landingThrusterOsc = noise;
    this.landingThrusterFilter = filter;
    this.landingThrusterGain = gain;
  }

  updateLandingThruster(intensity: number) {
    if (this.landingThrusterGain && this.landingThrusterFilter && this.ctx) {
        const t = this.ctx.currentTime;
        const vol = Math.max(0, Math.min(0.7, intensity));
        this.landingThrusterGain.gain.setTargetAtTime(vol, t, 0.1);
        const freq = 80 + (intensity * 520); 
        this.landingThrusterFilter.frequency.setTargetAtTime(freq, t, 0.1);
    }
  }

  stopLandingThruster() {
    if (this.landingThrusterGain && this.ctx) {
        this.landingThrusterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
        setTimeout(() => {
            if (this.landingThrusterOsc) { try { this.landingThrusterOsc.stop(); } catch(e){} this.landingThrusterOsc.disconnect(); this.landingThrusterOsc = null; }
            if (this.landingThrusterFilter) { this.landingThrusterFilter.disconnect(); this.landingThrusterFilter = null; }
            if (this.landingThrusterGain) { this.landingThrusterGain.disconnect(); this.landingThrusterGain = null; }
        }, 600);
    }
  }

  // --- REACTOR HUM (Only when music disabled) ---
  // "Brrruyuuuu" - Transformer Hum logic
  // Frequency ramps from 50Hz to 300Hz based on chargePct (0-100)
  updateReactorHum(active: boolean, chargePct: number = 0) {
      // Only play extra FX if music is disabled
      const shouldPlay = active && !this.musicEnabled && this.sfxEnabled && !!this.ctx;

      if (shouldPlay) {
          if (!this.reactorGain || !this.reactorOsc) {
              this.init();
              if (!this.ctx || !this.sfxGain) return;
              
              const t = this.ctx.currentTime;
              this.reactorGain = this.ctx.createGain();
              this.reactorGain.gain.setValueAtTime(0, t);
              this.reactorGain.connect(this.sfxGain);

              this.reactorOsc = this.ctx.createOscillator();
              this.reactorOsc.type = 'sawtooth'; // Sawtooth for electrical buzz
              
              const filter = this.ctx.createBiquadFilter();
              filter.type = 'lowpass';
              filter.frequency.value = 120; // Keep it somewhat muted

              // LFO for throbbing load
              this.reactorLfo = this.ctx.createOscillator();
              this.reactorLfo.type = 'sine';
              this.reactorLfo.frequency.value = 8; // 8Hz flutter
              const lfoGain = this.ctx.createGain();
              lfoGain.gain.value = 30; 

              this.reactorOsc.connect(filter);
              this.reactorLfo.connect(lfoGain);
              lfoGain.connect(filter.frequency);
              filter.connect(this.reactorGain);

              this.reactorOsc.start(t);
              this.reactorLfo.start(t);
          }

          if (this.reactorOsc && this.reactorGain && this.ctx) {
              const t = this.ctx.currentTime;
              this.reactorGain.gain.setTargetAtTime(0.25, t, 0.1);
              
              // Ramp from 50Hz (empty) to 300Hz (full) as requested
              const baseFreq = 50;
              const maxFreq = 300;
              const freq = baseFreq + ((Math.min(100, Math.max(0, chargePct)) / 100) * (maxFreq - baseFreq));
              
              this.reactorOsc.frequency.setTargetAtTime(freq, t, 0.1);
          }

      } else {
          if (this.reactorGain && this.ctx) {
              const t = this.ctx.currentTime;
              this.reactorGain.gain.setTargetAtTime(0, t, 0.1);
          }
      }
  }

  stopReactorHum() {
      if (this.reactorGain && this.ctx) {
          this.reactorGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.reactorGain.gain.setValueAtTime(0, this.ctx.currentTime);
          
          if (this.reactorOsc) { try { this.reactorOsc.stop(); } catch(e){} this.reactorOsc.disconnect(); }
          if (this.reactorLfo) { try { this.reactorLfo.stop(); } catch(e){} this.reactorLfo.disconnect(); }
          this.reactorGain.disconnect();
          
          this.reactorOsc = null;
          this.reactorLfo = null;
          this.reactorGain = null;
      }
  }

  playLandThud() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(10, t + 0.3);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.4);

    const metalOsc = ctx.createOscillator();
    metalOsc.type = 'square';
    metalOsc.frequency.setValueAtTime(200, t);
    metalOsc.frequency.linearRampToValueAtTime(50, t + 0.15);
    
    const metalFilter = ctx.createBiquadFilter();
    metalFilter.type = 'bandpass';
    metalFilter.Q.value = 5;
    metalFilter.frequency.setValueAtTime(1000, t);

    const metalGain = ctx.createGain();
    metalGain.gain.setValueAtTime(0.3, t);
    metalGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    metalOsc.connect(metalFilter);
    metalFilter.connect(metalGain);
    metalGain.connect(this.sfxGain);
    metalOsc.start(t);
    metalOsc.stop(t + 0.2);

    const noise = ctx.createBufferSource();
    const bSize = ctx.sampleRate * 0.5;
    const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
    const d = b.getChannelData(0);
    for(let i=0; i<bSize; i++) d[i] = Math.random()*2-1;
    noise.buffer = b;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, t);
    noiseFilter.frequency.linearRampToValueAtTime(100, t + 0.4);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.4);
  }

  startCrickets() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 4000;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 4; 
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05; 
    lfo.connect(gain.gain);
    osc.connect(gain);
    gain.connect(this.sfxGain); // Ambience on SFX bus
    osc.start();
    lfo.start();
    this.ambienceNodes.push(osc, lfo, gain, lfoGain);
  }

  stopAmbience() {
    this.ambienceNodes.forEach(node => {
        try { node.disconnect(); } catch(e){}
        if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
            try { node.stop(); } catch(e){}
        }
    });
    this.ambienceNodes = [];
  }

  playLaunchSequence() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const seqGain = ctx.createGain();
    seqGain.connect(this.sfxGain); // Connect to SFX bus
    this.launchGain = seqGain;

    const bangOsc = ctx.createOscillator();
    bangOsc.type = 'square';
    bangOsc.frequency.setValueAtTime(80, t);
    bangOsc.frequency.exponentialRampToValueAtTime(10, t + 0.4);
    
    const bangGain = ctx.createGain();
    bangGain.gain.setValueAtTime(0.6, t);
    bangGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    
    const bangFilter = ctx.createBiquadFilter();
    bangFilter.type = 'lowpass';
    bangFilter.frequency.value = 200;

    bangOsc.connect(bangFilter);
    bangFilter.connect(bangGain);
    bangGain.connect(seqGain); 
    bangOsc.start(t);
    bangOsc.stop(t + 0.4);

    const duration = 12.0;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'lowpass';
    roarFilter.frequency.setValueAtTime(100, t);
    roarFilter.frequency.linearRampToValueAtTime(800, t + 4); 
    roarFilter.frequency.linearRampToValueAtTime(400, t + 10); 

    const roarGain = ctx.createGain();
    roarGain.gain.setValueAtTime(0, t);
    roarGain.gain.linearRampToValueAtTime(0.3, t + 0.5);
    roarGain.gain.linearRampToValueAtTime(0.2, t + 8);
    roarGain.gain.linearRampToValueAtTime(0, t + 12); 

    noise.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(seqGain); 
    noise.start(t);
    noise.stop(t + duration);
  }

  stopLaunchSequence() {
    if (this.launchGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.launchGain.gain.cancelScheduledValues(t);
        this.launchGain.gain.setValueAtTime(this.launchGain.gain.value, t);
        this.launchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        setTimeout(() => {
            if (this.launchGain) { this.launchGain.disconnect(); this.launchGain = null; }
        }, 550);
    }
  }

  playAlertSiren() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const gain = ctx.createGain();
    gain.connect(this.sfxGain); // SFX

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2; 
    filter.frequency.setValueAtTime(1000, t);

    osc.frequency.setValueAtTime(293, t);
    osc.frequency.linearRampToValueAtTime(246, t + 0.2); 
    osc.frequency.exponentialRampToValueAtTime(587, t + 1.0); 
    
    const filterLfo = ctx.createOscillator();
    filterLfo.type = 'sine';
    filterLfo.frequency.value = 3.5; 

    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = 600; 

    filter.frequency.setValueAtTime(800, t);
    filter.frequency.linearRampToValueAtTime(1200, t + 1.0);

    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);
    
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.5);
    gain.gain.linearRampToValueAtTime(0, t + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    osc.start(t);
    filterLfo.start(t);
    osc.stop(t + 1.2);
    filterLfo.stop(t + 1.2);
  }

  playSfx(type: 'click' | 'transition' | 'denied' | 'buy') {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.sfxGain); // SFX

    if (type === 'click') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(g);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'transition') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.connect(g);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'denied') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.setValueAtTime(80, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      osc.connect(g);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'buy') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.05);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.connect(g);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  }

  playExplosion(pan: number = 0, scale: number = 1.0, type: 'normal' | 'mine' | 'player' | 'boss' | 'asteroid' | 'emp' | 'asteroid_mech' | 'asteroid_energy' = 'normal') {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    
    const panner = this.createPanner(pan);
    const dest = panner ? panner : this.sfxGain;
    if (panner) panner.connect(this.sfxGain);

    if (type === 'asteroid_mech') {
        // "Zdump" - Low thud + punchy noise
        const thudOsc = ctx.createOscillator();
        thudOsc.type = 'square';
        thudOsc.frequency.setValueAtTime(100, t);
        thudOsc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        
        const thudGain = ctx.createGain();
        thudGain.gain.setValueAtTime(0.6 * scale, t);
        thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 180;

        thudOsc.connect(filter); filter.connect(thudGain); thudGain.connect(dest);
        thudOsc.start(t); thudOsc.stop(t + 0.2);

    } else if (type === 'asteroid_energy') {
        // "Frrr" - Melting rock sound (Bandpass noise)
        const bSize = ctx.sampleRate * 0.4;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = b;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, t);
        filter.Q.value = 2;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5 * scale, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        
        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(t);

    } else if (type === 'player') {
        // "Zbang" + Tinnitus ("tzzzzziu")
        // 1. Zbang (Hard Impact)
        const bSize = ctx.sampleRate * 2.0;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = b;
        const nFilter = ctx.createBiquadFilter();
        nFilter.type = 'lowpass';
        nFilter.frequency.setValueAtTime(1000, t);
        nFilter.frequency.exponentialRampToValueAtTime(20, t + 1.0);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(1.5, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
        noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(dest);
        noise.start(t);

        // 2. Tinnitus (High pitched ringing)
        const ring = ctx.createOscillator();
        ring.type = 'sine';
        ring.frequency.setValueAtTime(9000, t); // High pitch ringing
        const ringGain = ctx.createGain();
        ringGain.gain.setValueAtTime(0.05, t);
        ringGain.gain.linearRampToValueAtTime(0, t + 4.0); // Fades out over 4s
        ring.connect(ringGain);
        ringGain.connect(dest);
        ring.start(t);
        ring.stop(t + 4.0);

    } else if (type === 'boss') {
        // "Brrrum" - Exotic Epic
        const duration = 3.0;
        // Deep modulated rumble
        const bSize = ctx.sampleRate * duration;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = b;
        const nFilter = ctx.createBiquadFilter();
        nFilter.type = 'lowpass';
        nFilter.frequency.setValueAtTime(80, t); // Very low base
        nFilter.frequency.linearRampToValueAtTime(10, t + duration);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(2.0, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        
        // Wobble LFO for the "Brrr"
        const lfo = ctx.createOscillator();
        lfo.type = 'sawtooth';
        lfo.frequency.value = 15;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 500;
        lfo.connect(lfoGain);
        lfoGain.connect(nFilter.frequency);
        lfo.start(t); lfo.stop(t + duration);

        noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(dest);
        noise.start(t);

    } else if (type === 'asteroid') {
        // Generic "Crack"
        const duration = 0.3;
        const bSize = ctx.sampleRate * duration;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = b;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(400, t); // Crisp crack
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.8 * scale, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(t);

    } else if (type === 'emp') {
        // "Sfrrr" - Frying oil / Electricity
        const duration = 1.0;
        const bSize = ctx.sampleRate * duration;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = b;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2500, t);
        filter.Q.value = 1;

        // Jittery gain for crackle effect
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        // Automate random spikes
        for(let i=0; i<10; i++) {
            gain.gain.linearRampToValueAtTime(Math.random() * 0.5, t + (i*0.1));
        }
        gain.gain.linearRampToValueAtTime(0, t + duration);

        noise.connect(filter); filter.connect(gain); gain.connect(dest);
        noise.start(t);

    } else if (type === 'mine') {
        // ... (Existing deep boom) ...
        const duration = 2.0 * scale;
        const bSize = ctx.sampleRate * duration;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = b;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, t);
        filter.frequency.linearRampToValueAtTime(20, t + duration);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(1.5 * scale, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        noise.connect(filter); filter.connect(nGain); nGain.connect(dest);
        noise.start(t);
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(70, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + duration);
        const oGain = ctx.createGain();
        oGain.gain.setValueAtTime(1.0 * scale, t);
        oGain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        osc.connect(oGain); oGain.connect(dest);
        osc.start(t); osc.stop(t + duration);

    } else {
        // Normal "Zbang" (Mechanical Explosion)
        const duration = 0.5 * scale;
        const crackNoise = ctx.createBufferSource();
        const bSize = ctx.sampleRate * 0.1;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        crackNoise.buffer = b;
        const crackFilter = ctx.createBiquadFilter();
        crackFilter.type = 'highpass';
        crackFilter.frequency.value = 500;
        const crackGain = ctx.createGain();
        crackGain.gain.setValueAtTime(0.8 * scale, t);
        crackGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        crackNoise.connect(crackFilter); crackFilter.connect(crackGain); crackGain.connect(dest);
        crackNoise.start(t);
        
        const thudOsc = ctx.createOscillator();
        thudOsc.type = 'square'; 
        thudOsc.frequency.setValueAtTime(150, t);
        thudOsc.frequency.exponentialRampToValueAtTime(20, t + 0.3);
        const thudFilter = ctx.createBiquadFilter();
        thudFilter.type = 'lowpass';
        thudFilter.frequency.value = 400;
        const thudGain = ctx.createGain();
        thudGain.gain.setValueAtTime(0.6 * scale, t);
        thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        thudOsc.connect(thudFilter); thudFilter.connect(thudGain); thudGain.connect(dest);
        thudOsc.start(t); thudOsc.stop(t + 0.3);
    }
  }

  private getShipSoundParams(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    const types: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];
    const wave = types[Math.abs(hash) % 4];
    const baseFreq = 150 + (Math.abs(hash * 3) % 400); 
    return { wave, baseFreq };
  }

  playWeaponFire(type: 'laser' | 'cannon' | 'missile' | 'mine' | 'rocket' | 'emp' | 'mega' | 'puff' | 'flame' | 'exotic_single' | 'exotic_power', pan: number = 0, variant?: string) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    const panner = this.createPanner(pan);
    const destination = panner ? panner : this.sfxGain!;
    if (panner) panner.connect(this.sfxGain!);
    g.connect(destination);

    const ct = ctx.currentTime;

    if (type === 'flame') {
        const duration = 0.4;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for(let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, ct);
        filter.frequency.linearRampToValueAtTime(100, ct + duration);
        g.gain.setValueAtTime(0.1, ct); 
        g.gain.linearRampToValueAtTime(0, ct + duration);
        noise.connect(filter);
        filter.connect(g);
        noise.start();
        noise.stop(ct + duration);
    } else if (type === 'exotic_single') {
        // High pitched sharp alien chirp
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, ct);
        osc.frequency.exponentialRampToValueAtTime(300, ct + 0.1);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 5;
        filter.frequency.setValueAtTime(2000, ct);
        filter.frequency.linearRampToValueAtTime(500, ct + 0.1);

        g.gain.setValueAtTime(0.15, ct);
        g.gain.exponentialRampToValueAtTime(0.001, ct + 0.15);

        osc.connect(filter);
        filter.connect(g);
        osc.start(ct);
        osc.stop(ct + 0.15);

    } else if (type === 'exotic_power') {
        // Deep oscillating thrum
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ct);
        
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 40; // Fast thrum
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 50;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(ct); lfo.stop(ct + 0.6);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, ct);
        filter.frequency.linearRampToValueAtTime(800, ct + 0.2); // Open up
        filter.frequency.linearRampToValueAtTime(100, ct + 0.6); // Close down

        g.gain.setValueAtTime(0.3, ct);
        g.gain.exponentialRampToValueAtTime(0.001, ct + 0.6);

        osc.connect(filter);
        filter.connect(g);
        osc.start(ct);
        osc.stop(ct + 0.6);

    } else if (type === 'laser') {
      // "Pciu pciu" - Classic sci-fi laser
      // Fast downward sine sweep
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ct); // Start High
      osc.frequency.exponentialRampToValueAtTime(150, ct + 0.15); // Drop fast
      
      g.gain.setValueAtTime(0.15, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + 0.15);
      
      osc.connect(g);
      osc.start();
      osc.stop(ct + 0.15);

    } else if (type === 'cannon' || type === 'rocket') {
      // "Tak spank" - Mechanical Punch
      // Part 1: "Tak" (High freq click/snap)
      const clickOsc = ctx.createOscillator();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(800, ct);
      clickOsc.frequency.exponentialRampToValueAtTime(200, ct + 0.05);
      
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.1, ct);
      clickGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.05);
      clickOsc.connect(clickGain); clickGain.connect(destination);
      clickOsc.start(ct); clickOsc.stop(ct + 0.05);

      // Part 2: "Spank" (Lower punchy body)
      const bodyOsc = ctx.createOscillator();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(200, ct);
      bodyOsc.frequency.exponentialRampToValueAtTime(50, ct + 0.12);
      
      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0.25, ct);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.12);
      
      bodyOsc.connect(bodyGain); bodyGain.connect(destination);
      bodyOsc.start(ct); bodyOsc.stop(ct + 0.12);
      
    } else if (type === 'mega') {
      // "Tceaw tceaw" - Power Shot
      // Sawtooth with filter sweep opening up
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ct);
      osc.frequency.linearRampToValueAtTime(150, ct + 0.4); // Slight drop
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, ct);
      filter.frequency.linearRampToValueAtTime(2000, ct + 0.1); // Open up filter ("Tceaw")
      filter.frequency.linearRampToValueAtTime(500, ct + 0.3); // Close down
      
      g.gain.setValueAtTime(0.2, ct);
      g.gain.linearRampToValueAtTime(0.2, ct + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, ct + 0.3);
      
      osc.connect(filter);
      filter.connect(g);
      osc.start(ct);
      osc.stop(ct + 0.3);

    } else if (type === 'puff') {
      let wave: OscillatorType = 'square';
      let freq = 150;
      let decay = 0.15;
      let vol = 0.1;
      if (variant) {
          const params = this.getShipSoundParams(variant);
          wave = params.wave;
          freq = params.baseFreq;
      }
      vol = 0.2; decay = 0.1;
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, ct); osc.frequency.exponentialRampToValueAtTime(50, ct + decay);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ct);
      filter.frequency.exponentialRampToValueAtTime(100, ct + decay);
      g.gain.setValueAtTime(vol, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + decay);
      osc.connect(filter);
      filter.connect(g);
      osc.start();
      osc.stop(ct + decay);
    } else if (type === 'missile') {
        // "Sfushshshsh" - Rocket thrust noise
        const duration = 0.6;
        const bSize = ctx.sampleRate * duration;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        
        const noise = ctx.createBufferSource();
        noise.buffer = b;
        
        // Lowpass filter sweeping up to simulate acceleration
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, ct);
        filter.frequency.linearRampToValueAtTime(1000, ct + 0.3);
        
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0, ct);
        nGain.gain.linearRampToValueAtTime(0.3, ct + 0.1); 
        nGain.gain.exponentialRampToValueAtTime(0.01, ct + 0.5); 
        
        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(destination);
        noise.start(ct);
        noise.stop(ct + duration);
    } else if (type === 'mine') {
        // "Schang" - Metallic/Mechanical
        const duration = 0.4;
        const osc1 = ctx.createOscillator();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(400, ct);
        osc1.frequency.exponentialRampToValueAtTime(100, ct + 0.1);
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(600, ct);
        const mGain = ctx.createGain();
        mGain.gain.setValueAtTime(0.15, ct);
        mGain.gain.exponentialRampToValueAtTime(0.01, ct + 0.3);
        osc1.connect(mGain); osc2.connect(mGain); mGain.connect(destination);
        osc1.start(ct); osc1.stop(ct + duration);
        osc2.start(ct); osc2.stop(ct + duration);
        const bSize = ctx.sampleRate * 0.1;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = b;
        const nFilter = ctx.createBiquadFilter();
        nFilter.type = 'highpass';
        nFilter.frequency.value = 1000;
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.1, ct);
        nGain.gain.exponentialRampToValueAtTime(0.01, ct + 0.1);
        noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(destination);
        noise.start(ct);
    } else if (type === 'emp') {
      // Launch sound for EMP (distinct from impact)
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ct);
      osc.frequency.linearRampToValueAtTime(1500, ct + 0.1); 
      g.gain.setValueAtTime(0.15, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + 0.15);
      osc.connect(g);
      osc.start(); osc.stop(ct + 0.15);
    }
  }

  playShieldHit(pan: number = 0) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    const panner = this.createPanner(pan);
    const destination = panner ? panner : this.sfxGain!;
    if (panner) panner.connect(this.sfxGain!);
    g.connect(destination);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.05);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(g);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  stopAllSfx() {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.stop();
      this.stopLaunchSequence();
      this.stopLandingThruster();
      this.stopAmbience();
      this.stopReactorHum();
    }
  }
}

export const audioService = new AudioService();
