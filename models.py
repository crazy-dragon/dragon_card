import json
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 't_user'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    display_name = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'display_name': self.display_name or self.username,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Template(db.Model):
    __tablename__ = 't_template'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('t_user.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    lang = db.Column(db.String(10), nullable=False, default='en')
    card_html = db.Column(db.Text, nullable=False, default='')
    card_css = db.Column(db.Text, nullable=False, default='')
    card_js = db.Column(db.Text, nullable=False, default='')
    sample_data = db.Column(db.Text)
    tracked_actions = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref='templates')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'lang': self.lang or 'en',
            'tracked_actions': self.get_tracked_actions(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def get_tracked_actions(self):
        if not self.tracked_actions:
            return []
        try:
            return json.loads(self.tracked_actions)
        except (json.JSONDecodeError, TypeError):
            return []

    def to_dict_full(self):
        d = self.to_dict()
        d.update({
            'card_html': self.card_html,
            'card_css': self.card_css,
            'card_js': self.card_js,
            'sample_data': self.sample_data,
        })
        return d


class Deck(db.Model):
    __tablename__ = 't_deck'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('t_user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    kind = db.Column(db.String(20), nullable=False, default='other')
    active_template_id = db.Column(db.Integer, db.ForeignKey('t_template.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref='decks')
    active_template = db.relationship('Template', foreign_keys=[active_template_id])
    deck_templates = db.relationship('DeckTemplate', backref='deck', cascade='all, delete-orphan')

    def to_dict(self):
        item_count = len(self.deck_items) if self.deck_items else 0
        active_t = self.active_template
        t_list = sorted(self.deck_templates, key=lambda r: r.sort_order)

        unknown_count = 0
        mastered_count = 0
        round_count = 0
        try:
            unknown_count = db.session.query(db.func.count(Progress.id)).filter(
                Progress.deck_id == self.id, Progress.is_unknown == 1
            ).join(DeckItem, Progress.deck_item_id == DeckItem.id).scalar() or 0
            round_count = db.session.query(db.func.count(StudyRound.id)).filter(
                StudyRound.deck_id == self.id
            ).scalar() or 0
            if round_count > 0:
                mastered_count = db.session.query(db.func.count(Progress.id)).filter(
                    Progress.deck_id == self.id, Progress.is_unknown == 0
                ).join(DeckItem, Progress.deck_item_id == DeckItem.id).scalar() or 0
        except Exception:
            pass

        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'kind': self.kind or 'other',
            'active_template_id': self.active_template_id,
            'template_name': active_t.name if active_t else None,
            'template_description': active_t.description if active_t else None,
            'templates': [{'id': r.template_id, 'name': r.template.name} for r in t_list if r.template],
            'item_count': item_count,
            'has_template': self.active_template_id is not None,
            'has_data': item_count > 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'unknown_count': unknown_count,
            'mastered_count': mastered_count,
            'round_count': round_count,
        }


class DeckTemplate(db.Model):
    __tablename__ = 't_deck_template'
    deck_id = db.Column(db.Integer, db.ForeignKey('t_deck.id'), primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('t_template.id'), primary_key=True)
    sort_order = db.Column(db.Integer, default=0)
    template = db.relationship('Template')


class DeckItem(db.Model):
    __tablename__ = 't_deck_item'

    id = db.Column(db.Integer, primary_key=True)
    deck_id = db.Column(db.Integer, db.ForeignKey('t_deck.id'), nullable=False)
    item_order = db.Column(db.Integer, nullable=False)
    data = db.Column(db.JSON, nullable=False)
    debug = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    deck = db.relationship('Deck', backref='deck_items')

    def to_dict(self):
        return {
            'id': self.id,
            'deck_id': self.deck_id,
            'item_order': self.item_order,
            'data': self.data,
            'debug': self.debug,
        }


class Progress(db.Model):
    __tablename__ = 't_progress'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('t_user.id'), nullable=False)
    deck_id = db.Column(db.Integer, db.ForeignKey('t_deck.id'), nullable=False)
    deck_item_id = db.Column(db.Integer, db.ForeignKey('t_deck_item.id'), nullable=False)
    is_unknown = db.Column(db.Integer, default=0)
    is_favorite = db.Column(db.Integer, default=0)
    current_order = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'deck_id', 'deck_item_id', name='uq_user_deck_item'),
    )

    deck = db.relationship('Deck')
    deck_item = db.relationship('DeckItem')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'deck_id': self.deck_id,
            'deck_item_id': self.deck_item_id,
            'is_unknown': self.is_unknown,
            'is_favorite': self.is_favorite,
            'current_order': self.current_order,
        }


class StudyRound(db.Model):
    __tablename__ = 't_study_round'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('t_user.id'), nullable=False)
    deck_id = db.Column(db.Integer, db.ForeignKey('t_deck.id'), nullable=False)
    round_number = db.Column(db.Integer, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    marked_count = db.Column(db.Integer, nullable=False, default=0)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'deck_id', 'round_number', name='uq_user_deck_round'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'round_number': self.round_number,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'marked_count': self.marked_count,
        }


class LearningEvent(db.Model):
    __tablename__ = 't_learning_event'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('t_user.id'), nullable=False)
    deck_id = db.Column(db.Integer, db.ForeignKey('t_deck.id'), nullable=False)
    deck_item_id = db.Column(db.Integer, db.ForeignKey('t_deck_item.id'), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('t_template.id'), nullable=True)
    action = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'deck_id': self.deck_id,
            'deck_item_id': self.deck_item_id,
            'template_id': self.template_id,
            'action': self.action,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }