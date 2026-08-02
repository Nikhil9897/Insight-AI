import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Database, Sparkles } from 'lucide-react';
import { parseCSVData } from '../lib/dataProfiler';
import { Dataset } from '../types';

interface UploadDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatasetCreated: (dataset: Dataset) => void;
  sampleDatasets: Dataset[];
}

export const UploadDatasetModal: React.FC<UploadDatasetModalProps> = ({
  isOpen,
  onClose,
  onDatasetCreated,
  sampleDatasets,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setErrorMsg('Please upload a valid CSV formatted file (.csv).');
      return;
    }
    setErrorMsg(null);
    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const dataset = parseCSVData(text, file.name);
        onDatasetCreated(dataset);
        setIsProcessing(false);
        onClose();
      } catch (err: any) {
        setErrorMsg('Failed to parse CSV: ' + err.message);
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Error reading uploaded file.');
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Import Dataset</h2>
            <p className="text-sm text-slate-400">Upload custom CSV files or load structured sample datasets.</p>
          </div>
        </div>

        {/* Drag & Drop Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragOver
              ? 'border-indigo-500 bg-indigo-950/30'
              : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60'
          }`}
        >
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileInput}
            className="hidden"
            id="csv-file-input"
          />
          <label htmlFor="csv-file-input" className="cursor-pointer block">
            <FileText className="h-10 w-10 text-indigo-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-200 mb-1">
              Drag & Drop your CSV file here, or <span className="text-indigo-400 underline">Browse</span>
            </p>
            <p className="text-xs text-slate-400">Supports UTF-8 CSVs with column headers (Max 10MB)</p>
          </label>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isProcessing && (
          <div className="mt-4 p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/50 text-indigo-300 text-xs flex items-center space-x-2">
            <Sparkles className="h-4 w-4 animate-spin text-indigo-400" />
            <span>Parsing dataset and auto-inferring schema...</span>
          </div>
        )}

        {/* Pre-loaded Sample Datasets Quick Selection */}
        {sampleDatasets && sampleDatasets.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Or Load Pre-Packaged Enterprise Samples
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {sampleDatasets.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    onDatasetCreated(sample);
                    onClose();
                  }}
                  className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 text-left transition-all group"
                >
                  <div className="flex items-center space-x-2 mb-1.5">
                    <Database className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300" />
                    <span className="text-xs font-bold text-slate-200 truncate">{sample.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {sample.description}
                  </p>
                  <div className="mt-2 text-[10px] text-indigo-400 font-medium">
                    {sample.summary.rowCount} rows • {sample.summary.columnCount} columns
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
