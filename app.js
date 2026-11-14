"use strict";
const $=i=>document.getElementById(i);
const DETN=["","0,75–1,10","1,10–1,62","1,62–2,42","2,42–3,82","3,82–4,42","4,42–5,00"];
const P=[
 {k:"barnard",n:"Звезда Барнарда",ra:269.4463,dec:4.7682,pm:[-0.80,10.36],det:6,alt:[[269.452,4.693]],
  note:"<b>Звезда Барнарда</b> — самая быстрая звезда на небе: по каталогу 10,4″ в год. Поле центрировано на её положении в 2026 году."},
 {k:"epsind",n:"ε Индейца B",ra:331.096,dec:-56.801,pm:[3.96,-2.54],det:6,alt:[[331.044,-56.783],[330.84,-56.786]],
  note:"<b>ε Индейца Ba и Bb</b> — пара коричневых карликов в 12 световых годах. SPHEREx видит их как одну точку: между ними меньше секунды дуги."},
 {k:"wise0855",n:"WISE 0855",ra:133.7595,dec:-7.2423,pm:[-8.12,0.68],det:6,alt:[[133.79513,-7.24515],[133.7685,-7.2429]],follow:6,
  note:"<b>WISE 0855−0714</b> — самый холодный известный коричневый карлик. Он виден только на детекторе 6 (4,4–5 мкм), на пределе чувствительности. С 2010 года, когда его сняли WISE, он ушёл на 2′ к западу и сейчас проходит в 5″ от фоновой звезды: на коротких волнах в кружке светит она, а не карлик."},
 {k:"rwaur",n:"RW Возничего",ra:76.9564,dec:30.4014,pm:[0,0],det:3,alt:[],
  note:"<b>RW Возничего</b> — молодая переменная звезда. Она стоит на месте, но меняет яркость: смотрите график яркости и режим разности."},
 {k:"rdra",n:"R Дракона",ra:248.1675,dec:66.755,pm:[0,0],det:3,alt:[[245.178,66.755]],
  note:"<b>R Дракона</b> — пульсирующий красный гигант (мирида) с периодом около 246 дней. В инфракрасном свете она так ярка, что насыщает детекторы SPHEREx: видны крылья и блики, а ядро теряется. Зато это участок глубокого обзора у полюса эклиптики: здесь семь эпох вместо трёх."}
];
const S={R:null,pre:null,det:6,e:0,mode:"blink",play:true,fps:2,sel:null,trk:[],cache:{},st:{}};
const mjd2date=m=>new Date((m-40587)*864e5),fmtD=m=>mjd2date(m).toLocaleDateString("ru-RU",{year:"numeric",month:"short",day:"numeric"}),yr=m=>2000+(m-51544.5)/365.25;
const num=(v,d=1)=>v.toFixed(d).replace(".",",");
function parseC(s,isRA){s=String(s).trim();const q=(s.match(/\d+\.?\d*/g)||[]).map(Number);if(!q.length)return NaN;const neg=/^[\s]*[-−]/.test(s);
 if(q.length==1&&!/[hdms:°'" ]/i.test(s))return neg?-q[0]:q[0];
 let v=q[0]+(q[1]||0)/60+(q[2]||0)/3600;if(isRA&&!/[d°]/i.test(s))v*=15;return neg?-v:v}
const sepArcmin=(a,b,c,d)=>Math.hypot((a-c)*Math.cos(b*Math.PI/180),b-d)*60;

/* ---------- images ---------- */
function imgOf(R,det,k){if(det>0){const s=R.stacks[det+"-"+k];return s?s.data:null}
 const key="all-"+k;if(R._c&&R._c[key])return R._c[key];let n=0;const a=new Float32Array(R.N*R.N);
 for(let d=1;d<=6;d++){const s=R.stacks[d+"-"+k];if(s){n++;for(let i=0;i<a.length;i++)a[i]+=s.data[i]}}
 if(!n)return null;for(let i=0;i<a.length;i++)a[i]/=n;(R._c=R._c||{})[key]=a;return a}
function stretchOf(R,det){const key="st"+det;if(R._c&&R._c[key])return R._c[key];let hi=0;const ns=[];
 R.epochs.forEach((_,k)=>{const a=imgOf(R,det,k);if(!a)return;const s=Float32Array.from(a).sort();hi=Math.max(hi,s[Math.floor(s.length*.9985)]);
  const md=s[s.length>>1];ns.push(1.4826*SPX.median(Array.from(a,v=>Math.abs(v-md))))});
 const noise=Math.max(1e-4,ns.length?SPX.median(ns):.01);const st={s:noise*2.5,hi:Math.max(hi,noise*40),noise};(R._c=R._c||{})[key]=st;return st}
const off=document.createElement("canvas");
function paint(ctx,a,N,st,o){o=o||{};off.width=off.height=N;const oc=off.getContext("2d"),id=oc.createImageData(N,N),M=Math.asinh(st.hi/st.s),D=id.data;
 for(let i=0;i<a.length;i++){const p=4*i;
  if(o.diff){const d=a[i],v=Math.min(255,255*Math.asinh(Math.abs(d)/st.s)/M);if(d>0){D[p]=v;D[p+1]=v*.58;D[p+2]=v*.16}else{D[p]=v*.14;D[p+1]=v*.55;D[p+2]=v}}
  else{const v=Math.max(0,Math.min(255,255*Math.asinh(Math.max(0,a[i]+st.noise)/st.s)/M));D[p]=v*.93;D[p+1]=v*.96;D[p+2]=v}
  D[p+3]=255}
 oc.putImageData(id,0,0);const W=ctx.canvas.width,z=o.zoom||1,cx=o.cx==null?N/2:o.cx,cy=o.cy==null?N/2:o.cy,sw=N/z;
 ctx.imageSmoothingEnabled=!!o.smooth;ctx.imageSmoothingQuality="high";ctx.fillStyle="#000";ctx.fillRect(0,0,W,W);
 ctx.drawImage(off,cx-sw/2,cy-sw/2,sw,sw,0,0,W,W)}
function current(){const R=S.R,N=R.N;let a=imgOf(R,S.det,S.e);
 if(S.mode=="diff"){const b=imgOf(R,S.det,0);if(a&&b)a=a.map((v,i)=>v-b[i]);else a=null}
 else if(S.mode=="sum"){const s=new Float32Array(N*N);let n=0;R.epochs.forEach((_,k)=>{const q=imgOf(R,S.det,k);if(q){n++;for(let i=0;i<s.length;i++)s[i]+=q[i]}});
  if(n){for(let i=0;i<s.length;i++)s[i]/=n;a=s}else a=null}
 return a}

/* ---------- selection, track, photometry ---------- */
function stk(k){const R=S.R;if(S.det>0)return R.stacks[S.det+"-"+k]||null;const a=imgOf(R,0,k);return a?{N:R.N,data:a,noise:stretchOf(R,0).noise}:null}
function follow(E,No,guess){const R=S.R,n=R.epochs.length,out=new Array(n).fill(null);
 const at=(k,e0,n0,rad)=>{const s=stk(k);if(!s)return null;const c=SPX.centroid(s,e0,n0,rad,R.scale);return c&&c.snr>=5?c:null};
 if(guess)return guess.map((g,k)=>at(k,g[0],g[1],6));
 const order=[...Array(n).keys()].sort((a,b)=>Math.abs(a-S.e)-Math.abs(b-S.e));let k0=-1,c0=null;
 for(const k of order){c0=at(k,E,No,9);if(c0){k0=k;break}}if(!c0)return out;out[k0]=c0;
 for(let k=k0+1,p=c0;k<n;k++){const c=at(k,p.E,p.No,9);out[k]=c;if(c)p=c}
 for(let k=k0-1,p=c0;k>=0;k--){const c=at(k,p.E,p.No,9);out[k]=c;if(c)p=c}
 return out}
function posAt(k){const t=S.trk[k];return t?[t.E,t.No]:S.guess?S.guess[k]:S.sel}
function apFlux(s,E,No,scl){const N=s.N,sc=scl||S.R.scale,ci=N/2-E/sc-.5,cj=N/2-No/sc-.5,r1=9/sc,r2=15/sc,r3=24/sc;let sum=0,c=0;const ann=[];
 for(let j=Math.floor(cj-r3);j<=Math.ceil(cj+r3);j++)for(let i=Math.floor(ci-r3);i<=Math.ceil(ci+r3);i++){if(i<0||j<0||i>=N||j>=N)continue;const r=Math.hypot(i-ci,j-cj),v=s.data[j*N+i];
  if(r<=r1){sum+=v;c++}else if(r>=r2&&r<=r3)ann.push(v)}
 if(!c||ann.length<10)return null;return(sum-SPX.median(ann)*c)*0.889*(sc/6.15)**2}
function select(E,No,isDefault){const R=S.R;S.sel=[E,No];S.selDefault=!!isDefault;S.guess=isDefault?R.track.map(t=>[t.E,t.No]):null;S.trk=follow(E,No,S.guess);
 const t=S.trk[S.e];S.nearC=isDefault||!!(t&&R.track[S.e]&&Math.hypot(t.E-R.track[S.e].E,t.No-R.track[S.e].No)<4);
 motion();charts()}
function satAt(R,dets,k,E,No){const ci=R.N/2-E/R.scale-.5,cj=R.N/2-No/R.scale-.5;
 for(const d of dets){const s=R.stacks[d+"-"+k];if(s&&s.holes)for(const p of s.holes)if(Math.hypot(p%R.N-ci,Math.floor(p/R.N)-cj)<15/R.scale)return true}return false}
function satNear(k){const[E,No]=posAt(k);return satAt(S.R,S.det?[S.det]:[1,2,3,4,5,6],k,E,No)}
function motion(){const R=S.R;S.sat=R.epochs.some((_,k)=>satNear(k));
 if(S.sat){$("move").innerHTML="Эта звезда <b>слишком яркая для SPHEREx</b>: её ядро насыщено, поэтому положение и яркость здесь ненадёжны. Попробуйте другой детектор или звезду слабее.";return}
 const pts=S.trk.map((t,k)=>t?{k,E:t.E,No:t.No,y:yr(R.epochs[k].mjd)}:null).filter(Boolean),el=$("move");
 if(pts.length<2){el.innerHTML=pts.length?"Объект найден только в одной эпохе: движение измерить нельзя.":"В этой точке нет источника ярче шума. Нажмите на звезду на снимке.";return}
 const a=pts[0],b=pts[pts.length-1],dE=b.E-a.E,dN=b.No-a.No,d=Math.hypot(dE,dN),dt=b.y-a.y;
 if(d<1){el.innerHTML="Сдвиг <b>"+num(d)+"″</b> за "+num(dt,2)+" года: меньше точности измерения (около 1″). Объект <b>неподвижен</b>, значит далеко.";return}
 const dir=(Math.abs(dN)>Math.abs(dE)*.4?(dN>0?"север":"юг"):"")+(Math.abs(dE)>Math.abs(dN)*.4?(Math.abs(dN)>Math.abs(dE)*.4?"о-":"")+(dE>0?"восток":"запад"):"");
 let cmp="";const p=S.pre;if(p&&S.nearC&&Math.hypot(p.pm[0],p.pm[1])>.5)cmp=" По каталогу: <b>"+num(Math.hypot(p.pm[0],p.pm[1]))+"″/год</b> (в измеренное входит ещё параллакс).";
 el.innerHTML="Объект <b>движется</b>: "+num(d)+"″ за "+num(dt,2)+" года, то есть <b>"+num(d/dt)+"″/год</b> на "+dir+"."+cmp}

/* ---------- viewer ---------- */
const cv=$("cv"),ctx=cv.getContext("2d");
function xy(E,No){const R=S.R,z=cv.width/R.N;return[(R.N/2-E/R.scale)*z,(R.N/2-No/R.scale)*z]}
function frame(){const R=S.R;if(!R)return;const a=current(),st=stretchOf(R,S.det);
 if(a)paint(ctx,a,R.N,st,{diff:S.mode=="diff",smooth:$("smooth").checked});else{ctx.fillStyle="#000";ctx.fillRect(0,0,cv.width,cv.width)}
 ctx.lineWidth=1.5;ctx.font="12px ui-monospace,Menlo,monospace";
 if(!a){ctx.fillStyle="#8b94a9";ctx.fillText(S.mode=="diff"?"Для разности нужны две эпохи на этом детекторе":"На этом детекторе нет снимков за эту эпоху",20,cv.width/2)}
 if($("cat").checked&&S.pre&&Math.hypot(S.pre.pm[0],S.pre.pm[1])>.5){const p=S.pre;ctx.strokeStyle="#ffb454";ctx.fillStyle="#ffb454";ctx.setLineDash([4,4]);ctx.beginPath();
  R.epochs.forEach((e,k)=>{const dt=yr(e.mjd)-2026,[x,y]=xy(p.pm[0]*dt,p.pm[1]*dt);k?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.setLineDash([]);
  const dt=yr(R.epochs[S.e].mjd)-2026,[x,y]=xy(p.pm[0]*dt,p.pm[1]*dt);ctx.beginPath();ctx.arc(x,y,16,0,7);ctx.stroke();ctx.fillText("каталог",x+20,y-12)}
 if($("trk").checked&&S.sel){const pts=S.trk.map((t,k)=>t?xy(t.E,t.No).concat(k):null).filter(Boolean);
  if(pts.length>1){ctx.strokeStyle="#5eead4";ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke()}
  for(const p of pts){ctx.fillStyle=p[2]==S.e?"#fff":"#5eead4";ctx.fillRect(p[0]-3,p[1]-3,6,6)}
  const[E,No]=posAt(S.e),[x,y]=xy(E,No);ctx.strokeStyle="#fff";ctx.beginPath();ctx.arc(x,y,9/R.scale*cv.width/R.N,0,7);ctx.stroke()}
 const L=60/R.scale*cv.width/R.N;ctx.strokeStyle="#fff";ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(16,cv.width-18);ctx.lineTo(16+L,cv.width-18);ctx.stroke();ctx.fillText("1′",16,cv.width-26);
 ctx.fillText("С",cv.width-28,24);ctx.fillText("В",cv.width-62,52);ctx.beginPath();ctx.moveTo(cv.width-24,48);ctx.lineTo(cv.width-24,28);ctx.moveTo(cv.width-24,48);ctx.lineTo(cv.width-48,48);ctx.stroke();
 const e=R.epochs[S.e];$("date").textContent=S.mode=="sum"?"все эпохи":fmtD(e.mjd)+" · "+(S.e+1)+"/"+R.epochs.length;$("ep").value=S.e;
 $("hud").textContent=(S.det?"детектор "+S.det+" · "+DETN[S.det]+" мкм":"все детекторы · 0,75–5,0 мкм")+(S.mode=="diff"?" · эпоха "+(S.e+1)+" минус эпоха 1":S.mode=="sum"?" · сумма эпох":"");
 meta()}
function meta(){const R=S.R,e=R.epochs[S.e],s=S.det?R.stacks[S.det+"-"+S.e]:null,rows=[];
 rows.push(["Эпоха",fmtD(e.mjd)+" (проход "+(S.e+1)+" из "+R.epochs.length+")"]);
 if(s){rows.push(["Снимков в кадре",s.n+" (медиана)"]);rows.push(["Длины волн",num(s.lam[0],2)+"–"+num(s.lam[1],2)+" мкм"]);rows.push(["Релиз данных",s.rel]);
  const f=Object.entries(s.fl).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,c])=>n+" "+c).join(", ");rows.push(["Флаги пикселей",f||"нет"])}
 else if(S.det==0)rows.push(["Кадр","среднее по детекторам с данными"]);
 rows.push(["Поле",R.fov+"′ × "+R.fov+"′, пиксель SPHEREx 6,15″"]);
 rows.push(["Центр","RA "+R.ra.toFixed(4)+"°, Dec "+R.dec.toFixed(4)+"°"]);
 rows.push(["Всего снимков",R.nFrames+", проходов телескопа: "+R.epochs.length]);
 rows.push(["Данные по",fmtD(R.tLast)+(R.built?" · обновлено "+R.built:"")]);
 rows.push(["Источник",S.live?"живой запрос к IRSA":"сохранённая копия из IRSA"]);
 $("meta").innerHTML=rows.map(r=>"<dt>"+r[0]+"</dt><dd>"+r[1]+"</dd>").join("")}

/* ---------- charts ---------- */
function setup(c){const d=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;c.width=w*d;c.height=h*d;const x=c.getContext("2d");x.setTransform(d,0,0,d,0,0);return[x,w,h]}
function niceMax(v){const p=Math.pow(10,Math.floor(Math.log10(v))),m=v/p;return(m<=1?1:m<=2?2:m<=5?5:10)*p}
function fmtF(v){return v>=100?Math.round(v)+"":v>=10?num(v,1):num(v,2)}
function axes(x,w,h,ymax,unit){const L=46,B=24,T=10,Rr=10;x.clearRect(0,0,w,h);x.font="11px ui-monospace,Menlo,monospace";x.fillStyle="#8b94a9";x.strokeStyle="rgba(140,170,255,.12)";x.lineWidth=1;
 for(let i=0;i<=4;i++){const y=T+(h-T-B)*(1-i/4);x.beginPath();x.moveTo(L,y+.5);x.lineTo(w-Rr,y+.5);x.stroke();x.textAlign="right";x.fillText(fmtF(ymax*i/4),L-6,y+4)}
 x.textAlign="left";return{L,B,T,R:Rr,Y:v=>T+(h-T-B)*(1-Math.max(0,Math.min(1.02,v/ymax)))}}
let SPEC=[],LC=[];
function specPoints(){const R=S.R;
 if(S.nearC&&R.spec&&R.spec.length)return{pts:R.spec,kind:"full"};
 if(R.frames){const idx=new Map(R.ids.map((id,k)=>[id,k])),out=[];for(const f of R.frames){const k=idx.get(f.ep),[E,No]=posAt(k),p=SPX.phot(f,E,No);if(p){p[0]=k;out.push(p)}}return{pts:out,kind:"full"}}
 const out=[];for(let d=1;d<=6;d++)R.epochs.forEach((_,k)=>{const s=R.stacks[d+"-"+k];if(!s)return;const[E,No]=posAt(k),f=apFlux(s,E,No);if(f!=null)out.push([k,d,(s.lam[0]+s.lam[1])/2,f,0,0,R.epochs[k].mjd])});
 return{pts:out,kind:"coarse"}}
function charts(){const R=S.R;if(!R)return;
 /* spectrum */
 const sp=specPoints();SPEC=sp.pts;const[x,w,h]=setup($("sp"));
 const fs=SPEC.map(p=>p[3]).filter(v=>v>0).sort((a,b)=>a-b),ymax=niceMax(Math.max(fs.length?fs[Math.floor(fs.length*.97)]*1.2:1,.01)),ax=axes(x,w,h,ymax),X=l=>ax.L+(w-ax.L-ax.R)*((l-.7)/(5.1-.7));
 x.fillStyle="#5b6479";[1,2,3,4,5].forEach(l=>{x.textAlign="center";x.fillText(l+"",X(l),h-8)});x.textAlign="left";
 x.strokeStyle="rgba(140,170,255,.12)";[1.10,1.62,2.42,3.82,4.42].forEach(l=>{x.beginPath();x.moveTo(X(l)+.5,ax.T);x.lineTo(X(l)+.5,h-ax.B);x.stroke()});
 const one=S.mode=="sum";for(const pass of [0,1])for(const p of SPEC){const cur=one||p[0]==S.e;if(cur!=(pass==1))continue;p._x=X(p[2]);p._y=ax.Y(p[3]);x.beginPath();x.arc(p._x,p._y,cur?3.5:2.5,0,7);
  const col=cur?"#3987d6":"#48506a";if(p[5]){x.strokeStyle=col;x.lineWidth=1.5;x.stroke()}else{x.fillStyle=col;x.fill()}}
 $("sph").textContent=sp.kind=="full"?"Спектр выбранного объекта (точек: "+SPEC.length+")":"Спектр выбранного объекта: по 6 детекторам";
 $("sps").textContent=sp.kind=="full"?"Поток (мЯн) по длине волны (мкм). Каждая точка — один снимок: объект попал на свою длину волны.":"Поток (мЯн) по длине волны (мкм). Грубая оценка по сложенным кадрам; полный спектр есть для центрального объекта и при живом запросе.";
 $("spl").innerHTML=(one?"<span><i style='background:#3987d6'></i>все эпохи</span>":"<span><i style='background:#3987d6'></i>эпоха на экране: "+fmtD(R.epochs[S.e].mjd)+"</span><span><i style='background:#48506a'></i>остальные эпохи</span>")+(SPEC.some(p=>p[5])?"<span><i class='h'></i>возможно насыщение</span>":"");
 /* light curve */
 LC=R.epochs.map((e,k)=>{const s=stk(k);if(!s)return null;const[E,No]=posAt(k),f=apFlux(s,E,No);return f==null?null:{k,f,mjd:e.mjd}}).filter(Boolean);
 const[y,w2,h2]=setup($("lc")),m2=niceMax(Math.max(...LC.map(p=>p.f),.01)*1.15),a2=axes(y,w2,h2,m2),n=R.epochs.length,X2=k=>a2.L+(w2-a2.L-a2.R)*(n>1?(k+.5)/n:.5);
 y.fillStyle="#8b94a9";y.textAlign="center";R.epochs.forEach((e,k)=>y.fillText(mjd2date(e.mjd).toLocaleDateString("ru-RU",{month:"short",year:"2-digit"}),X2(k),h2-8));y.textAlign="left";
 y.strokeStyle="#3987d6";y.lineWidth=2;y.beginPath();LC.forEach((p,i)=>{p._x=X2(p.k);p._y=a2.Y(p.f);i?y.lineTo(p._x,p._y):y.moveTo(p._x,p._y)});y.stroke();
 for(const p of LC){y.beginPath();y.arc(p._x,p._y,p.k==S.e?6:4,0,7);y.fillStyle="#3987d6";y.fill();y.lineWidth=2;y.strokeStyle="#0b0e16";y.stroke()}
 $("lch").textContent="Яркость по эпохам"+(S.det?" · детектор "+S.det:" · все детекторы");
 let ch="";if(LC.length>1){const a=LC[0].f,b=Math.max(...LC.map(p=>p.f)),c=Math.min(...LC.map(p=>p.f));const weak=S.trk.some(t=>!t||t.snr<30);if(weak)ch=" Источник слабый: разброс между эпохами в основном шум.";else if(c>0)ch=b/c>1.15?" Меняется в "+num(b/c,2)+" раза.":" Изменение меньше 15%: в пределах разброса."}
 $("lcs").textContent="Поток в апертуре 9″, мЯн."+(S.sat?" Ядро насыщено: значения занижены и ненадёжны.":ch)}
function hover(c,tip,get,fmt){c.addEventListener("mousemove",ev=>{const r=c.getBoundingClientRect(),mx=ev.clientX-r.left,my=ev.clientY-r.top;let b=null,bd=18;
  for(const p of get()){const d=Math.hypot(p._x-mx,p._y-my);if(d<bd){bd=d;b=p}}
  if(!b){tip.style.display="none";return}tip.innerHTML=fmt(b);tip.style.display="block";tip.style.left=Math.min(b._x+10,r.width-170)+"px";tip.style.top=Math.max(0,b._y-34)+"px"});
 c.addEventListener("mouseleave",()=>tip.style.display="none")}
hover($("sp"),$("spt"),()=>SPEC,p=>num(p[2],3)+" мкм · "+fmtF(p[3])+" мЯн · D"+p[1]+" · "+fmtD(p[6])+(p[5]?" · насыщение?":""));
hover($("lc"),$("lct"),()=>LC,p=>fmtD(p.mjd)+" · "+fmtF(p.f)+" мЯн");
$("csv").onclick=()=>{const t="epoch_date,detector,wavelength_um,flux_mJy,err_mJy,saturation_flag\n"+SPEC.map(p=>[mjd2date(p[6]).toISOString().slice(0,10),p[1],p[2],p[3],p[4],p[5]].join(",")).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type:"text/csv"}));a.download="spherex_spectrum.csv";a.click()};

/* ---------- loading ---------- */
function busy(msg,sub,frac){$("load").classList.toggle("on",msg!=null);if(msg!=null){$("lmsg").textContent=msg;$("lsub").textContent=sub||"";$("lbar").style.width=(frac||0)*100+"%"}}
function findPreset(ra,dec){for(const p of P){if(sepArcmin(ra,dec,p.ra,p.dec)<2.5)return p;for(const a of p.alt)if(sepArcmin(ra,dec,a[0],a[1])<1.5)return p}return null}
const pcache={};
async function loadPreset(p){if(pcache[p.k])return pcache[p.k];const r=await fetch("data/"+p.k+".json");if(!r.ok)throw 0;return pcache[p.k]=SPX.unpack(await r.json())}
function show(R,pre,live){S.R=R;S.pre=pre;S.live=live;S.e=0;
 const have=d=>R.epochs.some((_,k)=>R.stacks[d+"-"+k]);if(S.det&&!have(S.det))S.det=[6,5,4,3,2,1].find(have)||0;$("det").value=S.det;
 $("ep").max=R.epochs.length-1;busy(null);
 $("note").innerHTML=pre?pre.note:"Произвольный участок неба: RA "+R.ra.toFixed(4)+"°, Dec "+R.dec.toFixed(4)+"°. Нажмите на любой объект, чтобы проверить, движется ли он.";
 document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on",pre&&c.dataset.k==pre.k));
 select(R.track[0].E,R.track[0].No,true);frame();url()}
async function go(ra,dec,forceLive){const pre=findPreset(ra,dec);
 if(pre&&!forceLive){busy("Загрузка сохранённых данных…");try{const R=await loadPreset(pre);if(!qs.get("det")||go.used||pre.follow)S.det=pre.det;go.used=1;show(R,pre,false);return}catch(e){}}
 const fov=+$("fov").value;busy("Ищу снимки SPHEREx в архиве IRSA…","Архив NASA отвечает не быстро: запрос списка занимает до минуты.",.02);
 try{const dets=S.det?[S.det]:null,R=await SPX.process(ra,dec,fov,(d,t)=>busy("Загружаю и совмещаю снимки: "+d+" из "+t,dets?"Запрошен только детектор "+S.det+", чтобы было быстрее. Выберите «Все детекторы» и повторите для полного спектра.":"Все шесть детекторов: это несколько минут.",d/t));
  show(R,pre,true)}
 catch(e){busy(e&&e.message&&/IRSA|архив|снимк/i.test(e.message)?e.message:"Живой запрос сейчас недоступен","Живые запросы идут через server.py (python3 server.py). Без него работают пять сохранённых целей вверху справа.",0)}}
function url(){const R=S.R,q=new URLSearchParams();q.set("ra",R.ra.toFixed(4));q.set("dec",R.dec.toFixed(4));q.set("det",S.det);if(S.mode!="blink")q.set("mode",S.mode);if(R.fov!=6)q.set("fov",R.fov);if(qs.get("embed"))q.set("embed",1);
 try{history.replaceState(null,"","?"+q+location.hash)}catch(e){}$("ra").value=R.ra.toFixed(4);$("dec").value=R.dec.toFixed(4)}

/* ---------- controls ---------- */
const qs=new URLSearchParams(location.search);
const ds=$("det");for(let d=1;d<=6;d++)ds.add(new Option("Детектор "+d+" · "+DETN[d]+" мкм",d));ds.add(new Option("Все детекторы · 0,75–5,0 мкм",0));ds.value=S.det;
P.forEach(p=>{const b=document.createElement("button");b.className="chip";b.type="button";b.textContent=p.n;b.dataset.k=p.k;b.onclick=()=>{go.used=1;go(p.ra,p.dec)};$("chips").appendChild(b)});
$("form").onsubmit=ev=>{ev.preventDefault();const ra=parseC($("ra").value,true),dec=parseC($("dec").value,false);
 if(isNaN(ra)||isNaN(dec)||Math.abs(dec)>90||ra<0||ra>=360){busy("Не удалось разобрать координаты","Примеры: 08h55m10.8s и -07d14m42.5s, либо градусы: 133.795 и -7.245.");setTimeout(()=>S.R&&busy(null),3500);return}
 go(ra,dec)};
ds.onchange=()=>{S.det=+ds.value;if(S.live&&S.R&&S.det&&!S.R.epochs.some((_,k)=>S.R.stacks[S.det+"-"+k])){go(S.R.ra,S.R.dec,true);return}
 if(S.R){const s=S.sel;select(s[0],s[1],S.selDefault);frame();url()}};
$("mode").onchange=e=>{S.mode=e.target.value;if(S.mode=="diff"&&S.e==0&&S.R.epochs.length>1)S.e=S.R.epochs.length-1;frame();charts();url()};
$("fov").oninput=e=>$("fovv").textContent=e.target.value+"′";$("fovv").textContent="6′";
$("fps").oninput=e=>{S.fps=+e.target.value;timer()};
["trk","cat","smooth"].forEach(i=>$(i).onchange=frame);
$("play").onclick=()=>{S.play=!S.play;timer()};
$("ep").oninput=e=>{S.play=false;S.e=+e.target.value;timer();frame();charts()};
cv.onclick=ev=>{const R=S.R;if(!R)return;const r=cv.getBoundingClientRect(),px=(ev.clientX-r.left)/r.width*R.N,py=(ev.clientY-r.top)/r.height*R.N;select((R.N/2-px)*R.scale,(R.N/2-py)*R.scale,false);frame()};
let tm;function timer(){clearInterval(tm);$("fpsv").textContent=S.fps+" кадр/с";$("play").textContent=S.play?"Пауза":"Играть";
 if(S.play)tm=setInterval(()=>{const R=S.R;if(!R||S.mode=="sum"||document.hidden)return;const n=R.epochs.length,lo=S.mode=="diff"&&n>1?1:0;S.e=S.e+1>=n?lo:S.e+1;frame();charts()},1000/S.fps)}
addEventListener("resize",()=>S.R&&charts());

/* ================= visuals: hero, scroll story, results ================= */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const DETL=[0,.92,1.36,2.02,3.12,4.12,4.71];
/* false-colour tint per detector: short wavelengths blue, long wavelengths red */
const TINT={1:[.50,.70,1],2:[.62,.82,1],3:[.92,.95,1],4:[1,.84,.62],5:[1,.66,.42],6:[1,.50,.36]},NEUTRAL=[.84,.91,1];
function normed(R,det,k){const key="n"+det+"-"+k;if(R._c&&R._c[key])return R._c[key];const a=imgOf(R,det,k);if(!a)return null;
 const st=stretchOf(R,det),M=Math.asinh(st.hi/st.s),o=new Float32Array(a.length);
 for(let i=0;i<a.length;i++)o[i]=clamp(Math.asinh(Math.max(0,a[i]+st.noise)/st.s)/M,0,1);(R._c=R._c||{})[key]=o;return o}
function fit(cv){const d=Math.min(window.devicePixelRatio||1,2),w=cv.clientWidth,h=cv.clientHeight,W=Math.max(1,Math.round(w*d)),H=Math.max(1,Math.round(h*d));
 if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}return[cv.getContext("2d"),W,H,d]}
const SLOTS=[document.createElement("canvas"),document.createElement("canvas")];
function toImage(N,fn,slot){const c=SLOTS[slot||0];c.width=c.height=N;const x=c.getContext("2d"),id=x.createImageData(N,N),D=id.data;
 for(let i=0;i<N*N;i++){const p=4*i;fn(i,D,p);D[p+3]=255}x.putImageData(id,0,0);return c}
const tone=v=>v<=0?0:v>=1?255:255*v;
function tintFn(a,b,f,tA,tB){const t=[0,1,2].map(c=>lerp(tA[c],tB[c],f));
 return(i,D,p)=>{const v=b?a[i]*(1-f)+b[i]*f:a[i],w=Math.max(0,v-.6)*.9;D[p]=tone(v*t[0]*1.1+w);D[p+1]=tone(v*t[1]*1.1+w);D[p+2]=tone(v*t[2]*1.1+w)}}
function diffFn(a,b,st){const M=Math.asinh(st.hi/st.s);
 return(i,D,p)=>{const d=a[i]-b[i],v=Math.min(1,Math.asinh(Math.abs(d)/st.s)/M);if(d>0){D[p]=tone(v);D[p+1]=tone(v*.71);D[p+2]=tone(v*.33)}else{D[p]=tone(v*.49);D[p+1]=tone(v*.77);D[p+2]=tone(v)}}}
/* draw an N×N image so it covers the canvas, image point (cx,cy) at screen point (ax,ay); returns device px per image px */
function blit(x,W,H,img,N,o){const s=Math.max(W,H)/N*o.zoom;x.imageSmoothingEnabled=!!o.smooth;x.imageSmoothingQuality="high";x.globalAlpha=o.alpha==null?1:o.alpha;
 x.drawImage(img,o.ax-o.cx*s,o.ay-o.cy*s,N*s,N*s);x.globalAlpha=1;return s}

/* measurement used by the results cards: same method as the tool's default selection */
function measure(R,pre){const det=pre.det,sc=R.scale,pts=[];let sat=false;
 R.epochs.forEach((e,k)=>{const st=R.stacks[det+"-"+k],g=R.track[k];if(!st||!g)return;
  if(satAt(R,[det],k,g.E,g.No))sat=true;const c=SPX.centroid(st,g.E,g.No,6,sc);
  if(c&&c.snr>=5)pts.push({k,E:c.E,No:c.No,y:yr(e.mjd),f:apFlux(st,c.E,c.No,sc)})});
 let spd=null,ratio=null;if(pts.length>1){const a=pts[0],b=pts[pts.length-1];spd=Math.hypot(b.E-a.E,b.No-a.No)/(b.y-a.y);
  const fs=pts.map(q=>q.f).filter(v=>v>0);if(fs.length>1)ratio=Math.max(...fs)/Math.min(...fs)}
 return{pts,spd,ratio,sat,n:R.nFrames,ep:R.epochs.length}}

/* ---------- hero: false-colour composite of the six detectors ---------- */
let HR=null;
function heroDraw(){const cv=$("hero");if(!HR||!cv)return;const[x,W,H]=fit(cv),R=HR,N=R.N,z=new Float32Array(N*N);
 const n=[1,2,3,4,5,6].map(d=>normed(R,d,0)||z);
 const img=toImage(N,(i,D,p)=>{const r=(n[4][i]+n[5][i])/2,g=(n[2][i]+n[3][i])/2,b=(n[0][i]+n[1][i])/2,w=Math.max(0,(r+g+b)/3-.55)*.8;
  D[p]=tone(r*1.15+w);D[p+1]=tone(g*.98+w);D[p+2]=tone(b*1.25+w)});
 x.fillStyle="#02040a";x.fillRect(0,0,W,H);const wide=W>H*1.1;
 blit(x,W,H,img,N,{zoom:1.04,cx:N/2,cy:N/2,ax:W*(wide?.6:.5),ay:H*.5,smooth:true})}

/* ---------- scroll story ---------- */
let SR=null,SM=null,sraf=0;
function storyPrep(R){const td=R.track[0].det||6,have=R.epochs.map((_,k)=>k).filter(k=>R.stacks[td+"-"+k]),dets=[1,2,3,4,5,6].filter(d=>R.stacks[d+"-0"]);
 const pos=k=>[R.N/2-R.track[k].E/R.scale,R.N/2-R.track[k].No/R.scale],m=measure(R,P[0]);
 return{td,have,dets,pos,spd:m.spd||0}}
function chapAlpha(p,a,b){const fi=a<=0?1:clamp((p-a)/.035,0,1),fo=b>=1?1:clamp((b-p)/.035,0,1);return[Math.min(fi,fo),fi,fo]}
function place(el,X,Y,dx,dy,o){el.style.opacity=o;el.style.transform=`translate(${X+dx}px,${Y+dy}px)`}
function storyRender(){sraf=0;const R=SR,M=SM,el=$("story");if(!R||!M||!el)return;
 const p=clamp((scrollY-el.offsetTop)/(el.offsetHeight-innerHeight),0,1);$("sbar").style.transform="scaleX("+p+")";
 document.querySelectorAll(".chap").forEach(c=>{const[o,fi,fo]=chapAlpha(p,+c.dataset.a,+c.dataset.b);
  c.style.opacity=o;c.style.transform=`translateY(${(1-fi)*48-(1-fo)*48}px)`;c.style.pointerEvents=o>.5?"auto":"none"});
 const cv=$("sc"),[x,W,H,d]=fit(cv),N=R.N,wide=W>H*1.1,ax=W*(wide?.64:.5),ay=H*(wide?.5:.36);
 const h=M.have,k0=h[0],k1=h[h.length-1],[x0,y0]=M.pos(k0),[x1,y1]=M.pos(k1),mx=(x0+x1)/2,my=(y0+y1)/2,ZS=wide?1.9:1.7;
 let img,img2=null,a2=0,zoom,cx,cy,smooth=true,lam=null,kShown=k0,spdF=0,cOn=0,dOn=0,det=M.dets[0];
 if(p<.30){const t=p/.30*(M.dets.length-1),i=Math.min(M.dets.length-2,Math.floor(t)),f=t-i,dA=M.dets[i],dB=M.dets[i+1];
  img=toImage(N,tintFn(normed(R,dA,0),normed(R,dB,0),f,TINT[dA],TINT[dB]));zoom=1+.15*p/.30;cx=N/2;cy=N/2;lam=lerp(DETL[dA],DETL[dB],f);det=f<.5?dA:dB}
 else if(p<.44){const t=ease((p-.30)/.14),dl=M.dets[M.dets.length-1];
  img=toImage(N,tintFn(normed(R,dl,0),normed(R,M.td,k0),t,TINT[dl],NEUTRAL));zoom=lerp(1.15,ZS,t);cx=lerp(N/2,mx,t);cy=lerp(N/2,my,t);cOn=clamp((p-.36)/.05,0,1)}
 else if(p<.75){const u=clamp((p-.47)/.25,0,1),t=u*(h.length-1),i=Math.min(Math.max(0,h.length-2),Math.floor(t)),f=h.length>1?t-i:0;
  img=toImage(N,tintFn(normed(R,M.td,h[i]),h.length>1?normed(R,M.td,h[i+1]):null,f,NEUTRAL,NEUTRAL));zoom=ZS;cx=mx;cy=my;smooth=false;kShown=h[f<.5?i:Math.min(i+1,h.length-1)];spdF=u;cOn=1}
 else{img=toImage(N,tintFn(normed(R,M.td,k1),null,0,NEUTRAL,NEUTRAL));const A=imgOf(R,M.td,k1),B=imgOf(R,M.td,k0);
  img2=toImage(N,diffFn(A,B,stretchOf(R,M.td)),1);a2=clamp((p-.75)/.04,0,1);zoom=ZS;cx=mx;cy=my;smooth=false;kShown=k1;spdF=1;cOn=1;dOn=a2}
 x.fillStyle="#02040a";x.fillRect(0,0,W,H);const s=blit(x,W,H,img,N,{zoom,cx,cy,ax,ay,smooth});
 if(img2)blit(x,W,H,img2,N,{zoom,cx,cy,ax,ay,smooth,alpha:a2});
 const scr=(ix,iy)=>[(ax+(ix-cx)*s)/d,(ay+(iy-cy)*s)/d],[cX,cY]=scr(...M.pos(kShown)),[fX,fY]=scr(x0,y0),[lX,lY]=scr(x1,y1),rr=2.1*s/d;
 /* ring at the first position */
 const ringO=p>=.44?1:0;if(ringO){x.strokeStyle="rgba(255,180,84,.95)";x.lineWidth=2*d;x.beginPath();x.arc(fX*d,fY*d,rr*d,0,7);x.stroke()}
 /* callouts */
 const L=[$("lab1"),$("lab2"),$("lab3")],ln=[$("l1"),$("l2"),$("l3")],off=[[rr+110,-rr-90],[-rr-150,rr+80],[rr+110,-rr-80]];
 const show1=p<.75?cOn:1-dOn,show2=p>=.44?1:0,show3=dOn;
 L[1].innerHTML=p<.75?"<span>здесь она была</span>"+fmtD(R.epochs[k0].mjd):"<span>ушла отсюда</span>"+fmtD(R.epochs[k0].mjd);L[1].className="lab "+(p<.75?"amber":"blue");
 L[2].innerHTML="<span>пришла сюда</span>"+fmtD(R.epochs[k1].mjd);
 [[cX,cY,show1],[fX,fY,show2],[lX,lY,show3]].forEach(([X,Y,o],i)=>{const[dx,dy]=off[i];place(L[i],X,Y,dx,dy,o);
  ln[i].setAttribute("x1",X+Math.sign(dx)*rr*.9);ln[i].setAttribute("y1",Y+Math.sign(dy)*rr*.9);ln[i].setAttribute("x2",X+dx);ln[i].setAttribute("y2",Y+dy+12);ln[i].style.opacity=o});
 /* wavelength bar */
 const wo=p<.28?1:clamp((.32-p)/.04,0,1);$("wbar").style.opacity=wo;
 if(lam!=null){$("wdot").style.left=((lam-.75)/(5-.75)*100)+"%";$("wval").textContent="λ ≈ "+num(lam,2)+" мкм · детектор "+det}
 /* speed + date */
 const so=p<.44?0:clamp((p-.46)/.03,0,1);$("speed").style.opacity=so;$("spd").textContent=num(M.spd*ease(spdF))+"″";
 $("spdc").textContent="в год · каталог Gaia: 10,4″";
 $("sdate").style.opacity=so;$("sdate").textContent=p<.75?fmtD(R.epochs[kShown].mjd)+" · проход "+(h.indexOf(kShown)+1)+" из "+h.length:fmtD(R.epochs[k1].mjd)+" минус "+fmtD(R.epochs[k0].mjd)}
const kick=()=>{if(!sraf)sraf=requestAnimationFrame(storyRender)};
addEventListener("scroll",kick,{passive:true});
addEventListener("resize",()=>{kick();heroDraw()});

/* ---------- results ---------- */
const PCARD={barnard:"6 световых лет · самая быстрая звезда",epsind:"пара коричневых карликов · 12 св. лет",wise0855:"самый холодный карлик · только 4,4–5 мкм",rwaur:"молодая переменная звезда",rdra:"мирида · глубокое поле у полюса"};
function thumb(cv,R,pre,m){const[x,W,H]=fit(cv),N=R.N,det=pre.det,g=R.track,sc=R.scale;let img,cx,cy;
 const moving=!m.sat&&m.spd>=1.5;
 if(moving){const a=m.pts[0],b=m.pts[m.pts.length-1];img=toImage(N,diffFn(imgOf(R,det,b.k),imgOf(R,det,a.k),stretchOf(R,det)));cx=N/2-(a.E+b.E)/2/sc;cy=N/2-(a.No+b.No)/2/sc}
 else{const k=(m.pts[0]||{k:0}).k,t=g[k]||{E:0,No:0};img=toImage(N,tintFn(normed(R,det,k)||new Float32Array(N*N),null,0,TINT[det],TINT[det]));cx=N/2-t.E/sc;cy=N/2-t.No/sc}
 x.fillStyle="#02040a";x.fillRect(0,0,W,H);blit(x,W,H,img,N,{zoom:moving?2.6:1.9,cx,cy,ax:W/2,ay:H/2,smooth:false})}
function counter(el){const v=+el.dataset.v,dec=+el.dataset.dec,pre=el.dataset.pre||"",suf=el.dataset.suf||"",t0=performance.now();
 const step=t=>{const u=clamp((t-t0)/1300,0,1);el.textContent=pre+num(v*ease(u),dec)+suf;if(u<1)requestAnimationFrame(step)};requestAnimationFrame(step)}
async function buildCards(){const box=$("cards");if(!box)return;let total=0;
 for(const pre of P){let R;try{R=await loadPreset(pre)}catch(e){continue}const m=measure(R,pre);total+=R.nFrames;
  const moving=!m.sat&&m.spd!=null&&m.spd>=1.5,cat=Math.hypot(pre.pm[0],pre.pm[1]);let chip,cls,big,sub;
  if(m.sat){chip="Насыщена";cls="warn";big=`<b data-v="${m.ep}" data-dec="0">0</b><i>проходов</i>`;sub="слишком яркая: сайт это распознаёт и предупреждает"}
  else if(moving){chip=pre.k=="wise0855"?"Найден · движется":"Движется";cls="ok";big=`<b data-v="${m.spd}" data-dec="1" data-suf="″">0</b><i>в год</i>`;sub="каталог: "+num(cat)+"″ в год"}
  else{chip="Неподвижна · переменная";cls="var";big=`<b data-v="${m.ratio||1}" data-dec="2" data-pre="×">0</b><i>яркость</i>`;sub="сдвиг меньше 1″ за год"}
  const el=document.createElement("article");el.className="rcard glass rv";
  el.innerHTML=`<div class="rthumb"><canvas></canvas><span class="rtag">${moving?"разность эпох":"детектор "+pre.det}</span></div>
   <div class="rbody"><div class="rchip ${cls}">${chip}</div><h3>${pre.n}</h3><p class="rmeta">${PCARD[pre.k]||""}</p>
   <div class="rbig">${big}</div><p class="rsub">${sub} · ${R.nFrames} снимков</p>
   <button class="rgo" type="button">Открыть в инструменте <span>→</span></button></div>`;
  box.appendChild(el);thumb(el.querySelector("canvas"),R,pre,m);
  el.querySelector(".rgo").onclick=()=>{goTo("tool");go.used=1;go(pre.ra,pre.dec)};observe(el)}
 if(total)$("snframes").textContent=total.toLocaleString("ru-RU")}

/* ---------- reveal on scroll, smooth scroll ---------- */
const io="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add("in");
 e.target.querySelectorAll("[data-v]").forEach(counter);io.unobserve(e.target)}),{threshold:.18}):null;
function observe(el){if(io)io.observe(el);else el.classList.add("in")}
let lenis=null;
function goTo(id){const t=document.getElementById(id);if(!t)return;if(lenis)lenis.scrollTo(t,{duration:1.4});else t.scrollIntoView({behavior:"smooth"})}
function initScroll(){if(window.Lenis&&!matchMedia("(prefers-reduced-motion: reduce)").matches){lenis=new Lenis({lerp:.085,smoothWheel:true});
  const raf=t=>{lenis.raf(t);requestAnimationFrame(raf)};requestAnimationFrame(raf)}
 document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener("click",e=>{const id=a.getAttribute("href").slice(1);if(document.getElementById(id)){e.preventDefault();goTo(id)}}));
 document.querySelectorAll(".rv").forEach(observe);
 const nav=document.querySelector(".nav");addEventListener("scroll",()=>nav.classList.toggle("solid",scrollY>40),{passive:true})}
async function initVisuals(){initScroll();
 try{const R=await loadPreset(P[0]);HR=SR=R;SM=storyPrep(R);heroDraw();storyRender();
  $("hspeed").textContent=num(SM.spd)+"″ в год";$("hframes").textContent=R.nFrames;$("hdate").textContent=fmtD(R.tLast)}
 catch(e){document.body.classList.add("nostory")}
 buildCards()}


/* ---------- rebuild the saved targets: open ?build=1 while server.py is running ---------- */
async function buildAll(){for(const p of P){try{const R=await SPX.process(p.ra,p.dec,6,(d,t)=>busy("Обновляю «"+p.n+"»: "+d+" из "+t,"Пересборка сохранённых данных из IRSA. Не закрывайте вкладку.",d/t),null,p.follow?{det:p.follow,pm:p.pm}:null);
   const r=await fetch("save/"+p.k+".json",{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(SPX.pack(R,{key:p.k}))});if(!r.ok)throw new Error("save "+r.status);delete pcache[p.k]}
  catch(e){busy("Не удалось обновить «"+p.n+"»",String(e.message||e));await new Promise(r=>setTimeout(r,4000))}}
 busy("Готово: сохранённые цели обновлены","Перезагрузите страницу без ?build=1.",1)}

/* ---------- start ---------- */
(async function init(){
 if(qs.get("embed"))document.body.classList.add("embed");
 const hasQ=qs.get("ra")!=null&&qs.get("dec")!=null;
 if(qs.get("det")!=null)S.det=+qs.get("det")||0;ds.value=S.det;if(qs.get("mode"))S.mode=qs.get("mode");$("mode").value=S.mode;if(qs.get("fov")){$("fov").value=qs.get("fov");$("fovv").textContent=$("fov").value+"′"}
 timer();
 if(qs.get("build")){document.body.classList.add("nostory");buildAll();return}
 if(!qs.get("embed"))initVisuals();
 if(hasQ){const ra=parseC(qs.get("ra"),false),dec=parseC(qs.get("dec"),false);if(!isNaN(ra)&&!isNaN(dec)){if(location.hash=="#tool")$("tool").scrollIntoView();await go(ra,dec);if(S.mode=="diff"&&S.R&&S.R.epochs.length>1){S.e=S.R.epochs.length-1;frame()}return}}
 go(P[0].ra,P[0].dec)})();
