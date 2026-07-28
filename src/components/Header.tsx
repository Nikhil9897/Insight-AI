import React, { useState } from 'react';
import { Database, FileSpreadsheet, ChevronDown, Check, Upload, Trash2, Save, CheckCircle2 } from 'lucide-react';
import { Dataset } from '../types';
import { Button } from './ui/Button';
import { InsightLogo } from './ui/InsightLogo';
import { UserProfileMenu } from './auth/UserProfileMenu';

interface HeaderProps {
  activeTab: 'profiler' | 'query' | 'dashboard' | 'history' | 'schema';
  setActiveTab: (tab: 'profiler' | 'query' | 'dashboard' | 'history' | 'schema') => void;
  datasets: Dataset[];
  activeDataset: Dataset | null;
  onSelectDataset: (id: string) => void;
  onRemoveDataset: (id: string) => void;
  onOpenUpload: () => void;
  pinnedCount: number;
  onGoToLanding?: () => void;
  onOpenProjectSwitcher?: () => void;
  onOpenAuthModal?: () => void;
  onSaveProgress?: () => Promise<void>;
  isSaving?: boolean;
  lastSavedAt?: Date | null;
}

export const Header: React.FC<HeaderProps> = ({
  datasets,
  activeDataset,
  onSelectDataset,
  onRemoveDataset,
  onOpenUpload,
  onGoToLanding,
  onOpenProjectSwitcher,
  onOpenAuthModal,
  onSaveProgress,
  isSaving = false,
  lastSavedAt,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-14 glass-header flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left: Dataset picker */}
      <div className="flex items-center gap-3">
        {/* Logo (small, back link) */}
        <button
          onClick={onGoToLanding}
          className="cursor-pointer opacity-70 hover:opacity-100 transition-opacity mr-1 hidden md:block"
        >
          <InsightLogo size="sm" />
        </button>

        <div className="h-4 w-px bg-slate-200 hidden md:block" />

        {/* Dataset dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-slate-900 transition-colors cursor-pointer group"
          >
            <Database className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-[300px]">
              {activeDataset ? activeDataset.name : 'Select Dataset'}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 mt-2 w-80 bg-white border border-[#e5e5e5] rounded-xl shadow-soft-lg z-50 py-1.5 overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest border-b border-[#f0f0ef]">
                Active Datasets ({datasets.length})
              </div>

              <div className="max-h-60 overflow-y-auto py-1">
                {datasets.length > 0 ? (
                  datasets.map((ds) => (
                    <div
                      key={ds.id}
                      onClick={() => {
                        onSelectDataset(ds.id);
                        setDropdownOpen(false);
                      }}
                      className={`group px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${
                        activeDataset?.id === ds.id ? 'bg-blue-50/60 text-blue-700 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate mr-2">
                        <FileSpreadsheet className={`h-3.5 w-3.5 shrink-0 ${activeDataset?.id === ds.id ? 'text-blue-500' : 'text-slate-400'}`} />
                        <span className="truncate text-xs font-medium">{ds.name}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-medium text-slate-400">
                          {ds.summary.rowCount}r
                        </span>
                        {activeDataset?.id === ds.id && <Check className="h-3.5 w-3.5 text-blue-500" />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveDataset(ds.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">
                    No datasets loaded.
                  </div>
                )}
              </div>

              <div className="border-t border-[#f0f0ef] p-2">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenUpload();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Connect Data Source
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {onSaveProgress && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Save className={`h-3.5 w-3.5 ${isSaving ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />}
            onClick={onSaveProgress}
            disabled={isSaving}
            title={lastSavedAt ? `Last saved at ${lastSavedAt.toLocaleTimeString()}` : 'Save workspace progress'}
            className="hidden sm:flex"
          >
            {isSaving ? 'Saving...' : 'Save Progress'}
          </Button>
        )}

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Database className="h-3.5 w-3.5" />}
          onClick={onOpenUpload}
        >
          Connect Data Source
        </Button>

        <UserProfileMenu
          onOpenProjectSwitcher={onOpenProjectSwitcher}
          onOpenAuthModal={onOpenAuthModal}
          onSignOut={onGoToLanding}
          onSaveProgress={onSaveProgress}
        />
      </div>

      {/* Click-outside closer */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </header>
  );
};
