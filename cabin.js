const CabinScene = (() => {
  const W = RailwayWorld;
  const TAU = Math.PI * 2;
  const color = (hex, strength = 1) => [16, 8, 0].map(shift => ((hex >> shift) & 255) / 255 * strength);

  function surface(mesh, vertices, normals, shade) {
    for (let i = 0; i < 3; i++) mesh.data.push(...vertices[i], ...normals[i], ...shade, 0);
  }
  function lathe(mesh, x, y, z, profile, shade, sides = 48) {
    for (let row = 0; row < profile.length - 1; row++) {
      const [r0, h0] = profile[row];
      const [r1, h1] = profile[row + 1];
      const normal = angle => W.unit([(h1 - h0) * Math.cos(angle), r0 - r1, (h1 - h0) * Math.sin(angle)]);
      for (let i = 0; i < sides; i++) {
        const a = TAU * i / sides;
        const b = TAU * (i + 1) / sides;
        const p = (radius, height, angle) => [x + radius * Math.cos(angle), y + height, z + radius * Math.sin(angle)];
        const [p0,p1,p2,p3] = [p(r0,h0,a),p(r0,h0,b),p(r1,h1,b),p(r1,h1,a)];
        surface(mesh, [p0,p1,p2], [normal(a),normal(b),normal(b)], shade);
        surface(mesh, [p0,p2,p3], [normal(a),normal(b),normal(a)], shade);
      }
    }
  }
  function disc(mesh, x, y, z, radius, shade, sides = 48) {
    for (let i = 0; i < sides; i++) {
      const a = TAU * i / sides;
      const b = TAU * (i + 1) / sides;
      mesh.triangle([x,y,z], [x + radius * Math.cos(b),y,z + radius * Math.sin(b)],
        [x + radius * Math.cos(a),y,z + radius * Math.sin(a)], shade);
    }
  }
  function shadow(mesh, x, z, width, depth, angle = 0) {
    const point = (radius, a) => {
      const px = Math.cos(a) * width * radius;
      const pz = Math.sin(a) * depth * radius;
      return [x + px * Math.cos(angle) - pz * Math.sin(angle), .003, z + px * Math.sin(angle) + pz * Math.cos(angle)];
    };
    const rings = [[0,.30], [.55,.21], [.85,.08], [1,0]];
    const normal = [0,1,0];
    for (let ring = 0; ring < rings.length - 1; ring++) {
      const [inner, a0] = rings[ring];
      const [outer, a1] = rings[ring + 1];
      for (let i = 0; i < 40; i++) {
        const a = TAU * i / 40;
        const b = TAU * (i + 1) / 40;
        const vertices = [point(inner,a),point(inner,b),point(outer,b),point(outer,a)];
        const alphas = [a0,a0,a1,a1];
        for (const indices of [[0,1,2],[0,2,3]]) {
          for (const index of indices) mesh.data.push(...vertices[index], ...normal, ...color(0x32251a), -2 - alphas[index]);
        }
      }
    }
  }
  function appendRotated(target, mesh, x, z, angle, scale = 1) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let i = 0; i < mesh.data.length; i += 10) {
      const p = mesh.data.slice(i, i + 10);
      target.data.push(x + scale*(c*p[0] - s*p[2]),p[1]*scale,z + scale*(s*p[0] + c*p[2]),
        c*p[3] - s*p[5],p[4],s*p[3] + c*p[5],...p.slice(6));
    }
  }
  function leaf(mesh, start, tip, width, shade, arch = .025) {
    const direction = W.sub(tip, start);
    const right = W.unit(W.cross(direction, [0,1,0]));
    const center = t => W.add(W.add(start,W.mul(direction,t)),[0,Math.sin(t*Math.PI)*arch,0]);
    for (let i = 0; i < 9; i++) {
      const a = i / 9;
      const b = (i + 1) / 9;
      for (const side of [-1,1]) {
        const edge = t => W.add(W.add(center(t),W.mul(right,Math.sin(t*Math.PI)*width*side)),[0,-.012,0]);
        mesh.quad(center(a),edge(a),edge(b),center(b),color(shade,side === 1 ? .98 : 1.11));
      }
    }
    mesh.branch(start,tip,.0028,.001,color(0x829052));
  }
  function bell(mesh, neck, size, lean) {
    const axis = W.unit([lean,-.85,.52]);
    const right = W.unit(W.cross(axis,[0,0,1]));
    const up = W.cross(axis,right);
    const point = (t, angle, inner = false) => {
      const radius = size * (.026 + .107 * Math.pow(t,.8)) * (1 + .09 * Math.cos(angle*5) * t*t) - (inner ? .003 : 0);
      const length = size * (.22*t + .014*Math.cos(angle*5)*t*t*t);
      return W.add(W.add(neck,W.mul(axis,length)),W.add(W.mul(right,radius*Math.cos(angle)),W.mul(up,radius*Math.sin(angle))));
    };
    for (let row = 0; row < 8; row++) {
      const a = row / 8;
      const b = (row + 1) / 8;
      for (let i = 0; i < 30; i++) {
        const u = TAU * i / 30;
        const v = TAU * (i + 1) / 30;
        const tint = .93 + .13 * b + .055 * Math.cos(u*5);
        mesh.quad(point(a,u),point(a,v),point(b,v),point(b,u),color(0xa6a5d4,tint));
        mesh.quad(point(a,v,true),point(a,u,true),point(b,u,true),point(b,v,true),color(0xced0ed,.96 + .06*b));
        if (row === 7) mesh.quad(point(b,u),point(b,v),point(b,v,true),point(b,u,true),color(0xd4cdeb));
      }
    }
    for (let i = 0; i < 4; i++) {
      const offset = W.add(W.mul(right,.024*Math.cos(i*TAU/4)),W.mul(up,.024*Math.sin(i*TAU/4)));
      const end = W.add(W.add(neck,W.mul(axis,size*.18)),offset);
      mesh.branch(W.add(neck,W.mul(axis,.025)),end,.0019,.0024,color(0xd4c88a));
      mesh.cone(end[0],end[1]-.004,end[2],.006,.003,.012,color(0xe0cc8c),5);
    }
  }
  function flowers(mesh, x, z, scale) {
    const origin = [x,.0025,z];
    const pot = new W.Mesh();
    lathe(pot,0,0,0,[[.17,0],[.18,.025],[.237,.34],[.253,.35],[.257,.375],[.246,.395],[.222,.38],[.22,.34]],color(0x80907b));
    disc(pot,0,.343,0,.22,color(0x403a29));
    lathe(pot,0,0,0,[[.246,.349],[.254,.355],[.255,.371]],color(0xb4b89a));
    const stems = [
      {x:-.16,z:.00,h:1.28,lean:-.13},
      {x:-.34,z:.07,h:1.10,lean:-.34},
      {x:.03,z:-.04,h:1.48,lean:.02},
      {x:.25,z:.05,h:1.26,lean:.27},
      {x:.36,z:.12,h:.96,lean:.34}
    ];
    for (const [index, stem] of stems.entries()) {
      const p0 = [stem.x*.16,.345,stem.z*.3];
      const p1 = [stem.x*.32,.72,stem.z*.7];
      const p2 = [stem.x-.08,stem.h+.16,stem.z-.07];
      const p3 = [stem.x,stem.h,stem.z];
      const point = t => [0,1,2].map(j => (1-t)**3*p0[j]+3*(1-t)**2*t*p1[j]+3*(1-t)*t*t*p2[j]+t**3*p3[j]);
      for (let i = 0; i < 15; i++) pot.branch(point(i/15),point((i+1)/15),.0075-i*.00025,.00725-i*.00025,color(0x536946));
      for (const t of [.27,.46,.63]) {
        const start = point(t);
        const side = (index + Math.round(t*10)) % 2 ? 1 : -1;
        leaf(pot,start,W.add(start,[side*.22,.09,.07]),.050,0x617e4c);
      }
      bell(pot,p3,index === 2 ? 1 : .83,stem.lean);
    }
    for (let i = 0; i < pot.data.length; i += 10) mesh.data.push(
      pot.data[i]*scale+origin[0],pot.data[i+1]*scale+origin[1],pot.data[i+2]*scale+origin[2],...pot.data.slice(i+3,i+10));
  }
  function book(mesh, x, z, width) {
    const local = new W.Mesh();
    const depth = width * .60;
    const cover = color(0x344f45);
    local.box(0,.014,0,width,.025,depth,cover);
    local.box(.015,.039,-.01,width-.055,.105,depth-.065,color(0xd0c4a8));
    for (let row = 0; row < 6; row++) local.box(.015,.049 + row*.014,-.01,width-.053,.0022,depth-.062,color(0xaba58d));
    local.box(0,.144,0,width,.027,depth,cover);
    local.box(-width/2+.012,.025,0,.04,.13,depth,color(0x2d453e));
    for (const side of [-1,1]) {
      local.box(0,.172,side*depth*.40,width*.83,.003,.006,color(0xa18d61));
      local.box(side*width*.415,.172,0,.006,.003,depth*.80,color(0xa18d61));
      local.box(-width/2-.009,.055,side*depth*.27,.005,.073,.020,color(0xb49d6b));
    }
    for (let i = 0; i < 42; i++) local.box(-width*.44+i*width*.88/42,.1721,0,.0013,.0008,depth*.86,color(0x405b4d));
    local.box(width*.13,.026,depth*.49,.065,.004,.18,color(0x8a6651));
    for (let i = 1; i < local.data.length; i += 10) local.data[i] -= .010;
    appendRotated(mesh,local,x,z,-.14);
  }
  function teaSet(mesh, x, z) {
    const porcelain = color(0xd3d2bc);
    const gold = color(0xb89a61);
    lathe(mesh,x,0,z,[[0,.016],[.23,.016],[.41,.039],[.46,.064],[.46,.073],[.42,.083],[.30,.055],[.19,.047],[0,.047]],porcelain);
    lathe(mesh,x,0,z,[[.457,.065],[.462,.069],[.458,.075]],gold);
    lathe(mesh,x,0,z,[[.115,.048],[.142,.053],[.156,.081],[.19,.15],[.233,.29],[.267,.41],[.270,.426],[.258,.431],[.253,.412],[.226,.29],[.18,.16],[.13,.12],[0,.12]],porcelain);
    lathe(mesh,x,0,z,[[.268,.414],[.271,.424],[.264,.432],[.256,.430]],gold);
    for (let i = 0; i < 30; i++) {
      const a = (-100 + 200*i/30) * Math.PI/180;
      const b = (-100 + 200*(i+1)/30) * Math.PI/180;
      const point = (t,p) => [x+.26+Math.cos(t)*(.145+Math.cos(p)*.026),.257+Math.sin(t)*(.14+Math.cos(p)*.026),z+Math.sin(p)*.026];
      for (let j = 0; j < 10; j++) {
        const u = TAU*j/10;
        const v = TAU*(j+1)/10;
        mesh.quad(point(a,u),point(a,v),point(b,v),point(b,u),porcelain);
      }
    }
    disc(mesh,x,.396,z,.251,color(0x8e682d));
    lathe(mesh,x,0,z,[[.247,.396],[.251,.399]],color(0xb08a43));
    for (const [dx,dz,angle] of [[-.08,-.04,.5],[.07,.05,-.4],[.02,-.12,1.2]]) {
      leaf(mesh,[x+dx-.037*Math.cos(angle),.398,z+dz-.037*Math.sin(angle)],
        [x+dx+.037*Math.cos(angle),.398,z+dz+.037*Math.sin(angle)],.013,0x6b7741,.002);
    }
    return [x,.433,z];
  }
  function create(aspect) {
    const fov = aspect < 1 ? 79 : 56;
    const eyeY = 7.5*.73*Math.tan(fov*Math.PI/360);
    const eye = [0,eyeY,7.5];
    const target = [0,eyeY,0];
    const half = 7.5*Math.tan(fov*Math.PI/360)*aspect;
    const roomy = W.clamp((aspect-.65)/.9,0,1);
    const plantX = W.mix(-.48,-.72,roomy)*half;
    const cupX = .70*half;
    const plantScale = W.mix(.84,1,roomy)*1.2;
    const bookWidth = W.mix(1.15,1.65,roomy)*1.2;
    const cupScale = 1.2;
    const bookX = cupX-bookWidth*.54-cupScale*.46-.12;
    const sill = new W.Mesh();
    const objects = new W.Mesh();
    const shadows = new W.Mesh();
    const glass = new W.Mesh();
    const span = half*3;
    sill.box(0,-.18,-.59,span,.18,1.68,color(0x795b3c));
    sill.box(0,.001,-1.40,span,.035,.065,color(0x5d4631));
    sill.box(0,-.025,.248,span,.025,.022,color(0x967047));
    for (let i = 0; i < 22; i++) {
      const z = -1.36+i*.073;
      for (let step = 0; step < 24; step++) {
        const x0 = -span/2+span*step/24;
        const x1 = -span/2+span*(step+1)/24;
        const curve = x => z+Math.sin(x*2.7+i*.8)*.006;
        sill.quad([x0,.0015,curve(x0)],[x1,.0015,curve(x1)],[x1,.0015,curve(x1)+.009],[x0,.0015,curve(x0)+.009],color(i%3 ? 0x755839 : 0x806140));
      }
    }
    const flowerZ = -.50;
    const bookZ = -.69;
    const cupZ = -.31;
    shadow(shadows,plantX+.05,flowerZ+.06,.30*plantScale,.27*plantScale);
    shadow(shadows,bookX+.035,bookZ+.035,bookWidth*.60,bookWidth*.40,-.14);
    shadow(shadows,cupX+.04,cupZ+.04,.49*cupScale,.43*cupScale);
    flowers(objects,plantX,flowerZ,plantScale);
    book(objects,bookX,bookZ,bookWidth);
    const tea = new W.Mesh();
    const source = teaSet(tea,0,0);
    for (let i = 1; i < tea.data.length; i += 10) tea.data[i] -= .014;
    appendRotated(objects,tea,cupX,cupZ,0,cupScale);
    const steamOrigin = [cupX,(source[1]-.014)*cupScale,cupZ];
    for (const [left,right,alpha] of [[-.9,-.65,.035],[-.57,-.52,.025],[.34,.55,.018]]) {
      glass.quad([left*half,-.2,-1.5],[right*half,-.2,-1.5],[(right+.72)*half,7,-1.5],[(left+.72)*half,7,-1.5],color(0xc4d8ca),-2-alpha);
    }
    return { eye, target, fov, sill: sill.data, objects: objects.data, shadows: shadows.data, glass: glass.data, steamOrigin };
  }
  function steam(seconds, origin) {
    const mesh = new W.Mesh();
    for (let wisp = 0; wisp < 3; wisp++) {
      const phase = seconds*.21+wisp*2.1;
      const point = t => [
        origin[0]+Math.sin(t*7-phase)*(.035+t*.055)+wisp*.015-.015,
        origin[1]+.02+t*.76,
        origin[2]+Math.sin(t*4-phase)*.015-t*.025
      ];
      for (let i = 0; i < 22; i++) {
        const a = i/22;
        const b = (i+1)/22;
        const vertices = [];
        for (const t of [a,b]) {
          const p = point(t);
          const width = .018+t*.025;
          const alpha = Math.sin(t*Math.PI)*(.12+.045*Math.sin(phase-t*5));
          vertices.push({p:W.add(p,[-width,0,0]),a:0},{p,a:alpha},{p:W.add(p,[width,0,0]),a:0});
        }
        for (const indices of [[0,3,4],[0,4,1],[1,4,5],[1,5,2]]) {
          for (const index of indices) mesh.data.push(...vertices[index].p,0,1,0,...color(0xede3cd),-2-vertices[index].a);
        }
      }
    }
    return mesh.data;
  }
  return { create, steam };
})();
