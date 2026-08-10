"""
few_shot_examples.py — Domain-Adaptive Few-Shot Examples for LLM IR Refiner
============================================================================
Returns a compact, structured block of few-shot examples to inject into the
LLM IR Refiner prompt so Groq/Gemini learns exactly what format InsightAI
expects — without needing hundreds of examples.

The examples cover the 8 most common analytical patterns:
  AGGREGATION · RANKING · FILTERED_RANKING · TREND
  COMPARISON  · COMPOSITION · DISTRIBUTION · STATISTICAL
"""

from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Canonical pattern examples (domain-agnostic shape)
# These get customised with real column names at call-time.
# ---------------------------------------------------------------------------

_AGGREGATION_EXAMPLE = {
    "question": "Total {metric} by {dimension}",
    "ir": {
        "intent": "aggregation",
        "aggregation": "SUM",
        "metric": "{metric}",
        "dimensions": ["{dimension}"],
        "filters": [],
        "sort": {"column": "{metric}", "direction": "DESC"},
        "limit": None,
        "time_granularity": None,
        "chart": "bar"
    }
}

_RANKING_EXAMPLE = {
    "question": "Top 10 {dimension}s by {metric}",
    "ir": {
        "intent": "ranking",
        "aggregation": "SUM",
        "metric": "{metric}",
        "dimensions": ["{dimension}"],
        "filters": [],
        "sort": {"column": "{metric}", "direction": "DESC"},
        "limit": 10,
        "chart": "bar"
    }
}

_FILTERED_RANKING_EXAMPLE = {
    "question": "Top selling {dimension} in {filter_value}",
    "ir": {
        "intent": "ranking",
        "aggregation": "SUM",
        "metric": "{metric}",
        "dimensions": ["{dimension}"],
        "filters": [{"column": "{filter_col}", "operator": "eq", "value": "{filter_value}"}],
        "sort": {"column": "{metric}", "direction": "DESC"},
        "limit": 10,
        "chart": "bar"
    }
}

_TREND_EXAMPLE = {
    "question": "Monthly {metric} trend",
    "ir": {
        "intent": "trend",
        "aggregation": "SUM",
        "metric": "{metric}",
        "dimensions": ["{time_col}"],
        "filters": [],
        "sort": {"column": "{time_col}", "direction": "ASC"},
        "limit": None,
        "time_granularity": "month",
        "time_dimension": "{time_col}",
        "chart": "line"
    }
}

_COMPARISON_EXAMPLE = {
    "question": "Compare {metric} across {dimension}",
    "ir": {
        "intent": "comparison",
        "aggregation": "SUM",
        "metric": "{metric}",
        "dimensions": ["{dimension}"],
        "filters": [],
        "sort": {"column": "{metric}", "direction": "DESC"},
        "limit": None,
        "chart": "bar"
    }
}

_COMPOSITION_EXAMPLE = {
    "question": "What percentage of {metric} comes from each {dimension}?",
    "ir": {
        "intent": "aggregation",
        "aggregation": "SUM",
        "metric": "{metric}",
        "dimensions": ["{dimension}"],
        "filters": [],
        "sort": {"column": "{metric}", "direction": "DESC"},
        "limit": None,
        "chart": "pie"
    }
}

_AVG_EXAMPLE = {
    "question": "Average {metric} by {dimension}",
    "ir": {
        "intent": "aggregation",
        "aggregation": "AVG",
        "metric": "{metric}",
        "dimensions": ["{dimension}"],
        "filters": [],
        "sort": {"column": "{metric}", "direction": "DESC"},
        "limit": None,
        "chart": "bar"
    }
}

_DISTRIBUTION_EXAMPLE = {
    "question": "Distribution of {metric}",
    "ir": {
        "intent": "distribution",
        "aggregation": "COUNT",
        "metric": "{metric}",
        "dimensions": [],
        "filters": [],
        "sort": None,
        "limit": None,
        "chart": "histogram"
    }
}


def _fill(template: Dict[str, Any], **kwargs: str) -> Dict[str, Any]:
    """Recursively replace {placeholders} in a template dict."""
    import json
    raw = json.dumps(template)
    for key, val in kwargs.items():
        raw = raw.replace("{" + key + "}", str(val))
    return json.loads(raw)


def _fmt_example(ex: Dict[str, Any]) -> str:
    """Format a single example as a compact prompt block."""
    import json
    return (
        f"Question: {ex['question']}\n"
        f"IR:\n{json.dumps(ex['ir'], indent=2)}"
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_few_shot_examples(
    brain_profile: Optional[Dict[str, Any]],
    max_examples: int = 4,
) -> str:
    """
    Returns a formatted few-shot block for injection into the LLM IR Refiner
    prompt. Examples are customised with real column names from brain_profile.

    Args:
        brain_profile: DatasetBrain profile dict with metrics, dimensions, etc.
        max_examples:  Maximum number of examples to include (default 4).

    Returns:
        A multi-line string ready to embed in an f-string prompt.
    """
    if not brain_profile:
        return _generic_examples()

    metrics: List[str] = brain_profile.get("metrics", [])
    dimensions: List[str] = brain_profile.get("dimensions", [])
    time_cols: List[str] = brain_profile.get("time_columns", [])
    domain: str = brain_profile.get("domain", "")
    value_index: Dict[str, str] = brain_profile.get("value_index", {})

    # Pick representative columns
    m1 = metrics[0] if metrics else "Sales"
    m2 = metrics[1] if len(metrics) > 1 else m1
    d1 = dimensions[0] if dimensions else "Category"
    d2 = dimensions[1] if len(dimensions) > 1 else d1
    t1 = time_cols[0] if time_cols else "OrderDate"

    # Find a real categorical filter value from the value_index
    filter_val = "South"
    filter_col = d1
    for val, col in value_index.items():
        if col in dimensions and len(val) > 2 and not val.isdigit():
            filter_val = val.title()
            filter_col = col
            break

    # Build domain-specific example set
    selected_templates = _select_templates_for_domain(domain)

    examples = []
    for tpl in selected_templates[:max_examples]:
        filled = _fill(
            tpl,
            metric=m1,
            metric2=m2,
            dimension=d1,
            dimension2=d2,
            time_col=t1,
            filter_col=filter_col,
            filter_value=filter_val,
        )
        examples.append(_fmt_example(filled))

    separator = "\n\n---\n\n"
    header = "=== FEW-SHOT EXAMPLES (follow this exact IR structure) ==="
    footer = "=== END OF EXAMPLES ==="
    return f"{header}\n\n{separator.join(examples)}\n\n{footer}"


def _select_templates_for_domain(domain: str) -> List[Dict[str, Any]]:
    """Choose the most relevant example templates for the detected domain."""
    sales_domains = ["Sales", "Retail", "E-Commerce", "Enterprise"]
    hr_domains = ["HR", "Workforce", "Human Resources"]
    healthcare_domains = ["Healthcare", "Clinical"]

    if any(d in domain for d in sales_domains):
        return [
            _RANKING_EXAMPLE,
            _FILTERED_RANKING_EXAMPLE,
            _TREND_EXAMPLE,
            _COMPOSITION_EXAMPLE,
        ]
    elif any(d in domain for d in hr_domains):
        return [
            _AVG_EXAMPLE,
            _AGGREGATION_EXAMPLE,
            _DISTRIBUTION_EXAMPLE,
            _COMPARISON_EXAMPLE,
        ]
    elif any(d in domain for d in healthcare_domains):
        return [
            _AGGREGATION_EXAMPLE,
            _AVG_EXAMPLE,
            _TREND_EXAMPLE,
            _DISTRIBUTION_EXAMPLE,
        ]
    else:
        return [
            _AGGREGATION_EXAMPLE,
            _RANKING_EXAMPLE,
            _TREND_EXAMPLE,
            _AVG_EXAMPLE,
        ]


def _generic_examples() -> str:
    """Minimal generic examples when no brain_profile is available."""
    import json
    examples = [
        {
            "question": "Total Sales by Region",
            "ir": {
                "intent": "aggregation", "aggregation": "SUM",
                "metric": "Sales", "dimensions": ["Region"],
                "filters": [], "sort": {"column": "Sales", "direction": "DESC"},
                "limit": None, "chart": "bar"
            }
        },
        {
            "question": "Top 10 Products by Quantity",
            "ir": {
                "intent": "ranking", "aggregation": "SUM",
                "metric": "Quantity", "dimensions": ["Product"],
                "filters": [], "sort": {"column": "Quantity", "direction": "DESC"},
                "limit": 10, "chart": "bar"
            }
        },
        {
            "question": "Monthly Sales trend",
            "ir": {
                "intent": "trend", "aggregation": "SUM",
                "metric": "Sales", "dimensions": ["OrderDate"],
                "filters": [], "sort": {"column": "OrderDate", "direction": "ASC"},
                "limit": None, "time_granularity": "month", "chart": "line"
            }
        },
    ]
    lines = []
    for ex in examples:
        lines.append(f"Question: {ex['question']}\nIR:\n{json.dumps(ex['ir'], indent=2)}")
    return "=== FEW-SHOT EXAMPLES ===\n\n" + "\n\n---\n\n".join(lines) + "\n\n=== END ==="
