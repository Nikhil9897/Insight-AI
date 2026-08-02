import * as React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  featureName?: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FeatureErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[FeatureErrorBoundary:${this.props.featureName || 'Module'}] Error:`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white border border-rose-200/90 rounded-3xl p-6 shadow-soft-sm text-center space-y-3.5 my-4">
          <div className="w-10 h-10 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {this.props.featureName ? `${this.props.featureName} Notice` : 'Module Render Notice'}
            </h3>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
              This module encountered a temporary rendering state. Click reset below to recover.
            </p>
          </div>
          {this.state.error && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] font-mono text-rose-600 max-w-lg mx-auto overflow-x-auto">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset {this.props.featureName || 'Component'}</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
