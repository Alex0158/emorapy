/**
 * 錯誤邊界組件
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import ErrorFallback from './ErrorFallback';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 錯誤邊界捕獲的錯誤需要始終記錄（用於調試）
    // 但生產環境應發送到錯誤追蹤服務（如Sentry）
    if (import.meta.env.DEV) {
    console.error('Error caught by boundary:', error, errorInfo);
    }
    // 生產環境發送到錯誤追蹤服務
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      // import * as Sentry from '@sentry/react';
      // Sentry.captureException(error, { contexts: { react: errorInfo } });
    }
  }

  private resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error || undefined} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

