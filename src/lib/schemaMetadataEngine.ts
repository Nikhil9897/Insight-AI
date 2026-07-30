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

export type EntityClass = 'core' | 'transaction' | 'reference' | 'junction' | 'unknown';
export type Cardinality = '1:1' | '1:∞' | '∞:∞';

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
  entityClass: EntityClass;
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
  cardinality: Cardinality;
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
  healthScore: number;
  healthDetails: HealthDetail[];
  smartQuestions: string[];
  totalRows: number;
  pkCount: number;
  fkCount: number;
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

// ── Entity Classification ──────────────────────────────────────────────────────

function classifyTableEntity(table: SchemaTable, allRelationships: SchemaRelationship[]): EntityClass {
  const fkCount = table.foreignKeys.length;
  const hasDates = table.dateCols.length > 0;
  const hasNumerics = table.numericCols.length > 0;

  const nonFkNonPkCols = table.columns.filter(c => !c.isPrimaryKey && !c.isForeignKey).length;
  if (fkCount >= 2 && nonFkNonPkCols <= 3 && table.columns.length <= fkCount + 3) {
    return 'junction';
  }

  if (fkCount === 0 && table.rowCount <= 200 && table.categoricalCols.length > table.numericCols.length) {
    return 'reference';
  }

  if (hasDates && fkCount >= 1 && hasNumerics) {
    return 'transaction';
  }

  const referencedByCount = allRelationships.filter(r => r.toTable === table.name).length;
  if (referencedByCount >= 2 && fkCount <= 1) {
    return 'core';
  }

  if (hasDates && fkCount >= 1) {
    return 'transaction';
  }

  return 'unknown';
}

// ── Cardinality Inference ──────────────────────────────────────────────────────

function inferCardinality(
  fromTable: string,
  fromColumn: string,
  toTable: string,
  toColumn: string,
  allTables: SchemaTable[],
): Cardinality {
  const from = allTables.find(t => t.name === fromTable);
  const to = allTables.find(t => t.name === toTable);
  if (!from || !to) return '1:∞';
  const fromIsPk = from.primaryKeys.includes(fromColumn);
  const toIsPk = to.primaryKeys.includes(toColumn);
  if (fromIsPk && toIsPk) return '1:1';
  if (toIsPk) return '1:∞';
  return '∞:∞';
}

// ── Smart Question Generator ───────────────────────────────────────────────────

function generateSmartQuestions(tables: SchemaTable[], relationships: SchemaRelationship[]): string[] {
  const questions: string[] = [];

  const coreTables = tables.filter(t => t.entityClass === 'core');
  const transactionTables = tables.filter(t => t.entityClass === 'transaction');
  const referenceTables = tables.filter(t => t.entityClass === 'reference');

  const bestNumeric = (t: SchemaTable) =>
    t.numericCols.find(c => !c.isPrimaryKey && !c.isForeignKey) || t.numericCols[0];
  const bestCategorical = (t: SchemaTable) =>
    t.categoricalCols.find(c => !c.isPrimaryKey && !c.isForeignKey) || t.categoricalCols[0];
  const bestDate = (t: SchemaTable) => t.dateCols[0];

  for (const txTable of transactionTables.slice(0, 2)) {
    const numCol = bestNumeric(txTable);
    const dateCol = bestDate(txTable);
    if (numCol) {
      questions.push(`Show total ${numCol.name} from ${txTable.name}`);
      questions.push(`What is the average ${numCol.name} across all ${txTable.name}?`);
    }
    if (dateCol && numCol) {
      questions.push(`Monthly trend of ${numCol.name} over time`);
    }
    for (const rel of relationships) {
      if (rel.fromTable === txTable.name) {
        const parentTable = tables.find(t => t.name === rel.toTable);
        const parentCat = parentTable ? bestCategorical(parentTable) : null;
        if (parentTable && numCol && parentCat) {
          questions.push(`Show total ${numCol.name} by ${parentCat.name}`);
          questions.push(`Top 10 ${parentTable.name} by total ${numCol.name}`);
        }
      }
    }
  }

  for (const coreTable of coreTables.slice(0, 2)) {
    const catCol = bestCategorical(coreTable);
    const numCol = bestNumeric(coreTable);
    if (catCol) questions.push(`List all ${coreTable.name} sorted by ${catCol.name}`);
    if (numCol) questions.push(`Show ${coreTable.name} where ${numCol.name} is below average`);
  }

  for (const refTable of referenceTables.slice(0, 1)) {
    const catCol = bestCategorical(refTable);
    if (catCol) questions.push(`Count records grouped by ${catCol.name}`);
  }

  const sortedByRows = [...tables].sort((a, b) => b.rowCount - a.rowCount);
  for (const table of sortedByRows.slice(0, 3)) {
    const numCol = bestNumeric(table);
    const catCol = bestCategorical(table);
    if (numCol && catCol && !questions.some(q => q.includes(table.name))) {
      questions.push(`Show ${numCol.name} grouped by ${catCol.name} in ${table.name}`);
    }
    if (numCol && !questions.some(q => q.includes('Top 10') && q.includes(table.name))) {
      questions.push(`Top 10 rows in ${table.name} by ${numCol.name}`);
    }
  }

  return [...new Set(questions)].slice(0, 10);
}

// ── Health Score ───────────────────────────────────────────────────────────────

function computeHealthScore(tables: SchemaTable[], relationships: SchemaRelationship[]): {
  score: number;
  details: HealthDetail[];
} {
  const details: HealthDetail[] = [];
  let score = 100;

  const tablesWithPk = tables.filter(t => t.primaryKeys.length > 0).length;
  const pkCoverage = tables.length > 0 ? tablesWithPk / tables.length : 1;
  score -= Math.round((1 - pkCoverage) * 25);
  details.push({
    label: pkCoverage === 1 ? 'Primary Keys Detected' : 'Missing Primary Keys',
    status: pkCoverage === 1 ? 'pass' : pkCoverage >= 0.7 ? 'warn' : 'fail',
    detail: `${tablesWithPk} of ${tables.length} tables have primary keys defined.`,
  });

  const allTableNames = new Set(tables.map(t => t.name));
  const validFks = relationships.filter(r => allTableNames.has(r.toTable)).length;
  const fkIntegrity = relationships.length > 0 ? validFks / relationships.length : 1;
  score -= Math.round((1 - fkIntegrity) * 20);
  details.push({
    label: fkIntegrity === 1 ? 'Foreign Key Integrity Valid' : 'FK Reference Issues Detected',
    status: fkIntegrity === 1 ? 'pass' : fkIntegrity >= 0.8 ? 'warn' : 'fail',
    detail: relationships.length > 0
      ? `${validFks} of ${relationships.length} foreign key references resolve correctly.`
      : 'No foreign key relationships detected.',
  });

  const totalNullPct = tables.reduce((sum, t) => sum + t.missingValuePct, 0) / Math.max(tables.length, 1);
  score -= Math.round(Math.min(totalNullPct * 0.3, 30));
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
  score -= tables.length > 1 ? Math.round((1 - relCoverage) * 25) : 0;
  details.push({
    label: relCoverage > 0.5 ? 'Relationships Detected' : 'Sparse Relationship Graph',
    status: relCoverage > 0.7 ? 'pass' : relCoverage > 0.3 ? 'warn' : 'fail',
    detail: tables.length > 1
      ? `${connectedTables} of ${tables.length} tables participate in FK relationships.`
      : 'Single-table dataset — no relationships applicable.',
  });

  return { score: Math.max(0, Math.min(100, Math.round(score))), details };
}

// ── Memory Estimate ────────────────────────────────────────────────────────────

function estimateMemoryKB(table: { columns: any[]; rowCount: number }): number {
  return Math.round((table.columns.length * 50 * table.rowCount) / 1024);
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
      entityClass: 'unknown' as EntityClass,
      numericCols, categoricalCols, dateCols,
      memoryEstimateKB: estimateMemoryKB(t), missingValuePct: 0,
    };
  });

  const typedRelationships: SchemaRelationship[] = rawRels.map(r => ({
    fromTable: r.fromTable, fromColumn: r.fromColumn, toTable: r.toTable, toColumn: r.toColumn,
    cardinality: inferCardinality(r.fromTable, r.fromColumn, r.toTable, r.toColumn, partialTables),
    label: `${r.fromTable} → ${r.toTable}`,
  }));

  const typedTables = partialTables.map(t => ({ ...t, entityClass: classifyTableEntity(t, typedRelationships) }));
  const totalRows = typedTables.reduce((sum, t) => sum + t.rowCount, 0);
  const pkCount = typedTables.reduce((sum, t) => sum + t.primaryKeys.length, 0);
  const { score, details } = computeHealthScore(typedTables, typedRelationships);
  const smartQuestions = generateSmartQuestions(typedTables, typedRelationships);

  return {
    dbName: raw.dbName, dbType: raw.dbType, fileSizeBytes: raw.fileSizeBytes,
    tables: typedTables, relationships: typedRelationships,
    healthScore: score, healthDetails: details, smartQuestions,
    totalRows, pkCount, fkCount: typedRelationships.length,
  };
}

// ── Core Builder: from Dataset[] (CSV/Excel) ──────────────────────────────────

export function buildSchemaFromDatasets(datasets: Dataset[]): DatabaseSchema {
  if (!datasets || datasets.length === 0) {
    return {
      dbName: 'Workspace', dbType: 'csv',
      tables: [], relationships: [],
      healthScore: 0, healthDetails: [], smartQuestions: [],
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
      entityClass: 'unknown' as EntityClass,
      numericCols, categoricalCols, dateCols,
      memoryEstimateKB: estimateMemoryKB(t),
      missingValuePct: totalCells > 0 ? (totalNullCount / totalCells) * 100 : 0,
    };
  });

  const typedRelationships: SchemaRelationship[] = rawRels.map(r => ({
    fromTable: r.fromTable, fromColumn: r.fromColumn, toTable: r.toTable, toColumn: r.toColumn,
    cardinality: inferCardinality(r.fromTable, r.fromColumn, r.toTable, r.toColumn, partialTables),
    label: `${r.fromTable} → ${r.toTable}`,
  }));

  const typedTables = partialTables.map(t => ({ ...t, entityClass: classifyTableEntity(t, typedRelationships) }));
  const totalRows = typedTables.reduce((sum, t) => sum + t.rowCount, 0);
  const pkCount = typedTables.reduce((sum, t) => sum + t.primaryKeys.length, 0);
  const { score, details } = computeHealthScore(typedTables, typedRelationships);

  return {
    dbName: datasets.length === 1 ? datasets[0].name : 'Multi-table Workspace',
    dbType: 'csv', tables: typedTables, relationships: typedRelationships,
    healthScore: score, healthDetails: details,
    smartQuestions: generateSmartQuestions(typedTables, typedRelationships),
    totalRows, pkCount, fkCount: typedRelationships.length,
  };
}

// ── Utilities for UI Components ────────────────────────────────────────────────

export function groupTablesByEntity(tables: SchemaTable[]): Record<EntityClass, SchemaTable[]> {
  return {
    core: tables.filter(t => t.entityClass === 'core'),
    transaction: tables.filter(t => t.entityClass === 'transaction'),
    reference: tables.filter(t => t.entityClass === 'reference'),
    junction: tables.filter(t => t.entityClass === 'junction'),
    unknown: tables.filter(t => t.entityClass === 'unknown'),
  };
}

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

export const ENTITY_CLASS_COLORS: Record<EntityClass, { bg: string; text: string; border: string }> = {
  core:        { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200' },
  transaction: { bg: 'bg-violet-50',  text: 'text-violet-700', border: 'border-violet-200' },
  reference:   { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200' },
  junction:    { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
  unknown:     { bg: 'bg-slate-50',   text: 'text-slate-600',  border: 'border-slate-200' },
};

export const ENTITY_CLASS_LABELS: Record<EntityClass, string> = {
  core: 'Core Entity', transaction: 'Transaction',
  reference: 'Reference', junction: 'Junction', unknown: 'Table',
};

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

// ── Business Domain Catalog ────────────────────────────────────────────────────

export interface BusinessDomain {
  /** Domain name — derived from the most-connected core entity name */
  name: string;
  /** All tables assigned to this domain */
  tables: SchemaTable[];
  /** Color index for visual differentiation */
  colorIndex: number;
}

/**
 * Groups tables into semantic business domains using the FK relationship graph.
 *
 * Algorithm (fully schema-driven, no hardcoded domain names):
 * 1. Identify "anchor" tables (core entities that many others reference)
 * 2. Assign each non-anchor table to the anchor it most tightly connects to
 *    (measured by shortest FK hop distance)
 * 3. Name each domain after its anchor table
 * 4. Tables with no FK connections form a standalone domain named after themselves
 */
export function groupTablesByBusinessDomain(
  tables: SchemaTable[],
  relationships: SchemaRelationship[],
): BusinessDomain[] {
  if (tables.length === 0) return [];

  // Core entities and well-connected tables are domain anchors
  const anchors = tables.filter(
    t => t.entityClass === 'core' || t.entityClass === 'reference'
  );

  // If no anchors exist, every table becomes its own domain
  if (anchors.length === 0) {
    return tables.map((t, i) => ({ name: t.name, tables: [t], colorIndex: i }));
  }

  // BFS distance from each anchor to all other tables
  const distanceFrom = new Map<string, Map<string, number>>();

  for (const anchor of anchors) {
    const dist = new Map<string, number>();
    dist.set(anchor.name, 0);
    const queue = [anchor.name];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = dist.get(current)!;
      for (const rel of relationships) {
        const neighbor =
          rel.fromTable === current ? rel.toTable :
          rel.toTable === current ? rel.fromTable : null;
        if (neighbor && !dist.has(neighbor)) {
          dist.set(neighbor, currentDist + 1);
          queue.push(neighbor);
        }
      }
    }

    distanceFrom.set(anchor.name, dist);
  }

  // Assign each table to its closest anchor
  const domainMap = new Map<string, SchemaTable[]>();
  for (const anchor of anchors) domainMap.set(anchor.name, [anchor]);

  for (const table of tables) {
    if (anchors.some(a => a.name === table.name)) continue;

    let bestAnchor = anchors[0].name;
    let bestDist = Infinity;

    for (const anchor of anchors) {
      const dist = distanceFrom.get(anchor.name)?.get(table.name) ?? Infinity;
      if (dist < bestDist) { bestDist = dist; bestAnchor = anchor.name; }
    }

    if (bestDist === Infinity) {
      // Isolated table — standalone domain
      domainMap.set(table.name, [table]);
    } else {
      domainMap.get(bestAnchor)!.push(table);
    }
  }

  // Sort each domain: anchors first, then transactions, then junctions/unknowns
  const entityOrder: Record<EntityClass, number> = {
    core: 0, transaction: 1, reference: 2, junction: 3, unknown: 4,
  };

  const domains: BusinessDomain[] = [];
  let colorIdx = 0;

  for (const [anchorName, domainTables] of domainMap.entries()) {
    if (domainTables.length === 0) continue;
    const sorted = [...domainTables].sort(
      (a, b) => entityOrder[a.entityClass] - entityOrder[b.entityClass]
    );
    domains.push({ name: anchorName, tables: sorted, colorIndex: colorIdx++ });
  }

  // Sort domains by size (largest first)
  return domains.sort((a, b) => b.tables.length - a.tables.length);
}

/** Color palette for business domains */
export const DOMAIN_COLOR_PALETTE = [
  { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-500'},
  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
  { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200',   dot: 'bg-rose-500'   },
  { bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200',   dot: 'bg-cyan-500'   },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
];
