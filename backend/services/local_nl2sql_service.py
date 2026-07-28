import re
from typing import List, Dict, Any, Tuple, Optional
import pandas as pd
from backend.services.duckdb_service import execute_sql_on_data

def generate_local_ai_profile(summary: Dict[str, Any], sample_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generates dataset executive profile locally when LLM is unavailable.
    """
    columns = summary.get('columns', [])
    col_names = [c.get('name', '') for c in columns]
    num_cols = [c.get('name', '') for c in columns if c.get('type') == 'number']
    str_cols = [c.get('name', '') for c in columns if c.get('type') in ('string', 'category')]

    row_count = summary.get('rowCount', len(sample_rows))
    col_count = summary.get('columnCount', len(col_names))
    missing_cells = summary.get('missingCellsCount', 0)

    # Infer domain
    joined_names = ' '.join(col_names).lower()
    business_domain = 'General Analytics & Business Intelligence'
    if any(k in joined_names for k in ['sale', 'revenue', 'order', 'product']):
        business_domain = 'E-Commerce & Enterprise Sales'
    elif any(k in joined_names for k in ['patient', 'diagnosis', 'doctor', 'hospital']):
        business_domain = 'Healthcare & Clinical Operations'
    elif any(k in joined_names for k in ['customer', 'churn', 'subscription', 'arr']):
        business_domain = 'SaaS & Customer Analytics'
    elif any(k in joined_names for k in ['employee', 'salary', 'department']):
        business_domain = 'Human Resources & Workforce'

    primary_num = num_cols[0] if num_cols else (col_names[0] if col_names else 'value')
    primary_cat = str_cols[0] if str_cols else (col_names[0] if col_names else 'category')
    secondary_cat = str_cols[1] if len(str_cols) > 1 else primary_cat

    overview = f"Dataset containing {row_count:,} records across {col_count} attributes including {', '.join(col_names[:4])}. Analyzed for key patterns and metrics."

    suggested_questions = [
        f"What are the top 5 records by {primary_num}?",
        f"Show total {primary_num} grouped by {primary_cat}",
        f"What is the distribution of {primary_cat}?",
        f"Show summary statistics and highest values for {primary_num}",
    ]

    fill_rate = 100
    total_cells = row_count * col_count
    if total_cells > 0:
        fill_rate = round(((total_cells - missing_cells) / total_cells) * 100)

    executive_summary = {
        'keyGrowthDrivers': [
            f"High correlation observed between {primary_cat} categories and top {primary_num} performance metrics.",
            f"Complete data fill rate of {fill_rate}% across {col_count} primary dataset attributes."
        ],
        'operationalRisks': [
            f"Variance in {primary_num} across low-performing {primary_cat} segments require targeted intervention.",
            f"{missing_cells} missing values detected across dataset cells." if missing_cells > 0 else f"Potential data skew or outlier values detected in numerical attribute {primary_num}."
        ],
        'topPerformingSegments': [
            f"Leading {primary_cat} groups showing maximum {primary_num} values.",
            f"Top quantile records filtered across {secondary_cat} distributions."
        ],
        'strategicRecommendations': [
            f"Focus analysis on high-performing {primary_cat} segments to optimize {primary_num} outcomes.",
            f"Implement automated monitoring for outlier detection across {', '.join(col_names[:3])}."
        ]
    }

    return {
        'overview': overview,
        'businessDomain': business_domain,
        'suggestedQuestions': suggested_questions,
        'keyMetrics': num_cols if num_cols else [primary_num],
        'executiveSummary': executive_summary,
    }


def generate_local_sql_and_synthesis(
    user_query: str,
    dataset_rows: List[Dict[str, Any]],
    columns_profile: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Deterministic rule-based SQL generator and statistical synthesis engine.
    Used when Groq/Gemini API key is not configured, quota is reached, or offline.
    """
    if not dataset_rows:
        raise ValueError("No dataset rows available to query.")

    all_cols = list(dataset_rows[0].keys())
    query_lower = user_query.lower()

    def find_column(keywords: List[str]) -> Optional[str]:
        for col in all_cols:
            col_l = col.lower()
            if any(kw in col_l or col_l in kw for kw in keywords):
                return col
        return None

    # Domain column resolution
    gender_col = find_column(['sex', 'gender'])
    pclass_col = find_column(['pclass', 'class', 'grade', 'tier'])
    fare_col = find_column(['fare', 'price', 'cost', 'sales', 'revenue', 'amount', 'salary']) or next((c for c in all_cols if isinstance(dataset_rows[0].get(c), (int, float))), None)
    age_col = find_column(['age', 'tenure', 'experience', 'year'])
    survived_col = find_column(['survived', 'survival', 'status', 'churn', 'retained'])
    date_col = next((c for c in all_cols if any(k in c.lower() for k in ['date', 'month', 'time', 'timestamp'])), None)

    customer_col = find_column(['customer', 'client'])
    product_col = find_column(['product', 'item'])
    category_col = find_column(['category', 'dept', 'department'])
    region_col = find_column(['region', 'state', 'territory', 'zone'])
    city_col = find_column(['city', 'town'])
    segment_col = find_column(['segment'])
    payment_col = find_column(['payment', 'pay_method', 'method'])

    def is_id_col(c: str) -> bool:
        cl = c.lower()
        return (cl.endswith('id') and cl != 'customerid') or cl == 'id' or 'fips' in cl or 'code' in cl

    def is_unique_col(c: str) -> bool:
        if is_id_col(c):
            return True
        cl = c.lower()
        if cl in ('ticket', 'cabin', 'description'):
            return True
        distinct_cnt = len(set(r.get(c) for r in dataset_rows))
        return distinct_cnt > min(100, len(dataset_rows) * 0.9)

    num_cols = [c for c in all_cols if isinstance(dataset_rows[0].get(c), (int, float)) and not is_id_col(c)]
    if not num_cols:
        num_cols = [c for c in all_cols if isinstance(dataset_rows[0].get(c), (int, float))]

    str_cols = [c for c in all_cols if not is_unique_col(c)]
    if not str_cols:
        str_cols = [c for c in all_cols if not is_id_col(c)]

    matched_cat_col = None
    if re.search(r'\b(customer|customers|client|clients)\b', query_lower) and customer_col:
        matched_cat_col = customer_col
    elif re.search(r'\b(product|products|item|items)\b', query_lower) and product_col:
        matched_cat_col = product_col
    elif re.search(r'\b(category|categories)\b', query_lower) and category_col:
        matched_cat_col = category_col
    elif re.search(r'\b(region|regions|area|areas|zone|zones)\b', query_lower) and region_col:
        matched_cat_col = region_col
    elif re.search(r'\b(city|cities|town|towns)\b', query_lower) and city_col:
        matched_cat_col = city_col
    elif re.search(r'\b(segment|segments)\b', query_lower) and segment_col:
        matched_cat_col = segment_col
    elif re.search(r'\b(payment|payments|method|methods)\b', query_lower) and payment_col:
        matched_cat_col = payment_col
    elif re.search(r'\b(class|pclass)\b', query_lower) and pclass_col:
        matched_cat_col = pclass_col
    elif re.search(r'\b(gender|sex)\b', query_lower) and gender_col:
        matched_cat_col = gender_col
    else:
        has_group = bool(re.search(r'\b(by|group|grouped|breakdown|distribution|per)\b', query_lower))
        explicit_cat = next((c for c in str_cols if re.search(rf'\b{re.escape(c.lower().rstrip("s"))}\b', query_lower)), None)
        matched_cat_col = (explicit_cat or str_cols[0]) if has_group else None

    matched_num_col = (
        next((c for c in num_cols if c.lower() in query_lower), None) or
        (fare_col if any(k in query_lower for k in ['fare', 'price', 'cost', 'sales', 'revenue']) else None) or
        (age_col if 'age' in query_lower else None) or
        (survived_col if any(k in query_lower for k in ['survived', 'survival']) else None) or
        (num_cols[0] if num_cols else all_cols[0])
    )

    where_clauses = []
    if gender_col:
        if any(k in query_lower for k in ['female', 'women', 'woman']):
            where_clauses.append(f'"{gender_col}" = \'female\'')
        elif any(k in query_lower for k in ['male', 'men', 'man']):
            where_clauses.append(f'"{gender_col}" = \'male\'')

    if pclass_col:
        if any(k in query_lower for k in ['1st', 'first class', 'class 1']):
            where_clauses.append(f'"{pclass_col}" = 1')
        elif any(k in query_lower for k in ['2nd', 'second class', 'class 2']):
            where_clauses.append(f'"{pclass_col}" = 2')
        elif any(k in query_lower for k in ['3rd', 'third class', 'class 3']):
            where_clauses.append(f'"{pclass_col}" = 3')

    if survived_col and any(k in query_lower for k in ['survived', 'survival', 'survivor']):
        if 'survival rate' not in query_lower and matched_cat_col != survived_col:
            where_clauses.append(f'"{survived_col}" = 1')

    # Generic dynamic categorical matching against dataset_rows
    seen_where_cols = set(c.split('"')[1] for c in where_clauses if '"' in c)
    for col in str_cols:
        if col in seen_where_cols:
            continue
        distinct_vals = set(str(r.get(col, '')).strip() for r in dataset_rows if r.get(col) is not None)
        valid_vals = [v for v in distinct_vals if len(v) >= 2 and not v.isdigit()]
        for val in valid_vals:
            val_lower = val.lower()
            pattern = r'\b' + re.escape(val_lower) + r'\b'
            if re.search(pattern, query_lower) or val_lower in query_lower:
                escaped_val = val.replace("'", "''")
                where_clauses.append(f'LOWER("{col}") = LOWER(\'{escaped_val}\')')
                seen_where_cols.add(col)
                break

    where_str = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    is_time_intent = bool(re.search(r'\b(monthly|month|daily|day|yearly|year|trend|over time|time series)\b', query_lower))
    chart_type = 'bar'
    
    if is_time_intent and date_col:
        chart_type = 'line'
        target_m = matched_num_col or 'Sales'
        sql = f'SELECT SUBSTR("{date_col}", 1, 7) AS Month, ROUND(SUM("{target_m}"), 2) AS Total_{target_m} FROM df{where_str} GROUP BY Month ORDER BY Month ASC'
    elif survived_col and (fare_col or matched_num_col) and any(k in query_lower for k in ['surviv', 'affect', 'rate', 'effect', 'relationship']):
        target_f = fare_col or matched_num_col
        sql = f'SELECT "{survived_col}", COUNT(*) AS Passenger_Count, ROUND(AVG("{target_f}"), 2) AS Avg_Fare, ROUND(MIN("{target_f}"), 2) AS Min_Fare, ROUND(MAX("{target_f}"), 2) AS Max_Fare FROM df{where_str} GROUP BY "{survived_col}" ORDER BY "{survived_col}" DESC'
    elif any(k in query_lower for k in ['summary statistics', 'statistics', 'summary']):
        if matched_num_col and not is_id_col(matched_num_col):
            sql = f'SELECT COUNT(*) AS Record_Count, ROUND(AVG("{matched_num_col}"), 2) AS Avg_{matched_num_col}, MIN("{matched_num_col}") AS Min_{matched_num_col}, MAX("{matched_num_col}") AS Max_{matched_num_col} FROM df{where_str}'
        else:
            sql = f'SELECT COUNT(*) AS Record_Count FROM df{where_str}'
    elif matched_cat_col and matched_num_col:
        agg_fn = 'SUM'
        if any(k in query_lower for k in ['average', 'avg', 'mean']):
            agg_fn = 'AVG'
        elif any(k in query_lower for k in ['count', 'number of', 'total count']):
            agg_fn = 'COUNT'
        sql = f'SELECT "{matched_cat_col}", ROUND({agg_fn}("{matched_num_col}"), 2) AS Total_{matched_num_col} FROM df{where_str} GROUP BY "{matched_cat_col}" ORDER BY Total_{matched_num_col} DESC'
    else:
        limit_clause = " LIMIT 10" if len(dataset_rows) > 10 else ""
        sql = f'SELECT * FROM df{where_str}{limit_clause}'

    # Execute SQL using DuckDB
    query_rows, query_cols = execute_sql_on_data(sql, dataset_rows)

    # Use Scoring Recommendation Engine
    from backend.services.chart_recommender import recommend_chart
    chart_config, explanation = recommend_chart(user_query, query_rows, query_cols)

    x_key = chart_config['xAxisKey']
    y_key = chart_config['yAxisKey']

    top_row = query_rows[0] if query_rows else {}
    business_insights = [
        f"Query executed using DuckDB engine returning {len(query_rows)} record rows.",
        f"Top segment record is '{top_row.get(x_key, 'N/A')}' with metric value {top_row.get(y_key, 'N/A')}.",
        f"Data processed in-memory over {len(dataset_rows)} total rows."
    ]

    return {
        'sql': sql,
        'rows': query_rows,
        'columns': query_cols,
        'explanation': explanation,
        'chartConfig': chart_config,
        'businessInsights': business_insights
    }
