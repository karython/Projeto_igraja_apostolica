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