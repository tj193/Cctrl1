import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.Authentications import router as auth_router
from .routers.admin_api import router as admin_router
from .routers.drivers import router as drivers_router
from .routers.locations import router as locations_router
from .routers.reports import router as reports_router
from .routers.router import router as routes_router
from .security import require_admin, secret_key

secret_key()
app = FastAPI(title="DarbGo Admin API", version="1.0.0")
origins = os.getenv("ADMIN_CORS_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(admin_router)
for protected_router in (locations_router, drivers_router, routes_router, reports_router):
    app.include_router(protected_router, dependencies=[Depends(require_admin)])


@app.get("/health")
def health():
    return {"status": "ok"}
