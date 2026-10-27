import * as THREE from 'three';
import { GLTFLoader } from '../public/vendor/GLTFLoader.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const languageToggle = document.querySelector('#language-toggle');
const page = document.documentElement;
let language = 'en';

function setLanguage(next) {
  language = next;
  page.lang = next;
  page.dir = next === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('rtl', next === 'ar');
  languageToggle.textContent = next === 'en' ? 'عربي' : 'EN';
  languageToggle.setAttribute('aria-label', next === 'en' ? 'Switch to Arabic' : 'Switch to English');
  document.querySelectorAll('[data-en][data-ar]').forEach((node) => {
    node.innerHTML = node.dataset[next];
  });
}
languageToggle.addEventListener('click', () => setLanguage(language === 'en' ? 'ar' : 'en'));

const menuToggle = document.querySelector('#menu-toggle');
const mainNav = document.querySelector('#main-nav');
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  mainNav.classList.toggle('open', open);
});
mainNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  mainNav.classList.remove('open');
}));

const header = document.querySelector('.topbar');
const progressBar = document.querySelector('#scroll-progress-bar');
let scrollQueued = false;
function onScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progressBar.style.width = `${max > 0 ? (scrollY / max) * 100 : 0}%`;
    header.classList.toggle('scrolled', scrollY > 24);
    scrollQueued = false;
  });
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.13, rootMargin: '0px 0px -35px 0px' });
  reveals.forEach((item) => revealObserver.observe(item));
} else reveals.forEach((item) => item.classList.add('visible'));

const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...mainNav.querySelectorAll('a[href^="#"]')];
if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => link.classList.toggle('active', link.hash === `#${entry.target.id}`));
    });
  }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
  sections.forEach((section) => sectionObserver.observe(section));
}

document.querySelector('#year').textContent = new Date().getFullYear();

/* 3D GLB stages: slow idle motion, drag orbit, wheel zoom, and pause/reset controls. */
function createStage({ canvas, modelUrl, loading, resetButton, pauseButton, scale = 2.2, modelLift = 0.08, yaw = 0, tilt = 0.06, cameraDistance = 5.8, cameraTargetY = 0.12, bob = 0.055, onModelReady }) {
  if (!canvas) return null;
  if (!window.WebGLRenderingContext) {
    loading?.classList.add('loaded');
    canvas.parentElement?.classList.add('load-failed');
    return null;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (error) {
    console.warn('WebGL is unavailable for this 3D preview.', error);
    if (loading) loading.classList.add('loaded');
    canvas.parentElement?.classList.add('load-failed');
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  camera.position.set(0, cameraTargetY + 1.03, cameraDistance);
  camera.lookAt(0, cameraTargetY, 0);
  const ambient = new THREE.HemisphereLight(0xbfe7ff, 0x101020, 2.05);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-3.5, 5, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x078cff, 26, 13, 2);
  rim.position.set(3.5, 1.5, -2.6);
  scene.add(rim);
  const gold = new THREE.PointLight(0xffbd42, 12, 11, 2);
  gold.position.set(-2.8, -1.5, 2.4);
  scene.add(gold);

  const rig = new THREE.Group();
  rig.rotation.y = yaw;
  scene.add(rig);
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(1.25, 1.27, 96),
    new THREE.MeshBasicMaterial({ color: 0x10aefa, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = -1.25;
  rig.add(groundRing);
  const goldRing = new THREE.Mesh(
    new THREE.RingGeometry(1.52, 1.53, 96),
    new THREE.MeshBasicMaterial({ color: 0xf0c050, transparent: true, opacity: 0.19, side: THREE.DoubleSide })
  );
  goldRing.rotation.x = -Math.PI / 2;
  goldRing.position.y = -1.255;
  rig.add(goldRing);

  const loader = new GLTFLoader();
  let model = null;
  let baseRotation = yaw;
  let dragX = null;
  let dragY = null;
  let isDragging = false;
  let paused = reduceMotion;
  let zoom = 1;
  let disposed = false;
  const startAt = performance.now();
  const stageApi = { model: null, gltf: null, mixer: null };

  loader.load(modelUrl, (gltf) => {
    if (disposed) return;
    model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(scale / maxSize);
    model.position.sub(center.multiplyScalar(scale / maxSize));
    model.position.y += scale * modelLift;
    model.rotation.x = tilt;
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
      if (child.material) {
        child.material.envMapIntensity = 1.1;
        child.material.needsUpdate = true;
      }
    });
    rig.add(model);
    stageApi.model = model;
    stageApi.gltf = gltf;
    if (gltf.animations?.length) stageApi.mixer = new THREE.AnimationMixer(model);
    onModelReady?.(stageApi);
    canvas.parentElement?.classList.add('model-ready');
    loading?.classList.add('loaded');
  }, undefined, (error) => {
    console.error(`Could not load 3D model: ${modelUrl}`, error);
    if (loading) {
      const label = loading.querySelector('span:last-child');
      if (label) label.textContent = '3D PREVIEW · SEE PROJECT RENDER';
      loading.classList.add('loaded');
    }
    canvas.parentElement?.classList.add('load-failed');
  });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    const compact = rect.width < 560;
    camera.position.z = (compact ? cameraDistance * 1.12 : cameraDistance) / zoom;
    camera.position.y = cameraTargetY + 1.03 / zoom;
    camera.lookAt(0, cameraTargetY, 0);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);
  resize();

  const onPointerDown = (event) => {
    isDragging = true;
    dragX = event.clientX;
    dragY = event.clientY;
    canvas.parentElement.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event) => {
    if (!isDragging || dragX === null) return;
    const dx = event.clientX - dragX;
    const dy = event.clientY - dragY;
    baseRotation += dx * 0.009;
    rig.rotation.x = THREE.MathUtils.clamp(rig.rotation.x + dy * 0.006, -0.45, 0.45);
    dragX = event.clientX;
    dragY = event.clientY;
  };
  const onPointerUp = () => { isDragging = false; dragX = null; dragY = null; };
  const onWheel = (event) => {
    event.preventDefault();
    zoom = THREE.MathUtils.clamp(zoom + (event.deltaY < 0 ? 0.08 : -0.08), 0.72, 1.48);
    resize();
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  addEventListener('pointermove', onPointerMove, { passive: true });
  addEventListener('pointerup', onPointerUp, { passive: true });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  resetButton?.addEventListener('click', () => { baseRotation = yaw; rig.rotation.x = 0; zoom = 1; resize(); });
  pauseButton?.addEventListener('click', () => {
    paused = !paused;
    pauseButton.textContent = paused ? '▶' : 'Ⅱ';
    pauseButton.setAttribute('aria-label', paused ? 'Resume 3D motion' : 'Pause 3D motion');
  });
  let frame = 0;
  const animate = (now) => {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const elapsed = (now - startAt) * 0.001;
    if (!paused && !isDragging) {
      rig.rotation.y = baseRotation + Math.sin(elapsed * 0.34) * 0.17 + elapsed * 0.11;
      rig.position.y = Math.sin(elapsed * 1.08) * bob;
    }
    stageApi.mixer?.update(Math.min(0.05, (now - (stageApi.lastFrame || now)) / 1000));
    stageApi.lastFrame = now;
    gold.intensity = 10 + Math.sin(elapsed * 1.4) * 2.6;
    rim.intensity = 22 + Math.sin(elapsed * 1.1 + 1) * 4;
    groundRing.material.opacity = 0.32 + (Math.sin(elapsed * 1.7) + 1) * 0.08;
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(animate);
  stageApi.setVariant = (variant) => {
    if (!stageApi.model) return;
    stageApi.model.traverse((child) => {
      if (!child.isMesh) return;
      const name = child.name.toLowerCase();
      const isRoof = /roof_|roof\b|skylight|structural_roof|bridging_and_mep/.test(name);
      const isWall = /^(wall_|rearwall_|rear_architecture_preserved|front_industrial_door)/.test(name);
      child.visible = variant === 'exterior'
        || (variant === 'interior' && !isRoof && !isWall)
        || (variant === 'cutaway' && !isRoof && !/^wall_front_|^front_industrial_door|^rearwall_|^rear_architecture_preserved/.test(name));
    });
  };
  stageApi.playDoors = (open) => {
    if (!stageApi.mixer || !stageApi.gltf) return;
    stageApi.gltf.animations.forEach((clip) => {
      const action = stageApi.mixer.clipAction(clip);
      action.enabled = true;
      action.clampWhenFinished = true;
      action.setLoop(THREE.LoopOnce, 1);
      action.paused = false;
      action.timeScale = open ? 1 : -1;
      if (!open && action.time === 0) action.time = clip.duration;
      if (open && action.time >= clip.duration) action.time = 0;
      action.play();
    });
  };
  stageApi.reset = () => { baseRotation = yaw; rig.rotation.x = 0; zoom = 1; resize(); };
  stageApi.dispose = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    removeEventListener('pointermove', onPointerMove);
    removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    renderer.dispose();
  };
  return stageApi;
}

const factoryStage = createStage({
  canvas: document.querySelector('#factory-canvas'),
  modelUrl: './public/models/factory-realistic-v3.glb',
  loading: document.querySelector('#factory-loading'),
  resetButton: document.querySelector('#factory-reset'),
  scale: 4.4,
  modelLift: 0.015,
  yaw: -0.38,
  tilt: 0,
  cameraDistance: 8.5,
  cameraTargetY: 0.02,
  bob: 0.006,
  onModelReady: (stage) => stage.setVariant('exterior'),
});

let factoryView = 'exterior';
document.querySelectorAll('[data-factory-view]').forEach((button) => button.addEventListener('click', () => {
  factoryView = button.dataset.factoryView;
  factoryStage?.setVariant(factoryView);
  document.querySelectorAll('[data-factory-view]').forEach((item) => item.classList.toggle('active', item === button));
}));
const factoryDoorButton = document.querySelector('#factory-door-toggle');
let factoryDoorOpen = false;
factoryDoorButton?.addEventListener('click', () => {
  factoryDoorOpen = !factoryDoorOpen;
  factoryStage?.playDoors(factoryDoorOpen);
  factoryDoorButton.textContent = factoryDoorOpen
    ? (language === 'ar' ? 'إغلاق باب التحميل' : 'CLOSE LOADING DOOR')
    : (language === 'ar' ? 'فتح باب التحميل' : 'OPEN LOADING DOOR');
});
document.querySelector('#factory-reset')?.addEventListener('click', () => factoryStage?.reset());

/* Shared visual robot simulator; no message from this module actuates physical hardware. */
const demoApiBase = 'wss://robot-control-backend.onrender.com/api/v1/demo/ws';
const demoRoot = document.querySelector('#interactive-model');
const demoSocket = { current: null, shouldConnect: false, retry: 1200, retryTimer: null };
const demoState = { self: null, isHolder: false, queuePosition: null, visitorCount: 0, queueLength: 0, holderRemainingMs: 0, control: { x: 0, z: 0, yaw: 0, forward: 0, turn: 0, speed: 0.9, lights: false, device: 0, screenIndex: 0 } };
const demoDevices = [
  { name: 'PS1 GAMEPAD', arabic: 'يد تحكم PS1', file: './public/models/controller2.glb', label: '01 / 03' },
  { name: 'TV REMOTE', arabic: 'ريموت التلفاز', file: './public/models/super_gold_x3_sg555.glb', label: '02 / 03' },
  { name: 'LAPTOP', arabic: 'لابتوب', file: './public/models/laptop-v2.glb', label: '03 / 03' },
];
const laptopImages = [
  { file: './public/media/robot-showroom-v3.png', alt: 'Robot and control hardware Blender visualization' },
  { file: './public/media/factory-ev036.png', alt: 'Olive oil processing factory engineering model' },
  { file: './public/media/factory-flow-ev036.png', alt: 'Olive oil engineering process map' },
  { file: './public/media/controller-detail-v3.png', alt: 'Gamepad engineering model and details' },
];
let demoRobotViewer = null;
let demoDeviceViewer = null;

function createInteractiveViewer({ canvas, initialUrl, type }) {
  if (!canvas || !window.WebGLRenderingContext) return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch (error) { console.warn('Interactive preview is unavailable.', error); return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.4));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  camera.position.set(0, 1.08, type === 'robot' ? 5.5 : 4.8);
  camera.lookAt(0, 0.05, 0);
  scene.add(new THREE.HemisphereLight(0xcdeeff, 0x111526, 2.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.3);
  keyLight.position.set(-3, 5, 4);
  scene.add(keyLight);
  const blueLight = new THREE.PointLight(0x008fff, 18, 12, 2);
  blueLight.position.set(3.2, 1.9, -2.5);
  scene.add(blueLight);
  const goldLight = new THREE.PointLight(0xffbf45, 10, 10, 2);
  goldLight.position.set(-2.6, 0.8, 2.2);
  scene.add(goldLight);
  const orbitRig = new THREE.Group();
  scene.add(orbitRig);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.27, 96), new THREE.MeshBasicMaterial({ color: 0x0ba8ee, transparent: true, opacity: 0.42, side: THREE.DoubleSide }));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = type === 'robot' ? -1.58 : -1.15;
  orbitRig.add(floorRing);
  const contentRig = new THREE.Group();
  orbitRig.add(contentRig);
  const lamps = new THREE.Group();
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0x60dfff, emissive: 0x27baff, emissiveIntensity: 4, metalness: 0.15, roughness: 0.25 });
  for (const x of [-0.72, 0.72]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), lampMaterial);
    lamp.position.set(x * 1.12, 1.02, -0.65);
    lamps.add(lamp);
    const beam = new THREE.PointLight(0x26bfff, 0, 3.1, 2);
    beam.position.copy(lamp.position);
    lamps.add(beam);
  }
  lamps.visible = false;
  contentRig.add(lamps);

  const loader = new GLTFLoader();
  let currentModel = null;
  let wheelNodes = [];
  let loadId = 0;
  let target = { x: 0, z: 0, yaw: 0, forward: 0, turn: 0, lights: false };
  let yaw = type === 'robot' ? -0.55 : -0.28;
  let viewTilt = -0.04;
  let zoom = 1;
  let dragging = false;
  let pointer = null;
  let lastAt = performance.now();
  let disposed = false;
  let currentUrl = '';

  function clearModel() {
    if (!currentModel) return;
    contentRig.remove(currentModel);
    currentModel.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry?.dispose();
      for (const material of (Array.isArray(child.material) ? child.material : [child.material])) {
        if (!material) continue;
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
        material.dispose();
      }
    });
    currentModel = null;
    wheelNodes = [];
  }

  function load(url) {
    if (!url || url === currentUrl) return;
    currentUrl = url;
    const requestId = ++loadId;
    loader.load(url, (gltf) => {
      if (disposed || requestId !== loadId) return;
      clearModel();
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z) || 1;
      const factor = (type === 'robot' ? 3.05 : 2.55) / maxSize;
      model.scale.setScalar(factor);
      model.position.sub(center.multiplyScalar(factor));
      model.position.y += type === 'robot' ? 0.16 : 0;
      model.traverse((child) => {
        if (!child.isMesh) return;
        child.material && (child.material.envMapIntensity = 1.15);
        if (type === 'robot' && /motion__.*wheel/i.test(child.name)) wheelNodes.push(child);
      });
      currentModel = model;
      contentRig.add(model);
      canvas.parentElement?.classList.add('model-ready');
    }, undefined, (error) => {
      if (requestId !== loadId) return;
      console.error(`Could not load interactive model ${url}`, error);
      canvas.parentElement?.classList.add('load-failed');
    });
  }
  load(initialUrl);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.position.z = (type === 'robot' ? 5.5 : 4.8) / zoom;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
  resize();
  const onPointerDown = (event) => { dragging = true; pointer = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture?.(event.pointerId); event.preventDefault(); };
  const onPointerMove = (event) => {
    if (!dragging || !pointer) return;
    yaw += (event.clientX - pointer.x) * 0.008;
    viewTilt = THREE.MathUtils.clamp(viewTilt + (event.clientY - pointer.y) * 0.004, -0.5, 0.42);
    pointer = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = () => { dragging = false; pointer = null; };
  const onWheel = (event) => { event.preventDefault(); zoom = THREE.MathUtils.clamp(zoom + (event.deltaY < 0 ? 0.08 : -0.08), 0.72, 1.45); resize(); };
  canvas.addEventListener('pointerdown', onPointerDown);
  addEventListener('pointermove', onPointerMove, { passive: true });
  addEventListener('pointerup', onPointerUp, { passive: true });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  const frame = (now) => {
    if (disposed) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastAt) / 1000);
    lastAt = now;
    const t = 1 - Math.exp(-dt * 8);
    if (type === 'robot') {
      contentRig.position.x = THREE.MathUtils.lerp(contentRig.position.x, target.x, t);
      contentRig.position.z = THREE.MathUtils.lerp(contentRig.position.z, target.z, t);
      if (currentModel) {
        const angleDelta = Math.atan2(Math.sin(target.yaw - currentModel.rotation.y), Math.cos(target.yaw - currentModel.rotation.y));
        currentModel.rotation.y += angleDelta * t;
      }
      const wheelTurn = (target.forward * 3.1 + target.turn * 1.6) * dt;
      wheelNodes.forEach((wheel) => { wheel.rotation.x += wheelTurn; });
      lamps.visible = target.lights;
      blueLight.intensity = target.lights ? 25 : 18;
    } else if (!dragging) yaw += dt * 0.1;
    orbitRig.rotation.y += (yaw - orbitRig.rotation.y) * t;
    orbitRig.rotation.x += (viewTilt - orbitRig.rotation.x) * t;
    goldLight.intensity = 9 + Math.sin(now * 0.0014) * 2.3;
    floorRing.material.opacity = 0.32 + (Math.sin(now * 0.0015) + 1) * 0.07;
    renderer.render(scene, camera);
  };
  requestAnimationFrame(frame);

  return {
    setState: (state) => {
      target = { ...target, x: state.x, z: state.z, yaw: state.yaw, forward: state.forward, turn: state.turn, lights: state.lights };
      if (type === 'device' && Number.isInteger(state.device)) load(demoDevices[state.device]?.file);
    },
    dispose: () => {
      disposed = true;
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      removeEventListener('pointermove', onPointerMove);
      removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      clearModel();
      renderer.dispose();
    }
  };
}

demoRobotViewer = createInteractiveViewer({ canvas: document.querySelector('#demo-robot-canvas'), initialUrl: './public/models/robot-v2.glb', type: 'robot' });
demoDeviceViewer = createInteractiveViewer({ canvas: document.querySelector('#demo-device-canvas'), initialUrl: demoDevices[0].file, type: 'device' });

const connectionLabel = document.querySelector('#sim-connection-label');
const connectionDot = document.querySelector('#sim-connection-dot');
const queuePosition = document.querySelector('#sim-queue-position');
const queueCount = document.querySelector('#sim-queue-count');
const timeLeft = document.querySelector('#sim-time-left');
const joinButton = document.querySelector('#demo-join');
const releaseButton = document.querySelector('#demo-release');
const deviceTitle = document.querySelector('#demo-device-name');
const deviceCount = document.querySelector('#demo-device-count');
const deviceDownload = document.querySelector('#demo-device-download');
const laptopScreen = document.querySelector('#laptop-screen');
const laptopImage = document.querySelector('#laptop-screen-image');
document.querySelectorAll('[data-drive], #demo-lights, #demo-device-prev, #demo-device-next, #screen-prev, #screen-next').forEach((button) => { button.disabled = true; });
releaseButton.disabled = true;

function setConnectionLabel(connected) {
  connectionDot?.classList.toggle('connected', connected);
  connectionLabel.textContent = connected
    ? (language === 'ar' ? 'متصل بالجلسة المشتركة' : 'CONNECTED TO SHARED SESSION')
    : (language === 'ar' ? 'جارٍ الاتصال بالجلسة المشتركة' : 'CONNECTING TO SHARED SESSION');
}

function sendDemo(message) {
  if (demoSocket.current?.readyState === WebSocket.OPEN) demoSocket.current.send(JSON.stringify(message));
}

function applyDemoSnapshot(snapshot) {
  demoState.self = snapshot.self;
  demoState.isHolder = Boolean(snapshot.self?.isHolder);
  demoState.queuePosition = snapshot.self?.queuePosition ?? null;
  demoState.visitorCount = snapshot.visitorCount || 0;
  demoState.queueLength = snapshot.queueLength || 0;
  demoState.holderRemainingMs = snapshot.holderRemainingMs || 0;
  demoState.control = snapshot.control;
  demoRobotViewer?.setState(snapshot.control);
  demoDeviceViewer?.setState(snapshot.control);
  const device = demoDevices[snapshot.control.device] || demoDevices[0];
  if (deviceTitle) deviceTitle.textContent = language === 'ar' ? device.arabic : device.name;
  if (deviceCount) deviceCount.textContent = device.label;
  if (deviceDownload) deviceDownload.href = device.file;
  if (demoRoot) demoRoot.dataset.device = String(snapshot.control.device);
  if (laptopScreen) laptopScreen.hidden = snapshot.control.device !== 2;
  const image = laptopImages[snapshot.control.screenIndex] || laptopImages[0];
  if (laptopImage && laptopImage.getAttribute('src') !== image.file) {
    laptopImage.src = image.file;
    laptopImage.alt = image.alt;
  }
  const screenIndex = document.querySelector('#laptop-screen-index');
  if (screenIndex) screenIndex.textContent = String(snapshot.control.screenIndex + 1).padStart(2, '0');
  document.querySelector('#demo-light-state').textContent = snapshot.control.lights
    ? (language === 'ar' ? 'الإضاءة تعمل' : 'LIGHTS ON')
    : (language === 'ar' ? 'الإضاءة متوقفة' : 'LIGHTS OFF');
  document.querySelector('#demo-drive-badge').textContent = snapshot.control.forward || snapshot.control.turn
    ? (language === 'ar' ? 'يتحرك' : 'MOVING')
    : (language === 'ar' ? 'متوقف' : 'IDLE');
  document.querySelector('#demo-lights i').textContent = snapshot.control.lights
    ? (language === 'ar' ? 'يعمل' : 'ON')
    : (language === 'ar' ? 'متوقف' : 'OFF');
  queuePosition.textContent = demoState.isHolder
    ? (language === 'ar' ? 'أنت تتحكم الآن' : 'YOU ARE IN CONTROL')
    : demoState.queuePosition
      ? (language === 'ar' ? `رقم ${demoState.queuePosition} في الانتظار` : `QUEUE POSITION ${demoState.queuePosition}`)
      : (language === 'ar' ? 'مشاهدة فقط' : 'WATCHING THE SESSION');
  queueCount.textContent = language === 'ar'
    ? `${demoState.visitorCount} زائر متصل · ${demoState.queueLength} في الانتظار`
    : `${demoState.visitorCount} visitors connected · ${demoState.queueLength} waiting`;
  const canControl = demoState.isHolder;
  document.querySelectorAll('[data-drive], #demo-lights, #demo-device-prev, #demo-device-next, #screen-prev, #screen-next').forEach((button) => { button.disabled = !canControl; });
  if (!canControl && heldDirections.size) { heldDirections.clear(); updateSharedDrive(); }
  joinButton.hidden = canControl || demoState.queuePosition !== null;
  releaseButton.disabled = !canControl && demoState.queuePosition === null;
  document.querySelector('#demo-lights').classList.toggle('active', snapshot.control.lights);
}

function connectDemo() {
  if (!demoSocket.shouldConnect || demoSocket.current || !demoRoot) return;
  const socket = new WebSocket(demoApiBase);
  demoSocket.current = socket;
  socket.addEventListener('open', () => { demoSocket.retry = 1200; setConnectionLabel(true); });
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'snapshot') applyDemoSnapshot(message);
    if (message.type === 'error' && message.code === 'NOT_YOUR_TURN') setConnectionLabel(true);
  });
  socket.addEventListener('close', () => {
    if (demoSocket.current === socket) demoSocket.current = null;
    setConnectionLabel(false);
    demoState.isHolder = false;
    demoState.queuePosition = null;
    demoState.holderRemainingMs = 0;
    demoState.control.forward = 0;
    demoState.control.turn = 0;
    demoRobotViewer?.setState(demoState.control);
    joinButton.hidden = true;
    releaseButton.disabled = true;
    document.querySelectorAll('[data-drive], #demo-lights, #demo-device-prev, #demo-device-next, #screen-prev, #screen-next').forEach((button) => { button.disabled = true; });
    queuePosition.textContent = language === 'ar' ? 'انقطع الاتصال' : 'SESSION DISCONNECTED';
    timeLeft.textContent = '--:--';
    if (demoSocket.shouldConnect) {
      clearTimeout(demoSocket.retryTimer);
      demoSocket.retryTimer = setTimeout(connectDemo, demoSocket.retry);
      demoSocket.retry = Math.min(12000, Math.round(demoSocket.retry * 1.7));
    }
  });
  socket.addEventListener('error', () => socket.close());
}

if ('IntersectionObserver' in window && demoRoot) {
  const demoObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    demoSocket.shouldConnect = true;
    connectDemo();
    demoObserver.disconnect();
  }, { rootMargin: '250px 0px', threshold: 0.01 });
  demoObserver.observe(demoRoot);
} else if (demoRoot) { demoSocket.shouldConnect = true; connectDemo(); }

document.querySelector('#demo-join')?.addEventListener('click', () => sendDemo({ type: 'join' }));
document.querySelector('#demo-release')?.addEventListener('click', () => sendDemo({ type: 'release' }));
document.querySelector('#demo-device-prev')?.addEventListener('click', () => sendDemo({ type: 'device', index: (demoState.control.device + demoDevices.length - 1) % demoDevices.length }));
document.querySelector('#demo-device-next')?.addEventListener('click', () => sendDemo({ type: 'device', index: (demoState.control.device + 1) % demoDevices.length }));
document.querySelector('#screen-prev')?.addEventListener('click', () => sendDemo({ type: 'screen', index: (demoState.control.screenIndex + laptopImages.length - 1) % laptopImages.length }));
document.querySelector('#screen-next')?.addEventListener('click', () => sendDemo({ type: 'screen', index: (demoState.control.screenIndex + 1) % laptopImages.length }));
document.querySelector('#demo-lights')?.addEventListener('click', () => sendDemo({ type: 'lights', enabled: !demoState.control.lights }));

const heldDirections = new Set();
function updateSharedDrive() {
  const forward = Number(heldDirections.has('forward')) - Number(heldDirections.has('reverse'));
  const turn = Number(heldDirections.has('right')) - Number(heldDirections.has('left'));
  sendDemo({ type: 'drive', forward, turn });
}
document.querySelectorAll('[data-drive]').forEach((button) => {
  const direction = button.dataset.drive;
  const start = (event) => { if (button.disabled) return; event.preventDefault(); heldDirections.add(direction); updateSharedDrive(); };
  const stop = () => { if (heldDirections.delete(direction)) updateSharedDrive(); };
  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointerleave', stop);
  button.addEventListener('pointercancel', stop);
});
const keyDirections = { ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'reverse', KeyS: 'reverse', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', (event) => {
  const direction = keyDirections[event.code];
  if (!direction || !demoState.isHolder || event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
  event.preventDefault();
  if (!heldDirections.has(direction)) { heldDirections.add(direction); updateSharedDrive(); }
});
addEventListener('keyup', (event) => {
  const direction = keyDirections[event.code];
  if (direction && heldDirections.delete(direction)) updateSharedDrive();
});
addEventListener('blur', () => { if (heldDirections.size) { heldDirections.clear(); updateSharedDrive(); } });
setInterval(() => {
  if (!demoState.holderRemainingMs) { timeLeft.textContent = '--:--'; return; }
  demoState.holderRemainingMs = Math.max(0, demoState.holderRemainingMs - 1000);
  const seconds = Math.ceil(demoState.holderRemainingMs / 1000);
  timeLeft.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}, 1000);

/* Site-wide ambient particles and short electric arcs. */
const energyCanvas = document.querySelector('#energy-field');
const ctx = energyCanvas.getContext('2d', { alpha: true });
let particles = [];
let w = 0;
let h = 0;
let dpr = 1;
let pointer = { x: -1000, y: -1000, active: false };
let lastArc = performance.now() - 2600;
let arc = null;

function resizeEnergy() {
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  w = innerWidth;
  h = innerHeight;
  energyCanvas.width = Math.round(w * dpr);
  energyCanvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.min(80, Math.max(28, Math.round(w * h / 17800)));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    vx: (Math.random() - 0.5) * (reduceMotion ? 0.08 : 0.34),
    vy: (Math.random() - 0.5) * (reduceMotion ? 0.08 : 0.34),
    r: Math.random() * 1.4 + 0.35,
    hue: Math.random() < 0.68 ? 197 : (Math.random() < 0.8 ? 43 : 350),
    phase: Math.random() * Math.PI * 2,
  }));
}
resizeEnergy();
addEventListener('resize', resizeEnergy, { passive: true });
addEventListener('pointermove', (event) => { pointer = { x: event.clientX, y: event.clientY, active: true }; }, { passive: true });
addEventListener('pointerleave', () => { pointer.active = false; }, { passive: true });

function makeArc(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  const segments = Math.max(5, Math.floor(length / 15));
  const points = [{ x: ax, y: ay }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const offset = (Math.random() - 0.5) * Math.min(22, length * 0.12);
    points.push({ x: ax + dx * t - dy / length * offset, y: ay + dy * t + dx / length * offset });
  }
  points.push({ x: bx, y: by });
  return { points, until: performance.now() + 130 + Math.random() * 130, hue: Math.random() < 0.68 ? 194 : 45 };
}

function drawEnergy(now) {
  requestAnimationFrame(drawEnergy);
  ctx.clearRect(0, 0, w, h);
  const speed = reduceMotion ? 0.35 : 1;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx * speed;
    p.y += p.vy * speed;
    p.phase += 0.018 * speed;
    if (p.x < -12) p.x = w + 12;
    if (p.x > w + 12) p.x = -12;
    if (p.y < -12) p.y = h + 12;
    if (p.y > h + 12) p.y = -12;
    const pulse = 0.33 + (Math.sin(p.phase) + 1) * 0.28;
    const color = `hsla(${p.hue},100%,68%,${pulse})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowBlur = p.r * 7;
    ctx.shadowColor = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    for (let j = i + 1; j < particles.length; j++) {
      const q = particles[j];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 88 && i % 3 === 0) {
        ctx.strokeStyle = `rgba(33,163,237,${(1 - dist / 88) * 0.1})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
    }
  }
  if (!reduceMotion && now - lastArc > 1750 + Math.random() * 1950) {
    lastArc = now;
    let start;
    let end;
    if (pointer.active && Math.random() > 0.42) {
      start = { x: pointer.x + (Math.random() - 0.5) * 55, y: pointer.y + (Math.random() - 0.5) * 55 };
      const nearby = particles.reduce((best, p) => Math.hypot(p.x - pointer.x, p.y - pointer.y) < Math.hypot(best.x - pointer.x, best.y - pointer.y) ? p : best, particles[0]);
      end = { x: nearby.x, y: nearby.y };
    } else {
      start = particles[Math.floor(Math.random() * particles.length)];
      end = particles.reduce((nearest, p) => {
        const currentDistance = Math.hypot(start.x - p.x, start.y - p.y);
        const nearestDistance = Math.hypot(start.x - nearest.x, start.y - nearest.y);
        return p !== start && currentDistance < nearestDistance ? p : nearest;
      }, particles.find((p) => p !== start) || start);
    }
    arc = makeArc(start.x, start.y, end.x, end.y);
  }
  if (arc && now < arc.until) {
    const alpha = Math.max(0, (arc.until - now) / 230);
    ctx.beginPath();
    ctx.moveTo(arc.points[0].x, arc.points[0].y);
    arc.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = `hsla(${arc.hue},100%,74%,${alpha})`;
    ctx.lineWidth = 1.15;
    ctx.shadowBlur = 13;
    ctx.shadowColor = arc.hue === 45 ? '#f0c050' : '#00bfff';
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else arc = null;
}
requestAnimationFrame(drawEnergy);

