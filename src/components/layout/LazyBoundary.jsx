import { Component, Suspense } from 'react';

/**
 * Suspense + error boundary for lazily-loaded feature chunks. On a render/load error it shows
 * a small notice (with optional reset) instead of blanking the whole app.
 */
class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error, info) {
    console.error('[portal] feature failed to render', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallbackError ?? (
        <div role="alert" style={{ padding: 24, fontSize: 13.5, color: 'var(--muted)' }}>
          Something went wrong loading this section.{' '}
          {this.props.onReset && (
            <button type="button" onClick={this.props.onReset} style={{ border: 0, background: 'none', color: 'var(--primary)', fontWeight: 600, padding: 0 }}>
              Close
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function LazyBoundary({ children, fallback = null, resetKey, onReset, fallbackError }) {
  return (
    <Boundary resetKey={resetKey} onReset={onReset} fallbackError={fallbackError}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </Boundary>
  );
}
