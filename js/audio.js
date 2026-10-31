import { rand, clamp, choice } from './utils.js'

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.ready = false
    this.muted = false
    this.crowdLevel = 0.15
    this.crowdTarget = 0.15
    this.cheerCooldown = 0
    this.time = 0
    this.waveDrone = 0
  }

  init() {
    if (this.ready) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    try {
      this.ctx = new AC()
    } catch { return }
    const ctx = this.ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.72
    this.comp = ctx.createDynamicsCompressor()
    this.comp.threshold.value = -16
    this.comp.knee.value = 22
    this.comp.ratio.value = 4
    this.comp.attack.value = 0.004
    this.comp.release.value = 0.24
    this.master.connect(this.comp)
    this.comp.connect(ctx.destination)

    // arena reverb
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this._impulse(2.4, 2.6)
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.28
    this.reverb.connect(this.wet)
    this.wet.connect(this.master)

    this.noise = this._noiseBuffer(2.5)
    this.ready = true
    this._startAmbience()
  }

  resume() {
    if (!this.ready) this.init()
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }

  _noiseBuffer(seconds) {
    const ctx = this.ctx
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) {
        const t = i / len
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - t * 0.2)
      }
    }
    return buf
  }

  _panner(pan = 0) {
    if (!this.ctx.createStereoPanner) return null
    const p = this.ctx.createStereoPanner()
    p.pan.value = clamp(pan, -1, 1)
    return p
  }

  _out(node, pan = 0, wet = 0.3) {
    const p = this._panner(pan)
    if (p) { node.connect(p); p.connect(this.master) } else node.connect(this.master)
    if (wet > 0) {
      const w = this.ctx.createGain(); w.gain.value = wet
      node.connect(w); w.connect(this.reverb)
    }
  }

  _env(gain, t0, attack, hold, release, peak) {
    const g = gain.gain
    g.cancelScheduledValues(t0)
    g.setValueAtTime(0.0001, t0)
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack)
    g.setValueAtTime(Math.max(0.0002, peak), t0 + attack + hold)
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release)
  }

  _noiseBurst(dur, gain, type, freq, q, pan = 0, wet = 0.3, sweepTo = null) {
    if (!this.ready) return
    const ctx = this.ctx, t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur)
    const g = ctx.createGain()
    this._env(g, t, Math.min(0.02, dur * 0.2), dur * 0.35, dur * 0.65, gain)
    src.connect(f); f.connect(g)
    this._out(g, pan, wet)
    src.start(t); src.stop(t + dur + 0.08)
  }

  _tone(freq, dur, gain, type = 'sine', pan = 0, wet = 0.25, glideTo = null, attack = 0.005) {
    if (!this.ready) return
    const ctx = this.ctx, t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t + dur)
    const g = ctx.createGain()
    this._env(g, t, attack, dur * 0.25, dur * 0.7, gain)
    o.connect(g)
    this._out(g, pan, wet)
    o.start(t); o.stop(t + dur + 0.1)
  }

  ui() {
    if (!this.ready) return
    this._tone(520, 0.06, 0.05, 'triangle', 0, 0.15)
  }

  whoosh(pan = 0, heavy = false) {
    if (!this.ready) return
    this._noiseBurst(heavy ? 0.34 : 0.22, heavy ? 0.34 : 0.24, 'bandpass', heavy ? 420 : 900, heavy ? 0.9 : 1.4, pan, 0.25, heavy ? 130 : 280)
    if (heavy) this._tone(70, 0.22, 0.16, 'sine', pan, 0.2, 42)
  }

  hurt(pan = 0) {
    if (!this.ready) return
    this._tone(96, 0.34, 0.26, 'sine', pan, 0.3, 44)
    this._noiseBurst(0.18, 0.16, 'lowpass', 900, 0.8, pan, 0.25)
    this._tone(3100, 1.6, 0.018, 'sine', 0, 0.4)
  }

  flesh(power = 1, pan = 0, bone = false) {
    if (!this.ready) return
    const p = clamp(power, 0.4, 1.6)
    this._noiseBurst(0.14, 0.3 * p, 'lowpass', 700, 0.9, pan, 0.35, 160)
    this._tone(78, 0.2, 0.22 * p, 'sine', pan, 0.3, 42)
    this._noiseBurst(0.09, 0.16 * p, 'bandpass', 1600, 1.6, pan, 0.3, 500)
    if (bone) this.crunch(pan, 0.7 * p)
    setTimeout(() => this.splat(pan, 0.5 * p), 40)
  }

  crunch(pan = 0, power = 1) {
    if (!this.ready) return
    const ctx = this.ctx, t = ctx.currentTime
    for (let i = 0; i < 4; i++) {
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'
      f.frequency.value = rand(900, 2600); f.Q.value = rand(3, 8)
      const g = ctx.createGain()
      const start = t + i * rand(0.008, 0.03)
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(rand(0.08, 0.2) * power, start + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, start + rand(0.035, 0.09))
      src.connect(f); f.connect(g); this._out(g, pan, 0.25)
      src.start(start); src.stop(start + 0.12)
    }
    this._tone(rand(55, 90), 0.28, 0.2 * power, 'sine', pan, 0.3, 38)
  }

  splat(pan = 0, power = 1) {
    if (!this.ready) return
    this._noiseBurst(0.18, 0.16 * power, 'bandpass', rand(450, 850), 0.7, pan, 0.35, 180)
  }

  sever(pan = 0, bone = false) {
    if (!this.ready) return
    this._noiseBurst(0.28, 0.3, 'lowpass', 1200, 0.8, pan, 0.4, 120)
    this._tone(140, 0.3, 0.2, 'sawtooth', pan, 0.35, 42)
    this.splat(pan, 1.2)
    if (bone) setTimeout(() => this.crunch(pan, 1), 60)
    setTimeout(() => this.gurgle(pan), 120)
  }

  gurgle(pan = 0) {
    if (!this.ready) return
    this._tone(rand(120, 180), 0.5, 0.055, 'sawtooth', pan, 0.4, rand(60, 90))
    this._noiseBurst(0.35, 0.06, 'bandpass', rand(300, 500), 2.5, pan, 0.5)
  }

  clang(pan = 0) {
    if (!this.ready) return
    this._tone(1180, 0.28, 0.06, 'square', pan, 0.45, 940)
    this._tone(1760, 0.22, 0.04, 'triangle', pan, 0.45, 1400)
  }

  horn() {
    if (!this.ready) return
    const ctx = this.ctx, t = ctx.currentTime
    for (const f of [55, 82.5, 110]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 2
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.35)
      g.gain.setValueAtTime(0.09, t + 1.1)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
      o.connect(lp); lp.connect(g); this._out(g, 0, 0.55)
      o.start(t); o.stop(t + 2.3)
    }
  }

  cheer(intensity = 0.6) {
    if (!this.ready) return
    if (this.cheerCooldown > 0) return
    this.cheerCooldown = 0.35
    const ctx = this.ctx, t = ctx.currentTime
    const amt = clamp(intensity, 0.15, 1)
    // roar
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.55
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16 * amt, t + 0.18)
    g.gain.setValueAtTime(0.16 * amt, t + rand(0.5, 0.9))
    g.gain.exponentialRampToValueAtTime(0.0001, t + rand(1.1, 1.9))
    src.connect(bp); bp.connect(g); this._out(g, 0, 0.6)
    src.start(t); src.stop(t + 2.1)
    // voices
    const voices = Math.floor(6 + amt * 12)
    for (let i = 0; i < voices; i++) {
      const start = t + rand(0, 0.42)
      const dur = rand(0.35, 0.9)
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      const base = rand(120, 290) + (Math.random() < 0.3 ? 80 : 0)
      o.frequency.setValueAtTime(base, start)
      o.frequency.linearRampToValueAtTime(base * rand(0.82, 1.3), start + dur)
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = rand(500, 950); f1.Q.value = rand(4, 9)
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = rand(1100, 2100); f2.Q.value = rand(5, 11)
      const vg = ctx.createGain()
      vg.gain.setValueAtTime(0.0001, start)
      vg.gain.exponentialRampToValueAtTime(rand(0.008, 0.03) * amt, start + 0.08)
      vg.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      o.connect(f1); o.connect(f2); f1.connect(vg); f2.connect(vg)
      this._out(vg, rand(-0.8, 0.8), 0.5)
      o.start(start); o.stop(start + dur + 0.05)
    }
  }

  boo() {
    if (!this.ready) return
    this._noiseBurst(1.6, 0.09, 'bandpass', 340, 1.2, 0, 0.6, 220)
    this._tone(90, 1.4, 0.04, 'sawtooth', 0, 0.5, 65)
  }

  waveStart() {
    this.horn()
    setTimeout(() => this.cheer(0.8), 350)
  }

  _startAmbience() {
    const ctx = this.ctx, t = ctx.currentTime
    // crowd murmur
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.4
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 430; bp.Q.value = 0.5
    const g = ctx.createGain(); g.gain.value = this.crowdLevel * 0.1
    src.connect(lp); lp.connect(bp); bp.connect(g); this._out(g, 0, 0.2)
    src.start(t)
    this.crowdGain = g
    // low drone
    const dg = ctx.createGain(); dg.gain.value = 0.018
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 180
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 41.2
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 61.7
    o1.connect(dlp); o2.connect(dlp); dlp.connect(dg); this._out(dg, 0, 0.3)
    o1.start(t); o2.start(t)
    this.droneGain = dg
    // torch crackle bed
    const cs = ctx.createBufferSource(); cs.buffer = this.noise; cs.loop = true
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400
    const cg = ctx.createGain(); cg.gain.value = 0.008
    cs.connect(hp); hp.connect(cg); this._out(cg, 0, 0.15); cs.start(t)
  }

  setCrowd(intensity) {
    this.crowdTarget = clamp(intensity, 0.12, 1)
  }

  setMuted(m) {
    this.muted = m
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.72, this.ctx.currentTime, 0.08)
  }

  update(dt) {
    if (!this.ready) return
    this.time += dt
    this.cheerCooldown = Math.max(0, this.cheerCooldown - dt)
    this.crowdLevel += (this.crowdTarget - this.crowdLevel) * Math.min(1, dt * 1.4)
    if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(this.crowdLevel * 0.1, this.ctx.currentTime, 0.2)
    if (this.droneGain) this.droneGain.gain.setTargetAtTime(0.012 + this.crowdLevel * 0.02, this.ctx.currentTime, 0.3)
  }
}
