from typing import List, Dict, Any

class GrammarAutocomplete:
    """
    Layer 3.3: Grammar-Aware Autocomplete State Machine.
    Token-by-token autocomplete state machine that progressively narrows completions:
    1. 'show' -> ['show total', 'show average', 'show top 10', 'show monthly']
    2. 'show total' -> ['show total revenue', 'show total profit', 'show total quantity']
    3. 'show revenue' -> ['show revenue by', 'show revenue trend']
    4. 'show revenue by' -> ['Region', 'Category', 'Customer Segment', 'Month']
    """

    @classmethod
    def get_completions(cls, query_prefix: str, brain_profile: Dict[str, Any]) -> List[str]:
        q_lower = query_prefix.strip().lower()
        if not q_lower:
            return ["show total", "show average", "show top 10", "show monthly"]

        metrics = brain_profile.get('metrics', [])
        dimensions = brain_profile.get('dimensions', [])
        time_cols = brain_profile.get('time_columns', [])

        completions: List[str] = []

        tokens = q_lower.split()
        last_token = tokens[-1] if tokens else ""

        # State 1: "show"
        if q_lower == "show":
            return ["show total", "show average", "show top 10", "show monthly"]

        # State 2: "show total" / "show average" / "show top"
        if q_lower in ("show total", "show average", "show min", "show max", "total", "average"):
            for m in metrics:
                m_clean = m.replace('_', ' ')
                completions.append(f"{query_prefix} {m_clean}")
            return completions[:8]

        # State 3: "show [metric]" (e.g. "show revenue" or "show sales")
        matched_metric = None
        for m in metrics:
            m_clean = m.replace('_', ' ').lower()
            if m_clean in q_lower or m.lower() in q_lower:
                matched_metric = m
                break

        if matched_metric and not (" by" in q_lower or " over" in q_lower or " in" in q_lower):
            m_clean = matched_metric.replace('_', ' ')
            return [
                f"{query_prefix} by",
                f"{query_prefix} trend over time",
                f"top 10 {dimensions[0] if dimensions else 'items'} by {m_clean}"
            ]

        # State 4: "show [metric] by" (e.g. "show revenue by" or "sales by")
        if q_lower.endswith(" by"):
            for d in dimensions + time_cols:
                d_clean = d.replace('_', ' ')
                completions.append(f"{query_prefix} {d_clean}")
            return completions[:8]

        # General Fallback Prefix Matching
        for m in metrics:
            m_clean = m.replace('_', ' ')
            if m_clean.lower().startswith(last_token):
                prefix_stem = " ".join(tokens[:-1])
                completions.append(f"{prefix_stem} {m_clean}".strip())

        for d in dimensions:
            d_clean = d.replace('_', ' ')
            if d_clean.lower().startswith(last_token):
                prefix_stem = " ".join(tokens[:-1])
                completions.append(f"{prefix_stem} {d_clean}".strip())

        return list(dict.fromkeys(completions))[:8]
