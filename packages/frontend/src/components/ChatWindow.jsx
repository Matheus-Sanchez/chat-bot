import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

function ChatWindow({ messages, isStreaming }) {
  const windowRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    const chatWindow = windowRef.current;
    if (!chatWindow || !endRef.current) return;

    const animationFrame = window.requestAnimationFrame(() => {
      chatWindow.scrollTop = chatWindow.scrollHeight;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [messages, isStreaming]);

  return (
    <main className="chat-window" ref={windowRef}>
      <div className="message-list">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            status={message.status}
            statusText={message.statusText}
          />
        ))}
        <div ref={endRef} />
      </div>
    </main>
  );
}

export default ChatWindow;
