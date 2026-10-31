import * as THREE from 'three'
import { WEAPONS } from './model.js'
import { createFirstPersonWeapon } from './body.js'

const BASE_POSITION = new THREE.Vector3(0.56, -0.5, -0.92)
const BASE_ROTATION = new THREE.Euler(-0.5, -0.26, -0.55)

export function createPlayer({ camera, weaponType = 'sword', audio, onHurt = () => {}, onDeath = () => {} }) {
  camera.rotation.order = 'YXZ'
  camera.position.set(0, 1.68, 10.2)
  camera.near = 0.05
  camera.updateProjectionMatrix()

  const state = {
    yaw: 0,
    pitch: -0.03,
    health: 100,
    maxHealth: 100,
    weaponType,
    weapon: WEAPONS[weaponType],
    phase: 'idle',
    phaseTime: 0,
    heavy: false,
    hitDone: false,
    cooldown: 0,
    bob: 0,
    bobTime: 0,
    stepTimer: 0,
    dodgeCooldown: 0,
    dodgeTime: 0,
    shake: 0,
    dead: false,
    hurtFlash: 0,
    moveAmount: 0
  }

  const viewmodel = createFirstPersonWeapon(weaponType)
  viewmodel.scale.setScalar(0.5)
  viewmodel.position.copy(BASE_POSITION)
  viewmodel.rotation.copy(BASE_ROTATION)
  viewmodel.traverse(object => {
    if (object.isMesh) {
      object.castShadow = false
      object.receiveShadow = false
      object.renderOrder = 30
      object.material = object.material.clone()
      object.material.depthTest = false
      object.material.depthWrite = false
    }
  })
  camera.add(viewmodel)

  // A dim fill light attached to the camera keeps the viewmodel readable.
  const viewLight = new THREE.PointLight(0xffe1b0, 1.4, 4, 2)
  viewLight.position.set(0.3, 0.2, 0.25)
  camera.add(viewLight)

  const keys = new Set()
  const analog = { x: 0, z: 0 }
  const velocity = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const wish = new THREE.Vector3()

  function setWeapon(type) {
    if (!WEAPONS[type]) return
    state.weaponType = type
    state.weapon = WEAPONS[type]
    viewmodel.clear()
    const next = createFirstPersonWeapon(type)
    next.traverse(object => {
      if (!object.isMesh) return
      object.renderOrder = 30
      object.material = object.material.clone()
      object.material.depthTest = false
      object.material.depthWrite = false
    })
    while (next.children.length) viewmodel.add(next.children[0])
    audio.ui()
  }

  function startAttack(heavy = false) {
    if (state.dead || state.phase !== 'idle' || state.cooldown > 0) return false
    state.phase = 'windup'
    state.phaseTime = 0
    state.heavy = heavy
    state.hitDone = false
    state.consumedHit = false
    audio.whoosh(heavy)
    return true
  }

  function hurt(amount) {
    if (state.dead) return
    state.health = Math.max(0, state.health - amount)
    state.hurtFlash = 1
    state.shake = Math.min(0.4, state.shake + 0.22)
    audio.hurt()
    onHurt(state.health, amount)
    if (state.health <= 0) {
      state.dead = true
      state.phase = 'idle'
      onDeath()
    }
  }

  function heal(amount) {
    state.health = Math.min(state.maxHealth, state.health + amount)
  }

  function dodge() {
    if (state.dead || state.dodgeCooldown > 0) return false
    state.dodgeCooldown = 1.55
    state.dodgeTime = 0.2
    const dir = new THREE.Vector3()
    if (Math.hypot(velocity.x, velocity.z) > 0.5) dir.set(velocity.x, 0, velocity.z)
    else dir.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw))
    dir.normalize()
    velocity.x += dir.x * 8.5
    velocity.z += dir.z * 8.5
    audio.whoosh(true)
    return true
  }

  function reset() {
    state.health = state.maxHealth
    state.dead = false
    state.phase = 'idle'
    state.phaseTime = 0
    state.cooldown = 0
    state.hitDone = false
    state.consumedHit = false
    state.dodgeCooldown = 0
    state.dodgeTime = 0
    state.shake = 0
    state.hurtFlash = 0
    state.yaw = 0
    state.pitch = -0.03
    state.bob = 0
    camera.position.set(0, 1.68, 10.2)
    camera.rotation.set(-0.03, 0, 0)
    velocity.set(0, 0, 0)

    keys.clear()
    analog.x = 0
    analog.z = 0
    viewmodel.visible = true
  }

  function look(dx, dy, sensitivity = 0.0023) {
    if (state.dead) return
    state.yaw -= dx * sensitivity
    state.pitch -= dy * sensitivity
    state.pitch = THREE.MathUtils.clamp(state.pitch, -1.32, 1.28)
  }

  function update(dt) {
    const t = performance.now() / 1000
    state.cooldown = Math.max(0, state.cooldown - dt)
    state.dodgeCooldown = Math.max(0, state.dodgeCooldown - dt)
    state.hurtFlash = Math.max(0, state.hurtFlash - dt * 2.3)
    state.shake = Math.max(0, state.shake - dt * 2.4)

    if (!state.dead) {
      forward.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw))
      right.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw))
      wish.set(0, 0, 0)
      if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(forward)
      if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(forward)
      if (keys.has('KeyD') || keys.has('ArrowRight')) wish.add(right)
      if (keys.has('KeyA') || keys.has('ArrowLeft')) wish.sub(right)
      if (analog.x || analog.z) {
        wish.addScaledVector(right, analog.x)
        wish.addScaledVector(forward, analog.z)
      }
      if (wish.lengthSq() > 1) wish.normalize()

      const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight')
      const attacking = state.phase !== 'idle'
      let speed = sprint ? 6.4 : 4.25
      if (attacking) speed *= 0.48
      if (state.dodgeTime > 0) {
        state.dodgeTime -= dt
        speed *= 3.2
      }

      const accel = 12
      velocity.x += (wish.x * speed - velocity.x) * Math.min(1, accel * dt)
      velocity.z += (wish.z * speed - velocity.z) * Math.min(1, accel * dt)
      camera.position.x += velocity.x * dt
      camera.position.z += velocity.z * dt

      const radius = Math.hypot(camera.position.x, camera.position.z)
      if (radius > 16.2) {
        camera.position.x = (camera.position.x / radius) * 16.2
        camera.position.z = (camera.position.z / radius) * 16.2
      }

      state.moveAmount = Math.min(1, Math.hypot(velocity.x, velocity.z) / 4.2)
      if (state.moveAmount > 0.15) {
        state.bobTime += dt * (sprint ? 13 : 9)
        state.stepTimer -= dt * (sprint ? 1.6 : 1)
        if (state.stepTimer <= 0) {
          state.stepTimer = 0.43
          audio.step()
        }
      } else {
        state.bobTime += dt * 2
      }
      state.bob = Math.sin(state.bobTime) * 0.035 * state.moveAmount

      // Attack state.
      if (state.phase === 'windup') {
        const duration = state.heavy ? state.weapon.heavyWindup : state.weapon.windup
        if (state.phaseTime >= duration) {
          state.phase = 'swing'
          state.phaseTime = 0
        }
      } else if (state.phase === 'swing') {
        const duration = state.heavy ? state.weapon.heavySwing : state.weapon.swing
        if (!state.hitDone && state.phaseTime >= duration * 0.42) state.hitDone = true
        if (state.phaseTime >= duration) {
          state.phase = 'recover'
          state.phaseTime = 0
          state.cooldown = state.heavy ? 0.25 : 0.1
        }
      } else if (state.phase === 'recover') {
        const duration = state.heavy ? state.weapon.heavyRecovery : state.weapon.recovery
        if (state.phaseTime >= duration) {
          state.phase = 'idle'
          state.phaseTime = 0
        }
      }
      state.phaseTime += dt
    }

    // Camera pose.
    camera.rotation.y = state.yaw
    camera.rotation.x = state.pitch
    camera.position.y = 1.68 + state.bob

    if (state.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * state.shake * 0.16
      camera.position.y += (Math.random() - 0.5) * state.shake * 0.16
    }

    // Viewmodel animation.
    let targetX = BASE_POSITION.x
    let targetY = BASE_POSITION.y
    let targetZ = BASE_POSITION.z
    let rotX = BASE_ROTATION.x
    let rotY = BASE_ROTATION.y
    let rotZ = BASE_ROTATION.z

    const sway = Math.sin(state.bobTime * 0.5) * 0.012 * state.moveAmount
    const bob = Math.abs(Math.sin(state.bobTime)) * 0.02 * state.moveAmount
    targetX += sway
    targetY -= bob

    if (state.phase === 'windup') {
      const duration = state.heavy ? state.weapon.heavyWindup : state.weapon.windup
      const p = Math.min(1, state.phaseTime / Math.max(0.01, duration))
      const ease = p * p
      rotX = BASE_ROTATION.x - 0.55 * ease
      rotY = BASE_ROTATION.y + 0.6 * ease
      rotZ = BASE_ROTATION.z - 0.45 * ease
      targetX = BASE_POSITION.x - 0.09 * ease
      targetY = BASE_POSITION.y + 0.16 * ease
      targetZ = BASE_POSITION.z + 0.04 * ease
    } else if (state.phase === 'swing') {
      const duration = state.heavy ? state.weapon.heavySwing : state.weapon.swing
      const p = Math.min(1, state.phaseTime / Math.max(0.01, duration))
      const arc = Math.sin(p * Math.PI * 0.5)
      rotX = BASE_ROTATION.x - 0.55 + 1.05 * arc
      rotY = BASE_ROTATION.y + 0.6 - 1.5 * arc
      rotZ = BASE_ROTATION.z - 0.45 + 0.95 * arc
      targetX = BASE_POSITION.x - 0.09 + 0.16 * arc
      targetY = BASE_POSITION.y + 0.16 - 0.42 * arc
      targetZ = BASE_POSITION.z + 0.04 - 0.18 * arc
    } else if (state.phase === 'recover') {
      const duration = state.heavy ? state.weapon.heavyRecovery : state.weapon.recovery
      const p = Math.min(1, state.phaseTime / Math.max(0.01, duration))
      const ease = 1 - Math.pow(1 - p, 2)
      const swingEndX = BASE_ROTATION.x + 0.5
      const swingEndY = BASE_ROTATION.y - 0.9
      const swingEndZ = BASE_ROTATION.z + 0.5
      rotX = swingEndX + (BASE_ROTATION.x - swingEndX) * ease
      rotY = swingEndY + (BASE_ROTATION.y - swingEndY) * ease
      rotZ = swingEndZ + (BASE_ROTATION.z - swingEndZ) * ease
      targetX = BASE_POSITION.x + 0.07 * (1 - ease)
      targetY = BASE_POSITION.y - 0.26 * (1 - ease)
      targetZ = BASE_POSITION.z - 0.14 * (1 - ease)
    }

    viewmodel.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), Math.min(1, dt * (state.phase === 'swing' ? 30 : 14)))
    viewmodel.rotation.x = smoothAngle(viewmodel.rotation.x, rotX, state.phase === 'swing' ? 30 : 14, dt)
    viewmodel.rotation.y = smoothAngle(viewmodel.rotation.y, rotY, state.phase === 'swing' ? 30 : 14, dt)
    viewmodel.rotation.z = smoothAngle(viewmodel.rotation.z, rotZ, state.phase === 'swing' ? 30 : 14, dt)

    return {
      hit: state.hitDone && state.phase === 'swing' && !state.consumedHit ? (state.consumedHit = true, true) : false,
      phase: state.phase
    }
  }

  return {
    camera,
    state,
    velocity,
    keys,
    analog,
    viewmodel,
    attack: startAttack,
    hurt,
    heal,
    dodge,
    reset,
    look,
    setWeapon,
    update,
    consumeHit() {
      if (state.hitDone && !state.consumedHit && state.phase === 'swing') {
        state.consumedHit = true
        return true
      }
      return false
    },
    resetHitFlag() {
      state.consumedHit = false
    },
    get forward() {
      return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    }
  }
}

function smoothAngle(current, target, rate, dt) {
  return current + (target - current) * Math.min(1, rate * dt)
}
