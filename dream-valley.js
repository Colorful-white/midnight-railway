const DreamValley = (() => {
  const W = RailwayWorld;
  const valley = W.dream;
  const start = W.distanceAt(valley.minute);
  const end = W.distanceAt(valley.minute+valley.duration);
  const ease = (value,a,b) => W.smooth(W.clamp((value-a)/(b-a),0,1));

  function influence([x,,z]) {
    return ease(x,4920,5210)*(1-ease(x,5960,6280))*ease(z,169,305)*(1-ease(z,725,809));
  }

  function overhead(distance) {
    const strength = ease(distance,start-40,start+145)*(1-ease(distance,end-160,end+20));
    if (!strength) return null;
    const [x,y,z] = W.position(distance);
    return {strength, target:[x-23,y*.36,z-92], radius:161};
  }

  function lanterns(mesh,halos) {
    const posts = [
      [6058,541,2.7],[6048,511,3.3],[6028,516,3.5],[6019,474,3.6],[5998,478,3.4],[5920,484,3.2],
      [5855,541,2.7],[5805,558,2.9],[5741,581,2.7],[5681,588,2.4],[5655,586,2.2]
    ];
    for (const [x,z,height] of posts) {
      const y = W.groundHeight(x,z);
      mesh.cone(x,y,z,.36,.22,height,[.26,.23,.22],6);
      mesh.box(x,y+height,z,1.3,.76,1.18,[.92,.68,.39],1.28);
      mesh.cone(x,y+height+.76,z,.92,.47,.39,[.28,.24,.22],4);
      mesh.box(x,y+height-.10,z,1.52,.12,1.40,[.27,.23,.20]);
      for (const [radius,light] of [[2.4,-2.022],[1.3,-2.044]]) {
        halos.cone(x,y+height+.38-radius*.54,z,0,radius,radius*.54,[1,.71,.43],12,0,light);
        halos.cone(x,y+height+.38,z,radius,0,radius*.54,[1,.71,.43],12,0,light);
      }
    }
    for (const [x,z,h] of [[6122,569,1.2],[6107,567,1.1],[6092,565,.9],[6075,564,.9],[6036,567,1.1],[6022,566,.7]]) {
      if (!W.nearRail(x,z,7)) mesh.cone(x,W.groundHeight(x,z),z,h*.53,.15,h,[.38,.38,.32],5);
    }
  }

  function pine(mesh,x,z,height) {
    if (W.nearRail(x,z,13)) return;
    const y = W.groundHeight(x,z)-.24;
    mesh.cone(x,y,z,height*.045,height*.025,height*.68,[.25,.24,.24],5);
    for (let layer=0;layer<3;layer++) {
      mesh.cone(x,y+height*(.22+layer*.18),z,height*(.25-layer*.042),.06,height*.45,
        [.22+layer*.018,.31+layer*.025,.35+layer*.027],7,layer*.14);
    }
  }

  function groves(mesh) {
    for (const minute of [1390.8,1391.47,1392.19]) {
      const distance = W.distanceAt(minute);
      const [x,,z] = W.position(distance);
      const [hx,,hz] = W.heading(distance);
      for (const [ahead,side,height] of [[-23,43,6.3],[0,46,8.2],[9,54,6],[26,62,4.8],[44,51,5.4]]) {
        pine(mesh,x+hx*ahead-hz*side,z+hz*ahead+hx*side,height);
      }
    }
    const [x,z] = valley.cottage;
    for (const [dx,dz,height] of [[-17,6,7.4],[-25,-2,10],[15,-6,8.5],[23,2,6.7],[32,-9,7.9]]) {
      pine(mesh,x+dx,z+dz,height);
    }
  }

  function cottage(mesh,halos) {
    const [x,z] = valley.cottage;
    const y = W.groundHeight(x,z)-.26;
    const wood = [.40,.33,.33], cream = [.62,.53,.46], roof = [.35,.37,.49], trim = [.28,.25,.28];
    const front = z+6.15;
    mesh.box(x,y-.62,z,18,1.52,14,trim);
    mesh.box(x,y+.78,z,16.6,7.05,12.3,wood);
    for (let i=1;i<=5;i++) mesh.box(x,y+i*1.16,front,16.6,.07,.12,trim);
    mesh.box(x,y+.65,front+1.15,13.2,.36,2.7,cream);
    mesh.box(x,y+.28,front+3.4,4.0,.34,1.65,wood);
    mesh.box(x,y-.03,front+4.15,4.25,.32,1.52,trim);
    for (const side of [-1,1]) {
      mesh.box(x+side*7.9,y+.85,front,.27,7.05,.27,cream);
      mesh.box(x+side*6.0,y+1,front+2.3,.20,5.6,.20,cream);
    }

    const eave = y+7.30, peak = y+12.65, gable = 9.55, depth = 7.25;
    const roofPoint = (side,run,dz) => [x+side*gable*run,W.mix(peak,eave,run),z+dz];
    for (const side of [-1,1]) {
      for (let row=0;row<6;row++) {
        const upper = row/6, lower = (row+1)/6;
        mesh.quad(roofPoint(side,upper,-depth),roofPoint(side,upper,depth),
          roofPoint(side,lower,depth),roofPoint(side,lower,-depth),W.mul(roof,row%2===0 ? 1.12 : .91));
      }
      mesh.triangle([x,eave,front],[x,peak,front],[x+side*8.3,eave,front],wood);
      mesh.triangle([x,peak,z-6.15],[x,eave,z-6.15],[x+side*8.3,eave,z-6.15],wood);
      mesh.branch(roofPoint(side,0,depth),roofPoint(side,1,depth),.19,.19,cream);
    }
    mesh.box(x+4.3,y+9,z-2.3,1.2,3.26,1.2,trim);
    mesh.box(x+4.3,y+12.18,z-2.3,1.45,.24,1.45,cream);

    const amber = [1,.70,.40];
    for (const dx of [-4.45,4.45]) {
      mesh.box(x+dx,y+3.2,front+.12,3.42,2.66,.25,cream);
      mesh.box(x+dx,y+3.5,front+.29,2.79,2.16,.14,amber,.92);
      mesh.box(x+dx,y+3.49,front+.41,.13,2.17,.10,trim);
      mesh.box(x+dx,y+4.45,front+.41,2.79,.12,.10,trim);
      mesh.box(x+dx,y+3.12,front+.28,3.68,.15,.47,cream);
    }
    mesh.box(x,y+.88,front+.19,2.76,4.36,.29,trim);
    mesh.box(x,y+3.9,front+.39,1.42,.76,.12,amber,.71);
    mesh.box(x,y+1.52,front+.41,.10,2.38,.10,wood);
    mesh.box(x+.97,y+2.83,front+.44,.19,.19,.17,cream);
    mesh.box(x,y+6.44,front+1.0,13, .3,2.7,roof);

    // Pools of warm light follow the bank beneath the windows.
    const poolZ = front+2.8;
    const center = [x,W.groundHeight(x,poolZ)+.24,poolZ];
    const pool = [.87,.58,.34];
    for (let i=0;i<18;i++) {
      const point = step => {
        const angle = step*Math.PI/9;
        const px = center[0]+Math.cos(angle)*12.2, pz = center[2]+Math.sin(angle)*5.6;
        return [px,W.groundHeight(px,pz)+.14,pz];
      };
      halos.triangle(center,point(i),point(i+1),pool,-2.24,-2.001,-2.001);
    }
  }

  function stonePath(mesh) {
    const [cottageX,cottageZ] = valley.cottage;
    for (let x=cottageX+3;x<=5945;x+=8.5) {
      const progress = (x-cottageX)/(5945-cottageX);
      const z = W.mix(cottageZ+10,493,progress)+24*Math.sin(progress*Math.PI);
      const y = W.groundHeight(x,z)-.18;
      const width = 1.2+.28*Math.sin(x*.31);
      mesh.cone(x,y,z,width,width*.85,.43,[.37,.37,.41],5,.11);
    }
  }

  function cloudBank(mesh,x,z,radiusX,radiusZ,base,height,tint,density) {
    const rows = 10, sides = 36;
    const sample = (row,side) => {
      const a = side*Math.PI*2/sides, latitude = row*Math.PI/rows;
      const radial = Math.sin(latitude);
      const px = radial*Math.cos(a), py = Math.cos(latitude), pz = radial*Math.sin(a);
      const edge = 1+.13*Math.sin(a*3+x*.04)+.10*Math.cos(a*5+z*.07);
      const position = [x+radiusX*px*edge,base+height*py+px*2.4+1.1*Math.sin(px*7+z*.10),z+radiusZ*pz*edge];
      const normal = W.unit([px,py*.42,pz]);
      return [...position,...normal,...tint,-2-density];
    };
    const rings = Array.from({length:rows+1},(_,row)=>Array.from({length:sides+1},(_,side)=>sample(row,side)));
    for (let row=0;row<rows;row++) for (let side=0;side<sides;side++) {
      const a=rings[row][side], b=rings[row+1][side], c=rings[row+1][side+1], d=rings[row][side+1];
      if (row) mesh.data.push(...a,...b,...d);
      if (row<rows-1) mesh.data.push(...b,...c,...d);
    }
  }

  function create() {
    const objects=new W.Mesh(), halos=new W.Mesh(), clouds=new W.Mesh(), moon=new W.Mesh();
    lanterns(objects,halos);
    groves(objects);
    stonePath(objects);
    cottage(objects,halos);
    const banks = [
      [5820,449,101,56,-8,13,[.69,.69,.84],.24],
      [5744,475,91,49,-18,20,[.74,.73,.86],.36],
      [5642,446,125,57,-19,19,[.77,.75,.88],.40],
      [5556,474,105,54,-20,20,[.72,.71,.85],.34],
      [5593,520,108,38,-11,15,[.71,.72,.87],.29],
      [5680,518,120,33,-15,15,[.69,.71,.87],.27],
      [5453,453,86,40,-1,14,[.66,.67,.81],.21],
      [5272,406,130,49,5,7,[.57,.59,.76],.10]
    ];
    for (const bank of banks) cloudBank(clouds,...bank);
    const moonPoint = (ring,side) => {
      const angle = side*Math.PI/8;
      const latitude = ring*Math.PI/12;
      return [5260+4.3*Math.sin(latitude)*Math.cos(angle), 95+4.3*Math.cos(latitude),
        234+4.3*Math.sin(latitude)*Math.sin(angle)];
    };
    for (let ring=0;ring<12;ring++) for (let side=0;side<16;side++) {
      moon.quad(moonPoint(ring,side),moonPoint(ring+1,side),moonPoint(ring+1,side+1),moonPoint(ring,side+1),[.68,.71,.83],.12);
    }
    return {objects:objects.data,halos:halos.data,clouds:clouds.data,moon:moon.data};
  }

  function cloudDrift(seconds) {
    return [7*Math.sin(seconds*.033),.48*Math.sin(seconds*.028),3.2*Math.cos(seconds*.029)];
  }

  const warmth = ([x]) => ease(x,5710,6125);

  return {influence,overhead,create,cloudDrift,warmth};
})();
