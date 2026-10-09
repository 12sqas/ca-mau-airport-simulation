(() => {
  const canvas=document.getElementById('airportCanvas'),ctx=canvas.getContext('2d');
  const airportPhoto=new Image();
  airportPhoto.src='./airport-aerial.png';
  airportPhoto.addEventListener('load',()=>render());
  const W=1440,H=920,gateXs=[880,940,1000,1060,1120,1180,1240,1300];
  const runways=[{id:'09/27',y:480,taxiY:535},{id:'10/28',y:650,taxiY:705}];
  const phaseNames={parked:'ĐANG ĐỖ',pushback:'RỜI ỐNG LỒNG',taxiout:'LĂN RA ĐƯỜNG BĂNG',lineup:'VÀO VỊ TRÍ',takeoff:'ĐANG CẤT CÁNH',climb:'ĐANG LÊN CAO',cruise:'TRÊN ĐƯỜNG BAY',approach:'ĐANG TIẾP CẬN',landing:'ĐANG HẠ CÁNH',taxiin:'LĂN VÀO NHÀ GA'};
  const colors=['#63deeb','#f8c36c','#bd9dff','#90e5ae','#ff9a82'];
  const names=['DM 210','DM 408','DM 621','DM 103','DM 775'];
  const planes=names.map((name,i)=>({name,color:colors[i],gate:i,runway:i===4?1:i%2,phase:['parked','taxiout','takeoff','approach','landing'][i],t:[.45,.45,.24,.4,.55][i],phaseAge:0,route:null,pos:{x:gateXs[i],y:330},angle:-Math.PI/2,visible:true,history:[]}));
  let paused=false,speed=1,simSeconds=6*3600+30*60,last=performance.now(),acc=0,events=[],resizeObs;
  const $=id=>document.getElementById(id);
  const lerp=(a,b,t)=>a+(b-a)*t;
  const ease=t=>t*t*(3-2*t);
  const routeLengths=pts=>{let lens=[0],sum=0;for(let i=1;i<pts.length;i++){sum+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);lens.push(sum);}return {lens,total:sum};};
  function sample(pts,t){
    if(!Array.isArray(pts)||pts.length===0)return {x:0,y:0,angle:0};
    if(pts.length===1)return {x:pts[0][0],y:pts[0][1],angle:0};
    const {lens,total}=routeLengths(pts),target=Math.max(0,Math.min(1,t))*total;let i=1;while(i<lens.length-1&&lens[i]<target)i++;const span=lens[i]-lens[i-1]||1,u=(target-lens[i-1])/span,a=pts[i-1],b=pts[i];return {x:lerp(a[0],b[0],u),y:lerp(a[1],b[1],u),angle:Math.atan2(b[1]-a[1],b[0]-a[0])};}
  const gatePoint=p=>[gateXs[p.gate],330];
  function pathFor(p,phase){const rw=runways[p.runway],g=gatePoint(p),from=sample(p.route||[g],p.t);
    switch(phase){
      case'pushback':return [[...g],[g[0],365],[g[0]-55,365]];
      case'taxiout':return [[g[0]-55,365],[750,365],[750,rw.taxiY],[95,rw.taxiY],[95,rw.y]];
      case'lineup':return [[95,rw.y],[150,rw.y]];
      case'takeoff':return [[100,rw.y],[1365,rw.y]];
      case'climb':return [[1365,rw.y],[1410,rw.y-15],[1450,rw.y-70],[1500,rw.y-155]];
      case'approach':return [[1500,rw.y-170],[1440,rw.y-80],[1370,rw.y-10],[1280,rw.y]];
      case'landing':return [[1280,rw.y],[1100,rw.y],[870,rw.y],[760,rw.y]];
      case'taxiin':return [[760,rw.y],[730,rw.taxiY],[730,365],[g[0],365],[g[0],330]];
      default:return [g];
    }
  }
  function setPhase(p,phase){p.phase=phase;p.t=0;p.phaseAge=0;p.route=pathFor(p,phase);p.visible=phase!=='cruise';
    p.pos=sample(p.route,0);p.angle=p.pos.angle;
    const note=({parked:`${p.name} đã cập cầu ống lồng tại cửa ${String(p.gate+1).padStart(2,'0')}.`,pushback:`${p.name} rời ống lồng, bắt đầu đẩy lùi khỏi cửa.`,taxiout:`${p.name} lăn theo đường lăn đến đường băng ${runways[p.runway].id}.`,lineup:`${p.name} vào vị trí chờ cất cánh đường băng ${runways[p.runway].id}.`,takeoff:`${p.name} bắt đầu chạy đà cất cánh trên ${runways[p.runway].id}.`,climb:`${p.name} rời mặt đất, đang lấy độ cao.`,approach:`${p.name} vào tiếp cận cuối đường băng ${runways[p.runway].id}.`,landing:`${p.name} chạm bánh và giảm tốc trên đường băng.`,taxiin:`${p.name} rời đường băng, lăn về nhà ga.`})[phase];
    if(note)log(note);
  }
  function advancePhase(p){const next={parked:'pushback',pushback:'taxiout',taxiout:'lineup',lineup:'takeoff',takeoff:'climb',climb:'cruise',cruise:'approach',approach:'landing',landing:'taxiin',taxiin:'parked'};setPhase(p,next[p.phase]);}
  function log(message){const stamp=clockText();events.unshift({time:stamp,message});events=events.slice(0,5);renderLog();}
  function clockText(){const s=Math.floor(simSeconds)%86400,h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;return [h,m,sec].map(v=>String(v).padStart(2,'0')).join(':');}
  function renderLog(){ $('eventLog').innerHTML=events.map(e=>`<div class="event"><time>${e.time.slice(0,5)}</time><span>${esc(e.message)}</span></div>`).join(''); }
  function esc(s){return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function drawBackground(){
    if(airportPhoto.complete&&airportPhoto.naturalWidth){ctx.drawImage(airportPhoto,0,0,W,H);return;}
    ctx.fillStyle='#425749';ctx.fillRect(0,0,W,H);
    // Green delta fields, canals, service roads and low terminal-side development.
    for(let i=0;i<90;i++){const x=(i*173+31)%W,y=(i*97+27)%H;if((y<300&&x<820)||(y>755)||(x<55)){ctx.fillStyle=i%3?'#50664c':'#617354';ctx.fillRect(x,y,70+(i%5)*13,20+(i%4)*8);}}
    ctx.strokeStyle='#315e66';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(0,120);ctx.bezierCurveTo(240,170,355,20,610,83);ctx.bezierCurveTo(720,110,715,250,820,270);ctx.stroke();ctx.strokeStyle='#7ea5a1';ctx.lineWidth=1.2;ctx.stroke();
    ctx.fillStyle='#8b9080';ctx.fillRect(45,42,1350,790);ctx.strokeStyle='rgba(226,221,196,.16)';ctx.lineWidth=2;ctx.strokeRect(45,42,1350,790);
    // Perimeter road and service loop.
    ctx.strokeStyle='#4c5554';ctx.lineWidth=14;ctx.strokeRect(65,58,1310,755);ctx.strokeStyle='#c6b890';ctx.lineWidth=1.2;ctx.setLineDash([10,12]);ctx.strokeRect(65,58,1310,755);ctx.setLineDash([]);
    drawTerminal();drawApron();drawTaxiways();drawRunways();drawTower();drawLabels();
  }
  function drawTerminal(){ctx.save();ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=16;ctx.fillStyle='#c5c7bc';ctx.beginPath();ctx.moveTo(785,88);ctx.lineTo(1328,88);ctx.lineTo(1352,118);ctx.lineTo(1352,248);ctx.lineTo(1290,267);ctx.lineTo(814,267);ctx.lineTo(785,234);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#304f5b';ctx.fillRect(818,111,509,84);ctx.fillStyle='#71919a';for(let i=0;i<14;i++){ctx.fillRect(830+i*35,121,24,63);ctx.fillStyle=i%2?'#71919a':'#668c92';}ctx.fillStyle='#dde0d5';ctx.fillRect(807,200,535,21);ctx.fillStyle='#a8b4ad';ctx.fillRect(835,226,475,28);ctx.fillStyle='#53625e';ctx.fillRect(845,231,450,9);ctx.fillStyle='#263e48';ctx.font='700 14px Arial';ctx.fillText('CÀ MAU INTERNATIONAL TERMINAL',924,151);ctx.fillStyle='#5b6962';ctx.font='700 9px Arial';ctx.fillText('DAT MUI AIRPORT · CAH',1015,245);ctx.restore();
    // Gate fingers and passenger bridges, with stand numbers.
    gateXs.forEach((x,i)=>{ctx.strokeStyle='#bac0b5';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x,263);ctx.lineTo(x,307);ctx.stroke();ctx.strokeStyle='#485d5e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,263);ctx.lineTo(x,307);ctx.stroke();ctx.fillStyle='#d0d2c7';ctx.fillRect(x-22,301,44,5);ctx.fillStyle='#e5e2ce';ctx.font='700 9px Arial';ctx.textAlign='center';ctx.fillText(String(i+1).padStart(2,'0'),x,287);});ctx.textAlign='left';
  }
  function drawApron(){ctx.fillStyle='#898d82';ctx.fillRect(735,280,625,107);ctx.strokeStyle='rgba(239,223,171,.35)';ctx.lineWidth=1;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(760,373);ctx.lineTo(1340,373);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(38,57,52,.45)';for(let i=0;i<8;i++){const x=gateXs[i];ctx.beginPath();ctx.moveTo(x-27,307);ctx.lineTo(x+27,307);ctx.lineTo(x+40,355);ctx.lineTo(x-40,355);ctx.closePath();ctx.fill();}}
  function drawTaxiways(){ctx.lineCap='round';ctx.strokeStyle='#72786f';ctx.lineWidth=28;ctx.beginPath();ctx.moveTo(750,365);ctx.lineTo(750,740);ctx.moveTo(95,535);ctx.lineTo(750,535);ctx.moveTo(95,705);ctx.lineTo(750,705);ctx.moveTo(95,535);ctx.lineTo(95,705);ctx.moveTo(750,535);ctx.lineTo(750,705);ctx.stroke();ctx.strokeStyle='#e4cf87';ctx.lineWidth=1.4;ctx.setLineDash([8,10]);ctx.beginPath();ctx.moveTo(750,365);ctx.lineTo(750,740);ctx.moveTo(95,535);ctx.lineTo(750,535);ctx.moveTo(95,705);ctx.lineTo(750,705);ctx.moveTo(95,535);ctx.lineTo(95,705);ctx.moveTo(750,535);ctx.lineTo(750,705);ctx.stroke();ctx.setLineDash([]);
    // Taxiway holding points.
    runways.forEach(r=>{ctx.strokeStyle='#f5edcf';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(110,r.taxiY-13);ctx.lineTo(110,r.taxiY+13);ctx.moveTo(124,r.taxiY-13);ctx.lineTo(124,r.taxiY+13);ctx.stroke();});
  }
  function drawRunways(){runways.forEach((r,i)=>{ctx.fillStyle='#333b3f';ctx.fillRect(72,r.y-24,1295,48);ctx.fillStyle='#aeb0a6';ctx.fillRect(86,r.y-20,1268,40);ctx.fillStyle='#ece9dc';for(let x=160;x<1280;x+=48)ctx.fillRect(x,r.y-1,27,2);ctx.fillRect(97,r.y-15,7,30);ctx.fillRect(1344,r.y-15,7,30);ctx.fillStyle='#e3eadc';ctx.font='700 12px Arial';ctx.fillText(i===0?'09':'10',118,r.y+5);ctx.fillText(i===0?'27':'28',1315,r.y+5);ctx.fillStyle='rgba(41,53,53,.6)';ctx.fillRect(120,r.y-10,1200,1);});}
  function drawTower(){ctx.fillStyle='#545f5d';ctx.fillRect(565,120,36,108);ctx.fillStyle='#bdd0cc';ctx.fillRect(556,106,54,22);ctx.fillStyle='#274653';ctx.fillRect(561,110,44,10);ctx.fillStyle='#e7e3cd';ctx.beginPath();ctx.moveTo(562,106);ctx.lineTo(568,83);ctx.lineTo(598,83);ctx.lineTo(604,106);ctx.fill();ctx.fillStyle='#3b6973';ctx.fillRect(570,88,26,13);ctx.fillStyle='#f0e7c2';ctx.font='700 9px Arial';ctx.fillText('TOWER',562,244);}
  function drawLabels(){ctx.fillStyle='rgba(17,32,31,.72)';ctx.font='700 10px Arial';ctx.fillText('TAXIWAY A',360,526);ctx.fillText('TAXIWAY B',360,696);ctx.fillStyle='#eef2e7';ctx.font='700 9px Arial';ctx.fillText('09 / 27 · RUNWAY 1',155,456);ctx.fillText('10 / 28 · RUNWAY 2',155,626);ctx.fillStyle='rgba(255,255,255,.48)';ctx.font='800 8px Arial';ctx.fillText('CÀ MAU · VIỆT NAM',88,795);}
  function drawPlane(p){if(!p.visible)return;const q=p.pos;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.phase==='parked'||p.phase==='pushback'?-Math.PI/2:q.angle);ctx.globalAlpha=(p.phase==='climb'||p.phase==='approach')?.88:1;ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=5;ctx.fillStyle='rgba(8,20,25,.55)';ctx.beginPath();ctx.ellipse(2,3,19,7,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=p.color;ctx.strokeStyle='#f3fbfa';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(23,0);ctx.lineTo(9,-2.6);ctx.lineTo(3,-11);ctx.lineTo(-1,-11);ctx.lineTo(1,-2.4);ctx.lineTo(-11,-4);ctx.lineTo(-17,-7);ctx.lineTo(-19,-6);ctx.lineTo(-15,-1);ctx.lineTo(-15,1);ctx.lineTo(-19,6);ctx.lineTo(-17,7);ctx.lineTo(-11,4);ctx.lineTo(1,2.4);ctx.lineTo(-1,11);ctx.lineTo(3,11);ctx.lineTo(9,2.6);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#173346';ctx.fillRect(-7,-.8,12,1.6);ctx.restore();
    if(p.phase==='parked'||p.phase==='pushback'){const extension=p.phase==='parked'?1:Math.max(0,1-p.t),x=gateXs[p.gate],tip=263+extension*62;if(extension>0){ctx.strokeStyle='#c6cec1';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x,263);ctx.lineTo(x,tip);ctx.stroke();ctx.strokeStyle='#72827b';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x,263);ctx.lineTo(x,tip);ctx.stroke();ctx.fillStyle='#eee9d6';ctx.fillRect(x-4,tip-2,8,4);}}
    if(['takeoff','landing','approach'].includes(p.phase)){ctx.fillStyle='rgba(7,24,37,.82)';ctx.fillRect(q.x-24,q.y-25,48,13);ctx.fillStyle='#f1fbfd';ctx.font='700 8px Arial';ctx.textAlign='center';ctx.fillText(p.name,q.x,q.y-16);ctx.textAlign='left';}
  }
  function render(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));const scale=Math.min(canvas.width/W,canvas.height/H);ctx.setTransform(dpr*scale,0,0,dpr*scale,(canvas.width-dpr*scale*W)/2,(canvas.height-dpr*scale*H)/2);drawBackground();planes.forEach(drawPlane);}
  function phaseDuration(p){return ({parked:16,pushback:5,taxiout:28,lineup:3,takeoff:16,climb:8,cruise:13,approach:14,landing:19,taxiin:28})[p.phase]||10;}
  function update(dt){if(paused)return;simSeconds+=dt*speed;planes.forEach(p=>{p.phaseAge+=dt*speed;const duration=phaseDuration(p);if(p.phase==='lineup'&&p.phaseAge>=duration&&runwayBlocked(p))p.phaseAge=duration;if(p.phase==='approach'&&p.phaseAge/duration>.82&&runwayBlocked(p))p.phaseAge=duration*.82;const t=Math.min(1,p.phaseAge/duration);p.t=ease(t);if(p.phase==='cruise'){p.visible=false;}else{if(!p.route)p.route=pathFor(p,p.phase);const q=sample(p.route,p.t);p.pos.x=q.x;p.pos.y=q.y;p.angle=q.angle;}if(p.phase==='approach'&&p.t>.82){p.phase='landing';p.phaseAge=0;p.t=0;p.route=pathFor(p,'landing');log(`${p.name} chuyển sang hạ cánh đường băng ${runways[p.runway].id}.`);}else if(p.phaseAge>=duration){advancePhase(p);}});updateHud();}
  function updateHud(){ $('simClock').textContent=clockText();$('activeCount').textContent=planes.filter(p=>p.phase!=='parked').length;$('rwy1').textContent=runwayState(0);$('rwy2').textContent=runwayState(1);$('rwy1').classList.toggle('occupied',runwayOccupied(0));$('rwy2').classList.toggle('occupied',runwayOccupied(1));$('flightBoard').innerHTML=planes.map(p=>`<div class="flight-row"><b class="flight-code">${p.name}</b><div class="flight-route">CAH <span>→</span> ${p.phase==='taxiin'||p.phase==='landing'?'CAH':'SGN'}<small>${p.phase==='parked'?`Cửa ${String(p.gate+1).padStart(2,'0')} · Đường băng ${runways[p.runway].id}`:`Đường băng ${runways[p.runway].id} · ${clockText().slice(0,5)}`}</small></div><span class="phase-tag ${['landing','takeoff','approach'].includes(p.phase)?'warn':''}">${phaseNames[p.phase]}</span></div>`).join('');}
  function runwayOccupied(i){return planes.some(p=>p.runway===i&&['lineup','takeoff','landing'].includes(p.phase));}
  function runwayBlocked(plane){const index=planes.indexOf(plane);return planes.some((other,i)=>other!==plane&&other.runway===plane.runway&&(['takeoff','landing'].includes(other.phase)||(other.phase==='lineup'&&i<index)));}
  function runwayState(i){const p=planes.find(p=>p.runway===i&&['lineup','takeoff','landing'].includes(p.phase));return p?(p.phase==='landing'?'ĐANG HẠ CÁNH':p.phase==='takeoff'?'ĐANG CẤT CÁNH':'ĐANG XẾP HÀNG'):'SẴN SÀNG';}
  function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;acc+=dt;if(acc>.08){update(acc);acc=0;render();}requestAnimationFrame(frame);}
  function init(){planes.forEach((p,i)=>{p.route=pathFor(p,p.phase);p.pos=sample(p.route,p.t);if(p.phase==='parked')p.angle=-Math.PI/2;p.phaseAge=phaseDuration(p)*p.t;if(p.phase==='landing')p.t=.55;});log('Mô phỏng sân bay Cà Mau đã bắt đầu.');log('Hai đường băng sẵn sàng điều phối.');updateHud();render();resizeObs=new ResizeObserver(render);resizeObs.observe(canvas.parentElement);requestAnimationFrame(frame);}
  $('pauseBtn').addEventListener('click',()=>{paused=!paused;$('pauseBtn').innerHTML=paused?'▶ <span>Tiếp tục</span>':'Ⅱ <span>Tạm dừng</span>';});
  $('speedBtn').addEventListener('click',()=>{speed=speed===1?2:speed===2?4:1;$('speedBtn').textContent=speed+'×';});
  $('resetBtn').addEventListener('click',()=>{planes.forEach((p,i)=>{p.gate=i;p.runway=i%2;setPhase(p,['parked','taxiout','takeoff','approach','landing'][i]);});simSeconds=6*3600+30*60;events=[];log('Mô phỏng được chạy lại từ đầu.');updateHud();});
  init();
})();
