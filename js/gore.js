import * as THREE from 'three'
import { makeSplatTexture, makeSplashTexture } from './textures.js'

const MAX_PARTICLES = 1100
const MAX_GROUND_SPLATS = 380
const MAX_WALL_SPLATS = 180

const BLOOD_COLORS = [0x5e0809, 0x740a0b, 0x8a0e0e, 0x67090a]

function randomRange(min, max) {
  return min + Math.random() * (max - min)
}

function tint(index) {
  return new THREE.Color(BLOOD_COLORS[index % BLOOD_COLORS.length]).multiplyScalar(randomRange(0.8, 1.15))
}

export function createGore(scene, arena, contactShadowTexture) {
  const root = new THREE.Group()
  root.name = 'gore-debris'
  scene.add(root)

  const splatTexture = makeSplatTexture()
  const splashTexture = makeSplashTexture()

  // ---------------- Blood particles ----------------
  const particleGeo = new THREE.BufferGeometry()
  const positions = new Float32Array(MAX_PARTICLES * 3)
  const sizes = new Float32Array(MAX_PARTICLES)
  const alphas = new Float32Array(MAX_PARTICLES)
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  particleGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  particleGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))

  const particleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * 380.0 / max(0.5, -mv.z), 1.0, 64.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.08, d) * vAlpha;
        vec3 col = mix(vec3(0.28, 0.008, 0.01), vec3(0.72, 0.04, 0.035), smoothstep(0.1, 0.5, a));
        gl_FragColor = vec4(col, a);
      }
    `
  })
  const points = new THREE.Points(particleGeo, particleMat)
  points.frustumCulled = false
  points.renderOrder = 6
  scene.add(points)

  const particles = []
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, size: 0.05, ground: false })
  }
  let particleCursor = 0

  // ---------------- Decals ----------------
  const groundGeo = new THREE.PlaneGeometry(1, 1)
  groundGeo.rotateX(-Math.PI / 2)
  const groundMat = new THREE.MeshBasicMaterial({
    map: splatTexture,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    color: 0xffffff,
    polygonOffset: true,
    polygonOffsetFactor: -2
  })
  const groundSplats = new THREE.InstancedMesh(groundGeo, groundMat, MAX_GROUND_SPLATS)
  groundSplats.count = 0
  groundSplats.frustumCulled = false
  groundSplats.renderOrder = 2
  scene.add(groundSplats)
  let groundCount = 0

  const wallGeo = new THREE.PlaneGeometry(1, 1)
  const wallMat = new THREE.MeshBasicMaterial({
    map: splatTexture,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    color: 0xffffff,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2
  })
  const wallSplats = new THREE.InstancedMesh(wallGeo, wallMat, MAX_WALL_SPLATS)
  wallSplats.count = 0
  wallSplats.frustumCulled = false
  wallSplats.renderOrder = 2
  scene.add(wallSplats)
  let wallCount = 0

  const dummy = new THREE.Object3D()
  const quatY = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)

  function addGroundSplat(x, z, scale = 1) {
    if (groundCount >= MAX_GROUND_SPLATS) return
    const radius = Math.hypot(x, z)
    if (radius > arena.wallRadius) return
    const distance = scale * randomRange(1.15, 2.2)
    dummy.position.set(x + randomRange(-0.2, 0.2), 0.03 + groundCount * 0.00004, z + randomRange(-0.2, 0.2))
    quatY.setFromAxisAngle(up, Math.random() * Math.PI * 2)
    dummy.quaternion.copy(quatY)
    dummy.scale.set(distance, 1, distance)
    dummy.updateMatrix()
    groundSplats.setMatrixAt(groundCount, dummy.matrix)
    groundSplats.setColorAt(groundCount, tint(groundCount))
    groundCount++
    groundSplats.count = groundCount
    groundSplats.instanceMatrix.needsUpdate = true
    if (groundSplats.instanceColor) groundSplats.instanceColor.needsUpdate = true
  }

  function addWallSplat(x, z, y, scale = 1) {
    if (wallCount >= MAX_WALL_SPLATS) return
    const angle = Math.atan2(x, z)
    const radius = arena.wallRadius - 0.18
    dummy.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius)
    dummy.rotation.set(0, angle + Math.PI, randomRange(-0.35, 0.35))
    const distance = scale * randomRange(0.85, 1.75)
    dummy.scale.set(distance, distance, 1)
    dummy.updateMatrix()
    wallSplats.setMatrixAt(wallCount, dummy.matrix)
    wallSplats.setColorAt(wallCount, tint(wallCount + 2))
    wallCount++
    wallSplats.count = wallCount
    wallSplats.instanceMatrix.needsUpdate = true
    if (wallSplats.instanceColor) wallSplats.instanceColor.needsUpdate = true
  }

  function wallSplashFrom(position, direction, strength = 1) {
    // Where the spray would meet the arena wall.
    const ox = position.x
    const oz = position.z
    const dx = direction.x
    const dz = direction.z
    const R = arena.wallRadius - 0.4
    const a = dx * dx + dz * dz
    if (a < 0.0001) return
    const b = 2 * (ox * dx + oz * dz)
    const c = ox * ox + oz * oz - R * R
    const disc = b * b - 4 * a * c
    if (disc < 0) return
    const t = (-b + Math.sqrt(disc)) / (2 * a)
    if (t < 0.4 || t > 9) return
    const x = ox + dx * t
    const z = oz + dz * t
    const y = THREE.MathUtils.clamp(position.y + direction.y * t * 0.4 + randomRange(-0.25, 0.6), 0.35, 3.2)
    const count = Math.max(1, Math.round(strength * randomRange(1, 3)))
    for (let i = 0; i < count; i++) addWallSplat(x + randomRange(-0.55, 0.55), z + randomRange(-0.55, 0.55), y + randomRange(-0.3, 0.4), randomRange(0.5, 1.05) * strength)
  }

  // ---------------- Debris ----------------
  const debris = []

  function addDebris(object, { velocity = new THREE.Vector3(), spin = new THREE.Vector3(), life = 45, contact = 0 } = {}) {
    if (!object) return null
    root.attach(object)
    object.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    const item = {
      object,
      velocity: velocity.clone(),
      spin: spin.clone(),
      life,
      age: 0,
      contact,
      settled: false
    }
    debris.push(item)
    return item
  }

  function spawnGuts(position, direction) {
    const colors = [0x9c3f48, 0xb8565d, 0x7b2d36, 0xc06a6a, 0x8c2f2d]
    const blobGeo = new THREE.IcosahedronGeometry(0.11, 1)
    const ropeGeo = new THREE.CapsuleGeometry(0.035, 0.38, 2, 6)
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.55,
        metalness: 0.02
      })
      const isRope = i % 4 === 0
      const blob = new THREE.Mesh(isRope ? ropeGeo : blobGeo, mat)
      blob.scale.set(randomRange(0.7, 1.6), randomRange(0.65, 1.3), randomRange(0.7, 1.5))
      blob.position.set(
        position.x + randomRange(-0.16, 0.16),
        position.y + randomRange(-0.15, 0.2),
        position.z + randomRange(-0.16, 0.16)
      )
      blob.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      const spread = 1.5
      const vel = new THREE.Vector3(
        direction.x * randomRange(0.4, 2.2) + randomRange(-spread, spread),
        randomRange(0.8, 2.6),
        direction.z * randomRange(0.4, 2.2) + randomRange(-spread, spread)
      )
      blob.castShadow = true
      scene.add(blob)
      root.attach(blob)
      debris.push({ object: blob, velocity: vel, spin: new THREE.Vector3(randomRange(-6, 6), randomRange(-6, 6), randomRange(-6, 6)), life: 45, age: 0, settled: false })
    }
    addGroundSplat(position.x, position.z, 2.6)
    addGroundSplat(position.x + direction.x * 1.1, position.z + direction.z * 1.1, 1.9)
    spawnBlood(position, direction, 40, { arterial: true, speed: 3 })
    wallSplashFrom(position, direction, 1.6)
  }

  function spawnBlood(position, direction, amount = 16, { arterial = false, speed = 1, colorSeed = 0 } = {}) {
    const count = Math.max(1, Math.min(80, Math.round(amount)))
    for (let i = 0; i < count; i++) {
      const p = particles[particleCursor]
      particleCursor = (particleCursor + 1) % MAX_PARTICLES
      p.life = randomRange(0.45, arterial ? 1.15 : 0.8)
      p.maxLife = p.life
      p.vx = direction.x * randomRange(0.4, arterial ? 4.6 : 2.5) * speed + randomRange(-1.6, 1.6)
      p.vz = direction.z * randomRange(0.4, arterial ? 4.6 : 2.5) * speed + randomRange(-1.6, 1.6)
      p.vy = randomRange(0.4, arterial ? 4.2 : 2.6)
      p.size = randomRange(0.05, arterial ? 0.22 : 0.14)
      p.ground = false
      const idx = particleCursor === 0 ? MAX_PARTICLES - 1 : particleCursor - 1
      positions[idx * 3] = position.x + randomRange(-0.08, 0.08)
      positions[idx * 3 + 1] = position.y + randomRange(-0.12, 0.12)
      positions[idx * 3 + 2] = position.z + randomRange(-0.08, 0.08)
      sizes[idx] = p.size
      alphas[idx] = 1
    }
    particleGeo.attributes.position.needsUpdate = true
    particleGeo.attributes.aSize.needsUpdate = true
    particleGeo.attributes.aAlpha.needsUpdate = true
  }

  function splatter(position, direction, power = 1) {
    spawnBlood(position, direction, 12 + power * 10, { speed: 1 + power * 0.35 })
    const spread = 0.9 + power * 0.6
    addGroundSplat(position.x + randomRange(-spread, spread), position.z + randomRange(-spread, spread), 1.15 + power * 0.95)
    addGroundSplat(position.x + direction.x * 0.9, position.z + direction.z * 0.9, 0.85 + power * 0.8)
    wallSplashFrom(position, direction, power)
  }

  function addCorpsePool(position, scale = 1.6) {
    addGroundSplat(position.x, position.z, scale * 1.9)
    addGroundSplat(position.x + randomRange(-0.55, 0.55), position.z + randomRange(-0.55, 0.55), scale * 1.35)
    addGroundSplat(position.x + randomRange(-0.9, 0.9), position.z + randomRange(-0.9, 0.9), scale * 0.8)
  }

  function spawnBone(position, velocity = new THREE.Vector3(0, 1, 0)) {
    const bone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.04, 0.24, 6),
      new THREE.MeshStandardMaterial({ color: 0xefe5cc, roughness: 0.72 })
    )
    bone.position.copy(position)
    bone.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
    bone.castShadow = true
    scene.add(bone)
    addDebris(bone, { velocity, spin: new THREE.Vector3(randomRange(-8, 8), randomRange(-8, 8), randomRange(-8, 8)), life: 45 })
  }

  function clear() {
    for (const item of debris) {
      if (item.object.parent) item.object.parent.remove(item.object)
    }
    debris.length = 0
    for (const p of particles) {
      p.life = 0
    }
    alphas.fill(0)
    particleGeo.attributes.aAlpha.needsUpdate = true
    groundCount = 0
    wallCount = 0
    groundSplats.count = 0
    wallSplats.count = 0
  }

  function update(dt) {
    // Particles.
    let dirty = false
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i]
      if (p.life <= 0) {
        if (alphas[i] !== 0) {
          alphas[i] = 0
          dirty = true
        }
        continue
      }
      p.life -= dt
      if (p.life <= 0) {
        alphas[i] = 0
        dirty = true
        continue
      }
      const idx = i
      const drag = Math.pow(0.12, dt)
      p.vx *= drag
      p.vz *= drag
      p.vy -= 12 * dt
      positions[idx * 3] += p.vx * dt
      positions[idx * 3 + 1] += p.vy * dt
      positions[idx * 3 + 2] += p.vz * dt
      const radius = Math.hypot(positions[idx * 3], positions[idx * 3 + 2])
      if (positions[idx * 3 + 1] <= 0.03 && p.vy < 0) {
        if (Math.random() < 0.075) addGroundSplat(positions[idx * 3], positions[idx * 3 + 2], randomRange(0.2, 0.5))
        p.life = 0
        alphas[idx] = 0
      } else if (radius > arena.wallRadius - 0.2 && Math.random() < 0.09) {
        addWallSplat(positions[idx * 3], positions[idx * 3 + 2], positions[idx * 3 + 1], randomRange(0.2, 0.45))
        p.life = 0
        alphas[idx] = 0
      } else {
        alphas[idx] = Math.min(1, p.life / Math.max(0.1, p.maxLife * 0.55))
      }
      dirty = true
    }
    if (dirty) {
      particleGeo.attributes.position.needsUpdate = true
      particleGeo.attributes.aAlpha.needsUpdate = true
      particleGeo.attributes.aSize.needsUpdate = true
    }

    // Debris physics.
    for (let i = debris.length - 1; i >= 0; i--) {
      const item = debris[i]
      item.age += dt
      if (item.age > item.life) {
        if (item.object.parent) item.object.parent.remove(item.object)
        debris.splice(i, 1)
        continue
      }
      if (item.settled) continue
      const obj = item.object
      item.velocity.y -= 16 * dt
      obj.position.x += item.velocity.x * dt
      obj.position.y += item.velocity.y * dt
      obj.position.z += item.velocity.z * dt
      obj.rotation.x += item.spin.x * dt
      obj.rotation.y += item.spin.y * dt
      obj.rotation.z += item.spin.z * dt
      const radius = Math.hypot(obj.position.x, obj.position.z)
      if (radius > arena.wallRadius - 0.5) {
        const scale = (arena.wallRadius - 0.5) / radius
        obj.position.x *= scale
        obj.position.z *= scale
        item.velocity.x *= -0.25
        item.velocity.z *= -0.25
      }
      if (obj.position.y <= 0.08) {
        obj.position.y = 0.08
        if (Math.abs(item.velocity.y) > 1.4) {
          item.velocity.y *= -0.24
          item.velocity.x *= 0.55
          item.velocity.z *= 0.55
          item.spin.multiplyScalar(0.5)
          if (Math.random() < 0.4) addGroundSplat(obj.position.x, obj.position.z, randomRange(0.15, 0.4))
        } else {
          item.settled = true
          item.velocity.set(0, 0, 0)
          item.spin.multiplyScalar(0.2)
        }
      }
    }
  }

  return {
    root,
    spawnBlood,
    splatter,
    wallSplashFrom,
    addGroundSplat,
    addWallSplat,
    addCorpsePool,
    addDebris,
    spawnGuts,
    spawnBone,
    clear,
    update,
    get counts() {
      return { ground: groundCount, wall: wallCount, debris: debris.length }
    },
    splatTexture,
    splashTexture
  }
}
