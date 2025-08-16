from src import db
from src.models import attendance, member as member_model, role, user as user_model
from src.models.user import User
import datetime

# ===== Usuários =====
def authenticate_user(email, password):
    """Autentica um usuário pelo email e senha"""
    try:
        usuario = user_model.User.query.filter_by(email=email).first()
        if usuario and usuario.verificar_senha(password):
            return usuario
        return None
    except Exception as e:
        print(f"Erro na autenticação: {e}")
        return None

def get_user_by_id(user_id):
    """Busca um usuário pelo ID"""
    try:
        return user_model.User.query.get(user_id)
    except Exception as e:
        print(f"Erro ao buscar usuário por ID: {e}")
        return None

def create_user(data):
    """Cria um novo usuário"""
    try:
        # Verificar se email já existe
        existing_user = user_model.User.query.filter_by(email=data['email']).first()
        if existing_user:
            raise ValueError("Email já está em uso")
        
        # Criar novo usuário
        new_user = User(
            name=data['name'], 
            email=data['email']
        )
        
        # Gerar hash da senha
        new_user.gen_senha(data['password'])
        
        db.session.add(new_user)
        db.session.commit()
        return new_user.id
        
    except ValueError:
        db.session.rollback()
        raise
    except Exception as e:
        db.session.rollback()
        print(f"Erro na função create_user: {e}")
        raise

# ===== Membros =====
def list_members():
    """Lista todos os membros"""
    try:
        members = member_model.Member.query.all()
        result = []
        for m in members:
            result.append({
                'id': m.id,
                'name': m.name,
                'status': m.status,
                'roles': [r.name for r in m.roles] if m.roles else [],
                'createdAt': m.created_at.isoformat() if hasattr(m, 'created_at') and m.created_at else ''
            })
        return result
    except Exception as e:
        print(f"Erro ao listar membros: {e}")
        return []

def create_member(data):
    """Cria um novo membro"""
    try:
        # Validar dados obrigatórios
        name = data.get('name', '').strip()
        if not name:
            raise ValueError("Nome é obrigatório")
        
        # Criar novo membro
        new_member = member_model.Member(
            name=name, 
            status=data.get('status', 'frequente')
        )
        
        # Adicionar roles se fornecidos
        if 'roles' in data and data['roles']:
            roles_list = data['roles']
            if isinstance(roles_list, list):
                # Buscar roles válidos
                valid_roles = role.Role.query.filter(role.Role.name.in_(roles_list)).all()
                new_member.roles = valid_roles
        
        db.session.add(new_member)
        db.session.commit()
        return new_member.id
        
    except ValueError:
        db.session.rollback()
        raise
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao criar membro: {e}")
        raise

def update_member(member_id, data):
    """Atualiza um membro existente - CORREÇÃO PRINCIPAL"""
    try:
        # Converter member_id para int se necessário
        if isinstance(member_id, str):
            try:
                member_id = int(member_id)
            except ValueError:
                raise ValueError("ID do membro deve ser um número válido")
        
        # Buscar o membro primeiro - CORREÇÃO: usar member_model
        member = member_model.Member.query.get(member_id)
        
        if not member:
            raise ValueError(f"Membro com ID {member_id} não encontrado")
        
        # Atualizar nome se fornecido
        if 'name' in data:
            name = data['name'].strip()
            if not name:
                raise ValueError("Nome não pode ser vazio")
            member.name = name
        
        # Atualizar status se fornecido
        if 'status' in data:
            valid_statuses = ['frequente', 'afastado', 'licenca']
            if data['status'] not in valid_statuses:
                raise ValueError(f"Status deve ser um dos: {', '.join(valid_statuses)}")
            member.status = data['status']
        
        # Atualizar roles se fornecido
        if 'roles' in data:
            roles_list = data['roles']
            if not isinstance(roles_list, list):
                raise ValueError("Roles deve ser uma lista")
            
            # Limpar roles existentes e adicionar novos
            if roles_list:
                valid_roles = role.Role.query.filter(role.Role.name.in_(roles_list)).all()
                member.roles = valid_roles
            else:
                # Se lista vazia, limpar todos os roles
                member.roles = []
        
        # Salvar alterações
        db.session.commit()
        return True
        
    except ValueError:
        db.session.rollback()
        raise
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar membro: {e}")
        raise

# ===== Presença =====
def list_attendance(date_str):
    """Lista presenças de uma data específica"""
    try:
        date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        records = attendance.Attendance.query.filter_by(date=date_obj).all()
        return [
            {
                'memberId': str(r.member_id),
                'presence': r.presence,
                'observation': r.observation  # ✅ Inclui a observação
            }
            for r in records
        ]
    except ValueError as e:
        print(f"Erro no formato da data: {e}")
        return []
    except Exception as e:
        print(f"Erro ao listar presença: {e}")
        return []


def update_attendance(date_str, entries):
    """Atualiza presenças para uma data específica"""
    try:
        date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        
        for entry in entries:
            member_id = entry.get('memberId')
            presence = entry.get('presence')
            observation = entry.get('observation')  # ✅ Pega a observação, se houver
            
            # Validar dados da entrada
            if not member_id or presence not in ['P', 'F', 'FJ']:
                continue
            
            # Buscar registro existente
            att = attendance.Attendance.query.filter_by(
                date=date_obj, 
                member_id=member_id
            ).first()
            
            if att:
                # Atualizar registro existente
                att.presence = presence
                att.observation = observation  # ✅ Atualiza observação também
            else:
                # Criar novo registro
                att = attendance.Attendance(
                    member_id=member_id, 
                    date=date_obj, 
                    presence=presence,
                    observation=observation  # ✅ Salva observação
                )
                db.session.add(att)
        
        db.session.commit()
        return True
        
    except ValueError as e:
        db.session.rollback()
        print(f"Erro no formato da data: {e}")
        raise ValueError("Formato de data inválido")
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar presença: {e}")
        raise


# ===== Cargos/Roles =====
def list_roles():
    """Lista todos os cargos disponíveis"""
    try:
        roles = role.Role.query.all()
        return [r.name for r in roles]
    except Exception as e:
        print(f"Erro ao listar roles: {e}")
        # Retorna lista padrão em caso de erro
        return ["Professor", "Líder", "Aluno", "Auxiliar", "Visitante"]

# ===== Funções auxiliares =====
def get_member_by_id(member_id):
    """Busca um membro pelo ID"""
    try:
        if isinstance(member_id, str):
            member_id = int(member_id)
        return member_model.Member.query.get(member_id)
    except Exception as e:
        print(f"Erro ao buscar membro por ID: {e}")
        return None

def member_exists(member_id):
    """Verifica se um membro existe"""
    member = get_member_by_id(member_id)
    return member is not None

