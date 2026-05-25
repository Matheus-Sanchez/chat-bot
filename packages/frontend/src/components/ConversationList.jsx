import { MessageSquareText, Plus } from 'lucide-react';

function formatConversationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function ConversationList({
  activeConversationId,
  conversations,
  disabled,
  onCreateConversation,
  onSelectConversation,
}) {
  return (
    <section className="conversation-section" aria-label="Historico de conversas">
      <div className="conversation-header">
        <div className="section-title">
          <MessageSquareText size={17} />
          <span>Conversas</span>
        </div>

        <button
          className="mini-icon-button"
          type="button"
          onClick={onCreateConversation}
          disabled={disabled}
          title="Nova conversa"
          aria-label="Nova conversa"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="conversation-list" role="list">
        {conversations.map((conversation) => (
          <button
            className={`conversation-item ${conversation.id === activeConversationId ? 'active' : ''}`}
            key={conversation.id}
            type="button"
            onClick={() => onSelectConversation(conversation.id)}
            disabled={disabled}
            role="listitem"
            title={conversation.title}
          >
            <span className="conversation-title">{conversation.title}</span>
            <span className="conversation-date">{formatConversationDate(conversation.updatedAt)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default ConversationList;
