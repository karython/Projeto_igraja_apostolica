from flask import request, jsonify, render_template
from functools import wraps
import jwt, datetime
from src import app
from src.services.servisos import authenticate_user, create_user, get_user_by_id, list_members, create_member, update_member, list_attendance, update_attendance, list_roles

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
        except:
            return jsonify({'message': 'Token inválido!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# ===== Rotas =====
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    user = authenticate_user(email, password)
    if not user:
        return jsonify({'message': 'Email ou senha inválidos!'}), 401
    token = jwt.encode({'id': user.id, 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12)}, app.config['SECRET_KEY'])
    return jsonify({'token': token, 'user': {'id': user.id, 'name': user.name, 'email': user.email}})

@app.route('/api/users/me', methods=['GET'])
@token_required
def me(current_user):
    return jsonify({'id': current_user.id, 'name': current_user.name, 'email': current_user.email})

@app.route('/api/members', methods=['GET'])
@token_required
def get_members_route(current_user):
    return jsonify(list_members())

@app.route('/api/members', methods=['POST'])
@token_required
def create_member_route(current_user):
    data = request.json
    member_id = create_member(data)
    return jsonify({'id': member_id})

@app.route('/api/members/<int:id>', methods=['PUT'])
@token_required
def update_member_route(current_user, id):
    data = request.json
    update_member(id, data)
    return jsonify({'message':'Atualizado com sucesso'})

@app.route('/api/attendance', methods=['GET'])
@token_required
def get_attendance_route(current_user):
    date_str = request.args.get('date')
    return jsonify(list_attendance(date_str))

@app.route('/api/attendance/<date>', methods=['PUT'])
@token_required
def put_attendance_route(current_user, date):
    data = request.json
    update_attendance(date, data['entries'])
    return jsonify({'message':'Presença atualizada'})

@app.route('/api/roles', methods=['GET'])
@token_required
def get_roles_route(current_user):
    return jsonify(list_roles())

@app.route('/api/users', methods=['POST'])
def create_user_route():
    data = request.json

    if not data.get('name') or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Os campos name, email e password são obrigatórios!'}), 400

    try:
        user_id = create_user(data)
        return jsonify({'id': user_id, 'message': 'Usuário criado com sucesso!'}), 201
    except Exception as e:
        print(f"Erro ao criar usuário: {e}")  # Log do erro no console
        return jsonify({'message': 'Erro ao criar usuário', 'error': str(e)}), 500