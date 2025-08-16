from flask import request, jsonify, render_template
from functools import wraps
import jwt, datetime
from src import app
from src.services.servisos import (
    authenticate_user, 
    create_user, 
    get_user_by_id, 
    list_members, 
    create_member, 
    update_member, 
    list_attendance, 
    update_attendance, 
    list_roles
)

# ===== Rota principal para SPA =====
@app.route('/')
def index():
    return render_template('index.html')

# ===== Autenticação JWT =====
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth = request.headers['Authorization']
            if auth.startswith('Bearer '):
                token = auth[7:]
        
        if not token:
            return jsonify({'message': 'Token é necessário!'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = get_user_by_id(data['id'])
            if not current_user:
                return jsonify({'message': 'Usuário não encontrado!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token expirado!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token inválido!'}), 401
        except Exception as e:
            return jsonify({'message': 'Erro ao validar token!'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

# ===== Rotas de Autenticação =====
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        if not data:
            return jsonify({'message': 'Dados não fornecidos!'}), 400
        
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'message': 'Email e senha são obrigatórios!'}), 400
        
        user = authenticate_user(email, password)
        if not user:
            return jsonify({'message': 'Email ou senha inválidos!'}), 401
        
        # Usar timezone-aware datetime
        token = jwt.encode({
            'id': user.id, 
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=12)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            'token': token, 
            'user': {
                'id': user.id, 
                'name': user.name, 
                'email': user.email
            }
        })
    except Exception as e:
        print(f"Erro no login: {e}")
        return jsonify({'message': 'Erro interno do servidor'}), 500

@app.route('/api/users/me', methods=['GET'])
@token_required
def me(current_user):
    return jsonify({
        'id': current_user.id, 
        'name': current_user.name, 
        'email': current_user.email
    })

# ===== Rotas de Usuários =====
@app.route('/api/users', methods=['POST'])
def create_user_route():
    try:
        data = request.json
        if not data:
            return jsonify({'message': 'Dados não fornecidos!'}), 400

        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()

        if not name or not email or not password:
            return jsonify({'message': 'Os campos name, email e password são obrigatórios!'}), 400

        user_id = create_user(data)
        return jsonify({'id': user_id, 'message': 'Usuário criado com sucesso!'}), 201
        
    except ValueError as e:
        # Erros de validação (ex: email já existe)
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        print(f"Erro ao criar usuário: {e}")
        return jsonify({'message': 'Erro interno do servidor'}), 500

# ===== Rotas de Membros =====
@app.route('/api/members', methods=['GET'])
@token_required
def get_members_route(current_user):
    try:
        members = list_members()
        # Garantir que cada membro tenha a estrutura esperada pelo frontend
        formatted_members = []
        for member in members:
            formatted_member = {
                'id': str(member.get('id', '')),
                'name': member.get('name', ''),
                'roles': member.get('roles', []),
                'status': member.get('status', 'frequente'),
                'createdAt': member.get('createdAt', '')
            }
            formatted_members.append(formatted_member)
        
        return jsonify(formatted_members)
    except Exception as e:
        print(f"Erro ao listar membros: {e}")
        return jsonify({'message': 'Erro ao carregar membros'}), 500

@app.route('/api/members', methods=['POST'])
@token_required
def create_member_route(current_user):
    try:
        data = request.json
        if not data:
            return jsonify({'message': 'Dados não fornecidos!'}), 400

        name = data.get('name', '').strip()
        if not name:
            return jsonify({'message': 'Nome é obrigatório!'}), 400

        # Validar dados opcionais
        roles = data.get('roles', [])
        status = data.get('status', 'frequente')
        
        if status not in ['frequente', 'afastado', 'licenca']:
            return jsonify({'message': 'Status inválido!'}), 400

        member_id = create_member(data)
        return jsonify({'id': member_id}), 201
        
    except Exception as e:
        print(f"Erro ao criar membro: {e}")
        return jsonify({'message': 'Erro ao criar membro'}), 500

# CORREÇÃO PRINCIPAL: Rota de atualização de membro
@app.route('/api/members/<member_id>', methods=['PUT'])
@token_required
def update_member_route(current_user, member_id):
    try:
        print(f"Tentando atualizar membro ID: {member_id}")  # Debug
        
        data = request.json
        if not data:
            return jsonify({'message': 'Dados não fornecidos!'}), 400

        print(f"Dados recebidos: {data}")  # Debug
        
        # Validar se os dados básicos estão presentes
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'message': 'Nome é obrigatório!'}), 400
        
        # Validar status se fornecido
        status = data.get('status', 'frequente')
        if status not in ['frequente', 'afastado', 'licenca']:
            return jsonify({'message': 'Status inválido!'}), 400
        
        # Validar roles se fornecido
        roles = data.get('roles', [])
        if not isinstance(roles, list):
            return jsonify({'message': 'Roles deve ser uma lista!'}), 400

        # Chama a função de atualização
        success = update_member(member_id, data)
        
        if success:
            return jsonify({'message': 'Membro atualizado com sucesso'})
        else:
            return jsonify({'message': 'Membro não encontrado'}), 404
        
    except ValueError as e:
        print(f"Erro de validação: {e}")
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        print(f"Erro ao atualizar membro: {e}")
        return jsonify({'message': 'Erro interno do servidor'}), 500

# ===== Rotas de Presença =====
@app.route('/api/attendance', methods=['GET'])
@token_required
def get_attendance_route(current_user):
    try:
        date_str = request.args.get('date')
        if not date_str:
            return jsonify({'message': 'Parâmetro date é obrigatório!'}), 400
        
        # Validar formato da data (YYYY-MM-DD)
        try:
            datetime.datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return jsonify({'message': 'Formato de data inválido! Use YYYY-MM-DD'}), 400
        
        attendance_list = list_attendance(date_str)
        
        # Garantir formato esperado pelo frontend (agora incluindo observation)
        formatted_attendance = []
        for record in attendance_list:
            formatted_record = {
                'memberId': str(record.get('memberId', '')),
                'presence': record.get('presence', 'P'),
                'observation': record.get('observation', '')  # ✅ inclui observação
            }
            formatted_attendance.append(formatted_record)
        
        return jsonify(formatted_attendance)
        
    except Exception as e:
        print(f"Erro ao carregar presença: {e}")
        return jsonify({'message': 'Erro ao carregar presença'}), 500



@app.route('/api/attendance/<date>', methods=['PUT'])
@token_required
def put_attendance_route(current_user, date):
    try:
        # Validar formato da data
        try:
            datetime.datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return jsonify({'message': 'Formato de data inválido! Use YYYY-MM-DD'}), 400
        
        data = request.json
        if not data or 'entries' not in data:
            return jsonify({'message': 'Campo entries é obrigatório!'}), 400
        
        entries = data['entries']
        if not isinstance(entries, list):
            return jsonify({'message': 'Entries deve ser uma lista!'}), 400
        
        # Validar cada entrada
        for entry in entries:
            if not isinstance(entry, dict):
                return jsonify({'message': 'Cada entrada deve ser um objeto!'}), 400
            if 'memberId' not in entry or 'presence' not in entry:
                return jsonify({'message': 'Cada entrada deve ter memberId e presence!'}), 400
            if entry['presence'] not in ['P', 'F', 'FJ']:
                return jsonify({'message': 'Presence deve ser P, F ou FJ!'}), 400
            # observation é opcional, não precisa validar
        
        update_attendance(date, entries)
        return jsonify({'message': 'Presença atualizada com sucesso'})
        
    except Exception as e:
        print(f"Erro ao atualizar presença: {e}")
        return jsonify({'message': 'Erro ao atualizar presença'}), 500


# ===== Rotas de Cargos =====
@app.route('/api/roles', methods=['GET'])
@token_required
def get_roles_route(current_user):
    try:
        roles = list_roles()
        return jsonify(roles)
    except Exception as e:
        print(f"Erro ao carregar cargos: {e}")
        return jsonify({'message': 'Erro ao carregar cargos'}), 500

# ===== Tratamento de Erros Globais =====
@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Endpoint não encontrado'}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'message': 'Método não permitido'}), 405

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'message': 'Erro interno do servidor'}), 500