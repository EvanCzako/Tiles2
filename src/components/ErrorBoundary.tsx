import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  // Put the app back in a known-good state (reset the store, return to the menu).
  onReset: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Without this, a render-time throw leaves a blank tab with no way back — the
// game is a single client-side page, so there is nothing to navigate to and no
// server round-trip to recover on. Catching it keeps the persisted high score
// intact and offers one button back to the menu.
//
// Note the standard React limitation: this catches errors thrown while
// rendering, in lifecycle methods, and in constructors below it. It does NOT
// catch throws from setTimeout/requestAnimationFrame callbacks, which is where
// most of this app's logic runs (see the cascade in store/animations.ts).
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UNTILED crashed while rendering:', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="app crash-screen">
        <div className="crash-box">
          <h2 className="crash-title">Something broke</h2>
          <p className="crash-text">
            The board hit an unexpected error. Your best score is safe.
          </p>
          <pre className="crash-detail">{error.message}</pre>
          <button className="menu-btn menu-btn--primary" onClick={this.handleReset}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }
}
