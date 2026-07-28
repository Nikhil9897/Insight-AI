import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.services.ollama_service import OllamaService

def run_ollama_test():
    llm = OllamaService()
    print("Testing Ollama integration with model:", llm.model)
    response = llm.generate("Explain DuckDB in one sentence.")
    print("\nResponse:")
    print(response)

if __name__ == "__main__":
    run_ollama_test()
