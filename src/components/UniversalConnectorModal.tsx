import React, { useState } from 'react';
import {
  X,
  Upload,
  Database,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Server,
  Key,
  Layers,
  RefreshCw,
  HardDrive,
  Clock,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { parseCSVData } from '../lib/dataProfiler';
import { Dataset, ConnectorType } from '../types';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';

interface UniversalConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatasetsCreated: (datasets: Dataset[]) => void;
}

interface TableMeta {
  tableName: string;
  rowCount: number;
  columns: string[];
  columnCount: number;
}

export const UniversalConnectorModal: React.FC<UniversalConnectorModalProps> = ({
  isOpen,
  onClose,
  onDatasetsCreated,
}) => {
  const [selectedSource, setSelectedSource] = useState<ConnectorType>('csv');

  // File Upload State (CSV, Excel, SQLite)
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // DB Credential Form State (PostgreSQL, MySQL)
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState<string>('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Process / Connection States
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Introspection & Table Selection State
  const [discoveredTables, setDiscoveredTables] = useState<TableMeta[]>([]);
  const [selectedTableNames, setSelectedTableNames] = useState<string[]>([]);
  const [sqliteTmpPath, setSqliteTmpPath] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleSourceSelect = (type: ConnectorType) => {
    setSelectedSource(type);
    setConnectionSuccess(null);
    setErrorMsg(null);
    setDiscoveredTables([]);
    setSelectedTableNames([]);
    setUploadedFileName(null);
    if (type === 'postgres') setPort('5432');
    if (type === 'mysql') setPort('3306');
  };

  // CSV File Handler
  const handleCSVFile = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setErrorMsg('Please upload a valid CSV file (.csv).');
      return;
    }
    setErrorMsg(null);
    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const dataset = parseCSVData(text, file.name);
        onDatasetsCreated([dataset]);
        setIsImporting(false);
        onClose();
      } catch (err: any) {
        setErrorMsg('Failed to parse CSV: ' + err.message);
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  // Excel File Handler
  const handleExcelFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrorMsg('Please upload a valid Excel workbook (.xlsx, .xls).');
      return;
    }
    setErrorMsg(null);
    setIsImporting(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/connectors/upload-excel', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to process Excel workbook.');
      }

      const data = await res.json();
      const datasets: Dataset[] = data.datasets.map((ds: any) =>
        parseCSVData(
          // Convert JSON rows back to CSV string for uniform profiler schema generation
          [ds.columnNames.join(','), ...ds.data.map((r: any) => ds.columnNames.map((c: string) => JSON.stringify(r[c] ?? '')).join(','))].join('\n'),
          ds.name
        )
      );

      onDatasetsCreated(datasets);
      setIsImporting(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
      setIsImporting(false);
    }
  };

  // SQLite Database File Handler
  const handleSQLiteFile = async (file: File) => {
    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite') && !file.name.endsWith('.sqlite3')) {
      setErrorMsg('Please upload a valid SQLite database file (.db, .sqlite).');
      return;
    }
    setErrorMsg(null);
    setUploadedFileName(file.name);
    setIsTestingConnection(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/connectors/upload-sqlite', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to connect SQLite database.');
      }

      const data = await res.json();
      setSqliteTmpPath(data.tmpPath);
      setDiscoveredTables(data.tables || []);
      setSelectedTableNames((data.tables || []).map((t: TableMeta) => t.tableName));
      setConnectionSuccess(`✓ SQLite Connection Successful. Discovered ${data.tables.length} table(s).`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Test Connection for Relational Databases (PostgreSQL / MySQL)
  const handleTestDbConnection = async () => {
    if (!database.trim()) {
      setErrorMsg('Please enter a database name.');
      return;
    }
    setErrorMsg(null);
    setIsTestingConnection(true);
    setConnectionSuccess(null);

    try {
      const payload = {
        sourceType: selectedSource,
        host: host.trim() || 'localhost',
        port: parseInt(port) || (selectedSource === 'postgres' ? 5432 : 3306),
        database: database.trim(),
        username: username.trim() || undefined,
        password: password || undefined,
      };

      const testRes = await fetch('/api/connectors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!testRes.ok) {
        const errData = await testRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Database connection test failed.');
      }

      // Connection passed -> Introspect Schema
      const introspectRes = await fetch('/api/connectors/introspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const introData = await introspectRes.json();
      setDiscoveredTables(introData.tables || []);
      setSelectedTableNames((introData.tables || []).map((t: TableMeta) => t.tableName));
      setConnectionSuccess(`✓ ${selectedSource.toUpperCase()} Connection Successful! Discovered ${introData.tables.length} table(s). Password discarded for security.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Import Selected Tables
  const handleImportSelectedTables = async () => {
    if (selectedTableNames.length === 0) {
      setErrorMsg('Please select at least one table to import.');
      return;
    }

    setIsImporting(true);
    setErrorMsg(null);
    const importedDatasets: Dataset[] = [];

    try {
      for (const tableName of selectedTableNames) {
        let rows: Record<string, any>[] = [];

        if (selectedSource === 'sqlite' && sqliteTmpPath) {
          const res = await fetch('/api/connectors/import-sqlite-table', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tmpPath: sqliteTmpPath, tableName, limit: 10000 }),
          });
          const data = await res.json();
          rows = data.rows || [];
        } else {
          const res = await fetch('/api/connectors/import-table', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceType: selectedSource,
              tableName,
              host: host.trim() || 'localhost',
              port: parseInt(port) || (selectedSource === 'postgres' ? 5432 : 3306),
              database: database.trim(),
              username: username.trim() || undefined,
              password: password || undefined,
              limit: 10000,
            }),
          });
          const data = await res.json();
          rows = data.rows || [];
        }

        if (rows.length > 0) {
          const colNames = Object.keys(rows[0] || {});
          const csvText = [
            colNames.join(','),
            ...rows.map((r) => colNames.map((c) => JSON.stringify(r[c] ?? '')).join(',')),
          ].join('\n');

          const ds = parseCSVData(csvText, `${database ? database + ' • ' : ''}${tableName}`);
          importedDatasets.push(ds);
        }
      }

      if (importedDatasets.length > 0) {
        onDatasetsCreated(importedDatasets);
        setIsImporting(false);
        onClose();
      } else {
        throw new Error('Zero records were returned from the selected tables.');
      }
    } catch (err: any) {
      setErrorMsg('Error importing tables: ' + err.message);
      setIsImporting(false);
    }
  };

  const toggleTableSelection = (tableName: string) => {
    setSelectedTableNames((prev) =>
      prev.includes(tableName)
        ? prev.filter((t) => t !== tableName)
        : [...prev, tableName]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
      <div className="bg-white border border-slate-200/90 rounded-3xl max-w-3xl w-full p-7 shadow-soft-xl relative text-slate-900 animate-in fade-in zoom-in-95 duration-150 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-soft-xs">
              <Database className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Universal Data Connectors</h2>
                <Badge variant="blue">Enterprise</Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Connect external SQL databases, Excel workbooks, or CSV files directly into InsightAI.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* STEP 1: CHOOSE DATA SOURCE GRID */}
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
            1. Select Data Source Type
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {/* CSV */}
            <button
              onClick={() => handleSourceSelect('csv')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                selectedSource === 'csv'
                  ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 shadow-soft-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="p-1.5 rounded-xl bg-blue-100/70 text-blue-700 w-fit">
                <FileText className="h-4 w-4" />
              </div>
              <div className="text-xs font-bold text-slate-900">CSV File</div>
              <div className="text-[10px] text-slate-500">.csv, .txt</div>
            </button>

            {/* Excel */}
            <button
              onClick={() => handleSourceSelect('excel')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                selectedSource === 'excel'
                  ? 'bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-500/20 shadow-soft-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="p-1.5 rounded-xl bg-emerald-100/70 text-emerald-700 w-fit">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="text-xs font-bold text-slate-900">Excel</div>
              <div className="text-[10px] text-slate-500">.xlsx, .xls</div>
            </button>

            {/* SQLite */}
            <button
              onClick={() => handleSourceSelect('sqlite')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                selectedSource === 'sqlite'
                  ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-soft-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="p-1.5 rounded-xl bg-indigo-100/70 text-indigo-700 w-fit">
                <HardDrive className="h-4 w-4" />
              </div>
              <div className="text-xs font-bold text-slate-900">SQLite</div>
              <div className="text-[10px] text-slate-500">.db, .sqlite</div>
            </button>

            {/* PostgreSQL */}
            <button
              onClick={() => handleSourceSelect('postgres')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                selectedSource === 'postgres'
                  ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 shadow-soft-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="p-1.5 rounded-xl bg-blue-100/70 text-blue-700 w-fit">
                <Server className="h-4 w-4" />
              </div>
              <div className="text-xs font-bold text-slate-900">PostgreSQL</div>
              <div className="text-[10px] text-slate-500">Relational DB</div>
            </button>

            {/* MySQL */}
            <button
              onClick={() => handleSourceSelect('mysql')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                selectedSource === 'mysql'
                  ? 'bg-amber-50/90 border-amber-600 ring-2 ring-amber-500/20 shadow-soft-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="p-1.5 rounded-xl bg-amber-100/70 text-amber-700 w-fit">
                <Database className="h-4 w-4" />
              </div>
              <div className="text-xs font-bold text-slate-900">MySQL</div>
              <div className="text-[10px] text-slate-500">Relational DB</div>
            </button>
          </div>

          {/* Coming Soon Badges Row */}
          <div className="mt-3 flex items-center space-x-2 text-[10px] text-slate-400 font-medium flex-wrap gap-y-1">
            <span className="font-extrabold uppercase text-slate-500">Coming Soon:</span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">Snowflake</span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">BigQuery</span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">ClickHouse</span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">AWS S3 / Parquet</span>
          </div>
        </div>

        {/* STEP 2: CREDENTIALS FORM / FILE INPUT */}
        {(selectedSource === 'csv' || selectedSource === 'excel' || selectedSource === 'sqlite') ? (
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              2. Upload {selectedSource.toUpperCase()} Data File
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  const file = e.dataTransfer.files[0];
                  if (selectedSource === 'csv') handleCSVFile(file);
                  if (selectedSource === 'excel') handleExcelFile(file);
                  if (selectedSource === 'sqlite') handleSQLiteFile(file);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative ${
                dragOver
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-100/80'
              }`}
            >
              <input
                type="file"
                accept={
                  selectedSource === 'csv'
                    ? '.csv,.txt'
                    : selectedSource === 'excel'
                    ? '.xlsx,.xls'
                    : '.db,.sqlite,.sqlite3'
                }
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    if (selectedSource === 'csv') handleCSVFile(file);
                    if (selectedSource === 'excel') handleExcelFile(file);
                    if (selectedSource === 'sqlite') handleSQLiteFile(file);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Upload className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {uploadedFileName ? uploadedFileName : `Drag & drop your ${selectedSource.toUpperCase()} file here`}
              </h3>
              <p className="text-xs text-slate-500 mt-1">or click to browse local files</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              2. Enter {selectedSource.toUpperCase()} Connection Credentials
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Host / Server IP</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost or 192.168.1.100"
                  className="w-full bg-slate-50 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Port</label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder={selectedSource === 'postgres' ? '5432' : '3306'}
                  className="w-full bg-slate-50 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Database Name</label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="e.g. e_commerce"
                  className="w-full bg-slate-50 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={selectedSource === 'postgres' ? 'postgres' : 'root'}
                  className="w-full bg-slate-50 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500 font-semibold flex items-center space-x-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Zero Password Storage • Passwords used in-flight and discarded</span>
              </span>

              <Button
                variant="primary"
                size="sm"
                isLoading={isTestingConnection}
                disabled={isTestingConnection}
                onClick={handleTestDbConnection}
              >
                Test Connection & Introspect Schema
              </Button>
            </div>
          </div>
        )}

        {/* SUCCESS / ERROR CALLOUTS */}
        {connectionSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 shadow-soft-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{connectionSuccess}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2 shadow-soft-xs">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 4 & 5: SELECT TABLES & IMPORT */}
        {discoveredTables.length > 0 && (
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                3. Select Tables to Import Snapshot
              </div>
              <span className="text-xs text-slate-600 font-bold">
                {selectedTableNames.length} of {discoveredTables.length} tables selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
              {discoveredTables.map((t) => {
                const isSelected = selectedTableNames.includes(t.tableName);

                return (
                  <div
                    key={t.tableName}
                    onClick={() => toggleTableSelection(t.tableName)}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-300 font-bold text-slate-900 shadow-soft-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate" title={t.tableName}>{t.tableName}</div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {t.rowCount.toLocaleString()} rows • {t.columnCount} columns
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="md"
                isLoading={isImporting}
                disabled={isImporting || selectedTableNames.length === 0}
                rightIcon={<ArrowRight className="h-4 w-4" />}
                onClick={handleImportSelectedTables}
              >
                Import Selected Tables to Workspace
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
