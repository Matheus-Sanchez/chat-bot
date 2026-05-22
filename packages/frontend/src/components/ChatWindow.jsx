import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

function ChatWindow({ messages, isLoading }) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <main className="chat-window">
      {messages.map((msg, index) => (
        <MessageBubble key={index} role={msg.role} content={msg.content} />
      ))}
      {isLoading && messages[messages.length - 1]?.role === 'user' && (
         <MessageBubble role="assistant" content="" />
      )}
      <div ref={chatEndRef} />
    </main>
  );
}

export default ChatWindow;
