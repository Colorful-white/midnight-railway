const RailwaySeasons = (() => {
  const W = RailwayWorld;
  const profiles = [
    { id: 'spring', name: '春季', ground: [.43,.57,.33,.28], grass: [.51,.66,.34,.37], trees: [.34,.55,.39,.20],
      top: [3,10,9], horizon: [12,13,10], light: [.02,.035,.02] },
    { id: 'summer', name: '夏季', ground: [.33,.46,.25,.32], grass: [.43,.56,.29,.33], trees: [.24,.43,.31,.24],
      top: [-8,5,15], horizon: [1,8,15], light: [.025,.035,.02] },
    { id: 'autumn', name: '秋季', ground: [.67,.55,.33,.48], grass: [.78,.52,.31,.47], trees: [.36,.44,.31,.15],
      top: [11,1,-7], horizon: [23,9,-9], light: [.055,.01,-.025] },
    { id: 'winter', name: '冬季', ground: [.86,.89,.92,1], grass: [.62,.57,.49,.49], trees: [.36,.47,.45,.26],
      top: [0,0,12], horizon: [6,10,24], light: [.02,.035,.14] }
  ];
  // Use the civil date, so a short or long day at a clock change still advances once.
  const cycleStart = Date.UTC(2026,10,19); // The first spring follows the winter preview day.
  function onDate(date) {
    const day = Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
    return profiles[W.wrap((day-cycleStart)/86400000,profiles.length)];
  }

  const ease = (value, start, end) => W.smooth(W.clamp((value-start)/(end-start),0,1));
  function springMist(minute, height) {
    return ease(minute,350,375)*(1-ease(minute,475,510))*(1-ease(height,3,17));
  }
  function summerAfterglow(minute) {
    return ease(minute,1080,1122)*(1-ease(minute,1148,1210));
  }

  function snowStrength(minute, x, z) {
    const distance = Math.hypot(x-135,z-305);
    return ease(minute,1436.58,1436.80)*(1-ease(minute,1437.34,1437.66))*(1-ease(distance,65,119));
  }
  let seed = 48721;
  function between(a,b) {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return W.mix(a,b,seed/4294967296);
  }
  const flakes = Array.from({length:64},(_,index) => {
    const x = index<18 ? between(118,151) : between(90,191);
    const z = between(236,380);
    return { x, z, y: W.groundHeight(x,z), phase: between(0,1), speed: between(.014,.030), size: between(.18,.31) };
  });
  function snow(seconds, strength, data) {
    for (const [index, flake] of flakes.entries()) {
      const progress = W.wrap(seconds*flake.speed+flake.phase,1);
      const drift = Math.sin(seconds*.63+flake.phase*14);
      const fade = ease(progress,0,.19)*(1-ease(progress,.79,1));
      data.set([flake.x+drift*1.3, flake.y+.3+(1-progress)*15, flake.z+drift*.8,
        flake.size,0,0,0,0,0,fade*strength*.83],index*10);
    }
  }

  const meadowDistance = W.distanceAt(480);
  const [flowerX,,flowerZ] = W.position(meadowDistance);
  const flowerColors = [[.97,.79,.59],[.92,.62,.68],[.94,.89,.74]];
  function nearFlowers([x,,z]) {
    return Math.hypot(x-flowerX,z-flowerZ)<390;
  }
  function springFlowers() {
    const mesh = new W.Mesh();
    let flower = 0;
    for (const offset of [-53,-36,-14,-2,16,22,44,65]) {
      const distance = meadowDistance+offset;
      const [x,,z] = W.position(distance);
      const [hx,,hz] = W.heading(distance);
      for (let i = 0; i < 7; i++) {
        const reach = 5.1+(offset*offset%7)*.63 + i*.36;
        const along = Math.sin(i*2.4+offset)*2.6;
        const px = x-hz*reach+hx*along, pz = z+hx*reach+hz*along;
        if (W.nearRail(px,pz,3.3)) continue;
        const y = W.groundHeight(px,pz)-.02;
        const height = .31+.20*(.5+.5*Math.sin(flower*2.4));
        const color = flowerColors[flower++%flowerColors.length];
        mesh.cone(px,y,pz,.032,.018,height,[.35,.51,.29],5,.056);
        for (let j = 0; j < 5; j++) {
          const angle = j*Math.PI*2/5;
          mesh.cone(px+.056+Math.cos(angle)*.064,y+height-.025,pz+Math.sin(angle)*.064,.045,.063,.084,color,5);
        }
        mesh.cone(px+.056,y+height,pz,.043,.033,.079,[.92,.70,.34],5);
      }
    }
    return mesh.data;
  }
  return { onDate, springMist, summerAfterglow, snowStrength, snow, flakeCount:flakes.length, nearFlowers, springFlowers };
})();
