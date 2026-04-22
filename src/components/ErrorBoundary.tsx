import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button, Result } from "antd";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Antygraviti ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-background p-6">
          <Result
            status="error"
            title="Deslize Semântico no React"
            subTitle={
              <div className="space-y-4">
                <p>Ocorreu um erro inesperado na interface do Googlar Dashboard.</p>
                <div className="p-4 bg-zinc-900 rounded-lg text-left overflow-auto max-h-[200px]">
                    <code className="text-xs text-red-400 font-mono">
                        {this.state.error?.toString()}
                    </code>
                </div>
              </div>
            }
            extra={[
              <Button 
                type="primary" 
                key="reload" 
                onClick={() => window.location.reload()}
                className="btn-bw-inverse !border-none h-12 px-8 font-black uppercase tracking-widest"
              >
                Recarregar Dashboard
              </Button>,
              <Button 
                key="home" 
                onClick={() => {
                    localStorage.clear();
                    window.location.href = '/';
                }}
                className="h-12 px-8 font-bold text-zinc-500"
              >
                Limpar Cache e Sair
              </Button>
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
