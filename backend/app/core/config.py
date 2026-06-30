from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://pitchdeck:pitchdeck@postgres:5432/pitchdeck"
    database_url_sync: str = "postgresql://pitchdeck:pitchdeck@postgres:5432/pitchdeck"

    # Redis / Celery
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"

    # LLM
    llm_model: str = "mistral/mistral-small-latest"
    mistral_api_key: str = ""

    # Storage (S3-compatible)
    storage_endpoint: str = ""
    storage_bucket: str = "pitchdeck"
    storage_access_key: str = ""
    storage_secret_key: str = ""

    # Langfuse
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "http://langfuse-web:3000"

    # App
    environment: str = "development"
    debug: bool = True
    upload_dir: str = "/app/uploads"


settings = Settings()
