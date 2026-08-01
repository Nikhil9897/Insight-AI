import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { UniversalConnectorModal } from './components/UniversalConnectorModal';
import { DatasetProfiler } from './components/DatasetProfiler';
import { NLQueryConsole } from './components/NLQueryConsole';
import { SmartChart } from './components/SmartChart';
import { QueryResultTable } from './components/QueryResultTable';
import { InsightsBanner } from './components/InsightsBanner';
import { QueryResultTabs } from './components/QueryResultTabs';
import { QueryIRPanel } from './components/QueryIRPanel';
import { DashboardView } from './components/DashboardView';
import { QueryHistoryView } from './components/QueryHistoryView';
import { SchemaViewer } from './components/SchemaViewer';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { AuthLaunchModal } from './components/auth/AuthLaunchModal';
import { FeatureErrorBoundary } from './components/FeatureErrorBoundary';
import { ProjectSwitcherModal } from './components/workspace/ProjectSwitcherModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useAutoSaveWorkspace, loadGuestWorkspaceSnapshot } from './hooks/useAutoSaveWorkspace';
import { InsightLogo } from './components/ui/InsightLogo';
import { sampleDatasets } from './data/sampleDatasets';
import { Dataset, QueryResult, ChatResult, QueryHistoryItem, PinnedDashboardItem, ChartConfig } from './types';
import { LayoutDashboard, Sparkles, Database, History, Plus, FileText, BarChart2, Layers, Network, Upload, Home, Trash2, FolderGit2, Save, CheckCircle2, RefreshCw, Search, PanelLeftClose, PanelLeftOpen, AlertCircle } from 'lucide-react';

function WorkspaceInner() {
  const { user, userProfile, isGuestMode, activeProject, activeProjectId, getIdToken, isLoading } = useAuth();
  const [showLanding, setShowLanding] = useState<boolean>(true);
  // Authenticated users start with an empty workspace; guests get sample datasets
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'profiler' | 'query' | 'dashboard' | 'history' | 'schema'>('profiler');

  const [activeQueryResult, setActiveQueryResult] = useState<QueryResult | null>(null);
  const [activeChatResult, setActiveChatResult] = useState<ChatResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isAiProfiling, setIsAiProfiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);
  const [pinnedItems, setPinnedItems] = useState<PinnedDashboardItem[]>([]);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveToast, setSaveToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [datasetSearch, setDatasetSearch] = useState('');

  // Handle clear query history
  const handleClearHistory = async () => {
    setHistory([]);
    if (isGuestMode || !user) {
      try {
        const snap = loadGuestWorkspaceSnapshot() || { datasets: [], pinnedCards: [] };
        const snapshot = { ...snap, history: [], queryHistory: [], savedAt: new Date().toISOString() };
        localStorage.setItem('insightai_workspace_guest', JSON.stringify(snapshot));
      } catch (e) {
        console.warn('Clear guest history error:', e);
      }
    } else if (activeProjectId && user) {
      try {
        const token = await getIdToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`/api/workspace/projects/${activeProjectId}/query-history`, {
          method: 'DELETE',
          headers,
        });
      } catch (e) {
        console.warn('Clear query history error:', e);
      }
    }
  };

  // Handle Save Progress (for both Guest localStorage and Real User Cloud)
  const handleSaveProgress = async () => {
    setIsSaving(true);
    setSaveToast(null);
    try {
      if (isGuestMode && !user) {
        // Save Guest Progress to local browser storage
        const snapshot = {
          savedAt: new Date().toISOString(),
          datasets: (datasets || []).map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            summary: d.summary,
            data: (d.data || []).slice(0, 2000),
            uploadedAt: d.uploadedAt,
            isSample: d.isSample,
          })),
          pinnedCards: pinnedItems || [],
          history: history || [],
        };
        localStorage.setItem('insightai_workspace_guest', JSON.stringify(snapshot));
        const now = new Date();
        setLastSavedAt(now);
        setSaveToast({
          message: 'Guest session progress saved to browser storage',
          type: 'success',
        });
      } else if (activeProjectId && user) {
        // Save Authenticated Real User Progress to Cloud DB & User LocalStorage
        const token = await getIdToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const userStorageKey = `insightai_workspace_user_${user.uid}_${activeProjectId}`;
        localStorage.setItem(userStorageKey, JSON.stringify({
          savedAt: new Date().toISOString(),
          datasets: (datasets || []).map((d) => ({ id: d.id, name: d.name, summary: d.summary })),
          pinnedCards: pinnedItems || [],
          history: history || [],
        }));

        const res = await fetch(`/api/workspace/projects/${activeProjectId}/save-snapshot`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            datasets: (datasets || []).map((d) => ({
              id: d.id,
              name: d.name,
              description: d.description,
              summary: d.summary,
              data: d.data || [],
              isSample: d.isSample,
            })),
            pinnedCards: pinnedItems || [],
            queryHistory: history || [],
          }),
        });

        if (res.ok) {
          const now = new Date();
          setLastSavedAt(now);
          setSaveToast({
            message: 'Workspace progress saved to your account',
            type: 'success',
          });
        } else {
          throw new Error('Failed to save cloud snapshot');
        }
      }
    } catch (err: any) {
      console.warn('Save progress note:', err);
      setSaveToast({
        message: 'Could not save progress. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveToast(null), 4000);
    }
  };

  // Synchronize landing page & guest mode state cleanly
  useEffect(() => {
    if (isLoading) return;

    // Reset workspace transient state whenever identity changes to prevent state leakage
    setActiveQueryResult(null);
    setActiveChatResult(null);

    if (user && !isGuestMode) {
      // Authenticated user — clear workspace to empty; project restore effect will populate real saved datasets
      setShowLanding(false);
      setAuthModalMode(null);
      setDatasets([]);
      setActiveDatasetId('');
      setPinnedItems([]);
      setHistory([]);
    } else if (isGuestMode && !user) {
      // Guest mode — load guest snapshot from localStorage if exists, else load pristine sampleDatasets
      setHistory([]);
      const snap = loadGuestWorkspaceSnapshot();
      if (snap && snap.datasets && snap.datasets.length > 0) {
        const restored = snap.datasets
          .filter((d: any) => d.name !== 'InsightAI Advanced Test Dataset' && !d.name?.toLowerCase().includes('advanced test'))
          .map((d: any) => ({
            ...d,
            data: d.data || [],
            summary: d.summary || { rowCount: 0, columnCount: 0, columns: [], missingCellsCount: 0, duplicateRowsCount: 0 },
          })) as Dataset[];

        if (restored.length > 0) {
          setDatasets(restored);
          setActiveDatasetId(restored[0]?.id || '');
        } else {
          setDatasets(sampleDatasets);
          setActiveDatasetId(sampleDatasets[0]?.id || '');
        }
      } else {
        setDatasets(sampleDatasets);
        setActiveDatasetId(sampleDatasets[0]?.id || '');
      }
      setPinnedItems(snap?.pinnedCards || []);
      setHistory(snap?.history || (snap as any)?.queryHistory || []);
    } else if (!user && !isGuestMode) {
      setShowLanding(true);
      setAuthModalMode(null);
      setDatasets([]);
      setActiveDatasetId('');
      setPinnedItems([]);
      setHistory([]);
    }
  }, [user?.uid, isGuestMode, isLoading]);

  // Activate debounced auto-save hook
  useAutoSaveWorkspace(pinnedItems, datasets);

  // Restore workspace when project changes (STRICTLY AUTHENTICATED REAL USERS ONLY)
  useEffect(() => {
    if (!activeProjectId || !user || isGuestMode) return;
    const fetchRestored = async () => {
      try {
        const token = await getIdToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/workspace/restore?projectId=' + activeProjectId, { headers });
        if (res.ok) {
          const data = await res.json();

          // Reconstruct full Dataset objects (including data rows, filtering out any sample datasets for real users)
          if (data.datasets && data.datasets.length > 0) {
            const restoredDatasets: Dataset[] = data.datasets
              .filter((d: any) => d.data && d.data.length > 0 && !d.isSample && d.sourceType !== 'sample')  // filter out sample datasets for real user!
              .map((d: any) => ({
                id: d.id,
                name: d.name,
                description: d.description || '',
                data: d.data || [],
                summary: d.summary || {
                  rowCount: d.rowCount || 0,
                  columnCount: d.columnCount || 0,
                  columns: [],
                  missingCellsCount: 0,
                  duplicateRowsCount: 0,
                },
                uploadedAt: d.uploadedAt || new Date().toISOString(),
                isSample: false,
              } as Dataset));

            if (restoredDatasets.length > 0) {
              setDatasets(restoredDatasets);
              setActiveDatasetId(restoredDatasets[0].id);
            } else {
              // Authenticated user has no saved datasets — show empty workspace (not sample data)
              setDatasets([]);
              setActiveDatasetId('');
            }
          } else {
            // Authenticated user project has no datasets yet — show empty workspace
            setDatasets([]);
            setActiveDatasetId('');
          }

          // Always set pinnedItems (or [] if none) for strict user isolation
          setPinnedItems(data.dashboard?.pinnedCards || []);

          // Always set queryHistory (or [] if none) for strict user isolation
          if (data.queryHistory) {
            const restored: QueryHistoryItem[] = data.queryHistory.map((h: any) => ({
              id: h.id,
              datasetId: h.datasetId || '',
              datasetName: h.datasetName || '',
              userQuery: h.userQuery || '',
              sql: h.sql || '',
              resultRowCount: h.resultRowCount || 0,
              status: (h.status as 'success' | 'error') || 'success',
              timestamp: h.timestamp || new Date().toISOString(),
              executionTimeMs: h.executionTimeMs || 0,
              explanation: h.explanation || '',
            }));
            setHistory(restored);
          } else {
            setHistory([]);
          }
        }
      } catch (err) {
        console.warn('Restore note:', err);
      }
    };
    fetchRestored();
  }, [activeProjectId, user?.uid, isGuestMode]);

  const safeDatasets = Array.isArray(datasets) ? datasets : [];
  const safePinnedItems = Array.isArray(pinnedItems) ? pinnedItems : [];

  const activeDataset = safeDatasets.find((d) => d.id === activeDatasetId) || safeDatasets[0] || null;

  const activePinnedItems = activeDataset
    ? safePinnedItems.filter((item) => item && item.datasetId === activeDataset.id)
    : [];

  const handleSelectDataset = (id: string) => {
    setActiveDatasetId(id);
    setActiveQueryResult(null);
    setActiveChatResult(null);
    setError(null);
  };

  const handleRemoveDataset = (datasetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDatasets((prev) => {
      const updated = prev.filter((d) => d.id !== datasetId);
      if (activeDatasetId === datasetId) {
        setActiveDatasetId(updated[0]?.id || '');
        setActiveQueryResult(null);
      }
      return updated;
    });
  };

  const handleDatasetsCreated = (newDatasets: Dataset[]) => {
    setDatasets((prev) => [...newDatasets, ...prev]);
    if (newDatasets.length > 0) {
      setActiveDatasetId(newDatasets[0].id);
      setActiveQueryResult(null);
      setActiveTab('profiler');
    }
  };

  const generateAiProfile = async (datasetId: string) => {
    const ds = datasets.find((d) => d.id === datasetId);
    if (!ds) return;

    setIsAiProfiling(true);
    try {
      const res = await fetch('/api/analytics/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: ds.summary,
          sampleRows: ds.data.slice(0, 5),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || 'Failed to generate profile.');
      }

      const profileData = await res.json();
      setDatasets((prev) =>
        prev.map((d) =>
          d.id === datasetId ? { ...d, aiProfile: profileData } : d
        )
      );
    } catch (err: any) {
      console.error('Error generating AI profile:', err);
    } finally {
      setIsAiProfiling(false);
    }
  };

  // -----------------------------------------------------------------------
  // Conversational signal detector — routes to /api/analytics/chat
  // -----------------------------------------------------------------------
  const CONV_SIGNALS = [
    'summarize', 'summary', 'overview', 'tell me about', 'describe',
    'suitable for', 'good for', 'useful for', 'is this dataset',
    'recommend', 'any missing', 'missing data', 'null values',
    'unusual', 'anomaly', 'outlier', 'what trend', 'what pattern',
    'how many columns', 'how many rows', 'what columns', 'list columns',
    'show columns', 'what format', 'explain', 'what kind', 'what type',
    'what does', 'define', 'meaning of', 'schema', 'what is the dataset',
    'tell me', 'describe the', 'overview of',
    'affect', 'effect', 'impact', 'influence', 'relationship', 'correlation',
    'does ', 'do ', 'why ', 'how does', 'is there', 'can i', 'should i',
  ];

  const isConversational = (query: string): boolean => {
    const q = query.toLowerCase().trim();
    // Exclude explicit SQL aggregation commands (e.g. "show top 5", "total sales by")
    const isExplicitSql = (q.startsWith('show') || q.startsWith('select') || q.startsWith('get') || q.startsWith('list')) &&
      (q.includes('by ') || q.includes('top ') || q.includes('group') || q.includes('sum') || q.includes('total'));
    if (isExplicitSql) return false;

    return CONV_SIGNALS.some((sig) => q.includes(sig));
  };

  const executeQuery = async (queryText: string, targetDataset = activeDataset) => {
    if (!targetDataset || !targetDataset.data || targetDataset.data.length === 0) {
      setError('Please select or upload a valid dataset first.');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setActiveChatResult(null);

    // --- CONVERSATIONAL PATH: Route non-SQL questions to /api/analytics/chat ---
    if (isConversational(queryText)) {
      try {
        const res = await fetch('/api/analytics/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userQuery: queryText,
            datasetName: targetDataset.name,
            datasetSummary: targetDataset.summary,
            sampleRows: targetDataset.data.slice(0, 3),
            sessionId: targetDataset.id,
          }),
        });
        if (res.ok) {
          const chatData: ChatResult = await res.json();
          setActiveChatResult(chatData);
          setActiveQueryResult(null);
          setIsExecuting(false);
          return;
        }
        // If chat endpoint fails, fall through to SQL path
      } catch {
        // fall through to SQL path silently
      }
    }

    try {
      const res = await fetch('/api/analytics/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuery: queryText,
          datasetRows: targetDataset.data,
          columnsProfile: targetDataset.summary.columns,
          sessionId: targetDataset.id,
          datasetName: targetDataset.name,
          datasetSummary: targetDataset.summary,
        }),
      });

      // Safely parse response — backend may return plain-text errors on 5xx
      let responseData: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          responseData = await res.json();
        } catch {
          const rawText = await res.text().catch(() => '');
          throw new Error(`Server returned malformed JSON. Raw: ${rawText.slice(0, 200)}`);
        }
      } else {
        const rawText = await res.text().catch(() => '');
        if (!res.ok) {
          throw new Error(rawText.slice(0, 300) || `Server error: HTTP ${res.status}`);
        }
        throw new Error(`Unexpected response format from server. Raw: ${rawText.slice(0, 200)}`);
      }

      if (!res.ok) {
        throw new Error(responseData?.detail || responseData?.details || responseData?.error || `Server error: HTTP ${res.status}`);
      }

      const result: QueryResult = responseData;
      setActiveQueryResult(result);

      // Add to Query History Log
      const historyItem: QueryHistoryItem = {
        id: 'hist_' + Date.now(),
        datasetId: targetDataset.id,
        datasetName: targetDataset.name,
        userQuery: queryText,
        sql: result.sql,
        resultRowCount: result.rows.length,
        status: 'success',
        timestamp: new Date().toISOString(),
        executionTimeMs: result.executionTimeMs,
        explanation: result.explanation,
      };

      setHistory((prev) => [historyItem, ...prev]);

      // Persist query to backend (fire-and-forget)
      if (activeProjectId) {
        getIdToken().then((token) => {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          fetch('/api/workspace/save-query', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              projectId: activeProjectId,
              datasetId: targetDataset.id,
              datasetName: targetDataset.name,
              userQuery: queryText,
              sql: result.sql,
              explanation: result.explanation || '',
              executionTimeMs: result.executionTimeMs,
              resultRowCount: result.rows.length,
              status: 'success',
              historyId: historyItem.id,
            }),
          }).catch(() => {});
        });
      }
    } catch (err: any) {
      console.error('Query execution error:', err);
      setError(err.message || 'An error occurred while executing natural language query.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleAskQuestion = (q: string) => {
    setActiveTab('query');
    executeQuery(q, activeDataset);
  };

  const handlePinToDashboard = (title: string, chartConfig: ChartConfig) => {
    if (!activeQueryResult) return;

    const newItem: PinnedDashboardItem = {
      id: 'pin_' + Date.now(),
      datasetId: activeDataset?.id,
      datasetName: activeDataset?.name,
      title,
      query: activeQueryResult.query,
      sql: activeQueryResult.sql,
      chartConfig,
      rows: activeQueryResult.rows,
      insights: activeQueryResult.businessInsights,
    };

    setPinnedItems((prev) => [newItem, ...prev]);
  };

  const handleRemovePinned = (id: string) => {
    // Handle resize commands from DashboardView (immutable state update)
    if (id.startsWith('__RESIZE__')) {
      const parts = id.split('__').filter(Boolean); // ['RESIZE', itemId, width]
      const itemId = parts[1];
      const newWidth = parts[2] as 'full' | 'half';
      setPinnedItems((prev) =>
        prev.map((item) => item.id === itemId ? { ...item, width: newWidth } : item)
      );
      return;
    }
    setPinnedItems((prev) => prev.filter((item) => item.id !== id));
  };



  const isCurrentChartPinned = activeQueryResult && activePinnedItems.some(
    (item) => item.query === activeQueryResult.query && item.sql === activeQueryResult.sql
  );

  if (showLanding) {
    return (
      <>
        <LandingPage
          onLaunchApp={() => setAuthModalMode('register')}
          onTryDemo={() => {
            setAuthModalMode(null);
            setShowLanding(false);
            setActiveTab('query');
          }}
          onOpenAuthModal={() => setAuthModalMode('login')}
        />

        {/* Animated Auth Launch Modal with Left-to-Right 3D Ribbon Animation & Sliding Half-Window */}
        {authModalMode && (
          <AuthLaunchModal
            initialMode={authModalMode}
            onClose={() => setAuthModalMode(null)}
            onContinueAsGuest={() => {
              setAuthModalMode(null);
              setShowLanding(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F4] text-slate-800 font-sans flex flex-col md:flex-row">
      {/* Left Sidebar — Premium Enterprise Layout */}
      <aside className={`glass-sidebar text-slate-700 flex-shrink-0 flex flex-col md:sticky md:top-0 md:h-screen md:overflow-y-auto z-40 bg-white border-r border-[#e5e5e5] transition-all duration-300 ease-in-out print:hidden no-print ${isSidebarCollapsed ? 'w-20' : 'w-full md:w-64'}`}>

        
        {/* Brand Header */}
        <div className="px-4 py-4 flex items-center justify-between border-b border-[#e5e5e5]">
          {!isSidebarCollapsed && (
            <button onClick={() => setShowLanding(true)} className="cursor-pointer opacity-90 hover:opacity-100 transition-opacity">
              <InsightLogo size="md" variant="light" />
            </button>
          )}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ${isSidebarCollapsed ? 'mx-auto' : ''}`}>
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        {/* Workspace Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {!isSidebarCollapsed && (
            <button
              onClick={() => setShowLanding(true)}
              className="w-full flex items-center px-3 py-2 mb-4 text-xs font-semibold rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer gap-2"
            >
              <Home className="h-4 w-4 shrink-0" />
              <span>Back to Home</span>
            </button>
          )}

          {/* Section label */}
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 px-3 pb-2 pt-1">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">Workspace</span>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>
          )}

          {[
            { id: 'profiler', label: 'Dataset Profile', icon: Database, status: 'bg-emerald-400' },
            { id: 'query', label: 'NL2SQL Explorer', icon: Sparkles, status: 'bg-blue-400' },
            { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, count: activePinnedItems.length, status: 'bg-indigo-400' },
            { id: 'schema', label: 'Database Intelligence', icon: Network, status: 'bg-violet-400' },
            { id: 'history', label: 'Query Audit Log', icon: History, status: 'bg-slate-300' },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                title={isSidebarCollapsed ? item.label : undefined}
                onClick={() => setActiveTab(item.id as any)}
                className={`group relative w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-all duration-200 cursor-pointer overflow-hidden ${
                  isActive
                    ? 'bg-white shadow-soft-sm border border-slate-200/60 font-bold text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              >
                {/* Active Indicator Bar */}
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r shadow-[0_0_8px_rgba(37,99,235,0.4)] transition-all duration-300"></div>}
                
                <div className="flex items-center gap-3">
                  <Icon strokeWidth={isActive ? 2.5 : 2.2} className={`h-5 w-5 shrink-0 transition-all duration-200 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:translate-x-0.5'}`} />
                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-2">
                       {/* <span className={`w-1.5 h-1.5 rounded-full ${item.status}`}></span> */} 
                       <span className={`transition-all duration-200 ${!isActive && 'group-hover:translate-x-0.5'}`}>{item.label}</span>
                    </div>
                  )}
                </div>
                {!isSidebarCollapsed && item.count !== undefined && item.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Datasets section */}
          <div className="pt-6">
            {!isSidebarCollapsed ? (
              <>
                <div className="flex flex-col gap-2 px-3 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider">Datasets</span>
                    <div className="flex-1 h-px bg-slate-200"></div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={datasetSearch}
                      onChange={(e) => setDatasetSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 text-slate-700"
                    />
                  </div>
                </div>
              </>
            ) : (
               <div className="flex items-center justify-center pt-2 pb-4">
                 <div className="w-8 h-px bg-slate-200"></div>
               </div>
            )}
            <div className="space-y-1">
              {datasets.filter(d => d.name.toLowerCase().includes(datasetSearch.toLowerCase())).map((ds) => {
                const isSelected = activeDataset?.id === ds.id;
                return (
                  <div
                    key={ds.id}
                    title={isSidebarCollapsed ? ds.name : undefined}
                    onClick={() => handleSelectDataset(ds.id)}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'bg-white shadow-soft-sm border border-slate-200/60 scale-[1.01] z-10'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                    } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r shadow-[0_0_8px_rgba(59,130,246,0.4)]"></div>}
                    
                    <Database strokeWidth={isSelected ? 2.5 : 2.2} className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />
                    
                    {!isSidebarCollapsed && (
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <span className={`text-xs font-semibold truncate transition-all duration-200 ${isSelected ? 'text-slate-900' : 'text-slate-600 group-hover:translate-x-0.5 group-hover:text-slate-900'}`}>{ds.name}</span>
                        <span className={`text-[10px] text-slate-400 truncate mt-0.5 transition-all duration-200 ${!isSelected && 'group-hover:translate-x-0.5'}`}>
                          {ds.summary.rowCount.toLocaleString()} rows • {ds.summary.columnCount} cols
                        </span>
                      </div>
                    )}
                    
                    {!isSidebarCollapsed && (
                      <button
                        onClick={(e) => handleRemoveDataset(ds.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User footer — Premium */}
        <div className="p-3 border-t border-[#e5e5e5] bg-slate-50/50">
          <div className={`flex items-center gap-3 px-2 py-2 ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
            <div className="relative shrink-0">
              {/* Prefer Firebase photoURL first, then backend avatarUrl, then DiceBear initials */}
              <img
                src={
                  user?.photoURL ||
                  (userProfile?.avatarUrl && !userProfile.avatarUrl.includes('GuestAnalyst') ? userProfile.avatarUrl : null) ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    user?.displayName || user?.email?.split('@')[0] || 'User'
                  )}`
                }
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-[#e5e5e5] object-cover shadow-sm"
              />
            </div>
            
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                  {(() => {
                    // Always prefer the real Firebase user identity over backend profile
                    const firebaseName = user?.displayName;
                    const firebaseEmail = user?.email;
                    const backendName = userProfile?.displayName;
                    const isGuestName = (n: string | null | undefined) =>
                      !n || n === 'Guest Analyst (Demo)' || n === 'Authenticated User' || n === 'User Account' || n === 'User';

                    if (firebaseName && !isGuestName(firebaseName)) return firebaseName;
                    if (firebaseEmail) return firebaseEmail.split('@')[0];
                    if (backendName && !isGuestName(backendName)) return backendName;
                    if (userProfile?.email && userProfile.email !== 'guest@insightai.demo') return userProfile.email.split('@')[0];
                    return isGuestMode ? 'Demo / Guest User' : 'Authenticated User';
                  })()}
                </p>
                <p className="text-[10px] text-slate-500 font-medium truncate leading-tight mt-0.5">
                  {isGuestMode ? 'Guest Session' : 'Workspace Owner'}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F6F6F4] relative">
        {/* Toast Notification for Save Progress */}
        {saveToast && (
          <div className={`fixed top-16 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-soft-lg border text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
            saveToast.type === 'success' ? 'bg-slate-900 text-slate-50 border-slate-700' : 'bg-rose-900 text-rose-50 border-rose-700'
          }`}>
            {saveToast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{saveToast.message}</span>
          </div>
        )}

        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          datasets={datasets}
          activeDataset={activeDataset}
          onSelectDataset={handleSelectDataset}
          onRemoveDataset={handleRemoveDataset}
          onOpenUpload={() => setUploadModalOpen(true)}
          pinnedCount={pinnedItems.length}
          onGoToLanding={() => setShowLanding(true)}
          onOpenProjectSwitcher={() => setProjectSwitcherOpen(true)}
          onOpenAuthModal={() => setAuthModalMode('login')}
          onSaveProgress={handleSaveProgress}
          isSaving={isSaving}
          lastSavedAt={lastSavedAt}
        />

        <div className="px-8 py-8 max-w-6xl mx-auto w-full space-y-8 flex-1">
          {!activeDataset ? (
            <div className="flex flex-col items-center justify-center text-center py-16 space-y-8">
              {/* Welcome hero */}
              <div className="space-y-3">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl flex items-center justify-center border border-blue-100 shadow-soft-sm mx-auto">
                  <Database className="h-7 w-7 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Welcome to your workspace</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
                    Connect a data source to start running AI-powered queries, generating visualisations, and uncovering business insights in seconds.
                  </p>
                </div>
              </div>

              {/* Feature highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
                {[
                  { icon: Upload, label: 'Upload CSV / Excel', desc: 'Drag-and-drop any spreadsheet' },
                  { icon: Sparkles, label: 'AI-Powered SQL', desc: 'Ask questions in plain English' },
                  { icon: LayoutDashboard, label: 'Auto Dashboard', desc: 'Pin charts to your dashboard' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="bg-white border border-[#e5e5e5] rounded-xl p-4 text-left shadow-soft-xs">
                    <Icon className="h-5 w-5 text-blue-500 mb-2" />
                    <p className="text-xs font-semibold text-slate-800">{label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>

              {/* Primary CTA */}
              <button
                onClick={() => setUploadModalOpen(true)}
                className="inline-flex items-center gap-2 bg-[#0f172a] hover:bg-[#1e293b] text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-soft-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Upload className="h-4 w-4" />
                <span>Connect Data Source</span>
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + (activeDataset?.id || '')}
                initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                {/* Tab 1: Dataset Profiler */}
                {activeTab === 'profiler' && (
                  <FeatureErrorBoundary featureName="Dataset Profiler">
                    <DatasetProfiler
                      dataset={activeDataset}
                      onGenerateAiProfile={generateAiProfile}
                      isAiProfiling={isAiProfiling}
                      onAskQuestion={handleAskQuestion}
                      onRemoveDataset={handleRemoveDataset}
                    />
                  </FeatureErrorBoundary>
                )}

                {/* Tab 2: Natural Language Query Console */}
                {activeTab === 'query' && (
                  <div className="space-y-6">
                    <FeatureErrorBoundary featureName="Query Console">
                      <NLQueryConsole
                        dataset={activeDataset}
                        onExecuteQuery={(q) => executeQuery(q, activeDataset)}
                        isExecuting={isExecuting}
                        activeQueryResult={activeQueryResult}
                        activeChatResult={activeChatResult}
                        error={error}
                      />
                    </FeatureErrorBoundary>

                    {activeQueryResult && activeQueryResult.rows && activeQueryResult.rows.length > 0 && (
                      <div className="space-y-6">
                        {/* 1. Technical & Exploration Tabs (SQL, Performance, Follow-ups) */}
                        <FeatureErrorBoundary featureName="Technical SQL View">
                          <QueryResultTabs
                            activeQueryResult={activeQueryResult}
                            onExecuteQuery={(q) => executeQuery(q, activeDataset)}
                            isExecuting={isExecuting}
                          />
                        </FeatureErrorBoundary>

                        {/* 1b. Query IR Explainability Panel */}
                        {activeQueryResult.queryIR && (
                          <FeatureErrorBoundary featureName="Query IR Panel">
                            <QueryIRPanel ir={activeQueryResult.queryIR} />
                          </FeatureErrorBoundary>
                        )}

                        {/* 2. Visualization */}
                        {activeQueryResult.chartConfig && (
                          <FeatureErrorBoundary featureName="Interactive Chart">
                            <SmartChart
                              data={activeQueryResult.rows}
                              config={activeQueryResult.chartConfig}
                              onPinToDashboard={handlePinToDashboard}
                              isPinned={isCurrentChartPinned}
                            />
                          </FeatureErrorBoundary>
                        )}

                        {/* 3. Key Insights Banner */}
                        <FeatureErrorBoundary featureName="Business Insights">
                          <InsightsBanner
                            insights={activeQueryResult.businessInsights}
                            stats={activeQueryResult.deterministicStats}
                            rowCount={activeQueryResult.rows?.length}
                          />
                        </FeatureErrorBoundary>

                        {/* 4. SQL Execution Results Table */}
                        <FeatureErrorBoundary featureName="QueryResult Table">
                          <QueryResultTable
                            rows={activeQueryResult.rows}
                            columns={activeQueryResult.columns}
                            executionTimeMs={activeQueryResult.executionTimeMs}
                          />
                        </FeatureErrorBoundary>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'dashboard' && (
                  <FeatureErrorBoundary featureName="Executive Dashboard">
                    <DashboardView
                      pinnedItems={activePinnedItems}
                      onRemovePinned={handleRemovePinned}
                      activeDataset={activeDataset}
                      onNavigateToExplorer={() => setActiveTab('query')}
                      onOpenUpload={() => setUploadModalOpen(true)}
                      onGoToQuery={() => setActiveTab('query')}
                    />
                  </FeatureErrorBoundary>
                )}

                {activeTab === 'schema' && (
                  <FeatureErrorBoundary featureName="Database Intelligence">
                    <SchemaViewer
                      dataset={activeDataset}
                      allDatasets={datasets}
                      onSelectDataset={handleSelectDataset}
                      onAskQuestion={handleAskQuestion}
                    />
                  </FeatureErrorBoundary>
                )}

                {activeTab === 'history' && (
                  <FeatureErrorBoundary featureName="Query History Audit">
                    <QueryHistoryView
                      history={history}
                      onClearHistory={handleClearHistory}
                      onRerunQuery={(item) => {
                        const ds = datasets.find((d) => d.id === item.datasetId) || activeDataset;
                        setActiveTab('query');
                        executeQuery(item.userQuery, ds);
                      }}
                    />
                  </FeatureErrorBoundary>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Universal Data Connector Modal */}
      <UniversalConnectorModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onDatasetsCreated={handleDatasetsCreated}
      />

      {/* Workspace Project Switcher Modal */}
      <ProjectSwitcherModal
        isOpen={projectSwitcherOpen}
        onClose={() => setProjectSwitcherOpen(false)}
      />

      {/* Auth Modals */}
      {authModalMode === 'login' && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <LoginPage
            onSwitchToRegister={() => setAuthModalMode('register')}
            onContinueAsGuest={() => {
              setAuthModalMode(null);
              setShowLanding(false);
            }}
          />
        </div>
      )}

      {authModalMode === 'register' && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <RegisterPage
            onSwitchToLogin={() => setAuthModalMode('login')}
            onContinueAsGuest={() => {
              setAuthModalMode(null);
              setShowLanding(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceInner />
    </AuthProvider>
  );
}
