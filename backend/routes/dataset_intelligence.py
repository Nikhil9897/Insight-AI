from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, status
import pandas as pd

from backend.services.dataset_brain import DatasetBrain
from backend.services.capability_discovery import CapabilityDiscovery
from backend.services.suggestion_engine import SuggestionEngine
from backend.services.grammar_autocomplete import GrammarAutocomplete
from backend.models.schemas import QueryExecutionRequest

router = APIRouter(prefix="/api/intelligence", tags=["dataset_intelligence"])

@router.post("/profile")
async def get_dataset_brain_profile(req: QueryExecutionRequest):
    """
    Layer 1 Endpoint: Builds Dataset Profile JSON ('The Brain').
    Detects semantic roles, metrics, dimensions, time columns, and business domain metadata.
    """
    dataset_rows = req.datasetRows
    if not dataset_rows:
        raise HTTPException(status_code=400, detail="datasetRows cannot be empty.")

    df = pd.DataFrame(dataset_rows)
    brain_profile = DatasetBrain.build_brain_profile(df, dataset_name=req.datasetName or "Dataset")
    return brain_profile

@router.post("/capabilities")
async def get_dataset_capabilities(req: QueryExecutionRequest):
    """
    Layer 3.1 Endpoint: Capability Discovery.
    Discovers business capabilities supported by the dataset (e.g. ✓ Revenue Analysis, ✓ Regional Geography).
    """
    dataset_rows = req.datasetRows
    if not dataset_rows:
        raise HTTPException(status_code=400, detail="datasetRows cannot be empty.")

    df = pd.DataFrame(dataset_rows)
    brain_profile = DatasetBrain.build_brain_profile(df, dataset_name=req.datasetName or "Dataset")
    capabilities = CapabilityDiscovery.discover_capabilities(brain_profile)
    return {
        'domain': brain_profile['domain'],
        'confidence': brain_profile['domain_confidence'],
        'capabilities': capabilities
    }

@router.post("/suggestions")
async def get_algorithmic_suggestions(req: QueryExecutionRequest):
    """
    Layer 3.2 Endpoint: Algorithmic Ranked Suggestions.
    Returns candidate questions generated algorithmically with star ratings (3 to 5 stars).
    """
    dataset_rows = req.datasetRows
    if not dataset_rows:
        raise HTTPException(status_code=400, detail="datasetRows cannot be empty.")

    df = pd.DataFrame(dataset_rows)
    brain_profile = DatasetBrain.build_brain_profile(df, dataset_name=req.datasetName or "Dataset")
    suggestions = SuggestionEngine.generate_ranked_suggestions(brain_profile)
    return {
        'suggestions': suggestions
    }

@router.post("/autocomplete")
async def get_grammar_autocomplete(req: Dict[str, Any]):
    """
    Layer 3.3 Endpoint: Grammar-Aware Autocomplete.
    Takes user query prefix and returns token-by-token completion suggestions.
    """
    query_prefix = req.get('query', '')
    dataset_rows = req.get('datasetRows', [])

    if not dataset_rows:
        return {'completions': ["show total", "show average", "show top 10"]}

    df = pd.DataFrame(dataset_rows)
    brain_profile = DatasetBrain.build_brain_profile(df)
    completions = GrammarAutocomplete.get_completions(query_prefix, brain_profile)
    return {'completions': completions}
