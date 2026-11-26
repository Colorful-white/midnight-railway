const CabinScene = (() => {
  const W = RailwayWorld;
  const TAU = Math.PI * 2;
  const color = (hex, strength = 1) => [16, 8, 0].map(shift => ((hex >> shift) & 255) / 255 * strength);
  const options = {
    flower: {label:'花', choices:{bellflower:'风铃花',tulip:'郁金香',daisy:'雏菊'}},
    item: {label:'摆件', choices:{book:'书本',postcard:'明信片',musicbox:'音乐盒',empty:'留空'}},
    drink: {label:'饮品和点心', choices:{tea:'热茶',lemon:'柠檬茶',watermelon:'西瓜汁','strawberry-cake':'草莓蛋糕'}}
  };

  function surface(mesh, vertices, normals, shade, material = 0) {
    for (let i = 0; i < 3; i++) mesh.data.push(...vertices[i], ...normals[i], ...shade, material);
  }
  function lathe(mesh, x, y, z, profile, shade, sides = 48, material = 0) {
    for (let row = 0; row < profile.length - 1; row++) {
      const [r0, h0] = profile[row];
      const [r1, h1] = profile[row + 1];
      const normal = angle => W.unit([(h1 - h0) * Math.cos(angle), r0 - r1, (h1 - h0) * Math.sin(angle)]);
      for (let i = 0; i < sides; i++) {
        const a = TAU * i / sides;
        const b = TAU * (i + 1) / sides;
        const p = (radius, height, angle) => [x + radius * Math.cos(angle), y + height, z + radius * Math.sin(angle)];
        const [p0,p1,p2,p3] = [p(r0,h0,a),p(r0,h0,b),p(r1,h1,b),p(r1,h1,a)];
        surface(mesh, [p0,p1,p2], [normal(a),normal(b),normal(b)], shade,material);
        surface(mesh, [p0,p2,p3], [normal(a),normal(b),normal(a)], shade,material);
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
    const data = mesh.data;
    for (let i = 0; i < data.length; i += 10) {
      const px=data[i], pz=data[i+2], nx=data[i+3], nz=data[i+5];
      target.data.push(x+scale*(c*px-s*pz),data[i+1]*scale,z+scale*(s*px+c*pz),
        c*nx-s*nz,data[i+4],s*nx+c*nz,data[i+6],data[i+7],data[i+8],data[i+9]);
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
  function flowerPot(mesh, body, rim) {
    lathe(mesh,0,0,0,[[.17,0],[.18,.025],[.237,.34],[.253,.35],[.257,.375],[.246,.395],[.222,.38],[.22,.34]],color(body));
    disc(mesh,0,.343,0,.22,color(0x403a29));
    lathe(mesh,0,0,0,[[.246,.349],[.254,.355],[.255,.371]],color(rim));
  }
  function bellflowers(pot) {
    flowerPot(pot,0x80907b,0xb4b89a);
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
  }
  function tulip(mesh, base, height, lean, shade, phase) {
    // Two staggered rings overlap around the hollow cup.
    for (let i=0;i<6;i++) {
      const angle = phase+i*TAU/6;
      const outer = i%2===0;
      const point = (t,u,inside = false) => {
        const across = u*2-1;
        const arc = angle+across*(.18+.52*Math.sin(t*Math.PI*.88));
        const bloom = Math.sin(t*Math.PI*.66)**.83;
        const radius = .029+bloom*(outer ? .130 : .113)-(inside ? .005 : 0);
        const y = (height+.012*(outer ? 0 : 1))*t*(1-.24*across*across*t);
        return [base[0]+Math.cos(arc)*radius+lean*t,base[1]+y,base[2]+Math.sin(arc)*radius];
      };
      const tint = (t,u) => color(shade,.86+.15*t+.05*Math.sin(u*Math.PI));
      botanicalSurface(mesh,point,tint,12,10);
      botanicalSurface(mesh,(t,u)=>point(t,u,true),(t,u)=>W.mul(tint(t,u),1.05),12,10,true);
      for (let k=0;k<10;k++) mesh.quad(point(1,k/10),point(1,(k+1)/10),
        point(1,(k+1)/10,true),point(1,k/10,true),color(shade,1.06));
    }
  }
  function tulips(mesh) {
    flowerPot(mesh,0xcab898,0xe1d2af);
    for (const [x,y,z,shade,phase] of [
      [-.27,1.17,.035,0xe9a197,.1],[-.09,1.43,-.09,0xf2bdad,.56],
      [.19,1.31,-.06,0xe4a287,1.0],[.34,1.04,.08,0xf1baa2,.31],[-.02,.95,.16,0xf5d0bb,.83]
    ]) {
      const root = [x*.27,.343,z*.5];
      const bend = [x*.56,y*.73,z*.66];
      const tip = [x,y,z];
      mesh.branch(root,bend,.013,.010,color(0x68884b));
      mesh.branch(bend,tip,.010,.008,color(0x789753));
      foliage(mesh,root,W.add(bend,[x<0 ? -.22 : .22,.19,.09]),.075,0x71924e);
      foliage(mesh,W.mul(W.add(root,bend),.5),W.add(bend,[x<0 ? .09 : -.11,.10,.13]),.055,0x81a260);
      tulip(mesh,tip,.33+phase*.041,x*.12,shade,phase);
    }
  }
  function daisy(mesh, center, direction, size, phase) {
    const axis = W.unit(direction);
    const right = W.unit(W.cross(axis,[0,1,0]));
    const up = W.cross(axis,right);
    for (let i=0;i<12;i++) {
      const angle = phase+i*TAU/12;
      const ray = W.add(W.mul(right,Math.cos(angle)),W.mul(up,Math.sin(angle)));
      const side = W.cross(axis,ray);
      const point = (t,u) => {
        const width = Math.sin(Math.PI*t)**.82*size;
        return W.add(W.add(center,W.mul(ray,size*(.28+.77*t))),
          W.add(W.mul(side,.20*width*Math.cos(TAU*u)),W.mul(axis,.075*width*Math.sin(TAU*u)-.13*t*t*size)));
      };
      botanicalSurface(mesh,point,(t,u)=>color(0xf5ead5,.90+.12*t+.045*Math.sin(TAU*u)),8,8);
    }
    const button = (t,u) => {
      const radius = .35*size*Math.sin(Math.PI*t);
      return W.add(W.add(center,W.mul(axis,.17*size*Math.cos(Math.PI*t))),
        W.add(W.mul(right,radius*Math.cos(TAU*u)),W.mul(up,radius*Math.sin(TAU*u))));
    };
    botanicalSurface(mesh,button,(t,u)=>color(0xe7b24e,.93+.09*Math.sin(TAU*u*12)*Math.sin(t*Math.PI*14)),12,32);
  }
  function daisies(mesh) {
    flowerPot(mesh,0x86a294,0xb6c7ad);
    for (const [x,y,z,s,phase] of [
      [-.33,1.12,.06,.185,.2],[-.12,1.49,.04,.205,.8],[.19,1.29,-.11,.20,.4],
      [.38,1.00,.04,.177,.3],[.02,.89,.19,.163,.9],[-.25,.79,.17,.151,.6]
    ]) {
      const root = [x*.24,.344,z*.3], bend = [x*.70,y*.77,z*.78], tip = [x,y,z];
      mesh.branch(root,bend,.010,.008,color(0x6e8650));
      mesh.branch(bend,tip,.008,.006,color(0x819b55));
      foliage(mesh,bend,W.add(bend,[x<0 ? -.18 : .18,.075,.11]),.034,0x779455);
      foliage(mesh,W.mul(W.add(root,bend),.5),W.add(bend,[.03,-.11,.14]),.039,0x6c8950);
      daisy(mesh,tip,[x*.86,.64,.85],s,phase);
    }
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
  function postcard(mesh, x, z, width) {
    const beneath = new W.Mesh();
    beneath.box(0,.005,0,1.48,.031,.86,color(0xc2a68e));
    appendRotated(mesh,beneath,x+.03,z+.02,-.26,width/1.65);
    const card = new W.Mesh();
    card.box(0,.039,0,1.46,.024,.89,color(0xe9d5af));
    card.box(0,.064,0,1.30,.002,.72,color(0x8facba));
    const p = (px,pz) => [px,.067,pz];
    card.triangle(p(-.65,.10),p(-.31,-.27),p(.14,.10),color(0x6a8b90));
    card.triangle(p(-.20,.10),p(.19,-.19),p(.60,.10),color(0x789d94));
    card.triangle(p(-.414,-.157),p(-.31,-.27),p(-.167,-.152),color(0xe4dbc2));
    card.box(0,.067,.223,1.30,.002,.25,color(0x648887));
    for (const [px,pz,span] of [[.25,.17,.42],[-.28,.24,.38],[.06,.31,.52]]) {
      card.box(px,.07,pz,span,.001,.007,color(0x9ab7ac));
    }
    disc(card,.417,.069,-.207,.085,color(0xf2c17c),24);
    appendRotated(mesh,card,x,z,-.06,width/1.65);
  }
  function musicBox(mesh,x,z,width) {
    const local = new W.Mesh(), lid = new W.Mesh();
    const wood = color(0x805638), edge = color(0xa47753), dark = color(0x543b2e), brass = color(0xc59e61);
    local.box(0,.004,0,.99,.048,.65,dark);
    local.box(0,.050,0,.96,.095,.62,wood);
    local.box(0,.138,0,.84,.012,.49,color(0x5f4733));
    for (const side of [-1,1]) {
      local.box(side*.455,.130,0,.050,.110,.62,edge);
      local.box(0,.130,side*.286,.91,.085,.049,wood);
      local.box(side*.28,.214,-.278,.12,.026,.082,brass);
    }
    local.box(0,.087,.313,.78,.010,.007,edge);
    local.box(0,.125,.318,.126,.064,.013,brass);
    local.box(0,.143,.325,.040,.023,.006,dark);
    local.box(.025,.150,.053,.65,.023,.37,color(0x73634d));

    const barrel = (px,angle,radius) => [px,.256+radius*Math.cos(angle),.008+radius*Math.sin(angle)];
    for (let i=0;i<24;i++) {
      const a=TAU*i/24, b=TAU*(i+1)/24;
      local.quad(barrel(-.269,a,.074),barrel(-.269,b,.074),barrel(.170,b,.074),barrel(.170,a,.074),brass);
      for (const end of [-.269,.170]) {
        local.triangle([end,.256,.008],barrel(end,a,.074),barrel(end,b,.074),edge);
      }
    }
    for (let i=0;i<11;i++) {
      const a = .13+(i%3)*.69;
      local.branch(barrel(-.245+i*.039,a,.071),barrel(-.245+i*.039,a,.090),.005,.003,color(0xe0bc7b));
      local.box(-.245+i*.039,.185,.146,.021,.014,.118+(i%4)*.014,color(0xc6baa0));
    }
    local.box(-.299,.162,.005,.065,.105,.14,dark);
    local.box(.199,.161,.005,.063,.105,.14,dark);
    local.branch([.465,.140,.014],[.607,.140,.014],.018,.016,brass);
    local.box(.602,.105,.014,.050,.071,.119,brass);
    local.box(.628,.123,.014,.014,.036,.071,dark);

    lid.box(0,0,.304,.974,.042,.60,wood);
    lid.box(0,-.012,.312,.807,.013,.462,dark);
    lid.box(0,-.016,.312,.695,.005,.355,color(0x986a4d));
    lid.box(0,-.018,.527,.138,.009,.043,brass);
    const angle = Math.PI*.28, c=Math.cos(angle), s=Math.sin(angle);
    for (let i=0;i<lid.data.length;i+=10) {
      const [px,py,pz,nx,ny,nz,...paint]=lid.data.slice(i,i+10);
      local.data.push(px,.235+c*py+s*pz,-.290+c*pz-s*py,nx,c*ny+s*nz,c*nz-s*ny,...paint);
    }
    appendRotated(mesh,local,x,z,-.23,width/1.63);
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
  function lemonWheel(mesh, x, y, z) {
    const point = (radius,angle,face) => [x+radius*Math.cos(angle),y+radius*Math.sin(angle),z+face];
    for (let i=0;i<30;i++) {
      const a=TAU*i/30, b=TAU*(i+1)/30;
      mesh.quad(point(.146,a,-.018),point(.146,b,-.018),point(.146,b,.018),point(.146,a,.018),color(0xe6b747));
      for (const face of [-.018,.018]) {
        mesh.quad(point(.131,a,face),point(.131,b,face),point(.146,b,face),point(.146,a,face),color(0xf0d079));
      }
    }
    for (let i=0;i<9;i++) {
      const a=TAU*i/9, b=TAU*(i+1)/9;
      for (const face of [-.018,.018]) {
        mesh.triangle([x,y,z+face],point(.132,a,face),point(.132,b,face),color(0xecc16a));
        const top = face+Math.sign(face)*.001;
        mesh.triangle(point(.014,(a+b)*.5,top),point(.120,a+.035,top),point(.120,b-.035,top),color(i%2 ? 0xf3ca65 : 0xffd877));
      }
    }
  }
  function watermelonWedge(mesh,x,y,z) {
    const point = (radius,angle,face) => [x+radius*Math.cos(angle),y+radius*Math.sin(angle),z+face];
    const angle = t => -Math.PI/2+(t-.5)*1.54;
    const flesh = color(0xdd6f76), pith = color(0xc8cc8c), rind = color(0x729354);
    for (let i=0;i<14;i++) {
      const a=angle(i/14), b=angle((i+1)/14);
      mesh.quad(point(.170,a,-.023),point(.170,b,-.023),point(.170,b,.023),point(.170,a,.023),rind);
      for (const face of [-.023,.023]) {
        mesh.triangle([x,y,z+face],point(.143,a,face),point(.143,b,face),flesh);
        mesh.quad(point(.142,a,face),point(.142,b,face),point(.153,b,face),point(.153,a,face),pith);
        mesh.quad(point(.153,a,face),point(.153,b,face),point(.170,b,face),point(.170,a,face),rind);
      }
    }
    for (const a of [angle(0),angle(1)]) {
      mesh.quad([x,y,z-.023],point(.17,a,-.023),point(.17,a,.023),[x,y,z+.023],flesh);
    }
    for (const [r,a] of [[.077,.29],[.099,.56],[.079,.76]]) {
      const seed = point(r,angle(a),.025);
      mesh.branch(seed,W.add(seed,[.003,-.014,0]),.0046,.0024,color(0x473635));
    }
  }
  function coldDrink(mesh, glass, kind) {
    const lemon = kind==='lemon';
    const fill = lemon ? 0xb97a35 : 0xd05a62;
    const height = lemon ? .70 : .76;
    const coaster = lemon ? 0x92a797 : 0xd2b5a1;
    lathe(mesh,0,0,0,[[0,.006],[.29,.006],[.31,.027],[.29,.046],[0,.046]],color(coaster),36);
    lathe(mesh,0,0,0,[[0,.046],[.186,.046],[.194,.086],[.189,.11],[0,.11]],color(0x9aab9f),36);
    lathe(mesh,0,0,0,[[.170,.096],[.183,.20],[.212,height-.091]],color(fill),40);
    disc(mesh,0,height-.091,0,.212,color(lemon ? 0xca8f48 : 0xe4777e),40);
    lathe(glass,0,0,0,[[.194,.083],[.203,.20],[.231,height],[.240,height+.009],[.224,height+.021]],color(0xb7c8bf),40,-2.095);
    lathe(mesh,0,0,0,[[.228,height+.004],[.235,height+.008],[.226,height+.014]],color(0xced6c2),40);
    for (const [x,z,angle] of [[-.090,.052,.31],[.069,-.092,-.37],[.113,.071,.67]]) {
      const ice = new W.Mesh();
      ice.box(0,height-.104,0,.137,.084,.123,color(lemon ? 0xdfc897 : 0xe2b8af));
      ice.box(0,height-.020,0,.116,.009,.103,color(0xece0ca));
      appendRotated(mesh,ice,x,z,angle);
    }
    if (lemon) {
      lemonWheel(mesh,-.159,height+.042,-.030);
      leaf(mesh,[.06,height-.003,-.09],[.141,height+.02,-.15],.034,0x698c58,.012);
    } else {
      const bottom = [.067,height-.082,-.10], top = [.162,height+.25,-.115];
      mesh.branch(bottom,top,.023,.023,color(0xc5d8bc));
      mesh.branch(top,[.188,height+.285,-.122],.023,.020,color(0xe2dcc4));
      watermelonWedge(mesh,-.158,height+.134,-.026);
    }
  }
  function strawberry(mesh,x,y,z,size,phase,shade) {
    const profile = [[.016,0],[.058,.023],[.103,.083],[.128,.144],[.124,.198],[.088,.228],[.024,.232]];
    lathe(mesh,x,y,z,profile.map(([r,h])=>[r*size,h*size]),color(shade),28);
    for (let row=0;row<3;row++) {
      const [r,h] = profile[row+2];
      for (let i=0;i<9;i++) {
        const angle = TAU*(i+row*.43)/9+phase;
        const center = [x+(r+.002)*size*Math.cos(angle),y+h*size,z+(r+.002)*size*Math.sin(angle)];
        mesh.branch(center,W.add(center,[0,.017*size,0]),.0034*size,.0015*size,color(0xd9a56d));
      }
    }
    disc(mesh,x,y+.233*size,z,.026*size,color(0x758647),16);
    const crown = [x,y+.238*size,z];
    for (let i=0;i<5;i++) {
      const angle = phase+TAU*i/5;
      leaf(mesh,crown,W.add(crown,[Math.cos(angle)*.103*size,-.009*size,Math.sin(angle)*.103*size]),
        .024*size,0x8c9f61,.018);
    }
  }
  function strawberryCake(mesh) {
    const porcelain = color(0xd8c3a4);
    lathe(mesh,0,0,0,[[0,.007],[.23,.007],[.39,.035],[.445,.060],[.445,.070],[.40,.09],[.31,.068],[0,.061]],porcelain,40);
    lathe(mesh,0,0,0,[[.406,.085],[.417,.082],[.425,.079]],color(0xb99066),40);
    const slice = new W.Mesh();
    const point = (y,a) => [.442*Math.sin(a),y,.244-.442*Math.cos(a)];
    const tip = y => [0,y,.244];
    const edge = .66;
    const cream = color(0xf3e0c7);
    for (const [low,high,shade] of [
      [.067,.133,0xc99563],[.133,.195,0xf4dac0],[.195,.258,0xd7a06d],
      [.258,.311,0xeab5b0],[.311,.374,0xdeb17b],[.374,.419,0xf4e2c9]
    ]) {
      const filling = color(shade);
      slice.quad(point(low,-edge),tip(low),tip(high),point(high,-edge),filling);
      slice.quad(tip(low),point(low,edge),point(high,edge),tip(high),filling);
      for (let i=0;i<12;i++) {
        const a = W.mix(-edge,edge,i/12), b = W.mix(-edge,edge,(i+1)/12);
        slice.quad(point(low,b),point(low,a),point(high,a),point(high,b),color(0xe6cfb7));
        if (high===.419) slice.triangle(tip(high),point(high,b),point(high,a),cream);
      }
    }
    for (const side of [-1,1]) {
      for (const [distance,low,high] of [[.16,.153,.180],[.60,.144,.184],[.39,.266,.298],[.79,.270,.299]]) {
        const berry = (d,y,depth) => {
          const [x,,z]=point(y,side*edge);
          return [x*d+side*.0015,y,W.mix(.244,z,d)+depth];
        };
        const near = berry(distance-.074,high,.004), far = berry(distance+.067,high-.004,.004);
        slice.triangle(side<0 ? near : far,side<0 ? far : near,berry(distance+.013,low,.004),color(0xc35b63));
      }
    }
    lathe(slice,-.045,.419,-.075,[[.072,0],[.091,.018],[.080,.034],[.058,.047],[.023,.058]],cream,28);
    strawberry(slice,-.048,.471,-.075,.64,.7,0xcd555e);
    lathe(slice,.082,.419,-.004,[[.044,0],[.062,.017],[.052,.031],[.019,.048],[0,.055]],cream,18);
    appendRotated(mesh,slice,0,0,-.57);
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
    for (const [left,right,alpha] of [[-.9,-.65,.035],[-.57,-.52,.025],[.34,.55,.018]]) {
      glass.quad([left*half,-.2,-1.5],[right*half,-.2,-1.5],[(right+.72)*half,7,-1.5],[(left+.72)*half,7,-1.5],color(0xc4d8ca),-2-alpha);
    }
    const slots = {flower:[plantX,-.50,plantScale],item:[bookX,-.69,bookWidth],drink:[cupX,-.31,cupScale]};
    return {eye,target,fov,sill:sill.data,glass:glass.data,slots};
  }
  function prop([x,z,scale],slot,choice) {
    const objects = new W.Mesh(), shadows = new W.Mesh(), glass = new W.Mesh();
    let steamOrigin = null;
    if (slot==='flower') {
      const pot = new W.Mesh();
      const plant = {bellflower:bellflowers,tulip:tulips,daisy:daisies}[choice];
      plant(pot);
      for (let i=1;i<pot.data.length;i+=10) pot.data[i] += .0025/scale;
      appendRotated(objects,pot,x,z,0,scale);
      shadow(shadows,x+.05,z+.06,.30*scale,.27*scale);
    } else if (slot==='item' && choice!=='empty') {
      if (choice==='book') book(objects,x,z,scale);
      else if (choice==='musicbox') musicBox(objects,x,z,scale);
      else postcard(objects,x,z,scale);
      if (choice==='musicbox') shadow(shadows,x+.04,z+.04,scale*.37,scale*.24,-.23);
      else shadow(shadows,x+.035,z+.035,scale*.60,scale*.40,-.14);
    } else if (slot==='drink') {
      const drink = new W.Mesh(), shell = new W.Mesh();
      if (choice==='tea') {
        const source = teaSet(drink,0,0);
        for (let i=1;i<drink.data.length;i+=10) drink.data[i] -= .014;
        steamOrigin = [x,(source[1]-.014)*scale,z];
      } else if (choice==='strawberry-cake') {
        strawberryCake(drink);
      } else {
        coldDrink(drink,shell,choice);
        appendRotated(glass,shell,x,z,0,scale);
      }
      appendRotated(objects,drink,x,z,0,scale);
      const dish = choice==='tea'||choice==='strawberry-cake';
      shadow(shadows,x+.04,z+.04,(dish ? .49 : .35)*scale,(dish ? .43 : .31)*scale);
    }
    return {objects:objects.data,shadows:shadows.data,glass:glass.data,steamOrigin};
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
  return {options,create,prop,steam};
})();
