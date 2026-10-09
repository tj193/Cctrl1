"""Real application auth with an isolated, ephemeral SQLite database. Never loads .env."""
import os
import secrets
import sys
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if importlib.util.find_spec('sqlmodel') is None:
    sys.path.insert(0, str(ROOT / 'python-deps'))
sys.path.insert(0, str(ROOT.parent))
os.environ['DATABASE_URL'] = 'sqlite:///' + (ROOT / os.getenv('DARBGO_DEMO_DB', 'local-demo.sqlite')).as_posix()
os.environ['JWT_SECRET'] = secrets.token_urlsafe(48)
os.environ['ADMIN_CORS_ORIGINS'] = 'http://127.0.0.1:5199'
from sqlmodel import SQLModel, Session, select
from src.admin.DataBase import engine
from src.admin.models import User, UserRole, Status, Driver_Profile, ApplicationStatus
from src.admin.security import get_password_hash
SQLModel.metadata.create_all(engine)
with Session(engine) as session:
    admin = session.exec(select(User).where(User.email == 'admin@example.invalid')).first()
    if not admin:
        session.add(User(name='Demo Admin', email='admin@example.invalid', password_hash=get_password_hash('LocalDemoOnly2026!'), role=UserRole.ADMIN, status=Status.ACTIVE))
        session.commit()
    user = session.exec(select(User).where(User.email == 'driver@example.invalid')).first()
    if not user:
        user = User(name='Demo Driver', email='driver@example.invalid', password_hash=get_password_hash('LocalDemoOnly2026!'), role=UserRole.DRIVER, status=Status.ACTIVE)
        session.add(user)
        session.flush()
        session.add(Driver_Profile(Driver_id=user.id, phone_number='+9647000000001', vehicle_name='Demo car', vehicle_model='2026', vehicle_plate='DEMO-ONLY', license_number='DEMO-LICENSE', national_id='DEMO-ID', vehicle_photo_url='', license_photo_url='', id_photo_url='', verification_status=ApplicationStatus.APPROVED))
        session.commit()
from src.admin.main import app
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8009, access_log=False)


