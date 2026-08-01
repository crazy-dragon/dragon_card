import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dragon-card-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///dragon_card.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PAGE_SIZE = 100
