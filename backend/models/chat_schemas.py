from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    userQuery: str
    datasetName: str
    datasetSummary: Dict[str, Any]
    sampleRows: List[Dict[str, Any]] = []
    sessionId: Optional[str] = "default"


class ChatResponse(BaseModel):
    query: str
    answer: str
    queryType: str          # "conversational" | "schema" | "exploratory"
    followUpQuestions: List[str] = []
    executionTimeMs: int
    timestamp: str
