import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

// This boundary must live OUTSIDE all providers and the router: errors during
// initial theme/query/session setup otherwise leave an empty #root forever.
class StartupErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('SecureAsset startup failed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#fff', color: '#17394b', fontFamily: 'Arial, sans-serif' }}>
        <section style={{ maxWidth: 460, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24 }}>Secure Asset</h1>
          <p>The application could not open this page. Your data has not been changed.</p>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: '12px 24px', border: 0, background: '#0B5270', color: 'white', cursor: 'pointer' }}>Reload application</button>
        </section>
      </main>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StartupErrorBoundary><App /></StartupErrorBoundary>
  </React.StrictMode>,
);
