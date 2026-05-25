import { useEffect, useRef } from 'react';
import { Send, Square, X } from 'lucide-react';
import FileInput from './FileInput';

function ChatComposer({
  disabled,
  draft,
  isStreaming,
  onChangeDraft,
  onClearFile,
  onFileSelect,
  onStop,
  onSubmit,
  selectedFile,
}) {
  const textareaRef = useRef(null);
  const canSubmit = Boolean(draft.trim() || selectedFile) && !disabled;

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = '0px';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [draft]);

  return (
    <footer className="composer">
      {selectedFile && (
        <div className="file-chip">
          <span title={selectedFile.name}>{selectedFile.name}</span>
          <button type="button" onClick={onClearFile} title="Remover arquivo" aria-label="Remover arquivo">
            <X size={15} />
          </button>
        </div>
      )}

      <form className="composer-form" onSubmit={onSubmit}>
        <FileInput disabled={disabled} onFileSelect={onFileSelect} />
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onChangeDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit(event);
            }
          }}
          placeholder="Digite sua mensagem"
          rows={1}
          disabled={disabled}
        />
        {isStreaming ? (
          <button
            className="composer-submit stop"
            type="button"
            onClick={onStop}
            title="Interromper"
            aria-label="Interromper"
          >
            <Square size={17} />
          </button>
        ) : (
          <button
            className="composer-submit"
            type="submit"
            disabled={!canSubmit}
            title="Enviar"
            aria-label="Enviar"
          >
            <Send size={19} />
          </button>
        )}
      </form>
    </footer>
  );
}

export default ChatComposer;
