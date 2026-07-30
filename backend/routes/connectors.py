from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from backend.services.db_connector_service import (
    test_db_connection,
    introspect_schema_details,
    import_table_snapshot_rows,
    introspect_full_schema,
)
from backend.services.excel_service import parse_excel_workbook

router = APIRouter(prefix="/api/connectors", tags=["Universal Data Connectors"])

class ConnectionTestRequest(BaseModel):
    sourceType: str  # postgres, mysql, sqlite
    host: Optional[str] = "localhost"
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

class ImportTableRequest(BaseModel):
    sourceType: str
    tableName: str
    host: Optional[str] = "localhost"
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    limit: Optional[int] = 10000

@router.post("/test")
async def api_test_connection(req: ConnectionTestRequest):
    res = test_db_connection(
        source_type=req.sourceType,
        host=req.host,
        port=req.port,
        database=req.database,
        username=req.username,
        password=req.password
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@router.post("/introspect")
async def api_introspect_schema(req: ConnectionTestRequest):
    tables = introspect_schema_details(
        source_type=req.sourceType,
        host=req.host,
        port=req.port,
        database=req.database,
        username=req.username,
        password=req.password
    )
    return {"tables": tables}

@router.post("/schema-overview")
async def api_schema_overview(req: ConnectionTestRequest):
    """
    Returns the full relational schema for any supported database:
    tables, columns, SQL types, primary keys, foreign keys, row counts, file size.
    This is the primary data source for the Schema Metadata Engine on the frontend.
    Supports: SQLite (tmpPath via query param), PostgreSQL, MySQL.
    """
    try:
        schema = introspect_full_schema(
            source_type=req.sourceType,
            host=req.host,
            port=req.port,
            database=req.database,
            username=req.username,
            password=req.password,
        )
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schema introspection failed: {str(e)}")

@router.post("/schema-overview-sqlite")
async def api_schema_overview_sqlite(
    tmpPath: str = Body(..., embed=True),
    dbName: str = Body("Database", embed=True),
):
    """
    Returns the full relational schema for an already-uploaded SQLite database
    identified by its server-side tmpPath.
    """
    try:
        schema = introspect_full_schema(
            source_type="sqlite",
            sqlite_path=tmpPath,
            database=dbName,
        )
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SQLite schema introspection failed: {str(e)}")

@router.post("/import-table")
async def api_import_table(req: ImportTableRequest):
    rows = import_table_snapshot_rows(
        source_type=req.sourceType,
        table_name=req.tableName,
        host=req.host,
        port=req.port,
        database=req.database,
        username=req.username,
        password=req.password,
        limit=req.limit or 10000
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"No rows could be imported from table '{req.tableName}'.")
    return {"tableName": req.tableName, "rowCount": len(rows), "rows": rows}

@router.post("/upload-excel")
async def api_upload_excel(file: UploadFile = File(...)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel workbook (.xlsx, .xls).")
    
    contents = await file.read()
    try:
        datasets = parse_excel_workbook(contents, file.filename)
        if not datasets:
            raise HTTPException(status_code=400, detail="Excel workbook contains zero non-empty sheets.")
        return {"filename": file.filename, "datasets": datasets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse Excel workbook: {str(e)}")

@router.post("/upload-sqlite")
async def api_upload_sqlite(file: UploadFile = File(...)):
    if not file.filename.endswith(('.db', '.sqlite', '.sqlite3')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a SQLite database file (.db, .sqlite).")

    contents = await file.read()
    try:
        conn_res = test_db_connection(source_type='sqlite', sqlite_bytes=contents)
        if not conn_res.get("success"):
            raise HTTPException(status_code=400, detail=conn_res.get("message"))

        tmp_path = conn_res.get("tmpPath")
        tables = introspect_schema_details(source_type='sqlite', sqlite_path=tmp_path)
        return {"filename": file.filename, "tables": tables, "tmpPath": tmp_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inspect SQLite database: {str(e)}")

@router.post("/import-sqlite-table")
async def api_import_sqlite_table(
    tmpPath: str = Body(..., embed=True),
    tableName: str = Body(..., embed=True),
    limit: Optional[int] = Body(10000, embed=True)
):
    rows = import_table_snapshot_rows(
        source_type='sqlite',
        table_name=tableName,
        sqlite_path=tmpPath,
        limit=limit or 10000
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"No rows found in SQLite table '{tableName}'.")
    return {"tableName": tableName, "rowCount": len(rows), "rows": rows}
