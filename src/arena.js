import * as THREE from 'three';
import {
  canvas2d,
  textureFromCanvas,
  makeNoiseTexture,
  radialTexture,
  rand,
  randInt,
  pick,
  TAU,
  clamp,
} from './utils.js';

const BLOCK_LINES = '#22150e';

function sandTexture() {
  const { canvas, ctx } = canvas2d(512);
  ctx.fillStyle = '#8d6b40';
  ctx.fillRect(0, 0, 512, 512);

  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, 'rgba(206, 167, 105, .18)');
  gradient.addColorStop(0.46, 'rgba(67, 40, 20, .16)');
  gradient.addColorStop(1, 'rgba(224, 182, 117, .1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 9000; i++) {
    const tone = Math.random() > 0.52 ? 255 : 0;
    ctx.globalAlpha = rand(0.012, 0.055);
    ctx.fillStyle = tone ? '#f4dfb5' : '#331f11';
    const s = rand(0.3, 2.1);
    ctx.fillRect(rand(0, 512), rand(0, 512), s, s);
  }

  // Trodden tracks and hairline cracks.
  for (let i = 0; i < 18; i++) {
    ctx.globalAlpha = rand(0.025, 0.08);
    ctx.strokeStyle = i % 3 === 0 ? '#d4b67e' : '#3a2414';
    ctx.lineWidth = rand(0.5, 2.2);
    ctx.beginPath();
    let x = rand(0, 512);
    let y = rand(0, 512);
    ctx.moveTo(x, y);
    for (let j = 0; j < randInt(4, 10); j++) {
      x += rand(-24, 24);
      y += rand(3, 18);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 22; i++) {
    ctx.globalAlpha = rand(0.01, 0.035);
    ctx.fillStyle = '#f6dfb4';
    ctx.beginPath();
    ctx.ellipse(rand(0, 512), rand(0, 512), rand(18, 75), rand(2, 10), rand(0, TAU), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return textureFromCanvas(canvas, { repeat: [4, 4] });
}

function stoneTexture() {
  const { canvas, ctx } = canvas2d(512);
  ctx.fillStyle = '#4a3827';
  ctx.fillRect(0, 0, 512, 512);
  const rowHeight = 64;
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 === 0 ? 0 : 52;
    for (let col = -1; col < 6; col++) {
      const x = col * 104 + offset;
      const y = row * rowHeight;
      const tone = randInt(47, 75);
      ctx.fillStyle = `rgb(${tone + 7}, ${tone - 2}, ${Math.max(24, tone - 13)})`;
      ctx.fillRect(x + 2, y + 2, 100, rowHeight - 4);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#d2a973';
      ctx.fillRect(x + 4, y + 4, 96, 2);
      ctx.globalAlpha = 1;
    }
  }
  for (let i = 0; i < 3600; i++) {
    ctx.globalAlpha = rand(0.02, 0.11);
    ctx.fillStyle = Math.random() > 0.5 ? '#e3c08b' : '#160d08';
    ctx.fillRect(rand(0, 512), rand(0, 512), rand(0.4, 2.2), rand(0.4, 2.2));
  }
  // Moss and old damp patches.
  for (let i = 0; i < 12; i++) {
    ctx.globalAlpha = rand(0.025, 0.095);
    ctx.fillStyle = i % 3 === 0 ? '#59613a' : '#150c08';
    ctx.beginPath();
    ctx.ellipse(rand(0, 512), rand(0, 512), rand(9, 38), rand(4, 15), rand(0, TAU), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return textureFromCanvas(canvas, { repeat: [10, 1.8] });
}

function bannerTexture() {
  const { canvas, ctx } = canvas2d(256, 512);
  const grad = ctx.createLinearGradient(0, 0, 256, 512);
  grad.addColorStop(0, '#5a0d0e');
  grad.addColorStop(0.5, '#370909');
  grad.addColorStop(1, '#1e0505');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#000000' : '#b4553b';
    ctx.fillRect(rand(0, 256), rand(0, 512), rand(1, 4), rand(1, 30));
  }
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#b79354';
  ctx.lineWidth = 3;
  ctx.strokeRect(19, 20, 218, 470);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#5f4725';
  ctx.strokeRect(27, 28, 202, 454);

  ctx.fillStyle = '#b48e4f';
  ctx.beginPath();
  ctx.arc(128, 170, 63, 0, TAU);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Skull sigil.
  ctx.fillStyle = '#c3a76d';
  ctx.beginPath();
  ctx.ellipse(128, 156, 26, 30, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(108, 166, 40, 24);
  ctx.fillStyle = '#3c1b0f';
  ctx.beginPath();
  ctx.arc(117, 154, 6, 0, TAU);
  ctx.arc(139, 154, 6, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(128, 160);
  ctx.lineTo(122, 171);
  ctx.lineTo(134, 171);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 5; i++) ctx.fillRect(113 + i * 7, 181, 3, 8);

  ctx.fillStyle = '#d2b06b';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('BLOODPIT', 128, 295);
  ctx.fillStyle = '#8e7143';
  ctx.font = '10px Courier New, monospace';
  ctx.fillText('THE SANDS REMEMBER', 128, 324);

  // Ragged bottom.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, 490);
  for (let x = 0; x <= 256; x += 18) {
    ctx.lineTo(x, 470 + rand(-13, 25));
    ctx.lineTo(x + 9, 495 + rand(-15, 8));
  }
  ctx.lineTo(256, 512);
  ctx.lineTo(0, 512);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  return textureFromCanvas(canvas);
}

function emblemTexture() {
  const { canvas, ctx } = canvas2d(512);
  ctx.translate(256, 256);
  ctx.strokeStyle = 'rgba(44, 22, 10, .7)';
  ctx.fillStyle = 'rgba(47, 20, 9, .3)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 192, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 170, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 76, 0, TAU);
  ctx.stroke();

  for (let i = 0; i < 16; i++) {
    ctx.save();
    ctx.rotate((i / 16) * TAU);
    ctx.beginPath();
    ctx.moveTo(82, 0);
    ctx.lineTo(150, -12);
    ctx.lineTo(170, 0);
    ctx.lineTo(150, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.font = 'bold 46px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(43, 19, 9, .7)';
  ctx.fillText('BLOODPIT', 0, 116);
  ctx.font = '13px Courier New, monospace';
  ctx.letterSpacing = '8px';
  ctx.fillText('NO GODS / NO MERCY', 0, -118);
  return textureFromCanvas(canvas);
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x08090f) },
      horizon: { value: new THREE.Color(0x9b3b1c) },
      bottom: { value: new THREE.Color(0x1b0905) },
      sunDir: { value: new THREE.Vector3(-0.42, 0.31, -0.85).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 bottom;
      uniform vec3 sunDir;
      void main() {
        vec3 dir = normalize(vWorld);
        float h = dir.y;
        vec3 col = mix(bottom, horizon, smoothstep(-0.18, 0.08, h));
        col = mix(col, top, smoothstep(0.08, 0.72, h));
        float sun = pow(max(dot(dir, sunDir), 0.0), 180.0);
        float glow = pow(max(dot(dir, sunDir), 0.0), 9.0);
        col += vec3(1.0, 0.42, 0.13) * sun * 1.6;
        col += vec3(0.65, 0.18, 0.05) * glow * 0.34;
        float band = smoothstep(0.24, 0.0, abs(h - 0.08)) * 0.14;
        col += vec3(0.38, 0.1, 0.04) * band;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export class Arena {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'arena';
    scene.add(this.group);
    this.cheerTime = 0;
    this.time = 0;
    this.braziers = [];
    this.banners = [];
    this.spawnPoints = [
      new THREE.Vector3(1.5, 0, -14.4),
      new THREE.Vector3(-14.4, 0, -1.6),
      new THREE.Vector3(-1.2, 0, 14.5),
      new THREE.Vector3(14.5, 0, 1.2),
    ];
    this.radius = 17.6;
    this.build();
  }

  build() {
    const scene = this.scene;
    scene.fog = new THREE.FogExp2(0x29120a, 0.014);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 20), skyMaterial());
    this.group.add(this.sky);

    const hemi = new THREE.HemisphereLight(0x8a5d3b, 0x0d0805, 0.72);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffb277, 3.4);
    sun.position.set(-22, 31, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.045;
    scene.add(sun);
    this.sun = sun;

    const rim = new THREE.DirectionalLight(0xc84324, 1.15);
    rim.position.set(18, 8, -16);
    scene.add(rim);

    const fill = new THREE.PointLight(0xff6a32, 28, 34, 1.5);
    fill.position.set(0, 7, 0);
    scene.add(fill);

    // Sand floor.
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: sandTexture(),
      color: 0xc29a63,
      roughness: 0.97,
      metalness: 0,
    });
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(18.9, 96), floorMaterial);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.group.add(this.floor);

    // Painted arena sigil.
    const emblem = new THREE.Mesh(
      new THREE.CircleGeometry(8.2, 64),
      new THREE.MeshBasicMaterial({
        map: emblemTexture(),
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
      }),
    );
    emblem.rotation.x = -Math.PI / 2;
    emblem.position.y = 0.012;
    emblem.renderOrder = 1;
    this.group.add(emblem);

    // Low inner wall.
    const stoneMap = stoneTexture();
    const stoneMaterial = new THREE.MeshStandardMaterial({
      map: stoneMap,
      color: 0x8d7254,
      roughness: 0.92,
      metalness: 0.03,
    });
    this.wallMaterial = stoneMaterial;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(19.2, 19.5, 2.7, 72, 1, true), stoneMaterial);
    wall.position.y = 1.35;
    wall.material.side = THREE.DoubleSide;
    wall.receiveShadow = true;
    this.group.add(wall);

    const wallInner = new THREE.Mesh(
      new THREE.CylinderGeometry(19.1, 19.2, 2.55, 72, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 1, side: THREE.BackSide }),
    );
    wallInner.position.y = 1.35;
    this.group.add(wallInner);

    // Stone lip and tiered stands.
    const lip = new THREE.Mesh(new THREE.TorusGeometry(19.15, 0.13, 5, 72), stoneMaterial);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 2.7;
    lip.castShadow = true;
    this.group.add(lip);

    for (let row = 0; row < 6; row++) {
      const inner = 19.1 + row * 1.25;
      const outer = inner + 1.27;
      const step = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 72),
        new THREE.MeshStandardMaterial({
          color: row % 2 ? 0x4f3926 : 0x39291d,
          roughness: 0.95,
          side: THREE.DoubleSide,
        }),
      );
      step.rotation.x = -Math.PI / 2;
      step.position.y = 2.64 + row * 0.47;
      step.receiveShadow = true;
      this.group.add(step);
    }

    // Tall rear wall to give the horizon weight.
    const backWall = new THREE.Mesh(
      new THREE.CylinderGeometry(27.2, 27.2, 5.8, 72, 1, true),
      new THREE.MeshStandardMaterial({ map: stoneMap, color: 0x4b3726, roughness: 0.96, side: THREE.BackSide }),
    );
    backWall.position.y = 5.3;
    this.group.add(backWall);

    this.buildCrowd();
    this.buildGates();
    this.buildBanners();
    this.buildBraziers();
    this.buildProps();
    this.buildDust();
  }

  buildCrowd() {
    const count = 230;
    const bodyGeo = new THREE.BoxGeometry(0.3, 0.5, 0.25);
    const headGeo = new THREE.IcosahedronGeometry(0.125, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.94, vertexColors: false });
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    const heads = new THREE.InstancedMesh(headGeo, headMat, count);
    bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    bodies.castShadow = false;
    bodies.receiveShadow = false;

    const cloth = [0x5a2c21, 0x3b2920, 0x6f3d26, 0x2d322d, 0x563a23, 0x44211c, 0x5c4b31, 0x3d2028];
    const skins = [0xb98c64, 0x9e6f4e, 0x7b5139, 0xc49a71, 0x8b5f43, 0x6e4632];
    const figures = [];
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const row = i % 6;
      const angle = (Math.floor(i / 6) / Math.ceil(count / 6)) * TAU + rand(-0.035, 0.035);
      const radius = 21.0 + row * 1.24 + rand(-0.16, 0.16);
      const y = 3.1 + row * 0.47;
      const facing = Math.atan2(-Math.cos(angle), -Math.sin(angle));
      const phase = rand(0, TAU);
      const lean = rand(-0.06, 0.08);
      figures.push({ angle, radius, y, facing, phase, row, lean, scale: rand(0.88, 1.10) });

      position.set(Math.cos(angle) * radius, y + 0.27, Math.sin(angle) * radius);
      euler.set(0, facing, lean);
      quat.setFromEuler(euler);
      scale.setScalar(figures[i].scale);
      matrix.compose(position, quat, scale);
      bodies.setMatrixAt(i, matrix);
      bodies.setColorAt(i, new THREE.Color(pick(cloth)).multiplyScalar(rand(0.66, 1.1)));

      position.y = y + 0.62;
      scale.setScalar(figures[i].scale);
      matrix.compose(position, quat, scale);
      heads.setMatrixAt(i, matrix);
      heads.setColorAt(i, new THREE.Color(pick(skins)).multiplyScalar(rand(0.7, 1.1)));
    }

    bodies.instanceColor.needsUpdate = true;
    heads.instanceColor.needsUpdate = true;
    this.group.add(bodies, heads);
    this.crowd = { bodies, heads, figures, count };
    this._crowdMatrix = matrix;
    this._crowdQuat = quat;
    this._crowdEuler = euler;
    this._crowdScale = scale;
    this._crowdPos = position;
  }

  buildGates() {
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x1b110b, roughness: 0.9 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2e2620, metalness: 0.72, roughness: 0.55 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x6d5536, roughness: 0.8, metalness: 0.08 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * TAU + Math.PI / 4;
      const gate = new THREE.Group();
      gate.position.set(Math.cos(angle) * 19.1, 0, Math.sin(angle) * 19.1);
      gate.rotation.y = -angle + Math.PI / 2;
      this.group.add(gate);

      const archMesh = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.8, 0.28), gateMat);
      archMesh.position.y = 1.9;
      gate.add(archMesh);

      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 4.4, 0.7), trimMat);
        pillar.position.set(side * 1.73, 2.2, 0.12);
        pillar.castShadow = true;
        gate.add(pillar);
        const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), new THREE.MeshStandardMaterial({ color: 0xd0bd94, roughness: 0.8 }));
        skull.position.set(side * 1.73, 4.05, 0.5);
        gate.add(skull);
      }

      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.5, 0.75), trimMat);
      lintel.position.y = 4.23;
      lintel.castShadow = true;
      gate.add(lintel);

      // Portcullis behind the dark gate mouth.
      const barGeo = new THREE.CylinderGeometry(0.026, 0.026, 3.1, 6);
      for (let b = 0; b < 8; b++) {
        const bar = new THREE.Mesh(barGeo, ironMat);
        bar.position.set(-1.15 + b * 0.33, 1.9, -0.17);
        gate.add(bar);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.05, 0.05), ironMat);
      cross.position.set(0, 1.25, -0.14);
      gate.add(cross);
      const cross2 = cross.clone();
      cross2.position.y = 2.62;
      gate.add(cross2);
    }
  }

  buildBanners() {
    const map = bannerTexture();
    const material = new THREE.MeshStandardMaterial({
      map,
      color: 0xcdb087,
      roughness: 0.98,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.08,
    });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * TAU + 0.32;
      const group = new THREE.Group();
      group.position.set(Math.cos(angle) * 18.7, 0, Math.sin(angle) * 18.7);
      group.rotation.y = -angle + Math.PI;

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 4.8, 6),
        new THREE.MeshStandardMaterial({ color: 0x241710, roughness: 0.7 }),
      );
      pole.position.y = 2.45;
      group.add(pole);

      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 3.3), material);
      banner.position.set(0.86, 2.72, 0);
      banner.rotation.z = -0.025;
      group.add(banner);
      this.banners.push({ mesh: banner, base: -0.025, phase: rand(0, TAU) });
      this.group.add(group);
    }
  }

  buildBraziers() {
    const stone = new THREE.MeshStandardMaterial({ color: 0x3c2b1d, roughness: 0.96 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x241b14, metalness: 0.65, roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * TAU;
      const x = Math.cos(angle) * 13.4;
      const z = Math.sin(angle) * 13.4;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.48, 1.5, 7), stone);
      base.position.set(x, 0.75, z);
      base.castShadow = true;
      this.group.add(base);

      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.33, 0.35, 9, 1, true), iron);
      bowl.position.set(x, 1.63, z);
      this.group.add(bowl);

      const coal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.06, 9),
        new THREE.MeshBasicMaterial({ color: 0xff5b1e }),
      );
      coal.position.set(x, 1.67, z);
      this.group.add(coal);

      const light = new THREE.PointLight(0xff5a24, 22, 13, 1.8);
      light.position.set(x, 2.2, z);
      this.group.add(light);

      const count = 26;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const particles = [];
      for (let p = 0; p < count; p++) {
        particles.push(this.resetFlameParticle([], false));
        positions[p * 3] = x;
        positions[p * 3 + 1] = 1.9;
        positions[p * 3 + 2] = z;
        colors[p * 3] = 1;
        colors[p * 3 + 1] = 0.34;
        colors[p * 3 + 2] = 0.08;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.22,
        map: radialTexture(32, 'rgba(255,235,190,1)', 'rgba(255,90,20,0)'),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(geo, mat);
      points.position.set(0, 0, 0);
      this.group.add(points);
      this.braziers.push({ x, z, points, particles, light, baseIntensity: 22 });
    }
  }

  resetFlameParticle(target, randomize = true) {
    target[0] = rand(-0.34, 0.34);
    target[1] = randomize ? rand(0, 1.5) : rand(0, 0.4);
    target[2] = rand(-0.34, 0.34);
    target[3] = rand(0.7, 1.8);
    target[4] = rand(0.35, 0.75);
    return target;
  }

  buildProps() {
    const boneMat = new THREE.MeshStandardMaterial({ color: 0x8f7c5c, roughness: 0.86 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x35302a, metalness: 0.55, roughness: 0.55 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4b321f, roughness: 0.9 });
    const props = new THREE.Group();

    // Broken spears near the wall.
    for (let i = 0; i < 9; i++) {
      const angle = rand(0, TAU);
      const radius = rand(15.2, 18.1);
      const group = new THREE.Group();
      group.position.set(Math.cos(angle) * radius, 0.06, Math.sin(angle) * radius);
      group.rotation.set(rand(-0.1, 0.1), rand(0, TAU), Math.PI / 2 + rand(-0.15, 0.15));
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, rand(1.8, 3.1), 5), woodMat);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), ironMat);
      tip.position.y = 1.55;
      group.add(shaft, tip);
      props.add(group);
    }

    // Skulls and ribs half-buried in the sand.
    for (let i = 0; i < 16; i++) {
      const angle = rand(0, TAU);
      const radius = rand(8.4, 17.4);
      const skull = new THREE.Group();
      skull.position.set(Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius);
      skull.rotation.set(rand(-0.2, 0.2), rand(0, TAU), rand(-0.3, 0.3));
      const cranium = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.1, 0.15), 1), boneMat);
      cranium.scale.set(1, 0.86, 1.12);
      skull.add(cranium);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045, 0.11), boneMat);
      jaw.position.set(0, -0.11, 0.04);
      skull.add(jaw);
      props.add(skull);
    }

    // Discarded helms and a fallen shield.
    for (let i = 0; i < 4; i++) {
      const angle = rand(0, TAU);
      const radius = rand(12.5, 17.8);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 5, 0, TAU, 0, Math.PI / 2), ironMat);
      helm.position.set(Math.cos(angle) * radius, 0.05, Math.sin(angle) * radius);
      helm.rotation.set(Math.PI, rand(0, TAU), rand(-0.2, 0.2));
      props.add(helm);
    }
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 12), ironMat);
    shield.position.set(-7.5, 0.05, 9.5);
    shield.rotation.set(Math.PI / 2, 0, 0.6);
    props.add(shield);

    this.group.add(props);
  }

  buildDust() {
    const count = 150;
    const positions = new Float32Array(count * 3);
    const seeds = [];
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU);
      const radius = Math.sqrt(Math.random()) * 18;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = rand(0.3, 6.5);
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      seeds.push({ speed: rand(0.04, 0.16), phase: rand(0, TAU), drift: rand(0.2, 0.8) });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.035,
      color: 0xffc58a,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: radialTexture(16, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
    });
    this.dust = new THREE.Points(geo, mat);
    this.dustSeeds = seeds;
    this.group.add(this.dust);
  }

  triggerCheer() {
    this.cheerTime = 3.8;
    for (const brazier of this.braziers) {
      brazier.light.intensity = brazier.baseIntensity * 1.65;
    }
  }

  update(dt, time, menuMode = false) {
    this.time = time;
    const cheer = Math.max(0, this.cheerTime);
    this.cheerTime = Math.max(0, this.cheerTime - dt);
    const cheerStrength = clamp(cheer / 3.8, 0, 1);
    const cheerActive = cheer > 0;

    // Crowd idle and celebration bounce.
    const { bodies, heads, figures, count } = this.crowd;
    const m = this._crowdMatrix;
    const q = this._crowdQuat;
    const e = this._crowdEuler;
    const s = this._crowdScale;
    const p = this._crowdPos;

    if (cheerActive || menuMode || time % 0.1 < dt) {
      for (let i = 0; i < count; i++) {
        const figure = figures[i];
        const bounce = cheerActive
          ? Math.abs(Math.sin(time * 8.2 + figure.phase)) * 0.2 * cheerStrength
          : Math.sin(time * 0.8 + figure.phase) * 0.012;
        const sway = cheerActive ? Math.sin(time * 5.2 + figure.phase) * 0.12 * cheerStrength : 0;
        p.set(Math.cos(figure.angle) * figure.radius, figure.y + 0.27 + bounce, Math.sin(figure.angle) * figure.radius);
        e.set(0, figure.facing + sway, figure.lean + sway * 0.4);
        q.setFromEuler(e);
        s.setScalar(figure.scale * (cheerActive ? 1 + bounce * 0.22 : 1));
        m.compose(p, q, s);
        bodies.setMatrixAt(i, m);
        p.y = figure.y + 0.62 + bounce * 1.1;
        m.compose(p, q, s);
        heads.setMatrixAt(i, m);
      }
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    }

    // Braziers.
    for (const brazier of this.braziers) {
      const positions = brazier.points.geometry.attributes.position.array;
      brazier.particles.forEach((particle, index) => {
        particle[1] += dt * particle[3];
        particle[0] += dt * Math.sin(time * 2 + index) * 0.09;
        particle[2] += dt * Math.cos(time * 1.6 + index * 0.8) * 0.09;
        if (particle[1] > 1.42) {
          this.resetFlameParticle(particle, false);
        }
        positions[index * 3] = brazier.x + particle[0];
        positions[index * 3 + 1] = 1.86 + particle[1];
        positions[index * 3 + 2] = brazier.z + particle[2];
      });
      brazier.points.geometry.attributes.position.needsUpdate = true;
      brazier.points.material.opacity = 0.72 + Math.sin(time * 9 + brazier.x) * 0.16;
      brazier.light.intensity = brazier.baseIntensity * (0.82 + Math.sin(time * 12 + brazier.z) * 0.18 + (cheerActive ? 0.55 * cheerStrength : 0));
    }

    // Dust drift.
    if (this.dust) {
      const positions = this.dust.geometry.attributes.position.array;
      for (let i = 0; i < this.dustSeeds.length; i++) {
        const seed = this.dustSeeds[i];
        positions[i * 3] += Math.sin(time * 0.3 + seed.phase) * dt * 0.12;
        positions[i * 3 + 1] += dt * seed.speed * 0.12;
        positions[i * 3 + 2] += Math.cos(time * 0.25 + seed.phase) * dt * 0.1;
        if (positions[i * 3 + 1] > 7) positions[i * 3 + 1] = 0.3;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }

    // Banners shiver.
    for (const banner of this.banners) {
      banner.mesh.rotation.z = banner.base + Math.sin(time * 0.8 + banner.phase) * 0.019;
      banner.mesh.rotation.y = Math.sin(time * 0.5 + banner.phase) * 0.035;
    }
  }

  reset() {
    this.cheerTime = 0;
  }
}
