/**
 * SPA super simples com hash routing (#/login, #/members, #/attendance, #/filters)
 *
 * \u26a0\ufe0f PONTOS DE INTEGRAÇÃO COM O BACKEND (rotas REST/JSON sugeridas):
 * - POST   /api/auth/login            { email, password } => { token, user }
 * - GET    /api/users/me              Authorization: Bearer <token>
 * - GET    /api/members               => [{ id, name, roles:[...], status, createdAt }]
 * - POST   /api/members               { name, roles:[], status } => { id }
 * - PUT    /api/members/:id           { name, roles:[], status }
 * - GET    /api/attendance?date=YYYY-MM-DD  => [{ memberId, presence: 'P'|'F'|'FJ' }]
 * - PUT    /api/attendance/:date      { entries:[{ memberId, presence }] }
 * - GET    /api/roles                 => ["Professor","Líder","Aluno",...]
 *
 * Observação: Aqui simulamos com armazenamento local (localStorage) e mocks.
 */

// ======= Estado global =======
const state = {
  token: null,
  user: null,
  members: [],
  roles: ["Professor","Líder","Aluno","Auxiliar","Visitante"],
  attendanceByDate: {}, // { '2025-08-10': { memberId: 'P'|'F'|'FJ' } }
};

// Utilitários
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmt = {
  date(d){return new Date(d).toISOString().slice(0,10)}
}

// Persistência local (simula DB)
const storage = {
  save(){ localStorage.setItem('diario.state', JSON.stringify({members: state.members, attendanceByDate: state.attendanceByDate})) },
  load(){ const raw = localStorage.getItem('diario.state'); if(raw){ try{ const {members, attendanceByDate} = JSON.parse(raw); state.members = members||[]; state.attendanceByDate = attendanceByDate||{}; }catch(e){} } }
}

// Mock inicial (apenas na primeira vez)
function ensureSeed(){
  if(!localStorage.getItem('diario.seeded')){
    state.members = [
      {id: crypto.randomUUID(), name:'Ana Clara', roles:['Aluno'], status:'frequente', createdAt: fmt.date(new Date())},
      {id: crypto.randomUUID(), name:'Bruno Lima', roles:['Professor','Líder'], status:'frequente', createdAt: fmt.date(new Date())},
      {id: crypto.randomUUID(), name:'Carla Souza', roles:['Auxiliar'], status:'licenca', createdAt: fmt.date(new Date())},
      {id: crypto.randomUUID(), name:'Diego Alves', roles:['Aluno'], status:'afastado', createdAt: fmt.date(new Date())},
    ];
    state.attendanceByDate = {};
    storage.save();
    localStorage.setItem('diario.seeded','1');
  }
}

// ======= Router =======
const routes = ['login','members','attendance','filters'];
function setActiveNav(hash){
  $$('#nav a').forEach(a=>a.classList.toggle('active', a.getAttribute('href')===hash));
}
function renderNav(){
  const nav = $('#nav');
  nav.innerHTML = '';
  if(!state.token){ return; }
  const links = [
    ['#/members','Membros'],
    ['#/attendance','Lista de Presença'],
    ['#/filters','Filtros']
  ];
  links.forEach(([href,label])=>{
    const a = document.createElement('a'); a.href = href; a.textContent = label; nav.appendChild(a);
  });
}
function show(view){
  routes.forEach(v=>{ const el = $('#view-'+v); if(el) el.hidden = true; });
  const target = $('#view-'+view); if(target) target.hidden = false;
  setActiveNav('#/'+view);
}
function navigate(){
  const hash = location.hash || '#/login';
  const view = hash.replace('#/','');
  if(!state.token && view!== 'login'){ location.hash = '#/login'; return; }
  switch(view){
    case 'login': show('login'); break;
    case 'members': renderMembers(); show('members'); break;
    case 'attendance': renderAttendanceDates(); show('attendance'); break;
    case 'filters': renderFilterDates(); show('filters'); break;
    default: location.hash = '#/members';
  }
}
window.addEventListener('hashchange', navigate);

// ======= Autenticação (mock) =======
function renderUserBox(){
  const box = $('#userBox');
  if(state.token){
    box.innerHTML = `<span class="muted">${state.user?.email||'usuário'}</span> <button class="btn" id="btnLogout">Sair</button>`;
    $('#btnLogout')?.addEventListener('click', ()=>{ state.token=null; state.user=null; renderNav(); navigate(); renderUserBox(); });
  } else {
    box.innerHTML = '';
  }
}
$('#loginForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = fd.get('email'); const password = fd.get('password');
  // \u27a4 Backend real: POST /api/auth/login {email,password}
  if(email && password){
    state.token = 'mock-token';
    state.user = { id:'1', name:'Demo', email };
    renderNav(); renderUserBox(); location.hash = '#/members';
  }
});

// ======= Membros =======
function renderMembers(){
  const tbody = $('#membersTable tbody');
  const query = $('#memberSearch').value.toLowerCase();
  const selectedRole = $('#filterMemberRole') ? $('#filterMemberRole').value : '';

  // Filtra membros por nome e cargo
  const filtered = state.members.filter(m => 
    m.name.toLowerCase().includes(query) &&
    (!selectedRole || m.roles.includes(selectedRole))
  );

  // Atualiza contador total e contador por cargo
  $('#membersCount').textContent = `${filtered.length} membro(s)`;
  if(selectedRole){
    const countRole = filtered.length;
    $('#membersByRoleCount').textContent = `${countRole} membro(s) nesse cargo`;
  } else {
    $('#membersByRoleCount').textContent = '';
  }

  tbody.innerHTML = '';
  filtered.forEach(m=>{
    const tr = document.createElement('tr');
    const rolesBadges = m.roles.map(r=>`<span class="badge">${r}</span>`).join(' ');
    const statusBadge = {
      'frequente': `<span class="badge success"><span class="status-dot status-frequente"></span>Frequente</span>`,
      'afastado': `<span class="badge"><span class="status-dot status-afastado"></span>Afastado</span>`,
      'licenca': `<span class="badge warn"><span class="status-dot status-licenca"></span>Licença</span>`
    }[m.status] || '';
    tr.innerHTML = `
      <td data-label="Nome">${m.name}</td>
      <td data-label="Cargos">${rolesBadges||'<span class=muted>—</span>'}</td>
      <td data-label="Situação">${statusBadge}</td>
      <td data-label="Ações"><button class="btn" data-edit="${m.id}">Editar</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Adiciona evento para abrir diálogo de edição
  $$('button[data-edit]').forEach(b => b.addEventListener('click', ()=>openMemberDialog(b.dataset.edit)));
}

// Atualiza a lista ao digitar
$('#memberSearch').addEventListener('input', renderMembers);
$('#filterMemberRole')?.addEventListener('change', renderMembers);
$('#btnNewMember').addEventListener('click', ()=>openMemberDialog());

// Função de diálogo de cadastro/edição de membro
function openMemberDialog(id){
  const dlg = $('#memberDialog');
  const editing = !!id;
  $('#memberDialogTitle').textContent = editing ? 'Editar membro' : 'Cadastrar membro';
  $('#memberId').value = id||'';

  // Roles checkboxes
  const rolesArea = $('#rolesArea'); 
  rolesArea.innerHTML = '';
  state.roles.forEach(role=>{
    const label = document.createElement('label');
    label.style.display='inline-flex';
    label.style.alignItems='center';
    label.style.gap='6px';
    label.innerHTML = `<input type="checkbox" value="${role}"> ${role}`;
    rolesArea.appendChild(label);
  });

  // Reset campos
  $('#memberName').value = '';
  $('#memberStatus').value = 'frequente';

  if(editing){
    const m = state.members.find(x=>x.id===id);
    if(m){
      $('#memberName').value = m.name; 
      $('#memberStatus').value = m.status;
      $$('#rolesArea input[type=checkbox]').forEach(cb => cb.checked = m.roles.includes(cb.value));
    }
  }

  dlg.showModal();

  dlg.addEventListener('close', ()=>{
    if(dlg.returnValue==='default'){
      const name = $('#memberName').value.trim();
      const status = $('#memberStatus').value;
      const roles = $$('#rolesArea input:checked').map(cb=>cb.value);
      if(!name) return;

      if(editing){
        const i = state.members.findIndex(x=>x.id===id);
        if(i>-1) state.members[i] = {...state.members[i], name, status, roles};
        // ➤ Backend real: PUT /api/members/:id
      } else {
        state.members.push({ id: crypto.randomUUID(), name, status, roles, createdAt: fmt.date(new Date()) });
        // ➤ Backend real: POST /api/members
      }
      storage.save(); 
      renderMembers();
    }
  }, {once:true});
}

// Inicializa o select de cargos do filtro
function renderMemberRoleFilter(){
  const sel = $('#filterMemberRole');
  sel.innerHTML = '<option value="">Todos os cargos</option>';
  state.roles.forEach(role => {
    const opt = document.createElement('option');
    opt.value = role; opt.textContent = role;
    sel.appendChild(opt);
  });
}
renderMemberRoleFilter();
renderMembers();


// ======= Lista de Presença =======
function sundaysAround(startDate=new Date(), weeks=52){
  // gera últimos e próximos domingos
  const dates = new Set();
  const start = new Date(startDate);
  for(let i=-weeks;i<=weeks;i++){
    const d = new Date(start); d.setDate(d.getDate()+i*7);
    // Ajusta para domingo (0)
    const delta = d.getDay(); // 0..6
    d.setDate(d.getDate()-delta); // volta até domingo
    dates.add(fmt.date(d));
  }
  return Array.from(dates).sort();
}
function renderAttendanceDates(){
  const sel = $('#attendanceDate'); sel.innerHTML='';
  sundaysAround(new Date(), 60).forEach(iso=>{
    const o = document.createElement('option'); o.value = iso; o.textContent = new Date(iso).toLocaleDateString(); sel.appendChild(o);
  });
}
$('#btnLoadAttendance').addEventListener('click', ()=>{
  const date = $('#attendanceDate').value; loadAttendance(date); renderAttendanceTable(date);
});
$('#btnSaveAttendance').addEventListener('click', ()=>{
  const date = $('#attendanceDate').value; if(!date) return;
  // \u27a4 Backend real: PUT /api/attendance/:date { entries }
  storage.save();
  alert('Presenças salvas para '+ new Date(date).toLocaleDateString());
});

function loadAttendance(date){
  // \u27a4 Backend real: GET /api/attendance?date=YYYY-MM-DD
  if(!state.attendanceByDate[date]) state.attendanceByDate[date] = {};
}
function renderAttendanceTable(date){
  const tbody = $('#attendanceTable tbody');
  tbody.innerHTML='';
  const map = state.attendanceByDate[date]||{};
  // Apenas membros não-afastados aparecem; licença aparece como inativo
  const list = state.members.filter(m=>m.status!== 'afastado');
  list.sort((a,b)=>a.name.localeCompare(b.name));
  list.forEach(m=>{
    const current = map[m.id] || 'P'; // default Presente
    const tr = document.createElement('tr');
    const disabled = m.status==='licenca';
    tr.innerHTML = `
      <td data-label="Nome">${m.name}</td>
      <td data-label="Situação">${{
        'frequente':'Frequente', 'afastado':'Afastado', 'licenca':'Licença'
      }[m.status]}</td>
      <td data-label="Presença">
        <div class="row" style="gap:8px;align-items:center">
          <button class="btn" data-cycle="${m.id}" ${disabled?'disabled':''}>${renderPresenceLabel(current)}</button>
          <span class="muted">(clique para alternar)</span>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
  $$('button[data-cycle]').forEach(btn=>btn.addEventListener('click',()=>{
    const id = btn.dataset.cycle; const next = cyclePresence(getPresence(date,id)); setPresence(date,id,next); btn.textContent = renderPresenceLabel(next);
  }));
}
function renderPresenceLabel(code){
  // Regras do enunciado: checkbox triestado (vazio=Presente, preenchido=Falta, FJ=Falta Justificada)
  // Aqui usamos um botão que alterna os estados mantendo o conceito visual (P/F/FJ)
  return ({'P':'Presente','F':'Falta','FJ':'Falta Justificada'})[code] || 'Presente';
}
function cyclePresence(code){
  return code==='P' ? 'F' : code==='F' ? 'FJ' : 'P';
}
function getPresence(date, memberId){
  const map = state.attendanceByDate[date]||{}; return map[memberId]||'P';
}
function setPresence(date, memberId, value){
  if(!state.attendanceByDate[date]) state.attendanceByDate[date] = {}; state.attendanceByDate[date][memberId]=value;
}

// ======= Filtros =======

// Preenche o select com datas de domingos
function renderFilterDates() {
  const sel = $('#filterDate');
  sel.innerHTML = '';
  sundaysAround(new Date(), 60).forEach(iso => {
    const o = document.createElement('option');
    o.value = iso;
    o.textContent = new Date(iso).toLocaleDateString();
    sel.appendChild(o);
  });
}

$('#btnRunFilters').addEventListener('click', () => {
  const date = $('#filterDate').value;
  const pres = $('#filterPresence').value;
  const name = $('#filterName').value.toLowerCase();
  const role = $('#filterRole').value.toLowerCase();
  const status = $('#filterStatus').value; // Novo filtro por situação

  const tbody = $('#filtersResult tbody');
  tbody.innerHTML = '';

  const map = state.attendanceByDate[date] || {};
  const data = state.members
    .filter(m => m.name.toLowerCase().includes(name))
    .filter(m => !role || m.roles.some(r => r.toLowerCase().includes(role)))
    .filter(m => !status || m.status === status)
    .map(m => ({ m, presence: map[m.id] || 'P' }))
    .filter(row => !pres || row.presence === pres);

  // Contadores
  let countFaltas = 0;
  let countFaltasJustificadas = 0;
  let totalMembros = data.length;
  let cargosMap = {};

  data.forEach(({ m, presence }) => {
    if (presence === 'F') countFaltas++;
    if (presence === 'FJ') countFaltasJustificadas++;

    m.roles.forEach(cargo => {
      cargosMap[cargo] = (cargosMap[cargo] || 0) + 1;
    });

    // Renderiza a linha
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Data">${new Date(date).toLocaleDateString()}</td>
      <td data-label="Nome">${m.name}</td>
      <td data-label="Cargos">${m.roles.join(', ') || '—'}</td>
      <td data-label="Situação">${m.status}</td>
      <td data-label="Presença">${renderPresenceLabel(presence)}</td>`;
    tbody.appendChild(tr);
  });

  // Atualiza contadores
  $('#countTotalMembers').textContent = totalMembros;
  $('#countFaltas').textContent = countFaltas;
  $('#countFaltasJustificadas').textContent = countFaltasJustificadas;
  $('#countTotalFaltas').textContent = countFaltas + countFaltasJustificadas;
  $('#countMembersByRole').textContent = Object.entries(cargosMap)
    .map(([cargo, qtd]) => `${cargo}: ${qtd}`)
    .join(' | ') || '—';
});

// ======= Inicialização =======
(function init(){
  ensureSeed(); storage.load(); renderNav(); renderUserBox(); navigate();
})();