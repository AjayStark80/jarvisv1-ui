import './Header.css';

export default function Header({ connectionStatus }) {
  const statusColor = {
    connected: 'var(--success)',
    connecting: 'var(--gold)',
    error: 'var(--error)',
    idle: 'var(--text-dim)',
  }[connectionStatus] || 'var(--text-dim)';

  const statusLabel = {
    connected: 'Online',
    connecting: 'Connecting...',
    error: 'Offline',
    idle: 'Idle',
  }[connectionStatus] || 'Idle';

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-j">J</span>
          <span className="logo-text">ARVIS</span>
          <span className="logo-v1">V1</span>
        </div>
        <div className="tagline">AI Engineering Aid</div>
      </div>

      <div className="header-center">
        <div className="header-divider" />
        <span className="header-label">IronBat × JarvisV1</span>
        <div className="header-divider" />
      </div>

      <div className="header-right">
        <div className="status-indicator">
          <span className="status-dot" style={{ background: statusColor }} />
          <span className="status-label">{statusLabel}</span>
        </div>
      </div>
    </header>
  );
}
