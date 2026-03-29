import { useState, useRef, useEffect } from 'react';
import './InputBar.css';

export default function InputBar({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleInput = (e) => {
    setValue(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  return (
    <div className="input-bar">
      <div className={`input-wrapper ${disabled ? 'input-disabled' : ''}`}>
        <textarea
          ref={textareaRef}
          className="input-textarea"
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'JarvisV1 is thinking...' : 'Message JarvisV1  ⏎ to send, Shift+⏎ for newline'}
          disabled={disabled}
          rows={1}
        />
        <button
          className={`send-btn ${value.trim() && !disabled ? 'send-active' : ''}`}
          onClick={handleSend}
          disabled={!value.trim() || disabled}
        >
          <SendIcon />
        </button>
      </div>
      <div className="input-hint">
        <span>Claude Sonnet 4.6</span>
        <span>·</span>
        <span>OpenClaw Gateway</span>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
