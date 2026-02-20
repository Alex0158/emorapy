/**
 * 錯誤邊界組件
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import ErrorFallback from './ErrorFallback';
import { logger } from '@/utils/logger';

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
    logger.error('Error caught by boundary', {
      name: error?.name,
      message: error?.message,
      componentStack: errorInfo?.componentStack,
    });
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

