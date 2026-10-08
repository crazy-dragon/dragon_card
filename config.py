import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dragon-card-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///dragon_card.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PAGE_SIZE = 100
    # zip 小工具文件系统目录（不纳入 git）
    TOOLS_DIR = os.environ.get('TOOLS_DIR') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'minitools')
