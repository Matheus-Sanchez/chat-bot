import React from 'react';
import { Remarkable } from 'remarkable';

const md = new Remarkable();

function renderMarkdown(content) {
  // Renderiza o markdown e retorna um objeto para dangerouslySetInnerHTML
  return { __html: md.render(content) };
}

/**
 * Componente para renderizar uma única bolha de mensagem.
 * Lida com a formatação e estilização baseada no autor da mensagem,
 * e separa o "pensamento" da IA da resposta final.
 */
function MessageBubble({ role, content }) {
  const isUser = role === 'user';

  // Placeholder para o indicador de "a digitar" do assistente
  if (!content && !isUser) {
    return (
      <div className="message-bubble bot">
        <div className="typing-indicator"><span></span></div>
      </div>
    );
  }

  // Se for mensagem do usuário, renderiza diretamente
  if (isUser) {
    return (
      <div className="message-bubble user">
        <div dangerouslySetInnerHTML={renderMarkdown(content)} />
      </div>
    );
  }

  // Para mensagens do bot, processa para separar o pensamento
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const thoughts = [];
  
  // Extrai os pensamentos e os remove do conteúdo principal
  const finalContent = content.replace(thinkRegex, (match, thoughtContent) => {
    thoughts.push(thoughtContent.trim());
    return ''; // Remove a tag <think>
  }).trim();

  return (
    <div className="message-bubble bot">
      {/* Renderiza os pensamentos, se houver */}
      {thoughts.length > 0 && (
        <div className="thought-container">
          {thoughts.map((thought, index) => (
            <div key={index} className="thought-content">
              {/* Não usamos markdown para o pensamento para manter simples */}
              {thought}
            </div>
          ))}
        </div>
      )}

      {/* Renderiza a resposta final, se houver */}
      {finalContent && (
        <div
          className="final-response"
          dangerouslySetInnerHTML={renderMarkdown(finalContent)}
        />
      )}
    </div>
  );
}

export default MessageBubble;
