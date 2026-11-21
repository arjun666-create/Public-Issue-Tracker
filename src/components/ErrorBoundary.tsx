import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Top-level React ErrorBoundary catching unexpected rendering failures
 * and offering a safe recovery action without exposing sensitive internals.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected interface error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('CivicResolve ErrorBoundary caught an error:', error, info.componentStack);
  }

  private handleRecover = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-screen items-center justify-center bg-[#060913] p-6 text-slate-100"
        >
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-red-500/40 bg-slate-900/90 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
              <h1 className="text-lg font-bold text-slate-100">
                CivicResolve Interface Recovery
              </h1>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              A component encountered an unexpected runtime error. Your stored tickets and SOP
              settings remain preserved.
            </p>
            <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-red-300">
              {this.state.errorMessage}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRecover}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Restore Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
