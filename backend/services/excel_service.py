import io
import pandas as pd
from typing import List, Dict, Any

def parse_excel_workbook(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Parses an Excel workbook (.xlsx, .xls) and returns a list of dataset objects (one per sheet).
    """
    excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
    sheets = excel_file.sheet_names

    datasets = []

    for sheet_name in sheets:
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        
        # Drop empty rows & columns
        df = df.dropna(how='all')
        if df.empty:
            continue

        # Handle NaNs / Infinities for clean JSON serialization
        df = df.replace([float('inf'), float('-inf')], None)
        df = df.where(pd.notnull(df), None)

        rows = df.to_dict(orient='records')
        columns = list(df.columns)

        # Sanitize keys
        sanitized_rows = []
        for r in rows:
            clean_row = {}
            for k, v in r.items():
                str_key = str(k).strip()
                if isinstance(v, float) and (v != v or v == float('inf') or v == float('-inf')):
                    clean_row[str_key] = None
                elif pd.isna(v):
                    clean_row[str_key] = None
                elif hasattr(v, 'isoformat'):
                    clean_row[str_key] = v.isoformat()
                else:
                    clean_row[str_key] = v
            sanitized_rows.append(clean_row)

        dataset_id = f"ds_excel_{sheet_name.lower().replace(' ', '_')}_{len(datasets)+1}"
        dataset_name = f"{filename} - {sheet_name}" if len(sheets) > 1 else filename

        datasets.append({
            "id": dataset_id,
            "name": dataset_name,
            "sheetName": sheet_name,
            "description": f"Excel dataset imported from '{filename}' sheet '{sheet_name}'. Contains {len(sanitized_rows)} records.",
            "data": sanitized_rows,
            "columnNames": [str(c).strip() for c in columns]
        })

    return datasets
