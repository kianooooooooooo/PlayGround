import * as THREE from '../vendor/three.module.js'
import { World } from './world.js'
import { Player } from './player.js'
import { EnemyManager } from './enemy.js'
import { GoreSystem } from './gore.js'
import { AudioEngine } from './audio.js'
import { UI } from './ui.js'
import { clamp, damp, lerp, rand, roman, TAU } from './utils.js'

class Game {
  constructor() {
    this.canvas = document.getElementById('game')
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
    this.renderer.setSize(innerWidth, innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.055, 220)
    this.camera.rotation.order = 'YXZ'

    this.state = 'menu'
    this.mobile = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    this.time = 0
    this.wave = 0
    this.kills = 0
    this.score = 0
    this.combo = 0
    this.comboTimer = 0
    this.bestCombo = 0
    this.weapon = 'sword'
    this.timeScale = 1
    this.hitStop = 0
    this.waveQueue = []
    this.spawnTimer = 1
    this.intermissionT = 0
    this.aimTimer = 0
    this.menuAngle = 0.4
    this.lockFallback = false
    this._lockTimer = 0
    this.stats = { wave: 1, enemies: 0, kills: 0, score: 0, crowd: 0.1, health: 100, stamina: 100, cd: 0, weapon: 'sword' }

    this.audio = new AudioEngine()
    this.world = new World(this.scene, this.renderer)
    Object.assign(this.world, { playerMinX: -12.35, playerMaxX: 12.35, playerMinZ: -16.1, playerMaxZ: 16.25 })
    this.gore = new GoreSystem(this.scene, this.world, this.audio)
    this.player = new Player(this, this.scene, this.camera, this.canvas)
    this.enemies = new EnemyManager(this, this.scene, this.gore)
    this.ui = new UI(this)
    this.ui.initTouch()
    this.ui.setWeapon(this.weapon)
    this.ui.showHUD(false)
    this.ui.showMobile(false)

    this._bind()
    this._cinematicCamera(0)
    this.clock = new THREE.Clock()
    requestAnimationFrame(() => this._loop())
    setTimeout(() => {
      const l = document.getElementById('loading')
      l.classList.add('done')
      setTimeout(() => l.remove(), 800)
    }, 250)
  }

  _bind() {
    addEventListener('resize', () => this._resize())
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas
      if (locked) this.lockFallback = false
      if (this.state === 'playing' && !this.mobile && !locked) {
        this.pause()
      }
    })
    document.addEventListener('pointerlockerror', () => {
      this.lockFallback = true
      clearTimeout(this._lockTimer)
    })
    addEventListener('keydown', e => {
      if (e.repeat) return
      if (e.code === 'KeyM') this.toggleMute()
      if (e.code === 'KeyP') {
        if (this.state === 'playing') this.pause()
        else if (this.state === 'paused') this.resume()
      }
      if (e.code === 'Escape') {
        if (this.state === 'playing') this.pause()
      }
    })
    addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause()
    })
    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !this.mobile && document.pointerLockElement !== this.canvas) {
        this._lockPointer()
      }
    })
  }

  _lockPointer() {
    clearTimeout(this._lockTimer)
    this._lockTimer = setTimeout(() => {
      if (this.state === 'playing' && document.pointerLockElement !== this.canvas) this.lockFallback = true
    }, 800)
    try {
      const p = this.canvas.requestPointerLock?.()
      if (p?.catch) p.catch(() => { this.lockFallback = true })
    } catch { this.lockFallback = true }
  }

  _resize() {
    this.camera.aspect = innerWidth / innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.6 : 2))
    this.renderer.setSize(innerWidth, innerHeight)
  }

  selectWeapon(w) {
    this.weapon = w
    this.player.setWeapon(w)
    this.ui.setWeapon(w)
    this.stats.weapon = w
  }

  startRun() {
    this.audio.init()
    this.audio.resume()
    this.audio.ui()
    if (!this.mobile) this._lockPointer()
    this.ui.showMenu(false)
    this.ui.showDeath(false)
    this.ui.showPause(false)
    this.ui.showHUD(true)
    this.ui.showMobile(this.mobile)
    this.enemies.clearAll()
    this.gore.reset()
    this.player.reset()
    this.player.setWeapon(this.weapon)
    this.kills = 0
    this.score = 0
    this.combo = 0
    this.bestCombo = 0
    this.comboTimer = 0
    this.wave = 0
    this.state = 'playing'
    this.world.crowdTarget = 0.16
    this.startWave(1)
    this.ui.toast(this.mobile
      ? (this.weapon === 'sword'
          ? 'DRAG TO LOOK · TAP ◈ TO SWING — CUT LIMBS, HEADS AND GUTS'
          : 'DRAG TO LOOK · TAP ◈ TO SWING — BURST SKULLS, BREAK BONE')
      : (this.weapon === 'sword'
          ? 'LMB TO SWING — CUT LIMBS, HEADS AND GUTS TO FEED THE CROWD'
          : 'LMB TO SWING — BREAK BONE, BURST SKULLS, RIP JAWS'), 5200)
  }

  restart() {
    this.ui.showDeath(false)
    this.startRun()
  }

  quitToMenu() {
    this.state = 'menu'
    this.enemies.clearAll()
    this.gore.reset()
    this.player.attackHeld = false
    this.player.alive = true
    this.player.health = this.player.maxHealth
    this.ui.showMenu(true)
    this.ui.showDeath(false)
    this.ui.showPause(false)
    this.ui.showHUD(false)
    this.ui.showMobile(false)
    this.ui.hideBanner()
    this.world.crowdTarget = 0.05
    this.audio.setCrowd(0.05)
    if (document.pointerLockElement) document.exitPointerLock()
  }

  pause() {
    if (this.state !== 'playing') return
    this.state = 'paused'
    this.player.attackHeld = false
    this.ui.updatePauseStats({ wave: roman(this.wave), kills: this.kills, score: this.score })
    this.ui.showPause(true)
    this.ui.showMobile(false)
    if (document.pointerLockElement) document.exitPointerLock()
    this.audio.setCrowd(0.05)
  }

  resume() {
    if (this.state !== 'paused') return
    this.state = 'playing'
    this.ui.showPause(false)
    this.ui.showMobile(this.mobile)
    this.audio.resume()
    if (!this.mobile) this._lockPointer()
  }

  togglePause() {
    if (this.state === 'playing') this.pause()
    else if (this.state === 'paused') this.resume()
  }

  toggleMute() {
    this.muted = !this.muted
    this.audio.setMuted(this.muted)
    this.ui.setSoundMuted(this.muted)
    if (this.audio.ready) this.audio.ui()
  }

  startWave(n) {
    this.wave = n
    this.state = 'playing'
    this.waveQueue = this._waveComposition(n)
    this.spawnTimer = 0.55
    this.enemies.difficulty = n - 1
    this.world.cheer(0.7)
    this.audio.waveStart()
    const count = this.waveQueue.length
    this.ui.banner(`WAVE ${roman(n)}`, `${count} FIGHTER${count === 1 ? '' : 'S'} — SURVIVE`, n === 1 ? 'THE GATES OPEN' : 'THE CROWD DEMANDS MORE', 2600)
    if (n > 1) {
      this.player.heal(18)
      this.ui.toast(`WAVE CLEARED — VITALITY RESTORED`, 2400)
    }
  }

  _waveComposition(n) {
    const count = Math.min(3 + n * 2, 16)
    const q = []
    for (let i = 0; i < count; i++) {
      let type = 'raider'
      if (n >= 2 && i % 4 === 2) type = 'gladiator'
      if (n >= 4 && i % 6 === 5) type = 'brute'
      if (n >= 6 && i % 5 === 3) type = 'gladiator'
      if (n >= 7 && i % 7 === 6) type = 'brute'
      q.push(type)
    }
    return q
  }

  completeWave() {
    if (this.state !== 'playing') return
    this.state = 'intermission'
    this.intermissionT = 5.4
    this.score += 250 * this.wave
    this.world.cheer(1.4)
    this.audio.cheer(1)
    this.player.heal(14)
    this.gore.fadeOut(2.2)
    this.ui.banner('WAVE CLEARED', 'THE SAND IS SWEPT CLEAN — THE GATES WILL OPEN AGAIN', 'THE CROWD ROARS', 3600)
    this.ui.toast(`WAVE BONUS +${(250 * this.wave).toLocaleString()}`, 2800)
  }

  update(dt) {
    this.time += dt
    this.ui.setStats({
      wave: roman(Math.max(1, this.wave)),
      enemies: this.enemies.aliveCount + this.waveQueue.length,
      kills: this.kills,
      score: this.score,
      crowd: clamp(this.world.crowdTarget, 0, 1),
      health: this.player.health,
      stamina: this.player.stamina,
      cd: this.player.attackCooldown / (this.weapon === 'hammer' ? 0.9 : 0.46),
      weapon: this.weapon
    })
    this.audio.setCrowd(this.world.crowdTarget)
    this.audio.update(dt)
    this.world.update(dt, this.camera)
    this.gore.update(dt)

    // combos
    if (this.comboTimer > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) this.combo = 0
    }

    if (this.state === 'menu') {
      this._cinematicCamera(dt)
      return
    }
    if (this.state === 'paused') return

    if (this.state === 'dead') {
      this.player.update(dt, this.world)
      return
    }

    this.player.update(dt, this.world)

    if (this.state === 'playing' || this.state === 'intermission') {
      this.enemies.update(dt, this.player)
    }

    if (this.state === 'playing') {
      // spawn queue
      if (this.waveQueue.length) {
        this.spawnTimer -= dt
        const maxAlive = Math.min(3 + Math.floor(this.wave / 2), 7)
        if (this.spawnTimer <= 0 && this.enemies.aliveCount < maxAlive) {
          const type = this.waveQueue.shift()
          const e = this.enemies.spawn(type)
          e.health *= 1 + (this.wave - 1) * 0.055
          e.maxHealth = e.health
          this.spawnTimer = rand(0.75, 1.4)
        }
      }
      if (!this.waveQueue.length && this.enemies.aliveCount === 0) {
        this.completeWave()
      }
      // target readout
      this.aimTimer -= dt
      if (this.aimTimer <= 0) {
        this.aimTimer = 0.09
        const dir = this.camera.getWorldDirection(new THREE.Vector3())
        const info = this.enemies.targetInfo(this.camera.position, dir, 3.2)
        this.ui.target(info)
      }
    } else if (this.state === 'intermission') {
      this.ui.target(null)
      this.intermissionT -= dt
      this.player.heal(dt * 2)
      if (this.intermissionT <= 0) {
        this.gore.reset()
        this.enemies.clearAll()
        this.startWave(this.wave + 1)
      }
    }
  }

  _cinematicCamera(dt) {
    this.menuAngle += dt * 0.075
    const a = this.menuAngle
    const r = 11.5
    const x = Math.sin(a) * r
    const z = 2 + Math.cos(a) * r
    this.camera.position.set(x, 4.0 + Math.sin(a * 0.7) * 0.5, z)
    this.camera.lookAt(0, 1.45, -3)
    this.camera.fov = 60
    this.camera.updateProjectionMatrix()
  }

  onPlayerSwing(weapon, swing) {
    if (this.state !== 'playing') return
    const dir = this.camera.getWorldDirection(new THREE.Vector3())
    const origin = this.camera.position.clone()
    const result = this.enemies.attack(weapon, origin, dir)
    let any = false
    if (result.hits.length) {
      any = this.enemies.applyHits(result.hits, weapon, dir, this.player)
      if (any) {
        this.ui.hitmarker(weapon === 'hammer')
        this.player.addBloodOnWeapon(weapon === 'hammer' ? 0.25 : 0.32)
        this.player.shake(weapon === 'hammer' ? 0.16 : 0.045, weapon === 'hammer' ? 0.3 : 0.12)
        this.hitStop = Math.max(this.hitStop, weapon === 'hammer' ? 0.065 : 0.035)
        if (Math.random() < 0.32) this.ui.screenSplatter(rand(0.18, 0.4))
      }
    }
    if (weapon === 'hammer') {
      const p = any && result.point ? result.point.clone() : new THREE.Vector3(origin.x + dir.x * 1.75, 0.03, origin.z + dir.z * 1.75)
      p.y = Math.min(p.y, 0.1)
      this.gore.shockwave(p, 0xffc07a, 3.2, 0.55)
      this.gore.dustPuff(p, 10, 0xa88d68)
      this.player.shake(0.1, 0.32)
      this.audio.flesh(0.6, 0, false)
      if (!any) {
        this.hitStop = Math.max(this.hitStop, 0.05)
        this.ui.toast('THE SAND TAKES THE BLOW', 900)
      }
    }
  }

  onEnemyKilled(enemy, cause) {
    this.kills++
    this.combo++
    this.comboTimer = 3.2
    this.bestCombo = Math.max(this.bestCombo, this.combo)
    const base = 100 + this.wave * 15
    let bonus = 0
    let verb = 'SLAIN'
    if (cause === 'head') { bonus = 90; verb = enemy.lastWeapon === 'hammer' ? 'SKULL BURST' : 'SKULL SPLIT' }
    else if (cause === 'bisect') { bonus = 170; verb = 'CLEAVED IN TWO' }
    else if (cause === 'chest') { bonus = 140; verb = 'CHEST CAVED IN' }
    else if (cause === 'vital') { bonus = 0; verb = 'SLAIN' }
    this.score += base + bonus
    const gore = cause === 'head' || cause === 'bisect' || cause === 'chest'
    this.world.cheer(gore ? 1.15 : 0.78)
    this.audio.cheer(gore ? 1 : 0.75)
    this.ui.killFeed(`YOU <em>${verb}</em> A ${enemy.type.label} <b>+${base + bonus}</b>`)
    if (this.combo >= 2) this.ui.combo(this.combo, this.combo >= 5 ? 'THE CROWD IS FERAL' : 'KILL STREAK')
    if (gore) {
      this.ui.screenSplatter(rand(0.28, 0.5))
      this.player.shake(0.06, 0.25)
    }
    const d = enemy.root.position.distanceTo(this.player.position)
    if (d < 3) this.ui.screenSplatter(rand(0.35, 0.75))
  }

  onDismember(enemy, part) {
    this.score += 45
    this.world.cheer(0.5)
    this.audio.cheer(0.55)
    const label = part.kind === 'head' ? 'HEAD DESTROYED' : part.kind === 'jaw' ? 'JAW TORN OFF' : `${part.label} SEVERED`
    this.ui.toast(label, 1400)
    this.ui.killFeed(`<em>${label}</em> — ${enemy.type.label} <b>+45</b>`, 2400)
    this.player.addBloodOnWeapon(0.12)
  }

  onFracture(enemy, part) {
    this.score += 30
    this.world.cheer(0.35)
    this.ui.toast(`${part.label} SHATTERED — BONE EXPOSED`, 1300)
    this.ui.killFeed(`<em>BONE BROKEN</em> — ${enemy.type.label} <b>+30</b>`, 2200)
    this.player.addBloodOnWeapon(0.1)
  }

  onPlayerDeath() {
    if (this.state === 'dead') return
    this.state = 'dead'
    this.player.attackHeld = false
    this.world.crowdTarget = 0.03
    this.audio.boo()
    this.audio.setCrowd(0.03)
    this.ui.target(null)
    if (document.pointerLockElement) document.exitPointerLock()
    setTimeout(() => {
      if (this.state !== 'dead') return
      this.ui.showDeathStats({ wave: roman(this.wave), kills: this.kills, score: this.score, bestCombo: this.bestCombo })
      this.ui.showMobile(false)
    }, 1500)
  }

  render() {
    this.renderer.render(this.scene, this.camera)
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'intermission') {
      this.player.renderViewModel(this.renderer)
    }
  }

  _loop() {
    requestAnimationFrame(() => this._loop())
    let dt = Math.min(this.clock.getDelta(), 0.05)
    if (this.hitStop > 0) {
      this.hitStop -= dt
      dt *= 0.12
    }
    if (this.state === 'dead') dt *= 0.45
    this.update(dt)
    this.render()
  }
}

window.__bloodpit = new Game()
