/**
 * SPA super simples com hash routing (#/login, #/members, #/attendance, #/filters)
 */

// ======= Estado global =======
const state = {
  token: null,
  user: null,
  members: [],
  roles: ["Professor","Líder","Aluno","Auxiliar","Visitante"], // fallback
  attendanceByDate: {},
};

// Utilitários
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmt = {
  date(d){return new Date(d).toISOString().slice(0,10)},
  monthYear(d){return new Date(d).toISOString().slice(0,7)} // YYYY-MM
}

// ======= Funções de integração com backend =======
async function api(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

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

    renderNav();
    renderUserBox();
    
    // Carrega dados essenciais após login
    await loadMembers();
    await loadRoles();
    
    navigate();
    location.hash = '#/members';
  } catch (err) {
    state.token = null;
    state.user = null;
    renderNav();
    renderUserBox();
    navigate();
    location.hash = '#/login';
    alert('Login inválido!');
  }
});

// ======= Carregar membros do backend =======
async function loadMembers() {
  try {
    state.members = await api('/api/members');
    // Carrega dados de presença após carregar membros
    await loadAllAttendanceData();
    renderMembers();
  } catch (err) {
    console.error('Erro ao carregar membros:', err);
    state.members = [];
    renderMembers();
  }
}


// ======= Carregar cargos do backend =======
async function loadRoles() {
  try {
    const roles = await api('/api/roles');
    state.roles = roles;
    
    // Atualiza TODOS os selects de cargos na aplicação
    renderMemberRoleFilter();
    renderFilterRoleSelect();
    
  } catch (err) {
    console.error('Erro ao carregar cargos:', err);
    // Mantém os cargos padrão em caso de erro
    state.roles = ["Professor","Líder","Aluno","Auxiliar","Visitante"];
    renderMemberRoleFilter();
    renderFilterRoleSelect();
  }
}

// ======= Criar/Editar membro via backend =======
async function saveMember(data, editing, id) {
  try {
    if (editing) {
      await api(`/api/members/${id}`, 'PUT', data);
    } else {
      await api('/api/members', 'POST', data);
    }
    await loadMembers();
  } catch (err) {
    console.error('Erro ao salvar membro:', err);
    alert('Erro ao salvar membro: ' + err.message);
  }
}

// ======= Funções para análise de faltas =======
function getMemberAbsences(memberId) {
  const absences = [];
  for (const [date, attendanceMap] of Object.entries(state.attendanceByDate)) {
    const presence = attendanceMap[memberId];
    if (presence === 'F' || presence === 'FJ') {
      absences.push({
        date,
        type: presence,
        month: fmt.monthYear(date)
      });
    }
  }
  return absences.sort((a, b) => a.date.localeCompare(b.date));
}

function getUnexcusedAbsencesCount(memberId) {
  return getMemberAbsences(memberId).filter(a => a.type === 'F').length;
}

function getAbsencesByMonth(memberId) {
  const absences = getMemberAbsences(memberId);
  const byMonth = {};
  
  absences.forEach(absence => {
    if (!byMonth[absence.month]) {
      byMonth[absence.month] = { total: 0, excused: 0, unexcused: 0 };
    }
    byMonth[absence.month].total++;
    if (absence.type === 'F') {
      byMonth[absence.month].unexcused++;
    } else {
      byMonth[absence.month].excused++;
    }
  });
  
  return byMonth;
}

function hasExcessiveAbsences(memberId) {
  return getUnexcusedAbsencesCount(memberId) >= 3;
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
    const a = document.createElement('a'); 
    a.href = href; 
    a.textContent = label; 
    nav.appendChild(a);
  });
}

function show(view){
  routes.forEach(v=>{ 
    const el = $('#view-'+v); 
    if(el) el.hidden = true; 
  });
  
  const target = $('#view-'+view); 
  if(target) target.hidden = false;
  setActiveNav('#/'+view);
}

function navigate(){
  const hash = location.hash || '#/login';
  const view = hash.replace('#/','');
  
  if(!state.token && view !== 'login'){ 
    location.hash = '#/login'; 
    return; 
  }
  
  switch(view){
    case 'login': 
      show('login'); 
      break;
    case 'members': 
      renderMembers(); 
      show('members'); 
      break;
    case 'attendance': 
     
      show('attendance'); 
      break;
    case 'filters': 
      renderFilterDates(); 
      show('filters'); 
      break;
    default: 
      location.hash = '#/members';
  }
}

window.addEventListener('hashchange', navigate);

// ======= Autenticação - User Box =======
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
        const name = $('#userName')?.value.trim() || $('#nome')?.value.trim();
        const email = $('#userEmail').value.trim();
        const password = $('#userPassword').value.trim();

        if (!name || !email || !password) {
          alert('Todos os campos são obrigatórios!');
          return;
        }

        try {
          await api('/api/users', 'POST', { name, email, password });
          alert('Usuário cadastrado com sucesso!');
          dlg.querySelector('form').reset();
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

// ======= Membros =======
function renderMembers(){
  const tbody = $('#membersTable tbody');
  const query = $('#memberSearch').value.toLowerCase();
  const selectedRole = $('#filterMemberRole').value;

  // Filtra membros por nome e cargo
  const filtered = state.members.filter(m => {
    const matchesName = m.name.toLowerCase().includes(query);
    const matchesRole = !selectedRole || (m.roles && m.roles.includes(selectedRole));
    return matchesName && matchesRole;
  });

  // Atualiza contadores
  $('#membersCount').textContent = `${filtered.length} membro(s)`;
  if(selectedRole){
    $('#membersByRoleCount').textContent = `${filtered.length} membro(s) nesse cargo`;
  } else {
    $('#membersByRoleCount').textContent = '';
  }

  tbody.innerHTML = '';
  filtered.forEach(m=>{
    const tr = document.createElement('tr');
    const rolesBadges = (m.roles || []).map(r=>`<span class="badge">${r}</span>`).join(' ');
    const statusBadge = {
      'frequente': `<span class="badge success"><span class="status-dot status-frequente"></span>Frequente</span>`,
      'afastado': `<span class="badge"><span class="status-dot status-afastado"></span>Afastado</span>`,
      'licenca': `<span class="badge warn"><span class="status-dot status-licenca"></span>Licença</span>`
    }[m.status] || '';
    
    // Verifica se o membro tem muitas faltas não justificadas
    const hasExcessive = hasExcessiveAbsences(m.id);
    const rowClass = hasExcessive ? 'class="excessive-absences"' : '';
    
    tr.innerHTML = `
      <td data-label="Nome" ${rowClass}>${m.name}${hasExcessive ? ' ⚠️' : ''}</td>
      <td data-label="Cargos">${rolesBadges||'<span class=muted>—</span>'}</td>
      <td data-label="Situação">${statusBadge}</td>
      <td data-label="Ações"><button class="btn" data-edit="${m.id}">Editar</button></td>
    `;
    
    if (hasExcessive) {
      tr.classList.add('excessive-absences');
    }
    
    tbody.appendChild(tr);
  });

  // Adiciona evento para abrir diálogo de edição
  $$('button[data-edit]').forEach(b => 
    b.addEventListener('click', ()=>openMemberDialog(b.dataset.edit))
  );
}

// Função para renderizar o select de filtro por cargo na tela de membros
function renderMemberRoleFilter(){
  const select = $('#filterMemberRole');
  if (!select) return;
  
  select.innerHTML = '<option value="">Todos os cargos</option>';
  
  state.roles.forEach(role => {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = role;
    select.appendChild(option);
  });
}

// Função para renderizar o select de filtro por cargo na tela de filtros
function renderFilterRoleSelect(){
  const select = $('#filterRole');
  if (!select) return;
  
  select.innerHTML = '<option value="">Todos os cargos</option>';
  
  state.roles.forEach(role => {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = role;
    select.appendChild(option);
  });
}

// Event listeners para filtros
$('#memberSearch')?.addEventListener('input', renderMembers);
$('#filterMemberRole')?.addEventListener('change', renderMembers);
$('#btnNewMember')?.addEventListener('click', ()=>openMemberDialog());

// Função de diálogo de cadastro/edição de membro
$('#btnCancelMember')?.addEventListener('click', () => {
  const dlg = $('#memberDialog');
  if (dlg) {
    dlg.close();
    resetMemberDialog();
  }
});

function resetMemberDialog() {
  $('#memberName').value = '';
  $('#memberStatus').value = 'frequente';
  $$('#rolesArea input[type=checkbox]').forEach(cb => cb.checked = false);
  $('#memberId').value = '';
  $('#memberDialogTitle').textContent = 'Cadastrar membro';
}

function openMemberDialog(id) {
  const dlg = $('#memberDialog');
  const editing = !!id;
  
  $('#memberDialogTitle').textContent = editing ? 'Editar membro' : 'Cadastrar membro';
  $('#memberId').value = id || '';

  // Cria checkboxes para roles
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
  resetMemberDialog();

  if (editing) {
    const m = state.members.find(x => x.id === id);
    if (m) {
      $('#memberName').value = m.name;
      $('#memberStatus').value = m.status;
      $$('#rolesArea input[type=checkbox]').forEach(cb => {
        cb.checked = (m.roles || []).includes(cb.value);
      });
    }
  }

  dlg.showModal();

  dlg.addEventListener('close', async () => {
    if (dlg.returnValue === 'default') {
      const name = $('#memberName').value.trim();
      const status = $('#memberStatus').value;
      const roles = $$('#rolesArea input:checked').map(cb => cb.value);
      
      if (!name) {
        alert('Nome é obrigatório!');
        return;
      }
      
      await saveMember({ name, status, roles }, editing, id);
    }
  }, { once: true });
}

// ====================== Carregar e enviar presença da data selecionada ======================
async function loadAllAttendanceData() {
    const date = $('#attendanceDate').value;
    if (!date) return alert('Selecione uma data');

    try {
        console.log(`Carregando dados de presença para ${date}...`);

        // Carrega os dados atuais do backend
        await loadAttendance(date);

        // Garante que seja um array
        const attendanceData = Array.isArray(state.attendanceByDate[date])
            ? state.attendanceByDate[date]
            : [];

        // Prepara entries para enviar via PUT
        const membersList = state.members.filter(m => m.status !== 'afastado');
        const entries = membersList.map(member => {
            const att = attendanceData.find(a => a.memberId === member.id) || {};
            return {
                memberId: member.id,
                presence: att.status === 'falta' ? 'F' :
                          att.status === 'fj' ? 'FJ' :
                          'P', // padrão presente
                observation: att.observation || ''
            };
        });

        // Envia PUT para atualizar o banco
        const res = await fetch(`/api/attendance/${date}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ entries })
        });

        if (!res.ok) throw new Error('Falha ao atualizar presença');
        console.log(`Presença atualizada para ${date}`);
        alert('Presença carregada e enviada com sucesso!');

        // Atualiza a tabela
        renderAttendanceTable(date);

    } catch (err) {
        console.error(`Erro ao processar presença para ${date}:`, err);
        alert('Erro ao processar presença. Veja console para detalhes.');
    }
}
// ======= Lista de Presença =======
function sundaysAround(startDate = new Date(), weeks = 52) {
  const dates = new Set();
  const start = new Date(startDate);
  for (let i = -weeks; i <= weeks; i++) {
    const d = new Date(start); 
    d.setDate(d.getDate() + i * 7);
    const delta = d.getDay();
    d.setDate(d.getDate() - delta);
    dates.add(fmt.date(d));
  }
  return Array.from(dates).sort();
}

function renderAttendanceDates() {
  const sel = $('#attendanceDate'); 
  sel.innerHTML = '';
  sundaysAround(new Date(), 60).forEach(iso => {
    const o = document.createElement('option'); 
    o.value = iso; 
    o.textContent = new Date(iso).toLocaleDateString(); 
    sel.appendChild(o);
  });
}

$('#btnLoadAttendance')?.addEventListener('click', async () => {
  const date = $('#attendanceDate').value; 
  await loadAttendance(date); 
  renderAttendanceTable(date);
});

$('#btnSaveAttendance')?.addEventListener('click', async () => {
  const date = $('#attendanceDate').value; 
  if (!date) return alert('Selecione uma data');

  // Criar entries para todos os membros
  const membersList = state.members.filter(m => m.status !== 'afastado');
  const entries = membersList.map(m => ({
      memberId: m.id,
      presence: getPresence(date, m.id), // retorna 'P' se não tiver
      observation: '' // ou pegar observation se quiser
  }));

  try {
    await api(`/api/attendance/${date}`, 'PUT', { entries });
    alert('Presenças salvas para ' + new Date(date).toLocaleDateString());
  } catch (err) {
    alert('Erro ao salvar presenças: ' + err.message);
  }
});

async function loadAttendance(date) {
  if (!date) return; // evita popup
  try {
    const records = await api(`/api/attendance?date=${date}`);
    state.attendanceByDate[date] = {};
    records.forEach(r => { 
      state.attendanceByDate[date][r.memberId] = r.presence; 
    });
  } catch (err) {
    console.error('Erro ao carregar presença:', err);
    state.attendanceByDate[date] = {};
  }
}


function renderAttendanceTable(date) {
  const tbody = $('#attendanceTable tbody');
  tbody.innerHTML = '';
  const map = state.attendanceByDate[date] || {};
  const list = state.members.filter(m => m.status !== 'afastado');
  
  list.sort((a, b) => a.name.localeCompare(b.name));
  
  list.forEach(m => {
    const current = map[m.id] || 'P';
    const tr = document.createElement('tr');
    const disabled = m.status === 'licenca';
    const hasExcessive = hasExcessiveAbsences(m.id);
    
    if (hasExcessive) {
      tr.classList.add('excessive-absences');
    }
    
    tr.innerHTML = `
      <td data-label="Nome">${m.name}${hasExcessive ? ' ⚠️' : ''}</td>
      <td data-label="Situação">${{
        'frequente': 'Frequente', 
        'afastado': 'Afastado', 
        'licenca': 'Licença'
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
    const id = btn.dataset.cycle; 
    const next = cyclePresence(getPresence(date, id)); 
    setPresence(date, id, next); 
    btn.textContent = renderPresenceLabel(next);
  }));
}

function renderPresenceLabel(code) {
  return ({ 'P': 'Presente', 'F': 'Falta', 'FJ': 'Falta Justificada' })[code] || 'Presente';
}

function cyclePresence(code) {
  return code === 'P' ? 'F' : code === 'F' ? 'FJ' : 'P';
}

function getPresence(date, memberId) {
  const map = state.attendanceByDate[date] || {}; 
  return map[memberId] || 'P';
}

function setPresence(date, memberId, value) {
  if (!state.attendanceByDate[date]) state.attendanceByDate[date] = {}; 
  state.attendanceByDate[date][memberId] = value;
}

// ======= Filtros =======
function renderFilterDates() {
  const sel = $('#filterDate');
  sel.innerHTML = '';
  
  // Adiciona opção para todos os períodos
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Todos os períodos';
  sel.appendChild(allOption);
  
  sundaysAround(new Date(), 60).forEach(iso => {
    const o = document.createElement('option');
    o.value = iso;
    o.textContent = new Date(iso).toLocaleDateString();
    sel.appendChild(o);
  });
}

// Função para renderizar o select de membros para análise de faltas
function renderMemberSelect() {
  const select = $('#absenceAnalysisMember');
  if (!select) return;
  
  select.innerHTML = '<option value="">Selecione um membro</option>';
  
  state.members
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(member => {
      const option = document.createElement('option');
      option.value = member.id;
      
      // Adiciona informação sobre faltas no texto da opção
      const unexcusedCount = getUnexcusedAbsencesCount(member.id);
      const totalAbsences = getMemberAbsences(member.id).length;
      const warning = unexcusedCount >= 3 ? ' ⚠️' : '';
      
      option.textContent = `${member.name}${warning} (${totalAbsences} faltas, ${unexcusedCount} não justif.)`;
      select.appendChild(option);
    });
}

// Função para análise de faltas de um membro específico
$('#btnAnalyzeMemberAbsences')?.addEventListener('click', () => {
  const memberId = $('#absenceAnalysisMember').value;
  const analysisType = $('#absenceAnalysisType').value;
  
  if (!memberId) {
    alert('Selecione um membro para análise');
    return;
  }
  
  const member = state.members.find(m => m.id === memberId);
  const tbody = $('#absenceAnalysisResult tbody');
  tbody.innerHTML = '';
  
  console.log('Analisando faltas para membro:', member.name);
  console.log('Dados de presença disponíveis:', Object.keys(state.attendanceByDate));
  
  if (analysisType === 'all-absences') {
    // Lista todas as datas que o membro faltou
    const absences = getMemberAbsences(memberId);
    
    console.log('Faltas encontradas:', absences);
    
    $('#absenceAnalysisTitle').textContent = `Todas as faltas de ${member.name}`;
    $('#absenceAnalysisCount').textContent = `Total: ${absences.length} falta(s) | Não justificadas: ${absences.filter(a => a.type === 'F').length} | Justificadas: ${absences.filter(a => a.type === 'FJ').length}`;
    
    if (absences.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">Nenhuma falta registrada ou dados de presença não carregados</td></tr>';
    } else {
      absences.forEach(absence => {
        const tr = document.createElement('tr');
        const typeClass = absence.type === 'F' ? 'style="color: #dc3545; font-weight: 500;"' : '';
        tr.innerHTML = `
          <td>${new Date(absence.date).toLocaleDateString('pt-BR')}</td>
          <td ${typeClass}>${absence.type === 'F' ? '❌ Falta' : '⚠️ Falta Justificada'}</td>
          <td>${new Date(absence.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}</td>
        `;
        tbody.appendChild(tr);
      });
    }
    
  } else if (analysisType === 'monthly-summary') {
    // Resumo mensal de faltas
    const monthlyData = getAbsencesByMonth(memberId);
    
    console.log('Dados mensais:', monthlyData);
    
    $('#absenceAnalysisTitle').textContent = `Resumo mensal de faltas - ${member.name}`;
    
    const totalAbsences = Object.values(monthlyData).reduce((sum, data) => sum + data.total, 0);
    const totalUnexcused = Object.values(monthlyData).reduce((sum, data) => sum + data.unexcused, 0);
    
    $('#absenceAnalysisCount').textContent = `${Object.keys(monthlyData).length} mês(es) com faltas | Total geral: ${totalAbsences} falta(s) | Não justificadas: ${totalUnexcused}`;
    
    if (Object.keys(monthlyData).length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">Nenhuma falta registrada ou dados de presença não carregados</td></tr>';
    } else {
      Object.entries(monthlyData)
        .sort(([a], [b]) => b.localeCompare(a)) // Ordenar por mês (mais recente primeiro)
        .forEach(([month, data]) => {
          const tr = document.createElement('tr');
          const monthName = new Date(month + '-01').toLocaleDateString('pt-BR', { 
            year: 'numeric', 
            month: 'long' 
          });
          
          const alertClass = data.unexcused >= 2 ? 'style="background-color: #fff3cd; border-left: 3px solid #ffc107;"' : '';
          
          tr.innerHTML = `
            <td ${alertClass}>${monthName}</td>
            <td ${alertClass}><strong>${data.total}</strong> falta(s)</td>
            <td ${alertClass}>
              <span style="color: #dc3545;">❌ ${data.unexcused} não justificadas</span><br>
              <span style="color: #ffc107;">⚠️ ${data.excused} justificadas</span>
            </td>
          `;
          tbody.appendChild(tr);
        });
    }
  }
  
  // Mostra a seção de análise
  $('#absenceAnalysisSection').style.display = 'block';
});

$('#btnRunFilters')?.addEventListener('click', () =>{
  const date = $('#filterDate').value;
  const pres = $('#filterPresence').value;
  const name = $('#filterName').value.toLowerCase();
  const role = $('#filterRole').value.toLowerCase();
  const status = $('#filterStatus').value;

  const tbody = $('#filtersResult tbody');
  tbody.innerHTML = '';

  // Se uma data específica for selecionada, usar dados daquela data
  // Se não, usar todos os membros sem filtro de presença
  let data = [];
  
  if (date) {
    // Filtro por data específica
    const map = state.attendanceByDate[date] || {};
    data = state.members
      .filter(m => m.name.toLowerCase().includes(name))
      .filter(m => !role || (m.roles || []).some(r => r.toLowerCase().includes(role)))
      .filter(m => !status || m.status === status)
      .map(m => ({ m, presence: map[m.id] || 'P', date: date }))
      .filter(row => !pres || row.presence === pres);
  } else {
    // Filtro por todos os períodos - mostra todos os membros
    data = state.members
      .filter(m => m.name.toLowerCase().includes(name))
      .filter(m => !role || (m.roles || []).some(r => r.toLowerCase().includes(role)))
      .filter(m => !status || m.status === status)
      .map(m => ({ m, presence: 'N/A', date: 'Todos os períodos' }));
    
    // Se filtrar por presença e não há data específica, não mostrar resultados
    if (pres) {
      data = [];
    }
  }

  // Contadores
  let countFaltas = 0;
  let countFaltasJustificadas = 0;
  let totalMembros = data.length;
  let cargosMap = {};
  let membrosComMuitasFaltas = 0;

  data.forEach(({ m, presence, date: itemDate }) => {
    if (presence === 'F') countFaltas++;
    if (presence === 'FJ') countFaltasJustificadas++;

    (m.roles || []).forEach(cargo => {
      cargosMap[cargo] = (cargosMap[cargo] || 0) + 1;
    });

    const hasExcessive = hasExcessiveAbsences(m.id);
    if (hasExcessive) membrosComMuitasFaltas++;

    const tr = document.createElement('tr');
    if (hasExcessive) {
      tr.classList.add('excessive-absences');
    }
    
    tr.innerHTML = `
      <td data-label="Data">${itemDate === 'Todos os períodos' ? 'Todos os períodos' : new Date(itemDate).toLocaleDateString()}</td>
      <td data-label="Nome">${m.name}${hasExcessive ? ' ⚠️' : ''}</td>
      <td data-label="Cargos">${(m.roles || []).join(', ') || '—'}</td>
      <td data-label="Situação">${m.status}</td>
      <td data-label="Presença">${presence === 'N/A' ? '—' : renderPresenceLabel(presence)}</td>`;
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
  $('#countExcessiveAbsences').textContent = membrosComMuitasFaltas;
  
  // Mensagem explicativa quando filtrar por todos os períodos
  if (!date && data.length > 0) {
    const infoRow = document.createElement('tr');
    infoRow.innerHTML = `
      <td colspan="5" style="text-align: center; font-style: italic; color: #666; background-color: #f9f9f9;">
        <small>Mostrando todos os membros. Para ver dados de presença, selecione uma data específica.</small>
      </td>`;
    tbody.appendChild(infoRow);
  }
  
  // Mensagem quando tentar filtrar presença sem data específica
  if (!date && pres) {
    const warningRow = document.createElement('tr');
    warningRow.innerHTML = `
      <td colspan="5" style="text-align: center; font-style: italic; color: #e74c3c; background-color: #fdf2f2;">
        <small>Para filtrar por presença, selecione uma data específica.</small>
      </td>`;
    tbody.appendChild(warningRow);
  }
  
  // Atualiza o select de membros para análise após carregar dados
  renderMemberSelect();
  
  // Mostra informação sobre dados carregados
  console.log('Dados de presença disponíveis para análise:', Object.keys(state.attendanceByDate).length, 'datas');
  console.log('Membros com dados de presença:', state.members.map(m => ({
    name: m.name,
    absences: getMemberAbsences(m.id).length,
    unexcused: getUnexcusedAbsencesCount(m.id)
  })));
});

// ======= Modal de Cadastro de Usuário =======
$('#formCadastro')?.addEventListener('submit', async function(event) {
  event.preventDefault();
  
  const nome = $('#nome').value.trim();
  const email = $('#userEmail').value.trim();
  const password = $('#userPassword').value.trim();

  if (!nome || !email || !password) {
    alert('Todos os campos são obrigatórios!');
    return;
  }

  try {
    await api('/api/users', 'POST', { name: nome, email, password });
    alert('Usuário cadastrado com sucesso!');
    this.reset();
    $('#userDialog').close();
  } catch (err) {
    alert('Erro ao cadastrar usuário: ' + err.message);
  }
});

$('#btnCancelar')?.addEventListener('click', function() {
  $('#formCadastro').reset();
  $('#userDialog').close();
});

// ======= Inicialização =======
(async function init() {
  renderNav(); 
  renderUserBox(); 
  navigate();
})();