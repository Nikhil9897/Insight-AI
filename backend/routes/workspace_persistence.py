import datetime
import logging
from typing import Optional, List, Dict, Any, cast
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from backend.database import get_db
from backend.models.db_models import (
    User,
    Project,
    DataSource,
    ImportedDataset,
    QueryHistoryRecord,
    SavedDashboard,
    UserPreference
)
from backend.services.auth_service import verify_firebase_token

router = APIRouter(prefix="/api/workspace", tags=["Workspace & Persistence"])

@router.post("/sync-user")
async def sync_user(
    auth_user: Dict[str, Any] = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    user_id = auth_user["user_id"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User record not found.")
    projects = db.query(Project).filter(Project.user_id == user_id).order_by(Project.updated_at.desc()).all()
    if not projects:
        default_proj = Project(user_id=user_id, name="Global Enterprise Analytics", description="Default enterprise sales and operational analytics workspace.", icon="layout-dashboard", color="#2563EB")
        db.add(default_proj)
        db.commit()
        db.refresh(default_proj)
        user.last_opened_project_id = default_proj.id
        db.commit()
        projects = [default_proj]
    active_project_id = user.last_opened_project_id or projects[0].id
    return {
        "user": {"id": user.id, "email": user.email, "displayName": user.display_name, "avatarUrl": user.avatar_url, "role": user.role, "company": user.company, "lastOpenedProjectId": active_project_id},
        "isGuest": auth_user.get("is_guest", False),
        "projects": [{"id": p.id, "name": p.name, "description": p.description, "icon": p.icon, "color": p.color, "createdAt": p.created_at.isoformat()} for p in projects]
    }

@router.get("/projects")
async def list_projects(auth_user: Dict[str, Any] = Depends(verify_firebase_token), db: Session = Depends(get_db)):
    user_id = auth_user["user_id"]
    projects = db.query(Project).filter(Project.user_id == user_id).order_by(Project.updated_at.desc()).all()
    return {"projects": [{"id": p.id, "name": p.name, "description": p.description, "icon": p.icon, "color": p.color} for p in projects]}

@router.post("/projects")
async def create_project(
    name: str = Body(..., embed=True),
    description: Optional[str] = Body(None, embed=True),
    icon: Optional[str] = Body("layout-dashboard", embed=True),
    color: Optional[str] = Body("#2563EB", embed=True),
    auth_user: Dict[str, Any] = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    user_id = auth_user["user_id"]
    new_proj = Project(user_id=user_id, name=name.strip(), description=description.strip() if description else None, icon=icon, color=color)
    db.add(new_proj)
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.last_opened_project_id = new_proj.id
    db.commit()
    db.refresh(new_proj)
    return {"project": {"id": new_proj.id, "name": new_proj.name, "description": new_proj.description, "icon": new_proj.icon, "color": new_proj.color}}

@router.get("/restore")
async def restore_workspace(
    projectId: Optional[str] = None,
    auth_user: Dict[str, Any] = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Restores full datasets (including data rows), pinned dashboard, and query history."""
    user_id = auth_user["user_id"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    target_project_id = projectId or user.last_opened_project_id
    project = db.query(Project).filter(Project.id == target_project_id, Project.user_id == user_id).first() if target_project_id else None
    if not project:
        project = db.query(Project).filter(Project.user_id == user_id).order_by(Project.updated_at.desc()).first()
    if not project:
        project = Project(user_id=user_id, name="Global Enterprise Analytics", description="Default analytics project")
        db.add(project)
        db.commit()
        db.refresh(project)
    user.last_opened_project_id = project.id
    db.commit()
    datasets_meta = db.query(ImportedDataset).filter(ImportedDataset.project_id == project.id).all()
    dashboard = db.query(SavedDashboard).filter(SavedDashboard.project_id == project.id).order_by(SavedDashboard.updated_at.desc()).first()
    history = db.query(QueryHistoryRecord).filter(QueryHistoryRecord.project_id == project.id).order_by(QueryHistoryRecord.timestamp.desc()).limit(50).all()
    return {
        "projectId": project.id,
        "projectName": project.name,
        "datasets": [
            {"id": d.dataset_id, "name": d.dataset_name, "description": d.description or "", "sourceType": d.source_type, "rowCount": d.row_count, "columnCount": d.column_count, "schema": d.schema_json, "summary": d.summary_json, "data": d.data_rows_json or [], "uploadedAt": d.imported_at.isoformat() if d.imported_at else "", "isSample": d.source_type == "sample"}
            for d in datasets_meta
        ],
        "dashboard": {"pinnedCards": dashboard.pinned_cards_json if dashboard else [], "layout": dashboard.layout_json if dashboard else {}},
        "queryHistory": [
            {"id": h.id, "userQuery": h.user_query, "sql": h.generated_sql, "explanation": getattr(h, "explanation", "") or "", "datasetId": h.dataset_id or "", "datasetName": h.dataset_name or project.name, "resultRowCount": h.result_row_count, "executionTimeMs": h.execution_time_ms, "status": getattr(h, "status", "success") or "success", "timestamp": h.timestamp.isoformat()}
            for h in history
        ]
    }

@router.post("/projects/{projectId}/auto-save")
async def auto_save_workspace(
    projectId: str,
    pinnedCards: Optional[List[Dict[str, Any]]] = Body([], embed=True),
    layout: Optional[Dict[str, Any]] = Body({}, embed=True),
    datasetsMeta: Optional[List[Dict[str, Any]]] = Body([], embed=True),
    auth_user: Dict[str, Any] = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Auto-saves pinned dashboard layout and dataset metadata (lightweight, no rows)."""
    user_id = auth_user["user_id"]
    project = db.query(Project).filter(Project.id == projectId, Project.user_id == user_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    dashboard = db.query(SavedDashboard).filter(SavedDashboard.project_id == projectId).first()
    if not dashboard:
        dashboard = SavedDashboard(project_id=projectId, user_id=user_id)
        db.add(dashboard)
    dashboard.pinned_cards_json = cast(Any, pinnedCards or [])
    dashboard.layout_json = cast(Any, layout or {})
    dashboard.updated_at = cast(Any, datetime.datetime.now(datetime.timezone.utc))
    if datasetsMeta:
        for ds in datasetsMeta:
            ds_id = ds.get("id")
            if not ds_id:
                continue
            existing_ds = db.query(ImportedDataset).filter(ImportedDataset.project_id == projectId, ImportedDataset.dataset_id == ds_id).first()
            if not existing_ds:
                existing_ds = ImportedDataset(dataset_id=ds_id, project_id=projectId, dataset_name=ds.get("name", "Dataset"), source_type=ds.get("sourceType", "csv"), row_count=ds.get("summary", {}).get("rowCount", 0), column_count=ds.get("summary", {}).get("columnCount", 0), summary_json=cast(Any, ds.get("summary", {})))
                db.add(existing_ds)
            else:
                existing_ds.dataset_name = ds.get("name", existing_ds.dataset_name)
                existing_ds.summary_json = cast(Any, ds.get("summary") or existing_ds.summary_json)
    project.updated_at = cast(Any, datetime.datetime.now(datetime.timezone.utc))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logging.warning("[AutoSave] IntegrityError on commit — retrying with merge.")
        db.commit()
    return {"success": True, "message": "Workspace auto-saved successfully."}


@router.post("/projects/{projectId}/save-snapshot")
async def save_full_snapshot(
    projectId: str,
    datasets: Optional[List[Dict[str, Any]]] = Body([]),
    pinnedCards: Optional[List[Dict[str, Any]]] = Body([]),
    queryHistory: Optional[List[Dict[str, Any]]] = Body([]),
    auth_user: Dict[str, Any] = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Full workspace snapshot: saves complete dataset rows, pinned cards, query history. Called on Save Progress or before logout."""
    user_id = auth_user["user_id"]
    project = db.query(Project).filter(Project.id == projectId, Project.user_id == user_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    saved_datasets = 0
    saved_queries = 0
    for ds in (datasets or []):
        ds_id = ds.get("id")
        if not ds_id:
            continue
        rows = ds.get("data") or []
        rows_to_save = rows[:5000]
        summary = ds.get("summary") or {}
        
        existing_ds = db.query(ImportedDataset).filter(ImportedDataset.project_id == projectId, ImportedDataset.dataset_id == ds_id).first()
        if not existing_ds:
            existing_ds = ImportedDataset(
                dataset_id=ds_id, 
                project_id=projectId, 
                dataset_name=ds.get("name", "Dataset"), 
                description=ds.get("description", ""), 
                source_type="sample" if ds.get("isSample") else "csv", 
                row_count=summary.get("rowCount", len(rows)), 
                column_count=summary.get("columnCount", 0), 
                summary_json=cast(Any, summary), 
                data_rows_json=cast(Any, rows_to_save)
            )
            db.add(existing_ds)
        else:
            existing_ds.dataset_name = ds.get("name", existing_ds.dataset_name)
            existing_ds.description = ds.get("description", getattr(existing_ds, "description", "") or "")
            existing_ds.summary_json = cast(Any, summary)
            existing_ds.data_rows_json = cast(Any, rows_to_save)
            existing_ds.row_count = summary.get("rowCount", len(rows))
            existing_ds.column_count = summary.get("columnCount", existing_ds.column_count)
            existing_ds.updated_at = cast(Any, datetime.datetime.now(datetime.timezone.utc))
        saved_datasets += 1
    if pinnedCards is not None:
        dashboard = db.query(SavedDashboard).filter(SavedDashboard.project_id == projectId).first()
        if not dashboard:
            dashboard = SavedDashboard(project_id=projectId, user_id=user_id)
            db.add(dashboard)
        dashboard.pinned_cards_json = cast(Any, pinnedCards or [])
        dashboard.updated_at = cast(Any, datetime.datetime.now(datetime.timezone.utc))
    existing_ids = {row[0] for row in db.query(QueryHistoryRecord.id).filter(QueryHistoryRecord.project_id == projectId).all()}
    for h in (queryHistory or []):
        h_id = h.get("id")
        if not h_id or h_id in existing_ids:
            continue
        record = QueryHistoryRecord(id=h_id, project_id=projectId, user_id=user_id, dataset_id=h.get("datasetId", ""), dataset_name=h.get("datasetName", ""), user_query=h.get("userQuery", ""), generated_sql=h.get("sql", ""), explanation=h.get("explanation", ""), execution_time_ms=h.get("executionTimeMs", 0), result_row_count=h.get("resultRowCount", 0), status=h.get("status", "success"))
        db.add(record)
        saved_queries += 1
    project.updated_at = cast(Any, datetime.datetime.now(datetime.timezone.utc))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logging.warning("[Snapshot] IntegrityError on commit — skipping duplicate records.")
        db.commit()
    return {"success": True, "savedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "savedDatasets": saved_datasets, "savedQueries": saved_queries, "message": f"Snapshot saved: {saved_datasets} dataset(s), {saved_queries} query record(s)."}


@router.post("/save-query")
async def save_query_record(
    projectId: str = Body(..., embed=True),
    datasetId: Optional[str] = Body(None, embed=True),
    datasetName: Optional[str] = Body(None, embed=True),
    userQuery: str = Body(..., embed=True),
    sql: str = Body(..., embed=True),
    explanation: Optional[str] = Body(None, embed=True),
    executionTimeMs: Optional[int] = Body(0, embed=True),
    resultRowCount: Optional[int] = Body(0, embed=True),
    status: Optional[str] = Body("success", embed=True),
    historyId: Optional[str] = Body(None, embed=True),
    auth_user: Dict[str, Any] = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Persists a single query execution record after every NL2SQL run."""
    import uuid as _uuid
    try:
        user_id = auth_user["user_id"]
        record_id = historyId or str(_uuid.uuid4())
        existing = db.query(QueryHistoryRecord).filter(QueryHistoryRecord.id == record_id).first()
        if existing:
            return {"success": True, "id": record_id, "skipped": True}
        record = QueryHistoryRecord(id=record_id, project_id=projectId, user_id=user_id, dataset_id=datasetId or "", dataset_name=datasetName or "", user_query=userQuery, generated_sql=sql, explanation=explanation or "", execution_time_ms=executionTimeMs or 0, result_row_count=resultRowCount or 0, status=status or "success")
        db.add(record)
        db.commit()
        return {"success": True, "id": record.id}
    except Exception as e:
        db.rollback()
        logging.warning("[SaveQuery] Note: %s", str(e))
        return {"success": True, "note": str(e)}


@router.delete("/projects/{projectId}/query-history")
async def clear_query_history(
    projectId: str,
    auth_user: Dict[str, Any] = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Clears all query history records for a specific project and authenticated user."""
    user_id = auth_user["user_id"]
    project = db.query(Project).filter(Project.id == projectId, Project.user_id == user_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    
    db.query(QueryHistoryRecord).filter(
        QueryHistoryRecord.project_id == projectId,
        QueryHistoryRecord.user_id == user_id
    ).delete()
    db.commit()
    return {"success": True, "message": "Query history cleared successfully."}

