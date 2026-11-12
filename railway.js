(() => {
  const W = RailwayWorld;
  const byId = id => document.getElementById(id);
  const root = byId('journey');
  const canvas = byId('world');
  const menu = byId('feature-menu');
  const menuToggle = byId('menu-toggle');
  const experiencePanel = byId('experience-panel');
  const experienceToggle = byId('experience-toggle');
  const cameraPanel = byId('camera-panel');
  const cameraToggle = byId('camera-toggle');
  const installPanel = byId('install-panel');
  const installToggle = byId('install-toggle');
  const cameraOptions = [...cameraPanel.querySelectorAll('input[type="radio"]')];
  const cameraPreference = 'midnight-railway.camera';
  const returnLive = byId('return-live');
  const scrub = byId('scrub');
  const freeze = byId('freeze');
  const ticketToggle = byId('ticket-toggle');
  const departures = byId('departures');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const routeBounds = W.railSections.reduce((bounds, section) => ({
    left: Math.min(bounds.left, section.left), right: Math.max(bounds.right, section.right),
    north: Math.min(bounds.north, section.north), south: Math.max(bounds.south, section.south)
  }), { left: Infinity, right: -Infinity, north: Infinity, south: -Infinity });
  let view = 'aerial';
  let overheadMode = savedCameraMode();
  let freeFrame = null;
  let drag = null;
  let paused = reducedMotion.matches;
  let experience = null;
  let frozenMinute = localMinute();
  let gl;

  function savedCameraMode() {
    try {
      const saved = localStorage.getItem(cameraPreference);
      if (cameraOptions.some(option => option.value === saved)) return saved;
    } catch {
      // A local-file browser session can disallow storage.
    }
    return 'section';
  }
  function planetMap() {
    const track = byId('planet-track');
    const train = byId('planet-train');
    const centerX = (routeBounds.left + routeBounds.right) / 2;
    const centerZ = (routeBounds.north + routeBounds.south) / 2;
    const radius = Math.hypot(routeBounds.right - centerX, routeBounds.south - centerZ);
    function coordinates([x,,z]) {
      const u = (x - centerX) / radius;
      const v = (z - centerZ) / radius;
      const arc = Math.hypot(u, v);
      const scale = arc ? 44 * Math.sin(arc * 1.1) / arc : 44 * 1.1;
      return [(50 + u * scale).toFixed(3), (50 + v * scale).toFixed(3)].join(' ');
    }
    const count = Math.ceil(W.total / 34);
    const path = Array.from({ length: count }, (_, i) => coordinates(W.position(i * W.total / count)));
    track.setAttribute('d', 'M' + path.join('L') + 'Z');
    train.removeAttribute('visibility');
    let lastPoint = '';
    return distance => {
      const point = coordinates(W.position(distance));
      if (point === lastPoint) return;
      train.setAttribute('transform', 'translate(' + point + ')');
      lastPoint = point;
    };
  }
  const showPlanetPosition = planetMap();

  function localMinute() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
  }
  function activeMinute(now = performance.now()) {
    if (!experience) return paused ? frozenMinute : localMinute();
    const elapsed = paused ? 0 : Math.max(0, now - experience.started) / 60000;
    return W.wrap(experience.minute + elapsed, W.DAY);
  }
  function clock(minute) {
    const total = Math.floor(W.wrap(minute, W.DAY));
    const two = n => String(n).padStart(2, '0');
    return two(Math.floor(total / 60)) + ':' + two(total % 60);
  }
  function remaining(minutes) {
    const rounded = Math.ceil(minutes);
    const hours = Math.floor(rounded / 60);
    const rest = rounded % 60;
    return '还有 ' + (hours ? hours + ' 小时' + (rest ? ' ' : '') : '') + (rest || !hours ? rest + ' 分钟' : '');
  }

  const ui = {
    chapterIndex: byId('chapter-index'), chapterName: byId('chapter-name'),
    label: byId('ticket-label'), name: byId('ticket-name'), time: byId('ticket-time'),
    countdown: byId('ticket-countdown'), experienceClock: byId('experience-clock')
  };
  function syncExperienceClock(minute) {
    ui.experienceClock.value = clock(minute);
    if (!scrub.matches(':active')) scrub.value = Math.floor(minute);
  }
  let lastUi = '';
  function updateUi(minute, chapter) {
    const current = W.stops.find(stop => W.wrap(minute - stop.minute, W.DAY) < stop.duration);
    const next = current || W.stops.find(stop => stop.minute > minute) || W.stops[0];
    const key = [Math.floor(minute), chapter.index, next.minute, Boolean(current)].join();
    if (lastUi === key) return;
    lastUi = key;
    ui.chapterIndex.textContent = String(chapter.index + 1).padStart(2, '0') + ' / ' + String(W.chapters.length).padStart(2, '0');
    ui.chapterName.textContent = chapter.name;
    ui.label.textContent = current ? '正在经过' : '下一站';
    ui.name.textContent = next.name;
    ui.time.textContent = clock(next.minute);
    ui.time.dateTime = clock(next.minute);
    ui.countdown.textContent = current ? '观景路段' : remaining(W.wrap(next.minute - minute, W.DAY));
    if (!menu.hidden && !experiencePanel.hidden) syncExperienceClock(minute);
  }

  for (const stop of W.stops) {
    const time = document.createElement('time');
    time.dateTime = clock(stop.minute);
    time.textContent = clock(stop.minute);
    const item = document.createElement('li');
    item.append(stop.name, time);
    departures.append(item);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = stop.name;
    button.addEventListener('click', () => chooseTime(stop.minute));
    byId('experience-stops').append(button);
  }

  function setView(next) {
    view = next;
    root.classList.toggle('is-cabin', next === 'cabin');
    const free = isFreeView();
    root.classList.toggle('is-free', free);
    if (free) canvas.tabIndex = 0;
    else {
      canvas.removeAttribute('tabindex');
      stopDrag();
    }
    byId('aerial').setAttribute('aria-pressed', String(next === 'aerial'));
    byId('window').setAttribute('aria-pressed', String(next === 'cabin'));
  }
  function isFreeView() {
    return view === 'aerial' && overheadMode === 'free';
  }
  function selectCamera(mode) {
    if (mode === 'free' && overheadMode !== 'free') {
      const aspect = root.clientWidth / Math.max(1, root.clientHeight);
      const previous = overheadCamera(W.distanceAt(activeMinute()), aspect, overheadMode);
      freeFrame = { target: previous.target, offset: W.sub(previous.eye, previous.target) };
    }
    overheadMode = mode;
    try {
      localStorage.setItem(cameraPreference, mode);
    } catch {
      // The selected camera is still usable for this session.
    }
    syncCameraChoice();
    setView('aerial');
  }
  function syncCameraChoice() {
    for (const option of cameraOptions) option.checked = option.value === overheadMode;
    byId('free-hint').hidden = overheadMode !== 'free';
  }
  for (const option of cameraOptions) {
    option.addEventListener('change', () => selectCamera(option.value));
  }
  syncCameraChoice();
  setView(view);
  byId('aerial').addEventListener('click', () => setView('aerial'));
  byId('window').addEventListener('click', () => setView('cabin'));
  function moveFreeCamera(deltaX, deltaY) {
    if (!freeFrame) return;
    const { target, offset } = freeFrame;
    const aspect = root.clientWidth / Math.max(1, root.clientHeight);
    const scale = 2 * Math.hypot(...offset) * Math.tan(overheadFov(aspect) * Math.PI / 360) / Math.max(1, canvas.clientHeight);
    const back = W.unit(offset);
    const right = W.unit(W.cross([0, 1, 0], back));
    const up = W.cross(back, right);
    const forward = W.unit([offset[0], 0, offset[2]]);
    const translated = W.add(target, W.add(W.mul(right, -deltaX * scale), W.mul(forward, deltaY * scale / W.dot(forward, up))));
    const margin = 380;
    freeFrame.target = [
      W.clamp(translated[0], routeBounds.left - margin, routeBounds.right + margin),
      target[1],
      W.clamp(translated[2], routeBounds.north - margin, routeBounds.south + margin)
    ];
  }
  function stopDrag() {
    if (!drag) return;
    const id = drag.id;
    drag = null;
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    root.classList.remove('is-panning');
  }
  canvas.addEventListener('pointerdown', event => {
    if (!isFreeView() || drag || (event.pointerType !== 'touch' && event.button !== 2)) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    root.classList.add('is-panning');
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (event.pointerType === 'mouse' && !(event.buttons & 2)) {
      stopDrag();
      return;
    }
    moveFreeCamera(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => {
      if (drag?.id === event.pointerId) stopDrag();
    });
  }
  canvas.addEventListener('contextmenu', event => {
    if (isFreeView()) event.preventDefault();
  });
  canvas.addEventListener('keydown', event => {
    const step = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[event.key];
    if (!isFreeView() || !step) return;
    event.preventDefault();
    moveFreeCamera(...step);
  });
  function setDepartures(open) {
    departures.hidden = !open;
    ticketToggle.setAttribute('aria-expanded', String(open));
  }
  function setMenu(open) {
    if (open) setDepartures(false);
    menu.hidden = !open;
    root.classList.toggle('is-menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    if (open && !experiencePanel.hidden) syncExperienceClock(activeMinute());
  }
  menuToggle.addEventListener('click', () => setMenu(menu.hidden));
  ticketToggle.addEventListener('click', () => {
    const open = departures.hidden;
    if (open) setMenu(false);
    setDepartures(open);
  });
  function showPanel(button, panel, open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }
  experienceToggle.addEventListener('click', () => {
    const open = experiencePanel.hidden;
    showPanel(experienceToggle, experiencePanel, open);
    if (open) {
      showPanel(cameraToggle, cameraPanel, false);
      showPanel(installToggle, installPanel, false);
      syncExperienceClock(activeMinute());
    }
  });
  cameraToggle.addEventListener('click', () => {
    const open = cameraPanel.hidden;
    showPanel(cameraToggle, cameraPanel, open);
    if (open) {
      showPanel(experienceToggle, experiencePanel, false);
      showPanel(installToggle, installPanel, false);
    }
  });
  installToggle.addEventListener('click', () => {
    const open = installPanel.hidden;
    showPanel(installToggle, installPanel, open);
    if (open) {
      showPanel(experienceToggle, experiencePanel, false);
      showPanel(cameraToggle, cameraPanel, false);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!menu.hidden) {
      setMenu(false);
      menuToggle.focus();
    } else if (!departures.hidden) {
      setDepartures(false);
      ticketToggle.focus();
    }
  });
  function showExperienceState() {
    root.classList.toggle('is-experience', Boolean(experience));
    returnLive.hidden = !experience;
    menuToggle.setAttribute('aria-label', experience ? '功能菜单，正在体验选定时段' : '功能菜单');
  }
  function chooseTime(minute) {
    setPaused(false);
    experience = { minute: W.wrap(minute, W.DAY), started: performance.now() };
    freeFrame = null;
    showExperienceState();
    syncExperienceClock(experience.minute);
    lastUi = '';
  }
  returnLive.addEventListener('click', () => {
    experience = null;
    frozenMinute = localMinute();
    freeFrame = null;
    showExperienceState();
    syncExperienceClock(frozenMinute);
    experienceToggle.focus();
    lastUi = '';
  });
  scrub.addEventListener('input', () => chooseTime(Number(scrub.value)));
  function setPaused(next) {
    if (experience) {
      const now = performance.now();
      experience.minute = activeMinute(now);
      experience.started = now;
    }
    paused = next;
    if (paused) frozenMinute = localMinute();
    freeze.setAttribute('aria-pressed', String(paused));
    freeze.setAttribute('aria-label', paused ? '继续播放' : '暂停画面');
    freeze.title = paused ? '继续播放' : '暂停画面';
    byId('freeze-label').textContent = paused ? '继续' : '暂停';
    byId('freeze-icon').setAttribute('d', paused ? 'm8 5 11 7-11 7V5Z' : 'M9 5v14m6-14v14');
  }
  setPaused(paused);
  reducedMotion.addEventListener('change', event => setPaused(event.matches));
  freeze.addEventListener('click', () => setPaused(!paused));
  const fullscreen = byId('fullscreen');
  fullscreen.hidden = !document.fullscreenEnabled;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      fullscreen.title = '浏览器全屏快捷键 F11';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const label = document.fullscreenElement ? '退出全屏' : '全屏';
    fullscreen.setAttribute('aria-label', label);
    fullscreen.title = label;
    byId('fullscreen-label').textContent = label;
  });

  const lightCycle = [
    { time: 0, top: [16,28,44], horizon: [62,83,96], light: [.46,.55,.73], night: 1 },
    { time: 300, top: [33,47,70], horizon: [93,103,122], light: [.53,.62,.75], night: .82 },
    { time: 390, top: [96,139,149], horizon: [231,184,139], light: [.97,.83,.73], night: .30 },
    { time: 520, top: [95,145,151], horizon: [194,209,176], light: [1.02,1.04,.94], night: 0 },
    { time: 960, top: [102,149,156], horizon: [198,213,182], light: [1.05,1.04,.95], night: 0 },
    { time: 1122, top: [96,109,139], horizon: [240,181,129], light: [1.01,.85,.76], night: .42 },
    { time: 1200, top: [28,43,71], horizon: [91,102,127], light: [.63,.66,.82], night: .85 },
    { time: 1440, top: [16,28,44], horizon: [62,83,96], light: [.46,.55,.73], night: 1 }
  ];
  const blend = (a, b, t) => a.map((value, i) => W.mix(value, b[i], t));
  function lighting(minute) {
    const next = lightCycle.findIndex(key => key.time > minute);
    const [a, b] = [lightCycle[next - 1], lightCycle[next]];
    const t = W.smooth((minute - a.time) / (b.time - a.time));
    const top = blend(a.top, b.top, t);
    const horizon = blend(a.horizon, b.horizon, t);
    return { top, horizon, light: blend(a.light,b.light,t), night: W.mix(a.night,b.night,t) };
  }

  function viewMatrix(eye, target) {
    const z = W.unit(W.sub(eye, target));
    const x = W.unit(W.cross([0, 1, 0], z));
    const y = W.cross(z, x);
    return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -W.dot(x,eye),-W.dot(y,eye),-W.dot(z,eye),1];
  }
  function projection(fov, aspect, near = .15, far = 650) {
    const f = 1 / Math.tan(fov * Math.PI / 360);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)/(near-far),-1, 0,0,2*far*near/(near-far),0];
  }
  function camera(distance, aspect) {
    const current = W.chapters.findLastIndex(chapter => chapter.distance <= distance);
    const index = Math.max(0, current);
    const chapter = W.chapters[index];
    if (view === 'cabin') {
      const d = distance - 3.8;
      const at = W.position(d);
      const forward = W.heading(d);
      const side = [-forward[2], 0, forward[0]];
      const eye = W.add(W.add(at, [0, 1.28, 0]), W.mul(side, .63));
      const target = W.add(W.add(eye, W.mul(side, 20)), W.mul(forward, 3.4));
      return { eye, target, chapter, fov: aspect < 1 ? 79 : 56 };
    }
    if (overheadMode === 'free' && !freeFrame) {
      const initial = overheadCamera(distance, aspect, 'section');
      freeFrame = { target: initial.target, offset: W.sub(initial.eye, initial.target) };
    }
    return { ...overheadCamera(distance, aspect, overheadMode), chapter };
  }
  function overheadFov(aspect) {
    return W.mix(43, 54, W.clamp((1 - aspect) * 1.5, 0, 1));
  }
  function overheadOffset(radius) {
    return [radius * .61, radius * .99, radius * .77];
  }
  function overheadCamera(distance, aspect, mode) {
    const fov = overheadFov(aspect);
    if (mode === 'free') {
      const { target, offset } = freeFrame;
      return { eye: W.add(target, offset), target, fov };
    }
    if (mode === 'follow') {
      const target = W.add(W.position(distance), [0, .9, 0]);
      return { eye: W.add(target, overheadOffset(61)), target, fov };
    }
    const shots = Math.ceil(W.total / 72);
    const shotLength = W.total / shots;
    const shotIndex = Math.floor(distance / shotLength);
    const alongShot = distance - shotIndex * shotLength;
    const pan = W.smooth(W.clamp((alongShot - shotLength + 25) / 25, 0, 1));
    let target = blend(W.position((shotIndex + .5) * shotLength), W.position((shotIndex + 1.5) * shotLength), pan);
    let radius = 67;
    for (const shot of W.featureShots) {
      const edge = 22;
      const fromStart = W.wrap(distance - shot.start + edge, W.total) - edge;
      const blendAmount = W.smooth(W.clamp(Math.min(fromStart + edge, shot.end - shot.start + edge - fromStart) / edge, 0, 1));
      if (blendAmount === 0) continue;
      target = blend(target, shot.aim, blendAmount);
      radius = W.mix(radius, shot.radius, blendAmount);
    }
    const eyeOffset = overheadOffset(radius);
    const horizontal = W.unit([.77, 0, -.61]);
    const groundForward = W.unit([.61, 0, .77]);
    const away = W.unit(eyeOffset);
    const up = W.cross(away, horizontal);
    const train = W.sub(W.position(distance - 5.7), target);
    const depth = Math.hypot(...eyeOffset) - W.dot(train, away);
    const scale = Math.tan(fov * Math.PI / 360);
    // The shot holds while the train is inside the central area of the frame.
    const x = W.dot(train, horizontal);
    const y = W.dot(train, up);
    const vertical = scale * .64;
    const limitY = depth * vertical;
    const yDirection = Math.sign(y);
    const toward = W.dot(groundForward, away);
    const shiftY = (y - W.clamp(y, -limitY, limitY)) / (W.dot(groundForward, up) + yDirection * vertical * toward);
    const limitX = scale * (depth + shiftY * toward) * aspect * (aspect < 1 ? .53 : .65);
    const shiftX = x - W.clamp(x, -limitX, limitX);
    const framed = W.add(target, W.add(W.mul(horizontal, shiftX), W.mul(groundForward, shiftY)));
    return { eye: W.add(framed, eyeOffset), target: framed, fov };
  }

  const vertexSource = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec3 color;
    attribute float glow;
    uniform mat4 projection, camera;
    uniform vec3 offset, sun;
    uniform vec2 heading;
    uniform float modelScale;
    uniform mediump float pointScale;
    varying vec3 shade;
    varying vec3 location, seaPosition;
    varying float depth, emission;
    vec3 rotate(vec3 p) {
      return vec3(heading.x*p.x-heading.y*p.z,p.y,heading.y*p.x+heading.x*p.z);
    }
    void main() {
      vec3 world = rotate(position * modelScale) + offset;
      vec4 point = camera * vec4(world, 1.0);
      float diffuse = max(dot(rotate(normal), sun), 0.0);
      shade = color * (0.64 + 0.49 * diffuse);
      emission = glow;
      depth = length(point.xyz);
      location = world;
      seaPosition = world - vec3(${W.sea.x.toFixed(1)},0.0,${W.sea.z.toFixed(1)});
      gl_Position = projection * point;
      gl_PointSize = clamp(normal.x * pointScale / max(.1, -point.z), 1.0, 40.0);
    }`;
  const fragmentSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec3 light, mist;
    uniform float night, fogStart, fogRange, rippleTime, aquarium;
    uniform vec4 seaPhase;
    uniform vec2 seaShine;
    uniform vec3 seaAngles;
    uniform mediump float pointScale;
    varying vec3 shade;
    varying vec3 location, seaPosition;
    varying float depth, emission;
    void main() {
      if (pointScale > 0.0) {
        float edge = 1.0 - smoothstep(.10, .49, distance(gl_PointCoord, vec2(.5)));
        gl_FragColor = vec4(mix(vec3(.88,.87,.80), mist, night * .52), edge * emission);
        return;
      }
      if (emission < -1.5) {
        float alpha = clamp(-emission - 2.0, 0.0, 1.0);
        vec3 transparentColor = shade * light;
        if (alpha>.13 && alpha<.15 && abs(seaPosition.y-${W.sea.surface.toFixed(1)})<.03 && abs(seaPosition.x)<190.0 && abs(seaPosition.z)<140.0) {
          float pattern = seaPosition.x*.35+sin(seaPosition.z*.22);
          #ifdef GL_FRAGMENT_PRECISION_HIGH
          float shimmer = sin(pattern+seaAngles.z);
          #else
          float shimmer = sin(pattern)*seaShine.y+cos(pattern)*seaShine.x;
          #endif
          float shine = smoothstep(.91,1.0,shimmer);
          transparentColor += vec3(.10,.14,.13)*shine;
          alpha += shine*.035;
        }
        gl_FragColor = vec4(transparentColor, alpha);
        return;
      }
      vec3 lamp = vec3(1.0, .76, .41);
      vec3 color = shade * light + lamp * max(emission,0.0) * (.13 + night * .43);
      if (emission < -.5) {
        float ripple = sin(location.z * 2.6 + sin(location.x * .4) * .6 - rippleTime);
        float lightPath = pow(max(0.0, 1.0 - abs(location.x - 97.0) * .032), 2.0);
        float glint = smoothstep(.67, 1.0, ripple) * (.028 + .14 * lightPath);
        color += mix(vec3(.34,.66,.61), lamp, night) * glint;
      }
      if (abs(location.z - 73.55) < 7.0 && abs(location.x + 55.0) < 18.5) {
        float x = location.x + 66.0;
        float across = location.z - 73.55;
        float lampX = min(min(abs(x), abs(x - 8.0)), min(abs(x - 16.0), abs(x - 23.0)));
        float spill = max(0.0, 1.0 - length(vec2(lampX, across)) * .16);
        color += lamp * spill * spill * (.06 + night * .28);
      }
      if (aquarium > .05 && seaPosition.y < -6.8) {
        vec2 uv = seaPosition.xz * .42;
        float a = uv.x + sin(uv.y * 1.4);
        float b = uv.y + sin(uv.x * 1.3);
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        float wave = sin(a+seaAngles.x)*sin(b+seaAngles.y);
        #else
        float wave = (sin(a)*seaPhase.y+cos(a)*seaPhase.x) * (sin(b)*seaPhase.w+cos(b)*seaPhase.z);
        #endif
        float band = 1.0-smoothstep(0.0,.20,abs(wave));
        float caustic = band*band;
        color += vec3(.13,.17,.12) * caustic * aquarium;
      }
      float air = smoothstep(fogStart, fogStart + fogRange, depth) * .72;
      air = mix(air,smoothstep(fogStart,fogStart+fogRange,depth)*.999,aquarium);
      air *= mix(clamp(1.05 - location.y * .009, .74, 1.1),1.0,aquarium);
      gl_FragColor = vec4(mix(color, mist, air), 1.0);
    }`;

  function makeRenderer() {
    gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) throw new Error('当前浏览器无法启用 WebGL。可用开启硬件加速的 Chrome 或 Edge 打开。');
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const uniforms = Object.fromEntries(['projection','camera','offset','sun','heading','modelScale','light','mist','night','fogStart','fogRange','aquarium','rippleTime','seaPhase','seaShine','seaAngles','pointScale']
      .map(name => [name, gl.getUniformLocation(program,name)]));
    const attributes = ['position','normal','color','glow'].map(name => gl.getAttribLocation(program,name));
    for (const location of attributes) gl.enableVertexAttribArray(location);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    function buffer(data, usage = gl.STATIC_DRAW) {
      const handle = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, handle);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);
      return { handle, count: data.length / 10 };
    }
    const ground = buffer(W.terrain);
    const scenery = buffer(W.scenery);
    const engine = buffer(W.engine);
    const coach = buffer(W.coach);
    const tiles = new Map();
    const tracks = new Map();
    let visible = [];
    let visibleKey = '';
    function cachedMesh(cache, key, create) {
      const mesh = cache.get(key) || buffer(create());
      cache.delete(key);
      cache.set(key, mesh);
      return mesh;
    }
    function trimCache(cache, limit) {
      while (cache.size > limit) {
        const key = cache.keys().next().value;
        gl.deleteBuffer(cache.get(key).handle);
        cache.delete(key);
      }
    }
    function localScenery([x,,z]) {
      const size = W.tileSize;
      const column = Math.floor(x / size);
      const row = Math.floor(z / size);
      const radius = view === 'aerial' ? 2 : 3;
      const key = [column, row, radius].join();
      if (key === visibleKey) return visible;
      visibleKey = key;
      visible = [];
      const left = (column - radius) * size;
      const right = (column + radius + 1) * size;
      const north = (row - radius) * size;
      const south = (row + radius + 1) * size;
      const overlaps = area => area.left <= right && area.right >= left && area.north <= south && area.south >= north;
      if (overlaps(W.core)) visible.push(ground, scenery);
      for (let j = row - radius; j <= row + radius; j++) {
        for (let i = column - radius; i <= column + radius; i++) {
          const tile = cachedMesh(tiles, i + ',' + j, () => W.countryMesh(i, j));
          if (tile.count) visible.push(tile);
        }
      }
      for (const section of W.railSections) {
        if (overlaps(section)) visible.push(cachedMesh(tracks, section.start, () => W.railMesh(section)));
      }
      trimCache(tiles, 64);
      trimCache(tracks, 48);
      return visible;
    }
    const vaporData = new Float32Array(12 * 10);
    const vapor = buffer(vaporData, gl.DYNAMIC_DRAW);
    function draw(mesh, offset = [0,0,0], heading = [1,0,0], mode = gl.TRIANGLES, scale = 1) {
      gl.uniform3fv(uniforms.offset, offset);
      gl.uniform2f(uniforms.heading, heading[0], heading[2]);
      gl.uniform1f(uniforms.modelScale,scale);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.handle);
      attributes.forEach((attribute, i) => gl.vertexAttribPointer(attribute, i === 3 ? 1 : 3, gl.FLOAT, false, 40, i * 12));
      gl.drawArrays(mode, 0, mesh.count);
    }
    function drawVapor(minute, seconds, fov) {
      const lifetime = 3.6;
      for (let i = 0; i < vapor.count; i++) {
        const age = W.wrap(seconds + i * lifetime / vapor.count, lifetime);
        const past = W.distanceAt(minute - age / 60);
        // Each puff starts at the chimney's earlier position, then drifts upward.
        const source = W.position(past);
        const heading = W.heading(past);
        const fade = Math.min(age * 4, 1) * (1 - age / lifetime) ** 1.25;
        vaporData.set([
          source[0] + heading[0] * 1.05 + age * .24,
          source[1] + 2.07 + age * .62,
          source[2] + heading[2] * 1.05 - age * .17 + Math.sin(i * 2.1) * age * .10,
          .40 + age * .54, 0, 0, 0, 0, 0, fade * .38
        ], i * 10);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, vapor.handle);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vaporData);
      gl.uniform1f(uniforms.pointScale, canvas.height / (2 * Math.tan(fov * Math.PI / 360)));
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      draw(vapor, undefined, undefined, gl.POINTS);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.uniform1f(uniforms.pointScale, 0);
    }
    let cabin = null;
    let cabinAspect = 0;
    const steamBuffer = buffer([],gl.DYNAMIC_DRAW);
    let steamCapacity = 0;
    function drawTransparent(mesh, offset, heading, scale = 1) {
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      draw(mesh,offset,heading,gl.TRIANGLES,scale);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    function drawCabin(aspect, sky, seconds) {
      if (cabinAspect !== aspect) {
        if (cabin) for (const mesh of [cabin.sill,cabin.objects,cabin.shadows,cabin.glass]) gl.deleteBuffer(mesh.handle);
        const scene = CabinScene.create(aspect);
        cabin = { ...scene, sill:buffer(scene.sill),objects:buffer(scene.objects),shadows:buffer(scene.shadows),glass:buffer(scene.glass) };
        cabinAspect = aspect;
      }
      gl.clear(gl.DEPTH_BUFFER_BIT);
      // The foreground has its own depth pass: reserve precision for thin petals and leaf veins.
      gl.uniformMatrix4fv(uniforms.projection,false,projection(cabin.fov,aspect,2,20));
      gl.uniformMatrix4fv(uniforms.camera,false,viewMatrix(cabin.eye,cabin.target));
      gl.uniform3fv(uniforms.light,sky.light.map((value,i) => W.mix([.95,.89,.78][i],value,.28)));
      gl.uniform1f(uniforms.fogStart,1000);
      gl.uniform1f(uniforms.aquarium,0);
      drawTransparent(cabin.glass);
      draw(cabin.sill);
      drawTransparent(cabin.shadows);
      draw(cabin.objects);
      const steam = CabinScene.steam(reducedMotion.matches ? 0 : seconds,cabin.steamOrigin);
      gl.bindBuffer(gl.ARRAY_BUFFER,steamBuffer.handle);
      if (steamCapacity !== steam.byteLength) {
        gl.bufferData(gl.ARRAY_BUFFER,steam.byteLength,gl.DYNAMIC_DRAW);
        steamCapacity = steam.byteLength;
      }
      gl.bufferSubData(gl.ARRAY_BUFFER,0,steam);
      steamBuffer.count = steam.length / 10;
      drawTransparent(steamBuffer);
    }
    let sea = null;
    const rayBuffer = buffer([],gl.DYNAMIC_DRAW);
    let rayCapacity = 0;
    function prepareSea() {
      if (sea) return;
      const model = MintSea.create();
      sea = Object.fromEntries(['reef','frames','glass','water','light','jelly','bubble'].map(key=>[key,buffer(model[key])]));
      sea.fish = model.fish.map(fish=>({body:buffer(fish.body),tail:buffer(fish.tail)}));
    }
    function drawSeaAnimals(seconds) {
      for (const fish of MintSea.fish(seconds)) {
        const model=sea.fish[fish.kind];
        draw(model.body,fish.position,fish.heading,gl.TRIANGLES,fish.size);
        const pivot=W.add(fish.position,W.mul(fish.heading,-.75*fish.size));
        const a=Math.atan2(fish.heading[2],fish.heading[0])+fish.tail;
        draw(model.tail,pivot,[Math.cos(a),0,Math.sin(a)],gl.TRIANGLES,fish.size);
      }
      const ray=MintSea.ray(seconds);
      gl.bindBuffer(gl.ARRAY_BUFFER,rayBuffer.handle);
      if(rayCapacity!==ray.data.byteLength) {
        gl.bufferData(gl.ARRAY_BUFFER,ray.data.byteLength,gl.DYNAMIC_DRAW);
        rayCapacity=ray.data.byteLength;
      }
      gl.bufferSubData(gl.ARRAY_BUFFER,0,ray.data);
      rayBuffer.count=ray.data.length/10;
      draw(rayBuffer,ray.position,ray.heading);
    }
    function drawSeaGlass(seconds) {
      drawTransparent(sea.glass);
      drawTransparent(sea.light);
      for(const [index,[x,z,y]] of [[58,-58,-1.7],[-15,-55,-1.2],[-91,76,-2.0]].entries()) {
        const pulse=1+.055*Math.sin(seconds*.78+index*2);
        drawTransparent(sea.jelly,[W.sea.x+x,y+Math.sin(seconds*.25+index)*.35,W.sea.z+z],undefined,pulse);
      }
      for(let i=0;i<18;i++) {
        const t=W.wrap(seconds*.075+i*.173,1),group=i%2;
        drawTransparent(sea.bubble,[W.sea.x+(group ? -57 : 78)+Math.sin(t*6+i)*.5,
          -9.2+t*11,W.sea.z+(group ? 66 : -39)+Math.cos(t*7+i)*.3],undefined,.045+(i%3)*.025);
      }
      drawTransparent(sea.water);
    }
    let lastSky = '';
    return function render(minute, distance, cam, aspect, seconds) {
      const ordinarySky = lighting(minute);
      const seaAmount = MintSea.influence(cam.target);
      const underwater = view==='cabin' ? seaAmount*W.smooth(W.clamp((W.sea.surface-cam.eye[1])/3.2,0,1)) : 0;
      const sky = { top:blend(ordinarySky.top,[49,119,142],underwater),
        horizon:blend(ordinarySky.horizon,[124,188,186],underwater),
        light:blend(ordinarySky.light,[.94,1.02,.99],seaAmount*.94),
        night:W.mix(ordinarySky.night,.24,seaAmount) };
      const nearSea = Math.hypot(cam.target[0]-W.sea.x,cam.target[2]-W.sea.z)<430;
      const rgb = values => values.map(Math.round).join(',');
      const backdrop = 'linear-gradient(rgb(' + rgb(sky.top) + '),rgb(' + rgb(sky.horizon) + ') 69%)';
      if (lastSky !== backdrop) {
        root.style.background = backdrop;
        lastSky = backdrop;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(uniforms.projection, false, projection(cam.fov, aspect));
      gl.uniformMatrix4fv(uniforms.camera, false, viewMatrix(cam.eye, cam.target));
      gl.uniform3fv(uniforms.sun, W.unit([-.61, .80, -.34]));
      gl.uniform3fv(uniforms.light, sky.light);
      gl.uniform3fv(uniforms.mist, sky.horizon.map(v => v / 255));
      gl.uniform1f(uniforms.night, sky.night);
      gl.uniform1f(uniforms.fogStart, underwater>.1 ? 12 : view === 'aerial' ? 86 : 25);
      gl.uniform1f(uniforms.fogRange,W.mix(220,60,underwater));
      gl.uniform1f(uniforms.aquarium,underwater);
      gl.uniform1f(uniforms.rippleTime, minute * .47);
      // Bounded angles on highp GPUs; unit rotors on mediump GPUs avoid rounded, frozen time.
      const seaSeconds=reducedMotion.matches ? 0 : seconds;
      const phaseA=seaSeconds*.15,phaseB=1.7-seaSeconds*.125,shinePhase=seaSeconds*.025-.2;
      gl.uniform4f(uniforms.seaPhase,Math.sin(phaseA),Math.cos(phaseA),Math.sin(phaseB),Math.cos(phaseB));
      gl.uniform2f(uniforms.seaShine,Math.sin(shinePhase),Math.cos(shinePhase));
      const angle=p=>W.wrap(p+Math.PI,Math.PI*2)-Math.PI;
      gl.uniform3f(uniforms.seaAngles,angle(phaseA),angle(phaseB),angle(shinePhase));
      for (const mesh of localScenery(cam.target)) draw(mesh);
      if (nearSea) {
        prepareSea();
        draw(sea.reef);draw(sea.frames);
        drawSeaAnimals(reducedMotion.matches ? 0 : seconds);
      }
      if (view === 'aerial') {
        for (let i = 0; i < 4; i++) {
          const d = distance - i * 3.8;
          draw(i ? coach : engine, W.position(d), W.heading(d));
        }
        drawVapor(minute, seconds, cam.fov);
      }
      if (nearSea) drawSeaGlass(reducedMotion.matches ? 0 : seconds);
      if (view==='cabin') drawCabin(aspect,sky,seconds);
    };
  }

  try {
    const render = makeRenderer();
    window.RailwayLaunch?.advance(90);
    let lastFrame = performance.now();
    let lastRender = '';
    let motionSeconds = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      if (now - lastFrame < 30) return;
      const elapsed = Math.min((now - lastFrame) / 1000, .15);
      lastFrame = now;
      if (!paused) motionSeconds += elapsed;
      const minute = activeMinute(now);
      const distance = W.distanceAt(minute);
      const resolution = Math.min(devicePixelRatio || 1, 1.6);
      const width = Math.max(1, Math.round(root.clientWidth * resolution));
      const height = Math.max(1, Math.round(root.clientHeight * resolution));
      const renderKey = [minute, width, height, view, overheadMode, isFreeView() && freeFrame?.target.join(), motionSeconds].join();
      if (renderKey === lastRender) return;
      lastRender = renderKey;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const cam = camera(distance, width / height);
      showPlanetPosition(distance);
      updateUi(minute, cam.chapter);
      render(minute, distance, cam, width / height, motionSeconds);
      window.RailwayLaunch?.ready();
    }
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      byId('failure').textContent = '观景画面暂时中断，刷新页面即可继续。';
      byId('failure').hidden = false;
      window.RailwayLaunch?.fail('观景画面暂时中断，请重新打开。');
    });
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    byId('failure').textContent = gl ? '观景画面初始化失败，请刷新页面或换一个浏览器打开。' : error.message;
    byId('failure').hidden = false;
    window.RailwayLaunch?.fail('观景画面初始化失败，请重新打开或换一个浏览器。');
  }
})();
