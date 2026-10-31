import * as THREE from 'three'

const TAU = Math.PI * 2

const TUNICS = [0x7b2222, 0x2d4b72, 0x3d5b33, 0x8a6a25, 0x5a2e60, 0x2b5f61, 0x8b4a27, 0x6b6b6b]
const SKINS = [0xb9825c, 0x8d5a3b, 0xd2a17b, 0x6b432c, 0xc08b63]

function pick(array, rnd) {
  return array[Math.floor(rnd() * array.length)]
}

export function createCrowd(arena) {
  const rnd = (() => {
    let s = 1234567
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    }
  })()

  const people = []
  const centre = new THREE.Vector3()
  const tiers = 5
  for (let tier = 0; tier < tiers; tier++) {
    const radius = 19.1 + tier * 1.75 + 1.0
    const y = 3.9 + tier * 0.98 + 0.26
    const count = Math.min(96, Math.max(60, Math.floor((TAU * radius) / 1.45)))
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + (rnd() - 0.5) * 0.1
      const towardCenter = angle + Math.PI
      const scale = 0.85 + rnd() * 0.35
      people.push({
        x: Math.sin(angle) * radius,
        y: y + rnd() * 0.12,
        z: Math.cos(angle) * radius,
        angle: towardCenter,
        scale,
        phase: rnd() * TAU,
        speed: 0.7 + rnd() * 0.7,
        jump: rnd() > 0.72,
        bodyColor: new THREE.Color(pick(TUNICS, rnd)),
        skinColor: new THREE.Color(pick(SKINS, rnd))
      })
    }
  }

  const bodyGeo = new THREE.CylinderGeometry(0.15, 0.22, 0.46, 6)
  const headGeo = new THREE.SphereGeometry(0.105, 8, 6)
  const armGeo = new THREE.BoxGeometry(0.06, 0.34, 0.06)
  armGeo.translate(0, -0.17, 0)

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
  const armMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })

  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, people.length)
  const heads = new THREE.InstancedMesh(headGeo, headMat, people.length)
  const arms = new THREE.InstancedMesh(armGeo, armMat, people.length * 2)
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  arms.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  bodies.frustumCulled = false
  heads.frustumCulled = false
  arms.frustumCulled = false

  const matrix = new THREE.Matrix4()
  const quat = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  const armQuat = new THREE.Quaternion()
  const armMatrix = new THREE.Matrix4()
  const up = new THREE.Vector3(0, 1, 0)

  for (let i = 0; i < people.length; i++) {
    const p = people[i]
    bodies.setColorAt(i, p.bodyColor)
    heads.setColorAt(i, p.skinColor)
    arms.setColorAt(i * 2, p.bodyColor)
    arms.setColorAt(i * 2 + 1, p.bodyColor)
    quat.setFromAxisAngle(up, p.angle)
    scl.set(p.scale, p.scale, p.scale)

    matrix.compose(pos.set(p.x, p.y, p.z), quat, scl)
    bodies.setMatrixAt(i, matrix)

    matrix.compose(pos.set(p.x, p.y + 0.37 * p.scale, p.z), quat, scl)
    heads.setMatrixAt(i, matrix)

    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1
      const offsetX = Math.cos(p.angle) * 0.17 * sign
      const offsetZ = -Math.sin(p.angle) * 0.17 * sign
      armQuat.setFromEuler(new THREE.Euler(0, p.angle, sign * 0.18))
      armMatrix.compose(
        pos.set(p.x + offsetX, p.y + 0.16 * p.scale, p.z + offsetZ),
        armQuat,
        scl
      )
      arms.setMatrixAt(i * 2 + side, armMatrix)
    }
    p.armSide = i * 2
  }
  bodies.instanceMatrix.needsUpdate = true
  heads.instanceMatrix.needsUpdate = true
  arms.instanceMatrix.needsUpdate = true
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true
  if (arms.instanceColor) arms.instanceColor.needsUpdate = true

  const group = new THREE.Group()
  group.add(bodies, heads, arms)
  arena.group.add(group)

  let cheerEnergy = 0
  let cheerTime = 0
  let armsRaised = false
  const cheerDuration = 2.6

  return {
    group,
    count: people.length,
    cheer(strength = 1) {
      cheerEnergy = Math.min(1.4, cheerEnergy + strength)
      cheerTime = cheerDuration
    },
    update(dt, time) {
      cheerTime = Math.max(0, cheerTime - dt)
      const target = cheerTime > 0 ? Math.min(1.25, cheerEnergy) : 0
      cheerEnergy += (target - cheerEnergy) * Math.min(1, dt * 5)
      const energy = cheerEnergy
      const raised = energy > 0.25

      if (raised !== armsRaised) {
        armsRaised = raised
        for (let i = 0; i < people.length; i++) {
          const p = people[i]
          for (let side = 0; side < 2; side++) {
            const sign = side === 0 ? -1 : 1
            const offsetX = Math.cos(p.angle) * 0.17 * sign
            const offsetZ = -Math.sin(p.angle) * 0.17 * sign
            const zRot = raised ? -sign * (2.15 + 0.22 * Math.sin(time * 9 + p.phase)) : sign * 0.18
            armQuat.setFromEuler(new THREE.Euler(0, p.angle, zRot))
            armMatrix.compose(
              pos.set(p.x + offsetX, p.y + 0.16 * p.scale, p.z + offsetZ),
              armQuat,
              scl.set(p.scale, p.scale, p.scale)
            )
            arms.setMatrixAt(p.armSide + side, armMatrix)
          }
        }
        arms.instanceMatrix.needsUpdate = true
      }

      for (let i = 0; i < people.length; i++) {
        const p = people[i]
        const bob = Math.sin(time * p.speed * 1.6 + p.phase) * (0.018 + energy * 0.055)
        let jump = 0
        if (energy > 0.15 && p.jump) {
          const jumpWave = Math.max(0, Math.sin(time * 7.5 + p.phase * 2.3))
          jump = jumpWave * energy * 0.16
        }
        quat.setFromAxisAngle(up, p.angle)
        scl.set(p.scale, p.scale, p.scale)
        matrix.compose(pos.set(p.x, p.y + bob + jump, p.z), quat, scl)
        bodies.setMatrixAt(i, matrix)
        matrix.compose(pos.set(p.x, p.y + 0.37 * p.scale + bob + jump, p.z), quat, scl)
        heads.setMatrixAt(i, matrix)
        if (raised) {
          for (let side = 0; side < 2; side++) {
            const sign = side === 0 ? -1 : 1
            const offsetX = Math.cos(p.angle) * 0.17 * sign
            const offsetZ = -Math.sin(p.angle) * 0.17 * sign
            const zRot = -sign * (2.15 + 0.22 * Math.sin(time * 9 + p.phase))
            armQuat.setFromEuler(new THREE.Euler(0, p.angle, zRot))
            armMatrix.compose(
              pos.set(p.x + offsetX, p.y + 0.16 * p.scale + bob + jump, p.z + offsetZ),
              armQuat,
              scl
            )
            arms.setMatrixAt(p.armSide + side, armMatrix)
          }
        }
      }
      bodies.instanceMatrix.needsUpdate = true
      heads.instanceMatrix.needsUpdate = true
      if (raised) arms.instanceMatrix.needsUpdate = true
    }
  }
}
