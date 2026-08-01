import pytest
import pandas as pd
from backend.services.dataset_brain import DatasetBrain
from backend.services.intent_parser import intent_parser
from backend.services.query_planner import QueryPlanner
from backend.nl2sql_engine.query_validator import QueryValidator
from backend.nl2sql_engine.sql_generator import SQLGenerator
from backend.services.chart_recommender import recommend_chart

@pytest.fixture
def sample_sales_df():
    data = {
        'Order_Date': ['2023-01-01', '2023-02-01', '2023-03-01', '2023-04-01'],
        'Sales': [1000.0, 1500.0, 1200.0, 1800.0],
        'Region': ['North', 'South', 'East', 'West'],
        'CustomerName': ['Alice', 'Bob', 'Charlie', 'Diana']
    }
    return pd.DataFrame(data)


def test_dataset_brain_knowledge_graph_and_metadata(sample_sales_df):
    profile = DatasetBrain.build_brain_profile(sample_sales_df, dataset_name="Sales_Dataset")

    assert 'column_metadata' in profile
    assert 'knowledge_graph' in profile

    col_meta = profile['column_metadata']
    assert col_meta['Sales']['type'] == 'currency'
    assert col_meta['Sales']['aggregation'] == 'SUM'
    assert col_meta['Order_Date']['type'] == 'date'

    kg = profile['knowledge_graph']
    assert 'Sales' in kg
    assert 'Order_Date' in kg['Sales']['dimensions']['time']
    assert 'Region' in kg['Sales']['dimensions']['geography'] or 'Region' in kg['Sales']['dimensions']['categorical']


def test_intent_parser_monthly_sales_trend():
    columns = ['Order_Date', 'Sales', 'Region', 'CustomerName']
    col_profiles = [
        {'name': 'Order_Date', 'type': 'date'},
        {'name': 'Sales', 'type': 'number'},
        {'name': 'Region', 'type': 'string'},
        {'name': 'CustomerName', 'type': 'string'},
    ]

    ir = intent_parser.parse("Monthly Sales Trend", columns, col_profiles)

    assert ir.intent == "trend"
    assert ir.analysis_shape == "TIME_SERIES"
    assert ir.time_granularity == "month"
    assert ir.time_dimension == "Order_Date"
    assert "Order_Date" in ir.dimensions


def test_query_planner_trend_dimension_fallback(sample_sales_df):
    profile = DatasetBrain.build_brain_profile(sample_sales_df)
    plan = QueryPlanner.plan_query("Monthly Sales Trend", profile)

    assert plan['intent'] == "trend"
    assert plan['analysis_shape'] == "TIME_SERIES"
    assert plan['dimension'] == "Order_Date"
    assert plan['metric'] == "Sales"


def test_query_validator_blocks_avg_on_string():
    from backend.nl2sql_engine.ir import QueryIR

    ir = QueryIR(
        intent="aggregation",
        metrics=["CustomerName"],
        dimensions=["Region"],
        stat_fn="AVG"
    )
    col_types = {'CustomerName': 'string', 'Region': 'string'}
    available_cols = ['CustomerName', 'Region']

    is_valid, errors = QueryValidator.validate_ir(ir, available_cols, col_types)

    assert not is_valid
    assert any("Cannot apply mathematical function" in err for err in errors)


def test_sql_generator_time_series_asc_ordering():
    from backend.nl2sql_engine.ir import QueryIR

    ir = QueryIR(
        intent="trend",
        analysis_shape="TIME_SERIES",
        metrics=["Sales"],
        dimensions=["Order_Date"],
        time_granularity="month",
        date_cols=["Order_Date"],
        time_dimension="Order_Date"
    )

    sql = SQLGenerator.generate_sql(ir, table_name="df", dialect="duckdb")

    assert "DATE_TRUNC('month', TRY_CAST(\"Order_Date\" AS DATE))" in sql
    assert "ORDER BY \"Order_Date_granularity\" ASC" in sql


def test_chart_recommender_prioritizes_trend_intent():
    rows = [{'Order_Date': '2023-01-01', 'Sales': 1000.0}]
    cols = ['Order_Date', 'Sales']

    config, explanation = recommend_chart(
        user_query="Monthly Sales Trend",
        rows=rows,
        columns=cols,
        analysis_shape="TIME_SERIES",
        query_intent="trend"
    )

    assert config['type'] in ('line', 'area')
    assert config['type'] != 'kpi'


def test_monthly_sales_trend_auto_binds_date_column(sample_sales_df):
    from backend.nl2sql_engine import NL2SQLEngine

    available_cols = ['Order_Date', 'Sales', 'Region']
    col_types = {'Order_Date': 'date', 'Sales': 'float', 'Region': 'string'}

    res = NL2SQLEngine.process(
        query="monthly sales trend",
        available_columns=available_cols,
        column_types=col_types,
        df_data=sample_sales_df
    )

    assert res['is_valid']
    sql = res['sql']
    assert "DATE_TRUNC('month', TRY_CAST(\"Order_Date\" AS DATE))" in sql
    assert "ORDER BY \"Order_Date_granularity\" ASC" in sql
    assert "GROUP BY" in sql


def test_top_customers_by_sales_sum_and_group_by():
    from backend.nl2sql_engine import NL2SQLEngine

    res = NL2SQLEngine.process(
        query="top customers by sales",
        available_columns=['CustomerID', 'Sales'],
        column_types={'CustomerID': 'string', 'Sales': 'float'}
    )

    sql = res['sql']
    assert 'SUM("Sales")' in sql
    assert '"CustomerID"' in sql
    assert 'GROUP BY "CustomerID"' in sql
    assert 'LIMIT 10' in sql



