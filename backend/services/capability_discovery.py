from typing import List, Dict, Any

class CapabilityDiscovery:
    """
    Layer 3.1: Capability Discovery Engine.
    Inspects Dataset Profile JSON to infer supported analytical business capabilities:
    ✓ Revenue Analysis
    ✓ Profit Analysis
    ✓ Regional Geography Analysis
    ✓ Customer Segmentation
    ✓ Product Hierarchy Analysis
    ✓ Time-Series Analysis
    ✓ Discount Impact Analysis
    ✓ Volume Analysis
    """

    @classmethod
    def discover_capabilities(cls, brain_profile: Dict[str, Any]) -> List[Dict[str, str]]:
        capabilities: List[Dict[str, str]] = []
        roles = brain_profile.get('semantic_roles', {})

        role_values = list(roles.values())

        if 'Revenue Metric' in role_values:
            capabilities.append({
                'id': 'revenue',
                'title': 'Revenue Analysis',
                'description': 'Analyze revenue streams, gross sales, and average order values.'
            })

        if 'Profit Metric' in role_values:
            capabilities.append({
                'id': 'profitability',
                'title': 'Profitability Analysis',
                'description': 'Evaluate profit margins, net earnings, and high-margin segments.'
            })

        if 'Geography' in role_values:
            capabilities.append({
                'id': 'geography',
                'title': 'Regional Geography',
                'description': 'Compare performance across regions, cities, states, and territories.'
            })

        if 'Customer Dimension' in role_values:
            capabilities.append({
                'id': 'customer',
                'title': 'Customer Segmentation',
                'description': 'Identify top spending customers, buyer segments, and accounts.'
            })

        if 'Product Hierarchy' in role_values:
            capabilities.append({
                'id': 'product',
                'title': 'Product Hierarchy',
                'description': 'Break down revenue and units sold by category, sub-category, and SKU.'
            })

        if 'Time Dimension' in role_values:
            capabilities.append({
                'id': 'time_series',
                'title': 'Time-Series Trend Analysis',
                'description': 'Track monthly growth, quarterly trends, and trajectory over time.'
            })

        if 'Percentage Metric' in role_values:
            capabilities.append({
                'id': 'discount',
                'title': 'Discount & Tax Impact',
                'description': 'Analyze discount rates, promotions, and margin impact.'
            })

        if 'Volume Metric' in role_values:
            capabilities.append({
                'id': 'volume',
                'title': 'Volume & Units Sold',
                'description': 'Evaluate unit volume, quantity distribution, and inventory turnover.'
            })

        return capabilities
