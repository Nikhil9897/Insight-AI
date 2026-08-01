import re
from difflib import SequenceMatcher
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from backend.services.dataset_profiler import DatasetProfiler

SEMANTIC_ROLE_ALIASES: Dict[str, List[str]] = {
    'Revenue Metric': ['sales', 'revenue', 'amount', 'totalamount', 'turnover', 'income', 'netsales', 'grosssales', 'grandtotal', 'subtotal', 'price', 'unitprice'],
    'Profit Metric': ['profit', 'netprofit', 'grossprofit', 'margin', 'grossmargin', 'earnings', 'gain'],
    'Volume Metric': ['quantity', 'qty', 'units', 'unitsold', 'items', 'volume'],
    'Percentage Metric': ['discount', 'tax', 'rate', 'marginrate', 'pct', 'percent', 'percentage'],
    'Geography': ['region', 'city', 'shipcity', 'state', 'shipstate', 'country', 'shipcountry', 'territory', 'zone', 'area', 'district', 'zipcode'],
    'Customer Dimension': ['customer', 'customername', 'customerid', 'client', 'buyer', 'consumer', 'account', 'customersegment', 'segment'],
    'Product Hierarchy': ['category', 'categoryname', 'subcategory', 'product', 'productname', 'productid', 'sku', 'item', 'itemname', 'brand'],
    'Time Dimension': ['orderdate', 'createddate', 'transactiondate', 'date', 'shipdate', 'year', 'month', 'timestamp', 'day', 'quarter'],
    'Identifier': ['orderid', 'id', 'transactionid', 'uuid', 'rowid', 'code']
}

class DatasetBrain:
    """
    Layer 1: Dataset Understanding (The Dataset Brain).
    Analyzes dataset schema, detects precise semantic business roles via fuzzy matching & synonym dictionaries,
    and returns a structured Dataset Profile JSON.
    Pure data understanding -- NO SQL generation, NO prompt strings, NO UI code.
    """

    @classmethod
    def detect_semantic_role(cls, column_name: str, is_numeric: bool, is_date: bool) -> str:
        col_clean = re.sub(r'[^a-z0-9]', '', column_name.lower())

        # Check explicit synonyms first
        for role, aliases in SEMANTIC_ROLE_ALIASES.items():
            if col_clean in aliases or any(a == col_clean for a in aliases):
                return role

        # Check substring containment
        for role, aliases in SEMANTIC_ROLE_ALIASES.items():
            if any(a in col_clean for a in aliases):
                return role

        # Check fuzzy ratio
        for role, aliases in SEMANTIC_ROLE_ALIASES.items():
            for alias in aliases:
                if SequenceMatcher(None, col_clean, alias).ratio() > 0.8:
                    return role

        # Fallback role based on data type
        if is_date:
            return "Time Dimension"
        if is_numeric:
            return "Numeric Measure"
        return "Categorical Dimension"

    @classmethod
    def classify_domain(cls, roles: List[str]) -> Tuple[str, int]:
        """
        Classifies business domain metadata based on detected semantic roles.
        Returns: (domain_name, confidence_percentage)
        """
        role_counts = {role: roles.count(role) for role in set(roles)}

        if role_counts.get('Revenue Metric', 0) > 0 and (role_counts.get('Geography', 0) > 0 or role_counts.get('Product Hierarchy', 0) > 0):
            return "Retail & Enterprise Sales", 98
        elif role_counts.get('Customer Dimension', 0) > 0 and role_counts.get('Revenue Metric', 0) > 0:
            return "Customer & E-Commerce Analytics", 94
        elif any('patient' in r.lower() or 'hospital' in r.lower() for r in roles):
            return "Healthcare & Clinical Analytics", 95
        elif any('salary' in r.lower() or 'employee' in r.lower() for r in roles):
            return "HR & Workforce Analytics", 92
        elif role_counts.get('Time Dimension', 0) > 0 and role_counts.get('Numeric Measure', 0) > 0:
            return "Financial & Time-Series Analytics", 90
        
        return "General Business Analytics", 85

    @classmethod
    def build_brain_profile(cls, df: pd.DataFrame, dataset_name: str = "Enterprise Dataset") -> Dict[str, Any]:
        """
        Builds the complete Dataset Profile JSON ('The Brain').
        """
        raw_profile = DatasetProfiler.profile_dataframe(df, dataset_name=dataset_name)
        col_stats = raw_profile['column_stats']

        metrics: List[str] = []
        dimensions: List[str] = []
        time_columns: List[str] = []
        identifiers: List[str] = []
        semantic_roles: Dict[str, str] = {}
        all_roles_list: List[str] = []

        for col_name, stats in col_stats.items():
            role = cls.detect_semantic_role(col_name, stats['is_numeric'], stats['is_date'])
            semantic_roles[col_name] = role
            all_roles_list.append(role)

            if role in ('Revenue Metric', 'Profit Metric', 'Volume Metric', 'Percentage Metric', 'Numeric Measure'):
                metrics.append(col_name)
            elif role in ('Time Dimension',):
                time_columns.append(col_name)
            elif role in ('Identifier',):
                identifiers.append(col_name)
            else:
                dimensions.append(col_name)

        domain, domain_conf = cls.classify_domain(all_roles_list)

        # Build Rich Column Metadata & Categorized Knowledge Graph
        column_metadata: Dict[str, Dict[str, Any]] = {}
        for col_name, stats in col_stats.items():
            role = semantic_roles[col_name]
            is_num = stats['is_numeric']
            is_dt = stats['is_date']
            
            # Determine fine-grained column type
            if role in ('Revenue Metric', 'Profit Metric'):
                col_type = 'currency'
            elif is_dt or role == 'Time Dimension':
                col_type = 'date'
            elif is_num:
                col_type = 'numeric'
            elif role == 'Identifier':
                col_type = 'identifier'
            else:
                col_type = 'categorical'

            # Default aggregation per column type
            if role in ('Revenue Metric', 'Profit Metric', 'Volume Metric'):
                agg = 'SUM'
            elif role in ('Percentage Metric',):
                agg = 'AVG'
            elif is_num:
                agg = 'SUM'
            else:
                agg = 'NONE'

            column_metadata[col_name] = {
                'name': col_name,
                'type': col_type,
                'business_role': role,
                'aggregation': agg,
                'sortable': True,
            }

        # Knowledge Graph: map metrics to categorized dimensions & supported analytical shapes
        knowledge_graph: Dict[str, Dict[str, Any]] = {}
        geo_dims = [c for c, r in semantic_roles.items() if r == 'Geography']
        hier_dims = [c for c, r in semantic_roles.items() if r == 'Product Hierarchy']
        cust_dims = [c for c, r in semantic_roles.items() if r == 'Customer Dimension']
        cat_dims = [c for c in dimensions if c not in geo_dims and c not in hier_dims and c not in cust_dims] + cust_dims

        for m in metrics:
            default_agg = column_metadata.get(m, {}).get('aggregation', 'SUM')
            knowledge_graph[m] = {
                'dimensions': {
                    'time': time_columns,
                    'categorical': cat_dims,
                    'geography': geo_dims,
                    'hierarchy': hier_dims,
                },
                'default_aggregation': default_agg,
                'supported_analysis': ['trend', 'comparison', 'composition', 'ranking', 'distribution']
            }

        return {
            'dataset_name': dataset_name,
            'domain': domain,
            'domain_confidence': domain_conf,
            'row_count': raw_profile['row_count'],
            'col_count': raw_profile['col_count'],
            'metrics': metrics,
            'dimensions': dimensions,
            'time_columns': time_columns,
            'identifiers': identifiers,
            'semantic_roles': semantic_roles,
            'columns': list(col_stats.keys()),
            'column_metadata': column_metadata,
            'knowledge_graph': knowledge_graph,
        }

