import * as THREE from 'three'

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function canvasTexture(size, draw, { repeat = [1, 1], srgb = true, anisotropy = 8 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  draw(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.anisotropy = anisotropy
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function makeSandTexture() {
  return canvasTexture(512, (ctx, size) => {
    const rnd = mulberry32(7)
    ctx.fillStyle = '#cbaa76'
    ctx.fillRect(0, 0, size, size)

    for (let i = 0; i < 9000; i++) {
      const x = rnd() * size
      const y = rnd() * size
      const shade = 120 + Math.floor(rnd() * 90)
      const alpha = 0.05 + rnd() * 0.16
      ctx.fillStyle = `rgba(${shade},${Math.floor(shade * 0.88)},${Math.floor(shade * 0.62)},${alpha})`
      const r = 0.4 + rnd() * 1.9
      ctx.fillRect(x, y, r, r)
    }

    for (let i = 0; i < 22; i++) {
      const x = rnd() * size
      const y = rnd() * size
      const radius = 12 + rnd() * 46
      const patch = ctx.createRadialGradient(x, y, 0, x, y, radius)
      patch.addColorStop(0, `rgba(110,80,44,${0.06 + rnd() * 0.06})`)
      patch.addColorStop(1, 'rgba(110,80,44,0)')
      ctx.fillStyle = patch
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Raked sand grooves.
    ctx.lineWidth = 1
    for (let i = 0; i < 90; i++) {
      const y = rnd() * size
      ctx.strokeStyle = `rgba(90,62,32,${0.04 + rnd() * 0.07})`
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(size * 0.33, y + (rnd() - 0.5) * 18, size * 0.66, y + (rnd() - 0.5) * 18, size, y + (rnd() - 0.5) * 8)
      ctx.stroke()
    }
  }, { repeat: [11, 11] })
}

export function makeStoneTexture() {
  return canvasTexture(512, (ctx, size) => {
    const rnd = mulberry32(19)
    ctx.fillStyle = '#665f51'
    ctx.fillRect(0, 0, size, size)
    const rowHeight = 64
    for (let row = 0; row < size / rowHeight; row++) {
      const offset = row % 2 ? 64 : 0
      for (let col = -1; col < 5; col++) {
        const x = col * 128 + offset
        const y = row * rowHeight
        const tone = 118 + Math.floor(rnd() * 40)
        ctx.fillStyle = `rgb(${tone},${Math.floor(tone * 0.94)},${Math.floor(tone * 0.82)})`
        ctx.fillRect(x + 3, y + 3, 122, rowHeight - 6)
        ctx.strokeStyle = 'rgba(255,244,214,0.14)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 4.5, y + 4.5, 119, rowHeight - 9)
        for (let i = 0; i < 45; i++) {
          ctx.fillStyle = `rgba(50,44,34,${0.03 + rnd() * 0.1})`
          ctx.fillRect(x + 4 + rnd() * 118, y + 4 + rnd() * (rowHeight - 10), 1 + rnd() * 3, 1 + rnd() * 2)
        }
      }
    }
    ctx.strokeStyle = 'rgba(40,34,26,0.28)'
    ctx.lineWidth = 1.3
    for (let i = 0; i < 12; i++) {
      let x = rnd() * size
      let y = rnd() * size
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let s = 0; s < 5; s++) {
        x += (rnd() - 0.5) * 44
        y += rnd() * 26
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }, { repeat: [10, 1.6] })
}

export function makeSplatTexture() {
  return canvasTexture(256, (ctx, size) => {
    const rnd = mulberry32(91)
    ctx.clearRect(0, 0, size, size)
    const cx = size / 2
    const cy = size / 2
    for (let i = 0; i < 16; i++) {
      const angle = rnd() * Math.PI * 2
      const distance = rnd() * 26
      const x = cx + Math.cos(angle) * distance
      const y = cy + Math.sin(angle) * distance
      const radius = 16 + rnd() * 46
      const gradient = ctx.createRadialGradient(x, y, radius * 0.15, x, y, radius)
      gradient.addColorStop(0, 'rgba(255,255,255,0.98)')
      gradient.addColorStop(0.72, 'rgba(255,255,255,0.9)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 52; i++) {
      const angle = rnd() * Math.PI * 2
      const distance = 44 + rnd() * 74
      const x = cx + Math.cos(angle) * distance
      const y = cy + Math.sin(angle) * distance
      const radius = 1.5 + rnd() * 7
      ctx.fillStyle = `rgba(255,255,255,${0.45 + rnd() * 0.5})`
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    // Long arterial streaks.
    for (let i = 0; i < 5; i++) {
      const angle = rnd() * Math.PI * 2
      const length = 40 + rnd() * 70
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'
      ctx.lineWidth = 2 + rnd() * 5
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(angle) * 18, cy + Math.sin(angle) * 18)
      ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length)
      ctx.stroke()
    }
  }, { repeat: [1, 1], srgb: false })
}

export function makeContactShadowTexture() {
  return canvasTexture(128, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(0,0,0,0.78)')
    gradient.addColorStop(0.45, 'rgba(0,0,0,0.4)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }, { repeat: [1, 1], srgb: false })
}

export function makeBannerTexture() {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#6d1112'
    ctx.fillRect(0, 0, size, size)
    const gradient = ctx.createLinearGradient(0, 0, size, 0)
    gradient.addColorStop(0, 'rgba(0,0,0,0.38)')
    gradient.addColorStop(0.5, 'rgba(255,210,120,0.08)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.42)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = '#d8b25a'
    ctx.lineWidth = 8
    ctx.strokeRect(10, 10, size - 20, size - 20)
    ctx.strokeStyle = '#c9a24a'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, 58, 0, Math.PI * 2)
    ctx.stroke()
    // Crossed blades.
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.moveTo(72, 176)
    ctx.lineTo(184, 74)
    ctx.moveTo(184, 176)
    ctx.lineTo(72, 74)
    ctx.stroke()
    ctx.fillStyle = '#d8b25a'
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, 16, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.08})`
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2)
    }
  }, { repeat: [1, 1] })
}

export function makeWoodTexture() {
  return canvasTexture(256, (ctx, size) => {
    const rnd = mulberry32(44)
    ctx.fillStyle = '#4b3421'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 55; i++) {
      const y = rnd() * size
      ctx.fillStyle = `rgba(${90 + Math.floor(rnd() * 40)},${58 + Math.floor(rnd() * 26)},${30 + Math.floor(rnd() * 14)},0.35)`
      ctx.fillRect(0, y, size, 1 + rnd() * 4)
    }
    for (let i = 0; i < 8; i++) {
      const x = rnd() * size
      const y = rnd() * size
      ctx.strokeStyle = 'rgba(30,18,10,0.5)'
      ctx.beginPath()
      ctx.ellipse(x, y, 4 + rnd() * 7, 1.5 + rnd() * 3, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }, { repeat: [2, 2] })
}

export function makeSplashTexture() {
  return canvasTexture(128, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.8)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.fill()
  }, { repeat: [1, 1], srgb: false })
}
