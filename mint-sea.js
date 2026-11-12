/* A small aquarium on the continuous railway. Everything is mesh geometry. */
const MintSea = (() => {
  const W = RailwayWorld, S = W.sea, TAU = Math.PI*2;
  const rgb = (hex,k=1) => [16,8,0].map(shift=>((hex>>shift)&255)/255*k);
  const palettes = [0xffe6a3,0xf3bac7,0xb8dfca,0xaacfe3,0xc9b7e1];
  const routeStart = W.stops[3].distance;
  const routeEnd = W.distanceAt(W.stops[3].minute+W.stops[3].duration);
  function influence([x,,z]) {
    const r = Math.hypot((x-S.x)/220,(z-S.z)/170);
    return 1-W.smooth(W.clamp((r-.75)/.5,0,1));
  }
  function ellipsoid(mesh,center,size,shade,glow=0,rows=10,sides=18) {
    const sample = (r,c) => {
      const phi=Math.PI*r/rows,angle=TAU*c/sides;
      const p=[Math.cos(phi),Math.sin(phi)*Math.cos(angle),Math.sin(phi)*Math.sin(angle)];
      const n=W.unit(p.map((v,i)=>v/size[i]));
      return [...p.map((v,i)=>center[i]+v*size[i]),...n,...shade,glow];
    };
    const grid=Array.from({length:rows+1},(_,r)=>Array.from({length:sides+1},(_,c)=>sample(r,c)));
    for(let r=0;r<rows;r++)for(let c=0;c<sides;c++)for(const [dr,dc] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]])mesh.data.push(...grid[r+dr][c+dc]);
  }
  function trackPoint(d,side=0,lift=0) {
    const p=W.position(d),h=W.heading(d);
    return [p[0]-h[2]*side,p[1]+lift,p[2]+h[0]*side];
  }
  function fishModel(hex) {
    const body=new W.Mesh(),tail=new W.Mesh();
    ellipsoid(body,[0,0,0],[.88,.44,.23],rgb(hex),.10);
    ellipsoid(body,[.29,-.18,.012],[.43,.18,.20],rgb(0xfff4de),.04,6,12);
    for(const side of [-1,1]) {
      ellipsoid(body,[.48,.12,side*.202],[.085,.085,.035],rgb(0xfff9e9),.12,5,10);
      ellipsoid(body,[.50,.12,side*.232],[.037,.046,.014],rgb(0x42575b),0,5,10);
      ellipsoid(body,[.514,.139,side*.245],[.011,.012,.004],rgb(0xffffff),.3,4,6);
      body.triangle([.06,-.01,side*.19],[-.24,-.22,side*.49],[-.34,.02,side*.14],rgb(hex,.87),.08);
    }
    body.triangle([.25,.31,0],[-.43,.70,0],[-.64,.19,0],rgb(hex,.88),.06);
    body.triangle([-.15,-.32,0],[-.49,-.57,0],[-.62,-.21,0],rgb(hex,.94),.06);
    const outline=[[0,0],[-.65,.40],[-.49,0],[-.65,-.40]];
    for(const side of [-1,1]) {
      const points=outline.map(([x,y])=>[x,y,side*.035]);
      tail.quad(...points,rgb(hex,side<0 ? .93 : 1.02),.12);
    }
    for(let i=0;i<outline.length;i++) {
      const a=outline[i],b=outline[(i+1)%outline.length];
      tail.quad([a[0],a[1],-.035],[b[0],b[1],-.035],[b[0],b[1],.035],[a[0],a[1],.035],rgb(hex),.10);
    }
    for(const sign of [-1,1])tail.branch([-.07,0,0],[-.60,sign*.34,0],.007,.003,rgb(0xfff0db));
    return {body:body.data,tail:tail.data};
  }
  function create() {
    let seed=41327;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const between=(a,b)=>W.mix(a,b,random());
    const reef=new W.Mesh(),frames=new W.Mesh(),glass=new W.Mesh(),water=new W.Mesh(),light=new W.Mesh();
    const railSamples=[];
    for(let d=routeStart-20;d<routeEnd+8;d+=3)railSamples.push(W.position(d));
    const clearTrack=(x,z,r)=>!railSamples.some(p=>(p[0]-x)**2+(p[2]-z)**2<r*r);
    // Branching corals, shells and pearly rocks have distinct three-dimensional silhouettes.
    for(let i=0;i<178;i++) {
      const a=random()*TAU,r=Math.sqrt(random());
      const nearPath=i>=112 ? trackPoint(routeStart+(routeEnd-routeStart)*(i-112)/66,(i%2 ? 1 : -1)*between(9,21)) : null;
      const x=nearPath ? nearPath[0] : S.x+Math.cos(a)*r*157,z=nearPath ? nearPath[2] : S.z+Math.sin(a)*r*103;
      if(!clearTrack(x,z,7))continue;
      const y=W.groundHeight(x,z)+.14,kind=i%4,height=between(1.5,5.0),shade=rgb(palettes[i%palettes.length],.92);
      ellipsoid(reef,[x,y-.1,z],[between(1.1,2.4),.47,between(.8,1.7)],rgb(0xe6e2cf),.08,5,9);
      if(kind===0) {
        const root=[x,y,z],top=[x+between(-.4,.4),y+height,z];
        reef.branch(root,top,.26,.11,shade);
        for(let j=0;j<6;j++) {
          const t=.27+j*.11,angle=j*2.4+i;
          const start=W.add(root,W.mul(W.sub(top,root),t));
          const end=W.add(start,[Math.cos(angle)*height*.42,height*.30,Math.sin(angle)*height*.42]);
          const fork=W.add(end,[Math.cos(angle+.65)*height*.18,height*.22,Math.sin(angle+.65)*height*.18]);
          reef.branch(start,end,.16,.09,shade);reef.branch(end,fork,.09,.05,shade);
          ellipsoid(reef,fork,[.14,.19,.14],rgb(palettes[i%5],1.02),.13,4,7);
        }
      } else if(kind===1) {
        ellipsoid(reef,[x,y+.55,z],[1.22,.78,1.05],shade,.12,6,10);
        for(let j=0;j<8;j++) {
          const a=j*2.4,r=.55+(j%2)*.25;
          ellipsoid(reef,[x+Math.cos(a)*r,y+.8+(j%3)*.36,z+Math.sin(a)*r],
            [.56,.58,.53],rgb(palettes[i%5],.97+(j%2)*.07),.10,5,9);
        }
      } else if(kind===2) {
        for(let j=0;j<8;j++) {
          const a0=-1.3+j*.325,a1=a0+.325;
          const p=a=>[x+Math.sin(a)*height*.65,y+Math.cos(a)*height,z+Math.sin(a*2)*.30];
          reef.triangle([x,y,z],p(a0),p(a1),shade,.10);
          reef.branch([x,y,z],p(a0),.025,.012,rgb(0xf6e2d3));
        }
      } else {
        for(let j=0;j<5;j++) {
          const dx=Math.cos(j*2.4)*.6,dz=Math.sin(j*2.4)*.6;
          const mid=[x+dx*.9,y+height*(.6+.1*j)*.55,z+dz*.8];
          const tip=[x+dx*.8+.19*Math.sin(j),y+height*(.6+.1*j),z+dz*.8+.12*Math.cos(j)];
          reef.branch([x+dx,y,z+dz],mid,.27,.23,shade);
          reef.branch(mid,tip,.23,.18,shade);
          ellipsoid(reef,tip,[.18,.20,.18],shade,.10,4,8);
        }
      }
    }
    // Champagne ribs enclose the track; thin transparent panels preserve both camera views.
    const arch=(d,a)=>trackPoint(d,3.25*Math.cos(a),.15+4.65*Math.sin(a));
    for(let d=routeStart-17;d<routeEnd-14;d+=12) {
      for(let j=0;j<14;j++)frames.branch(arch(d,j*Math.PI/14),arch(d,(j+1)*Math.PI/14),.022,.022,rgb(0xe9d9b9),.16);
      for(const side of [-1,1]) {
        const p=trackPoint(d,side*3.18,.43);
        ellipsoid(frames,p,[.16,.17,.16],rgb(0xffecc1),.72,4,8);
      }
    }
    for(let d=routeStart-17;d<routeEnd-14;d+=6) {
      const end=Math.min(d+6,routeEnd-14);
      for(let j=0;j<12;j++)glass.quad(arch(d,j*Math.PI/12),arch(end,j*Math.PI/12),
        arch(end,(j+1)*Math.PI/12),arch(d,(j+1)*Math.PI/12),rgb(0xcbe8e3),-2.042);
      for(const side of [-1,1])frames.branch(trackPoint(d,side*3.25,.15),trackPoint(end,side*3.25,.15),.045,.045,rgb(0xc6b791),.13);
      frames.branch(arch(d,Math.PI/2),arch(end,Math.PI/2),.025,.025,rgb(0xdacdaa),.10);
    }
    // A clear water surface lets the overhead camera watch the same train below it.
    for(let i=0;i<96;i++) {
      const a=TAU*i/96,b=TAU*(i+1)/96;
      water.triangle([S.x,S.surface,S.z],[S.x+188*Math.cos(a),S.surface,S.z+138*Math.sin(a)],
        [S.x+188*Math.cos(b),S.surface,S.z+138*Math.sin(b)],rgb(0x9fd9ce),-2.14);
    }
    // Subtle shafts above the reef; feathered edges rather than opaque cones.
    for(const [dx,dz] of [[85,-53],[17,-32],[-64,53],[-115,8]]) {
      const normal=[0,1,0];
      for(let j=0;j<4;j++) {
        const left=-2.5+j*1.25,right=left+1.25;
        const vertices=[[S.x+dx+left,S.floor+.6,S.z+dz],[S.x+dx+right,S.floor+.6,S.z+dz],
          [S.x+dx+right*.4+2,S.surface,S.z+dz-3],[S.x+dx+left*.4+2,S.surface,S.z+dz-3]];
        const alpha=[0,.012,.012,0][j];
        for(const k of [0,1,2,0,2,3])light.data.push(...vertices[k],...normal,...rgb(0xe4f5de),-2-alpha);
      }
    }
    const jelly=new W.Mesh();
    for(let row=0;row<8;row++)for(let i=0;i<24;i++) {
      const point=(r,c)=>{const a=TAU*c/24,t=r/8;return [Math.cos(a)*Math.sin(t*Math.PI/2)*1.15,Math.cos(t*Math.PI/2)*.85,Math.sin(a)*Math.sin(t*Math.PI/2)*1.15];};
      jelly.quad(point(row,i),point(row+1,i),point(row+1,i+1),point(row,i+1),rgb(0xd7c3e5),-2.19);
    }
    for(let i=0;i<8;i++)for(let j=0;j<9;j++) {
      const a=i*TAU/8,p=t=>[Math.cos(a)*(.72+.12*Math.sin(t*5+i)), -t*1.8,Math.sin(a)*(.72+.12*Math.sin(t*5+i))];
      jelly.branch(p(j/9),p((j+1)/9),.020,.015,rgb(i%2 ? 0xd8bede : 0xf2dedf));
    }
    const bubble=new W.Mesh();ellipsoid(bubble,[0,0,0],[1,1,1],rgb(0xe1f6ee),-2.18,5,8);
    return {reef:reef.data,frames:frames.data,glass:glass.data,water:water.data,light:light.data,
      fish:palettes.map(fishModel),jelly:jelly.data,bubble:bubble.data};
  }
  const schools=Array.from({length:9},(_,i)=>{
    const d=routeStart+(routeEnd-routeStart)*i/9;
    return {center:trackPoint(d,14+(i%3)*2,1.7),forward:W.heading(d),kind:[0,1,2,4,3,1,0,4,2][i]};
  });
  function fish(seconds) {
    const result=[];
    for(const [index,{center,forward,kind}] of schools.entries())for(let i=0;i<10;i++) {
      const member=i%5,layer=Math.floor(i/5);
      const a=seconds*.072+index*.93+member*.31+layer*.65;
      const side=[-forward[2],0,forward[0]];
      const h=W.unit(W.add(W.mul(forward,-Math.sin(a)*7),W.mul(side,Math.cos(a)*4.5)));
      const position=W.add(center,W.add(W.mul(forward,Math.cos(a)*7+(member-2)*2.2-layer*7),W.mul(side,Math.sin(a)*4.5+layer*4)));
      position[1]+=Math.sin(seconds*.32+member*1.8+layer)*.70+layer*.65;
      const size=.67+(member%3)*.13;
      result.push({kind:layer ? (kind+2)%palettes.length : kind,position,heading:h,size,tail:Math.sin(seconds*3.5+i*1.2+index)*.29});
    }
    return result;
  }
  const rayRows=24,rayColumns=36,tailRows=32,tailSides=12;
  let rayModel=null;
  function makeRayModel() {
    const details=new W.Mesh();
    // Rounded head, raised eyes and spiracles sit on a continuous, thick disc.
    ellipsoid(details,[.55,.12,0],[1.24,.31,.64],rgb(0xf0e9dc),.10,12,24);
    ellipsoid(details,[1.48,.035,0],[.44,.16,.33],rgb(0xf4ecdf),.12,10,20);
    ellipsoid(details,[0,-.075,0],[1.43,.18,.88],rgb(0xfff4e7),.18,12,24);
    for(const side of [-1,1]) {
      ellipsoid(details,[1.02,.39,side*.37],[.19,.13,.15],rgb(0xede5d7),.10,8,16);
      ellipsoid(details,[1.09,.435,side*.455],[.072,.069,.043],rgb(0x465c60),.04,8,16);
      ellipsoid(details,[1.115,.458,side*.48],[.021,.022,.011],rgb(0xfffaf0),.30,6,10);
      ellipsoid(details,[.49,.415,side*.43],[.22,.047,.115],rgb(0xe8d7cb),.08,8,16);
      ellipsoid(details,[.48,.455,side*.43],[.145,.013,.064],rgb(0x9a8c82),.03,6,14);
      ellipsoid(details,[-1.25,-.06,side*.62],[.49,.06,.29],rgb(0xf0dcd8),.12,7,16);
      // Ventral nostrils and five pairs of shallow, curved gill slits.
      ellipsoid(details,[1.27,-.172,side*.23],[.080,.013,.042],rgb(0xa99a8b),.03,5,10);
      for(let slit=0;slit<5;slit++)for(let segment=0;segment<7;segment++) {
        const p=t=>[.54-slit*.23+.045*Math.sin(t*Math.PI),-.215+.014*Math.cos(t*Math.PI),side*(.31+t*.34)];
        details.branch(p(segment/7),p((segment+1)/7),.009,.009,rgb(0xae9c8c));
      }
    }
    for(let i=0;i<16;i++) {
      const p=t=>[1.16+.10*Math.sin(t*Math.PI),-.204+.012*Math.cos(t*TAU),-.27+t*.54];
      details.branch(p(i/16),p((i+1)/16),.012,.012,rgb(0x958578));
    }
    const stride=rayColumns+1,count=(rayRows+1)*stride;
    const base=new Float32Array(count*7);
    const colors=new Float32Array(count*2*3);
    const cream=rgb(0xf2eadc),belly=rgb(0xfff4e8),rose=rgb(0xe7bdcb);
    for(let row=0;row<=rayRows;row++)for(let column=0;column<=rayColumns;column++) {
      const t=row/rayRows,u=column/rayColumns*2-1,s=Math.max(0,Math.sin(t*Math.PI)),edge=Math.abs(u);
      const i=row*stride+column,k=i*7;
      const leading=1.85-2.23*edge**1.15;
      const trailing=-1.60+1.18*edge**.80;
      base[k]=W.mix(leading,trailing,t);
      base[k+1]=u*(4.30-.06*(2*t-1)**2);
      base[k+2]=s**.75;
      base[k+3]=edge;
      base[k+4]=.035+.28*(1-u*u)**2*s**.7+.065*s*(1-edge);
      base[k+5]=-.025-.19*(1-u*u)**2*s**.7;
      base[k+6]=W.smooth(W.clamp((edge-.16)/.84,0,1));
      const edgeTint=W.smooth(W.clamp((edge-.76)/.24,0,1))*.65;
      for(let side=0;side<2;side++)for(let c=0;c<3;c++)colors[(side*count+i)*3+c]=W.mix(side ? belly[c] : cream[c],rose[c],edgeTint);
    }
    const vertices=rayRows*rayColumns*12+(rayRows+rayColumns)*12+tailRows*tailSides*6;
    return {base,colors,count,stride,details:new Float32Array(details.data),grid:new Float32Array(count*2*6),
      tail:new Float32Array((tailRows+1)*(tailSides+1)*6),data:new Float32Array(vertices*10+details.data.length)};
  }
  function ray(seconds) {
    rayModel ||= makeRayModel();
    const {base,colors,count,stride,grid,tail,details,data}=rayModel;
    const bank=.33*Math.sin(seconds*.21+.5),pitch=.07*Math.sin(seconds*.35);
    const cb=Math.cos(bank),sb=Math.sin(bank),cp=Math.cos(pitch),sp=Math.sin(pitch);
    let offset=0;
    const emit=(x,y,z,nx,ny,nz,r,g,b,glow)=>{
      const by=cb*y-sb*z,bz=sb*y+cb*z,bny=cb*ny-sb*nz,bnz=sb*ny+cb*nz;
      data[offset++]=cp*x-sp*by;data[offset++]=sp*x+cp*by;data[offset++]=bz;
      data[offset++]=cp*nx-sp*bny;data[offset++]=sp*nx+cp*bny;data[offset++]=bnz;
      data[offset++]=r;data[offset++]=g;data[offset++]=b;data[offset++]=glow;
    };
    // A slow travelling wave starts near the body and rolls out to each fin tip.
    for(let side=0;side<2;side++)for(let row=0;row<=rayRows;row++)for(let column=0;column<=rayColumns;column++) {
      const i=row*stride+column,k=i*7,g=(side*count+i)*6,t=row/rayRows;
      const bend=Math.sin(seconds*.86-base[k+3]*1.35+t*.35)*.90*base[k+6]*(.85+.15*base[k+2]);
      const curl=Math.sin(seconds*.86-base[k+3]*1.35+t*3.3)*.10*base[k+3]**2*t*t;
      grid[g]=base[k];grid[g+1]=base[k+(side ? 5 : 4)]+bend+curl;grid[g+2]=base[k+1];
    }
    // Recompute smooth normals from the deformed surface; there are no flat triangle seams.
    for(let side=0;side<2;side++)for(let row=0;row<=rayRows;row++)for(let column=0;column<=rayColumns;column++) {
      const origin=side*count,g=(origin+row*stride+column)*6;
      const a=(origin+Math.max(0,row-1)*stride+column)*6,b=(origin+Math.min(rayRows,row+1)*stride+column)*6;
      const c=(origin+row*stride+Math.max(0,column-1))*6,d=(origin+row*stride+Math.min(rayColumns,column+1))*6;
      const tx=grid[b]-grid[a],ty=grid[b+1]-grid[a+1],tz=grid[b+2]-grid[a+2];
      const ux=grid[d]-grid[c],uy=grid[d+1]-grid[c+1],uz=grid[d+2]-grid[c+2];
      const nx=ty*uz-tz*uy,ny=tz*ux-tx*uz,nz=tx*uy-ty*ux;
      const length=Math.hypot(nx,ny,nz)||1,sign=side ? -1 : 1;
      grid[g+3]=nx/length*sign;grid[g+4]=ny/length*sign;grid[g+5]=nz/length*sign;
    }
    const vertex=(side,i)=>{
      const g=(side*count+i)*6,c=(side*count+i)*3;
      emit(grid[g],grid[g+1],grid[g+2],grid[g+3],grid[g+4],grid[g+5],colors[c],colors[c+1],colors[c+2],side ? .18 : .10);
    };
    for(let side=0;side<2;side++)for(let row=0;row<rayRows;row++)for(let column=0;column<rayColumns;column++) {
      const a=row*stride+column,b=a+stride;
      vertex(side,a);vertex(side,b);vertex(side,b+1);vertex(side,a);vertex(side,b+1);vertex(side,a+1);
    }
    const rim=(a,b)=>{vertex(0,a);vertex(0,b);vertex(1,b);vertex(0,a);vertex(1,b);vertex(1,a);};
    for(let row=0;row<rayRows;row++){rim(row*stride,(row+1)*stride);rim(row*stride+rayColumns,(row+1)*stride+rayColumns);}
    for(let c=0;c<rayColumns;c++){rim(c,c+1);rim(rayRows*stride+c,rayRows*stride+c+1);}
    // The tapered tail is a closed, smoothly shaded curved tube.
    for(let row=0;row<=tailRows;row++)for(let column=0;column<=tailSides;column++) {
      const t=row/tailRows,a=column/tailSides*TAU,r=.12*(1-t)**1.3+.006,k=(row*(tailSides+1)+column)*6;
      tail[k]=-1.35-t*6.85;
      tail[k+1]=-.025-.20*t+Math.sin(t*4-seconds*.65)*t*.12+Math.cos(a)*r;
      tail[k+2]=Math.sin(t*5-seconds*.70)*t**.9*.25+Math.sin(a)*r;
      tail[k+3]=-.045;tail[k+4]=Math.cos(a);tail[k+5]=Math.sin(a);
    }
    const tailColor=rgb(0xeadfd5);
    const tailVertex=i=>{const k=i*6;emit(tail[k],tail[k+1],tail[k+2],tail[k+3],tail[k+4],tail[k+5],...tailColor,.10);};
    for(let row=0;row<tailRows;row++)for(let c=0;c<tailSides;c++) {
      const a=row*(tailSides+1)+c,b=a+tailSides+1;
      tailVertex(a);tailVertex(b);tailVertex(b+1);tailVertex(a);tailVertex(b+1);tailVertex(a+1);
    }
    for(let i=0;i<details.length;i+=10)emit(details[i],details[i+1],details[i+2],details[i+3],details[i+4],details[i+5],details[i+6],details[i+7],details[i+8],details[i+9]);
    const a=seconds*.026;
    return {data,position:[S.x+32+Math.cos(a)*46,.25+Math.sin(a*2)*.35,S.z-45+Math.sin(a)*27],heading:W.unit([-46*Math.sin(a),0,27*Math.cos(a)])};
  }
  return {create,influence,fish,ray,routeStart,routeEnd};
})();
