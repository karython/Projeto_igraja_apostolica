from dotenv import load_dotenv
from flask import Flask

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import os

# Carrega variáveis do .env
load_dotenv()

# Inicializa DB antes do app
db = SQLAlchemy()

# Inicializa Flask
app = Flask(__name__)

# Configurações
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'supersecretkey')
app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('USER')}:{os.getenv('PASSWORD')}@{os.getenv('HOST')}:{os.getenv('PORT')}/{os.getenv('DB')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Inicializa DB com o app
db.init_app(app)
migrate = Migrate(app, db)

# ===== Teste de conexão dentro do contexto =====
with app.app_context():
    try:
        db.engine.connect()
        print("Conectado ao banco de dados com sucesso!")
    except Exception as e:
        print(f"Falha ao conectar ao banco de dados: {e}")

# Importa modelos e rotas
from src.models import *  # seus models estão em modelos.py
from src import routes  # rotas usam 'app'
