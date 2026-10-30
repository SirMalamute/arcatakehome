"""HTTP API. DBOS launches inside this process, so it also runs the workers."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import db
from backend.api import documents, reviews, templates
from backend.reviews import workflows


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_schema()
    # DBOS's sync setup refuses to run on the event loop thread.
    await asyncio.to_thread(workflows.launch)
    yield


app = FastAPI(title="Arca Reviewer", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)
app.include_router(documents.router)
app.include_router(templates.router)
app.include_router(reviews.router)
