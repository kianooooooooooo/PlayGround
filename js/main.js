import * as THREE from 'three'
import { createArena } from './arena.js'
import { createCrowd } from './crowd.js'
import { createGore } from './gore.js'
import { createGladiator } from './body.js'
import { createNPC } from './npc.js'
import { createPlayer } from './player.js'
import { createAudio } from './audio.js'
import { makeContactShadowTexture } from './textures.js'
import { createFighter, WEAPONS, wavePlan, waveClearBonus } from './model.js'

const $ = id => document.getElementById(id)

const canvas = $('game')
const titleScreen = $('title')
const hud = $('hud')
const pauseScreen = $('pause')
const gameoverScreen = $('gameover')
const touchUI = $('touch')
const loading = $('loading')
const healthFill = $('health-fill')
const healthNumber = $('health-number')
const playerStatus = $('player-status')
const waveNumber = $('wave-number')
const foesLeft = $('foes-left')
const killCount = $('kill-count')
const scoreCount = $('score-count')
const weaponIcon = $('weapon-icon')
const hudWeaponName = $('hud-weapon-name')
const hudWeaponSub = $('hud-weapon-sub')
const waveBanner = $('wave-banner')
const bannerKicker = $('banner-kicker')
const bannerTitle = $('banner-title')
const bannerSub = $('banner-sub')
const toast = $('toast')
const combo = $('combo')
const crosshair = $('crosshair')
const bloodFlash = $('blood-flash')
const damageRing = $('damage-ring')
const muteBtn = $('mute-btn')
const rotateHint = $('rotate-hint')

const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
document.body.classList.toggle('touch-device', isTouch)

// ---------------- Renderer ----------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.98
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 320)
scene.add(camera)

const arena = createArena(scene)
const crowd = createCrowd(arena)
const contactTexture = makeContactShadowTexture()
const gore = createGore(scene, arena, contactTexture)
const audio = createAudio()

const playerProxy = {
  get position() { return camera.position },
  hurt: amount => player.hurt(amount)
}

let player
try {
  player = createPlayer({
    camera,
    weaponType: 'sword',
    audio,
    onHurt: (health, amount) => onPlayerHurt(health, amount),
    onDeath: () => onPlayerDeath()
  })
} catch (error) {
  console.error(error)
  throw error
}
player.viewmodel.visible = false

// ---------------- State ----------------
const game = {
  state: 'menu',
  previousState: 'playing',
  wave: 1,
  kills: 0,
  score: 0,
  selectedWeapon: 'sword',
  npcs: [],
  spawnRemaining: 0,
  spawnTimer: 0,
  alive: 0,
  intermission: 0,
  plan: null,
  time: 0,
  hudTimer: 0,
  deathTimer: 0,
  hadPointerLock: false,
  hitStop: 0,
  killsThisWave: 0,
  displayedFoes: -1
}

const dirVector = new THREE.Vector3()
const originVector = new THREE.Vector3()
const tempVector = new THREE.Vector3()
const tempVector2 = new THREE.Vector3()
const raycaster = new THREE.Raycaster()

const WEAPON_ICONS = {
  sword: `<svg viewBox="0 0 64 64"><path d="M32 4 L38 18 L35.5 45 L32 51 L28.5 45 L26 18 Z" fill="currentColor"/><rect x="18" y="45" width="28" height="4" rx="1" fill="currentColor"/><rect x="30" y="49" width="4" height="9" fill="currentColor"/><circle cx="32" cy="60" r="3.2" fill="currentColor"/></svg>`,
  hammer: `<svg viewBox="0 0 64 64"><path d="M30 24 L35 24 L37 56 L28 56 Z" fill="currentColor"/><rect x="12" y="9" width="40" height="16" rx="3" fill="currentColor"/><rect x="17" y="25" width="30" height="5" fill="currentColor" opacity=".58"/><path d="M12 13 L5 17 L12 21 M52 13 L59 17 L52 21" fill="currentColor"/></svg>`
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']
function roman(n) {
  return ROMAN[n] || String(n)
}

// ---------------- HUD ----------------
function updateWeaponHud() {
  const weapon = WEAPONS[game.selectedWeapon]
  weaponIcon.innerHTML = WEAPON_ICONS[weapon.id]
  hudWeaponName.textContent = weapon.name.toUpperCase()
  hudWeaponSub.textContent = weapon.subtitle.toUpperCase()
}

function updateHud() {
  const pct = Math.max(0, Math.min(100, player.state.health))
  healthFill.style.width = `${pct}%`
  healthNumber.textContent = Math.round(pct)
  healthFill.classList.toggle('low', pct <= 30)
  playerStatus.textContent =
    pct > 75 ? 'UNHARMED' : pct > 50 ? 'BLOODIED' : pct > 25 ? 'BADLY WOUNDED' : 'NEAR DEATH'
  waveNumber.textContent = roman(game.wave)
  killCount.textContent = game.kills
  scoreCount.textContent = game.score

  if (game.state === 'intermission') {
    foesLeft.textContent = `NEXT WAVE IN ${Math.max(1, Math.ceil(game.intermission))}`
  } else if (game.state === 'playing') {
    const total = game.spawnRemaining + game.npcs.filter(n => !n.fighter.dead).length
    foesLeft.textContent = total === 1 ? '1 FOE REMAINS' : `${total} FOES REMAIN`
  } else {
    foesLeft.textContent = ''
  }
}

let bannerHideTimer = null
let bannerOutTimer = null
function showBanner(kicker, title, sub, duration = 2800) {
  clearTimeout(bannerHideTimer)
  clearTimeout(bannerOutTimer)
  bannerKicker.textContent = kicker
  bannerTitle.textContent = title
  bannerSub.textContent = sub
  waveBanner.classList.remove('hidden', 'out')
  bannerHideTimer = setTimeout(() => {
    waveBanner.classList.add('out')
    bannerOutTimer = setTimeout(() => waveBanner.classList.add('hidden'), 480)
  }, duration)
}

let toastTimer = null
let toastPopTimer = null
function showToast(text, duration = 1900) {
  clearTimeout(toastTimer)
  clearTimeout(toastPopTimer)
  toast.textContent = text
  toast.classList.remove('hidden', 'pop')
  void toast.offsetWidth
  toast.classList.add('pop')
  toastPopTimer = setTimeout(() => toast.classList.remove('pop'), 380)
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration)
}

let comboTimer = null
function showCombo(text) {
  clearTimeout(comboTimer)
  combo.textContent = text
  combo.classList.remove('hidden')
  combo.style.animation = 'none'
  void combo.offsetWidth
  combo.style.animation = ''
  comboTimer = setTimeout(() => combo.classList.add('hidden'), 1100)
}

function flashPlayerDamage() {
  bloodFlash.classList.add('on')
  damageRing.classList.add('on')
  setTimeout(() => bloodFlash.classList.remove('on'), 260)
  setTimeout(() => damageRing.classList.remove('on'), 380)
}

function strikeCrosshair() {
  crosshair.classList.add('strike')
  setTimeout(() => crosshair.classList.remove('strike'), 130)
}

// ---------------- Waves ----------------
function clearCombatants() {
  for (const npc of game.npcs) npc.dispose()
  game.npcs.length = 0
}

function removeAllCorpses() {
  clearCombatants()
  gore.clear()
}

function spawnNPC(index, angleOverride, distanceOverride) {
  const plan = game.plan
  const baseAngle = player.state.yaw + Math.PI
  const angle = angleOverride ?? baseAngle + (Math.random() - 0.5) * 2.3
  const distance = distanceOverride ?? 7.6 + Math.random() * 3.2
  let x = camera.position.x + Math.sin(angle) * distance
  let z = camera.position.z + Math.cos(angle) * distance
  const radiusFromCenter = Math.hypot(x, z)
  if (radiusFromCenter > 15.5) {
    x = (x / radiusFromCenter) * 15.5
    z = (z / radiusFromCenter) * 15.5
  }
  const npcWeapon = Math.random() > 0.52 ? 'sword' : 'hammer'
  const seed = game.wave * 97 + index * 13 + 5
  const fighter = createFighter({ health: plan.health, weapon: npcWeapon, seed })
  const body = createGladiator({ seed, weapon: npcWeapon })
  const scale = 0.92 + Math.random() * 0.13
  body.root.position.set(x, 0, z)
  scene.add(body.root)

  const npc = createNPC({
    body,
    fighter,
    gore,
    audio,
    contactTexture,
    speed: plan.speed * (0.9 + Math.random() * 0.2),
    damage: plan.damage,
    attackCooldown: plan.attackCooldown,
    scale,
    onDeath: handleNPCDeath
  })
  npc.yaw = Math.atan2(camera.position.x - body.root.position.x, camera.position.z - body.root.position.z)
  body.root.rotation.y = npc.yaw
  npc.spawnIndex = index
  game.npcs.push(npc)
  game.spawnRemaining--
  game.spawnTimer = 0.75 + Math.random() * 0.55
  updateHud()
  return npc
}

function startWave(wave) {
  clearCombatants()
  gore.clear()
  game.wave = wave
  game.plan = wavePlan(wave)
  game.spawnRemaining = game.plan.total
  game.spawnTimer = 0
  game.killsThisWave = 0
  game.state = 'playing'
  player.heal(18)
  updateHud()
  showBanner('THE GATES OPEN', `WAVE ${roman(wave)}`, `${game.plan.total} CHALLENGERS ENTER THE SAND`, 2600)
  audio.horn()
  if (isTouch) touchUI.classList.remove('hidden')
  hud.classList.remove('hidden')
  // First challenger enters opposite the player for a clean opening shot.
  spawnNPC(0, Math.PI)
  for (let i = 1; i < Math.min(2, game.plan.concurrent); i++) {
    setTimeout(() => {
      if (game.state === 'playing' || game.state === 'intermission') spawnNPC(i)
    }, 500 + i * 350)
  }
}

function aliveCount() {
  let count = 0
  for (const npc of game.npcs) if (!npc.fighter.dead) count++
  return count
}

function handleNPCDeath(npc) {
  game.kills++
  game.killsThisWave++
  game.score += 80 + game.wave * 25
  crowd.cheer(1.15)
  updateHud()
  const lines = ['THE CROWD ROARS', 'LIMBS FOR THE SAND', 'THE EMPEROR APPROVES', 'A FINE DEATH', 'BLOOD FOR THE CROWD']
  showToast(lines[Math.floor(Math.random() * lines.length)])
  if (npc.fighter.bisected) showCombo('BISECTED')
  else if (npc.fighter.skullOpen) showCombo('SKULL CAVED IN')
  else if (npc.fighter.headSplit) showCombo('HEAD SPLIT')
  else if (npc.fighter.jawGone) showCombo('JAW TORN OFF')
  else if (npc.fighter.limbs.leftArm.severed || npc.fighter.limbs.rightArm.severed) showCombo('ARM SEVERED')
  else if (npc.fighter.crawling) showCombo('LEGGED')
}

function beginIntermission() {
  game.state = 'intermission'
  game.intermission = 4.4
  player.heal(waveClearBonus(game.wave).heal)
  game.score += waveClearBonus(game.wave).score
  updateHud()
  showBanner('THE SAND IS QUIET', 'WAVE CLEARED', 'THE CROWD CHANTS YOUR NAME', 2600)
  showToast('SURVIVOR OF THE SAND')
  crowd.cheer(1.7)
  audio.cheer(1.6)
  audio.horn()
}

function onPlayerHurt(health, amount) {
  flashPlayerDamage()
  updateHud()
}

function onPlayerDeath() {
  if (game.state === 'gameover' || game.state === 'dying') return
  game.state = 'dying'
  game.deathTimer = 0
  touchUI.classList.add('hidden')
  if (document.pointerLockElement) document.exitPointerLock()
}

function showGameOver() {
  game.state = 'gameover'
  $('final-wave').textContent = roman(game.wave)
  $('final-kills').textContent = game.kills
  $('final-score').textContent = game.score
  $('death-kicker').innerHTML = '<span></span> THE SAND DRINKS DEEP <span></span>'
  $('death-title').textContent = 'YOU FALL'
  $('death-line').textContent = 'The crowd screams for more. There is always another challenger.'
  gameoverScreen.classList.remove('hidden')
  hud.classList.add('hidden')
}

function startGame() {
  audio.ensure()
  player.reset()
  game.state = 'playing'
  game.wave = 1
  game.kills = 0
  game.score = 0
  game.deathTimer = 0
  player.setWeapon(game.selectedWeapon)
  updateWeaponHud()
  titleScreen.classList.add('hidden')
  gameoverScreen.classList.add('hidden')
  pauseScreen.classList.add('hidden')
  hud.classList.remove('hidden')
  player.viewmodel.visible = true
  game.hadPointerLock = false
  if (!isTouch) {
    canvas.requestPointerLock?.()
  }
  startWave(1)
}

function toMenu() {
  game.state = 'menu'
  clearCombatants()
  gore.clear()
  player.viewmodel.visible = false
  hud.classList.add('hidden')
  gameoverScreen.classList.add('hidden')
  pauseScreen.classList.add('hidden')
  touchUI.classList.add('hidden')
  titleScreen.classList.remove('hidden')
  game.wave = 1
  game.kills = 0
  game.score = 0
  updateHud()
}

function toggleWeapon(next) {
  game.selectedWeapon = next || (game.selectedWeapon === 'sword' ? 'hammer' : 'sword')
  document.querySelectorAll('.weapon-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.weapon === game.selectedWeapon)
  })
  if (game.state === 'playing' || game.state === 'intermission' || game.state === 'paused') {
    player.setWeapon(game.selectedWeapon)
  }
  updateWeaponHud()
  audio.ui()
}

function pauseGame() {
  if (game.state !== 'playing' && game.state !== 'intermission') return
  game.previousState = game.state
  game.state = 'paused'
  pauseScreen.classList.remove('hidden')
  player.keys.clear()
  player.analog.x = 0
  player.analog.z = 0
  if (document.pointerLockElement) document.exitPointerLock()
}

function resumeGame() {
  if (game.state !== 'paused') return
  game.state = game.previousState
  pauseScreen.classList.add('hidden')
  audio.ensure()
  if (!isTouch) canvas.requestPointerLock?.()
}

// ---------------- Combat ----------------
function collectHitboxes() {
  const boxes = []
  for (const npc of game.npcs) {
    if (npc.fighter.dead) continue
    npc.root.traverse(object => {
      if (object.isMesh && object.userData.hitbox && object.visible) boxes.push(object)
    })
  }
  return boxes
}

function fallbackAim(dir) {
  let best = null
  let bestScore = Infinity
  for (const npc of game.npcs) {
    if (npc.fighter.dead) continue
    tempVector.copy(npc.root.position).setY(1.15).sub(camera.position)
    const distance = tempVector.length()
    if (distance > player.state.weapon.reach + 1.1) continue
    tempVector.normalize()
    const alignment = tempVector.dot(dir)
    if (alignment < 0.52) continue
    const score = distance * (1.4 - alignment)
    if (score < bestScore) {
      bestScore = score
      best = npc
    }
  }
  if (!best) return null

  const toNpc = tempVector2.copy(best.root.position).setY(1.1).sub(camera.position)
  const t = Math.max(0.2, toNpc.dot(dir))
  const aimPoint = originVector.clone().addScaledVector(dir, t)
  const local = best.root.worldToLocal(aimPoint.clone())
  const normalized = THREE.MathUtils.clamp(local.y / 1.95, 0, 1)
  let part
  if (normalized > 0.88) part = 'head'
  else if (normalized > 0.79) part = 'jaw'
  else if (normalized > 0.42) part = 'torso'
  else if (normalized > 0.22) part = local.x > 0 ? 'rightArm' : 'leftArm'
  else part = local.x > 0 ? 'rightLeg' : 'leftLeg'
  return { npc: best, part }
}

function performAttack() {
  const weapon = player.state.weapon
  const heavy = player.state.heavy
  camera.getWorldPosition(originVector)
  camera.getWorldDirection(dirVector)
  const damage = heavy ? weapon.heavyDamage : weapon.damage

  raycaster.set(originVector, dirVector)
  raycaster.far = weapon.reach + 0.6
  const hits = raycaster.intersectObjects(collectHitboxes(), false)
  let target = null
  let part = null
  if (hits.length) {
    const hit = hits[0]
    const npc = hit.object.userData.npc
    if (npc && !npc.fighter.dead) {
      target = npc
      part = hit.object.userData.part
    }
  }
  if (!target) {
    const fallback = fallbackAim(dirVector)
    if (fallback) {
      target = fallback.npc
      part = fallback.part
    }
  }

  if (!target) {
    audio.whoosh(heavy)
    return
  }

  strikeCrosshair()
  player.state.shake = Math.min(0.45, player.state.shake + (heavy ? 0.32 : 0.16))
  game.hitStop = heavy ? 0.06 : 0.03
  const result = target.hit({
    part,
    style: weapon.sharp ? 'sharp' : 'blunt',
    damage,
    heavy,
    direction: dirVector.toArray()
  })

  if (result) {
    const types = new Set(result.events.map(event => event.type))
    if (types.has('bisect')) showCombo('BISECTED')
    else if (types.has('headSplit')) showCombo('HEAD SPLIT')
    else if (types.has('skullOpen')) showCombo('SKULL CRACKED')
    else if (types.has('jawOff')) showCombo('JAW BROKEN OFF')
    else if (types.has('sever')) {
      const event = result.events.find(e => e.type === 'sever')
      showCombo(`${event.part.replace('left', 'LEFT ').replace('right', 'RIGHT ').replace('Arm', ' ARM').replace('Leg', ' LEG')} SEVERED`)
    } else if (types.has('break')) {
      const event = result.events.find(e => e.type === 'break')
      showCombo(`${event.part.includes('Arm') ? 'ARM' : 'LEG'} BONE SHATTERED`)
    } else if (types.has('crack')) {
      showCombo('BONE CRACKS')
    }
  }
}

// ---------------- Input ----------------
window.addEventListener('keydown', event => {
  if (event.code === 'Escape') {
    if (game.state === 'paused') resumeGame()
    else if (game.state === 'playing' || game.state === 'intermission') pauseGame()
    return
  }
  if (event.code === 'KeyM') {
    const muted = audio.toggleMute()
    muteBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON'
    return
  }
  if (game.state !== 'playing' && game.state !== 'intermission') return
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    player.keys.add(event.code)
    if (event.code.startsWith('Arrow')) event.preventDefault()
  }
  if (event.code === 'Space') {
    event.preventDefault()
    player.dodge()
  }
  if (event.code === 'KeyR') toggleWeapon()
  if (event.code === 'Digit1') toggleWeapon('sword')
  if (event.code === 'Digit2') toggleWeapon('hammer')
})

window.addEventListener('keyup', event => {
  player.keys.delete(event.code)
})

window.addEventListener('mousemove', event => {
  if (document.pointerLockElement === canvas) {
    player.look(event.movementX, event.movementY)
  }
})

window.addEventListener('mousedown', event => {
  if (game.state !== 'playing' && game.state !== 'intermission') return
  if (document.pointerLockElement !== canvas) {
    if (!isTouch && game.state !== 'paused') canvas.requestPointerLock?.()
    return
  }
  if (event.button === 0) player.attack(false)
  if (event.button === 2) player.attack(true)
})

window.addEventListener('contextmenu', event => event.preventDefault())
window.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    game.hadPointerLock = true
  } else if (game.hadPointerLock && !isTouch && (game.state === 'playing' || game.state === 'intermission')) {
    pauseGame()
  }
})

// Weapon selection on title screen.
document.querySelectorAll('.weapon-card').forEach(card => {
  card.addEventListener('click', () => toggleWeapon(card.dataset.weapon))
})

$('play-btn').addEventListener('click', startGame)
$('restart-btn').addEventListener('click', () => {
  gameoverScreen.classList.add('hidden')
  startGame()
})
$('menu-btn').addEventListener('click', toMenu)
$('resume-btn').addEventListener('click', resumeGame)
muteBtn.addEventListener('click', () => {
  audio.ensure()
  const muted = audio.toggleMute()
  muteBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON'
})

// ---------------- Touch controls ----------------
const joystick = $('joystick')
const knob = $('joystick-knob')
let joystickPointer = null
let joystickCenter = { x: 0, y: 0 }
let lookPointer = null
let lookLast = { x: 0, y: 0 }

function updateTouchVisibility() {
  const show = isTouch && (game.state === 'playing' || game.state === 'intermission')
  touchUI.classList.toggle('hidden', !show)
}

if (isTouch) {
  joystick.addEventListener('pointerdown', event => {
    event.preventDefault()
    joystickPointer = event.pointerId
    const rect = joystick.getBoundingClientRect()
    joystickCenter.x = rect.left + rect.width / 2
    joystickCenter.y = rect.top + rect.height / 2
    joystick.setPointerCapture(event.pointerId)
    moveJoystick(event.clientX, event.clientY)
  })
  joystick.addEventListener('pointermove', event => {
    if (event.pointerId !== joystickPointer) return
    event.preventDefault()
    moveJoystick(event.clientX, event.clientY)
  })
  const endJoystick = event => {
    if (event.pointerId !== joystickPointer) return
    joystickPointer = null
    knob.style.transform = ''
    player.analog.x = 0
    player.analog.z = 0
  }
  joystick.addEventListener('pointerup', endJoystick)
  joystick.addEventListener('pointercancel', endJoystick)

  function moveJoystick(x, y) {
    let dx = x - joystickCenter.x
    let dy = y - joystickCenter.y
    const max = 42
    const length = Math.hypot(dx, dy)
    if (length > max) {
      dx = (dx / length) * max
      dy = (dy / length) * max
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`
    player.analog.x = dx / max
    player.analog.z = -dy / max
  }

  canvas.addEventListener('pointerdown', event => {
    if ((game.state !== 'playing' && game.state !== 'intermission') || event.pointerType === 'mouse') return
    if (event.clientX < window.innerWidth * 0.28 && event.clientY > window.innerHeight * 0.5) return
    if (lookPointer !== null) return
    lookPointer = event.pointerId
    lookLast.x = event.clientX
    lookLast.y = event.clientY
  })
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== lookPointer) return
    const dx = event.clientX - lookLast.x
    const dy = event.clientY - lookLast.y
    lookLast.x = event.clientX
    lookLast.y = event.clientY
    player.look(dx * 2.4, dy * 2.4, 0.0028)
  })
  const endLook = event => {
    if (event.pointerId === lookPointer) lookPointer = null
  }
  canvas.addEventListener('pointerup', endLook)
  canvas.addEventListener('pointercancel', endLook)

  $('touch-attack').addEventListener('pointerdown', event => {
    event.preventDefault()
    audio.ensure()
    player.attack(false)
  })
  $('touch-heavy').addEventListener('pointerdown', event => {
    event.preventDefault()
    audio.ensure()
    player.attack(true)
  })
  $('touch-swap').addEventListener('pointerdown', event => {
    event.preventDefault()
    toggleWeapon()
  })
  $('touch-dodge').addEventListener('pointerdown', event => {
    event.preventDefault()
    player.dodge()
  })
}

// Prevent iOS double-tap zoom and long-press menus over the arena.
document.addEventListener('gesturestart', event => event.preventDefault())
document.addEventListener('touchstart', event => {
  if (event.target === canvas) event.preventDefault()
}, { passive: false })

// ---------------- Menu camera ----------------
function menuCamera(time) {
  const angle = time * 0.075
  camera.position.set(Math.sin(angle) * 11.2, 8.4 + Math.sin(time * 0.21) * 0.4, Math.cos(angle) * 11.2)
  camera.lookAt(0, 1.4, 0)
}

menuCamera(0)

// ---------------- Main loop ----------------
let last = performance.now()
function animate(now) {
  requestAnimationFrame(animate)
  let dt = Math.min(0.05, (now - last) / 1000)
  last = now
  game.time += dt
  arena.update(dt, game.time)
  crowd.update(dt, game.time)

  if (game.hitStop > 0) {
    game.hitStop = Math.max(0, game.hitStop - dt)
  }

  if (game.state === 'menu') {
    menuCamera(game.time)
  } else if (game.state === 'playing' || game.state === 'intermission') {
    player.update(dt)
    if (player.consumeHit()) performAttack()
    for (const npc of game.npcs) {
      npc.update(dt, playerProxy, game.npcs)
    }

    if (game.state === 'playing') {
      const alive = aliveCount()
      if (game.spawnRemaining > 0) {
        game.spawnTimer -= dt
        if (game.spawnTimer <= 0 && alive < game.plan.concurrent) {
          spawnNPC(game.plan.total - game.spawnRemaining)
        }
      } else if (alive === 0) {
        beginIntermission()
      }
    } else if (game.state === 'intermission') {
      game.intermission -= dt
      if (game.intermission <= 0) startWave(game.wave + 1)
    }

    game.hudTimer -= dt
    if (game.hudTimer <= 0) {
      game.hudTimer = 0.22
      updateHud()
    }
  } else if (game.state === 'dying') {
    game.deathTimer += dt
    player.update(dt)
    const t = Math.min(1, game.deathTimer / 1.1)
    const ease = 1 - Math.pow(1 - t, 2)
    camera.position.y = 1.68 - 1.0 * ease
    camera.rotation.z = 0.9 * ease
    camera.rotation.x = -0.5 * ease
    for (const npc of game.npcs) npc.update(dt, playerProxy, game.npcs)
    if (game.deathTimer > 1.25) showGameOver()
  } else if (game.state === 'paused' || game.state === 'gameover') {
    // Render the frozen arena.
  }

  gore.update(dt)
  renderer.render(scene, camera)
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
  renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)
window.addEventListener('orientationchange', () => setTimeout(onResize, 80))
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (game.state === 'playing' || game.state === 'intermission')) pauseGame()
})

updateWeaponHud()
updateHud()
requestAnimationFrame(animate)

// Hide the loading veil after the first painted frames.
requestAnimationFrame(() => {
  setTimeout(() => loading.classList.add('done'), 220)
})

// A small public surface for debugging and automated visual checks.
window.__BLOOD_AND_SAND = {
  game,
  player,
  gore,
  crowd,
  arena,
  camera,
  scene,
  start: startGame,
  menu: toMenu,
  spawn: (angle = Math.PI, distance) => spawnNPC(0, angle, distance),
  attack: performAttack,
  hitNearest: (part = 'head', style = 'blunt', heavy = true) => {
    let best = null
    let bestD = Infinity
    for (const npc of game.npcs) {
      if (npc.fighter.dead) continue
      const d = npc.root.position.distanceTo(camera.position)
      if (d < bestD) { bestD = d; best = npc }
    }
    if (!best) return null
    const direction = best.root.position.clone().sub(camera.position).setY(0).normalize()
    return best.hit({ part, style, damage: style === 'sharp' ? 72 : 92, heavy, direction: direction.toArray() })
  },
  killAll: () => {
    for (const npc of game.npcs) {
      if (!npc.fighter.dead) npc.hit({ part: 'torso', style: 'sharp', damage: 999, heavy: true, direction: [0, 0, 1] })
    }
  }
}
