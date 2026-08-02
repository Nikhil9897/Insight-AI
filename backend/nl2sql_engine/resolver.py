import re
from difflib import SequenceMatcher
from typing import List, Dict, Optional, Tuple, Any

SYNONYM_MAP: Dict[str, List[str]] = {
    'revenue': ['totalamount', 'amount', 'sales', 'salesamount', 'profit', 'revenue', 'turnover', 'earnings', 'grandtotal', 'subtotal'],
    'sales': ['salesamount', 'totalamount', 'amount', 'unitsold', 'quantity', 'sales', 'revenue'],
    'profit': ['netprofit', 'profit', 'margin', 'grossmargin', 'earnings', 'gain'],
    'customer': ['customername', 'customerid', 'customer', 'client', 'buyer', 'purchaser', 'consumer', 'account'],
    'client': ['customername', 'customerid', 'customer', 'client', 'buyer'],
    'city': ['shipcity', 'city', 'location', 'town', 'municipality', 'billingcity'],
    'country': ['shipcountry', 'country', 'nation', 'billingcountry'],
    'state': ['shipstate', 'state', 'province', 'region', 'billingstate'],
    'region': ['region', 'territory', 'zone', 'area', 'shipregion', 'district'],
    'product': ['productname', 'productid', 'product', 'item', 'itemname', 'goods', 'merchandise'],
    'item': ['productname', 'itemname', 'product', 'item'],
    'category': ['categoryname', 'category', 'segment', 'productcategory', 'type', 'group'],
    'order': ['orderid', 'ordernumber', 'transactionid', 'orderdate', 'order'],
    'date': ['orderdate', 'createddate', 'transactiondate', 'date', 'shipdate', 'timestamp'],
    'quantity': ['quantity', 'units', 'volume', 'qty', 'count', 'amount'],
    'price': ['unitprice', 'price', 'rate', 'cost', 'fee', 'msrp'],
    'discount': ['discount', 'rebate', 'deduction', 'markdown'],
}

SQL_KEYWORDS = {'show', 'list', 'average', 'avg', 'mean', 'sum', 'total', 'count', 'max', 'maximum', 'min', 'minimum', 'top', 'bottom', 'by', 'over', 'time', 'the', 'for', 'each', 'all', 'and', 'with'}

class SchemaResolver:
    """
    Multi-tier Schema Grounding & Fuzzy Column Resolver.
    Resolves natural language tokens to exact column names using:
    1. Exact Match
    2. Case-Insensitive Match
    3. Token & Sequence Similarity Match
    4. Business Synonym Dictionary Mapping
    """

    @staticmethod
    def resolve_column(token: str, available_columns: List[str], threshold: float = 0.65) -> Optional[str]:
        if not token or not available_columns:
            return None

        cleaned_token = token.strip().lower()
        cleaned_token_alphanumeric = re.sub(r'[^a-z0-9]', '', cleaned_token)

        if cleaned_token_alphanumeric in SQL_KEYWORDS:
            return None

        # 1. Exact match
        for col in available_columns:
            if col == token:
                return col

        # 2. Case-insensitive exact match
        for col in available_columns:
            if col.lower() == cleaned_token:
                return col

        # 3. Alphanumeric normalized exact match (e.g. ship_city vs ShipCity)
        for col in available_columns:
            col_clean = re.sub(r'[^a-z0-9]', '', col.lower())
            if col_clean == cleaned_token_alphanumeric:
                return col

        # 4. Business Synonym Dictionary Match
        if cleaned_token_alphanumeric in SYNONYM_MAP:
            synonyms = SYNONYM_MAP[cleaned_token_alphanumeric]
            for col in available_columns:
                col_clean = re.sub(r'[^a-z0-9]', '', col.lower())
                if col_clean in synonyms or any(s in col_clean for s in synonyms):
                    return col

        # 5. Fuzzy String Similarity (SequenceMatcher)
        best_col: Optional[str] = None
        best_score: float = 0.0

        for col in available_columns:
            col_clean = re.sub(r'[^a-z0-9]', '', col.lower())
            
            # Substring containment boost
            if cleaned_token_alphanumeric in col_clean or col_clean in cleaned_token_alphanumeric:
                score = 0.85
            else:
                score = SequenceMatcher(None, cleaned_token_alphanumeric, col_clean).ratio()

            if score > best_score and score >= threshold:
                best_score = score
                best_col = col

        return best_col

    @classmethod
    def resolve_query_columns(cls, raw_metrics: List[str], raw_dimensions: List[str], available_columns: List[str]) -> Tuple[List[str], List[str], List[str]]:
        """
        Resolves list of metric names and dimension names against available database columns.
        Returns: (resolved_metrics, resolved_dimensions, warnings)
        """
        resolved_metrics: List[str] = []
        resolved_dims: List[str] = []
        notes: List[str] = []

        for m in raw_metrics:
            res = cls.resolve_column(m, available_columns)
            if res:
                if res not in resolved_metrics:
                    resolved_metrics.append(res)
            else:
                notes.append(f"Could not map metric '{m}' to schema columns.")

        for d in raw_dimensions:
            res = cls.resolve_column(d, available_columns)
            if res:
                if res not in resolved_dims and res not in resolved_metrics:
                    resolved_dims.append(res)
            else:
                notes.append(f"Could not map dimension '{d}' to schema columns.")

        return resolved_metrics, resolved_dims, notes

    @classmethod
    def resolve_value(cls, token: str, value_index: Dict[str, str], column_metadata: Dict[str, Dict[str, Any]]) -> Optional[Tuple[str, str]]:
        """
        Resolves a natural language token to (column_name, exact_value) if it matches
        a categorical distinct value in DatasetBrain / ColumnMetadata.
        """
        if not token:
            return None
        t_clean = token.strip().lower()
        
        # 1. Direct lookup in value_index
        if t_clean in value_index:
            col_name = value_index[t_clean]
            distincts = column_metadata.get(col_name, {}).get('distinct_values', [])
            exact_val = next((v for v in distincts if str(v).lower() == t_clean), token.capitalize())
            return col_name, exact_val

        # 2. Check distinct_values inside column_metadata
        for col_name, meta in column_metadata.items():
            distincts = meta.get('distinct_values', [])
            for v in distincts:
                v_str = str(v).strip()
                if v_str.lower() == t_clean:
                    return col_name, v_str

        return None

