export function createAudio() {
  let ctx = null
  let master = null
  let muted = false
  let ambient = null
  let noiseBuffer = null

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume()
      return ctx
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
    master = ctx.createGain()
    master.gain.value = 0.85
    master.connect(ctx.destination)
    noiseBuffer = makeNoise(2)
    startAmbient()
    return ctx
  }

  function makeNoise(seconds) {
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      last = last * 0.72 + white * 0.28
      data[i] = last
    }
    return buffer
  }

  function startAmbient() {
    if (!ctx) return
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 520
    filter.Q.value = 0.6
    const gain = ctx.createGain()
    gain.gain.value = 0.028
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.11
    lfoGain.gain.value = 0.012
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    src.start()
    lfo.start()
    ambient = { src, gain, filter, lfo }
  }

  function noiseBurst({ duration = 0.3, gain = 0.2, type = 'lowpass', from = 900, to = 200, q = 1, delay = 0 }) {
    if (!ctx || muted) return
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.Q.value = q
    filter.frequency.setValueAtTime(from, t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, duration * 0.2))
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(filter)
    filter.connect(g)
    g.connect(master)
    src.start(t)
    src.stop(t + duration + 0.05)
  }

  function tone({ freq = 220, end = 80, type = 'sine', duration = 0.25, gain = 0.15, delay = 0, vibrato = 0 }) {
    if (!ctx || muted) return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration)
    if (vibrato) {
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfo.frequency.value = 22
      lfoGain.gain.value = vibrato
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      lfo.start(t)
      lfo.stop(t + duration)
    }
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(g)
    g.connect(master)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }

  return {
    ensure,
    get ready() { return Boolean(ctx) },
    get muted() { return muted },
    setMuted(value) {
      muted = value
      if (master) master.gain.value = muted ? 0 : 0.85
    },
    toggleMute() {
      this.setMuted(!muted)
      return muted
    },
    whoosh(heavy = false) {
      if (!ctx) return
      noiseBurst({ duration: heavy ? 0.38 : 0.22, gain: heavy ? 0.16 : 0.11, type: 'bandpass', from: heavy ? 420 : 700, to: heavy ? 160 : 260, q: 1.3 })
    },
    hit({ style = 'sharp', bone = false, heavy = false } = {}) {
      if (!ctx) return
      noiseBurst({ duration: heavy ? 0.22 : 0.14, gain: heavy ? 0.38 : 0.26, type: 'lowpass', from: 700, to: 90, q: 0.8 })
      tone({ freq: heavy ? 120 : 160, end: 42, type: 'sine', duration: heavy ? 0.3 : 0.18, gain: heavy ? 0.32 : 0.18 })
      if (bone) {
        noiseBurst({ duration: 0.09, gain: 0.32, type: 'highpass', from: 2600, to: 900, q: 0.5 })
        tone({ freq: 420, end: 90, type: 'square', duration: 0.08, gain: 0.08 })
      }
      if (style === 'blunt') {
        tone({ freq: 90, end: 38, type: 'triangle', duration: 0.25, gain: 0.22 })
      }
    },
    crack() {
      if (!ctx) return
      noiseBurst({ duration: 0.1, gain: 0.34, type: 'highpass', from: 3200, to: 800, q: 0.6 })
      tone({ freq: 700, end: 90, type: 'square', duration: 0.1, gain: 0.09 })
      tone({ freq: 260, end: 60, type: 'sawtooth', duration: 0.13, gain: 0.08 })
    },
    sever() {
      if (!ctx) return
      noiseBurst({ duration: 0.3, gain: 0.3, type: 'lowpass', from: 1800, to: 150, q: 1.2 })
      noiseBurst({ duration: 0.18, gain: 0.16, type: 'bandpass', from: 600, to: 200, q: 2 })
      tone({ freq: 180, end: 55, type: 'sawtooth', duration: 0.2, gain: 0.1, vibrato: 20 })
    },
    death() {
      if (!ctx) return
      tone({ freq: 130, end: 48, type: 'sawtooth', duration: 0.55, gain: 0.14, vibrato: 14 })
      noiseBurst({ duration: 0.5, gain: 0.14, type: 'bandpass', from: 500, to: 120, q: 1.5, delay: 0.1 })
    },
    hurt() {
      if (!ctx) return
      noiseBurst({ duration: 0.25, gain: 0.3, type: 'lowpass', from: 500, to: 80, q: 0.9 })
      tone({ freq: 95, end: 40, type: 'sine', duration: 0.28, gain: 0.25 })
    },
    metal() {
      if (!ctx) return
      tone({ freq: 1250, end: 900, type: 'triangle', duration: 0.25, gain: 0.08 })
      tone({ freq: 1870, end: 1320, type: 'sine', duration: 0.32, gain: 0.05 })
    },
    cheer(strength = 1) {
      if (!ctx || muted) return
      const duration = 1.6 + strength * 0.9
      for (let i = 0; i < 4; i++) {
        const delay = i * 0.09
        noiseBurst({ duration, gain: 0.16 * strength, type: 'bandpass', from: 400 + i * 120, to: 900 + i * 130, q: 0.8, delay })
        noiseBurst({ duration: 0.16, gain: 0.11 * strength, type: 'bandpass', from: 2200, to: 1800, q: 2, delay: delay + Math.random() * 0.5 })
      }
      tone({ freq: 190, end: 260, type: 'sawtooth', duration: 0.5, gain: 0.03 * strength, delay: 0.1 })
    },
    horn() {
      if (!ctx) return
      for (const freq of [110, 164.8, 220]) {
        tone({ freq, end: freq * 0.98, type: 'sawtooth', duration: 1.3, gain: 0.045 })
      }
      tone({ freq: 55, end: 52, type: 'triangle', duration: 1.5, gain: 0.08 })
    },
    step() {
      if (!ctx) return
      noiseBurst({ duration: 0.07, gain: 0.05, type: 'lowpass', from: 320, to: 90, q: 0.7 })
    },
    ui() {
      if (!ctx) return
      tone({ freq: 660, end: 880, type: 'triangle', duration: 0.08, gain: 0.05 })
    }
  }
}
