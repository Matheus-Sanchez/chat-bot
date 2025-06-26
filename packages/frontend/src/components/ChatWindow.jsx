import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

/**
 * Componente que exibe a lista de mensagens e o indicador de "a digitar".
 */
function ChatWindow({ messages, isLoading }) {
  const chatEndRef = useRef(null);

  // Efeito para rolar para o final do chat sempre que as mensagens ou o estado de loading mudam.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    // A classe aqui deveria ser "chat-window"
    <main className="flex-1 p-6 overflow-y-auto space-y-4"> 
      {messages.map((msg, index) => (
        <MessageBubble key={index} role={msg.role} content={msg.content} />
      ))}
      {/* Exibe o placeholder de "a digitar" enquanto o stream está ativo */}
      {isLoading && messages[messages.length - 1]?.role === 'user' && (
         <MessageBubble role="assistant" content="" />
      )}
      <div ref={chatEndRef} />
    </main>
  );
}

export default ChatWindow;
