import pytest
import pandas as pd

from backend.services.dataset_brain import DatasetBrain
from backend.services.query_understanding_engine import QueryUnderstandingEngine, Capability
from backend.services.clarification_engine import ClarificationEngine
from backend.services.feedback_service import FeedbackService

@pytest.fixture
def sales_df():
    data = {
        'Product': ['Widget A', 'Widget B', 'Widget C'],
        'Sales': [100.0, 250.0, 150.0],
        'Revenue': [120.0, 300.0, 180.0],
        'Quantity': [10, 25, 15],
        'Region': ['South', 'South', 'North'],
        'Order_Date': ['2023-01-01', '2023-02-01', '2023-03-01']
    }
    return pd.DataFrame(data)


def test_rich_dataset_brain_metadata(sales_df):
    profile = DatasetBrain.build_brain_profile(sales_df)
    meta = profile['column_metadata']

    assert 'Sales' in meta
    sales_meta = meta['Sales']
    assert sales_meta['role'] == 'metric'
    assert sales_meta['aggregation'] == 'SUM'
    assert 'line' in sales_meta['recommended_charts']
    assert 'trend' in sales_meta['supported_analysis']
    assert sales_meta['cardinality'] == 3
    assert len(sales_meta['example_values']) > 0


def test_rich_execution_plan_and_high_confidence_local_execution(sales_df):
    profile = DatasetBrain.build_brain_profile(sales_df)
    
    # High-confidence query -> confidence >= 0.85
    u = QueryUnderstandingEngine.understand("What specific products were driving sales in South region?", profile)
    
    assert u.confidence >= 0.85
    plan = u.execution_plan
    assert plan.metric == "Sales"
    assert plan.aggregation == "SUM"
    assert plan.dimension == "Product"
    assert plan.chart_hint == "bar"
    assert plan.analysis_shape == "TOP_N"
    assert plan.confidence >= 0.85


def test_clarification_engine_detection(sales_df):
    profile = DatasetBrain.build_brain_profile(sales_df)
    u = QueryUnderstandingEngine.understand("Show income performance", profile)

    eval_res = ClarificationEngine.evaluate("Show income performance", u, profile)
    assert eval_res is not None
    assert eval_res['requires_clarification'] is True
    assert len(eval_res['options']) > 0


def test_feedback_service_logging():
    FeedbackService.log_execution(
        query="Top products by sales in South",
        capability="QUERY",
        confidence=0.96,
        bypassed_llm=True,
        execution_plan={"intent": "ranking", "metric": "Sales"},
        sql="SELECT Product, SUM(Sales) FROM df WHERE Region = 'South' GROUP BY Product",
        execution_time_ms=12,
        status="success"
    )

    recent = FeedbackService.get_recent_telemetry(1)
    assert len(recent) == 1
    assert recent[0]['query'] == "Top products by sales in South"
    assert recent[0]['bypassed_llm'] is True
