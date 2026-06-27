import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { en } from '../utils/translations';

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
      const lang = localStorage.getItem('richland_lang') || 'vi';
      const t = (key: string) => {
        if (lang === 'vi') return key;
        return en[key] || key;
      };

      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-12 text-center bg-white rounded-2xl border border-gray-100 shadow-sm max-w-lg mx-auto mt-8">
          <div className="w-16 h-16 mb-6 text-red-500 bg-red-50 rounded-full flex items-center justify-center shadow-inner">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ color: 'var(--color-text)' }}>{t('Đã xảy ra lỗi hệ thống')}</h2>
          <p className="text-gray-500 mb-8 max-w-md" style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
            {t('Chúng tôi xin lỗi vì sự bất tiện này. Lỗi đã được ghi nhận. Vui lòng tải lại trang để tiếp tục.')}
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => window.location.reload()}
              className="btn primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 2rem', height: '46px', borderRadius: 'var(--radius-lg)' }}
            >
              <RefreshCw size={18} /> {t('Tải lại trang')}
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
