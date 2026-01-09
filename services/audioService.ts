
class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentTrack: any = null;
  private volume: number = 0.3;
  private enabled: boolean = true;
  private introAudio: HTMLAudioElement | null = null;
  private activeNodes: Set<AudioNode> = new Set();
  
  // Charge Sound State
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;

  // Launch Sound State
  private launchGain: GainNode | null = null;

  // Landing Sound State
  private landingThrusterOsc: AudioBufferSourceNode | null = null;
  private landingThrusterGain: GainNode | null = null;
  private landingThrusterFilter: BiquadFilterNode | null = null;
  private ambienceNodes: AudioNode[] = [];

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.updateVolume(this.volume);
  }

  private createPanner(x: number): StereoPannerNode | null {
    if (!this.ctx) return null;
    const panner = this.ctx.createStereoPanner();
    // Clamp x to -1 to 1
    const panValue = Math.max(-1, Math.min(1, x));
    panner.pan.setValueAtTime(panValue, this.ctx.currentTime);
    return panner;
  }

  updateVolume(v: number) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(this.enabled ? v : 0, this.ctx!.currentTime, 0.1);
    if (this.introAudio) this.introAudio.volume = this.enabled ? v : 0;
  }

  setEnabled(e: boolean) {
    this.enabled = e;
    this.updateVolume(this.volume);
  }

  startLandingThruster() {
    this.init();
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    
    // Create Brown Noise Buffer for heavy rumble
    // 4 seconds loop to avoid repetition artifacts
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Leaky integrator for brown noise approximation
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5; 
        // Add a tiny bit of white noise back for high-freq hiss
        data[i] += white * 0.05; 
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Filter to shape the roar dynamically
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 100; // Start deep and muffled

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
        // Volume: 0 to 0.7 based on intensity
        const vol = Math.max(0, Math.min(0.7, intensity));
        this.landingThrusterGain.gain.setTargetAtTime(vol, t, 0.1);
        
        // Filter Freq: 80Hz (idle rumble) to 600Hz (full throttle roar)
        const freq = 80 + (intensity * 520); 
        this.landingThrusterFilter.frequency.setTargetAtTime(freq, t, 0.1);
    }
  }

  stopLandingThruster() {
    if (this.landingThrusterGain && this.ctx) {
        this.landingThrusterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
        setTimeout(() => {
            if (this.landingThrusterOsc) {
                try { this.landingThrusterOsc.stop(); } catch(e){}
                this.landingThrusterOsc.disconnect();
                this.landingThrusterOsc = null;
            }
            if (this.landingThrusterFilter) {
                this.landingThrusterFilter.disconnect();
                this.landingThrusterFilter = null;
            }
            if (this.landingThrusterGain) {
                this.landingThrusterGain.disconnect();
                this.landingThrusterGain = null;
            }
        }, 600);
    }
  }

  playLandThud() {
    this.init();
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Heavy Low Thud (Sine drop) - The "weight"
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

    // 2. Metallic Clank (Bandpass Square) - The "gear"
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

    // 3. Impact Hiss (Filtered Noise) - The "dust/hydraulics"
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
    
    // Create a rhythmic high pitch chirp
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 4000;
    
    const gain = ctx.createGain();
    gain.gain.value = 0;
    
    // LFO for chirping rhythm
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 4; // 4 chirps per second roughly
    
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05; // Modulation depth
    
    // Connect LFO to Gain
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

    // Create a specific gain for the launch sequence to allow fading
    const seqGain = ctx.createGain();
    seqGain.connect(this.masterGain!);
    this.launchGain = seqGain;

    // 1. Ignition Bang (Low Thud)
    const bangOsc = ctx.createOscillator();
    bangOsc.type = 'square';
    bangOsc.frequency.setValueAtTime(80, t);
    bangOsc.frequency.exponentialRampToValueAtTime(10, t + 0.4);
    
    const bangGain = ctx.createGain();
    bangGain.gain.setValueAtTime(0.6, t);
    bangGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    
    // Lowpass filter for the bang to make it heavy
    const bangFilter = ctx.createBiquadFilter();
    bangFilter.type = 'lowpass';
    bangFilter.frequency.value = 200;

    bangOsc.connect(bangFilter);
    bangFilter.connect(bangGain);
    bangGain.connect(seqGain); // Connect to sequence gain
    bangOsc.start(t);
    bangOsc.stop(t + 0.4);

    // 2. Engine Roar (Pink-ish Noise)
    const duration = 12.0;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Simple noise generation
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'lowpass';
    roarFilter.frequency.setValueAtTime(100, t);
    roarFilter.frequency.linearRampToValueAtTime(800, t + 4); // Rev up
    roarFilter.frequency.linearRampToValueAtTime(400, t + 10); // Fade out frequency

    const roarGain = ctx.createGain();
    roarGain.gain.setValueAtTime(0, t);
    roarGain.gain.linearRampToValueAtTime(0.3, t + 0.5); // Fade in
    roarGain.gain.linearRampToValueAtTime(0.2, t + 8);
    roarGain.gain.linearRampToValueAtTime(0, t + 12); // Fade out

    noise.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(seqGain); // Connect to sequence gain
    
    noise.start(t);
    noise.stop(t + duration);
  }

  stopLaunchSequence() {
    if (this.launchGain && this.ctx) {
        const t = this.ctx.currentTime;
        // Fade out over 0.5 seconds
        this.launchGain.gain.cancelScheduledValues(t);
        this.launchGain.gain.setValueAtTime(this.launchGain.gain.value, t);
        this.launchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        
        setTimeout(() => {
            if (this.launchGain) {
                this.launchGain.disconnect();
                this.launchGain = null;
            }
        }, 550);
    }
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
    if (panner) {
      gain.connect(panner);
      panner.connect(this.masterGain!);
    } else {
      gain.connect(this.masterGain!);
    }

    noise.start();
    noise.stop(ctx.currentTime + duration);
  }

  startCharging() {
    this.init();
    if (!this.ctx || !this.enabled) return;
    if (this.chargeOsc) return; // Already charging

    const ctx = this.ctx;
    this.chargeOsc = ctx.createOscillator();
    this.chargeGain = ctx.createGain();

    this.chargeOsc.type = 'triangle';
    this.chargeOsc.frequency.setValueAtTime(150, ctx.currentTime);
    this.chargeOsc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 1.5); // Growing pitch

    this.chargeGain.gain.setValueAtTime(0.05, ctx.currentTime);
    this.chargeGain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 1.5);

    this.chargeOsc.connect(this.chargeGain);
    this.chargeGain.connect(this.masterGain!);
    this.chargeOsc.start();
  }

  stopCharging() {
    if (this.chargeOsc) {
        try {
            this.chargeOsc.stop();
            this.chargeOsc.disconnect();
        } catch(e) {}
        this.chargeOsc = null;
    }
    if (this.chargeGain) {
        this.chargeGain.disconnect();
        this.chargeGain = null;
    }
  }

  playWeaponFire(type: 'laser' | 'cannon' | 'missile' | 'mine' | 'rocket' | 'emp' | 'mega', pan: number = 0) {
    this.init();
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    const panner = this.createPanner(pan);
    const destination = panner ? panner : this.masterGain!;
    if (panner) panner.connect(this.masterGain!);
    g.connect(destination);

    const ct = ctx.currentTime;

    if (type === 'laser') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, ct);
      osc.frequency.exponentialRampToValueAtTime(400, ct + 0.1);
      g.gain.setValueAtTime(0.05, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + 0.1);
      osc.connect(g);
      osc.start();
      osc.stop(ct + 0.1);
    } else if (type === 'cannon') { // PROJECTILE
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ct);
      osc.frequency.exponentialRampToValueAtTime(50, ct + 0.15);
      g.gain.setValueAtTime(0.1, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + 0.15);
      osc.connect(g);
      osc.start();
      osc.stop(ct + 0.15);
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
      // Hissing launch + thud
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(80, ct);
      osc.frequency.exponentialRampToValueAtTime(20, ct + 0.2);
      
      // Noise
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
      // Electric Zap
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ct);
      osc.frequency.linearRampToValueAtTime(1500, ct + 0.1); // Rapid rise
      g.gain.setValueAtTime(0.15, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + 0.15);
      osc.connect(g);
      osc.start(); osc.stop(ct + 0.15);
    } else if (type === 'mega') {
      // Power release whoosh
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ct);
      osc.frequency.exponentialRampToValueAtTime(60, ct + 0.5);
      
      const noise = ctx.createBufferSource();
      const bSize = ctx.sampleRate * 0.5;
      const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
      const d = b.getChannelData(0);
      for(let i=0; i<bSize; i++) d[i] = Math.random()*2-1;
      noise.buffer = b;
      
      const nFilter = ctx.createBiquadFilter();
      nFilter.type = 'lowpass';
      nFilter.frequency.setValueAtTime(2000, ct);
      nFilter.frequency.linearRampToValueAtTime(100, ct + 0.5);

      g.gain.setValueAtTime(0.4, ct);
      g.gain.exponentialRampToValueAtTime(0.001, ct + 0.5);

      osc.connect(g);
      noise.connect(nFilter);
      nFilter.connect(g);

      osc.start(); osc.stop(ct + 0.5);
      noise.start(); noise.stop(ct + 0.5);
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
      // We don't necessarily want to close the context, but stop everything
      this.stop();
      this.stopCharging();
      this.stopLaunchSequence();
      this.stopLandingThruster();
      this.stopAmbience();
    }
  }

  stop() {
    if (this.currentTrack) {
      this.currentTrack.stop();
      this.currentTrack = null;
    }
    if (this.introAudio) {
      this.introAudio.pause();
      this.introAudio.currentTime = 0;
      this.introAudio = null;
    }
  }

  playTrack(type: 'intro' | 'command' | 'map' | 'combat') {
    this.init();
    this.stop();
    if (!this.ctx) return;

    if (type === 'intro') {
      this.introAudio = new Audio('assets/1m-intro-galaxy-defendor.mp3');
      this.introAudio.loop = true;
      this.introAudio.volume = this.enabled ? this.volume : 0;
      this.introAudio.play().catch(err => console.log("Intro audio play failed", err));
      this.currentTrack = {
        stop: () => {
          if (this.introAudio) {
            this.introAudio.pause();
            this.introAudio.currentTime = 0;
          }
        }
      };
      return;
    }

    const ctx = this.ctx;
    const gain = this.masterGain!;
    let oscillators: OscillatorNode[] = [];
    let intervals: number[] = [];

    const playNote = (freq: number, duration: number, type: OscillatorType = 'square', vol = 0.1, decay = true) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      if (decay) g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(g);
      g.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + duration);
      return osc;
    };

    if (type === 'command') {
      let step = 0;
      const bassNotes = [110, 110, 110, 110, 82, 82, 98, 98];
      const leadNotes = [220, 0, 330, 0, 440, 330, 220, 0];
      
      intervals.push(window.setInterval(() => {
        playNote(bassNotes[step % bassNotes.length], 0.15, 'square', 0.04);
        if (leadNotes[step % leadNotes.length] > 0 && step % 2 === 0) {
           playNote(leadNotes[step % leadNotes.length], 0.1, 'triangle', 0.03);
        }
        if (step % 4 === 0) playNote(55, 0.3, 'sawtooth', 0.05);
        step++;
      }, 200));
    } else if (type === 'map') {
      const sweep = ctx.createOscillator();
      const sweepGain = ctx.createGain();
      sweep.type = 'triangle';
      sweep.frequency.setValueAtTime(110, ctx.currentTime);
      sweepGain.gain.setValueAtTime(0.02, ctx.currentTime);
      sweep.connect(sweepGain);
      sweepGain.connect(gain);
      sweep.start();
      oscillators.push(sweep);

      intervals.push(window.setInterval(() => {
        const time = ctx.currentTime;
        sweep.frequency.exponentialRampToValueAtTime(110 + Math.random() * 220, time + 5);
      }, 5000));

      intervals.push(window.setInterval(() => {
        if (Math.random() > 0.5) {
          const freq = 1000 + Math.random() * 2000;
          playNote(freq, 0.5, 'sine', 0.01);
        }
      }, 800));
    } else if (type === 'combat') {
      let step = 0;
      const notes = [110, 165, 220, 330, 110, 165, 440, 330];
      intervals.push(window.setInterval(() => {
        const freq = notes[step % notes.length];
        playNote(freq, 0.08, 'square', 0.05);
        if (step % 8 === 0) playNote(55, 0.4, 'sawtooth', 0.08);
        step++;
      }, 125));
    }

    this.currentTrack = {
      stop: () => {
        oscillators.forEach(o => { try { o.stop(); } catch(e) {} });
        intervals.forEach(i => window.clearInterval(i));
      }
    };
  }
}

export const audioService = new AudioService();
