import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, query, where, serverTimestamp, Timestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
import { firebaseConfig } from './config.js';
import { MATERIALS, STATUS, registration, pointInput, publicationInput, canEdit, canAccept, canComplete, filterPoints } from './domain.js';

const configured = ['apiKey','authDomain','projectId','appId'].every(k => firebaseConfig[k] && !firebaseConfig[k].includes('REEMPLAZAR'));
const firebaseApp = configured ? initializeApp(firebaseConfig) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;
const root = document.querySelector('#app');
let user = null, profile = null, currentSection = 'inicio', renderId = 0;

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}
const brand = () => h('a',{class:'brand',href:'./index.html'},h('span',{class:'brandmark','aria-hidden':'true'},'♻'),'RecycleGo');
const footer = () => h('footer',{},'RecycleGo · Conectamos personas y materiales para darles una nueva vida.');
const setupNotice = () => h('div',{class:'notice'},'Conexión pendiente: completa public/js/config.js con la configuración de tu aplicación web de Firebase y publica firestore.rules en Firestore.');
const empty = text => h('div',{class:'empty'},text);
function friendly(error) {
  const map = {
    'auth/invalid-credential':'El correo o la contraseña son incorrectos.',
    'auth/email-already-in-use':'Ese correo ya está registrado. Inicia sesión con tu cuenta.',
    'auth/weak-password':'Utiliza una contraseña de al menos 8 caracteres.',
    'auth/too-many-requests':'Se realizaron demasiados intentos. Inténtalo nuevamente más tarde.',
    'auth/operation-not-allowed':'Activa Correo/contraseña en Firebase Authentication.',
    'auth/unauthorized-domain':'Agrega el dominio de esta web en los dominios autorizados de Firebase Authentication.',
    'permission-denied':'Firebase rechazó la operación. Revisa las reglas publicadas y los permisos de tu cuenta.',
    'unavailable':'No se pudo conectar con Firebase. Comprueba tu conexión.',
    'auth/network-request-failed':'No se pudo conectar. Comprueba tu conexión a internet.'
  };
  return map[error.code] || error.message || 'No se pudo completar la operación.';
}
function toast(message) {
  document.querySelector('.toast')?.remove();
  const node = h('div',{class:'toast',role:'status'},message);
  document.body.append(node); setTimeout(() => node.remove(), 6500);
}
const guarded = fn => async event => { try { await fn(event); } catch (error) { toast(friendly(error)); } };
function requireFirebase() { if (!configured) throw new Error('Primero completa la configuración de Firebase en public/js/config.js.'); }
const identity = () => ({ uid:user.uid, role:profile.role });
function field(label, name, value = '', props = {}) {
  return h('label',{},label,h('input',{name,value,required:true,...props}));
}
function select(label, name, values, selected = '', required = true) {
  return h('label',{},label,h('select',{name,required},...values.map(v => {
    const [value,text] = Array.isArray(v) ? v : [v,v];
    return h('option',{value,selected:value===selected},text);
  })));
}
function wireForm(form, callback) {
  const error = h('div',{class:'error',role:'alert'});
  form.append(error);
  form.addEventListener('submit', async event => {
    event.preventDefault(); error.textContent='';
    const button=form.querySelector('button[type=submit]'); button.disabled=true;
    try { await callback(Object.fromEntries(new FormData(form)),form); }
    catch (err) { error.textContent=friendly(err); }
    finally { button.disabled=false; }
  });
  return form;
}
function dialog(title, content) {
  const d=h('dialog',{},h('div',{class:'dialog-head'},h('h2',{},title),h('button',{class:'ghost small',type:'button','aria-label':'Cerrar',onclick:()=>d.close()},'✕')),content);
  d.addEventListener('close',()=>d.remove()); document.body.append(d); d.showModal(); return d;
}
function publicHeader() {
  return h('header',{class:'topbar'},brand(),h('nav',{},h('a',{href:'./login.html',class:'btn secondary'},'Iniciar sesión'),h('a',{href:'./registro.html',class:'btn'},'Crear cuenta')));
}
async function allPoints() { requireFirebase(); return (await getDocs(collection(db,'points'))).docs.map(d=>({id:d.id,...d.data()})); }
async function publications() {
  let snaps;
  const base=collection(db,'publications');
  if(profile.role==='ciudadano') snaps=[await getDocs(query(base,where('ownerId','==',user.uid)))];
  else if(profile.role==='recolector') snaps=await Promise.all([
    getDocs(query(base,where('status','==',STATUS.AVAILABLE))), getDocs(query(base,where('collectorId','==',user.uid)))]);
  else snaps=[await getDocs(base)];
  const items=new Map(); snaps.forEach(s=>s.docs.forEach(d=>items.set(d.id,{id:d.id,...d.data()})));
  return [...items.values()].sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
}
function badge(status) {
  const type=status===STATUS.ASSIGNED?'assigned':status===STATUS.DONE?'done':status===STATUS.CANCELLED?'cancelled':'';
  return h('span',{class:`badge ${type}`},status);
}
function dateText(timestamp) {
  return timestamp?.toDate ? new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short'}).format(timestamp.toDate()) : 'Pendiente';
}
function showPoint(point) {
  dialog(point.name,h('div',{class:'detail'},h('dl',{},...[
    ['Dirección',point.address],['Distrito',point.district],['Horario',point.hours],['Materiales',point.materials.join(', ')]
  ].map(([label,value])=>h('div',{},h('dt',{},label),h('dd',{},value))))));
}
function pointCards(points, admin = false) {
  if (!points.length) return empty('No hay puntos de acopio que coincidan con la búsqueda.');
  return h('div',{class:'grid'},...points.map(p=>h('article',{class:'card'},
    h('div',{class:'card-title'},h('h3',{},p.name),h('span',{class:'badge'},p.district)),
    h('p',{class:'muted'},p.address),h('p',{},'Horario: ',p.hours),
    h('div',{class:'chips'},...p.materials.map(m=>h('span',{class:'chip'},m))),
    h('div',{class:'actions'},h('button',{class:'secondary small',onclick:()=>showPoint(p)},'Ver detalle'),
      admin ? h('button',{class:'small',onclick:()=>pointForm(p)},'Editar') : null))));
}
function pointsArea(points, admin = false) {
  const district=field('Distrito','district','',{required:false,placeholder:'Ej. Miraflores'});
  const material=select('Material','material',[['','Todos los materiales'],...MATERIALS],'',false);
  const results=h('div',{},pointCards(points,admin));
  const apply=()=>results.replaceChildren(pointCards(filterPoints(points,district.querySelector('input').value,material.querySelector('select').value),admin));
  district.querySelector('input').addEventListener('input',apply);material.querySelector('select').addEventListener('change',apply);
  return h('section',{},h('div',{class:'section-head'},h('div',{},h('h2',{},'Puntos de acopio'),h('p',{class:'muted'},'Encuentra dónde entregar tus materiales y consulta sus horarios.')),
    admin ? h('button',{onclick:()=>pointForm()},'+ Nuevo punto') : null),
    h('div',{class:'filters'},district,material,h('button',{class:'secondary',onclick:()=>{district.querySelector('input').value='';material.querySelector('select').value='';apply();}},'Limpiar')),
    admin ? h('p',{},h('button',{class:'link-button',onclick:guarded(seedPoints)},'Cargar tres puntos de demostración')) : null,results);
}
async function home() {
  const points=h('section',{id:'puntos'},h('p',{class:'loading'},'Cargando puntos de acopio…'));
  root.replaceChildren(publicHeader(),h('main',{class:'container'},
    h('section',{class:'hero'},h('div',{},h('span',{class:'eyebrow'},'Cada material tiene otra oportunidad'),h('h1',{},'Reciclar empieza con una conexión.'),h('p',{class:'muted'},'Encuentra puntos de acopio, publica tus materiales y coordina su recojo con personas que les darán una nueva vida.'),h('div',{class:'actions'},h('a',{class:'btn',href:'./registro.html'},'Quiero participar'),h('a',{class:'btn secondary',href:'#puntos'},'Buscar puntos de acopio'))),
      h('aside',{class:'hero-art'},h('div',{class:'cycle','aria-hidden':'true'},'♻'),h('h2',{},'Menos residuos. Más posibilidades.'),h('p',{},'Ciudadanos y recolectores unidos por un entorno más limpio.'))),
    h('div',{class:'grid'},...[
      ['01 · Encuentra','Consulta materiales aceptados, direcciones y horarios de los puntos de acopio.'],
      ['02 · Publica','Indica qué materiales tienes, su cantidad y cuándo pueden recogerlos.'],
      ['03 · Conecta','Un recolector acepta el recojo y ambos pueden seguir su estado.']
    ].map(([title,text])=>h('article',{class:'card'},h('h3',{},title),h('p',{class:'muted'},text)))),configured?null:setupNotice(),points),footer());
  if(!configured){points.replaceChildren(empty('Los puntos de acopio aparecerán al conectar Firebase.'));return;}
  try { points.replaceChildren(pointsArea(await allPoints())); }
  catch(error){points.replaceChildren(empty(friendly(error)));}
}
function authPage(register=false) {
  const form=h('form',{},register?field('Nombre completo','name','',{autocomplete:'name',maxLength:80}):null,
    field('Correo electrónico','email','',{type:'email',autocomplete:'email'}),
    field('Contraseña','password','',{type:'password',minLength:8,autocomplete:register?'new-password':'current-password'}),
    register?select('Quiero participar como','role',[['ciudadano','Ciudadano: publicar materiales'],['recolector','Recolector: recoger materiales']],'ciudadano'):null,
    h('button',{type:'submit'},register?'Crear mi cuenta':'Iniciar sesión'));
  wireForm(form,async input=>{
    requireFirebase();
    if(register){
      const valid=registration(input);
      const result=await createUserWithEmailAndPassword(auth,valid.email,valid.password);
      await updateProfile(result.user,{displayName:valid.name});
      await setDoc(doc(db,'users',result.user.uid),{name:valid.name,email:valid.email,role:valid.role,createdAt:serverTimestamp()});
    } else await signInWithEmailAndPassword(auth,input.email.trim().toLowerCase(),input.password);
    location.href='./panel.html';
  });
  root.replaceChildren(publicHeader(),h('main',{class:'auth-layout'},h('section',{class:'auth-copy'},h('span',{class:'eyebrow'},'Una comunidad que transforma'),h('h1',{},register?'Tu próxima acción puede cambiar el destino de un material.':'Qué bueno volver a conectar.'),h('p',{class:'muted'},'Gestiona tus publicaciones y recolecciones en un solo lugar.')),
    h('section',{class:'card auth-card'},h('h2',{},register?'Crea tu cuenta':'Bienvenido a RecycleGo'),h('p',{class:'muted'},register?'Elige cómo quieres participar.':'Ingresa con tu correo y contraseña.'),configured?null:setupNotice(),form,
      h('p',{class:'muted'},register?'¿Ya tienes una cuenta? ':'¿Es tu primera visita? ',h('a',{href:register?'./login.html':'./registro.html'},register?'Inicia sesión':'Regístrate')))),footer());
}
function pointForm(existing=null) {
  const checks=h('div',{class:'checkboxes'},...MATERIALS.map(m=>h('label',{},h('input',{type:'checkbox',name:'materials',value:m,checked:existing?.materials.includes(m)??false}),m)));
  const form=h('form',{},h('div',{class:'form-grid'},field('Nombre del punto','name',existing?.name??'',{maxLength:100}),field('Distrito','district',existing?.district??'',{maxLength:80}),
    field('Dirección','address',existing?.address??'',{maxLength:180}),field('Horario de atención','hours',existing?.hours??'',{placeholder:'Lun-Sáb, 9:00 a 17:00',maxLength:180}),h('label',{class:'span2'},'Materiales aceptados',checks)),h('div',{class:'actions'},h('button',{type:'submit'},'Guardar punto')));
  const d=dialog(existing?'Editar punto de acopio':'Nuevo punto de acopio',form);
  wireForm(form,async(input,node)=>{
    if(profile.role!=='admin')throw new Error('Se requiere el rol administrador.');
    const valid=pointInput({...input,materials:new FormData(node).getAll('materials')});
    if(existing)await updateDoc(doc(db,'points',existing.id),{...valid,updatedAt:serverTimestamp()});
    else await addDoc(collection(db,'points'),{...valid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    d.close();toast('Punto de acopio guardado.');await renderSection();
  });
}
async function seedPoints() {
  if(profile.role!=='admin')throw new Error('Se requiere el rol administrador.');
  const samples=[
    {name:'Punto Verde Miraflores (demo)',district:'Miraflores',address:'Dirección de ejemplo - punto de demostración',hours:'Lun-Sáb, 9:00 a 17:00',materials:['Papel','Cartón','Plástico']},
    {name:'Centro Circular Surco (demo)',district:'Surco',address:'Dirección de ejemplo - punto de demostración',hours:'Lun-Vie, 8:30 a 16:30',materials:['Vidrio','Metal','Plástico']},
    {name:'EcoTech San Borja (demo)',district:'San Borja',address:'Dirección de ejemplo - punto de demostración',hours:'Sábados, 9:00 a 13:00',materials:['Aparatos electrónicos','Metal']}
  ];
  for(let i=0;i<samples.length;i++)await setDoc(doc(db,'points',`demo-${i+1}`),{...samples[i],createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  toast('Puntos ficticios de demostración cargados.');await renderSection();
}
function pubForm(existing=null) {
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const dateDefault=[tomorrow.getFullYear(),String(tomorrow.getMonth()+1).padStart(2,'0'),String(tomorrow.getDate()).padStart(2,'0')].join('-');
  const form=h('form',{},h('div',{class:'form-grid'},select('Material','material',MATERIALS,existing?.material??MATERIALS[0]),
    field('Cantidad aproximada','quantity',existing?.quantity??'',{type:'number',min:'0.01',max:'1000000',step:'any'}),select('Unidad','unit',['kg','unidades'],existing?.unit??'kg'),
    field('Distrito','district',existing?.district??'',{maxLength:80}),field('Dirección de recojo','address',existing?.address??'',{maxLength:180}),
    field('Fecha disponible','availableDate',existing?.availableDate??dateDefault,{type:'date'}),field('Desde','timeStart',existing?.timeStart??'09:00',{type:'time'}),field('Hasta','timeEnd',existing?.timeEnd??'18:00',{type:'time'})),
    h('div',{class:'actions'},h('button',{type:'submit'},existing?'Guardar cambios':'Publicar materiales')));
  const d=dialog(existing?'Editar publicación':'Publicar materiales disponibles',form);
  wireForm(form,async input=>{
    const valid=publicationInput(input);valid.availableUntil=Timestamp.fromDate(valid.availableUntil);
    if(existing){
      if(!canEdit(existing,identity()))throw new Error('Solo puedes editar tus publicaciones disponibles.');
      await updateDoc(doc(db,'publications',existing.id),{...valid,updatedAt:serverTimestamp()});
    } else await addDoc(collection(db,'publications'),{...valid,ownerId:user.uid,ownerName:profile.name,status:STATUS.AVAILABLE,
      collectorId:null,collectorName:null,acceptedAt:null,completedAt:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    d.close();toast(existing?'Publicación actualizada.':'Materiales publicados.');await renderSection();
  });
}
async function cancelPublication(pub) {
  if(!canEdit(pub,identity()))throw new Error('La publicación ya no se puede cancelar.');
  if(!confirm('¿Confirmas que deseas cancelar esta publicación?'))return;
  await updateDoc(doc(db,'publications',pub.id),{status:STATUS.CANCELLED,updatedAt:serverTimestamp()});
  toast('Publicación cancelada.');await renderSection();
}
async function acceptPublication(pub) {
  if(!confirm('¿Confirmas que recogerás los materiales en la fecha y horario publicados?'))return;
  await runTransaction(db,async transaction=>{
    const reference=doc(db,'publications',pub.id),snapshot=await transaction.get(reference);
    if(!snapshot.exists()||!canAccept(snapshot.data(),identity()))throw new Error('Esta publicación ya no está disponible.');
    transaction.update(reference,{status:STATUS.ASSIGNED,collectorId:user.uid,collectorName:profile.name,acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  });
  toast('Recolección aceptada. Consulta la dirección en Mis recolecciones.');currentSection='recolecciones';await renderSection();
}
async function completePublication(pub) {
  if(!confirm('¿Confirmas que ya recogiste los materiales?'))return;
  await runTransaction(db,async transaction=>{
    const reference=doc(db,'publications',pub.id),snapshot=await transaction.get(reference);
    if(!snapshot.exists()||!canComplete(snapshot.data(),identity()))throw new Error('No puedes finalizar esta recolección.');
    transaction.update(reference,{status:STATUS.DONE,completedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  });
  toast('Recolección finalizada. Se guardó en el historial.');await renderSection();
}
function pubDetail(pub) {
  const own=pub.ownerId===user.uid||pub.collectorId===user.uid||profile.role==='admin';
  dialog('Detalle de la publicación',h('div',{},badge(pub.status),h('dl',{class:'detail'},...[
    ['Material',`${pub.material} · ${pub.quantity} ${pub.unit}`],['Ciudadano',pub.ownerName],['Distrito',pub.district],
    ['Dirección',own?pub.address:'Disponible después de aceptar la recolección'],['Disponibilidad',`${pub.availableDate} · ${pub.timeStart} a ${pub.timeEnd}`],
    ['Recolector',pub.collectorName||'Sin asignar'],['Aceptación',dateText(pub.acceptedAt)],['Finalización',dateText(pub.completedAt)]
  ].map(([label,value])=>h('div',{},h('dt',{},label),h('dd',{},value))))));
}
function pubTable(items) {
  if(!items.length)return empty('No hay publicaciones en esta sección.');
  return h('div',{class:'table-wrap'},h('table',{},h('thead',{},h('tr',{},...['Material / cantidad','Distrito','Disponibilidad','Estado','Acciones'].map(t=>h('th',{scope:'col'},t)))),
    h('tbody',{},...items.map(p=>h('tr',{},h('td',{},h('strong',{},p.material),h('div',{class:'muted'},`${p.quantity} ${p.unit}`)),h('td',{},p.district),
      h('td',{},p.availableDate,h('div',{class:'muted'},`${p.timeStart} - ${p.timeEnd}`)),h('td',{},badge(p.status)),h('td',{},h('div',{class:'actions'},
        h('button',{class:'secondary small',onclick:()=>pubDetail(p)},'Detalle'),
        canEdit(p,identity())?[h('button',{class:'small',onclick:()=>pubForm(p)},'Editar'),h('button',{class:'danger small',onclick:guarded(()=>cancelPublication(p))},'Cancelar')]:null,
        canAccept(p,identity())?h('button',{class:'small',onclick:guarded(()=>acceptPublication(p))},'Aceptar'):null,
        canComplete(p,identity())?h('button',{class:'small',onclick:guarded(()=>completePublication(p))},'Finalizar'):null)))))));
}
const labels={inicio:'Mi resumen',puntos:'Puntos de acopio',publicaciones:'Publicaciones',oportunidades:'Materiales disponibles',recolecciones:'Mis recolecciones e historial'};
function shell() {
  const tabs=['inicio','puntos',...(profile.role==='recolector'?['oportunidades','recolecciones']:['publicaciones'])];
  root.replaceChildren(h('div',{class:'shell'},h('aside',{class:'sidebar'},brand(),h('nav',{class:'nav-list','aria-label':'Menú principal'},...tabs.map(key=>h('button',{class:currentSection===key?'active':'',onclick:guarded(async()=>{currentSection=key;await renderSection();})},labels[key]))),
    h('div',{class:'sidebar-bottom'},h('div',{},h('div',{class:'person'},profile.name),h('div',{class:'role'},profile.role)),h('button',{class:'ghost small',onclick:guarded(async()=>{await signOut(auth);location.href='./login.html';})},'Cerrar sesión'))),
    h('main',{class:'main'},h('header',{class:'panel-header'},h('h2',{},'Tu espacio RecycleGo'),h('span',{class:'badge'},'Conectado a Firebase')),
      h('div',{class:'workspace',id:'workspace'},h('p',{class:'loading'},'Cargando información…')))));
}
async function renderSection() {
  const token=++renderId;shell();const workspace=document.querySelector('#workspace');
  try {
    if(currentSection==='puntos'){
      const points=await allPoints();if(token!==renderId)return;workspace.replaceChildren(pointsArea(points,profile.role==='admin'));return;
    }
    const pubs=await publications();if(token!==renderId)return;
    if(currentSection==='inicio'){
      const stats=[['Publicaciones visibles',pubs.length],['En recolección',pubs.filter(p=>p.status===STATUS.ASSIGNED).length],['Recolecciones finalizadas',pubs.filter(p=>p.status===STATUS.DONE).length]];
      workspace.replaceChildren(h('div',{class:'section-head'},h('div',{},h('span',{class:'eyebrow'},'Un pequeño gesto, un gran cambio'),h('h2',{},`Hola, ${profile.name.split(' ')[0]}`),h('p',{class:'muted'},'Consulta tu actividad y continúa conectando materiales con nuevas oportunidades.'))),
        h('div',{class:'grid'},...stats.map(([title,value])=>h('article',{class:'card stat'},h('span',{},title),h('strong',{},value),h('span',{},'Según los registros de tu perfil')))),
        h('div',{class:'section-head'},h('h2',{},'Actividad reciente'),h('button',{class:'secondary small',onclick:guarded(renderSection)},'Actualizar')),pubTable(pubs.slice(0,5)));return;
    }
    const selected=currentSection==='oportunidades'?pubs.filter(p=>canAccept(p,identity())):currentSection==='recolecciones'?pubs.filter(p=>p.collectorId===user.uid):pubs;
    workspace.replaceChildren(h('div',{class:'section-head'},h('div',{},h('h2',{},labels[currentSection]),h('p',{class:'muted'},currentSection==='oportunidades'?'Acepta una publicación para coordinar su recolección.':'Consulta el detalle, las fechas y el estado de cada registro.')),
      profile.role==='ciudadano'&&currentSection==='publicaciones'?h('button',{onclick:()=>pubForm()},'+ Publicar materiales'):h('button',{class:'secondary',onclick:guarded(renderSection)},'Actualizar')),pubTable(selected));
  } catch(error){if(token===renderId)workspace.replaceChildren(h('div',{class:'error',role:'alert'},friendly(error)),h('button',{class:'secondary',onclick:guarded(renderSection)},'Reintentar'));}
}
function recoverProfile() {
  const form=h('form',{},field('Nombre completo','name',user.displayName||'',{maxLength:80}),select('Participaré como','role',[['ciudadano','Ciudadano'],['recolector','Recolector']],'ciudadano'),h('button',{type:'submit'},'Guardar perfil'));
  wireForm(form,async input=>{
    if(!input.name.trim()||!['ciudadano','recolector'].includes(input.role))throw new Error('Completa tu nombre y rol.');
    await setDoc(doc(db,'users',user.uid),{name:input.name.trim(),email:user.email,role:input.role,createdAt:serverTimestamp()});location.reload();
  });
  root.replaceChildren(publicHeader(),h('main',{class:'container'},h('section',{class:'card'},h('h2',{},'Completa tu perfil'),h('p',{class:'muted'},'Tu cuenta existe. Guarda los datos de tu perfil para continuar.'),form)));
}
function panel() {
  if(!configured){root.replaceChildren(publicHeader(),h('main',{class:'container'},setupNotice()));return;}
  onAuthStateChanged(auth,async account=>{
    if(!account){location.replace('./login.html');return;}
    user=account;
    try {
      const snapshot=await getDoc(doc(db,'users',user.uid));
      if(!snapshot.exists()){recoverProfile();return;}
      profile=snapshot.data();await renderSection();
    }catch(error){root.replaceChildren(publicHeader(),h('main',{class:'container'},h('div',{class:'error'},friendly(error))));}
  });
}
const page=document.body.dataset.page;
if(page==='home')home();else if(page==='login')authPage();else if(page==='register')authPage(true);else panel();
