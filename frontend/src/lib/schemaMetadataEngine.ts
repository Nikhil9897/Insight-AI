/**
 * Schema Metadata Engine
 *
 * A fully generic, database-agnostic engine that converts raw introspection data
 * (from PRAGMA, INFORMATION_SCHEMA, or column profiling) into a rich relational model.
 *
 * Works for any database: SQLite, PostgreSQL, MySQL, Northwind, Chinook, Sakila,
 * AdventureWorks, HR, Banking, Healthcare, Retail, or any user-uploaded dataset.
 *
 * Zero hardcoding of table names, column names, or domain assumptions.
 */

import { Dataset, ColumnProfile } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────



export interface SchemaColumn {
  name: string;
  sqlType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  distinctCount?: number;
  nullCount?: number;
  nullPct?: number;
  sampleValues?: any[];
}

export interface SchemaTable {
  name: string;
  rowCount: number;
  columns: SchemaColumn[];
  primaryKeys: string[];
  foreignKeys: { col: string; refTable: string; refCol: string }[];

  numericCols: SchemaColumn[];
  categoricalCols: SchemaColumn[];
  dateCols: SchemaColumn[];
  memoryEstimateKB: number;
  missingValuePct: number;
}

export interface SchemaRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;

  label: string;
}

export interface HealthDetail {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface DatabaseSchema {
  dbName: string;
  dbType: string;
  fileSizeBytes?: number;
  tables: SchemaTable[];
  relationships: SchemaRelationship[];
  healthDetails: HealthDetail[];
  totalRows: number;
  pkCount: number;
  fkCount: number;
  smartQuestions?: string[];
}

export interface RawSchemaColumn {
  name: string;
  sqlType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
}

export interface RawSchemaTable {
  name: string;
  rowCount: number;
  columns: RawSchemaColumn[];
  primaryKeys: string[];
}

export interface RawSchemaRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface RawSchemaResponse {
  dbName: string;
  dbType: string;
  fileSizeBytes?: number;
  tables: RawSchemaTable[];
  relationships: RawSchemaRelationship[];
}

// ── SQL Type Classification ────────────────────────────────────────────────────

const NUMERIC_SQL_TYPES = new Set([
  'INTEGER', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'FLOAT', 'DOUBLE', 'REAL', 'DECIMAL', 'NUMERIC', 'NUMBER',
  'DOUBLE PRECISION', 'MONEY', 'SMALLMONEY',
]);

const DATE_SQL_TYPES = new Set([
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'TIMESTAMPTZ',
  'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITHOUT TIME ZONE',
  'YEAR', 'INTERVAL',
]);

function isNumericSqlType(sqlType: string): boolean {
  const base = sqlType.split('(')[0].trim().toUpperCase();
  return NUMERIC_SQL_TYPES.has(base);
}

function isDateSqlType(sqlType: string): boolean {
  const base = sqlType.split('(')[0].trim().toUpperCase();
  return DATE_SQL_TYPES.has(base);
}

function isDateColByName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('date') || n.includes('time') || n.includes('year') ||
    n.includes('month') || n.includes('day') || n.includes('created') ||
    n.includes('updated') || n.includes('timestamp') || n.endsWith('at')
  );
}

// ── Health Score ───────────────────────────────────────────────────────────────

function computeDatabaseHealth(tables: SchemaTable[], relationships: SchemaRelationship[]): { details: HealthDetail[] } {
  const details: HealthDetail[] = [];

  const tablesWithPk = tables.filter(t => t.primaryKeys.length > 0).length;
  const pkCoverage = tables.length > 0 ? tablesWithPk / tables.length : 1;
  
  details.push({
    label: pkCoverage === 1 ? 'Primary Keys Detected' : 'Missing Primary Keys',
    status: pkCoverage === 1 ? 'pass' : pkCoverage >= 0.7 ? 'warn' : 'fail',
    detail: `${tablesWithPk} of ${tables.length} tables have primary keys defined.`,
  });

  const allTableNames = new Set(tables.map(t => t.name));
  const validFks = relationships.filter(r => allTableNames.has(r.toTable)).length;
  const fkIntegrity = relationships.length > 0 ? validFks / relationships.length : 1;
  
  details.push({
    label: fkIntegrity === 1 ? 'Foreign Key Integrity Valid' : 'FK Reference Issues Detected',
    status: fkIntegrity === 1 ? 'pass' : fkIntegrity >= 0.8 ? 'warn' : 'fail',
    detail: relationships.length > 0
      ? `${validFks} of ${relationships.length} foreign key references resolve correctly.`
      : 'No foreign key relationships detected.',
  });

  const totalNullPct = tables.reduce((sum, t) => sum + t.missingValuePct, 0) / Math.max(tables.length, 1);
  
  details.push({
    label: totalNullPct < 5 ? 'Low Missing Value Rate' : 'Missing Values Present',
    status: totalNullPct < 5 ? 'pass' : totalNullPct < 20 ? 'warn' : 'fail',
    detail: `Average missing value rate across tables: ${totalNullPct.toFixed(1)}%.`,
  });

  const connectedTables = new Set([
    ...relationships.map(r => r.fromTable),
    ...relationships.map(r => r.toTable),
  ]).size;
  const relCoverage = tables.length > 1 ? connectedTables / tables.length : 1;
  
  details.push({
    label: relCoverage > 0.5 ? 'Relationships Detected' : 'Sparse Relationship Graph',
    status: relCoverage > 0.7 ? 'pass' : relCoverage > 0.3 ? 'warn' : 'fail',
    detail: tables.length > 1
      ? `${connectedTables} of ${tables.length} tables participate in FK relationships.`
      : 'Single-table dataset — no relationships applicable.',
  });

  return { details };
}

// ── Memory Estimate ────────────────────────────────────────────────────────────

function estimateMemoryKB(table: { columns: any[]; rowCount: number }): number {
  return Math.round((table.columns.length * 50 * table.rowCount) / 1024);
}

export function generateSmartQuestions(tables: SchemaTable[], rels: SchemaRelationship[]): string[] {
  // Strict rules: Date exists, Measure exists, Join exists
  let hasDate = false;
  let hasMeasure = false;
  let measureColName = '';
  let measureTableName = '';
  let dateColName = '';
  
  for (const t of tables) {
    if (t.dateCols.length > 0) {
      hasDate = true;
      dateColName = t.dateCols[0].name;
    }
    if (t.numericCols.length > 0) {
      const measure = t.numericCols.find(c => !c.isPrimaryKey && !c.isForeignKey && !c.name.toLowerCase().includes('id'));
      if (measure) {
        hasMeasure = true;
        measureColName = measure.name;
        measureTableName = t.name;
      }
    }
  }

  const hasJoin = rels.length > 0;

  if (!hasDate || !hasMeasure || !hasJoin) {
    return [];
  }

  // Find a categorical column from a different table connected to the measure table
  let categoryName = '';
  let categoryTableName = '';
  const measureTableRels = rels.filter(r => r.fromTable === measureTableName || r.toTable === measureTableName);
  for (const rel of measureTableRels) {
    const otherTableName = rel.fromTable === measureTableName ? rel.toTable : rel.fromTable;
    const otherTable = tables.find(t => t.name === otherTableName);
    if (otherTable && otherTable.categoricalCols.length > 0) {
      const catCol = otherTable.categoricalCols.find(c => !c.isPrimaryKey && !c.isForeignKey && !c.name.toLowerCase().includes('id'));
      if (catCol) {
        categoryName = catCol.name;
        categoryTableName = otherTable.name;
        break;
      }
    }
  }

  const questions: string[] = [];
  questions.push(`Show total ${measureColName} over time by ${dateColName}`);
  
  if (categoryName && categoryTableName) {
    questions.push(`What is the total ${measureColName} broken down by ${categoryTableName} ${categoryName}?`);
    questions.push(`Show the top 10 ${categoryTableName} by total ${measureColName}`);
  }

  return questions;
}

// ── Heuristic FK Inference ─────────────────────────────────────────────────────

function inferRelationshipsFromColumnNames(tables: RawSchemaTable[]): RawSchemaRelationship[] {
  const inferred: RawSchemaRelationship[] = [];
  const seen = new Set<string>();

  for (const tableA of tables) {
    const pkCols = tableA.columns.filter(c => c.isPrimaryKey).map(c => c.name);
    const guessedPks = pkCols.length > 0
      ? pkCols
      : tableA.columns
          .filter(c => /^id$/i.test(c.name) || c.name.toLowerCase().endsWith('id'))
          .slice(0, 1)
          .map(c => c.name);

    for (const pk of guessedPks) {
      for (const tableB of tables) {
        if (tableB.name === tableA.name) continue;
        for (const col of tableB.columns) {
          if (col.name.toLowerCase() === pk.toLowerCase() && col.name !== col.name.replace(/id$/i, '')) {
            const key = `${tableB.name}.${col.name}->${tableA.name}.${pk}`;
            if (!seen.has(key)) {
              seen.add(key);
              inferred.push({ fromTable: tableB.name, fromColumn: col.name, toTable: tableA.name, toColumn: pk });
            }
          }
        }
      }
    }
  }

  return inferred;
}

// ── Core Builder: from backend response ───────────────────────────────────────

export function buildSchemaFromBackend(raw: RawSchemaResponse): DatabaseSchema {
  let rawRels = raw.relationships;
  if (rawRels.length === 0) rawRels = inferRelationshipsFromColumnNames(raw.tables);

  const partialTables: SchemaTable[] = raw.tables.map(t => {
    const numericCols = t.columns.filter(c => isNumericSqlType(c.sqlType) && !c.isPrimaryKey);
    const dateCols = t.columns.filter(c => isDateSqlType(c.sqlType) || isDateColByName(c.name));
    const categoricalCols = t.columns.filter(c => !numericCols.includes(c) && !dateCols.includes(c) && !c.isPrimaryKey);
    const fkDefs = rawRels.filter(r => r.fromTable === t.name).map(r => ({ col: r.fromColumn, refTable: r.toTable, refCol: r.toColumn }));

    return {
      name: t.name, rowCount: t.rowCount,
      columns: t.columns.map(c => ({ ...c, distinctCount: undefined, nullCount: undefined, nullPct: undefined, sampleValues: [] })),
      primaryKeys: t.primaryKeys, foreignKeys: fkDefs,
      
      numericCols, categoricalCols, dateCols,
      memoryEstimateKB: estimateMemoryKB(t), missingValuePct: 0,
    };
  });

  const typedRelationships: SchemaRelationship[] = rawRels.map(r => ({
    fromTable: r.fromTable, fromColumn: r.fromColumn, toTable: r.toTable, toColumn: r.toColumn,
    
    label: `${r.fromTable} → ${r.toTable}`,
  }));

  const typedTables = partialTables;
  const totalRows = typedTables.reduce((sum, t) => sum + t.rowCount, 0);
  const pkCount = typedTables.reduce((sum, t) => sum + t.primaryKeys.length, 0);
  const { details } = computeDatabaseHealth(typedTables, typedRelationships);
  return {
    dbName: raw.dbName, dbType: raw.dbType, fileSizeBytes: raw.fileSizeBytes,
    tables: typedTables, relationships: typedRelationships,
    healthDetails: details,
    totalRows, pkCount, fkCount: typedRelationships.length,
    smartQuestions: generateSmartQuestions(typedTables, typedRelationships),
  };
}

// ── Core Builder: from Dataset[] (CSV/Excel) ──────────────────────────────────

export function buildSchemaFromDatasets(datasets: Dataset[]): DatabaseSchema {
  if (!datasets || datasets.length === 0) {
    return {
      dbName: 'Workspace', dbType: 'csv',
      tables: [], relationships: [],
      healthDetails: [],
      totalRows: 0, pkCount: 0, fkCount: 0,
    };
  }

  const rawTables: RawSchemaTable[] = datasets.map(ds => {
    const cols: RawSchemaColumn[] = (ds.summary?.columns || []).map((col: ColumnProfile) => {
      let sqlType = 'TEXT';
      if (col.type === 'number') {
        const hasDecimals = (col.sampleValues || []).some(v => typeof v === 'number' && !Number.isInteger(v));
        sqlType = hasDecimals ? 'FLOAT' : 'INTEGER';
      } else if (col.type === 'datetime') sqlType = 'TIMESTAMP';
      else if (col.type === 'boolean') sqlType = 'BOOLEAN';
      else {
        const maxLen = (col.sampleValues || []).reduce((acc: number, v: any) => Math.max(acc, String(v ?? '').length), 0) as number;
        sqlType = maxLen > 255 ? 'TEXT' : 'VARCHAR';
      }
      const isPrimaryKey =
        col.distinctCount === ds.summary.rowCount ||
        /^id$/i.test(col.name) ||
        col.name.toLowerCase() === `${ds.name.toLowerCase().replace(/\s+/g, '')}id`;

      return { name: col.name, sqlType, isPrimaryKey, isForeignKey: false, isNullable: col.nullCount > 0 };
    });
    return {
      name: ds.name,
      rowCount: ds.summary?.rowCount || ds.data?.length || 0,
      columns: cols,
      primaryKeys: cols.filter(c => c.isPrimaryKey).map(c => c.name),
    };
  });

  const rawRels = inferRelationshipsFromColumnNames(rawTables);
  for (const rel of rawRels) {
    const table = rawTables.find(t => t.name === rel.fromTable);
    if (table) { const col = table.columns.find(c => c.name === rel.fromColumn); if (col) col.isForeignKey = true; }
  }

  const partialTables: SchemaTable[] = rawTables.map((t, idx) => {
    const ds = datasets[idx];
    const dsColumns: ColumnProfile[] = ds.summary?.columns || [];
    const columns: SchemaColumn[] = t.columns.map(rawCol => {
      const profile = dsColumns.find(p => p.name === rawCol.name);
      return {
        ...rawCol,
        distinctCount: profile?.distinctCount,
        nullCount: profile?.nullCount,
        nullPct: profile ? (profile.nullCount / Math.max(t.rowCount, 1)) * 100 : 0,
        sampleValues: profile?.sampleValues || [],
      };
    });
    const numericCols = columns.filter(c => (c.sqlType === 'INTEGER' || c.sqlType === 'FLOAT') && !c.isPrimaryKey);
    const dateCols = columns.filter(c => c.sqlType === 'TIMESTAMP' || isDateColByName(c.name));
    const categoricalCols = columns.filter(c => !numericCols.includes(c) && !dateCols.includes(c) && !c.isPrimaryKey);
    const totalNullCount = columns.reduce((sum, c) => sum + (c.nullCount || 0), 0);
    const totalCells = t.rowCount * Math.max(columns.length, 1);
    return {
      name: t.name, rowCount: t.rowCount, columns,
      primaryKeys: t.primaryKeys,
      foreignKeys: rawRels.filter(r => r.fromTable === t.name).map(r => ({ col: r.fromColumn, refTable: r.toTable, refCol: r.toColumn })),
      
      numericCols, categoricalCols, dateCols,
      memoryEstimateKB: estimateMemoryKB(t),
      missingValuePct: totalCells > 0 ? (totalNullCount / totalCells) * 100 : 0,
    };
  });

  const typedRelationships: SchemaRelationship[] = rawRels.map(r => ({
    fromTable: r.fromTable, fromColumn: r.fromColumn, toTable: r.toTable, toColumn: r.toColumn,
    
    label: `${r.fromTable} → ${r.toTable}`,
  }));

  const typedTables = partialTables;
  const totalRows = typedTables.reduce((sum, t) => sum + t.rowCount, 0);
  const pkCount = typedTables.reduce((sum, t) => sum + t.primaryKeys.length, 0);
  const { details } = computeDatabaseHealth(typedTables, typedRelationships);

  return {
    dbName: datasets.length === 1 ? datasets[0].name : 'Multi-table Workspace',
    dbType: 'csv', tables: typedTables, relationships: typedRelationships,
    healthDetails: details,
    totalRows, pkCount, fkCount: typedRelationships.length,
    smartQuestions: generateSmartQuestions(typedTables, typedRelationships),
  };
}

// ── Utilities for UI Components ────────────────────────────────────────────────

export function getTableRelationships(tableName: string, relationships: SchemaRelationship[]) {
  return {
    referencedBy: relationships.filter(r => r.toTable === tableName),
    references: relationships.filter(r => r.fromTable === tableName),
  };
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}



// ── Join Path Explorer ─────────────────────────────────────────────────────────

export interface JoinPathStep {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  stepIndex: number;
}

export interface JoinPath {
  steps: JoinPathStep[];
  tables: string[]; // ordered list: [start, ...intermediates, end]
  found: boolean;
}

/**
 * Finds the shortest FK join path between two tables using BFS over the
 * bidirectional relationship graph.
 *
 * Works for any schema — no table names are hardcoded.
 * Returns an ordered list of join steps that can be visually rendered.
 */
export function findJoinPath(
  fromTable: string,
  toTable: string,
  relationships: SchemaRelationship[],
): JoinPath {
  if (fromTable === toTable) {
    return { steps: [], tables: [fromTable], found: true };
  }

  // Build adjacency list (bidirectional — can traverse FK in either direction)
  const adj: Map<string, { neighbor: string; rel: SchemaRelationship; forward: boolean }[]> = new Map();
  for (const rel of relationships) {
    if (!adj.has(rel.fromTable)) adj.set(rel.fromTable, []);
    if (!adj.has(rel.toTable)) adj.set(rel.toTable, []);
    adj.get(rel.fromTable)!.push({ neighbor: rel.toTable, rel, forward: true });
    adj.get(rel.toTable)!.push({ neighbor: rel.fromTable, rel, forward: false });
  }

  // BFS
  const visited = new Set<string>([fromTable]);
  const queue: { table: string; path: { neighbor: string; rel: SchemaRelationship; forward: boolean }[] }[] = [
    { table: fromTable, path: [] },
  ];

  while (queue.length > 0) {
    const { table, path } = queue.shift()!;
    const neighbors = adj.get(table) || [];

    for (const edge of neighbors) {
      if (visited.has(edge.neighbor)) continue;
      visited.add(edge.neighbor);

      const newPath = [...path, edge];

      if (edge.neighbor === toTable) {
        // Reconstruct steps
        const steps: JoinPathStep[] = newPath.map((e, i) => ({
          fromTable: e.forward ? e.rel.fromTable : e.rel.toTable,
          fromColumn: e.forward ? e.rel.fromColumn : e.rel.toColumn,
          toTable: e.forward ? e.rel.toTable : e.rel.fromTable,
          toColumn: e.forward ? e.rel.toColumn : e.rel.fromColumn,
          stepIndex: i,
        }));
        const tables = [fromTable, ...steps.map(s => s.toTable)];
        return { steps, tables, found: true };
      }

      queue.push({ table: edge.neighbor, path: newPath });
    }
  }

  return { steps: [], tables: [], found: false };
}


