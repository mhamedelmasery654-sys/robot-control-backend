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
function createStage({ canvas, modelUrl, loading, resetButton, pauseButton, scale = 2.2, modelLift = 0.08, yaw = 0, tilt = 0.06 }) {
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
  const cameraTargetY = 0.12;
  camera.position.set(0, 1.15, 5.8);
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
    camera.position.z = (compact ? 6.45 : 5.8) / zoom;
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
      rig.position.y = Math.sin(elapsed * 1.08) * 0.055;
    }
    gold.intensity = 10 + Math.sin(elapsed * 1.4) * 2.6;
    rim.intensity = 22 + Math.sin(elapsed * 1.1 + 1) * 4;
    groundRing.material.opacity = 0.32 + (Math.sin(elapsed * 1.7) + 1) * 0.08;
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(animate);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    removeEventListener('pointermove', onPointerMove);
    removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    renderer.dispose();
  };
}

createStage({
  canvas: document.querySelector('#robot-canvas'),
  modelUrl: './public/models/robot-v2.glb',
  loading: document.querySelector('#robot-loading'),
  resetButton: document.querySelector('#model-reset'),
  pauseButton: document.querySelector('#model-pause'),
  scale: 2.75,
  modelLift: 0.08,
  yaw: -0.35,
  tilt: 0.08,
});

createStage({
  canvas: document.querySelector('#detail-canvas'),
  modelUrl: './public/models/controller2.glb',
  scale: 2.15,
  modelLift: 0.08,
  yaw: -0.32,
  tilt: -0.13,
});

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
