(function () {
  const loaderUrl = 'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js';
  const green = 0x52ff86;
  const blueGreen = 0x35e0d8;
  const dimGreen = 0x0e3f25;

  const regions = [
    {
      name: 'Corti',
      role: 'Behavior and planning',
      description: 'ML-based behavior, path planning, mission adaptation, and complex task execution.',
      anchor: [-0.66, 0.24, 0.54],
      yaw: -0.88,
      side: -1,
      labelDy: -58,
      elbowDy: -30
    },
    {
      name: 'Pari',
      role: 'Payloads and fusion',
      description: 'Multi-sensor fusion and spatial awareness for reasoning over the outside world.',
      anchor: [0.00, 0.58, 0.32],
      yaw: -0.26,
      side: 1,
      labelDy: -78,
      elbowDy: -34
    },
    {
      name: 'Oculi',
      role: 'Vision systems',
      description: 'Collision avoidance, visual-inertial odometry, and onboard perception.',
      anchor: [0.72, 0.12, 0.42],
      yaw: 0.46,
      side: 1,
      labelDy: -52,
      elbowDy: -22
    },
    {
      name: 'Tempi',
      role: 'Comms and connectivity',
      description: 'Telemetry, coordination, and cloud connectivity without turning the aircraft into a black box.',
      anchor: [-0.44, -0.16, 0.58],
      yaw: 0.06,
      side: -1,
      labelDy: 30,
      elbowDy: 22
    },
    {
      name: 'Cerebri',
      role: 'Flight firmware',
      description: 'Controls, fail-safes, and manual override running on the Zephyr RTOS.',
      anchor: [0.46, -0.70, 0.26],
      yaw: 0.88,
      side: 1,
      labelDy: 26,
      elbowDy: 22
    }
  ];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const easeOutCubic = (value) => {
    const t = clamp(value, 0, 1) - 1;
    return 1 + t * t * t;
  };

  function injectStyles() {
    if (document.getElementById('platform-brain-styles')) return;
    const style = document.createElement('style');
    style.id = 'platform-brain-styles';
    style.textContent = `
      .platform-brain-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(320px, .72fr);
        gap: clamp(28px, 5vw, 58px);
        align-items: stretch;
        margin-top: 42px;
      }
      .platform-brain-stage {
        position: relative;
        min-height: clamp(420px, 44vw, 620px);
        isolation: isolate;
        overflow: hidden;
        border: 1px solid rgba(82,255,134,.14);
        border-radius: 6px;
        background:
          linear-gradient(rgba(82,255,134,.035) 50%, rgba(6,9,15,.035) 50%),
          radial-gradient(circle at 50% 42%, rgba(82,255,134,.14), transparent 62%);
        background-size: 100% 4px, auto;
        box-shadow: inset 0 0 32px rgba(82,255,134,.055);
      }
      .platform-brain-stage::before {
        content: "";
        position: absolute;
        inset: 8% -5% 0;
        background:
          linear-gradient(rgba(53,224,216,.16) 1px, transparent 1px),
          linear-gradient(90deg, rgba(53,224,216,.11) 1px, transparent 1px);
        background-size: 28px 28px;
        opacity: .34;
        transform: perspective(720px) rotateX(64deg);
        transform-origin: 50% 80%;
        -webkit-mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
        mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
        pointer-events: none;
      }
      .platform-brain-stage::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 4;
        background:
          linear-gradient(90deg, transparent, rgba(82,255,134,.08), transparent),
          repeating-linear-gradient(180deg, rgba(82,255,134,.055) 0 1px, transparent 1px 7px);
        opacity: .22;
        mix-blend-mode: screen;
        pointer-events: none;
      }
      .platform-brain-stage canvas {
        position: absolute;
        inset: 0;
        display: block;
        width: 100%;
        height: 100%;
        filter: drop-shadow(0 0 24px rgba(53,224,216,.22));
      }
      .platform-brain-callout-svg {
        position: absolute;
        inset: 0;
        z-index: 5;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
      }
      .platform-brain-callout-line {
        fill: none;
        stroke: #52ff86;
        stroke-width: 2.2;
        stroke-linecap: square;
        stroke-linejoin: miter;
        vector-effect: non-scaling-stroke;
        filter:
          drop-shadow(0 0 4px rgba(6,9,15,.95))
          drop-shadow(0 0 10px rgba(82,255,134,.95));
      }
      .platform-brain-callout-target {
        opacity: 0;
        filter:
          drop-shadow(0 0 5px rgba(6,9,15,.98))
          drop-shadow(0 0 13px rgba(82,255,134,.92));
      }
      .platform-brain-callout-target-ring {
        fill: rgba(4, 12, 7, .68);
        stroke: #52ff86;
        stroke-width: 1.8;
        vector-effect: non-scaling-stroke;
      }
      .platform-brain-callout-target-pulse {
        fill: none;
        stroke: rgba(82,255,134,.56);
        stroke-width: 1.2;
        transform-box: fill-box;
        transform-origin: center;
        vector-effect: non-scaling-stroke;
        animation: platform-brain-target-pulse 1.8s ease-in-out infinite;
      }
      .platform-brain-callout-target-dot {
        fill: #e9fff1;
        stroke: #052510;
        stroke-width: 1.2;
        vector-effect: non-scaling-stroke;
      }
      .platform-brain-callout-target-cross {
        fill: none;
        stroke: #52ff86;
        stroke-width: 1.6;
        stroke-linecap: square;
        vector-effect: non-scaling-stroke;
      }
      .platform-brain-callout-label {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 5;
        min-width: 92px;
        padding: 8px 10px 8px 14px;
        border-left: 2px solid #52ff86;
        background: linear-gradient(90deg, rgba(82,255,134,.14), rgba(82,255,134,.03) 70%, transparent);
        color: #b8ffd0;
        font: 700 12px "IBM Plex Mono", ui-monospace, monospace;
        letter-spacing: .14em;
        line-height: 1;
        opacity: 0;
        text-shadow: 0 0 8px rgba(82,255,134,.9);
        pointer-events: none;
        white-space: nowrap;
        will-change: transform, opacity;
      }
      .platform-brain-callout-label::before {
        content: "";
        position: absolute;
        top: 50%;
        left: -5px;
        width: 8px;
        height: 8px;
        border: 1px solid #52ff86;
        background: #06090f;
        transform: translateY(-50%) rotate(45deg);
        box-shadow: 0 0 10px rgba(82,255,134,.85);
      }
      .platform-brain-terminal {
        position: absolute;
        left: clamp(10px, 3vw, 24px);
        right: clamp(10px, 3vw, 24px);
        bottom: clamp(10px, 3vw, 22px);
        z-index: 3;
        border: 1px solid rgba(82,255,134,.30);
        background: rgba(4, 12, 7, .74);
        box-shadow:
          inset 0 0 18px rgba(82,255,134,.08),
          0 0 18px rgba(82,255,134,.10);
        color: #b8ffd0;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        text-shadow: 0 0 8px rgba(82,255,134,.60);
        pointer-events: none;
      }
      .platform-brain-terminal-header {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(82,255,134,.20);
        color: rgba(184,255,208,.76);
        font-size: 9px;
        letter-spacing: .16em;
        text-transform: uppercase;
      }
      .platform-brain-terminal-body {
        min-height: 96px;
        padding: 12px 13px 14px;
      }
      .platform-brain-terminal-title {
        color: #52ff86;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: .13em;
        text-transform: uppercase;
      }
      .platform-brain-terminal-meta {
        margin-top: 6px;
        color: rgba(184,255,208,.68);
        font-size: 10px;
        letter-spacing: .10em;
        text-transform: uppercase;
      }
      .platform-brain-terminal-text {
        margin-top: 10px;
        color: rgba(210,255,224,.88);
        font-size: 12px;
        line-height: 1.52;
        letter-spacing: .02em;
      }
      .platform-brain-terminal-cursor {
        display: inline-block;
        width: .65em;
        color: #52ff86;
        animation: platform-brain-cursor 1s steps(2, start) infinite;
      }
      .platform-brain-info-button {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 6;
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border: 1px solid rgba(82,255,134,.42);
        border-radius: 50%;
        background: rgba(4, 12, 7, .72);
        color: #b8ffd0;
        font: 700 13px "IBM Plex Mono", ui-monospace, monospace;
        line-height: 1;
        text-shadow: 0 0 8px rgba(82,255,134,.85);
        box-shadow:
          inset 0 0 12px rgba(82,255,134,.08),
          0 0 14px rgba(82,255,134,.12);
        cursor: pointer;
      }
      .platform-brain-info-button:hover,
      .platform-brain-info-button:focus-visible,
      .platform-brain-info-button[aria-expanded="true"] {
        border-color: rgba(82,255,134,.85);
        color: #52ff86;
        outline: 0;
        box-shadow:
          inset 0 0 14px rgba(82,255,134,.12),
          0 0 18px rgba(82,255,134,.28);
      }
      .platform-brain-credit-panel {
        position: absolute;
        top: 52px;
        right: 12px;
        z-index: 6;
        width: min(320px, calc(100% - 24px));
        padding: 13px 14px 14px;
        border: 1px solid rgba(82,255,134,.34);
        border-radius: 4px;
        background: rgba(4, 12, 7, .90);
        color: #d2ffe0;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        box-shadow:
          inset 0 0 18px rgba(82,255,134,.08),
          0 0 24px rgba(82,255,134,.16);
        text-shadow: 0 0 8px rgba(82,255,134,.42);
      }
      .platform-brain-credit-panel[hidden] {
        display: none;
      }
      .platform-brain-credit-panel strong {
        display: block;
        color: #52ff86;
        font-size: 11px;
        letter-spacing: .15em;
        text-transform: uppercase;
      }
      .platform-brain-credit-panel p {
        margin: 8px 0 0;
        color: rgba(210,255,224,.84);
        font-size: 11px;
        line-height: 1.45;
        letter-spacing: .02em;
      }
      .platform-brain-credit-panel a {
        color: #52ff86;
        border-bottom: 1px solid rgba(82,255,134,.45);
      }
      .platform-brain-copy {
        display: grid;
        gap: 16px;
        align-content: start;
      }
      .platform-brain-copy-panel {
        border: 1px solid var(--line);
        border-radius: 10px;
        background: var(--panel);
        padding: 24px;
      }
      .platform-brain-copy-panel h3 {
        margin: 0 0 10px;
        color: var(--text);
        font-family: "Space Grotesk", "IBM Plex Sans", system-ui, sans-serif;
        font-size: 24px;
        line-height: 1.12;
      }
      .platform-brain-copy-panel p {
        margin: 0;
        color: var(--muted);
        font-size: 15.5px;
        line-height: 1.62;
      }
      .platform-brain-region-list {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .platform-brain-region {
        display: grid;
        grid-template-columns: 72px 1fr;
        gap: 14px;
        align-items: baseline;
        padding: 12px 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(255,255,255,.02);
      }
      .platform-brain-region strong {
        color: #52ff86;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        font-size: 12px;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .platform-brain-region span {
        color: var(--muted);
        font-size: 13.5px;
        line-height: 1.42;
      }
      @keyframes platform-brain-target-pulse {
        0%, 100% { transform: scale(.88); opacity: .46; }
        50% { transform: scale(1.08); opacity: .88; }
      }
      @keyframes platform-brain-cursor { 50% { opacity: 0; } }
      @media (max-width: 960px) {
        .platform-brain-layout { grid-template-columns: 1fr; }
        .platform-brain-stage { min-height: 430px; }
      }
      @media (max-width: 560px) {
        .platform-brain-stage { min-height: 430px; }
        .platform-brain-callout-label {
          min-width: 78px;
          padding: 7px 8px 7px 12px;
          font-size: 10px;
        }
        .platform-brain-terminal {
          left: 8px;
          right: 8px;
          bottom: 8px;
        }
        .platform-brain-terminal-header {
          font-size: 8px;
          letter-spacing: .10em;
        }
        .platform-brain-terminal-body {
          min-height: 132px;
          padding: 10px 11px 12px;
        }
        .platform-brain-terminal-title { font-size: 13px; }
        .platform-brain-terminal-text { font-size: 11px; }
        .platform-brain-region { grid-template-columns: 1fr; gap: 4px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .platform-brain-callout-target-pulse,
        .platform-brain-terminal-cursor {
          animation: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureScript(src) {
    const existing = Array.from(document.scripts).find((script) => script.src === src);
    if (existing) {
      return existing.dataset.loaded === 'true'
        ? Promise.resolve()
        : new Promise((resolve) => {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', resolve, { once: true });
        });
    }
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.loaded = 'false';
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', resolve, { once: true });
      document.head.appendChild(script);
    });
  }

  function waitForThree(attempt) {
    attempt = attempt || 0;
    if (window.THREE && window.THREE.WebGLRenderer) {
      if (window.THREE.GLTFLoader) return Promise.resolve(window.THREE);
      return ensureScript(loaderUrl).then(() => window.THREE);
    }
    if (attempt > 40) return Promise.resolve(null);
    return new Promise((resolve) => {
      setTimeout(() => resolve(waitForThree(attempt + 1)), 120);
    });
  }

  function initCreditPanel(stage) {
    const infoButton = stage.querySelector('.platform-brain-info-button');
    const creditPanel = stage.querySelector('.platform-brain-credit-panel');
    if (!infoButton || !creditPanel) return;

	    function setOpen(open) {
	      creditPanel.hidden = !open;
	      infoButton.setAttribute('aria-expanded', String(open));
	    }

	    setOpen(false);
	    infoButton.addEventListener('click', (event) => {
	      event.stopPropagation();
	      setOpen(creditPanel.hidden);
    });
    creditPanel.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', (event) => {
      if (creditPanel.hidden) return;
      if (event.target !== infoButton && !creditPanel.contains(event.target)) setOpen(false);
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
  }

	  function initStage(stage) {
	    if (stage.__platformBrainInitialized === true) return;
	    stage.__platformBrainInitialized = true;
	    stage.dataset.platformBrainInitialized = 'true';
	    injectStyles();
	    initCreditPanel(stage);

    const canvas = stage.querySelector('.platform-brain-canvas');
    const calloutLine = stage.querySelector('.platform-brain-callout-line');
    const calloutTarget = stage.querySelector('.platform-brain-callout-target');
    const calloutLabel = stage.querySelector('.platform-brain-callout-label');
    const calloutText = stage.querySelector('.platform-brain-callout-text');
    const readoutTitle = stage.querySelector('.platform-brain-readout-title');
    const readoutMeta = stage.querySelector('.platform-brain-readout-meta');
    const readoutBody = stage.querySelector('.platform-brain-readout-body');
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canvas || !calloutLine || !calloutLabel || !calloutText) return;

    function sizeStage() {
      const rect = stage.getBoundingClientRect();
      return {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height))
      };
    }

    function lerpAngle(a, b, t) {
      const twoPi = Math.PI * 2;
      let delta = (b - a + Math.PI) % twoPi;
      if (delta < 0) delta += twoPi;
      delta -= Math.PI;
      return a + delta * t;
    }

    function activeFrame(timeMs) {
      const cycle = reducedMotion ? 11000 : 8200;
      const transition = reducedMotion ? 2200 : 980;
      const lineStart = transition + 180;
      const nameStart = lineStart + 220;
      const bodyStart = nameStart + 620;
      const fadeOut = 760;
      const cycleIndex = Math.floor(timeMs / cycle);
      const phase = timeMs - cycleIndex * cycle;
      const activeIndex = cycleIndex % regions.length;
      const active = regions[activeIndex];
      const previous = regions[(activeIndex + regions.length - 1) % regions.length];
      const turn = easeOutCubic(phase / transition);
      const holdSeconds = Math.max(0, phase - transition) / 1000;
      const yaw = phase < transition
        ? lerpAngle(previous.yaw, active.yaw, turn)
        : active.yaw + Math.sin(holdSeconds * 0.44) * 0.10 + holdSeconds * 0.015;
      const lineProgress = clamp((phase - lineStart) / 520, 0, 1);
      const nameProgress = clamp((phase - nameStart) / 620, 0, 1);
      const bodyProgress = clamp((phase - bodyStart) / 3000, 0, 1);
      const nameLetters = Math.floor(nameProgress * (active.name.length + 1));
      const bodyLetters = Math.floor(bodyProgress * (active.description.length + 1));
      const fade = phase > cycle - fadeOut ? clamp((cycle - phase) / fadeOut, 0, 1) : 1;
      const cursorOn = Math.floor(timeMs / 180) % 2 === 0;
      return {
        active,
        yaw,
        lineProgress,
        labelAlpha: lineProgress * fade,
        labelText: active.name.slice(0, nameLetters) + (nameLetters < active.name.length && cursorOn ? '_' : ''),
        bodyText: active.description.slice(0, bodyLetters),
        markerScale: 1.10 + Math.sin(timeMs / 140) * 0.10
      };
    }

    function segmentLength(points) {
      let length = 0;
      for (let i = 1; i < points.length; i += 1) {
        length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      }
      return length;
    }

    function updateCallout(region, anchorX, anchorY, frame) {
      const size = sizeStage();
      const labelWidth = Math.max(calloutLabel.offsetWidth || 92, 78);
      const labelHeight = Math.max(calloutLabel.offsetHeight || 28, 24);
      const offset = clamp(size.width * 0.18, 74, 140);
      const side = region.side || (anchorX < size.width / 2 ? 1 : -1);
      const labelX = clamp(
        side < 0 ? anchorX - offset - labelWidth : anchorX + offset,
        8,
        size.width - labelWidth - 8
      );
      const labelY = clamp(anchorY + region.labelDy, 12, size.height - labelHeight - 132);
      const endX = side < 0 ? labelX + labelWidth : labelX;
      const endY = labelY + labelHeight * 0.5;
      const elbowX = anchorX + side * clamp(size.width * 0.08, 34, 64);
      const elbowY = anchorY + region.elbowDy;
      const points = [
        [anchorX, anchorY],
        [elbowX, elbowY],
        [endX, endY]
      ];
      const length = Math.max(1, segmentLength(points));

      calloutText.textContent = frame.labelText;
      calloutLabel.style.opacity = String(frame.labelAlpha);
      calloutLabel.style.transform = `translate(${labelX}px, ${labelY}px)`;
      calloutLine.setAttribute('points', points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
      calloutLine.style.opacity = String(frame.labelAlpha);
      calloutLine.style.strokeDasharray = length.toFixed(1);
      calloutLine.style.strokeDashoffset = (length * (1 - frame.lineProgress)).toFixed(1);
      if (calloutTarget) {
        calloutTarget.setAttribute('transform', `translate(${anchorX.toFixed(1)} ${anchorY.toFixed(1)})`);
        calloutTarget.style.opacity = String(frame.labelAlpha);
      }
    }

    function updateReadout(frame) {
      if (!readoutTitle || !readoutMeta || !readoutBody) return;
      readoutTitle.textContent = frame.active.name;
      readoutMeta.textContent = frame.active.role;
      readoutBody.textContent = `> ${frame.bodyText}`;
    }

    function startFallback() {
      const context = canvas.getContext('2d');
      if (!context || canvas.dataset.fallbackStarted === 'true') return;
      canvas.dataset.fallbackStarted = 'true';
      function draw(now) {
        const size = sizeStage();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== size.width * dpr || canvas.height !== size.height * dpr) {
          canvas.width = size.width * dpr;
          canvas.height = size.height * dpr;
        }
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, size.width, size.height);
        context.save();
        context.translate(size.width * 0.52, size.height * 0.34);
        const scale = Math.min(size.width / 620, size.height / 560);
        context.scale(scale, scale);
        context.strokeStyle = 'rgba(82,255,134,.62)';
        context.fillStyle = 'rgba(82,255,134,.08)';
        context.lineWidth = 1.25;
        context.beginPath();
        context.moveTo(-154, -36);
        context.bezierCurveTo(-130, -140, 82, -154, 172, -50);
        context.bezierCurveTo(244, 34, 120, 116, -42, 88);
        context.bezierCurveTo(-162, 74, -216, 24, -154, -36);
        context.fill();
        context.stroke();
        for (let i = -100; i <= 100; i += 18) {
          context.beginPath();
          context.bezierCurveTo(-130, i * 0.32, -42, i - 28, 112, i * 0.42);
          context.stroke();
        }
        context.restore();

        const frame = activeFrame(now);
        updateCallout(frame.active, size.width * 0.44, size.height * 0.30, frame);
        updateReadout(frame);
        window.requestAnimationFrame(draw);
      }
      window.requestAnimationFrame(draw);
    }

    waitForThree().then((THREE) => {
      if (!THREE || !THREE.WebGLRenderer || !THREE.GLTFLoader) {
        startFallback();
        return;
      }

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if ('outputEncoding' in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0.10, 0.08, 4.95);
      camera.lookAt(0, 0, 0);

      const brain = new THREE.Group();
      brain.rotation.set(-0.08, regions[0].yaw, -0.035);
      scene.add(brain);

      const hud = new THREE.Group();
      scene.add(hud);

      function lineMaterial(opacity, color, options = {}) {
        const additive = options.additive !== false;
        return new THREE.LineBasicMaterial({
          color: color || green,
          transparent: true,
          opacity,
          blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
          depthWrite: false,
          depthTest: options.depthTest === true
        });
      }

      const fillMaterial = new THREE.MeshBasicMaterial({
        color: dimGreen,
        transparent: true,
        opacity: 0.34,
        blending: THREE.NormalBlending,
        depthWrite: true,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        side: THREE.DoubleSide
      });
      const wireMaterial = lineMaterial(0.42, 0xe9fff1, { additive: false, depthTest: true });
      const activeMaterial = lineMaterial(0.92);

      function addHudRings() {
        [1.72, 2.05, 2.38].forEach((radius, index) => {
          const points = [];
          for (let i = 0; i <= 180; i += 1) {
            const a = (i / 180) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius * 0.66, 0));
          }
          const ring = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            lineMaterial(0.12 - index * 0.025, index === 0 ? green : blueGreen)
          );
          ring.rotation.x = 0.08 + index * 0.22;
          ring.rotation.y = -0.16 + index * 0.13;
          hud.add(ring);
        });
      }

      function makeTargetMarker() {
        const group = new THREE.Group();
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.105, 0.006, 6, 48),
          new THREE.MeshBasicMaterial({
            color: green,
            transparent: true,
            opacity: 0.94,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false
          })
        );
        const crossGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-0.19, 0, 0), new THREE.Vector3(0.19, 0, 0),
          new THREE.Vector3(0, -0.19, 0), new THREE.Vector3(0, 0.19, 0)
        ]);
        const cross = new THREE.LineSegments(crossGeometry, activeMaterial);
        group.renderOrder = 10;
        group.add(ring, cross);
        return group;
      }

      addHudRings();
      const marker = makeTargetMarker();
      brain.add(marker);

      const loader = new THREE.GLTFLoader();
      loader.load(
        stage.dataset.model || 'assets/brain-poly-google.glb',
        (gltf) => {
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root) throw new Error('Brain GLB did not contain a scene.');
          const wrapper = new THREE.Group();
          const bounds = new THREE.Box3().setFromObject(root);
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z, 1);
          root.position.sub(center);
          wrapper.scale.setScalar(2.55 / maxDim);
          root.traverse((object) => {
            if (!object.isMesh || !object.geometry) return;
            object.material = fillMaterial.clone();
            object.renderOrder = 1;
            object.frustumCulled = false;
            const wire = new THREE.LineSegments(
              new THREE.WireframeGeometry(object.geometry),
              wireMaterial.clone()
            );
            wire.name = 'brain-wire-overlay';
            wire.renderOrder = 2;
            wire.frustumCulled = false;
            object.add(wire);
          });
          wrapper.add(root);
          brain.add(wrapper);
          stage.dataset.brainModel = 'loaded';
          window.__platformBrainModelLoaded = true;
        },
        undefined,
        (error) => {
          stage.dataset.brainModel = 'error';
          window.__platformBrainModelError = error && error.message ? error.message : String(error);
          startFallback();
        }
      );

	      let lastRenderWidth = 0;
	      let lastRenderHeight = 0;
	      function resize() {
	        const size = sizeStage();
	        const compact = size.width < 520;
	        if (size.width === lastRenderWidth && size.height === lastRenderHeight) return;
	        lastRenderWidth = size.width;
	        lastRenderHeight = size.height;
	        renderer.setSize(size.width, size.height, false);
	        camera.aspect = size.width / size.height;
	        camera.position.set(0.10, compact ? 0.18 : 0.08, compact ? 5.90 : 4.95);
	        camera.lookAt(0, compact ? 0.08 : 0, 0);
	        camera.updateProjectionMatrix();
	        brain.position.y = compact ? 0.28 : 0.18;
	        brain.scale.setScalar(compact ? 0.76 : 1);
        hud.position.y = brain.position.y;
        hud.scale.setScalar(compact ? 0.82 : 1);
      }

      if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(stage);
      } else {
        window.addEventListener('resize', resize);
	      }
	      resize();
	      window.setTimeout(resize, 120);
	      window.setTimeout(resize, 650);

	      function animate(now) {
	        resize();
	        const frame = activeFrame(now);
	        const seconds = now / 1000;
	        const activeAnchor = new THREE.Vector3().fromArray(frame.active.anchor);

        brain.rotation.y = frame.yaw;
        brain.rotation.x = -0.08 + Math.sin(seconds * 0.24) * 0.018;
        brain.rotation.z = -0.035 + Math.sin(seconds * 0.18) * 0.014;
        hud.rotation.z = seconds * 0.024;
        hud.rotation.y = -brain.rotation.y * 0.18;

        marker.position.copy(activeAnchor);
        marker.scale.setScalar(frame.markerScale);
        marker.lookAt(camera.position);

        brain.updateMatrixWorld();
        const projected = activeAnchor.clone().applyMatrix4(brain.matrixWorld).project(camera);
        const size = sizeStage();
        const anchorX = (projected.x * 0.5 + 0.5) * size.width;
        const anchorY = (-projected.y * 0.5 + 0.5) * size.height;

        updateCallout(frame.active, anchorX, anchorY, frame);
        updateReadout(frame);
        renderer.render(scene, camera);
        window.requestAnimationFrame(animate);
      }

      window.requestAnimationFrame(animate);
    });
  }

	  function initAll() {
	    injectStyles();
	    document.querySelectorAll('.platform-brain-stage').forEach(initStage);
	  }

	  window.initPlatformBrain = initAll;
	  let observerStarted = false;
	  function startObserver() {
	    if (observerStarted || !('MutationObserver' in window) || !document.body) return;
	    observerStarted = true;
	    const observer = new MutationObserver(() => initAll());
	    observer.observe(document.body, { childList: true, subtree: true });
	  }
	  if (document.readyState === 'loading') {
	    document.addEventListener('DOMContentLoaded', () => {
	      initAll();
	      startObserver();
	    }, { once: true });
	  } else {
	    initAll();
	    startObserver();
	  }
	}());
