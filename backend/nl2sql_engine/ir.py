from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

@dataclass
class QueryIR:
    intent: str = "aggregation"  # aggregation, comparison, trend, distribution, correlation, raw_data, metadata
    metrics: List[str] = field(default_factory=list)
    dimensions: List[str] = field(default_factory=list)
    date_cols: List[str] = field(default_factory=list)
    time_dimension: Optional[str] = None
    time_granularity: Optional[str] = None  # year, month, day, quarter, week
    analysis_shape: Optional[str] = None  # TIME_SERIES, CATEGORICAL, DISTRIBUTION, CORRELATION, COMPOSITION, SINGLE_VALUE, TOP_N, RANKING, GEO, HIERARCHY
    stat_fn: Optional[str] = None  # SUM, AVG, COUNT, MIN, MAX, CORRELATION

    filters: List[Dict[str, Any]] = field(default_factory=list)
    group_by: List[str] = field(default_factory=list)
    order_by: List[Dict[str, str]] = field(default_factory=list)  # [{"col": "Sales", "dir": "DESC"}]
    limit: Optional[int] = None
    chart: Optional[str] = None  # bar, line, area, pie, donut, treemap, box_plot, bubble, etc.
    confidence: float = 0.95
    raw_query: str = ""
    resolved_schema: Dict[str, Any] = field(default_factory=dict)
    validation_notes: List[str] = field(default_factory=list)
