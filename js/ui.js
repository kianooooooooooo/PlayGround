import { clamp, rand, randInt } from './utils.js'

const ICONS = {
  sword: `<svg viewBox="0 0 48 48"><path d="M37 3l3 3-5 15-9 9-4-4 9-9 6-14z"/><path d="M19 25l4 4-4 4-2-1-2 5-5 5-3-3 5-5 5-2-1-2 3-5z" opacity=".65"/><path d="M10 32l5 5" stroke="currentColor" stroke-width="3"/></svg>`,
  hammer: `<svg viewBox="0 0 48 48"><path d="M20 18l4-2 13 13-3 3-13-13z" opacity=".7"/><path d="M6 5h15l3 4v7l-3 4H6l-3-4V9l3-4z"/><path d="M10 5v15M18 5v15" stroke="#0a0706" stroke-width="2" opacity=".5"/><path d="M15 19l3 1 5 15-4 1-5-15 1-2z" opacity=".7"/></svg>`
}

export class UI {
  constructor(game) {
    this.game = game
    this.$ = (id) => document.getElementById(id)
    this.cache = {}
    this.bannerTimer = 0
    this.toastTimer = 0
    this.splatCount = 0
    this.mobile = false
    this._bind()
  }

  _bind() {
    for (const card of document.querySelectorAll('.weapon-card')) {
      card.addEventListener('click', () => {
        const w = card.dataset.weapon
        this.game.selectWeapon(w)
        this.game.audio.ui()
      })
    }
    this.$('start-btn').addEventListener('click', () => this.game.startRun())
    this.$('resume-btn').addEventListener('click', () => this.game.resume())
    this.$('quit-btn').addEventListener('click', () => this.game.quitToMenu())
    this.$('restart-btn').addEventListener('click', () => this.game.restart())
    this.$('death-menu-btn').addEventListener('click', () => this.game.quitToMenu())
    this.$('pause-btn').addEventListener('click', () => this.game.togglePause())
    this.$('sound-btn').addEventListener('click', () => this.game.toggleMute())
  }

  setWeapon(w) {
    for (const card of document.querySelectorAll('.weapon-card')) {
      const on = card.dataset.weapon === w
      card.classList.toggle('selected', on)
      card.setAttribute('aria-pressed', String(on))
    }
    this.$('weapon-icon').innerHTML = ICONS[w]
    this.$('weapon-name').textContent = w === 'sword' ? 'ARENA SWORD' : 'WAR HAMMER'
    this.$('weapon-hint').textContent = w === 'sword' ? 'SEVER & CLEAVE' : 'CRUSH & BREAK'
    this.$('crosshair').className = `crosshair ${w}`
  }

  showHUD(on) {
    this.$('hud').classList.toggle('hidden', !on)
  }

  showMenu(on) {
    this.$('menu').classList.toggle('hidden', !on)
  }

  showPause(on) {
    this.$('pause').classList.toggle('hidden', !on)
  }

  showDeath(on) {
    this.$('death').classList.toggle('hidden', !on)
  }

  showDeathStats(stats) {
    this.$('death-wave').textContent = stats.wave
    this.$('death-kills').textContent = stats.kills
    this.$('death-score').textContent = stats.score.toLocaleString()
    this.$('death-combo').textContent = stats.bestCombo
    this.showDeathScreen()
  }

  showMobile(on) {
    this.$('mobile').classList.toggle('hidden', !on)
    this.mobile = on
  }

  setStats({ wave, enemies, kills, score, crowd, health, stamina, cd, weapon }) {
    const c = this.cache
    if (c.wave !== wave) { this.$('wave-num').textContent = wave; c.wave = wave }
    if (c.enemies !== enemies) { this.$('enemies-left').textContent = enemies; c.enemies = enemies }
    if (c.kills !== kills) { this.$('kill-num').textContent = kills; c.kills = kills }
    if (c.score !== score) { this.$('score-num').textContent = score.toLocaleString(); c.score = score }
    if (c.health !== health) {
      this.$('health-fill').style.width = `${clamp(health, 0, 100)}%`
      this.$('health-text').textContent = Math.ceil(health)
      this.$('health-fill').style.background = health < 30
        ? 'linear-gradient(90deg,#450406,#c0171b 70%,#ff4034)'
        : 'linear-gradient(90deg,#52080a,#b31419 70%,#d63c32)'
      c.health = health
    }
    if (c.stamina !== stamina) {
      this.$('stamina-fill').style.width = `${clamp(stamina, 0, 100)}%`
      c.stamina = stamina
    }
    if (c.crowd !== crowd) {
      this.$('crowd-fill').style.width = `${clamp(crowd * 100, 4, 100)}%`
      c.crowd = crowd
    }
    if (c.cd !== cd) {
      this.$('weapon-cd').style.transform = `scaleX(${clamp(1 - cd, 0, 1)})`
      c.cd = cd
    }
    if (c.weapon !== weapon) {
      this.setWeapon(weapon)
      c.weapon = weapon
    }
  }

  banner(title, sub, eyebrow = 'THE GATES OPEN', ms = 2400) {
    const el = this.$('wave-banner')
    this.$('banner-title').textContent = title
    this.$('banner-sub').textContent = sub
    el.querySelector('.banner-eyebrow').textContent = eyebrow
    el.classList.add('show')
    clearTimeout(this.bannerTimer)
    this.bannerTimer = setTimeout(() => el.classList.remove('show'), ms)
  }

  hideBanner() {
    this.$('wave-banner').classList.remove('show')
  }

  toast(text, ms = 1600) {
    const el = this.$('toast')
    el.textContent = text
    el.classList.add('show')
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => el.classList.remove('show'), ms)
  }

  killFeed(html, ms = 3800) {
    const feed = this.$('killfeed')
    const item = document.createElement('div')
    item.className = 'kill-item'
    item.innerHTML = html
    feed.prepend(item)
    while (feed.children.length > 6) feed.lastChild.remove()
    setTimeout(() => {
      item.classList.add('out')
      setTimeout(() => item.remove(), 520)
    }, ms)
  }

  hitmarker(strong = false) {
    const el = this.$('hitmarker')
    el.classList.remove('active')
    void el.offsetWidth
    el.classList.add('active')
    el.style.filter = strong ? 'drop-shadow(0 0 4px #c0171b)' : 'none'
  }

  combo(count, label = 'KILL STREAK') {
    const el = this.$('combo')
    el.querySelector('b').textContent = `${count}×`
    el.querySelector('span').textContent = label
    el.classList.add('show')
    clearTimeout(this._comboTimer)
    this._comboTimer = setTimeout(() => el.classList.remove('show'), 1400)
  }

  target(info) {
    const el = this.$('target-tag')
    if (!info) { el.classList.remove('show'); return }
    const p = info.part
    const hp = clamp(p.hp / p.maxHp, 0, 1)
    if (this._targetPart !== p) {
      el.innerHTML = `${p.label}<span class="tt-bar"><i style="width:${hp * 100}%"></i></span>`
      this._targetPart = p
    } else {
      el.querySelector('i').style.width = `${hp * 100}%`
    }
    el.classList.add('show')
  }

  damageFlash(amount, sourcePos) {
    const player = this.game.player
    const v = this.$('blood-screen')
    // red vignette pulse
    let pulse = document.getElementById('dmg-pulse')
    if (!pulse) {
      pulse = document.createElement('div')
      pulse.id = 'dmg-pulse'
      pulse.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 35%,rgba(150,5,8,.75) 100%);opacity:0;transition:opacity .45s ease-out'
      v.appendChild(pulse)
    }
    pulse.style.transition = 'none'
    pulse.style.opacity = String(clamp(0.35 + amount / 30, 0.35, 1))
    requestAnimationFrame(() => {
      pulse.style.transition = 'opacity .5s ease-out'
      pulse.style.opacity = '0'
    })

    if (Math.random() < 0.7) this.screenSplatter(clamp(0.32 + amount / 45, 0.3, 0.8))

    if (sourcePos) {
      const cam = player.camera
      const dx = sourcePos.x - cam.position.x
      const dz = sourcePos.z - cam.position.z
      const angle = Math.atan2(dx, -dz) - player.yaw
      const deg = (angle * 180 / Math.PI) % 360
      const d = document.createElement('div')
      d.className = 'dmg-dir'
      d.style.setProperty('--r', `${deg}deg`)
      this.$('damage-dirs').appendChild(d)
      setTimeout(() => d.remove(), 950)
    }
  }

  screenSplatter(opacity = 0.6) {
    const wrap = this.$('blood-screen')
    const el = document.createElement('div')
    el.className = 'blood-splat'
    const size = rand(140, 460)
    const top = rand(-8, 78)
    const left = Math.random() < 0.5 ? rand(-10, 26) : rand(58, 96)
    el.style.setProperty('--s', `${size}px`)
    el.style.setProperty('--r', `${rand(-40, 40)}deg`)
    el.style.setProperty('--o', String(opacity))
    el.style.top = `${top}%`
    el.style.left = `${left}%`
    wrap.appendChild(el)
    this.splatCount++
    setTimeout(() => { el.remove(); this.splatCount-- }, 1400)
    if (this.splatCount > 8) {
      const first = wrap.querySelector('.blood-splat')
      first?.remove()
    }
  }

  showDeathScreen() {
    this.$('death').classList.remove('hidden')
  }

  updatePauseStats(stats) {
    this.$('pause-wave').textContent = stats.wave
    this.$('pause-kills').textContent = stats.kills
    this.$('pause-score').textContent = stats.score.toLocaleString()
  }

  setSoundMuted(muted) {
    this.$('sound-on').classList.toggle('hidden', muted)
    this.$('sound-off').classList.toggle('hidden', !muted)
  }

  // ------------------------------------------------------------- touch
  initTouch() {
    this.mobile = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    this.game.mobile = this.mobile
    if (!this.mobile) return
    document.body.classList.add('touch')

    const zone = this.$('stick-zone')
    const knob = this.$('stick-knob')
    let stickId = null
    let base = null
    const maxR = 46
    const setStick = (x, y) => {
      knob.style.transform = `translate(${x}px,${y}px)`
      const p = this.game.player
      p.joystick.x = clamp(x / maxR, -1, 1)
      p.joystick.z = clamp(-y / maxR, -1, 1)
    }
    const resetStick = () => {
      stickId = null
      knob.style.transform = 'translate(0,0)'
      const p = this.game.player
      p.joystick.x = 0; p.joystick.z = 0
    }
    zone.addEventListener('pointerdown', e => {
      stickId = e.pointerId
      zone.setPointerCapture(e.pointerId)
      base = { x: e.clientX, y: e.clientY }
      setStick(0, 0)
      e.preventDefault()
    })
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== stickId || !base) return
      let dx = e.clientX - base.x, dy = e.clientY - base.y
      const l = Math.hypot(dx, dy)
      if (l > maxR) { dx = dx / l * maxR; dy = dy / l * maxR }
      setStick(dx, dy)
      e.preventDefault()
    })
    const up = e => { if (e.pointerId === stickId) resetStick() }
    zone.addEventListener('pointerup', up)
    zone.addEventListener('pointercancel', up)
    zone.addEventListener('lostpointercapture', up)

    // look drag on the canvas
    const canvas = this.game.canvas
    let lookId = null
    let lastX = 0, lastY = 0
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
      if (this.game.state !== 'playing') return
      if (lookId !== null) return
      lookId = e.pointerId
      lastX = e.clientX; lastY = e.clientY
      canvas.setPointerCapture?.(e.pointerId)
      e.preventDefault()
    })
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== lookId) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      lastX = e.clientX; lastY = e.clientY
      this.game.player.applyLook(dx * 1.85, dy * 1.85)
      e.preventDefault()
    })
    const lookUp = e => { if (e.pointerId === lookId) lookId = null }
    canvas.addEventListener('pointerup', lookUp)
    canvas.addEventListener('pointercancel', lookUp)
    canvas.addEventListener('lostpointercapture', lookUp)

    const attack = this.$('btn-attack')
    const sprint = this.$('btn-sprint')
    const dodge = this.$('btn-dodge')
    const press = (btn, down, up) => {
      btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); down() })
      btn.addEventListener('pointerup', e => { e.preventDefault(); e.stopPropagation(); up?.() })
      btn.addEventListener('pointercancel', e => { e.preventDefault(); up?.() })
      btn.addEventListener('pointerleave', e => { if (e.buttons) up?.() })
    }
    press(attack, () => {
      const p = this.game.player
      p.attackHeld = true
      p.startAttack()
    }, () => { this.game.player.attackHeld = false })
    press(sprint, () => { this.game.player.joystickSprint = true }, () => { this.game.player.joystickSprint = false })
    press(dodge, () => { this.game.player.dodge() })
  }
}
