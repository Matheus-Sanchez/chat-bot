import React from 'react';
import { Remarkable } from 'remarkable';

const md = new Remarkable();

function renderMarkdown(content) {
  return { __html: md.render(content) };
}

/**
 * Componente para renderizar uma única bolha de mensagem.
 * Lida com a formatação e estilização baseada no autor da mensagem.
 */
function MessageBubble({ role, content }) {
  const isUser = role === 'user';

  // Estilos base para a bolha de mensagem.
  const baseClasses = 'px-4 py-3 rounded-2xl max-w-xl lg:max-w-2xl xl:max-w-3xl shadow-md whitespace-pre-wrap';
  // Estilos condicionais para utilizador vs. assistente.
  const roleClasses = isUser 
    ? 'bg-blue-600 text-white self-end' 
    : 'bg-white text-slate-800 self-start';

  // Placeholder para o indicador de "a digitar"
  if (!content && !isUser) {
    return (
      <div className="flex justify-start w-full">
        <div className={`${baseClasses} bg-white text-slate-800`}>
          <span className="animate-pulse-caret">▍</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
      <div 
        className={`${baseClasses} ${roleClasses}`}
        dangerouslySetInnerHTML={renderMarkdown(content)}
      />
    </div>
  );
}

export default MessageBubble;
