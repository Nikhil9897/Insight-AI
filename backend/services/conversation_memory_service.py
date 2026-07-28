import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger("insightai.conversation_memory")


class TurnMemory(BaseModel):
    user_query: str
    generated_sql: str
    explanation: str
    target_table: str = "df"
    filters_applied: List[Dict[str, Any]] = []
    dimensions_used: List[str] = []
    metrics_used: List[str] = []


class ConversationSession(BaseModel):
    session_id: str
    turns: List[TurnMemory] = []
    active_filters: Dict[str, Any] = {}
    active_dimensions: List[str] = []
    active_metrics: List[str] = []


class ConversationMemoryService:
    def __init__(self):
        self._sessions: Dict[str, ConversationSession] = {}

    def get_or_create_session(self, session_id: str) -> ConversationSession:
        if session_id not in self._sessions:
            self._sessions[session_id] = ConversationSession(session_id=session_id)
        return self._sessions[session_id]

    def record_turn(
        self,
        session_id: str,
        user_query: str,
        sql: str,
        explanation: str,
        filters: List[Dict[str, Any]] = None,
        dimensions: List[str] = None,
        metrics: List[str] = None
    ):
        session = self.get_or_create_session(session_id)
        turn = TurnMemory(
            user_query=user_query,
            generated_sql=sql,
            explanation=explanation,
            filters_applied=filters or [],
            dimensions_used=dimensions or [],
            metrics_used=metrics or []
        )
        session.turns.append(turn)
        if dimensions:
            session.active_dimensions = dimensions
        if metrics:
            session.active_metrics = metrics
        if filters:
            for f in filters:
                col = f.get("column")
                val = f.get("value")
                if col and val:
                    session.active_filters[col] = val

        logger.info(f"[Conversation Memory] Recorded turn #{len(session.turns)} for session '{session_id}'")

    def build_context_prompt(self, session_id: str, current_query: str) -> str:
        if session_id not in self._sessions:
            return ""

        session = self._sessions[session_id]
        if not session.turns:
            return ""

        recent_turns = session.turns[-3:]
        history_lines = []
        for i, turn in enumerate(recent_turns, 1):
            history_lines.append(f"Turn {i} User Request: \"{turn.user_query}\"")
            history_lines.append(f"Turn {i} Executed SQL: `{turn.generated_sql}`")
            if turn.filters_applied:
                history_lines.append(f"Turn {i} Active Filters: {turn.filters_applied}")

        context_str = "\n".join(history_lines)
        return f"""
CONVERSATION HISTORY & MULTI-TURN CONTEXT:
{context_str}

Active Session State:
- Active Metrics: {session.active_metrics}
- Active Dimensions: {session.active_dimensions}
- Active Filters: {session.active_filters}

INSTRUCTION:
If the user request ("{current_query}") is a follow-up, refinement, or modification (e.g. "only South region", "sort by sales", "compare with last month"), build upon the previous query state and SQL above instead of resetting.
"""


conversation_memory_service = ConversationMemoryService()
