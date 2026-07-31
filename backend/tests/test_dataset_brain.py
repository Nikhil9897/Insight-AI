import pytest
import pandas as pd

from backend.services.dataset_profiler import DatasetProfiler
from backend.services.dataset_brain import DatasetBrain
from backend.services.query_planner import QueryPlanner
from backend.services.capability_discovery import CapabilityDiscovery
from backend.services.suggestion_engine import SuggestionEngine
from backend.services.grammar_autocomplete import GrammarAutocomplete

@pytest.fixture
def sample_sales_df():
    return pd.DataFrame([
        {"OrderID": 1, "CustomerName": "Acme Corp", "Sales": 1500.0, "Profit": 300.0, "Quantity": 10, "Discount": 0.05, "ShipCity": "New York", "Region": "East", "OrderDate": "2026-01-15", "Category": "Technology"},
        {"OrderID": 2, "CustomerName": "Global Logistics", "Sales": 2400.0, "Profit": 500.0, "Quantity": 20, "Discount": 0.10, "ShipCity": "San Francisco", "Region": "West", "OrderDate": "2026-01-16", "Category": "Furniture"},
        {"OrderID": 3, "CustomerName": "Apex Tech", "Sales": 800.0, "Profit": 120.0, "Quantity": 5, "Discount": 0.00, "ShipCity": "Chicago", "Region": "Central", "OrderDate": "2026-01-17", "Category": "Technology"},
    ])

def test_dataset_profiler(sample_sales_df):
    profile = DatasetProfiler.profile_dataframe(sample_sales_df, "Sales Test")
    assert profile['row_count'] == 3
    assert profile['col_count'] == 10
    assert 'Sales' in profile['column_stats']

def test_dataset_brain_semantic_roles(sample_sales_df):
    brain = DatasetBrain.build_brain_profile(sample_sales_df, "Sales Test")
    roles = brain['semantic_roles']
    
    assert roles['Sales'] == 'Revenue Metric'
    assert roles['Profit'] == 'Profit Metric'
    assert roles['Quantity'] == 'Volume Metric'
    assert roles['Discount'] == 'Percentage Metric'
    assert roles['Region'] == 'Geography'
    assert roles['CustomerName'] == 'Customer Dimension'
    assert roles['Category'] == 'Product Hierarchy'
    assert roles['OrderDate'] == 'Time Dimension'
    assert roles['OrderID'] == 'Identifier'
    
    assert brain['domain'] == "Retail & Enterprise Sales"
    assert brain['domain_confidence'] >= 90

def test_query_planner(sample_sales_df):
    brain = DatasetBrain.build_brain_profile(sample_sales_df, "Sales Test")
    plan = QueryPlanner.plan_query("Top 10 customers by sales", brain)
    
    assert plan['intent'] == 'ranking'
    assert plan['metric'] == 'Sales'
    assert plan['aggregation'] == 'SUM'
    assert plan['dimension'] == 'CustomerName'
    assert plan['sort'] == 'DESC'
    assert plan['limit'] == 10

def test_capability_discovery(sample_sales_df):
    brain = DatasetBrain.build_brain_profile(sample_sales_df, "Sales Test")
    caps = CapabilityDiscovery.discover_capabilities(brain)
    titles = [c['title'] for c in caps]
    
    assert 'Revenue Analysis' in titles
    assert 'Profitability Analysis' in titles
    assert 'Regional Geography' in titles
    assert 'Customer Segmentation' in titles
    assert 'Product Hierarchy' in titles
    assert 'Time-Series Trend Analysis' in titles

def test_suggestion_engine(sample_sales_df):
    brain = DatasetBrain.build_brain_profile(sample_sales_df, "Sales Test")
    suggestions = SuggestionEngine.generate_ranked_suggestions(brain)
    
    assert len(suggestions) > 0
    prompts = [s['prompt'] for s in suggestions]
    assert any("Sales by Region" in p for p in prompts)
    assert any("Top 10" in p for p in prompts)
    assert suggestions[0]['stars'] == 5

def test_grammar_autocomplete(sample_sales_df):
    brain = DatasetBrain.build_brain_profile(sample_sales_df, "Sales Test")
    
    c1 = GrammarAutocomplete.get_completions("show", brain)
    assert "show total" in c1
    
    c2 = GrammarAutocomplete.get_completions("show total", brain)
    assert any("Sales" in item for item in c2)
    
    c3 = GrammarAutocomplete.get_completions("Sales by", brain)
    assert any("Region" in item or "Category" in item for item in c3)
