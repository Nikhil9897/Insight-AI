import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Database, Table, Key, Hash, Type, Calendar, ToggleLeft, Layers, Search,
  Network, Star, StarOff, ZoomIn, ZoomOut, Maximize2, RotateCcw,
  ArrowRight, Activity, Shield, ChevronDown, ChevronRight, Sparkles,
  GitBranch, CheckCircle2, AlertCircle, XCircle, Link2, Cpu,
} from 'lucide-react';
import { Dataset, ColumnProfile } from '../types';
import { Card } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import {
  buildSchemaFromDatasets,
  DatabaseSchema, SchemaTable, SchemaRelationship,
  getTableRelationships, formatFileSize,
} from '../lib/schemaMetadataEngine';

interface SchemaViewerProps {
  dataset?: Dataset | null;
  allDatasets?: Dataset[];
  onSelectDataset?: (id: string) => void;
  onAskQuestion?: (question: string) => void;
}

// ── SQL Type Icon ──────────────────────────────────────────────────────────────
const SqlTypeIcon: React.FC<{ sqlType: string; className?: string }> = ({ sqlType, className = 'h-3.5 w-3.5' }) => {
  const base = sqlType.split('(')[0].toUpperCase();
  if (['INTEGER','INT','BIGINT','FLOAT','DOUBLE','REAL','DECIMAL','NUMERIC','NUMBER','SMALLINT'].includes(base))
    return <Hash className={`${className} text-blue-600`} />;
  if (['DATE','DATETIME','TIMESTAMP','TIME','TIMESTAMPTZ','YEAR'].includes(base))
    return <Calendar className={`${className} text-purple-600`} />;
  if (base === 'BOOLEAN') return <ToggleLeft className={`${className} text-emerald-600`} />;
  return <Type className={`${className} text-slate-500`} />;
};

// ── Health Icon ────────────────────────────────────────────────────────────────
const HealthIcon: React.FC<{ status: 'pass' | 'warn' | 'fail' }> = ({ status }) => {
  if (status === 'pass') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  if (status === 'warn') return <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  return <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />;
};

// ── ERD Canvas ─────────────────────────────────────────────────────────────────
const ERD_W = 240;
const ERD_H = 190;

function layoutTables(tables: SchemaTable[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const cols = 5;
  const gapX = 280;
  const gapY = 230;
  tables.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[t.name] = { x: 60 + col * gapX, y: 40 + row * gapY };
  });
  return positions;
}

interface ErdCanvasProps {
  schema: DatabaseSchema;
  selectedTable: string | null;
  onSelectTable: (name: string | null) => void;
}

const ErdCanvas: React.FC<ErdCanvasProps> = ({ schema, selectedTable, onSelectTable }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState(() => layoutTables(schema.tables));
  const [zoom, setZoom] = useState(0.82);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [dragging, setDragging] = useState<{ table: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [panDrag, setPanDrag] = useState<{ sx: number; sy: number; op: { x: number; y: number } } | null>(null);

  useEffect(() => { setPositions(layoutTables(schema.tables)); setZoom(0.82); setPan({ x: 20, y: 20 }); }, [schema]);

  const connected = selectedTable
    ? new Set(schema.relationships.flatMap(r =>
        r.fromTable === selectedTable ? [r.toTable] : r.toTable === selectedTable ? [r.fromTable] : []
      ))
    : new Set<string>();

  const onCardDown = useCallback((e: React.MouseEvent, name: string) => {
    e.stopPropagation(); e.preventDefault();
    const p = positions[name];
    setDragging({ table: name, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y });
  }, [positions]);

  const onCardClick = useCallback((e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    onSelectTable(name === selectedTable ? null : name);
  }, [selectedTable, onSelectTable]);

  const onCanvasDown = (e: React.MouseEvent) => {
    if (dragging) return;
    setPanDrag({ sx: e.clientX, sy: e.clientY, op: pan });
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dragging) {
        const dx = (e.clientX - dragging.sx) / zoom;
        const dy = (e.clientY - dragging.sy) / zoom;
        setPositions(p => ({ ...p, [dragging.table]: { x: Math.max(0, dragging.ox + dx), y: Math.max(0, dragging.oy + dy) } }));
      } else if (panDrag) {
        setPan({ x: panDrag.op.x + e.clientX - panDrag.sx, y: panDrag.op.y + e.clientY - panDrag.sy });
      }
    };
    const up = () => { setDragging(null); setPanDrag(null); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragging, panDrag, zoom]);

  const fit = useCallback(() => {
    if (!containerRef.current || !schema.tables.length) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const xs = Object.values(positions).map(p => p.x);
    const ys = Object.values(positions).map(p => p.y);
    const cW = Math.max(...xs) + ERD_W - Math.min(...xs);
    const cH = Math.max(...ys) + ERD_H - Math.min(...ys);
    const z = Math.min((width - 80) / cW, (height - 80) / cH, 1.1);
    setZoom(Math.max(0.2, z));
    setPan({ x: (width - cW * z) / 2 - Math.min(...xs) * z, y: (height - cH * z) / 2 - Math.min(...ys) * z });
  }, [positions, schema.tables.length]);

  const bezier = (rel: SchemaRelationship) => {
    const f = positions[rel.fromTable]; const t = positions[rel.toTable];
    if (!f || !t) return '';
    const x1 = f.x + ERD_W / 2, y1 = f.y + ERD_H / 2;
    const x2 = t.x + ERD_W / 2, y2 = t.y + ERD_H / 2;
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  };

  const cW = Math.max(1500, ...Object.values(positions).map(p => p.x + ERD_W + 80));
  const cH = Math.max(800, ...Object.values(positions).map(p => p.y + ERD_H + 80));

  return (
    <div className="relative bg-[#f8f9fc] rounded-2xl border border-slate-200 overflow-hidden" style={{ height: 620 }}>
      {/* Controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/95 border border-slate-200 rounded-xl p-1.5 shadow-soft-sm backdrop-blur-sm">
        {[
          { icon: ZoomIn, action: () => setZoom(z => Math.min(z + 0.15, 2)), title: 'Zoom in' },
          { icon: ZoomOut, action: () => setZoom(z => Math.max(z - 0.15, 0.2)), title: 'Zoom out' },
        ].map(({ icon: Icon, action, title }) => (
          <button key={title} onClick={action} title={title} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <button onClick={fit} title="Fit to screen" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setPositions(layoutTables(schema.tables)); setZoom(0.82); setPan({ x: 20, y: 20 }); }} title="Reset" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <span className="text-[10px] font-bold text-slate-400 px-1">{Math.round(zoom * 100)}%</span>
      </div>


      {/* Canvas */}
      <div ref={containerRef} className="w-full h-full overflow-hidden" style={{ cursor: panDrag ? 'grabbing' : 'grab' }}
        onMouseDown={onCanvasDown} onClick={() => onSelectTable(null)}>
        <div style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: cW, height: cH, position: 'relative' }}>
          {/* SVG connectors */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: cW, height: cH, pointerEvents: 'none', zIndex: 0 }}>
            <defs>
              <marker id="arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                <polygon points="0 0, 7 2.5, 0 5" fill="#94a3b8" />
              </marker>
              <marker id="arr-active" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                <polygon points="0 0, 7 2.5, 0 5" fill="#2563eb" />
              </marker>
            </defs>
            {schema.relationships.map((rel, i) => {
              const path = bezier(rel);
              if (!path) return null;
              const active = rel.fromTable === selectedTable || rel.toTable === selectedTable;
              return (
                <path key={i} d={path} fill="none"
                  stroke={active ? '#2563eb' : '#cbd5e1'}
                  strokeWidth={active ? 2 : 1}
                  strokeDasharray={active ? undefined : '5,4'}
                  markerEnd={active ? 'url(#arr-active)' : 'url(#arr)'}
                  opacity={selectedTable && !active ? 0.2 : 1}
                  className={!active ? 'erd-connector' : ''}
                  style={{ transition: 'opacity 0.2s, stroke 0.2s' }}
                />
              );
            })}
          </svg>

          {/* Table cards */}
          {schema.tables.map(table => {
            const pos = positions[table.name] || { x: 0, y: 0 };
            const isSel = selectedTable === table.name;
            const isConn = connected.has(table.name);
            const dimmed = selectedTable && !isSel && !isConn;

            return (
              <div key={table.name}
                className={`erd-table-card absolute bg-white border-2 rounded-xl shadow-soft-sm ${isSel ? 'selected' : isConn ? 'connected' : 'border-slate-200'}`}
                style={{ left: pos.x, top: pos.y, width: ERD_W, zIndex: isSel ? 10 : 1, opacity: dimmed ? 0.3 : 1, transition: 'opacity 0.2s' }}
                onMouseDown={e => onCardDown(e, table.name)}
                onClick={e => onCardClick(e, table.name)}
              >
                {/* Header */}
                <div className={`px-2.5 py-2 rounded-t-xl border-b border-slate-100 flex items-center justify-between ${isSel ? 'bg-blue-50' : isConn ? 'bg-violet-50' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Table className={`h-3.5 w-3.5 shrink-0 ${isSel ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="text-[11px] font-bold text-slate-800 truncate">{table.name}</span>
                  </div>
                </div>

                {/* Columns */}
                <div className="px-2.5 py-2 space-y-1">
                  {table.columns.slice(0, 6).map((col, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                      <div className="flex items-center gap-1 min-w-0 pr-1">
                        {col.isPrimaryKey ? <Key className="h-2.5 w-2.5 text-amber-500 shrink-0" /> : <SqlTypeIcon sqlType={col.sqlType} className="h-2.5 w-2.5" />}
                        <span className={`truncate ${col.isPrimaryKey ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{col.name}</span>
                        {col.isPrimaryKey && <span className="text-[7px] bg-amber-100 text-amber-700 px-0.5 rounded shrink-0">PK</span>}
                        {col.isForeignKey && !col.isPrimaryKey && <span className="text-[7px] bg-violet-100 text-violet-700 px-0.5 rounded shrink-0">FK</span>}
                      </div>
                      <span className="text-[9px] text-slate-400 shrink-0">{col.sqlType.split('(')[0].substring(0, 7)}</span>
                    </div>
                  ))}
                  {table.columns.length > 6 && <div className="text-[9px] text-slate-400 pt-0.5">+{table.columns.length - 6} more</div>}
                </div>

                {/* Footer */}
                <div className="px-2.5 py-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-medium">
                  <span>{table.rowCount.toLocaleString()} rows</span>
                  <span>{table.columns.length} cols</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!schema.tables.length && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Network className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No tables to display</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const SchemaViewer: React.FC<SchemaViewerProps> = ({ dataset, allDatasets = [], onSelectDataset, onAskQuestion }) => {
  const [activeTab, setActiveTab] = useState<'schema' | 'erd'>('schema');
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [columnSearch, setColumnSearch] = useState('');
  const [showAllErdCols, setShowAllErdCols] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentTables, setRecentTables] = useState<string[]>([]);

  const schema: DatabaseSchema = React.useMemo(
    () => buildSchemaFromDatasets(allDatasets.length > 0 ? allDatasets : dataset ? [dataset] : []),
    [allDatasets, dataset]
  );

  const selectedSchemaTable: SchemaTable | null = React.useMemo(() => {
    if (selectedTableName) return schema.tables.find(t => t.name === selectedTableName) || null;
    if (dataset) return schema.tables.find(t => t.name === dataset.name) || schema.tables[0] || null;
    return schema.tables[0] || null;
  }, [selectedTableName, schema, dataset]);

  useEffect(() => {
    if (dataset && schema.tables.length > 0) {
      const match = schema.tables.find(t => t.name === dataset.name);
      setSelectedTableName(match?.name || schema.tables[0]?.name || null);
    }
  }, [dataset?.id]);

  const handleSelectTable = (name: string) => {
    setSelectedTableName(name);
    setRecentTables(prev => [name, ...prev.filter(n => n !== name)].slice(0, 3));
    const ds = allDatasets.find(d => d.name === name);
    if (ds && onSelectDataset) onSelectDataset(ds.id);
    setShowAllErdCols(false);
    setColumnSearch('');
  };

  const toggleFavorite = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };



  // Legacy getSqlType for original attribute dictionary
  const getSqlType = (col: ColumnProfile): string => {
    if (col.type === 'number') {
      const hasDecimals = col.sampleValues?.some(v => typeof v === 'number' && !Number.isInteger(v));
      return hasDecimals ? 'FLOAT' : 'INTEGER';
    }
    if (col.type === 'datetime') return 'TIMESTAMP';
    if (col.type === 'boolean') return 'BOOLEAN';
    const maxLen = col.sampleValues?.reduce<number>((acc, v) => Math.max(acc, String(v ?? '').length), 0) || 0;
    return maxLen > 255 ? 'TEXT' : 'VARCHAR';
  };

  if (!dataset || !dataset.summary || !dataset.summary.columns) {
    return (
      <EmptyState
        title="No Active Dataset Selected"
        description="Please select or upload a dataset to view its ERD relational model, column schema, and data types."
        icon={<Network className="h-8 w-8 text-blue-600" />}
      />
    );
  }


  const relInfo = selectedSchemaTable ? getTableRelationships(selectedSchemaTable.name, schema.relationships) : null;
  const activeDataset = allDatasets.find(d => d.name === selectedSchemaTable?.name) || dataset;
  const activeColumns = activeDataset?.summary?.columns || [];
  const filteredOrigCols = activeColumns.filter(c => c.name.toLowerCase().includes(columnSearch.toLowerCase()));
  const numCount = activeColumns.filter(c => c.type === 'number').length;
  const catCount = activeColumns.length - numCount;




  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── Banner ── */}
      <Card className="shadow-soft-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl shadow-soft-sm">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{schema.dbName} — Database Intelligence</h1>
              <p className="text-[11px] text-slate-400 font-medium">
                Schema-driven · Database-agnostic · Explainable · Scalable
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveTab('schema')}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${activeTab === 'schema' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Schema
          </button>
          <button onClick={() => setActiveTab('erd')}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${activeTab === 'erd' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <GitBranch className="h-3.5 w-3.5" />
            ER Diagram
          </button>
        </div>
      </Card>

      {/* ── Database Overview ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-soft-xs schema-panel-enter">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-900">Database Overview</span>
          <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase">{schema.dbType}</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {[
            { label: 'Tables', value: schema.tables.length },
            { label: 'Relationships', value: schema.relationships.length },
            { label: 'Primary Keys', value: schema.pkCount },
            { label: 'Foreign Keys', value: schema.fkCount },
            { label: 'Total Rows', value: schema.totalRows.toLocaleString() },
            { label: 'DB Size', value: formatFileSize(schema.fileSizeBytes) },
          ].map(m => (
            <div key={m.label} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-none mb-1">{m.label}</div>
              <div className="text-sm font-extrabold text-slate-900">{m.value}</div>
            </div>
          ))}
        </div>
      </div>





      {/* ── ER DIAGRAM TAB ── */}
      {activeTab === 'erd' && (
        <div className="space-y-4 schema-panel-enter">
          <ErdCanvas schema={schema} selectedTable={selectedTableName} onSelectTable={n => { if (n) handleSelectTable(n); else setSelectedTableName(null); }} />
          {selectedSchemaTable && relInfo && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Relationship Inspector */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-soft-xs schema-panel-enter">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900">Relationship Inspector — {selectedSchemaTable.name}</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Primary Key(s)</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedSchemaTable.primaryKeys.length > 0
                        ? selectedSchemaTable.primaryKeys.map(pk => (
                          <span key={pk} className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                            <Key className="h-2.5 w-2.5" />{pk}
                          </span>
                        ))
                        : <span className="text-slate-400 text-xs">None detected</span>}
                    </div>
                  </div>
                  {relInfo.references.map((rel, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
                      <span className="font-mono text-[10px] text-slate-700">{rel.fromColumn}</span>
                      <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="font-mono text-[10px] text-blue-700 font-bold">{rel.toTable}.{rel.toColumn}</span>
                    </div>
                  ))}
                  {relInfo.referencedBy.map((rel, i) => (
                    <div key={i} className="flex items-center gap-2 bg-violet-50 rounded-lg px-3 py-1.5 border border-violet-100">
                      <span className="font-mono text-[10px] text-violet-700 font-bold">{rel.fromTable}.{rel.fromColumn}</span>
                      <ArrowRight className="h-3 w-3 text-violet-400 shrink-0" />
                      <span className="font-mono text-[10px] text-slate-700">{rel.toColumn}</span>
                    </div>
                  ))}
                  {relInfo.references.length === 0 && relInfo.referencedBy.length === 0 && (
                    <p className="text-slate-400 text-center py-3 text-xs">No relationships for this table.</p>
                  )}
                </div>
              </div>

              {/* Table Statistics */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-soft-xs schema-panel-enter">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">Table Statistics</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Rows', value: selectedSchemaTable.rowCount.toLocaleString() },
                    { label: 'Columns', value: selectedSchemaTable.columns.length },
                    { label: 'Numeric', value: selectedSchemaTable.numericCols.length },
                    { label: 'Categorical', value: selectedSchemaTable.categoricalCols.length },
                    { label: 'Date Cols', value: selectedSchemaTable.dateCols.length },
                    { label: 'FK Refs', value: selectedSchemaTable.foreignKeys.length },
                    { label: 'Missing %', value: `${selectedSchemaTable.missingValuePct.toFixed(1)}%` },
                    { label: 'Memory Est.', value: `${selectedSchemaTable.memoryEstimateKB} KB` },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{s.label}</div>
                      <div className="font-extrabold text-slate-900 mt-0.5">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SCHEMA TAB ── */}
      {activeTab === 'schema' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Table Navigator */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-soft-xs space-y-3 schema-panel-enter">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Network className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-900">Table Navigator</span>
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{schema.tables.length}</span>
              </div>

              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input type="text" placeholder="Search tables..." value={tableSearch} onChange={e => setTableSearch(e.target.value)}
                  className="w-full bg-slate-50 text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium" />
              </div>

              {recentTables.length > 0 && !tableSearch && (
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 px-1">Recent</div>
                  {recentTables.map(name => (
                    <button key={name} onClick={() => handleSelectTable(name)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-all ${selectedSchemaTable?.name === name ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      {name}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {schema.tables
                  .filter(t => t.name.toLowerCase().includes(tableSearch.toLowerCase()))
                  .map(t => (
                    <button key={t.name} onClick={() => handleSelectTable(t.name)}
                      className={`group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-all ${selectedSchemaTable?.name === t.name ? 'bg-blue-50 border border-blue-200 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      <span className="flex-1 truncate font-medium">{t.name}</span>
                      <span className="text-[9px] text-slate-400">{t.rowCount.toLocaleString()}</span>
                      <button onClick={e => toggleFavorite(t.name, e)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {favorites.has(t.name) ? <Star className="h-3 w-3 text-amber-400 fill-amber-400" /> : <StarOff className="h-3 w-3 text-slate-300" />}
                      </button>
                    </button>
                ))}
              </div>
            </div>

            {/* Right column: Schema + Health + Questions */}
            <div className="lg:col-span-2 space-y-4">
              {selectedSchemaTable && (
                <>
                  {/* Dataset Schema Card (preserved) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-soft-xs space-y-4 schema-panel-enter">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-2">
                        <Network className="h-4 w-4 text-blue-600" />
                        <h2 className="text-sm font-bold text-slate-900">Dataset Schema</h2>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {schema.tables.length > 1 ? 'Multi-table Workspace' : 'Single-table dataset — no relationships detected'}
                      </span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col md:flex-row items-stretch justify-around gap-6">
                      {/* Entity Card */}
                      <div className="bg-white border-2 border-blue-500 rounded-xl p-4 shadow-soft-xs w-full md:w-80 flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                          <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm min-w-0 pr-2">
                            <Table className="h-4 w-4 text-blue-600 shrink-0" />
                            <span className="truncate">{selectedSchemaTable.name}</span>
                          </div>
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded shrink-0">TABLE</span>
                        </div>
                        <div className="space-y-2 text-xs max-h-80 overflow-y-auto pr-1">
                          {(showAllErdCols ? selectedSchemaTable.columns : selectedSchemaTable.columns.slice(0, 6)).map((col, idx) => (
                            <div key={idx} className="flex items-center justify-between font-mono text-[11px] text-slate-700">
                              <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                                {col.isPrimaryKey ? <Key className="h-3.5 w-3.5 text-amber-500 shrink-0" /> : <SqlTypeIcon sqlType={col.sqlType} className="h-3.5 w-3.5 shrink-0" />}
                                <span className={`truncate ${col.isPrimaryKey ? 'font-extrabold text-slate-900' : ''}`}>{col.name}</span>
                                {col.isPrimaryKey && <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1 rounded border border-amber-300 shrink-0">PRIMARY KEY</span>}
                                {col.isForeignKey && !col.isPrimaryKey && <span className="text-[9px] bg-violet-100 text-violet-700 font-extrabold px-1 rounded border border-violet-300 shrink-0">FK</span>}
                              </div>
                              <span className="text-slate-500 text-[10px] font-sans font-bold shrink-0 ml-2">{col.sqlType.split('(')[0]}</span>
                            </div>
                          ))}
                          {selectedSchemaTable.columns.length > 6 && (
                            <button onClick={() => setShowAllErdCols(!showAllErdCols)}
                              className="w-full text-[10px] text-blue-600 hover:text-blue-800 font-bold pt-1.5 hover:underline text-center">
                              {showAllErdCols ? 'Collapse attributes' : `+ ${selectedSchemaTable.columns.length - 6} more attributes`}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Metrics Card */}
                      <div className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-soft-xs w-full md:w-80 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                          <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                            <Layers className="h-4 w-4 text-blue-600" />
                            <span>Schema Overview Summary</span>
                          </div>
                          <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">METRICS</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          {[
                            { label: 'Primary Key', value: selectedSchemaTable.primaryKeys[0] || 'N/A', icon: <Key className="h-3 w-3 text-amber-500 shrink-0" /> },
                            { label: 'Columns', value: String(selectedSchemaTable.columns.length) },
                            { label: 'Numeric', value: String(numCount) },
                            { label: 'Categorical', value: String(catCount) },
                            { label: 'Date Cols', value: String(selectedSchemaTable.dateCols.length) },
                            { label: 'Missing %', value: `${selectedSchemaTable.missingValuePct.toFixed(1)}%` },
                          ].map(m => (
                            <div key={m.label} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{m.label}</div>
                              <div className="font-extrabold text-slate-900 truncate mt-0.5 flex items-center gap-1">
                                {m.icon}{m.value}
                              </div>
                            </div>
                          ))}
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 col-span-2">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Rows</div>
                            <div className="font-extrabold text-slate-900 mt-0.5">{selectedSchemaTable.rowCount.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Relationship Inspector */}
                  {relInfo && (relInfo.references.length > 0 || relInfo.referencedBy.length > 0) && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-soft-xs schema-panel-enter">
                      <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-3">
                        <Link2 className="h-4 w-4 text-blue-600" />
                        <h3 className="text-sm font-bold text-slate-900">Relationship Inspector</h3>
                        <span className="text-[10px] text-slate-400 font-medium">— {selectedSchemaTable.name}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {relInfo.references.length > 0 && (
                          <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">References (FK → Parent)</div>
                            <div className="space-y-1.5">
                              {relInfo.references.map((rel, i) => (
                                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 text-[11px]">
                                  <span className="font-mono text-slate-700">{rel.fromColumn}</span>
                                  <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span className="font-mono text-blue-700 font-bold">{rel.toTable}.{rel.toColumn}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {relInfo.referencedBy.length > 0 && (
                          <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Referenced By (Child Tables)</div>
                            <div className="space-y-1.5">
                              {relInfo.referencedBy.map((rel, i) => (
                                <div key={i} className="flex items-center gap-2 bg-violet-50 rounded-lg px-3 py-2 border border-violet-100 text-[11px]">
                                  <span className="font-mono text-violet-700 font-bold">{rel.fromTable}.{rel.fromColumn}</span>
                                  <ArrowRight className="h-3 w-3 text-violet-400 shrink-0" />
                                  <span className="font-mono text-slate-700">{rel.toColumn}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}


            </div>
          </div>

          {/* Smart Questions */}
          {schema.smartQuestions && schema.smartQuestions.length > 0 && onAskQuestion && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-soft-xs schema-panel-enter">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Smart Question Suggestions</h3>
                <span className="text-[10px] text-slate-400 font-medium">Auto-generated from strictly validated schema signals</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {schema.smartQuestions.map((q, i) => (
                  <button key={i} onClick={() => onAskQuestion(q)}
                    className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-blue-100 transition-all hover:shadow-soft-xs active:scale-95">
                    <Sparkles className="h-3 w-3 shrink-0" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Attribute Schema Dictionary (preserved) ── */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-soft-xs space-y-4 schema-panel-enter">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Attribute Schema Dictionary</h2>
                <p className="text-xs text-slate-500 font-medium">Explore SQL data types, distinct cardinality, and sample values</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input type="text" placeholder="Search column attribute..." value={columnSearch} onChange={e => setColumnSearch(e.target.value)}
                  className="w-full bg-slate-50 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium" />
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
                  {filteredOrigCols.map((col, idx) => {
                    const sqlType = getSqlType(col);
                    const pk = selectedSchemaTable?.primaryKeys.includes(col.name);
                    const fk = selectedSchemaTable?.foreignKeys.some(f => f.col === col.name);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            {pk && <Key className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                            <span className="font-mono">{col.name}</span>
                            {pk && <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded border border-amber-300 font-sans shrink-0">PRIMARY KEY</span>}
                            {fk && !pk && <span className="text-[9px] bg-violet-100 text-violet-700 font-extrabold px-1.5 py-0.5 rounded border border-violet-300 font-sans shrink-0">FK</span>}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-[10px] uppercase font-sans font-bold">
                            <SqlTypeIcon sqlType={sqlType} className="h-3 w-3" />
                            <span>{sqlType}</span>
                          </span>
                        </td>
                        <td className="p-3 text-slate-800 font-sans font-bold">{col.distinctCount.toLocaleString()}</td>
                        <td className="p-3 font-sans">
                          {col.nullCount > 0 ? <span className="text-amber-600 font-bold">{col.nullCount} missing</span> : <span className="text-emerald-600 font-bold">0 (Complete)</span>}
                        </td>
                        <td className="p-3 font-sans text-slate-500 max-w-xs truncate font-medium">
                          {(col.sampleValues || []).slice(0, 3).map(String).join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOrigCols.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400 font-sans text-xs">No columns match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
