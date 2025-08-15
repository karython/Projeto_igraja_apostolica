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


// ======= Funções de integração com backend =======
async function api(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Add the token to the Authorization header if available
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ======= Autenticação =======
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = fd.get('email');
  const password = fd.get('password');
  try {
    const resp = await api('/api/auth/login', 'POST', { email, password });
    state.token = resp.token;
    state.user = resp.user;

    // Atualiza navegação e redireciona para a página de membros
    renderNav();
    renderUserBox();
    await loadMembers();
    await loadRoles();
    navigate(); // Garante que o roteador seja chamado
    location.hash = '#/members'; // Redireciona para a página de membros
  } catch (err) {
    state.token = null;
    state.user = null;
    renderNav();
    renderUserBox();
    navigate(); // Garante que o roteador seja chamado
    location.hash = '#/login'; // Redireciona para a página de login
    alert('Login inválido!');
  }
});

// ======= Carregar membros do backend =======
async function loadMembers() {
  try {
    state.members = await api('/api/members');
    renderMembers();
  } catch (err) {
    state.members = [];
    renderMembers();
  }
}

// ======= Carregar cargos do backend =======
async function loadRoles() {
  try {
    state.roles = await api('/api/roles');
    renderMemberRoleFilter();
  } catch (err) {
    state.roles = ["Professor","Líder","Aluno","Auxiliar","Visitante"];
    renderMemberRoleFilter();
  }
}

// ======= Criar/Editar membro via backend =======
async function saveMember(data, editing, id) {
  if (editing) {
    await api(`/api/members/${id}`, 'PUT', data);
  } else {
    await api('/api/members', 'POST', data);
  }
  await loadMembers();
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
  box.innerHTML = `
    <button class="btn" id="btnOpenUserModal">Cadastrar Usuário</button>
    ${state.token ? `<span class="muted">${state.user?.email||'usuário'}</span> <button class="btn" id="btnLogout">Sair</button>` : ''}
  `;
  $('#btnOpenUserModal')?.addEventListener('click', () => {
    const dlg = $('#userDialog');
    dlg.showModal();

    dlg.addEventListener('close', async () => {
      if (dlg.returnValue === 'default') {
        const name = $('#userName').value.trim();
        const email = $('#userEmail').value.trim();
        const password = $('#userPassword').value.trim();

        if (!name || !email || !password) {
          alert('Todos os campos são obrigatórios!');
          return;
        }

        try {
          await api('/api/users', 'POST', { name, email, password });
          alert('Usuário cadastrado com sucesso!');
        } catch (err) {
          alert('Erro ao cadastrar usuário: ' + err.message);
        }
      }
    }, { once: true });
  });

  if (state.token) {
    $('#btnLogout')?.addEventListener('click', () => {
      state.token = null;
      state.user = null;
      renderNav();
      navigate();
      renderUserBox();
    });
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
$('#btnCancelMember').addEventListener('click', () => {
  const dlg = $('#memberDialog');
  if (dlg) {
    dlg.close(); // fecha o modal
    $('#memberName').value = '';
    $('#memberStatus').value = 'frequente';
    $$('#rolesArea input[type=checkbox]').forEach(cb => cb.checked = false);
    $('#memberId').value = '';
    $('#memberDialogTitle').textContent = 'Cadastrar membro';
  }
});
function openMemberDialog(id) {
  const dlg = $('#memberDialog');
  const editing = !!id;
  $('#memberDialogTitle').textContent = editing ? 'Editar membro' : 'Cadastrar membro';
  $('#memberId').value = id || '';

  // Roles checkboxes
  const rolesArea = $('#rolesArea');
  rolesArea.innerHTML = '';
  state.roles.forEach(role => {
    const label = document.createElement('label');
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '6px';
    label.innerHTML = `<input type="checkbox" value="${role}"> ${role}`;
    rolesArea.appendChild(label);
  });

  // Reset campos
  $('#memberName').value = '';
  $('#memberStatus').value = 'frequente';

  if (editing) {
    const m = state.members.find(x => x.id === id);
    if (m) {
      $('#memberName').value = m.name;
      $('#memberStatus').value = m.status;
      $$('#rolesArea input[type=checkbox]').forEach(cb => cb.checked = m.roles.includes(cb.value));
    }
  }

  dlg.showModal();

  dlg.addEventListener('close', async () => {
    if (dlg.returnValue === 'default') {
      const name = $('#memberName').value.trim();
      const status = $('#memberStatus').value;
      const roles = $$('#rolesArea input:checked').map(cb => cb.value);
      if (!name) return;
      await saveMember({ name, status, roles }, editing, id);
    }
  }, { once: true });
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
function sundaysAround(startDate = new Date(), weeks = 52) {
  // gera últimos e próximos domingos
  const dates = new Set();
  const start = new Date(startDate);
  for (let i = -weeks; i <= weeks; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i * 7);
    // Ajusta para domingo (0)
    const delta = d.getDay(); // 0..6
    d.setDate(d.getDate() - delta); // volta até domingo
    dates.add(fmt.date(d));
  }
  return Array.from(dates).sort();
}
function renderAttendanceDates() {
  const sel = $('#attendanceDate'); sel.innerHTML = '';
  sundaysAround(new Date(), 60).forEach(iso => {
    const o = document.createElement('option'); o.value = iso; o.textContent = new Date(iso).toLocaleDateString(); sel.appendChild(o);
  });
}
$('#btnLoadAttendance').addEventListener('click', async () => {
  const date = $('#attendanceDate').value; await loadAttendance(date); renderAttendanceTable(date);
});
$('#btnSaveAttendance').addEventListener('click', async () => {
  const date = $('#attendanceDate').value; if (!date) return;
  // Salva presença no backend
  const entries = Object.entries(state.attendanceByDate[date] || {}).map(([memberId, presence]) => ({ memberId, presence }));
  await api(`/api/attendance/${date}`, 'PUT', { entries });
  alert('Presenças salvas para ' + new Date(date).toLocaleDateString());
});

async function loadAttendance(date) {
  // Carrega presença do backend
  try {
    const records = await api(`/api/attendance?date=${date}`);
    state.attendanceByDate[date] = {};
    records.forEach(r => { state.attendanceByDate[date][r.memberId] = r.presence; });
  } catch (err) {
    state.attendanceByDate[date] = {};
  }
}
function renderAttendanceTable(date) {
  const tbody = $('#attendanceTable tbody');
  tbody.innerHTML = '';
  const map = state.attendanceByDate[date] || {};
  // Apenas membros não-afastados aparecem; licença aparece como inativo
  const list = state.members.filter(m => m.status !== 'afastado');
  list.sort((a, b) => a.name.localeCompare(b.name));
  list.forEach(m => {
    const current = map[m.id] || 'P'; // default Presente
    const tr = document.createElement('tr');
    const disabled = m.status === 'licenca';
    tr.innerHTML = `
      <td data-label="Nome">${m.name}</td>
      <td data-label="Situação">${{
        'frequente': 'Frequente', 'afastado': 'Afastado', 'licenca': 'Licença'
      }[m.status]}</td>
      <td data-label="Presença">
        <div class="row" style="gap:8px;align-items:center">
          <button class="btn" data-cycle="${m.id}" ${disabled ? 'disabled' : ''}>${renderPresenceLabel(current)}</button>
          <span class="muted">(clique para alternar)</span>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
  $$('button[data-cycle]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.cycle; const next = cyclePresence(getPresence(date, id)); setPresence(date, id, next); btn.textContent = renderPresenceLabel(next);
  }));
}
function renderPresenceLabel(code) {
  return ({ 'P': 'Presente', 'F': 'Falta', 'FJ': 'Falta Justificada' })[code] || 'Presente';
}
function cyclePresence(code) {
  return code === 'P' ? 'F' : code === 'F' ? 'FJ' : 'P';
}
function getPresence(date, memberId) {
  const map = state.attendanceByDate[date] || {}; return map[memberId] || 'P';
}
function setPresence(date, memberId, value) {
  if (!state.attendanceByDate[date]) state.attendanceByDate[date] = {}; state.attendanceByDate[date][memberId] = value;
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
(async function init() {
  renderNav(); renderUserBox(); navigate();
})();

// Abrir modal de cadastro de usuário
document.querySelector('#btnOpenUserModal').addEventListener('click', () => {
  const dlg = document.querySelector('#userDialog');
  if (dlg) {
    dlg.showModal();
  } else {
    console.error('Modal de cadastro de usuário não encontrada!');
  }
});

// Evento para validar o formulário de cadastro
document.getElementById('formCadastro').addEventListener('submit', async function(event) {
  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const password = document.getElementById('userPassword').value.trim();

  if (nome === '' || email === '' || password === '') {
    alert('Todos os campos são obrigatórios!');
    event.preventDefault(); // Impede o envio do formulário
    return;
  }

  try {
    await api('/api/users', 'POST', { name: nome, email, password });
    alert('Usuário cadastrado com sucesso!');
    document.getElementById('formCadastro').reset(); // Limpa o formulário
    document.querySelector('#userDialog').close(); // Fecha a modal
  } catch (err) {
    alert('Erro ao cadastrar usuário: ' + err.message);
    event.preventDefault(); // Impede o envio do formulário
  }
});

// Evento para cancelar o cadastro
document.getElementById('btnCancelar').addEventListener('click', function() {
  document.getElementById('formCadastro').reset(); // Limpa os campos do formulário
  alert('Cadastro cancelado!');
  document.querySelector('#userDialog').close(); // Fecha a modal
});
async function loadRoles() {
  try {
    const roles = await api('/api/roles', 'GET'); // Supondo que a rota /api/roles retorna a lista de cargos
    const filterRole = document.getElementById('filterRole');
    filterRole.innerHTML = '<option value="">Todos os cargos</option>'; // Reseta as opções

    roles.forEach(role => {
      const option = document.createElement('option');
      option.value = role;
      option.textContent = role;
      filterRole.appendChild(option);
    });
  } catch (err) {
    console.error('Erro ao carregar cargos:', err);
  }
}

// Chama a função ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  loadRoles();
});