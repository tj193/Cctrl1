from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .DataBase import create_db
from .routers.Authentications import router as auth_router
from .routers.drivers import router as drivers_router
from .routers.locations import router as locations_router
from .routers.reports import router as reports_router
from .routers.router import router as routes_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db()
    yield


app = FastAPI(title="DarbGo Admin API", description="Backend Management System for DarbGo",version="1.0.0",lifespan=lifespan,)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(locations_router)
app.include_router(drivers_router)
app.include_router(routes_router)
app.include_router(reports_router)


@app.get("/")
def root():
    return {"message": "DarbGo Admin API is running smoothly!"}