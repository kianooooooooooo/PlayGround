import * as THREE from 'three'
import {
  makeSandTexture,
  makeStoneTexture,
  makeBannerTexture,
  makeWoodTexture,
  makeSplashTexture
} from './textures.js'

const TAU = Math.PI * 2

function add(mesh, cast = true, receive = true) {
  mesh.castShadow = cast
  mesh.receiveShadow = receive
  return mesh
}

function archWallGeometry(width, height, openingWidth, openingHeight, depth) {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  shape.lineTo(width / 2, 0)
  shape.lineTo(width / 2, height)
  shape.lineTo(-width / 2, height)
  shape.lineTo(-width / 2, 0)
  const hole = new THREE.Path()
  const half = openingWidth / 2
  const spring = openingHeight - half
  hole.moveTo(-half, 0)
  hole.lineTo(half, 0)
  hole.lineTo(half, spring)
  hole.absarc(0, spring, half, 0, Math.PI, false)
  hole.lineTo(-half, 0)
  shape.holes.push(hole)
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 })
}

export function createArena(scene) {
  const group = new THREE.Group()
  scene.add(group)

  scene.fog = new THREE.Fog(0xdcc39a, 58, 150)
  scene.background = new THREE.Color(0x9fc2e6)

  // Sky dome.
  const skyGeo = new THREE.SphereGeometry(160, 32, 20)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f6db3) },
      mid: { value: new THREE.Color(0x8fbde6) },
      horizon: { value: new THREE.Color(0xf0d6a6) },
      sunDir: { value: new THREE.Vector3(-0.45, 0.62, 0.38).normalize() }
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir;
      varying vec3 vWorld;
      void main() {
        vec3 d = normalize(vWorld);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, top, smoothstep(0.18, 0.85, h));
        float sun = pow(max(dot(d, sunDir), 0.0), 180.0);
        float haze = pow(max(dot(d, sunDir), 0.0), 8.0);
        col += vec3(1.0, 0.72, 0.36) * sun * 1.6;
        col += vec3(1.0, 0.8, 0.55) * haze * 0.12;
        float clouds = sin(d.x * 13.0 + d.z * 9.0) * sin(d.z * 17.0 - d.x * 7.0);
        col += vec3(1.0, 0.96, 0.9) * smoothstep(0.72, 1.0, clouds) * 0.05 * smoothstep(0.05, 0.4, h);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  const sky = new THREE.Mesh(skyGeo, skyMat)
  sky.frustumCulled = false
  group.add(sky)

  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0xa77a48, 0.82)
  scene.add(hemi)
  const ambient = new THREE.AmbientLight(0xffe9c4, 0.16)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(0xfff1d4, 2.35)
  sun.position.set(-24, 34, 18)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -26
  sun.shadow.camera.right = 26
  sun.shadow.camera.top = 26
  sun.shadow.camera.bottom = -26
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 90
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.035
  scene.add(sun)
  scene.add(sun.target)
  sun.target.position.set(0, 0, 0)

  const sandTexture = makeSandTexture()
  const stoneTexture = makeStoneTexture()
  const bannerTexture = makeBannerTexture()
  const woodTexture = makeWoodTexture()

  // Sand floor.
  const floorGeo = new THREE.CircleGeometry(18.6, 112)
  const pos = floorGeo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    pos.setZ(i, (Math.sin(x * 1.7) * Math.cos(y * 1.3) + Math.sin(x * 4.3 + y * 2.1) * 0.35) * 0.018)
  }
  floorGeo.computeVertexNormals()
  const sandMat = new THREE.MeshStandardMaterial({ map: sandTexture, color: 0xdcc397, roughness: 1, metalness: 0 })
  const floor = new THREE.Mesh(floorGeo, sandMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  group.add(floor)

  // Darker disturbed sand ring near the wall.
  const ringMat = new THREE.MeshStandardMaterial({ map: sandTexture, color: 0xbfa079, roughness: 1, transparent: true, opacity: 0.65 })
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(14.6, 18.7, 96), ringMat)
  outerRing.rotation.x = -Math.PI / 2
  outerRing.position.y = 0.006
  outerRing.receiveShadow = true
  group.add(outerRing)

  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTexture, color: 0xbfb098, roughness: 0.94, metalness: 0.02 })
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x4b463d, roughness: 0.96 })
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc4b08b, roughness: 0.8 })
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture, color: 0xc2a077, roughness: 0.92 })
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTexture, color: 0xf0c7a9, roughness: 0.95, side: THREE.DoubleSide })
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x4a4f52, roughness: 0.55, metalness: 0.55 })

  // Podium wall with arches.
  const bays = 24
  const wallRadius = 18.75
  const chord = (TAU * wallRadius) / bays * 1.02
  const wallGeo = archWallGeometry(chord, 3.6, 2.15, 2.65, 0.6)
  for (let i = 0; i < bays; i++) {
    const angle = (i / bays) * TAU
    const wall = new THREE.Mesh(wallGeo, stoneMat)
    wall.position.set(Math.sin(angle) * wallRadius, 0, Math.cos(angle) * wallRadius)
    wall.rotation.y = angle
    add(wall)
    group.add(wall)

    // Recess behind the arch.
    const recess = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.9), new THREE.MeshBasicMaterial({ color: 0x17130f }))
    recess.position.set(Math.sin(angle) * (wallRadius + 0.66), 1.35, Math.cos(angle) * (wallRadius + 0.66))
    recess.rotation.y = angle + Math.PI
    group.add(recess)

    // Pillar caps.
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.75, 0.75), trimMat)
    pillar.position.set(Math.sin(angle) * (wallRadius - 0.13), 1.87, Math.cos(angle) * (wallRadius - 0.13))
    pillar.rotation.y = angle
    add(pillar)
    group.add(pillar)
  }

  // Ledge along the podium.
  const ledge = new THREE.Mesh(new THREE.TorusGeometry(wallRadius - 0.1, 0.17, 6, 128), trimMat)
  ledge.rotation.x = Math.PI / 2
  ledge.position.y = 3.62
  add(ledge)
  group.add(ledge)

  // Seating tiers.
  const tierCount = 5
  for (let tier = 0; tier < tierCount; tier++) {
    const radius = 19.1 + tier * 1.75
    const y = 3.9 + tier * 0.98
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.96, 96, 1, true), stoneMat)
    riser.position.y = y - 0.48
    riser.material.side = THREE.DoubleSide
    add(riser, false, true)
    group.add(riser)

    const seat = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 1.72, 96), new THREE.MeshStandardMaterial({
      color: 0xb8a68a, roughness: 0.98, side: THREE.DoubleSide
    }))
    seat.rotation.x = -Math.PI / 2
    seat.position.y = y + 0.01
    add(seat, false, true)
    group.add(seat)

    const lip = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.06, 0.075, 5, 96), trimMat)
    lip.rotation.x = Math.PI / 2
    lip.position.y = y + 0.02
    group.add(lip)
  }

  // Outer wall.
  const outerWall = new THREE.Mesh(new THREE.CylinderGeometry(28.2, 28.2, 15, 96, 1, true), stoneMat)
  outerWall.position.y = 10.4
  outerWall.material = stoneMat.clone()
  outerWall.material.side = THREE.BackSide
  outerWall.material.map = stoneTexture.clone()
  outerWall.material.map.repeat.set(20, 3)
  outerWall.material.map.needsUpdate = true
  add(outerWall, false, true)
  group.add(outerWall)

  const topRing = new THREE.Mesh(new THREE.TorusGeometry(28.2, 0.32, 6, 128), trimMat)
  topRing.rotation.x = Math.PI / 2
  topRing.position.y = 17.9
  group.add(topRing)

  // Imperial box.
  const boxAngle = -Math.PI / 2
  const boxGroup = new THREE.Group()
  const boxPos = new THREE.Vector3(Math.sin(boxAngle) * 20.4, 4.75, Math.cos(boxAngle) * 20.4)
  boxGroup.position.copy(boxPos)
  boxGroup.rotation.y = boxAngle + Math.PI
  const platform = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.7, 3.2), trimMat)
  platform.position.y = -0.2
  add(platform)
  boxGroup.add(platform)
  for (const x of [-2.6, 2.6]) {
    for (const z of [-1.2, 1.2]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.8, 10), trimMat)
      column.position.set(x, 1.5, z)
      add(column)
      boxGroup.add(column)
    }
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 3.6), new THREE.MeshStandardMaterial({ color: 0x701a1c, roughness: 0.9 }))
  canopy.position.y = 3
  add(canopy)
  boxGroup.add(canopy)
  const canopyFront = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: 0x8c2526, roughness: 0.9 }))
  canopyFront.position.set(0, 2.7, 1.8)
  boxGroup.add(canopyFront)
  group.add(boxGroup)

  // Banners hung on the podium.
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * TAU + 0.13
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.1), bannerMat)
    banner.position.set(Math.sin(angle) * (wallRadius - 0.34), 2.35, Math.cos(angle) * (wallRadius - 0.34))
    banner.rotation.y = angle + Math.PI
    banner.receiveShadow = true
    group.add(banner)
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6), woodMat)
    rod.rotation.z = Math.PI / 2
    rod.rotation.y = angle
    rod.position.set(Math.sin(angle) * (wallRadius - 0.3), 3.42, Math.cos(angle) * (wallRadius - 0.3))
    group.add(rod)
  }

  // Scattered props near the walls.
  const props = new THREE.Group()
  group.add(props)
  const crateSpots = [
    [-15.2, 10.4], [15.8, -8.5], [-11.8, -13.2], [13.4, 11.6], [-16.5, -3], [9.5, 15.4]
  ]
  for (const [x, z] of crateSpots) {
    const size = 0.7 + Math.random() * 0.35
    const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), woodMat)
    crate.position.set(x, size / 2, z)
    crate.rotation.y = Math.random() * Math.PI
    add(crate)
    props.add(crate)
    if (Math.random() > 0.4) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.9, 12), woodMat)
      barrel.position.set(x + 0.6, 0.45, z + 0.45)
      barrel.rotation.y = Math.random() * Math.PI
      add(barrel)
      props.add(barrel)
    }
  }

  // Weapon rack.
  const rack = new THREE.Group()
  rack.position.set(16.2, 0, 3.2)
  rack.rotation.y = -0.7
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), woodMat)
  rail.position.y = 1.35
  add(rail)
  rack.add(rail)
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), woodMat)
    post.position.set(0.8 * side, 0.7, 0)
    add(post)
    rack.add(post)
  }
  for (let i = 0; i < 5; i++) {
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 2.1, 5), woodMat)
    spear.position.set(-0.65 + i * 0.32, 1.05, 0.08)
    spear.rotation.z = 0.14 * (i - 2)
    add(spear)
    rack.add(spear)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 4), ironMat)
    tip.position.set(-0.65 + i * 0.32 + Math.sin(0.14 * (i - 2)) * 1.05, 2.15, 0.08)
    rack.add(tip)
  }
  props.add(rack)

  // Shields against the wall.
  for (let i = 0; i < 7; i++) {
    const angle = i * 1.37 + 0.4
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 18), i % 2 ? ironMat : trimMat)
    shield.rotation.x = Math.PI / 2
    shield.rotation.z = angle
    shield.position.set(Math.sin(angle) * 17.9, 0.55 + (i % 2) * 0.12, Math.cos(angle) * 17.9)
    add(shield)
    props.add(shield)
  }

  // Dust motes.
  const dustCount = 260
  const dustGeo = new THREE.BufferGeometry()
  const dustPositions = new Float32Array(dustCount * 3)
  const dustPhase = new Float32Array(dustCount)
  for (let i = 0; i < dustCount; i++) {
    const radius = Math.sqrt(Math.random()) * 17
    const angle = Math.random() * TAU
    dustPositions[i * 3] = Math.cos(angle) * radius
    dustPositions[i * 3 + 1] = 0.2 + Math.random() * 5.5
    dustPositions[i * 3 + 2] = Math.sin(angle) * radius
    dustPhase[i] = Math.random() * TAU
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: makeSplashTexture(),
    color: 0xffe9c2,
    size: 0.075,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }))
  group.add(dust)

  return {
    group,
    floor,
    wallRadius,
    playRadius: 16.6,
    spawnRadius: 16.9,
    sandTexture,
    stoneTexture,
    update(dt, time) {
      const positions = dustGeo.attributes.position.array
      for (let i = 0; i < dustCount; i++) {
        positions[i * 3 + 1] += dt * (0.06 + (i % 5) * 0.008)
        positions[i * 3] += Math.sin(time * 0.3 + dustPhase[i]) * dt * 0.04
        if (positions[i * 3 + 1] > 6.2) positions[i * 3 + 1] = 0.2
      }
      dustGeo.attributes.position.needsUpdate = true
    }
  }
}
