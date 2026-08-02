"""
feedback_service.py — Execution Feedback & Telemetry Logger
===========================================================
Persists natural language query execution attempts, grounded execution plans,
generated SQL, and execution metrics for offline continuous evaluation.
"""

import json
import time
import os
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger("insightai.feedback")

FEEDBACK_LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "execution_telemetry.json")


class TelemetryRecord(BaseModel):
    timestamp: float
    query: str
    capability: str
    confidence: float
    bypassed_llm: bool
    execution_plan: Dict[str, Any]
    sql: str
    execution_time_ms: int
    status: str = "success"  # success, error, clarification
    error_message: Optional[str] = None


class FeedbackService:
    """
    Telemetry and Feedback Service for InsightAI.
    """
    _records: List[Dict[str, Any]] = []

    @classmethod
    def log_execution(
        cls,
        query: str,
        capability: str,
        confidence: float,
        bypassed_llm: bool,
        execution_plan: Dict[str, Any],
        sql: str,
        execution_time_ms: int,
        status: str = "success",
        error_message: Optional[str] = None
    ) -> None:
        rec = TelemetryRecord(
            timestamp=time.time(),
            query=query,
            capability=capability,
            confidence=confidence,
            bypassed_llm=bypassed_llm,
            execution_plan=execution_plan,
            sql=sql,
            execution_time_ms=execution_time_ms,
            status=status,
            error_message=error_message
        ).model_dump()

        cls._records.append(rec)
        logger.info(f"[FeedbackService] Logged query='{query}' cap={capability} conf={confidence:.2f} bypassed_llm={bypassed_llm} time={execution_time_ms}ms")

        # Persist to disk async/best-effort
        try:
            os.makedirs(os.path.dirname(FEEDBACK_LOG_PATH), exist_ok=True)
            with open(FEEDBACK_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec) + "\n")
        except Exception as e:
            logger.debug(f"[FeedbackService] Disk log skipped: {e}")

    @classmethod
    def get_recent_telemetry(cls, limit: int = 50) -> List[Dict[str, Any]]:
        return cls._records[-limit:]
