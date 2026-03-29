import ReactMarkdown from 'react-markdown';
import './Message.css';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function UserMessage({ message }) {
  return (
    <div className="message message-user">
      <div className="message-meta">
        <span className="message-role user-role">IronBat</span>
        <span className="message-time">{formatTime(message.timestamp || Date.now())}</span>
      </div>
      <div className="message-content user-content">
        {message.content}
      </div>
    </div>
  );
}

export function AssistantMessage({ message }) {
  return (
    <div className="message message-assistant">
      <div className="message-meta">
        <span className="message-role assistant-role">JarvisV1</span>
        <span className="message-time">{formatTime(message.timestamp || Date.now())}</span>
      </div>
      <div className="message-content assistant-content">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}

export function StreamingMessage({ text }) {
  return (
    <div className="message message-assistant">
      <div className="message-meta">
        <span className="message-role assistant-role">JarvisV1</span>
        <span className="message-streaming-badge">● streaming</span>
      </div>
      <div className="message-content assistant-content">
        <ReactMarkdown>{text || ''}</ReactMarkdown>
        <span className="cursor-blink">▋</span>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="message message-assistant">
      <div className="message-meta">
        <span className="message-role assistant-role">JarvisV1</span>
      </div>
      <div className="typing-indicator">
        <span /><span /><span />
      </div>
    </div>
  );
}
