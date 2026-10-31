import * as THREE from 'three'
import { applyHit } from './model.js'

const UP = new THREE.Vector3(0, 1, 0)
const tmpDir = new THREE.Vector3()
const tmpPos = new THREE.Vector3()
const tmpVec = new THREE.Vector3()

function smooth(current, target, rate, dt) {
  return current + (target - current) * Math.min(1, rate * dt)
}

export function createNPC({
  body,
  fighter,
  gore,
  audio,
  contactTexture,
  speed = 1.3,
  damage = 8,
  attackCooldown = 1.5,
  scale = 1,
  onDeath = () => {}
}) {
  body.root.scale.setScalar(scale * 0.04)
  body.root.userData.npc = true
  if (body.contact) {
    body.contact.material.map = contactTexture
    body.contact.material.needsUpdate = true
  }

  const rightArm = body.parts.rightArm
  const leftArm = body.parts.leftArm
  const rightLeg = body.parts.rightLeg
  const leftLeg = body.parts.leftLeg
  const torso = body.parts.chest

  const npc = {
    body,
    fighter,
    root: body.root,
    speed,
    damage,
    cooldownMax: attackCooldown,
    cooldown: 0.4 + Math.random() * 0.8,
    attackRange: 1.95,
    state: 'approach',
    stateTime: 0,
    swingHit: false,
    deadTimer: 0,
    bleedTimer: 0,
    walkPhase: Math.random() * 10,
    yaw: Math.random() * Math.PI * 2,
    velocity: new THREE.Vector3(),
    removed: false,
    bisected: false,
    spawnGrow: 0,
    scale,
    id: fighter.id,

    hit(hit) {
      if (fighter.dead) return null
      const partGroup = body.parts[hit.part] || body.parts.chest
      partGroup.getWorldPosition(tmpPos)
      const hp = fighter.health
      const result = applyHit(fighter, hit)
      if (!result.events.length) return result

      const dir = new THREE.Vector3(hit.direction?.[0] || 0, hit.direction?.[1] || 0, hit.direction?.[2] || 1).normalize()
      if (hit.style === 'blunt') audio.hit({ style: 'blunt', bone: false, heavy: hit.heavy })
      else audio.hit({ style: 'sharp', heavy: hit.heavy })

      for (const event of result.events) {
        switch (event.type) {
          case 'blood': {
            const wound = event.part === 'head' || event.part === 'jaw'
              ? tmpPos
              : this.root.position.clone().setY(event.part.includes('Leg') ? 0.75 : 1.25)
            const sprayDir = dir.clone().add(new THREE.Vector3(0, 0.15, 0)).normalize()
            gore.spawnBlood(wound, sprayDir, event.amount, { arterial: event.arterial, speed: event.arterial ? 1.35 : 1 })
            if (event.arterial) {
              gore.wallSplashFrom(wound, sprayDir, 1.6)
              gore.addCorpsePool(this.root.position, 1.2)
            } else {
              gore.addGroundSplat(this.root.position.x + sprayDir.x * 0.7, this.root.position.z + sprayDir.z * 0.7, 0.55 + event.amount / 45)
              gore.wallSplashFrom(wound, sprayDir, 0.6)
            }
            break
          }
          case 'sever': {
            const part = event.part
            const group = body.parts[part]
            this.root.updateMatrixWorld(true)
            const world = new THREE.Vector3()
            group.getWorldPosition(world)
            if (part === 'rightArm' && body.weaponMesh) {
              // The weapon leaves with the arm.
            }
            const side = part.includes('left') ? -1 : 1
            const vel = new THREE.Vector3(dir.x * 2.4 + side * 0.8, 2.2 + Math.random() * 1.2, dir.z * 2.4 + (Math.random() - 0.5) * 1.4)
            gore.addDebris(group, {
              velocity: vel,
              spin: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9)
            })
            this.addBoneToLimb(group, part)
            body.showStump(part)
            audio.sever()
            gore.spawnBlood(world, dir, 34, { arterial: true, speed: 1.4 })
            gore.addGroundSplat(world.x, world.z, 1.15)
            break
          }
          case 'break': {
            body.showBone(event.part)
            break
          }
          case 'jawOff': {
            const jaw = body.parts.jaw
            this.root.updateMatrixWorld(true)
            const world = new THREE.Vector3()
            jaw.getWorldPosition(world)
            body.showJawSocket()
            gore.addDebris(jaw, {
              velocity: new THREE.Vector3(dir.x * 2.2, 1.6, dir.z * 2.2),
              spin: new THREE.Vector3(3, 4, 2)
            })
            gore.spawnBlood(world, dir, 18)
            gore.splatter(world, dir, 0.7)
            break
          }
          case 'skullOpen': {
            const cap = body.parts.cap
            const skull = body.parts.skull
            skull.getWorldPosition(tmpPos)
            body.showBrain()
            gore.addDebris(cap, {
              velocity: new THREE.Vector3(dir.x * 2.8, 3.2, dir.z * 2.8),
              spin: new THREE.Vector3(5, 2, 7)
            })
            gore.spawnBlood(tmpPos, dir, 45, { arterial: true, speed: 1.5 })
            gore.spawnBone(tmpPos.clone().add(new THREE.Vector3(0, 0.08, 0)), new THREE.Vector3(dir.x, 2.5, dir.z))
            gore.splatter(tmpPos, dir, 1.6)
            gore.addCorpsePool(this.root.position, 1)
            break
          }
          case 'headSplit': {
            const skull = body.parts.skull
            this.root.updateMatrixWorld(true)
            skull.getWorldPosition(tmpPos)
            body.showHeadCut()
            gore.addDebris(skull, {
              velocity: new THREE.Vector3(dir.x * 2.8, 2.6, dir.z * 2.8),
              spin: new THREE.Vector3(2, 5, 6)
            })
            gore.spawnBlood(tmpPos, dir, 52, { arterial: true, speed: 1.6 })
            gore.spawnGuts(tmpPos, dir)
            gore.wallSplashFrom(tmpPos, dir, 2)
            gore.addCorpsePool(this.root.position, 1.2)
            audio.sever()
            break
          }
          case 'bisect': {
            this.root.updateMatrixWorld(true)
            const chest = body.parts.chest
            const pelvis = body.parts.pelvis
            const world = new THREE.Vector3()
            chest.getWorldPosition(world)
            body.showBisectCut('chest')
            body.showBisectCut('pelvis')
            const upper = new THREE.Vector3(dir.x * 1.8, 2.2, dir.z * 1.8)
            gore.addDebris(chest, {
              velocity: upper,
              spin: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3)
            })
            const lower = pelvis
            const lowerVel = new THREE.Vector3(dir.x * 1.2 + (Math.random() - 0.5), 0.8, dir.z * 1.2 + (Math.random() - 0.5))
            gore.addDebris(lower, {
              velocity: lowerVel,
              spin: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4)
            })
            gore.spawnGuts(world, dir)
            gore.spawnBlood(world, dir, 70, { arterial: true, speed: 1.7 })
            gore.wallSplashFrom(world, dir, 2.4)
            gore.addCorpsePool(this.root.position, 1.9)
            this.bisected = true
            audio.sever()
            break
          }
          case 'dropWeapon': {
            // Only drop separately if the arm is still attached to the body.
            if (body.weaponMesh && body.weaponMesh.parent && !fighter.limbs.rightArm.severed) {
              const weapon = body.weaponMesh
              const world = new THREE.Vector3()
              weapon.getWorldPosition(world)
              body.weaponMesh = null
              gore.addDebris(weapon, {
                velocity: new THREE.Vector3(dir.x * 2.2, 2.4, dir.z * 2.2),
                spin: new THREE.Vector3(2.5, 5, 3.5)
              })
              gore.spawnBlood(world, dir, 8)
            }
            break
          }
          case 'crack':
            audio.crack()
            break
          case 'crawl':
            break
          case 'death': {
            this.deadTimer = 0
            this.state = 'dead'
            audio.death()
            audio.cheer(1)
            gore.addCorpsePool(this.root.position, 1.5)
            onDeath(this)
            break
          }
          default:
            break
        }
      }
      if (fighter.health < hp && fighter.health > 0) {
        this.state = 'stagger'
        this.stateTime = 0
      }
      return result
    },

    addBoneToLimb(group, part) {
      const bone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.04, 0.24, 6),
        body.boneMaterial
      )
      bone.position.set(0, part.includes('Arm') ? 0.03 : 0.03, 0.02)
      bone.rotation.set(0.4, 0, 0.25)
      bone.castShadow = true
      group.add(bone)
    },

    update(dt, player, others) {
      const fighter = this.fighter
      if (this.spawnGrow < 1) {
        this.spawnGrow = Math.min(1, this.spawnGrow + dt * 2.7)
        const grow = 1 - Math.pow(1 - this.spawnGrow, 3)
        this.root.scale.setScalar(this.scale * grow)
      }
      if (fighter.dead) {
        this.deadTimer += dt
        if (!this.bisected) {
          const t = Math.min(1, Math.max(0, (this.deadTimer - 0.35) / 0.85))
          const ease = 1 - Math.pow(1 - t, 3)
          const target = this.state === 'dead' ? 1.42 : 1.2
          body.pose.rotation.x = smooth(body.pose.rotation.x, target, 4 * ease + 0.5, dt)
          body.pose.position.y = smooth(body.pose.position.y, -0.04, 2, dt)
          if (t >= 1 && body.contact) body.contact.material.opacity = 0.22
        }
        return
      }

      this.stateTime += dt
      this.cooldown = Math.max(0, this.cooldown - dt)
      const toPlayer = tmpDir.copy(player.position).sub(this.root.position)
      toPlayer.y = 0
      const distance = toPlayer.length()
      if (distance > 0.001) toPlayer.divideScalar(distance)
      const targetYaw = Math.atan2(toPlayer.x, toPlayer.z)
      let deltaYaw = targetYaw - this.yaw
      while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2
      while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2
      this.yaw += deltaYaw * Math.min(1, dt * 6)
      this.root.rotation.y = this.yaw

      if (fighter.crawling) {
        body.pose.rotation.x = smooth(body.pose.rotation.x, 1.12, 4, dt)
        body.pose.position.y = smooth(body.pose.position.y, -0.04, 4, dt)
        // Drag the body along with alternating arm strokes; the shattered leg
        // trails behind while the good leg kicks for purchase.
        const stroke = Math.sin(this.walkPhase * 1.6)
        leftArm.rotation.x = smooth(leftArm.rotation.x, -1.05 - stroke * 0.35, 10, dt)
        rightArm.rotation.x = smooth(rightArm.rotation.x, -1.05 + stroke * 0.35, 10, dt)
        const leftBroken = fighter.limbs.leftLeg.broken || fighter.limbs.leftLeg.severed
        const rightBroken = fighter.limbs.rightLeg.broken || fighter.limbs.rightLeg.severed
        leftLeg.rotation.x = smooth(leftLeg.rotation.x, leftBroken ? 0.85 : 0.15 + stroke * 0.22, 8, dt)
        rightLeg.rotation.x = smooth(rightLeg.rotation.x, rightBroken ? 0.85 : 0.15 - stroke * 0.22, 8, dt)
      } else {
        body.pose.rotation.x = smooth(body.pose.rotation.x, 0, 6, dt)
        body.pose.position.y = smooth(body.pose.position.y, 0, 6, dt)
      }

      if (this.state === 'stagger') {
        const t = this.stateTime
        rightArm.rotation.x = smooth(rightArm.rotation.x, -0.25, 8, dt)
        leftArm.rotation.x = smooth(leftArm.rotation.x, 0.25, 8, dt)
        if (t > (fighter.crawling ? 0.4 : 0.32)) this.state = 'approach'
        return
      }

      // Melee attack state machine.
      if (this.state === 'windup') {
        const windup = fighter.crawling ? 0.7 : 0.5
        rightArm.rotation.x = smooth(rightArm.rotation.x, -2.25, 12, dt)
        body.parts.rightForearm.rotation.x = smooth(body.parts.rightForearm.rotation.x, -0.45, 12, dt)
        if (this.stateTime > windup) {
          this.state = 'swing'
          this.stateTime = 0
          this.swingHit = false
          audio.whoosh()
        }
        return
      }
      if (this.state === 'swing') {
        rightArm.rotation.x = smooth(rightArm.rotation.x, 0.65, 24, dt)
        body.parts.rightForearm.rotation.x = smooth(body.parts.rightForearm.rotation.x, 0.2, 20, dt)
        if (!this.swingHit && this.stateTime > 0.09) {
          this.swingHit = true
          const facing = tmpVec.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
          const toTarget = new THREE.Vector3().copy(player.position).sub(this.root.position)
          toTarget.y = 0
          const dist = toTarget.length()
          toTarget.normalize()
          if (dist < 2.35 && facing.dot(toTarget) > 0.35) {
            player.hurt(this.damage)
          }
        }
        if (this.stateTime > 0.22) {
          this.state = 'recover'
          this.stateTime = 0
        }
        return
      }
      if (this.state === 'recover') {
        rightArm.rotation.x = smooth(rightArm.rotation.x, -0.2, 8, dt)
        body.parts.rightForearm.rotation.x = smooth(body.parts.rightForearm.rotation.x, 0, 8, dt)
        if (this.stateTime > 0.3) {
          this.state = 'approach'
          this.cooldown = this.cooldownMax * (0.85 + Math.random() * 0.35)
        }
        return
      }

      // Approach / circle.
      if (!fighter.hasWeapon) {
        // Disarmed gladiators can only shove weakly.
        if (distance < 1.4 && this.cooldown <= 0) {
          player.hurt(Math.max(2, Math.round(this.damage * 0.3)))
          this.cooldown = 1.8
        }
      } else if (distance < this.attackRange && this.cooldown <= 0) {
        this.state = 'windup'
        this.stateTime = 0
        return
      }

      const crawlFactor = fighter.crawling ? 0.32 : 1
      if (distance > (fighter.crawling ? 1.2 : 1.7)) {
        const move = this.speed * crawlFactor * (fighter.hasWeapon ? 1 : 0.8)
        this.root.position.x += toPlayer.x * move * dt
        this.root.position.z += toPlayer.z * move * dt
        this.walkPhase += dt * (fighter.crawling ? 3 : 7)
        if (!fighter.crawling) {
          const swing = Math.sin(this.walkPhase) * 0.5
          leftLeg.rotation.x = swing
          rightLeg.rotation.x = -swing
          if (this.state !== 'windup' && this.state !== 'swing') {
            leftArm.rotation.x = -swing * 0.7
            rightArm.rotation.x = swing * 0.55 - 0.2
          }
        }
      } else {
        leftLeg.rotation.x = smooth(leftLeg.rotation.x, 0, 8, dt)
        rightLeg.rotation.x = smooth(rightLeg.rotation.x, 0, 8, dt)
        leftArm.rotation.x = smooth(leftArm.rotation.x, 0.1, 8, dt)
        rightArm.rotation.x = smooth(rightArm.rotation.x, -0.2, 8, dt)
      }

      // Separation from other fighters.
      if (others) {
        for (const other of others) {
          if (other === this || other.removed || other.fighter.dead) continue
          const dx = this.root.position.x - other.root.position.x
          const dz = this.root.position.z - other.root.position.z
          const d2 = dx * dx + dz * dz
          if (d2 < 0.95 && d2 > 0.0001) {
            const d = Math.sqrt(d2)
            const push = (0.95 - d) * 0.5
            this.root.position.x += (dx / d) * push
            this.root.position.z += (dz / d) * push
          }
        }
      }

      // Arena bounds.
      const radius = Math.hypot(this.root.position.x, this.root.position.z)
      if (radius > 16.35) {
        this.root.position.x = (this.root.position.x / radius) * 16.35
        this.root.position.z = (this.root.position.z / radius) * 16.35
      }

      // Wounded gladiators drip blood.
      this.bleedTimer -= dt
      if (this.bleedTimer <= 0 && fighter.health < fighter.maxHealth) {
        this.bleedTimer = fighter.crawling ? 0.9 : 0.55
        const wound = this.root.position.clone().setY(fighter.crawling ? 0.45 : 1.1)
        gore.spawnBlood(wound, new THREE.Vector3(Math.sin(this.yaw + 1.5), 0.2, Math.cos(this.yaw + 1.5)), 2, { speed: 0.4 })
        if (Math.random() < 0.25) gore.addGroundSplat(this.root.position.x, this.root.position.z, 0.22)
      }
    },

    dispose() {
      this.removed = true
      if (this.root.parent) this.root.parent.remove(this.root)
    }
  }

  body.root.traverse(object => {
    if (object.userData.hitbox) object.userData.npc = npc
  })

  return npc
}
