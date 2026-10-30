/**
 * MusicMatch - 3D Three.js Interactive Audio Universe
 * ====================================================
 * Creates procedural 3D musical objects:
 * - Floating Music Notes (beamed notes & single notes)
 * - Sleek Studio Headphones
 * - Glossy Vinyl Record with center label
 * - Cyberpunk Speaker with acoustic cone
 * - Dynamic Equalizer Bar spectrum
 * - Twinkling cosmic particles
 * 
 * Features:
 * - Weightless bobbing & smooth rotation
 * - Subtle mouse repulsion & smooth parallax
 * - Scroll-based depth movement
 * - Adaptive performance: Full scene on Home, lightweight on inner pages & mobile
 */

(function () {
  'use strict';

  // Check if Three.js is loaded
  if (typeof THREE === 'undefined') {
    console.warn('Three.js is not loaded. Skipping 3D scene initialization.');
    return;
  }

  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  // Determine mode: full scene on Home page, lightweight on sub-pages
  const isHomePage = document.body.classList.contains('home-page') || 
                     canvas.getAttribute('data-scene') === 'full' ||
                     window.location.pathname.endsWith('index.html') ||
                     window.location.pathname.endsWith('/') ||
                     window.location.pathname === '';
  const isMobile = window.innerWidth < 768;

  // Scene, Camera, Renderer
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a14, isHomePage ? 0.025 : 0.04);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, isMobile ? 16 : 13);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: !isMobile,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // -----------------------------------------------------------------
  // Lighting
  // -----------------------------------------------------------------
  const ambientLight = new THREE.AmbientLight(0x2a2550, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const purpleLight = new THREE.PointLight(0x9d4edd, 3.5, 30);
  purpleLight.position.set(-8, 6, 4);
  scene.add(purpleLight);

  const blueLight = new THREE.PointLight(0x3a86ff, 3.5, 30);
  blueLight.position.set(8, -5, 5);
  scene.add(blueLight);

  const pinkLight = new THREE.PointLight(0xff007f, 2.5, 25);
  pinkLight.position.set(0, 8, 2);
  scene.add(pinkLight);

  // -----------------------------------------------------------------
  // Material Palette (Purple, Blue, Pink Glossy Glowing Finishes)
  // -----------------------------------------------------------------
  const matPurple = new THREE.MeshStandardMaterial({
    color: 0x9d4edd,
    roughness: 0.25,
    metalness: 0.65,
    emissive: 0x3d0066,
    emissiveIntensity: 0.3
  });

  const matBlue = new THREE.MeshStandardMaterial({
    color: 0x3a86ff,
    roughness: 0.2,
    metalness: 0.7,
    emissive: 0x001d66,
    emissiveIntensity: 0.3
  });

  const matPink = new THREE.MeshStandardMaterial({
    color: 0xff007f,
    roughness: 0.3,
    metalness: 0.5,
    emissive: 0x660033,
    emissiveIntensity: 0.35
  });

  const matDarkVinyl = new THREE.MeshStandardMaterial({
    color: 0x111116,
    roughness: 0.15,
    metalness: 0.85
  });

  const matGold = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    roughness: 0.3,
    metalness: 0.8
  });

  // -----------------------------------------------------------------
  // Procedural 3D Mesh Builders
  // -----------------------------------------------------------------

  // 1. Music Note (Single or Eighth Note)
  function createMusicNote(colorMat) {
    const group = new THREE.Group();

    // Note head (tilted oval)
    const headGeo = new THREE.SphereGeometry(0.45, 24, 16);
    headGeo.scale(1.2, 0.75, 0.6);
    const headMesh = new THREE.Mesh(headGeo, colorMat);
    headMesh.rotation.z = Math.PI / 6;
    headMesh.rotation.x = Math.PI / 12;
    group.add(headMesh);

    // Stem (vertical cylinder)
    const stemGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 16);
    const stemMesh = new THREE.Mesh(stemGeo, colorMat);
    stemMesh.position.set(0.42, 0.85, 0);
    group.add(stemMesh);

    // Flag (curved banner at top of stem)
    const flagGeo = new THREE.TorusGeometry(0.5, 0.06, 12, 24, Math.PI * 0.75);
    const flagMesh = new THREE.Mesh(flagGeo, colorMat);
    flagMesh.position.set(0.78, 1.6, 0);
    flagMesh.rotation.z = -Math.PI / 3;
    group.add(flagMesh);

    return group;
  }

  // 2. Beamed Pair of Eighth Notes
  function createBeamedNotes(colorMat) {
    const group = new THREE.Group();

    // First note head & stem
    const head1 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 14), colorMat);
    head1.scale.set(1.2, 0.7, 0.6);
    head1.rotation.z = Math.PI / 6;
    head1.position.set(-0.6, 0, 0);
    group.add(head1);

    const stem1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 12), colorMat);
    stem1.position.set(-0.25, 0.75, 0);
    group.add(stem1);

    // Second note head & stem
    const head2 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 14), colorMat);
    head2.scale.set(1.2, 0.7, 0.6);
    head2.rotation.z = Math.PI / 6;
    head2.position.set(0.6, 0.2, 0);
    group.add(head2);

    const stem2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 12), colorMat);
    stem2.position.set(0.95, 0.95, 0);
    group.add(stem2);

    // Connecting beam
    const beamGeo = new THREE.BoxGeometry(1.3, 0.15, 0.09);
    const beamMesh = new THREE.Mesh(beamGeo, colorMat);
    beamMesh.position.set(0.35, 1.6, 0);
    beamMesh.rotation.z = 0.16;
    group.add(beamMesh);

    return group;
  }

  // 3. Studio Headphones
  function createHeadphones(accentMat) {
    const group = new THREE.Group();

    // Headband (Half Torus)
    const bandGeo = new THREE.TorusGeometry(1.25, 0.09, 16, 36, Math.PI);
    const bandMesh = new THREE.Mesh(bandGeo, matDarkVinyl);
    bandMesh.rotation.z = 0;
    group.add(bandMesh);

    // Left and Right Earcups
    [-1.25, 1.25].forEach((xSide) => {
      const cupGroup = new THREE.Group();

      // Outer housing
      const cupGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.35, 24);
      const cupMesh = new THREE.Mesh(cupGeo, matDarkVinyl);
      cupMesh.rotation.z = Math.PI / 2;
      cupGroup.add(cupMesh);

      // Accent ring
      const ringGeo = new THREE.TorusGeometry(0.53, 0.05, 12, 24);
      const ringMesh = new THREE.Mesh(ringGeo, accentMat);
      ringMesh.rotation.y = Math.PI / 2;
      cupGroup.add(ringMesh);

      // Soft ear pad cushion
      const padGeo = new THREE.TorusGeometry(0.42, 0.14, 16, 24);
      const padMesh = new THREE.Mesh(padGeo, matDarkVinyl);
      padMesh.rotation.y = Math.PI / 2;
      padMesh.position.x = (xSide > 0 ? -0.15 : 0.15);
      cupGroup.add(padMesh);

      cupGroup.position.set(xSide, 0, 0);
      group.add(cupGroup);
    });

    return group;
  }

  // 4. Glossy Vinyl Record
  function createVinylRecord() {
    const group = new THREE.Group();

    // Disc body
    const discGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.04, 48);
    const discMesh = new THREE.Mesh(discGeo, matDarkVinyl);
    group.add(discMesh);

    // Concentric groove highlights
    [0.9, 1.2, 1.4].forEach((radius) => {
      const grooveGeo = new THREE.RingGeometry(radius, radius + 0.02, 36);
      const grooveMesh = new THREE.Mesh(
        grooveGeo,
        new THREE.MeshBasicMaterial({ color: 0x222230, side: THREE.DoubleSide })
      );
      grooveMesh.rotation.x = Math.PI / 2;
      grooveMesh.position.y = 0.022;
      group.add(grooveMesh);
    });

    // Center circular label sticker
    const labelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.046, 32);
    const labelMesh = new THREE.Mesh(labelGeo, matPink);
    group.add(labelMesh);

    // Spindle center hole
    const holeGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16);
    const holeMesh = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a14 }));
    group.add(holeMesh);

    return group;
  }

  // 5. Cyberpunk Sound Speaker
  function createSpeaker(accentMat) {
    const group = new THREE.Group();

    // Cabinet box
    const boxGeo = new THREE.BoxGeometry(1.3, 1.9, 0.9);
    const boxMesh = new THREE.Mesh(boxGeo, matDarkVinyl);
    group.add(boxMesh);

    // Subwoofer cone (lower front)
    const coneGeo = new THREE.ConeGeometry(0.45, 0.25, 24);
    const coneMesh = new THREE.Mesh(coneGeo, accentMat);
    coneMesh.rotation.x = -Math.PI / 2;
    coneMesh.position.set(0, -0.35, 0.45);
    group.add(coneMesh);

    // Tweeter cone (upper front)
    const tweetGeo = new THREE.SphereGeometry(0.2, 18, 14);
    tweetGeo.scale(1, 1, 0.5);
    const tweetMesh = new THREE.Mesh(tweetGeo, matBlue);
    tweetMesh.position.set(0, 0.48, 0.45);
    group.add(tweetMesh);

    // Glowing bass port ring
    const portRingGeo = new THREE.TorusGeometry(0.48, 0.04, 12, 24);
    const portRing = new THREE.Mesh(portRingGeo, matPink);
    portRing.position.set(0, -0.35, 0.46);
    group.add(portRing);

    return group;
  }

  // 6. Dynamic Equalizer Bars
  function createEqualizerGroup() {
    const group = new THREE.Group();
    const barCount = 7;
    const barWidth = 0.16;
    const spacing = 0.24;
    const startX = -((barCount - 1) * spacing) / 2;

    group.bars = [];

    for (let i = 0; i < barCount; i++) {
      const height = 0.6 + Math.random() * 1.2;
      const barGeo = new THREE.BoxGeometry(barWidth, 1, barWidth);
      const color = i % 2 === 0 ? matPurple : (i % 3 === 0 ? matPink : matBlue);
      const barMesh = new THREE.Mesh(barGeo, color);
      barMesh.position.set(startX + i * spacing, 0, 0);
      barMesh.scale.y = height;
      group.add(barMesh);

      group.bars.push({
        mesh: barMesh,
        speed: 1.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        baseScale: 0.5 + Math.random() * 0.5
      });
    }

    return group;
  }

  // -----------------------------------------------------------------
  // Create & Populate Floating Elements Collection
  // -----------------------------------------------------------------
  const floatingObjects = [];

  // Define object blueprints
  const items = [
    { factory: () => createHeadphones(matPink), pos: [-5.2, 2.5, -1], rotSpeed: [0.005, 0.008, 0.003], floatAmp: 0.45, floatSpeed: 1.1, scale: 1.2 },
    { factory: () => createVinylRecord(), pos: [5.4, 1.8, 1], rotSpeed: [0.012, 0.006, 0.01], floatAmp: 0.55, floatSpeed: 0.9, scale: 1.1 },
    { factory: () => createSpeaker(matPurple), pos: [-4.6, -3.2, 2], rotSpeed: [0.004, 0.009, 0.002], floatAmp: 0.4, floatSpeed: 1.3, scale: 1.0 },
    { factory: () => createMusicNote(matBlue), pos: [4.8, -2.8, -2], rotSpeed: [0.008, 0.012, 0.005], floatAmp: 0.5, floatSpeed: 1.2, scale: 1.3 },
    { factory: () => createBeamedNotes(matPink), pos: [1.8, 4.2, -3], rotSpeed: [0.006, 0.007, 0.004], floatAmp: 0.35, floatSpeed: 1.4, scale: 1.0 },
    { factory: () => createEqualizerGroup(), pos: [-1.8, -4.5, -1], rotSpeed: [0.003, 0.006, 0.001], floatAmp: 0.3, floatSpeed: 1.0, scale: 1.1 },
    { factory: () => createMusicNote(matPurple), pos: [-6.8, 0.5, -4], rotSpeed: [0.01, 0.008, 0.006], floatAmp: 0.4, floatSpeed: 0.8, scale: 0.9 },
    { factory: () => createVinylRecord(), pos: [6.8, -0.5, -5], rotSpeed: [0.007, 0.015, 0.005], floatAmp: 0.5, floatSpeed: 1.0, scale: 0.85 },
    { factory: () => createHeadphones(matBlue), pos: [0, 5.0, -4], rotSpeed: [0.004, 0.008, 0.003], floatAmp: 0.4, floatSpeed: 1.2, scale: 0.9 }
  ];

  // For inner pages or mobile, keep only a subset
  let activeItems = items;
  if (!isHomePage) {
    // 4 background ambient items on sub-pages
    activeItems = [items[0], items[1], items[2], items[3]];
  } else if (isMobile) {
    // 5 items on mobile home
    activeItems = items.slice(0, 5);
  }

  activeItems.forEach((def) => {
    const obj = def.factory();
    obj.position.set(...def.pos);
    obj.scale.set(def.scale, def.scale, def.scale);
    scene.add(obj);

    floatingObjects.push({
      mesh: obj,
      initialPos: new THREE.Vector3(...def.pos),
      rotSpeed: def.rotSpeed,
      floatAmp: def.floatAmp,
      floatSpeed: def.floatSpeed,
      randomOffset: Math.random() * Math.PI * 2,
      depthFactor: 0.2 + Math.abs(def.pos[2]) * 0.15
    });
  });

  // -----------------------------------------------------------------
  // Background Twinkling Stardust Particles
  // -----------------------------------------------------------------
  const particleCount = isHomePage ? (isMobile ? 250 : 550) : (isMobile ? 120 : 220);
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);

  const colorPalette = [
    new THREE.Color(0x9d4edd),
    new THREE.Color(0x3a86ff),
    new THREE.Color(0xff007f),
    new THREE.Color(0x00f0ff),
    new THREE.Color(0xffffff)
  ];

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    particlePos[i3] = (Math.random() - 0.5) * 36;
    particlePos[i3 + 1] = (Math.random() - 0.5) * 28;
    particlePos[i3 + 2] = (Math.random() - 0.5) * 20 - 2;

    const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    particleColors[i3] = col.r;
    particleColors[i3 + 1] = col.g;
    particleColors[i3 + 2] = col.b;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

  const particleMat = new THREE.PointsMaterial({
    size: isMobile ? 0.08 : 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(particleGeo, particleMat);
  scene.add(particleSystem);

  // -----------------------------------------------------------------
  // Interactive Event Listeners: Mouse & Scroll
  // -----------------------------------------------------------------
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;
  let scrollY = 0;
  let targetScrollY = 0;

  window.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener('scroll', () => {
    targetScrollY = window.pageYOffset || document.documentElement.scrollTop;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  // -----------------------------------------------------------------
  // Animation Loop (60 FPS)
  // -----------------------------------------------------------------
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    // Smooth Mouse Lerp
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Smooth Scroll Lerp
    scrollY += (targetScrollY - scrollY) * 0.06;

    // Subtle Camera Parallax
    camera.position.x = mouseX * 0.8;
    camera.position.y = -mouseY * 0.8 - (scrollY * 0.002);
    camera.lookAt(0, -scrollY * 0.002, 0);

    // Update Floating Musical Objects
    for (let i = 0; i < floatingObjects.length; i++) {
      const item = floatingObjects[i];
      const mesh = item.mesh;

      // Slow Continuous Rotation
      mesh.rotation.x += item.rotSpeed[0];
      mesh.rotation.y += item.rotSpeed[1];
      mesh.rotation.z += item.rotSpeed[2];

      // Weightless Bobbing (Sine Wave)
      const floatVal = Math.sin(elapsedTime * item.floatSpeed + item.randomOffset) * item.floatAmp;
      
      // Mouse Repulsion & Parallax Shift: moves slightly away from mouse
      const repulsionX = -mouseX * 0.6 * item.depthFactor;
      const repulsionY = mouseY * 0.6 * item.depthFactor;

      // Scroll Offset at different speeds for depth
      const scrollOffset = scrollY * 0.003 * item.depthFactor;

      mesh.position.x = item.initialPos.x + repulsionX;
      mesh.position.y = item.initialPos.y + floatVal + repulsionY + scrollOffset;
      mesh.position.z = item.initialPos.z;

      // Animate Equalizer bars if present
      if (mesh.bars) {
        mesh.bars.forEach((b) => {
          const beatScale = b.baseScale + 0.6 * Math.abs(Math.sin(elapsedTime * b.speed + b.phase));
          b.mesh.scale.y = beatScale;
        });
      }
    }

    // Slowly Rotate Cosmic Particles
    particleSystem.rotation.y = elapsedTime * 0.02;
    particleSystem.rotation.x = elapsedTime * 0.01;

    renderer.render(scene, camera);
  }

  animate();
})();
