import { rand } from './utils.js';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.ambientStarted = false;
    this.lastStep = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.62;
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.24;
    this.master.connect(compressor);
    compressor.connect(this.ctx.destination);
    this.noiseBuffer = this.makeNoiseBuffer(3);
  }

  makeNoiseBuffer(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.18 + white * 0.82;
      data[i] = last;
    }
    return buffer;
  }

  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  noiseSource() {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    source.loopEnd = this.noiseBuffer.duration;
    return source;
  }

  toggleMute() {
    if (!this.master) return false;
    this.muted = !this.muted;
    this.master.gain.cancelScheduledValues(this.now);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.62, this.now + 0.08);
    return this.muted;
  }

  startAmbient() {
    if (!this.ctx || this.ambientStarted) return;
    this.ambientStarted = true;
    const t = this.now;

    // A low sea of crowd matter.
    const crowd = this.noiseSource();
    const crowdFilter = this.ctx.createBiquadFilter();
    crowdFilter.type = 'bandpass';
    crowdFilter.frequency.value = 420;
    crowdFilter.Q.value = 0.65;
    const crowdGain = this.ctx.createGain();
    crowdGain.gain.setValueAtTime(0.0001, t);
    crowdGain.gain.exponentialRampToValueAtTime(0.024, t + 1.5);
    crowd.connect(crowdFilter);
    crowdFilter.connect(crowdGain);
    crowdGain.connect(this.master);
    crowd.start(t);

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.17;
    lfoGain.gain.value = 0.007;
    lfo.connect(lfoGain);
    lfoGain.connect(crowdGain.gain);
    lfo.start(t);

    // Desert wind over the top.
    const wind = this.noiseSource();
    wind.playbackRate.value = 0.55;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 230;
    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.0001, t);
    windGain.gain.exponentialRampToValueAtTime(0.017, t + 2.1);
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.master);
    wind.start(t);
  }

  tone({ frequency = 220, endFrequency = null, type = 'sine', gain = 0.1, duration = 0.3, attack = 0.004, delay = 0, detune = 0 }) {
    if (!this.ctx) return;
    const t = this.now + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(frequency, t);
    if (endFrequency !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t + duration);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(gain, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noise({
    gain = 0.1,
    duration = 0.25,
    type = 'bandpass',
    frequency = 900,
    endFrequency = null,
    Q = 1,
    attack = 0.003,
    delay = 0,
    playbackRate = 1,
  }) {
    if (!this.ctx) return;
    const t = this.now + delay;
    const source = this.noiseSource();
    source.playbackRate.value = playbackRate;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = Q;
    filter.frequency.setValueAtTime(frequency, t);
    if (endFrequency !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), t + duration);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(gain, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    source.start(t);
    source.stop(t + duration + 0.02);
  }

  swing(weapon = 'sword') {
    if (!this.ctx) return;
    const heavy = weapon === 'hammer';
    this.noise({
      type: 'bandpass',
      frequency: heavy ? 260 : 880,
      endFrequency: heavy ? 110 : 2400,
      Q: heavy ? 1.4 : 2.2,
      gain: heavy ? 0.13 : 0.09,
      duration: heavy ? 0.34 : 0.2,
      playbackRate: heavy ? 0.8 : 1.2,
    });
    this.noise({
      type: 'highpass',
      frequency: 3100,
      gain: 0.018,
      duration: 0.12,
      playbackRate: 1.7,
    });
  }

  flesh(power = 1) {
    if (!this.ctx) return;
    this.tone({ frequency: 92, endFrequency: 44, type: 'sine', gain: 0.24 * power, duration: 0.2, attack: 0.002 });
    this.noise({ type: 'lowpass', frequency: 680, endFrequency: 180, gain: 0.17 * power, duration: 0.18, playbackRate: 0.8 });
    this.noise({ type: 'bandpass', frequency: 1900, endFrequency: 900, Q: 0.8, gain: 0.05 * power, duration: 0.09 });
  }

  boneBreak() {
    if (!this.ctx) return;
    this.noise({ type: 'highpass', frequency: 2600, gain: 0.14, duration: 0.1, playbackRate: 1.4 });
    this.noise({ type: 'bandpass', frequency: 780, endFrequency: 260, Q: 1.8, gain: 0.12, duration: 0.22 });
    this.tone({ frequency: 160, endFrequency: 76, type: 'triangle', gain: 0.13, duration: 0.25 });
  }

  metal() {
    if (!this.ctx) return;
    this.tone({ frequency: 1320, endFrequency: 940, type: 'triangle', gain: 0.07, duration: 0.24 });
    this.tone({ frequency: 1830, endFrequency: 1510, type: 'sine', gain: 0.035, duration: 0.2, detune: 9 });
    this.noise({ type: 'bandpass', frequency: 3200, Q: 2.4, gain: 0.05, duration: 0.16 });
  }

  hammer(power = 1) {
    if (!this.ctx) return;
    this.tone({ frequency: 64, endFrequency: 32, type: 'sine', gain: 0.35 * power, duration: 0.45, attack: 0.002 });
    this.noise({ type: 'lowpass', frequency: 440, endFrequency: 90, gain: 0.22 * power, duration: 0.4, playbackRate: 0.65 });
    this.metal();
  }

  scream(pitch = 1) {
    if (!this.ctx) return;
    const t = this.now;
    const osc = this.ctx.createOscillator();
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const amp = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(rand(220, 300) * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(rand(90, 140) * pitch, t + 0.58);
    vibrato.frequency.value = 18;
    vibratoGain.gain.value = 9;
    filter.type = 'bandpass';
    filter.frequency.value = 780;
    filter.Q.value = 1.2;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(0.035, t + 0.03);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    osc.start(t);
    vibrato.start(t);
    osc.stop(t + 0.7);
    vibrato.stop(t + 0.7);
  }

  crowdCheer(intensity = 1) {
    if (!this.ctx) return;
    const t = this.now;
    const source = this.noiseSource();
    source.playbackRate.value = 0.9;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(340, t);
    band.frequency.linearRampToValueAtTime(780, t + 0.55);
    band.frequency.linearRampToValueAtTime(410, t + 2.8);
    band.Q.value = 0.55;
    const amp = this.ctx.createGain();
    const peak = 0.1 * intensity;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.12);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
    source.connect(band);
    band.connect(amp);
    amp.connect(this.master);
    source.start(t);
    source.stop(t + 3);

    for (let i = 0; i < 15; i++) {
      this.noise({
        type: 'highpass',
        frequency: rand(900, 2100),
        Q: 0.7,
        gain: rand(0.015, 0.05) * intensity,
        duration: rand(0.035, 0.08),
        delay: rand(0.08, 1.9),
        attack: 0.001,
      });
    }

    this.tone({ frequency: 85, endFrequency: 62, type: 'sine', gain: 0.04 * intensity, duration: 1.2 });
  }

  gate() {
    if (!this.ctx) return;
    this.tone({ frequency: 48, endFrequency: 33, type: 'sawtooth', gain: 0.07, duration: 1.15 });
    this.noise({ type: 'lowpass', frequency: 360, endFrequency: 110, gain: 0.055, duration: 1.3, playbackRate: 0.55 });
    this.metal();
  }

  gong() {
    if (!this.ctx) return;
    this.tone({ frequency: 118, endFrequency: 72, type: 'sine', gain: 0.2, duration: 2.2, attack: 0.006 });
    this.tone({ frequency: 177, endFrequency: 110, type: 'sine', gain: 0.07, duration: 1.8, detune: -8 });
    this.tone({ frequency: 312, endFrequency: 260, type: 'triangle', gain: 0.03, duration: 1.3 });
  }

  footstep(sprint = false) {
    if (!this.ctx) return;
    const now = this.now;
    if (now - this.lastStep < (sprint ? 0.26 : 0.36)) return;
    this.lastStep = now;
    this.noise({ type: 'lowpass', frequency: rand(170, 260), gain: sprint ? 0.055 : 0.032, duration: 0.09, playbackRate: 0.55 });
    this.tone({ frequency: rand(62, 82), endFrequency: 45, type: 'sine', gain: sprint ? 0.05 : 0.025, duration: 0.1 });
  }

  ui() {
    if (!this.ctx) return;
    this.tone({ frequency: 640, endFrequency: 740, type: 'sine', gain: 0.025, duration: 0.06 });
  }

  deathCall() {
    if (!this.ctx) return;
    this.gong();
    this.tone({ frequency: 55, endFrequency: 28, type: 'sine', gain: 0.2, duration: 2.6 });
  }
}
