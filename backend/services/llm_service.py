import warnings
warnings.filterwarnings('ignore', category=FutureWarning)

import json
import time
import logging
from typing import Optional, Any, Dict
from groq import Groq
import google.generativeai as genai

from backend.config import settings
from backend.services.ollama_service import generate_ollama_content

logger = logging.getLogger("insightai.llm")


def _clean_json_markdown(text: str) -> str:
    """
    Strips markdown code fencing (e.g. ```json ... ```) from LLM output.
    """
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def generate_groq_content(prompt: str) -> str:
    """
    Generates JSON content using Groq Python SDK with high-speed models.
    """
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY environment variable is missing.")

    client = Groq(api_key=settings.GROQ_API_KEY, max_retries=0)
    models = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']
    last_err = None

    for model in models:
        for attempt in range(2):
            try:
                response = client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an ultra-fast, expert SQL Data Architect and Analytics Agent. Return ONLY valid JSON."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    model=model,
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=2048,
                )
                content = response.choices[0].message.content
                if content:
                    return _clean_json_markdown(content)
            except Exception as err:
                last_err = err
                err_msg = str(err)
                if "429" in err_msg and attempt == 0:
                    time.sleep(0.5)
                    continue
                logger.debug(f"[Groq] Model {model} attempt {attempt} issue: {err_msg[:100]}")

    raise last_err or RuntimeError("Groq API unavailable.")


def generate_gemini_content(prompt: str) -> str:
    """
    Generates content using Google Generative AI Python SDK as fallback.
    """
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is missing.")

    genai.configure(api_key=settings.GEMINI_API_KEY)
    models = ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-flash']
    last_err = None

    generation_config = {
        "temperature": 0.1,
        "response_mime_type": "application/json"
    }

    for model_name in models:
        try:
            model = genai.GenerativeModel(model_name, generation_config=generation_config)
            response = model.generate_content(prompt)
            if response.text:
                return _clean_json_markdown(response.text)
        except Exception as err:
            last_err = err
            logger.warning(f"[Gemini] Model {model_name} issue: {str(err)[:120]}")

    raise last_err or RuntimeError("Gemini API unavailable.")


def generate_llm_content_with_fallback(prompt: str, provider: Optional[str] = None) -> str:
    """
    Hybrid LLM Manager Hierarchy:
    Ollama (Qwen3:8b Local Engine) -> Groq API -> Gemini API -> Rule-based Local Engine
    """
    active_provider = (provider or settings.LLM_PROVIDER or "ollama").lower()
    last_errors = []

    # Strategy 1: Local Ollama Model (Qwen3:8b)
    if active_provider == "ollama" or not settings.GROQ_API_KEY:
        try:
            logger.info(f"[LLM Manager] Invoking local Ollama provider with model '{settings.OLLAMA_MODEL}'...")
            res = generate_ollama_content(prompt)
            if res:
                return _clean_json_markdown(res)
        except Exception as err:
            logger.warning(f"[Ollama Provider] Local Ollama call failed, attempting cloud fallbacks: {err}")
            last_errors.append(f"Ollama: {err}")

    # Strategy 2: Groq Cloud API
    if settings.GROQ_API_KEY:
        try:
            logger.info("[LLM Manager] Invoking Groq cloud provider...")
            res = generate_groq_content(prompt)
            if res:
                return res
        except Exception as err:
            logger.warning(f"[Groq API] Groq call failed, attempting Gemini fallback: {err}")
            last_errors.append(f"Groq: {err}")

    # Strategy 3: Gemini Cloud API
    if settings.GEMINI_API_KEY:
        try:
            logger.info("[LLM Manager] Invoking Gemini cloud provider...")
            res = generate_gemini_content(prompt)
            if res:
                return res
        except Exception as err:
            logger.warning(f"[Gemini API] Gemini call failed: {err}")
            last_errors.append(f"Gemini: {err}")

    # Final fallback if Ollama wasn't tried yet (e.g. active_provider was set to groq but Groq failed)
    if active_provider != "ollama":
        try:
            logger.info(f"[LLM Manager] Fallback to local Ollama provider '{settings.OLLAMA_MODEL}'...")
            res = generate_ollama_content(prompt)
            if res:
                return _clean_json_markdown(res)
        except Exception as err:
            logger.warning(f"[Ollama Fallback] Failed: {err}")
            last_errors.append(f"Ollama Fallback: {err}")

    raise RuntimeError(f"All LLM providers failed. Errors: {'; '.join(last_errors)}")
