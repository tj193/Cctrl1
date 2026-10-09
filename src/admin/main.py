import os
from dotenv import load_dotenv

# يجب تحميل ملف الـ .env أولاً قبل أي استيراد للملفات الأخرى
load_dotenv()

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.Authentications import router as auth_router
from .routers.admin_api import router as admin_router
from .routers.drivers import router as drivers_router
from .routers.locations import router as locations_router
from .routers.journey_api import driver_router, student_router as student_routes_router
from .routers.ride_request_api import (driver_router as driver_requests_router,
                                       enrollment_router, student_router as student_requests_router)
from .routers.report_api import driver_router as driver_reports_router, student_router as student_reports_router
from .routers.route_demand_api import router as student_demand_router
from .routers.public_catalogue import router as public_catalogue_router
from .routers.student_api import router as student_router
from .routers.reports import router as reports_router
from .routers.router import router as routes_router
from .security import require_admin, secret_key

secret_key()
app = FastAPI(title="DarbGo Admin API", version="1.0.0")

origins = os.getenv("ADMIN_CORS_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5501,http://localhost:5501,http://127.0.0.1:5174,http://localhost:5174").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(student_router)
app.include_router(student_routes_router)
app.include_router(driver_router)
app.include_router(student_requests_router)
app.include_router(driver_requests_router)
app.include_router(enrollment_router)
app.include_router(student_reports_router)
app.include_router(driver_reports_router)
app.include_router(student_demand_router)
app.include_router(public_catalogue_router)
for protected_router in (locations_router, drivers_router, routes_router, reports_router):
    app.include_router(protected_router, dependencies=[Depends(require_admin)])


@app.get("/health")
def health():
    return {"status": "ok"}
