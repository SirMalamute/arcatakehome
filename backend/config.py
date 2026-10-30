from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://bulk:bulk@localhost:5433/bulk_review"
    dbos_database_url: str = "postgresql://bulk:bulk@localhost:5433/bulk_review_dbos"
    openai_api_key: str = ""
    extract_model: str = "gpt-5"
    filter_model: str = "gpt-5-mini"
    extract_concurrency: int = 10
    extract_rate_per_min: int = 300
    max_upload_bytes: int = 25 * 1024 * 1024


@lru_cache
def settings() -> Settings:
    return Settings()
