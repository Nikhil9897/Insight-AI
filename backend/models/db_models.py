import uuid
import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    firebase_uid = Column(String(128), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    display_name = Column(String(255), nullable=True)
    avatar_url = Column(Text, nullable=True)
    role = Column(String(100), default="Enterprise Data Analyst")
    company = Column(String(255), default="InsightAI Workspace")
    last_opened_project_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    dashboards = relationship("SavedDashboard", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), default="layout-dashboard")
    color = Column(String(50), default="#2563EB")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="projects")
    data_sources = relationship("DataSource", back_populates="project", cascade="all, delete-orphan")
    datasets = relationship("ImportedDataset", back_populates="project", cascade="all, delete-orphan")
    dashboards = relationship("SavedDashboard", back_populates="project", cascade="all, delete-orphan")
    query_records = relationship("QueryHistoryRecord", back_populates="project", cascade="all, delete-orphan")


class DataSource(Base):
    __tablename__ = "data_sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    connector_type = Column(String(50), nullable=False)  # csv, excel, postgres, mysql, sqlite
    display_name = Column(String(255), nullable=False)
    source_metadata = Column(JSON, nullable=True)  # host, port, dbname WITHOUT passwords
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="data_sources")


class ImportedDataset(Base):
    __tablename__ = "imported_datasets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(128), index=True, nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    dataset_name = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False)  # csv, excel, postgres, mysql, sqlite
    original_file_name = Column(String(255), nullable=True)
    storage_location = Column(String(255), nullable=True)
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    schema_json = Column(JSON, nullable=True)
    summary_json = Column(JSON, nullable=True)
    data_rows_json = Column(JSON, nullable=True)   # Full row data — up to 5000 rows
    description = Column(Text, nullable=True)
    imported_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="datasets")


class QueryHistoryRecord(Base):
    __tablename__ = "query_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    dataset_id = Column(String(128), nullable=True)
    dataset_name = Column(String(255), nullable=True)
    user_query = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, default=0)
    chart_type = Column(String(50), default="bar")
    result_row_count = Column(Integer, default=0)
    status = Column(String(20), default="success")   # success | error
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="query_records")


class SavedDashboard(Base):
    __tablename__ = "saved_dashboards"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    layout_json = Column(JSON, nullable=True)
    pinned_cards_json = Column(JSON, nullable=True)
    filters_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="dashboards")
    user = relationship("User", back_populates="dashboards")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    theme = Column(String(50), default="light")
    preferred_llm = Column(String(50), default="ollama")
    default_chart = Column(String(50), default="bar")
    sidebar_state = Column(String(50), default="expanded")

    # Relationships
    user = relationship("User", back_populates="preferences")
