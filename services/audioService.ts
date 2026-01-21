
class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.3;
  private enabled: boolean = true;
  
  // Background Music State
  private introAudio: HTMLAudioElement | null = null;
  private intendedTrack: string | null = null; // Track we *want* to be playing
  
  // Track Mapping
  private tracks: Record<string, string> = {
      'intro': '/assets/intro.mp3',
      'command': '/assets/hangar.mp3',
      'map': '/assets/map.mp3',
      'combat': '/assets/combat.mp3'
  };

  private activeNodes: Set<AudioNode> = new Set();
  
  // Charge Sound State
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private chargeFilter: BiquadFilterNode | null = null;

  // Capacitor Sound State
  private capOsc: OscillatorNode | null = null;
  private capGain: GainNode | null = null;
  private capFilter: BiquadFilterNode | null = null;
  private bottleNode: AudioBufferSourceNode | null = null;
  private bottleFilter: BiquadFilterNode | null = null;
  private bottleGain: GainNode | null = null;

  // Launch Sound State
  private launchGain: GainNode | null = null;

  // Landing Sound State
  private landingThrusterOsc: AudioBufferSourceNode | null = null;
  private landingThrusterGain: GainNode | null = null;
  private landingThrusterFilter: BiquadFilterNode | null = null;
  private ambienceNodes: AudioNode[] = [];

  init() {
    if (this.ctx) return;
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.updateVolume(this.volume);
    }
  }

  private createPanner(x: number): StereoPannerNode | null {
    if (!this.ctx) return null;
    const panner = this.ctx.createStereoPanner();
    const panValue = Math.max(-1, Math.min(1, x));
    panner.pan.setValueAtTime(panValue, this.ctx.currentTime);
    return panner;
  }

  updateVolume(v: number) {
    this.volume = v;
    
    // Update SFX Volume
    if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.enabled ? v : 0, this.ctx.currentTime, 0.1);
    }

    // Update Music Volume
    if (this.enabled && v > 0) {
        if (this.introAudio) {
            // Update existing track volume
            this.introAudio.volume = v;
            // Resume if it was paused due to 0 volume or initial autoplay block
            if (this.introAudio.paused) {
                const playPromise = this.introAudio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => console.warn("Resume failed (interaction needed?):", e));
                }
            }
        } else if (this.intendedTrack) {
            // Volume raised from 0, load the intended track now
            this.loadAndPlay(this.intendedTrack);
        }
    } else {
        // Volume is 0 or disabled
        if (this.introAudio) {
            this.introAudio.pause();
            // Optional: Unload to save memory if specifically desired
        }
    }
  }

  setEnabled(e: boolean) {
    this.enabled = e;
    this.updateVolume(this.volume);
  }

  // Internal helper to actually load the file
  private loadAndPlay(trackId: string) {
      const path = this.tracks[trackId];
      if (!path) return;

      // Check if we are already playing this track
      if (this.introAudio) {
          // If the src matches, just ensure it's playing
          if (this.introAudio.src.endsWith(path.substring(1))) { // Handle ./ vs / matching loosely
               if (this.introAudio.paused && this.volume > 0) {
                   this.introAudio.play().catch(e => console.warn("Play blocked:", e));
               }
               return; 
          }
          // Otherwise stop the old one
          this.introAudio.pause();
          this.introAudio.src = "";
          this.introAudio = null;
      }

      const audio = new Audio(path);
      audio.loop = true;
      audio.volume = this.volume;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
          playPromise.catch(error => {
              console.warn(`Audio play blocked for ${trackId}:`, error);
              // We intentionally leave it paused. 
              // App.tsx handleInteraction will call init() -> updateVolume() which will try .play() again on user gesture.
          });
      }
      
      this.introAudio = audio;
  }

  playTrack(type: 'intro' | 'command' | 'map' | 'combat') {
    this.init();
    
    // Always update intention
    this.intendedTrack = type;

    // Check Constraints: If volume 0 or disabled, do NOT load/play
    if (!this.enabled || this.volume <= 0) {
        if (this.introAudio) {
            this.introAudio.pause();
            // Don't nullify immediately to allow resume, but if switching tracks we might want to?
            // Actually, if we switch tracks while mute, we shouldn't load the new one.
            // If we are just pausing the current one, we keep it.
            // But if 'type' is different from current, we should probably prepare to switch.
            // For now, simple pause is enough.
        }
        return;
    }

    // Load and play
    this.loadAndPlay(type);
  }

  stop() {
    this.intendedTrack = null;
    if (this.introAudio) {
      this.introAudio.pause();
      this.introAudio = null;
    }
  }

  startLandingThruster() {
    this.init();
    if (!this.ctx || !this.enabled) return;
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
    gain.connect(this.masterGain!);
    
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

  playLandThud() {
    this.init();
    if (!this.ctx || !this.enabled) return;
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
    gain.connect(this.masterGain!);
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
    metalGain.connect(this.masterGain!);
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
    noiseGain.connect(this.masterGain!);
    noise.start(t);
    noise.stop(t + 0.4);
  }

  startCrickets() {
    this.init();
    if (!this.ctx || !this.enabled) return;
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
    gain.connect(this.masterGain!);
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
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const seqGain = ctx.createGain();
    seqGain.connect(this.masterGain!);
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
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

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
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.masterGain!);

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

  playExplosion(pan: number = 0, scale: number = 1.0) {
    this.init();
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const duration = 0.5 * scale;
    
    const noise = ctx.createBufferSource();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3 * scale, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    const panner = this.createPanner(pan);
    
    noise.connect(filter);
    filter.connect(gain);
    if (panner) { gain.connect(panner); panner.connect(this.masterGain!); } else { gain.connect(this.masterGain!); }

    noise.start();
    noise.stop(ctx.currentTime + duration);
  }

  startCharging() {
    this.init();
    if (!this.ctx || !this.enabled) return;
    if (this.chargeOsc) return;

    const ctx = this.ctx;
    this.chargeOsc = ctx.createOscillator();
    this.chargeGain = ctx.createGain();
    
    this.chargeOsc.type = 'sine';
    this.chargeOsc.frequency.setValueAtTime(200, ctx.currentTime); 
    this.chargeOsc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 2.0);

    const filter = ctx.createBiquadFilter();
    this.chargeFilter = filter;
    filter.type = 'bandpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(300, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 2.0);

    this.chargeGain.gain.setValueAtTime(0, ctx.currentTime);
    this.chargeGain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.2);

    this.chargeOsc.connect(filter);
    filter.connect(this.chargeGain);
    this.chargeGain.connect(this.masterGain!);
    this.chargeOsc.start();
  }

  stopCharging() {
    if (this.chargeOsc) { try { this.chargeOsc.stop(); this.chargeOsc.disconnect(); } catch(e) {} this.chargeOsc = null; }
    if (this.chargeFilter) { this.chargeFilter.disconnect(); this.chargeFilter = null; }
    if (this.chargeGain) { this.chargeGain.disconnect(); this.chargeGain = null; }
  }

  startCapacitorCharge() {
    this.init();
    if (!this.ctx || !this.enabled) return;
    if (this.capOsc) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, t); 

    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.setValueAtTime(120, t);
    
    const humGain = ctx.createGain();
    humGain.gain.setValueAtTime(0, t);
    humGain.gain.linearRampToValueAtTime(0.15, t + 0.5);

    osc.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(this.masterGain!);
    osc.start();

    const bufferSize = ctx.sampleRate * 2; 
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const bottleFilter = ctx.createBiquadFilter();
    bottleFilter.type = 'bandpass';
    bottleFilter.Q.value = 15; 
    bottleFilter.frequency.setValueAtTime(200, t);
    bottleFilter.frequency.exponentialRampToValueAtTime(1500, t + 4.0); 

    const bottleGain = ctx.createGain();
    bottleGain.gain.setValueAtTime(0, t);
    bottleGain.gain.linearRampToValueAtTime(0.1, t + 0.5);

    noise.connect(bottleFilter);
    bottleFilter.connect(bottleGain);
    bottleGain.connect(this.masterGain!);
    noise.start();

    this.capOsc = osc;
    this.capGain = humGain;
    this.capFilter = humFilter;
    this.bottleNode = noise;
    this.bottleFilter = bottleFilter;
    this.bottleGain = bottleGain;
  }

  stopCapacitorCharge() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (this.capGain) this.capGain.gain.setTargetAtTime(0, t, 0.1);
      if (this.bottleGain) this.bottleGain.gain.setTargetAtTime(0, t, 0.1);

      setTimeout(() => {
          if (this.capOsc) { try { this.capOsc.stop(); } catch(e){} this.capOsc.disconnect(); this.capOsc = null; }
          if (this.capFilter) { this.capFilter.disconnect(); this.capFilter = null; }
          if (this.capGain) { this.capGain.disconnect(); this.capGain = null; }
          if (this.bottleNode) { try { this.bottleNode.stop(); } catch(e){} this.bottleNode.disconnect(); this.bottleNode = null; }
          if (this.bottleFilter) { this.bottleFilter.disconnect(); this.bottleFilter = null; }
          if (this.bottleGain) { this.bottleGain.disconnect(); this.bottleGain = null; }
      }, 150);
  }

  private getShipSoundParams(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    const types: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];
    const wave = types[Math.abs(hash) % 4];
    const baseFreq = 150 + (Math.abs(hash * 3) % 400); 
    return { wave, baseFreq };
  }

  playWeaponFire(type: 'laser' | 'cannon' | 'missile' | 'mine' | 'rocket' | 'emp' | 'mega' | 'puff' | 'flame', pan: number = 0, variant?: string) {
    this.init();
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    const panner = this.createPanner(pan);
    const destination = panner ? panner : this.masterGain!;
    if (panner) panner.connect(this.masterGain!);
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
    } else if (type === 'laser') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, ct);
      osc.frequency.exponentialRampToValueAtTime(400, ct + 0.1);
      g.gain.setValueAtTime(0.05, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + 0.1);
      osc.connect(g);
      osc.start();
      osc.stop(ct + 0.1);
    } else if (type === 'puff' || type === 'cannon' || type === 'mega') {
      let wave: OscillatorType = 'square';
      let freq = 150;
      let decay = 0.15;
      let vol = 0.1;
      if (variant) {
          const params = this.getShipSoundParams(variant);
          wave = params.wave;
          freq = params.baseFreq;
      }
      if (type === 'puff') { vol = 0.2; decay = 0.1; } 
      else if (type === 'mega') { vol = 0.4; decay = 0.25; wave = 'sawtooth'; freq = 1800; }
      const osc = ctx.createOscillator();
      osc.type = wave;
      if (type === 'mega') { osc.frequency.setValueAtTime(freq, ct); osc.frequency.exponentialRampToValueAtTime(100, ct + decay); } 
      else { osc.frequency.setValueAtTime(freq, ct); osc.frequency.exponentialRampToValueAtTime(50, ct + decay); }
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(type === 'mega' ? 3000 : 800, ct);
      filter.frequency.exponentialRampToValueAtTime(type === 'mega' ? 500 : 100, ct + decay);
      g.gain.setValueAtTime(vol, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + decay);
      osc.connect(filter);
      filter.connect(g);
      osc.start();
      osc.stop(ct + decay);
    } else if (type === 'missile') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, ct);
      osc.frequency.exponentialRampToValueAtTime(800, ct + 0.2);
      g.gain.setValueAtTime(0.08, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + 0.2);
      osc.connect(g);
      osc.start();
      osc.stop(ct + 0.2);
    } else if (type === 'mine') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ct);
      osc.frequency.exponentialRampToValueAtTime(200, ct + 0.3);
      g.gain.setValueAtTime(0.1, ct);
      g.gain.linearRampToValueAtTime(0, ct + 0.3);
      osc.connect(g);
      osc.start();
      osc.stop(ct + 0.3);
    } else if (type === 'rocket') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(80, ct);
      osc.frequency.exponentialRampToValueAtTime(20, ct + 0.2);
      const noise = ctx.createBufferSource();
      const bSize = ctx.sampleRate * 0.2;
      const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
      const d = b.getChannelData(0);
      for(let i=0; i<bSize; i++) d[i] = Math.random()*2-1;
      noise.buffer = b;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.3, ct);
      nGain.gain.exponentialRampToValueAtTime(0.01, ct + 0.2);
      g.gain.setValueAtTime(0.15, ct);
      g.gain.linearRampToValueAtTime(0, ct + 0.2);
      osc.connect(g);
      noise.connect(nGain);
      nGain.connect(destination);
      osc.start(); osc.stop(ct + 0.2);
      noise.start(); noise.stop(ct + 0.2);
    } else if (type === 'emp') {
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
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    const panner = this.createPanner(pan);
    const destination = panner ? panner : this.masterGain!;
    if (panner) panner.connect(this.masterGain!);
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
      this.stopCharging();
      this.stopCapacitorCharge();
      this.stopLaunchSequence();
      this.stopLandingThruster();
      this.stopAmbience();
    }
  }
}

export const audioService = new AudioService();
