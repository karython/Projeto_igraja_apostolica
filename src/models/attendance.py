from src import db
from werkzeug.security import generate_password_hash, check_password_hash
import datetime


class Attendance(db.Model):
    __tablename__ = 'attendance'
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'))
    date = db.Column(db.Date)
    presence = db.Column(db.String(2))  # 'P', 'F', 'FJ'
    member = db.relationship('Member', backref='attendances')