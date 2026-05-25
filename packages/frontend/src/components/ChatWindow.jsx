import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

function ChatWindow({ messages, isStreaming }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  return (
    <main className="chat-window">
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
