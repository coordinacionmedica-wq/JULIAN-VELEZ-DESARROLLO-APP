import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 font-sans">
          <div className="bg-[#0e1a2e] border border-rose-500/30 p-8 rounded-[32px] max-w-md w-full shadow-2xl text-center">
            <div className="bg-rose-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
              <AlertCircle className="w-8 h-8 text-rose-500" />
            </div>
            <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Vaya, algo salió mal</h1>
            <p className="text-sky-200/60 text-sm mb-6">
              La aplicación ha encontrado un error inesperado. Por favor, intenta recargar la página.
            </p>
            
            {this.state.error && (
              <div className="bg-[#162840] p-4 rounded-xl mb-6 text-left border border-[#1a3050]">
                <p className="text-[10px] uppercase text-sky-500 font-bold mb-1">Detalle del error:</p>
                <code className="text-xs text-rose-300 font-mono break-all">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#00c8f0] text-[#030712] font-black h-12 rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" /> RECARGAR APLICACIÓN
            </button>
            <p className="text-[9px] text-slate-500 mt-4 uppercase tracking-widest font-bold">
              ESE ROLDANILLO - COORDINACIÓN MÉDICA
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
