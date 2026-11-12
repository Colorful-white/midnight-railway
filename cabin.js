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
  // Curved leaves and petals are real double-sided surfaces with smooth normals.
  // Colour and fine fluting live in the vertices; no image planes or textures.
  function botanicalSurface(mesh, point, tint, rows, columns, inside = false) {
    const sample = (t,u) => {
      const p = point(t,u);
      const dt = W.sub(point(Math.min(1,t+.0005),u),point(Math.max(0,t-.0005),u));
      const du = W.sub(point(t,u+.0005),point(t,u-.0005));
      const normal = W.mul(W.unit(W.cross(du,dt)),inside ? -1 : 1);
      return [...p,...normal,...tint(t,u),0];
    };
    const grid = Array.from({length:rows+1},(_,r) =>
      Array.from({length:columns+1},(_,c) => sample(r/rows,c/columns)));
    for (let r=0;r<rows;r++) for (let c=0;c<columns;c++) {
      const corners = [grid[r][c],grid[r][c+1],grid[r+1][c+1],grid[r+1][c]];
      for (const index of inside ? [0,2,1,0,3,2] : [0,1,2,0,2,3]) mesh.data.push(...corners[index]);
    }
  }
  function foliage(mesh, start, tip, width, shade = 0x63834d, detail = true) {
    const direction = W.sub(tip,start);
    const side = W.unit(W.cross(direction,[0,0,1]));
    const facing = W.unit(W.cross(side,direction));
    const center = t => W.add(W.add(start,W.mul(direction,t)),W.mul(facing,Math.sin(t*Math.PI)*width*.34));
    const point = (t,u,back = false) => {
      const v = u*2-1;
      const outline = Math.sin(Math.PI*t)**.8 * (1+.045*Math.sin(t*18*Math.PI));
      return W.add(W.add(center(t),W.mul(side,width*outline*v)),
        W.mul(facing,-width*.20*Math.abs(v)*Math.sin(Math.PI*t)-(back ? .003 : 0)));
    };
    const rows = detail ? 8 : 4;
    const columns = detail ? 4 : 2;
    botanicalSurface(mesh,(t,u)=>point(t,u),(t,u)=>color(shade,.86+.15*Math.sin(Math.PI*u)+.07*t),rows,columns);
    botanicalSurface(mesh,(t,u)=>point(t,u,true),()=>color(shade,.77),rows,columns,true);
    if (!detail) return;
    for (let i=0;i<9;i++) mesh.branch(center(i/9),center((i+1)/9),.0016,.0012,color(0x9baf72));
    for (const t of [.25,.43,.61,.76]) for (const sign of [-1,1]) {
      const end = point(Math.min(.96,t+.13),.5+sign*.43);
      mesh.branch(center(t),W.add(end,W.mul(facing,.001)),.0009,.00035,color(0x7f9b60));
    }
  }
  function bell(mesh, neck, size, direction, phase = 0) {
    const axis = W.unit(direction);
    const right = W.unit(W.cross(axis,[0,0,1]));
    const up = W.cross(axis,right);
    const radial = a => W.add(W.mul(right,Math.cos(a)),W.mul(up,Math.sin(a)));
    const point = (t,u,inner = false) => {
      const angle = TAU*u+phase;
      const lobe = (.5+.5*Math.cos(angle*5))**1.3;
      const lip = W.clamp((t-.73)/.27,0,1);
      const radius = size*(.027+.091*Math.sin(Math.min(1,t/.32)*Math.PI/2)
        -.008*Math.sin(Math.PI*W.clamp((t-.32)/.5,0,1))
        +.032*lip*lip*lobe+.0015*Math.cos(angle*10)*Math.sin(t*Math.PI))-(inner ? size*.006 : 0);
      const length = size*(.32*t+.040*lip*lobe-.024*lip**4*lobe);
      return W.add(W.add(neck,W.mul(axis,length)),W.mul(radial(angle),radius));
    };
    const tint = (t,u,inner = false) => {
      const rib = .5+.5*Math.cos((TAU*u+phase)*10);
      const base = inner ? 0xdbc9ed : 0xceb6e4;
      const edge = color(0xb896d3,1.06);
      const body = color(base, 1.04+.045*rib+.025*Math.sin(t*9+phase));
      const rim = W.clamp((t-.75)/.25,0,1)*.70;
      const throat = inner ? (1-W.clamp(t/.6,0,1))*.6 : (1-W.clamp(t/.25,0,1))*.3;
      return body.map((c,i)=>W.mix(W.mix(c,edge[i],rim),color(0xc7c2a6)[i],throat));
    };
    botanicalSurface(mesh,(t,u)=>point(t,u),(t,u)=>tint(t,u),14,40);
    botanicalSurface(mesh,(t,u)=>point(t,u,true),(t,u)=>tint(t,u,true),14,40,true);
    for (let i=0;i<40;i++) mesh.quad(point(1,i/40),point(1,(i+1)/40),
      point(1,(i+1)/40,true),point(1,i/40,true),color(0xd4bde7));
    // A pale green base and five narrow sepals wrap the bell, rather than a flat star.
    mesh.branch(W.add(neck,W.mul(axis,-.035*size)),W.add(neck,W.mul(axis,.035*size)),.027*size,.038*size,color(0x718c50));
    for (let i=0;i<5;i++) {
      const a = phase+i*TAU/5;
      const start = W.add(neck,W.mul(radial(a),.017*size));
      const tip = W.add(W.add(neck,W.mul(axis,.105*size)),W.mul(radial(a),.070*size));
      foliage(mesh,start,tip,.018*size,0x789956,false);
    }
    // The central style has a three-part stigma; shorter anthers remain inside the cup.
    const pistil = W.add(neck,W.mul(axis,.245*size));
    mesh.branch(W.add(neck,W.mul(axis,.020*size)),pistil,.0045*size,.003*size,color(0xded5a4));
    for (let i=0;i<3;i++) {
      const end = W.add(W.add(pistil,W.mul(axis,.014*size)),W.mul(radial(i*TAU/3),.010*size));
      mesh.branch(pistil,end,.004*size,.0045*size,color(0xe6dbad));
    }
    for (let i=0;i<5;i++) {
      const end = W.add(W.add(neck,W.mul(axis,.17*size)),W.mul(radial(i*TAU/5),.037*size));
      mesh.branch(W.add(neck,W.mul(axis,.04*size)),end,.0017*size,.0023*size,color(0xcac694));
      mesh.branch(end,W.add(end,W.mul(axis,.014*size)),.004*size,.003*size,color(0xe0c88c));
    }
  }
  function bud(mesh, start, direction, size) {
    const axis = W.unit(direction);
    const right = W.unit(W.cross(axis,[0,0,1]));
    const across = W.cross(axis,right);
    const point = (t,u) => {
      const angle = TAU*u;
      const radius = size*(.004+.036*Math.sin(Math.PI*t)**.75)*(1+.09*Math.cos(angle*5));
      return W.add(W.add(start,W.mul(axis,t*.17*size)),
        W.add(W.mul(right,radius*Math.cos(angle)),W.mul(across,radius*Math.sin(angle))));
    };
    botanicalSurface(mesh,point,(t,u)=>color(t<.35 ? 0x799455 : 0xb7a0cc,.93+.08*Math.cos(u*TAU*5)),9,20);
    for (let i=0;i<5;i++) {
      const a=i*TAU/5;
      foliage(mesh,start,W.add(W.add(start,W.mul(axis,.084*size)),
        W.add(W.mul(right,Math.cos(a)*.035*size),W.mul(across,Math.sin(a)*.035*size))),.010*size,0x7d9b59,false);
    }
  }
  function flowers(mesh, x, z, scale) {
    const origin = [x,.0025,z];
    const pot = new W.Mesh();
    lathe(pot,0,0,0,[[.17,0],[.18,.025],[.237,.34],[.253,.35],[.257,.375],[.246,.395],[.222,.38],[.22,.34]],color(0x80907b));
    disc(pot,0,.343,0,.22,color(0x403a29));
    lathe(pot,0,0,0,[[.246,.349],[.254,.355],[.255,.371]],color(0xb4b89a));
    const stems = [
      {x:-.30,z:-.03,h:1.25,axis:[-.32,.92,.26]},
      {x:-.12,z:-.10,h:1.48,axis:[-.10,.98,.14]},
      {x:.15,z:-.07,h:1.38,axis:[.28,.93,.20]},
      {x:.34,z:.02,h:1.10,axis:[.51,.73,.43]},
      {x:.03,z:.14,h:.94,axis:[-.13,.55,.83]}
    ];
    for (const [index, stem] of stems.entries()) {
      const p0 = [stem.x*.16,.345,stem.z*.3];
      const p1 = [stem.x*.32,.72,stem.z*.7];
      const p2 = [stem.x*.85,stem.h-.18,stem.z-.03];
      const p3 = [stem.x,stem.h,stem.z];
      const point = t => [0,1,2].map(j => (1-t)**3*p0[j]+3*(1-t)**2*t*p1[j]+3*(1-t)*t*t*p2[j]+t**3*p3[j]);
      for (let i = 0; i < 16; i++) pot.branch(point(i/16),point((i+1)/16),.009-i*.0003,.0087-i*.0003,color(0x627c48));
      for (const t of [.24,.42,.59,.76]) {
        const start = point(t);
        const side = (index + Math.round(t*10)) % 2 ? 1 : -1;
        foliage(pot,start,W.add(start,[side*(.19+.05*(1-t)),.07,.055+index*.008]),.044*(1.25-t*.5));
      }
      bell(pot,p3,index===1 ? .92 : .86,stem.axis,index*.31);
      for (const [j,t] of [.57,.78].entries()) {
        if (index===4 && j===1) continue;
        const side = (index+j)%2 ? 1 : -1;
        const start = point(t);
        const neck = W.add(start,[side*(j ? .14 : .20),.08,.07+(index%2)*.06]);
        const elbow = W.add(start,[side*.075,.025,.035]);
        pot.branch(start,elbow,.005,.004,color(0x67814d));
        pot.branch(elbow,neck,.004,.0035,color(0x718b52));
        if (j===1 && index%2===0) bud(pot,neck,[side*.3,.90,.3],.86);
        else bell(pot,neck,j ? .70 : .79,[side*.40,.48+(j*.2),.72],index*.43+j*.67);
      }
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
    const plantX = W.mix(-.35,-.72,roomy)*half;
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
  const steamRows = 32, steamColumns = 4;
  // Reuse both CPU and GPU storage: the fine mist must not allocate meshes every frame.
  const steamData = new Float32Array(3*2*steamRows*steamColumns*6*10);
  const steamGrid = new Float32Array((steamRows+1)*(steamColumns+1)*4);
  const steamTint = color(0xf4eddf);
  function steam(seconds, origin) {
    let offset = 0;
    for (let wisp=0;wisp<3;wisp++) {
      const phase = wisp*2.14;
      const time = seconds*(.64+wisp*.035);
      // Two intersecting soft cross-sections give each tendril depth, not a hard outline.
      for (const angle of [-.58,.58]) {
        for (let row=0;row<=steamRows;row++) {
          const t = row/steamRows;
          const lift = t*(1.02+wisp*.075);
          const spread = .012+.075*t*t;
          const x = origin[0]+(wisp-1)*.065
            + Math.sin(t*7.2-time+phase)*spread+.035*t*t;
          const y = origin[1]-.035+lift;
          const z = origin[2]+(wisp-1)*.024
            +Math.sin(t*5.6-time*.73+phase)*(.009+.035*t)-.04*t;
          const width = .019+.052*t*(.82+.18*Math.sin(t*9-time+phase));
          const appear = W.smooth(W.clamp(t/.13,0,1));
          const dissolve = (1-t)**1.6;
          // Brightness packets travel upward; their ends disappear before a new curl forms.
          const packet = .62+.38*Math.sin(t*10.5-seconds*1.12+phase);
          const alpha = .17*appear*dissolve*packet;
          for (let column=0;column<=steamColumns;column++) {
            const across = column/steamColumns*2-1;
            const feather = (Math.exp(-3.8*across*across)-Math.exp(-3.8))/(1-Math.exp(-3.8));
            const i = (row*(steamColumns+1)+column)*4;
            steamGrid[i] = x+Math.cos(angle)*across*width;
            steamGrid[i+1] = y;
            steamGrid[i+2] = z+Math.sin(angle)*across*width;
            steamGrid[i+3] = alpha*feather*.68;
          }
        }
        for (let row=0;row<steamRows;row++) for (let column=0;column<steamColumns;column++) {
          const a = row*(steamColumns+1)+column;
          const b = a+steamColumns+1;
          for (const index of [a,b,b+1,a,b+1,a+1]) {
            const i = index*4;
            steamData[offset++] = steamGrid[i];
            steamData[offset++] = steamGrid[i+1];
            steamData[offset++] = steamGrid[i+2];
            steamData[offset++] = 0;
            steamData[offset++] = 1;
            steamData[offset++] = 0;
            steamData[offset++] = steamTint[0];
            steamData[offset++] = steamTint[1];
            steamData[offset++] = steamTint[2];
            steamData[offset++] = -2-steamGrid[i+3];
          }
        }
      }
    }
    return steamData;
  }
  return { create, steam };
})();
