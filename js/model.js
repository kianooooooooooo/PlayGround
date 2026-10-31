// Pure combat model — no Three.js imports so it can be unit tested in Node.

export const PARTS = ['head', 'jaw', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']

export const WEAPONS = {
  sword: {
    id: 'sword',
    name: 'Gladius',
    subtitle: 'Cut · Sever · Bisect',
    sharp: true,
    damage: 30,
    heavyDamage: 72,
    reach: 2.85,
    arc: 0.72,
    windup: 0.09,
    swing: 0.16,
    recovery: 0.26,
    heavyWindup: 0.34,
    heavySwing: 0.22,
    heavyRecovery: 0.38,
    icon: 'sword'
  },
  hammer: {
    id: 'hammer',
    name: 'War Hammer',
    subtitle: 'Crush · Break · Pulverise',
    sharp: false,
    damage: 46,
    heavyDamage: 92,
    reach: 2.55,
    arc: 0.64,
    windup: 0.15,
    swing: 0.2,
    recovery: 0.34,
    heavyWindup: 0.42,
    heavySwing: 0.26,
    heavyRecovery: 0.5,
    icon: 'hammer'
  }
}

const LIMB_HP = {
  head: 90,
  jaw: 42,
  torso: 170,
  leftArm: 92,
  rightArm: 92,
  leftLeg: 96,
  rightLeg: 96
}

const HEALTH_MULTIPLIER = {
  head: 1.85,
  jaw: 1.2,
  torso: 1,
  leftArm: 0.72,
  rightArm: 0.72,
  leftLeg: 0.78,
  rightLeg: 0.78
}

const SHARP_MULTIPLIER = {
  head: 1.25,
  jaw: 1.35,
  torso: 1,
  leftArm: 1.7,
  rightArm: 1.7,
  leftLeg: 1.7,
  rightLeg: 1.7
}

const BLUNT_MULTIPLIER = {
  head: 1.35,
  jaw: 1.3,
  torso: 1,
  leftArm: 1.15,
  rightArm: 1.15,
  leftLeg: 1.15,
  rightLeg: 1.15
}

export function createFighter({ health = 100, weapon = 'sword', seed = 0 } = {}) {
  const limbs = {}
  for (const part of PARTS) {
    limbs[part] = { hp: LIMB_HP[part], maxHp: LIMB_HP[part], severed: false, broken: false }
  }
  return {
    id: `fighter-${seed}`,
    health,
    maxHealth: health,
    weapon,
    weaponDropped: false,
    hasWeapon: weapon !== 'none',
    dead: false,
    deathCause: null,
    crawling: false,
    bisected: false,
    headSplit: false,
    skullOpen: false,
    jawGone: false,
    stagger: 0,
    lastHitPart: null,
    limbs,
    hitsTaken: 0
  }
}

function aliveCheck(fighter) {
  return !fighter.dead && fighter.health > 0
}

/**
 * Apply one weapon strike to an NPC.
 * style: 'sharp' (sword) | 'blunt' (hammer)
 * Returns an ordered list of events consumed by the renderer / gore system.
 */
export function applyHit(fighter, { part, style = 'sharp', damage = 30, heavy = false, direction = [0, 0, 1] }) {
  const events = []
  if (!aliveCheck(fighter) || !PARTS.includes(part)) return { events, killed: false }

  const limb = fighter.limbs[part]
  const sharp = style === 'sharp'
  const multiplier = sharp ? SHARP_MULTIPLIER[part] : BLUNT_MULTIPLIER[part]
  const limbDamage = Math.max(1, damage * multiplier)

  fighter.hitsTaken++
  fighter.lastHitPart = part
  fighter.stagger = Math.max(fighter.stagger, heavy ? 0.65 : 0.3)

  // Limb-level destruction.
  if (sharp) {
    limb.hp -= limbDamage
    if (part === 'head' && (heavy || limb.hp <= 0)) {
      fighter.headSplit = true
      limb.hp = 0
      events.push({ type: 'headSplit', part, heavy, direction })
      events.push({ type: 'blood', part, amount: 46, direction, arterial: true })
      events.push({ type: 'gore', part: 'brain' })
    } else if (part === 'jaw' && (heavy || limb.hp <= 0)) {
      fighter.jawGone = true
      limb.hp = 0
      events.push({ type: 'jawOff', part, style, direction })
      events.push({ type: 'blood', part, amount: 20, direction })
    } else if ((part === 'leftArm' || part === 'rightArm') && limb.hp <= 0) {
      limb.severed = true
      events.push({ type: 'sever', part, style, direction })
      events.push({ type: 'blood', part, amount: 32, direction, arterial: true })
      if (part === 'rightArm' && fighter.hasWeapon) {
        fighter.hasWeapon = false
        fighter.weaponDropped = true
        events.push({ type: 'dropWeapon', part: 'rightArm', direction })
      }
    } else if ((part === 'leftLeg' || part === 'rightLeg') && limb.hp <= 0) {
      limb.severed = true
      events.push({ type: 'sever', part, style, direction })
      events.push({ type: 'blood', part, amount: 30, direction, arterial: true })
      if (!fighter.crawling) {
        fighter.crawling = true
        events.push({ type: 'crawl', part })
      }
    } else if (part === 'torso' && heavy) {
      fighter.bisected = true
      events.push({ type: 'bisect', part, style, direction })
      events.push({ type: 'blood', part: 'torso', amount: 60, direction, arterial: true })
      events.push({ type: 'gore', part: 'guts' })
    } else {
      events.push({ type: 'hit', part, style, heavy, direction })
      events.push({ type: 'blood', part, amount: heavy ? 24 : 14, direction })
    }
  } else {
    limb.hp -= limbDamage
    if (part === 'head' && (limb.hp <= 0 || (heavy && damage >= 80))) {
      fighter.skullOpen = true
      limb.hp = 0
      events.push({ type: 'skullOpen', part, direction })
      events.push({ type: 'blood', part, amount: 42, direction, arterial: true })
      events.push({ type: 'gore', part: 'brain' })
      events.push({ type: 'crack', part })
    } else if (part === 'jaw' && limb.hp <= 0) {
      fighter.jawGone = true
      limb.hp = 0
      events.push({ type: 'jawOff', part, style, direction })
      events.push({ type: 'crack', part })
      events.push({ type: 'blood', part, amount: 16, direction })
    } else if ((part === 'leftArm' || part === 'rightArm') && limb.hp <= 0) {
      limb.broken = true
      events.push({ type: 'break', part, style, direction })
      events.push({ type: 'crack', part })
      events.push({ type: 'blood', part, amount: 18, direction })
      if (part === 'rightArm' && fighter.hasWeapon) {
        fighter.hasWeapon = false
        fighter.weaponDropped = true
        events.push({ type: 'dropWeapon', part: 'rightArm', direction })
      }
    } else if ((part === 'leftLeg' || part === 'rightLeg') && limb.hp <= 0) {
      limb.broken = true
      events.push({ type: 'break', part, style, direction })
      events.push({ type: 'crack', part })
      events.push({ type: 'blood', part, amount: 18, direction })
      if (!fighter.crawling) {
        fighter.crawling = true
        events.push({ type: 'crawl', part })
      }
    } else {
      events.push({ type: 'hit', part, style, heavy, direction })
      events.push({ type: 'blood', part, amount: heavy ? 22 : 12, direction })
    }
  }

  // Vital damage.
  let vitality = damage * HEALTH_MULTIPLIER[part]
  if (fighter.headSplit || fighter.skullOpen) vitality += 999
  if (fighter.bisected) vitality += 999
  if (limb.severed || limb.broken) vitality += 12
  fighter.health = Math.max(0, fighter.health - vitality)

  if (fighter.health <= 0 && !fighter.dead) {
    fighter.dead = true
    fighter.deathCause = fighter.headSplit
      ? 'headSplit'
      : fighter.skullOpen
        ? 'skullOpen'
        : fighter.bisected
          ? 'bisected'
          : 'wounds'
    events.push({ type: 'death', cause: fighter.deathCause, part })
  }

  return { events, killed: fighter.dead }
}

export function pickFallbackPart(normalizedY) {
  if (normalizedY > 0.9) return 'head'
  if (normalizedY > 0.8) return 'jaw'
  if (normalizedY > 0.52) return 'torso'
  if (normalizedY > 0.26) return normalizedY > 0.39 ? 'leftArm' : 'rightArm'
  return normalizedY > 0.13 ? 'rightLeg' : 'leftLeg'
}

export function wavePlan(wave) {
  const total = 2 + Math.floor(wave * 1.4)
  return {
    wave,
    total,
    concurrent: Math.min(2 + Math.floor(wave / 1.5), 7),
    health: 88 + wave * 12,
    speed: 1.18 + Math.min(wave * 0.055, 0.55),
    damage: 7 + Math.min(wave * 1.15, 11),
    attackCooldown: Math.max(0.7, 1.55 - wave * 0.05)
  }
}

export function waveClearBonus(wave) {
  return { heal: 22, score: 100 * wave }
}
