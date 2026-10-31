import * as THREE from '../vendor/three.module.js'
import {
  makeSandTexture, makeStoneTexture, makeWoodTexture, makeSkyTexture, makeFlameTexture,
  makeEmblemTexture, makeDustTexture, makeClothTexture, roundedBox, mesh,
  rand, randInt, choice, clamp, lerp, TAU
} from './utils.js'

export const ARENA = {
  halfX: 13, halfZ: 17, wallH: 3.5,
  playerMinX: -12.35, playerMaxX: 12.35,
  playerMinZ: -16.1, playerMaxZ: 16.25,
  gates: [-6.6, 0, 6.6],
  gateZ: -16.55
}

export class World {
  constructor(scene, renderer) {
    this.scene = scene
    this.renderer = renderer
    this.torches = []
    this.banners = []
    this.time = 0
    this.quality = 1
    this._build()
  }

  _build() {
    const s = this.scene
    s.fog = new THREE.FogExp2(0x2a1411, 0.0145)
    s.background = new THREE.Color(0x0c0808)

    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    this.tex = {
      sand: makeSandTexture(),
      stone: makeStoneTexture(),
      wood: makeWoodTexture(),
      sky: makeSkyTexture(),
      flame: makeFlameTexture(),
      emblem: makeEmblemTexture(),
      cloth: makeClothTexture(),
      dust: makeDustTexture()
    }
    for (const t of Object.values(this.tex)) t.anisotropy = aniso

    this._lights()
    this._sky()
    this._ground()
    this._walls()
    this._stands()
    this._crowd()
    this._torches()
    this._banners()
    this._details()
    this._dust()
  }

  _lights() {
    const s = this.scene
    const hemi = new THREE.HemisphereLight(0x6a80a8, 0x24130d, 0.8)
    s.add(hemi)
    const amb = new THREE.AmbientLight(0x3a2018, 0.36)
    s.add(amb)

    const sun = new THREE.DirectionalLight(0xffb477, 2.9)
    sun.position.set(-26, 23, -14)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -26
    sun.shadow.camera.right = 26
    sun.shadow.camera.top = 26
    sun.shadow.camera.bottom = -26
    sun.shadow.camera.near = 2
    sun.shadow.camera.far = 80
    sun.shadow.bias = -0.00035
    sun.shadow.normalBias = 0.035
    s.add(sun)
    s.add(sun.target)
    sun.target.position.set(0, 0, 0)

    // warm frontal fill so the fighters never become black silhouettes
    const front = new THREE.DirectionalLight(0xffc8a2, 2.15)
    front.position.set(9, 13, 24)
    s.add(front)
    s.add(front.target)
    front.target.position.set(0, 1, -4)

    // cool rim from the far side for contrast
    const rim = new THREE.DirectionalLight(0x6f8fd0, 1.0)
    rim.position.set(20, 12, -24)
    s.add(rim)
    s.add(rim.target)
    rim.target.position.set(0, 1, 4)

    // warm reflected fill from the sand
    const fill = new THREE.PointLight(0xff6a30, 22, 34, 2)
    fill.position.set(0, 7, 4)
    s.add(fill)
  }

  _sky() {
    const geo = new THREE.SphereGeometry(150, 40, 24)
    const mat = new THREE.MeshBasicMaterial({ map: this.tex.sky, side: THREE.BackSide, fog: false, depthWrite: false })
    const dome = new THREE.Mesh(geo, mat)
    dome.rotation.y = 2.4
    this.scene.add(dome)
    // sun disc glow sprite
    const glowTex = makeDustTexture()
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
    sp.position.set(-48, 26, -100)
    sp.scale.set(46, 46, 1)
    this.scene.add(sp)
  }

  _ground() {
    const sand = new THREE.MeshStandardMaterial({ map: this.tex.sand, roughness: 0.97, metalness: 0, color: 0x9f8a6b })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.halfX * 2, ARENA.halfZ * 2), sand)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    // dark blood-soaked ring at the edge
    const edgeTex = makeSandTexture()
    edgeTex.repeat.set(2, 2)
    const edge = new THREE.Mesh(new THREE.RingGeometry(0, 1, 48), new THREE.MeshBasicMaterial({ color: 0x1a0d08, transparent: true, opacity: 0.0 }))
    edge.visible = false
    this.scene.add(edge)

    // outside/understructure
    const dark = new THREE.MeshStandardMaterial({ color: 0x120b08, roughness: 1 })
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), dark)
    outer.rotation.x = -Math.PI / 2
    outer.position.y = -0.06
    outer.receiveShadow = true
    this.scene.add(outer)
  }

  _wallBlock(w, h, d, x, y, z, mapRepeat = null) {
    const mat = new THREE.MeshStandardMaterial({
      map: this.tex.stone, roughness: 0.95, metalness: 0.02, color: 0xa08d78
    })
    if (mapRepeat) {
      // shared texture; clone so repeats can differ
      const m = mat.clone()
      m.map = this.tex.stone.clone()
      m.map.needsUpdate = true
      m.map.repeat.set(mapRepeat[0], mapRepeat[1])
      mat.dispose()
      const b = mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z)
      this.scene.add(b)
      return b
    }
    const b = mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z)
    this.scene.add(b)
    return b
  }

  _walls() {
    const { halfX, halfZ, wallH } = ARENA
    const t = 0.7
    const wallMat = new THREE.MeshStandardMaterial({ map: this.tex.stone, roughness: 0.94, metalness: 0.02, color: 0x9b8874 })
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2a201a, roughness: 0.95 })
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x3b2b21, roughness: 0.9, metalness: 0.08 })

    const addWall = (w, h, d, x, y, z) => {
      const b = mesh(new THREE.BoxGeometry(w, h, d), wallMat, x, y, z)
      this.scene.add(b)
      return b
    }

    // side walls
    addWall(t, wallH, halfZ * 2 + t, -halfX - t / 2, wallH / 2, 0)
    addWall(t, wallH, halfZ * 2 + t, halfX + t / 2, wallH / 2, 0)
    // front wall
    addWall(halfX * 2 + t * 2, wallH, t, 0, wallH / 2, halfZ + t / 2)

    // back wall with three gate openings
    const gates = ARENA.gates
    const segs = []
    let cursor = -halfX - t / 2
    for (const gx of gates) {
      segs.push([cursor, gx - 1.75])
      cursor = gx + 1.75
    }
    segs.push([cursor, halfX + t / 2])
    for (const [a, b] of segs) {
      if (b - a < 0.1) continue
      addWall(b - a, wallH, t, (a + b) / 2, wallH / 2, -halfZ - t / 2)
    }
    // wall above gates
    for (const gx of gates) {
      addWall(3.5, wallH - 2.75, t, gx, 2.75 + (wallH - 2.75) / 2, -halfZ - t / 2)
    }

    // caps
    const cap = (w, d, x, z) => {
      const c = mesh(new THREE.BoxGeometry(w, 0.26, d), capMat, x, wallH + 0.13, z)
      this.scene.add(c)
    }
    cap(t + 0.3, halfZ * 2 + t, -halfX - t / 2, 0)
    cap(t + 0.3, halfZ * 2 + t, halfX + t / 2, 0)
    cap(halfX * 2 + t * 2, t + 0.3, 0, halfZ + t / 2)
    cap(halfX * 2 + t * 2, t + 0.3, 0, -halfZ - t / 2)

    // base skirt
    const skirt = new THREE.MeshStandardMaterial({ color: 0x241813, roughness: 1 })
    const skirtM = (w, d, x, z) => {
      const m = mesh(new THREE.BoxGeometry(w, 0.4, d), skirt, x, 0.2, z)
      this.scene.add(m)
    }
    skirtM(0.45, halfZ * 2, -halfX + 0.18, 0)
    skirtM(0.45, halfZ * 2, halfX - 0.18, 0)
    skirtM(halfX * 2, 0.45, 0, halfZ - 0.18)

    // pillars with torches
    const pillarGeo = new THREE.BoxGeometry(0.62, wallH + 0.9, 0.62)
    const pillarMats = []
    for (let i = 0; i < 8; i++) {
      const m = wallMat.clone()
      m.map = this.tex.stone.clone(); m.map.needsUpdate = true; m.map.repeat.set(1, 2)
      pillarMats.push(m)
    }
    let pi = 0
    const pillar = (x, z) => {
      const p = mesh(pillarGeo, pillarMats[pi++ % pillarMats.length], x, (wallH + 0.9) / 2, z)
      this.scene.add(p)
      const capG = mesh(new THREE.BoxGeometry(0.82, 0.18, 0.82), trimMat, x, wallH + 0.95, z)
      this.scene.add(capG)
    }
    for (const z of [-9, 0, 9]) { pillar(-halfX + 0.34, z); pillar(halfX - 0.34, z) }
    pillar(-halfX + 0.34, halfZ - 0.34); pillar(halfX - 0.34, halfZ - 0.34)

    // gate frames, portcullis and tunnel
    for (const gx of gates) {
      const frameMat = trimMat
      const f1 = mesh(new THREE.BoxGeometry(0.4, 3.0, 0.9), frameMat, gx - 1.95, 1.5, -halfZ)
      const f2 = mesh(new THREE.BoxGeometry(0.4, 3.0, 0.9), frameMat, gx + 1.95, 1.5, -halfZ)
      const top = mesh(new THREE.BoxGeometry(4.3, 0.55, 0.9), frameMat, gx, 3.05, -halfZ)
      this.scene.add(f1, f2, top)
      // dark tunnel
      const tunnel = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.7, 6), new THREE.MeshStandardMaterial({ color: 0x070504, roughness: 1 }))
      tunnel.position.set(gx, 1.35, -halfZ - 3.2)
      this.scene.add(tunnel)
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.5), new THREE.MeshBasicMaterial({ color: 0x050303 }))
      inner.position.set(gx, 1.3, -halfZ + 0.03)
      this.scene.add(inner)
      // portcullis bars
      const barMat = new THREE.MeshStandardMaterial({ color: 0x24211f, metalness: 0.75, roughness: 0.45 })
      for (let i = 0; i < 7; i++) {
        const bar = mesh(new THREE.BoxGeometry(0.075, 2.55, 0.075), barMat, gx - 1.35 + i * 0.45, 1.3, -halfZ - 0.18)
        this.scene.add(bar)
      }
      for (let j = 0; j < 2; j++) {
        const bar = mesh(new THREE.BoxGeometry(2.75, 0.07, 0.07), barMat, gx, 0.7 + j * 0.95, -halfZ - 0.18)
        this.scene.add(bar)
      }
      // torch inside gate
      this._addTorch(gx - 1.9, 2.6, -halfZ + 0.55, 0, 0, true)
    }
  }

  _stands() {
    const { halfX, halfZ, wallH } = ARENA
    const standMat = new THREE.MeshStandardMaterial({ map: this.tex.stone, color: 0x7e6b57, roughness: 1 })
    const underMat = new THREE.MeshStandardMaterial({ color: 0x140d0a, roughness: 1 })
    const tierH = 0.62, tierD = 1.05

    // dark outer mass
    const outerL = mesh(new THREE.BoxGeometry(4.2, wallH + 2.4, halfZ * 2 + 9), underMat, -halfX - 3.6, (wallH + 2.4) / 2, 0)
    const outerR = mesh(new THREE.BoxGeometry(4.2, wallH + 2.4, halfZ * 2 + 9), underMat, halfX + 3.6, (wallH + 2.4) / 2, 0)
    this.scene.add(outerL, outerR)

    const side = (sign) => {
      for (let i = 0; i < 3; i++) {
        const x = sign * (halfX + 0.58 + i * tierD)
        const top = wallH + 0.34 + i * tierH
        const step = mesh(new THREE.BoxGeometry(tierD, tierH, halfZ * 2 + 7), standMat, x, top - tierH / 2, 0)
        this.scene.add(step)
      }
    }
    side(-1); side(1)

    for (let i = 0; i < 3; i++) {
      const zBack = -halfZ - 0.58 - i * tierD
      const top = wallH + 0.34 + i * tierH
      this.scene.add(mesh(new THREE.BoxGeometry(halfX * 2 + 6, tierH, tierD), standMat, 0, top - tierH / 2, zBack))
      const zFront = halfZ + 0.58 + i * tierD
      this.scene.add(mesh(new THREE.BoxGeometry(halfX * 2 + 6, tierH, tierD), standMat, 0, top - tierH / 2, zFront))
    }

    // wooden rail in front of the first tier
    const railMat = new THREE.MeshStandardMaterial({ map: this.tex.wood, color: 0x8a6b4a, roughness: 0.9 })
    const rail = (w, d, x, z) => {
      const r = mesh(new THREE.BoxGeometry(w, 0.12, d), railMat, x, wallH + 0.9, z)
      this.scene.add(r)
      for (let k = -3; k <= 3; k++) {
        const post = mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), railMat, x + (w > d ? k * (w / 7) : 0), wallH + 0.45, z + (w > d ? 0 : k * (d / 7)))
        this.scene.add(post)
      }
    }
    rail(0.1, halfZ * 2 + 6, -halfX - 0.54, 0)
    rail(0.1, halfZ * 2 + 6, halfX + 0.54, 0)
  }

  _crowd() {
    const { halfX, halfZ, wallH } = ARENA
    const members = []
    const palette = [0x4d1f1a, 0x5c3320, 0x2d211a, 0x3b2a23, 0x6b2c22, 0x1f1a19, 0x533b28, 0x2b2f33, 0x6b5130, 0x3e1b1d]
    const skins = [0xc59a78, 0xa77a58, 0x8a5e40, 0x6e452e, 0xd1a887, 0x9b6c4f]
    const tierH = 0.62
    const add = (x, z, y, yaw) => members.push({ x, z, y, yaw, phase: rand(0, TAU), speed: rand(0.8, 1.6), palette: choice(palette), skin: choice(skins), height: rand(0.88, 1.1), girth: rand(0.85, 1.25) })

    // sides
    for (const sign of [-1, 1]) {
      for (let tier = 0; tier < 3; tier++) {
        const x = sign * (halfX + 0.62 + tier * 1.05)
        const y = wallH + 0.34 + tier * tierH
        for (let k = 0; k < 19; k++) {
          const z = -halfZ + 0.8 + k * ((halfZ * 2 - 1.6) / 18) + rand(-0.3, 0.3)
          add(x + rand(-0.12, 0.12), z, y, sign > 0 ? -Math.PI / 2 : Math.PI / 2)
        }
      }
    }
    // back + front
    for (const sign of [-1, 1]) {
      for (let tier = 0; tier < 3; tier++) {
        const z = sign * (halfZ + 0.62 + tier * 1.05) + sign * 0.15
        const y = wallH + 0.34 + tier * tierH
        for (let k = 0; k < 16; k++) {
          const x = -halfX + 0.7 + k * ((halfX * 2 - 1.4) / 15) + rand(-0.35, 0.35)
          add(x, z + rand(-0.12, 0.12), y, sign > 0 ? Math.PI : 0)
        }
      }
    }

    this.crowd = members
    const n = members.length
    const bodyGeo = new THREE.CylinderGeometry(0.155, 0.23, 0.58, 6)
    const headGeo = new THREE.SphereGeometry(0.13, 8, 6)
    const armGeo = new THREE.CapsuleGeometry(0.042, 0.28, 2, 5)
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
    const armMat = new THREE.MeshLambertMaterial({ color: 0xffffff })

    this.crowdBody = new THREE.InstancedMesh(bodyGeo, bodyMat, n)
    this.crowdHead = new THREE.InstancedMesh(headGeo, headMat, n)
    this.crowdArmL = new THREE.InstancedMesh(armGeo, armMat, n)
    this.crowdArmR = new THREE.InstancedMesh(armGeo, armMat, n)
    for (const im of [this.crowdBody, this.crowdHead, this.crowdArmL, this.crowdArmR]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      im.frustumCulled = false
      im.castShadow = false
      im.receiveShadow = false
      this.scene.add(im)
    }
    const col = new THREE.Color()
    members.forEach((m, i) => {
      col.setHex(m.palette); this.crowdBody.setColorAt(i, col)
      col.setHex(m.skin); this.crowdHead.setColorAt(i, col); this.crowdArmL.setColorAt(i, col); this.crowdArmR.setColorAt(i, col)
    })
    this.crowdBody.instanceColor.needsUpdate = true
    this.crowdHead.instanceColor.needsUpdate = true
    this.crowdArmL.instanceColor.needsUpdate = true
    this.crowdArmR.instanceColor.needsUpdate = true

    this._dummy = new THREE.Object3D()
    this._q = new THREE.Quaternion()
    this._qy = new THREE.Quaternion()
    this._armQ = new THREE.Quaternion()
    this.crowdEnergy = 0.05
    this.crowdTarget = 0.05
    this._updateCrowd(0)
  }

  cheer(amount) {
    this.crowdTarget = clamp(this.crowdTarget + amount, 0.05, 1.4)
    this._cheerHold = Math.max(this._cheerHold || 0, amount > 0.35 ? 1.8 : 0.8)
  }

  _updateCrowd(dt) {
    const dummy = this._dummy
    const q = this._q, qy = this._qy, armQ = this._armQ
    const t = this.time
    const energy = this.crowdTarget
    const members = this.crowd
    for (let i = 0; i < members.length; i++) {
      const m = members[i]
      const cheer = clamp(energy * (0.35 + 0.65 * Math.abs(Math.sin(t * m.speed * 2.2 + m.phase))), 0, 1.4)
      const jump = Math.max(0, Math.sin(t * (3.2 + m.speed) + m.phase)) ** 3 * cheer * 0.28
      const sway = Math.sin(t * 0.9 + m.phase) * 0.012
      const px = m.x + sway
      const py = m.y + jump
      const pz = m.z
      qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.yaw)

      // body
      dummy.position.set(px, py + 0.35 * m.height, pz)
      dummy.quaternion.copy(qy)
      dummy.scale.set(m.girth, m.height, m.girth)
      dummy.updateMatrix()
      this.crowdBody.setMatrixAt(i, dummy.matrix)

      // head, lean toward the sand
      dummy.position.set(px, py + 0.72 * m.height, pz)
      dummy.quaternion.copy(qy)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      this.crowdHead.setMatrixAt(i, dummy.matrix)

      // arms: pivot at shoulder, capsules point down by default, rotate up when cheering
      const raise = clamp(cheer * 1.25, 0, 1)
      const swing = Math.sin(t * 5 + m.phase) * 0.4 * raise
      for (const side of [-1, 1]) {
        const ax = px + Math.cos(m.yaw) * side * 0.2 * m.girth
        const az = pz - Math.sin(m.yaw) * side * 0.2 * m.girth
        const ay = py + 0.55 * m.height
        dummy.position.set(ax, ay, az)
        q.setFromEuler(new THREE.Euler(side * (0.15 + raise * 2.05 + swing), m.yaw, 0, 'YXZ'))
        dummy.quaternion.copy(q)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        if (side < 0) this.crowdArmL.setMatrixAt(i, dummy.matrix)
        else this.crowdArmR.setMatrixAt(i, dummy.matrix)
      }
    }
    this.crowdBody.instanceMatrix.needsUpdate = true
    this.crowdHead.instanceMatrix.needsUpdate = true
    this.crowdArmL.instanceMatrix.needsUpdate = true
    this.crowdArmR.instanceMatrix.needsUpdate = true
    this.crowdEnergy = energy
  }

  _addTorch(x, y, z, rotX = 0, rotY = 0, withLight = false) {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    const wood = new THREE.MeshStandardMaterial({ map: this.tex.wood, color: 0x9a7550, roughness: 0.9 })
    const iron = new THREE.MeshStandardMaterial({ color: 0x2c2825, metalness: 0.7, roughness: 0.5 })
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.66, 6), wood)
    handle.rotation.z = 0.16
    handle.castShadow = true
    g.add(handle)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 4, 8), iron)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.2
    g.add(ring)
    const flameMat = new THREE.SpriteMaterial({ map: this.tex.flame, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 })
    const flame = new THREE.Sprite(flameMat)
    flame.position.set(0.06, 0.42, 0)
    flame.scale.set(0.3, 0.62, 1)
    g.add(flame)
    const coreMat = new THREE.SpriteMaterial({ map: this.tex.flame, color: 0xfff1c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 })
    const core = new THREE.Sprite(coreMat)
    core.position.set(0.06, 0.4, 0.03)
    core.scale.set(0.16, 0.36, 1)
    g.add(core)
    let light = null
    if (withLight) {
      light = new THREE.PointLight(0xff7a30, 16, 11, 2)
      light.position.set(0.1, 0.48, 0)
      g.add(light)
    }
    g.rotation.x = rotX
    g.rotation.y = rotY
    this.scene.add(g)
    this.torches.push({ group: g, flame, core, light, phase: rand(0, TAU), baseY: 0.42 })
  }

  _torches() {
    const { halfX, halfZ } = ARENA
    // braziers along side walls
    for (const z of [-11, -4, 3, 10]) {
      this._addTorch(-halfX + 0.55, 2.25, z, 0, Math.PI / 2, true)
      this._addTorch(halfX - 0.55, 2.25, z, 0, -Math.PI / 2, false)
    }
    for (const x of [-9, 9]) {
      this._addTorch(x, 2.25, halfZ - 0.55, 0, Math.PI, true)
      this._addTorch(x, 2.25, -halfZ + 0.55, 0, 0, true)
    }
    // standing braziers at corners
    for (const [x, z] of [[-10.5, 13.8], [10.5, 13.8]]) {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      const iron = new THREE.MeshStandardMaterial({ color: 0x2a2522, metalness: 0.72, roughness: 0.45 })
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.35, 6), iron)
      pole.position.y = 0.68; pole.castShadow = true
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.18, 0.26, 8), iron)
      bowl.position.y = 1.42; bowl.castShadow = true
      g.add(pole, bowl)
      const mat = new THREE.SpriteMaterial({ map: this.tex.flame, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 })
      const fl = new THREE.Sprite(mat); fl.position.y = 1.78; fl.scale.set(0.8, 1.5, 1); g.add(fl)
      const light = new THREE.PointLight(0xff7b32, 22, 13, 2)
      light.position.y = 1.9; g.add(light)
      this.scene.add(g)
      this.torches.push({ group: g, flame: fl, core: null, light, phase: rand(0, TAU), baseY: 1.78, big: true })
    }
  }

  _banners() {
    const mat = new THREE.MeshStandardMaterial({
      map: this.tex.emblem, transparent: true, side: THREE.DoubleSide, roughness: 1,
      color: 0xc9a15f, alphaTest: 0.02
    })
    const cloth = new THREE.MeshStandardMaterial({ map: this.tex.cloth, side: THREE.DoubleSide, roughness: 1, color: 0x9a6f5c })
    const positions = [
      { x: -12.55, y: 2.2, z: -8, ry: Math.PI / 2 },
      { x: -12.55, y: 2.2, z: 6, ry: Math.PI / 2 },
      { x: 12.55, y: 2.2, z: -8, ry: -Math.PI / 2 },
      { x: 12.55, y: 2.2, z: 6, ry: -Math.PI / 2 },
      { x: -4.6, y: 2.25, z: 16.55, ry: Math.PI },
      { x: 4.6, y: 2.25, z: 16.55, ry: Math.PI }
    ]
    for (const p of positions) {
      const g = new THREE.Group()
      g.position.set(p.x, p.y, p.z)
      g.rotation.y = p.ry
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.7, 5), new THREE.MeshStandardMaterial({ color: 0x2b2119, roughness: 0.9 }))
      pole.position.y = 0.25
      g.add(pole)
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.25, 6, 8), cloth)
      banner.position.set(0, 0.1, 0.03)
      banner.castShadow = true
      const emblem = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.18), mat)
      emblem.position.set(0, 0.28, 0.055)
      g.add(banner, emblem)
      this.scene.add(g)
      this.banners.push({ group: g, banner, emblem, phase: rand(0, TAU) })
    }
  }

  _details() {
    // scattered bones near the walls
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xa69472, roughness: 0.85 })
    const boneGeo = new THREE.CylinderGeometry(0.025, 0.018, rand(0.3, 0.5), 5)
    const count = 70
    const inst = new THREE.InstancedMesh(boneGeo, boneMat, count)
    inst.castShadow = true
    const d = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const side = randInt(0, 3)
      let x, z
      if (side === 0) { x = rand(-12, 12); z = rand(-16, -13.6) }
      else if (side === 1) { x = rand(-12, 12); z = rand(13.6, 16) }
      else if (side === 2) { x = rand(-12.4, -10.4); z = rand(-15, 15) }
      else { x = rand(10.4, 12.4); z = rand(-15, 15) }
      d.position.set(x, 0.035, z)
      d.rotation.set(rand(-0.2, 0.2), rand(0, TAU), Math.PI / 2 + rand(-0.2, 0.2))
      d.scale.set(1, 1, rand(0.8, 1.6))
      d.updateMatrix()
      inst.setMatrixAt(i, d.matrix)
    }
    this.scene.add(inst)

    // skulls
    const skullMat = new THREE.MeshStandardMaterial({ color: 0xb3a17c, roughness: 0.8 })
    const jawMat = new THREE.MeshStandardMaterial({ color: 0x9c8a66, roughness: 0.9 })
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group()
      const side = randInt(0, 3)
      let x, z
      if (side === 0) { x = rand(-11.5, 11.5); z = rand(-15.8, -13.8) }
      else if (side === 1) { x = rand(-11.5, 11.5); z = rand(13.8, 15.8) }
      else if (side === 2) { x = rand(-12, -10.6); z = rand(-14, 14) }
      else { x = rand(10.6, 12); z = rand(-14, 14) }
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skullMat)
      skull.scale.set(0.9, 1, 1.05); skull.castShadow = true
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.09), jawMat)
      jaw.position.set(0, -0.1, 0.025)
      g.add(skull, jaw)
      g.position.set(x, 0.1, z)
      g.rotation.set(rand(-0.4, 0.2), rand(0, TAU), rand(-0.2, 0.2))
      this.scene.add(g)
    }

    // weapon rack at the front wall
    const rackMat = new THREE.MeshStandardMaterial({ map: this.tex.wood, color: 0x8b6744, roughness: 0.9 })
    const metal = new THREE.MeshStandardMaterial({ color: 0x7f7d78, metalness: 0.8, roughness: 0.4 })
    for (const side of [-1, 1]) {
      const g = new THREE.Group()
      g.position.set(side * 8.7, 0, 15.4)
      g.rotation.y = Math.PI
      for (let i = -1; i <= 1; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.4, 0.09), rackMat)
        post.position.set(i * 0.55, 0.7, 0); post.castShadow = true; g.add(post)
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.08), rackMat)
      bar.position.y = 1.1; g.add(bar)
      for (let i = -1; i <= 1; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.75, 0.012), metal)
        blade.position.set(i * 0.5, 1.45, 0.03); blade.rotation.z = rand(-0.08, 0.08); g.add(blade)
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 5), new THREE.MeshStandardMaterial({ color: 0x3a2416 }))
        grip.position.set(i * 0.5, 1.02, 0.03); g.add(grip)
      }
      this.scene.add(g)
    }
  }

  _dust() {
    const n = 700
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    this.dustData = []
    for (let i = 0; i < n; i++) {
      const x = rand(-14, 14), y = rand(0.2, 7.5), z = rand(-18, 18)
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
      this.dustData.push({ x, y, z, p: rand(0, TAU), s: rand(0.04, 0.16), v: rand(0.03, 0.13) })
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      map: this.tex.dust, size: 0.075, transparent: true, opacity: 0.32,
      depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd7a0, sizeAttenuation: true
    })
    this.dust = new THREE.Points(geo, mat)
    this.dust.frustumCulled = false
    this.scene.add(this.dust)
  }

  update(dt, camera) {
    this.time += dt
    // torch flicker
    for (const t of this.torches) {
      const f = 0.78 + Math.sin(this.time * 8.3 + t.phase) * 0.12 + Math.sin(this.time * 17.7 + t.phase * 2.1) * 0.07 + Math.random() * 0.04
      if (t.light) t.light.intensity = (t.big ? 22 : 15) * f
      t.flame.scale.x = (t.big ? 0.8 : 0.3) * (0.9 + f * 0.18)
      t.flame.scale.y = (t.big ? 1.5 : 0.62) * (0.88 + f * 0.24)
      t.flame.material.opacity = 0.78 + f * 0.2
      t.flame.position.y = t.baseY + Math.sin(this.time * 6 + t.phase) * 0.012
      if (t.core) {
        t.core.scale.y = 0.36 * (0.85 + f * 0.3)
        t.core.material.opacity = 0.7 + f * 0.25
      }
    }
    // banners
    for (const b of this.banners) {
      const w = Math.sin(this.time * 1.6 + b.phase) * 0.045 + Math.sin(this.time * 3.1 + b.phase) * 0.015
      b.banner.rotation.y = w
      b.emblem.rotation.y = w * 0.9
      b.banner.rotation.x = Math.sin(this.time * 1.1 + b.phase) * 0.02
      b.emblem.rotation.x = b.banner.rotation.x
    }
    // crowd energy decay
    this.crowdTarget = lerp(this.crowdTarget, 0.055, 1 - Math.exp(-dt * 0.62))
    this._updateCrowd(dt)
    // dust
    const arr = this.dust.geometry.attributes.position.array
    for (let i = 0; i < this.dustData.length; i++) {
      const d = this.dustData[i]
      d.y += d.v * dt
      d.x += Math.sin(this.time * 0.4 + d.p) * 0.06 * dt
      if (d.y > 8.5) { d.y = 0.1; d.x = rand(-14, 14); d.z = rand(-18, 18) }
      arr[i * 3] = d.x; arr[i * 3 + 1] = d.y; arr[i * 3 + 2] = d.z
    }
    this.dust.geometry.attributes.position.needsUpdate = true
    this.dust.material.opacity = 0.24 + Math.sin(this.time * 0.8) * 0.04
  }
}
