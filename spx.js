/* SPHEREx Blink data pipeline.
   Finds every SPHEREx spectral image covering a sky position (IRSA TAP),
   downloads small cutouts, removes the zodiacal background, aligns the frames
   on the sky and stacks them per detector and per survey pass (epoch).
   Runs entirely in the browser. cfg.base points at the IRSA proxy. */
window.SPX=(()=>{
const D2R=Math.PI/180,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cfg={base:"irsa",conc:6};
const BAD=64|512|1024|2048;          // unusable, lost, hot, cold pixels: never used
const SAT=1|2|4|32768;               // transient/overflow/ramp error/nonlinear: bright-star cores
const FLAGN={0:"TRANSIENT",1:"OVERFLOW",2:"SUR_ERROR",6:"NONFUNC",7:"DICHROIC",9:"MISSING_DATA",10:"HOT",11:"COLD",14:"PHANMISS",15:"NONLINEAR",17:"PERSIST",19:"OUTLIER",20:"CROSSTALK",22:"GHOST",23:"GHOST_FPA",24:"GHOST_EXT",25:"STREAK",26:"BLOOM",27:"SNOWBALL",28:"HALO"};
const waveTab={};
async function tap(ra,dec){
 const q=`SELECT a.uri, p.time_bounds_lower, p.energy_bandpassname FROM spherex.artifact a JOIN spherex.plane p ON a.planeid = p.planeid WHERE 1 = CONTAINS(POINT('ICRS', ${ra}, ${dec}), p.poly) ORDER BY p.time_bounds_lower`;
 let txt=null;
 for(let a=0;a<4&&txt===null;a++){try{const r=await fetch(cfg.base+"/TAP/sync?FORMAT=CSV&QUERY="+encodeURIComponent(q));if(r.ok)txt=await r.text();else await sleep(2000)}catch(e){await sleep(2000)}}
 if(txt===null)throw new Error("Архив IRSA не ответил на запрос списка снимков");
 const m=new Map();
 for(const l of txt.trim().split("\n").slice(1)){const p=l.split(",");if(p.length<3)continue;const det=+p[2].slice(-1);if(!det)continue;
  const k=(p[0].match(/level2_(.+?)_spx/)||[,p[0]])[1],rel=p[0].split("/")[3];
  if(!m.has(k)||/^dr/.test(rel))m.set(k,{u:p[0],t:+p[1],det,rel})}
 const rows=[...m.values()].sort((a,b)=>a.t-b.t);let e=-1,last=-1e9;
 /* A gap over 60 days starts a new survey pass. Near the ecliptic poles coverage is
    continuous, so a pass is also closed after 75 days. */
 let start=0;for(const r of rows){if(r.t-last>60||r.t-start>75){e++;start=r.t}r.ep=e;last=r.t}
 return rows}
/* At most `max` frames per detector and pass, evenly spread in time (deep fields have thousands). */
function thin(rows,max){const g={},out=[];for(const r of rows)(g[r.det+"-"+r.ep]=g[r.det+"-"+r.ep]||[]).push(r);
 for(const k in g){const a=g[k];if(a.length<=max)out.push(...a);else for(let i=0;i<max;i++)out.push(a[Math.round(i*(a.length-1)/(max-1))])}
 return out.sort((a,b)=>a.t-b.t)}
function parseFits(u8,maxHdu){const td=new TextDecoder("latin1");let off=0;const hd=[];
 while(off<u8.length&&hd.length<maxHdu){const h={};let end=false;
  while(!end){if(off+2880>u8.length)return{hd,need:off+2880*6};
   const blk=td.decode(u8.subarray(off,off+2880));off+=2880;
   for(let i=0;i<36;i++){const c=blk.substr(i*80,80),k=c.substr(0,8).trim();if(k==="END"){end=true;break}
    if(c[8]==="="){let v=c.substr(10).split(" /")[0].trim();if(v[0]==="'")v=v.replace(/'/g,"").trim();else if(v==="T"||v==="F")v=v==="T";else v=+v;h[k]=v}}}
  const na=h.NAXIS||0;let n=na?1:0;for(let i=1;i<=na;i++)n*=h["NAXIS"+i];
  const bytes=Math.abs(h.BITPIX)/8*(h.GCOUNT||1)*((h.PCOUNT||0)+n);
  if(off+bytes>u8.length)return{hd,need:off+bytes};
  hd.push({h,off,bytes});off+=Math.ceil(bytes/2880)*2880}
 return{hd,need:0}}
/* Streams a cutout and stops as soon as the needed layers have arrived
   (the PSF table is 97% of the file and is not needed). */
async function getFits(url,maxHdu){
 for(let a=0;a<7;a++){const ctl=new AbortController();
  try{const r=await fetch(url,{signal:ctl.signal});
   if(r.status===200&&r.body){const rd=r.body.getReader(),ch=[];let len=0,want=2880*30;
    for(;;){const{done,value}=await rd.read();if(value){ch.push(value);len+=value.length}
     if(done||len>=want){const u8=new Uint8Array(len);let o=0;for(const c of ch){u8.set(c,o);o+=c.length}
      const p=parseFits(u8,maxHdu);if(!p.need||done){ctl.abort();if(p.hd.length>=Math.min(maxHdu,5))return{u8,hd:p.hd};break}
      want=p.need}}}
  }catch(e){}
  try{ctl.abort()}catch(e){}
  await sleep(700*(a+1)+Math.random()*600)}
 return null}
/* Sky -> pixel for the TAN-SIP projection in the IMAGE header (0-based pixels). */
function mkWcs(h){const c1=h.CDELT1||1,c2=h.CDELT2||1,a=h.PC1_1*c1,b=h.PC1_2*c1,c=h.PC2_1*c2,d=h.PC2_2*c2,det=a*d-b*c,ap=[],bp=[];
 for(const k in h){let m=k.match(/^AP_(\d)_(\d)$/);if(m)ap.push([+m[1],+m[2],h[k]]);m=k.match(/^BP_(\d)_(\d)$/);if(m)bp.push([+m[1],+m[2],h[k]])}
 const a0=h.CRVAL1*D2R,d0=h.CRVAL2*D2R,s0=Math.sin(d0),c0=Math.cos(d0);
 return(ra,dec)=>{const al=ra*D2R-a0,dl=dec*D2R,sd=Math.sin(dl),cd=Math.cos(dl),ca=Math.cos(al),cc=s0*sd+c0*cd*ca;
  const xi=cd*Math.sin(al)/cc/D2R,eta=(c0*sd-s0*cd*ca)/cc/D2R,u=(d*xi-b*eta)/det,v=(-c*xi+a*eta)/det;let U=u,V=v;
  for(const[p,q,k]of ap)U+=k*u**p*v**q;for(const[p,q,k]of bp)V+=k*u**p*v**q;
  return[U+h.CRPIX1-1,V+h.CRPIX2-1]}}
function readWave(u8,hd){const w=hd.find(x=>x.h.EXTNAME==="WCS-WAVE");if(!w)return null;const dv=new DataView(u8.buffer,u8.byteOffset+w.off,w.bytes);
 const X=[],Y=[],V=[];for(let i=0;i<9;i++){X.push(dv.getInt32(i*4));Y.push(dv.getInt32(36+i*4))}for(let i=0;i<162;i++)V.push(dv.getFloat32(72+i*4));return{X,Y,V}}
/* Wavelength (um) seen by a given cutout pixel: the filter changes across the detector. */
function lamAt(fr,px,py){const t=waveTab[fr.det];if(!t)return NaN;
 const fi=(A,v)=>{let i=0;while(i<7&&v>A[i+1])i++;return[i,Math.max(0,Math.min(1,(v-A[i])/(A[i+1]-A[i])))]};
 const[i,fx]=fi(t.X,px+1-fr.wx[0]+fr.wx[1]),[j,fy]=fi(t.Y,py+1-fr.wy[0]+fr.wy[1]),g=(ii,jj)=>t.V[(jj*9+ii)*2];
 return g(i,j)*(1-fx)*(1-fy)+g(i+1,j)*fx*(1-fy)+g(i,j+1)*(1-fx)*fy+g(i+1,j+1)*fx*fy}
function median(a){const s=Float32Array.from(a).sort(),n=s.length;return n?(n&1?s[n>>1]:(s[n/2-1]+s[n/2])/2):NaN}
async function frame(row,ra,dec,sizeDeg){
 const full=!waveTab[row.det];
 const f=await getFits(cfg.base+"/"+row.u+`?center=${ra},${dec}d&size=${sizeDeg}`,full?7:5);if(!f)return null;
 if(full){const t=readWave(f.u8,f.hd);if(t)waveTab[row.det]=t}
 const by={};for(const x of f.hd)if(x.h.EXTNAME)by[x.h.EXTNAME]=x;const I=by.IMAGE,F=by.FLAGS,Z=by.ZODI;if(!I||!F)return null;
 const h=I.h,nx=h.NAXIS1,ny=h.NAXIS2,n=nx*ny,img=new Float32Array(n),bad=new Uint8Array(n),sat=new Uint8Array(n),fl={},dv=new DataView(f.u8.buffer,f.u8.byteOffset),good=[];
 for(let i=0;i<n;i++){let v=dv.getFloat32(I.off+i*4)-(Z?dv.getFloat32(Z.off+i*4):0);const g=dv.getInt32(F.off+i*4);
  if(!isFinite(v)||(g&BAD)){bad[i]=1;v=0}else good.push(v);if(g&SAT)sat[i]=1;img[i]=v;
  if(g)for(const b in FLAGN)if(g&(1<<b))fl[FLAGN[b]]=(fl[FLAGN[b]]||0)+1}
 const med=median(good);for(let i=0;i<n;i++)if(!bad[i])img[i]-=med;
 return{det:row.det,ep:row.ep,t:h["MJD-AVG"]||row.t,rel:row.rel,nx,ny,img,bad,sat,fl,sky2pix:mkWcs(h),wx:[h.CRPIX1W,h.CRVAL1W],wy:[h.CRPIX2W,h.CRVAL2W]}}
async function pool(items,fn,conc){let i=0;const out=new Array(items.length);
 await Promise.all(Array.from({length:conc},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k])}}));return out}
async function loadFrames(rows,ra,dec,fov,onp){const size=+(Math.max(fov*1.5,1.2)/60).toFixed(4);
 const first=[],rest=[],seen={};for(const r of rows){if(!waveTab[r.det]&&!seen[r.det]){seen[r.det]=1;first.push(r)}else rest.push(r)}
 let d=0;const tot=rows.length,one=async r=>{const f=await frame(r,ra,dec,size);d++;onp&&onp(d,tot);return f};
 const fr=(await pool(first,one,2)).concat(await pool(rest,one,cfg.conc)).filter(Boolean),cd=Math.cos(dec*D2R),H=60;
 for(const f of fr){const c=f.sky2pix(ra,dec),e=f.sky2pix(ra+H/3600/cd,dec),w=f.sky2pix(ra-H/3600/cd,dec),n=f.sky2pix(ra,dec+H/3600),s=f.sky2pix(ra,dec-H/3600);
  f.aff=[c[0],c[1],(e[0]-w[0])/(2*H),(e[1]-w[1])/(2*H),(n[0]-s[0])/(2*H),(n[1]-s[1])/(2*H)];f.lam=lamAt(f,c[0],c[1])}
 return fr.sort((x,y)=>x.t-y.t)}
/* Median stack on a north-up grid centred on the requested position. */
function stack(frames,fov,scale){const N=Math.round(fov*60/scale),out=new Float32Array(N*N),tmp=new Float32Array(frames.length);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const E=(N/2-(i+.5))*scale,No=(N/2-(j+.5))*scale;let m=0;
  for(const f of frames){const a=f.aff,x=a[0]+a[2]*E+a[4]*No,y=a[1]+a[3]*E+a[5]*No,x0=Math.floor(x),y0=Math.floor(y);
   if(x0<0||y0<0||x0>=f.nx-1||y0>=f.ny-1)continue;const p=y0*f.nx+x0;if(f.bad[p]||f.bad[p+1]||f.bad[p+f.nx]||f.bad[p+f.nx+1])continue;
   const fx=x-x0,fy=y-y0;tmp[m++]=f.img[p]*(1-fx)*(1-fy)+f.img[p+1]*fx*(1-fy)+f.img[p+f.nx]*(1-fx)*fy+f.img[p+f.nx+1]*fx*fy}
  if(m){const s=tmp.subarray(0,m).slice().sort();out[j*N+i]=m&1?s[m>>1]:(s[m/2-1]+s[m/2])/2}}
 const md=median(out);return{N,data:out,noise:1.4826*median(Array.from(out,v=>Math.abs(v-md)))||1e-3}}
/* Aperture photometry on one frame at an offset (arcsec east, north) from the field centre. Returns mJy. */
function phot(f,E,No){const a=f.aff,x=a[0]+a[2]*E+a[4]*No,y=a[1]+a[3]*E+a[5]*No,xi=Math.round(x),yi=Math.round(y);
 if(xi<7||yi<7||xi>=f.nx-7||yi>=f.ny-7)return null;let s=0,c=0,st=0;const ann=[];
 for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){const p=(yi+dy)*f.nx+xi+dx,r=Math.hypot(xi+dx-x,yi+dy-y);
  if(r<=2.2){if(f.bad[p])return null;s+=f.img[p];c++;st|=f.sat[p]}else if(r>=4&&r<=7&&!f.bad[p])ann.push(f.img[p])}
 if(ann.length<20)return null;const bg=median(ann),mad=median(ann.map(v=>Math.abs(v-bg)))*1.4826;
 return[f.ep,f.det,+lamAt(f,x,y).toFixed(4),+((s-bg*c)*0.889).toFixed(3),+(mad*Math.sqrt(c)*0.889).toFixed(3),st,+f.t.toFixed(2)]}
/* Brightest source within rad arcsec of an offset, with a flux-weighted centre. */
function centroid(st,E0,N0,rad,scale){const N=st.N,ci=N/2-E0/scale-.5,cj=N/2-N0/scale-.5,r=rad/scale;let b=-Infinity,bi=0,bj=0;
 for(let j=Math.max(3,Math.floor(cj-r));j<=Math.min(N-4,Math.ceil(cj+r));j++)for(let i=Math.max(3,Math.floor(ci-r));i<=Math.min(N-4,Math.ceil(ci+r));i++)
  if((i-ci)**2+(j-cj)**2<=r*r&&st.data[j*N+i]>b){b=st.data[j*N+i];bi=i;bj=j}
 if(!isFinite(b))return null;let sx=0,sy=0,sw=0;
 for(let j=bj-3;j<=bj+3;j++)for(let i=bi-3;i<=bi+3;i++){const v=Math.max(0,st.data[j*N+i]);sx+=v*i;sy+=v*j;sw+=v}
 if(!sw)return null;return{E:(N/2-(sx/sw+.5))*scale,No:(N/2-(sy/sw+.5))*scale,peak:b,snr:b/st.noise}}
const yearOf=m=>2000+(m-51544.5)/365.25;
/* opt.det + opt.pm: follow a faint target on one detector, starting from its catalogue motion
   (arcsec/yr east, north; position is the field centre at 2026.0). */
function build(frames,ra,dec,fov,opt){const scale=3.075,ids=[...new Set(frames.map(f=>f.ep))].sort((a,b)=>a-b),stacks={};
 const epochs=ids.map(e=>{const g=frames.filter(f=>f.ep===e);return{id:e,mjd:g.reduce((s,f)=>s+f.t,0)/g.length,n:g.length}});
 for(let d=1;d<=6;d++)ids.forEach((e,k)=>{const g=frames.filter(f=>f.det===d&&f.ep===e);if(g.length<2)return;
  const st=stack(g,fov,scale),fl={};for(const f of g)for(const n in f.fl)fl[n]=(fl[n]||0)+f.fl[n];
  const lm=g.map(f=>f.lam).filter(isFinite);Object.assign(st,{n:g.length,lam:[Math.min(...lm),Math.max(...lm)],fl,rel:[...new Set(g.map(f=>f.rel))].join(", ")});stacks[d+"-"+k]=st});
 const track=ids.map((e,k)=>{let best={E:0,No:0,snr:0,det:0};
  if(opt&&opt.pm){const dt=yearOf(epochs[k].mjd)-2026,g=[opt.pm[0]*dt,opt.pm[1]*dt],st=stacks[opt.det+"-"+k],c=st&&centroid(st,g[0],g[1],6,scale);
   return c&&c.snr>=5?{E:c.E,No:c.No,snr:c.snr,det:opt.det}:{E:g[0],No:g[1],snr:0,det:opt.det}}
  for(let d=1;d<=6;d++){const st=stacks[d+"-"+k];if(!st)continue;const c=centroid(st,0,0,20,scale);if(c&&c.snr>10&&c.snr>best.snr)best={E:c.E,No:c.No,snr:c.snr,det:d}}return best});
 const spec=[];for(const f of frames){const k=ids.indexOf(f.ep),p=phot(f,track[k].E,track[k].No);if(p){p[0]=k;spec.push(p)}}
 return{ra,dec,fov,scale,N:Math.round(fov*60/scale),epochs,stacks,track,spec,frames,ids,nFrames:frames.length,tLast:Math.max(...frames.map(f=>f.t))}}
async function process(ra,dec,fov,onp,dets,opt){let rows=await tap(ra,dec);if(dets)rows=rows.filter(r=>dets.includes(r.det));rows=thin(rows,16);
 if(!rows.length)throw new Error("В архиве пока нет снимков SPHEREx для этой точки");
 const fr=await loadFrames(rows,ra,dec,fov,onp);if(fr.length<2)throw new Error("Архив IRSA перегружен: кадры не загрузились. Попробуйте ещё раз через минуту");
 return build(fr,ra,dec,fov,opt)}
/* Compact form for data/*.json: stacks as 16-bit asinh-coded arrays in base64. */
const QS=0.01,QK=2000;
function b64(u8){let s="";for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return btoa(s)}
function pack(r,extra){const stacks={};for(const k in r.stacks){const s=r.stacks[k],q=new Int16Array(s.data.length);
  for(let i=0;i<q.length;i++)q[i]=Math.max(-32767,Math.min(32767,Math.round(Math.asinh(s.data[i]/QS)*QK)));
  stacks[k]={q:b64(new Uint8Array(q.buffer)),n:s.n,lam:s.lam.map(v=>+v.toFixed(3)),fl:s.fl,rel:s.rel,noise:+s.noise.toFixed(5)}}
 return Object.assign({v:1,ra:r.ra,dec:r.dec,fov:r.fov,scale:r.scale,N:r.N,epochs:r.epochs.map(e=>({mjd:+e.mjd.toFixed(2),n:e.n})),stacks,
  track:r.track.map(t=>({E:+t.E.toFixed(2),No:+t.No.toFixed(2),snr:+t.snr.toFixed(1),det:t.det})),spec:r.spec,nFrames:r.nFrames,tLast:+r.tLast.toFixed(2),built:new Date().toISOString().slice(0,10)},extra||{})}
function unpack(j){const stacks={};for(const k in j.stacks){const s=j.stacks[k],bin=atob(s.q),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  const q=new Int16Array(u8.buffer),data=new Float32Array(q.length);for(let i=0;i<q.length;i++)data[i]=Math.sinh(q[i]/QK)*QS;
  /* Saturated cores of very bright stars have no valid pixels; fill the hole from its rim for display. */
  const N=j.N,holes=[];for(let pass=0;pass<12;pass++){const fill=[];for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){const p=y*N+x;if(q[p]!==0)continue;let mx=0,c=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const v=data[p+dy*N+dx];if(v>40*s.noise){c++;if(v>mx)mx=v}}if(c>=2)fill.push([p,mx])}
   if(!fill.length)break;for(const[p,v]of fill){data[p]=v;q[p]=1;holes.push(p)}}
  stacks[k]={N:j.N,data,noise:s.noise,n:s.n,lam:s.lam,fl:s.fl,rel:s.rel,holes}}
 return Object.assign({},j,{stacks,frames:null})}
return{cfg,tap,thin,loadFrames,stack,phot,centroid,build,process,pack,unpack,median,waveTab,FLAGN}})();
