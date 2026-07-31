from typing import List, Dict, Any
from backend.services.capability_discovery import CapabilityDiscovery

class SuggestionEngine:
    """
    Layer 3.2: Capability-Driven Algorithmic Suggestion & Star Rating Generator.
    Connects directly to CapabilityDiscovery. Prompts are ONLY generated for supported capabilities.
    Scores and ranks candidate questions with 3 to 5 star ratings.
    """

    @classmethod
    def generate_ranked_suggestions(cls, brain_profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        metrics = brain_profile.get('metrics', [])
        dimensions = brain_profile.get('dimensions', [])
        time_cols = brain_profile.get('time_columns', [])
        semantic_roles = brain_profile.get('semantic_roles', {})

        # Discover supported capabilities
        capabilities = CapabilityDiscovery.discover_capabilities(brain_profile)
        supported_ids = {c['id'] for c in capabilities}

        suggestions: List[Dict[str, Any]] = []

        for m in metrics:
            m_clean = m.replace('_', ' ')
            m_role = semantic_roles.get(m, 'Metric')

            # Summary Suggestions (Always supported)
            suggestions.append({
                'prompt': f"Total {m_clean}",
                'metric': m,
                'dimension': None,
                'category': 'Summary',
                'stars': 5,
                'rating_label': '★★★★★'
            })

            # Metric by Dimension Breakdown (If geography, customer, or product capability supported)
            for d in dimensions:
                d_role = semantic_roles.get(d, 'Dimension')
                d_clean = d.replace('_', ' ')

                # Check if dimension matches supported capability
                if (d_role == 'Geography' and 'geography' not in supported_ids) or \
                   (d_role == 'Customer Dimension' and 'customer' not in supported_ids) or \
                   (d_role == 'Product Hierarchy' and 'product' not in supported_ids):
                    continue

                is_high_impact = m_role in ('Revenue Metric', 'Profit Metric') and d_role in ('Geography', 'Customer Dimension', 'Product Hierarchy')
                stars = 5 if is_high_impact else 4
                star_label = '★★★★★' if stars == 5 else '★★★★☆'

                suggestions.append({
                    'prompt': f"{m_clean} by {d_clean}",
                    'metric': m,
                    'dimension': d,
                    'category': d_role,
                    'stars': stars,
                    'rating_label': star_label
                })

                if stars == 5:
                    suggestions.append({
                        'prompt': f"Top 10 {d_clean} by {m_clean}",
                        'metric': m,
                        'dimension': d,
                        'category': d_role,
                        'stars': 5,
                        'rating_label': '★★★★★'
                    })

            # Time Series Trend ONLY IF time_series capability is supported
            if 'time_series' in supported_ids and time_cols:
                for t_col in time_cols:
                    t_clean = t_col.replace('_', ' ')
                    suggestions.append({
                        'prompt': f"Monthly {m_clean} trend over {t_clean}",
                        'metric': m,
                        'dimension': t_col,
                        'category': 'Time-Series',
                        'stars': 5,
                        'rating_label': '★★★★★'
                    })

        # Sort by Stars Descending & Deduplicate
        seen_prompts = set()
        deduped: List[Dict[str, Any]] = []

        for s in sorted(suggestions, key=lambda x: x['stars'], reverse=True):
            if s['prompt'] not in seen_prompts:
                seen_prompts.add(s['prompt'])
                deduped.append(s)

        return deduped[:20]
