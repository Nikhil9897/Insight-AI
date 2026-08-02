"""
clarification_engine.py — Interactive Clarification Engine
==========================================================
Detects low-confidence or multi-column ambiguous queries and formats domain-grounded
clarifying questions to resolve user intent before SQL compilation.
"""

import logging
from typing import Dict, Any, List, Optional
from backend.services.query_understanding_engine import QueryUnderstanding

logger = logging.getLogger("insightai.clarification")


class ClarificationEngine:
    """
    Clarification Engine for InsightAI.
    Prompts the user with clarifying options when query ambiguity is detected.
    """

    @classmethod
    def evaluate(
        cls,
        user_query: str,
        understanding: QueryUnderstanding,
        brain_profile: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates query confidence and entity mapping for ambiguity.
        Returns a clarification payload if clarification is required, or None if clear.
        """
        conf = understanding.confidence
        q_lower = user_query.lower()

        metrics = brain_profile.get("metrics", []) if brain_profile else []
        dimensions = brain_profile.get("dimensions", []) if brain_profile else []

        # Case 1: Low Confidence (< 0.60)
        if conf < 0.60:
            m1 = metrics[0] if metrics else "Sales"
            d1 = dimensions[0] if dimensions else "Category"
            return {
                "requires_clarification": True,
                "confidence": conf,
                "question": f"I want to make sure I answer accurately. Did you mean one of these questions?",
                "options": [
                    f"Top 10 {d1}s by {m1}",
                    f"Total {m1} grouped by {d1}",
                    f"Monthly trend for {m1}",
                    "Show dataset schema and data quality"
                ]
            }

        # Case 2: Multi-Metric Ambiguity (e.g. query mentions 'income' or 'performance' when multiple metrics exist)
        if ("income" in q_lower or "revenue" in q_lower or "performance" in q_lower) and len(metrics) >= 2:
            if "Sales" in metrics and "Revenue" in metrics:
                return {
                    "requires_clarification": True,
                    "confidence": 0.65,
                    "question": f"Your dataset has both **Sales** and **Revenue**. Which metric would you like to analyze?",
                    "options": [
                        f"Analyze total Sales",
                        f"Analyze total Revenue",
                        f"Compare Sales vs Revenue"
                    ]
                }

        return None
