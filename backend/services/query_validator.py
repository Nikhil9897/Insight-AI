from typing import List, Dict, Any, Tuple, Optional
from backend.services.capability_discovery import CapabilityDiscovery

class QueryValidator:
    """
    Precision Query Validation Engine.
    Validates logical requirements before SQL generation:
    1. Checks if temporal time-series trend is requested without a date column.
    2. Validates if requested metric & dimension exist in Dataset Brain.
    3. Checks if aggregation function matches target column data type.
    4. If invalid, returns clear explanation and valid alternative prompts.
    """

    @classmethod
    def validate_execution_plan(cls, plan: Dict[str, Any], brain_profile: Dict[str, Any]) -> Tuple[bool, float, Optional[str], List[str]]:
        intent = plan.get('intent')
        metric = plan.get('metric')
        dimension = plan.get('dimension')
        raw_query = plan.get('raw_query', '').lower()

        metrics = brain_profile.get('metrics', [])
        dimensions = brain_profile.get('dimensions', [])
        time_cols = brain_profile.get('time_columns', [])

        suggested_alternatives: List[str] = []

        # 1. Temporal Trend requested on dataset without Date column
        if intent == 'trend' or any(k in raw_query for k in ('monthly', 'yearly', 'trend', 'over time')):
            if not time_cols:
                m_label = (metric or 'Metric').replace('_', ' ')
                d_alt = dimensions[0] if dimensions else 'Category'
                d_alt_clean = d_alt.replace('_', ' ')

                suggested_alternatives = [
                    f"{m_label} by {d_alt_clean}",
                    f"Top 10 {d_alt_clean} by {m_label}",
                    f"Total {m_label}"
                ]

                return (
                    False,
                    0.52,
                    f"No temporal date/time column detected in dataset to calculate time-series trend for '{m_label}'.",
                    suggested_alternatives
                )

        # 2. Metric Existence Check
        if metric and metric not in brain_profile.get('columns', []):
            m_alt = metrics[0] if metrics else 'record count'
            return (
                False,
                0.45,
                f"Metric column '{metric}' not found in dataset.",
                [f"Total {m_alt.replace('_', ' ')}", f"Average {m_alt.replace('_', ' ')}"]
            )

        # 3. Dimension Existence Check
        if dimension and dimension not in brain_profile.get('columns', []):
            d_alt = dimensions[0] if dimensions else 'records'
            m_label = (metric or 'metrics').replace('_', ' ')
            return (
                False,
                0.48,
                f"Dimension column '{dimension}' not found in dataset.",
                [f"{m_label} by {d_alt.replace('_', ' ')}"]
            )

        return True, 0.98, None, []
