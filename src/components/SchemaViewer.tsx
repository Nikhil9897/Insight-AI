import React, { useState } from 'react';
import { Database, Table, Key, Hash, Type, Calendar, ToggleLeft, Layers, Search, Network } from 'lucide-react';
import { Dataset, ColumnProfile } from '../types';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';

interface SchemaViewerProps {
  dataset?: Dataset | null;
  allDatasets?: Dataset[];
  onSelectDataset?: (id: string) => void;
  onAskQuestion?: (question: string) => void;
}

export const SchemaViewer: React.FC<SchemaViewerProps> = ({
  dataset,
  allDatasets = [],
  onSelectDataset,
}) => {
  const [columnSearch, setColumnSearch] = useState('');
  const [showAllErdCols, setShowAllErdCols] = useState(false);

  if (!dataset || !dataset.summary || !dataset.summary.columns) {
    return (
      <EmptyState
        title="No Active Dataset Selected"
        description="Please select or upload a dataset to view its ERD relational model, column schema, and data types."
        icon={<Network className="h-8 w-8 text-blue-600" />}
      />
    );
  }

  const summary = dataset?.summary || {
    rowCount: dataset?.data?.length || 0,
    columnCount: dataset?.data?.[0] ? Object.keys(dataset.data[0]).length : 0,
    columns: dataset?.data?.[0] ? Object.keys(dataset.data[0]).map(k => ({ name: k, type: typeof dataset.data[0][k] === 'number' ? 'number' : 'string', nullCount: 0, distinctCount: 10, sampleValues: [] })) : [],
    missingCellsCount: 0,
    duplicateRowsCount: 0,
    healthScore: 100,
  };

  const columns = summary?.columns || [];
  const filteredColumns = columns.filter((col) =>
    col && col.name ? col.name.toLowerCase().includes(columnSearch.toLowerCase()) : false
  );

  const primaryKeyCol = columns.find(
    (c) => c && c.name && (c.name.toLowerCase().includes('id') || c.distinctCount === summary.rowCount)
  ) || columns[0];

  // Professional SQL Data Type Mapper
  const getSqlType = (col: ColumnProfile): string => {
    const nameLower = col.name.toLowerCase();

    if (col.type === 'number') {
      const hasDecimals = col.sampleValues?.some(
        (v) => typeof v === 'number' && !Number.isInteger(v)
      ) || nameLower.includes('age') || nameLower.includes('fare') || nameLower.includes('rate') || nameLower.includes('pct') || nameLower.includes('price') || nameLower.includes('score');

      return hasDecimals ? 'FLOAT' : 'INTEGER';
    }

    if (col.type === 'datetime') return 'TIMESTAMP';
    if (col.type === 'boolean') return 'BOOLEAN';

    const maxLen = col.sampleValues?.reduce<number>((acc, v) => Math.max(acc, String(v ?? '').length), 0) || 0;
    if (maxLen > 255) return 'TEXT';
    return 'VARCHAR';
  };

  const getTypeIcon = (type: string, sqlType: string) => {
    if (sqlType === 'INTEGER' || sqlType === 'FLOAT') {
      return <Hash className="h-3.5 w-3.5 text-blue-600" />;
    }
    if (sqlType === 'TIMESTAMP') {
      return <Calendar className="h-3.5 w-3.5 text-purple-600" />;
    }
    if (sqlType === 'BOOLEAN') {
      return <ToggleLeft className="h-3.5 w-3.5 text-emerald-600" />;
    }
    return <Type className="h-3.5 w-3.5 text-slate-600" />;
  };

  const numCount = columns.filter((c) => getSqlType(c) === 'INTEGER' || getSqlType(c) === 'FLOAT').length;
  const catCount = (dataset.summary.columnCount || columns.length) - numCount;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <Card className="shadow-soft-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <Database className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{dataset.name} Schema Explorer</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Detailed relational attribute schema, SQL data types, distinct cardinality, and primary key groundings.
          </p>
        </div>

        {/* Dataset Switcher Pills */}
        {allDatasets && allDatasets.length > 0 && (
          <div className="flex items-center space-x-2 overflow-x-auto">
            {allDatasets.map((ds) => (
              <Button
                key={ds.id}
                variant={ds.id === dataset.id ? 'primary' : 'outline'}
                size="sm"
                onClick={() => onSelectDataset && onSelectDataset(ds.id)}
              >
                {ds.name}
              </Button>
            ))}
          </div>
        )}
      </Card>

      {/* Dataset Schema Structure Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Network className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Dataset Schema</h2>
          </div>
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
            {allDatasets && allDatasets.length > 1 ? 'Multi-table Workspace' : 'Single-table dataset — no relationships detected'}
          </span>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col md:flex-row items-stretch justify-around gap-6">
          {/* Main Table Entity Card */}
          <div className="bg-white border-2 border-blue-500 rounded-xl p-4 shadow-xs w-full md:w-80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm min-w-0 pr-2">
                  <Table className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="truncate" title={dataset.name}>{dataset.name.replace(/\s+/g, '_')}</span>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded shrink-0">
                  TABLE
                </span>
              </div>

              <div className="space-y-2 text-xs max-h-80 overflow-y-auto pr-1">
                {(showAllErdCols ? dataset.summary.columns : dataset.summary.columns.slice(0, 6)).map((col, idx) => {
                  const sqlType = getSqlType(col);
                  const isPk = col.name === primaryKeyCol?.name;

                  return (
                    <div key={idx} className="flex items-center justify-between font-mono text-[11px] text-slate-700">
                      <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                        {isPk ? (
                          <Key className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <span className="shrink-0">{getTypeIcon(col.type, sqlType)}</span>
                        )}
                        <span className={`truncate ${isPk ? 'font-extrabold text-slate-900' : ''}`} title={col.name}>
                          {col.name}
                        </span>
                        {isPk && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1 py-0.2 rounded border border-amber-300 shrink-0">
                            PRIMARY KEY
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 text-[10px] font-sans font-bold shrink-0 ml-2">{sqlType}</span>
                    </div>
                  );
                })}
                {dataset.summary.columns.length > 6 && (
                  <button
                    onClick={() => setShowAllErdCols(!showAllErdCols)}
                    className="w-full text-[10px] text-blue-600 hover:text-blue-800 font-bold pt-1.5 hover:underline text-center flex items-center justify-center space-x-1"
                  >
                    <span>
                      {showAllErdCols
                        ? 'Collapse attributes'
                        : `+ ${dataset.summary.columns.length - 6} more attributes`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Schema Summary Metrics Card */}
          <div className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-xs w-full md:w-80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
              <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                <Layers className="h-4 w-4 text-blue-600" />
                <span>Schema Overview Summary</span>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">
                METRICS
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Primary Key</div>
                <div className="font-extrabold text-slate-900 truncate mt-0.5 flex items-center space-x-1">
                  <Key className="h-3 w-3 text-amber-500 shrink-0" />
                  <span className="truncate">{primaryKeyCol?.name || 'N/A'}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Columns</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{dataset.summary.columnCount}</div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Numeric</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{numCount}</div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Categorical</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{catCount}</div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 col-span-2">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Rows</div>
                <div className="font-extrabold text-slate-900 mt-0.5">{dataset.summary.rowCount.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Attribute Column Explorer Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Attribute Schema Dictionary</h2>
            <p className="text-xs text-slate-500 font-medium">Explore SQL data types, distinct cardinality, and sample values</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search column attribute..."
              value={columnSearch}
              onChange={(e) => setColumnSearch(e.target.value)}
              className="w-full bg-slate-50 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                <th className="p-3">Attribute Name</th>
                <th className="p-3">SQL Data Type</th>
                <th className="p-3">Distinct Values</th>
                <th className="p-3">Missing Cells</th>
                <th className="p-3">Sample Values</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredColumns.map((col, idx) => {
                const sqlType = getSqlType(col);
                const isPk = col.name === primaryKeyCol?.name;

                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-900 flex items-center space-x-2">
                      {isPk && (
                        <span title="Primary Key" className="inline-flex">
                          <Key className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        </span>
                      )}
                      <span className="font-mono">{col.name}</span>
                      {isPk && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded border border-amber-300 font-sans shrink-0">
                          PRIMARY KEY
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-[10px] uppercase font-sans font-bold shadow-2xs">
                        {getTypeIcon(col.type, sqlType)}
                        <span>{sqlType}</span>
                      </span>
                    </td>
                    <td className="p-3 text-slate-800 font-sans font-bold">{col.distinctCount.toLocaleString()}</td>
                    <td className="p-3 font-sans">
                      {col.nullCount > 0 ? (
                        <span className="text-amber-600 font-bold">{col.nullCount} missing</span>
                      ) : (
                        <span className="text-emerald-600 font-bold">0 (Complete)</span>
                      )}
                    </td>
                    <td className="p-3 font-sans text-slate-500 max-w-xs truncate font-medium">
                      {(col.sampleValues || []).slice(0, 3).map(String).join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
