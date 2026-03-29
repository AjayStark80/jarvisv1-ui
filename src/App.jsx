import { useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import InputBar from './components/InputBar';
import StatusBar from './components/StatusBar';
import { UserMessage, AssistantMessage, StreamingMessage, TypingIndicator } from './components/Message';
import { useChatStore } from './store/chatStore';
import { sendMessage, checkHealth } from './api/gateway';
import './App.css';

export default function App() {
  const {
    messages,
    sessionKey,
    isStreaming,
    streamingText,
    connectionStatus,
    setConnectionStatus,
    addMessage,
    startStreaming,
    appendToken,
    finishStreaming,
  } = useChatStore();

  const messagesEndRef = useRef(null);

  // Check gateway health on mount
  useEffect(() => {
    const check = async () => {
      setConnectionStatus('connecting');
      const ok = await checkHealth();
      setConnectionStatus(ok ? 'connected' : 'error');
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSend = useCallback(async (text) => {
    addMessage({ role: 'user', content: text, timestamp: new Date().toISOString() });
    startStreaming(sessionKey);

    await sendMessage({
      message: text,
      sessionKey,
      onToken: appendToken,
      onDone: finishStreaming,
      onError: (err) => {
        finishStreaming();
        addMessage({ role: 'assistant', content: `⚠️ Error: ${err}`, timestamp: new Date().toISOString() });
      },
    });
  }, [sessionKey, addMessage, startStreaming, appendToken, finishStreaming]);

  const showTyping = isStreaming && !streamingText;

  return (
    <div className="app">
      <Header connectionStatus={connectionStatus} />

      <div className="chat-area">
        {messages.length === 0 && !isStreaming && (
          <div className="empty-state">
            <div className="empty-logo">J</div>
            <div className="empty-title">JarvisV1 Online</div>
            <div className="empty-subtitle">What are we building today, IronBat?</div>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === 'user'
            ? <UserMessage key={msg.id} message={msg} />
            : <AssistantMessage key={msg.id} message={msg} />
        )}

        {showTyping && <TypingIndicator />}
        {isStreaming && streamingText && <StreamingMessage text={streamingText} />}

        <div ref={messagesEndRef} />
      </div>

      <InputBar onSend={handleSend} disabled={isStreaming} />
      <StatusBar messageCount={messages.length} sessionKey={sessionKey} />
    </div>
  );
}
