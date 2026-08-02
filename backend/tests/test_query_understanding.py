import pytest
import pandas as pd
from backend.services.query_understanding_engine import QueryUnderstandingEngine, Capability
from backend.services.response_router import ResponseRouter
from backend.services.dataset_brain import DatasetBrain

@pytest.fixture
def sales_dataset_df():
    data = {
        'Product': ['Widget A', 'Widget B', 'Widget C', 'Widget D'],
        'Sales': [1000.0, 1500.0, 1200.0, 1800.0],
        'Region': ['South', 'South', 'North', 'West'],
        'Order_Date': ['2023-01-01', '2023-02-01', '2023-03-01', '2023-04-01']
    }
    return pd.DataFrame(data)


def test_query_understanding_capability_scoring(sales_dataset_df):
    profile = DatasetBrain.build_brain_profile(sales_dataset_df)

    # 1. Schema Query Capability
    u1 = QueryUnderstandingEngine.understand("What columns are available?", profile)
    assert u1.capability == Capability.SCHEMA
    assert not u1.requires_sql

    # 2. Quality Query Capability
    u2 = QueryUnderstandingEngine.understand("Are there missing or null values?", profile)
    assert u2.capability == Capability.QUALITY
    assert not u2.requires_sql

    # 3. Summary Query Capability
    u3 = QueryUnderstandingEngine.understand("Explain this dataset summary", profile)
    assert u3.capability == Capability.SUMMARY
    assert not u3.requires_sql

    # 4. Help / Greeting Capability
    u4 = QueryUnderstandingEngine.understand("Hello", profile)
    assert u4.capability == Capability.HELP
    assert not u4.requires_sql

    # 5. Query / Analytics Capability
    u5 = QueryUnderstandingEngine.understand("What specific products were driving sales in South region?", profile)
    assert u5.capability == Capability.QUERY
    assert u5.requires_sql


def test_query_understanding_entity_and_value_extraction(sales_dataset_df):
    profile = DatasetBrain.build_brain_profile(sales_dataset_df)

    query = "What specific products were driving sales in the South region?"
    u = QueryUnderstandingEngine.understand(query, profile)

    assert u.capability == Capability.QUERY
    assert "Sales" in u.entities.metrics
    assert "Product" in u.entities.dimensions
    assert "Region" not in u.entities.dimensions  # Omitted from grouping dimensions due to equality filter
    
    filters = u.entities.filters
    assert len(filters) == 1
    assert filters[0].column == "Region"
    assert filters[0].value == "South"

    plan = u.execution_plan
    assert plan.metric == "Sales"
    assert plan.dimension == "Product"
    assert "Region" not in plan.group_by
    assert plan.intent == "ranking"
    assert plan.analysis_shape == "TOP_N"


def test_response_router_capability_dispatch(sales_dataset_df):
    # Test router for non-SQL capabilities
    res_schema = ResponseRouter.route_query("What columns are available?", sales_dataset_df, "Sales_Data")
    assert res_schema["capability"] == Capability.SCHEMA.value
    assert not res_schema["requires_sql"]

    res_quality = ResponseRouter.route_query("Check missing data and nulls", sales_dataset_df, "Sales_Data")
    assert res_quality["capability"] == Capability.QUALITY.value
    assert not res_quality["requires_sql"]

    # Test router for SQL query capability
    res_query = ResponseRouter.route_query("Monthly sales trend", sales_dataset_df, "Sales_Data")
    assert res_query["capability"] == Capability.QUERY.value
    assert res_query["requires_sql"]
    assert "execution_plan" in res_query


def test_top_selling_product_in_south_region_sql_generation():
    df = pd.DataFrame({
        'Product': ['Widget A', 'Widget B', 'Widget C'],
        'Quantity': [10, 25, 15],
        'Sales': [100.0, 250.0, 150.0],
        'Region': ['South', 'South', 'North']
    })
    
    from backend.nl2sql_engine.orchestrator import NL2SQLEngine
    res = NL2SQLEngine.process(
        query="Top selling product in South region",
        available_columns=list(df.columns),
        column_types={c: str(df[c].dtype) for c in df.columns},
        df_data=df
    )

    sql = res['sql']
    assert 'WHERE "Region" = \'South\'' in sql or "WHERE \"Region\" = 'South'" in sql
    assert 'GROUP BY "Product"' in sql
    assert 'GROUP BY "Product", "Region"' not in sql
    assert 'ORDER BY' in sql
    assert 'LIMIT' in sql

