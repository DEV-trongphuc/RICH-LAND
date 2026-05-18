import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-16 h-16 mb-4 text-red-500 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Đã xảy ra lỗi hệ thống</h2>
          <p className="text-gray-500 mb-6 max-w-md">
            Chúng tôi xin lỗi vì sự bất tiện này. Lỗi đã được ghi nhận. Vui lòng tải lại trang hoặc quay về trang chủ.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Tải lại trang
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Về trang chủ
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <div className="mt-8 p-4 bg-red-50 rounded text-left w-full overflow-auto max-h-64 border border-red-100">
              <p className="text-red-800 font-mono text-sm whitespace-pre-wrap">
                {this.state.error.toString()}
              </p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
