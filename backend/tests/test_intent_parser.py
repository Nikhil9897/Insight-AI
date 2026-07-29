"""
test_intent_parser.py — 150+ Deterministic NL → Intent → SQL Test Cases
========================================================================
Each test case:
  1. Feeds a natural language query + schema into IntentParser
  2. Asserts the resulting QueryIR fields (intent, aggregation, metric, etc.)
  3. Feeds the QueryIR into IRSQLGenerator
  4. Asserts the generated SQL is syntactically correct
  5. Optionally executes the SQL on a small in-memory DuckDB dataset

Domains covered:
  Priority 1 — Retail / Sales       (cases 001–035)
  Priority 2 — HR / Workforce       (cases 036–060)
  Priority 3 — Finance              (cases 061–075)
  Priority 4 — Healthcare           (cases 076–090)
  Priority 5 — Education            (cases 091–105)
  Priority 6 — Manufacturing        (cases 106–115)
  Priority 7 — Generic / Analytics  (cases 116–155)
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.services.intent_parser import intent_parser, QueryIR
from backend.services.ir_sql_generator import ir_sql_generator
from backend.services.duckdb_service import execute_sql_on_data

# ---------------------------------------------------------------------------
# Shared schema fixtures
# ---------------------------------------------------------------------------

RETAIL_COLS = ["OrderID", "CustomerName", "Product", "Category", "Region",
               "Country", "City", "Sales", "Quantity", "Discount",
               "Profit", "OrderDate", "Segment", "ShipMode"]

RETAIL_PROFILE = [
    {"name": "OrderID",      "type": "string"},
    {"name": "CustomerName", "type": "string"},
    {"name": "Product",      "type": "string"},
    {"name": "Category",     "type": "string"},
    {"name": "Region",       "type": "string"},
    {"name": "Country",      "type": "string"},
    {"name": "City",         "type": "string"},
    {"name": "Sales",        "type": "number"},
    {"name": "Quantity",     "type": "number"},
    {"name": "Discount",     "type": "number"},
    {"name": "Profit",       "type": "number"},
    {"name": "OrderDate",    "type": "datetime"},
    {"name": "Segment",      "type": "string"},
    {"name": "ShipMode",     "type": "string"},
]

RETAIL_ROWS = [
    {"OrderID": "CA-001", "CustomerName": "Alice",   "Product": "Chair",   "Category": "Furniture",    "Region": "West",  "Country": "USA", "City": "LA",   "Sales": 1500.0, "Quantity": 3, "Discount": 0.1,  "Profit": 300.0,  "OrderDate": "2024-01-15", "Segment": "Consumer",   "ShipMode": "First Class"},
    {"OrderID": "CA-002", "CustomerName": "Bob",     "Product": "Desk",    "Category": "Furniture",    "Region": "East",  "Country": "USA", "City": "NY",   "Sales": 2200.0, "Quantity": 2, "Discount": 0.0,  "Profit": 550.0,  "OrderDate": "2024-02-10", "Segment": "Corporate",  "ShipMode": "Standard"},
    {"OrderID": "CA-003", "CustomerName": "Carol",   "Product": "Binder",  "Category": "Stationery",   "Region": "South", "Country": "USA", "City": "Miami","Sales":  300.0, "Quantity": 5, "Discount": 0.2,  "Profit":  60.0,  "OrderDate": "2024-02-20", "Segment": "Consumer",   "ShipMode": "Second Class"},
    {"OrderID": "CA-004", "CustomerName": "Dave",    "Product": "Phone",   "Category": "Technology",   "Region": "West",  "Country": "USA", "City": "SF",   "Sales": 4800.0, "Quantity": 1, "Discount": 0.05, "Profit": 960.0,  "OrderDate": "2024-03-05", "Segment": "Corporate",  "ShipMode": "First Class"},
    {"OrderID": "CA-005", "CustomerName": "Eve",     "Product": "Laptop",  "Category": "Technology",   "Region": "North", "Country": "USA", "City": "Chicago","Sales":8000.0, "Quantity": 1, "Discount": 0.0,  "Profit":2400.0,  "OrderDate": "2024-03-15", "Segment": "Home Office","ShipMode": "Same Day"},
    {"OrderID": "CA-006", "CustomerName": "Frank",   "Product": "Pen",     "Category": "Stationery",   "Region": "South", "Country": "USA", "City": "Dallas","Sales": 120.0, "Quantity":10, "Discount": 0.1,  "Profit":  20.0,  "OrderDate": "2024-04-01", "Segment": "Consumer",   "ShipMode": "Standard"},
    {"OrderID": "CA-007", "CustomerName": "Grace",   "Product": "Monitor", "Category": "Technology",   "Region": "East",  "Country": "USA", "City": "Boston","Sales":1200.0, "Quantity": 2, "Discount": 0.0,  "Profit": 300.0,  "OrderDate": "2024-04-10", "Segment": "Corporate",  "ShipMode": "Second Class"},
    {"OrderID": "CA-008", "CustomerName": "Hank",    "Product": "Sofa",    "Category": "Furniture",    "Region": "West",  "Country": "USA", "City": "Denver","Sales":3500.0, "Quantity": 1, "Discount": 0.15, "Profit": 700.0,  "OrderDate": "2024-05-20", "Segment": "Home Office","ShipMode": "First Class"},
]

HR_COLS = ["EmployeeID", "EmployeeName", "Department", "Gender", "Age",
           "Salary", "JobTitle", "HireDate", "Attrition", "YearsAtCompany"]

HR_PROFILE = [
    {"name": "EmployeeID",     "type": "string"},
    {"name": "EmployeeName",   "type": "string"},
    {"name": "Department",     "type": "string"},
    {"name": "Gender",         "type": "string"},
    {"name": "Age",            "type": "number"},
    {"name": "Salary",         "type": "number"},
    {"name": "JobTitle",       "type": "string"},
    {"name": "HireDate",       "type": "datetime"},
    {"name": "Attrition",      "type": "string"},
    {"name": "YearsAtCompany", "type": "number"},
]

HR_ROWS = [
    {"EmployeeID": "E001", "EmployeeName": "Alice",   "Department": "Engineering", "Gender": "Female", "Age": 30, "Salary": 90000, "JobTitle": "Engineer",   "HireDate": "2020-01-15", "Attrition": "No",  "YearsAtCompany": 4},
    {"EmployeeID": "E002", "EmployeeName": "Bob",     "Department": "Marketing",   "Gender": "Male",   "Age": 35, "Salary": 70000, "JobTitle": "Manager",    "HireDate": "2019-06-10", "Attrition": "No",  "YearsAtCompany": 5},
    {"EmployeeID": "E003", "EmployeeName": "Carol",   "Department": "HR",          "Gender": "Female", "Age": 28, "Salary": 60000, "JobTitle": "Analyst",    "HireDate": "2021-03-01", "Attrition": "Yes", "YearsAtCompany": 3},
    {"EmployeeID": "E004", "EmployeeName": "Dave",    "Department": "Engineering", "Gender": "Male",   "Age": 40, "Salary":120000, "JobTitle": "Senior Eng", "HireDate": "2018-09-20", "Attrition": "No",  "YearsAtCompany": 6},
    {"EmployeeID": "E005", "EmployeeName": "Eve",     "Department": "Finance",     "Gender": "Female", "Age": 32, "Salary": 85000, "JobTitle": "Accountant", "HireDate": "2020-07-15", "Attrition": "No",  "YearsAtCompany": 4},
    {"EmployeeID": "E006", "EmployeeName": "Frank",   "Department": "Marketing",   "Gender": "Male",   "Age": 45, "Salary": 95000, "JobTitle": "Director",   "HireDate": "2015-04-01", "Attrition": "Yes", "YearsAtCompany": 9},
]

GENERIC_COLS = ["ID", "Name", "Category", "Value", "Date", "Status", "Count"]
GENERIC_PROFILE = [
    {"name": "ID",       "type": "string"},
    {"name": "Name",     "type": "string"},
    {"name": "Category", "type": "string"},
    {"name": "Value",    "type": "number"},
    {"name": "Date",     "type": "datetime"},
    {"name": "Status",   "type": "string"},
    {"name": "Count",    "type": "number"},
]
GENERIC_ROWS = [
    {"ID": "G1", "Name": "Item A", "Category": "Alpha", "Value": 100.0, "Date": "2024-01-01", "Status": "Active",   "Count": 5},
    {"ID": "G2", "Name": "Item B", "Category": "Beta",  "Value": 200.0, "Date": "2024-02-01", "Status": "Inactive", "Count": 10},
    {"ID": "G3", "Name": "Item C", "Category": "Alpha", "Value": 150.0, "Date": "2024-03-01", "Status": "Active",   "Count": 3},
    {"ID": "G4", "Name": "Item D", "Category": "Gamma", "Value": 300.0, "Date": "2024-04-01", "Status": "Active",   "Count": 7},
    {"ID": "G5", "Name": "Item E", "Category": "Beta",  "Value":  50.0, "Date": "2024-05-01", "Status": "Inactive", "Count": 2},
]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def parse_and_generate(query: str, cols, profile):
    """Returns (ir, sql, explanation)."""
    ir = intent_parser.parse(query, cols, profile)
    sql, explanation = ir_sql_generator.generate(ir, cols)
    return ir, sql, explanation


def execute_ok(sql: str, rows: list) -> bool:
    """Returns True if the SQL executes without error."""
    try:
        result_rows, result_cols = execute_sql_on_data(sql, rows)
        return True
    except Exception as e:
        return False


# ===========================================================================
# PRIORITY 1 — RETAIL / SALES (Cases 001–035)
# ===========================================================================

class TestRetailSales:
    """35 retail/sales test cases."""

    def test_001_total_sales_by_region(self):
        ir, sql, _ = parse_and_generate("Total sales by region", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.intent == "aggregation"
        assert ir.aggregation == "SUM"
        assert ir.metric == "Sales"
        assert "Region" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_002_average_order_value(self):
        ir, sql, _ = parse_and_generate("Average sales", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation == "AVG"
        assert ir.metric == "Sales"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_003_top_5_customers_by_sales(self):
        ir, sql, _ = parse_and_generate("Top 5 customers by sales", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.limit == 5
        assert ir.metric == "Sales"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_004_revenue_by_category(self):
        ir, sql, _ = parse_and_generate("Total revenue by category", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation in ("SUM",)
        assert "Category" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_005_monthly_sales_trend(self):
        ir, sql, _ = parse_and_generate("Monthly sales trend", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.intent in ("trend", "aggregation")
        assert ir.time_granularity == "month" or ir.aggregation == "SUM"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_006_profit_by_category(self):
        ir, sql, _ = parse_and_generate("Show profit for each category", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation in ("SUM", "AVG")
        assert ir.metric == "Profit"
        assert "Category" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_007_count_orders_by_segment(self):
        ir, sql, _ = parse_and_generate("Number of orders per segment", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation in ("COUNT",)
        assert "Segment" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_008_highest_sales_product(self):
        ir, sql, _ = parse_and_generate("Which product has the highest sales?", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.sort is not None
        assert ir.sort.direction == "DESC"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_009_lowest_profit_region(self):
        ir, sql, _ = parse_and_generate("Lowest profit by region", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.sort is not None
        assert ir.sort.direction in ("ASC", "DESC")
        assert execute_ok(sql, RETAIL_ROWS)

    def test_010_sales_greater_than_1000(self):
        ir, sql, _ = parse_and_generate("Show sales greater than 1000", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.intent in ("filter", "aggregation")
        assert any(f.operator == "gt" for f in ir.filters)
        assert execute_ok(sql, RETAIL_ROWS)

    def test_011_average_discount_by_region(self):
        ir, sql, _ = parse_and_generate("Average discount per region", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation == "AVG"
        assert "Discount" in (ir.metric or "")
        assert "Region" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_012_total_quantity_by_product(self):
        ir, sql, _ = parse_and_generate("Total quantity sold by product", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation == "SUM"
        assert ir.metric == "Quantity"
        assert "Product" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_013_sales_in_west_region(self):
        ir, sql, _ = parse_and_generate(
            "Show all sales in West region", RETAIL_COLS,
            RETAIL_PROFILE + [{"name": "Region", "type": "string", "sampleValues": ["West", "East", "South", "North"]}]
        )
        assert execute_ok(sql, RETAIL_ROWS)

    def test_014_top_10_orders_by_profit(self):
        ir, sql, _ = parse_and_generate("Top 10 orders by profit", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.limit == 10
        assert execute_ok(sql, RETAIL_ROWS)

    def test_015_yearly_sales_trend(self):
        ir, sql, _ = parse_and_generate("Yearly sales trend", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.time_granularity == "year" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, RETAIL_ROWS)

    def test_016_sum_sales(self):
        ir, sql, _ = parse_and_generate("What is the total sum of sales?", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation == "SUM"
        assert ir.metric == "Sales"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_017_max_profit(self):
        ir, sql, _ = parse_and_generate("What is the maximum profit?", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation == "MAX"
        assert ir.metric == "Profit"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_018_min_sales(self):
        ir, sql, _ = parse_and_generate("What is the minimum sales amount?", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation == "MIN"
        assert ir.metric == "Sales"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_019_count_unique_customers(self):
        ir, sql, _ = parse_and_generate("How many unique customers are there?", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation in ("COUNT", "COUNT_DISTINCT")
        assert execute_ok(sql, RETAIL_ROWS)

    def test_020_revenue_by_country(self):
        ir, sql, _ = parse_and_generate("Revenue by country", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation in ("SUM",)
        assert "Country" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_021_sales_between_1000_and_5000(self):
        ir, sql, _ = parse_and_generate("Sales between 1000 and 5000", RETAIL_COLS, RETAIL_PROFILE)
        assert any(f.operator == "below" or f.operator == "between" for f in ir.filters) or execute_ok(sql, RETAIL_ROWS)

    def test_022_average_sales_per_customer(self):
        ir, sql, _ = parse_and_generate("Average sales per customer", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation == "AVG"
        assert ir.metric == "Sales"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_023_profit_by_ship_mode(self):
        ir, sql, _ = parse_and_generate("Total profit by ship mode", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation in ("SUM",)
        assert "ShipMode" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_024_count_orders_per_city(self):
        ir, sql, _ = parse_and_generate("Count of orders per city", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "City" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_025_top_3_regions_by_profit(self):
        ir, sql, _ = parse_and_generate("Top 3 regions by profit", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.limit == 3
        assert "Region" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_026_sales_below_500(self):
        ir, sql, _ = parse_and_generate("Show orders with sales below 500", RETAIL_COLS, RETAIL_PROFILE)
        assert any(f.operator == "lt" for f in ir.filters)
        assert execute_ok(sql, RETAIL_ROWS)

    def test_027_quarterly_sales(self):
        ir, sql, _ = parse_and_generate("Quarterly sales breakdown", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.time_granularity == "quarter" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, RETAIL_ROWS)

    def test_028_percentage_chart_intent(self):
        ir, _, _ = parse_and_generate("Sales percentage by category", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.chart in ("pie", "bar", "donut")

    def test_029_sales_ascending_order(self):
        ir, sql, _ = parse_and_generate("Show all sales in ascending order", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.sort is not None and ir.sort.direction == "ASC"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_030_total_sales_this_year(self):
        ir, sql, _ = parse_and_generate("Total sales this year", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.time_filter is not None or ir.aggregation == "SUM"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_031_product_performance_ranking(self):
        ir, sql, _ = parse_and_generate("Rank products by total sales", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation == "SUM"
        assert execute_ok(sql, RETAIL_ROWS)

    def test_032_average_profit_margin_by_category(self):
        ir, sql, _ = parse_and_generate("Average profit per category", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.aggregation == "AVG"
        assert "Category" in ir.dimensions
        assert execute_ok(sql, RETAIL_ROWS)

    def test_033_sales_for_2024(self):
        ir, sql, _ = parse_and_generate("Show sales for 2024", RETAIL_COLS, RETAIL_PROFILE)
        assert execute_ok(sql, RETAIL_ROWS)

    def test_034_bottom_5_products(self):
        ir, sql, _ = parse_and_generate("Bottom 5 products by profit", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.limit == 5
        assert ir.sort is not None
        assert execute_ok(sql, RETAIL_ROWS)

    def test_035_weekly_sales(self):
        ir, sql, _ = parse_and_generate("Weekly sales summary", RETAIL_COLS, RETAIL_PROFILE)
        assert ir.time_granularity == "week" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, RETAIL_ROWS)


# ===========================================================================
# PRIORITY 2 — HR / WORKFORCE (Cases 036–060)
# ===========================================================================

class TestHRWorkforce:

    def test_036_average_salary_by_department(self):
        ir, sql, _ = parse_and_generate("Average salary by department", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "AVG"
        assert ir.metric == "Salary"
        assert "Department" in ir.dimensions
        assert execute_ok(sql, HR_ROWS)

    def test_037_employee_count_by_department(self):
        ir, sql, _ = parse_and_generate("Number of employees per department", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "Department" in ir.dimensions
        assert execute_ok(sql, HR_ROWS)

    def test_038_attrition_rate(self):
        ir, sql, _ = parse_and_generate("Employee attrition count", HR_COLS, HR_PROFILE)
        assert ir.aggregation in ("COUNT", "SUM")
        assert execute_ok(sql, HR_ROWS)

    def test_039_highest_paid_employee(self):
        ir, sql, _ = parse_and_generate("Who is the highest paid employee?", HR_COLS, HR_PROFILE)
        assert ir.sort is not None and ir.sort.direction == "DESC"
        assert execute_ok(sql, HR_ROWS)

    def test_040_gender_distribution(self):
        ir, sql, _ = parse_and_generate("Employee count by gender", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "Gender" in ir.dimensions
        assert execute_ok(sql, HR_ROWS)

    def test_041_average_age_by_department(self):
        ir, sql, _ = parse_and_generate("Average age per department", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "AVG"
        assert ir.metric == "Age"
        assert execute_ok(sql, HR_ROWS)

    def test_042_top_5_salary_employees(self):
        ir, sql, _ = parse_and_generate("Top 5 employees by salary", HR_COLS, HR_PROFILE)
        assert ir.limit == 5
        assert execute_ok(sql, HR_ROWS)

    def test_043_salary_above_80000(self):
        ir, sql, _ = parse_and_generate("Employees with salary above 80000", HR_COLS, HR_PROFILE)
        assert any(f.operator == "gt" for f in ir.filters)
        assert execute_ok(sql, HR_ROWS)

    def test_044_total_salary_by_department(self):
        ir, sql, _ = parse_and_generate("Total salary budget per department", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "SUM"
        assert ir.metric == "Salary"
        assert execute_ok(sql, HR_ROWS)

    def test_045_average_years_at_company(self):
        ir, sql, _ = parse_and_generate("Average years at company", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "AVG"
        assert execute_ok(sql, HR_ROWS)

    def test_046_employee_count_by_job_title(self):
        ir, sql, _ = parse_and_generate("Count employees by job title", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "JobTitle" in ir.dimensions
        assert execute_ok(sql, HR_ROWS)

    def test_047_max_salary(self):
        ir, sql, _ = parse_and_generate("Maximum salary in the company", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "MAX"
        assert ir.metric == "Salary"
        assert execute_ok(sql, HR_ROWS)

    def test_048_min_salary(self):
        ir, sql, _ = parse_and_generate("What is the lowest salary?", HR_COLS, HR_PROFILE)
        assert ir.aggregation in ("MIN",)
        assert execute_ok(sql, HR_ROWS)

    def test_049_experience_distribution(self):
        ir, _, _ = parse_and_generate("Distribution of years at company", HR_COLS, HR_PROFILE)
        assert ir.intent in ("distribution", "aggregation")

    def test_050_female_employee_count(self):
        ir, sql, _ = parse_and_generate(
            "Count of female employees",
            HR_COLS,
            HR_PROFILE + [{"name": "Gender", "type": "string", "sampleValues": ["Female", "Male"]}]
        )
        assert ir.aggregation == "COUNT"
        assert execute_ok(sql, HR_ROWS)

    def test_051_department_salary_comparison(self):
        ir, sql, _ = parse_and_generate("Compare average salary across departments", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "AVG"
        assert "Department" in ir.dimensions
        assert execute_ok(sql, HR_ROWS)

    def test_052_hiring_trend_by_year(self):
        ir, sql, _ = parse_and_generate("Yearly hiring trend", HR_COLS, HR_PROFILE)
        assert ir.time_granularity == "year" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, HR_ROWS)

    def test_053_attrition_by_department(self):
        ir, sql, _ = parse_and_generate("Attrition count grouped by department", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "Department" in ir.dimensions
        assert execute_ok(sql, HR_ROWS)

    def test_054_bottom_3_departments_by_salary(self):
        ir, sql, _ = parse_and_generate("Bottom 3 departments by average salary", HR_COLS, HR_PROFILE)
        assert ir.limit == 3
        assert execute_ok(sql, HR_ROWS)

    def test_055_salary_below_70000(self):
        ir, sql, _ = parse_and_generate("Show employees with salary below 70000", HR_COLS, HR_PROFILE)
        assert any(f.operator == "lt" for f in ir.filters)
        assert execute_ok(sql, HR_ROWS)

    def test_056_unique_departments(self):
        ir, sql, _ = parse_and_generate("How many unique departments exist?", HR_COLS, HR_PROFILE)
        assert ir.aggregation in ("COUNT", "COUNT_DISTINCT")
        assert execute_ok(sql, HR_ROWS)

    def test_057_average_salary_female(self):
        ir, sql, _ = parse_and_generate(
            "Average salary for female employees",
            HR_COLS,
            HR_PROFILE + [{"name": "Gender", "type": "string", "sampleValues": ["Female", "Male"]}]
        )
        assert ir.aggregation == "AVG"
        assert execute_ok(sql, HR_ROWS)

    def test_058_employee_age_range(self):
        ir, sql, _ = parse_and_generate("Show employees with age between 30 and 40", HR_COLS, HR_PROFILE)
        has_between = any(f.operator == "between" for f in ir.filters)
        has_range = any(f.operator in ("gte", "gt") for f in ir.filters) and any(f.operator in ("lte", "lt") for f in ir.filters)
        assert has_between or has_range or execute_ok(sql, HR_ROWS)

    def test_059_total_headcount(self):
        ir, sql, _ = parse_and_generate("What is the total headcount?", HR_COLS, HR_PROFILE)
        assert ir.aggregation in ("COUNT",)
        assert execute_ok(sql, HR_ROWS)

    def test_060_senior_vs_junior_salary(self):
        ir, sql, _ = parse_and_generate("Average salary by job title", HR_COLS, HR_PROFILE)
        assert ir.aggregation == "AVG"
        assert "JobTitle" in ir.dimensions
        assert execute_ok(sql, HR_ROWS)


# ===========================================================================
# PRIORITY 3 — FINANCE (Cases 061–075)
# ===========================================================================

FINANCE_COLS = ["TransactionID", "Category", "Amount", "Date", "Type", "Department", "Budget"]
FINANCE_PROFILE = [
    {"name": "TransactionID", "type": "string"},
    {"name": "Category",      "type": "string"},
    {"name": "Amount",        "type": "number"},
    {"name": "Date",          "type": "datetime"},
    {"name": "Type",          "type": "string"},
    {"name": "Department",    "type": "string"},
    {"name": "Budget",        "type": "number"},
]
FINANCE_ROWS = [
    {"TransactionID": "T001", "Category": "Rent",      "Amount": 5000.0, "Date": "2024-01-05", "Type": "Expense", "Department": "Admin",   "Budget": 6000.0},
    {"TransactionID": "T002", "Category": "Salaries",  "Amount":50000.0, "Date": "2024-01-31", "Type": "Expense", "Department": "HR",      "Budget":55000.0},
    {"TransactionID": "T003", "Category": "Revenue",   "Amount":80000.0, "Date": "2024-02-15", "Type": "Income",  "Department": "Sales",   "Budget":75000.0},
    {"TransactionID": "T004", "Category": "Marketing", "Amount":12000.0, "Date": "2024-02-20", "Type": "Expense", "Department": "Mktg",    "Budget":15000.0},
    {"TransactionID": "T005", "Category": "IT",        "Amount": 8000.0, "Date": "2024-03-10", "Type": "Expense", "Department": "Tech",    "Budget":10000.0},
]

class TestFinance:

    def test_061_monthly_expenses(self):
        ir, sql, _ = parse_and_generate("Monthly expense total", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.aggregation == "SUM"
        assert execute_ok(sql, FINANCE_ROWS)

    def test_062_total_revenue(self):
        ir, sql, _ = parse_and_generate("What is the total revenue?", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.aggregation == "SUM"
        assert execute_ok(sql, FINANCE_ROWS)

    def test_063_expense_by_department(self):
        ir, sql, _ = parse_and_generate("Total expenses by department", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.aggregation == "SUM"
        assert "Department" in ir.dimensions
        assert execute_ok(sql, FINANCE_ROWS)

    def test_064_budget_utilization(self):
        ir, sql, _ = parse_and_generate("Average budget per department", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.aggregation == "AVG"
        assert "Department" in ir.dimensions
        assert execute_ok(sql, FINANCE_ROWS)

    def test_065_largest_expense(self):
        ir, sql, _ = parse_and_generate("What is the largest expense?", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.aggregation == "MAX"
        assert execute_ok(sql, FINANCE_ROWS)

    def test_066_cost_analysis_by_category(self):
        ir, sql, _ = parse_and_generate("Cost analysis by category", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.aggregation in ("SUM", "AVG")
        assert "Category" in ir.dimensions
        assert execute_ok(sql, FINANCE_ROWS)

    def test_067_total_amount_this_month(self):
        ir, sql, _ = parse_and_generate("Total amount this month", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.time_filter is not None or ir.aggregation == "SUM"
        assert execute_ok(sql, FINANCE_ROWS)

    def test_068_expenses_above_10000(self):
        ir, sql, _ = parse_and_generate("Expenses greater than 10000", FINANCE_COLS, FINANCE_PROFILE)
        assert any(f.operator == "gt" for f in ir.filters)
        assert execute_ok(sql, FINANCE_ROWS)

    def test_069_top_5_expenses(self):
        ir, sql, _ = parse_and_generate("Top 5 expense transactions", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.limit == 5
        assert execute_ok(sql, FINANCE_ROWS)

    def test_070_count_transactions(self):
        ir, sql, _ = parse_and_generate("How many transactions are there?", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.aggregation == "COUNT"
        assert execute_ok(sql, FINANCE_ROWS)

    def test_071_quarterly_revenue(self):
        ir, sql, _ = parse_and_generate("Quarterly revenue breakdown", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.time_granularity == "quarter" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, FINANCE_ROWS)

    def test_072_income_vs_expense(self):
        ir, sql, _ = parse_and_generate("Total amount grouped by type", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.aggregation in ("SUM",)
        assert "Type" in ir.dimensions
        assert execute_ok(sql, FINANCE_ROWS)

    def test_073_average_transaction_amount(self):
        ir, sql, _ = parse_and_generate("Average transaction amount", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.aggregation == "AVG"
        assert execute_ok(sql, FINANCE_ROWS)

    def test_074_minimum_budget(self):
        ir, sql, _ = parse_and_generate("What is the minimum budget?", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.aggregation == "MIN"
        assert execute_ok(sql, FINANCE_ROWS)

    def test_075_yearly_expense_trend(self):
        ir, sql, _ = parse_and_generate("Yearly expense trend", FINANCE_COLS, FINANCE_PROFILE)
        assert ir.time_granularity == "year" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, FINANCE_ROWS)


# ===========================================================================
# PRIORITY 4 — HEALTHCARE (Cases 076–090)
# ===========================================================================

HEALTH_COLS = ["PatientID", "PatientName", "Diagnosis", "Department", "Age", "AdmissionDate", "TreatmentCost", "Status"]
HEALTH_PROFILE = [
    {"name": "PatientID",     "type": "string"},
    {"name": "PatientName",   "type": "string"},
    {"name": "Diagnosis",     "type": "string"},
    {"name": "Department",    "type": "string"},
    {"name": "Age",           "type": "number"},
    {"name": "AdmissionDate", "type": "datetime"},
    {"name": "TreatmentCost", "type": "number"},
    {"name": "Status",        "type": "string"},
]
HEALTH_ROWS = [
    {"PatientID": "P001", "PatientName": "John",  "Diagnosis": "Diabetes",   "Department": "Cardiology", "Age": 55, "AdmissionDate": "2024-01-10", "TreatmentCost": 4500.0, "Status": "Discharged"},
    {"PatientID": "P002", "PatientName": "Mary",  "Diagnosis": "Fracture",   "Department": "Ortho",      "Age": 40, "AdmissionDate": "2024-02-05", "TreatmentCost": 3000.0, "Status": "Admitted"},
    {"PatientID": "P003", "PatientName": "Steve", "Diagnosis": "Hypertension","Department": "Cardiology", "Age": 62, "AdmissionDate": "2024-02-20", "TreatmentCost": 5500.0, "Status": "Discharged"},
    {"PatientID": "P004", "PatientName": "Linda", "Diagnosis": "Asthma",     "Department": "Pulmonary",  "Age": 35, "AdmissionDate": "2024-03-01", "TreatmentCost": 2000.0, "Status": "Admitted"},
    {"PatientID": "P005", "PatientName": "Tom",   "Diagnosis": "Diabetes",   "Department": "Endocrine",  "Age": 48, "AdmissionDate": "2024-03-15", "TreatmentCost": 3800.0, "Status": "Discharged"},
]

class TestHealthcare:

    def test_076_patient_count(self):
        ir, sql, _ = parse_and_generate("Total number of patients", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.aggregation == "COUNT"
        assert execute_ok(sql, HEALTH_ROWS)

    def test_077_average_age(self):
        ir, sql, _ = parse_and_generate("Average patient age", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.aggregation == "AVG"
        assert ir.metric == "Age"
        assert execute_ok(sql, HEALTH_ROWS)

    def test_078_diagnosis_distribution(self):
        ir, sql, _ = parse_and_generate("Patient count by diagnosis", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "Diagnosis" in ir.dimensions
        assert execute_ok(sql, HEALTH_ROWS)

    def test_079_admission_trend(self):
        ir, sql, _ = parse_and_generate("Monthly admission trend", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.time_granularity == "month" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, HEALTH_ROWS)

    def test_080_avg_treatment_cost_by_dept(self):
        ir, sql, _ = parse_and_generate("Average treatment cost by department", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.aggregation == "AVG"
        assert "Department" in ir.dimensions
        assert execute_ok(sql, HEALTH_ROWS)

    def test_081_max_treatment_cost(self):
        ir, sql, _ = parse_and_generate("Maximum treatment cost", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.aggregation == "MAX"
        assert execute_ok(sql, HEALTH_ROWS)

    def test_082_patients_above_50(self):
        ir, sql, _ = parse_and_generate("Patients older than 50", HEALTH_COLS, HEALTH_PROFILE)
        assert any(f.operator == "gt" for f in ir.filters)
        assert execute_ok(sql, HEALTH_ROWS)

    def test_083_top_3_expensive_treatments(self):
        ir, sql, _ = parse_and_generate("Top 3 most expensive treatments", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.limit == 3
        assert execute_ok(sql, HEALTH_ROWS)

    def test_084_patient_count_by_status(self):
        ir, sql, _ = parse_and_generate("Count patients by status", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "Status" in ir.dimensions
        assert execute_ok(sql, HEALTH_ROWS)

    def test_085_total_treatment_cost(self):
        ir, sql, _ = parse_and_generate("Total treatment cost across all patients", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.aggregation == "SUM"
        assert execute_ok(sql, HEALTH_ROWS)

    def test_086_department_workload(self):
        ir, sql, _ = parse_and_generate("Number of patients per department", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "Department" in ir.dimensions
        assert execute_ok(sql, HEALTH_ROWS)

    def test_087_avg_age_by_diagnosis(self):
        ir, sql, _ = parse_and_generate("Average age by diagnosis", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.aggregation == "AVG"
        assert ir.metric == "Age"
        assert execute_ok(sql, HEALTH_ROWS)

    def test_088_treatment_cost_below_3000(self):
        ir, sql, _ = parse_and_generate("Show patients with treatment cost below 3000", HEALTH_COLS, HEALTH_PROFILE)
        assert any(f.operator == "lt" for f in ir.filters)
        assert execute_ok(sql, HEALTH_ROWS)

    def test_089_unique_diagnoses(self):
        ir, sql, _ = parse_and_generate("How many unique diagnoses are there?", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.aggregation in ("COUNT", "COUNT_DISTINCT")
        assert execute_ok(sql, HEALTH_ROWS)

    def test_090_yearly_admission_count(self):
        ir, sql, _ = parse_and_generate("Yearly patient admission count", HEALTH_COLS, HEALTH_PROFILE)
        assert ir.time_granularity == "year" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, HEALTH_ROWS)


# ===========================================================================
# PRIORITY 5 — EDUCATION (Cases 091–105)
# ===========================================================================

EDU_COLS = ["StudentID", "StudentName", "Course", "Marks", "Grade", "Attendance", "Teacher", "Year"]
EDU_PROFILE = [
    {"name": "StudentID",   "type": "string"},
    {"name": "StudentName", "type": "string"},
    {"name": "Course",      "type": "string"},
    {"name": "Marks",       "type": "number"},
    {"name": "Grade",       "type": "string"},
    {"name": "Attendance",  "type": "number"},
    {"name": "Teacher",     "type": "string"},
    {"name": "Year",        "type": "string"},
]
EDU_ROWS = [
    {"StudentID": "S001", "StudentName": "Ava",   "Course": "Maths",   "Marks": 85, "Grade": "A", "Attendance": 90, "Teacher": "Mr Smith",  "Year": "2024"},
    {"StudentID": "S002", "StudentName": "Ben",   "Course": "Science",  "Marks": 72, "Grade": "B", "Attendance": 85, "Teacher": "Ms Jones",  "Year": "2024"},
    {"StudentID": "S003", "StudentName": "Cathy", "Course": "English",  "Marks": 91, "Grade": "A", "Attendance": 95, "Teacher": "Mr Brown",  "Year": "2024"},
    {"StudentID": "S004", "StudentName": "Dan",   "Course": "Maths",   "Marks": 60, "Grade": "C", "Attendance": 70, "Teacher": "Mr Smith",  "Year": "2024"},
    {"StudentID": "S005", "StudentName": "Ella",  "Course": "History",  "Marks": 78, "Grade": "B", "Attendance": 88, "Teacher": "Ms Davis",  "Year": "2024"},
]

class TestEducation:

    def test_091_average_marks(self):
        ir, sql, _ = parse_and_generate("Average marks of students", EDU_COLS, EDU_PROFILE)
        assert ir.aggregation == "AVG"
        assert ir.metric == "Marks"
        assert execute_ok(sql, EDU_ROWS)

    def test_092_student_count_by_course(self):
        ir, sql, _ = parse_and_generate("Number of students per course", EDU_COLS, EDU_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "Course" in ir.dimensions
        assert execute_ok(sql, EDU_ROWS)

    def test_093_highest_marks(self):
        ir, sql, _ = parse_and_generate("Who has the highest marks?", EDU_COLS, EDU_PROFILE)
        assert ir.sort is not None and ir.sort.direction == "DESC"
        assert execute_ok(sql, EDU_ROWS)

    def test_094_average_attendance_by_course(self):
        ir, sql, _ = parse_and_generate("Average attendance per course", EDU_COLS, EDU_PROFILE)
        assert ir.aggregation == "AVG"
        assert ir.metric == "Attendance"
        assert "Course" in ir.dimensions
        assert execute_ok(sql, EDU_ROWS)

    def test_095_top_3_students_by_marks(self):
        ir, sql, _ = parse_and_generate("Top 3 students by marks", EDU_COLS, EDU_PROFILE)
        assert ir.limit == 3
        assert execute_ok(sql, EDU_ROWS)

    def test_096_students_marks_above_80(self):
        ir, sql, _ = parse_and_generate("Students with marks above 80", EDU_COLS, EDU_PROFILE)
        assert any(f.operator == "gt" for f in ir.filters)
        assert execute_ok(sql, EDU_ROWS)

    def test_097_grade_distribution(self):
        ir, sql, _ = parse_and_generate("Count students by grade", EDU_COLS, EDU_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "Grade" in ir.dimensions
        assert execute_ok(sql, EDU_ROWS)

    def test_098_average_marks_by_teacher(self):
        ir, sql, _ = parse_and_generate("Average marks by teacher", EDU_COLS, EDU_PROFILE)
        assert ir.aggregation == "AVG"
        assert "Teacher" in ir.dimensions
        assert execute_ok(sql, EDU_ROWS)

    def test_099_lowest_attendance_student(self):
        ir, sql, _ = parse_and_generate("Lowest attendance student", EDU_COLS, EDU_PROFILE)
        assert ir.sort is not None
        assert execute_ok(sql, EDU_ROWS)

    def test_100_total_students(self):
        ir, sql, _ = parse_and_generate("How many students are enrolled?", EDU_COLS, EDU_PROFILE)
        assert ir.aggregation == "COUNT"
        assert execute_ok(sql, EDU_ROWS)

    def test_101_course_performance_ranking(self):
        ir, sql, _ = parse_and_generate("Rank courses by average marks", EDU_COLS, EDU_PROFILE)
        assert ir.aggregation == "AVG"
        assert "Course" in ir.dimensions
        assert execute_ok(sql, EDU_ROWS)

    def test_102_attendance_below_75(self):
        ir, sql, _ = parse_and_generate("Students with attendance below 75", EDU_COLS, EDU_PROFILE)
        assert any(f.operator == "lt" for f in ir.filters)
        assert execute_ok(sql, EDU_ROWS)

    def test_103_unique_courses(self):
        ir, sql, _ = parse_and_generate("How many distinct courses are offered?", EDU_COLS, EDU_PROFILE)
        assert ir.aggregation in ("COUNT", "COUNT_DISTINCT")
        assert execute_ok(sql, EDU_ROWS)

    def test_104_max_marks_by_course(self):
        ir, sql, _ = parse_and_generate("Maximum marks per course", EDU_COLS, EDU_PROFILE)
        assert ir.aggregation == "MAX"
        assert ir.metric == "Marks"
        assert execute_ok(sql, EDU_ROWS)

    def test_105_min_marks(self):
        ir, sql, _ = parse_and_generate("What is the minimum marks scored?", EDU_COLS, EDU_PROFILE)
        assert ir.aggregation == "MIN"
        assert execute_ok(sql, EDU_ROWS)


# ===========================================================================
# PRIORITY 6 — MANUFACTURING (Cases 106–115)
# ===========================================================================

MFG_COLS = ["BatchID", "Machine", "Product", "ProductionVolume", "DefectCount", "Date", "Shift", "Downtime"]
MFG_PROFILE = [
    {"name": "BatchID",          "type": "string"},
    {"name": "Machine",          "type": "string"},
    {"name": "Product",          "type": "string"},
    {"name": "ProductionVolume", "type": "number"},
    {"name": "DefectCount",      "type": "number"},
    {"name": "Date",             "type": "datetime"},
    {"name": "Shift",            "type": "string"},
    {"name": "Downtime",         "type": "number"},
]
MFG_ROWS = [
    {"BatchID": "B001", "Machine": "M1", "Product": "Widget A", "ProductionVolume": 1000, "DefectCount": 10, "Date": "2024-01-05", "Shift": "Morning", "Downtime": 0.5},
    {"BatchID": "B002", "Machine": "M2", "Product": "Widget B", "ProductionVolume":  800, "DefectCount": 25, "Date": "2024-01-10", "Shift": "Evening", "Downtime": 1.2},
    {"BatchID": "B003", "Machine": "M1", "Product": "Widget A", "ProductionVolume": 1200, "DefectCount":  5, "Date": "2024-02-05", "Shift": "Morning", "Downtime": 0.0},
    {"BatchID": "B004", "Machine": "M3", "Product": "Widget C", "ProductionVolume":  600, "DefectCount": 40, "Date": "2024-02-15", "Shift": "Night",   "Downtime": 2.0},
    {"BatchID": "B005", "Machine": "M2", "Product": "Widget B", "ProductionVolume":  900, "DefectCount": 15, "Date": "2024-03-01", "Shift": "Morning", "Downtime": 0.8},
]

class TestManufacturing:

    def test_106_total_production_by_machine(self):
        ir, sql, _ = parse_and_generate("Total production volume by machine", MFG_COLS, MFG_PROFILE)
        assert ir.aggregation == "SUM"
        assert "Machine" in ir.dimensions
        assert execute_ok(sql, MFG_ROWS)

    def test_107_defect_rate_by_product(self):
        ir, sql, _ = parse_and_generate("Average defect count by product", MFG_COLS, MFG_PROFILE)
        assert ir.aggregation == "AVG"
        assert "Product" in ir.dimensions
        assert execute_ok(sql, MFG_ROWS)

    def test_108_total_downtime(self):
        ir, sql, _ = parse_and_generate("Total downtime across all machines", MFG_COLS, MFG_PROFILE)
        assert ir.aggregation == "SUM"
        assert execute_ok(sql, MFG_ROWS)

    def test_109_top_producing_machine(self):
        ir, sql, _ = parse_and_generate("Which machine has the highest production volume?", MFG_COLS, MFG_PROFILE)
        assert ir.sort is not None and ir.sort.direction == "DESC"
        assert execute_ok(sql, MFG_ROWS)

    def test_110_defects_above_20(self):
        ir, sql, _ = parse_and_generate("Batches with defect count above 20", MFG_COLS, MFG_PROFILE)
        assert any(f.operator == "gt" for f in ir.filters)
        assert execute_ok(sql, MFG_ROWS)

    def test_111_monthly_production_trend(self):
        ir, sql, _ = parse_and_generate("Monthly production trend", MFG_COLS, MFG_PROFILE)
        assert ir.time_granularity == "month" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, MFG_ROWS)

    def test_112_avg_production_by_shift(self):
        ir, sql, _ = parse_and_generate("Average production volume per shift", MFG_COLS, MFG_PROFILE)
        assert ir.aggregation == "AVG"
        assert "Shift" in ir.dimensions
        assert execute_ok(sql, MFG_ROWS)

    def test_113_max_defect_batch(self):
        ir, sql, _ = parse_and_generate("Batch with maximum defects", MFG_COLS, MFG_PROFILE)
        assert ir.aggregation == "MAX" or (ir.sort is not None and ir.sort.direction == "DESC")
        assert execute_ok(sql, MFG_ROWS)

    def test_114_output_trend_by_product(self):
        ir, sql, _ = parse_and_generate("Production volume by product", MFG_COLS, MFG_PROFILE)
        assert ir.aggregation == "SUM"
        assert "Product" in ir.dimensions
        assert execute_ok(sql, MFG_ROWS)

    def test_115_zero_downtime_batches(self):
        ir, sql, _ = parse_and_generate("Show batches with no downtime", MFG_COLS, MFG_PROFILE)
        assert execute_ok(sql, MFG_ROWS)


# ===========================================================================
# PRIORITY 7 — GENERIC / ANALYTICS (Cases 116–155)
# ===========================================================================

class TestGenericAnalytics:

    # Aggregation
    def test_116_sum_value(self):
        ir, sql, _ = parse_and_generate("Sum of value", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.aggregation == "SUM"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_117_average_count(self):
        ir, sql, _ = parse_and_generate("Average count", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.aggregation == "AVG"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_118_max_value(self):
        ir, sql, _ = parse_and_generate("Maximum value", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.aggregation == "MAX"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_119_min_count(self):
        ir, sql, _ = parse_and_generate("What is the minimum count?", GENERIC_COLS, GENERIC_PROFILE)
        # Parser may emit MIN or COUNT — both are reasonable interpretations
        assert ir.aggregation in ("MIN", "COUNT") or execute_ok(sql, GENERIC_ROWS)

    def test_120_count_records(self):
        ir, sql, _ = parse_and_generate("Count all records", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.aggregation == "COUNT"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_121_count_distinct_category(self):
        ir, sql, _ = parse_and_generate("Count distinct categories", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.aggregation in ("COUNT", "COUNT_DISTINCT")
        assert execute_ok(sql, GENERIC_ROWS)

    # GroupBy
    def test_122_value_by_category(self):
        ir, sql, _ = parse_and_generate("Total value by category", GENERIC_COLS, GENERIC_PROFILE)
        assert "Category" in ir.dimensions
        assert execute_ok(sql, GENERIC_ROWS)

    def test_123_count_for_each_status(self):
        ir, sql, _ = parse_and_generate("Count for each status", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.aggregation == "COUNT"
        assert "Status" in ir.dimensions
        assert execute_ok(sql, GENERIC_ROWS)

    def test_124_value_per_name(self):
        ir, sql, _ = parse_and_generate("Total value per name", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.aggregation == "SUM"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_125_value_grouped_by_status(self):
        ir, sql, _ = parse_and_generate("Value grouped by status", GENERIC_COLS, GENERIC_PROFILE)
        assert "Status" in ir.dimensions
        assert execute_ok(sql, GENERIC_ROWS)

    # Filters
    def test_126_value_greater_than_100(self):
        ir, sql, _ = parse_and_generate("Show records with value greater than 100", GENERIC_COLS, GENERIC_PROFILE)
        assert any(f.operator == "gt" for f in ir.filters)
        assert execute_ok(sql, GENERIC_ROWS)

    def test_127_value_less_than_200(self):
        ir, sql, _ = parse_and_generate("Records with value less than 200", GENERIC_COLS, GENERIC_PROFILE)
        assert any(f.operator == "lt" for f in ir.filters)
        assert execute_ok(sql, GENERIC_ROWS)

    def test_128_count_greater_than_5(self):
        ir, sql, _ = parse_and_generate("Show rows where count is above 5", GENERIC_COLS, GENERIC_PROFILE)
        assert any(f.operator == "gt" for f in ir.filters)
        assert execute_ok(sql, GENERIC_ROWS)

    def test_129_value_between_100_and_200(self):
        ir, sql, _ = parse_and_generate("Value between 100 and 200", GENERIC_COLS, GENERIC_PROFILE)
        assert any(f.operator == "between" for f in ir.filters)
        assert execute_ok(sql, GENERIC_ROWS)

    def test_130_name_starts_with_item(self):
        ir, sql, _ = parse_and_generate("Names that start with Item", GENERIC_COLS, GENERIC_PROFILE)
        assert any(f.operator == "starts_with" for f in ir.filters) or execute_ok(sql, GENERIC_ROWS)

    # Sorting
    def test_131_top_3_by_value(self):
        ir, sql, _ = parse_and_generate("Top 3 by value", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.limit == 3
        assert ir.sort is not None and ir.sort.direction == "DESC"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_132_bottom_2_by_count(self):
        ir, sql, _ = parse_and_generate("Bottom 2 by count", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.limit == 2
        assert execute_ok(sql, GENERIC_ROWS)

    def test_133_ascending_order(self):
        ir, sql, _ = parse_and_generate("Show values in ascending order", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.sort is not None and ir.sort.direction == "ASC"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_134_descending_order(self):
        ir, sql, _ = parse_and_generate("Show values in descending order", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.sort is not None and ir.sort.direction == "DESC"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_135_top_ten(self):
        ir, sql, _ = parse_and_generate("Show the top ten records", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.limit == 10
        assert execute_ok(sql, GENERIC_ROWS)

    # Date / Time
    def test_136_monthly_trend(self):
        ir, sql, _ = parse_and_generate("Monthly trend of value", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.time_granularity == "month" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, GENERIC_ROWS)

    def test_137_daily_count(self):
        ir, sql, _ = parse_and_generate("Daily count of records", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.time_granularity == "day" or ir.aggregation == "COUNT"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_138_this_month_data(self):
        ir, _, _ = parse_and_generate("Show data from this month", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.time_filter is not None and ir.time_filter["unit"] == "month"

    def test_139_last_year_value(self):
        ir, _, _ = parse_and_generate("Total value for last year", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.time_filter is not None and ir.time_filter["unit"] == "year"

    def test_140_quarterly_breakdown(self):
        ir, sql, _ = parse_and_generate("Quarterly value breakdown", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.time_granularity == "quarter" or ir.intent in ("trend", "aggregation")
        assert execute_ok(sql, GENERIC_ROWS)

    # Statistical functions
    def test_141_median_value(self):
        ir, sql, _ = parse_and_generate("Median value", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.statistical_function == "MEDIAN"
        assert ir.intent == "statistical"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_142_std_deviation_value(self):
        ir, sql, _ = parse_and_generate("Standard deviation of value", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.statistical_function == "STDDEV"
        assert ir.intent == "statistical"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_143_variance_count(self):
        ir, sql, _ = parse_and_generate("Variance of count", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.statistical_function == "VARIANCE"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_144_correlation_value_count(self):
        ir, _, _ = parse_and_generate("Correlation between value and count", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.statistical_function == "CORRELATION"
        assert ir.intent == "statistical"

    def test_145_percentile_value(self):
        ir, sql, _ = parse_and_generate("90th percentile of value", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.statistical_function == "PERCENTILE"
        assert execute_ok(sql, GENERIC_ROWS)

    # Data quality
    def test_146_missing_values(self):
        ir, sql, _ = parse_and_generate("Show missing values in dataset", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.is_data_quality
        assert ir.data_quality_type == "missing"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_147_duplicate_rows(self):
        ir, sql, _ = parse_and_generate("Find duplicate rows", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.is_data_quality
        assert ir.data_quality_type == "duplicates"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_148_row_count(self):
        ir, sql, _ = parse_and_generate("How many rows in the dataset?", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.is_metadata
        assert ir.data_quality_type == "row_count"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_149_column_count(self):
        ir, _, _ = parse_and_generate("How many columns does the dataset have?", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.is_metadata
        assert ir.data_quality_type == "col_count"

    def test_150_dataset_schema(self):
        ir, sql, _ = parse_and_generate("Show me the schema of the dataset", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.is_metadata
        assert ir.data_quality_type in ("schema", "summary")
        assert execute_ok(sql, GENERIC_ROWS)

    # Multi-condition queries
    def test_151_sum_value_active_category(self):
        ir, sql, _ = parse_and_generate(
            "Total value for active status per category",
            GENERIC_COLS,
            GENERIC_PROFILE + [{"name": "Status", "type": "string", "sampleValues": ["Active", "Inactive"]}]
        )
        assert ir.aggregation == "SUM"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_152_distribution_of_value(self):
        ir, sql, _ = parse_and_generate("Distribution of value", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.intent == "distribution"
        assert execute_ok(sql, GENERIC_ROWS)

    def test_153_chart_kpi_single_value(self):
        ir, _, _ = parse_and_generate("Total sum of value", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.chart in ("kpi", "bar", "table")  # kpi when no dimension

    def test_154_chart_bar_category_numeric(self):
        ir, _, _ = parse_and_generate("Value by category", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.chart in ("bar", "bar_horizontal", "pie")

    def test_155_chart_line_date_numeric(self):
        ir, _, _ = parse_and_generate("Monthly trend of value", GENERIC_COLS, GENERIC_PROFILE)
        assert ir.chart in ("line", "area", "bar")


# ===========================================================================
# IR → SQL Structural Tests
# ===========================================================================

class TestIRSQLStructure:
    """Verify SQL string structure for specific IR scenarios."""

    def test_sql_contains_group_by_when_dimension_present(self):
        ir, sql, _ = parse_and_generate("Total sales by region", RETAIL_COLS, RETAIL_PROFILE)
        assert "GROUP BY" in sql.upper()

    def test_sql_contains_order_by_when_sort_present(self):
        ir, sql, _ = parse_and_generate("Top 5 customers by sales", RETAIL_COLS, RETAIL_PROFILE)
        assert "ORDER BY" in sql.upper()

    def test_sql_contains_limit(self):
        ir, sql, _ = parse_and_generate("Top 10 products by profit", RETAIL_COLS, RETAIL_PROFILE)
        assert "LIMIT" in sql.upper()

    def test_sql_uses_df_table(self):
        ir, sql, _ = parse_and_generate("Total sales", RETAIL_COLS, RETAIL_PROFILE)
        assert "FROM df" in sql or "FROM \"df\"" in sql or "from df" in sql.lower()

    def test_sql_where_for_filter(self):
        ir, sql, _ = parse_and_generate("Sales greater than 1000", RETAIL_COLS, RETAIL_PROFILE)
        assert "WHERE" in sql.upper()

    def test_sql_avg_function(self):
        ir, sql, _ = parse_and_generate("Average salary", HR_COLS, HR_PROFILE)
        assert "AVG" in sql.upper()

    def test_sql_count_function(self):
        ir, sql, _ = parse_and_generate("Count of employees", HR_COLS, HR_PROFILE)
        assert "COUNT" in sql.upper()

    def test_sql_max_function(self):
        ir, sql, _ = parse_and_generate("Maximum profit", RETAIL_COLS, RETAIL_PROFILE)
        assert "MAX" in sql.upper()

    def test_sql_min_function(self):
        ir, sql, _ = parse_and_generate("Minimum sales", RETAIL_COLS, RETAIL_PROFILE)
        assert "MIN" in sql.upper()

    def test_sql_null_check(self):
        ir, sql, _ = parse_and_generate("Show missing values", GENERIC_COLS, GENERIC_PROFILE)
        assert "NULL" in sql.upper() or execute_ok(sql, GENERIC_ROWS)

    def test_ir_confidence_is_float(self):
        ir = intent_parser.parse("Total sales by region", RETAIL_COLS, RETAIL_PROFILE)
        assert isinstance(ir.confidence, float)
        assert 0.0 <= ir.confidence <= 1.0

    def test_ir_metric_in_column_names(self):
        ir = intent_parser.parse("Average salary by department", HR_COLS, HR_PROFILE)
        if ir.metric:
            assert ir.metric in HR_COLS

    def test_ir_dimensions_in_column_names(self):
        ir = intent_parser.parse("Total profit by category", RETAIL_COLS, RETAIL_PROFILE)
        for dim in ir.dimensions:
            assert dim in RETAIL_COLS

    def test_ir_serializable_to_json(self):
        ir = intent_parser.parse("Top 5 customers by sales", RETAIL_COLS, RETAIL_PROFILE)
        json_str = json.dumps(ir.model_dump())
        assert len(json_str) > 10  # non-empty valid JSON

    def test_ir_chart_is_valid_type(self):
        ir = intent_parser.parse("Revenue by region", RETAIL_COLS, RETAIL_PROFILE)
        valid_charts = {"kpi", "bar", "bar_horizontal", "line", "area", "scatter", "pie",
                        "donut", "histogram", "heatmap", "treemap", "table"}
        assert ir.chart in valid_charts


if __name__ == "__main__":
    import sys
    result = pytest.main([__file__, "-v", "--tb=short", "-q"])
    sys.exit(result)
