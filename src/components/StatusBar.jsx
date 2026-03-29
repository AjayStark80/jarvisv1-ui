import './StatusBar.css';

export default function StatusBar({ messageCount, sessionKey }) {
  return (
    <div className="status-bar">
      <div className="status-items">
        <StatusItem label="Model" value="claude-sonnet-4-6" accent />
        <StatusDivider />
        <StatusItem label="Session" value={sessionKey ? sessionKey.slice(0, 16) + '…' : 'New'} />
        <StatusDivider />
        <StatusItem label="Messages" value={messageCount} />
        <StatusDivider />
        <StatusItem label="Gateway" value="127.0.0.1:18789" />
      </div>
      <div className="status-right">
        <span className="status-brand">JarvisV1 × IronBat</span>
      </div>
    </div>
  );
}

function StatusItem({ label, value, accent }) {
  return (
    <div className="status-item">
      <span className="status-item-label">{label}</span>
      <span className={`status-item-value ${accent ? 'status-accent' : ''}`}>{value}</span>
    </div>
  );
}

function StatusDivider() {
  return <span className="status-divider">·</span>;
}
