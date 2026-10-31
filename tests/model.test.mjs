import test from 'node:test'
import assert from 'node:assert/strict'
import { applyHit, createFighter, pickFallbackPart, wavePlan } from '../js/model.js'

function hammer(part, { heavy = false } = {}) {
  return { part, style: 'blunt', damage: heavy ? 92 : 46, heavy, direction: [0, 0, 1] }
}
function sword(part, { heavy = false } = {}) {
  return { part, style: 'sharp', damage: heavy ? 72 : 30, heavy, direction: [0, 0, 1] }
}
function eventsOf(result, type) {
  return result.events.filter(event => event.type === type)
}

test('hammer cracks a skull open and kills the gladiator', () => {
  const fighter = createFighter()
  let result = applyHit(fighter, hammer('head'))
  assert.equal(fighter.dead, false, 'one ordinary head blow should not kill')
  result = applyHit(fighter, hammer('head'))
  assert.equal(fighter.skullOpen, true)
  assert.equal(fighter.dead, true)
  assert.equal(fighter.deathCause, 'skullOpen')
  assert.equal(eventsOf(result, 'skullOpen').length, 1)
  assert.equal(eventsOf(result, 'gore')[0].part, 'brain')
})

test('a heavy hammer blow opens the skull in one strike', () => {
  const fighter = createFighter()
  const result = applyHit(fighter, hammer('head', { heavy: true }))
  assert.equal(fighter.skullOpen, true)
  assert.equal(fighter.dead, true)
  assert.equal(eventsOf(result, 'crack').length, 1)
})

test('hammer breaks the jaw clean off', () => {
  const fighter = createFighter()
  const result = applyHit(fighter, hammer('jaw'))
  assert.equal(fighter.jawGone, true)
  assert.equal(fighter.dead, false)
  assert.equal(eventsOf(result, 'jawOff').length, 1)
})

test('breaking the weapon arm drops the weapon and exposes bone', () => {
  const fighter = createFighter({ weapon: 'sword' })
  applyHit(fighter, hammer('rightArm'))
  const result = applyHit(fighter, hammer('rightArm'))
  assert.equal(fighter.limbs.rightArm.broken, true)
  assert.equal(fighter.hasWeapon, false)
  assert.equal(fighter.weaponDropped, true)
  assert.equal(eventsOf(result, 'break').length, 1)
  assert.equal(eventsOf(result, 'dropWeapon').length, 1)
})

test('breaking a leg makes the gladiator crawl', () => {
  const fighter = createFighter()
  applyHit(fighter, hammer('leftLeg'))
  const result = applyHit(fighter, hammer('leftLeg'))
  assert.equal(fighter.limbs.leftLeg.broken, true)
  assert.equal(fighter.crawling, true)
  assert.equal(eventsOf(result, 'crawl').length, 1)
})

test('sword severs an arm and the weapon falls with it', () => {
  const fighter = createFighter({ weapon: 'hammer' })
  applyHit(fighter, sword('rightArm'))
  const result = applyHit(fighter, sword('rightArm'))
  assert.equal(fighter.limbs.rightArm.severed, true)
  assert.equal(fighter.hasWeapon, false)
  assert.equal(eventsOf(result, 'sever').length, 1)
  assert.equal(eventsOf(result, 'dropWeapon').length, 1)
})

test('a heavy sword cut severs a limb in one strike', () => {
  const fighter = createFighter()
  applyHit(fighter, sword('leftArm', { heavy: true }))
  assert.equal(fighter.limbs.leftArm.severed, true)
})

test('severing a leg grounds the gladiator', () => {
  const fighter = createFighter()
  applyHit(fighter, sword('rightLeg', { heavy: true }))
  assert.equal(fighter.limbs.rightLeg.severed, true)
  assert.equal(fighter.crawling, true)
})

test('a heavy sword blow bisects the torso and spills guts', () => {
  const fighter = createFighter({ health: 130 })
  const result = applyHit(fighter, sword('torso', { heavy: true }))
  assert.equal(fighter.bisected, true)
  assert.equal(fighter.dead, true)
  assert.equal(fighter.deathCause, 'bisected')
  assert.equal(eventsOf(result, 'bisect').length, 1)
  assert.equal(eventsOf(result, 'gore')[0].part, 'guts')
  assert.ok(eventsOf(result, 'blood')[0].amount >= 50)
})

test('a heavy sword cut splits the head but leaves the jaw', () => {
  const fighter = createFighter({ health: 200 })
  const result = applyHit(fighter, sword('head', { heavy: true }))
  assert.equal(fighter.headSplit, true)
  assert.equal(fighter.jawGone, false)
  assert.equal(fighter.dead, true)
  assert.equal(eventsOf(result, 'headSplit').length, 1)
})

test('dead fighters ignore further damage', () => {
  const fighter = createFighter()
  applyHit(fighter, sword('head', { heavy: true }))
  const result = applyHit(fighter, hammer('head'))
  assert.equal(result.events.length, 0)
})

test('fallback aim maps screen height to body parts', () => {
  assert.equal(pickFallbackPart(0.95), 'head')
  assert.equal(pickFallbackPart(0.84), 'jaw')
  assert.equal(pickFallbackPart(0.65), 'torso')
  assert.equal(pickFallbackPart(0.32), 'rightArm')
  assert.equal(pickFallbackPart(0.05), 'leftLeg')
})

test('waves scale enemies while keeping concurrency bounded', () => {
  const first = wavePlan(1)
  const tenth = wavePlan(10)
  assert.ok(tenth.total > first.total)
  assert.ok(tenth.health > first.health)
  assert.ok(tenth.speed > first.speed)
  assert.ok(tenth.concurrent <= 7)
  assert.ok(tenth.attackCooldown < first.attackCooldown)
})
