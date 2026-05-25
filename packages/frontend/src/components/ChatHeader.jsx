import { Bot } from 'lucide-react';

function ChatHeader({ hasError, statusText }) {
  return (
    <header className="workspace-header">
      <div className="brand-mark" aria-hidden="true">
        <Bot size={22} />
      </div>
      <div>
        <h1>Assistente IA</h1>
        <p className={hasError ? 'status-error' : ''}>{statusText}</p>
      </div>
    </header>
  );
}

export default ChatHeader;
