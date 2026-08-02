import pytest
import pandas as pd
from backend.services.query_understanding_engine import QueryUnderstandingEngine, Capability
from backend.services.response_router import ResponseRouter
from backend.services.dataset_brain import DatasetBrain

@pytest.fixture
def sample_sales_df():
    data = {
        'Product': ['Widget A', 'Widget B', 'Widget C', 'Widget D'],
        'Sales': [1000.0, 1500.0, 1200.0, 1800.0],
        'Region': ['North', 'South', 'East', 'West'],
        'Order_Date': ['2023-01-01', '2023-02-01', '2023-03-01', '2023-04-01']
    }
    return pd.DataFrame(data)


def test_classify_schema_queries(sample_sales_df):
    profile = DatasetBrain.build_brain_profile(sample_sales_df)

    res1 = QueryUnderstandingEngine.understand("What columns are available?", profile)
    assert res1.capability == Capability.SCHEMA
    assert not res1.requires_sql

    res2 = QueryUnderstandingEngine.understand("Show dataset schema fields", profile)
    assert res2.capability == Capability.SCHEMA
    assert not res2.requires_sql


def test_classify_data_quality_queries(sample_sales_df):
    profile = DatasetBrain.build_brain_profile(sample_sales_df)

    res1 = QueryUnderstandingEngine.understand("Are there any missing values?", profile)
    assert res1.capability == Capability.QUALITY
    assert not res1.requires_sql

    res2 = QueryUnderstandingEngine.understand("Check duplicates and null count", profile)
    assert res2.capability == Capability.QUALITY
    assert not res2.requires_sql


def test_classify_explanation_and_greeting_queries(sample_sales_df):
    profile = DatasetBrain.build_brain_profile(sample_sales_df)

    res1 = QueryUnderstandingEngine.understand("Explain this dataset", profile)
    assert res1.capability == Capability.SUMMARY
    assert not res1.requires_sql

    res2 = QueryUnderstandingEngine.understand("Hello", profile)
    assert res2.capability == Capability.HELP
    assert not res2.requires_sql


def test_classify_analytics_queries(sample_sales_df):
    profile = DatasetBrain.build_brain_profile(sample_sales_df)

    res1 = QueryUnderstandingEngine.understand("Monthly sales trend", profile)
    assert res1.capability == Capability.QUERY
    assert res1.requires_sql

    res2 = QueryUnderstandingEngine.understand("Top products by sales in South region", profile)
    assert res2.capability == Capability.QUERY
    assert res2.requires_sql


def test_response_router_direct_non_sql_resolution(sample_sales_df):
    # Schema Query Router
    schema_res = ResponseRouter.route_query("What columns are available?", sample_sales_df, "Sales_Data")
    assert not schema_res["requires_sql"]
    assert schema_res["capability"] == Capability.SCHEMA.value
    assert len(schema_res["rows"]) == 4  # Product, Sales, Region, Order_Date

    # Data Quality Router
    dq_res = ResponseRouter.route_query("Are there any missing values?", sample_sales_df, "Sales_Data")
    assert not dq_res["requires_sql"]
    assert dq_res["capability"] == Capability.QUALITY.value
    assert "Missing Value Distribution" in dq_res["chartConfig"]["title"]

    # Explanation Router
    exp_res = ResponseRouter.route_query("Explain this dataset", sample_sales_df, "Sales_Data")
    assert not exp_res["requires_sql"]
    assert exp_res["capability"] == Capability.SUMMARY.value

    # Analytics Query Router
    ana_res = ResponseRouter.route_query("What specific products were driving sales in South region?", sample_sales_df, "Sales_Data")
    assert ana_res["requires_sql"]
    assert ana_res["capability"] == Capability.QUERY.value
