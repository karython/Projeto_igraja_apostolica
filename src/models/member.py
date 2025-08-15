from src import db
import datetime

roles_members = db.Table('roles_members',
    db.Column('member_id', db.Integer, db.ForeignKey('members.id')),
    db.Column('role_id', db.Integer, db.ForeignKey('roles.id'))
)


class Member(db.Model):
    __tablename__ = 'members'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    status = db.Column(db.String(50), default='frequente')
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    roles = db.relationship('Role', secondary=roles_members, backref='members')
