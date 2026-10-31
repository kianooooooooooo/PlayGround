import * as THREE from 'three'

const SKIN_TONES = [0x9c6646, 0x7d4f34, 0xb9825c, 0x6b432c, 0xc79770]
const CLOTH_COLORS = [0x7b1f1f, 0x223f6b, 0x3c5b33, 0x7a5a18, 0x56265f, 0x2d6064]
const ARMOR_COLORS = [0xa8813d, 0x7b7f82, 0x8c6a33, 0x676c70]

const geometryCache = new Map()
function geo(key, make) {
  if (!geometryCache.has(key)) geometryCache.set(key, make())
  return geometryCache.get(key)
}

const box = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d))
const cyl = (rt, rb, h, seg = 8) => geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg))
const sph = (r, seg = 12) => geo(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, Math.floor(seg * 0.66))))
const hemi = (r, seg = 12, top = true) => geo(`h${r},${seg},${top}`, () => new THREE.SphereGeometry(r, seg, 8, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2))

const standard = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02, ...options })

function mesh(geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material)
  m.position.set(...position)
  m.scale.set(...scale)
  m.rotation.set(...rotation)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 })
const hitGeo = new THREE.BoxGeometry(1, 1, 1)

function hitbox(size, position = [0, 0, 0]) {
  const m = new THREE.Mesh(hitGeo, hitMaterial)
  m.scale.set(...size)
  m.position.set(...position)
  m.userData.hitbox = true
  return m
}

function seeded(seed) {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

function buildSword() {
  const group = new THREE.Group()
  const bladeMat = standard(0xd5d9dc, { roughness: 0.28, metalness: 0.55 })
  const bronze = standard(0xa8813d, { roughness: 0.42, metalness: 0.6 })
  const leather = standard(0x3b2413, { roughness: 0.95 })
  group.add(mesh(cyl(0.022, 0.025, 0.22, 8), leather, [0, 0.02, 0]))
  group.add(mesh(sph(0.038, 8), bronze, [0, -0.1, 0]))
  group.add(mesh(box(0.24, 0.03, 0.055), bronze, [0, 0.135, 0]))
  const blade = mesh(box(0.065, 0.78, 0.018), bladeMat, [0, 0.55, 0])
  group.add(blade)
  group.add(mesh(box(0.04, 0.09, 0.015), bladeMat, [0, 0.97, 0], [1, 1, 1], [0, 0, 0]))
  const tip = mesh(cyl(0.001, 0.034, 0.12, 4), bladeMat, [0, 1.06, 0])
  group.add(tip)
  group.userData.blade = blade
  return group
}

function buildHammer() {
  const group = new THREE.Group()
  const iron = standard(0x5d6266, { roughness: 0.48, metalness: 0.65 })
  const darkIron = standard(0x3b4044, { roughness: 0.55, metalness: 0.5 })
  const wood = standard(0x5a3a20, { roughness: 0.9 })
  const bronze = standard(0x9b7534, { roughness: 0.45, metalness: 0.55 })
  group.add(mesh(cyl(0.027, 0.032, 0.72, 8), wood, [0, 0.2, 0]))
  group.add(mesh(cyl(0.04, 0.04, 0.09, 8), bronze, [0, -0.15, 0]))
  group.add(mesh(box(0.19, 0.19, 0.34), iron, [0, 0.6, 0]))
  group.add(mesh(box(0.205, 0.06, 0.28), darkIron, [0, 0.7, 0]))
  group.add(mesh(cyl(0.001, 0.07, 0.18, 4), iron, [0, 0.6, 0.24], [1, 1, 1], [Math.PI / 2, 0, 0]))
  group.add(mesh(cyl(0.001, 0.07, 0.18, 4), iron, [0, 0.6, -0.24], [1, 1, 1], [-Math.PI / 2, 0, 0]))
  group.add(mesh(cyl(0.045, 0.045, 0.05, 8), bronze, [0, 0.46, 0]))
  return group
}

export function createWeapon(type) {
  return type === 'hammer' ? buildHammer() : buildSword()
}

export function createGladiator({ seed = 1, weapon = 'sword' } = {}) {
  const rnd = seeded(seed)
  const skin = standard(SKIN_TONES[Math.floor(rnd() * SKIN_TONES.length)], { roughness: 0.92 })
  const cloth = standard(CLOTH_COLORS[Math.floor(rnd() * CLOTH_COLORS.length)], { roughness: 0.96 })
  const armor = standard(ARMOR_COLORS[Math.floor(rnd() * ARMOR_COLORS.length)], { roughness: 0.4, metalness: 0.62 })
  const darkLeather = standard(0x3b2a1b, { roughness: 0.95 })
  const iron = standard(0x686d71, { roughness: 0.46, metalness: 0.58 })
  const red = standard(0x761616, { roughness: 0.9 })
  const gold = standard(0xc09a4a, { roughness: 0.35, metalness: 0.7 })
  const boneMat = standard(0xeee3c8, { roughness: 0.75 })

  const root = new THREE.Group()
  const pose = new THREE.Group()
  root.add(pose)

  const pelvis = new THREE.Group()
  pelvis.position.y = 0.95
  pose.add(pelvis)
  pelvis.add(mesh(box(0.34, 0.24, 0.25), skin, [0, 0, 0]))
  pelvis.add(mesh(box(0.38, 0.09, 0.29), darkLeather, [0, 0.09, 0]))
  pelvis.add(mesh(box(0.08, 0.08, 0.03), gold, [0, 0.09, 0.16]))
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2
    const strip = mesh(box(0.075, 0.34, 0.025), i % 2 ? cloth : darkLeather,
      [Math.sin(angle) * 0.17, -0.24, Math.cos(angle) * 0.13],
      [1, 1, 1],
      [0.16 * Math.cos(angle), angle, -0.16 * Math.sin(angle)])
    pelvis.add(strip)
  }

  const legGroups = {}
  const legParts = {}
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    const leg = new THREE.Group()
    leg.position.set(0.13 * sign, -0.03, 0)
    pelvis.add(leg)
    legParts[side] = leg
    leg.add(mesh(box(0.18, 0.46, 0.2), skin, [0, -0.23, 0]))
    leg.add(mesh(box(0.2, 0.2, 0.22), cloth, [0, -0.07, 0.01]))
    leg.add(mesh(sph(0.09, 10), skin, [0, -0.46, 0.01]))
    const shin = new THREE.Group()
    shin.position.y = -0.46
    leg.add(shin)
    legGroups[side] = shin
    shin.add(mesh(box(0.155, 0.42, 0.17), skin, [0, -0.21, 0]))
    shin.add(mesh(box(0.18, 0.26, 0.19), armor, [0, -0.17, 0.015]))
    shin.add(mesh(box(0.18, 0.06, 0.3), darkLeather, [0, -0.42, 0.06]))
    shin.add(mesh(box(0.16, 0.035, 0.34), skin, [0, -0.45, 0.07]))
    shin.add(mesh(box(0.17, 0.025, 0.03), darkLeather, [0, -0.38, 0.16]))
    const legHit = hitbox([0.3, 0.9, 0.32], [0, -0.42, 0])
    legHit.userData.part = `${side}Leg`
    leg.add(legHit)
    leg.userData.legPart = side
  }

  const chest = new THREE.Group()
  chest.position.y = 0.16
  pelvis.add(chest)
  chest.add(mesh(box(0.44, 0.42, 0.27), skin, [0, 0.17, 0]))
  chest.add(mesh(box(0.47, 0.18, 0.3), cloth, [0, 0.06, 0]))
  const plate = mesh(box(0.43, 0.3, 0.06), armor, [0, 0.19, 0.15])
  chest.add(plate)
  chest.add(mesh(box(0.06, 0.34, 0.04), gold, [0, 0.19, 0.19]))
  chest.add(mesh(box(0.5, 0.07, 0.06), darkLeather, [0, 0.02, 0.14], [1, 1, 1], [0, 0, 0]))
  chest.add(mesh(box(0.075, 0.4, 0.035), darkLeather, [-0.15, 0.17, 0.18], [1, 1, 1], [0, 0, 0.4]))
  chest.add(mesh(box(0.075, 0.4, 0.035), darkLeather, [0.15, 0.17, 0.18], [1, 1, 1], [0, 0, -0.4]))
  const torsoHit = hitbox([0.56, 0.48, 0.38], [0, 0.19, 0])
  torsoHit.userData.part = 'torso'
  chest.add(torsoHit)

  // Shoulder guards.
  for (const side of [-1, 1]) {
    chest.add(mesh(hemi(0.17, 12, true), armor, [0.3 * side, 0.35, 0], [1, 0.72, 1]))
    chest.add(mesh(box(0.11, 0.1, 0.2), iron, [0.3 * side, 0.36, 0.02]))
  }

  const head = new THREE.Group()
  head.position.y = 0.43
  chest.add(head)
  head.add(mesh(cyl(0.07, 0.09, 0.12, 8), skin, [0, 0.02, 0]))
  const skull = new THREE.Group()
  skull.position.y = 0.16
  head.add(skull)
  const lowerHead = mesh(hemi(0.15, 14, false), skin, [0, 0, 0], [1, 1.05, 0.96])
  skull.add(lowerHead)
  skull.add(mesh(sph(0.075, 8), skin, [0, 0.04, 0.115], [1, 0.7, 0.7]))
  skull.add(mesh(box(0.03, 0.05, 0.04), skin, [0, 0.02, 0.16]))
  for (const side of [-1, 1]) {
    skull.add(mesh(box(0.045, 0.026, 0.02), iron, [0.055 * side, 0.07, 0.137]))
    skull.add(mesh(box(0.075, 0.055, 0.03), skin, [0.09 * side, 0.02, 0.105]))
  }
  const headHit = hitbox([0.36, 0.36, 0.34], [0, 0.03, 0])
  headHit.userData.part = 'head'
  skull.add(headHit)

  const cap = new THREE.Group()
  cap.position.y = 0.015
  skull.add(cap)
  cap.add(mesh(hemi(0.158, 14, true), skin, [0, 0, 0], [1, 1, 0.97]))
  const helmetStyle = Math.floor(rnd() * 3)
  if (helmetStyle !== 2) {
    const helmetMat = helmetStyle === 0 ? armor : iron
    cap.add(mesh(hemi(0.172, 12, true), helmetMat, [0, 0.015, 0], [1, 0.94, 1]))
    cap.add(mesh(cyl(0.174, 0.178, 0.055, 14), helmetMat, [0, -0.02, 0]))
    cap.add(mesh(box(0.05, 0.13, 0.06), helmetMat, [0, -0.09, 0.135]))
    if (helmetStyle === 0) {
      cap.add(mesh(box(0.035, 0.12, 0.3), red, [0, 0.19, -0.02]))
      for (let i = 0; i < 4; i++) cap.add(mesh(box(0.05, 0.07 + i * 0.012, 0.055), red, [0, 0.17 + i * 0.015, -0.14 + i * 0.07]))
    }
  } else {
    cap.add(mesh(box(0.31, 0.05, 0.045), cloth, [0, 0.02, 0.05]))
  }
  cap.userData.isCap = true

  const brain = mesh(sph(0.12, 10), standard(0xb0646c, { roughness: 0.7 }), [0, 0.02, 0])
  brain.visible = false
  skull.add(brain)

  const jaw = new THREE.Group()
  jaw.position.set(0, 0.055, 0.055)
  head.add(jaw)
  const jawMesh = mesh(box(0.17, 0.095, 0.13), skin, [0, -0.035, 0.035])
  jaw.add(jawMesh)
  jaw.add(mesh(box(0.15, 0.025, 0.11), darkLeather, [0, -0.075, 0.04]))
  jaw.add(mesh(box(0.15, 0.02, 0.025), standard(0xd8cfb4, { roughness: 0.7 }), [0, -0.004, 0.097]))
  const jawHit = hitbox([0.26, 0.16, 0.24], [0, -0.02, 0.04])
  jawHit.userData.part = 'jaw'
  jaw.add(jawHit)
  jaw.userData.isJaw = true

  const mouth = mesh(box(0.13, 0.07, 0.06), standard(0x370b0b, { roughness: 1 }), [0, 0.04, 0.085])
  mouth.visible = false
  skull.add(mouth)
  const cutDisc = mesh(cyl(0.14, 0.14, 0.035, 12), standard(0x6d1111, { roughness: 0.6 }), [0, 0.02, 0])
  cutDisc.visible = false
  head.add(cutDisc)

  const armparts = {}
  const armGroups = {}
  const weaponPivots = {}
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    const arm = new THREE.Group()
    arm.position.set(0.31 * sign, 0.32, 0)
    chest.add(arm)
    armparts[side] = arm
    arm.add(mesh(box(0.15, 0.34, 0.16), skin, [0, -0.17, 0]))
    arm.add(mesh(box(0.18, 0.17, 0.19), cloth, [0, -0.06, 0]))
    const forearm = new THREE.Group()
    forearm.position.y = -0.35
    arm.add(forearm)
    armGroups[side] = forearm
    forearm.add(mesh(box(0.13, 0.3, 0.14), skin, [0, -0.15, 0]))
    forearm.add(mesh(box(0.155, 0.24, 0.165), darkLeather, [0, -0.16, 0.01]))
    forearm.add(mesh(sph(0.07, 8), skin, [0, -0.33, 0.01]))
    const hand = new THREE.Group()
    hand.position.y = -0.35
    forearm.add(hand)
    weaponPivots[side] = hand
    const armHit = hitbox([0.28, 0.86, 0.3], [0, -0.4, 0])
    armHit.userData.part = `${side}Arm`
    arm.add(armHit)
    arm.userData.armPart = side
  }

  const weaponPivot = weaponPivots.right
  let weaponMesh = null
  if (weapon !== 'none') {
    weaponMesh = createWeapon(weapon)
    weaponMesh.rotation.x = -0.55
    weaponMesh.rotation.z = -0.08
    weaponMesh.position.y = -0.02
    weaponMesh.scale.setScalar(0.95)
    weaponPivot.add(weaponMesh)
  }

  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({
    map: null,
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  }))
  contact.rotation.x = -Math.PI / 2
  contact.position.y = 0.012
  contact.renderOrder = 1
  root.add(contact)

  const allMeshes = []
  const hitboxes = []
  root.traverse(object => {
    if (!object.isMesh) return
    if (object.userData.hitbox) hitboxes.push(object)
    else allMeshes.push(object)
  })

  return {
    root,
    pose,
    pelvis,
    chest,
    head,
    skull,
    cap,
    jaw,
    brain,
    mouth,
    cutDisc,
    armour: armor,
    cloth,
    skin,
    boneMaterial: boneMat,
    parts: {
      head,
      skull,
      jaw,
      cap,
      chest,
      pelvis,
      leftArm: armparts.left,
      rightArm: armparts.right,
      leftForearm: armGroups.left,
      rightForearm: armGroups.right,
      leftLeg: legParts.left,
      rightLeg: legParts.right,
      leftShin: legGroups.left,
      rightShin: legGroups.right
    },
    weaponPivots,
    weaponPivot,
    weaponMesh,
    allMeshes,
    contact,
    hitboxes,
    setWeapon(type) {
      if (weaponMesh) weaponPivot.remove(weaponMesh)
      weaponMesh = createWeapon(type)
      weaponMesh.rotation.x = -0.55
      weaponMesh.rotation.z = -0.08
      weaponMesh.position.y = -0.02
      weaponMesh.scale.setScalar(0.95)
      weaponPivot.add(weaponMesh)
      this.weaponMesh = weaponMesh
    },
    showBone(part) {
      const bone = mesh(cyl(0.048, 0.085, 0.48, 7), boneMat, [0, 0, 0])
      const bloodMat = standard(0x5f0d0d, { roughness: 0.55 })
      const blood = mesh(sph(0.1, 8), bloodMat, [0, 0, 0], [1, 0.5, 1])
      if (part === 'leftArm' || part === 'rightArm') {
        const sign = part === 'leftArm' ? -1 : 1
        bone.position.set(0.17 * sign, -0.34, 0.13)
        bone.rotation.set(0.7, 0, 1.08 * sign)
        blood.position.set(0.1 * sign, -0.32, 0.09)
        armparts[part === 'leftArm' ? 'left' : 'right'].add(bone, blood)
      } else {
        const sign = part === 'leftLeg' ? -1 : 1
        bone.position.set(0.14 * sign, -0.46, 0.25)
        bone.rotation.set(1.18, 0, 0.52 * sign)
        blood.position.set(0.09 * sign, -0.44, 0.19)
        legParts[part === 'leftLeg' ? 'left' : 'right'].add(bone, blood)
      }
    },
    showStump(part) {
      const bloodMat = standard(0x5f0d0d, { roughness: 0.5 })
      const stump = mesh(sph(0.075, 8), bloodMat, [0, 0, 0], [1, 0.5, 1])
      if (part === 'rightArm' || part === 'leftArm') {
        const sign = part === 'rightArm' ? 1 : -1
        stump.position.set(0.3 * sign, 0.3, 0)
        chest.add(stump)
      } else if (part === 'rightLeg' || part === 'leftLeg') {
        const sign = part === 'rightLeg' ? 1 : -1
        stump.position.set(0.13 * sign, -0.02, 0)
        pelvis.add(stump)
      }
    },
    showJawSocket() {
      mouth.visible = true
    },
    showBrain() {
      brain.visible = true
      if (cap.parent === skull) cap.visible = false
      const rim = mesh(cyl(0.15, 0.15, 0.03, 14), standard(0x4d0b0b, { roughness: 0.55 }), [0, 0.16, 0])
      skull.add(rim)
    },
    showHeadCut() {
      cutDisc.visible = true
    },
    showBisectCut(where) {
      const disc = mesh(cyl(0.2, 0.2, 0.035, 14), standard(0x5c0c0c, { roughness: 0.55 }), [0, 0, 0])
      if (where === 'chest') {
        disc.position.y = -0.03
        chest.add(disc)
      } else {
        disc.position.y = 0.13
        pelvis.add(disc)
      }
    }
  }
}

export function createFirstPersonWeapon(type) {
  const group = new THREE.Group()
  const weapon = createWeapon(type)
  weapon.scale.setScalar(1.15)
  group.add(weapon)

  const gloveMat = standard(0x2e1c12, { roughness: 0.88 })
  const strapMat = standard(0x6d4a25, { roughness: 0.9 })
  const steel = standard(0x8a9096, { roughness: 0.35, metalness: 0.55 })
  const glove = new THREE.Group()
  glove.add(mesh(box(0.14, 0.17, 0.15), gloveMat, [0, -0.01, 0]))
  glove.add(mesh(box(0.15, 0.05, 0.16), strapMat, [0, 0.04, 0]))
  glove.add(mesh(sph(0.05, 8), gloveMat, [0.07, 0.03, 0.02]))
  glove.add(mesh(sph(0.045, 8), gloveMat, [0.06, 0.0, 0.06]))
  glove.add(mesh(box(0.18, 0.16, 0.05), steel, [0, -0.1, 0.11], [1, 1, 1], [0.2, 0, 0]))
  glove.position.y = -0.03
  group.add(glove)

  group.userData.weapon = weapon
  return group
}
