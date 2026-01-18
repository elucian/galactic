
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
  private chargeFilter: BiquadFilterNode | null = null; // Track filter for cleanup

  // Capacitor Sound State (Low Pulsing Reactor Hum)
  private capOsc: OscillatorNode | null = null;
  private capGain: GainNode | null = null;
  private capFilter: BiquadFilterNode | null = null;
  private capLfo: OscillatorNode | null = null;

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

  playAlertSiren() {
    this.init();
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    // Filter for "siren" tone + Wah effect
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2; // Resonant to emphasize the wah
    filter.frequency.setValueAtTime(1000, t);

    // Frequency Sweep: Descend then Ascend Scale
    // D4 ~ 293 Hz
    // B3 ~ 246 Hz
    // D5 ~ 587 Hz
    
    osc.frequency.setValueAtTime(293, t);
    osc.frequency.linearRampToValueAtTime(246, t + 0.2); // Drop to B (The "lower to C, B" part)
    // Ascend through "C, D, E, F, G, A, B, C, D" -> approximated by a sweep to D5
    osc.frequency.exponentialRampToValueAtTime(587, t + 1.0); 
    
    // "Waee Wuaee Waee" - Wah-Wah Filter LFO
    // We want roughly 3 pulses in the 1s duration
    const filterLfo = ctx.createOscillator();
    filterLfo.type = 'sine';
    filterLfo.frequency.value = 3.5; // ~3.5 Hz for the pulses

    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = 600; // Modulate filter freq by +/- 600Hz

    // Base filter frequency envelope
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.linearRampToValueAtTime(1200, t + 1.0);

    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);
    
    // Base gain envelope
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
    if (this.chargeOsc) return;

    const ctx = this.ctx;
    this.chargeOsc = ctx.createOscillator();
    this.chargeGain = ctx.createGain();
    
    // "Weeo" Sound: Sine wave rising pitch 
    this.chargeOsc.type = 'sine';
    this.chargeOsc.frequency.setValueAtTime(200, ctx.currentTime); 
    this.chargeOsc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 2.0);

    // Bandpass filter to emphasize the "ee" vowel quality as pitch rises
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
    if (this.chargeOsc) {
        try {
            this.chargeOsc.stop();
            this.chargeOsc.disconnect();
        } catch(e) {}
        this.chargeOsc = null;
    }
    if (this.chargeFilter) {
        this.chargeFilter.disconnect();
        this.chargeFilter = null;
    }
    if (this.chargeGain) {
        this.chargeGain.disconnect();
        this.chargeGain = null;
    }
  }

  // --- NEW CAPACITOR CHARGE SOUND (Low Pulsing Reactor Hum) ---
  startCapacitorCharge() {
    this.init();
    if (!this.ctx || !this.enabled) return;
    if (this.capOsc) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // "vou vou vou" - Low pulsing reactor hum
    // Use a sawtooth for texture, filtered heavily
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, t); // Low base pitch

    // Dynamic Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, t); // Start very muffled
    filter.frequency.linearRampToValueAtTime(300, t + 4.0); // Slow rise to signify filling
    filter.Q.value = 1; // Mild resonance

    // LFO for the "vou vou" (Wah effect)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 3; // 3Hz pulse speed

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 150; // Modulate filter by +/- 150Hz

    // Volume Envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.5); // Very soft volume (0.1)

    // Connect LFO -> Filter Freq
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start();
    lfo.start();

    this.capOsc = osc;
    this.capGain = gain;
    this.capFilter = filter;
    this.capLfo = lfo;
  }

  stopCapacitorCharge() {
      if (this.capGain) {
          const t = this.ctx!.currentTime;
          this.capGain.gain.setTargetAtTime(0, t, 0.1);
          setTimeout(() => {
              if (this.capOsc) { try { this.capOsc.stop(); } catch(e){} this.capOsc.disconnect(); this.capOsc = null; }
              if (this.capLfo) { try { this.capLfo.stop(); } catch(e){} this.capLfo.disconnect(); this.capLfo = null; }
              if (this.capFilter) { this.capFilter.disconnect(); this.capFilter = null; }
              if (this.capGain) { this.capGain.disconnect(); this.capGain = null; }
          }, 150);
      }
  }

  private getShipSoundParams(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    
    const types: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];
    const wave = types[Math.abs(hash) % 4];
    const baseFreq = 150 + (Math.abs(hash * 3) % 400); // 150 - 550 Hz
    
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
        // Wind-like flame sound: Filtered noise
        const duration = 0.4;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for(let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        // Lowpass filter for "Shhh" sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, ct);
        filter.frequency.linearRampToValueAtTime(100, ct + duration);
        
        g.gain.setValueAtTime(0.1, ct); // Lower volume
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
      // Ship-specific "Buf" sound
      let wave: OscillatorType = 'square';
      let freq = 150;
      let decay = 0.15;
      let vol = 0.1;

      if (variant) {
          const params = this.getShipSoundParams(variant);
          wave = params.wave;
          freq = params.baseFreq;
      }

      if (type === 'puff') {
          vol = 0.2; // Softer
          decay = 0.1;
      } else if (type === 'mega') {
          vol = 0.4;
          decay = 0.25;
          wave = 'sawtooth'; // Always aggressive for mega
          freq = 1800; // Original Zap sound but blended with ship tone
      }

      const osc = ctx.createOscillator();
      osc.type = wave;
      
      if (type === 'mega') {
          // Sharp Zap
          osc.frequency.setValueAtTime(freq, ct); 
          osc.frequency.exponentialRampToValueAtTime(100, ct + decay);
      } else {
          // "Buf" drop
          osc.frequency.setValueAtTime(freq, ct);
          osc.frequency.exponentialRampToValueAtTime(50, ct + decay);
      }

      // Filter for muffling the "Buf"
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
      this.stopCapacitorCharge();
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
    // Background music disabled as per request.
  }
}

export const audioService = new AudioService();
