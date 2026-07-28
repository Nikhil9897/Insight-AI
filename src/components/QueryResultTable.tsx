import React, { useState } from 'react';
import { Download, Search, FileSpreadsheet, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import Papa from 'papaparse';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

interface QueryResultTableProps {
  rows: Record<string, any>[];
  columns: string[];
  executionTimeMs?: number;
}

export const QueryResultTable: React.FC<QueryResultTableProps> = ({
  rows,
  columns,
  executionTimeMs,
}) => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const rowsPerPage = 10;

  if (!rows || rows.length === 0) {
    return (
      <Card className="p-8 text-center text-slate-400 text-xs font-medium shadow-soft-sm">
        Query returned zero result rows.
      </Card>
    );
  }

  const actualColumns = columns && columns.length > 0 ? columns : Object.keys(rows[0] || {});

  const filteredRows = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const downloadCSV = () => {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `query_result_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSON = () => {
    const jsonStr = JSON.stringify(rows, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `query_result_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = () => {
    const tsv = [
      actualColumns.join('\t'),
      ...rows.map((r) => actualColumns.map((c) => r[c] ?? '').join('\t')),
    ].join('\n');
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="shadow-soft-sm space-y-4">
      {/* Table Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2.5">
          <h3 className="text-base font-black text-slate-900 tracking-tight">Query Execution Results</h3>
          <Badge variant="blue">{rows.length} records</Badge>
          {executionTimeMs !== undefined && (
            <Badge variant="emerald">⚡ {executionTimeMs}ms</Badge>
          )}
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search table rows..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 text-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all w-36 sm:w-48 font-medium"
            />
          </div>

          {/* Copy Table */}
          <Button
            variant="outline"
            size="sm"
            leftIcon={copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
            onClick={copyToClipboard}
          >
            {copied ? 'Copied' : 'Copy TSV'}
          </Button>

          {/* Export CSV */}
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Download className="h-3.5 w-3.5" />}
            onClick={downloadCSV}
          >
            Export CSV
          </Button>

          {/* Export JSON */}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />}
            onClick={downloadJSON}
          >
            JSON
          </Button>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-soft-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 uppercase tracking-wider font-extrabold border-b border-slate-200 text-[10px]">
              {actualColumns.map((col) => (
                <th key={col} className="py-3 px-3.5 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-xs">
            {paginatedRows.length > 0 ? (
              paginatedRows.map((row, idx) => {
                const rowKey = `row-${(currentPage - 1) * rowsPerPage + idx}`;
                return (
                  <tr key={rowKey} className="hover:bg-blue-50/40 transition-colors">
                    {actualColumns.map((col, colIdx) => {
                      const val = row[col];
                      const formattedVal = val !== null && val !== undefined
                        ? typeof val === 'number'
                          ? val.toLocaleString()
                          : typeof val === 'object'
                          ? JSON.stringify(val)
                          : String(val)
                        : null;

                      return (
                        <td key={`cell-${rowKey}-${colIdx}`} className="py-2.5 px-3.5 whitespace-nowrap max-w-[240px] truncate">
                          {formattedVal !== null ? (
                            <span>{formattedVal}</span>
                          ) : (
                            <span className="text-slate-300 font-sans italic text-[10px]">null</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={actualColumns.length} className="py-8 text-center text-slate-400 font-sans font-medium">
                  No matching query rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
        <div>
          Showing {paginatedRows.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to{' '}
          {Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length} rows
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="font-bold text-slate-700">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Card>
  );
};

