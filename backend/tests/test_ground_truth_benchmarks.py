import pytest
import pandas as pd
from backend.nl2sql_engine import NL2SQLEngine
from backend.services.duckdb_service import execute_sql_on_data

# ── GROUND TRUTH DATASETS MOCKS ────────────────────────────────────────────────

@pytest.fixture
def retail_ground_truth_df():
    return [
        {"OrderID": 101, "CustomerName": "Acme Inc", "Sales": 5000.0, "Profit": 1200.0, "Quantity": 15, "Discount": 0.05, "Region": "East", "Category": "Technology", "OrderDate": "2026-01-10"},
        {"OrderID": 102, "CustomerName": "Global Corp", "Sales": 3200.0, "Profit": 800.0, "Quantity": 8, "Discount": 0.10, "Region": "West", "Category": "Furniture", "OrderDate": "2026-01-12"},
        {"OrderID": 103, "CustomerName": "Apex Systems", "Sales": 1800.0, "Profit": 400.0, "Quantity": 5, "Discount": 0.00, "Region": "Central", "Category": "Office Supplies", "OrderDate": "2026-01-15"},
    ]

@pytest.fixture
def hr_ground_truth_df():
    return [
        {"EmployeeID": 1, "EmployeeName": "Alice Vance", "Salary": 95000.0, "Bonus": 12000.0, "Age": 34, "Department": "Engineering"},
        {"EmployeeID": 2, "EmployeeName": "Bob Smith", "Salary": 78000.0, "Bonus": 8000.0, "Age": 29, "Department": "Marketing"},
        {"EmployeeID": 3, "EmployeeName": "Charlie Brown", "Salary": 110000.0, "Bonus": 15000.0, "Age": 41, "Department": "Engineering"},
    ]

@pytest.fixture
def healthcare_ground_truth_df():
    return [
        {"PatientID": 1001, "BillingAmount": 14500.0, "LengthOfStay": 5, "Hospital": "City General", "Diagnosis": "Cardiology"},
        {"PatientID": 1002, "BillingAmount": 8900.0, "LengthOfStay": 3, "Hospital": "St Jude", "Diagnosis": "Orthopedics"},
        {"PatientID": 1003, "BillingAmount": 6100.0, "LengthOfStay": 2, "Hospital": "City General", "Diagnosis": "Cardiology"},
    ]

@pytest.fixture
def finance_ground_truth_df():
    return [
        {"TransactionID": 901, "AccountBalance": 45000.0, "TransactionAmount": 1200.0, "CreditScore": 750, "Branch": "Downtown"},
        {"TransactionID": 902, "AccountBalance": 12000.0, "TransactionAmount": 350.0, "CreditScore": 680, "Branch": "Uptown"},
        {"TransactionID": 903, "AccountBalance": 28000.0, "TransactionAmount": 950.0, "CreditScore": 710, "Branch": "Downtown"},
    ]

# ── 1. RETAIL GROUND TRUTH BENCHMARKS ──────────────────────────────────────────

def test_ground_truth_total_sales(retail_ground_truth_df):
    """
    Query: 'Total sales'
    Ground Truth Expected: SUM(Sales) == 10000.0
    """
    cols = list(retail_ground_truth_df[0].keys())
    col_types = {c: 'float' if c in ('Sales', 'Profit', 'Discount') else 'varchar' for c in cols}

    res = NL2SQLEngine.process("Total sales", cols, col_types, df_data=retail_ground_truth_df)
    assert res['is_valid'] is True

    rows, res_cols = execute_sql_on_data(res['sql'], retail_ground_truth_df)
    assert len(rows) == 1
    val = list(rows[0].values())[0]
    assert abs(val - 10000.0) < 0.01

def test_ground_truth_sales_by_region(retail_ground_truth_df):
    """
    Query: 'Sales by region'
    Ground Truth Expected: East = 5000.0, West = 3200.0, Central = 1800.0
    """
    cols = list(retail_ground_truth_df[0].keys())
    col_types = {c: 'float' if c in ('Sales', 'Profit') else 'varchar' for c in cols}

    res = NL2SQLEngine.process("Sales by region", cols, col_types, df_data=retail_ground_truth_df)
    assert res['is_valid'] is True

    rows, res_cols = execute_sql_on_data(res['sql'], retail_ground_truth_df)
    assert len(rows) == 3
    row_map = {r['Region']: r[res_cols[1]] for r in rows if 'Region' in r}
    assert row_map.get('East') == 5000.0
    assert row_map.get('West') == 3200.0
    assert row_map.get('Central') == 1800.0

def test_ground_truth_top_customer_ranking(retail_ground_truth_df):
    """
    Query: 'Top customer by sales'
    Ground Truth Expected: Acme Inc with 5000.0 sales
    """
    cols = list(retail_ground_truth_df[0].keys())
    col_types = {c: 'float' if c in ('Sales', 'Profit') else 'varchar' for c in cols}

    res = NL2SQLEngine.process("Top customer by sales", cols, col_types, df_data=retail_ground_truth_df)
    assert res['is_valid'] is True

    rows, res_cols = execute_sql_on_data(res['sql'], retail_ground_truth_df)
    assert rows[0].get('CustomerName') == 'Acme Inc'
    assert list(rows[0].values())[1] == 5000.0

# ── 2. HR GROUND TRUTH BENCHMARKS ──────────────────────────────────────────────

def test_ground_truth_total_salary(hr_ground_truth_df):
    """
    Query: 'Total salary'
    Ground Truth Expected: SUM(Salary) == 283000.0
    """
    cols = list(hr_ground_truth_df[0].keys())
    col_types = {c: 'float' if c in ('Salary', 'Bonus') else 'varchar' for c in cols}

    res = NL2SQLEngine.process("Total salary", cols, col_types, df_data=hr_ground_truth_df)
    assert res['is_valid'] is True

    rows, res_cols = execute_sql_on_data(res['sql'], hr_ground_truth_df)
    assert len(rows) == 1
    val = list(rows[0].values())[0]
    assert val == 283000.0

def test_ground_truth_avg_salary_by_department(hr_ground_truth_df):
    """
    Query: 'Average salary by department'
    Ground Truth Expected: Engineering = 102500.0, Marketing = 78000.0
    """
    cols = list(hr_ground_truth_df[0].keys())
    col_types = {c: 'float' if c in ('Salary', 'Bonus') else 'varchar' for c in cols}

    res = NL2SQLEngine.process("Average salary by department", cols, col_types, df_data=hr_ground_truth_df)
    assert res['is_valid'] is True

    rows, res_cols = execute_sql_on_data(res['sql'], hr_ground_truth_df)
    assert len(rows) == 2
    row_map = {r['Department']: r[res_cols[1]] for r in rows if 'Department' in r}
    assert row_map.get('Engineering') == 102500.0
    assert row_map.get('Marketing') == 78000.0

# ── 3. HEALTHCARE GROUND TRUTH BENCHMARKS ──────────────────────────────────────

def test_ground_truth_billing_by_hospital(healthcare_ground_truth_df):
    """
    Query: 'Total billing amount by hospital'
    Ground Truth Expected: City General = 20600.0, St Jude = 8900.0
    """
    cols = list(healthcare_ground_truth_df[0].keys())
    col_types = {c: 'float' if c == 'BillingAmount' else 'varchar' for c in cols}

    res = NL2SQLEngine.process("Total billing amount by hospital", cols, col_types, df_data=healthcare_ground_truth_df)
    assert res['is_valid'] is True

    rows, res_cols = execute_sql_on_data(res['sql'], healthcare_ground_truth_df)
    assert len(rows) == 2
    row_map = {r['Hospital']: r[res_cols[1]] for r in rows if 'Hospital' in r}
    assert row_map.get('City General') == 20600.0
    assert row_map.get('St Jude') == 8900.0

# ── 4. FINANCE GROUND TRUTH BENCHMARKS ─────────────────────────────────────────

def test_ground_truth_transaction_amount_by_branch(finance_ground_truth_df):
    """
    Query: 'Total transaction amount by branch'
    Ground Truth Expected: Downtown = 2150.0, Uptown = 350.0
    """
    cols = list(finance_ground_truth_df[0].keys())
    col_types = {c: 'float' if c in ('AccountBalance', 'TransactionAmount') else 'varchar' for c in cols}

    res = NL2SQLEngine.process("Total transaction amount by branch", cols, col_types, df_data=finance_ground_truth_df)
    assert res['is_valid'] is True

    rows, res_cols = execute_sql_on_data(res['sql'], finance_ground_truth_df)
    assert len(rows) == 2
    row_map = {r['Branch']: r[res_cols[1]] for r in rows if 'Branch' in r}
    assert row_map.get('Downtown') == 2150.0
    assert row_map.get('Uptown') == 350.0
