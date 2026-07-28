import React, { useState } from 'react';
import { X, Plus, FolderGit2, Check, ArrowRight, LayoutDashboard, Sparkles } from 'lucide-react';
import { useAuth, WorkspaceProject } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface ProjectSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectSwitcherModal: React.FC<ProjectSwitcherModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { projects, activeProjectId, switchProject, createProject } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectProject = async (id: string) => {
    await switchProject(id);
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      await createProject(newProjName.trim(), newProjDesc.trim() || undefined);
      setNewProjName('');
      setNewProjDesc('');
      setShowCreateForm(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
      <div className="bg-white border border-slate-200/90 rounded-3xl max-w-xl w-full p-6 shadow-soft-xl relative text-slate-900 animate-in fade-in zoom-in-95 duration-150 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-soft-xs">
              <FolderGit2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Workspace Projects</h2>
              <p className="text-xs text-slate-500 font-medium">Switch between or create dedicated analytics projects.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Existing Projects List */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {projects.map((p) => {
            const isActive = p.id === activeProjectId;

            return (
              <div
                key={p.id}
                onClick={() => handleSelectProject(p.id)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50/90 border-blue-300 shadow-soft-xs font-bold text-slate-900'
                    : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/80 text-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div className={`p-2 rounded-xl border ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                    <LayoutDashboard className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{p.description || 'Workspace analytics project'}</div>
                  </div>
                </div>

                {isActive && (
                  <Badge variant="blue" icon={<Check className="h-3 w-3" />}>
                    Active
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Create Project Form or CTA */}
        {showCreateForm ? (
          <form onSubmit={handleCreate} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-900">Create New Project</div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Project Name</label>
              <input
                type="text"
                required
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                placeholder="e.g. Sales Analytics, HR Reports, Marketing Dashboard"
                className="w-full bg-white text-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newProjDesc}
                onChange={(e) => setNewProjDesc(e.target.value)}
                placeholder="Brief project description..."
                className="w-full bg-white text-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-semibold"
              />
            </div>

            {error && <div className="text-xs text-rose-600 font-bold">{error}</div>}

            <div className="flex justify-end space-x-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isCreating}
                rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Create Project
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            size="md"
            className="w-full"
            leftIcon={<Plus className="h-4 w-4 text-blue-600" />}
            onClick={() => setShowCreateForm(true)}
          >
            Create New Project Workspace
          </Button>
        )}
      </div>
    </div>
  );
};
