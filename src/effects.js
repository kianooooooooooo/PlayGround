import * as THREE from 'three';
import {
  canvas2d,
  textureFromCanvas,
  radialTexture,
  rand,
  randInt,
  pick,
  clamp,
  TAU,
} from './utils.js';

function makeSplatTexture(seed = 1) {
  const { canvas, ctx } = canvas2d(128);
  ctx.clearRect(0, 0, 128, 128);
  const r = (min, max) => min + Math.random() * (max - min);

  // Central impact blot.
  const cx = 64 + r(-7, 7);
  const cy = 64 + r(-7, 7);
  const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, 44);
  gradient.addColorStop(0, 'rgba(104, 0, 2, .98)');
  gradient.addColorStop(0.55, 'rgba(78, 0, 2, .82)');
  gradient.addColorStop(1, 'rgba(48, 0, 2, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, TAU);
  ctx.fill();

  // Irregular lobes.
  for (let i = 0; i < 16; i++) {
    const angle = r(0, TAU);
    const dist = r(10, 38);
    const radius = r(5, 19);
    ctx.fillStyle = `rgba(${r(48, 104) | 0}, 0, ${r(0, 5) | 0}, ${r(0.4, 0.88)})`;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, radius, radius * r(0.35, 1), angle, 0, TAU);
    ctx.fill();
  }

  // Satellite droplets.
  for (let i = 0; i < 34; i++) {
    const angle = r(0, TAU);
    const dist = r(30, 62);
    const radius = r(0.8, 5.2);
    ctx.fillStyle = `rgba(${r(52, 122) | 0}, 0, ${r(0, 4) | 0}, ${r(0.32, 0.9)})`;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, radius, radius * r(0.3, 2.2), angle, 0, TAU);
    ctx.fill();
  }

  // Directional spray lines.
  for (let i = 0; i < 5; i++) {
    const angle = r(0, TAU);
    ctx.strokeStyle = `rgba(80, 0, 2, ${r(0.2, 0.5)})`;
    ctx.lineWidth = r(1, 3);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * r(36, 57), cy + Math.sin(angle) * r(36, 57));
    ctx.stroke();
  }
  return textureFromCanvas(canvas);
}

function makeWallSplatTexture() {
  const { canvas, ctx } = canvas2d(128, 256);
  ctx.clearRect(0, 0, 128, 256);
  const gradient = ctx.createRadialGradient(64, 44, 2, 64, 44, 46);
  gradient.addColorStop(0, 'rgba(112, 0, 2, .96)');
  gradient.addColorStop(0.5, 'rgba(74, 0, 2, .8)');
  gradient.addColorStop(1, 'rgba(45, 0, 1, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(64, 44, 48, 40, 0, 0, TAU);
  ctx.fill();

  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(${randInt(45, 100)}, 0, 1, ${rand(0.35, 0.85)})`;
    ctx.beginPath();
    ctx.ellipse(rand(20, 108), rand(25, 100), rand(5, 18), rand(3, 13), rand(0, TAU), 0, TAU);
    ctx.fill();
  }
  // Drips.
  for (let i = 0; i < 19; i++) {
    const x = rand(22, 106);
    const y = rand(48, 116);
    const length = rand(12, 118);
    const width = rand(1.1, 4.2);
    const dripGrad = ctx.createLinearGradient(0, y, 0, y + length);
    dripGrad.addColorStop(0, `rgba(${randInt(55, 105)}, 0, 2, ${rand(0.4, 0.86)})`);
    dripGrad.addColorStop(1, 'rgba(42, 0, 1, 0)');
    ctx.fillStyle = dripGrad;
    ctx.fillRect(x, y, width, length);
    if (Math.random() > 0.4) {
      ctx.beginPath();
      ctx.arc(x + width / 2, y + length, width * 1.5, 0, TAU);
      ctx.fillStyle = 'rgba(64, 0, 2, .5)';
      ctx.fill();
    }
  }
  return textureFromCanvas(canvas);
}

export class Effects {
  constructor(scene, arena) {
    this.scene = scene;
    this.arena = arena;
    this.particleCount = 640;
    this.particles = [];
    this.decals = [];
    this.debris = [];
    this.transients = [];

    this.splatMaps = [makeSplatTexture(), makeSplatTexture(), makeSplatTexture()];
    this.wallMaps = [makeWallSplatTexture(), makeWallSplatTexture()];
    this.decalGeometry = new THREE.PlaneGeometry(1, 1);
    this.wallDecalGeometry = new THREE.PlaneGeometry(1, 1);
    this.decalCount = 0;

    this.initParticles();
  }

  initParticles() {
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    positions.fill(-1000);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.075,
      map: radialTexture(32, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 3;
    this.scene.add(points);
    this.points = points;
    this.particleCursor = 0;
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        gravity: 9.8,
        life: 0,
        maxLife: 1,
        drag: 0.99,
      });
      positions[i * 3 + 1] = -1000;
    }
    geometry.attributes.position.needsUpdate = true;
  }

  emit(position, direction, count, options = {}) {
    const {
      speed = 3.3,
      spread = 0.85,
      gravity = 9.8,
      life = 0.65,
      colors = [
        [0.38, 0.005, 0.008],
        [0.56, 0.008, 0.01],
        [0.71, 0.02, 0.015],
        [0.29, 0.002, 0.004],
      ],
      drag = 0.992,
      bias = 0.35,
    } = options;
    const positions = this.points.geometry.attributes.position.array;
    const colorArray = this.points.geometry.attributes.color.array;
    for (let i = 0; i < count; i++) {
      const index = this.particleCursor;
      this.particleCursor = (this.particleCursor + 1) % this.particleCount;
      const particle = this.particles[index];
      particle.active = true;
      particle.pos.copy(position);
      particle.pos.x += rand(-0.12, 0.12);
      particle.pos.y += rand(-0.08, 0.2);
      particle.pos.z += rand(-0.12, 0.12);
      const vx = direction.x + rand(-spread, spread);
      const vy = direction.y + rand(-spread * 0.55, spread) + bias;
      const vz = direction.z + rand(-spread, spread);
      const scale = speed * rand(0.25, 1.2);
      particle.vel.set(vx, vy, vz).normalize().multiplyScalar(scale);
      particle.gravity = gravity;
      particle.life = life * rand(0.5, 1.35);
      particle.maxLife = particle.life;
      particle.drag = drag;
      const c = pick(colors);
      colorArray[index * 3] = c[0];
      colorArray[index * 3 + 1] = c[1];
      colorArray[index * 3 + 2] = c[2];
      positions[index * 3] = particle.pos.x;
      positions[index * 3 + 1] = particle.pos.y;
      positions[index * 3 + 2] = particle.pos.z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  bloodBurst(position, direction = new THREE.Vector3(0, 0.4, 1), intensity = 1) {
    this.emit(position, direction, Math.round(15 * intensity), {
      speed: 3.5 * intensity,
      spread: 0.95,
      life: 0.75,
    });
    this.emit(position, direction, Math.round(8 * intensity), {
      speed: 5.8 * intensity,
      spread: 0.55,
      life: 0.45,
      bias: 0.55,
      gravity: 11,
    });
    // Thick arterial spray is represented by long directional streaks.
    this.emit(position, direction, Math.round(5 * intensity), {
      speed: 6.4,
      spread: 0.12,
      life: 0.75,
      gravity: 9.8,
      bias: 0.25,
      drag: 0.985,
    });
    this.addBloodDecal(position, direction, intensity);
    if (Math.random() > 0.58) this.addBloodDecal(position, direction, intensity * 0.7, true);
  }

  bloodFountain(position, direction = new THREE.Vector3(0, 1, 0), intensity = 1) {
    this.emit(position, new THREE.Vector3(direction.x * 0.3, 1.1, direction.z * 0.3), Math.round(10 * intensity), {
      speed: 2.1,
      spread: 0.32,
      life: 0.9,
      gravity: 8,
      bias: 0.6,
    });
  }

  sparks(position, direction, count = 12) {
    this.emit(position, direction, count, {
      speed: 4.2,
      spread: 0.8,
      gravity: 7.5,
      life: 0.28,
      drag: 0.98,
      colors: [[1, 0.76, 0.29], [1, 0.93, 0.67], [1, 0.5, 0.12], [0.8, 0.24, 0.02]],
    });
  }

  addBloodDecal(position, direction = new THREE.Vector3(0, 0, 1), intensity = 1, forceWall = false) {
    const radial = Math.hypot(position.x, position.z);
    const isWall = forceWall || radial > 18.25 || (position.y > 1.2 && radial > 17.2);
    let mesh;
    if (isWall) {
      const angle = Math.atan2(position.z, position.x);
      const radius = 19.05;
      const y = clamp(position.y + rand(-0.15, 0.55), 0.3, 2.55);
      const material = new THREE.MeshBasicMaterial({
        map: pick(this.wallMaps),
        transparent: true,
        opacity: rand(0.45, 0.87) * clamp(intensity, 0.4, 1.35),
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      });
      mesh = new THREE.Mesh(this.wallDecalGeometry, material);
      const scale = rand(0.45, 1.15) * clamp(intensity, 0.5, 1.2);
      mesh.scale.set(scale * rand(0.7, 1.15), scale * rand(0.9, 1.35), 1);
      mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      mesh.lookAt(0, y, 0);
      mesh.rotation.z = rand(-0.18, 0.18);
      mesh.renderOrder = 4;
    } else {
      const material = new THREE.MeshBasicMaterial({
        map: pick(this.splatMaps),
        transparent: true,
        opacity: rand(0.5, 0.86) * clamp(intensity, 0.4, 1.3),
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
      });
      mesh = new THREE.Mesh(this.decalGeometry, material);
      const scale = rand(0.5, 1.35) * clamp(intensity, 0.45, 1.35);
      mesh.scale.set(scale * rand(0.8, 1.6), scale * rand(0.55, 1.4), 1);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rand(0, TAU);
      mesh.position.set(
        position.x + direction.x * rand(0.2, 0.6) + rand(-0.25, 0.25),
        0.018 + this.decals.length * 0.00004,
        position.z + direction.z * rand(0.2, 0.6) + rand(-0.25, 0.25),
      );
      mesh.renderOrder = 2;
    }
    this.scene.add(mesh);
    this.decals.push(mesh);
    if (this.decals.length > 155) {
      const old = this.decals.shift();
      this.scene.remove(old);
      old.material.dispose();
    }
  }

  addDebris(object, velocity = new THREE.Vector3(), spin = new THREE.Vector3(), floor = 0.07) {
    object.userData.physics = {
      vel: velocity.clone(),
      spin: spin.clone(),
      floor,
      settled: false,
    };
    this.debris.push(object);
    return object;
  }

  updateDebris(dt) {
    for (const object of this.debris) {
      const physics = object.userData.physics;
      if (!physics || physics.settled) continue;
      physics.vel.y -= 12.5 * dt;
      object.position.addScaledVector(physics.vel, dt);
      object.rotation.x += physics.spin.x * dt;
      object.rotation.y += physics.spin.y * dt;
      object.rotation.z += physics.spin.z * dt;
      if (object.position.y < physics.floor) {
        object.position.y = physics.floor;
        if (Math.abs(physics.vel.y) > 1.2) {
          physics.vel.y *= -0.27;
          physics.vel.x *= 0.58;
          physics.vel.z *= 0.58;
          physics.spin.multiplyScalar(0.62);
          if (Math.random() > 0.6) {
            this.emit(object.position, new THREE.Vector3(0, 0.6, 0), 2, {
              speed: 1.2,
              spread: 0.9,
              life: 0.35,
              gravity: 6,
              colors: [[0.32, 0.002, 0.003], [0.5, 0.006, 0.005]],
            });
          }
        } else {
          physics.vel.set(0, 0, 0);
          physics.spin.set(0, 0, 0);
          physics.settled = true;
        }
      }
      const radial = Math.hypot(object.position.x, object.position.z);
      if (radial > 18.4) {
        object.position.x *= 18.4 / radial;
        object.position.z *= 18.4 / radial;
        physics.vel.x *= -0.3;
        physics.vel.z *= -0.3;
      }
    }
  }

  createGuts(position, direction) {
    const group = new THREE.Group();
    group.position.copy(position);
    const intestineMat = new THREE.MeshStandardMaterial({
      color: 0x6e2626,
      roughness: 0.72,
      metalness: 0.02,
      flatShading: true,
    });
    const fatMat = new THREE.MeshStandardMaterial({ color: 0xb68168, roughness: 0.82 });
    for (let i = 0; i < 4; i++) {
      const points = [];
      const length = randInt(3, 5);
      for (let j = 0; j < length; j++) {
        points.push(new THREE.Vector3(rand(-0.3, 0.3), rand(-0.1, 0.3), rand(-0.35, 0.35)));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, rand(0.035, 0.075), 5, false), intestineMat);
      group.add(tube);
    }
    for (let i = 0; i < 7; i++) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.04, 0.1), 1), Math.random() > 0.3 ? intestineMat : fatMat);
      blob.position.set(rand(-0.32, 0.32), rand(-0.1, 0.3), rand(-0.32, 0.32));
      group.add(blob);
    }
    this.scene.add(group);
    const velocity = new THREE.Vector3(direction.x * rand(1.2, 2.8) + rand(-0.8, 0.8), rand(1.5, 3.6), direction.z * rand(1.2, 2.8) + rand(-0.8, 0.8));
    this.addDebris(group, velocity, new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)), 0.04);
    this.bloodBurst(position, direction, 1.8);
    return group;
  }

  createBone(position, direction, length = 0.35, radius = 0.04) {
    const material = new THREE.MeshStandardMaterial({ color: 0xe5d6b8, roughness: 0.7, flatShading: true });
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.8, length, 5), material);
    bone.position.copy(position);
    bone.rotation.set(rand(-1, 1), rand(0, TAU), rand(-1, 1));
    this.scene.add(bone);
    this.addDebris(
      bone,
      new THREE.Vector3(direction.x * rand(0.8, 2.4), rand(1.5, 3.3), direction.z * rand(0.8, 2.4)),
      new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
      0.05,
    );
    return bone;
  }

  createBrain(position, direction) {
    const brain = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xc27b79, roughness: 0.55 });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 2), mat);
    core.scale.set(1, 0.72, 1.12);
    brain.add(core);
    for (let i = 0; i < 7; i++) {
      const lobe = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.035, 0.075), 1), mat);
      lobe.position.set(rand(-0.13, 0.13), rand(-0.06, 0.08), rand(-0.13, 0.13));
      brain.add(lobe);
    }
    brain.position.copy(position);
    this.scene.add(brain);
    this.addDebris(
      brain,
      new THREE.Vector3(direction.x * rand(0.5, 1.8), rand(1.4, 3), direction.z * rand(0.5, 1.8)),
      new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
      0.12,
    );
    return brain;
  }

  createSkullFragment(position, direction, side = 1) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xcfb995, roughness: 0.62, flatShading: true });
    const geo = new THREE.SphereGeometry(0.18, 9, 6, 0, Math.PI, 0, Math.PI * 0.72);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.rotation.set(rand(-0.4, 0.4), side * rand(1.2, 2.2), rand(-0.5, 0.5));
    mesh.scale.set(1, 0.95, 1.1);
    this.scene.add(mesh);
    this.addDebris(
      mesh,
      new THREE.Vector3(direction.x * rand(0.5, 2) + side * rand(0.8, 2), rand(1.2, 3.2), direction.z * rand(0.5, 2)),
      new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)),
      0.12,
    );
    return mesh;
  }

  hammerShockwave(position, radius = 3.2) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.55, 40),
      new THREE.MeshBasicMaterial({
        color: 0xf3b064,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.position.y = 0.06;
    this.scene.add(ring);
    this.transients.push({ mesh: ring, age: 0, maxAge: 0.5, type: 'ring', radius });
    this.emit(position, new THREE.Vector3(0, 1, 0), 16, {
      speed: 2.8,
      spread: 0.65,
      gravity: 3.5,
      life: 0.4,
      colors: [[0.95, 0.7, 0.4], [0.7, 0.5, 0.32], [0.36, 0.23, 0.13]],
    });
  }

  update(dt) {
    const positions = this.points.geometry.attributes.position.array;
    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        positions[i * 3 + 1] = -1000;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.pos.addScaledVector(p.vel, dt);
      positions[i * 3] = p.pos.x;
      positions[i * 3 + 1] = p.pos.y;
      positions[i * 3 + 2] = p.pos.z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.updateDebris(dt);

    for (let i = this.transients.length - 1; i >= 0; i--) {
      const t = this.transients[i];
      t.age += dt;
      const progress = t.age / t.maxAge;
      if (t.type === 'ring') {
        const scale = 1 + progress * t.radius * 2.4;
        t.mesh.scale.set(scale, scale, 1);
        t.mesh.material.opacity = 0.65 * (1 - progress);
      }
      if (progress >= 1) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.transients.splice(i, 1);
      }
    }
  }

  clearWave() {
    for (const decal of this.decals) {
      this.scene.remove(decal);
      decal.material.dispose();
    }
    this.decals.length = 0;

    for (const object of this.debris) {
      this.scene.remove(object);
      object.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose?.();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) material?.dispose?.();
        }
      });
    }
    this.debris.length = 0;

    for (const t of this.transients) {
      this.scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    }
    this.transients.length = 0;

    const positions = this.points.geometry.attributes.position.array;
    for (let i = 0; i < this.particleCount; i++) {
      this.particles[i].active = false;
      positions[i * 3 + 1] = -1000;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
