import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Explicitly load .env file from root project directory
load_dotenv()

from pydantic import ConfigDict

class Settings(BaseSettings):
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "ollama")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen3:8b")
    OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = "0.0.0.0"

    model_config = ConfigDict(env_file=".env", extra="ignore")

settings = Settings()
