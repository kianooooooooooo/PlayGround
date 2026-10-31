import * as THREE from '../vendor/three.module.js'
import { makeBloodTexture, rand, randInt, choice, clamp, lerp, TAU, bloodColor } from './utils.js'
import { ARENA } from './world.js'

const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _zAxis = new THREE.Vector3(0, 0, 1)
const _up = new THREE.Vector3(0, 1, 0)
const _m = new THREE.Matrix4()
const _box = new THREE.Box3()

export class GoreSystem {
  constructor(scene, world, audio) {
    this.scene = scene
    this.world = world
    this.audio = audio
    this.time = 0
    this.locked = false
    this.chunks = []
    this.bleeders = []
    this.effects = []
    this.decalMax = 780
    this.decalCursor = 0
    this.fade = 1
    this.fading = false

    this.bloodTex = makeBloodTexture()
    this._buildDecals()
    this._buildDroplets()
    this._mats = {
      skin: new THREE.MeshStandardMaterial({ color: 0xb98a6a, roughness: 0.72 }),
      skinPale: new THREE.MeshStandardMaterial({ color: 0x9d7258, roughness: 0.8 }),
      bone: new THREE.MeshStandardMaterial({ color: 0xd8cba8, roughness: 0.55 }),
      gut: new THREE.MeshStandardMaterial({ color: 0x8a2230, roughness: 0.28, metalness: 0.02 }),
      gutDark: new THREE.MeshStandardMaterial({ color: 0x5c1520, roughness: 0.3 }),
      brain: new THREE.MeshStandardMaterial({ color: 0xc98a8e, roughness: 0.42 }),
      blood: new THREE.MeshStandardMaterial({ color: 0x5c0609, roughness: 0.35 })
    }
    this._halfSkullGeo = new THREE.SphereGeometry(0.145, 16, 12, 0, Math.PI)
    this._cutGeo = new THREE.CircleGeometry(0.144, 16)
    this._brainGeo = new THREE.IcosahedronGeometry(0.05, 1)
    this._organGeo = new THREE.SphereGeometry(1, 8, 6)
    this._gutGeo = new THREE.CapsuleGeometry(0.032, 0.19, 4, 7)
    this._gutRingGeo = new THREE.TorusGeometry(0.075, 0.026, 5, 12)
    this._shardGeo = new THREE.IcosahedronGeometry(0.05, 0)
  }

  _buildDecals() {
    const geo = new THREE.PlaneGeometry(1, 1)
    const mat = new THREE.MeshBasicMaterial({
      map: this.bloodTex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      color: 0xffffff, alphaTest: 0.015, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
    })
    const im = new THREE.InstancedMesh(geo, mat, this.decalMax)
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    im.frustumCulled = false
    im.renderOrder = 3
    im.count = 0
    this.decals = im
    this.scene.add(im)
    const c = new THREE.Color()
    this.decalColors = []
    for (let i = 0; i < this.decalMax; i++) this.decalColors.push(c.clone())
  }

  _buildDroplets() {
    const geo = new THREE.IcosahedronGeometry(0.018, 0)
    const mat = new THREE.MeshBasicMaterial({ color: 0x930a11 })
    const n = 620
    const im = new THREE.InstancedMesh(geo, mat, n)
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    im.frustumCulled = false
    im.count = n
    im.castShadow = false
    this.droplets = im
    this.scene.add(im)
    this.dropData = []
    const d = new THREE.Object3D()
    for (let i = 0; i < n; i++) {
      this.dropData.push({ active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, size: 1 })
      d.position.set(0, -100, 0); d.scale.setScalar(0); d.updateMatrix()
      im.setMatrixAt(i, d.matrix)
      im.setColorAt(i, bloodColor())
    }
    im.instanceColor.needsUpdate = true
    this.dropCursor = 0
    this._dropDummy = d
  }

  // ---------------------------------------------------------------- decals
  _addDecal(pos, normal, size, tone = 1) {
    if (this.locked) return
    const idx = this.decalCursor
    this.decalCursor = (this.decalCursor + 1) % this.decalMax
    if (this.decals.count < this.decalMax) this.decals.count = Math.min(this.decalMax, this.decals.count + 1)
    const d = this._dropDummy
    d.position.copy(pos).addScaledVector(normal, 0.012)
    d.quaternion.setFromUnitVectors(_zAxis, normal)
    d.quaternion.multiply(_q.setFromAxisAngle(_zAxis, rand(0, TAU)))
    d.scale.set(size * rand(0.8, 1.25), size * rand(0.75, 1.2), 1)
    d.updateMatrix()
    this.decals.setMatrixAt(idx, d.matrix)
    const c = this.decalColors[idx]
    c.setRGB(rand(0.88, 1.05) * tone, rand(0.5, 0.72) * tone, rand(0.5, 0.72) * tone)
    this.decals.setColorAt(idx, c)
    this.decals.instanceMatrix.needsUpdate = true
    if (this.decals.instanceColor) this.decals.instanceColor.needsUpdate = true
  }

  addGroundDecal(pos, size = 0.7) {
    _v.set(pos.x, 0.012, pos.z)
    this._addDecal(_v, _up, size)
  }

  bloodPool(pos, size = 1) {
    const n = 2 + Math.floor(size * 2)
    for (let i = 0; i < n; i++) {
      this.addGroundDecal({ x: pos.x + rand(-0.3, 0.3) * size, z: pos.z + rand(-0.3, 0.3) * size }, size * rand(0.55, 1.1))
    }
  }

  wallDecal(pos, normal, size = 0.7) {
    _v.copy(pos).addScaledVector(normal, -0.02)
    this._addDecal(_v, normal, size)
  }

  // ---------------------------------------------------------------- droplets
  spawnDroplet(pos, vel, size = 1, life = rand(0.8, 2.2)) {
    if (this.locked) return
    let idx = -1
    for (let k = 0; k < this.dropData.length; k++) {
      const j = (this.dropCursor + k) % this.dropData.length
      if (!this.dropData[j].active) { idx = j; break }
    }
    if (idx < 0) idx = this.dropCursor
    this.dropCursor = (idx + 1) % this.dropData.length
    const p = this.dropData[idx]
    p.active = true
    p.pos.copy(pos)
    p.vel.copy(vel)
    p.life = life
    p.size = size
  }

  bloodBurst(pos, dir, count = 14, power = 1, spread = 0.7) {
    if (this.locked) return
    const n = Math.min(count, 40)
    for (let i = 0; i < n; i++) {
      _v.set(dir.x + rand(-spread, spread), dir.y + rand(-spread * 0.45, spread), dir.z + rand(-spread, spread)).normalize()
      _v.multiplyScalar(rand(1.2, 5.4) * power)
      _v.y += rand(0.4, 2.4)
      this.spawnDroplet(pos, _v, rand(0.6, 1.8))
    }
  }

  addBleeder(object, localPos, duration = 2.2, rate = 24, power = 1) {
    this.bleeders.push({
      object, local: localPos.clone(), time: duration, rate, power, accum: 0
    })
  }

  // ---------------------------------------------------------------- chunks
  addChunk(object, vel, angVel, opts = {}) {
    this.scene.attach(object)
    this.chunks.push({
      object, vel: vel.clone(), angVel: angVel.clone(),
      rest: false, age: 0, gore: !!opts.gore, ttl: opts.ttl || 60
    })
    if (this.chunks.length > 150) {
      const old = this.chunks.shift()
      this.scene.remove(old.object)
    }
    return object
  }

  spawnGuts(pos, dir, count = 6) {
    for (let i = 0; i < count; i++) {
      const mat = Math.random() < 0.5 ? this._mats.gut : this._mats.gutDark
      let m
      if (i % 4 === 3) {
        m = new THREE.Mesh(this._gutRingGeo, mat)
        const sz = rand(0.75, 1.35)
        m.scale.set(sz, sz * rand(0.7, 1.2), sz)
        m.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU))
      } else if (i % 4 === 2) {
        m = new THREE.Mesh(this._organGeo, mat)
        const sz = rand(0.04, 0.075)
        m.scale.set(sz * rand(0.8, 1.4), sz * rand(0.9, 1.8), sz)
      } else {
        m = new THREE.Mesh(this._gutGeo, mat)
        m.scale.set(rand(0.7, 1.25), rand(0.8, 1.65), rand(0.7, 1.25))
        m.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU))
      }
      m.castShadow = true
      m.position.copy(pos).add(_v.set(rand(-0.1, 0.1), rand(-0.1, 0.1), rand(-0.1, 0.1)))
      this.scene.add(m)
      _v.set(dir.x * rand(0.4, 1.4) + rand(-0.9, 0.9), rand(1, 3.2), dir.z * rand(0.4, 1.4) + rand(-0.9, 0.9))
      this.addChunk(m, _v, _v2.set(rand(-9, 9), rand(-9, 9), rand(-9, 9)), { gore: true })
      this.spawnDroplet(pos, _v.set(rand(-1, 1), rand(0.5, 2), rand(-1, 1)), 1)
    }
    this.bloodBurst(pos, dir, 20, 1.5, 1)
    this.bloodPool(pos, 1.1)
  }

  spawnSkullHalves(pos, skinColor = 0xb98a6a) {
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7, side: THREE.DoubleSide })
    const cutMat = new THREE.MeshStandardMaterial({ color: 0x6d1016, roughness: 0.45 })
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group()
      const half = new THREE.Mesh(this._halfSkullGeo, skinMat)
      // scale head shape
      half.scale.set(0.98, 1.12, 0.95)
      half.castShadow = true
      const cut = new THREE.Mesh(this._cutGeo, cutMat)
      cut.scale.set(0.98, 1.12, 1)
      g.add(half, cut)
      if (i === 1) g.rotation.y = Math.PI
      g.position.copy(pos)
      g.position.x += i === 0 ? -0.05 : 0.05
      this.scene.add(g)
      const dir = i === 0 ? -1 : 1
      _v.set(dir * rand(0.9, 2.1), rand(1, 2.4), rand(-1, 1.4))
      this.addChunk(g, _v, _v2.set(rand(-9, 9), rand(-9, 9), rand(-9, 9)), { gore: true })
    }
    for (let i = 0; i < 4; i++) {
      const brain = new THREE.Mesh(this._brainGeo, this._mats.brain)
      brain.scale.setScalar(rand(0.7, 1.4))
      brain.position.copy(pos).add(_v.set(rand(-0.08, 0.08), rand(-0.08, 0.08), rand(-0.08, 0.08)))
      this.scene.add(brain)
      _v.set(rand(-2, 2), rand(0.8, 2.6), rand(-2, 2))
      this.chunks.push({ object: brain, vel: _v.clone(), angVel: _v2.set(rand(-10, 10), rand(-10, 10), rand(-10, 10)), rest: false, age: 0, gore: true, ttl: 60 })
    }
    this.bloodBurst(pos, _up, 22, 1.6, 1)
  }

  spawnSkullFragments(pos, skinColor = 0xb98a6a) {
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.72 })
    const boneMat = this._mats.bone
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(this._shardGeo, Math.random() < 0.6 ? skinMat : boneMat)
      m.scale.set(rand(0.5, 1.3), rand(0.4, 1.1), rand(0.4, 1.2))
      m.position.copy(pos).add(_v.set(rand(-0.1, 0.1), rand(-0.05, 0.12), rand(-0.1, 0.1)))
      m.castShadow = true
      this.scene.add(m)
      _v.set(rand(-3.4, 3.4), rand(1.2, 4.2), rand(-3.4, 3.4))
      this.addChunk(m, _v, _v2.set(rand(-14, 14), rand(-14, 14), rand(-14, 14)), { gore: true })
    }
    for (let i = 0; i < 5; i++) {
      const brain = new THREE.Mesh(this._brainGeo, this._mats.brain)
      brain.scale.setScalar(rand(0.6, 1.3))
      brain.position.copy(pos).add(_v.set(rand(-0.1, 0.1), rand(-0.08, 0.08), rand(-0.1, 0.1)))
      this.scene.add(brain)
      _v.set(rand(-2.4, 2.4), rand(1, 3.2), rand(-2.4, 2.4))
      this.chunks.push({ object: brain, vel: _v.clone(), angVel: _v2.set(rand(-10, 10), rand(-10, 10), rand(-10, 10)), rest: false, age: 0, gore: true, ttl: 60 })
    }
    this.bloodBurst(pos, _up, 28, 1.8, 1)
  }

  boneSpike(parent, localPos, dir = _up, len = 0.2) {
    const g = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, len, 5), this._mats.bone)
    shaft.position.y = len / 2
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), this._mats.bone)
    knob.position.y = len
    const blood = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), this._mats.blood)
    blood.scale.y = 0.5
    g.add(shaft, knob, blood)
    g.position.copy(localPos)
    g.quaternion.setFromUnitVectors(_up, dir.clone().normalize())
    parent.add(g)
    return g
  }

  // ---------------------------------------------------------------- fx
  shockwave(pos, color = 0xffc07a, size = 3.4, duration = 0.5) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    const m = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.28, 36), mat)
    m.rotation.x = -Math.PI / 2
    m.position.copy(pos); m.position.y = 0.04
    this.scene.add(m)
    this.effects.push({ mesh: m, life: duration, max: duration, kind: 'ring', size })
  }

  dustPuff(pos, count = 8, color = 0xa88d68) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.NormalBlending })
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.05, 0.14), 0), mat.clone())
      m.position.copy(pos).add(_v.set(rand(-0.2, 0.2), rand(0, 0.2), rand(-0.2, 0.2)))
      this.scene.add(m)
      this.effects.push({
        mesh: m, life: rand(0.5, 1.1), max: 1.1, kind: 'dust',
        vel: new THREE.Vector3(rand(-0.8, 0.8), rand(0.3, 1), rand(-0.8, 0.8))
      })
    }
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    this.time += dt
    const drops = this.dropData
    const d = this._dropDummy
    const { playerMinX, playerMaxX, playerMinZ, playerMaxZ } = ARENA
    const wallHalfX = 12.98, wallHalfZ = 16.98

    for (let i = 0; i < drops.length; i++) {
      const p = drops[i]
      if (!p.active) continue
      p.life -= dt
      p.vel.y -= 17 * dt
      p.pos.addScaledVector(p.vel, dt)
      // floor
      if (p.pos.y <= 0.02) {
        p.pos.y = 0.02
        this.addGroundDecal(p.pos, clamp(0.18 + p.size * 0.28, 0.16, 0.7))
        p.active = false
        d.position.set(0, -100, 0); d.scale.setScalar(0); d.updateMatrix()
        this.droplets.setMatrixAt(i, d.matrix)
        continue
      }
      // walls
      let hitWall = false
      if (p.pos.x < -wallHalfX) {
        if (p.pos.y < ARENA.wallH) {
          this.wallDecal(_v.set(-wallHalfX, p.pos.y, p.pos.z), _v2.set(1, 0, 0), clamp(0.22 + p.size * 0.3, 0.2, 0.8))
          hitWall = true
        }
        p.pos.x = -wallHalfX
      } else if (p.pos.x > wallHalfX) {
        if (p.pos.y < ARENA.wallH) {
          this.wallDecal(_v.set(wallHalfX, p.pos.y, p.pos.z), _v2.set(-1, 0, 0), clamp(0.22 + p.size * 0.3, 0.2, 0.8))
          hitWall = true
        }
        p.pos.x = wallHalfX
      }
      if (!hitWall && p.pos.z < -wallHalfZ) {
        const nearGate = ARENA.gates.some(g => Math.abs(p.pos.x - g) < 1.7)
        if (!nearGate && p.pos.y < ARENA.wallH) {
          this.wallDecal(_v.set(p.pos.x, p.pos.y, -wallHalfZ), _v2.set(0, 0, 1), clamp(0.22 + p.size * 0.3, 0.2, 0.8))
          hitWall = true
        }
        p.pos.z = -wallHalfZ
      } else if (!hitWall && p.pos.z > wallHalfZ) {
        if (p.pos.y < ARENA.wallH) {
          this.wallDecal(_v.set(p.pos.x, p.pos.y, wallHalfZ), _v2.set(0, 0, -1), clamp(0.22 + p.size * 0.3, 0.2, 0.8))
          hitWall = true
        }
        p.pos.z = wallHalfZ
      }
      if (hitWall || p.life <= 0) {
        p.active = false
        d.position.set(0, -100, 0); d.scale.setScalar(0); d.updateMatrix()
        this.droplets.setMatrixAt(i, d.matrix)
        continue
      }
      d.position.copy(p.pos)
      const s = p.size * (0.7 + clamp(p.life, 0, 1) * 0.4)
      d.scale.setScalar(s)
      d.rotation.set(p.life * 2.3, p.life * 3.1, p.life * 1.7)
      d.updateMatrix()
      this.droplets.setMatrixAt(i, d.matrix)
    }
    this.droplets.instanceMatrix.needsUpdate = true

    // bleeders
    for (let i = this.bleeders.length - 1; i >= 0; i--) {
      const b = this.bleeders[i]
      b.time -= dt
      if (b.time <= 0) { this.bleeders.splice(i, 1); continue }
      b.accum += dt * b.rate
      while (b.accum >= 1) {
        b.accum -= 1
        b.object.updateWorldMatrix(true, false)
        _v.copy(b.local).applyMatrix4(b.object.matrixWorld)
        _v2.set(rand(-0.5, 0.5), rand(-0.2, 0.6), rand(-0.5, 0.5))
        this.spawnDroplet(_v, _v2, rand(0.5, 1.2), rand(0.3, 0.9))
      }
    }

    // chunks
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i]
      c.age += dt
      if (c.age > c.ttl) {
        this.scene.remove(c.object)
        this.chunks.splice(i, 1)
        continue
      }
      if (c.rest) continue
      c.vel.y -= 19 * dt
      c.object.position.addScaledVector(c.vel, dt)
      c.object.rotation.x += c.angVel.x * dt
      c.object.rotation.y += c.angVel.y * dt
      c.object.rotation.z += c.angVel.z * dt
      c.object.updateWorldMatrix(true, true)
      // floor
      _box.setFromObject(c.object)
      if (_box.min.y < 0.012) {
        const lift = 0.012 - _box.min.y
        c.object.position.y += lift
        if (c.vel.y < 0) c.vel.y *= -0.22
        c.vel.x *= 0.7; c.vel.z *= 0.7
        c.angVel.multiplyScalar(0.62)
        if (Math.abs(c.vel.y) < 0.45 && c.vel.lengthSq() < 0.5) {
          c.rest = true
          c.vel.set(0, 0, 0)
          c.angVel.set(0, 0, 0)
          c.object.updateWorldMatrix(true, true)
          _box.setFromObject(c.object)
          c.object.position.y += Math.max(0, 0.012 - _box.min.y)
          if (c.gore) {
            this.bloodPool(c.object.position, 0.32)
          }
        }
      }
      // arena bounds
      if (c.object.position.x < playerMinX) { c.object.position.x = playerMinX; c.vel.x = Math.abs(c.vel.x) * 0.4 }
      if (c.object.position.x > playerMaxX) { c.object.position.x = playerMaxX; c.vel.x = -Math.abs(c.vel.x) * 0.4 }
      if (c.object.position.z < playerMinZ) { c.object.position.z = playerMinZ; c.vel.z = Math.abs(c.vel.z) * 0.4 }
      if (c.object.position.z > playerMaxZ) { c.object.position.z = playerMaxZ; c.vel.z = -Math.abs(c.vel.z) * 0.4 }
    }

    // effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]
      e.life -= dt
      const t = 1 - e.life / e.max
      if (e.life <= 0) {
        this.scene.remove(e.mesh)
        e.mesh.geometry.dispose?.()
        e.mesh.material.dispose?.()
        this.effects.splice(i, 1)
        continue
      }
      if (e.kind === 'ring') {
        e.mesh.scale.setScalar(1 + t * e.size)
        e.mesh.material.opacity = (1 - t) * 0.8
      } else if (e.kind === 'dust') {
        e.mesh.position.addScaledVector(e.vel, dt)
        e.mesh.material.opacity = (1 - t) * 0.28
        e.mesh.scale.multiplyScalar(1 + dt * 1.4)
      }
    }

    // fade handling
    if (this.fading) {
      this.fade = Math.max(0, this.fade - dt / this._fadeDur)
      this.decals.material.opacity = this.fade
      if (this.fade <= 0) this.reset()
    }
  }

  fadeOut(duration = 1.6) {
    this.locked = true
    this.fading = true
    this._fadeDur = duration
    this.fade = 1
  }

  reset() {
    this.decals.count = 0
    this.decalCursor = 0
    this.decals.material.opacity = 1
    this.fade = 1
    this.fading = false
    this.locked = false
    const d = this._dropDummy
    for (let i = 0; i < this.dropData.length; i++) {
      this.dropData[i].active = false
      d.position.set(0, -100, 0); d.scale.setScalar(0); d.updateMatrix()
      this.droplets.setMatrixAt(i, d.matrix)
    }
    this.droplets.instanceMatrix.needsUpdate = true
    for (const c of this.chunks) this.scene.remove(c.object)
    this.chunks.length = 0
    this.bleeders.length = 0
    for (const e of this.effects) this.scene.remove(e.mesh)
    this.effects.length = 0
  }
}
