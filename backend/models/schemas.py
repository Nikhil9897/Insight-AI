from typing import List, Dict, Any, Optional, Union, Literal
from pydantic import BaseModel, Field

DataType = Literal['number', 'string', 'datetime', 'boolean']

class ColumnProfile(BaseModel):
    name: str
    type: DataType
    sampleValues: List[Optional[Union[str, int, float, bool]]] = []
    nullCount: int = 0
    distinctCount: int = 0
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    median: Optional[float] = None
    topValue: Optional[Union[str, int, float]] = None
    topCount: Optional[int] = None

class HealthCheckItem(BaseModel):
    label: str
    status: Literal['pass', 'warn', 'fail']
    detail: str

class DatasetSummary(BaseModel):
    rowCount: int
    columnCount: int
    missingCellsCount: int
    duplicateRowsCount: int
    columns: List[ColumnProfile]
    healthScore: Optional[int] = None
    healthChecks: Optional[List[HealthCheckItem]] = None

class ExecutiveSummary(BaseModel):
    keyGrowthDrivers: List[str] = []
    operationalRisks: List[str] = []
    topPerformingSegments: List[str] = []
    strategicRecommendations: List[str] = []

class AiProfileResponse(BaseModel):
    overview: str
    businessDomain: str
    suggestedQuestions: List[str]
    keyMetrics: List[str]
    executiveSummary: Optional[ExecutiveSummary] = None

class DatasetProfileRequest(BaseModel):
    summary: Dict[str, Any]
    sampleRows: List[Dict[str, Any]] = []

class ChartConfig(BaseModel):
    type: str
    xAxisKey: str
    yAxisKey: Union[str, List[str]]
    title: str
    description: Optional[str] = None
    groupBy: Optional[str] = None
    subTitle: Optional[str] = None
    delta: Optional[str] = None
    badge: Optional[str] = None
    alternativeCharts: Optional[List[str]] = None
    chartRankings: Optional[List[Dict[str, Any]]] = None

class AgenticAttempt(BaseModel):
    attemptNumber: int
    generatedSql: str
    status: Literal['success', 'error']
    errorMessage: Optional[str] = None
    reflectionNote: Optional[str] = None

class PerformanceBreakdown(BaseModel):
    plannerMs: int = 0
    semanticSearchMs: int = 0
    sqlBuildMs: int = 0
    duckdbMs: int = 0
    insightMs: int = 0
    llmMs: int = 0
    vizMs: int = 0
    totalMs: int = 0

class QueryExecutionRequest(BaseModel):
    userQuery: str
    datasetRows: List[Dict[str, Any]]
    columnsProfile: Optional[List[Dict[str, Any]]] = None
    sessionId: Optional[str] = None
    datasetName: Optional[str] = None
    datasetSummary: Optional[Dict[str, Any]] = None

class QueryResultResponse(BaseModel):
    query: str
    sql: str
    rows: List[Dict[str, Any]]
    columns: List[str]
    explanation: str
    chartConfig: Optional[ChartConfig] = None
    businessInsights: List[str] = []
    executionTimeMs: int
    agenticLog: List[AgenticAttempt] = []
    timestamp: str
    confidenceScore: Optional[int] = 98
    confidenceReasons: Optional[List[str]] = None
    querySteps: Optional[List[str]] = None
    followUpQuestions: Optional[List[str]] = None
    performanceBreakdown: Optional[PerformanceBreakdown] = None
    chartExplanation: Optional[str] = None
    # Advanced Dual-Path & Intelligence Features
    executionPath: Optional[str] = None
    deterministicStats: Optional[Dict[str, Any]] = None
    datasetMemory: Optional[Dict[str, Any]] = None
    semanticMappings: Optional[Dict[str, str]] = None
    queryPlan: Optional[Dict[str, Any]] = None
    ragContext: Optional[Dict[str, Any]] = None
    explainabilityDetails: Optional[Dict[str, Any]] = None

# Authentication Schemas
class AuthLoginRequest(BaseModel):
    email: str
    password: str

class AuthRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    company: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar: Optional[str] = None
    role: str = "Enterprise Data Analyst"
    company: Optional[str] = "InsightAI Workspace"
    token: str
    createdAt: str

class AuthResponse(BaseModel):
    success: bool
    user: Optional[UserResponse] = None
    message: Optional[str] = None
