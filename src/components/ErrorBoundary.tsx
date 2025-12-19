import { Component, ReactNode } from 'react';
import { Button, Notice } from '@wordpress/components';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child components.
 * Displays a user-friendly error message with a retry option.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <Notice status="error" isDismissible={false}>
            <h2>Something went wrong</h2>
            <p>
              The application encountered an unexpected error. You can try again or reload the page.
            </p>
            {this.state.error && (
              <details>
                <summary>Error details</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
          </Notice>
          <div className="error-boundary-actions">
            <Button variant="primary" onClick={this.handleRetry}>
              Try Again
            </Button>
            <Button variant="secondary" onClick={this.handleReload}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
