import hashlib
import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger("insightai.dataset_memory")


class DatasetMemoryObject(BaseModel):
    dataset_hash: str
    dataset_name: str
    row_count: int
    column_count: int
    columns: List[Dict[str, Any]]
    primary_keys: List[str]
    foreign_keys: List[Dict[str, str]]
    numeric_columns: List[str]
    categorical_columns: List[str]
    datetime_columns: List[str]
    column_aliases: Dict[str, List[str]]
    business_summary: str
    statistics_overview: Dict[str, Any]


class DatasetMemoryService:
    def __init__(self):
        self._memory_cache: Dict[str, DatasetMemoryObject] = {}

    def _compute_hash(self, summary: Dict[str, Any], sample_rows: List[Dict[str, Any]]) -> str:
        raw_str = f"{summary.get('rowCount', 0)}_{summary.get('columnCount', 0)}_{json.dumps(summary.get('columns', []))[:200]}"
        return hashlib.sha256(raw_str.encode('utf-8')).hexdigest()[:16]

    def get_or_create_memory(
        self,
        summary: Dict[str, Any],
        sample_rows: List[Dict[str, Any]],
        dataset_name: Optional[str] = None
    ) -> DatasetMemoryObject:
        d_hash = self._compute_hash(summary, sample_rows)
        if d_hash in self._memory_cache:
            logger.info(f"[Dataset Memory] Cache hit for hash {d_hash}")
            return self._memory_cache[d_hash]

        cols = summary.get("columns", [])
        num_cols = []
        cat_cols = []
        dt_cols = []
        aliases: Dict[str, List[str]] = {}
        primary_keys = []

        for c in cols:
            name = c.get("name", "")
            ctype = c.get("type", "string")

            # Generate semantic aliases for column search
            clean_name = name.replace("_", " ").replace("-", " ").lower()
            tokens = clean_name.split()
            col_aliases = [clean_name, name.lower()]

            if "id" in tokens or "code" in tokens or "key" in tokens:
                primary_keys.append(name)
            if "sale" in clean_name or "revenue" in clean_name or "amount" in clean_name:
                col_aliases.extend(["sales", "revenue", "turnover", "income", "amount", "spend"])
            if "customer" in clean_name or "client" in clean_name or "buyer" in clean_name:
                col_aliases.extend(["customer", "client", "buyer", "user", "purchaser"])
            if "region" in clean_name or "country" in clean_name or "state" in clean_name or "city" in clean_name:
                col_aliases.extend(["location", "geography", "territory", "place", "region", "area"])
            if "product" in clean_name or "item" in clean_name or "sku" in clean_name:
                col_aliases.extend(["product", "item", "merchandise", "good", "article"])
            if "date" in clean_name or "time" in clean_name or "year" in clean_name or "month" in clean_name:
                col_aliases.extend(["date", "time", "period", "timestamp", "day"])

            aliases[name] = list(set(col_aliases))

            if ctype in ["number", "float", "int", "integer"]:
                num_cols.append(name)
            elif ctype in ["datetime", "date", "timestamp"]:
                dt_cols.append(name)
            else:
                cat_cols.append(name)

        stats_overview = {
            "total_records": summary.get("rowCount", 0),
            "total_columns": summary.get("columnCount", 0),
            "numeric_metrics_count": len(num_cols),
            "categorical_dimensions_count": len(cat_cols),
            "missing_cells": summary.get("missingCellsCount", 0)
        }

        b_summary = (
            f"Dataset containing {summary.get('rowCount', 0):,} records across {len(cols)} columns. "
            f"Primary numerical metrics: {', '.join(num_cols[:4]) if num_cols else 'N/A'}. "
            f"Primary dimensions: {', '.join(cat_cols[:4]) if cat_cols else 'N/A'}."
        )

        memory_obj = DatasetMemoryObject(
            dataset_hash=d_hash,
            dataset_name=dataset_name or "Uploaded Dataset",
            row_count=summary.get("rowCount", 0),
            column_count=len(cols),
            columns=cols,
            primary_keys=primary_keys[:2],
            foreign_keys=[],
            numeric_columns=num_cols,
            categorical_columns=cat_cols,
            datetime_columns=dt_cols,
            column_aliases=aliases,
            business_summary=b_summary,
            statistics_overview=stats_overview
        )

        self._memory_cache[d_hash] = memory_obj
        logger.info(f"[Dataset Memory] Created & cached new memory object for hash {d_hash}")
        return memory_obj


dataset_memory_service = DatasetMemoryService()
