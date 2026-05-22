import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Send, Sun, Trash2, X } from 'lucide-react';
import ChatWindow from './components/ChatWindow';
import FileInput from './components/FileInput';
import ModelSelector from './components/ModelSelector';
import { fetchModels, requestModelLoad, streamChat } from './services/chatApiService';
import './App.css';

const MAX_FILE_BYTES = 512 * 1024;

const welcomeMessage = {
  role: 'assistant',
  content: 'Ola! Sou o assistente de IA interno. Como posso ajudar?',
  localOnly: true,
};

function App() {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [theme, setTheme] = useState('light');
  const [models, setModels] = useState([]);
  const [activeModel, setActiveModel] = useState('');
  const [modelError, setModelError] = useState('');
  const [modelNotice, setModelNotice] = useState('');
  const [isModelBusy, setIsModelBusy] = useState(false);
  const textareaRef = useRef(null);

  const conversationMessages = useMemo(
    () => messages.filter((message) => !message.localOnly),
    [messages]
  );

  const loadModelCatalog = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setIsModelBusy(true);
    setModelError('');

    try {
      const payload = await fetchModels();
      setModels(payload.models || []);
      setActiveModel(payload.activeModel || payload.models?.find((model) => model.loaded)?.id || '');
      setModelNotice(payload.models?.length ? '' : 'Nenhum modelo LLM local encontrado.');
    } catch (error) {
      setModelError(error.message);
    } finally {
      if (!quiet) setIsModelBusy(false);
    }
  }, []);

  useEffect(() => {
    loadModelCatalog();
  }, [loadModelCatalog]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput]);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

  const handleSelectModel = async (modelId) => {
    if (!modelId || modelId === activeModel || isLoading) return;

    setIsModelBusy(true);
    setModelError('');
    setModelNotice('Carregando modelo no LM Studio...');

    try {
      const result = await requestModelLoad(modelId);
      setActiveModel(result.activeModel || modelId);
      setModelNotice(result.status === 'already-loaded'
        ? 'Modelo selecionado.'
        : `Modelo carregado em ${result.loadTimeSeconds?.toFixed?.(1) || 'alguns'}s.`);
      await loadModelCatalog({ quiet: true });
    } catch (error) {
      setModelError(error.message);
      setModelNotice('');
    } finally {
      setIsModelBusy(false);
    }
  };

  const handleSendMessage = async (event) => {
    event?.preventDefault();
    const trimmedInput = userInput.trim();
    if ((!trimmedInput && !selectedFile) || isLoading) return;

    setIsLoading(true);

    let finalPrompt = trimmedInput;
    let displayPrompt = trimmedInput;
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_BYTES) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: 'O arquivo selecionado e maior que 512 KB. Use um trecho menor para manter o chat responsivo.',
          localOnly: true,
        }]);
        setIsLoading(false);
        return;
      }

      try {
        const fileContent = await readFileAsText(selectedFile);
        const question = trimmedInput || 'Resuma o conteudo do arquivo de forma objetiva.';
        finalPrompt = `Use o seguinte contexto do arquivo "${selectedFile.name}" para responder a pergunta.

---

${fileContent}

---

Pergunta: ${question}`;
        displayPrompt = trimmedInput
          ? `${trimmedInput}\n\nArquivo anexado: ${selectedFile.name}`
          : `Resuma o arquivo: ${selectedFile.name}`;
      } catch (error) {
        console.error('Erro ao ler o arquivo:', error);
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro ao ler o arquivo.',
          localOnly: true,
        }]);
        setIsLoading(false);
        return;
      }
    }

    const userMessage = { role: 'user', content: displayPrompt, apiContent: finalPrompt };
    const newMessages = [...conversationMessages, userMessage];
    setMessages((prev) => [...prev, userMessage]);
    setUserInput('');
    setSelectedFile(null);

    let accumulatedResponse = '';
    const assistantMessage = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, assistantMessage]);

    streamChat(
      newMessages.map(({ role, content, apiContent }) => ({ role, content: apiContent || content })),
      (chunk) => {
        accumulatedResponse += chunk;
        setMessages((prev) => {
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1] = { ...assistantMessage, content: accumulatedResponse };
          return updatedMessages;
        });
      },
      () => setIsLoading(false),
      (error) => {
        console.error('Erro recebido pelo chat:', error);
        setMessages((prev) => {
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1] = {
            ...assistantMessage,
            content: `Ocorreu um erro no servidor: ${error.message}`,
            localOnly: true,
          };
          return updatedMessages;
        });
        setIsLoading(false);
      }
    );
  };

  const clearConversation = () => {
    if (isLoading) return;
    setMessages([welcomeMessage]);
    setUserInput('');
    setSelectedFile(null);
  };

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <h1>Assistente IA</h1>
          <span>Chat local via LM Studio</span>
        </div>

        <ModelSelector
          activeModel={activeModel}
          disabled={isLoading}
          error={modelError}
          isLoading={isModelBusy}
          models={models}
          onRefresh={loadModelCatalog}
          onSelectModel={handleSelectModel}
        />

        <div className="header-actions">
          <button
            className="icon-button"
            type="button"
            onClick={clearConversation}
            disabled={isLoading}
            title="Nova conversa"
            aria-label="Nova conversa"
          >
            <Trash2 size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={toggleTheme}
            title="Mudar tema"
            aria-label="Mudar tema"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      {(modelNotice || modelError) && (
        <div className={`system-banner ${modelError ? 'error' : 'info'}`}>
          {modelError || modelNotice}
        </div>
      )}

      <ChatWindow messages={messages} isLoading={isLoading} />

      <footer className="composer">
        {selectedFile && (
          <div className="file-tag">
            <span>{selectedFile.name}</span>
            <button type="button" onClick={() => setSelectedFile(null)} title="Remover arquivo">
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="input-form">
          <FileInput onFileChange={(event) => setSelectedFile(event.target.files[0])} disabled={isLoading} />
          <textarea
            ref={textareaRef}
            value={userInput}
            onChange={(event) => setUserInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage(event);
              }
            }}
            placeholder="Digite sua mensagem"
            rows="1"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="send-button"
            disabled={isLoading || (!userInput.trim() && !selectedFile)}
            title="Enviar"
            aria-label="Enviar"
          >
            <Send size={20} />
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;
