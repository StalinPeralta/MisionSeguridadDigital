import{getApps}from'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import{getAuth,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import{getFirestore,collection,onSnapshot,addDoc,serverTimestamp}from'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

const app=getApps()[0];
const auth=getAuth(app);
const db=getFirestore(app);
let sessions=[];
let decisions=[];

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function injectStyles(){
  if(document.getElementById('cie-styles'))return;
  const s=document.createElement('style');
  s.id='cie-styles';
  s.textContent=`
  .cie-shell{margin:10px 0;border:1px solid rgba(168,85,247,.48);background:linear-gradient(145deg,rgba(12,26,50,.99),rgba(6,13,30,.99));border-radius:15px;padding:17px;box-shadow:0 18px 55px #0006,0 0 34px rgba(168,85,247,.12)}
  .cie-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:15px}.cie-title{display:flex;gap:12px;align-items:center}.cie-orb{width:50px;height:50px;border:1px solid #a855f7;border-radius:13px;display:grid;place-items:center;font-size:25px;box-shadow:0 0 24px #a855f755;animation:ciePulse 2s infinite}.cie-title h2{margin:0;font-size:18px}.cie-title small{color:#8fa6bd}.hai{font:800 9px Courier New,monospace;border:1px solid rgba(20,241,149,.5);color:#14f195;padding:8px 11px;border-radius:999px;box-shadow:0 0 18px rgba(20,241,149,.08)}
  .cie-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.rec{border:1px solid rgba(148,163,184,.17);border-left:3px solid var(--prio,#ffc928);background:#061525;border-radius:11px;padding:14px;position:relative;overflow:hidden}.rec:before{content:'';position:absolute;right:-35px;top:-35px;width:100px;height:100px;border-radius:50%;background:var(--prio,#ffc928);opacity:.06}.rec-top{display:flex;justify-content:space-between;gap:10px}.priority{font:900 8px Courier New,monospace;color:var(--prio);border:1px solid var(--prio);padding:4px 6px;border-radius:5px}.confidence{font:900 10px Courier New,monospace;color:#00d9ff}.rec h3{margin:12px 0 4px;font-size:14px}.target{color:#c5d8e8;font-size:11px}.reason{margin:12px 0;color:#91a8bc;font-size:11px;line-height:1.5}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}.metric{background:#03101d;border:1px solid rgba(23,152,255,.15);border-radius:7px;padding:7px;text-align:center}.metric b{display:block;font-size:14px;color:#dff7ff}.metric small{font-size:8px;color:#70869b}.rec-actions{display:flex;gap:7px;flex-wrap:wrap}.rec-actions button{border-radius:7px;padding:8px 10px;font-weight:850;font-size:9px;cursor:pointer}.approve{border:0;background:#14f195;color:#002719}.modify{border:1px solid #00d9ff;background:transparent;color:#8defff}.discard{border:1px solid #ff5369;background:transparent;color:#ff8795}.decision{margin-top:9px;font:800 9px Courier New,monospace;color:#14f195}.cie-empty{padding:28px;text-align:center;color:#7890aa}.cie-history{margin-top:13px;border-top:1px solid rgba(148,163,184,.13);padding-top:12px}.history-row{display:grid;grid-template-columns:1fr 110px 190px;gap:10px;padding:9px;border-bottom:1px solid rgba(148,163,184,.08);font-size:10px}.history-row span:nth-child(2){color:#bd7cff}.history-row span:last-child{color:#7890aa;text-align:right}.cie-nav-active{border-color:rgba(168,85,247,.55)!important;background:rgba(168,85,247,.14)!important;color:#d5a2ff!important;box-shadow:inset 3px 0 #a855f7!important}
  @keyframes ciePulse{50%{transform:scale(1.04);box-shadow:0 0 40px #a855f788}}@media(max-width:1200px){.cie-grid{grid-template-columns:1fr 1fr}}@media(max-width:760px){.cie-grid{grid-template-columns:1fr}.cie-head{align-items:flex-start;flex-direction:column}.history-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

function mount(){
  if(document.getElementById('cie-center'))return;
  injectStyles();
  const main=document.querySelector('main.content');
  if(!main)return;
  const host=document.createElement('section');
  host.id='cie-center';
  host.className='cie-shell';
  host.innerHTML=`<div class="cie-head"><div class="cie-title"><div class="cie-orb">◈</div><div><h2>CAMPAIGN INTELLIGENCE ENGINE</h2><small>DOMINIC analiza, recomienda y justifica. El operador autorizado decide.</small></div></div><div class="hai">HUMAN APPROVED INTELLIGENCE · ACTIVO</div></div><div id="cie-recommendations" class="cie-grid"></div><div class="cie-history"><div class="panel-title"><h3>HISTORIAL DE DECISIONES</h3><span>TRAZABILIDAD HAI</span></div><div id="cie-history"></div></div>`;
  const top=main.querySelector('.topbar');
  top?.insertAdjacentElement('afterend',host);

  const nav=document.querySelector('.nav');
  if(nav&&!document.getElementById('cie-nav')){
    const b=document.createElement('button');
    b.id='cie-nav';
    b.textContent='◈ INTELIGENCIA DE CAMPAÑAS';
    b.onclick=()=>{
      document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('cie-nav-active'));
      b.classList.add('cie-nav-active');
      host.scrollIntoView({behavior:'smooth',block:'start'});
      history.replaceState(null,'','#intelligence');
    };
    nav.insertBefore(b,nav.children[1]||null);
  }

  document.querySelectorAll('.nav button').forEach(btn=>{
    const label=btn.textContent.trim().toUpperCase();
    if(label.includes('COLABORADORES'))btn.onclick=()=>{
      document.getElementById('collaborators')?.scrollIntoView({behavior:'smooth',block:'start'});
      history.replaceState(null,'','#collaborators');
    };
    if(label.includes('CAA SOC'))btn.onclick=()=>{location.href='./caa-admin.html#threats'};
    if(label.includes('CAMPAÑAS'))btn.onclick=()=>{
      document.getElementById('campaign-builder')?.scrollIntoView({behavior:'smooth',block:'start'});
      history.replaceState(null,'','#campaigns');
    };
  });

  if(location.hash==='#intelligence')setTimeout(()=>host.scrollIntoView({block:'start'}),250);
}

function analyze(){
  const ps=sessions.filter(s=>s.campaignType==='phishing'||s.campaignType==='phishing-awareness'||String(s.campaignId||'').toLowerCase().includes('ph'));
  const grouped={};
  for(const s of ps){
    const department=s.department||'Sin departamento';
    (grouped[department]??=[]).push(s);
  }
  const priorityWeight={ALTA:3,MEDIA:2,BAJA:1};
  let recs=Object.entries(grouped).map(([department,arr])=>{
    const total=arr.length;
    const clicked=arr.filter(x=>x.linkClicked||x.clicked||x.status==='clicked'||x.lastEventType==='phishing_link_clicked').length;
    const completed=arr.filter(x=>x.tutorialCompleted||x.trainingCompleted||x.status==='completed'||Number(x.quizScore)>=80).length;
    const scores=arr.map(x=>Number(x.quizScore)).filter(Number.isFinite);
    const avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;
    const risk=total?Math.round(clicked/total*100):0;
    const priority=(risk>=50||(avg>0&&avg<70))?'ALTA':(risk>=25||(avg>0&&avg<80))?'MEDIA':'BAJA';
    const confidence=Math.min(97,72+Math.min(total,15)+Math.round(risk/8));
    return{
      id:`${department}-${total}-${clicked}`,
      department,total,clicked,completed,avg,risk,priority,confidence,
      scenario:risk>=40?'Restablecimiento de acceso y verificación de enlaces':'Reconocimiento de remitentes y dominios',
      reason:clicked?`${clicked} de ${total} participantes pulsaron el enlace educativo. ${completed<clicked?`${clicked-completed} aún requieren completar o aprobar el entrenamiento.`:'El grupo completó el aprendizaje; conviene validar la retención periódica.'}`:'No se registran clics de riesgo; se recomienda una campaña periódica para validar la retención.'
    };
  });
  recs.sort((a,b)=>(priorityWeight[b.priority]-priorityWeight[a.priority])||(b.risk-a.risk));
  if(!recs.length){
    recs=[{id:'baseline-onboarding',department:'Población inicial del cliente',total:0,clicked:0,completed:0,avg:0,risk:0,priority:'MEDIA',confidence:82,scenario:'Campaña diagnóstica de phishing básico',reason:'Todavía no existe telemetría histórica suficiente. DOMINIC recomienda una campaña diagnóstica controlada para establecer la línea base.'}];
  }
  return recs.slice(0,6);
}

function formatDate(v){
  const d=v?.toDate?v.toDate():null;
  return d?d.toLocaleString('es-DO',{dateStyle:'short',timeStyle:'short'}):'pendiente';
}

function render(){
  const el=document.getElementById('cie-recommendations');
  if(!el)return;
  const recs=analyze();
  el.innerHTML=recs.map(r=>{
    const prior=r.priority==='ALTA'?'#ff5369':r.priority==='MEDIA'?'#ffc928':'#14f195';
    const decision=decisions.find(d=>d.recommendationId===r.id);
    return`<article class="rec" style="--prio:${prior}"><div class="rec-top"><span class="priority">PRIORIDAD ${r.priority}</span><span class="confidence">CONFIANZA ${r.confidence}%</span></div><h3>${esc(r.scenario)}</h3><div class="target">Público sugerido: <b>${esc(r.department)}</b></div><p class="reason">${esc(r.reason)}</p><div class="metrics"><div class="metric"><b>${r.total}</b><small>PARTICIPANTES</small></div><div class="metric"><b>${r.risk}%</b><small>EXPOSICIÓN</small></div><div class="metric"><b>${r.avg||'--'}</b><small>QUIZ PROMEDIO</small></div></div><div class="rec-actions"><button class="approve" data-action="approved" data-id="${esc(r.id)}">APROBAR</button><button class="modify" data-action="modified" data-id="${esc(r.id)}">MODIFICAR</button><button class="discard" data-action="discarded" data-id="${esc(r.id)}">DESCARTAR</button></div>${decision?`<div class="decision">DECISIÓN: ${esc(decision.status).toUpperCase()} · SIN ENVÍO AUTOMÁTICO</div>`:''}</article>`;
  }).join('');
  el.querySelectorAll('button[data-action]').forEach(b=>b.onclick=()=>decide(b.dataset.id,b.dataset.action,recs.find(r=>r.id===b.dataset.id)));

  const h=document.getElementById('cie-history');
  h.innerHTML=decisions.length?decisions.slice(0,12).map(d=>`<div class="history-row"><b>${esc(d.scenario||d.recommendationId)}</b><span>${esc(String(d.status||'').toUpperCase())}</span><span>${esc(d.decidedBy||'Operador SOC')} · ${esc(formatDate(d.decidedAt))}</span></div>`).join(''):'<div class="cie-empty">Aún no existen decisiones registradas.</div>';
}

async function decide(id,status,rec){
  const user=auth.currentUser;
  if(!user)return;
  let note='';
  if(status==='modified')note=prompt('Describe brevemente el ajuste requerido para esta recomendación:','Revisar destinatarios, plantilla y fecha antes de aprobar.')||'Modificación solicitada';
  if(status==='discarded'&&!confirm('¿Descartar esta recomendación? La decisión quedará auditada.'))return;
  if(status==='approved'&&!confirm('¿Aprobar esta recomendación para preparar una campaña? Esta acción NO enviará correos.'))return;
  await addDoc(collection(db,'campaign_recommendation_decisions'),{
    recommendationId:id,status,scenario:rec?.scenario||'',department:rec?.department||'',priority:rec?.priority||'',confidence:rec?.confidence||0,note,
    decidedBy:user.email||user.uid,decidedAt:serverTimestamp(),executionAuthorized:false,automaticSending:false,governanceModel:'Human Approved Intelligence'
  });
}

mount();
onAuthStateChanged(auth,user=>{
  if(!user)return;
  onSnapshot(collection(db,'sessions'),snap=>{
    sessions=snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  });
  onSnapshot(collection(db,'campaign_recommendation_decisions'),snap=>{
    decisions=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.decidedAt?.seconds||0)-(a.decidedAt?.seconds||0));
    render();
  });
});