import os
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401 — importa los modelos para registrarlos en Base.metadata
from app.api.routes import auth, cash, customers, dashboard, orders, products, sales, users
from app.bootstrap import ensure_first_admin
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.seed_on_startup:
        from app.seed import run_seed

        run_seed()
    ensure_first_admin()
    yield


app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(users.router)
api.include_router(cash.router)
api.include_router(products.router)
api.include_router(customers.router)
api.include_router(sales.router)
api.include_router(dashboard.router)
api.include_router(orders.router)
app.include_router(api)


@app.get("/")
def root():
    return {"name": settings.app_name, "version": settings.version, "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
