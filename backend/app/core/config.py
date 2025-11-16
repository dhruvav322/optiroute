from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongo_uri: str = Field(default="mongodb://localhost:27017", env="MONGO_URI")
    mongo_db: str = Field(default="optiroute", env="MONGO_DB")
    model_dir: Path = Field(default=Path("models"), env="MODEL_DIR")
    model_path: Path = Field(default=Path("models/model.pkl"), env="MODEL_PATH")
    uploads_dir: Path = Field(default=Path("storage/uploads"), env="UPLOADS_DIR")
    secret_key: str = Field(default="insecure-secret", env="SECRET_KEY")
    allowed_origins: str = Field(default="", env="ALLOWED_ORIGINS")
    max_file_size_mb: int = Field(default=10, env="MAX_FILE_SIZE_MB")
    enable_auth: bool = Field(default=False, env="ENABLE_AUTH")  # Set to True in production
    redis_url: str = Field(default="redis://localhost:6379", env="REDIS_URL")

    class Config:
        env_file = ".env"
        case_sensitive = False
        protected_namespaces = ('settings_',)  # Fix Pydantic warnings


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.model_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return settings
