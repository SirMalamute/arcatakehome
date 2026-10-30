"""Question templates (the preset column sets)."""

import json
from pathlib import Path

from fastapi import APIRouter

TEMPLATES_PATH = Path(__file__).parents[2] / "data" / "templates.json"

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("")
def get_templates():
    return json.loads(TEMPLATES_PATH.read_text())
