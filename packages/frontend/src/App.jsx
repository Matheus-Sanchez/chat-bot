import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, RefreshCcw, Square, Sun, Trash2 } from 'lucide-react';
import ChatComposer from './components/ChatComposer';
import ChatHeader from './components/ChatHeader';
import ChatWindow from './components/ChatWindow';
import ConversationList from './components/ConversationList';
import ModelSelector from './components/ModelSelector';
import {
  createConversation,
  deleteConversation,
  getConversationIndex,
  loadConversation,
  loadOrCreateActiveConversation,
  saveConversation,
  setActiveConversationId as storeActiveConversationId,
} from './lib/conversationStorage';
import { fetchModels, streamChat } from './services/chatApiService';
import './App.css';

const MAX_FILE_BYTES = 512 * 1024;
const SELECTED_MODEL_STORAGE_KEY = 'chat.selectedModelId';

const welcomeMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Ola! Sou o assistente local. Como posso ajudar?',
  localOnly: true,
};

function getInitialConversationState() {
  return loadOrCreateActiveConversation({
    defaultModelId: window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY) || '',
    defaultMessages: [welcomeMessage],
  });
}

function hydrateMessages(messages) {
  return Array.isArray(messages) && messages.length > 0 ? messages : [welcomeMessage];
}

function createMessageId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function getInitialTheme() {
  const storedTheme = window.localStorage.getItem('chat-theme');
  if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  const [initialState] = useState(getInitialConversationState);
  const [activeConversationId, setActiveConversationId] = useState(initialState.conversation.id);
  const [conversationIndex, setConversationIndex] = useState(initialState.index);
  const [messages, setMessages] = useState(() => hydrateMessages(initialState.conversation.messages));
  const [draft, setDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [models, setModels] = useState([]);
  const [activeModel, setActiveModel] = useState(initialState.conversation.modelId || '');
  const [modelError, setModelError] = useState('');
  const [modelNotice, setModelNotice] = useState('');
  const [isModelBusy, setIsModelBusy] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const abortRef = useRef(null);
  const activeConversationIdRef = useRef(initialState.conversation.id);
  const activeConversationCreatedAtRef = useRef(initialState.conversation.createdAt);
  const activeModelRef = useRef(initialState.conversation.modelId || '');

  useEffect(() => {
    activeModelRef.current = activeModel;
  }, [activeModel]);

  const persistActiveConversation = useCallback((nextMessages, modelId = activeModelRef.current) => {
    if (!activeConversationIdRef.current) return;

    const { conversation, index } = saveConversation({
      id: activeConversationIdRef.current,
      createdAt: activeConversationCreatedAtRef.current,
      modelId: modelId || '',
      messages: nextMessages,
    });

    activeConversationCreatedAtRef.current = conversation.createdAt;
    setConversationIndex(index);
  }, []);

  const applyConversation = useCallback((conversation, nextIndex = getConversationIndex()) => {
    activeConversationIdRef.current = conversation.id;
    activeConversationCreatedAtRef.current = conversation.createdAt;
    storeActiveConversationId(conversation.id);
    setActiveConversationId(conversation.id);
    setConversationIndex(nextIndex);
    setMessages(hydrateMessages(conversation.messages));
    setDraft('');
    setSelectedFile(null);

    if (conversation.modelId) {
      activeModelRef.current = conversation.modelId;
      setActiveModel(conversation.modelId);
      window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, conversation.modelId);
    }
  }, []);

  const conversationMessages = useMemo(
    () => messages.filter((message) => !message.localOnly),
    [messages]
  );

  const selectedModel = useMemo(
    () => models.find((model) => model.id === activeModel),
    [activeModel, models]
  );

  const loadModelCatalog = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setIsModelBusy(true);
    setModelError('');

    try {
      const payload = await fetchModels();
      const nextModels = payload.models || [];
      const preferredModelId = activeModelRef.current
        || window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY);
      const preferredModelExists = nextModels.some((model) => model.id === preferredModelId);
      const nextActiveModel = preferredModelExists
        ? preferredModelId
        : payload.activeModel || nextModels.find((model) => model.loaded)?.id || nextModels[0]?.id || '';

      setModels(nextModels);
      setActiveModel(nextActiveModel);
      if (nextActiveModel) {
        activeModelRef.current = nextActiveModel;
        window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, nextActiveModel);
      }
      setModelNotice(nextModels.length ? '' : 'Nenhum modelo LLM local encontrado.');
    } catch (error) {
      setModelError(error.message);
      setModelNotice('');
    } finally {
      if (!quiet) setIsModelBusy(false);
    }
  }, []);

  useEffect(() => {
    loadModelCatalog();
  }, [loadModelCatalog]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('chat-theme', theme);
  }, [theme]);

  const handleCreateConversation = () => {
    if (isStreaming) return;

    const { conversation, index } = createConversation({
      modelId: activeModelRef.current,
      messages: [welcomeMessage],
    });

    applyConversation(conversation, index);
  };

  const handleOpenConversation = (conversationId) => {
    if (isStreaming || conversationId === activeConversationIdRef.current) return;

    const conversation = loadConversation(conversationId);
    if (!conversation) {
      setConversationIndex(getConversationIndex());
      return;
    }

    applyConversation(conversation);
  };

  const handleDeleteActiveConversation = () => {
    if (isStreaming) return;

    const nextIndex = deleteConversation(activeConversationIdRef.current);
    if (!nextIndex.length) {
      const { conversation, index } = createConversation({
        modelId: activeModelRef.current,
        messages: [welcomeMessage],
      });
      applyConversation(conversation, index);
      return;
    }

    const nextConversation = loadConversation(nextIndex[0].id);
    if (nextConversation) {
      applyConversation(nextConversation, nextIndex);
    }
  };

  const handleSelectModel = async (modelId) => {
    if (!modelId || modelId === activeModel || isStreaming) return;

    setModelError('');
    setActiveModel(modelId);
    activeModelRef.current = modelId;
    window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, modelId);
    persistActiveConversation(messages, modelId);
    setModelNotice('Modelo selecionado para as proximas mensagens. Ele sera carregado quando sua mensagem chegar na fila.');
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const buildPrompt = async () => {
    const trimmedDraft = draft.trim();

    if (!selectedFile) {
      return {
        displayPrompt: trimmedDraft,
        apiPrompt: trimmedDraft,
      };
    }

    if (selectedFile.size > MAX_FILE_BYTES) {
      throw new Error('O arquivo selecionado e maior que 512 KB.');
    }

    const fileContent = await readFileAsText(selectedFile);
    const question = trimmedDraft || 'Resuma o conteudo do arquivo de forma objetiva.';

    return {
      displayPrompt: trimmedDraft
        ? `${trimmedDraft}\n\nArquivo anexado: ${selectedFile.name}`
        : `Resuma o arquivo: ${selectedFile.name}`,
      apiPrompt: `Use o seguinte contexto do arquivo "${selectedFile.name}" para responder a pergunta.

---

${fileContent}

---

Pergunta: ${question}`,
    };
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (isStreaming || (!draft.trim() && !selectedFile)) return;

    const userId = createMessageId('user');
    const assistantId = createMessageId('assistant');
    const messagesBeforeSubmit = messages;
    const modelForRequest = activeModel || '';
    let accumulatedResponse = '';
    let accumulatedReasoning = '';
    let userMessage = null;
    let assistantMessage = null;

    try {
      const { displayPrompt, apiPrompt } = await buildPrompt();
      userMessage = {
        id: userId,
        role: 'user',
        content: displayPrompt,
        apiContent: apiPrompt,
      };
      assistantMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        status: 'queued',
        statusText: 'Entrando na fila...',
      };
      const requestMessages = [...conversationMessages, userMessage]
        .map(({ role, content, apiContent }) => ({ role, content: apiContent || content }));
      const optimisticMessages = [...messagesBeforeSubmit, userMessage, assistantMessage];
      const persistedUserMessages = [...messagesBeforeSubmit, userMessage];

      setMessages(optimisticMessages);
      persistActiveConversation(persistedUserMessages, modelForRequest);
      setDraft('');
      setSelectedFile(null);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortRef.current = abortController;

      await streamChat(requestMessages, {
        model: modelForRequest || undefined,
        signal: abortController.signal,
        onStatus: (status) => {
          setMessages((current) => current.map((message) => {
            if (message.id !== assistantId) return message;

            return {
              ...message,
              status: status.state || message.status,
              statusText: status.message || message.statusText,
              queuePosition: status.position ?? message.queuePosition,
            };
          }));
        },
        onReasoning: (chunk) => {
          accumulatedReasoning += chunk;
        },
        onChunk: (chunk) => {
          accumulatedResponse += chunk;
          setMessages((current) => current.map((message) => (
            message.id === assistantId
              ? { ...message, content: accumulatedResponse, status: 'streaming', statusText: 'Recebendo resposta...' }
              : message
          )));
        },
      });

      const fallbackContent = accumulatedReasoning.trim()
        ? 'O modelo terminou sem uma resposta final. Ele enviou apenas raciocinio interno; aumentei o limite padrao de tokens para reduzir isso. Tente reenviar a pergunta.'
        : 'A resposta terminou sem conteudo.';
      const finalAssistantMessage = {
        ...assistantMessage,
        content: accumulatedResponse.trim() ? accumulatedResponse : fallbackContent,
        localOnly: !accumulatedResponse.trim(),
        status: 'done',
        statusText: '',
      };
      const finalMessages = [...messagesBeforeSubmit, userMessage, finalAssistantMessage];

      setMessages(finalMessages);
      persistActiveConversation(finalMessages, modelForRequest);
    } catch (error) {
      const wasAborted = error.name === 'AbortError';
      const errorAssistantMessage = {
        id: assistantId,
        role: 'assistant',
        content: wasAborted && accumulatedResponse.trim()
          ? accumulatedResponse
          : wasAborted
            ? 'Resposta interrompida.'
            : `Ocorreu um erro: ${error.message}`,
        localOnly: true,
        status: wasAborted ? 'done' : 'error',
        statusText: wasAborted && accumulatedResponse.trim() ? 'Interrompida.' : '',
      };
      const failedMessages = userMessage
        ? [...messagesBeforeSubmit, userMessage, errorAssistantMessage]
        : [...messagesBeforeSubmit, { ...errorAssistantMessage, id: createMessageId('local-error') }];

      setMessages(failedMessages);
      persistActiveConversation(failedMessages, modelForRequest);
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  };

  const statusText = modelError
    ? 'LM Studio indisponivel'
    : selectedModel?.name || activeModel || 'Modelo automatico';

  return (
    <div className="app-shell">
      <aside className="workspace-panel">
        <ChatHeader statusText={statusText} hasError={Boolean(modelError)} />

        <ModelSelector
          activeModel={activeModel}
          disabled={isStreaming}
          error={modelError}
          isLoading={isModelBusy}
          models={models}
          notice={modelNotice}
          onRefresh={loadModelCatalog}
          onSelectModel={handleSelectModel}
        />

        <ConversationList
          activeConversationId={activeConversationId}
          conversations={conversationIndex}
          disabled={isStreaming}
          onCreateConversation={handleCreateConversation}
          onSelectConversation={handleOpenConversation}
        />

        <div className="workspace-actions" aria-label="Acoes da conversa">
          <button
            className="icon-button"
            type="button"
            onClick={handleDeleteActiveConversation}
            disabled={isStreaming}
            title="Apagar conversa"
            aria-label="Apagar conversa"
          >
            <Trash2 size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => loadModelCatalog()}
            disabled={isModelBusy}
            title="Atualizar modelos"
            aria-label="Atualizar modelos"
          >
            <RefreshCcw size={18} className={isModelBusy ? 'spin' : undefined} />
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
      </aside>

      <section className="chat-panel" aria-label="Chat local">
        <header className="chat-topbar">
          <div>
            <span className={`connection-dot ${modelError ? 'error' : ''}`} />
            <span>{statusText}</span>
          </div>
          {isStreaming && (
            <button
              className="topbar-stop"
              type="button"
              onClick={stopStreaming}
              title="Interromper resposta"
              aria-label="Interromper resposta"
            >
              <Square size={15} />
            </button>
          )}
        </header>

        {(modelNotice || modelError) && (
          <div className={`system-banner ${modelError ? 'error' : 'info'}`}>
            {modelError || modelNotice}
          </div>
        )}

        <ChatWindow messages={messages} isStreaming={isStreaming} />

        <ChatComposer
          disabled={isStreaming}
          draft={draft}
          isStreaming={isStreaming}
          onChangeDraft={setDraft}
          onClearFile={() => setSelectedFile(null)}
          onFileSelect={setSelectedFile}
          onStop={stopStreaming}
          onSubmit={handleSubmit}
          selectedFile={selectedFile}
        />
      </section>
    </div>
  );
}

export default App;
