import pytest
import pandas as pd
from backend.services.dataset_brain import DatasetBrain
from backend.services.query_planner import QueryPlanner
from backend.services.query_validator import QueryValidator
from backend.nl2sql_engine.sql_generator import SQLGenerator
from backend.nl2sql_engine.sql_validator import SQLValidator
from backend.services.chart_recommender import recommend_chart

# ── DOMAIN DATASETS MOCKS ──────────────────────────────────────────────────────

@pytest.fixture
def retail_df():
    return pd.DataFrame([
        {"OrderID": 101, "CustomerName": "Acme Inc", "Sales": 5000.0, "Profit": 1200.0, "Quantity": 15, "Discount": 0.05, "Region": "East", "Category": "Technology", "OrderDate": "2026-01-10"},
        {"OrderID": 102, "CustomerName": "Global Corp", "Sales": 3200.0, "Profit": 800.0, "Quantity": 8, "Discount": 0.10, "Region": "West", "Category": "Furniture", "OrderDate": "2026-01-12"},
        {"OrderID": 103, "CustomerName": "Apex Systems", "Sales": 1800.0, "Profit": 400.0, "Quantity": 5, "Discount": 0.00, "Region": "Central", "Category": "Office Supplies", "OrderDate": "2026-01-15"},
    ])

@pytest.fixture
def hr_df():
    return pd.DataFrame([
        {"EmployeeID": 1, "EmployeeName": "Alice Vance", "Salary": 95000.0, "Bonus": 12000.0, "Age": 34, "Department": "Engineering", "PerformanceScore": 4.8},
        {"EmployeeID": 2, "EmployeeName": "Bob Smith", "Salary": 78000.0, "Bonus": 8000.0, "Age": 29, "Department": "Marketing", "PerformanceScore": 4.2},
        {"EmployeeID": 3, "EmployeeName": "Charlie Brown", "Salary": 110000.0, "Bonus": 15000.0, "Age": 41, "Department": "Engineering", "PerformanceScore": 4.9},
    ])

@pytest.fixture
def healthcare_df():
    return pd.DataFrame([
        {"PatientID": 1001, "BillingAmount": 14500.0, "LengthOfStay": 5, "Hospital": "City General", "Diagnosis": "Cardiology"},
        {"PatientID": 1002, "BillingAmount": 8900.0, "LengthOfStay": 3, "Hospital": "St Jude", "Diagnosis": "Orthopedics"},
    ])

@pytest.fixture
def finance_df():
    return pd.DataFrame([
        {"TransactionID": 901, "AccountBalance": 45000.0, "TransactionAmount": 1200.0, "CreditScore": 750, "Branch": "Downtown", "TransactionDate": "2026-02-01"},
        {"TransactionID": 902, "AccountBalance": 12000.0, "TransactionAmount": 350.0, "CreditScore": 680, "Branch": "Uptown", "TransactionDate": "2026-02-02"},
    ])

# ── BENCHMARK TEST SUITE ───────────────────────────────────────────────────────

def test_retail_domain_accuracy(retail_df):
    brain = DatasetBrain.build_brain_profile(retail_df, "Retail Sales")
    assert brain['domain'] == "Retail & Enterprise Sales"
    assert brain['semantic_roles']['Sales'] == 'Revenue Metric'
    assert brain['semantic_roles']['Profit'] == 'Profit Metric'
    assert brain['semantic_roles']['Region'] == 'Geography'

    # Test Query Planning
    plan = QueryPlanner.plan_query("Top 10 customers by sales", brain)
    assert plan['intent'] == 'ranking'
    assert plan['metric'] == 'Sales'
    assert plan['dimension'] == 'CustomerName'

    # Test SQL Generation & Validation
    from backend.nl2sql_engine.ir import QueryIR
    ir = QueryIR(intent=plan['intent'], metrics=[plan['metric']], dimensions=[plan['dimension']], limit=plan['limit'])
    sql = SQLGenerator.generate_sql(ir, table_name="df")
    is_valid, repaired_sql, err = SQLValidator.validate_and_repair(sql, df_data=retail_df)
    assert is_valid is True

def test_hr_domain_accuracy(hr_df):
    brain = DatasetBrain.build_brain_profile(hr_df, "HR Dataset")
    assert brain['semantic_roles']['Salary'] == 'Revenue Metric' or 'Numeric Measure'
    assert brain['semantic_roles']['Department'] == 'Categorical Dimension'

    plan = QueryPlanner.plan_query("Average salary by department", brain)
    assert plan['aggregation'] == 'AVG'
    assert plan['metric'] == 'Salary'
    assert plan['dimension'] == 'Department'

def test_query_validator_capability_fallback(hr_df):
    # HR dataset has no date column -> Querying monthly trend should fail gracefully & return alternatives
    brain = DatasetBrain.build_brain_profile(hr_df, "HR Dataset")
    plan = QueryPlanner.plan_query("Monthly salary trend", brain)
    
    is_valid, conf, err_msg, alternatives = QueryValidator.validate_execution_plan(plan, brain)
    assert is_valid is False
    assert conf == 0.52
    assert "No temporal date/time column detected" in err_msg
    assert len(alternatives) > 0
    assert any("Salary by" in alt for alt in alternatives)

def test_healthcare_domain_accuracy(healthcare_df):
    brain = DatasetBrain.build_brain_profile(healthcare_df, "Healthcare Dataset")
    plan = QueryPlanner.plan_query("Total billing amount by hospital", brain)
    assert plan['metric'] == 'BillingAmount'
    assert plan['dimension'] == 'Hospital'

def test_finance_domain_accuracy(finance_df):
    brain = DatasetBrain.build_brain_profile(finance_df, "Finance Dataset")
    plan = QueryPlanner.plan_query("Average transaction amount by branch", brain)
    assert plan['aggregation'] == 'AVG'
    assert plan['metric'] == 'TransactionAmount'
    assert plan['dimension'] == 'Branch'
