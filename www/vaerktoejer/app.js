const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const num = (id, fallback = 0) => Number($(id)?.value) || fallback;
const strictNum = (id, fallback = 0) => { const value = Number($(id)?.value); return Number.isFinite(value) ? value : fallback; };
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const VOLTAGE_COLOR = '#48dff0';
const CURRENT_COLOR = '#ff5f6d';
const da = (value, digits = 1) => Number.isFinite(value) ? value.toLocaleString('da-DK', {maximumFractionDigits: digits, minimumFractionDigits: digits}) : '—';
const unit = (value, suffix, digits = 1) => `${da(value, digits)} ${suffix}`;
const inputNumber = (value, digits = 3) => Number.isFinite(value) ? String(Number(value.toFixed(digits))) : '';
const power = (watts, reactive = false) => {
  const suffix = reactive ? 'var' : 'W';
  return Math.abs(watts) >= 1000 ? unit(watts / 1000, reactive ? 'kvar' : 'kW', 2) : unit(watts, suffix, 1);
};
const apparentPower = va => Math.abs(va) >= 1000 ? unit(va / 1000, 'kVA', 2) : unit(va, 'VA', 1);
const phiResultLabel = phi => Math.abs(phi) < .05 ? 'φ = 0,0°  |  resistiv' : `φ = ${phi > 0 ? '+' : ''}${da(phi,1)}°  |  ${phi < 0 ? 'kapacitiv' : 'induktiv'}`;
const themeSurface = () => document.body.classList.contains('light-theme') ? '#ffffff' : '#111b24';
const svg = (tag, attrs = {}, text = '') => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v));
  if (text) e.textContent = text;
  return e;
};
const clear = el => { while(el.firstChild) el.removeChild(el.firstChild); };
const MAX_COMPONENTS = 10;
const THREE_LOAD_MAX_COMPONENTS = 5;
const line = (root, x1,y1,x2,y2, cls='grid-line', color) => root.append(svg('line',{x1,y1,x2,y2,class:cls, ...(color?{stroke:color}:{})}));
const text = (root, x,y,value, cls='vector-label', color='#aab6be', anchor='start') => root.append(svg('text',{x,y,class:cls,fill:color,'text-anchor':anchor},value));
const subscriptText = (root,x,y,main,sub,cls='vector-label',color='#aab6be',anchor='start') => {
  const t=svg('text',{x,y,class:cls,fill:color,'text-anchor':anchor});
  t.append(svg('tspan',{},main));
  t.append(svg('tspan',{'baseline-shift':'sub','font-size':'72%'},sub));
  root.append(t); return t;
};
const subscriptValueText = (root,x,y,main,sub,suffix,cls='vector-label',color='#aab6be',anchor='start') => {
  const t=subscriptText(root,x,y,main,sub,cls,color,anchor);
  t.append(svg('tspan',{},suffix));
  return t;
};
function arrow(root, cx, cy, length, angle, color, label, scale=1){
  const a=rad(angle), ex=cx+length*Math.cos(a), ey=cy-length*Math.sin(a);
  const g=svg('g');
  const stroke=Math.max(1.6,2.05*scale);
  const head=Math.min(Math.max(7,9.5*scale), Math.max(4,length*.38));
  const wing=Math.max(3.4,head*.46);
  const bx=ex-head*Math.cos(a), by=ey+head*Math.sin(a);
  if(length>head*.9)g.append(svg('line',{x1:cx,y1:cy,x2:bx,y2:by,class:'vector',stroke:color,style:`stroke-width:${stroke};stroke-linecap:round`}));
  const p1=[ex,ey],p2=[bx+wing*Math.sin(a),by+wing*Math.cos(a)],p3=[bx-wing*Math.sin(a),by-wing*Math.cos(a)];
  g.append(svg('polygon',{points:`${p1.join(',')} ${p2.join(',')} ${p3.join(',')}`,fill:color}));
  if(label)g.append(svg('text',{x:ex+12*Math.cos(a),y:ey-12*Math.sin(a),fill:color,class:'vector-label','text-anchor':Math.cos(a)<-.2?'end':'start'},label));
  root.append(g); return {x:ex,y:ey,group:g};
}
function arrowTo(root,x1,y1,x2,y2,color,label='',scale=1){
  return arrow(root,x1,y1,Math.hypot(x2-x1,y2-y1),deg(Math.atan2(y1-y2,x2-x1)),color,label,scale);
}
function baseGrid(root,cx,cy,w=480,h=250){
  for(let x=cx;x>=40;x-=40) line(root,x,25,x,h+25);
  for(let x=cx+40;x<=w;x+=40) line(root,x,25,x,h+25);
  for(let y=cy;y>=25;y-=40) line(root,40,y,w,y);
  for(let y=cy+40;y<=h+25;y+=40) line(root,40,y,w,y);
  line(root,35,cy,w+5,cy,'axis'); line(root,cx,20,cx,h+30,'axis');
  root.append(svg('circle',{cx,cy,r:3,fill:'#5f707b'}));
}

const circuitWire=(root,x1,y1,x2,y2,color)=>root.append(svg('line',{x1,y1,x2,y2,class:'circuit-wire',...(color?{stroke:color}:{})}));
const circuitText=(root,x,y,value,cls='circuit-label',anchor='start',color)=>root.append(svg('text',{x,y,class:cls,'text-anchor':anchor,...(color?{fill:color}:{})},value));
const circuitNode=(root,x,y)=>root.append(svg('circle',{cx:x,cy:y,r:2.8,class:'circuit-node'}));
function circuitArrow(root,x,y,length,angle,label='',color=CURRENT_COLOR){
  const a=rad(angle),ex=x+length*Math.cos(a),ey=y-length*Math.sin(a),head=Math.min(7,Math.max(4,length*.42)),wing=head*.48,bx=ex-head*Math.cos(a),by=ey+head*Math.sin(a);
  circuitWire(root,x,y,bx,by,color);
  root.append(svg('polygon',{points:`${ex},${ey} ${bx+wing*Math.sin(a)},${by+wing*Math.cos(a)} ${bx-wing*Math.sin(a)},${by-wing*Math.cos(a)}`,fill:color}));
  if(label)circuitText(root,(x+ex)/2,(y+ey)/2-7,label,'circuit-current','middle',color);
}
function circuitResistor(root,cx,cy,angle=0){const g=svg('g',{transform:`translate(${cx} ${cy}) rotate(${angle})`});g.append(svg('line',{x1:-32,y1:0,x2:-15,y2:0,class:'circuit-wire'}));g.append(svg('rect',{x:-15,y:-8,width:30,height:16,class:'circuit-component'}));g.append(svg('line',{x1:15,y1:0,x2:32,y2:0,class:'circuit-wire'}));root.append(g);}
function circuitInductor(root,cx,cy,angle=0){const g=svg('g',{transform:`translate(${cx} ${cy}) rotate(${angle})`});g.append(svg('path',{d:'M -34 0 L -24 0 Q -16 -14 -8 0 Q 0 14 8 0 Q 16 -14 24 0 L 34 0',class:'circuit-coil'}));root.append(g);}
function circuitCapacitor(root,cx,cy,angle=0){const g=svg('g',{transform:`translate(${cx} ${cy}) rotate(${angle})`});g.append(svg('line',{x1:-32,y1:0,x2:-5,y2:0,class:'circuit-wire'}));g.append(svg('line',{x1:-5,y1:-12,x2:-5,y2:12,class:'circuit-component'}));g.append(svg('line',{x1:5,y1:-12,x2:5,y2:12,class:'circuit-component'}));g.append(svg('line',{x1:5,y1:0,x2:32,y2:0,class:'circuit-wire'}));root.append(g);}
function builderComponents(prefix,count){return Array.from({length:Math.min(count,MAX_COMPONENTS)},(_,i)=>({index:i+1,type:$(`${prefix}CompType${i+1}`).value,value:Math.max(0,num(`${prefix}CompValue${i+1}`))}));}
function subscriptNumber(value){const digits={'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};return String(value).replace(/\d/g,d=>digits[d]);}
function componentSymbol(type,index){const sub=subscriptNumber(index);return type==='R'?`R${sub}`:type==='L'?`L${sub}`:type==='C'?`C${sub}`:`Z${sub}`;}
function currentSymbol(type,index){const sub=subscriptNumber(index);return type==='R'?`Iᴿ${sub}`:type==='L'?`Iᴸ${sub}`:`Iᶜ${sub}`;}
function drawCircuitComponent(root,type,x,y,angle=0){if(type==='R')circuitResistor(root,x,y,angle);if(type==='L')circuitInductor(root,x,y,angle);if(type==='C')circuitCapacitor(root,x,y,angle);}
function drawCompactCircuitComponent(root,type,x,y,angle=0){
  const g=svg('g',{transform:`translate(${x} ${y}) rotate(${angle})`});
  if(type==='R'||type==='Z')g.append(svg('rect',{x:-12,y:-7,width:24,height:14,rx:2,class:'circuit-component'}));
  if(type==='L')g.append(svg('path',{d:'M -13 0 Q -9 -9 -5 0 Q -1 9 3 0 Q 7 -9 11 0',class:'circuit-coil'}));
  if(type==='C'){g.append(svg('line',{x1:-15,y1:0,x2:-5,y2:0,class:'circuit-wire'}));g.append(svg('line',{x1:-5,y1:-9,x2:-5,y2:9,class:'circuit-component'}));g.append(svg('line',{x1:5,y1:-9,x2:5,y2:9,class:'circuit-component'}));g.append(svg('line',{x1:5,y1:0,x2:15,y2:0,class:'circuit-wire'}));}
  root.append(g);
}
function drawSeriesCircuit(components){
  const root=$('seriesCircuit');clear(root);const compact=components.length>5,start=compact?64:components.length===1?255:components.length===2?185:140,end=compact?458:components.length===1?255:components.length===2?335:380,step=components.length>1?(end-start)/(components.length-1):0,centers=components.map((_,i)=>start+i*step);let previous=28;circuitNode(root,28,48);circuitNode(root,28,118);circuitArrow(root,45,48,31,0,'I');components.forEach((component,i)=>{const x=centers[i],half=compact?16:32;circuitWire(root,previous,48,x-half,48);compact?drawCompactCircuitComponent(root,component.type,x,48):drawCircuitComponent(root,component.type,x,48);circuitText(root,x,compact?25:23,componentSymbol(component.type,component.index),'circuit-label','middle');previous=x+half;});circuitWire(root,previous,48,475,48);circuitWire(root,475,48,475,118);circuitWire(root,475,118,28,118);circuitText(root,12,87,'U','circuit-label','middle');
}
function drawParallelCircuit(components){
  $('parallelCircuitTitle').textContent=`${components.length} parallel${components.length===1?'gren':'grene'}`;
  const root=$('parallelCircuit');clear(root),compact=components.length>5;
  circuitWire(root,30,38,482,38);circuitWire(root,30,125,482,125);circuitNode(root,30,38);circuitNode(root,30,125);circuitArrow(root,48,38,38,0,'I');circuitText(root,13,85,'U','circuit-label','middle');
  const start=components.length===1?280:compact?68:components.length===2?210:170,end=components.length===1?280:compact?455:components.length===2?370:410,step=components.length>1?(end-start)/(components.length-1):0,xs=components.map((_,i)=>start+i*step);
  components.forEach((component,i)=>{
    const x=xs[i];circuitNode(root,x,38);circuitNode(root,x,125);
    if(compact){circuitWire(root,x,38,x,67);circuitWire(root,x,97,x,125);circuitArrow(root,x,44,20,-90,currentSymbol(component.type,component.index));drawCompactCircuitComponent(root,component.type,x,82,90);circuitText(root,x,107,componentSymbol(component.type,component.index),'circuit-label tiny-label','middle');}
    else{circuitArrow(root,x,45,20,-90,currentSymbol(component.type,component.index));drawCircuitComponent(root,component.type,x,82,90);circuitText(root,x+17,86,componentSymbol(component.type,component.index),'circuit-label','start');}
  });
}

const defaults = {};
$$('input').forEach(input => defaults[input.id] = input.value);
const selectDefaults={};$$('select').forEach(select=>selectDefaults[select.id]=select.value);
let powerMode=1, threeConnection='Y', threeVoltageType='line', threeCurrentView='line', threeLoadConnection='Y', threeLoadVoltageType='line', threeLoadInputMode='components', threeLoadAsymInputMode='z', threeLoadComponentCount=3, threeLoadVectorMode='total', threeLoadFocusPhase=1, ohmTarget='U', ohmPowerMode='simple', seriesInputMode='components', parallelInputMode='components',seriesComponentCount=3,parallelComponentCount=3,transformDirection='delta-star',transformSymDirection='star-delta',seriesVoltageMode='total',seriesImpedanceMode='total',parallelVectorMode='total',triangleMode='general';
const triangleStates={general:{a:3,b:4,c:5,phi:53.13},impedance:{a:12,b:9,c:15,phi:36.87},voltage:{a:184,b:138,c:230,phi:36.87},power:{a:800,b:600,c:1000,phi:36.87}};
const triangleEdited={general:['a','b'],impedance:['a','b'],voltage:['a','b'],power:['a','b']};

function drawAc(){
  const U=num('acU'), I=num('acI'), f=Math.max(.1,num('acF')), phi=clamp(Number($('acPhi').value)||0,-90,90);
  $('acPhiRange').value=phi; $('acPhiLabel').textContent=`${phi>0?'+':phi<0?'−':''}${da(Math.abs(phi),0)}° — ${phi>0?'kapacitiv':phi<0?'induktiv':'resistiv'}`;
  const loadType=phi<0?'inductive':phi>0?'capacitive':'resistive',loadChip=document.querySelector('.load-chip');loadChip.dataset.load=loadType;
  if(loadType==='inductive'){$('acLoadTitle').textContent='Induktiv last';$('acLoadExplanation').textContent='Strøm bagefter spænding';$('acSignNote').innerHTML='<strong>Induktiv:</strong> Strømmen er bagefter spændingen.';}
  if(loadType==='capacitive'){$('acLoadTitle').textContent='Kapacitiv last';$('acLoadExplanation').textContent='Strøm foran spænding';$('acSignNote').innerHTML='<strong>Kapacitiv:</strong> Strømmen er foran spændingen.';}
  if(loadType==='resistive'){$('acLoadTitle').textContent='Resistiv last';$('acLoadExplanation').textContent='Strøm og spænding er i fase';$('acSignNote').innerHTML='<strong>Resistiv:</strong> Strøm og spænding følges ad.';}
  const S=U*I, P=S*Math.cos(rad(phi)), Q=-S*Math.sin(rad(phi)),T=1/f,dt=Math.abs(phi)/360*T;
  $('acP').textContent=power(P); $('acQ').textContent=power(Q,true); $('acS').textContent=Math.abs(S)>=1000?unit(S/1000,'kVA',2):unit(S,'VA'); $('acCos').textContent=da(Math.cos(rad(phi)),3);
  $('acDt').textContent=`${da(dt*1000,2)} ms`;$('acDtNote').textContent=`Δt = |${da(phi,0)}°| / 360° · ${da(T*1000,1)} ms`;
  $('acVectorText').textContent=`I∠${phi===0?'0':phi>0?'+'+da(phi,0):'−'+da(Math.abs(phi),0)}°`;
  $('acWaveCaption').textContent=phi<0?`Fasevinklen svarer til en tidsforskel: strømmen kommer ${da(dt*1000,2)} ms efter spændingen.`:phi>0?`Fasevinklen svarer til en tidsforskel: strømmen kommer ${da(dt*1000,2)} ms før spændingen.`:'Der er ingen tidsforskel: strøm og spænding passerer samme punkt samtidig.';
  $('acUhatFormula').textContent=da(U*Math.SQRT2,1); $('acFFormula').textContent=da(f,0);
  const Uhat=U*Math.SQRT2,Ihat=I*Math.SQRT2,Umean=2/Math.PI*Uhat,Imean=2/Math.PI*Ihat;
  $('acPeakValues').textContent=`Û = ${da(Uhat,1)} V  |  Î = ${da(Ihat,1)} A`;
  $('acMeanValues').textContent=`Ū = ${da(Umean,1)} V  |  Ī = ${da(Imean,1)} A`;
  $('acRmsValues').textContent=`Uₑff = ${da(U,1)} V  |  Iₑff = ${da(I,1)} A`;
  const root=$('acPhasor'),cx=260,cy=190,uAngle=90,iAngle=90+phi;clear(root);baseGrid(root,cx,cy,480,240);root.append(svg('circle',{cx,cy,r:110,class:'guide'}));
  arrow(root,cx,cy,145,uAngle,VOLTAGE_COLOR,`U = ${da(U,0)} V`);arrow(root,cx,cy,125,iAngle,CURRENT_COLOR,`I = ${da(I,1)} A`);
  if(phi!==0){const r=42,sweep=phi>0?0:1,endX=cx+r*Math.cos(rad(iAngle)),endY=cy-r*Math.sin(rad(iAngle)),midAngle=90+phi/2;root.append(svg('path',{d:`M ${cx} ${cy-r} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,cx+58*Math.cos(rad(midAngle)),cy-58*Math.sin(rad(midAngle))+4,`φ = ${da(Math.abs(phi),0)}°`,'vector-label','#778791','middle');}
  drawWaves(U,I,f,phi);
}
function drawWaves(U,I,f,phi){
  const root=$('waveDiagram'); clear(root); const W=850,H=180,mid=90; line(root,20,mid,830,mid,'axis');
  const durationMs=2000/f;
  for(let ms=0;ms<=durationMs+.001;ms+=5){const x=20+ms/durationMs*810;line(root,x,15,x,165);}
  const path=(phase,amp)=>{let d='';for(let x=20;x<=830;x+=3){const t=(x-20)/810*4*Math.PI;const y=mid-amp*Math.sin(t+rad(phase));d+=(x===20?'M':'L')+` ${x} ${y}`;}return d;};
  root.append(svg('path',{d:path(0,60),fill:'none',stroke:VOLTAGE_COLOR,'stroke-width':2.2}));root.append(svg('path',{d:path(phi,42),fill:'none',stroke:CURRENT_COLOR,'stroke-width':2}));
  const periodPx=405,refX=425,currentX=refX-phi/360*periodPx,dtY=153,left=Math.min(refX,currentX),right=Math.max(refX,currentX),dt=Math.abs(phi)/360/f*1000;
  line(root,refX,mid,refX,166,'guide',VOLTAGE_COLOR);line(root,currentX,mid,currentX,166,'guide',CURRENT_COLOR);
  if(Math.abs(phi)>.05){line(root,left,dtY,right,dtY,'vector','#82909a');root.append(svg('polygon',{points:`${left},${dtY} ${left+7},${dtY-4} ${left+7},${dtY+4}`,fill:'#82909a'}));root.append(svg('polygon',{points:`${right},${dtY} ${right-7},${dtY-4} ${right-7},${dtY+4}`,fill:'#82909a'}));text(root,(left+right)/2,dtY-8,`Δt = ${da(dt,2)} ms`,'vector-label','#82909a','middle');text(root,(left+right)/2,170,phi<0?'I bagefter U':'I foran U','vector-label',CURRENT_COLOR,'middle');}
  else text(root,425,153,'Δt = 0 ms — i fase','vector-label','#55d6a1','middle');
  text(root,28,27,`û = ${da(U*Math.SQRT2,1)} V`,'vector-label',VOLTAGE_COLOR); text(root,28,44,`î = ${da(I*Math.SQRT2,1)} A`,'vector-label',CURRENT_COLOR); text(root,824,107,`${da(2/f*1000,1)} ms`,'vector-label','#596873','end');
}

function seriesValues(){
  const U=Math.max(0,num('rlcU')),f=Math.max(.1,num('rlcF')),omega=2*Math.PI*f,components=builderComponents('series',seriesComponentCount);let R=0,XL=0,XC=0;
  components.forEach(component=>{const value=Math.max(component.value,.000000001);if(component.type==='R')R+=component.value;if(component.type==='L')XL+=seriesInputMode==='components'?omega*value/1000:value;if(component.type==='C')XC+=seriesInputMode==='components'?1/(omega*value*1e-6):value;});
  return {U,f,R,XL,XC,L:XL/omega,C:XC>0?1/(omega*XC):Infinity,components};
}

function seriesComponentParts(components,I,omega){
  return components.map(component=>{
    const value=Math.max(component.value,.000000001);
    const R=component.type==='R'?component.value:0;
    const X=component.type==='L'?(seriesInputMode==='components'?omega*value/1000:value):component.type==='C'?-(seriesInputMode==='components'?1/(omega*value*1e-6):value):0;
    const color=component.type==='R'?'#9b87f5':component.type==='L'?'#ff9f43':'#55d6a1';
    const prefix=component.type==='R'?'U_R':component.type==='L'?'U_L':'U_C';
    const xPrefix=component.type==='R'?'R':component.type==='L'?'X_L':'X_C';
    return {...component,R,X,Ux:I*R,Uy:I*X,color,prefix,xPrefix};
  });
}
function fitScaleFromPoints(points,width,height,pad=60){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs,0),maxX=Math.max(...xs,0),minY=Math.min(...ys,0),maxY=Math.max(...ys,0);
  return Math.min((width-pad*2)/Math.max(1,maxX-minX),(height-pad*2)/Math.max(1,maxY-minY),14);
}
function drawAxisGrid(root,cx,cy,w=680,h=310){
  for(let x=cx;x>=40;x-=50)line(root,x,25,x,h+25);
  for(let x=cx+50;x<=w;x+=50)line(root,x,25,x,h+25);
  for(let y=cy;y>=25;y-=50)line(root,40,y,w,y);
  for(let y=cy+50;y<=h+25;y+=50)line(root,40,y,w,y);
  line(root,35,cy,w+5,cy,'axis');line(root,cx,20,cx,h+30,'axis');root.append(svg('circle',{cx,cy,r:3,fill:'#5f707b'}));
}

function drawRlc(){
  const {U,f,R,L,C,XL,XC,components}=seriesValues(),X=XL-XC,Z=Math.hypot(R,X),I=Z?U/Z:0,zAngle=deg(Math.atan2(X,R)),currentAngle=-zAngle,P=I*I*R,hasL=XL>.00001,hasC=XC>.00001,isResonant=hasL&&hasC&&Math.abs(X)<.05;drawSeriesCircuit(components);
  $('seriesInputTitle').textContent=`${seriesComponentCount} komponent${seriesComponentCount===1?'':'er'} i serie`;$('seriesCircuitTitle').textContent=`${seriesComponentCount} komponent${seriesComponentCount===1?'':'er'} i vandret serie`;
  let seriesFlow='';components.forEach((component,index)=>{const term=component.type==='R'?`R<sub>${component.index}</sub>`:component.type==='L'?`X<sub>L${component.index}</sub>`:`X<sub>C${component.index}</sub>`,operator=index===0?'':component.type==='C'?'<i>−</i>':'<i>+</i>';seriesFlow+=`${operator}<span>${term}</span>`;});$('seriesEquationFlow').innerHTML=`${seriesFlow}<i>→</i><span>Z</span>`;
  const signedCurrentAngle=Math.abs(currentAngle)<.05?'0,0':`${currentAngle>0?'+':'−'}${da(Math.abs(currentAngle),1)}`;$('rlcXL').textContent=unit(XL,'Ω');$('rlcXC').textContent=unit(XC,'Ω');$('rlcZ').textContent=unit(Z,'Ω');$('rlcI').textContent=unit(I,'A',2);$('rlcPhi').textContent=`${signedCurrentAngle} °`;$('rlcP').textContent=power(P);$('rlcPhiText').textContent=`φ = ${signedCurrentAngle}°`;$('rlcNature').textContent=isResonant?'Resonans: spænding og strøm i fase':Math.abs(X)<.05?'Resistiv: spænding og strøm i fase':X>0?'Induktiv: strømmen halter efter':'Kapacitiv: strømmen er foran';
  drawSeriesVoltageDiagram($('rlcPhasor'),components,R,X,U,I,zAngle,f);
  drawSeriesUIPhasor(U,I,zAngle);drawImpedanceTriangle(R,XL,XC,X,Z,zAngle,components,f);
  const ratio=clamp(X/(Math.abs(XL)+Math.abs(XC)+.001),-.5,.5);$('resonanceNeedle').style.left=`${50+ratio*92}%`;const f0=Number.isFinite(C)&&L>0&&C>0?1/(2*Math.PI*Math.sqrt(L*C)):0;$('resonanceTitle').textContent=!f0?'Serieresonans kræver både L og C':isResonant?'Kredsen er i resonans':'Afstand til resonans';$('resonanceText').textContent=f0?`Resonansfrekvens f₀ = ${da(f0,1)} Hz. Ved resonans er Xᴸ = Xᶜ, Z = R og strømmen størst.`:'Vælg mindst én induktiv og én kapacitiv komponent for at beregne resonans.';
}

function drawSeriesUIPhasor(U,I,phi){
  const root=$('seriesUIPhasor'),cx=260,cy=190,currentAngle=-phi,iAngle=90+currentAngle;clear(root);baseGrid(root,cx,cy,480,240);root.append(svg('circle',{cx,cy,r:110,class:'guide'}));
  arrow(root,cx,cy,145,90,VOLTAGE_COLOR,`U = ${da(U,0)} V`,.85);arrow(root,cx,cy,125,iAngle,CURRENT_COLOR,`I = ${da(I,2)} A`,.85);
  if(Math.abs(currentAngle)>.05){const r=42,sweep=currentAngle<0?1:0,endX=cx+r*Math.cos(rad(iAngle)),endY=cy-r*Math.sin(rad(iAngle));root.append(svg('path',{d:`M ${cx} ${cy-r} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,cx+42,cy+24,`φ = ${da(Math.abs(currentAngle),1)}°`,'vector-label','#778791','middle');}
  $('seriesUIAngle').textContent=`I∠${Math.abs(currentAngle)<.05?'0':currentAngle>0?'+'+da(Math.abs(currentAngle),1):'−'+da(Math.abs(currentAngle),1)}°`;
}

function drawSeriesVoltageDiagram(root,components,R,X,U,I,phi,f){
  clear(root);const x0=115,y0=185,W=680,H=310,omega=2*Math.PI*f,parts=seriesComponentParts(components,I,omega);
  drawAxisGrid(root,x0,y0,W,H);arrow(root,x0,y0,520,0,CURRENT_COLOR,'',.7);text(root,646,166,'I som reference','vector-label',CURRENT_COLOR,'end');
  if(seriesVoltageMode==='total'){
    const UR=I*R,UX=I*X,scale=Math.min(Math.abs(UR)>0?360/Math.abs(UR):Infinity,Math.abs(UX)>0?135/Math.abs(UX):Infinity,U>0?330/U:Infinity),s=Number.isFinite(scale)?scale:1,ex=x0+UR*s,ey=y0-UX*s;
    const rLabelY=UX<0?y0-14:y0+24;
    arrow(root,x0,y0,Math.abs(UR)*s,UR>=0?0:180,'#9b87f5','',.85);subscriptValueText(root,(x0+ex)/2,rLabelY,'U','R',` = ${da(UR,1)} V`,'vector-label','#9b87f5','middle');
    line(root,ex,y0,ex,ey,'vector','#ff9f43');subscriptValueText(root,ex+14,(y0+ey)/2+4,'U','X',` = ${da(UX,1)} V`,'vector-label','#ff9f43');
    const uEnd=arrow(root,x0,y0,U*s,phi,VOLTAGE_COLOR,'',.85);subscriptValueText(root,(x0+uEnd.x)/2,(y0+uEnd.y)/2+(UX>=0?-14:22),'U','kreds',` = ${da(U,0)} V`,'vector-label',VOLTAGE_COLOR,'middle');
    if(Math.abs(phi)>.5){const r=42,sweep=phi>0?0:1,endX=x0+r*Math.cos(rad(phi)),endY=y0-r*Math.sin(rad(phi));root.append(svg('path',{d:`M ${x0+r} ${y0} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,x0+58,y0+(phi<0?36:-24),`φ = ${da(Math.abs(phi),1)}°`,'vector-label','#82909a','middle');}
    return;
  }
  const URparts=parts.filter(p=>p.type==='R'),Lparts=parts.filter(p=>p.type==='L'),Cparts=parts.filter(p=>p.type==='C'),URsum=URparts.reduce((sum,p)=>sum+p.Ux,0),ULsum=Lparts.reduce((sum,p)=>sum+Math.abs(p.Uy),0),UCsum=Cparts.reduce((sum,p)=>sum+Math.abs(p.Uy),0),UX=ULsum-UCsum;
  const s=Math.min(URsum>0?380/URsum:Infinity,Math.max(ULsum,UCsum,Math.abs(UX))>0?130/Math.max(ULsum,UCsum,Math.abs(UX)):Infinity,U>0?330/U:Infinity),safeS=Number.isFinite(s)?s:1,rx=x0+URsum*safeS,finalY=y0-UX*safeS;
  const rLabelY=UX<0?y0-14:y0+22;
  let px=x0;URparts.forEach(part=>{const nx=px+part.Ux*safeS;arrow(root,px,y0,part.Ux*safeS,0,part.color,'',.5);subscriptText(root,(px+nx)/2,rLabelY,'U',`R${part.index}`,'vector-label',part.color,'middle');px=nx;});
  let vy=y0;Lparts.forEach(part=>{const len=Math.abs(part.Uy)*safeS,nextY=vy-len;arrow(root,rx,vy,len,90,part.color,'',.5);subscriptText(root,rx+18,(vy+nextY)/2+4,'U',`L${part.index}`,'vector-label',part.color,'start');vy=nextY;});
  Cparts.forEach(part=>{const len=Math.abs(part.Uy)*safeS,nextY=vy+len;arrow(root,rx,vy,len,-90,part.color,'',.5);subscriptText(root,rx+18,(vy+nextY)/2+4,'U',`C${part.index}`,'vector-label',part.color,'start');vy=nextY;});
  if(Math.abs(UX)>.0001)line(root,rx,y0,rx,finalY,'vector','#ff9f43');const compPhi=deg(Math.atan2(UX,URsum||.000001)),uEnd=arrow(root,x0,y0,U*safeS,compPhi,VOLTAGE_COLOR,'',.8);subscriptText(root,(x0+uEnd.x)/2,(y0+uEnd.y)/2+(UX>=0?-14:22),'U','samlet','vector-label',VOLTAGE_COLOR,'middle');if(Math.abs(compPhi)>.5){const r=42,sweep=compPhi>0?0:1,endX=x0+r*Math.cos(rad(compPhi)),endY=y0-r*Math.sin(rad(compPhi));root.append(svg('path',{d:`M ${x0+r} ${y0} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,x0+58,y0+(compPhi<0?36:-24),`φ = ${da(Math.abs(compPhi),1)}°`,'vector-label','#82909a','middle');}
  const rows=[...parts.map(part=>({main:'U',sub:`${part.type}${part.index}`,value:part.type==='R'?part.Ux:Math.abs(part.Uy),color:part.color})),{main:'U',sub:'samlet',value:U,color:VOLTAGE_COLOR}],boxX=500,boxY=28,row=18,colGap=92,split=Math.ceil(rows.length/2);root.append(svg('rect',{x:boxX-14,y:boxY-18,width:206,height:Math.min(146,34+split*row),rx:8,fill:themeSurface(),stroke:'#263946','stroke-width':1}));text(root,boxX,boxY,'Værdier','parallel-state','#8f9da6');rows.forEach((item,index)=>{const col=index>=split?1:0,r=col?index-split:index,x=boxX+col*colGap,y=boxY+23+r*row;root.append(svg('circle',{cx:x-8,cy:y-4,r:3,fill:item.color}));subscriptText(root,x,y,item.main,item.sub,'vector-label',item.color,'start');text(root,x+36,y,`${da(item.value,1)} V`,'vector-label',item.color,'start');});
  text(root,50,330,'R-komponenter ligger på x-aksen; reaktanserne tegnes lodret fra R-summen.','vector-label','#778791');
}

function drawImpedanceTriangle(R,XL,XC,X,Z,phi,components=[],f=50){
  $('impedanceR').textContent=unit(R,'Ω');$('impedanceX').textContent=unit(X,'Ω');$('impedanceZ').textContent=unit(Z,'Ω');
  const isResonant=XL>.00001&&XC>.00001&&Math.abs(X)<.05;$('impedanceType').textContent=isResonant?'Resonans':Math.abs(X)<.05?'Resistiv':X>0?'Induktiv':'Kapacitiv';
  $('impedanceXFormula').textContent=`X = ${da(XL,1)} − ${da(XC,1)} = ${da(X,1)} Ω`;
  $('impedanceZFormula').textContent=`Z = √(${da(R,1)}² + (${da(X,1)})²) = ${da(Z,1)} Ω`;
  $('impedancePhiFormula').textContent=R>0?`∠Z = tan⁻¹(${da(X,1)} / ${da(R,1)}) = ${phi>0?'+':''}${da(phi,1)}°`:`∠Z = ${phi>0?'+':''}${da(phi,1)}°`;
  $('impedanceCosFormula').textContent=Z>0?`cos(∠Z) = ${da(R,1)} / ${da(Z,1)} = ${da(R/Z,3)}`:'cos(∠Z) = —';
  const root=$('impedanceTriangle');clear(root);
  if(seriesImpedanceMode==='parts'&&components.length){
    const omega=2*Math.PI*f,parts=seriesComponentParts(components,1,omega),x0=115,y0=185,W=680,H=310;drawAxisGrid(root,x0,y0,W,H);arrow(root,x0,y0,520,0,CURRENT_COLOR,'',.7);text(root,646,166,'I som reference','vector-label',CURRENT_COLOR,'end');
    const Rparts=parts.filter(p=>p.type==='R'),Lparts=parts.filter(p=>p.type==='L'),Cparts=parts.filter(p=>p.type==='C'),Rsum=Rparts.reduce((sum,p)=>sum+p.R,0),XLsum=Lparts.reduce((sum,p)=>sum+Math.abs(p.X),0),XCsum=Cparts.reduce((sum,p)=>sum+Math.abs(p.X),0),Xsum=XLsum-XCsum;
    const s=Math.min(Rsum>0?380/Rsum:Infinity,Math.max(XLsum,XCsum,Math.abs(Xsum))>0?130/Math.max(XLsum,XCsum,Math.abs(Xsum)):Infinity,Z>0?330/Z:Infinity),safeS=Number.isFinite(s)?s:1,rx=x0+Rsum*safeS,finalY=y0-Xsum*safeS;
    const rLabelY=Xsum<0?y0-14:y0+22;
    let px=x0;Rparts.forEach(part=>{const nx=px+part.R*safeS;arrow(root,px,y0,part.R*safeS,0,part.color,'',.5);text(root,(px+nx)/2,rLabelY,`${part.xPrefix}${part.index}`,'vector-label',part.color,'middle');px=nx;});
    let vy=y0;Lparts.forEach(part=>{const len=Math.abs(part.X)*safeS,nextY=vy-len;arrow(root,rx,vy,len,90,part.color,'',.5);subscriptText(root,rx+16,(vy+nextY)/2+4,'X',`L${part.index}`,'vector-label',part.color,'start');vy=nextY;});
    Cparts.forEach(part=>{const len=Math.abs(part.X)*safeS,nextY=vy+len;arrow(root,rx,vy,len,-90,part.color,'',.5);subscriptText(root,rx+16,(vy+nextY)/2+4,'X',`C${part.index}`,'vector-label',part.color,'start');vy=nextY;});
    if(Math.abs(Xsum)>.0001)line(root,rx,y0,rx,finalY,'vector','#ff9f43');const zEnd=arrow(root,x0,y0,Z*safeS,phi,VOLTAGE_COLOR,'',.8);text(root,(x0+zEnd.x)/2,(y0+zEnd.y)/2+(Xsum>=0?-13:22),'Z','vector-label',VOLTAGE_COLOR,'middle');if(Math.abs(phi)>1){const radius=38,sweep=phi>0?0:1,endX=x0+radius*Math.cos(rad(phi)),endY=y0-radius*Math.sin(rad(phi));root.append(svg('path',{d:`M ${x0+radius} ${y0} A ${radius} ${radius} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,x0+56,y0+(phi<0?34:-20),`φ = ${da(Math.abs(phi),1)}°`,'vector-label','#83919a','middle');}
    const rows=[...parts.map(part=>({name:`${part.xPrefix}${part.index}`,value:part.type==='R'?part.R:Math.abs(part.X),color:part.color})),{name:'Z',value:Z,color:VOLTAGE_COLOR}],boxX=500,boxY=28,row=18,colGap=90;root.append(svg('rect',{x:boxX-14,y:boxY-18,width:190,height:Math.min(224,36+Math.ceil(rows.length/2)*row),rx:8,fill:themeSurface(),stroke:'#263946','stroke-width':1}));text(root,boxX,boxY,'Værdier','parallel-state','#8f9da6');rows.forEach((item,index)=>{const col=index>=Math.ceil(rows.length/2)?1:0,r=col?index-Math.ceil(rows.length/2):index,x=boxX+col*colGap,y=boxY+23+r*row;root.append(svg('circle',{cx:x-8,cy:y-4,r:3,fill:item.color}));text(root,x,y,`${item.name} ${da(item.value,1)} Ω`,'vector-label',item.color,'start');});
    text(root,50,330,'R-komponenter ligger på x-aksen; X-komponenter tegnes lodret fra R-summen.','vector-label','#778791');return;
  }
  baseGrid(root,115,185,680,310);arrow(root,115,185,520,0,CURRENT_COLOR,'',.75);text(root,646,166,'I som reference','vector-label',CURRENT_COLOR,'end');
  const scale=Math.min(R>0?380/R:Infinity,Math.abs(X)>0?135/Math.abs(X):Infinity,12);
  const safeScale=Number.isFinite(scale)?scale:1,x0=115,y0=185,rx=x0+R*safeScale,xy=y0-X*safeScale;
  line(root,x0,y0,rx,y0,'vector','#9b87f5');
  line(root,rx,y0,rx,xy,'vector','#ff9f43');
  const zEnd=arrow(root,x0,y0,Z*safeScale,phi,'#35d3e3','',.85);text(root,zEnd.x+12,zEnd.y+(phi>=0?-11:20),`Z = ${da(Z,1)} Ω`,'vector-label','#35d3e3');
  text(root,(x0+rx)/2,y0+(X<0?-12:22),`R = ${da(R,1)} Ω`,'vector-label','#9b87f5','middle');
  text(root,rx+10,(y0+xy)/2+4,`X = ${da(X,1)} Ω`,'vector-label','#ff9f43');
  line(root,x0,xy,rx,xy,'guide');
  if(Math.abs(phi)>1){const radius=38,sweep=phi>0?0:1,endX=x0+radius*Math.cos(rad(phi)),endY=y0-radius*Math.sin(rad(phi));root.append(svg('path',{d:`M ${x0+radius} ${y0} A ${radius} ${radius} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,x0+50,y0+(phi>0?-9:31),`φ = ${da(Math.abs(phi),1)}°`,'vector-label','#83919a');}
  if(Math.abs(X)<.05)text(root,rx+18,y0-10,isResonant?'X = 0  |  resonans':'X = 0  |  resistiv','impedance-zero','#55d6a1');
}

function drawParallel(){
  const U=Math.max(0,num('parU')),f=Math.max(.1,num('parF')),omega=2*Math.PI*f,directCurrents=parallelInputMode==='currents',components=builderComponents('parallel',parallelComponentCount),colors=['#9b87f5','#ff9f43','#55d6a1','#8fb7ff','#d94f8a','#f7c948','#4dd0a9','#ff8a70','#b58cff','#7fd1ff'];let branches=[],inductiveSusceptance=0,capacitiveSusceptance=0;
  if(directCurrents){branches=components.map((component,i)=>({type:component.type,index:component.index,name:currentSymbol(component.type,component.index),value:Math.max(0,num(`parCurrentInput${i+1}`)),angle:clamp(Number($(`parAngleInput${i+1}`).value)||0,-180,180),color:colors[i%colors.length]}));}
  else{branches=components.map((component,i)=>{const value=Math.max(component.value,.000000001);let impedance=value,angle=0;if(component.type==='L'){impedance=parallelInputMode==='components'?omega*value/1000:value;angle=-90;inductiveSusceptance+=1/impedance;}if(component.type==='C'){impedance=parallelInputMode==='components'?1/(omega*value*1e-6):value;angle=90;capacitiveSusceptance+=1/impedance;}return {type:component.type,index:component.index,name:currentSymbol(component.type,component.index),value:U/impedance,angle,color:colors[i%colors.length],impedance};});}
  drawParallelCircuit(components);const XL=inductiveSusceptance>0?1/inductiveSusceptance:NaN,XC=capacitiveSusceptance>0?1/capacitiveSusceptance:NaN,L=Number.isFinite(XL)?XL/omega:NaN,C=Number.isFinite(XC)?1/(omega*XC):NaN,IRsum=branches.filter(b=>b.type==='R').reduce((sum,b)=>sum+b.value,0),ILsum=branches.filter(b=>b.type==='L').reduce((sum,b)=>sum+b.value,0),ICsum=branches.filter(b=>b.type==='C').reduce((sum,b)=>sum+b.value,0),referenceCurrent=branches.reduce((sum,b)=>sum+b.value*Math.cos(rad(b.angle)),0),leadingCurrent=branches.reduce((sum,b)=>sum+b.value*Math.sin(rad(b.angle)),0),I=Math.hypot(referenceCurrent,leadingCurrent),currentAngle=I?deg(Math.atan2(leadingCurrent,referenceCurrent)):0,phi=Math.abs(currentAngle)<.05?0:-currentAngle,Z=I?U/I:0,cos=I?referenceCurrent/I:1,P=U*referenceCurrent,Q=-U*leadingCurrent,tolerance=Math.max(I*.005,.002),state=Math.abs(Q/U||0)<=tolerance?'resistive':Q>0?'inductive':'capacitive',f0=Number.isFinite(L)&&Number.isFinite(C)&&L>0&&C>0?1/(2*Math.PI*Math.sqrt(L*C)):0,isResonant=!directCurrents&&f0>0&&state==='resistive';
  $('parallelInputTitle').textContent=directCurrents?`${parallelComponentCount} grenstrøm${parallelComponentCount===1?'':'me'} med valgfri vinkel`:`${parallelComponentCount} parallel${parallelComponentCount===1?'gren':'grene'}`;$('parallelDiagramTitle').textContent='U som reference: grenstrømme';$('parallelReferenceText').innerHTML=directCurrents?'Reference: U∠0°; alle vinkler måles fra U':'Reference: U∠0°; R: 0°, L: −90°, C: +90°';$('parallelMainFormula').innerHTML='I = |Σ I̲<sub>gren</sub>|';
  $('parallelBranchEquations').innerHTML=branches.map(b=>directCurrents?`<span>${b.name} = I<sub>${b.index}</sub>∠θ<sub>${b.index}</sub></span>`:b.type==='R'?`<span>${b.name} = U/R<sub>${b.index}</sub></span>`:b.type==='L'?`<span>${b.name} = U/X<sub>L${b.index}</sub></span>`:`<span>${b.name} = U/X<sub>C${b.index}</sub></span>`).join('');
  $('parXL').textContent=Number.isFinite(XL)?unit(XL,'Ω'):'—';$('parXC').textContent=Number.isFinite(XC)?unit(XC,'Ω'):'—';$('parXLNote').textContent=directCurrents?'Ikke anvendt':Number.isFinite(XL)?'Ækvivalent induktiv reaktans':'Ingen L-gren';$('parXCNote').textContent=directCurrents?'Ikke anvendt':Number.isFinite(XC)?'Ækvivalent kapacitiv reaktans':'Ingen C-gren';$('parBranchName1').innerHTML='ΣI<sub>R</sub>';$('parBranchName2').innerHTML='ΣI<sub>L</sub>';$('parBranchName3').innerHTML='ΣI<sub>C</sub>';$('parIR').textContent=unit(IRsum,'A',2);$('parIL').textContent=unit(ILsum,'A',2);$('parIC').textContent=unit(ICsum,'A',2);$('parIRNote').textContent='Samlet resistiv strøm';$('parILNote').textContent='Samlet induktiv strøm';$('parICNote').textContent='Samlet kapacitiv strøm';$('parI').textContent=unit(I,'A',2);
  $('parZ').textContent=unit(Z,'Ω');$('parPhi').textContent=unit(phi,'°');$('parCos').textContent=da(cos,3);$('parP').textContent=power(P);$('parQ').textContent=power(state==='resistive'?0:Q,true);$('parallelPhiText').textContent=`I∠${Math.abs(currentAngle)<.05?'0':currentAngle>0?'+'+da(currentAngle,1):da(currentAngle,1)}°`;$('parIFormulaTitle').innerHTML='I = |Σ I̲<sub>gren</sub>|';$('parIFormula').textContent=directCurrents?`I = |Σ I̲_gren| = ${da(I,2)} A`:`I = √(${da(IRsum,2)}² + (${da(ILsum,2)} − ${da(ICsum,2)})²) = ${da(I,2)} A`;
  $('parPhiNote').innerHTML='φ = −arg(ΣI̲<sub>gren</sub>)';$('parCosNote').innerHTML='cos φ = P/(U · I)';$('parPNote').innerHTML=directCurrents?'P = U · Σ(I<sub>k</sub> cos θ<sub>k</sub>)':'P = U · ΣI<sub>R</sub>';$('parQNote').innerHTML=directCurrents?'Q = −U · Σ(I<sub>k</sub> sin θ<sub>k</sub>)':'Q = U · (ΣI<sub>L</sub>−ΣI<sub>C</sub>)';$('parResFormula').textContent=f0?`f₀ = ${da(f0,2)} Hz`:'Kræver både L- og C-gren';$('parZFormula').textContent=`Z = ${da(U,1)} / ${da(I,2)} = ${da(Z,2)} Ω`;$('parallelType').textContent=state==='inductive'?'Induktiv':state==='capacitive'?'Kapacitiv':isResonant?'Parallelresonans':'Resistiv';
  const angleHelp=directCurrents?' Positiv grenvinkel er foran U&nbsp;&nbsp;|&nbsp;&nbsp;negativ er bagefter U.':'';if(state==='inductive')$('parallelNatureText').innerHTML=`<strong>Induktiv:</strong> Resultatstrømmen er ${da(Math.abs(currentAngle),1)}° bagefter spændingen.${angleHelp}`;if(state==='capacitive')$('parallelNatureText').innerHTML=`<strong>Kapacitiv:</strong> Resultatstrømmen er ${da(Math.abs(currentAngle),1)}° foran spændingen.${angleHelp}`;if(state==='resistive')$('parallelNatureText').innerHTML=isResonant?'<strong>Parallelresonans:</strong> De induktive og kapacitive grenstrømme ophæver hinanden.':`<strong>Resistiv:</strong> Resultatstrømmen er i fase med spændingen.${angleHelp}`;
  drawParallelVectorDiagram(branches,I,currentAngle,phi,state);
  if(directCurrents){$('parResonanceNeedle').style.left='50%';$('parResonanceTitle').textContent='Grenstrømme indtastet direkte';$('parResonanceText').textContent='Vektorsummen, fasevinklen, P, Q og Z beregnes direkte ud fra de aktive grenstrømme.';}else if(!f0){$('parResonanceNeedle').style.left='50%';$('parResonanceTitle').textContent='Parallelresonans kræver både L og C';$('parResonanceText').textContent='Vælg mindst én induktiv og én kapacitiv gren for at beregne resonans.';}else{const resRatio=clamp((1-f/f0)*.5,-.5,.5);$('parResonanceNeedle').style.left=`${50+resRatio*92}%`;$('parResonanceTitle').textContent=isResonant?'Kredsen er i parallelresonans':'Afstand til parallelresonans';$('parResonanceText').textContent=`Resonansfrekvens f₀ = ${da(f0,2)} Hz. Ved resonans ophæver de samlede L- og C-strømme hinanden.`;}
}

function drawParallelVectorDiagram(branches,I,currentAngle,phi,state){
  const root=$('parallelPhasor'),cx=330,cy=185,W=680,H=310,IRsum=branches.filter(b=>b.type==='R').reduce((sum,b)=>sum+b.value,0),ILsum=branches.filter(b=>b.type==='L').reduce((sum,b)=>sum+b.value,0),ICsum=branches.filter(b=>b.type==='C').reduce((sum,b)=>sum+b.value,0),pathSum=branches.reduce((sum,b)=>sum+b.value,0),branchExtent=Math.max(IRsum,Math.abs(ILsum-ICsum),Math.hypot(IRsum,ILsum-ICsum)),maxVector=Math.max(I,IRsum,ILsum,ICsum,branchExtent,parallelInputMode==='currents'?pathSum:0,...branches.map(b=>b.value),.001),s=Math.min(145/maxVector,28),iAngle=90+currentAngle;let branchEnd=null;clear(root);drawAxisGrid(root,cx,cy,W,H);root.append(svg('circle',{cx,cy,r:132,class:'guide'}));
  const uEnd=arrow(root,cx,cy,150,90,VOLTAGE_COLOR,'',.75);text(root,uEnd.x-12,uEnd.y-8,'U som reference','vector-label',VOLTAGE_COLOR,'end');
  if(parallelVectorMode==='branches'){
    if(parallelInputMode==='currents'){
      let px=cx,py=cy;const rLabelRight=state==='capacitive'||state==='resistive';const drawDirectStack=(items,side)=>items.forEach(b=>{const len=b.value*s,angle=90+b.angle,a=rad(angle),ex=px+len*Math.cos(a),ey=py-len*Math.sin(a),mx=(px+ex)/2,my=(py+ey)/2;arrow(root,px,py,len,angle,b.color,'',.52);if(side==='R')text(root,px+(rLabelRight?18:-18),my+4,b.name,'vector-label',b.color,rLabelRight?'start':'end');else text(root,mx,my+(side==='L'?-12:20),b.name,'vector-label',b.color,'middle');px=ex;py=ey;});
      drawDirectStack(branches.filter(b=>b.type==='R'),'R');drawDirectStack(branches.filter(b=>b.type==='L'),'L');drawDirectStack(branches.filter(b=>b.type==='C'),'C');line(root,cx,py,px,py,'guide');text(root,58,326,'Grenstrømmene lægges hale-til-spids: R på y-aksen, L mod højre, C mod venstre.','parallel-state','#8f9da6');branchEnd={x:px,y:py};
    }else{
      let px=cx,py=cy;const rLabelRight=state==='capacitive'||state==='resistive';const drawStack=(items,angle,side)=>items.forEach((b,n)=>{const len=b.value*s,ex=px+len*Math.cos(rad(angle)),ey=py-len*Math.sin(rad(angle));arrow(root,px,py,len,angle,b.color,'',.52);if(side==='R')text(root,px+(rLabelRight?18:-18),(py+ey)/2+4,b.name,'vector-label',b.color,rLabelRight?'start':'end');else text(root,(px+ex)/2,(py+ey)/2+(side==='L'?-12:20),b.name,'vector-label',b.color,'middle');px=ex;py=ey;});
      drawStack(branches.filter(b=>b.type==='R'),90,'R');drawStack(branches.filter(b=>b.type==='L'),0,'L');drawStack(branches.filter(b=>b.type==='C'),180,'C');line(root,cx,py,px,py,'guide');text(root,58,326,'Grenstrømmene lægges hale-til-spids: R på y-aksen, L mod højre, C mod venstre.','parallel-state','#8f9da6');
      branchEnd={x:px,y:py};
    }
    const legendRows=[...branches.slice(0,10),{name:'I',value:I,color:CURRENT_COLOR,total:true}],legendX=505,legendY=58,colGap=105,row=18,split=Math.ceil(legendRows.length/2);root.append(svg('rect',{x:legendX-14,y:legendY-18,width:206,height:Math.min(224,34+split*row),rx:8,fill:themeSurface(),stroke:'#263946','stroke-width':1}));text(root,legendX,legendY,'Værdier','parallel-state','#8f9da6');legendRows.forEach((b,index)=>{const col=index>=split?1:0,r=col?index-split:index,x=legendX+col*colGap,y=legendY+23+r*row;root.append(svg('circle',{cx:x-8,cy:y-4,r:3,fill:b.color}));text(root,x,y,`${b.name} ${da(b.value,2)} A${parallelInputMode==='currents'&&!b.total?` ∠${da(b.angle,0)}°`:''}`,'vector-label',b.color,'start');});
  }else{
    text(root,58,326,'Skift til “Grene” for at se de enkelte grenstrømme.','parallel-state','#8f9da6');
  }
  const totalEnd=branchEnd?arrowTo(root,cx,cy,branchEnd.x,branchEnd.y,CURRENT_COLOR,'',.85):arrow(root,cx,cy,I*s,iAngle,CURRENT_COLOR,'',.85),iLabelRight=state!=='capacitive',iLabelX=(cx+totalEnd.x)/2+(iLabelRight?20:-20),iLabelY=(cy+totalEnd.y)/2+4;text(root,iLabelX,iLabelY,'I','vector-label',CURRENT_COLOR,iLabelRight?'start':'end');
  if(Math.abs(phi)>1){const r=44,sweep=phi>0?1:0,endX=cx+r*Math.cos(rad(iAngle)),endY=cy-r*Math.sin(rad(iAngle));root.append(svg('path',{d:`M ${cx} ${cy-r} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,cx+42,cy+24,`φ = ${da(Math.abs(phi),1)}°`,'vector-label','#82909a','middle');}
  text(root,648,326,state==='inductive'?'I bagefter U':state==='capacitive'?'I foran U':'I i fase med U','parallel-state','#8f9da6','end');
}

function drawPower(){
  const U=num('powerU'),I=num('powerI'),signed=clamp(Number($('powerCos').value)||0,-1,1),cosMagnitude=Math.sqrt(Math.max(0,1-signed*signed)),k=powerMode===3?Math.sqrt(3):1,S=k*U*I,P=S*cosMagnitude,phi=deg(Math.asin(signed)),Q=S*signed;$('powerCosRange').value=signed;$('powerCosLabel').innerHTML=`${da(signed,2)} — ${signed<0?'kapacitiv':signed>0?'induktiv':'resistiv'}&nbsp;&nbsp;|&nbsp;&nbsp;cos φ = ${da(cosMagnitude,2)}`;$('powerP').textContent=power(P);$('powerQ').textContent=power(Q,true);$('powerS').textContent=S>=1000?unit(S/1000,'kVA',2):unit(S,'VA');$('powerAngle').textContent=unit(phi,'°');$('powerPhi').textContent=`φ = ${phi>0?'+':''}${da(phi,1)}°`;
  const prefix=powerMode===3?'√3 · ':'';$('powerPFormula').textContent=`P = ${prefix}U · I · cos φ`;$('powerQFormula').textContent=`Q = ${prefix}U · I · sin φ`;$('powerSFormula').textContent=`S = ${prefix}U · I`;
  const root=$('powerTriangle');clear(root);baseGrid(root,85,150,480,240);const scale=Math.min(P>0?330/P:Infinity,Math.abs(Q)>0?110/Math.abs(Q):Infinity),s=Number.isFinite(scale)?scale:1,px=85+P*s,qy=150-Q*s;line(root,85,150,px,150,'vector','#9b87f5');line(root,px,150,px,qy,'vector',Q<0?'#9b87f5':'#ff9f43');line(root,85,150,px,qy,'vector','#35d3e3');text(root,(85+px)/2,170,`P ${power(P)}`,'vector-label','#9b87f5','middle');text(root,px+10,(150+qy)/2+4,`Q ${power(Q,true)}`,'vector-label',Q<0?'#9b87f5':'#ff9f43');text(root,(85+px)/2,(150+qy)/2+(Q>=0?-10:18),`S ${S>=1000?da(S/1000,2)+' kVA':da(S,0)+' VA'}`,'vector-label','#35d3e3','middle');text(root,455,282,Q<0?'Kapacitiv: Q < 0':Q>0?'Induktiv: Q > 0':'Resistiv: Q = 0','vector-label',Q<0?'#9b87f5':Q>0?'#ff9f43':'#55d6a1','end');drawPowerWave(phi,cosMagnitude,powerMode);
}

function drawPowerWave(phi,cosMagnitude,mode){
  const root=$('powerWave');clear(root);const left=35,right=870,mid=154,width=right-left,ampU=58,ampI=48,ampP=88;line(root,left,mid,right,mid,'axis');for(let x=left;x<=right;x+=84)line(root,x,35,x,270);
  const points=[],uPoints=[],iPoints=[];for(let x=left;x<=right;x+=2){const t=(x-left)/width*4*Math.PI,u=Math.sin(t),i=Math.sin(t-rad(phi)),p=u*i;points.push({x,y:mid-ampP*p,p});uPoints.push([x,mid-ampU*u]);iPoints.push([x,mid-ampI*i]);}
  let area='',inside=false;points.forEach((pt,index)=>{if(pt.p<0&&!inside){area+=`M ${pt.x} ${mid} L ${pt.x} ${pt.y}`;inside=true;}else if(pt.p<0){area+=` L ${pt.x} ${pt.y}`;}else if(inside){area+=` L ${pt.x} ${mid} Z `;inside=false;}if(index===points.length-1&&inside)area+=` L ${pt.x} ${mid} Z`;});
  root.append(svg('path',{d:area,fill:phi<0?'rgba(155,135,245,.28)':'rgba(255,159,67,.25)',stroke:'none'}));const pathOf=arr=>arr.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(' ');root.append(svg('path',{d:pathOf(uPoints),fill:'none',stroke:'#35d3e3','stroke-width':1.8}));root.append(svg('path',{d:pathOf(iPoints),fill:'none',stroke:phi<0?'#9b87f5':'#ff9f43','stroke-width':1.8}));root.append(svg('path',{d:points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '),fill:'none',stroke:'#d4dde1','stroke-width':2.2,'stroke-dasharray':'6 5'}));const avgY=mid-ampP*.5*cosMagnitude;line(root,left,avgY,right,avgY,'guide');text(root,left+8,avgY-7,`Pₘᵢd = ${da(cosMagnitude,2)} · S`,'vector-label','#91a0aa');text(root,left+10,48,'u(t)','vector-label','#35d3e3');text(root,left+10,66,'i(t)','vector-label',phi<0?'#9b87f5':'#ff9f43');if(Math.abs(phi)>.2)text(root,left+190,mid+82,phi<0?'Kapacitiv reaktiv energi: Q < 0':'Induktiv reaktiv energi: Q > 0','vector-label',phi<0?'#9b87f5':'#ff9f43','middle');text(root,right-8,286,'2 perioder','vector-label','#63727d','end');$('powerWaveState').textContent=phi<0?'Kapacitiv reaktiv effekt':phi>0?'Induktiv reaktiv effekt':'Rent resistiv effekt';$('powerWaveCaption').textContent=mode===3?'Kurverne viser én fase. Den samlede effekt i et symmetrisk 3-faset system er konstant.':'Farven under x-aksen viser energi, der kortvarigt sendes tilbage mod forsyningen.';
}

function drawThree(){
  const inputU=num('threeU'),R=Math.max(0,num('threeR')),X=Number($('threeX').value)||0,Z=Math.hypot(R,X),cosMagnitude=Z?R/Z:0,phi=deg(Math.atan2(X,R)),signedCos=X<0?-cosMagnitude:cosMagnitude,Uf=threeVoltageType==='phase'?inputU:threeConnection==='Y'?inputU/Math.sqrt(3):inputU,Un=threeVoltageType==='line'?inputU:threeConnection==='Y'?inputU*Math.sqrt(3):inputU,If=Z?Uf/Z:0,In=threeConnection==='Y'?If:If*Math.sqrt(3),P=Math.sqrt(3)*Un*In*cosMagnitude,Q=Math.sqrt(3)*Un*In*Math.sin(rad(phi));
  $('threeVoltageLabel').innerHTML=threeVoltageType==='line'?'<b>Netspænding U<sub>n</sub></b><em>V</em>':'<b>Fasespænding U<sub>f</sub></b><em>V</em>';$('threeUn').textContent=unit(Un,'V');$('threeUf').textContent=unit(Uf,'V');$('threeZ').textContent=unit(Z,'Ω');$('threeIf').textContent=unit(If,'A',2);$('threeI').textContent=unit(In,'A',2);$('threeLineCurrentButton').textContent=unit(In,'A',2);$('threePhaseCurrentButton').textContent=unit(If,'A',2);$('threeP').textContent=power(P);$('threeQ').textContent=power(Q,true);$('threeCos').textContent=da(signedCos,3);$('threeCosAngle').textContent=phiResultLabel(phi);$('threeUnFormula').textContent=threeVoltageType==='line'?'Indtastet':threeConnection==='Y'?'√3 · U_f':'U_n = U_f';$('threeUfFormula').textContent=threeVoltageType==='phase'?'Indtastet':threeConnection==='Y'?'U_n / √3':'U_n = U_f';$('threeIFormula').textContent=threeConnection==='Y'?`I_n = I_z = ${da(If,2)} A`:`I_n = √3 · I_z (${da(If,2)} A)`;$('threePFormula').textContent=threeVoltageType==='line'?'√3 · U_n · I_n · |cosφ|':'3 · U_f · I_z · |cosφ|';$('threeQFormula').textContent=threeVoltageType==='line'?'√3 · U_n · I_n · sinφ':'3 · U_f · I_z · sinφ';
  const selectedPowerFormula=threeVoltageType==='line'?'P = √3 · Uₙ · Iₙ · |cosφ|':'P = 3 · U_f · I_z · |cosφ|';
  $('connectionExplainer').innerHTML=threeConnection==='Y'?`<strong>Y</strong><p>U<sub>f</sub> = U<sub>n</sub>/√3<br>I<sub>n</sub> = I<sub>z</sub><br>I<sub>0</sub> = 0 A ved symmetrisk belastning<br>${selectedPowerFormula}<br>cos φ = ${da(signedCos,3)}</p>`:`<strong>Δ</strong><p>U<sub>f</sub> = U<sub>n</sub><br>I<sub>n</sub> = √3 · I<sub>z</sub><br>I̲<sub>n1</sub> = I̲<sub>12</sub> − I̲<sub>31</sub><br>${selectedPowerFormula}<br>cos φ = ${da(signedCos,3)}</p>`;
  $('threeDiagramTitle').textContent=threeConnection==='Y'?'Stjerne: komponentstrøm og netstrøm er ens':'Trekant: komponentstrømme og netstrømme';$('threeDiagramNote').textContent=threeConnection==='Y'?'Y: Iₙ = I_z og I₀ = 0 A ved symmetrisk belastning.':threeCurrentView==='line'?'Δ: Iₙ = √3 · I_z og er 30° forskudt fra komponentstrømmen.':'Δ: Grenstrømmene I₁₂, I₂₃ og I₃₁ danner netstrømmene ved vektorforskel.';$('threeLoadType').textContent=X<0?'Kapacitiv: strømmen er foran':X>0?'Induktiv: strømmen er bagefter':'Resistiv: strøm og spænding i fase';drawThreeDiagram($('threePhasor'),threeConnection,phi,threeCurrentView);drawThreeCircuit(threeConnection);
}

function drawThreeDiagram(root,connection,phi,currentView){
  clear(root);baseGrid(root,260,160,480,270);const cx=260,cy=160,radius=78,angles=[90,-30,210],deltaAngles=[120,0,-120],colors=['#35d3e3','#ff9f43','#9b87f5'],points=angles.map(a=>[cx+radius*Math.cos(rad(a)),cy-radius*Math.sin(rad(a))]);root.append(svg('polygon',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#657680','stroke-width':1.5}));
  const phaseVoltageNames=['U₁₀','U₂₀','U₃₀'];
  angles.forEach((a,i)=>{const p=points[i];line(root,cx,cy,p[0],p[1],'guide');});
  if(connection==='Y')text(root,405,44,`Fasespændinger: ${phaseVoltageNames.join(', ')}`,'vector-label','#8c9aa3','end');
  const sideNames=['U₁₂','U₂₃','U₃₁'];points.forEach((p,i)=>{const q=points[(i+1)%3],mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2;text(root,mx+(mx<cx?-12:12),my+(my>cy?15:-8),sideNames[i],'vector-label','#8c9aa3','middle');});
  const phaseNames=connection==='Y'?['I_z1','I_z2','I_z3']:['I₁₂','I₂₃','I₃₁'],returnNames=['−I₃₁','−I₁₂','−I₂₃'],lineNames=['Iₙ₁','Iₙ₂','Iₙ₃'];points.forEach((p,i)=>{const refAngle=angles[i],deltaRefAngle=deltaAngles[i],phaseAngle=connection==='D'?deltaRefAngle-phi:refAngle-phi,lineAngle=connection==='D'?refAngle-phi:phaseAngle,returnAngle=connection==='D'?deltaAngles[(i+2)%3]-phi+180:angles[(i+2)%3]-phi+180,guideAngle=connection==='D'?deltaRefAngle:refAngle;line(root,p[0],p[1],p[0]+62*Math.cos(rad(guideAngle)),p[1]-62*Math.sin(rad(guideAngle)),'guide');if(connection==='Y'){arrow(root,p[0],p[1],54,phaseAngle,colors[i],lineNames[i],.58);}else{const phaseColor=currentView==='phase'?colors[i]:'#53646f',lineColor=currentView==='line'?colors[i]:'#53646f',returnColor=currentView==='line'?'#8a98a3':'#53646f';arrow(root,p[0],p[1],42,phaseAngle,phaseColor,phaseNames[i],.52);arrow(root,p[0],p[1],42,returnAngle,returnColor,returnNames[i],.45);arrow(root,p[0],p[1],65,lineAngle,lineColor,lineNames[i],.62);}});
  if(connection==='Y'){const neutralNames=['−I₁₀','−I₂₀','−I₃₀'];angles.forEach((a,i)=>arrow(root,cx,cy,34,a-phi+180,CURRENT_COLOR,neutralNames[i],.28));root.append(svg('circle',{cx,cy,r:4,fill:CURRENT_COLOR,opacity:.95}));text(root,cx+16,cy+19,'I₀ = 0 A','vector-label',CURRENT_COLOR);}
  if(Math.abs(phi)>.2){const p=points[0],rr=18,startAngle=connection==='D'?deltaAngles[0]:angles[0],endAngle=startAngle-phi,sweep=endAngle<startAngle?1:0;root.append(svg('path',{d:`M ${p[0]+rr*Math.cos(rad(startAngle))} ${p[1]-rr*Math.sin(rad(startAngle))} A ${rr} ${rr} 0 0 ${sweep} ${p[0]+rr*Math.cos(rad(endAngle))} ${p[1]-rr*Math.sin(rad(endAngle))}`,class:'arc'}));text(root,p[0]+29,p[1]-25,'φ','vector-label','#8c9aa3');}
  text(root,260,304,connection==='Y'?'Stjerne: Uₙ = √3 · U_f, Iₙ = I_z og I₀ = −I₁₀ − I₂₀ − I₃₀':currentView==='line'?'Trekant: Iₙ er vektorforskellen mellem to komponentstrømme':'Trekant: Iₙ = √3 · I_z og er 30° forskudt','vector-label','#6f7e89','middle');
}

function drawThreeCircuit(connection){
  const root=$('threeCircuit');clear(root);const colors=['#35d3e3','#ff9f43','#9b87f5'],ys=[30,60,90];ys.forEach((y,i)=>{circuitText(root,20,y+4,`L${i+1}`,'circuit-label','middle',colors[i]);circuitWire(root,45,y,485,y,colors[i]);circuitArrow(root,62,y,34,0,`Iₙ${i+1}`);});
  if(connection==='Y'){
    $('threeCircuitTitle').textContent='Stjernekobling (Y)';$('threeCircuitNote').textContent='Tre ens faseimpedanser er forbundet mellem L1, L2, L3 og et fælles nulpunkt N.';circuitText(root,20,154,'N','circuit-label','middle');circuitWire(root,45,150,485,150,'#8b98a1');circuitArrow(root,62,150,34,0,'I₀ = 0 A',CURRENT_COLOR);const xs=[180,300,420];xs.forEach((x,i)=>{circuitNode(root,x,ys[i]);circuitWire(root,x,ys[i],x,90,colors[i]);circuitResistor(root,x,120,90);circuitNode(root,x,150);circuitText(root,x+17,124,`Z${i+1}`,'circuit-label');circuitArrow(root,x,92,18,-90);subscriptText(root,x+10,104,'I',`Z${i+1}`,'circuit-current',CURRENT_COLOR);});
  }else{
    $('threeCircuitTitle').textContent='Trekantkobling (Δ)';$('threeCircuitNote').textContent='De tre ens faseimpedanser er forbundet direkte mellem netlederne L1–L2, L2–L3 og L3–L1.';const branches=[{a:[170,30],b:[240,60],y:120,label:'Z₁₂',current:'I₁₂'},{a:[280,60],b:[350,90],y:145,label:'Z₂₃',current:'I₂₃'},{a:[390,90],b:[470,30],y:165,label:'Z₃₁',current:'I₃₁'}];branches.forEach((branch,index)=>{const [ax,ay]=branch.a,[bx,by]=branch.b,arrowY=Math.min(ay+12,branch.y-28);circuitNode(root,ax,ay);circuitNode(root,bx,by);circuitWire(root,ax,ay,ax,branch.y,colors[index]);circuitResistor(root,(ax+bx)/2,branch.y,0);circuitWire(root,bx,branch.y,bx,by,colors[index]);circuitArrow(root,ax,arrowY,18,-90);circuitText(root,ax+10,arrowY+13,branch.current,'circuit-current','start',CURRENT_COLOR);circuitText(root,(ax+bx)/2,branch.y-13,branch.label,'circuit-label','middle');});
  }
}

function threeLoadParts(){
  const omega=2*Math.PI*Math.max(.1,num('threeLoadF'));
  return builderComponents('threeLoad',Math.min(threeLoadComponentCount,THREE_LOAD_MAX_COMPONENTS)).map(component=>{
    const value=component.value;
    if(component.type==='R')return {...component,R:value,X:0};
    if(component.type==='Z'){const phi=clamp(num(`threeLoadPhi${Math.min(component.index,3)}`),-89.9,89.9),z=Math.max(value,.000000001);return {...component,R:z*Math.cos(rad(phi)),X:z*Math.sin(rad(phi)),zAngle:phi,Zmag:z};}
    if(threeLoadInputMode==='reactance')return {...component,R:0,X:component.type==='L'?value:-value};
    return {...component,R:0,X:component.type==='L'?omega*value/1000:-1/(omega*Math.max(value,.000000001)*1e-6)};
  });
}
function threeLoadAsymModeMap(){
  return {
    z:{key:'z',title:'Z + ∠Z',heading:'Impedans pr. belastningsgruppe',first:'Z',firstUnit:'Ω',second:'∠Z',secondUnit:'°',firstDefault:'32.7',secondDefault:'0',firstMin:'0',firstStep:'0.1',secondMin:'-89.9',secondMax:'89.9',secondStep:'0.1',symbol:'Z',help:'Indtast impedansens størrelse og impedansvinkel. Strømmen beregnes som I = U / Z og får modsat fortegn.'},
    current:{key:'current',title:'I + φ',heading:'Strøm pr. belastningsgruppe',first:'I',firstUnit:'A',second:'φ',secondUnit:'°',firstDefault:'7',secondDefault:'0',firstMin:'0',firstStep:'0.1',secondMin:'-180',secondMax:'180',secondStep:'0.1',symbol:'I',help:'Indtast grenstrømmen direkte samt strømvinklen φ målt fra grenens egen spænding.'},
    powerCos:{key:'powerCos',title:'P + cosφ',heading:'Effekt og cosφ pr. belastningsgruppe',first:'P',firstUnit:'W',second:'cosφ',secondUnit:'',firstDefault:'1000',secondDefault:'1',firstMin:'0',firstStep:'10',secondMin:'-1',secondMax:'1',secondStep:'0.01',symbol:'P',help:'Indtast aktiv effekt P og fortegnet cosφ. Positivt fortegn er induktivt, negativt fortegn er kapacitivt.'},
    powerPhi:{key:'powerPhi',title:'P + φ',heading:'Effekt og vinkel pr. belastningsgruppe',first:'P',firstUnit:'W',second:'φ',secondUnit:'°',firstDefault:'1000',secondDefault:'0',firstMin:'0',firstStep:'10',secondMin:'-89.9',secondMax:'89.9',secondStep:'0.1',symbol:'P',help:'Indtast aktiv effekt P og strømvinklen φ. Strømmen findes af P = U · I · cosφ.'}
  };
}
function threeLoadAsymModeConfig(mode=threeLoadAsymInputMode){
  const modes=threeLoadAsymModeMap();
  return modes[mode]||modes.z;
}
function threeLoadAsymBranchCurrent(branch,sourceU){
  if(!branch.active||!Number.isFinite(sourceU)||sourceU<=0)return {value:0,currentAngle:0,zAngle:0,cos:1};
  const mode=branch.inputMode||'z',primary=Number(branch.inputValue),secondary=Number(branch.inputAngle);
  if(mode==='current'){
    const value=Math.max(0,primary),currentAngle=clamp(secondary,-180,180),zAngle=-currentAngle;
    return {value,currentAngle,zAngle,cos:Math.cos(rad(currentAngle))};
  }
  if(mode==='powerCos'){
    const P=Math.max(0,primary),signedCos=clamp(secondary,-1,1),cosAbs=Math.max(.001,Math.abs(signedCos)),angle=deg(Math.acos(cosAbs)),currentAngle=signedCos<0?angle:-angle,zAngle=-currentAngle,value=P/(sourceU*cosAbs);
    return {value,currentAngle,zAngle,cos:signedCos};
  }
  if(mode==='powerPhi'){
    const P=Math.max(0,primary),currentAngle=clamp(secondary,-89.9,89.9),cosAbs=Math.max(.001,Math.abs(Math.cos(rad(currentAngle)))),zAngle=-currentAngle,value=P/(sourceU*cosAbs);
    return {value,currentAngle,zAngle,cos:Math.cos(rad(currentAngle))};
  }
  const Z=Math.max(.000000001,primary),zAngle=clamp(secondary,-89.9,89.9),value=sourceU/Z,currentAngle=-zAngle;
  return {value,currentAngle,zAngle,cos:Math.cos(rad(zAngle))};
}
function threeLoadImpedanceParts(){
  const count=Math.min(threeLoadComponentCount,THREE_LOAD_MAX_COMPONENTS);
  const mode=threeLoadAsymInputMode||'z',cfg=threeLoadAsymModeConfig(mode),zLike=mode==='z';
  return Array.from({length:count},(_,i)=>{
    const index=i+1,connection=threeLoadConnection==='M'?($(`threeLoadGroupConn${index}`)?.value||'Y'):threeLoadConnection,subs=connection==='Y'?['10','20','30']:['12','23','31'],names=connection==='Y'?['I₁₀','I₂₀','I₃₀']:['I₁₂','I₂₃','I₃₁'];
    const branches=[0,1,2].map(phase=>{
      const p=phase+1,primaryInput=$(`threeLoadZc${index}p${p}`),raw=primaryInput?String(primaryInput.value).trim():cfg.firstDefault,primary=Number(raw),enabled=$(`threeLoadActivec${index}p${p}`)?.checked??true,active=enabled&&raw!==''&&Number.isFinite(primary)&&primary>0,angleMin=Number(cfg.secondMin??-180),angleMax=Number(cfg.secondMax??180),inputAngle=active?clamp(strictNum(`threeLoadPhic${index}p${p}`,Number(cfg.secondDefault)||0),angleMin,angleMax):0,Z=active&&zLike?primary:Infinity,zAngle=zLike?inputAngle:0;
      return {group:index,phase:p,type:cfg.symbol,active,value:active?primary:0,inputMode:mode,inputValue:active?primary:0,inputAngle,Zmag:Z,zAngle,R:active&&zLike?Z*Math.cos(rad(zAngle)):0,X:active&&zLike?Z*Math.sin(rad(zAngle)):0,label:`${cfg.symbol}${subscriptNumber(index)}${subscriptNumber(subs[phase])}`,currentName:names[phase],sub:subs[phase]};
    });
    const R=branches.reduce((sum,p)=>sum+p.R,0),X=branches.reduce((sum,p)=>sum+p.X,0),Zmag=Math.hypot(R,X),zAngle=deg(Math.atan2(X,R));
    return {index,connection,branches,R,X,value:Zmag,Zmag,zAngle,label:`Gruppe ${index}`};
  });
}
function vectorFrom(mag,angle){return {x:mag*Math.cos(rad(angle)),y:mag*Math.sin(rad(angle)),mag,angle};}
function vectorSum(...vectors){const x=vectors.reduce((s,v)=>s+v.x,0),y=vectors.reduce((s,v)=>s+v.y,0);return {x,y,mag:Math.hypot(x,y),angle:deg(Math.atan2(y,x))};}
function normalizeAngle(angle){let a=((angle+180)%360+360)%360-180;return Math.abs(a)<.05?0:a;}
function threeLoadPhaseContribs(analysis,phaseIndex){
  const phase=phaseIndex+1,phaseRefs=[90,-30,-150],deltaPairs=[[0,2],[1,0],[2,1]];
  return (analysis?.groups||[]).flatMap(group=>{
    const activeBranches=group.branchCurrents||[],branchByIndex=index=>activeBranches.find(branch=>branch.phase===index+1);
    if(group.connection==='Y'){
      const branch=branchByIndex(phaseIndex);
      return branch?[{...branch,name:`Iₙ${phase}.${group.index}`,phase,angle:branch.angle,globalAngle:branch.angle,localAngle:normalizeAngle(branch.angle-phaseRefs[phaseIndex]),vec:branch.vec,value:branch.value,color:branch.color,sourceConnection:'Y'}]:[];
    }
    const [plusIndex,minusIndex]=deltaPairs[phaseIndex],items=[];
    const plusBranch=branchByIndex(plusIndex),minusBranch=branchByIndex(minusIndex);
    if(plusBranch)items.push({...plusBranch,name:`${plusBranch.currentName}.${group.index}`,phase,angle:plusBranch.angle,globalAngle:plusBranch.angle,localAngle:normalizeAngle(plusBranch.angle-phaseRefs[phaseIndex]),vec:plusBranch.vec,value:plusBranch.value,color:plusBranch.color,sourceConnection:'D'});
    if(minusBranch){const angle=minusBranch.angle+180,vec=vectorFrom(minusBranch.value,angle);items.push({...minusBranch,name:`−${minusBranch.currentName}.${group.index}`,phase,angle,globalAngle:angle,localAngle:normalizeAngle(angle-phaseRefs[phaseIndex]),vec,value:minusBranch.value,color:minusBranch.color,sourceConnection:'D'});}
    return items;
  });
}
function threeLoadSymAnalysis(Uf,Un,parts,connection){
  const sourceU=connection==='Y'?Uf:Un,branchCurrents=parts.map((part,i)=>{
    const Zmag=Math.max(.000000001,Math.hypot(part.R,part.X)),zAngle=deg(Math.atan2(part.X,part.R)),value=sourceU/Zmag,angle=-zAngle,vec=vectorFrom(value,angle);
    return {...part,name:`I${subscriptNumber(part.index)}`,Zmag,zAngle,value,angle,vec,color:['#9b87f5','#ff9f43','#55d6a1','#8fb7ff','#d94f8a'][i%5]};
  }),phaseVec=vectorSum(...branchCurrents.map(b=>b.vec)),If=phaseVec.mag,phaseCurrentAngle=phaseVec.angle,zAngle=If?-phaseCurrentAngle:0,Zmag=If?sourceU/If:0,R=Zmag*Math.cos(rad(zAngle)),X=Zmag*Math.sin(rad(zAngle)),In=connection==='Y'?If:If*Math.sqrt(3),P=3*sourceU*If*Math.cos(rad(zAngle)),Q=3*sourceU*If*Math.sin(rad(zAngle)),S=connection==='Y'?Math.sqrt(3)*Un*In:Math.sqrt(3)*Un*In,cos=S?P/S:1;
  return {asym:false,parallelGroups:true,parts,branches:branchCurrents,R,X,Zmag,If,In,P,Q,S,phi:zAngle,cos,branchTotal:If,branchPhi:phaseCurrentAngle,sourceU,Uf,Un};
}
function threeLoadAsymAnalysis(Uf,Un){
  const groups=threeLoadImpedanceParts(),phaseRefs=[90,-30,-150],deltaRefs=[120,0,-120],phaseRefNames=['U₁₀','U₂₀','U₃₀'],deltaRefNames=['U₁₂','U₂₃','U₃₁'],deltaLineRefNames=['U₁₂ − U₃₁','U₂₃ − U₁₂','U₃₁ − U₂₃'],colors=['#9b87f5','#ff9f43','#55d6a1','#8fb7ff','#d94f8a'],lineVecs=[vectorFrom(0,0),vectorFrom(0,0),vectorFrom(0,0)],neutralSourceVecs=[],branches=[],groupLines=[];
  const deltaBranchVecs=[vectorFrom(0,0),vectorFrom(0,0),vectorFrom(0,0)];
  const localFromPhase=(angle,phaseIndex)=>normalizeAngle(angle-phaseRefs[phaseIndex]);
  let P=0,Q=0;
  groups.forEach((group,gIndex)=>{
    const sourceU=group.connection==='Y'?Uf:Un,refs=group.connection==='Y'?phaseRefs:deltaRefs;
    const b=group.branches.map((branch,i)=>{
      const solved=threeLoadAsymBranchCurrent(branch,sourceU),value=solved.value,currentAngle=solved.currentAngle,angle=refs[i]+currentAngle,vec=vectorFrom(value,angle);
      const item={...branch,...solved,group:group.index,connection:group.connection,name:branch.currentName,value,angle,globalAngle:angle,zPhi:solved.zAngle,branchPhi:currentAngle,localAngle:group.connection==='Y'?localFromPhase(angle,i):null,vec,ref:refs[i],refName:(group.connection==='Y'?phaseRefNames:deltaRefNames)[i],color:colors[gIndex%colors.length]};
      if(branch.active){P+=sourceU*value*Math.cos(rad(solved.zAngle));Q+=sourceU*value*Math.sin(rad(solved.zAngle));branches.push(item);}
      return item;
    });
    if(group.connection==='D')b.forEach((branch,i)=>{if(branch.active)deltaBranchVecs[i]=vectorSum(deltaBranchVecs[i],branch.vec);});
    const lines=group.connection==='Y'?b.map((branch,i)=>({...branch,phase:i+1,name:`Iₙ${i+1}.${group.index}`,sourceName:branch.name,value:branch.value,angle:branch.angle,globalAngle:branch.angle,localAngle:localFromPhase(branch.angle,i),vec:branch.vec,refName:phaseRefNames[i],color:colors[gIndex%colors.length]})):
      [vectorSum(b[0].vec,vectorFrom(b[2].value,b[2].angle+180)),vectorSum(b[1].vec,vectorFrom(b[0].value,b[0].angle+180)),vectorSum(b[2].vec,vectorFrom(b[1].value,b[1].angle+180))]
        .map((v,i)=>({phase:i+1,name:`Iₙ${i+1}.${group.index}`,sourceName:i===0?'I₁₂−I₃₁':i===1?'I₂₃−I₁₂':'I₃₁−I₂₃',group:group.index,connection:group.connection,refName:deltaLineRefNames[i],value:v.mag,angle:v.angle,globalAngle:v.angle,localAngle:localFromPhase(v.angle,i),vec:v,color:colors[gIndex%colors.length]}));
    lines.forEach((lineCurrent,i)=>{lineVecs[i]=vectorSum(lineVecs[i],lineCurrent.vec);if(lineCurrent.value>.0001)groupLines.push(lineCurrent);});
    if(group.connection==='Y')b.filter(branch=>branch.active).forEach(branch=>neutralSourceVecs.push(branch.vec));
    group.branchCurrents=b.filter(branch=>branch.active);group.lineCurrents=lines.filter(line=>line.value>.0001);
  });
  const lines=lineVecs.map((v,i)=>({phase:i+1,name:`Iₙ${i+1}`,value:v.mag,angle:v.angle,globalAngle:v.angle,localAngle:localFromPhase(v.angle,i),vec:v,color:CURRENT_COLOR}));
  const activeGroups=groups.filter(g=>g.branches.some(b=>b.active)),deltaOnly=activeGroups.length>0&&activeGroups.every(g=>g.connection==='D'),deltaCurrentNames=['I₁₂','I₂₃','I₃₁'];
  const deltaTotals=deltaBranchVecs.map((v,i)=>({phase:i+1,name:deltaCurrentNames[i],value:v.mag,angle:v.angle,globalAngle:v.angle,localAngle:localFromPhase(v.angle,i),vec:v,color:CURRENT_COLOR,refName:deltaRefNames[i]}));
  const neutralSource=vectorSum(...neutralSourceVecs),neutralVec=vectorFrom(neutralSource.mag,neutralSource.angle+180),neutral={name:'I₀',value:neutralVec.mag,angle:neutralVec.angle,globalAngle:neutralVec.angle,localAngle:localFromPhase(neutralVec.angle,0),vec:neutralVec,color:CURRENT_COLOR};
  const S=Math.hypot(P,Q),phi=S?deg(Math.atan2(Q,P)):0,cos=S?P/S:1;
  return {asym:true,parts:groups,groups,branches,groupLines,lines,deltaTotals,deltaOnly,neutral,P,Q,S,phi,cos,IfValues:branches.map(b=>b.value),InValues:lines.map(l=>l.value),Un,Uf};
}
function threeLoadLocalAngle(line){
  if(!line)return 0;
  if(Number.isFinite(line.localAngle))return line.localAngle;
  if(Number.isFinite(line.angle))return line.angle;
  return 0;
}
function threeLoadAsymLineSummary(analysis){
  const lines=((analysis&&analysis.lines)||[]).filter(Boolean);
  const parts=lines.map((line,i)=>{
    const phase=line.phase||i+1;
    return `I<sub>n${phase}</sub> = ${unit(line.value,'A',2)} ∠${da(threeLoadLocalAngle(line),1)}°`;
  });
  if(analysis&&analysis.neutral)parts.push(`I<sub>0</sub> = ${unit(analysis.neutral.value,'A',2)} ∠${da(threeLoadLocalAngle(analysis.neutral),1)}°`);
  return parts.length?parts.join('<br>'):'Ingen aktive netstrømme';
}
function threeLoadAsymPowerSummary(analysis){
  const groups=((analysis&&analysis.groups)||[]).filter(g=>g.branches&&g.branches.some(b=>b.active)).length;
  return `P<sub>Σ</sub> = ${power((analysis&&analysis.P)||0)}<br>${groups} aktiv${groups===1?'':'e'} belastningsgruppe${groups===1?'':'r'}`;
}
function threeLoadAsymCosSummary(analysis){
  const lines=((analysis&&analysis.lines)||[]).filter(Boolean);
  if(!lines.length)return 'φ = —';
  return lines.map((line,i)=>{
    const phase=line.phase||i+1,angle=threeLoadLocalAngle(line);
    return `φ<sub>n${phase}</sub> = ${da(angle,1)}° · cosφ<sub>n${phase}</sub> = ${da(Math.cos(rad(angle)),3)}`;
  }).join('<br>');
}
function setThreeLoadFormula(id,value){
  const el=$(id);
  if(el)el.innerHTML=value;
}
function threeLoadAsymCounts(analysis){
  const groups=((analysis&&analysis.groups)||[]).filter(g=>(g.branches||[]).some(b=>b.active));
  const branches=groups.reduce((sum,g)=>sum+(g.branches||[]).filter(b=>b.active).length,0);
  return {groups:groups.length,branches};
}
function threeLoadAsymRFormula(){
  return 'Varierer pr. fase og aktiv gren<br>Se hver belastningsgruppe separat';
}
function threeLoadAsymXFormula(){
  return 'Varierer pr. fase og aktiv gren<br>+ induktiv&nbsp;&nbsp;|&nbsp;&nbsp;− kapacitiv';
}
function threeLoadAsymZFormula(analysis){
  const {groups}=threeLoadAsymCounts(analysis);
  return `${groups} aktiv${groups===1?'':'e'} belastningsgruppe${groups===1?'':'r'}<br>Z behandles pr. fase/gren`;
}
function threeLoadAsymIzFormula(analysis){
  const {branches}=threeLoadAsymCounts(analysis);
  return `${branches} aktiv${branches===1?'':'e'} gren${branches===1?'':'e'} beregnes separat<br>I = U/Z med grenens egen φ`;
}
function threeLoadAsymQFormula(){
  return 'Q summeres fra aktive grene<br>+ induktiv&nbsp;&nbsp;|&nbsp;&nbsp;− kapacitiv';
}
function drawThreeLoad(){
  if(threeLoadConnection==='M'){threeLoadInputMode='impedance';threeLoadVoltageType='line';}
  else if(threeLoadInputMode==='impedance')threeLoadInputMode='components';
  const inputU=Math.max(0,strictNum('threeLoadU')),mixed=threeLoadConnection==='M',Un=inputU,Uf=Math.max(0,strictNum('threeLoadUf',Un/Math.sqrt(3))),asym=threeLoadInputMode==='impedance';
  $('trefaset-belastning')?.classList.toggle('three-load-asym-layout',asym);
  const parts=asym?threeLoadImpedanceParts():threeLoadParts(),analysis=asym?threeLoadAsymAnalysis(Uf,Un):threeLoadSymAnalysis(Uf,Un,parts,threeLoadConnection),R=analysis.R,X=analysis.X,Z=analysis.Zmag,phi=analysis.phi,cosMagnitude=Math.abs(analysis.cos),signedCos=analysis.cos,If=analysis.If??Math.max(...analysis.IfValues),In=analysis.In??Math.max(...analysis.InValues),S=analysis.S,P=analysis.P,Q=analysis.Q,displayP=asym?P:P/3,displayQ=asym?Q:Q/3;
  $('threeLoadVoltageLabel').innerHTML='<b>Netspænding U<sub>n</sub></b><em>V</em>';
  $('threeLoadR').textContent=asym?'varierer':unit(R,'Ω');$('threeLoadX').textContent=asym?'varierer':unit(X,'Ω');$('threeLoadZ').textContent=asym?`${analysis.groups.length} gruppe${analysis.groups.length===1?'':'r'}`:unit(Z,'Ω');$('threeLoadIf').textContent=asym?`maks. ${unit(If,'A',2)}`:unit(If,'A',2);$('threeLoadIn').textContent=asym?`maks. ${unit(In,'A',2)}`:unit(In,'A',2);$('threeLoadP').textContent=power(displayP);$('threeLoadQ').textContent=power(displayQ,true);$('threeLoadCos').textContent=da(signedCos,3);
  if(asym){
    setThreeLoadFormula('threeLoadRFormula',threeLoadAsymRFormula(analysis));
    setThreeLoadFormula('threeLoadXFormula',threeLoadAsymXFormula(analysis));
    setThreeLoadFormula('threeLoadZFormula',threeLoadAsymZFormula(analysis));
    setThreeLoadFormula('threeLoadIfFormula',threeLoadAsymIzFormula(analysis));
    setThreeLoadFormula('threeLoadIFormula',threeLoadAsymLineSummary(analysis));
    setThreeLoadFormula('threeLoadPFormula',threeLoadAsymPowerSummary(analysis));
    setThreeLoadFormula('threeLoadQFormula',threeLoadAsymQFormula(analysis));
    setThreeLoadFormula('threeLoadCosAngle',threeLoadAsymCosSummary(analysis));
  }
  else{
    setThreeLoadFormula('threeLoadRFormula','Ækvivalent R pr. fase');
    setThreeLoadFormula('threeLoadXFormula','Ækvivalent X pr. fase');
    setThreeLoadFormula('threeLoadZFormula','Pr. fase: √(R<sub>eq</sub>² + X<sub>eq</sub>²)');
    setThreeLoadFormula('threeLoadIfFormula','I<sub>z</sub> = U<sub>gren</sub>/Z<sub>eq</sub>');
    setThreeLoadFormula('threeLoadIFormula',threeLoadConnection==='Y'?'I<sub>n</sub> = I<sub>z</sub>':`I<sub>n</sub> = √3 · I<sub>z</sub> (${da(If,2)} A)`);
    setThreeLoadFormula('threeLoadPFormula',threeLoadConnection==='Y'?'Pr. fase: U<sub>f</sub> · I<sub>z</sub> · |cosφ|':'Pr. fase: U<sub>n</sub> · I<sub>z</sub> · |cosφ|');
    setThreeLoadFormula('threeLoadQFormula','Pr. fase: + induktiv&nbsp;&nbsp;|&nbsp;&nbsp;− kapacitiv');
    setThreeLoadFormula('threeLoadCosAngle',phiResultLabel(phi));
  }
  const phaseFormula=`Y-grene bruger indtastet U<sub>f</sub> = ${da(Uf,1)} V`;
  const asymHelp=threeLoadAsymModeConfig(threeLoadAsymInputMode).help;
  $('threeLoadExplainer').innerHTML=asym?`<strong>Usymmetrisk</strong><p>Hver belastningsgruppe kan kobles som Y eller Δ.<br>${phaseFormula}; Δ-grene bruger U<sub>n</sub> = ${da(Un,1)} V.<br>${asymHelp}<br>Værdibokse viser vinkler lokalt: fase 1 ift. U<sub>10</sub>, fase 2 ift. U<sub>20</sub> og fase 3 ift. U<sub>30</sub>.</p>`:threeLoadConnection==='Y'?`<strong>Y</strong><p>Indtastet U<sub>f</sub> = ${da(Uf,1)} V<br>I<sub>n</sub> = I<sub>z</sub><br>Z<sub>eq</sub>: R = ${da(R,1)} Ω, X = ${da(X,1)} Ω</p>`:`<strong>Δ</strong><p>Fasebelastningen ligger mellem to faser, så U<sub>f</sub> = U<sub>n</sub> = ${da(Un,1)} V<br>I<sub>n</sub> = √3 · I<sub>z</sub><br>Z<sub>eq</sub>: R = ${da(R,1)} Ω, X = ${da(X,1)} Ω</p>`;
  const asymDeltaOnly=asym&&analysis.deltaOnly;
  $('threeLoadDiagramTitle').textContent=asymDeltaOnly?'Usymmetrisk Δ: netstrømme på spændingstrekant':mixed?'Usymmetrisk: samlede netstrømme':threeLoadConnection==='Y'?'Stjerne: netstrømme på spændingstrekant':'Trekant: belastningsstrømme på spændingstrekant';$('threeLoadDiagramNote').textContent=asymDeltaOnly?'Røde vektorer er netstrømmene Iₙ1, Iₙ2 og Iₙ3. I trekant beregnes de som vektorforskelle: Iₙ1 = I₁₂ − I₃₁, Iₙ2 = I₂₃ − I₁₂, Iₙ3 = I₃₁ − I₂₃.':asym?'Røde vektorer er de samlede netstrømme Iₙ1, Iₙ2 og Iₙ3.':threeLoadConnection==='D'?'Røde vektorer er grenstrømmene I₁₂, I₂₃ og I₃₁. Netstrømmen Iₙ står i resultaterne.':'Røde vektorer er netstrømmene Iₙ1, Iₙ2 og Iₙ3.';$('threeLoadType').textContent=Q<0?'Kapacitiv: strømmen er foran':Q>0?'Induktiv: strømmen er bagefter':'Resistiv: strøm og spænding i fase';
  if($('threeLoadFocusCard'))$('threeLoadFocusCard').hidden=!asym;$$('#threeLoadFocusPhase button').forEach(b=>b.classList.toggle('active',Number(b.dataset.loadFocus)===threeLoadFocusPhase));
  drawThreeLoadPhasor($('threeLoadPhasor'),threeLoadConnection,phi,If,In,Uf,parts,analysis);drawThreeLoadPhaseFocus($('threeLoadPhaseFocus'),analysis);drawThreeLoadCircuit(parts,threeLoadConnection,R,X,Z,If,In,analysis);if($('threeLoadKind'))$('threeLoadKind').textContent=$('threeLoadType').textContent;
}
function drawThreeLoadPhasor(root,connection,phi,If,In,Uf=0,parts=[],analysis=null){
  clear(root);const cx=360,cy=210,W=680,H=365;drawAxisGrid(root,cx,cy,W,H);
  const triH=analysis?.asym?104:122,triX=analysis?.asym?94:106,triY=analysis?.asym?55:62,top=[cx,cy-triH],right=[cx+triX,cy+triY],left=[cx-triX,cy+triY],neutral=[cx,cy],pts=[top,right,left],voltageColor='#cfd8de',currentColors=[CURRENT_COLOR,'#ff9f43','#55d6a1'],branchColors=['#9b87f5','#ff9f43','#55d6a1','#8fb7ff','#d94f8a'],refs=[90,-30,-150];
  root.append(svg('polygon',{points:pts.map(p=>p.join(',')).join(' '),fill:'none',stroke:voltageColor,'stroke-width':1.9}));
  line(root,neutral[0],neutral[1],top[0],top[1],'guide',voltageColor);line(root,neutral[0],neutral[1],right[0],right[1],'guide',voltageColor);line(root,neutral[0],neutral[1],left[0],left[1],'guide',voltageColor);
  text(root,top[0]+12,top[1]+12,connection==='Y'?'U₁₀':'U₁₂','vector-label',voltageColor);text(root,right[0]-10,right[1]+22,connection==='Y'?'U₂₀':'U₂₃','vector-label',voltageColor,'end');text(root,left[0]+8,left[1]-8,connection==='Y'?'U₃₀':'U₃₁','vector-label',voltageColor);
  const showBranches=threeLoadVectorMode==='branches';
  if(analysis?.asym){
    const displayTotals=analysis.lines;
    const phaseContribsByPhase=[0,1,2].map(i=>threeLoadPhaseContribs(analysis,i)),allPhaseContribs=phaseContribsByPhase.flatMap((items,i)=>items.map(item=>({...item,phase:i+1,valueKind:'bidrag'})));
    const maxI=Math.max(...allPhaseContribs.map(b=>b.value),...analysis.lines.map(l=>l.value),analysis.neutral?.value||0,.001),lineLen=96,branchLen=70,phaseRefs=[90,-30,-150];
    pts.forEach((p,i)=>{
      const ref=phaseRefs[i],refEnd={x:p[0]+54*Math.cos(rad(ref)),y:p[1]-54*Math.sin(rad(ref))},lineCurrent=displayTotals[i],phaseParts=showBranches?phaseContribsByPhase[i]:[];
      root.append(svg('line',{x1:p[0],y1:p[1],x2:refEnd.x,y2:refEnd.y,class:'guide',stroke:'#8a98a3','stroke-dasharray':'7 6'}));
      if(showBranches)phaseParts.forEach(part=>{
        const len=Math.max(18,part.value/maxI*branchLen);
        arrow(root,p[0],p[1],len,part.angle,part.color,'',.44);
      });
      const end=arrow(root,p[0],p[1],Math.max(34,lineCurrent.value/maxI*lineLen),lineCurrent.angle,CURRENT_COLOR,'',.82),anchor=end.x<p[0]?'end':'start';
      text(root,end.x+(anchor==='end'?-10:10),end.y+(i===0?-10:18),`${lineCurrent.name}`,'vector-label',CURRENT_COLOR,anchor);
      const shownPhi=normalizeAngle(lineCurrent.angle-ref);if(Math.abs(shownPhi)>.2){const r=24,from={x:p[0]+r*Math.cos(rad(ref)),y:p[1]-r*Math.sin(rad(ref))},to={x:p[0]+r*Math.cos(rad(lineCurrent.angle)),y:p[1]-r*Math.sin(rad(lineCurrent.angle))},sweep=shownPhi<0?1:0;root.append(svg('path',{d:`M ${from.x} ${from.y} A ${r} ${r} 0 0 ${sweep} ${to.x} ${to.y}`,class:'arc'}));text(root,p[0]+(i===1?36:-30),p[1]+(i===0?-18:20),`φ = ${da(shownPhi,1)}°`,'vector-label','#8c9aa3','middle');}
    });
    if(!analysis.deltaOnly&&analysis.neutral){
      if(analysis.neutral.value>.01){const nEnd=arrow(root,neutral[0],neutral[1],Math.max(28,analysis.neutral.value/maxI*74),analysis.neutral.angle,CURRENT_COLOR,'',.72),nAnchor=nEnd.x<neutral[0]?'end':'start';text(root,nEnd.x+(nAnchor==='end'?-10:10),nEnd.y+18,`I₀ = ${da(analysis.neutral.value,2)} A`,'vector-label',CURRENT_COLOR,nAnchor);}
      else{text(root,neutral[0]+10,neutral[1]+18,'I₀ = 0 A','vector-label',CURRENT_COLOR,'start');}
    }
    const lineContribs=showBranches?allPhaseContribs:[],lineTotals=(analysis.lines||[]).map(b=>({...b,valueKind:'net'})),neutralValue=!analysis.deltaOnly&&analysis.neutral?[{...analysis.neutral,valueKind:'nul'}]:[],values=showBranches?[...lineContribs,...lineTotals,...neutralValue].filter(Boolean):[...lineTotals,...neutralValue].filter(Boolean),lx=556,ly=58,row=15,cols=showBranches&&values.length>13?2:1,rows=Math.ceil(values.length/cols),displayAngle=b=>{if(b.name==='I₀'&&b.value<.01)return 0;if(b.phase>=1&&b.phase<=3&&Number.isFinite(b.localAngle))return b.localAngle;const angle=Number.isFinite(b.globalAngle)?b.globalAngle:b.angle;return normalizeAngle(angle-phaseRefs[0]);},kindLabel=b=>b.valueKind==='bidrag'?' bidrag':'';root.append(svg('rect',{x:lx-14,y:ly-18,width:cols===2?344:230,height:38+row*rows,rx:8,fill:themeSurface(),stroke:'#263946','stroke-width':1}));text(root,lx,ly,showBranches?'Alle bidrag + total · lokale vinkler':'Samlede netstrømme · lokale vinkler','parallel-state','#8f9da6');values.forEach((b,k)=>{const col=cols===2&&k>=rows?1:0,r=col?k-rows:k,x=lx+col*168,y=ly+22+r*row,c=b.valueKind==='net'||b.valueKind==='nul'?CURRENT_COLOR:b.color;root.append(svg('circle',{cx:x-8,cy:y-4,r:3,fill:c}));text(root,x,y,`${b.name}${kindLabel(b)} ${da(b.value,2)} A ∠${da(displayAngle(b),1)}°`,'vector-label',c);});
    text(root,640,365,analysis.deltaOnly?'Δ: Iₙ1 = I₁₂ − I₃₁, Iₙ2 = I₂₃ − I₁₂, Iₙ3 = I₃₁ − I₂₃.':connection==='M'?'Usymmetrisk: I₀ er nulstrømmen fra Y-grupperne.':connection==='D'?'Iₙ beregnes som vektorforskel: Iₙ1 = I₁₂ − I₃₁.':'Iₙ er den enkelte fasegrenstrøm i stjerne.','vector-label','#8f9da6','end');return;
  }
  const isDelta=connection==='D',sourceU=analysis?.sourceU??Uf,deltaBranchNames=['I₁₂','I₂₃','I₃₁'],deltaNetNames=['Iₙ1','Iₙ2','Iₙ3'];
  const branchCurrents=parts.map((part,i)=>{const z=Math.hypot(part.R,part.X),angle=z?-deg(Math.atan2(part.X,part.R)):0,val=z?sourceU/z:0;return {...part,name:`I${subscriptNumber(part.index)}`,value:val,angle,color:branchColors[i%branchColors.length]};}),branchSumX=branchCurrents.reduce((sum,b)=>sum+b.value*Math.cos(rad(b.angle)),0),branchSumY=branchCurrents.reduce((sum,b)=>sum+b.value*Math.sin(rad(b.angle)),0),branchTotal=Math.hypot(branchSumX,branchSumY),branchPhi=branchTotal?deg(Math.atan2(branchSumY,branchSumX)):0,showComponentCurrents=showBranches&&(isDelta||branchCurrents.length>1);
  const deltaBranches=isDelta?refs.map((ref,i)=>{const angle=ref+30+branchPhi,value=branchTotal,vec=vectorFrom(value,angle);return {name:deltaBranchNames[i],value,angle,vec,color:branchColors[i%branchColors.length]};}):[];
  const deltaLines=isDelta?refs.map((ref,i)=>{const returnIndex=[2,0,1][i],forward=deltaBranches[i],returnSource=deltaBranches[returnIndex],retVec=vectorFrom(returnSource.value,returnSource.angle+180),sum=vectorSum(forward.vec,retVec);return {name:deltaNetNames[i],value:sum.mag,angle:sum.angle,phaseRef:ref,forward,ret:{name:`−${returnSource.name}`,value:returnSource.value,angle:normalizeAngle(returnSource.angle+180),color:branchColors[returnIndex%branchColors.length]}};}):[];
  pts.forEach((p,i)=>{
    const ref=refs[i],deltaRef=ref+30,lineData=isDelta?deltaLines[i]:null,lineName=isDelta?lineData.name:`Iₙ${i+1}`,currentRef=isDelta?ref:ref,currentAngle=isDelta?lineData.angle:(showComponentCurrents?currentRef+branchPhi:currentRef-phi),shownValue=isDelta?lineData.value:In,refEnd={x:p[0]+54*Math.cos(rad(currentRef)),y:p[1]-54*Math.sin(rad(currentRef))};
    root.append(svg('line',{x1:p[0],y1:p[1],x2:refEnd.x,y2:refEnd.y,class:'guide',stroke:'#8a98a3','stroke-dasharray':'7 6'}));
    if(showComponentCurrents&&!isDelta){const maxI=Math.max(branchTotal,...branchCurrents.map(b=>b.value),.001),baseLen=52;branchCurrents.forEach(b=>arrow(root,p[0],p[1],Math.max(17,b.value/maxI*baseLen),currentRef+b.angle,b.color,'',.4));}
    if(showComponentCurrents&&isDelta){const maxI=Math.max(lineData.value,lineData.forward.value,lineData.ret.value,.001),baseLen=54;arrow(root,p[0],p[1],Math.max(18,lineData.forward.value/maxI*baseLen),lineData.forward.angle,lineData.forward.color,'',.42);arrow(root,p[0],p[1],Math.max(18,lineData.ret.value/maxI*baseLen),lineData.ret.angle,lineData.ret.color,'',.42);}
    const len=showComponentCurrents?76:74,resultColor=CURRENT_COLOR,end=arrow(root,p[0],p[1],len,currentAngle,resultColor,'',.78),anchor=end.x<p[0]?'end':'start';
    text(root,end.x+(anchor==='end'?-10:10),end.y+(i===0?-8:18),showComponentCurrents?lineName:`${lineName} = ${da(shownValue,2)} A`,'vector-label',resultColor,anchor);
    const shownPhi=isDelta?normalizeAngle(currentAngle-ref):normalizeAngle(currentAngle-currentRef),phiReference=currentRef;if(Math.abs(shownPhi)>.2){const r=24,from={x:p[0]+r*Math.cos(rad(phiReference)),y:p[1]-r*Math.sin(rad(phiReference))},to={x:p[0]+r*Math.cos(rad(currentAngle)),y:p[1]-r*Math.sin(rad(currentAngle))},sweep=isDelta?(shownPhi>0?0:1):(shownPhi>0?1:0);root.append(svg('path',{d:`M ${from.x} ${from.y} A ${r} ${r} 0 0 ${sweep} ${to.x} ${to.y}`,class:'arc'}));text(root,p[0]+(i===1?36:-30),p[1]+(i===0?-18:20),`φ = ${da(shownPhi,1)}°`,'vector-label','#8c9aa3','middle');}
  });
  if(showComponentCurrents){
    const lx=500,ly=55,row=18,values=isDelta?[deltaLines[0].forward,deltaLines[0].ret,deltaLines[0]]:[...branchCurrents,{name:'Iₙ1',value:branchTotal,angle:branchPhi,color:CURRENT_COLOR}],displayAngle=b=>isDelta?normalizeAngle(b.angle-refs[0]):b.angle;root.append(svg('rect',{x:lx-14,y:ly-18,width:210,height:38+row*values.length,rx:8,fill:themeSurface(),stroke:'#263946','stroke-width':1}));text(root,lx,ly,isDelta?'Værdier i fase 1':'Værdier i én fase','parallel-state','#8f9da6');values.forEach((b,k)=>{const y=ly+24+k*row,c=b.color||CURRENT_COLOR;root.append(svg('circle',{cx:lx-8,cy:y-4,r:3,fill:c}));text(root,lx,y,`${b.name} ${da(b.value,2)} A ∠${da(displayAngle(b),1)}°`,'vector-label',c);});
  }
  text(root,640,365,showComponentCurrents?(isDelta?'Rød resultant er netstrømmen: Iₙ1 = I₁₂ − I₃₁.':'Rød resultant er netstrømmen Iₙ.'):connection==='D'?`Δ: rød vektor er netstrømmen Iₙ. Iₙ = √3 · I_z = ${da(In,2)} A`:`Y: Iₙ = I_z = ${da(In,2)} A`,'vector-label','#8f9da6','end');
}

function drawThreeLoadPhaseFocus(root,analysis){
  if(!root)return;clear(root);if(!analysis?.asym)return;
  const phase=clamp(threeLoadFocusPhase,1,3),phaseIndex=phase-1,phaseRefs=[90,-30,-150],phaseReferenceNames=['U₁₀','U₂₀','U₃₀'],phaseContribs=threeLoadPhaseContribs(analysis,phaseIndex),total=analysis.lines[phaseIndex],ref=phaseRefs[phaseIndex],referenceName=phaseReferenceNames[phaseIndex],focusOrigins=[{x:405,y:324},{x:405,y:130},{x:405,y:130}],cx=focusOrigins[phaseIndex].x,cy=focusOrigins[phaseIndex].y,W=900,H=410;
  drawAxisGrid(root,cx,cy,W,H);
  const node={x:cx,y:cy},bounds={minX:90,maxX:760,minY:52,maxY:366},maxLenForAngle=angle=>{
    const c=Math.cos(rad(angle)),s=-Math.sin(rad(angle)),limits=[];
    if(c>.001)limits.push((bounds.maxX-node.x)/c); if(c<-.001)limits.push((bounds.minX-node.x)/c);
    if(s>.001)limits.push((bounds.maxY-node.y)/s); if(s<-.001)limits.push((bounds.minY-node.y)/s);
    return Math.max(40,Math.min(...limits.filter(Number.isFinite)));
  };
  root.append(svg('circle',{cx:node.x,cy:node.y,r:3.2,fill:'#cfd8de'}));
  const refLength=Math.max(120,maxLenForAngle(ref)-8),refEnd={x:node.x+refLength*Math.cos(rad(ref)),y:node.y-refLength*Math.sin(rad(ref))},refAnchor=Math.cos(rad(ref))<-.2?'end':'start';
  root.append(svg('line',{x1:node.x,y1:node.y,x2:refEnd.x,y2:refEnd.y,stroke:VOLTAGE_COLOR,'stroke-width':2,'stroke-dasharray':'7 6','stroke-linecap':'round',opacity:.9}));
  text(root,refEnd.x+(refAnchor==='end'?-12:12),refEnd.y-8,referenceName,'vector-label',VOLTAGE_COLOR,refAnchor);
  const visible=[...phaseContribs,total].filter(Boolean),maxI=Math.max(...visible.map(v=>v.value),.001),fitScale=Math.min(315/maxI,...visible.map(v=>(maxLenForAngle(v.angle)-18)/(Math.max(v.value,.001)*(v===total?1:.92)))),scale=Math.max(.8,fitScale);
  const localPhi=b=>Number.isFinite(b.localAngle)?b.localAngle:normalizeAngle(b.angle-ref),localAngle=b=>ref+localPhi(b);
  const drawFocusVector=(v,k,color,isTotal=false)=>{
    const angle=localAngle(v),dirMax=maxLenForAngle(angle)-12,target=v.value*scale*(isTotal?1:.92),len=Math.min(dirMax,Math.max(isTotal?82:54,target)),end=arrow(root,node.x,node.y,len,angle,color,'',isTotal?1.08:.78);
    return {end,angle};
  };
  phaseContribs.forEach((part,k)=>drawFocusVector(part,k,part.color,false));
  let focusPhi=0;
  if(total){
    const totalDraw=drawFocusVector(total,0,CURRENT_COLOR,true),phi=localPhi(total),angle=totalDraw.angle;
    focusPhi=phi;
    if(Math.abs(phi)>.2){const r=35,from={x:node.x+r*Math.cos(rad(ref)),y:node.y-r*Math.sin(rad(ref))},to={x:node.x+r*Math.cos(rad(angle)),y:node.y-r*Math.sin(rad(angle))},sweep=phi<0?1:0;root.append(svg('path',{d:`M ${from.x} ${from.y} A ${r} ${r} 0 0 ${sweep} ${to.x} ${to.y}`,class:'arc'}));}
  }
  const phiLabelPositions=[
    {x:node.x-22,y:node.y+32,anchor:'end'},
    {x:node.x-22,y:node.y-28,anchor:'end'},
    {x:node.x+22,y:node.y-28,anchor:'start'}
  ],phiPos=phiLabelPositions[phaseIndex]||phiLabelPositions[0];
  text(root,phiPos.x,phiPos.y,`φ = ${da(focusPhi,1)}°`,'vector-label','#8f9da6',phiPos.anchor);
  const values=visible,lx=626,ly=66,row=24;root.append(svg('rect',{x:lx-16,y:ly-20,width:300,height:66+row*values.length,rx:8,fill:themeSurface(),stroke:'#263946','stroke-width':1}));text(root,lx,ly,`Værdier for fase ${phase}`,'parallel-state','#8f9da6');text(root,lx,ly+20,`Vinkler målt fra ${referenceName}`,'parallel-state',VOLTAGE_COLOR);
  values.forEach((b,k)=>{const y=ly+52+k*row,angle=localPhi(b),c=b.name.includes('.')?b.color:CURRENT_COLOR;root.append(svg('circle',{cx:lx-8,cy:y-4,r:3,fill:c}));text(root,lx,y,`${b.name} ${da(b.value,2)} A ∠${da(angle,1)}°`,'vector-label',c);});
  $('threeLoadFocusTitle').textContent=`Fase ${phase}: zoom på strømvektorer`;
  $('threeLoadFocusNote').textContent=`Lokal reference: ${referenceName}. Alle viste vinkler er målt fra den valgte fases spænding.`;
}

function drawThreeLoadCircuit(parts,connection,R,X,Z,If,In,analysis=null){
  const root=$('threeLoadCircuit');clear(root);
  $('threeLoadCircuitTitle').textContent=analysis?.asym?'Usymmetrisk belastning':(connection==='Y'?'Symmetrisk stjernebelastning':'Symmetrisk trekantbelastning');
  $('threeLoadCircuitNote').textContent=analysis?.asym?`${threeLoadComponentCount} belastningsgruppe${threeLoadComponentCount===1?'':'r'} med tre individuelle Z/φ-værdier. Hver gruppe kan være Y eller Δ.`:`${parts.length} belastningsgruppe${parts.length===1?'':'r'} pr. fase (maks. 5 for læsbarhed). Hver gruppe svarer til komponenterne i fasegrenen; Zf = ${da(Z,1)} Ω.`;
  root.append(svg('rect',{x:14,y:10,width:1392,height:248,rx:10,class:'overview-board'}));
  const ys=[42,76,110,144],lineNames=['L1','L2','L3','N'],end=1384,groupStep=parts.length>1?clamp(1085/(parts.length-1),112,360):0,groupStart=parts.length===1?610:165;
  lineNames.forEach((label,i)=>{circuitText(root,50,ys[i]+5,label,'overview-label','middle');root.append(svg('line',{x1:78,y1:ys[i],x2:i===3&&connection==='D'?155:end,y2:ys[i],class:'overview-wire'}));});
  ['Iₙ₁','Iₙ₂','Iₙ₃'].forEach((label,i)=>circuitArrow(root,96,ys[i],52,0,`${label} = ${da(analysis?.lines?.[i]?.value??In,2)} A`,CURRENT_COLOR));
  if(connection==='Y'||(connection==='M'&&analysis?.groups?.some(g=>g.connection==='Y')))circuitArrow(root,96,ys[3],52,0,analysis?.neutral?`I₀ = ${da(analysis.neutral.value,2)} A`:'I₀',CURRENT_COLOR);
  const loadSymbol=(part,x,y)=>{drawCompactCircuitComponent(root,part.type,x,y,0);circuitText(root,x,y+25,componentSymbol(part.type,part.index),'overview-label tiny-label','middle');};
  const branchArrow=(x,y,len,label)=>{circuitArrow(root,x,y,len,-90,'',CURRENT_COLOR);circuitText(root,x+12,y-2,label,'circuit-current','start',CURRENT_COLOR);};
  const impedanceSeries=(branch,x1,x2,y,sub)=>{
    const components=branch.components?.length?branch.components:[branch],count=components.length,step=(x2-x1)/(count+1);
    components.forEach((component,k)=>{const x=x1+step*(k+1),label=component.components?component.label:`Z${subscriptNumber(component.component||k+1)}${subscriptNumber(sub)}`;drawCompactCircuitComponent(root,'Z',x,y,0);circuitText(root,x,y+25,label,'overview-label tiny-label','middle');});
  };
  if(analysis?.asym){
    analysis.groups.forEach((group,idx)=>{
      const base=groupStart+idx*groupStep,loadY=221;
      if(group.connection==='Y'){
        const taps=[base,base+40,base+80];
        taps.forEach((tap,i)=>{const neutralTap=tap+36,branch=group.branches[i];if(!branch.active)return;root.append(svg('circle',{cx:tap,cy:ys[i],r:2.8,class:'circuit-node'}));root.append(svg('circle',{cx:neutralTap,cy:ys[3],r:2.8,class:'circuit-node'}));root.append(svg('line',{x1:tap,y1:ys[i],x2:tap,y2:loadY,class:'overview-wire'}));root.append(svg('line',{x1:tap,y1:loadY,x2:neutralTap,y2:loadY,class:'overview-wire'}));root.append(svg('line',{x1:neutralTap,y1:loadY,x2:neutralTap,y2:ys[3],class:'overview-wire'}));branchArrow(tap,ys[i]+12,30,branch.currentName);drawCompactCircuitComponent(root,'Z',(tap+neutralTap)/2,loadY,0);circuitText(root,(tap+neutralTap)/2,loadY+25,branch.label,'overview-label tiny-label','middle');});
      }else{
        const branches=[{from:0,to:1,x1:base,x2:base+35,zi:0},{from:1,to:2,x1:base+46,x2:base+81,zi:1},{from:2,to:0,x1:base+92,x2:base+127,zi:2}];
        branches.forEach(b=>{const branch=group.branches[b.zi];if(!branch.active)return;root.append(svg('circle',{cx:b.x1,cy:ys[b.from],r:2.8,class:'circuit-node'}));root.append(svg('circle',{cx:b.x2,cy:ys[b.to],r:2.8,class:'circuit-node'}));root.append(svg('line',{x1:b.x1,y1:ys[b.from],x2:b.x1,y2:loadY,class:'overview-wire'}));root.append(svg('line',{x1:b.x1,y1:loadY,x2:b.x2,y2:loadY,class:'overview-wire'}));branchArrow(b.x1,ys[b.from]+16,38,branch.currentName);drawCompactCircuitComponent(root,'Z',(b.x1+b.x2)/2,loadY,0);circuitText(root,(b.x1+b.x2)/2,loadY+25,branch.label,'overview-label tiny-label','middle');root.append(svg('line',{x1:b.x2,y1:loadY,x2:b.x2,y2:ys[b.to],class:'overview-wire'}));});
      }
    });
    return;
  }
  if(connection==='Y'){
    parts.forEach((part,idx)=>{
      const base=groupStart+idx*groupStep,loadY=221,taps=[base,base+40,base+80],labels=['I₁₀','I₂₀','I₃₀'];
      taps.forEach((tap,i)=>{const neutralTap=tap+36;root.append(svg('circle',{cx:tap,cy:ys[i],r:2.8,class:'circuit-node'}));root.append(svg('circle',{cx:neutralTap,cy:ys[3],r:2.8,class:'circuit-node'}));root.append(svg('line',{x1:tap,y1:ys[i],x2:tap,y2:loadY,class:'overview-wire'}));root.append(svg('line',{x1:tap,y1:loadY,x2:neutralTap,y2:loadY,class:'overview-wire'}));root.append(svg('line',{x1:neutralTap,y1:loadY,x2:neutralTap,y2:ys[3],class:'overview-wire'}));branchArrow(tap,ys[i]+12,30,labels[i]);loadSymbol(part,(tap+neutralTap)/2,loadY);});
    });
  }else{
    parts.forEach((part,idx)=>{
      const base=groupStart+idx*groupStep,loadY=221,branches=[{from:0,to:1,x1:base,x2:base+35,label:'I₁₂'},{from:1,to:2,x1:base+46,x2:base+81,label:'I₂₃'},{from:2,to:0,x1:base+92,x2:base+127,label:'I₃₁'}];
      branches.forEach(b=>{root.append(svg('circle',{cx:b.x1,cy:ys[b.from],r:2.8,class:'circuit-node'}));root.append(svg('circle',{cx:b.x2,cy:ys[b.to],r:2.8,class:'circuit-node'}));root.append(svg('line',{x1:b.x1,y1:ys[b.from],x2:b.x1,y2:loadY,class:'overview-wire'}));root.append(svg('line',{x1:b.x1,y1:loadY,x2:b.x2,y2:loadY,class:'overview-wire'}));branchArrow(b.x1,ys[b.from]+16,38,b.label);loadSymbol(part,(b.x1+b.x2)/2,loadY);root.append(svg('line',{x1:b.x2,y1:loadY,x2:b.x2,y2:ys[b.to],class:'overview-wire'}));});
    });
  }
}

function drawComp(){
  const P=Math.max(0,num('compP'))*1000,U=Math.max(.1,num('compU')),f=Math.max(.1,num('compF')),c1=clamp(num('compCos1'),.05,1),c2=clamp(num('compCos2'),.05,1),p1=Math.acos(c1),p2=Math.acos(c2),valid=c2>=c1,Q1=P*Math.tan(p1),Q2=P*Math.tan(p2),Qc=Math.max(0,Q1-Q2),C=Qc/(3*2*Math.PI*f*U*U),I1=P/(Math.sqrt(3)*U*c1),I2=P/(Math.sqrt(3)*U*c2),Ic=Qc/(Math.sqrt(3)*U),S1=P/c1,S2=P/c2,Ip=P/(Math.sqrt(3)*U),Iq1=Q1/(Math.sqrt(3)*U),Iq2=Q2/(Math.sqrt(3)*U);
  $('compQc').textContent=valid?power(Qc,true):'Kontrollér cos φ';$('compCdelta').textContent=valid?unit(C*1e6,'µF',1):'—';$('compBankI').textContent=valid?unit(Ic,'A',2):'—';$('compI1').textContent=unit(I1,'A',2);$('compI2').textContent=unit(I2,'A',2);$('compSaving').textContent=valid?`${da((1-I2/I1)*100,1)} % lavere netstrøm`:'Målet skal være højere';$('compQ1').textContent=power(Q1,true);$('compQ2').textContent=power(Q2,true);$('compS1').textContent=S1>=1000?unit(S1/1000,'kVA',2):unit(S1,'VA');$('compS2').textContent=S2>=1000?unit(S2/1000,'kVA',2):unit(S2,'VA');$('compPhi1').textContent=`φ₁ = ${da(deg(p1),1)}°`;$('compPhi2').textContent=`φ₂ = ${da(deg(p2),1)}°`;$('compFlowPill').textContent=valid?`Iᴄ ${da(Ic,2)} A`:'Kontrollér cos φ';$('compWarning').innerHTML=!valid?'<strong>Bemærk:</strong> Ønsket cos φ₂ skal være større end cos φ₁.':`<strong>Resultat:</strong> Kondensatorstrømmen ${da(Ic,2)} A reducerer netstrømmen fra ${da(I1,2)} A til ${da(I2,2)} A.`;
  const root=$('compDiagram');clear(root);baseGrid(root,70,250,480,220);const scale=Math.min(P>0?330/P:Infinity,Q1>0?180/Q1:Infinity),s=Number.isFinite(scale)?scale:1,px=70+P*s,q1y=250-Q1*s,q2y=250-Q2*s;line(root,70,250,px,250,'vector','#596873');line(root,px,250,px,q1y,'vector','#667581');line(root,70,250,px,q1y,'vector','#667581');line(root,px,250,px,q2y,'vector','#35d3e3');line(root,70,250,px,q2y,'vector','#35d3e3');text(root,(70+px)/2,270,`P ${power(P)}`,'vector-label','#8b98a2','middle');text(root,px+8,(250+q1y)/2,`Q₁`,'vector-label','#667581');text(root,px+8,(250+q2y)/2+5,`Q₂`,'vector-label','#35d3e3');text(root,(70+px)/2-12,(250+q1y)/2-9,'S₁','vector-label','#667581','middle');text(root,(70+px)/2+8,(250+q2y)/2+15,'S₂','vector-label','#35d3e3','middle');
  drawCompCurrentPhasor(Ip,Iq1,valid?Iq2:Iq1,I1,valid?I2:I1,Ic);drawCompCurrentFlow(I1,I2,Ic,U,valid);
}

function drawCompCurrentPhasor(Ip,Iq1,Iq2,I1,I2,Ic){
  const root=$('compCurrentPhasor'),cx=120,cy=235,maxQ=Math.max(Iq1,Iq2,Ic,.001),scale=Math.min(Ip>0?145/Ip:Infinity,245/maxQ),s=Number.isFinite(scale)?scale:1,tip1={x:cx+Iq1*s,y:cy-Ip*s},tip2={x:cx+Iq2*s,y:cy-Ip*s};clear(root);baseGrid(root,cx,cy,480,240);arrow(root,cx,cy,165,90,VOLTAGE_COLOR,'U som reference',.72);const a1=deg(Math.atan2(Ip,Iq1||.000001)),a2=deg(Math.atan2(Ip,Iq2||.000001));arrow(root,cx,cy,I1*s,a1,'#8a5a62','',.75);text(root,tip1.x+14,tip1.y-12,'I₁','vector-label','#b37a83');arrow(root,cx,cy,I2*s,a2,CURRENT_COLOR,'',.8);text(root,tip2.x-10,tip2.y+22,'I₂','vector-label',CURRENT_COLOR,'end');if(Ic>.001){arrow(root,tip1.x,tip1.y,Ic*s,180,'#55d6a1','',.7);text(root,(tip1.x+tip2.x)/2,tip1.y-14,'Iᴄ','vector-label','#55d6a1','middle');}line(root,cx,tip1.y,tip1.x,tip1.y,'guide');text(root,465,283,'I₂ = I₁ + Iᴄ','vector-label','#778690','end');
}

function drawCompCurrentFlow(Ibefore,Iafter,Ic,U,valid){
  const root=$('compCurrentFlow'),afterText=valid?unit(Iafter,'A',2):'—',beforeText=unit(Ibefore,'A',2),icText=valid?unit(Ic,'A',2):'—';clear(root);
  root.append(svg('rect',{x:45,y:76,width:100,height:62,rx:9,class:'circuit-component'}));text(root,95,101,'FORSYNING','vector-label','#8c9aa3','middle');text(root,95,121,`Uₙ = ${da(U,0)} V`,'vector-label',VOLTAGE_COLOR,'middle');
  circuitWire(root,145,107,755,107,'#71808a');root.append(svg('rect',{x:755,y:65,width:110,height:84,rx:9,class:'circuit-component'}));text(root,810,91,'BELASTNING','vector-label','#d3dde1','middle');text(root,810,116,'før komp.','vector-label','#70808b','middle');
  circuitArrow(root,195,107,130,0,'Iₙ efter',CURRENT_COLOR);text(root,260,88,afterText,'vector-label',CURRENT_COLOR,'middle');
  circuitArrow(root,575,107,130,0,'I belastning','#b37a83');text(root,640,88,beforeText,'vector-label','#b37a83','middle');
  circuitNode(root,505,107);circuitWire(root,505,107,505,214,'#55d6a1');circuitWire(root,505,122,505,160,'#55d6a1');root.append(svg('polygon',{points:'505,160 501,152 509,152',fill:'#55d6a1'}));text(root,505,134,'Iᴄ','vector-label','#55d6a1','middle');text(root,522,151,icText,'vector-label','#55d6a1','start');
  circuitCapacitor(root,505,196,90);text(root,548,193,'KONDENSATORBATTERI','vector-label','#55d6a1');text(root,548,213,valid?'Kapacitiv grenstrøm':'Kontrollér inddata','vector-label','#81909a');
  root.append(svg('rect',{x:333,y:172,width:128,height:62,rx:8,fill:themeSurface(),stroke:'#263946','stroke-width':1}));
  text(root,349,194,`Iₙ før = ${beforeText}`,'vector-label','#b37a83','start');
  text(root,349,211,`Iₙ efter = ${afterText}`,'vector-label',CURRENT_COLOR,'start');
  text(root,349,228,`Iᴄ = ${icText}`,'vector-label','#55d6a1','start');
}

function drawConnections(){
  const U=Math.max(0,num('connU2')),Z=Math.max(.0001,num('connZ2')),c=clamp(num('connCos2'),0,1),sinPhi=Math.sqrt(Math.max(0,1-c*c));
  const UfY=U/Math.sqrt(3),UfD=U,IfY=UfY/Z,IfD=UfD/Z,InY=IfY,InD=Math.sqrt(3)*IfD;
  const SY=Math.sqrt(3)*U*InY,SD=Math.sqrt(3)*U*InD,PY=SY*c,PD=SD*c,QY=SY*sinPhi,QD=SD*sinPhi;
  const values={starPhaseU2:unit(UfY,'V'),deltaPhaseU2:unit(UfD,'V'),connUnY:unit(U,'V'),connUnD:unit(U,'V'),connUfY:unit(UfY,'V'),connUfD:unit(UfD,'V'),connIfY:unit(IfY,'A',2),connIfD:unit(IfD,'A',2),connInY:unit(InY,'A',2),connInD:unit(InD,'A',2),connPY:power(PY),connPD:power(PD),connQY:power(QY,true),connQD:power(QD,true),connSY:unit(SY>=1000?SY/1000:SY,SY>=1000?'kVA':'VA',2),connSD:unit(SD>=1000?SD/1000:SD,SD>=1000?'kVA':'VA',2)};
  Object.entries(values).forEach(([id,value])=>{if($(id))$(id).textContent=value;});
  drawConnectionSvg($('starDiagram2'),'Y');drawConnectionSvg($('deltaDiagram2'),'D');
}
function drawConnectionSvg(root,type){clear(root);const colors=[VOLTAGE_COLOR,'#8fb7ff','#9b87f5'];if(type==='Y'){const pts=[[110,28],[35,172],[185,172]],center=[110,120];pts.forEach((p,i)=>{line(root,p[0],p[1],center[0],center[1],'vector',colors[i]);root.append(svg('circle',{cx:p[0],cy:p[1],r:5,fill:colors[i]}));text(root,p[0],p[1]+(i?22:-12),`L${i+1}`,'vector-label',colors[i],'middle');});root.append(svg('circle',{cx:center[0],cy:center[1],r:6,fill:'#cbd7dc'}));text(root,center[0]+12,center[1]+4,'N','vector-label','#8b99a3');}else{const pts=[[110,28],[35,172],[185,172]];pts.forEach((p,i)=>{const q=pts[(i+1)%3];line(root,p[0],p[1],q[0],q[1],'vector',colors[i]);root.append(svg('circle',{cx:p[0],cy:p[1],r:5,fill:colors[i]}));text(root,p[0],p[1]+(i?22:-12),`L${i+1}`,'vector-label',colors[i],'middle');});}}

function parallelBetween(a,b){return a+b? a*b/(a+b):0;}
function drawTransformation(){
  const input=[Math.max(.000001,num('trR1')),Math.max(.000001,num('trR2')),Math.max(.000001,num('trR3'))];let output,sourceLabels,targetLabels,sourceType,targetType;
  if(transformDirection==='delta-star'){
    const [r12,r23,r31]=input,sum=r12+r23+r31;output=[r12*r31/sum,r23*r12/sum,r31*r23/sum];sourceLabels=['R₁₂','R₂₃','R₃₁'];targetLabels=['R₁₀','R₂₀','R₃₀'];sourceType='D';targetType='Y';
  }else{
    const [r10,r20,r30]=input,n=r10*r20+r20*r30+r30*r10;output=[n/r30,n/r10,n/r20];sourceLabels=['R₁₀','R₂₀','R₃₀'];targetLabels=['R₁₂','R₂₃','R₃₁'];sourceType='Y';targetType='D';
  }
  const inputEq=transformDirection==='delta-star'?parallelBetween(input[0],input[1]+input[2]):input[0]+input[1];
  const outputEq=transformDirection==='delta-star'?output[0]+output[1]:parallelBetween(output[0],output[1]+output[2]);
  const difference=Math.abs(inputEq-outputEq),ok=difference<Math.max(.0001,inputEq*.000001);
  ['trOut1','trOut2','trOut3'].forEach((id,i)=>$(id).textContent=unit(output[i],'Ω',3));
  ['trOutLabel1','trOutLabel2','trOutLabel3'].forEach((id,i)=>$(id).textContent=targetLabels[i]);
  ['trLabel1','trLabel2','trLabel3'].forEach((id,i)=>$(id).innerHTML=`${sourceLabels[i]} <em>Ω</em>`);
  $('trEquivalent').textContent=unit(outputEq,'Ω',3);$('transformCheck').textContent=`${unit(inputEq,'Ω',3)} = ${unit(outputEq,'Ω',3)}`;
  $('transformCheckPill').textContent=ok?'ÆKVIVALENT':'KONTROLLÉR';$('transformCheckPill').classList.toggle('transform-check-ok',ok);$('transformCheckPill').classList.toggle('transform-check-bad',!ok);
  $('transformDiagramTitle').textContent=transformDirection==='delta-star'?'Trekant til stjerne':'Stjerne til trekant';
  $('transformHint').innerHTML=transformDirection==='delta-star'?'Hver Y-modstand er produktet af de to Δ-modstande, der mødes ved klemmen, divideret med summen af alle tre.':'Hver Δ-modstand er summen af de tre parvise produkter divideret med den modstående Y-modstand.';
  drawSymmetricTransformation();
  drawTransformationDiagram(sourceType,targetType,input,output,sourceLabels,targetLabels);
}
function drawSymmetricTransformation(){
  const value=Math.max(0,num('trSymY'));
  const starToDelta=transformSymDirection==='star-delta';
  $('trSymInputLabel').innerHTML=starToDelta?'Stjernemodstand R<sub>Y</sub> <em>Ω</em>':'Trekantmodstand R<sub>Δ</sub> <em>Ω</em>';
  $('trSymEquation').innerHTML=starToDelta?'R<sub>Δ</sub> = 3 · R<sub>Y</sub>':'R<sub>Y</sub> = R<sub>Δ</sub> / 3';
  $('trSymDelta').textContent=unit(starToDelta?value*3:value/3,'Ω',2);
  $('trSymHelp').innerHTML=starToDelta?'Samme symmetriske belastning i trekant skal have tre gange så stor modstand.':'Samme symmetriske belastning i stjerne skal have en tredjedel af trekantmodstanden.';
}
function drawTransformationDiagram(rootType,targetType,sourceValues,targetValues,sourceLabels,targetLabels){
  const root=$('transformationDiagram');clear(root);
  root.append(svg('rect',{x:22,y:18,width:856,height:292,rx:14,fill:'#0f1820',stroke:'#263743'}));
  drawTransformNetwork(root,235,165,rootType,sourceValues,sourceLabels);drawTransformNetwork(root,665,165,targetType,targetValues,targetLabels);
  arrow(root,402,166,96,0,'#55d6a1',transformDirection==='delta-star'?'Δ → Y':'Y → Δ',.72);
  text(root,235,42,transformDirection==='delta-star'?'INDDATA: TREKANT':'INDDATA: STJERNE','vector-label','#8fa0aa','middle');text(root,665,42,transformDirection==='delta-star'?'RESULTAT: STJERNE':'RESULTAT: TREKANT','vector-label',VOLTAGE_COLOR,'middle');
}
function drawTransformNetwork(root,cx,cy,type,values,labels){
  const wire='#c7d2d8',box='#edf4f7',labelColor='#dbe5e9',muted='#8fa0aa';
  const resistor=(a,b,label,value,normal=1)=>{const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,angle=deg(Math.atan2(b[1]-a[1],b[0]-a[0])),length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/length,ny=(b[0]-a[0])/length;line(root,a[0],a[1],b[0],b[1],'vector',wire);const g=svg('g',{transform:`translate(${mx} ${my}) rotate(${angle})`});g.append(svg('rect',{x:-22,y:-9,width:44,height:18,rx:2,fill:'#0f1820',stroke:box,'stroke-width':2}));root.append(g);text(root,mx+nx*25*normal,my+ny*25*normal+4,label,'vector-label',labelColor,'middle');};
  const top=[cx,76],left=[cx-92,232],right=[cx+92,232],center=[cx,166];
  if(type==='D'){
    resistor(top,right,labels[0],values[0],-1);resistor(right,left,labels[1],values[1],-1);resistor(left,top,labels[2],values[2],-1);
    line(root,top[0],top[1],top[0],52,'vector',wire);line(root,left[0],left[1],left[0]-34,left[1]+24,'vector',wire);line(root,right[0],right[1],right[0]+34,right[1]+24,'vector',wire);
  }else{
    resistor(center,top,labels[0],values[0],-1);resistor(center,right,labels[1],values[1],-1);resistor(center,left,labels[2],values[2],-1);
    line(root,top[0],top[1],top[0],52,'vector',wire);line(root,left[0],left[1],left[0]-34,left[1]+24,'vector',wire);line(root,right[0],right[1],right[0]+34,right[1]+24,'vector',wire);root.append(svg('circle',{cx:center[0],cy:center[1],r:5,fill:box}));text(root,center[0]+11,center[1]+5,'0','vector-label',muted);
  }
  [[top[0],48,'1'],[left[0]-40,left[1]+30,'3'],[right[0]+40,right[1]+30,'2']].forEach(([x,y,n])=>text(root,x,y,n,'vector-label',VOLTAGE_COLOR,'middle'));
}

const targetConfigs={U:[['I','Strøm I','A',10],['R','Resistans R','Ω',23]],I:[['U','Spænding U','V',230],['R','Resistans R','Ω',23]],R:[['U','Spænding U','V',230],['I','Strøm I','A',10]]};
const ohmPowerConfigs={
  simple:{title:'P = U · I',formula:'P = U · I',fields:[['U','Spænding U','V',230],['I','Strøm I','A',10]],calc:v=>v.U*v.I,tip:'Ren resistiv/jævnstrøms-beregning uden faseforskydning.'},
  cos:{title:'1-faset: cosφ',formula:'P = U · I · cos φ',fields:[['U','Spænding U','V',230],['I','Strøm I','A',10],['Cos','Effektfaktor cos φ','',0.80]],calc:v=>v.U*v.I*clamp(v.Cos,-1,1),tip:'Bruges ved 1-faset vekselstrøm, når strøm og spænding ikke er i fase.'},
  three:{title:'3-faset: √3',formula:'P = √3 · Uₙ · Iₙ · cos φ',fields:[['U','Netspænding Uₙ','V',400],['I','Netstrøm Iₙ','A',16],['Cos','Effektfaktor cos φ','',0.80]],calc:v=>Math.sqrt(3)*v.U*v.I*clamp(v.Cos,-1,1),tip:'Bruges ved symmetrisk 3-faset belastning med netspænding og netstrøm.'}
};
const ohmValue=(id,fallback=0)=>{const value=Number($(id)?.value);return Number.isFinite(value)?value:fallback;};
function renderOhmInputs(){
  const root=$('ohmInputs');root.innerHTML='';
  if(ohmTarget==='P'){
    const selector=document.createElement('div');selector.className='segmented three field-wide ohm-power-selector';selector.id='ohmPowerMode';
    selector.innerHTML=Object.entries(ohmPowerConfigs).map(([key,cfg])=>`<button class="${key===ohmPowerMode?'active':''}" data-power-formula="${key}">${cfg.title}</button>`).join('');
    root.append(selector);
    $$('#ohmPowerMode button',root).forEach(b=>b.addEventListener('click',()=>{ohmPowerMode=b.dataset.powerFormula;renderOhmInputs();}));
  }
  const fields=ohmTarget==='P'?ohmPowerConfigs[ohmPowerMode].fields:targetConfigs[ohmTarget];
  fields.forEach(([key,label,u,v])=>{const l=document.createElement('label');if(fields.length===3&&key==='Cos')l.className='field-wide';l.innerHTML=`<span>${label} <em>${u}</em></span><input id="ohm${key}" type="number" value="${v}" min="${key==='Cos'?-1:0}" max="${key==='Cos'?1:''}" step="${key==='Cos'?0.01:0.1}">`;root.append(l);});
  $$('input',root).forEach(i=>i.addEventListener('input',drawOhm));drawOhm();
}
function drawOhm(){
  let r=0,formula='',u='',tip='Klik på U, I, R eller P i vælgeren';
  if(ohmTarget==='U'){const I=ohmValue('ohmI'),R=ohmValue('ohmR');r=I*R;u='V';formula='U = I · R';}
  if(ohmTarget==='I'){const U=ohmValue('ohmU'),R=ohmValue('ohmR');r=R?U/R:0;u='A';formula='I = U / R';}
  if(ohmTarget==='R'){const U=ohmValue('ohmU'),I=ohmValue('ohmI');r=I?U/I:0;u='Ω';formula='R = U / I';}
  if(ohmTarget==='P'){const cfg=ohmPowerConfigs[ohmPowerMode],values={U:ohmValue('ohmU'),I:ohmValue('ohmI'),Cos:ohmValue('ohmCos',1)};r=cfg.calc(values);u='W';formula=cfg.formula;tip=cfg.tip;}
  $('ohmResult').textContent=u==='W'?power(r):unit(r,u,2);$('ohmUsedFormula').textContent=formula;const root=$('ohmWheel');clear(root);const items=[['U',260,55],['I',130,220],['R',390,220],['P',260,245]];line(root,260,70,145,205,'guide');line(root,260,70,375,205,'guide');line(root,145,220,375,220,'guide');items.forEach(([k,x,y])=>{const active=k===ohmTarget;root.append(svg('circle',{cx:x,cy:y,r:active?40:32,fill:active?'#17333b':'#121d25',stroke:active?'#35d3e3':'#344550','stroke-width':active?2:1}));text(root,x,y+6,k,'vector-label',active?'#35d3e3':'#94a2ac','middle');});text(root,260,135,formula,'vector-label','#c5d2d8','middle');text(root,260,155,tip,'vector-label','#596873','middle');
}

function recolorArrowGroup(group,color){if(!group)return;const vector=group.querySelector('line.vector');const head=group.querySelector('polygon');const label=group.querySelector('text');if(vector)vector.setAttribute('stroke',color);if(head)head.setAttribute('fill',color);if(label)label.setAttribute('fill',color);}
function applyElectricalColorConvention(){
  const parallelGroups=$$('#parallelPhasor > g');recolorArrowGroup(parallelGroups[0],VOLTAGE_COLOR);recolorArrowGroup(parallelGroups.at(-1),CURRENT_COLOR);
  const compGroups=$$('#compCurrentPhasor > g');recolorArrowGroup(compGroups[0],VOLTAGE_COLOR);recolorArrowGroup(compGroups[1],'#a84f59');recolorArrowGroup(compGroups[2],CURRENT_COLOR);
  const powerPaths=$$('#powerWave path');if(powerPaths[1])powerPaths[1].setAttribute('stroke',VOLTAGE_COLOR);if(powerPaths[2])powerPaths[2].setAttribute('stroke',CURRENT_COLOR);$$('#powerWave text').forEach(label=>{if(label.textContent==='u(t)')label.setAttribute('fill',VOLTAGE_COLOR);if(label.textContent==='i(t)')label.setAttribute('fill',CURRENT_COLOR);});
  ['threePhasor','threeLoadPhasor'].forEach(id=>$$( `#${id} > g`).forEach((group,index)=>{const label=group.querySelector('text')?.textContent||'';if(label.startsWith('U'))recolorArrowGroup(group,index%3===0?VOLTAGE_COLOR:index%3===1?'#8fb7ff':'#9b87f5');if(label.startsWith('I'))recolorArrowGroup(group,label.includes('ⁿ')||label.includes('ₙ')?CURRENT_COLOR:index%3===0?CURRENT_COLOR:index%3===1?'#ff8a70':'#d94f8a');}));
  $$('.circuit-current').forEach(label=>{label.setAttribute('fill',CURRENT_COLOR);const head=label.previousElementSibling,shaft=head?.previousElementSibling;if(head?.tagName==='polygon')head.setAttribute('fill',CURRENT_COLOR);if(shaft?.tagName==='line')shaft.setAttribute('stroke',CURRENT_COLOR);});
}

let activeDiagram=null,lastExpandButton=null;
function installDiagramExpanders(){
  $$('svg.diagram, svg[data-expandable-diagram]').forEach(diagram=>{const card=diagram.closest('.card');if(!card||card.querySelector('.diagram-expand'))return;card.classList.add('diagram-host');const button=document.createElement('button');button.className='diagram-expand';button.type='button';button.textContent='⛶';button.title='Forstør diagram';button.setAttribute('aria-label','Forstør diagram');button.addEventListener('click',()=>openDiagramModal(diagram,button));card.append(button);});
}
function openDiagramModal(diagram,button){
  activeDiagram=diagram;lastExpandButton=button;const clone=diagram.cloneNode(true);clone.removeAttribute('id');$('diagramModalCanvas').replaceChildren(clone);const page=diagram.closest('.page'),card=diagram.closest('.card'),heading=card?.querySelector('h3')?.textContent||'Diagram';$('diagramModalTitle').textContent=`${page?.dataset.title||'VektorLab'} | ${heading}`;$('diagramModal').hidden=false;document.body.classList.add('modal-open');$('closeDiagram').focus();
}
function closeDiagramModal(){if($('diagramModal').hidden)return;$('diagramModal').hidden=true;$('diagramModalCanvas').replaceChildren();document.body.classList.remove('modal-open');activeDiagram=null;lastExpandButton?.focus();}
function exportableSvg(source){
  const copy=source.cloneNode(true),sourceNodes=[source,...source.querySelectorAll('*')],copyNodes=[copy,...copy.querySelectorAll('*')],properties=['fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','font-family','font-size','font-weight'];sourceNodes.forEach((node,i)=>{const styles=getComputedStyle(node);properties.forEach(prop=>copyNodes[i].style.setProperty(prop,styles.getPropertyValue(prop)));});const viewBox=source.viewBox.baseVal,w=1600,h=Math.round(w*(viewBox.height/viewBox.width));copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',w);copy.setAttribute('height',h);const background=svg('rect',{x:viewBox.x,y:viewBox.y,width:viewBox.width,height:viewBox.height,fill:themeSurface()});copy.insertBefore(background,copy.firstChild);return {copy,w,h};
}
function downloadActiveDiagram(){
  if(!activeDiagram)return;const {copy,w,h}=exportableSvg(activeDiagram),data=new XMLSerializer().serializeToString(copy),blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const context=canvas.getContext('2d');context.fillStyle=themeSurface();context.fillRect(0,0,w,h);context.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);canvas.toBlob(png=>{const link=document.createElement('a'),page=activeDiagram.closest('.page')?.dataset.title||'diagram';link.href=URL.createObjectURL(png);link.download=`VektorLab-${page.toLowerCase().replace(/[^a-z0-9æøå]+/gi,'-')}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);},'image/png');};img.src=url;
}
$('closeDiagram').addEventListener('click',closeDiagramModal);$('downloadDiagram').addEventListener('click',downloadActiveDiagram);$('diagramModal').addEventListener('click',e=>{if(e.target===$('diagramModal'))closeDiagramModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('diagramModal').hidden)closeDiagramModal();});

function syncInputModeUI(){
  $$('#seriesInputMode button').forEach(b=>b.classList.toggle('active',b.dataset.seriesMode===seriesInputMode));const directCurrents=parallelInputMode==='currents';$('parFrequencyField').hidden=directCurrents;$('parVoltageField').classList.toggle('field-wide',directCurrents);$('parallelCurrentFields').hidden=!directCurrents;$$('#parallelInputMode button').forEach(b=>b.classList.toggle('active',b.dataset.parallelMode===parallelInputMode));syncComponentBuilders();syncThreeLoadBuilder();
  $$('#seriesVoltageMode button').forEach(b=>b.classList.toggle('active',b.dataset.seriesVoltage===seriesVoltageMode));$$('#seriesImpedanceMode button').forEach(b=>b.classList.toggle('active',b.dataset.seriesImpedance===seriesImpedanceMode));$$('#parallelVectorMode button').forEach(b=>b.classList.toggle('active',b.dataset.parallelVector===parallelVectorMode));
}
function componentUnit(type,mode){if(type==='R'||type==='Z')return 'Ω';if(mode==='reactance')return type==='L'?'Xₗ (Ω)':'X꜀ (Ω)';return type==='L'?'mH':'µF';}
function syncComponentBuilders(){
  $('seriesComponentBuilder').classList.remove('current-entry-mode');for(let i=1;i<=MAX_COMPONENTS;i++){const active=i<=seriesComponentCount,type=$(`seriesCompType${i}`).value;$(`seriesComponentRow${i}`).hidden=!active;$(`seriesCompUnit${i}`).textContent=componentUnit(type,seriesInputMode);}$$('#seriesComponentCount button').forEach(b=>b.classList.toggle('active',Number(b.dataset.count)===seriesComponentCount));
  const direct=parallelInputMode==='currents';$('parallelComponentBuilder').classList.toggle('current-entry-mode',direct);for(let i=1;i<=MAX_COMPONENTS;i++){const active=i<=parallelComponentCount,type=$(`parallelCompType${i}`).value,name=currentSymbol(type,i);$(`parallelComponentRow${i}`).hidden=!active;$(`parallelCompUnit${i}`).textContent=componentUnit(type,parallelInputMode);$(`parCurrentLabel${i}`).innerHTML=`Strøm ${name} <em>A</em>`;$(`parAngleLabel${i}`).innerHTML=`Vinkel ${name} <em>°</em>`;$(`parCurrentRow${i}a`).hidden=!active;$(`parCurrentRow${i}b`).hidden=!active;}$$('#parallelComponentCount button').forEach(b=>b.classList.toggle('active',Number(b.dataset.count)===parallelComponentCount));
}
function renderThreeLoadImpedanceFields(){
  const box=$('threeLoadImpedanceFields');if(!box)return;
  const mixed=threeLoadConnection==='M',count=Math.min(threeLoadComponentCount,THREE_LOAD_MAX_COMPONENTS),mode=mixed?threeLoadAsymInputMode:'z',cfg=threeLoadAsymModeConfig(mode),remember={};
  for(let c=1;c<=THREE_LOAD_MAX_COMPONENTS;c++){
    remember[`conn${c}`]=$(`threeLoadGroupConn${c}`)?.value||'Y';
    for(let p=1;p<=3;p++){
      remember[`z${c}${p}`]=$(`threeLoadZc${c}p${p}`)?.value??cfg.firstDefault;
      remember[`phi${c}${p}`]=$(`threeLoadPhic${c}p${p}`)?.value??cfg.secondDefault;
      remember[`active${c}${p}`]=$(`threeLoadActivec${c}p${p}`)?.checked??true;
    }
  }
  const modeButtons=mixed?`<div class="segmented compact asym-input-mode" aria-label="Usymmetrisk indtastningstype">${Object.values(threeLoadAsymModeMap()).map(item=>`<button type="button" data-three-load-asym-mode="${item.key}" class="${item.key===mode?'active':''}">${item.title}</button>`).join('')}</div>`:'';
  const rows=Array.from({length:THREE_LOAD_MAX_COMPONENTS},(_,i)=>{
    const c=i+1,connection=mixed?remember[`conn${c}`]:threeLoadConnection,subs=connection==='Y'?['10','20','30']:['12','23','31'],names=connection==='Y'?['L1–N','L2–N','L3–N']:['L1–L2','L2–L3','L3–L1'],hidden=c>count?' hidden':'',connSelect=mixed?`<label class="impedance-phase-connection"><span>Kobling</span><select id="threeLoadGroupConn${c}" aria-label="Kobling for belastningsgruppe ${c}"><option value="Y"${connection==='Y'?' selected':''}>Y</option><option value="D"${connection==='D'?' selected':''}>Δ</option></select></label>`:'';
    const cells=[0,1,2].map(p=>{
      const rawPrimary=String(remember[`z${c}${p+1}`]),primary=rawPrimary.replace(/"/g,'&quot;'),secondary=String(remember[`phi${c}${p+1}`]||cfg.secondDefault).replace(/"/g,'&quot;'),sub=`${subscriptNumber(c)}${subscriptNumber(subs[p])}`,primaryNumber=Number(rawPrimary),checked=remember[`active${c}${p+1}`]&&rawPrimary.trim()!==''&&Number.isFinite(primaryNumber)&&primaryNumber>0?' checked':'',label=mixed?`${cfg.symbol}<sub>${sub}</sub> · ${names[p]}`:`Z<sub>${sub}</sub> · ${names[p]}`,firstAria=`${cfg.first} ${c}${subs[p]} ${cfg.firstUnit}`.trim(),secondAria=`${cfg.second} ${c}${subs[p]} ${cfg.secondUnit}`.trim();
      return `<div class="impedance-phase-cell"><div class="impedance-cell-head"><span>${label}</span><label class="impedance-enable"><input id="threeLoadActivec${c}p${p+1}" type="checkbox"${checked}> Til</label></div><label class="mini-input-label"><span>${cfg.first}</span><em>${cfg.firstUnit}</em></label><input id="threeLoadZc${c}p${p+1}" type="number" value="${primary}" min="${cfg.firstMin}" step="${cfg.firstStep}" placeholder="frakoblet" aria-label="${firstAria}"><label class="mini-input-label"><span>${cfg.second}</span><em>${cfg.secondUnit}</em></label><input id="threeLoadPhic${c}p${p+1}" type="number" value="${secondary}" min="${cfg.secondMin}" max="${cfg.secondMax}" step="${cfg.secondStep}" placeholder="${cfg.second}" aria-label="${secondAria}"></div>`;
    }).join('');
    return `<div class="impedance-phase-row${mixed?' mixed':''}"${hidden}><b>Gruppe ${c}</b>${connSelect}${cells}</div>`;
  }).join('');
  box.innerHTML=`<div class="component-builder-head"><span>${mixed?cfg.heading:'Impedans pr. belastningsgruppe'}</span><small>${mixed?cfg.help:'Usymmetrisk: slå enkelte grene fra med “Til” eller lad Z være tom/0. Hver gruppe kan være Y eller Δ.'}</small></div>${modeButtons}${rows}`;
  $$('[data-three-load-asym-mode]',box).forEach(btn=>btn.addEventListener('click',()=>{threeLoadAsymInputMode=btn.dataset.threeLoadAsymMode||'z';renderThreeLoadImpedanceFields();drawThreeLoad();}));
  $$('input',box).forEach(input=>{input.addEventListener('input',updateAll);input.addEventListener('change',updateAll);});$$('select',box).forEach(select=>select.addEventListener('change',()=>{renderThreeLoadImpedanceFields();drawThreeLoad();}));
}
function syncThreeLoadBuilder(){
  if(!$('threeLoadComponentBuilder'))return;
  threeLoadComponentCount=Math.min(threeLoadComponentCount,THREE_LOAD_MAX_COMPONENTS);
  const asymOnly=threeLoadConnection==='M';
  if(asymOnly){threeLoadInputMode='impedance';threeLoadVoltageType='line';}
  else if(threeLoadInputMode==='impedance')threeLoadInputMode='components';
  const impedanceMode=threeLoadInputMode==='impedance';
  if($('threeLoadCountLabel'))$('threeLoadCountLabel').textContent=asymOnly?'Antal usymmetriske belastningsgrupper':'Antal komponenter pr. fase';
  $('threeLoadComponentBuilder').hidden=false;$('threeLoadImpedanceFields').hidden=!impedanceMode;
  for(let i=1;i<=MAX_COMPONENTS;i++){const active=i<=threeLoadComponentCount&&i<=THREE_LOAD_MAX_COMPONENTS,type=$(`threeLoadCompType${i}`).value;$(`threeLoadComponentRow${i}`).hidden=impedanceMode||!active;$(`threeLoadCompUnit${i}`).textContent=componentUnit(type,threeLoadInputMode);}
  if(impedanceMode)renderThreeLoadImpedanceFields();
  $$('#threeLoadConnection button').forEach(b=>b.classList.toggle('active',b.dataset.loadConnection===threeLoadConnection));
  $$('#threeLoadVoltageType button').forEach(b=>{const allowed=!asymOnly||b.dataset.loadVoltage==='line';b.hidden=!allowed;b.classList.toggle('active',allowed&&b.dataset.loadVoltage===threeLoadVoltageType);});
  $$('#threeLoadComponentCount button').forEach(b=>b.classList.toggle('active',Number(b.dataset.count)===threeLoadComponentCount));
  $$('#threeLoadInputMode button').forEach(b=>{const mode=b.dataset.loadMode,allowed=asymOnly?mode==='impedance':mode!=='impedance';b.hidden=!allowed;b.classList.toggle('active',allowed&&mode===threeLoadInputMode);});
  $$('#threeLoadVectorMode button').forEach(b=>b.classList.toggle('active',b.dataset.threeLoadVector===threeLoadVectorMode));
}
function convertComponentValue(type,value,fromMode,toMode,omega){if(type==='R'||type==='Z'||fromMode===toMode||fromMode==='impedance'||toMode==='impedance')return value;if(fromMode==='components'&&toMode==='reactance')return type==='L'?omega*value/1000:1/(omega*Math.max(value,.000000001)*1e-6);if(fromMode==='reactance'&&toMode==='components')return type==='L'?value/omega*1000:1/(omega*Math.max(value,.000000001))*1e6;return value;}
function switchSeriesInputMode(next){
  if(next===seriesInputMode)return;const omega=2*Math.PI*Math.max(.1,num('rlcF'));for(let i=1;i<=MAX_COMPONENTS;i++){const type=$(`seriesCompType${i}`).value,value=num(`seriesCompValue${i}`);$(`seriesCompValue${i}`).value=convertComponentValue(type,value,seriesInputMode,next,omega).toFixed(3);}
  seriesInputMode=next;syncInputModeUI();drawRlc();
}
function switchParallelInputMode(next){
  if(next===parallelInputMode)return;const U=Math.max(0,num('parU')),omega=2*Math.PI*Math.max(.1,num('parF'));for(let i=1;i<=MAX_COMPONENTS;i++){const type=$(`parallelCompType${i}`).value,value=Math.max(num(`parallelCompValue${i}`),.000000001);if(next==='currents'){let impedance=value;if(type!=='R'&&parallelInputMode==='components')impedance=type==='L'?omega*value/1000:1/(omega*value*1e-6);$(`parCurrentInput${i}`).value=(U/impedance).toFixed(3);$(`parAngleInput${i}`).value=type==='R'?'0':type==='L'?'-90':'90';}else if(parallelInputMode==='currents'){const impedance=Math.max(U/Math.max(num(`parCurrentInput${i}`),.000000001),.000000001);$(`parallelCompValue${i}`).value=(type==='R'?impedance:next==='reactance'?impedance:type==='L'?impedance/omega*1000:1/(omega*impedance)*1e6).toFixed(3);}else{$(`parallelCompValue${i}`).value=convertComponentValue(type,value,parallelInputMode,next,omega).toFixed(3);}}
  parallelInputMode=next;syncInputModeUI();drawParallel();
}
function switchThreeLoadInputMode(next){
  if(threeLoadConnection==='M')next='impedance';
  if(next==='impedance'&&threeLoadConnection!=='M')next='components';
  if(next===threeLoadInputMode)return;const omega=2*Math.PI*Math.max(.1,num('threeLoadF'));for(let i=1;i<=MAX_COMPONENTS;i++){const type=$(`threeLoadCompType${i}`).value,value=num(`threeLoadCompValue${i}`);$(`threeLoadCompValue${i}`).value=convertComponentValue(type,value,threeLoadInputMode,next,omega).toFixed(3);}
  threeLoadInputMode=next;syncInputModeUI();drawThreeLoad();
}
function triangleModes(){return {
  general:{title:'Retvinklet trekant',intro:'En retvinklet trekant har to kateter og en hypotenuse. Vinklen φ måles mellem den hosliggende katete og hypotenusen.',sides:['hosliggende','modstående','hypotenuse'],symbols:['a','b','c'],units:['','',''],tip:'Brug trekanten som grundmodel for de elektriske trekanter.',main:'c² = a² + b²',formulas:[['Hypotenuse','c = √(a² + b²)'],['Hosliggende','a = c · cos φ = √(c² − b²)'],['Modstående','b = c · sin φ = √(c² − a²)'],['Vinkel','φ = cos⁻¹(a/c) = sin⁻¹(b/c) = tan⁻¹(b/a)']]},
  impedance:{title:'Impedanstrekant',intro:'Modstanden R og reaktansen X er vinkelrette impedanskomponenter. Impedansen Z er den vektorielle resultant.',sides:['modstand','reaktans','impedans'],symbols:['R','X','Z'],units:['Ω','Ω','Ω'],tip:'X er positiv ved induktiv og negativ ved kapacitiv reaktans.',main:'Z² = R² + X²',formulas:[['Impedans','Z = √(R² + X²)'],['Modstand','R = Z · cos φ = √(Z² − X²)'],['Reaktans','X = Z · sin φ = ±√(Z² − R²)'],['Vinkel','φ = sin⁻¹(X/Z) = tan⁻¹(X/R)']]},
  voltage:{title:'Spændingstrekant',intro:'Den resistive spænding Uᴿ og reaktive spænding Uˣ står vinkelret. Forsyningsspændingen U er resultanten.',sides:['resistiv spænding','reaktiv spænding','spænding'],symbols:['Uᴿ','Uˣ','U'],units:['V','V','V'],tip:'I en seriekreds er Uᴿ i fase med strømmen, mens Uˣ er forskudt 90°.',main:'U² = Uᴿ² + Uˣ²',formulas:[['Spænding','U = √(Uᴿ² + Uˣ²)'],['Resistiv del','Uᴿ = U · cos φ = √(U² − Uˣ²)'],['Reaktiv del','Uˣ = U · sin φ = √(U² − Uᴿ²)'],['Vinkel','φ = cos⁻¹(Uᴿ/U) = sin⁻¹(Uˣ/U) = tan⁻¹(Uˣ/Uᴿ)']]},
  power:{title:'Effekttrekant',intro:'Aktiv effekt P og reaktiv effekt Q er vinkelrette. Den tilsyneladende effekt S er resultanten.',sides:['aktiv effekt','reaktiv effekt','tilsyneladende effekt'],symbols:['P','Q','S'],units:['W','var','VA'],tip:'Q er positiv for induktiv last og negativ for kapacitiv last.',main:'S² = P² + Q²',formulas:[['Tilsyneladende','S = √(P² + Q²)'],['Aktiv effekt','P = S · cos φ = √(S² − Q²)'],['Reaktiv effekt','Q = S · sin φ = √(S² − P²)'],['Vinkel','φ = cos⁻¹(P/S) = sin⁻¹(Q/S) = tan⁻¹(Q/P)']]}
};}
function renderTriangleInputs(){
  const root=$('triangleValueInputs');if(!root)return;const m=triangleModes()[triangleMode],s=triangleStates[triangleMode];
  const inputFor=(key,label,value,unit='')=>`<label><span>${label}${unit?` <em>${unit}</em>`:''}</span><input data-triangle-key="${key}" type="number" value="${triangleInputValue(value)}" step="0.1"${triangleAllowsNegative(key)?'':' min="0.1"'}${key==='phi'?' max="89.9"':''}></label>`;
  root.innerHTML=['a','b','c'].map((key,index)=>inputFor(key,`${m.symbols[index]} · ${m.sides[index]}`,s[key],m.units[index])).join('')+inputFor('phi','φ',s.phi,'°');
  $$('input[data-triangle-key]',root).forEach(input=>{input.addEventListener('input',()=>updateTriangleValue(input.dataset.triangleKey,input.value));input.addEventListener('change',()=>drawTriangleExplorer());});
}
function triangleAllowsNegative(key){return triangleMode==='impedance'&&(key==='b'||key==='phi');}
function triangleInputValue(value){return Number.isFinite(value)?String(Math.round(value*10)/10):'';}
function clampTriangleValue(key,value){
  if(key==='phi')return triangleAllowsNegative(key)?clamp(value,-89.9,89.9):clamp(value,.1,89.9);
  if(triangleAllowsNegative(key))return value;
  return Math.max(.1,value);
}
function solveTriangle(){
  const s=triangleStates[triangleMode],pair=triangleEdited[triangleMode],has=(x,y)=>pair.includes(x)&&pair.includes(y),toDeg=r=>deg(r),toRad=v=>rad(v),signed=triangleMode==='impedance',verticalSign=()=>signed&&((pair.includes('b')&&s.b<0)||(pair.includes('phi')&&s.phi<0)||(!pair.includes('b')&&!pair.includes('phi')&&(s.b<0||s.phi<0)))?-1:1;
  if(has('a','b')){s.c=Math.hypot(s.a,s.b);s.phi=toDeg(Math.atan2(s.b,s.a));}
  else if(has('a','c')){const sign=verticalSign();s.b=sign*Math.sqrt(Math.max(0,s.c*s.c-s.a*s.a));s.phi=sign*toDeg(Math.acos(clamp(s.a/s.c,-1,1)));}
  else if(has('b','c')){s.a=Math.sqrt(Math.max(0,s.c*s.c-s.b*s.b));s.phi=toDeg(Math.asin(clamp(s.b/s.c,-1,1)));}
  else if(has('a','phi')){const p=toRad(s.phi);s.b=s.a*Math.tan(p);s.c=Math.abs(s.a/Math.cos(p));}
  else if(has('b','phi')){if(Math.abs(s.phi)<.001){s.a=Math.max(s.a,.1);s.c=Math.hypot(s.a,s.b);}else{const p=toRad(s.phi);s.a=Math.abs(s.b/Math.tan(p));s.c=Math.abs(s.b/Math.sin(p));}}
  else if(has('c','phi')){const p=toRad(s.phi);s.a=Math.abs(s.c*Math.cos(p));s.b=s.c*Math.sin(p);}
  if(!signed){s.b=Math.abs(s.b);s.phi=Math.abs(s.phi);}
}
function updateTriangleValue(key,raw){
  const value=Number(String(raw).replace(',','.'));if(!Number.isFinite(value)||(!triangleAllowsNegative(key)&&key!=='phi'&&value<=0))return;
  if(key==='phi'&&!triangleAllowsNegative(key)&&(value<=0||value>=90))return;
  const s=triangleStates[triangleMode];s[key]=clampTriangleValue(key,value);triangleEdited[triangleMode]=[...triangleEdited[triangleMode].filter(k=>k!==key),key].slice(-2);solveTriangle();drawTriangleExplorer(key);
}
function syncTriangleInputs(activeKey=''){
  const s=triangleStates[triangleMode];$$('input[data-triangle-key]').forEach(input=>{const key=input.dataset.triangleKey;if(key!==activeKey||document.activeElement!==input)input.value=triangleInputValue(s[key]);});
  const labels={a:'første katete',b:'anden katete',c:'hypotenusen',phi:'φ'};const pair=triangleEdited[triangleMode];$('triangleInputStatus').textContent=`Inddata: ${labels[pair[0]]} og ${labels[pair[1]]}.`;
}
function drawTriangleExplorer(activeKey=''){
  const root=$('triangleExplorerSvg');if(!root)return;const modes=triangleModes(),m=modes[triangleMode]||modes.general,s=triangleStates[triangleMode];
  if($('triangleValueInputs').dataset.mode!==triangleMode){renderTriangleInputs();$('triangleValueInputs').dataset.mode=triangleMode;}
  $('triangleExplorerTitle').textContent=m.title;$('triangleExplorerIntro').textContent=m.intro;$('triangleExplorerTip').textContent=m.tip;if($('triangleAngleReadout'))$('triangleAngleReadout').textContent=`φ = ${da(s.phi,1)}°`;
  $('trianglePrimaryFormula').innerHTML=`<p>${m.main}</p>`;$('triangleFormulaGrid').innerHTML=m.formulas.map(([label,formula])=>`<div><span>${label}</span><strong>${formula}</strong></div>`).join('');syncTriangleInputs(activeKey);
  const isNegativeVertical=s.b<0;clear(root);const A={x:115,y:isNegativeVertical?128:185};
  baseGrid(root,A.x,A.y,480,240);
  const scale=Math.min(330/Math.max(s.a,.001),128/Math.max(Math.abs(s.b),.001)),width=s.a*scale,height=s.b*scale,B={x:A.x+width,y:A.y},C={x:A.x+width,y:A.y-height};
  const angleRadius=clamp(Math.min(width,Math.abs(height))*.28,18,40),angleEnd={x:A.x+Math.cos(rad(s.phi))*angleRadius,y:A.y-Math.sin(rad(s.phi))*angleRadius},rightSize=clamp(Math.min(width,Math.abs(height))*.16,12,22),verticalDir=height<0?1:-1;
  const aColor=m.symbols[0]==='R'||m.symbols[0]==='P'?'#9b87f5':'#48dff0',bColor=m.symbols[1]==='X'||m.symbols[1]==='Q'?'#ff9f43':'#55d6a1',cColor=VOLTAGE_COLOR;
  line(root,A.x,C.y,B.x,C.y,'guide');
  arrow(root,A.x,A.y,width,0,aColor,'',.75);
  arrow(root,B.x,B.y,Math.abs(height),height<0?-90:90,bColor,'',.75);
  arrowTo(root,A.x,A.y,C.x,C.y,cColor,'',.85);
  root.append(svg('path',{d:`M ${B.x-rightSize} ${B.y} L ${B.x-rightSize} ${B.y+verticalDir*rightSize} L ${B.x} ${B.y+verticalDir*rightSize}`,class:'triangle-right-angle'}));
  root.append(svg('path',{d:`M ${A.x+angleRadius} ${A.y} A ${angleRadius} ${angleRadius} 0 0 ${s.phi<0?1:0} ${angleEnd.x} ${angleEnd.y}`,class:'triangle-angle'}));
  const sideValue=(index,key)=>`${m.symbols[index]} = ${da(s[key],1)}${m.units[index]?` ${m.units[index]}`:''}`;
  text(root,A.x+width*.5,A.y+25,sideValue(0,'a'),'vector-label',aColor,'middle');text(root,B.x+13,B.y-height*.5+4,sideValue(1,'b'),'vector-label',bColor);text(root,A.x+width*.5-10,A.y-height*.5+(height<0?27:-13),sideValue(2,'c'),'vector-label',cColor,'middle');
  line(root,70,A.y,A.x-12,A.y,'triangle-angle');text(root,94,A.y+(s.phi<0?18:-9),`φ = ${da(s.phi,1)}°`,'triangle-dimension','#aab8c0','middle');
  text(root,A.x+width*.5,A.y+44,m.sides[0],'triangle-dimension','#71828d','middle');text(root,B.x+22,B.y-height*.5+(height<0?-18:23),m.sides[1],'triangle-dimension','#71828d');text(root,A.x+width*.5-10,A.y-height*.5+(height<0?44:-30),m.sides[2],'triangle-dimension','#71828d','middle');
}
function drawIronCore(){
  const circuit=$('ironCircuit'),triangle=$('ironTriangle'),hyst=$('ironHysteresis');if(!circuit||!triangle||!hyst)return;
  const activeId=document.activeElement?.id,I=Math.max(.001,num('ironI',2)),RCu=Math.max(0,num('ironRCu',18)),RFe=Math.max(0,num('ironRFeInput',27)),Reff=RCu+RFe;
  let Xeff=Math.max(0,num('ironXeffInput',105.83)),Z=Math.max(.001,num('ironZInput',115));
  if(activeId==='ironZInput'){
    Xeff=Math.sqrt(Math.max(0,Z*Z-Reff*Reff));
    if($('ironXeffInput'))$('ironXeffInput').value=inputNumber(Xeff);
  }else{
    Z=Math.hypot(Reff,Xeff);
    if($('ironZInput'))$('ironZInput').value=inputNumber(Z);
  }
  const PCu=I*I*RCu,PFe=I*I*RFe,P=I*I*Reff,Q=I*I*Xeff,S=I*I*Z,phi=deg(Math.atan2(Xeff,Reff||.000001)),cos=Reff/Z;
  $('ironInputNote').textContent=activeId==='ironZInput'?'X_L,eff beregnes ud fra Z og R_eff, så trekanten passer.':'Z beregnes ud fra R_eff og X_L,eff, så trekanten passer.';
  $('ironS').textContent=apparentPower(S);$('ironQ').textContent=power(Q,true);$('ironPCu').textContent=power(PCu);$('ironPFe').textContent=power(PFe);$('ironRFe').textContent=unit(RFe,'Ω',2);$('ironReff').textContent=unit(Reff,'Ω',2);$('ironXeff').textContent=unit(Xeff,'Ω',2);$('ironZ').textContent=unit(Z,'Ω',2);
  $('ironTriR').textContent=unit(Reff,'Ω',2);$('ironTriX').textContent=unit(Xeff,'Ω',2);$('ironTriZ').textContent=unit(Z,'Ω',2);$('ironPhiBadge').textContent=`φ = ${da(phi,1)}°  |  cos φ = ${da(cos,3)}`;
  drawIronCircuit(circuit,I*Z,I,RCu,RFe,Xeff,Reff);
  drawIronTriangle(triangle,Reff,Xeff,Z,phi);
  drawIronPowerTriangle($('ironPowerTriangle'),PCu,PFe,P,Q,S,phi);
  drawIronVectorDiagram($('ironVectorDiagram'),I,RCu,RFe,Xeff,Reff,Z,phi);
  drawIronImpedanceDetail($('ironImpedanceDetail'),RCu,RFe,Xeff,Reff,Z,phi);
  drawIronHysteresis(hyst);
}
function drawIronCircuit(root,U,I,RCu,RFe,Xeff,Reff){
  clear(root);circuitWire(root,32,55,655,55);circuitWire(root,655,55,655,135);circuitWire(root,655,135,32,135);circuitWire(root,32,135,32,55);
  circuitNode(root,32,55);circuitNode(root,32,135);circuitText(root,17,100,`U = ${unit(U,'V',0)}`,'circuit-label','middle');circuitArrow(root,58,55,52,0,`I = ${unit(I,'A',2)}`,CURRENT_COLOR);
  const items=[{x:205,label:'R_Cu',value:unit(RCu,'Ω',2),type:'R'},{x:360,label:'R_Fe',value:unit(RFe,'Ω',2),type:'R'},{x:520,label:'X_L,eff',value:unit(Xeff,'Ω',2),type:'L'}];
  items.forEach(item=>{item.type==='R'?circuitResistor(root,item.x,55):circuitInductor(root,item.x,55);circuitText(root,item.x,28,item.label,'circuit-label','middle');circuitText(root,item.x,85,item.value,'circuit-label','middle');});
  root.append(svg('path',{d:'M 164 112 L 164 125 L 401 125 L 401 112',class:'guide'}));circuitText(root,282,145,`R_eff = ${unit(Reff,'Ω',2)}`,'circuit-label','middle');
  circuitText(root,594,28,'fast serieækvivalent','circuit-label','middle');circuitText(root,594,84,'spole med jernkerne','circuit-label','middle');
}
function drawIronTriangle(root,R,X,Z,phi){
  clear(root);const A={x:130,y:255};baseGrid(root,A.x,A.y,630,300);
  const scale=Math.min(440/Math.max(R,.001),175/Math.max(X,.001)),w=R*scale,h=X*scale,B={x:A.x+w,y:A.y},C={x:B.x,y:A.y-h};
  arrow(root,A.x,A.y,w,0,'#9b87f5','',.9);arrow(root,B.x,B.y,h,90,'#ff9f43','',.9);arrowTo(root,A.x,A.y,C.x,C.y,VOLTAGE_COLOR,'',1);
  root.append(svg('path',{d:`M ${B.x-24} ${B.y} L ${B.x-24} ${B.y-24} L ${B.x} ${B.y-24}`,class:'triangle-right-angle'}));
  const r=44,end={x:A.x+r*Math.cos(rad(phi)),y:A.y-r*Math.sin(rad(phi))};root.append(svg('path',{d:`M ${A.x+r} ${A.y} A ${r} ${r} 0 0 0 ${end.x} ${end.y}`,class:'arc'}));
  text(root,A.x+w*.5,A.y+29,`R_eff = ${da(R,2)} Ω`,'vector-label','#9b87f5','middle');text(root,B.x+16,B.y-h*.5,`X_L,eff = ${da(X,2)} Ω`,'vector-label','#ff9f43');text(root,A.x+w*.5-12,A.y-h*.5-13,`Z = ${da(Z,2)} Ω`,'vector-label',VOLTAGE_COLOR,'middle');text(root,A.x+35,A.y-10,`φ = ${da(phi,1)}°`,'vector-label','#aab8c0','middle');
  text(root,A.x+w*.5,A.y+52,'effektiv modstand','triangle-dimension','#71828d','middle');text(root,B.x+18,B.y-h*.5+22,'induktiv reaktans','triangle-dimension','#71828d');
}
function drawIronPowerTriangle(root,PCu,PFe,P,Q,S,phi){
  if(!root)return;clear(root);const x0=105,y0=290,W=680,H=380;
  drawAxisGrid(root,x0,y0,W,H);
  const scale=Math.min(P>0?430/P:Infinity,Q>0?235/Q:Infinity,S>0?455/S:Infinity),s=Number.isFinite(scale)?scale:1;
  const pCuW=Math.max(18,PCu*s),pFeW=Math.max(18,PFe*s),base=Math.max(42,pCuW+pFeW),height=Math.max(42,Q*s),B={x:x0+base,y:y0},C={x:B.x,y:y0-height},splitX=x0+pCuW;
  arrow(root,x0,y0,pCuW,0,'#9b87f5','',.7);arrow(root,splitX,y0,pFeW,0,'#55d6a1','',.7);arrow(root,B.x,B.y,height,90,'#ff9f43','',.75);arrowTo(root,x0,y0,C.x,C.y,VOLTAGE_COLOR,'',.85);
  line(root,splitX,y0-8,splitX,y0+8,'axis');root.append(svg('path',{d:`M ${B.x-24} ${B.y} L ${B.x-24} ${B.y-24} L ${B.x} ${B.y-24}`,class:'triangle-right-angle'}));
  const r=42,end={x:x0+r*Math.cos(rad(phi)),y:y0-r*Math.sin(rad(phi))};root.append(svg('path',{d:`M ${x0+r} ${y0} A ${r} ${r} 0 0 0 ${end.x} ${end.y}`,class:'arc'}));
  text(root,x0+pCuW*.5,y0+26,`P_Cu = ${power(PCu)}`,'vector-label','#9b87f5','middle');text(root,splitX+pFeW*.5,y0+26,`P_Fe = ${power(PFe)}`,'vector-label','#55d6a1','middle');text(root,B.x+18,y0-height*.5+4,`Q = ${power(Q,true)}`,'vector-label','#ff9f43');text(root,x0+base*.5,y0-height*.55,`S = ${apparentPower(S)}`,'vector-label',VOLTAGE_COLOR,'middle');
  text(root,x0+44,y0-17,`φ = ${da(phi,1)}°`,'vector-label','#aab8c0','middle');text(root,x0+base*.5,y0+51,`P = ${power(P)}`,'triangle-dimension','#71828d','middle');text(root,50,405,'Aktiv effekt ligger på x-aksen; reaktiv effekt tegnes lodret fra P-summen.','vector-label','#778791');
}
function drawIronVectorDiagram(root,I,RCu,RFe,Xeff,Reff,Z,phi){
  if(!root)return;clear(root);const x0=115,y0=270,W=680,H=380;
  drawAxisGrid(root,x0,y0,W,H);arrow(root,x0,y0,330,0,CURRENT_COLOR,'',.7);text(root,470,251,'I som reference','vector-label',CURRENT_COLOR,'end');
  const URCu=I*RCu,URFe=I*RFe,UX=I*Xeff,UZ=I*Z,scale=Math.min((URCu+URFe)>0?430/(URCu+URFe):Infinity,UX>0?235/UX:Infinity,UZ>0?475/UZ:Infinity),s=Number.isFinite(scale)?scale:1;
  const rcu=Math.max(1,URCu*s),rfe=Math.max(1,URFe*s),rx=x0+rcu+rfe,cuX=x0+rcu,effH=Math.max(1,UX*s),zEnd={x:rx,y:y0-effH};
  arrow(root,x0,y0,rcu,0,'#9b87f5','',.65);arrow(root,cuX,y0,rfe,0,'#55d6a1','',.65);arrowTo(root,cuX,y0,zEnd.x,zEnd.y,'#d6e1e5','',.75);arrow(root,rx,y0,effH,90,'#ff9f43','',.75);arrowTo(root,x0,y0,zEnd.x,zEnd.y,VOLTAGE_COLOR,'',.85);
  root.append(svg('path',{d:`M ${x0+42} ${y0} A 42 42 0 0 0 ${x0+42*Math.cos(rad(phi))} ${y0-42*Math.sin(rad(phi))}`,class:'arc'}));
  text(root,x0+rcu*.5,y0+24,'I·R_Cu','vector-label','#9b87f5','middle');text(root,cuX+rfe*.5,y0+24,'I·R_Fe','vector-label','#55d6a1','middle');text(root,cuX+(rx-cuX)*.38,y0-effH*.52,'I·X_L','vector-label','#d6e1e5','middle');text(root,rx+15,y0-effH*.5+4,'I·X_L,eff','vector-label','#ff9f43');text(root,x0+(rx-x0)*.42,y0-effH*.58,'I·Z','vector-label',VOLTAGE_COLOR,'middle');text(root,x0+34,y0-13,'φ','vector-label','#aab8c0','middle');
  text(root,50,405,'R_Cu og R_Fe ligger i fase med strømmen; X_L går fra R_Cu-punktet til enden af Z.','vector-label','#778791');
}
function drawIronImpedanceDetail(root,RCu,RFe,Xeff,Reff,Z,phi){
  if(!root)return;clear(root);const x0=115,y0=270,W=680,H=380;
  drawAxisGrid(root,x0,y0,W,H);arrow(root,x0,y0,330,0,CURRENT_COLOR,'',.65);text(root,470,251,'I som reference','vector-label',CURRENT_COLOR,'end');
  const scale=Math.min(Reff>0?430/Reff:Infinity,Xeff>0?235/Xeff:Infinity,Z>0?475/Z:Infinity),s=Number.isFinite(scale)?scale:1;
  const rcu=Math.max(1,RCu*s),rfe=Math.max(1,RFe*s),rx=x0+rcu+rfe,cuX=x0+rcu,effH=Math.max(1,Xeff*s),zEnd={x:rx,y:y0-effH};
  arrow(root,x0,y0,rcu,0,'#9b87f5','',.65);arrow(root,cuX,y0,rfe,0,'#55d6a1','',.65);arrowTo(root,cuX,y0,zEnd.x,zEnd.y,'#d6e1e5','',.75);arrow(root,rx,y0,effH,90,'#ff9f43','',.75);arrowTo(root,x0,y0,zEnd.x,zEnd.y,VOLTAGE_COLOR,'',.85);
  root.append(svg('path',{d:`M ${rx-24} ${y0} L ${rx-24} ${y0-24} L ${rx} ${y0-24}`,class:'triangle-right-angle'}));root.append(svg('path',{d:`M ${x0+42} ${y0} A 42 42 0 0 0 ${x0+42*Math.cos(rad(phi))} ${y0-42*Math.sin(rad(phi))}`,class:'arc'}));
  root.append(svg('path',{d:`M ${x0} ${y0+43} C ${x0+40} ${y0+61}, ${rx-40} ${y0+61}, ${rx} ${y0+43}`,class:'guide'}));
  text(root,x0+rcu*.5,y0+24,'R_Cu','vector-label','#9b87f5','middle');text(root,cuX+rfe*.5,y0+24,'R_Fe','vector-label','#55d6a1','middle');text(root,cuX+(rx-cuX)*.38,y0-effH*.52,'X_L','vector-label','#d6e1e5','middle');text(root,rx+15,y0-effH*.5+4,`X_L,eff = ${da(Xeff,2)} Ω`,'vector-label','#ff9f43');text(root,x0+(rx-x0)*.48,y0-effH*.58,`Z = ${da(Z,2)} Ω`,'vector-label',VOLTAGE_COLOR,'middle');text(root,x0+34,y0-13,'φ','vector-label','#aab8c0','middle');text(root,x0+(rx-x0)*.5,y0+72,`R_eff = ${da(Reff,2)} Ω`,'vector-label','#d6e1e5','middle');
  text(root,50,405,'R_eff = R_Cu + R_Fe på x-aksen; X_L går fra R_Cu-punktet til enden af Z.','vector-label','#778791');
}
function drawIronHysteresis(root){
  clear(root);const cx=448,cy=222,xScale=250,yScale=132,toX=H=>cx+H/2200*xScale,toY=B=>cy-B/1.5*yScale;
  for(let h=-2000;h<=2000;h+=500)line(root,toX(h),58,toX(h),388,'grid-line');for(let b=-1.5;b<=1.51;b+=.25)line(root,185,toY(b),700,toY(b),'grid-line');
  line(root,170,cy,727,cy,'axis');line(root,cx,50,cx,396,'axis');arrow(root,727,cy,35,0,'#d6e1e5','',.55);arrow(root,cx,50,35,90,'#d6e1e5','',.55);text(root,766,cy-8,'H','vector-label','#d6e1e5');text(root,cx+9,43,'B [T]','vector-label','#d6e1e5');text(root,740,cy+20,'[Avind/m]','triangle-dimension','#aab8c0');
  [-2000,-1000,1000,2000].forEach(v=>text(root,toX(v),cy+28,String(Math.abs(v)),'triangle-dimension','#aab8c0','middle'));[.5,1,1.5,-.5,-1,-1.5].forEach(v=>text(root,cx+9,toY(v)+4,String(Math.abs(v)).replace('.',','),'triangle-dimension','#aab8c0'));
  const loop=[];for(let i=0;i<=240;i++){const t=i/240*Math.PI*2,H=1850*Math.sin(t),B=1.45*Math.tanh(1.9*Math.sin(t+.72));loop.push([toX(H),toY(B)]);}root.append(svg('path',{d:loop.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '),fill:'none',stroke:'#d6e1e5','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));
  const virgin=[];for(let i=0;i<=90;i++){const H=1500*i/90,B=1.42*Math.tanh(2.2*i/90);virgin.push([toX(H),toY(B)]);}root.append(svg('path',{d:virgin.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '),fill:'none',stroke:'#d6e1e5','stroke-width':2,'stroke-dasharray':'8 7'}));
  arrow(root,toX(600),toY(1.1),44,68,'#d6e1e5','',.45);arrow(root,toX(-720),toY(-1.08),44,-112,'#d6e1e5','',.45);
  line(root,toX(-850),toY(1.2),toX(-850),toY(.05),'vector','#d6e1e5');arrow(root,toX(-850),toY(1.2),50,-90,'#d6e1e5','',.45);arrow(root,toX(-850),toY(.05),50,90,'#d6e1e5','',.45);text(root,toX(-1240),toY(.78),'Remanens','vector-label','#d6e1e5');
  line(root,toX(-850),toY(1.27),toX(-340),toY(1.27),'vector','#d6e1e5');arrow(root,toX(-850),toY(1.27),45,0,'#d6e1e5','',.45);arrow(root,toX(-340),toY(1.27),45,180,'#d6e1e5','',.45);text(root,toX(-1080),toY(1.39),'Coercitivkraft','vector-label','#d6e1e5');
  text(root,toX(930),toY(-.9),'B = Φ / A','vector-label','#d6e1e5');text(root,toX(930),toY(-1.25),'H = I · N / l','vector-label','#d6e1e5');
}
function updateAll(){drawAc();drawRlc();drawIronCore();drawParallel();drawPower();drawThreeLoad();drawThree();drawComp();drawConnections();drawTransformation();drawOhm();drawTriangleExplorer();applyElectricalColorConvention();}
$$('input').forEach(input=>input.addEventListener('input',()=>{ if(input.id==='acPhi') $('acPhiRange').value=input.value; if(input.id==='powerCos') $('powerCosRange').value=input.value; updateAll(); }));
$$('#triangleSelector button').forEach(button=>button.addEventListener('click',()=>{triangleMode=button.dataset.triangle;$$('#triangleSelector button').forEach(b=>b.classList.toggle('active',b===button));drawTriangleExplorer();}));
$('acPhiRange').addEventListener('input',e=>{$('acPhi').value=e.target.value;drawAc();});$('powerCosRange').addEventListener('input',e=>{$('powerCos').value=e.target.value;drawPower();});
$$('#seriesInputMode button').forEach(b=>b.addEventListener('click',()=>switchSeriesInputMode(b.dataset.seriesMode)));
$$('#parallelInputMode button').forEach(b=>b.addEventListener('click',()=>switchParallelInputMode(b.dataset.parallelMode)));
$$('#seriesComponentCount button').forEach(b=>b.addEventListener('click',()=>{seriesComponentCount=Number(b.dataset.count);syncComponentBuilders();drawRlc();}));
$$('#parallelComponentCount button').forEach(b=>b.addEventListener('click',()=>{parallelComponentCount=Number(b.dataset.count);syncComponentBuilders();drawParallel();}));
$$('#seriesComponentBuilder select').forEach(select=>select.addEventListener('change',()=>{syncComponentBuilders();drawRlc();}));
$$('#parallelComponentBuilder select').forEach(select=>select.addEventListener('change',()=>{const index=Number(select.id.match(/\d+$/)?.[0]||1),type=select.value;if(parallelInputMode==='currents')$(`parAngleInput${index}`).value=type==='R'?'0':type==='L'?'-90':'90';syncComponentBuilders();drawParallel();}));
$$('#seriesVoltageMode button').forEach(b=>b.addEventListener('click',()=>{seriesVoltageMode=b.dataset.seriesVoltage;syncInputModeUI();drawRlc();}));
$$('#seriesImpedanceMode button').forEach(b=>b.addEventListener('click',()=>{seriesImpedanceMode=b.dataset.seriesImpedance;syncInputModeUI();drawRlc();}));
$$('#parallelVectorMode button').forEach(b=>b.addEventListener('click',()=>{parallelVectorMode=b.dataset.parallelVector;syncInputModeUI();drawParallel();}));
$$('#threeLoadVectorMode button').forEach(b=>b.addEventListener('click',()=>{threeLoadVectorMode=b.dataset.threeLoadVector;syncInputModeUI();drawThreeLoad();}));
$$('#threeLoadFocusPhase button').forEach(b=>b.addEventListener('click',()=>{threeLoadFocusPhase=Number(b.dataset.loadFocus)||1;drawThreeLoad();}));
$$('#powerMode button').forEach(b=>b.addEventListener('click',()=>{$$('#powerMode button').forEach(x=>x.classList.remove('active'));b.classList.add('active');powerMode=Number(b.dataset.mode);drawPower();}));
$$('#threeConnection button').forEach(b=>b.addEventListener('click',()=>{$$('#threeConnection button').forEach(x=>x.classList.remove('active'));b.classList.add('active');threeConnection=b.dataset.connection;drawThree();}));
$$('#threeVoltageType button').forEach(b=>b.addEventListener('click',()=>{const next=b.dataset.voltage;if(next===threeVoltageType)return;const current=num('threeU'),converted=threeVoltageType==='line'?(threeConnection==='Y'?current/Math.sqrt(3):current):(threeConnection==='Y'?current*Math.sqrt(3):current);$('threeU').value=converted.toFixed(2);$$('#threeVoltageType button').forEach(x=>x.classList.remove('active'));b.classList.add('active');threeVoltageType=next;drawThree();}));
$$('#threeCurrentType button').forEach(b=>b.addEventListener('click',()=>{$$('#threeCurrentType button').forEach(x=>x.classList.remove('active'));b.classList.add('active');threeCurrentView=b.dataset.current;drawThree();}));
$$('#threeLoadConnection button').forEach(b=>b.addEventListener('click',()=>{$$('#threeLoadConnection button').forEach(x=>x.classList.remove('active'));b.classList.add('active');threeLoadConnection=b.dataset.loadConnection;if(threeLoadConnection==='M'){threeLoadInputMode='impedance';threeLoadVoltageType='line';}else if(threeLoadInputMode==='impedance')threeLoadInputMode='components';syncThreeLoadBuilder();drawThreeLoad();}));
$$('#threeLoadVoltageType button').forEach(b=>b.addEventListener('click',()=>{let next=b.dataset.loadVoltage;if(threeLoadConnection==='M')next='line';if(next===threeLoadVoltageType){syncThreeLoadBuilder();return;}const current=num('threeLoadU'),converted=threeLoadVoltageType==='line'?(threeLoadConnection==='Y'?current/Math.sqrt(3):current):(threeLoadConnection==='Y'?current*Math.sqrt(3):current);$('threeLoadU').value=converted.toFixed(2);$$('#threeLoadVoltageType button').forEach(x=>x.classList.toggle('active',x.dataset.loadVoltage===next));threeLoadVoltageType=next;drawThreeLoad();}));
$$('#threeLoadInputMode button').forEach(b=>b.addEventListener('click',()=>switchThreeLoadInputMode(b.dataset.loadMode)));
$$('#threeLoadComponentCount button').forEach(b=>b.addEventListener('click',()=>{threeLoadComponentCount=Number(b.dataset.count);syncThreeLoadBuilder();drawThreeLoad();}));
$$('#threeLoadComponentBuilder select').forEach(select=>select.addEventListener('change',()=>{syncThreeLoadBuilder();drawThreeLoad();}));
$$('#ohmTarget button').forEach(b=>b.addEventListener('click',()=>{$$('#ohmTarget button').forEach(x=>x.classList.remove('active'));b.classList.add('active');ohmTarget=b.dataset.target;renderOhmInputs();}));
$$('#transformDirection button').forEach(b=>b.addEventListener('click',()=>{$$('#transformDirection button').forEach(x=>x.classList.remove('active'));b.classList.add('active');transformDirection=b.dataset.transform;drawTransformation();}));
$$('#trSymDirection button').forEach(b=>b.addEventListener('click',()=>{$$('#trSymDirection button').forEach(x=>x.classList.remove('active'));b.classList.add('active');transformSymDirection=b.dataset.symTransform;drawTransformation();}));
function activatePage(id,push=true){const page=$(id)||$('vekselstroem');$$('.page').forEach(p=>p.classList.toggle('active',p===page));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page.id));$('pageTitle').textContent=page.dataset.title;if(push)history.replaceState(null,'',`#${page.id}`);document.body.classList.remove('menu-open');$('menuButton').setAttribute('aria-expanded','false');window.scrollTo({top:0,behavior:'auto'});if(typeof updateAll==='function')updateAll();}
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>activatePage(b.dataset.page)));$('menuButton').addEventListener('click',()=>{const open=document.body.classList.toggle('menu-open');$('menuButton').setAttribute('aria-expanded',String(open));});
$('resetButton').addEventListener('click',()=>{const active=document.querySelector('.page.active');if(!active)return;$$('input',active).forEach(i=>{if(defaults[i.id]!==undefined)i.value=defaults[i.id];else if(i.defaultValue!==undefined)i.value=i.defaultValue;});$$('select',active).forEach(s=>{if(selectDefaults[s.id]!==undefined)s.value=selectDefaults[s.id];});if(active.id==='serie'){seriesInputMode='components';seriesComponentCount=3;seriesVoltageMode='total';seriesImpedanceMode='total';}if(active.id==='parallel'){parallelInputMode='components';parallelComponentCount=3;parallelVectorMode='total';}if(active.id==='effekt'){powerMode=1;$$('#powerMode button').forEach((b,i)=>b.classList.toggle('active',i===0));}if(active.id==='trefaset'){threeConnection='Y';threeVoltageType='line';threeCurrentView='line';$$('#threeConnection button').forEach((b,i)=>b.classList.toggle('active',i===0));$$('#threeVoltageType button').forEach((b,i)=>b.classList.toggle('active',i===0));$$('#threeCurrentType button').forEach((b,i)=>b.classList.toggle('active',i===0));}if(active.id==='trefaset-belastning'){threeLoadConnection='Y';threeLoadVoltageType='line';threeLoadInputMode='components';threeLoadAsymInputMode='z';threeLoadComponentCount=3;threeLoadFocusPhase=1;$$('#threeLoadConnection button').forEach((b,i)=>b.classList.toggle('active',i===0));$$('#threeLoadVoltageType button').forEach((b,i)=>b.classList.toggle('active',i===0));$$('#threeLoadInputMode button').forEach((b,i)=>b.classList.toggle('active',i===0));$$('#threeLoadFocusPhase button').forEach((b,i)=>b.classList.toggle('active',i===0));}if(active.id==='transformation'){transformDirection='delta-star';transformSymDirection='star-delta';$$('#transformDirection button').forEach((b,i)=>b.classList.toggle('active',i===0));$$('#trSymDirection button').forEach((b,i)=>b.classList.toggle('active',i===0));}if(active.id==='ellove'){ohmTarget='U';ohmPowerMode='simple';$$('#ohmTarget button').forEach((b,i)=>b.classList.toggle('active',i===0));renderOhmInputs();}syncInputModeUI();updateAll();});
$('resetButton').addEventListener('click',()=>{const active=document.querySelector('.page.active');if(active?.id==='trefaset-belastning'){threeLoadVectorMode='total';$$('#threeLoadVectorMode button').forEach((b,i)=>b.classList.toggle('active',i===0));drawThreeLoad();}});
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const target=$$('.nav-item').find(button=>button.querySelector('kbd')?.textContent===e.key);if(target)activatePage(target.dataset.page);});
window.addEventListener('hashchange',()=>activatePage(location.hash.slice(1),false));
let scaleMode='auto',manualScale=1;
try{const saved=localStorage.getItem('vektorlab-scale');if(saved&&saved!=='auto'){scaleMode='manual';manualScale=clamp(Number(saved)||1,.85,1.35);}}catch(e){}
let themeMode='dark';
try{themeMode=localStorage.getItem('vektorlab-theme')||'dark';}catch(e){}
function applyTheme(){
  const light=themeMode==='light';
  document.body.classList.toggle('light-theme',light);
  const button=$('themeToggle');
  if(button){button.setAttribute('aria-pressed',String(light));button.innerHTML=`${light?'☾':'☀'} <span>${light?'Mørkt tema':'Lyst tema'}</span>`;}
}
function saveTheme(value){try{localStorage.setItem('vektorlab-theme',value);}catch(e){}}
$('themeToggle').addEventListener('click',()=>{themeMode=document.body.classList.contains('light-theme')?'dark':'light';saveTheme(themeMode);applyTheme();});
function automaticScale(){const width=window.innerWidth;return width>=2200?1.22:width>=1800?1.15:width>=1500?1.07:1;}
function applyDisplayScale(){const effective=window.innerWidth<=760?1:scaleMode==='auto'?automaticScale():manualScale;document.documentElement.style.setProperty('--ui-zoom',effective);$('scaleAuto').textContent=`${scaleMode==='auto'?'Auto | ':''}${Math.round(effective*100)}%`;}
function saveScale(value){try{localStorage.setItem('vektorlab-scale',value);}catch(e){}}
$('scaleDown').addEventListener('click',()=>{const current=scaleMode==='auto'?automaticScale():manualScale;scaleMode='manual';manualScale=clamp(Math.round((current-.1)*100)/100,.85,1.35);saveScale(String(manualScale));applyDisplayScale();});
$('scaleUp').addEventListener('click',()=>{const current=scaleMode==='auto'?automaticScale():manualScale;scaleMode='manual';manualScale=clamp(Math.round((current+.1)*100)/100,.85,1.35);saveScale(String(manualScale));applyDisplayScale();});
$('scaleAuto').addEventListener('click',()=>{scaleMode='auto';saveScale('auto');applyDisplayScale();});
window.addEventListener('resize',()=>{if(scaleMode==='auto')applyDisplayScale();});
applyTheme();applyDisplayScale();renderOhmInputs();syncInputModeUI();activatePage(location.hash.slice(1)||'vekselstroem',false);updateAll();installDiagramExpanders();window.addEventListener('load',()=>window.scrollTo({top:0,behavior:'auto'}),{once:true});setTimeout(()=>window.scrollTo(0,0),350);





