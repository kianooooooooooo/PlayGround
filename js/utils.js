import * as THREE from '../vendor/three.module.js'

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a)
export const randInt = (a, b) => Math.floor(rand(a, b + 1))
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)]
export const TAU = Math.PI * 2

export function roman(num) {
  const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]
  let out = ''
  for (const [n, s] of map) while (num >= n) { out += s; num -= n }
  return out
}

export function makeCanvasTexture(w, h, draw, { repeat = null, srgb = true, anisotropy = 8 } = {}) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  draw(ctx, w, h)
  const tex = new THREE.CanvasTexture(c)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = anisotropy
  if (repeat) tex.repeat.set(repeat[0], repeat[1])
  return tex
}

function noise(ctx, w, h, count, alpha, size = 2, colors = ['#000', '#fff']) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = rand(alpha * 0.25, alpha)
    ctx.fillStyle = choice(colors)
    const s = rand(0.5, size)
    ctx.fillRect(rand(0, w), rand(0, h), s, s)
  }
  ctx.globalAlpha = 1
}

export function makeSandTexture() {
  return makeCanvasTexture(1024, 1024, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#a68a5f'); g.addColorStop(0.45, '#947a55'); g.addColorStop(1, '#7e6648')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)

    // broad damp patches and old stains
    for (let i = 0; i < 90; i++) {
      const x = rand(0, w), y = rand(0, h), r = rand(30, 190)
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
      const dark = Math.random() < 0.6
      rg.addColorStop(0, dark ? 'rgba(70,50,33,.12)' : 'rgba(210,190,150,.10)')
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
    }
    // raked arcs
    ctx.globalAlpha = 0.09; ctx.strokeStyle = '#3b2c1c'; ctx.lineWidth = 2
    for (let i = 0; i < 26; i++) {
      const y = rand(0, h)
      ctx.beginPath()
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.014 + i) * 8)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    // pebbles / grain
    noise(ctx, w, h, 26000, 0.24, 2.4, ['#5f4a30', '#c4a97a', '#3c2d1d', '#d8c193'])
    // tiny dark flecks
    noise(ctx, w, h, 6000, 0.45, 1.4, ['#38291a', '#2a1d12'])
    // footfall scars
    ctx.strokeStyle = 'rgba(59,42,25,.18)'; ctx.lineWidth = 5
    for (let i = 0; i < 40; i++) {
      ctx.beginPath(); ctx.arc(rand(0, w), rand(0, h), rand(8, 26), 0, TAU); ctx.stroke()
    }
  }, { repeat: [7, 9] })
}

export function makeStoneTexture() {
  return makeCanvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#241c18'; ctx.fillRect(0, 0, w, h)
    const rows = 7, rowH = h / rows
    for (let r = 0; r < rows; r++) {
      const y = r * rowH
      let x = (r % 2) ? -rand(40, 90) : -rand(0, 40)
      while (x < w) {
        const bw = rand(95, 175), gap = rand(4, 8)
        const c = Math.floor(rand(33, 52))
        const grad = ctx.createLinearGradient(0, y, 0, y + rowH)
        grad.addColorStop(0, `hsl(22 ${rand(5, 13)}% ${c + 8}%)`)
        grad.addColorStop(0.5, `hsl(24 ${rand(4, 10)}% ${c}%)`)
        grad.addColorStop(1, `hsl(20 ${rand(6, 14)}% ${c - 9}%)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        const pad = 3
        ctx.roundRect(x + gap / 2, y + pad, bw - gap, rowH - pad * 2, 3)
        ctx.fill()
        // brick face texture
        ctx.save(); ctx.clip()
        noise(ctx, w, h, 220, 0.09, 2.2, ['#000', '#fff', '#6a4a34'])
        ctx.restore()
        // edge highlight
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2
        ctx.stroke()
        x += bw
      }
    }
    // mortar noise + cracks
    noise(ctx, w, h, 12000, 0.2, 1.8, ['#0c0908', '#5e4a3a'])
    ctx.strokeStyle = 'rgba(8,5,4,.35)'; ctx.lineWidth = 1.5
    for (let i = 0; i < 28; i++) {
      let x = rand(0, w), y = rand(0, h)
      ctx.beginPath(); ctx.moveTo(x, y)
      for (let s = 0; s < rand(3, 7); s++) { x += rand(-24, 24); y += rand(8, 26); ctx.lineTo(x, y) }
      ctx.stroke()
    }
    // moss
    for (let i = 0; i < 40; i++) {
      const x = rand(0, w), y = rand(0, h)
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rand(8, 30))
      rg.addColorStop(0, 'rgba(63,74,38,.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill()
    }
  }, { repeat: [3, 1] })
}

export function makeWoodTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#3a2418'; ctx.fillRect(0, 0, w, h)
    const planks = 7, pw = w / planks
    for (let i = 0; i < planks; i++) {
      const x = i * pw
      const g = ctx.createLinearGradient(x, 0, x + pw, 0)
      const l = rand(16, 27)
      g.addColorStop(0, `hsl(24 42% ${l - 4}%)`)
      g.addColorStop(0.4, `hsl(26 38% ${l + 5}%)`)
      g.addColorStop(1, `hsl(22 44% ${l - 2}%)`)
      ctx.fillStyle = g; ctx.fillRect(x + 1, 0, pw - 2, h)
      ctx.strokeStyle = 'rgba(12,7,5,.4)'; ctx.lineWidth = 2
      for (let k = 0; k < 5; k++) {
        let yy = rand(0, h), xx = x + rand(4, pw - 4)
        ctx.beginPath(); ctx.moveTo(xx, yy)
        for (let s = 0; s < 8; s++) { xx += rand(-2, 2); yy += rand(8, 20); ctx.lineTo(xx, yy) }
        ctx.stroke()
      }
      // nail heads
      ctx.fillStyle = 'rgba(15,12,10,.8)'
      for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(x + pw / 2 + rand(-6, 6), rand(0, h), 2, 0, TAU); ctx.fill() }
    }
    noise(ctx, w, h, 4000, 0.12, 2, ['#000', '#b08050'])
  }, { repeat: [2, 2] })
}

export function makeSkyTexture() {
  return makeCanvasTexture(2048, 1024, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0.0, '#07070f')
    g.addColorStop(0.2, '#14101d')
    g.addColorStop(0.38, '#3e1620')
    g.addColorStop(0.5, '#8f3423')
    g.addColorStop(0.56, '#d9803c')
    g.addColorStop(0.60, '#6b2a1c')
    g.addColorStop(0.72, '#24100d')
    g.addColorStop(1.0, '#0a0605')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)

    // sun glow
    const sx = w * 0.34, sy = h * 0.515
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 300)
    sun.addColorStop(0, 'rgba(255,238,200,1)')
    sun.addColorStop(0.07, 'rgba(255,205,130,.92)')
    sun.addColorStop(0.24, 'rgba(230,120,55,.32)')
    sun.addColorStop(0.6, 'rgba(120,40,20,.10)')
    sun.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sx, sy, 300, 0, TAU); ctx.fill()

    // clouds
    for (let i = 0; i < 42; i++) {
      const x = rand(0, w), y = rand(h * 0.18, h * 0.56), rw = rand(90, 380), rh = rand(10, 44)
      const cg = ctx.createRadialGradient(x, y, 0, x, y, rw)
      cg.addColorStop(0, `rgba(${randInt(30, 80)},${randInt(14, 34)},${randInt(22, 42)},${rand(0.12, 0.34)})`)
      cg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.save(); ctx.translate(x, y); ctx.scale(1, rh / rw); ctx.translate(-x, -y)
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, y, rw, 0, TAU); ctx.fill(); ctx.restore()
    }
    // stars
    for (let i = 0; i < 260; i++) {
      ctx.globalAlpha = rand(0.1, 0.8); ctx.fillStyle = '#dfe4ff'
      const s = rand(0.5, 1.6)
      ctx.fillRect(rand(0, w), rand(0, h * 0.33), s, s)
    }
    ctx.globalAlpha = 1
    // distant haze mountains silhouette
    ctx.fillStyle = 'rgba(12,8,8,.6)'
    ctx.beginPath(); ctx.moveTo(0, h * 0.585)
    for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h * 0.585 - Math.abs(Math.sin(x * 0.004) * 28 + Math.sin(x * 0.011) * 12))
    ctx.lineTo(w, h * 0.7); ctx.lineTo(0, h * 0.7); ctx.closePath(); ctx.fill()
  }, { repeat: [1, 1] })
}

export function makeBloodTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const cx = w * 0.5, cy = h * 0.5
    const blob = (x, y, rx, ry, rot, color) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore()
    }
    // central irregular pool
    ctx.fillStyle = 'rgba(118,7,11,.97)'
    ctx.beginPath()
    const points = 14
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * TAU
      const r = 92 + Math.sin(a * 3 + 1.2) * 26 + Math.sin(a * 7) * 14
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.86
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.closePath(); ctx.fill()
    // inner darker center
    blob(cx, cy, 55, 45, 0.3, 'rgba(61,2,5,.85)')
    // satellite splats
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU), d = rand(95, 225)
      const rx = rand(4, 26) * (1 - d / 340), ry = rx * rand(0.6, 1.3)
      blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, rx, ry, rand(0, TAU), `rgba(${randInt(108, 158)},${randInt(4, 14)},${randInt(6, 17)},${rand(0.5, 0.95)})`)
    }
    // drips / streaks
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU), d = rand(40, 120)
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d
      ctx.strokeStyle = `rgba(${randInt(92, 138)},4,8,${rand(0.35, 0.8)})`
      ctx.lineWidth = rand(2, 8); ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + rand(-16, 16), y + rand(10, 24), x + rand(-20, 20), y + rand(28, 70))
      ctx.stroke()
    }
    // tiny droplets
    for (let i = 0; i < 90; i++) {
      const a = rand(0, TAU), d = rand(130, 250)
      blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rand(1, 5), rand(1, 4), rand(0, TAU), `rgba(${randInt(96, 145)},3,7,${rand(0.3, 0.8)})`)
    }
  }, { repeat: [1, 1] })
}

export function makeFlameTexture() {
  return makeCanvasTexture(128, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const g = ctx.createRadialGradient(w / 2, h * 0.66, 2, w / 2, h * 0.62, w * 0.6)
    g.addColorStop(0, 'rgba(255,250,210,1)')
    g.addColorStop(0.22, 'rgba(255,190,70,.95)')
    g.addColorStop(0.52, 'rgba(230,80,20,.55)')
    g.addColorStop(1, 'rgba(120,20,5,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.moveTo(w / 2, 4)
    ctx.bezierCurveTo(w * 0.96, h * 0.4, w * 0.82, h * 0.96, w / 2, h * 0.98)
    ctx.bezierCurveTo(w * 0.14, h * 0.94, w * 0.05, h * 0.42, w / 2, 4)
    ctx.fill()
    // inner core
    const g2 = ctx.createRadialGradient(w / 2, h * 0.76, 1, w / 2, h * 0.76, w * 0.3)
    g2.addColorStop(0, 'rgba(255,255,230,1)')
    g2.addColorStop(0.6, 'rgba(255,220,120,.7)')
    g2.addColorStop(1, 'rgba(255,120,30,0)')
    ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.78, w * 0.22, h * 0.2, 0, 0, TAU); ctx.fill()
  }, { repeat: [1, 1] })
}

export function makeEmblemTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const cx = w / 2, cy = h * 0.46
    ctx.fillStyle = '#160b0a'
    // skull silhouette
    ctx.beginPath()
    ctx.ellipse(cx, cy, 118, 132, 0, 0, TAU); ctx.fill()
    ctx.beginPath(); ctx.roundRect(cx - 82, cy + 74, 164, 94, 26); ctx.fill()
    ctx.beginPath(); ctx.ellipse(cx, cy + 78, 118, 34, 0, 0, TAU); ctx.fill()
    // cheekbones
    ctx.beginPath(); ctx.arc(cx - 92, cy + 26, 34, 0, TAU); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + 92, cy + 26, 34, 0, TAU); ctx.fill()
    // eyes (holes)
    ctx.fillStyle = '#8e0d10'
    ctx.beginPath(); ctx.ellipse(cx - 48, cy + 4, 34, 42, 0.18, 0, TAU); ctx.fill()
    ctx.beginPath(); ctx.ellipse(cx + 48, cy + 4, 34, 42, -0.18, 0, TAU); ctx.fill()
    ctx.fillStyle = '#0b0505'
    ctx.beginPath(); ctx.ellipse(cx - 48, cy + 6, 25, 32, 0.18, 0, TAU); ctx.fill()
    ctx.beginPath(); ctx.ellipse(cx + 48, cy + 6, 25, 32, -0.18, 0, TAU); ctx.fill()
    // nose
    ctx.beginPath(); ctx.moveTo(cx, cy + 38); ctx.lineTo(cx - 16, cy + 76); ctx.lineTo(cx + 16, cy + 76); ctx.closePath(); ctx.fill()
    // teeth
    ctx.fillStyle = '#160b0a'
    for (let i = -4; i <= 4; i++) ctx.fillRect(cx + i * 20 - 7, cy + 118, 13, 38)
    // cross swords behind
    ctx.save(); ctx.translate(cx, cy + 30); ctx.rotate(-0.68)
    ctx.fillStyle = 'rgba(160,128,76,.55)'; ctx.fillRect(-5, -210, 10, 420); ctx.restore()
    ctx.save(); ctx.translate(cx, cy + 30); ctx.rotate(0.68)
    ctx.fillStyle = 'rgba(160,128,76,.55)'; ctx.fillRect(-5, -210, 10, 420); ctx.restore()
    // border ring
    ctx.strokeStyle = 'rgba(190,155,95,.5)'; ctx.lineWidth = 5
    ctx.beginPath(); ctx.arc(cx, cy + 26, 225, 0, TAU); ctx.stroke()
  }, { repeat: [1, 1] })
}

export function makeDustTexture() {
  return makeCanvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,235,200,.9)')
    g.addColorStop(0.4, 'rgba(230,200,150,.35)')
    g.addColorStop(1, 'rgba(200,170,120,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  }, { srgb: true })
}

export function makeClothTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4d0b0d'; ctx.fillRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 5000; i++) {
      ctx.globalAlpha = rand(0.02, 0.1); ctx.fillStyle = Math.random() < 0.5 ? '#000' : '#c08060'
      ctx.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(1, 6))
    }
    ctx.globalAlpha = 1
  }, { repeat: [1, 1] })
}

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2, y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y)
  return s
}

export function roundedBox(w, h, d, r = 0.05, bevel = 0.5) {
  const shape = roundedRectShape(w, h, Math.min(r, Math.min(w, h) * 0.45))
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, d - r * bevel), bevelEnabled: true, bevelSegments: 2,
    steps: 1, bevelSize: r * bevel * 0.6, bevelThickness: r * bevel * 0.6, curveSegments: 4
  })
  geo.center()
  geo.computeVertexNormals()
  return geo
}

export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

export function disposeObject(obj) {
  obj.traverse?.(o => {
    if (o.geometry) o.geometry.dispose?.()
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) m.dispose?.()
    }
  })
}

export function bloodColor() {
  return new THREE.Color().setHSL(rand(0.985, 1.01) % 1, rand(0.72, 0.95), rand(0.12, 0.24))
}
