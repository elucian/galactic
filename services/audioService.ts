
class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentTrack: any = null;
  private volume: number = 0.3;
  private enabled: boolean = true;
  private introAudio: HTMLAudioElement | null = null;
  private activeNodes: Set<AudioNode> = new Set();

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

  playWeaponFire(type: 'laser' | 'cannon' | 'missile' | 'mine', pan: number = 0) {
    this.init();
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    const panner = this.createPanner(pan);
    const destination = panner ? panner : this.masterGain!;
    if (panner) panner.connect(this.masterGain!);
    g.connect(destination);

    if (type === 'laser') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.05, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(g);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'cannon') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(g);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'missile') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(g);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'mine') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.connect(g);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
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
