import { Bot, User } from 'lucide-react';
import { renderMarkdown } from '../lib/markdown';

function splitThoughts(content) {
  const thoughts = [];
  const finalContent = content.replace(/<think>([\s\S]*?)<\/think>/g, (_, thought) => {
    thoughts.push(thought.trim());
    return '';
  }).trim();

  return { thoughts, finalContent };
}

const DEFAULT_STATUS_TEXT = {
  queued: 'Na fila...',
  processing: 'Processando no LM Studio...',
  reasoning: 'Raciocinando antes de responder...',
  streaming: 'Recebendo resposta...',
};

function MessageBubble({ role, content, status, statusText }) {
  const isUser = role === 'user';
  const { thoughts, finalContent } = splitThoughts(content || '');
  const visibleStatus = statusText || DEFAULT_STATUS_TEXT[status] || '';

  return (
    <article className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar" aria-hidden="true">
        {isUser ? <User size={16} /> : <Bot size={17} />}
      </div>

      <div className="message-body">
        {!content && !isUser ? (
          <div className="processing-status" aria-label={visibleStatus || 'Resposta em andamento'}>
            <span className="typing-caret" />
            <span>{visibleStatus || 'Preparando resposta...'}</span>
          </div>
        ) : (
          <>
            {visibleStatus && status !== 'done' && !isUser && (
              <div className="inline-status">
                <span className="typing-dot" />
                <span>{visibleStatus}</span>
              </div>
            )}

            {thoughts.length > 0 && (
              <details className="thoughts">
                <summary>Raciocinio</summary>
                {thoughts.map((thought, index) => (
                  <pre key={`${thought.slice(0, 12)}-${index}`}>{thought}</pre>
                ))}
              </details>
            )}

            {finalContent && (
              <div
                className="markdown-content"
                dangerouslySetInnerHTML={renderMarkdown(finalContent)}
              />
            )}
          </>
        )}
      </div>
    </article>
  );
}

export default MessageBubble;
