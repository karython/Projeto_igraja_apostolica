from src import db
from passlib.hash import sha256_crypt as sha256

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150))
    email = db.Column(db.String(150), unique=True)
    password = db.Column(db.String(256))

    def gen_senha(self, password):
        self.password = sha256.hash(password)

    def verificar_senha(self, password):
        return sha256.verify(password, self.password)