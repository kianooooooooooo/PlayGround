import * as THREE from '../vendor/three.module.js'
import {
  roundedBox, rand, randInt, choice, clamp, lerp, damp, TAU
} from './utils.js'
import { ARENA } from './world.js'

const GEO = {
  head: new THREE.SphereGeometry(0.145, 16, 12),
  jaw: roundedBox(0.15, 0.07, 0.12, 0.022, 0.7),
  chest: roundedBox(0.5, 0.44, 0.3, 0.07, 0.8),
  belly: roundedBox(0.4, 0.32, 0.27, 0.055, 0.8),
  neck: new THREE.CylinderGeometry(0.072, 0.085, 0.13, 8),
  upperArm: new THREE.CapsuleGeometry(0.06, 0.22, 3, 7),
  lowerArm: new THREE.CapsuleGeometry(0.05, 0.22, 3, 7),
  hand: new THREE.SphereGeometry(0.062, 8, 6),
  thigh: new THREE.CapsuleGeometry(0.075, 0.3, 3, 7),
  shin: new THREE.CapsuleGeometry(0.06, 0.3, 3, 7),
  foot: roundedBox(0.13, 0.09, 0.25, 0.025, 0.7),
  eye: new THREE.SphereGeometry(0.018, 6, 5),
  tooth: new THREE.BoxGeometry(0.018, 0.026, 0.014),
  shoulderPad: roundedBox(0.19, 0.1, 0.24, 0.04, 0.8),
  belt: new THREE.BoxGeometry(0.43, 0.07, 0.29),
  buckle: new THREE.BoxGeometry(0.08, 0.08, 0.03),
  bracer: new THREE.CylinderGeometry(0.062, 0.056, 0.11, 7),
  shinGuard: roundedBox(0.1, 0.2, 0.05, 0.02, 0.7),
  helmet: new THREE.SphereGeometry(0.16, 14, 8, 0, TAU, 0, Math.PI * 0.58),
  crest: new THREE.BoxGeometry(0.035, 0.1, 0.3),
  mask: roundedBox(0.15, 0.17, 0.05, 0.025, 0.7),
  horn: new THREE.ConeGeometry(0.028, 0.15, 5),
  hair: new THREE.SphereGeometry(0.152, 12, 8, 0, TAU, 0, Math.PI * 0.4),
  beard: roundedBox(0.15, 0.1, 0.08, 0.03, 0.7),
  hitHead: new THREE.SphereGeometry(0.185, 8, 6),
  hitJaw: new THREE.BoxGeometry(0.18, 0.1, 0.15),
  hitTorso: new THREE.BoxGeometry(0.56, 0.5, 0.36),
  hitBelly: new THREE.BoxGeometry(0.46, 0.38, 0.32),
  hitUpperArm: new THREE.CapsuleGeometry(0.085, 0.24, 2, 5),
  hitLowerArm: new THREE.CapsuleGeometry(0.072, 0.22, 2, 5),
  hitThigh: new THREE.CapsuleGeometry(0.1, 0.32, 2, 5),
  hitShin: new THREE.CapsuleGeometry(0.085, 0.3, 2, 5)
}

const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false })

export const ENEMY_TYPES = {
  raider: {
    label: 'RAIDER', health: 100, speed: 3.15, damage: 8, reach: 1.72, scale: 1.0,
    attackCooldown: 1.55, windup: 0.4, weapon: 'club', palette: {
      cloth: 0x6e4a31, leather: 0x4a2e1c, metal: 0x7a746a, hair: 0x2c1a11
    }
  },
  gladiator: {
    label: 'GLADIATOR', health: 138, speed: 3.45, damage: 12, reach: 1.8, scale: 1.02,
    attackCooldown: 1.35, windup: 0.36, weapon: 'sword', helmet: true, palette: {
      cloth: 0x87322b, leather: 0x54331f, metal: 0xa0a0a8, hair: 0x241812
    }
  },
  brute: {
    label: 'BRUTE', health: 215, speed: 2.35, damage: 18, reach: 1.95, scale: 1.18,
    attackCooldown: 2.0, windup: 0.55, weapon: 'hammer', mask: true, palette: {
      cloth: 0x4c382b, leather: 0x3a2417, metal: 0x77726b, hair: 0x1d130d
    }
  }
}

let enemyId = 0

export class Enemy {
  constructor(manager, typeName, x, z) {
    this.manager = manager
    this.game = manager.game
    this.scene = manager.scene
    this.gore = manager.gore
    this.id = ++enemyId
    this.typeName = typeName
    this.type = ENEMY_TYPES[typeName]
    this.health = this.type.health
    this.maxHealth = this.health
    this.dead = false
    this.cause = null
    this.deathT = 0
    this.deathDir = 1
    this.aliveTime = 0
    this.walkPhase = rand(0, TAU)
    this.speed = 0
    this.yaw = 0
    this.targetYaw = 0
    this.attackCooldown = rand(0.4, 1.1)
    this.attackT = -1
    this.attackHitDone = false
    this.staggerT = 0
    this.flash = 0
    this.crawl = false
    this.crawlAmt = 0
    this.weaponDropped = false
    this.bloodMarks = 0
    this.hitPower = 1
    this.offset = rand(0, TAU)
    this.strafe = choice([-1, 1])
    this.cutTorso = 0
    this.boneSpikes = []
    this.limbsLost = 0
    this._build(x, z)
  }

  _mat(color, extra = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02, ...extra })
    this.materials.push(m)
    return m
  }

  _build(x, z) {
    this.materials = []
    const p = this.type.palette
    const skinCol = choice([0xc79a78, 0xb98a68, 0xa87a59, 0xd0a582, 0x9a6c4d])
    this.skinCol = skinCol
    const mats = this.mats = {
      skin: this._mat(skinCol, { roughness: 0.7 }),
      cloth: this._mat(p.cloth, { roughness: 0.92 }),
      leather: this._mat(p.leather, { roughness: 0.86 }),
      metal: this._mat(p.metal, { metalness: 0.82, roughness: 0.35 }),
      hair: this._mat(p.hair, { roughness: 0.95 }),
      eye: this._mat(0x0a0706, { roughness: 0.4 }),
      tooth: this._mat(0xd8cbb0, { roughness: 0.5 }),
      mouth: this._mat(0x3a0809, { roughness: 0.5 }),
      bone: this._mat(0xd8cba8, { roughness: 0.5 })
    }

    const root = this.root = new THREE.Group()
    root.position.set(x, 0, z)
    root.scale.setScalar(this.type.scale)
    this.scene.add(root)

    const hips = this.hips = new THREE.Group()
    hips.position.y = 1.0
    root.add(hips)

    const torsoUpper = this.torsoUpper = new THREE.Group()
    torsoUpper.position.y = 0.25
    hips.add(torsoUpper)
    const neck = this.neck = new THREE.Group()
    neck.position.y = 0.43
    torsoUpper.add(neck)

    this.parts = {}
    this.hitMeshes = []

    const mk = (geo, mat, x2, y2, z2, parent) => {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x2, y2, z2)
      m.castShadow = true
      m.receiveShadow = true
      parent.add(m)
      return m
    }

    // lower torso
    const belly = mk(GEO.belly, this.typeName === 'brute' ? mats.skin : mats.cloth, 0, 0.06, 0, hips)
    const belt = mk(GEO.belt, mats.leather, 0, 0.24, 0, hips)
    const buckle = mk(GEO.buckle, mats.metal, 0, 0.24, 0.152, hips)
    // loincloth
    const loin = mk(roundedBox(0.25, 0.3, 0.035, 0.02, 0.5), mats.cloth, 0, -0.08, 0.148, hips)
    loin.rotation.x = -0.08
    const loinBack = mk(roundedBox(0.28, 0.26, 0.035, 0.02, 0.5), mats.cloth, 0, -0.06, -0.145, hips)
    this.parts.torsoLower = this._part('torsoLower', 'GUTS', hips, belly, 112, 0.46, 'torso', GEO.hitBelly, 0, 0.06, 0)
    this.parts.torsoLower.decor = [belt, buckle, loin, loinBack]

    // upper torso
    const chestMat = this.typeName === 'raider' || this.typeName === 'gladiator' ? mats.cloth : mats.skin
    const chest = mk(GEO.chest, chestMat, 0, 0.17, 0, torsoUpper)
    // straps
    const strap1 = mk(roundedBox(0.09, 0.46, 0.035, 0.01, 0.5), mats.leather, -0.09, 0.17, 0.16, torsoUpper)
    strap1.rotation.z = 0.35
    const strap2 = mk(roundedBox(0.09, 0.46, 0.035, 0.01, 0.5), mats.leather, 0.11, 0.17, 0.158, torsoUpper)
    strap2.rotation.z = -0.25
    if (this.typeName === 'gladiator') {
      const armor = mk(roundedBox(0.43, 0.3, 0.06, 0.03, 0.7), mats.metal, 0, 0.17, 0.17, torsoUpper)
      armor.scale.z = 0.6
    }
    this.parts.torsoUpper = this._part('torsoUpper', 'CHEST', torsoUpper, chest, 128, 0.52, 'torso', GEO.hitTorso, 0, 0.17, 0)

    // neck
    mk(GEO.neck, mats.skin, 0, 0.02, 0, neck)

    // head
    const skull = this.skull = new THREE.Group()
    skull.position.set(0, 0.135, 0)
    neck.add(skull)
    const headMesh = mk(GEO.head, mats.skin, 0, 0, 0, skull)
    headMesh.scale.set(0.95, 1.08, 0.98)
    // eyes and brow
    for (const sx of [-1, 1]) {
      const eye = mk(GEO.eye, mats.eye, sx * 0.052, 0.018, 0.123, skull)
      eye.castShadow = false
    }
    const nose = mk(new THREE.ConeGeometry(0.02, 0.05, 4), mats.skin, 0, -0.015, 0.14, skull)
    nose.rotation.x = Math.PI / 2
    // hair / helmet / mask
    if (this.type.helmet) {
      const helm = mk(GEO.helmet, mats.metal, 0, 0.025, -0.005, skull)
      helm.rotation.x = -0.06
      const crest = mk(GEO.crest, mats.metal, 0, 0.14, -0.02, skull)
      const brim = mk(new THREE.TorusGeometry(0.15, 0.014, 4, 14, Math.PI * 2), mats.metal, 0, 0.045, 0, skull)
      brim.rotation.x = Math.PI / 2
    } else if (this.type.mask) {
      const mask = mk(GEO.mask, mats.metal, 0, -0.005, 0.12, skull)
      for (const sx of [-1, 1]) {
        const horn = mk(GEO.horn, mats.metal, sx * 0.13, 0.06, 0.01, skull)
        horn.rotation.z = sx * 0.9
      }
      const brow = mk(new THREE.BoxGeometry(0.2, 0.03, 0.04), mats.metal, 0, 0.07, 0.14, skull)
    } else {
      const hair = mk(GEO.hair, mats.hair, 0, 0.035, -0.012, skull)
      hair.rotation.x = -0.18
    }
    this.parts.head = this._part('head', 'HEAD', skull, headMesh, 104, 0.85, 'head', GEO.hitHead, 0, 0.01, 0)

    // jaw
    const jaw = this.jaw = new THREE.Group()
    jaw.position.set(0, 0.015, 0.072)
    skull.parent.add(jaw)
    const jawMesh = mk(GEO.jaw, mats.skin, 0, 0, 0.035, jaw)
    const mouth = mk(new THREE.BoxGeometry(0.11, 0.012, 0.012), mats.mouth, 0, 0.002, 0.09, jaw)
    for (let i = -2; i <= 2; i++) {
      const tooth = mk(GEO.tooth, mats.tooth, i * 0.022, 0.03, 0.095, jaw)
      tooth.castShadow = false
    }
    if (!this.type.mask && !this.type.helmet) {
      const beard = mk(GEO.beard, mats.hair, 0, -0.04, 0.03, jaw)
      beard.scale.set(1.02, 1.15, 1)
    }
    this.parts.jaw = this._part('jaw', 'JAW', jaw, jawMesh, 42, 0.32, 'jaw', GEO.hitJaw, 0, 0.01, 0.04)

    // arms
    this.rig = { shoulders: {}, elbows: {}, hands: {}, hips: {}, knees: {}, feet: {} }
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? -1 : 1
      const shoulder = new THREE.Group()
      shoulder.position.set(sx * 0.3, 0.32, 0)
      torsoUpper.add(shoulder)
      this.rig.shoulders[side] = shoulder
      const upper = mk(GEO.upperArm, mats.skin, 0, -0.18, 0, shoulder)
      // shoulder pad
      const pad = mk(GEO.shoulderPad, this.typeName === 'gladiator' ? mats.metal : mats.leather, sx * 0.01, 0.02, 0, shoulder)
      pad.rotation.z = sx * 0.12
      const elbow = new THREE.Group()
      elbow.position.y = -0.38
      shoulder.add(elbow)
      this.rig.elbows[side] = elbow
      const lower = mk(GEO.lowerArm, mats.skin, 0, -0.17, 0, elbow)
      const bracer = mk(GEO.bracer, mats.leather, 0, -0.16, 0, elbow)
      const hand = new THREE.Group()
      hand.position.y = -0.35
      elbow.add(hand)
      this.rig.hands[side] = hand
      mk(GEO.hand, mats.skin, 0, -0.01, 0, hand)
      const upperPart = this._part(`arm${side}`, side === 'L' ? 'LEFT ARM' : 'RIGHT ARM', shoulder, upper, 62, 0.18, 'arm', GEO.hitUpperArm, 0, -0.18, 0)
      upperPart.side = side
      const lowerPart = this._part(`arm${side}Lower`, side === 'L' ? 'LEFT FOREARM' : 'RIGHT FOREARM', elbow, lower, 48, 0.16, 'forearm', GEO.hitLowerArm, 0, -0.17, 0)
      lowerPart.side = side
      this.parts[`arm${side}`] = upperPart
      this.parts[`arm${side}Lower`] = lowerPart
    }

    // legs
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? -1 : 1
      const hip = new THREE.Group()
      hip.position.set(sx * 0.115, -0.03, 0)
      hips.add(hip)
      this.rig.hips[side] = hip
      const thigh = mk(GEO.thigh, this.typeName === 'brute' ? mats.skin : mats.leather, 0, -0.23, 0, hip)
      // leg cloth
      if (this.typeName !== 'brute') {
        const cloth = mk(new THREE.BoxGeometry(0.16, 0.19, 0.16), mats.cloth, 0, -0.12, 0, hip)
        cloth.scale.set(1.02, 1, 1.02)
      }
      const knee = new THREE.Group()
      knee.position.y = -0.47
      hip.add(knee)
      this.rig.knees[side] = knee
      const shin = mk(GEO.shin, mats.skin, 0, -0.21, 0, knee)
      const guard = mk(GEO.shinGuard, mats.leather, 0, -0.19, 0.055, knee)
      const foot = new THREE.Group()
      foot.position.y = -0.43
      knee.add(foot)
      this.rig.feet[side] = foot
      const footMesh = mk(GEO.foot, mats.leather, 0, -0.025, 0.055, foot)
      const upperPart = this._part(`leg${side}`, side === 'L' ? 'LEFT LEG' : 'RIGHT LEG', hip, thigh, 74, 0.2, 'leg', GEO.hitThigh, 0, -0.23, 0)
      upperPart.side = side
      const lowerPart = this._part(`leg${side}Lower`, side === 'L' ? 'LEFT SHIN' : 'RIGHT SHIN', knee, shin, 56, 0.16, 'shin', GEO.hitShin, 0, -0.21, 0)
      lowerPart.side = side
      this.parts[`leg${side}`] = upperPart
      this.parts[`leg${side}Lower`] = lowerPart
    }

    // weapon
    this.weapon = this._makeWeapon(this.type.weapon)
    this.weapon.position.set(0, -0.02, 0.02)
    this.rig.hands.R.add(this.weapon)

    // pose
    this.root.rotation.y = 0
    this._updateHitMeshList()
  }

  _part(id, label, group, mainMesh, hp, vital, kind, hitGeo, hx, hy, hz) {
    const hit = new THREE.Mesh(hitGeo, HIT_MAT)
    hit.position.set(hx, hy, hz)
    hit.userData.part = null
    hit.visible = false
    group.add(hit)
    const part = {
      id, label, group, mesh: mainMesh, hp, maxHp: hp, vital, kind,
      lost: false, fractured: false, side: null, hitMesh: hit, enemy: this, bloodMarkCount: 0
    }
    hit.userData.part = part
    return part
  }

  _updateHitMeshList() {
    this.hitMeshes = Object.values(this.parts).map(p => p.hitMesh).filter(Boolean)
  }

  _makeWeapon(kind) {
    const g = new THREE.Group()
    const wood = this.mats.leather
    const metal = this.mats.metal
    if (kind === 'club') {
      const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.55, 6), wood)
      haft.position.y = -0.27
      haft.castShadow = true
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 0.3, 7), wood)
      head.position.y = -0.58
      head.castShadow = true
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.16), metal)
      band.position.y = -0.52
      for (let i = 0; i < 4; i++) {
        const stud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), metal)
        const a = i / 4 * TAU
        stud.position.set(Math.cos(a) * 0.075, -0.62, Math.sin(a) * 0.075)
        g.add(stud)
        stud.castShadow = true
      }
      g.add(haft, head, band)
    } else if (kind === 'sword') {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.023, 0.17, 6), wood)
      grip.position.y = 0.05
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.05), metal)
      guard.position.y = -0.03
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.66, 0.016), metal)
      blade.position.y = -0.39
      blade.castShadow = true
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.1, 4), metal)
      tip.position.y = -0.77
      tip.rotation.z = Math.PI
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), metal)
      pommel.position.y = 0.14
      g.add(grip, guard, blade, tip, pommel)
    } else {
      const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.82, 6), wood)
      haft.position.y = -0.4
      haft.castShadow = true
      const head = new THREE.Mesh(roundedBox(0.25, 0.16, 0.15, 0.03, 0.7), metal)
      head.position.y = -0.8
      head.castShadow = true
      const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.17), this.mats.leather)
      band1.position.set(0.1, -0.8, 0)
      const band2 = band1.clone(); band2.position.x = -0.1
      g.add(haft, head, band1, band2)
    }
    return g
  }

  setAttackCooldown(v) { this.attackCooldown = v }

  aliveArm(side) {
    const up = this.parts[`arm${side}`]
    const lo = this.parts[`arm${side}Lower`]
    return up && !up.lost && !up.fractured && lo && !lo.lost && !lo.fractured
  }

  get hasWeapon() { return !!this.weapon && !!this.weapon.parent && this.aliveArm('R') }

  get canAttack() {
    if (this.dead) return false
    if (this.aliveArm('R') && this.weapon) return true
    if (this.aliveArm('L') || this.aliveArm('R')) return true
    return false
  }

  _legLost() {
    const a = this.parts.legL, b = this.parts.legR
    const c = this.parts.legLLower, d = this.parts.legRLower
    return [a, b, c, d].filter(p => p && (p.lost || p.fractured)).length
  }

  update(dt, player, enemies) {
    this.aliveTime += dt
    this.flash = Math.max(0, this.flash - dt)
    this._updateFlash()

    if (this.dead) {
      this._updateDeath(dt)
      return
    }

    const dx = player.position.x - this.root.position.x
    const dz = player.position.z - this.root.position.z
    const dist = Math.hypot(dx, dz)
    this.distToPlayer = dist

    const legsLost = this._legLost()
    this.crawl = legsLost > 0
    this.crawlAmt = damp(this.crawlAmt, this.crawl ? 1 : 0, 5, dt)

    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.staggerT = Math.max(0, this.staggerT - dt)

    // attack state machine
    if (this.attackT >= 0) {
      this.attackT += dt
      const windup = this.type.windup
      const strikeAt = windup + 0.14
      if (!this.attackHitDone && this.attackT >= strikeAt) {
        this.attackHitDone = true
        this._doAttackHit(player, dist)
      }
      if (this.attackT > windup + 0.62) {
        this.attackT = -1
        this.attackCooldown = this.type.attackCooldown * rand(0.8, 1.2)
      }
    } else if (player.alive && dist < this._reach() && this.attackCooldown <= 0 && this.staggerT <= 0 && this.canAttack) {
      this.attackT = 0
      this.attackHitDone = false
      this.game.audio.gurgle(this._pan())
    }

    // movement
    let moveSpeed = 0
    if (this.staggerT <= 0 && this.attackT < 0) {
      const want = this._reach() * 0.72
      let mx = 0, mz = 0
      if (dist > want + 0.15) {
        mx = dx / (dist || 1); mz = dz / (dist || 1)
      } else if (dist < want - 0.4) {
        mx = -dx / (dist || 1); mz = -dz / (dist || 1)
      }
      // strafe
      if (dist < this._reach() * 1.9) {
        const s = Math.sin(this.aliveTime * 1.3 + this.offset) * 0.55
        mx += (-dz / (dist || 1)) * s
        mz += (dx / (dist || 1)) * s
      }
      // separation
      for (const o of enemies) {
        if (o === this || o.dead) continue
        const ox = this.root.position.x - o.root.position.x
        const oz = this.root.position.z - o.root.position.z
        const d2 = ox * ox + oz * oz
        if (d2 < 2.2 && d2 > 0.0001) {
          const d = Math.sqrt(d2)
          mx += (ox / d) * (1.5 - d) * 0.75
          mz += (oz / d) * (1.5 - d) * 0.75
        }
      }
      const ml = Math.hypot(mx, mz)
      if (ml > 0.001) {
        mx /= ml; mz /= ml
        const spdMul = this.crawl ? (legsLost > 1 ? 0.16 : 0.34) : 1
        moveSpeed = this.type.speed * spdMul * (this.attackT >= 0 ? 0.15 : 1)
        this.root.position.x += mx * moveSpeed * dt
        this.root.position.z += mz * moveSpeed * dt
        this.targetYaw = Math.atan2(mx, mz)
      }
    }
    this.speed = damp(this.speed, moveSpeed, 8, dt)

    // clamp
    this.root.position.x = clamp(this.root.position.x, ARENA.playerMinX + 0.1, ARENA.playerMaxX - 0.1)
    this.root.position.z = clamp(this.root.position.z, ARENA.playerMinZ + 0.1, ARENA.playerMaxZ - 0.1)

    // face player when close / move direction otherwise
    if (dist < this._reach() * 1.8) this.targetYaw = Math.atan2(dx, dz)
    let dyaw = ((this.targetYaw - this.yaw + Math.PI * 3) % TAU) - Math.PI
    this.yaw += dyaw * Math.min(1, dt * 7)
    this.root.rotation.y = this.yaw

    this._animate(dt, dist)
  }

  _reach() {
    return this.type.reach * (this.crawl ? 0.7 : 1)
  }

  _pan() {
    const cam = this.game.player.camera
    return clamp((this.root.position.x - cam.position.x) / 14, -0.85, 0.85)
  }

  _doAttackHit(player, dist) {
    const reach = this._reach() + 0.3
    if (dist > reach || !player.alive) return
    const dx = player.position.x - this.root.position.x
    const dz = player.position.z - this.root.position.z
    const angleTo = Math.atan2(dx, dz)
    let diff = Math.abs(((angleTo - this.yaw + Math.PI * 3) % TAU) - Math.PI)
    if (diff > 1.2) return
    const arm = this.aliveArm('R') ? 'R' : (this.aliveArm('L') ? 'L' : null)
    if (!arm) return
    let dmg = this.type.damage
    if (!this.weapon) dmg *= 0.45
    if (this.crawl) dmg *= 0.7
    dmg *= 0.85 + this.manager.difficulty * 0.12
    player.damage(dmg, this.root.position)
    this.game.audio.flesh(0.8, this._pan(), false)
    this.game.gore.bloodBurst(new THREE.Vector3(player.position.x, 1.2, player.position.z), new THREE.Vector3(dx, 0.4, dz).normalize(), 5, 0.6, 0.5)
  }

  _animate(dt, dist) {
    const t = this.aliveTime
    const rig = this.rig
    const moving = this.speed > 0.2
    const crawl = this.crawlAmt
    const crouch = clamp(1 - crawl, 0, 1)

    // hips height and torso lean
    const targetHipY = lerp(0.98, 0.42, crawl)
    this.hips.position.y = damp(this.hips.position.y, targetHipY, 6, dt)
    const targetTorsoX = lerp(0.0, 1.18, crawl)
    let torsoX = damp(this.torsoUpper.rotation.x, targetTorsoX, 6, dt)
    let torsoY = 0

    // walk cycle
    const amp = this.crawl ? 0.45 : clamp(this.speed / 3, 0, 1) * 0.55
    const ph = this.walkPhase + (this.speed > 0.1 ? dt * this.speed * 2.4 : 0)
    this.walkPhase = ph
    const sw = Math.sin(ph) * amp
    const sw2 = Math.cos(ph) * amp

    if (!this.parts.legL.fractured && !this.parts.legL.lost) {
      rig.hips.L.rotation.x = sw
      if (!this.parts.legLLower.fractured) rig.knees.L.rotation.x = Math.max(0, -sw) * 1.3 + 0.04
    }
    if (!this.parts.legR.fractured && !this.parts.legR.lost) {
      rig.hips.R.rotation.x = -sw
      if (!this.parts.legRLower.fractured) rig.knees.R.rotation.x = Math.max(0, sw) * 1.3 + 0.04
    }
    if (this.parts.legLLower.lost) rig.knees.L.rotation.x = lerp(rig.knees.L.rotation.x, -0.4, dt * 4)
    if (this.parts.legRLower.lost) rig.knees.R.rotation.x = lerp(rig.knees.R.rotation.x, -0.4, dt * 4)

    // arms idle/walk
    let armSwingL = -sw * 0.7
    let armSwingR = sw * 0.7
    if (this.aliveArm('L')) {
      rig.shoulders.L.rotation.x = damp(rig.shoulders.L.rotation.x, armSwingL + (crawl ? -1.55 : 0.08), 8, dt)
      rig.shoulders.L.rotation.z = damp(rig.shoulders.L.rotation.z, crawl ? -0.25 : 0.09, 8, dt)
    }
    if (this.aliveArm('R')) {
      rig.shoulders.R.rotation.x = damp(rig.shoulders.R.rotation.x, armSwingR + (crawl ? -1.55 : 0.08), 8, dt)
      rig.shoulders.R.rotation.z = damp(rig.shoulders.R.rotation.z, crawl ? 0.25 : -0.09, 8, dt)
    }

    // crawl paddle
    if (crawl > 0.1) {
      if (this.aliveArm('L')) rig.shoulders.L.rotation.x = -1.7 + Math.sin(t * 5 + 1) * 0.55 * crawl
      if (this.aliveArm('R')) rig.shoulders.R.rotation.x = -1.7 + Math.sin(t * 5) * 0.55 * crawl
    }

    // attack animation
    if (this.attackT >= 0) {
      const windup = this.type.windup
      const k = this.attackT
      const arm = this.aliveArm('R') ? 'R' : 'L'
      const sgn = arm === 'R' ? 1 : -1
      if (k < windup) {
        const p = k / windup
        rig.shoulders[arm].rotation.x = lerp(rig.shoulders[arm].rotation.x, -2.15, p)
        rig.shoulders[arm].rotation.z = sgn * lerp(0.1, 0.55, p)
        torsoY = sgn * 0.42 * p
      } else if (k < windup + 0.28) {
        const p = clamp((k - windup) / 0.28, 0, 1)
        rig.shoulders[arm].rotation.x = lerp(-2.15, 0.85, p)
        rig.shoulders[arm].rotation.z = sgn * lerp(0.55, -0.35, p)
        torsoY = sgn * lerp(0.42, -0.4, p)
      } else {
        const p = clamp((k - windup - 0.28) / 0.34, 0, 1)
        rig.shoulders[arm].rotation.x = lerp(0.85, 0.08, p)
        torsoY = sgn * lerp(-0.4, 0, p)
      }
      // left arm counterbalance
      const other = arm === 'R' ? 'L' : 'R'
      if (this.aliveArm(other)) rig.shoulders[other].rotation.x = lerp(rig.shoulders[other].rotation.x, 0.6, 0.2)
    }

    // stagger
    if (this.staggerT > 0) {
      const s = this.staggerT / 0.5
      this.hips.rotation.z = Math.sin(t * 40) * 0.08 * s
      this.hips.rotation.x = -0.18 * s
      torsoX -= 0.25 * s
    } else {
      this.hips.rotation.z = damp(this.hips.rotation.z, 0, 6, dt)
      this.hips.rotation.x = damp(this.hips.rotation.x, 0, 6, dt)
    }

    this.torsoUpper.rotation.x = damp(this.torsoUpper.rotation.x, torsoX, 10, dt)
    this.torsoUpper.rotation.y = damp(this.torsoUpper.rotation.y, torsoY, 12, dt)

    // slow head tracking / jawless head loll
    if (this.parts.head.lost) {
      // no head
    } else if (this.parts.jaw.lost) {
      this.neck.rotation.z = Math.sin(t * 1.7) * 0.09
      this.neck.rotation.x = 0.12 + Math.sin(t * 0.9) * 0.05
    } else {
      this.neck.rotation.x = damp(this.neck.rotation.x, -0.05, 4, dt)
    }
  }

  _updateDeath(dt) {
    this.deathT += dt
    const k = clamp(this.deathT / 0.75, 0, 1)
    const e = 1 - Math.pow(1 - k, 3)
    if (this.cause === 'bisect') {
      this.hips.position.y = damp(this.hips.position.y, 0.26, 5, dt)
      this.root.rotation.z = lerp(0, this.deathDir * 1.35, e)
      this.root.rotation.x = lerp(0, 0.18, e)
    } else {
      this.hips.position.y = lerp(0.98, 0.26, e)
      this.root.rotation.x = lerp(0, -this.deathDir * 1.42, e)
      this.root.rotation.z = lerp(0, this.deathDir * 0.12, e)
    }
    if (this.deathT > 0.9 && !this.poolDone) {
      this.poolDone = true
      this.gore.bloodPool(this.root.position, 1.3)
      this.gore.bloodBurst(new THREE.Vector3(this.root.position.x, 0.6, this.root.position.z), new THREE.Vector3(0, 1, 0), 6, 0.5, 0.8)
      if (this.cause === 'vital') this.game.audio.gurgle(this._pan())
    }
  }

  _updateFlash() {
    const on = this.flash > 0
    for (const m of this.materials) {
      if (m.emissive) {
        if (on) m.emissive.setRGB(0.32, 0.02, 0.02)
        else m.emissive.setRGB(0, 0, 0)
      }
    }
  }

  // -------------------------------------------------------- damage & gore
  takeHit(part, damage, weapon, dir, point) {
    if (this.dead || !part || part.lost) return
    this.lastWeapon = weapon
    this.flash = 0.13
    this.staggerT = Math.max(this.staggerT, 0.32)
    this.health -= damage * part.vital
    this.game.audio.flesh(1, this._pan(), weapon === 'hammer')
    const bd = dir.clone().normalize()
    bd.y = Math.abs(bd.y) + 0.35
    this.gore.bloodBurst(point, bd, weapon === 'hammer' ? 22 : 13, weapon === 'hammer' ? 1.6 : 1.1, 0.9)
    this._addBloodMark(part, point)

    let partDamage = damage * (weapon === 'hammer' ? 1.45 : 1)
    if (part.kind === 'torso') {
      this.cutTorso += partDamage
      // Two committed body cuts are enough to cleave a fighter in half.
      if (weapon === 'sword' && this.cutTorso >= 140) {
        this._bisect(point, dir)
        return
      }
      if (weapon === 'hammer' && this.health <= 0) {
        this._burstChest(point, dir)
        return
      }
    }
    part.hp -= partDamage

    if (part.hp <= 0) {
      if (weapon === 'sword') {
        if (part.kind === 'head') { this._splitHead(point, dir); return }
        if (part.kind === 'jaw') { this._severJaw(point, dir); return }
        if (part.kind === 'arm' || part.kind === 'forearm') { this._severArm(part, point, dir); }
        if (part.kind === 'leg' || part.kind === 'shin') { this._severLeg(part, point, dir); }
      } else {
        if (part.kind === 'head') { this._burstHead(point, dir); return }
        if (part.kind === 'jaw') { this._breakJaw(point, dir); return }
        if (part.kind === 'arm' || part.kind === 'forearm') { this._fractureArm(part, point, dir); }
        if (part.kind === 'leg' || part.kind === 'shin') { this._fractureLeg(part, point, dir); }
        if (part.kind === 'torso' && this.health <= 0) { this._burstChest(point, dir); return }
      }
    }

    if (this.health <= 0 && !this.dead) this.die('vital', dir)
  }

  _addBloodMark(part, worldPoint) {
    if (part.lost || this.bloodMarks > 10) return
    const local = part.group.worldToLocal(worldPoint.clone())
    const mat = new THREE.MeshBasicMaterial({
      map: this.gore.bloodTex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      opacity: rand(0.65, 0.95), polygonOffset: true, polygonOffsetFactor: -2
    })
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    plane.position.copy(local)
    plane.scale.setScalar(rand(0.12, 0.28))
    plane.rotation.z = rand(0, TAU)
    plane.renderOrder = 2
    part.group.add(plane)
    this.bloodMarks++
  }

  _stump(parent, localPos, radius = 0.07, bone = true, dir = null) {
    const stump = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), this.gore._mats.blood)
    stump.position.copy(localPos)
    stump.scale.set(1.15, 1.15, 0.55)
    parent.add(stump)
    if (bone) {
      this.gore.boneSpike(parent, localPos, dir || new THREE.Vector3(rand(-0.4, 0.4), 1, rand(-0.4, 0.4)), rand(0.1, 0.18))
    }
    this.gore.addBleeder(parent, localPos, rand(2.4, 4.2), rand(20, 32), 1)
  }

  _detachLimb(part, point, dir, opts = {}) {
    if (part.lost) return
    const group = part.group
    const parent = group.parent
    const local = group.position.clone()
    part.lost = true
    part.hp = 0
    const worldPos = new THREE.Vector3()
    group.getWorldPosition(worldPos)
    if (part.side === 'R') this._dropWeapon(dir)
    const vel = dir.clone().multiplyScalar(rand(1.2, 2.6))
    vel.y += rand(1, 2.6)
    this.gore.addChunk(group, vel, new THREE.Vector3(rand(-7, 7), rand(-7, 7), rand(-7, 7)), { gore: true })
    this.gore.bloodBurst(worldPos, dir.clone().multiplyScalar(-1), 20, 1.5, 1)
    this.gore.bloodPool(worldPos, 0.55)
    this._stump(parent, local, opts.radius || 0.065, true, dir)
    this.limbsLost++
    // if upper part removed, mark lower parts lost logically
    if (opts.lower && this.parts[opts.lower]) this.parts[opts.lower].lost = true
    if (opts.upper && this.parts[opts.upper]) this.parts[opts.upper].lost = true
    this.game.audio.sever(this._pan(), true)
    this.game.onDismember(this, part)
  }

  _severArm(part, point, dir) {
    const side = part.side
    if (part.kind === 'arm') {
      this._detachLimb(part, point, dir, { lower: `arm${side}Lower`, radius: 0.075 })
    } else {
      this._detachLimb(part, point, dir, { upper: `arm${side}`, radius: 0.06 })
      // upper remains but unusable
    }
  }

  _severLeg(part, point, dir) {
    const side = part.side
    if (part.kind === 'leg') {
      this._detachLimb(part, point, dir, { lower: `leg${side}Lower`, radius: 0.085 })
    } else {
      this._detachLimb(part, point, dir, { upper: `leg${side}`, radius: 0.07 })
    }
    this.crawl = true
  }

  _fractureArm(part, point, dir) {
    if (part.fractured) return
    part.fractured = true
    this.flash = 0.2
    const side = part.side
    const worldPos = new THREE.Vector3()
    part.group.getWorldPosition(worldPos)
    if (side === 'R') this._dropWeapon(dir)
    if (part.kind === 'arm') {
      this.rig.elbows[side].rotation.x = -1.35
      this.rig.elbows[side].rotation.z = side === 'R' ? -0.55 : 0.55
      this.rig.shoulders[side].rotation.x = 0.45
      this.gore.boneSpike(part.group, new THREE.Vector3(0, -0.38, 0), new THREE.Vector3(rand(-0.5, 0.5), 0.3, rand(0.3, 0.8)), 0.2)
      this.gore.addBleeder(part.group, new THREE.Vector3(0, -0.38, 0), 3.4, 26, 1.2)
    } else {
      this.rig.elbows[side].rotation.x = -1.5
      this.gore.boneSpike(part.group, new THREE.Vector3(0, -0.34, 0), new THREE.Vector3(rand(-0.4, 0.4), 0.4, rand(0.2, 0.7)), 0.18)
      this.gore.addBleeder(part.group, new THREE.Vector3(0, -0.34, 0), 3.0, 24, 1)
    }
    this.gore.bloodBurst(point, dir, 22, 1.5, 1)
    this.game.audio.crunch(this._pan(), 1.2)
    this.game.audio.sever(this._pan(), true)
    this.staggerT = 0.7
    this.game.onFracture(this, part)
  }

  _fractureLeg(part, point, dir) {
    if (part.fractured) return
    part.fractured = true
    this.flash = 0.2
    const side = part.side
    if (part.kind === 'leg') {
      this.rig.hips[side].rotation.x = -1.1
      this.rig.knees[side].rotation.x = 1.75
      this.gore.boneSpike(part.group, new THREE.Vector3(0, -0.46, 0), new THREE.Vector3(rand(-0.5, 0.5), 0.3, rand(0.4, 1)), 0.23)
      this.gore.addBleeder(part.group, new THREE.Vector3(0, -0.46, 0), 3.6, 26, 1.2)
    } else {
      this.rig.knees[side].rotation.x = 1.8
      this.gore.boneSpike(part.group, new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(rand(-0.5, 0.5), 0.4, rand(0.4, 1)), 0.2)
      this.gore.addBleeder(part.group, new THREE.Vector3(0, -0.3, 0), 3.2, 24, 1)
    }
    this.gore.bloodBurst(point, dir, 22, 1.4, 1)
    this.game.audio.crunch(this._pan(), 1.3)
    this.staggerT = 0.75
    this.crawl = true
    this.game.onFracture(this, part)
  }

  _neckCap() {
    if (this.neckCap) return
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.088, 0.03, 12), this.gore._mats.blood)
    cap.position.y = 0.09
    this.neck.add(cap)
    this.neckCap = cap
  }

  _splitHead(point, dir) {
    if (this.parts.head.lost) return
    this.parts.head.lost = true
    const skull = this.parts.head.group
    const worldPos = new THREE.Vector3()
    skull.getWorldPosition(worldPos)
    skull.removeFromParent()
    this._neckCap()
    // helmet/hair as debris
    if (this.type.helmet || this.type.mask) {
      // skull children are lost; spawn a metal chunk
      const chunk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), this.mats.metal)
      chunk.position.copy(worldPos)
      this.scene.add(chunk)
      this.gore.addChunk(chunk, new THREE.Vector3(dir.x * 2, 3, dir.z * 2), new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), { gore: true })
    }
    this.gore.spawnSkullHalves(worldPos, this.skinCol)
    this.gore.addBleeder(this.neck, new THREE.Vector3(0, 0.12, 0), 4.5, 30, 1.4)
    this.gore.bloodBurst(worldPos, new THREE.Vector3(0, 1, 0), 30, 1.8, 1)
    this.game.audio.crunch(this._pan(), 1.4)
    this.game.audio.sever(this._pan(), true)
    this.game.onDismember(this, this.parts.head)
    this.die('head', dir)
  }

  _burstHead(point, dir) {
    if (this.parts.head.lost) return
    this.parts.head.lost = true
    const skull = this.parts.head.group
    const worldPos = new THREE.Vector3()
    skull.getWorldPosition(worldPos)
    skull.removeFromParent()
    this._neckCap()
    this.gore.spawnSkullFragments(worldPos, this.skinCol)
    if (!this.parts.jaw.lost) {
      const jw = new THREE.Vector3()
      this.parts.jaw.group.getWorldPosition(jw)
      this._detachJawChunk(dir, 2.2)
    }
    this.gore.addBleeder(this.neck, new THREE.Vector3(0, 0.12, 0), 6, 34, 1.6)
    this.gore.bloodBurst(worldPos, new THREE.Vector3(0, 1, 0), 42, 2.1, 1)
    this.game.audio.crunch(this._pan(), 1.8)
    this.game.audio.sever(this._pan(), true)
    this.game.onDismember(this, this.parts.head)
    this.die('head', dir)
  }

  _severJaw(point, dir) {
    if (this.parts.jaw.lost) return
    this.parts.jaw.lost = true
    const worldPos = new THREE.Vector3()
    this.parts.jaw.group.getWorldPosition(worldPos)
    this._detachJawChunk(dir, 1.6)
    this.gore.bloodBurst(worldPos, new THREE.Vector3(0, 0.2, 1), 18, 1.2, 0.9)
    this.gore.addBleeder(this.neck, new THREE.Vector3(0, -0.06, 0.07), 4, 18, 0.8)
    this.game.audio.sever(this._pan(), true)
    this.game.audio.gurgle(this._pan())
    this.health -= 8
    this.game.onDismember(this, this.parts.jaw)
    this.game.ui.toast('JAW SEVERED — HE CAN STILL SCREAM', 1600)
  }

  _breakJaw(point, dir) {
    if (this.parts.jaw.lost) return
    this.parts.jaw.lost = true
    const worldPos = new THREE.Vector3()
    this.parts.jaw.group.getWorldPosition(worldPos)
    this._detachJawChunk(dir, 2.4)
    this.gore.bloodBurst(worldPos, new THREE.Vector3(0, 0.1, 1), 24, 1.5, 1)
    this.gore.addBleeder(this.neck, new THREE.Vector3(0, -0.06, 0.07), 4, 20, 0.9)
    this.game.audio.crunch(this._pan(), 1.4)
    this.game.audio.gurgle(this._pan())
    this.health -= 12
    this.game.onDismember(this, this.parts.jaw)
    this.game.ui.toast('JAW BROKEN CLEAN OFF', 1500)
  }

  _detachJawChunk(dir, power) {
    const jaw = this.parts.jaw.group
    this.parts.jaw.lost = true
    const wp = new THREE.Vector3()
    jaw.getWorldPosition(wp)
    const vel = new THREE.Vector3(dir.x * power, 1.2 + rand(0, 1.8), dir.z * power + rand(-0.8, 0.8))
    this.gore.addChunk(jaw, vel, new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), { gore: true })
  }

  _bisect(point, dir) {
    if (this.torsoGone) return
    this.torsoGone = true
    const upper = this.torsoUpper
    const wp = new THREE.Vector3()
    upper.getWorldPosition(wp)
    const waist = new THREE.Vector3(this.root.position.x, 1.18 * this.type.scale, this.root.position.z)
    this.parts.torsoUpper.lost = true
    this.parts.torsoLower.lost = true
    // raw cut faces on both halves
    const upperCap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.035, 14), this.gore._mats.blood)
    upperCap.position.set(0, -0.07, 0)
    upperCap.scale.z = 0.72
    upper.add(upperCap)
    const lowerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.195, 0.04, 14), this.gore._mats.blood)
    lowerCap.position.set(0, 0.265, 0)
    lowerCap.scale.z = 0.72
    this.hips.add(lowerCap)
    this.gore.boneSpike(this.hips, new THREE.Vector3(0, 0.27, 0), new THREE.Vector3(0.1, 1, 0.05), 0.22)
    // upper body becomes gore
    const vel = new THREE.Vector3(dir.x * 2.2, 2.2, dir.z * 2.2)
    this.gore.addChunk(upper, vel, new THREE.Vector3(rand(-4, 4), rand(-5, 5), rand(-4, 4)), { gore: true })
    this.parts.armL.lost = true; this.parts.armLLower.lost = true
    this.parts.armR.lost = true; this.parts.armRLower.lost = true
    this.parts.head.lost = true; this.parts.jaw.lost = true
    this.gore.spawnGuts(waist, dir, 9)
    this.gore.addBleeder(this.hips, new THREE.Vector3(0, 0.26, 0), 6, 36, 1.6)
    this.gore.bloodBurst(waist, new THREE.Vector3(0, 0.8, 0), 34, 1.9, 1)
    this.game.audio.sever(this._pan(), true)
    this.game.audio.crunch(this._pan(), 1.2)
    this.game.onDismember(this, this.parts.torsoUpper)
    this.die('bisect', dir)
    this.game.ui.toast('CUT IN HALF — THE GUTS SPILL OUT', 2000)
  }

  _burstChest(point, dir) {
    if (this.chestGone) return
    this.chestGone = true
    const wp = new THREE.Vector3(this.root.position.x, 1.4, this.root.position.z)
    this.gore.spawnGuts(wp, dir, 8)
    const boneMat = this.gore._mats.bone
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, rand(0.15, 0.3), 5), boneMat)
      rib.position.copy(wp).add(new THREE.Vector3(rand(-0.15, 0.15), rand(-0.1, 0.15), rand(-0.1, 0.1)))
      rib.rotation.set(rand(-1, 1), rand(-1, 1), rand(-1, 1))
      this.scene.add(rib)
      this.gore.addChunk(rib, new THREE.Vector3(rand(-2, 2), rand(1, 3), rand(-2, 2)), new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), { gore: true })
    }
    this.gore.bloodBurst(wp, dir, 36, 2, 1)
    this.gore.addBleeder(this.torsoUpper, new THREE.Vector3(0, 0.18, 0), 5, 30, 1.4)
    this.game.audio.crunch(this._pan(), 1.8)
    this.die('chest', dir)
  }

  _dropWeapon(dir = null) {
    if (!this.weapon || this.weaponDropped) return
    this.weaponDropped = true
    const w = this.weapon
    this.weapon = null
    const wp = new THREE.Vector3()
    w.getWorldPosition(wp)
    const vel = new THREE.Vector3(dir ? dir.x * 2.2 : rand(-1, 1), rand(1.2, 2.5), dir ? dir.z * 2.2 : rand(-1, 1))
    this.gore.addChunk(w, vel, new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), { gore: false, ttl: 30 })
    this.game.audio.clang(this._pan())
    this.game.ui.toast(`${this.type.label} DISARMED`, 1100)
  }

  die(cause, dir = null) {
    if (this.dead) return
    this.dead = true
    this.deathT = 0
    this.cause = cause
    this.deathDir = (dir && dir.x >= 0) ? 1 : -1
    this.attackT = -1
    if (this.weapon && Math.random() < 0.55) this._dropWeapon(dir)
    this.game.onEnemyKilled(this, cause)
  }
}

export class EnemyManager {
  constructor(game, scene, gore) {
    this.game = game
    this.scene = scene
    this.gore = gore
    this.enemies = []
    this.difficulty = 0
    this.raycaster = new THREE.Raycaster()
    this._v = new THREE.Vector3()
    this._v2 = new THREE.Vector3()
    this._tmp = new THREE.Vector3()
  }

  spawn(typeName, gateIndex = randInt(0, 2)) {
    const gx = ARENA.gates[gateIndex % ARENA.gates.length]
    const x = gx + rand(-1.0, 1.0)
    const z = ARENA.gateZ - rand(0.1, 0.5)
    const e = new Enemy(this, typeName, x, z)
    this.enemies.push(e)
    this.gore.dustPuff(new THREE.Vector3(x, 0.12, z + 0.7), 6, 0x9a7d55)
    return e
  }

  get alive() {
    return this.enemies.filter(e => !e.dead)
  }

  get aliveCount() {
    let n = 0
    for (const e of this.enemies) if (!e.dead) n++
    return n
  }

  update(dt, player) {
    const alive = this.alive
    for (const e of this.enemies) e.update(dt, player, alive)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]
      if (e.dead && e.deathT >= 20) {
        e.root.removeFromParent()
        this.enemies.splice(i, 1)
      }
    }
  }

  clearAll() {
    for (const e of this.enemies) {
      e.root.removeFromParent()
    }
    this.enemies.length = 0
  }

  allHitMeshes() {
    const out = []
    for (const e of this.enemies) {
      if (!e.dead) for (const h of e.hitMeshes) if (!h.userData.part.lost) out.push(h)
    }
    return out
  }

  // returns {enemy, part, point, distance}
  raycast(origin, dir, maxDist) {
    const meshes = this.allHitMeshes()
    if (!meshes.length) return null
    this.raycaster.set(origin, dir)
    this.raycaster.far = maxDist
    const hits = this.raycaster.intersectObjects(meshes, false)
    for (const h of hits) {
      const part = h.object.userData.part
      if (!part || part.lost) continue
      return { enemy: part.enemy, part, point: h.point, distance: h.distance }
    }
    return null
  }

  aimAssist(origin, dir, maxDist, radius = 0.85) {
    let best = null, bestScore = Infinity
    const meshCenters = []
    for (const e of this.enemies) {
      if (e.dead) continue
      for (const p of Object.values(e.parts)) {
        if (p.lost || !p.hitMesh) continue
        const wp = new THREE.Vector3()
        p.hitMesh.getWorldPosition(wp)
        const along = wp.clone().sub(origin).dot(dir)
        if (along < 0.2 || along > maxDist) continue
        const closest = origin.clone().addScaledVector(dir, along)
        const perp = closest.distanceTo(wp)
        if (perp < radius) {
          const score = perp + along * 0.02
          if (score < bestScore) {
            bestScore = score
            best = { enemy: e, part: p, point: wp, distance: along }
          }
        }
      }
    }
    return best
  }

  attack(weapon, origin, dir) {
    const isHammer = weapon === 'hammer'
    const range = isHammer ? 2.9 : 3.05
    let primary = this.raycast(origin, dir, range)
    if (!primary) primary = this.aimAssist(origin, dir, range, isHammer ? 1.15 : 0.72)
    if (!primary) return { hits: [], point: null }

    const hits = [{ enemy: primary.enemy, part: primary.part, point: primary.point.clone() }]
    const hitPoint = primary.point.clone()
    const hitEnemy = primary.enemy

    if (isHammer) {
      // wide sweep: one part per enemy within impact radius
      for (const e of this.enemies) {
        if (e.dead || e === hitEnemy) continue
        const d = e.root.position.distanceTo(hitPoint)
        if (d < 2.5) {
          const p = this._closestPart(e, hitPoint)
          if (p) hits.push({ enemy: e, part: p, point: p.hitMesh.getWorldPosition(new THREE.Vector3()) })
        }
      }
    } else {
      // sword cleave: nearby enemies in the swing arc
      for (const e of this.enemies) {
        if (e.dead || e === hitEnemy) continue
        const center = e.root.position.clone(); center.y += 1.1
        const d = center.distanceTo(hitPoint)
        if (d < 1.7) {
          const p = this._closestPart(e, hitPoint)
          if (p) hits.push({ enemy: e, part: p, point: p.hitMesh.getWorldPosition(new THREE.Vector3()) })
        }
        if (hits.length >= 3) break
      }
    }
    return { hits, point: hitPoint }
  }

  _closestPart(enemy, point) {
    let best = null, bd = Infinity
    for (const p of Object.values(enemy.parts)) {
      if (p.lost || !p.hitMesh) continue
      const wp = p.hitMesh.getWorldPosition(new THREE.Vector3())
      const d = wp.distanceToSquared(point)
      if (d < bd) { bd = d; best = p }
    }
    return best
  }

  applyHits(hits, weapon, dir, player) {
    let any = false
    const bloodDir = dir.clone()
    for (const h of hits) {
      if (!h || !h.part || h.part.lost || h.enemy.dead) continue
      h.enemy.takeHit(h.part, weapon === 'hammer' ? 142 : 74, weapon, bloodDir, h.point)
      any = true
    }
    return any
  }

  targetInfo(origin, dir, range) {
    let hit = this.raycast(origin, dir, range)
    if (!hit) hit = this.aimAssist(origin, dir, range, 0.55)
    return hit
  }
}
