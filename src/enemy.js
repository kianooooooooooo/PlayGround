import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  clamp,
  damp,
  easeOutCubic,
  lerp,
  pick,
  rand,
  randInt,
  TAU,
  angleDelta,
} from './utils.js';

const PART_LABELS = {
  head: 'SKULL',
  torso: 'TORSO',
  armL: 'LEFT ARM',
  armR: 'RIGHT ARM',
  legL: 'LEFT LEG',
  legR: 'RIGHT LEG',
  weapon: 'WEAPON',
  shield: 'SHIELD',
};

const THRESHOLDS = {
  head: 46,
  torso: 82,
  armL: 34,
  armR: 34,
  legL: 37,
  legR: 37,
};

export const ENEMY_TYPES = {
  sandsman: {
    key: 'sandsman',
    name: 'SANDSMAN',
    title: 'THE UNPROVEN',
    health: 100,
    speed: 2.15,
    attackDamage: 12,
    attackRange: 2.15,
    attackWindup: 0.56,
    attackCooldown: 1.55,
    weapon: 'sword',
    shield: false,
    scale: 1,
    skin: 0xb8855d,
    cloth: 0x6b3b27,
    armor: 0x5c4a37,
    metal: 0x8a7c65,
    accent: 0xa23c2a,
    helmet: false,
  },
  brute: {
    key: 'brute',
    name: 'PIT BRUTE',
    title: 'THE WALL OF MEAT',
    health: 165,
    speed: 1.62,
    attackDamage: 23,
    attackRange: 2.35,
    attackWindup: 0.82,
    attackCooldown: 2.15,
    weapon: 'hammer',
    shield: false,
    scale: 1.16,
    skin: 0x9c6f4e,
    cloth: 0x3c2d24,
    armor: 0x4f4237,
    metal: 0x8a7357,
    accent: 0x86201d,
    helmet: true,
  },
  shield: {
    key: 'shield',
    name: 'SHIELDBEARER',
    title: 'THE PATIENT',
    health: 125,
    speed: 1.8,
    attackDamage: 15,
    attackRange: 2.2,
    attackWindup: 0.68,
    attackCooldown: 1.8,
    weapon: 'sword',
    shield: true,
    scale: 1.04,
    skin: 0x7c5138,
    cloth: 0x3e3028,
    armor: 0x544b42,
    metal: 0x95856c,
    accent: 0x65221d,
    helmet: true,
  },
  executioner: {
    key: 'executioner',
    name: 'EXECUTIONER',
    title: 'THE CROWD’S FAVOURITE',
    health: 190,
    speed: 1.74,
    attackDamage: 26,
    attackRange: 2.5,
    attackWindup: 0.9,
    attackCooldown: 2.2,
    weapon: 'hammer',
    shield: false,
    scale: 1.22,
    skin: 0x815b41,
    cloth: 0x2b201b,
    armor: 0x44352b,
    metal: 0xa38963,
    accent: 0x9a1d18,
    helmet: true,
  },
};

export function waveEnemyTypes(wave) {
  if (wave <= 1) return ['sandsman'];
  if (wave === 2) return ['sandsman', 'sandsman'];
  if (wave === 3) return ['sandsman', 'shield'];
  if (wave === 4) return ['sandsman', 'shield', 'brute'];
  if (wave === 5) return ['shield', 'brute', 'sandsman', 'sandsman'];
  return ['sandsman', 'shield', 'brute', 'executioner', wave % 2 ? 'sandsman' : 'shield'].slice(0, 5);
}

function makeMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.84,
    metalness: opts.metalness ?? 0,
    flatShading: opts.flatShading ?? true,
  });
}

export class Enemy {
  constructor(scene, effects, audio, config, position, player, callbacks = {}) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.config = { ...config };
    this.player = player;
    this.callbacks = callbacks;
    this.name = config.name;
    this.scaleValue = config.scale || 1;
    this.maxHealth = config.health;
    this.health = config.health;
    this.speed = config.speed;
    this.attackDamage = config.attackDamage;
    this.attackRange = config.attackRange;
    this.weaponType = config.weapon;
    this.hasShield = config.shield;
    this.dead = false;
    this.deathTime = 0;
    this.attackState = null;
    this.attackTimer = 0;
    this.attackCooldown = rand(0.6, 1.3);
    this.stagger = 0;
    this.flashTimer = 0;
    this.phase = rand(0, TAU);
    this.walkBlend = 0;
    this.crawlBlend = 0;
    this.jawBroken = false;
    this.headLost = false;
    this.torsoLost = false;
    this.bleedRate = 0;
    this.bleedTimer = 0;
    this.lastPart = 'torso';
    this.lastType = 'sword';
    this.attackingArm = 'armR';
    this.partDamage = { head: 0, torso: 0, armL: 0, armR: 0, legL: 0, legR: 0 };
    this.countedGore = new Set();
    this.crawling = false;
    this.hasWeapon = true;
    this.hitMeshes = [];
    this.materials = [];
    this.pivots = {};
    this.partAttached = { head: true, torso: true, armL: true, armR: true, legL: true, legR: true };

    this.root = new THREE.Group();
    this.root.position.copy(position);
    this.root.scale.setScalar(this.scaleValue);
    this.scene.add(this.root);

    this.build();
    this.applyHealthBar();

    this.effects.emit(
      new THREE.Vector3(position.x, 0.14, position.z),
      new THREE.Vector3(0, 0.8, 0),
      16,
      {
        speed: 2,
        spread: 0.9,
        life: 0.8,
        gravity: 1,
        colors: [[0.38, 0.29, 0.2], [0.24, 0.18, 0.12], [0.51, 0.4, 0.27]],
      },
    );
  }

  build() {
    const c = this.config;
    const skinMat = makeMaterial(c.skin, { roughness: 0.88 });
    const clothMat = makeMaterial(c.cloth, { roughness: 0.96 });
    const armorMat = makeMaterial(c.armor, { roughness: 0.66, metalness: 0.22 });
    const metalMat = makeMaterial(c.metal, { roughness: 0.42, metalness: 0.64 });
    const accentMat = makeMaterial(c.accent, { roughness: 0.9 });
    const leatherMat = makeMaterial(0x312019, { roughness: 0.94 });
    const boneMat = makeMaterial(0xd7c8a9, { roughness: 0.7 });
    const darkMat = makeMaterial(0x080504, { roughness: 0.9 });
    this.materials = [skinMat, clothMat, armorMat, metalMat, accentMat, leatherMat, boneMat, darkMat];

    const rig = new THREE.Group();
    this.root.add(rig);
    this.rig = rig;

    const pelvis = new THREE.Group();
    pelvis.position.y = 0.9;
    rig.add(pelvis);
    this.pivots.pelvis = pelvis;

    const pelvisMesh = this.addMesh(
      pelvis,
      new RoundedBoxGeometry(0.43, 0.25, 0.27, 2, 0.06),
      clothMat,
      'torso',
      new THREE.Vector3(0, 0.03, 0),
    );
    pelvisMesh.scale.set(1, 1, 1);

    const belt = this.addMesh(
      pelvis,
      new RoundedBoxGeometry(0.47, 0.1, 0.3, 2, 0.03),
      leatherMat,
      'torso',
      new THREE.Vector3(0, 0.12, 0),
    );
    const buckle = this.addMesh(
      pelvis,
      new THREE.BoxGeometry(0.09, 0.08, 0.025),
      metalMat,
      'torso',
      new THREE.Vector3(0, 0.12, 0.16),
    );

    // Skirt straps.
    for (let i = 0; i < 5; i++) {
      const strap = this.addMesh(
        pelvis,
        new RoundedBoxGeometry(0.085, 0.31, 0.025, 1, 0.01),
        i % 2 ? leatherMat : accentMat,
        'torso',
        new THREE.Vector3(-0.18 + i * 0.09, -0.16, 0.145),
      );
      strap.rotation.x = 0.05;
    }

    const torso = new THREE.Group();
    torso.position.y = 0.09;
    pelvis.add(torso);
    this.pivots.torso = torso;

    this.addMesh(torso, new RoundedBoxGeometry(0.54, 0.65, 0.32, 3, 0.1), skinMat, 'torso', new THREE.Vector3(0, 0.33, 0));
    // Chest plate.
    this.addMesh(torso, new RoundedBoxGeometry(0.58, 0.43, 0.36, 3, 0.08), armorMat, 'torso', new THREE.Vector3(0, 0.39, 0.035));
    // Central sigil.
    this.addMesh(torso, new THREE.CylinderGeometry(0.075, 0.075, 0.025, 6), accentMat, 'torso', new THREE.Vector3(0, 0.44, 0.225), new THREE.Euler(Math.PI / 2, 0, 0));
    // Straps and rivets.
    for (const side of [-1, 1]) {
      const strap = this.addMesh(torso, new THREE.BoxGeometry(0.06, 0.48, 0.018), leatherMat, 'torso', new THREE.Vector3(side * 0.2, 0.38, 0.215));
      strap.rotation.z = side * 0.12;
      this.addMesh(torso, new THREE.SphereGeometry(0.022, 5, 3), metalMat, 'torso', new THREE.Vector3(side * 0.27, 0.52, 0.2));
    }
    // Back harness.
    this.addMesh(torso, new THREE.BoxGeometry(0.38, 0.09, 0.04), leatherMat, 'torso', new THREE.Vector3(0, 0.33, -0.18));

    // Neck and head.
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.77, 0.015);
    torso.add(headPivot);
    this.pivots.head = headPivot;
    this.addMesh(headPivot, new THREE.CylinderGeometry(0.085, 0.1, 0.12, 6), skinMat, 'head', new THREE.Vector3(0, 0.0, 0));
    const skull = this.addMesh(headPivot, new THREE.IcosahedronGeometry(0.18, 2), skinMat, 'head', new THREE.Vector3(0, 0.14, 0));
    skull.scale.set(0.92, 1.05, 0.96);
    this.addMesh(headPivot, new THREE.BoxGeometry(0.16, 0.06, 0.04), darkMat, 'head', new THREE.Vector3(0, 0.105, 0.155));
    for (const side of [-1, 1]) {
      const eye = this.addMesh(headPivot, new THREE.SphereGeometry(0.018, 5, 3), darkMat, 'head', new THREE.Vector3(side * 0.058, 0.165, 0.158));
      eye.scale.set(1, 0.6, 0.4);
      this.addMesh(headPivot, new THREE.BoxGeometry(0.11, 0.012, 0.012), accentMat, 'head', new THREE.Vector3(side * 0.06, 0.225, 0.15));
    }
    this.addMesh(headPivot, new THREE.BoxGeometry(0.065, 0.035, 0.055), skinMat, 'head', new THREE.Vector3(0, 0.12, 0.185));

    const jaw = new THREE.Group();
    jaw.position.set(0, 0.025, 0.055);
    headPivot.add(jaw);
    this.pivots.jaw = jaw;
    const jawMesh = this.addMesh(jaw, new RoundedBoxGeometry(0.15, 0.075, 0.14, 2, 0.025), skinMat, 'head', new THREE.Vector3(0, 0, 0.02));
    jawMesh.rotation.x = -0.07;
    for (let i = 0; i < 4; i++) {
      this.addMesh(jaw, new THREE.BoxGeometry(0.018, 0.02, 0.012), boneMat, 'head', new THREE.Vector3(-0.045 + i * 0.03, 0.04, 0.08));
    }

    if (c.helmet) {
      const helm = this.addMesh(
        headPivot,
        new THREE.SphereGeometry(0.205, 9, 6, 0, TAU, 0, Math.PI * 0.56),
        metalMat,
        'head',
        new THREE.Vector3(0, 0.19, -0.005),
      );
      helm.scale.set(1, 0.95, 1.05);
      this.addMesh(headPivot, new THREE.BoxGeometry(0.028, 0.17, 0.06), accentMat, 'head', new THREE.Vector3(0, 0.29, -0.03));
      this.addMesh(headPivot, new THREE.BoxGeometry(0.43, 0.025, 0.05), metalMat, 'head', new THREE.Vector3(0, 0.29, 0.02)).rotation.z = 0.05;
      for (const side of [-1, 1]) {
        this.addMesh(headPivot, new THREE.BoxGeometry(0.03, 0.16, 0.11), metalMat, 'head', new THREE.Vector3(side * 0.18, 0.12, 0.03));
      }
    } else {
      this.addMesh(headPivot, new THREE.BoxGeometry(0.27, 0.04, 0.2), accentMat, 'head', new THREE.Vector3(0, 0.225, -0.01));
    }

    // Arms.
    for (const side of [-1, 1]) {
      const key = side < 0 ? 'armL' : 'armR';
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.35, 0.6, 0);
      torso.add(shoulder);
      this.pivots[key] = shoulder;

      // Shoulder pad.
      const pad = this.addMesh(shoulder, new THREE.SphereGeometry(0.17, 7, 5, 0, TAU, 0, Math.PI / 2), armorMat, key, new THREE.Vector3(side * 0.02, 0.07, 0));
      pad.scale.set(1.05, 0.72, 1);
      this.addMesh(shoulder, new THREE.CapsuleGeometry(0.078, 0.22, 3, 6), skinMat, key, new THREE.Vector3(0, -0.17, 0));
      this.addMesh(shoulder, new THREE.CylinderGeometry(0.083, 0.078, 0.1, 6), leatherMat, key, new THREE.Vector3(0, -0.07, 0));

      const elbow = new THREE.Group();
      elbow.position.y = -0.35;
      shoulder.add(elbow);
      this.pivots[`elbow${side < 0 ? 'L' : 'R'}`] = elbow;
      this.addMesh(elbow, new THREE.CapsuleGeometry(0.066, 0.2, 3, 6), skinMat, key, new THREE.Vector3(0, -0.17, 0));
      this.addMesh(elbow, new THREE.CylinderGeometry(0.075, 0.07, 0.17, 6), armorMat, key, new THREE.Vector3(0, -0.2, 0));
      const hand = new THREE.Group();
      hand.position.y = -0.36;
      elbow.add(hand);
      this.pivots[`hand${side < 0 ? 'L' : 'R'}`] = hand;
      const handMesh = this.addMesh(hand, new THREE.IcosahedronGeometry(0.068, 1), skinMat, key, new THREE.Vector3(0, 0, 0));
      handMesh.scale.set(0.85, 1, 1.15);

      if (side > 0) this.weaponHand = hand;
      if (side < 0) this.shieldHand = hand;
    }

    // Legs.
    for (const side of [-1, 1]) {
      const key = side < 0 ? 'legL' : 'legR';
      const hip = new THREE.Group();
      hip.position.set(side * 0.15, 0.85, 0);
      rig.add(hip);
      this.pivots[key] = hip;
      this.addMesh(hip, new THREE.CapsuleGeometry(0.102, 0.27, 3, 6), skinMat, key, new THREE.Vector3(0, -0.22, 0));
      this.addMesh(hip, new THREE.CylinderGeometry(0.11, 0.095, 0.2, 6), clothMat, key, new THREE.Vector3(0, -0.15, 0));

      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      this.pivots[`knee${side < 0 ? 'L' : 'R'}`] = knee;
      this.addMesh(knee, new THREE.CapsuleGeometry(0.078, 0.24, 3, 6), skinMat, key, new THREE.Vector3(0, -0.18, 0));
      this.addMesh(knee, new THREE.CylinderGeometry(0.088, 0.075, 0.16, 6), leatherMat, key, new THREE.Vector3(0, -0.12, 0));
      this.addMesh(knee, new THREE.BoxGeometry(0.16, 0.09, 0.31), leatherMat, key, new THREE.Vector3(0, -0.37, 0.075));
    }

    this.buildWeapon();
    if (this.hasShield) this.buildShield();

    // Attack telegraph ring.
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xc62018,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.telegraph = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.72, 28), ringMat);
    this.telegraph.rotation.x = -Math.PI / 2;
    this.telegraph.position.y = 0.025;
    this.telegraph.visible = false;
    this.root.add(this.telegraph);

    // Blood-stained wraps.
    this.addMesh(this.pivots.torso, new THREE.BoxGeometry(0.16, 0.22, 0.03), accentMat, 'torso', new THREE.Vector3(0.13, -0.03, 0.18)).rotation.z = 0.2;
  }

  buildWeapon() {
    const c = this.config;
    const metalMat = makeMaterial(0xbfc0b4, { roughness: 0.3, metalness: 0.82 });
    const darkMetal = makeMaterial(0x4a4942, { roughness: 0.38, metalness: 0.76 });
    const woodMat = makeMaterial(0x3e2516, { roughness: 0.9 });
    const leatherMat = makeMaterial(0x2b1a12, { roughness: 0.95 });
    this.materials.push(metalMat, darkMetal, woodMat, leatherMat);

    const weapon = new THREE.Group();
    weapon.position.set(0, -0.015, 0.02);
    weapon.rotation.set(-0.5, 0, 0);
    this.weaponHand.add(weapon);
    this.weapon = weapon;

    if (this.weaponType === 'sword') {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.27, 6), leatherMat);
      handle.position.y = -0.065;
      weapon.add(handle);
      const pommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 1), metalMat);
      pommel.position.y = -0.21;
      weapon.add(pommel);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.075), metalMat);
      guard.position.y = 0.08;
      weapon.add(guard);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.93, 0.026), metalMat);
      blade.position.y = 0.56;
      weapon.add(blade);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.9, 0.03), new THREE.MeshBasicMaterial({ color: 0xffe9c7 }));
      edge.position.set(0, 0.56, 0.003);
      weapon.add(edge);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.14, 4), metalMat);
      tip.position.y = 1.085;
      weapon.add(tip);
      weapon.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.userData.part = 'weapon';
          child.userData.enemy = this;
          this.hitMeshes.push(child);
        }
      });
    } else {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.045, 1.1, 7), woodMat);
      handle.position.y = 0.34;
      weapon.add(handle);
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.3, 6), leatherMat);
      wrap.position.y = 0.02;
      weapon.add(wrap);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.27, 0.27), darkMetal);
      head.position.y = 0.92;
      weapon.add(head);
      const capA = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.34, 0.32), metalMat);
      capA.position.set(-0.145, 0.92, 0);
      weapon.add(capA);
      const capB = capA.clone();
      capB.position.x = 0.145;
      weapon.add(capB);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), metalMat);
      spike.position.y = 1.13;
      weapon.add(spike);
      weapon.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.userData.part = 'weapon';
          child.userData.enemy = this;
          this.hitMeshes.push(child);
        }
      });
    }
  }

  buildShield() {
    const wood = makeMaterial(0x5e3c22, { roughness: 0.9 });
    const metal = makeMaterial(0x8d7b5e, { roughness: 0.4, metalness: 0.7 });
    const accent = makeMaterial(0x7e1f1b, { roughness: 0.9 });
    this.materials.push(wood, metal, accent);
    const shield = new THREE.Group();
    shield.position.set(-0.01, -0.22, 0.16);
    shield.rotation.set(0.25, 0.2, 0.2);
    this.shieldHand.add(shield);
    this.shield = shield;
    const board = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.075, 12), wood);
    board.rotation.x = Math.PI / 2;
    board.scale.set(0.92, 1, 1.3);
    shield.add(board);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 5, 18), metal);
    rim.scale.set(0.92, 1.3, 1);
    rim.position.z = 0.045;
    shield.add(rim);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 5, 0, TAU, 0, Math.PI / 2), metal);
    boss.rotation.x = Math.PI / 2;
    boss.position.z = 0.075;
    shield.add(boss);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.64, 0.018), accent);
    stripe.position.z = 0.045;
    shield.add(stripe);
    shield.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.userData.part = 'shield';
        child.userData.enemy = this;
        this.hitMeshes.push(child);
      }
    });
  }

  addMesh(parent, geometry, material, part, position = new THREE.Vector3(), rotation = null) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    if (rotation) mesh.rotation.copy(rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.userData.part = part;
    mesh.userData.enemy = this;
    parent.add(mesh);
    this.hitMeshes.push(mesh);
    return mesh;
  }

  applyHealthBar() {
    this.healthBarGroup = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.66, 0.055),
      new THREE.MeshBasicMaterial({ color: 0x110907, transparent: true, opacity: 0.7, depthWrite: false, depthTest: true }),
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.032),
      new THREE.MeshBasicMaterial({ color: 0xb82118, transparent: true, opacity: 0.92, depthWrite: false, depthTest: true }),
    );
    fill.position.z = 0.002;
    this.healthFill = fill;
    this.healthFillBase = 0.62;
    this.healthBarGroup.add(bg, fill);
    this.healthBarGroup.position.y = 2.24;
    this.healthBarGroup.visible = false;
    this.scene.add(this.healthBarGroup);
  }

  updateHealthBar() {
    const ratio = clamp(this.health / this.maxHealth, 0, 1);
    this.healthFill.scale.x = Math.max(0.001, ratio);
    this.healthFill.position.x = -(1 - ratio) * 0.31;
    this.healthBarGroup.visible = !this.dead && this.health < this.maxHealth - 0.1;
    if (this.healthBarGroup.visible) {
      this.healthBarGroup.position.set(this.root.position.x, this.root.position.y + 2.24 * this.scaleValue, this.root.position.z);
      this.healthBarGroup.quaternion.copy(this.player.camera.quaternion);
    }
  }

  angleToPlayer() {
    return Math.atan2(this.player.position.x - this.root.position.x, this.player.position.z - this.root.position.z);
  }

  distanceToPlayer() {
    const dx = this.player.position.x - this.root.position.x;
    const dz = this.player.position.z - this.root.position.z;
    return Math.hypot(dx, dz);
  }

  update(dt, time, enemies) {
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    if (this.flashTimer === 0) this.setEmissive(0x000000);

    if (this.dead) {
      this.deathTime += dt;
      if (this.deathTime < 0.85) {
        const p = easeOutCubic(this.deathTime / 0.85);
        this.root.rotation.x = lerp(0, -1.38, p);
        this.root.position.y = lerp(0, 0.06, p);
      }
      this.updateHealthBar();
      return;
    }

    this.phase += dt * (this.crawling ? 2.4 : 4.2);
    this.attackCooldown -= dt;
    this.updateHealthBar();

    // Bleeding out: wounds keep working even when the crowd is cheering.
    if (this.bleedRate > 0) {
      this.health -= this.bleedRate * dt;
      this.bleedTimer -= dt;
      if (this.bleedTimer <= 0) {
        this.bleedTimer = rand(0.35, 0.65);
        const point = this.root.position.clone().add(new THREE.Vector3(rand(-0.2, 0.2), rand(0.3, 1.4), rand(-0.2, 0.2)));
        this.effects.bloodFountain(point, new THREE.Vector3(0, 1, 0), 0.55);
        this.effects.addBloodDecal(this.root.position.clone(), new THREE.Vector3(0, 0, 1), 0.5);
        if (this.crawling) this.effects.addBloodDecal(this.root.position.clone(), new THREE.Vector3(0, 0, 1), 0.35);
      }
      if (this.health <= 0) {
        this.die('BLED OUT', new THREE.Vector3(0, 0, 0));
        return;
      }
    }

    if (this.stagger > 0) {
      this.stagger -= dt;
      this.rig.rotation.z = Math.sin(time * 37) * 0.04;
      this.updateTelegraph();
      return;
    }
    this.rig.rotation.z = damp(this.rig.rotation.z, 0, 5, dt);

    const dx = this.player.position.x - this.root.position.x;
    const dz = this.player.position.z - this.root.position.z;
    const distance = Math.hypot(dx, dz);
    const targetYaw = this.angleToPlayer();
    this.root.rotation.y += clamp(angleDelta(this.root.rotation.y, targetYaw), -7 * dt, 7 * dt);

    const canAttack = this.hasWeapon && this.partAttached.armR && !this.player.isDead;
    let moving = false;
    let desiredSpeed = this.speed * (this.crawling ? 0.32 : 1);

    if (this.attackState === 'windup') {
      this.attackTimer -= dt;
      this.animateAttackWindup(time);
      this.updateTelegraph(true);
      if (this.attackTimer <= 0) {
        this.resolveAttack();
        this.attackState = 'recover';
        this.attackTimer = 0.28;
      }
    } else if (this.attackState === 'recover') {
      this.attackTimer -= dt;
      this.animateAttackRecover(time);
      this.updateTelegraph(false);
      if (this.attackTimer <= 0) this.attackState = null;
    } else {
      this.updateTelegraph(false);
      if (canAttack && distance < this.attackRange && this.attackCooldown <= 0) {
        this.attackState = 'windup';
        this.attackTimer = this.config.attackWindup;
        this.attackCooldown = this.config.attackCooldown;
        this.audio.swing(this.weaponType);
      } else if (distance > this.attackRange * 0.86) {
        moving = true;
      }
    }

    // Separation so the beasts don't merge into one another.
    let sepX = 0;
    let sepZ = 0;
    for (const other of enemies) {
      if (other === this || other.dead) continue;
      const ox = this.root.position.x - other.root.position.x;
      const oz = this.root.position.z - other.root.position.z;
      const d = Math.hypot(ox, oz);
      if (d < 0.92 && d > 0.001) {
        sepX += (ox / d) * (0.92 - d) * 2.4;
        sepZ += (oz / d) * (0.92 - d) * 2.4;
      }
    }

    if (moving && this.attackState !== 'windup') {
      const step = desiredSpeed * dt;
      this.root.position.x += (dx / Math.max(distance, 0.001)) * step + sepX * dt;
      this.root.position.z += (dz / Math.max(distance, 0.001)) * step + sepZ * dt;
      this.walkBlend = damp(this.walkBlend, 1, 8, dt);
    } else {
      this.root.position.x += sepX * dt;
      this.root.position.z += sepZ * dt;
      this.walkBlend = damp(this.walkBlend, 0, 9, dt);
    }

    // Stay inside the wall and out of the player's body.
    const radial = Math.hypot(this.root.position.x, this.root.position.z);
    if (radial > 17.8) {
      this.root.position.x *= 17.8 / radial;
      this.root.position.z *= 17.8 / radial;
    }
    if (distance < 0.95) {
      const push = 0.95 - distance;
      this.root.position.x -= (dx / Math.max(distance, 0.001)) * push;
      this.root.position.z -= (dz / Math.max(distance, 0.001)) * push;
    }

    if (this.crawling) this.crawlBlend = damp(this.crawlBlend, 1, 5, dt);
    else this.crawlBlend = damp(this.crawlBlend, 0, 5, dt);

    this.animate(time);
  }

  animate(time) {
    const speedBlend = this.walkBlend;
    const crawl = this.crawlBlend;
    const phase = this.phase;
    const pelvisY = lerp(0.9, 0.38, crawl);
    this.pivots.pelvis.position.y = pelvisY + Math.sin(phase * 2) * 0.018 * speedBlend;
    this.pivots.pelvis.rotation.z = Math.sin(phase) * 0.03 * speedBlend;
    this.pivots.torso.rotation.x = lerp(0, -1.02, crawl);
    this.pivots.torso.rotation.z = Math.sin(phase) * 0.025 * speedBlend;
    this.pivots.head.rotation.x = lerp(-0.02, 0.86, crawl);

    if (this.partAttached.legL) {
      const kneeL = this.pivots.kneeL;
      const hipL = this.pivots.legL;
      if (this.crawling) {
        hipL.rotation.x = lerp(hipL.rotation.x, 0.25, 0.08);
        kneeL.rotation.x = lerp(kneeL.rotation.x, 0.6, 0.08);
      } else {
        hipL.rotation.x = Math.sin(phase) * 0.55 * speedBlend;
        kneeL.rotation.x = Math.max(0, -Math.sin(phase)) * 0.7 * speedBlend;
      }
    }
    if (this.partAttached.legR) {
      const kneeR = this.pivots.kneeR;
      const hipR = this.pivots.legR;
      if (this.crawling) {
        hipR.rotation.x = lerp(hipR.rotation.x, 0.35, 0.08);
        kneeR.rotation.x = lerp(kneeR.rotation.x, 0.75, 0.08);
      } else {
        hipR.rotation.x = Math.sin(phase + Math.PI) * 0.55 * speedBlend;
        kneeR.rotation.x = Math.max(0, -Math.sin(phase + Math.PI)) * 0.7 * speedBlend;
      }
    }

    if (this.partAttached.armL) {
      const armL = this.pivots.armL;
      if (this.hasShield) {
        armL.rotation.x = damp(armL.rotation.x, -0.45, 6, 0.016);
        armL.rotation.z = 0.22;
      } else {
        armL.rotation.x = lerp(Math.sin(phase + Math.PI) * 0.38 * speedBlend, -1.2, crawl);
        armL.rotation.z = lerp(-0.09, 0.35, crawl);
      }
    }
    if (this.partAttached.armR && this.attackState === null) {
      const armR = this.pivots.armR;
      armR.rotation.x = damp(armR.rotation.x, this.crawling ? -1.15 : -0.62, 6, 0.016);
      armR.rotation.z = damp(armR.rotation.z, this.weaponType === 'hammer' ? -0.28 : -0.12, 6, 0.016);
    }
    if (this.partAttached.armR && this.attackState === 'recover') {
      const armR = this.pivots.armR;
      armR.rotation.x = damp(armR.rotation.x, -0.62, 9, 0.016);
    }

    if (this.hasWeapon && this.weapon) {
      this.weapon.rotation.z = Math.sin(phase * 0.5) * 0.03;
    }
    if (this.telegraph.visible) {
      this.telegraph.material.opacity = 0.25 + Math.sin(time * 25) * 0.15;
      const scale = 1 + Math.sin(time * 12) * 0.08;
      this.telegraph.scale.set(scale, scale, scale);
    }
  }

  animateAttackWindup(time) {
    if (!this.partAttached.armR) return;
    const armR = this.pivots.armR;
    const target = this.weaponType === 'hammer' ? -2.35 : -2.1;
    armR.rotation.x = damp(armR.rotation.x, target, 12, 0.016);
    armR.rotation.z = damp(armR.rotation.z, this.weaponType === 'hammer' ? 0.18 : 0.28, 10, 0.016);
    this.pivots.torso.rotation.y = Math.sin(time * 30) * 0.01;
  }

  animateAttackRecover(time) {
    if (!this.partAttached.armR) return;
    const armR = this.pivots.armR;
    armR.rotation.x = damp(armR.rotation.x, 0.55, 18, 0.016);
    armR.rotation.z = damp(armR.rotation.z, -0.05, 14, 0.016);
    this.pivots.torso.rotation.y = damp(this.pivots.torso.rotation.y, 0, 8, 0.016);
  }

  updateTelegraph(active) {
    this.telegraph.visible = active;
    if (active) {
      this.telegraph.material.opacity = 0.3;
    }
  }

  resolveAttack() {
    this.audio.swing(this.weaponType);
    const distance = this.distanceToPlayer();
    if (distance <= this.attackRange + 0.42 && !this.player.isDead) {
      this.player.damage(this.attackDamage, this);
      this.audio.metal();
      this.effects.sparks(
        this.player.position.clone().add(new THREE.Vector3(0, 1.1, 0)),
        new THREE.Vector3(0, 0.4, 0),
        5,
      );
    } else {
      this.effects.emit(this.root.position.clone().add(new THREE.Vector3(0, 0.4, 0)), new THREE.Vector3(0, 0.5, 1), 5, {
        speed: 1.5,
        spread: 1,
        life: 0.4,
        gravity: 5,
        colors: [[0.31, 0.26, 0.2], [0.48, 0.41, 0.3]],
      });
    }
  }

  setEmissive(color) {
    for (const material of this.materials) {
      material.emissive?.setHex(color);
      material.emissiveIntensity = color ? 1.4 : 0;
    }
  }

  flash() {
    this.flashTimer = 0.09;
    this.setEmissive(0x5e0805);
  }

  takeHit(part, damage, attackType, direction, point, heavy = false) {
    if (this.dead) return { ignored: true };
    if (!point) point = this.root.position.clone().add(new THREE.Vector3(0, 1.25, 0));
    if (part === 'weapon') {
      this.audio.metal();
      this.effects.sparks(point, direction, 14);
      return { blocked: true, label: 'STEEL RINGS' };
    }
    if (part === 'shield') {
      this.audio.metal();
      this.effects.sparks(point, direction, 18);
      this.stagger = 0.12;
      return { blocked: true, label: 'SHIELD HOLDS' };
    }

    const group = ['head', 'jaw'].includes(part) ? 'head' : part;
    if (!this.partAttached[group]) return { ignored: true };

    this.lastPart = group;
    this.lastType = attackType;
    this.flash();
    this.partDamage[group] += damage;
    this.health -= damage;
    this.audio.flesh(attackType === 'hammer' ? 1.3 : 1);
    this.effects.bloodBurst(point, direction, attackType === 'hammer' ? 1.55 : 1.1);
    if (heavy) {
      this.stagger = Math.max(this.stagger, 0.28);
      this.attackState = null;
      this.attackTimer = 0;
    }

    let result = { label: PART_LABELS[group] || 'BODY' };

    if (group === 'head') {
      if (attackType === 'hammer' && !this.jawBroken && this.partDamage.head >= 20 && this.partDamage.head < THRESHOLDS.head) {
        this.breakJaw(direction);
        result = { label: 'JAW BROKEN', gore: true };
      }
      if (this.partDamage.head >= THRESHOLDS.head) {
        if (attackType === 'hammer') {
          this.burstHead(direction);
          return { label: 'HEAD CRUSHED', gore: true, kill: true };
        }
        this.splitHead(direction);
        return { label: 'HEAD SPLIT', gore: true, kill: true };
      }
    } else if (group === 'torso' && this.partDamage.torso >= THRESHOLDS.torso) {
      if (attackType === 'sword') {
        this.bisect(direction);
        return { label: 'CLEAVED IN TWO', gore: true, kill: true };
      }
      this.crushChest(direction);
      return { label: 'RIBCAGE CAVED', gore: true, kill: true };
    } else if ((group === 'armL' || group === 'armR' || group === 'legL' || group === 'legR') && this.partDamage[group] >= THRESHOLDS[group]) {
      if (attackType === 'hammer') {
        this.breakLimb(group, direction);
        result = { label: `${PART_LABELS[group]} BROKEN`, gore: true };
      } else {
        this.severLimb(group, direction);
        result = { label: `${PART_LABELS[group]} SEVERED`, gore: true };
      }
    }

    if (this.health <= 0) {
      const method = attackType === 'hammer' ? 'BEATEN TO PULP' : 'CUT DOWN';
      this.die(method, direction);
      return { ...result, kill: true };
    }
    return result;
  }

  breakJaw(direction) {
    if (this.jawBroken || this.headLost) return;
    this.jawBroken = true;
    const jaw = this.pivots.jaw;
    const world = new THREE.Vector3();
    jaw.getWorldPosition(world);
    this.detachMeshes(jaw);
    this.scene.attach(jaw);
    this.pivots.jaw = jaw;
    this.effects.addDebris(
      jaw,
      new THREE.Vector3(direction.x * rand(1, 2.4), rand(1.2, 2.8), direction.z * rand(1, 2.4)),
      new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
      0.05,
    );
    this.effects.bloodBurst(world, direction, 1.2);
    this.audio.boneBreak();
    this.callbacks.onGore?.(this, 'JAW BROKEN');
  }

  splitHead(direction) {
    if (this.headLost) return;
    this.headLost = true;
    const head = this.pivots.head;
    const world = new THREE.Vector3();
    head.getWorldPosition(world);

    // The jaw tears free and drops to the sand, still working its hinge.
    const jaw = this.pivots.jaw;
    if (jaw && !this.jawBroken) {
      this.scene.attach(jaw);
      this.pivots.jaw = jaw;
      this.effects.addDebris(
        jaw,
        new THREE.Vector3(direction.x * rand(0.8, 1.8) + rand(-0.5, 0.5), rand(1.2, 2.6), direction.z * rand(0.8, 1.8) + rand(-0.5, 0.5)),
        new THREE.Vector3(rand(-7, 7), rand(-7, 7), rand(-7, 7)),
        0.05,
      );
    }

    this.detachMeshes(head);
    this.root.remove(head);
    this.effects.createSkullFragment(world.clone().add(new THREE.Vector3(-0.09, 0.08, 0)), direction, -1);
    this.effects.createSkullFragment(world.clone().add(new THREE.Vector3(0.09, 0.04, 0)), direction, 1);
    this.effects.createBrain(world.clone().add(new THREE.Vector3(0, 0.03, 0)), direction);
    this.effects.bloodBurst(world, direction, 2.2);
    this.effects.bloodFountain(world, new THREE.Vector3(0, 1, 0), 1.5);
    this.effects.addBloodDecal(this.root.position.clone(), direction, 1.2, true);
    this.audio.boneBreak();
    this.die('HEAD SPLIT', direction);
  }

  burstHead(direction) {
    if (this.headLost) return;
    this.headLost = true;
    const head = this.pivots.head;
    const world = new THREE.Vector3();
    head.getWorldPosition(world);
    this.detachMeshes(head);
    this.root.remove(head);
    for (let i = 0; i < 4; i++) {
      this.effects.createSkullFragment(
        world.clone().add(new THREE.Vector3(rand(-0.12, 0.12), rand(0, 0.16), rand(-0.12, 0.12))),
        direction,
        i % 2 ? 1 : -1,
      );
    }
    this.effects.createBrain(world.clone().add(new THREE.Vector3(0, 0.02, 0)), direction);
    this.effects.createBrain(world.clone().add(new THREE.Vector3(0.04, -0.02, 0.04)), direction);
    this.effects.bloodBurst(world, direction, 2.8);
    this.effects.bloodFountain(world, new THREE.Vector3(0, 1, 0), 2);
    this.effects.addBloodDecal(this.root.position.clone(), direction, 1.6, true);
    this.audio.hammer(1.2);
    this.audio.boneBreak();
    this.die('SKULL CRACKED', direction);
  }

  severLimb(group, direction) {
    if (!this.partAttached[group] || group === 'head' || group === 'torso') return;
    this.partAttached[group] = false;
    const pivot = this.pivots[group];
    const world = new THREE.Vector3();
    pivot.getWorldPosition(world);

    if (group === 'armR' && this.hasWeapon && this.weapon) {
      this.dropWeapon(direction);
    }
    if (group === 'armL' && this.hasShield && this.shield) {
      this.scene.attach(this.shield);
      this.effects.addDebris(
        this.shield,
        new THREE.Vector3(direction.x * rand(1.2, 2.4), rand(1.4, 3.4), direction.z * rand(1.2, 2.4)),
        new THREE.Vector3(rand(-7, 7), rand(-7, 7), rand(-7, 7)),
        0.07,
      );
      this.hasShield = false;
    }

    this.detachMeshes(pivot);
    this.scene.attach(pivot);
    this.effects.addDebris(
      pivot,
      new THREE.Vector3(direction.x * rand(1.4, 3) + rand(-0.8, 0.8), rand(1.5, 3.6), direction.z * rand(1.4, 3) + rand(-0.8, 0.8)),
      new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)),
      0.06,
    );
    this.addStump(group);
    this.effects.bloodBurst(world, direction, 2.2);
    this.effects.bloodFountain(world, new THREE.Vector3(0, 1, 0), 1.4);
    for (let i = 0; i < 3; i++) {
      this.effects.addBloodDecal(world, direction, 0.8);
    }
    this.audio.boneBreak();
    this.bleedRate += 1.9;
    if (group === 'legL' || group === 'legR') {
      this.crawling = true;
      this.attackState = null;
    }
    this.callbacks.onGore?.(this, `${PART_LABELS[group]} SEVERED`);
  }

  breakLimb(group, direction) {
    if (!this.partAttached[group]) return;
    if (group === 'armR' && this.hasWeapon) this.dropWeapon(direction);
    if (group === 'armL' && this.hasShield) {
      this.hasShield = false;
      if (this.shield) this.shield.visible = false;
    }
    const jointKey = group.startsWith('arm') ? `elbow${group === 'armL' ? 'L' : 'R'}` : `knee${group === 'legL' ? 'L' : 'R'}`;
    const joint = this.pivots[jointKey];
    if (joint) {
      joint.rotation.x = rand(1.1, 1.8) * (group.endsWith('L') ? -1 : 1);
      joint.rotation.z = rand(-0.4, 0.4);
    }
    const pivot = this.pivots[group];
    const world = new THREE.Vector3();
    pivot.getWorldPosition(world);
    // Bone shard jutting through the break.
    const bone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.018, rand(0.18, 0.28), 5),
      makeMaterial(0xe1d3b6, { roughness: 0.62 }),
    );
    bone.material.emissive = new THREE.Color(0x000000);
    bone.position.set(rand(-0.03, 0.03), group.startsWith('arm') ? -0.42 : -0.5, rand(-0.02, 0.06));
    bone.rotation.set(rand(-0.9, -0.3), rand(-0.4, 0.4), rand(-0.5, 0.5));
    pivot.add(bone);
    this.materials.push(bone.material);
    this.hitMeshes.push(bone);
    bone.userData.part = group;
    bone.userData.enemy = this;
    this.effects.bloodBurst(world, direction, 1.4);
    this.audio.boneBreak();
    if (group === 'legL' || group === 'legR') {
      this.crawling = true;
      this.attackState = null;
      this.bleedRate += 0.5;
    } else {
      this.bleedRate += 0.35;
    }
    this.callbacks.onGore?.(this, `${PART_LABELS[group]} FRACTURED`);
  }

  bisect(direction) {
    if (this.torsoLost) return;
    this.torsoLost = true;
    const torso = this.pivots.torso;
    const waist = new THREE.Vector3();
    torso.getWorldPosition(waist);
    waist.y -= 0.1;
    this.detachMeshes(torso);
    this.scene.attach(torso);
    this.effects.addDebris(
      torso,
      new THREE.Vector3(direction.x * rand(1, 2.6) + rand(-0.6, 0.6), rand(2, 3.8), direction.z * rand(1, 2.6) + rand(-0.6, 0.6)),
      new THREE.Vector3(rand(-7, 7), rand(-7, 7), rand(-7, 7)),
      0.12,
    );
    this.effects.createGuts(waist, direction);
    this.effects.bloodBurst(waist, direction, 3);
    this.effects.bloodFountain(waist, new THREE.Vector3(0, 1, 0), 2);
    for (let i = 0; i < 5; i++) this.effects.addBloodDecal(waist, direction, 1.1);
    this.audio.boneBreak();
    this.audio.flesh(1.4);
    this.hasWeapon = false;
    this.die('CLEAVED IN TWO', direction);
  }

  crushChest(direction) {
    if (this.torsoLost) return;
    const waist = this.root.position.clone().add(new THREE.Vector3(0, 1.15, 0));
    this.pivots.torso.rotation.x = -1.1;
    this.pivots.torso.rotation.z = rand(-0.25, 0.25);
    for (let i = 0; i < 4; i++) this.effects.createBone(waist, direction, rand(0.2, 0.4), 0.035);
    this.effects.bloodBurst(waist, direction, 3.2);
    this.effects.bloodFountain(waist, new THREE.Vector3(0, 1, 0), 2.2);
    this.effects.createGuts(waist, direction);
    this.audio.hammer(1.5);
    this.die('RIBCAGE CAVED', direction);
  }

  dropWeapon(direction) {
    if (!this.hasWeapon || !this.weapon) return;
    this.hasWeapon = false;
    const weapon = this.weapon;
    this.scene.attach(weapon);
    this.effects.addDebris(
      weapon,
      new THREE.Vector3(direction.x * rand(1.2, 2.8) + rand(-0.7, 0.7), rand(1.3, 3.2), direction.z * rand(1.2, 2.8) + rand(-0.7, 0.7)),
      new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)),
      0.08,
    );
    this.weapon = null;
    this.audio.metal();
  }

  addStump(group) {
    const boneMat = makeMaterial(0xdfd0b1, { roughness: 0.65 });
    this.materials.push(boneMat);
    const stump = new THREE.Group();
    let parent = this.pivots.torso;
    let position;
    if (group.startsWith('arm')) {
      position = new THREE.Vector3(group === 'armL' ? -0.35 : 0.35, 0.6, 0);
    } else {
      parent = this.pivots.pelvis;
      position = new THREE.Vector3(group === 'legL' ? -0.15 : 0.15, -0.02, 0);
    }
    stump.position.copy(position);
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.16, 5), boneMat);
    bone.rotation.z = group.endsWith('L') ? 1.05 : -1.05;
    bone.position.set(group.endsWith('L') ? -0.06 : 0.06, -0.02, 0);
    stump.add(bone);
    const meat = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.08, 1),
      makeMaterial(0x6c1414, { roughness: 0.62 }),
    );
    meat.material.emissive = new THREE.Color(0x000000);
    meat.scale.set(1.2, 0.7, 1);
    stump.add(meat);
    this.materials.push(meat.material);
    stump.traverse((child) => {
      if (child.isMesh) {
        child.userData.enemy = this;
        child.userData.part = 'torso';
        child.castShadow = true;
        this.hitMeshes.push(child);
      }
    });
    parent.add(stump);
  }

  detachMeshes(root) {
    const remove = new Set();
    root.traverse((child) => {
      if (child.isMesh) remove.add(child);
    });
    this.hitMeshes = this.hitMeshes.filter((mesh) => !remove.has(mesh));
  }

  die(method, direction) {
    if (this.dead) return;
    if (this.torsoLost) {
      // Lower body remains; a collapse is still worth the crowd's attention.
    }
    this.dead = true;
    this.deathTime = 0;
    this.attackState = null;
    this.telegraph.visible = false;
    this.healthBarGroup.visible = false;
    this.effects.bloodBurst(
      this.root.position.clone().add(new THREE.Vector3(0, 0.9, 0)),
      direction || new THREE.Vector3(0, 0.3, 0),
      1.1,
    );
    this.audio.scream(this.weaponType === 'hammer' ? 0.8 : 1);
    this.callbacks.onKill?.(this, method, direction);
  }

  dispose() {
    this.scene.remove(this.root);
    this.scene.remove(this.healthBarGroup);
    this.root.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose?.();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) material?.dispose?.();
      }
    });
    this.healthBarGroup.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }
    });
  }
}
