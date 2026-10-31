import * as THREE from 'three';
import {
  clamp,
  damp,
  easeInCubic,
  easeOutCubic,
  lerp,
  rand,
  TAU,
} from './utils.js';

const IDLE_POSITION = new THREE.Vector3(0.5, -0.62, -1.05);
const IDLE_ROTATION = new THREE.Euler(0.1, -0.34, -0.3);

export class Player {
  constructor(camera, scene, effects, audio, callbacks = {}) {
    this.camera = camera;
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.callbacks = callbacks;
    this.position = new THREE.Vector3(0, 0, 9);
    this.yaw = 0;
    this.pitch = -0.07;
    this.health = 100;
    this.maxHealth = 100;
    this.dead = false;
    this.weapon = 'sword';
    this.attack = null;
    this.attackCooldown = 0;
    this.comboStep = 0;
    this.dodgeCooldown = 0;
    this.dodgeTimer = 0;
    this.dodgeInvuln = 0;
    this.dodgeDirection = new THREE.Vector3();
    this.walkPhase = 0;
    this.moveBlend = 0;
    this.shake = 0;
    this.shakeTime = 0;
    this.fov = 74;
    this.baseFov = 74;
    this.aimingAt = null;
    this.aimPart = null;
    this.aimTimer = 0;
    this.hitPoint = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 4;
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.moveDirection = new THREE.Vector3();
    this.lastStep = 0;
    this.weaponKick = 0;
    this.hitCount = 0;
    this.viewmodel = new THREE.Group();
    this.camera.add(this.viewmodel);
    this.buildViewmodel();
    this.setWeapon('sword');
    this.camera.position.set(this.position.x, 1.68, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  buildViewmodel() {
    // A soft warm fill follows the player weapon so the metal reads in shadow.
    this.weaponLight = new THREE.PointLight(0xffc48d, 0.85, 1.6, 2);
    this.weaponLight.position.set(0.18, 0.1, 0.25);
    this.viewmodel.add(this.weaponLight);

    this.skinMat = new THREE.MeshStandardMaterial({ color: 0xb98761, roughness: 0.82, flatShading: true });
    this.leatherMat = new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 0.92 });
    this.clothMat = new THREE.MeshStandardMaterial({ color: 0x5c211b, roughness: 0.9 });
    this.bronzeMat = new THREE.MeshStandardMaterial({ color: 0xa1844f, roughness: 0.38, metalness: 0.8 });
    this.steelMat = new THREE.MeshStandardMaterial({ color: 0xd4d7d0, roughness: 0.22, metalness: 0.95 });
    this.darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x575a58, roughness: 0.34, metalness: 0.88 });
    this.woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.86 });
    this.runeMat = new THREE.MeshBasicMaterial({ color: 0xf7a955 });
    this.bloodMat = new THREE.MeshStandardMaterial({ color: 0x5b0b0b, roughness: 0.58 });

    this.handGroup = new THREE.Group();
    this.handGroup.position.copy(IDLE_POSITION);
    this.handGroup.rotation.copy(IDLE_ROTATION);
    this.handGroup.scale.setScalar(0.42);
    this.viewmodel.add(this.handGroup);

    this.forearm = new THREE.Group();
    this.forearm.position.set(0.02, -0.03, 0.08);
    this.forearm.rotation.set(-0.28, 0.08, 0.16);
    this.handGroup.add(this.forearm);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.36, 4, 9), this.skinMat);
    arm.position.y = -0.23;
    arm.castShadow = false;
    this.forearm.add(arm);
    const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.08, 0.22, 7), this.leatherMat);
    bracer.position.y = -0.24;
    this.forearm.add(bracer);
    for (let i = 0; i < 3; i++) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.008, 4, 9), this.bronzeMat);
      strap.rotation.x = Math.PI / 2;
      strap.position.y = -0.19 - i * 0.05;
      this.forearm.add(strap);
    }
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), this.skinMat);
    hand.scale.set(0.9, 1.05, 1.2);
    hand.position.y = -0.02;
    this.forearm.add(hand);

    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.065, 0.055), this.leatherMat);
    knuckles.position.set(0, -0.01, 0.055);
    knuckles.rotation.x = 0.2;
    this.forearm.add(knuckles);

    this.weaponAnchor = new THREE.Group();
    this.weaponAnchor.position.set(0, -0.02, 0.02);
    this.handGroup.add(this.weaponAnchor);

    this.supportHand = new THREE.Group();
    this.supportHand.position.set(-0.11, -0.11, -0.02);
    this.supportHand.rotation.set(-0.2, 0.1, -0.25);
    this.handGroup.add(this.supportHand);
    const supportArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.066, 0.34, 4, 8), this.skinMat);
    supportArm.position.set(-0.05, -0.29, 0.03);
    supportArm.rotation.z = 0.22;
    this.supportHand.add(supportArm);
    const supportBracer = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.072, 0.17, 6), this.leatherMat);
    supportBracer.position.set(-0.04, -0.34, 0.03);
    this.supportHand.add(supportBracer);
    const supportFist = new THREE.Mesh(new THREE.IcosahedronGeometry(0.064, 1), this.skinMat);
    supportFist.scale.set(0.9, 1, 1.15);
    this.supportHand.add(supportFist);

    // Slash ribbon, drawn in camera space.
    const trailGeo = new THREE.RingGeometry(0.46, 1.5, 32, 1, 0.35, Math.PI * 1.06);
    this.trail = new THREE.Mesh(
      trailGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffd6a1,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.trail.position.set(0, -0.08, -1.15);
    this.trail.rotation.z = 0.35;
    this.viewmodel.add(this.trail);

    this.hammerTrail = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.6, 26),
      new THREE.MeshBasicMaterial({
        color: 0xffa45c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.hammerTrail.position.set(0, -0.22, -1.1);
    this.hammerTrail.rotation.x = -0.8;
    this.viewmodel.add(this.hammerTrail);
  }

  setWeapon(name) {
    this.weapon = name;
    for (const child of [...this.weaponAnchor.children]) {
      this.weaponAnchor.remove(child);
      child.traverse?.((node) => {
        node.geometry?.dispose?.();
      });
    }
    this.weaponModel = name === 'sword' ? this.buildSword() : this.buildHammer();
    this.weaponAnchor.add(this.weaponModel);
    this.supportHand.visible = true;
    this.weaponAnchor.rotation.set(0.05, 0.05, 0);
    this.callbacks.onWeaponChange?.(name);
  }

  buildSword() {
    const group = new THREE.Group();

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.28, 7), this.leatherMat);
    handle.position.y = 0.02;
    group.add(handle);
    for (let i = 0; i < 5; i++) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.005, 4, 8), this.bronzeMat);
      wrap.rotation.x = Math.PI / 2;
      wrap.position.y = -0.09 + i * 0.05;
      group.add(wrap);
    }
    const pommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), this.bronzeMat);
    pommel.position.y = -0.14;
    group.add(pommel);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.05, 0.075), this.bronzeMat);
    guard.position.y = 0.17;
    guard.rotation.z = 0.02;
    group.add(guard);
    for (const side of [-1, 1]) {
      const quillon = new THREE.Mesh(new THREE.SphereGeometry(0.048, 7, 5), this.bronzeMat);
      quillon.position.set(side * 0.2, 0.17, 0);
      quillon.scale.set(0.8, 1.25, 0.8);
      group.add(quillon);
    }

    // Slightly tapered blade.
    const bladeGeo = new THREE.BufferGeometry();
    const width = 0.072;
    const length = 1.08;
    const vertices = new Float32Array([
      -width, 0.19, 0, width, 0.19, 0, width * 0.78, 0.84, 0, -width * 0.78, 0.84, 0,
      // Beveled face.
      -width * 0.78, 0.84, 0, width * 0.78, 0.84, 0, 0, 1.27, 0,
    ]);
    bladeGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    bladeGeo.setIndex([0, 1, 2, 0, 2, 3, 3, 4, 5, 4, 6, 5]);
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, this.steelMat);
    blade.material.side = THREE.DoubleSide;
    group.add(blade);

    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.75, 0.012), this.darkSteelMat);
    fuller.position.set(0, 0.57, -0.008);
    group.add(fuller);

    for (let i = 0; i < 4; i++) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.035, 0.008), this.runeMat);
      rune.position.set(0, 0.33 + i * 0.16, 0.011);
      rune.rotation.z = i % 2 ? 0.55 : -0.55;
      group.add(rune);
    }

    const notchBlood = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.012), this.bloodMat);
    notchBlood.position.set(width * 0.6, 0.8, 0.008);
    group.add(notchBlood);

    group.traverse((child) => {
      if (child.isMesh) child.castShadow = false;
    });
    return group;
  }

  buildHammer() {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.042, 0.98, 8), this.woodMat);
    handle.position.y = 0.46;
    group.add(handle);
    for (let i = 0; i < 5; i++) {
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.075, 7), this.leatherMat);
      wrap.position.y = i * 0.09 - 0.02;
      group.add(wrap);
    }
    const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 7), this.bronzeMat);
    pommel.position.y = -0.04;
    group.add(pommel);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.28), this.darkSteelMat);
    head.position.y = 0.97;
    group.add(head);
    const faceA = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.36, 0.32), this.steelMat);
    faceA.position.set(-0.15, 0.97, 0);
    group.add(faceA);
    const faceB = faceA.clone();
    faceB.position.x = 0.15;
    group.add(faceB);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.23, 4), this.steelMat);
    spike.position.y = 1.2;
    group.add(spike);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 8), this.bronzeMat);
    collar.position.y = 0.82;
    group.add(collar);

    for (const side of [-1, 1]) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.006), this.runeMat);
      rune.position.set(side * 0.15, 0.97, 0.162);
      group.add(rune);
    }
    // Dried blood in the striking face.
    const stain = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.01), this.bloodMat);
    stain.position.set(0.15, 0.93, 0.18);
    group.add(stain);

    group.traverse((child) => {
      if (child.isMesh) child.castShadow = false;
    });
    return group;
  }

  setLook(dx, dy, sensitivity = 0.0021) {
    if (this.dead) return;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = clamp(this.pitch, -1.27, 1.18);
    this.yaw %= TAU;
  }

  setPosition(x, z) {
    this.position.set(x, 0, z);
    this.camera.position.set(x, 1.68, z);
  }

  reset(weapon = 'sword') {
    this.health = this.maxHealth;
    this.dead = false;
    this.attack = null;
    this.attackCooldown = 0;
    this.dodgeCooldown = 0;
    this.dodgeTimer = 0;
    this.dodgeInvuln = 0;
    this.shake = 0;
    this.pitch = -0.07;
    this.yaw = 0;
    this.setPosition(0, 9);
    this.setWeapon(weapon);
    this.fov = this.baseFov;
    this.aimingAt = null;
    this.viewmodel.visible = true;
  }

  queueAttack(heavy = false) {
    if (this.dead || this.attack || this.attackCooldown > 0) return false;
    const sword = this.weapon === 'sword';
    const duration = heavy ? (sword ? 0.78 : 1.05) : (sword ? 0.48 : 0.68);
    const hitDelay = heavy ? (sword ? 0.3 : 0.48) : (sword ? 0.17 : 0.28);
    this.attack = {
      heavy,
      elapsed: 0,
      duration,
      hitDelay,
      hitDone: false,
      step: this.comboStep++,
    };
    this.comboStep %= 2;
    this.audio.swing(this.weapon);
    return true;
  }

  getAimEnemies() {
    return this.callbacks.getEnemies?.() || [];
  }

  getForward() {
    return this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  findTarget(maxRange, angleLimit = 0.82) {
    const enemies = this.getAimEnemies();
    const origin = this.camera.position;
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    this.raycaster.set(origin, direction);
    this.raycaster.far = maxRange;

    const meshes = [];
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      for (const mesh of enemy.hitMeshes) {
        if (!mesh.visible) continue;
        meshes.push(mesh);
      }
    }
    const intersections = this.raycaster.intersectObjects(meshes, false);
    if (intersections.length) {
      const hit = intersections[0];
      const enemy = hit.object.userData.enemy;
      const part = hit.object.userData.part;
      if (enemy && !enemy.dead) {
        return { enemy, part, point: hit.point.clone(), exact: true };
      }
    }

    // Generous assisted targeting for the fast, close quarters melee.
    let best = null;
    let bestScore = Infinity;
    const projected = new THREE.Vector3();
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      for (const mesh of enemy.hitMeshes) {
        if (!mesh.visible) continue;
        mesh.getWorldPosition(projected);
        const offset = projected.clone().sub(origin);
        const distance = offset.length();
        if (distance > maxRange + 0.65) continue;
        const dot = offset.normalize().dot(direction);
        if (dot < Math.cos(angleLimit)) continue;
        const screen = projected.clone().project(this.camera);
        const screenDistance = Math.hypot(screen.x, screen.y);
        const score = screenDistance * 2.4 + distance * 0.045 - dot * 0.5;
        if (screenDistance < 0.42 && score < bestScore) {
          bestScore = score;
          best = { enemy, part: mesh.userData.part, point: projected.clone(), exact: false };
        }
      }
    }
    return best;
  }

  updateAimTarget(enemies) {
    this.aimTimer -= 1 / 60;
    if (this.aimTimer > 0) return;
    this.aimTimer = 0.07;
    let closest = null;
    let bestScore = Infinity;
    const origin = this.camera.position;
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const point = new THREE.Vector3();
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      for (const mesh of enemy.hitMeshes) {
        if (!mesh.visible) continue;
        mesh.getWorldPosition(point);
        const dist = point.distanceTo(origin);
        if (dist > 9) continue;
        const dir = point.clone().sub(origin).normalize();
        const dot = dir.dot(direction);
        if (dot < 0.92) continue;
        const screen = point.clone().project(this.camera);
        const score = Math.hypot(screen.x, screen.y) + dist * 0.006;
        if (score < bestScore) {
          bestScore = score;
          closest = enemy;
        }
      }
    }
    this.aimingAt = closest;
  }

  performHit() {
    const heavy = this.attack.heavy;
    const sword = this.weapon === 'sword';
    const range = sword ? (heavy ? 3.5 : 3.1) : (heavy ? 3.9 : 3.05);
    const damage = sword ? (heavy ? 55 : 24) : (heavy ? 76 : 32);
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    direction.y = 0;
    direction.normalize();

    if (!sword && heavy) {
      // Ground slam: a wide, low arc that can ruin several sets of legs.
      const center = this.position.clone().addScaledVector(direction, 2.1);
      this.effects.hammerShockwave(center, 3.6);
      this.effects.emit(center, new THREE.Vector3(0, 1, 0), 22, {
        speed: 4,
        spread: 1,
        gravity: 7,
        life: 0.5,
        colors: [[0.53, 0.4, 0.24], [0.33, 0.24, 0.15], [0.22, 0.15, 0.09]],
      });
      this.shakeCamera(0.32);
      this.audio.hammer(1.5);
      let hitAny = false;
      const enemies = this.getAimEnemies();
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        const dx = enemy.root.position.x - this.position.x;
        const dz = enemy.root.position.z - this.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 3.9) continue;
        const dot = (dx / Math.max(dist, 0.01)) * direction.x + (dz / Math.max(dist, 0.01)) * direction.z;
        if (dot < -0.25) continue;
        const part = this.chooseLowPart(enemy);
        const point = enemy.root.position.clone().add(new THREE.Vector3(0, part.startsWith('leg') ? 0.45 : 1.1, 0));
        const result = enemy.takeHit(part, damage, 'hammer', direction, point, true);
        this.callbacks.onHit?.(result, enemy, part, heavy);
        hitAny = true;
      }
      if (!hitAny && this.callbacks.onMiss) this.callbacks.onMiss();
      return;
    }

    const target = this.findTarget(range);
    if (target) {
      const result = target.enemy.takeHit(target.part, damage, sword ? 'sword' : 'hammer', direction, target.point, heavy);
      this.callbacks.onHit?.(result, target.enemy, target.part, heavy);
      this.shakeCamera(heavy ? 0.21 : 0.1);
      if (sword) this.audio.flesh(heavy ? 1.25 : 0.85);
      else this.audio.hammer(heavy ? 1.3 : 0.9);
      this.weaponKick = heavy ? 1 : 0.55;
      return;
    }
    this.callbacks.onMiss?.();
  }

  chooseLowPart(enemy) {
    const choices = [];
    if (enemy.partAttached.legL) choices.push('legL');
    if (enemy.partAttached.legR) choices.push('legR');
    if (enemy.partAttached.torso) choices.push('torso');
    if (!choices.length && enemy.partAttached.head) choices.push('head');
    return choices[Math.floor(Math.random() * choices.length)] || 'torso';
  }

  shakeCamera(amount) {
    this.shake = Math.max(this.shake, amount);
    this.shakeTime = 0.32;
  }

  damage(amount, source) {
    if (this.dead) return false;
    if (this.dodgeInvuln > 0) {
      this.callbacks.onDodge?.();
      return false;
    }
    this.health -= amount;
    this.shakeCamera(0.34);
    this.audio.flesh(1.2);
    this.callbacks.onDamage?.(amount, source);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.viewmodel.visible = false;
      this.callbacks.onDeath?.(source);
    }
    return true;
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, this.maxHealth);
  }

  dodge(input) {
    if (this.dead || this.dodgeCooldown > 0) return false;
    const moveX = input.right || 0;
    const moveZ = input.forward || 0;
    const forward = this.getForward();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    this.dodgeDirection.set(0, 0, 0).addScaledVector(forward, moveZ).addScaledVector(right, moveX);
    if (this.dodgeDirection.lengthSq() < 0.05) this.dodgeDirection.copy(forward).multiplyScalar(-1);
    this.dodgeDirection.normalize();
    this.dodgeTimer = 0.25;
    this.dodgeInvuln = 0.34;
    this.dodgeCooldown = 1.25;
    this.shakeCamera(0.06);
    this.callbacks.onDodgeStart?.();
    return true;
  }

  update(dt, input, time) {
    if (this.dead) {
      this.updateCamera(dt, time);
      return;
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.dodgeInvuln = Math.max(0, this.dodgeInvuln - dt);

    const forward = this.getForward();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    this.moveDirection.set(0, 0, 0)
      .addScaledVector(forward, input.forward || 0)
      .addScaledVector(right, input.right || 0);

    if (this.moveDirection.lengthSq() > 1) this.moveDirection.normalize();
    const deadzone = 0.08;
    const moving = this.moveDirection.lengthSq() > deadzone;

    const attackSlow = this.attack && !this.attack.heavy ? 0.62 : 1;
    const speed = 4.65 * attackSlow;
    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= dt;
      this.position.addScaledVector(this.dodgeDirection, 11.5 * dt);
      this.fov = damp(this.fov, 83, 11, dt);
    } else if (moving) {
      this.position.addScaledVector(this.moveDirection, speed * dt);
      this.moveBlend = damp(this.moveBlend, 1, 10, dt);
      this.walkPhase += dt * 10.5;
      if (time - this.lastStep > 0.37) {
        this.lastStep = time;
        this.audio.footstep(false);
      }
    } else {
      this.moveBlend = damp(this.moveBlend, 0, 8, dt);
      this.walkPhase += dt * 1.4;
    }

    const radial = Math.hypot(this.position.x, this.position.z);
    if (radial > 17.35) {
      this.position.x *= 17.35 / radial;
      this.position.z *= 17.35 / radial;
    }

    if (this.attack) {
      this.attack.elapsed += dt;
      if (!this.attack.hitDone && this.attack.elapsed >= this.attack.hitDelay) {
        this.attack.hitDone = true;
        this.performHit();
      }
      if (this.attack.elapsed >= this.attack.duration) {
        this.attack = null;
        this.attackCooldown = this.weapon === 'hammer' ? 0.12 : 0.06;
        this.fov = this.baseFov;
      }
    }

    this.updateCamera(dt, time);
    this.animateViewmodel(dt, time, moving);
    this.updateAimTarget(this.getAimEnemies());
    this.updateTrail();
  }

  updateCamera(dt, time) {
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    this.shake = damp(this.shake, 0, 8, dt);
    const bobAmount = this.moveBlend * 0.033;
    const bob = Math.sin(this.walkPhase * 2) * bobAmount;
    const sway = Math.cos(this.walkPhase) * bobAmount * 0.7;
    const shakePower = this.shake * Math.min(1, this.shakeTime * 4);
    const shakeX = (Math.random() - 0.5) * shakePower;
    const shakeY = (Math.random() - 0.5) * shakePower;
    const shakeRoll = (Math.random() - 0.5) * shakePower * 0.5;

    this.camera.position.set(
      this.position.x + sway * 0.6 + shakeX,
      1.68 + bob + shakeY,
      this.position.z,
    );
    this.camera.rotation.set(
      this.pitch + shakeY * 0.04,
      this.yaw + shakeX * 0.03,
      shakeRoll + Math.cos(this.walkPhase) * this.moveBlend * 0.004,
    );

    if (this.dodgeTimer <= 0) {
      this.fov = damp(this.fov, this.baseFov + (this.attack?.heavy ? 2 : 0), 6, dt);
    }
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  animateViewmodel(dt, time, moving) {
    const attack = this.attack;
    const isSword = this.weapon === 'sword';
    let px = IDLE_POSITION.x;
    let py = IDLE_POSITION.y;
    let pz = IDLE_POSITION.z;
    let rx = IDLE_ROTATION.x;
    let ry = IDLE_ROTATION.y;
    let rz = IDLE_ROTATION.z;

    const bob = Math.sin(this.walkPhase * 2) * 0.013 * this.moveBlend;
    const sway = Math.cos(this.walkPhase) * 0.011 * this.moveBlend;
    px += sway;
    py += bob;
    rx += Math.sin(time * 1.7) * 0.006;
    ry += Math.sin(time * 1.1) * 0.008;

    if (isSword) {
      this.trail.visible = true;
      this.hammerTrail.visible = false;
      this.supportHand.visible = false;
    } else {
      this.trail.visible = false;
      this.hammerTrail.visible = true;
      this.supportHand.visible = true;
      this.supportHand.position.set(-0.12, -0.16, 0.02);
      this.supportHand.rotation.z = -0.35;
    }

    if (attack) {
      const p = clamp(attack.elapsed / attack.duration, 0, 1);
      const windup = clamp(p / 0.26, 0, 1);
      const strike = clamp((p - 0.26) / 0.38, 0, 1);
      const recover = clamp((p - 0.64) / 0.36, 0, 1);
      const strikeEase = easeOutCubic(strike);
      const windEase = easeInCubic(windup);
      const direction = attack.step % 2 === 0 ? 1 : -1;

      if (isSword) {
        if (attack.heavy) {
          // Overhead cleave.
          py += -0.05 + 0.18 * windEase - 0.24 * strikeEase + 0.04 * recover;
          pz += 0.08 - 0.35 * strikeEase;
          rx += -0.55 * windEase + 1.05 * strikeEase - 0.3 * recover;
          rz += 0.15 * windEase - 0.55 * strikeEase;
          ry += -0.15 * strikeEase;
        } else {
          py += 0.12 * windEase - 0.18 * strikeEase;
          px += 0.16 * windEase * direction - 0.4 * strikeEase * direction + 0.2 * recover;
          pz += 0.08 - 0.24 * strikeEase;
          rz += 0.55 * windEase * direction - 1.45 * strikeEase * direction;
          ry += -0.4 * windEase * direction + 0.9 * strikeEase * direction;
          rx += -0.18 * windEase + 0.16 * strikeEase;
        }
      } else if (attack.heavy) {
        // Hammer overhead demolition.
        py += 0.22 * windEase - 0.3 * strikeEase + 0.05 * recover;
        pz += 0.08 - 0.38 * strikeEase;
        rx += -1.05 * windEase + 1.5 * strikeEase - 0.38 * recover;
        rz += 0.22 * windEase - 0.25 * strikeEase;
        ry += -0.25 * strikeEase;
        this.fov = damp(this.fov, this.baseFov - 5 * strikeEase, 8, dt);
      } else {
        // Wide horizontal hammer sweep.
        py += 0.06 - 0.2 * strikeEase;
        px += 0.28 * windEase * direction - 0.65 * strikeEase * direction + 0.32 * recover;
        pz += 0.08 - 0.24 * strikeEase;
        rz += 0.65 * windEase * direction - 1.35 * strikeEase * direction;
        ry += -0.55 * windEase * direction + 1.1 * strikeEase * direction;
        rx += -0.12 * windEase + 0.2 * strikeEase;
      }
    }

    this.handGroup.position.set(px, py, pz);
    this.handGroup.rotation.set(rx, ry, rz);
    this.handGroup.position.y += this.weaponKick * 0.025;
    this.weaponKick = damp(this.weaponKick, 0, 9, dt);
    this.handGroup.rotation.z += this.weaponKick * 0.03;
    this.weaponLight.intensity = 0.75 + Math.sin(time * 6) * 0.08 + this.weaponKick * 0.6;
  }

  updateTrail() {
    if (!this.attack) {
      this.trail.material.opacity = damp(this.trail.material.opacity, 0, 17, 1 / 60);
      this.hammerTrail.material.opacity = damp(this.hammerTrail.material.opacity, 0, 17, 1 / 60);
      return;
    }
    const p = this.attack.elapsed / this.attack.duration;
    const visible = p > 0.24 && p < 0.66;
    if (this.weapon === 'sword') {
      this.trail.material.opacity = visible ? 0.34 : 0;
      this.trail.rotation.z = this.attack.step % 2 === 0 ? 0.35 : 2.2;
      this.trail.scale.setScalar(0.88 + Math.sin(p * Math.PI) * 0.16);
    } else {
      this.hammerTrail.material.opacity = visible ? 0.23 : 0;
      this.hammerTrail.scale.setScalar(1 + p * 0.4);
    }
  }
}
