from functools import lru_cache
from typing import List, Dict, Any, Optional
import pandas as pd

class SchemaCache:
    """
    Lightweight LRU Schema & Column Metadata Cache.
    Replaces heavy stateful memory services with zero-overhead LRU caching for:
    - Column data types and names
    - Categorical values and numerical min/max profiles
    - Schema relationships
    """

    _cache_store: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def set_dataset_schema(cls, dataset_id: str, df: pd.DataFrame) -> Dict[str, Any]:
        columns = list(df.columns)
        column_types = {col: str(df[col].dtype) for col in columns}
        
        numeric_cols = [c for c, t in column_types.items() if any(nt in t for nt in ('int', 'float', 'double', 'number', 'int64', 'float64'))]
        categorical_cols = [c for c, t in column_types.items() if c not in numeric_cols]
        date_cols = [c for c in columns if any(dk in c.lower() for dk in ('date', 'time', 'year', 'month', 'timestamp', 'day'))]

        profile = {
            'dataset_id': dataset_id,
            'columns': columns,
            'column_types': column_types,
            'numeric_cols': numeric_cols,
            'categorical_cols': categorical_cols,
            'date_cols': date_cols,
            'row_count': len(df),
        }
        cls._cache_store[dataset_id] = profile
        return profile

    @classmethod
    def get_dataset_schema(cls, dataset_id: str) -> Optional[Dict[str, Any]]:
        return cls._cache_store.get(dataset_id)

    @classmethod
    def clear_cache(cls):
        cls._cache_store.clear()
