from src import db
from src.models import member, attendance, role, user as user_model
import datetime

# ===== Usuários =====
def authenticate_user(email, password):
    usuario = user_model.User.query.filter_by(email=email).first()
    if usuario and usuario.check_password(password):
        return usuario
    return None

def get_user_by_id(user_id):
    return user_model.User.query.get(user_id)

# ===== Membros =====
def list_members():
    members = member.Member.query.all()
    result = []
    for m in members:
        result.append({
            'id': m.id,
            'name': m.name,
            'status': m.status,
            'roles': [r.name for r in m.roles],
            'createdAt': m.created_at.isoformat()
        })
    return result

def create_member(data):
    member = member.Member(name=data['name'], status=data.get('status','frequente'))
    if 'roles' in data:
        member.roles = role.Role.query.filter(role.Role.name.in_(data['roles'])).all()
    db.session.add(member)
    db.session.commit()
    return member.id

def update_member(id, data):
    member = member.Member.query.get_or_404(id)
    member.name = data.get('name', member.name)
    member.status = data.get('status', member.status)
    if 'roles' in data:
        member.roles = role.Role.query.filter(role.Role.name.in_(data['roles'])).all()
    db.session.commit()
    return True

# ===== Presença =====
def list_attendance(date_str):
    date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
    records = attendance.Attendance.query.filter_by(date=date_obj).all()
    return [{'memberId': r.member_id, 'presence': r.presence} for r in records]

def update_attendance(date_str, entries):
    date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
    for entry in entries:
        att = attendance.Attendance.query.filter_by(date=date_obj, member_id=entry['memberId']).first()
        if att:
            att.presence = entry['presence']
        else:
            att = attendance.Attendance(member_id=entry['memberId'], date=date_obj, presence=entry['presence'])
            db.session.add(att)
    db.session.commit()
    return True

# ===== Roles =====
def list_roles():
    roles = role.Role.query.all()
    return [r.name for r in roles]
