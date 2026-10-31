import * as THREE from '../vendor/three.module.js'
import { clamp, damp, lerp, rand, TAU, roundedBox } from './utils.js'

const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _move = new THREE.Vector3()
const _camDir = new THREE.Vector3()

export class Player {
  constructor(game, scene, camera, canvas) {
    this.game = game
    this.scene = scene
    this.camera = camera
    this.canvas = canvas
    this.position = new THREE.Vector3(0, 0, 10.5)
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.pitch = -0.04
    this.roll = 0
    this.health = 100
    this.maxHealth = 100
    this.stamina = 100
    this.maxStamina = 100
    this.weapon = 'sword'
    this.attackHeld = false
    this.attackCooldown = 0
    this.swing = { active: false, t: 0, dur: 0.42, hitAt: 0.22, didHit: false, kind: 0 }
    this.dodgeT = 0
    this.dodgeCooldown = 0
    this.dodgeDir = new THREE.Vector3()
    this.invuln = 0
    this.bobPhase = 0
    this.bobAmt = 0
    this.sprintFov = 0
    this.shakeAmt = 0
    this.shakeTime = 0
    this.shakeDur = 0.001
    this.damageFlash = 0
    this.alive = true
    this.lookEnabled = false
    this.sensitivity = 0.0023
    this.moveInput = { x: 0, z: 0 }
    this.keyMove = { x: 0, z: 0 }
    this.joystick = { x: 0, z: 0 }
    this.sprintHeld = false
    this.joystickSprint = false
    this.dragging = false
    this.lastPointer = { x: 0, y: 0 }
    this.time = 0
    this.stepPhase = 0
    this.hitPulse = 0
    this.bloodiness = 0

    this._buildViewmodel()
    this._bindInput()
  }

  setWeapon(w) {
    this.weapon = w
    this.swordGroup.visible = w === 'sword'
    this.hammerGroup.visible = w === 'hammer'
    this.bloodiness = 0
  }

  reset() {
    this.position.set(0, 0, 10.5)
    this.velocity.set(0, 0, 0)
    this.yaw = 0; this.pitch = -0.04; this.roll = 0
    this.health = this.maxHealth
    this.stamina = this.maxStamina
    this.attackHeld = false
    this.attackCooldown = 0
    this.swing.active = false
    this.dodgeT = 0
    this.dodgeCooldown = 0
    this.invuln = 0
    this.alive = true
    this.shakeAmt = 0
    this.damageFlash = 0
    this.bloodiness = 0
    this._updateCamera(0)
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, this.maxHealth)
  }

  applyLook(dx, dy, sens = this.sensitivity) {
    if (!this.alive) return
    this.yaw -= dx * sens
    this.pitch -= dy * sens
    this.pitch = clamp(this.pitch, -1.32, 1.28)
    if (this.yaw > Math.PI) this.yaw -= TAU
    if (this.yaw < -Math.PI) this.yaw += TAU
  }

  shake(amount, duration = 0.28) {
    this.shakeAmt = Math.max(this.shakeAmt, amount)
    this.shakeDur = duration
    this.shakeTime = duration
  }

  damage(amount, sourcePos = null) {
    if (!this.alive || this.invuln > 0) return
    this.health -= amount
    this.invuln = 0.32
    this.damageFlash = 1
    this.shake(0.14, 0.3)
    this.game.audio.hurt(0)
    this.game.ui.damageFlash(amount, sourcePos)
    if (this.health <= 0) {
      this.health = 0
      this.alive = false
      this.game.onPlayerDeath()
    }
  }

  startAttack() {
    if (!this.alive || this.attackCooldown > 0 || this.game.state !== 'playing') return
    const isHammer = this.weapon === 'hammer'
    this.swing.active = true
    this.swing.t = 0
    this.swing.dur = isHammer ? 0.82 : 0.44
    this.swing.hitAt = isHammer ? 0.40 : 0.20
    this.swing.didHit = false
    this.swing.kind = isHammer ? 0 : (this.swing.kind ? 0 : 1)
    this.attackCooldown = isHammer ? 0.9 : 0.46
    this.game.audio.whoosh(0, isHammer)
    if (isHammer) this.shake(0.045, 0.18)
  }

  _bindInput() {
    window.addEventListener('keydown', e => {
      if (e.repeat) return
      const k = e.code
      if (k === 'KeyW' || k === 'ArrowUp') this.keyMove.z += 1
      if (k === 'KeyS' || k === 'ArrowDown') this.keyMove.z -= 1
      if (k === 'KeyA' || k === 'ArrowLeft') this.keyMove.x -= 1
      if (k === 'KeyD' || k === 'ArrowRight') this.keyMove.x += 1
      if (k === 'ShiftLeft' || k === 'ShiftRight') this.sprintHeld = true
      if (k === 'Space') { e.preventDefault(); this.dodge() }
    })
    window.addEventListener('keyup', e => {
      const k = e.code
      if (k === 'KeyW' || k === 'ArrowUp') this.keyMove.z -= 1
      if (k === 'KeyS' || k === 'ArrowDown') this.keyMove.z += 1
      if (k === 'KeyA' || k === 'ArrowLeft') this.keyMove.x += 1
      if (k === 'KeyD' || k === 'ArrowRight') this.keyMove.x -= 1
      if (k === 'ShiftLeft' || k === 'ShiftRight') this.sprintHeld = false
    })
    window.addEventListener('blur', () => {
      this.keyMove.x = 0; this.keyMove.z = 0; this.sprintHeld = false; this.attackHeld = false
    })

    const canvas = this.canvas
    document.addEventListener('mousemove', e => {
      if (!this.alive) return
      if (this.game.state !== 'playing') return
      if (document.pointerLockElement === canvas) {
        this.applyLook(e.movementX, e.movementY)
      } else if (this.dragging) {
        this.applyLook(e.clientX - this.lastPointer.x, e.clientY - this.lastPointer.y)
        this.lastPointer.x = e.clientX; this.lastPointer.y = e.clientY
      }
    })
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return
      if (this.game.state !== 'playing') return
      if (document.pointerLockElement !== canvas) {
        this.dragging = true
        this.lastPointer.x = e.clientX; this.lastPointer.y = e.clientY
        if (this.game.mobile) return
        if (!this.game.lockFallback) {
          this.game._lockPointer()
          return
        }
      }
      this.attackHeld = true
      this.startAttack()
    })
    window.addEventListener('mouseup', e => {
      if (e.button === 0) { this.dragging = false; this.attackHeld = false }
    })
    canvas.addEventListener('contextmenu', e => e.preventDefault())
  }

  dodge() {
    if (!this.alive || this.game.state !== 'playing' || this.dodgeCooldown > 0 || this.stamina < 26) return
    this.stamina -= 26
    this.dodgeCooldown = 0.75
    this.dodgeT = 0.2
    this.invuln = Math.max(this.invuln, 0.34)
    this._getMoveDir(_move)
    if (_move.lengthSq() < 0.01) {
      _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
      _move.copy(_forward)
    }
    this.dodgeDir.copy(_move).normalize()
    this.game.audio.whoosh(0, false)
  }

  _getMoveDir(out) {
    const x = clamp(this.keyMove.x + this.joystick.x, -1, 1)
    const z = clamp(this.keyMove.z + this.joystick.z, -1, 1)
    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    out.set(0, 0, 0).addScaledVector(_right, x).addScaledVector(_forward, z)
    if (out.lengthSq() > 1) out.normalize()
    return out
  }

  update(dt, world) {
    this.time += dt
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.invuln = Math.max(0, this.invuln - dt)
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt)
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2)
    this.hitPulse = Math.max(0, this.hitPulse - dt * 4)

    if (!this.alive) {
      // collapse camera
      this.camera.position.y = damp(this.camera.position.y, 0.45, 5, dt)
      this.camera.rotation.z = damp(this.camera.rotation.z, 1.25, 3, dt)
      return
    }

    const playing = this.game.state === 'playing'
    const move = this._getMoveDir(_move)
    const moving = move.lengthSq() > 0.01
    const wantSprint = (this.sprintHeld || this.joystickSprint) && moving && this.stamina > 4
    const sprint = wantSprint && playing
    const speed = sprint ? 8.2 : 5.1

    if (this.dodgeT > 0) {
      this.dodgeT -= dt
      this.velocity.copy(this.dodgeDir).multiplyScalar(12.5)
      this.velocity.y = 0
    } else if (playing) {
      this.velocity.x = damp(this.velocity.x, move.x * speed, 12, dt)
      this.velocity.z = damp(this.velocity.z, move.z * speed, 12, dt)
    } else {
      this.velocity.x = damp(this.velocity.x, 0, 8, dt)
      this.velocity.z = damp(this.velocity.z, 0, 8, dt)
    }

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    const b = this.game.world
    this.position.x = clamp(this.position.x, b.playerMinX, b.playerMaxX)
    this.position.z = clamp(this.position.z, b.playerMinZ, b.playerMaxZ)

    // stamina
    if (sprint) this.stamina = Math.max(0, this.stamina - 20 * dt)
    else this.stamina = Math.min(this.maxStamina, this.stamina + 14 * dt)

    // bob
    const spd = Math.hypot(this.velocity.x, this.velocity.z)
    const bobTarget = spd > 0.3 ? clamp(spd / 8, 0, 1) : 0
    this.bobAmt = damp(this.bobAmt, bobTarget, 8, dt)
    this.bobPhase += dt * (sprint ? 12.5 : 8.2) * clamp(spd / 5, 0.15, 1.5)
    this.stepPhase += dt * spd
    if (this.stepPhase > 2.2 && spd > 1) {
      this.stepPhase = 0
      this.game.audio.splat(rand(-0.25, 0.25), 0.16)
    }

    // attack timeline
    if (this.swing.active) {
      this.swing.t += dt
      if (!this.swing.didHit && this.swing.t >= this.swing.hitAt) {
        this.swing.didHit = true
        this.game.onPlayerSwing(this.weapon, this.swing)
      }
      if (this.swing.t >= this.swing.dur) this.swing.active = false
    }
    if (playing && this.attackHeld) this.startAttack()

    // FOV sprint
    const targetFov = 72 + (sprint ? 7 : 0) + (this.swing.active ? (this.weapon === 'hammer' ? 2.5 : 1.5) : 0)
    this.sprintFov = damp(this.sprintFov, targetFov, 6, dt)
    this.camera.fov = this.sprintFov
    this.camera.updateProjectionMatrix()

    this._updateCamera(dt)
    this._updateViewmodel(dt, spd, sprint)
    this._updateShake(dt)
  }

  _updateCamera(dt) {
    const bobY = Math.sin(this.bobPhase) * 0.035 * this.bobAmt
    const bobX = Math.cos(this.bobPhase * 0.5) * 0.025 * this.bobAmt
    this.camera.position.set(this.position.x + bobX, 1.68 + bobY, this.position.z)
    this.roll = damp(this.roll, -this.velocity.x * 0.0035, 6, dt)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = this.yaw
    this.camera.rotation.x = this.pitch
    this.camera.rotation.z = this.roll
  }

  _updateShake(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt
      const k = Math.max(0, this.shakeTime / this.shakeDur)
      const a = this.shakeAmt * k * k
      this.camera.rotation.x += rand(-a, a) * 0.4
      this.camera.rotation.y += rand(-a, a) * 0.4
      this.camera.rotation.z += rand(-a, a) * 0.6
      this.camera.position.y += rand(-a, a) * 0.2
      if (this.shakeTime <= 0) this.shakeAmt = 0
    }
  }

  // ------------------------------------------------------------- viewmodel
  _buildViewmodel() {
    this.vmScene = new THREE.Scene()
    this.vmCamera = new THREE.PerspectiveCamera(55, 1, 0.01, 5)
    this.vmCamera.position.set(0, 0, 0)

    const amb = new THREE.HemisphereLight(0xc8d4e8, 0x2a1710, 0.9)
    this.vmScene.add(amb)
    const key = new THREE.DirectionalLight(0xffd0a0, 3.0)
    key.position.set(-0.8, 1.0, -1.4)
    this.vmScene.add(key)
    const rim = new THREE.DirectionalLight(0xff6a3a, 2.2)
    rim.position.set(1.0, 0.4, -0.8)
    this.vmScene.add(rim)
    const bounce = new THREE.PointLight(0xffb070, 3.2, 3, 2)
    bounce.position.set(0.35, -0.1, -0.55)
    this.vmScene.add(bounce)

    this.weaponRoot = new THREE.Group()
    this.weaponRoot.position.set(0.47, -0.34, -0.86)
    this.vmScene.add(this.weaponRoot)
    this.baseWeaponPos = this.weaponRoot.position.clone()

    const leather = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.85 })
    const leatherDark = new THREE.MeshStandardMaterial({ color: 0x24150c, roughness: 0.95 })
    const skin = new THREE.MeshStandardMaterial({ color: 0xc08e6c, roughness: 0.72 })
    const steel = new THREE.MeshStandardMaterial({ color: 0xbfc7d2, metalness: 0.95, roughness: 0.24 })
    const steelDark = new THREE.MeshStandardMaterial({ color: 0x6e747c, metalness: 0.9, roughness: 0.34 })
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a15f, metalness: 0.85, roughness: 0.32 })
    const bloodMat = new THREE.MeshStandardMaterial({ color: 0x5e070a, roughness: 0.32 })
    this.bladeMat = steel
    this.bladeBloodMat = bloodMat
    this.goldMat = gold

    // ---- sword
    const sg = new THREE.Group()
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.19, 8), leather)
    grip.position.y = 0.02
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.13, 8), leatherDark)
    wrap.position.y = 0.02
    const pommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.042, 1), gold)
    pommel.position.y = -0.095
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.055), gold)
    guard.position.y = 0.125
    const guardTipL = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 4), gold)
    guardTipL.position.set(-0.13, 0.125, 0); guardTipL.rotation.z = Math.PI / 2
    const guardTipR = guardTipL.clone(); guardTipR.position.x = 0.13; guardTipR.rotation.z = -Math.PI / 2
    // blade with tip
    const bladeShape = new THREE.Shape()
    bladeShape.moveTo(-0.028, 0); bladeShape.lineTo(0.028, 0); bladeShape.lineTo(0.028, 0.78)
    bladeShape.lineTo(0, 0.9); bladeShape.lineTo(-0.028, 0.78); bladeShape.closePath()
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, steps: 1 })
    bladeGeo.center()
    const blade = new THREE.Mesh(bladeGeo, steel)
    blade.position.y = 0.59
    blade.rotation.z = Math.PI
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.68, 0.004), steelDark)
    fuller.position.set(0, 0.55, 0.009)
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.72, 0.014), steelDark)
    edge.position.set(-0.019, 0.55, 0)
    const bloodFilm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.019), bloodMat)
    bloodFilm.position.y = 0.56
    bloodFilm.scale.set(1, 0.001, 1)
    bloodFilm.visible = false
    this.swordBlood = bloodFilm
    const fist = new THREE.Mesh(roundedBox(0.075, 0.13, 0.08, 0.025, 0.8), leatherDark)
    fist.position.set(0, 0.015, 0.005)
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), leather)
    knuckle.position.set(0, 0.062, 0.025)
    const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.16, 2, 6), leather)
    wrist.position.set(0, -0.2, 0.02)
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.1, 7), leather)
    cuff.position.set(0, -0.27, 0.02)
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 3, 7), skin)
    forearm.position.set(0, -0.43, 0.02)
    sg.add(grip, wrap, pommel, guard, guardTipL, guardTipR, blade, fuller, edge, bloodFilm, fist, knuckle, wrist, cuff, forearm)
    sg.position.y = 0.1
    sg.rotation.set(-0.24, 0.08, -0.35)
    this.swordGroup = sg
    this.weaponRoot.add(sg)

    // ---- hammer
    const hg = new THREE.Group()
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.98, 8), leather)
    haft.position.y = 0.2
    const haftWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.22, 8), leatherDark)
    haftWrap.position.y = -0.08
    const headGeo = roundedBox(0.26, 0.17, 0.16, 0.035, 0.8)
    const head = new THREE.Mesh(headGeo, steelDark)
    head.position.y = 0.73
    const face1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.14), steel)
    face1.position.set(0.14, 0.73, 0)
    const face2 = face1.clone(); face2.position.x = -0.14
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.19, 0.18), gold)
    band1.position.set(0.105, 0.73, 0)
    const band2 = band1.clone(); band2.position.x = -0.105
    const butt = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 6), gold)
    butt.position.y = -0.33; butt.rotation.x = Math.PI
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 4), steel)
    spike.position.set(0, 0.87, 0)
    const hammerBlood = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.17), bloodMat)
    hammerBlood.position.y = 0.73
    hammerBlood.scale.set(1.02, 0.001, 1.02)
    hammerBlood.visible = false
    this.hammerBlood = hammerBlood
    const hfist = new THREE.Mesh(roundedBox(0.085, 0.15, 0.09, 0.028, 0.8), leatherDark)
    hfist.position.set(0, 0.04, 0.005)
    const hknuckle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), leather)
    hknuckle.position.set(0, 0.095, 0.03)
    const hwrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.18, 2, 6), leather)
    hwrist.position.set(0, -0.2, 0.02)
    const hcuff = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.072, 0.1, 7), leather)
    hcuff.position.set(0, -0.28, 0.02)
    const hforearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.34, 3, 7), skin)
    hforearm.position.set(0, -0.45, 0.02)
    hg.add(haft, haftWrap, head, face1, face2, band1, band2, butt, spike, hammerBlood, hfist, hknuckle, hwrist, hcuff, hforearm)
    hg.position.y = 0.06
    hg.rotation.set(-0.5, -0.12, 0.3)
    this.hammerGroup = hg
    this.hammerGroup.visible = false
    this.weaponRoot.add(hg)

    // slash arc
    const arcGeo = new THREE.RingGeometry(0.42, 0.62, 24, 1, 0.1, Math.PI * 0.86)
    const arcMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    this.slashArc = new THREE.Mesh(arcGeo, arcMat)
    this.slashArc.position.set(0.06, -0.02, -0.3)
    this.slashArc.rotation.z = -0.4
    this.slashArc.visible = false
    this.vmScene.add(this.slashArc)
    this.slashMat = arcMat
  }

  _updateViewmodel(dt, spd, sprint) {
    const t = this.time
    const bob = this.bobAmt
    const narrow = clamp((1.05 - this.camera.aspect) / 0.56, 0, 1)
    const baseX = 0.47 - narrow * 0.29
    const baseY = -0.34 - narrow * 0.05
    const baseZ = -0.86 + narrow * 0.01
    const swayX = Math.sin(t * 1.3) * 0.004 + Math.sin(this.bobPhase * 0.5) * 0.012 * bob
    const swayY = Math.sin(t * 1.7) * 0.004 + Math.cos(this.bobPhase) * 0.016 * bob
    const spr = sprint ? 0.6 : 0
    let px = baseX + swayX, py = baseY + swayY, pz = baseZ
    let rx = -0.05, ry = 0.03, rz = 0
    const sc = 1 - narrow * 0.24

    if (this.weapon === 'sword') {
      rx = -0.22 - spr * 0.2
      ry = 0.16
      rz = 0.36
      pz = baseZ + 0.02 - spr * 0.05
    } else {
      rx = -0.5 - spr * 0.1
      ry = -0.12
      rz = 0.3
      pz = baseZ - spr * 0.03
    }

    const s = this.swing
    if (s.active) {
      const k = clamp(s.t / s.dur, 0, 1)
      const isHammer = this.weapon === 'hammer'
      if (isHammer) {
        // windup, slam, recover
        const wind = clamp(k / 0.42, 0, 1)
        const slam = clamp((k - 0.42) / 0.2, 0, 1)
        const rec = clamp((k - 0.62) / 0.38, 0, 1)
        const lift = Math.sin(wind * Math.PI * 0.5)
        const down = Math.sin(slam * Math.PI * 0.5)
        rx = lerp(-0.5, -1.85, lift) + down * 2.2 - rec * 0.5
        py = baseY + lift * 0.32 - down * 0.3 + rec * 0.16
        pz = baseZ + lift * 0.06 - down * 0.22 + rec * 0.1
        px = baseX - lift * 0.08 + down * 0.05
        rz = 0.3 - lift * 0.3 + down * 0.2
        if (slam > 0) {
          this.shake(0.02, 0.1)
        }
      } else {
        const sign = s.kind === 0 ? 1 : -1
        const wind = clamp(k / 0.26, 0, 1)
        const cut = clamp((k - 0.26) / 0.22, 0, 1)
        const rec = clamp((k - 0.48) / 0.52, 0, 1)
        const lift = Math.sin(wind * Math.PI * 0.5)
        const slash = Math.sin(cut * Math.PI * 0.5)
        rx = -0.22 - lift * 0.45 + slash * 0.6 - rec * 0.1
        ry = 0.16 + sign * (lift * 0.8 - slash * 1.5 + rec * 0.6)
        rz = 0.36 + sign * (lift * 0.9 - slash * 2.0 + rec * 0.9)
        px = baseX + sign * (lift * 0.12 - slash * 0.2 + rec * 0.06)
        py = baseY + lift * 0.12 - slash * 0.08
        pz = baseZ + 0.02 + slash * 0.12
        // slash trail
        this.slashArc.visible = cut > 0 && cut < 1
        this.slashMat.opacity = Math.sin(cut * Math.PI) * 0.45
        this.slashArc.rotation.z = -0.4 + sign * (cut * 2.2 - 1.0)
        this.slashArc.position.x = 0.04 + sign * cut * 0.1
      }
    } else {
      this.slashArc.visible = false
      if (this.weapon === 'hammer') this.slashArc.visible = false
    }

    this.weaponRoot.position.set(px, py, pz)
    this.weaponRoot.rotation.set(rx, ry, rz)
    this.weaponRoot.scale.setScalar(sc * (this.weapon === 'sword' ? 0.31 : 0.38))

    // blood build-up on blade
    if (this.bloodiness > 0) {
      const on = this.weapon === 'sword' ? this.swordBlood : this.hammerBlood
      on.visible = true
      on.scale.y = clamp(this.bloodiness, 0.001, 1)
      on.material.color.setRGB(0.36, 0.03, 0.04)
    } else {
      this.swordBlood.visible = false
      this.hammerBlood.visible = false
    }
    this.hammerGroup.visible = this.weapon === 'hammer'
  }

  addBloodOnWeapon(amount = 0.2) {
    this.bloodiness = clamp(this.bloodiness + amount, 0, 1)
  }

  getWorldDirection(out) {
    return this.camera.getWorldDirection(out)
  }

  renderViewModel(renderer) {
    this.vmCamera.aspect = this.camera.aspect
    this.vmCamera.updateProjectionMatrix()
    const prev = renderer.autoClear
    renderer.autoClear = false
    renderer.clearDepth()
    renderer.render(this.vmScene, this.vmCamera)
    renderer.autoClear = prev
  }
}
