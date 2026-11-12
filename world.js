const RailwayWorld = (() => {
  const TAU = Math.PI * 2;
  const DAY = 1440;
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const clamp = (t, low, high) => Math.max(low, Math.min(high, t));
  const wrap = (n, limit) => (n % limit + limit) % limit;
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const mul = (a, n) => a.map(v => v * n);
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = a => mul(a, 1 / (Math.hypot(...a) || 1));
  const tint = (hex, factor = 1) => [16, 8, 0].map(shift => ((hex >> shift) & 255) / 255 * factor);
  let seed = 18601;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const between = (a, b) => mix(a, b, random());
  const pick = values => values[Math.floor(random() * values.length)];

  // Events bind a local minute to a point on the continuous, closed rail.
  const stops = [
    { name: '零点小站', minute: 0, duration: 20 / 69 },
    { name: '空心巨树', minute: 500, duration: 32 / 69 },
    { name: '浮灯水城', minute: 1122, duration: 72 / 69 },
    { name: '薄荷海', minute: 1362, duration: 6 }
  ];
  const tree = { x: -108, z: -32 };
  const lake = { x: 95, z: -6 };
  const sea = { x: 8910, z: 572, surface: 3.2, floor: -11.5, startNode: 0, endNode: 0 };
  const controls = [];
  function rail(x, z, height = 0.7) {
    controls.push([x, height, z]);
    return controls.length - 1;
  }
  // Ordinary stretches carry most of the day's mileage. Their long curves
  // leave the hand-built landmarks at the same scale as the original railway.
  function countryLine(x, z, dx, dz, reach, separation, diversion = null) {
    const bend = separation / 2;
    const point = (forward, side) => rail(x + dx * forward - dz * side, z + dz * forward + dx * side);
    const sway = d => Math.sin(d * .0027) * 102 + Math.sin(d * .0051) * 32;
    const offset = d => sway(d) * smooth(clamp(Math.min(d, reach - d) / 440, 0, 1));
    const segments = Math.ceil(reach / 70);
    for (let i = 0; i <= segments; i++) {
      const d = reach * i / segments;
      point(d, offset(d));
    }
    for (let i = 1; i < 13; i++) {
      const angle = Math.PI * i / 12;
      point(reach + bend * Math.sin(angle), bend * (1 - Math.cos(angle)));
    }
    let diverted = false;
    for (let i = segments; i >= 0; i--) {
      const d = reach * i / segments;
      if (diversion && d <= diversion.entry && d >= diversion.exit) {
        if (!diverted) diversion.build();
        diverted = true;
        continue;
      }
      point(d, separation + offset(d) * .77);
    }
  }
  stops[0].node = rail(-56, 76);
  rail(-76, 76); rail(-113, 72);
  const west = rail(-148, 63);
  rail(-203, 58); rail(-274, 58);
  countryLine(-340, 58, -1, 0, 6530, 420);
  rail(-264, -362); rail(-213, -340); rail(-167, -292); rail(-148, -228);
  rail(-145, -141); rail(-170, -62); rail(-162, -17); rail(-133, 4); rail(-114, -2); rail(-109, -15);
  stops[1].node = rail(-108, -24);
  rail(-108, -39);
  stops[1].endNode = rail(-108, -45);
  rail(-109, -67);
  const north = rail(-104, -105);
  rail(-89, -155); rail(-72, -230);
  countryLine(-72, -306, 0, -1, 12600, 470);
  rail(398, -235); rail(377, -170);
  const valley = rail(317, -132);
  rail(246, -119); rail(177, -118); rail(111, -113); rail(73, -87);
  rail(67, -62); rail(78, -49, 1.25);
  stops[2].node = rail(95, -48, 1.25);
  // The exit climbs onto a viaduct above the first arc of the city loop.
  for (let step = 1; step <= 24; step++) {
    const t = step / 24;
    const angle = -Math.PI / 2 + TAU * t;
    const radius = mix(42, 32, t);
    rail(lake.x + radius * Math.cos(angle), lake.z + radius * Math.sin(angle), 1.25 + 4.6 * smooth(clamp((t - 0.76) / 0.24, 0, 1)));
  }
  stops[2].endNode = controls.length - 1;
  rail(119, -38, 5.85); rail(142, -38, 5.75); rail(163, -25, 3.8);
  const east = rail(172, 5);
  rail(196, 34); rail(254, 54); rail(329, 62);
  countryLine(410, 62, 1, 0, 15700, 510, { entry: 8750, exit: 8250, build() {
    sea.startNode = rail(sea.x+250,sea.z-60,5);
    rail(sea.x+192,sea.z-52,5); rail(sea.x+150,sea.z-45,4.8);
    rail(sea.x+124,sea.z-40,1.1); rail(sea.x+104,sea.z-33,-3.1);
    stops[3].node = rail(sea.x+85,sea.z-25,-5.8);
    rail(sea.x+47,sea.z-12,-5.8); rail(sea.x+3,sea.z+1,-5.8);
    rail(sea.x-40,sea.z+12,-5.8);
    for (let i=1;i<=24;i++) {
      const t=i/24, angle=-1.1+TAU*t, radius=mix(34,27,t);
      rail(sea.x-55+Math.cos(angle)*radius,sea.z+42+Math.sin(angle)*radius,
        -5.8+6.2*smooth(clamp((t-.73)/.27,0,1)));
    }
    rail(sea.x-72,sea.z+2,.55); rail(sea.x-110,sea.z-18,1.2);
    stops[3].endNode = rail(sea.x-145,sea.z-32,3.8);
    rail(sea.x-188,sea.z-41,5.1);
    sea.endNode = rail(sea.x-250,sea.z-45,5.1);
  }});
  const south = rail(323, 572);
  rail(246, 552); rail(183, 507); rail(141, 435); rail(120, 356);
  rail(111, 270); rail(125, 192); rail(126, 134); rail(103, 88);
  rail(70, 71); rail(43, 55); rail(13, 55); rail(-9, 72); rail(-31, 76);

  const path = [];
  const lengths = [0];
  const nodeDistances = [];
  const resolution = 12;
  for (let i = 0; i < controls.length; i++) {
    const [a, b, c, d] = [-1, 0, 1, 2].map(offset => controls[wrap(i + offset, controls.length)]);
    for (let step = 0; step < resolution; step++) {
      const t = step / resolution;
      const p = b.map((v, j) => 0.5 * ((2 * v) + (-a[j] + c[j]) * t
        + (2 * a[j] - 5 * v + 4 * c[j] - d[j]) * t * t
        + (-a[j] + 3 * v - 3 * c[j] + d[j]) * t * t * t));
      p[1] = Math.max(p[1], terrain(p[0], p[2]) + .32);
      if (path.length) lengths.push(lengths.at(-1) + Math.hypot(...sub(p, path.at(-1))));
      if (step === 0) nodeDistances.push(lengths.at(-1));
      path.push(p);
    }
  }
  lengths.push(lengths.at(-1) + Math.hypot(...sub(path[0], path.at(-1))));
  path.push(path[0]);
  const total = lengths.at(-1);
  for (const stop of stops) stop.distance = nodeDistances[stop.node];
  const timeline = [
    stops[0],
    stops[1],
    { minute: stops[1].minute + stops[1].duration, distance: nodeDistances[stops[1].endNode] },
    stops[2],
    { minute: stops[2].minute + stops[2].duration, distance: nodeDistances[stops[2].endNode] },
    { minute: 1360, distance: nodeDistances[sea.startNode] },
    stops[3],
    { minute: stops[3].minute + stops[3].duration, distance: nodeDistances[stops[3].endNode] },
    { minute: 1370, distance: nodeDistances[sea.endNode] },
    { minute: DAY, distance: total }
  ];

  function distanceAt(minute) {
    minute = wrap(minute, DAY);
    const next = timeline.findIndex(mark => mark.minute > minute);
    const [a, b] = [timeline[next - 1], timeline[next]];
    return mix(a.distance, b.distance, (minute - a.minute) / (b.minute - a.minute));
  }
  function position(distance) {
    const d = wrap(distance, total);
    let low = 0;
    let high = lengths.length - 1;
    while (high - low > 1) {
      const mid = (high + low) >> 1;
      if (lengths[mid] <= d) low = mid;
      else high = mid;
    }
    const t = (d - lengths[low]) / (lengths[high] - lengths[low]);
    return path[low].map((v, i) => mix(v, path[high][i], t));
  }
  function heading(distance) {
    const delta = sub(position(distance + 0.45), position(distance - 0.45));
    return unit([delta[0], 0, delta[2]]);
  }
  const chapters = [
    { name: '零点小站', node: 0 },
    { name: '西岸杉林', node: west },
    { name: '空心巨树', node: stops[1].node },
    { name: '北岭', node: north },
    { name: '风谷', node: valley },
    { name: '浮灯水城', node: stops[2].node },
    { name: '东岸高架', node: east },
    { name: '薄荷海', node: sea.startNode },
    { name: '海岸归途', node: sea.endNode },
    { name: '南岸原野', node: south }
  ].map((chapter, index) => ({ ...chapter, index, distance: nodeDistances[chapter.node] }));
  const featureShots = [
    { stop: stops[0], aim: [-49, 0, 76], radius: 54, before: 24, after: 28 },
    { stop: stops[1], aim: [-112, 7, -31], radius: 61, before: 16, after: 26 },
    { stop: stops[2], aim: [97, 0, -6], radius: 94, before: 27, after: 0 },
    { stop: stops[3], aim: [sea.x,-3,sea.z], radius: 126, before: 24, after: 24 }
  ].map(({stop, aim, radius, before, after}) => ({
    start: stop.distance - before, end: (nodeDistances[stop.endNode] ?? stop.distance) + after, aim, radius
  }));

  class Mesh {
    data = [];
    triangle(a, b, c, color, light = 0) {
      const normal = unit(cross(sub(b, a), sub(c, a)));
      for (const p of [a, b, c]) this.data.push(...p, ...normal, ...color, light);
    }
    quad(a, b, c, d, color, light) {
      this.triangle(a, b, c, color, light);
      this.triangle(a, c, d, color, light);
    }
    box(x, y, z, w, h, d, color, glow = 0) {
      const [l, r, f, b, t] = [x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + h];
      this.quad([l,t,b], [r,t,b], [r,t,f], [l,t,f], color, glow);
      this.quad([r,y,b], [r,y,f], [r,t,f], [r,t,b], color, glow);
      this.quad([l,y,f], [l,y,b], [l,t,b], [l,t,f], color, glow);
      this.quad([r,y,f], [l,y,f], [l,t,f], [r,t,f], color, glow);
      this.quad([l,y,b], [r,y,b], [r,t,b], [l,t,b], color, glow);
    }
    cone(x, y, z, bottom, top, height, color, sides = 7, drift = 0) {
      for (let i = 0; i < sides; i++) {
        const a = TAU * i / sides;
        const b = TAU * (i + 1) / sides;
        this.quad(
          [x + bottom * Math.cos(b), y, z + bottom * Math.sin(b)],
          [x + bottom * Math.cos(a), y, z + bottom * Math.sin(a)],
          [x + drift + top * Math.cos(a), y + height, z + top * Math.sin(a)],
          [x + drift + top * Math.cos(b), y + height, z + top * Math.sin(b)], color
        );
      }
    }
    branch(start, end, root, tip, color) {
      const axis = unit(sub(end, start));
      const side = unit(cross(axis, [0, 0, 1]));
      const up = cross(axis, side);
      const ring = angle => add(mul(side, Math.cos(angle)), mul(up, Math.sin(angle)));
      for (let i = 0; i < 7; i++) {
        const a = ring(i * TAU / 7);
        const b = ring((i + 1) * TAU / 7);
        this.quad(add(start,mul(a,root)), add(start,mul(b,root)), add(end,mul(b,tip)), add(end,mul(a,tip)), color);
      }
    }
  }

  function terrain(x, z) {
    const lakeDistance = Math.hypot((x - lake.x) / 62, (z - lake.z) / 59);
    const hollow = 4.6 * smooth(clamp((1.13 - lakeDistance) / 0.32, 0, 1));
    const farHills = 31 * Math.exp(-((x + 60) ** 2 / 4300 + (z + 165) ** 2 / 400))
      + 20 * Math.exp(-((x - 23) ** 2 / 5100 + (z + 151) ** 2 / 510))
      + 21 * Math.exp(-((x + 187) ** 2 / 520 + (z + 39) ** 2 / 4400));
    const outer = smooth(clamp(Math.max((Math.abs(x) - 215) / 200, (Math.abs(z) - 195) / 200), 0, 1));
    const country = 12 * (.5 + .5 * Math.sin(x * .021 + z * .013)) ** 3
      + 8 * (.5 + .5 * Math.cos(z * .033 - x * .011)) ** 2
      + 3 * (.5 + .5 * Math.sin(x * .061 - z * .044));
    const ordinary = -0.5 + 0.36 * Math.sin(x * 0.105 + z * 0.07) + 0.34 * Math.cos(z * 0.13) + farHills - hollow + outer * country;
    const basin = Math.hypot((x-sea.x)/190,(z-sea.z)/140);
    const depth = 1-smooth(clamp((basin-.65)/.45,0,1));
    return mix(ordinary,sea.floor+.28*Math.sin(x*.13)*Math.cos(z*.11),depth);
  }
  const ground = new Mesh();
  const scenery = new Mesh();
  const step = 5;
  const core = { left: -260, right: 255, north: -235, south: 215 };
  const insideCore = (x, z) => x >= core.left && x < core.right && z >= core.north && z < core.south;
  function groundCell(mesh, x, z) {
    const [a, b, c, d] = [[x,z], [x,z+step], [x+step,z+step], [x+step,z]].map(([px,pz]) => [px,terrain(px,pz),pz]);
    const distance = Math.hypot((x - lake.x) / 65, (z - lake.z) / 62);
    const basin = Math.hypot((x-sea.x)/190,(z-sea.z)/140);
    const base = basin < .94 ? (Math.sin(x*.17+z*.08)>.3 ? 0xc9d9c8 : 0xb9d5c9)
      : basin<1.15 ? 0xe2d8bb : distance > 0.97 && distance < 1.09 ? 0x958b64 : x < -36 ? 0x56694c : 0x748061;
    const shade = 0.96 + 0.09 * Math.sin(x * .037 + z * .09) + between(0.01, 0.07);
    mesh.triangle(a, b, c, tint(base, shade));
    mesh.triangle(a, c, d, tint(base, shade * between(.95, 1.05)));
  }
  for (let z = core.north; z < core.south; z += step) {
    for (let x = core.left; x < core.right; x += step) {
      groundCell(ground, x, z);
    }
  }
  const waterHeight = -1.06;
  scenery.quad([27,waterHeight,56], [162,waterHeight,56], [162,waterHeight,-68], [27,waterHeight,-68], tint(0x397c79), -1);
  for (let i = 0; i < 510; i++) {
    const x = lake.x + between(-62, 62);
    const z = lake.z + between(-56, 56);
    if (terrain(x, z) > waterHeight - .2 || Math.hypot(x - lake.x, z - lake.z) < 23) continue;
    const w = between(.25, 4.2);
    const y = waterHeight + .016;
    scenery.quad([x,y,z], [x+w,y,z], [x+w-.15,y,z-.12], [x+.2,y,z-.12], tint(pick([0x4c8982, 0x60958a, 0x33716e, 0x54968c])));
  }

  const railSections = [];
  const railGrid = new Map();
  const gridSize = 32;
  const gridKey = (x, z) => x + ',' + z;
  for (let start = 0; start < total; start += 140) {
    const end = Math.min(total, start + 140);
    const section = { start, end, left: Infinity, right: -Infinity, north: Infinity, south: -Infinity };
    for (let d = start; d <= end; d += 1) {
      const [x,,z] = position(d);
      const key = gridKey(Math.floor(x / gridSize), Math.floor(z / gridSize));
      if (!railGrid.has(key)) railGrid.set(key, []);
      railGrid.get(key).push([x,z]);
      section.left = Math.min(section.left, x);
      section.right = Math.max(section.right, x);
      section.north = Math.min(section.north, z);
      section.south = Math.max(section.south, z);
    }
    railSections.push(section);
  }
  function nearRail(x, z, buffer) {
    for (let j = Math.floor((z - buffer) / gridSize); j <= Math.floor((z + buffer) / gridSize); j++) {
      for (let i = Math.floor((x - buffer) / gridSize); i <= Math.floor((x + buffer) / gridSize); i++) {
        const points = railGrid.get(gridKey(i, j));
        if (points?.some(([px,pz]) => (px - x) ** 2 + (pz - z) ** 2 < buffer * buffer)) return true;
      }
    }
    return false;
  }
  const evergreens = [0x2b5545, 0x365e4a, 0x44684d, 0x4f7355, 0x607954, 0x6a8255];
  function pine(mesh, x, z, h, palette = evergreens) {
    const y = terrain(x, z);
    const width = h * between(.19, .26);
    const color = pick(palette);
    mesh.cone(x, y, z, width * .14, width * .08, h * .5, tint(0x574736), 5);
    for (let j = 0; j < 3; j++) {
      mesh.cone(x, y + h * (.17 + j * .17), z, width * (1 - j * .20), 0, h * (.49 - j * .02), tint(color, .87 + j * .10), 6);
    }
  }
  for (let i = 0; i < 2300; i++) {
    const x = between(-212, 207);
    const z = between(-167, 124);
    const groves = Math.sin(x * .055 + z * .042) + Math.cos(z * .075 - x * .026);
    if (groves < -.6 || terrain(x, z) < waterHeight + .3 || nearRail(x, z, 3.2)
      || Math.hypot(x - tree.x, z - tree.z) < 14
      || (z > 64 && z < 92 && x > -72 && x < -39)) continue;
    if (x > -12 && z > 31 && random() < .63) continue;
    pine(scenery, x, z, between(2.2, x < -72 ? 9.2 : 6.7));
  }
  for (let i = 0; i < 1200; i++) {
    const x = between(-178, 194);
    const z = between(-130, 105);
    const y = terrain(x, z);
    if (nearRail(x, z, 1.8) || y < waterHeight + .15) continue;
    scenery.cone(x, y, z, between(.18, .9), between(.02, .14), between(.15, .8), tint(pick([0x8a925e, 0xb0a571, 0x647750, 0x87946f])), 4);
  }

  // The track passes through a bark arch and an open tunnel below the canopy.
  const bark = [0x684735, 0x785239, 0x845d3e, 0x986b46, 0x523d30];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * i / 10;
    const b = Math.PI * (i + 1) / 10;
    const arch = (r, angle, z) => [tree.x + r * Math.cos(angle), .12 + r * Math.sin(angle), z];
    for (let j = 0; j < 4; j++) {
      const front = tree.z + 10 - j * 5;
      const back = front - 5;
      const color = tint(pick(bark));
      scenery.quad(arch(4.1, a, front), arch(4.1, b, front), arch(4.1, b, back), arch(4.1, a, back), tint(0x614530, between(.78, 1.3)));
      scenery.quad(arch(7.1, b, front), arch(7.1, a, front), arch(7.1, a, back), arch(7.1, b, back), color);
      if (j === 0) scenery.quad(arch(4.1, b, front), arch(4.1, a, front), arch(7.1, a, front), arch(7.1, b, front), color);
      if (j === 3) scenery.quad(arch(4.1, a, back), arch(4.1, b, back), arch(7.1, b, back), arch(7.1, a, back), color);
    }
  }
  scenery.cone(tree.x, 4.85, tree.z, 6.5, 2.7, 20, tint(0x78583d), 10, 1.8);
  for (const [dx, dz] of [[-15,-9], [12,-5], [-11,6], [14,8], [-6,13], [9,-13]]) {
    scenery.branch([tree.x + dx * .29, 3.35, tree.z + dz * .25],
      [tree.x + dx, terrain(tree.x + dx, tree.z + dz), tree.z + dz], 2.2, .13, tint(pick(bark)));
  }
  for (const [dx, dz, height] of [[-12,-6,24], [11,-3,22], [7,10,24], [-10,8,21]]) {
    scenery.branch([tree.x, 11, tree.z], [tree.x + dx, height, tree.z + dz], 2.1, .65, tint(pick(bark)));
  }
  for (let i = 0; i < 19; i++) {
    const angle = i * 2.39996;
    const x = tree.x + Math.cos(angle) * between(4, 13);
    const z = tree.z + Math.sin(angle) * between(3, 11);
    const y = between(16, 28);
    const r = between(3.4, 7.3);
    const color = tint(pick([0x556947, 0x6b794a, 0x788a4c, 0x889154, 0x52664a]));
    scenery.cone(x, y, z, r * .34, r, r * .65, color, 8);
    scenery.cone(x, y + r * .65, z, r, .1, r * .72, color, 8, between(-1.8, 2.5));
  }
  for (let i = 0; i < 49; i++) {
    const y = between(.45, 3.7);
    const x = tree.x + pick([-1, 1]) * (Math.sqrt(4.1 ** 2 - (y - .12) ** 2) * .95 - .15);
    const z = tree.z + between(-9.7, 9.7);
    const color = tint(pick([0xc2d288, 0x90b790, 0xe5c383]));
    scenery.box(x, y, z, .045, between(.045,.095), .052, color, .76);
  }

  function house(x, y, z, w, h, d, wall, roof, windows = true) {
    scenery.box(x, y, z, w, h, d, tint(wall));
    const [l,r,f,b,t] = [x-w*.58,x+w*.58,z-d*.59,z+d*.59,y+h];
    const ridge = t + Math.min(w,d) * .43;
    const color = tint(roof);
    scenery.quad([l,t,b], [r,t,b], [r,ridge,z], [l,ridge,z], color);
    scenery.quad([r,t,f], [l,t,f], [l,ridge,z], [r,ridge,z], color);
    scenery.triangle([l,t,f], [l,t,b], [l,ridge,z], tint(wall,.91));
    scenery.triangle([r,t,b], [r,t,f], [r,ridge,z], tint(wall,.91));
    if (!windows) return;
    for (const side of [-1, 1]) {
      for (const offset of [-.26, .26]) {
        scenery.box(x + w * offset, y + h * .40, z + side * (d/2 + .025), w * .18, h * .26, .065, tint(0xe8b873), .88);
      }
      scenery.box(x + side * (w / 2 + .025), y + h * .39, z, .065, h * .28, d * .23, tint(0xe6bb79), .8);
    }
  }
  const cityWall = [0xbba484, 0xd7bd91, 0xc39f7b, 0xa99981, 0xb9ac8b];
  const cityRoofs = [0x925847, 0x9c6951, 0x526c6b, 0x546058, 0x7b514a];
  scenery.cone(lake.x, -1.21, lake.z, 22.7, 21.5, 2.55, tint(0x9e927a), 20);
  for (let i = 0; i < 20; i++) {
    const a = TAU * i / 20;
    const b = TAU * (i + 1) / 20;
    const p = a => [lake.x + 21.5 * Math.cos(a), 1.35, lake.z + 21.5 * Math.sin(a)];
    scenery.triangle([lake.x,1.35,lake.z], p(b), p(a), tint(0xa99a78, between(.9, 1.08)));
  }
  for (let row = -2; row <= 2; row++) {
    for (let col = -3; col <= 3; col++) {
      if (Math.hypot(col * 5.4, row * 6.6) > 19 || (!row && !col)) continue;
      const x = lake.x + col * 5.4 + between(-.35,.35);
      const z = lake.z + row * 6.6 + between(-.4,.4);
      house(x, 1.35, z, between(3.0,4.7), between(2.1,5.6), between(3.5,4.9), pick(cityWall), pick(cityRoofs));
    }
  }
  scenery.box(lake.x, 1.35, lake.z, 4.0, 12.5, 4.0, tint(0xc6b293));
  scenery.box(lake.x, 12.3, lake.z, 4.65, .5, 4.65, tint(0xe1c6a0));
  scenery.cone(lake.x, 13.8, lake.z, 3.15, .2, 7.6, tint(0x4e6863), 4);
  for (const side of [-1, 1]) {
    scenery.box(lake.x, 10.45, lake.z + side * 2.03, 1.4, 1.65, .1, tint(0xf1c884), .95);
    scenery.box(lake.x + side * 2.03, 10.45, lake.z, .1, 1.65, 1.4, tint(0xf1c884), .95);
    scenery.box(lake.x + side * 17, -.52, lake.z + 6, 14.0, .38, 3.1, tint(0x765b43));
  }
  for (let i = 0; i < 19; i++) {
    const a = TAU * i / 19;
    const x = lake.x + 20.5 * Math.cos(a);
    const z = lake.z + 20.5 * Math.sin(a);
    scenery.box(x, 1.36, z, .16, 1.55, .16, tint(0x4b4434));
    scenery.box(x, 2.78, z, .4, .38, .4, tint(0xf1c483), .98);
  }

  scenery.box(-55, -.55, 68.65, 29, 1.05, 11.7, tint(0xa59b78));
  house(-57, .48, 66.1, 13.8, 3.8, 5.6, 0xd7b382, 0x86534b);
  scenery.box(-55, 3.4, 71.55, 16, .18, 5.7, tint(0x5c463b));
  for (const x of [-66, -58, -50, -43]) {
    scenery.box(x, .5, 73.55, .19, 2.96, .19, tint(0x534437));
    scenery.box(x, 2.8, 73.55, .32, .30, .32, tint(0xf8c584), .98);
  }
  scenery.box(-56, .55, 79.2, .18, 2.55, .18, tint(0x5e513b));
  scenery.box(-56, 2.25, 79.2, 2.35, .66, .23, tint(0xead0a1), .22);
  scenery.box(-57, 3.08, 74.4, 3.8, .75, .15, tint(0x694938));
  scenery.box(-57, 3.14, 74.49, 3.55, .62, .05, tint(0xe3c592), .24);
  if (typeof document !== 'undefined') {
    const plaque = document.createElement('canvas');
    plaque.width = 128;
    plaque.height = 24;
    const ink = plaque.getContext('2d');
    ink.font = '600 17px "Microsoft YaHei", sans-serif';
    ink.textAlign = 'center';
    ink.fillText('零点小站', 64, 19);
    const pixels = ink.getImageData(0, 0, plaque.width, plaque.height).data;
    const scale = .025;
    for (let row = 0; row < plaque.height; row++) {
      let col = 0;
      while (col < plaque.width) {
        const start = col;
        const dark = pixels[(row * plaque.width + col) * 4 + 3] > 100;
        while (col < plaque.width && (pixels[(row * plaque.width + col) * 4 + 3] > 100) === dark) col++;
        if (!dark) continue;
        const left = -57 + (start - 64) * scale;
        const right = -57 + (col - 64) * scale;
        const top = 3.73 - row * scale;
        scenery.quad([left,top-scale,74.521], [right,top-scale,74.521], [right,top,74.521], [left,top,74.521], tint(0x3d3027));
      }
    }
  }

  function railStrip(mesh, start, end, center, width, lift, color) {
    const point = (d, offset) => {
      const [x,y,z] = position(d);
      const [dx,,dz] = heading(d);
      return [x - dz * offset, y + lift, z + dx * offset];
    };
    mesh.quad(point(start, center - width / 2), point(start, center + width / 2),
      point(end, center + width / 2), point(end, center - width / 2), color);
  }
  function railMesh(section) {
    const mesh = new Mesh();
    for (let d = section.start; d < section.end; d += 1) {
      const end = Math.min(d + 1, section.end);
      const undersea = d>=stops[3].distance && d<=nodeDistances[stops[3].endNode];
      railStrip(mesh, d, end, 0, 2.25, -.13, tint(undersea ? 0x9db9b0 : 0x776855));
      railStrip(mesh, d, Math.min(d + .28, end), 0, 1.92, -.07, tint(undersea ? 0x9e967e : 0x3e3730));
      for (const side of [-1, 1]) railStrip(mesh, d, end, side * .59, .15, 0, tint(undersea ? 0xe6d6af : 0xc7bd9d));
    }
    for (let d = Math.ceil(section.start / 5.5) * 5.5; d < section.end; d += 5.5) {
      const [x,y,z] = position(d);
      const floor = terrain(x, z);
      if (y - floor > 2.05) {
        const undersea = d>=stops[3].distance && d<=nodeDistances[stops[3].endNode];
        const width = undersea ? .40 : .66;
        mesh.box(x, floor, z, width, y - floor - .14, width, tint(undersea ? 0xc8cdbd : 0x7f7969));
        mesh.box(x, y - .38, z, 2.1, .27, 1.1, tint(undersea ? 0xc4c6b4 : 0x8d8776));
      }
    }
    return mesh.data;
  }

  const tileSize = 100;
  function countryMesh(column, row) {
    const mesh = new Mesh();
    const left = column * tileSize;
    const north = row * tileSize;
    const savedSeed = seed;
    seed = Math.imul(column, 73856093) ^ Math.imul(row, 19349663) ^ 18601;
    for (let z = north; z < north + tileSize; z += step) {
      for (let x = left; x < left + tileSize; x += step) {
        if (!insideCore(x, z)) groundCell(mesh, x, z);
      }
    }
    for (let i = 0; i < 86; i++) {
      const x = left + between(0, tileSize);
      const z = north + between(0, tileSize);
      if (insideCore(x, z) || nearRail(x, z, 4.8) || Math.hypot((x-sea.x)/190,(z-sea.z)/140)<1.13) continue;
      const woods = Math.sin(x * .019 + z * .028) + Math.cos(z * .043 - x * .011);
      const meadow = x > 310 && z > 100;
      if (woods > (meadow ? .78 : -.12)) {
        pine(mesh, x, z, between(2.5, meadow ? 6.1 : 9.0));
      } else {
        const rock = z < -280 && random() > .66;
        const color = rock ? 0x909183 : pick([0x8a925e, 0xa09768, 0x647750]);
        mesh.cone(x, terrain(x, z), z, between(.4, 2), .12, rock ? between(1.1, 3) : between(.25, .95), tint(color), 5);
      }
    }
    seed = savedSeed;
    return mesh.data;
  }

  function trainCar(engine) {
    const m = new Mesh();
    const paint = tint(engine ? 0xd08c54 : 0x9d5548);
    const roof = tint(0x443d37);
    m.box(0, .13, 0, 3.45, .38, 1.38, tint(0x282e2c));
    m.box(0, .48, 0, 3.25, 1.04, 1.4, paint);
    m.box(0, 1.48, 0, 3.32, .21, 1.49, roof);
    m.box(0, 1.65, 0, 3.18, .14, 1.20, tint(0x635548));
    for (const side of [-1, 1]) {
      m.box(0,.84,side*.705,3.24,.07,.04,tint(0xe4ba7b));
      for (const x of [-1.13, -.37, .37, 1.13]) m.box(x,1.02,side*.705,.49,.33,.06,tint(0xeac799),.67);
      for (const x of [-1.14, 1.14]) m.box(x,.05,side*.57,.54,.38,.22,tint(0x2b302e));
    }
    if (engine) {
      m.box(1.65,.89,0,.09,.26,.34,tint(0xffdf9d),1);
      m.box(1.05,1.76,0,.27,.34,.27,roof);
    }
    return m.data;
  }

  return { Mesh, DAY, clamp, wrap, mix, smooth, add, sub, mul, dot, cross, unit, stops, chapters, featureShots,
    total, distanceAt, position, heading, core, sea, groundHeight:terrain, tileSize, railSections, railMesh, countryMesh, terrain: ground.data, scenery: scenery.data,
    engine: trainCar(true), coach: trainCar(false) };
})();
