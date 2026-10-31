import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Arena } from './arena.js';
import { Effects } from './effects.js';
import { Enemy, ENEMY_TYPES, waveEnemyTypes } from './enemy.js';
import { Player } from './player.js';
import { SoundEngine } from './audio.js';
import {
  clamp,
  damp,
  rand,
  roman,
  pick,
  TAU,
  disposeObject,
} from './utils.js';

const $ = (id) => document.getElementById(id);

const WAVE_NAMES = [
  'THE FIRST SPILL',
  'BLOOD IN THE DUST',
  'THE CROWD’S HUNGER',
  'TIN AND BONE',
  'THE BUTCHER’S CHOIR',
  'NO MERCY LEFT',
  'THE RED MIST',
  'SOMETHING WORSE',
  'THE SAND REMEMBERS',
  'LAST OF THE DAMNED',
];

const WAVE_SUBS = [
  'THE GATES OPEN',
  'THEY HAVE SEEN YOU',
  'SMELL THE FEAR',
  'STEEL FOR THE BEASTS',
  'THE CROWD IS STANDING',
  'THEY WANT A SHOW',
  'NO GODS. NO MERCY.',
  'THE ARENA FEEDS',
  'DO NOT KNEEL',
  'SURVIVE THE SAND',
];

const refs = {
  canvas: $('game'),
  boot: $('boot'),
  menu: $('menu'),
  hud: $('hud'),
  waveNum: $('wave-num'),
  waveName: $('wave-name'),
  favorNum: $('favor-num'),
  favorFill: $('favor-fill'),
  crowdCheer: $('crowd-cheer'),
  killNum: $('kill-num'),
  scoreNum: $('score-num'),
  enemyPips: $('enemy-pips'),
  killFeed: $('kill-feed'),
  crosshair: $('crosshair'),
  healthNum: $('health-num'),
  healthFill: $('health-fill'),
  statusText: $('status-text'),
  dodgeStatus: $('dodge-status'),
  weaponGlyph: $('weapon-glyph'),
  weaponName: $('weapon-name'),
  weaponMode: $('weapon-mode'),
  comboNum: $('combo-num'),
  comboLabel: $('combo-label'),
  comboFill: $('combo-fill'),
  hintStrip: $('hint-strip'),
  waveBanner: $('wave-banner'),
  waveBannerKicker: $('wave-banner-kicker'),
  waveBannerTitle: $('wave-banner-title'),
  waveBannerSub: $('wave-banner-sub'),
  intermission: $('intermission'),
  intermissionCopy: $('intermission-copy'),
  intermissionTimer: $('intermission-timer'),
  pause: $('pause'),
  death: $('death'),
  deathCopy: $('death-copy'),
  deathWave: $('death-wave'),
  deathKills: $('death-kills'),
  deathScore: $('death-score'),
  damageFlash: $('damage-flash'),
  bloodDrops: $('blood-drops'),
  touchControls: $('touch-controls'),
  joystick: $('joystick'),
  joystickKnob: $('joystick-knob'),
  touchAttack: $('touch-attack'),
  touchHeavy: $('touch-heavy'),
  touchDodge: $('touch-dodge'),
  toast: $('toast'),
  fps: $('fps'),
};

let renderer;
let scene;
let camera;
let arena;
let effects;
let player;
let audio;
let clock;

const state = {
  mode: 'boot',
  wave: 0,
  kills: 0,
  score: 0,
  favor: 0,
  waveKills: 0,
  waveTotal: 0,
  combo: 1,
  comboTimer: 0,
  crowdCheerTimer: 0,
  waveClearTimer: 0,
  intermissionTimer: 0,
  selectedWeapon: 'sword',
  menuTime: 0,
  fpsTime: 0,
  fpsFrames: 0,
  isTouch: false,
  locked: false,
  started: false,
};

const enemies = [];
const spawnQueue = [];
const keys = new Set();
const input = { forward: 0, right: 0 };
const touchInput = { forward: 0, right: 0, activeId: null, lookId: null, lookX: 0, lookY: 0 };
let bannerTimeout = null;
let damageTimeout = null;
let toastTimeout = null;
let uiRefresh = 0;
let audioMuted = false;
let softwareRenderer = false;

function detectSoftwareRenderer() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererName = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : '';
    const found = /swiftshader|llvmpipe|software|mesa offscreen/i.test(String(rendererName));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return found;
  } catch {
    return false;
  }
}

function pixelRatioForScreen() {
  if (softwareRenderer) return 0.64;
  return Math.min(window.devicePixelRatio || 1, 1.5);
}

function isCoarsePointer() {
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

function initThree() {
  softwareRenderer = detectSoftwareRenderer();
  renderer = new THREE.WebGLRenderer({
    canvas: refs.canvas,
    antialias: !softwareRenderer,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(pixelRatioForScreen());
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (softwareRenderer) {
    renderer.shadowMap.type = THREE.BasicShadowMap;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x170b06);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 150);
  camera.position.set(8, 3.3, 8);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // A neutral PBR environment is enough to give the steel and bronze specular life.
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    scene.environment = pmrem.fromScene(envScene, 0.05).texture;
    scene.environmentIntensity = 0.3;
    envScene.dispose?.();
  } catch {
    // Environment maps are a polish pass, not a hard dependency.
  }

  arena = new Arena(scene, renderer);
  effects = new Effects(scene, arena);
  audio = new SoundEngine();
  player = new Player(camera, scene, effects, audio, {
    getEnemies: () => enemies,
    onHit: handlePlayerHit,
    onMiss: handleMiss,
    onDamage: handlePlayerDamage,
    onDeath: handlePlayerDeath,
    onDodge: () => {},
    onDodgeStart: () => {},
    onWeaponChange: updateWeaponHud,
  });
  player.viewmodel.visible = false;

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') pauseGame();
  });
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatioForScreen());
  renderer.setSize(width, height, false);
}

function bindUI() {
  for (const card of document.querySelectorAll('.weapon-card')) {
    card.addEventListener('click', () => {
      selectWeapon(card.dataset.weapon);
      audio.init();
      audio.ui();
    });
  }
  for (const card of document.querySelectorAll('.mini-weapon')) {
    card.addEventListener('click', () => {
      if (state.mode !== 'intermission') return;
      selectWeapon(card.dataset.weapon);
      player.setWeapon(state.selectedWeapon);
      audio.ui();
    });
  }
  $('play-btn').addEventListener('click', () => startRun());
  $('restart-btn').addEventListener('click', () => startRun(true));
  $('resume-btn').addEventListener('click', () => resumeGame());
  $('quit-btn').addEventListener('click', () => toMenu());

  refs.canvas.addEventListener('mousedown', onMouseDown);
  refs.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  refs.canvas.addEventListener('click', () => {
    if (state.mode === 'playing' && !state.isTouch && !state.locked) {
      lockPointer();
    }
  });
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === refs.canvas;
    if (state.locked) refs.hintStrip.classList.add('is-hidden');
  });

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', (event) => keys.delete(event.code));

  refs.touchAttack.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    actionAttack(false);
  });
  refs.touchHeavy.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    actionAttack(true);
  });
  refs.touchDodge.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    player.dodge({ forward: touchInput.forward || input.forward, right: touchInput.right || input.right });
  });
  bindTouchControls();

  window.addEventListener('blur', () => {
    keys.clear();
  });
}

function selectWeapon(weapon) {
  if (!['sword', 'hammer'].includes(weapon)) return;
  state.selectedWeapon = weapon;
  for (const card of document.querySelectorAll('.weapon-card')) {
    const selected = card.dataset.weapon === weapon;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-checked', String(selected));
  }
  for (const card of document.querySelectorAll('.mini-weapon')) {
    card.classList.toggle('is-selected', card.dataset.weapon === weapon);
  }
}

function startRun(restart = false) {
  audio.init();
  audio.startAmbient();
  if (restart) {
    state.kills = 0;
    state.score = 0;
    state.favor = 0;
    state.combo = 1;
    state.wave = 0;
    state.waveClearTimer = 0;
    state.intermissionTimer = 0;
    clearAllEnemies();
    effects.clearWave();
    refs.death.classList.add('is-hidden');
    refs.intermission.classList.add('is-hidden');
  }
  state.started = true;
  state.mode = 'playing';
  refs.boot.classList.add('is-gone');
  refs.menu.classList.add('is-gone');
  refs.hud.classList.remove('is-hidden');
  refs.pause.classList.add('is-hidden');
  refs.death.classList.add('is-hidden');
  refs.intermission.classList.add('is-hidden');
  player.reset(state.selectedWeapon);
  player.viewmodel.visible = true;
  camera.fov = 74;
  camera.updateProjectionMatrix();
  player.baseFov = 74;
  selectWeapon(state.selectedWeapon);
  state.wave = 0;
  startWave();
  if (!state.isTouch) {
    window.setTimeout(lockPointer, 40);
    refs.hintStrip.classList.remove('is-hidden');
  }
  updateHud(true);
}

function lockPointer() {
  if (state.isTouch || !refs.canvas.requestPointerLock) return;
  try {
    const promise = refs.canvas.requestPointerLock();
    promise?.catch?.(() => {});
  } catch {
    // The pointer can be locked only from a user gesture; the game still runs.
  }
}

function startWave() {
  if (state.mode === 'dead') return;
  state.mode = 'playing';
  state.wave += 1;
  state.waveKills = 0;
  state.waveClearTimer = 0;
  state.intermissionTimer = 0;
  refs.intermission.classList.add('is-hidden');

  // The arena is wiped clean between waves, so blood and corpses never stack forever.
  effects.clearWave();
  clearAllEnemies();
  spawnQueue.length = 0;

  const types = waveEnemyTypes(state.wave);
  state.waveTotal = types.length;
  const basePoints = [
    new THREE.Vector3(1.2, 0, 3.2),
    new THREE.Vector3(-4.4, 0, 2.2),
    new THREE.Vector3(4.8, 0, -1.5),
    new THREE.Vector3(-1.3, 0, -4.6),
    new THREE.Vector3(6.4, 0, 5.4),
  ];
  types.forEach((type, index) => {
    const angle = (index / types.length) * TAU + rand(-0.25, 0.25);
    const base = basePoints[index % basePoints.length].clone();
    if (index >= basePoints.length) {
      base.set(Math.cos(angle) * rand(7, 11.5), 0, Math.sin(angle) * rand(7, 11.5));
    }
    spawnQueue.push({
      type,
      position: base,
      delay: index === 0 ? 0.04 : 0.3 + index * 0.34,
    });
  });

  showWaveBanner(state.wave);
  updateWavePips();
  updateWeaponHud();
  updateHud(true);
  audio.gate();
  if (state.wave > 1) {
    player.heal(12);
  }
  setTimeout(() => {
    if (state.mode === 'playing') audio.gong();
  }, 280);
}

function showWaveBanner(wave) {
  const name = WAVE_NAMES[(wave - 1) % WAVE_NAMES.length];
  const sub = WAVE_SUBS[(wave - 1) % WAVE_SUBS.length];
  refs.waveBannerKicker.textContent = `WAVE ${roman(wave)}`;
  refs.waveBannerTitle.textContent = name;
  refs.waveBannerSub.textContent = sub;
  refs.waveBanner.classList.remove('is-hidden');
  if (bannerTimeout) clearTimeout(bannerTimeout);
  const duration = wave === 1 ? 780 : 1450;
  bannerTimeout = setTimeout(() => refs.waveBanner.classList.add('is-hidden'), duration);
}

function spawnEnemy(typeKey, position) {
  const config = ENEMY_TYPES[typeKey] || ENEMY_TYPES.sandsman;
  const enemy = new Enemy(scene, effects, audio, config, position, player, {
    onKill: handleEnemyKill,
    onGore: handleGore,
  });
  enemies.push(enemy);
  effects.emit(
    new THREE.Vector3(position.x, 0.15, position.z),
    new THREE.Vector3(0, 0.8, 0),
    18,
    { speed: 2.4, spread: 0.9, life: 0.7, gravity: 1.5, colors: [[0.4, 0.3, 0.2], [0.24, 0.17, 0.11]] },
  );
}

function updateWavePips() {
  refs.enemyPips.innerHTML = '';
  for (let i = 0; i < state.waveTotal; i++) {
    const pip = document.createElement('i');
    if (i < state.waveKills) pip.classList.add('is-dead');
    refs.enemyPips.appendChild(pip);
  }
}

function handleEnemyKill(enemy, method, direction) {
  if (enemy.counted) return;
  enemy.counted = true;
  state.kills += 1;
  state.waveKills += 1;
  const goreBonus = method.includes('SPLIT') || method.includes('TWO') || method.includes('SKULL') ? 75 : 0;
  state.score += 120 + state.wave * 30 + goreBonus;
  state.favor = clamp(state.favor + 18, 0, 100);
  state.combo = clamp(state.combo + 1, 1, 9);
  state.comboTimer = 4.2;
  player.heal(5);
  audio.crowdCheer(1.0);
  arena.triggerCheer();
  state.crowdCheerTimer = 2.2;
  refs.crowdCheer.classList.add('is-on');
  addKillFeed(enemy, method);
  updateWavePips();
  updateHud(true);
  // A wet red badge on the sand.
  effects.addBloodDecal(enemy.root.position.clone(), direction || new THREE.Vector3(0, 0, 1), 1.25);
}

function handleGore(enemy, label) {
  if (enemy.dead) return;
  state.score += 25;
  state.favor = clamp(state.favor + 3, 0, 100);
  if (label.includes('SEVERED') || label.includes('FRACTURED') || label.includes('JAW')) {
    state.combo = clamp(state.combo + 1, 1, 9);
    state.comboTimer = 4.2;
    // Crowd appreciation for a good piece of butchery.
    if (Math.random() > 0.55) {
      audio.crowdCheer(0.45);
      arena.triggerCheer();
      state.crowdCheerTimer = 1.1;
      refs.crowdCheer.classList.add('is-on');
    }
  }
  updateHud(true);
}

function handlePlayerHit(result, enemy, part, heavy) {
  if (result?.ignored) return;
  if (result?.blocked) {
    showToast(result.label === 'SHIELD HOLDS' ? 'THE SHIELD HOLDS' : 'STEEL ON STEEL');
    return;
  }
  refs.crosshair.classList.remove('is-hit');
  void refs.crosshair.offsetWidth;
  refs.crosshair.classList.add('is-hit');
  if (result?.gore) {
    state.score += 20;
    state.favor = clamp(state.favor + 4, 0, 100);
    updateHud(true);
  }
  if (state.comboTimer <= 0) {
    state.combo = Math.max(1, state.combo);
  }
}

function handleMiss() {
  // The swing audio and weapon motion carry the feedback.
}

function handlePlayerDamage(amount, source) {
  refs.damageFlash.classList.add('is-hit');
  refs.bloodDrops.classList.add('is-hit');
  if (damageTimeout) clearTimeout(damageTimeout);
  damageTimeout = setTimeout(() => {
    refs.damageFlash.classList.remove('is-hit');
    refs.bloodDrops.classList.remove('is-hit');
  }, 180);
  if (source) {
    const dx = source.root.position.x - player.position.x;
    const dz = source.root.position.z - player.position.z;
    const length = Math.hypot(dx, dz) || 1;
    player.position.x -= (dx / length) * 0.24;
    player.position.z -= (dz / length) * 0.24;
  }
  showToast(amount > 18 ? 'BONE-RATTLING HIT' : 'FLESH WOUND');
  updateHud(true);
}

function handlePlayerDeath() {
  if (state.mode === 'dead') return;
  state.mode = 'dead';
  refs.hud.classList.add('is-hidden');
  refs.death.classList.remove('is-hidden');
  refs.deathWave.textContent = roman(state.wave);
  refs.deathKills.textContent = String(state.kills);
  refs.deathScore.textContent = String(state.score);
  refs.deathCopy.textContent = pick([
    'Your blood joins the sand. The arena always finds another fool.',
    'The crowd got what it paid for. They are already chanting another name.',
    'You gave them a show. Now you are part of the floor.',
    'The sand drinks deep. Someone else will swing your blade.',
  ]);
  audio.deathCall();
  if (document.pointerLockElement) document.exitPointerLock?.();
  refs.touchControls.classList.add('is-hidden');
  state.locked = false;
}

function addKillFeed(enemy, method) {
  const row = document.createElement('div');
  row.innerHTML = `<b>${enemy.name}</b> <em>//</em> ${method}`;
  refs.killFeed.appendChild(row);
  setTimeout(() => row.classList.add('is-out'), 3300);
  setTimeout(() => row.remove(), 3900);
  while (refs.killFeed.children.length > 5) refs.killFeed.firstChild.remove();
}

function showToast(text) {
  refs.toast.textContent = text;
  refs.toast.classList.add('is-on');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => refs.toast.classList.remove('is-on'), 1450);
}

function updateWeaponHud() {
  if (!player) return;
  const sword = player.weapon === 'sword';
  refs.weaponName.textContent = sword ? 'GLADIUS' : 'MAUL OF CARCASSA';
  refs.weaponGlyph.textContent = sword ? '†' : '⚒';
  refs.weaponMode.textContent = sword ? 'LMB SEVER // RMB CLEAVE' : 'LMB CRUSH // RMB SLAM';
  refs.statusText.textContent = sword ? 'THE SURGEON' : 'THE BUTCHER';
}

function updateHud(force = false) {
  if (!player) return;
  if (!force && state.mode === 'menu') return;
  const healthPct = clamp((player.health / player.maxHealth) * 100, 0, 100);
  refs.healthFill.style.width = `${healthPct}%`;
  refs.healthFill.style.background = healthPct < 30
    ? 'linear-gradient(90deg, #4e0608, #a31c16 60%, #d4572b)'
    : 'linear-gradient(90deg, #6e0d11, #c72a1d 65%, #e8a44d)';
  refs.healthNum.textContent = String(Math.ceil(player.health));
  refs.waveNum.textContent = roman(state.wave);
  refs.waveName.textContent = WAVE_NAMES[(state.wave - 1) % WAVE_NAMES.length] || 'THE SAND REMEMBERS';
  refs.killNum.textContent = String(state.kills).padStart(2, '0');
  refs.scoreNum.textContent = String(state.score).padStart(4, '0');
  refs.favorNum.textContent = String(Math.round(state.favor));
  refs.favorFill.style.width = `${state.favor}%`;
  refs.comboNum.textContent = `x${state.combo}`;
  refs.comboLabel.textContent = state.combo >= 5 ? 'CARNAGE' : state.combo >= 3 ? 'BLOOD WORK' : 'CLEAN WORK';
  refs.comboFill.style.width = `${clamp((state.comboTimer / 4.2) * 100, 0, 100)}%`;

  if (player.dodgeCooldown > 0) {
    refs.dodgeStatus.textContent = `DODGE ${player.dodgeCooldown.toFixed(1)}s`;
    refs.dodgeStatus.style.color = '#8a6654';
  } else {
    refs.dodgeStatus.textContent = 'DODGE READY';
    refs.dodgeStatus.style.color = '#8c9a78';
  }
  refs.crosshair.classList.toggle('is-target', Boolean(player.aimingAt) && state.mode === 'playing');
}

function showIntermission() {
  if (state.mode !== 'playing') return;
  state.mode = 'intermission';
  state.intermissionTimer = 5.5;
  state.score += 220 + state.wave * 80;
  state.favor = clamp(state.favor + 10, 0, 100);
  player.heal(20);
  audio.crowdCheer(1.15);
  arena.triggerCheer();
  state.crowdCheerTimer = 2.4;
  refs.crowdCheer.classList.add('is-on');
  refs.intermission.classList.remove('is-hidden');
  refs.intermissionCopy.textContent = pick([
    'The crowd wants more. Give them something to remember.',
    'The sand is wet. Choose what makes the next wound.',
    'They are still cheering your name. Do not disappoint them.',
    'A moment to breathe. A moment to choose your butchery.',
  ]);
  for (const card of document.querySelectorAll('.mini-weapon')) {
    card.classList.toggle('is-selected', card.dataset.weapon === state.selectedWeapon);
  }
  if (state.isTouch) {
    refs.touchControls.classList.add('is-hidden');
  }
  updateHud(true);
}

function nextWaveFromIntermission() {
  if (state.mode !== 'intermission') return;
  refs.intermission.classList.add('is-hidden');
  startWave();
  if (state.isTouch) refs.touchControls.classList.remove('is-hidden');
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  refs.pause.classList.remove('is-hidden');
  if (document.pointerLockElement) document.exitPointerLock?.();
  refs.touchControls.classList.add('is-hidden');
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  refs.pause.classList.add('is-hidden');
  if (state.isTouch) refs.touchControls.classList.remove('is-hidden');
  else lockPointer();
}

function toMenu() {
  state.mode = 'menu';
  state.started = false;
  state.wave = 0;
  clearAllEnemies();
  spawnQueue.length = 0;
  effects.clearWave();
  refs.pause.classList.add('is-hidden');
  refs.death.classList.add('is-hidden');
  refs.intermission.classList.add('is-hidden');
  refs.waveBanner.classList.add('is-hidden');
  refs.hud.classList.add('is-hidden');
  refs.menu.classList.remove('is-gone');
  refs.boot.classList.add('is-gone');
  player.viewmodel.visible = false;
  if (document.pointerLockElement) document.exitPointerLock?.();
  refs.touchControls.classList.add('is-hidden');
  state.selectedWeapon = player.weapon;
  selectWeapon(state.selectedWeapon);
}

function clearAllEnemies() {
  for (const enemy of enemies) enemy.dispose();
  enemies.length = 0;
}

function onMouseDown(event) {
  if (state.mode !== 'playing') return;
  if (!state.isTouch && !state.locked) {
    lockPointer();
    return;
  }
  event.preventDefault();
  if (event.button === 0) actionAttack(false);
  else if (event.button === 2) actionAttack(true);
}

function actionAttack(heavy) {
  if (state.mode !== 'playing') return;
  player.queueAttack(heavy);
}

function onMouseMove(event) {
  if (state.mode !== 'playing' || state.isTouch || !state.locked) return;
  player.setLook(event.movementX || 0, event.movementY || 0, 0.0022);
}

function onKeyDown(event) {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    if (state.mode === 'playing') event.preventDefault();
  }
  keys.add(event.code);

  if (event.code === 'Escape') {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
    return;
  }
  if (event.code === 'KeyM') {
    audio.init();
    audioMuted = audio.toggleMute();
    showToast(audioMuted ? 'ARENA SILENCED' : 'ARENA AUDIBLE');
    return;
  }
  if (state.mode === 'dead' && event.code === 'Enter') {
    startRun(true);
    return;
  }
  if (state.mode === 'intermission' && (event.code === 'Digit1' || event.code === 'Digit2')) {
    selectWeapon(event.code === 'Digit1' ? 'sword' : 'hammer');
    player.setWeapon(state.selectedWeapon);
    audio.ui();
    return;
  }
  if (state.mode === 'playing' && event.code === 'Space') {
    player.dodge({ forward: input.forward, right: input.right });
  }
}

function bindTouchControls() {
  const joystick = refs.joystick;
  joystick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    touchInput.activeId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  joystick.addEventListener('pointermove', (event) => {
    if (touchInput.activeId !== event.pointerId) return;
    event.preventDefault();
    updateJoystick(event);
  });
  const release = (event) => {
    if (touchInput.activeId !== event.pointerId) return;
    touchInput.activeId = null;
    touchInput.forward = 0;
    touchInput.right = 0;
    refs.joystickKnob.style.transform = 'translate(0px, 0px)';
  };
  joystick.addEventListener('pointerup', release);
  joystick.addEventListener('pointercancel', release);

  refs.canvas.addEventListener('pointerdown', (event) => {
    if (!state.isTouch || state.mode !== 'playing' || event.pointerType === 'mouse') return;
    touchInput.lookId = event.pointerId;
    touchInput.lookX = event.clientX;
    touchInput.lookY = event.clientY;
    refs.canvas.setPointerCapture(event.pointerId);
  });
  refs.canvas.addEventListener('pointermove', (event) => {
    if (!state.isTouch || state.mode !== 'playing' || event.pointerId !== touchInput.lookId) return;
    const dx = event.clientX - touchInput.lookX;
    const dy = event.clientY - touchInput.lookY;
    touchInput.lookX = event.clientX;
    touchInput.lookY = event.clientY;
    player.setLook(dx, dy, 0.0045);
  });
  const endLook = (event) => {
    if (touchInput.lookId === event.pointerId) touchInput.lookId = null;
  };
  refs.canvas.addEventListener('pointerup', endLook);
  refs.canvas.addEventListener('pointercancel', endLook);

  for (const button of [refs.touchAttack, refs.touchHeavy, refs.touchDodge]) {
    button.addEventListener('pointerdown', () => button.classList.add('is-down'));
    button.addEventListener('pointerup', () => button.classList.remove('is-down'));
    button.addEventListener('pointercancel', () => button.classList.remove('is-down'));
    button.addEventListener('pointerleave', () => button.classList.remove('is-down'));
  }
}

function updateJoystick(event) {
  const rect = refs.joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const radius = rect.width * 0.33;
  const length = Math.hypot(dx, dy);
  const clamped = Math.min(length, radius);
  const angle = Math.atan2(dy, dx);
  const nx = Math.cos(angle) * clamped / radius;
  const ny = Math.sin(angle) * clamped / radius;
  touchInput.right = nx;
  touchInput.forward = -ny;
  refs.joystickKnob.style.transform = `translate(${Math.cos(angle) * clamped}px, ${Math.sin(angle) * clamped}px)`;
}

function updateInput() {
  let forward = 0;
  let right = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) right += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) right -= 1;
  input.forward = forward;
  input.right = right;
  if (state.isTouch) {
    input.forward = touchInput.forward;
    input.right = touchInput.right;
  }
}

function updateSpawns(dt) {
  for (let i = spawnQueue.length - 1; i >= 0; i--) {
    const item = spawnQueue[i];
    item.delay -= dt;
    if (item.delay <= 0) {
      spawnEnemy(item.type, item.position);
      spawnQueue.splice(i, 1);
    }
  }
}

function updatePlaying(dt, time) {
  updateInput();
  player.update(dt, input, time);
  updateSpawns(dt);

  for (const enemy of enemies) {
    enemy.update(dt, time, enemies);
  }

  // Combo decays if the player stops spilling blood.
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 1;
  }

  // Clear timing.
  const alive = enemies.some((enemy) => !enemy.dead);
  if (!alive && spawnQueue.length === 0) {
    if (state.waveClearTimer <= 0) {
      state.waveClearTimer = 1.15;
    } else {
      state.waveClearTimer -= dt;
      if (state.waveClearTimer <= 0) {
        state.waveClearTimer = 0;
        showIntermission();
      }
    }
  } else {
    state.waveClearTimer = 0;
  }

  if (state.crowdCheerTimer > 0) {
    state.crowdCheerTimer -= dt;
    if (state.crowdCheerTimer <= 0) refs.crowdCheer.classList.remove('is-on');
  }

  updateHud(false);
}

function updateIntermission(dt, time) {
  player.update(dt, { forward: 0, right: 0 }, time);
  if (state.intermissionTimer > 0) {
    state.intermissionTimer -= dt;
    refs.intermissionTimer.textContent = String(Math.max(0, Math.ceil(state.intermissionTimer))).padStart(2, '0');
    if (state.intermissionTimer <= 0) nextWaveFromIntermission();
  }
  if (state.crowdCheerTimer > 0) {
    state.crowdCheerTimer -= dt;
    if (state.crowdCheerTimer <= 0) refs.crowdCheer.classList.remove('is-on');
  }
}

function updateMenu(dt, time) {
  state.menuTime += dt;
  const angle = time * 0.055 + 0.6;
  const radius = 12.4;
  camera.position.set(Math.cos(angle) * radius, 3.25 + Math.sin(time * 0.19) * 0.18, Math.sin(angle) * radius);
  camera.lookAt(0, 1.45, 0);
  if (camera.fov !== 60) {
    camera.fov = 60;
    camera.updateProjectionMatrix();
  }
}

function updateDead(dt, time) {
  for (const enemy of enemies) {
    enemy.update(dt, time, enemies);
  }
  if (state.crowdCheerTimer > 0) {
    state.crowdCheerTimer -= dt;
    if (state.crowdCheerTimer <= 0) refs.crowdCheer.classList.remove('is-on');
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (state.mode === 'boot') {
    arena.update(dt, time, true);
    effects.update(dt);
  } else if (state.mode === 'menu') {
    updateMenu(dt, time);
    arena.update(dt, time, true);
    effects.update(dt);
  } else if (state.mode === 'playing') {
    updatePlaying(dt, time);
    arena.update(dt, time, false);
    effects.update(dt);
  } else if (state.mode === 'intermission') {
    updateIntermission(dt, time);
    arena.update(dt, time, false);
    effects.update(dt);
  } else if (state.mode === 'paused') {
    arena.update(0, time, false);
  } else if (state.mode === 'dead') {
    updateDead(dt, time);
    arena.update(dt, time, false);
    effects.update(dt);
  }

  if (state.mode === 'playing' || state.mode === 'intermission') {
    state.fpsFrames += 1;
    state.fpsTime += dt;
    if (state.fpsTime > 1) {
      refs.fps.textContent = `${Math.round(state.fpsFrames / state.fpsTime)} FPS`;
      state.fpsFrames = 0;
      state.fpsTime = 0;
    }
  }

  renderer.render(scene, camera);
}

function boot() {
  state.isTouch = isCoarsePointer();
  if (state.isTouch) {
    document.body.classList.add('is-touch');
    refs.touchControls.classList.add('is-hidden');
  }
  initThree();
  bindUI();
  selectWeapon('sword');
  state.mode = 'menu';
  arena.update(0, 0, true);
  requestAnimationFrame(animate);
  setTimeout(() => {
    refs.boot.classList.add('is-gone');
    state.mode = 'menu';
  }, 360);
  window.__BLOODPIT__ = {
    get state() {
      return {
        mode: state.mode,
        wave: state.wave,
        kills: state.kills,
        enemies: enemies.length,
        alive: enemies.filter((enemy) => !enemy.dead).length,
        health: player.health,
        weapon: player.weapon,
      };
    },
    start: startRun,
    spawn: (type, x, z) => spawnEnemy(type, new THREE.Vector3(x, 0, z)),
    enemies,
    player,
    effects,
    scene,
    renderer,
  };
}

boot();
