from typing import List, Dict, Any
import pandas as pd

class DatasetProfiler:
    """
    Layer 1.1: Dataset Statistical Profiler.
    Calculates raw row counts, column data types, missing value percentages, and distinct cardinality.
    Purely statistical -- zero LLM or prompt strings.
    """

    @classmethod
    def profile_dataframe(cls, df: pd.DataFrame, dataset_name: str = "Dataset") -> Dict[str, Any]:
        columns = list(df.columns)
        row_count = len(df)
        col_count = len(columns)

        column_stats: Dict[str, Dict[str, Any]] = {}
        for col in columns:
            series = df[col]
            dtype_str = str(series.dtype).lower()
            null_count = int(series.isnull().sum())
            null_pct = round((null_count / row_count) * 100, 2) if row_count > 0 else 0.0
            distinct_count = int(series.nunique())

            is_numeric = any(nt in dtype_str for nt in ('int', 'float', 'double', 'number', 'decimal'))
            is_date = any(dk in col.lower() for dk in ('date', 'time', 'year', 'month', 'timestamp', 'day'))

            column_stats[col] = {
                'name': col,
                'raw_type': dtype_str,
                'is_numeric': is_numeric,
                'is_date': is_date,
                'null_count': null_count,
                'null_pct': null_pct,
                'distinct_count': distinct_count,
                'sample_values': series.dropna().unique()[:5].tolist()
            }

        return {
            'dataset_name': dataset_name,
            'row_count': row_count,
            'col_count': col_count,
            'column_stats': column_stats,
        }
