import logging
from typing import Optional
import ollama
from backend.config import settings

logger = logging.getLogger("insightai.ollama")

class OllamaService:
    def __init__(self, model: Optional[str] = None, host: Optional[str] = None):
        self.model = model or getattr(settings, "OLLAMA_MODEL", "qwen3:8b")
        self.host = host or getattr(settings, "OLLAMA_HOST", "http://localhost:11434")

    def generate(self, prompt: str) -> str:
        """
        Generates text using the local Ollama Python client with a fast 1.5s timeout check.
        """
        try:
            # Fast ping check to verify if local Ollama daemon is active
            import httpx
            ping_url = f"{self.host.rstrip('/')}/api/tags"
            with httpx.Client(timeout=1.2) as http_client:
                ping_res = http_client.get(ping_url)
                if ping_res.status_code != 200:
                    raise RuntimeError("Ollama daemon ping status != 200")

            client = ollama.Client(host=self.host, timeout=30.0)
            response = client.chat(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                options={
                    "num_predict": 300,
                    "temperature": 0.0,
                }
            )
            if isinstance(response, dict):
                content = response.get("message", {}).get("content", "")
            elif hasattr(response, "message"):
                content = response.message.content
            else:
                content = str(response)
            return content or ""
        except Exception as err:
            logger.warning(f"[Ollama] Generation or ping failed using model {self.model}: {err}")
            raise err


def generate_ollama_content(prompt: str) -> str:
    """
    Helper function for Ollama content generation.
    """
    service = OllamaService()
    return service.generate(prompt)
