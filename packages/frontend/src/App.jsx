import React, { useState, useEffect, useRef } from 'react';
import ChatWindow from './components/ChatWindow';
import FileInput from './components/FileInput'; // Importa o FileInput
import { streamChat } from './services/chatApiService';
import './App.css';

// --- Ícones SVG ---
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);


// --- COMPONENTE PRINCIPAL ---

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou o assistente de IA interno. Como posso ajudar?' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); // Estado para o arquivo
  const [theme, setTheme] = useState('light');
  const textareaRef = useRef(null);

  // Efeito para ajustar a altura do textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [userInput]);

  // Efeito para aplicar a classe de tema ao body
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const trimmedInput = userInput.trim();
    if ((!trimmedInput && !selectedFile) || isLoading) return;

    setIsLoading(true);

    let finalPrompt = trimmedInput;
    if (selectedFile) {
      try {
        const fileContent = await readFileAsText(selectedFile);
        finalPrompt = `Use o seguinte contexto do arquivo \"${selectedFile.name}\" para responder à pergunta.

---

${fileContent}

---

Pergunta: ${trimmedInput}`;
      } catch (error) {
        console.error("Erro ao ler o arquivo:", error);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro ao ler o arquivo.' }]);
        setIsLoading(false);
        return;
      }
    }

    const userMessage = { role: 'user', content: finalPrompt };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setUserInput('');
    setSelectedFile(null);

    let accumulatedResponse = '';
    const assistantMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMessage]);

    streamChat(
      newMessages,
      (chunk) => {
        accumulatedResponse += chunk;
        setMessages(prev => {
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1] = { ...assistantMessage, content: accumulatedResponse };
          return updatedMessages;
        });
      },
      () => setIsLoading(false),
      (error) => {
        setMessages(prev => {
            const updatedMessages = [...prev];
            updatedMessages[updatedMessages.length - 1] = { ...assistantMessage, content: 'Ocorreu um erro no servidor. Por favor, tente novamente.' };
            return updatedMessages;
        });
        setIsLoading(false);
      }
    );
  };

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Assistente IA</h1>
        <button onClick={toggleTheme} className="theme-toggle-button" title="Mudar tema">
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
      </header>
      
      <ChatWindow messages={messages} isLoading={isLoading} />
      
      <footer className="input-area">
        {selectedFile && (
            <div className="file-tag">
                <span>{selectedFile.name}</span>
                <button onClick={() => setSelectedFile(null)} title="Remover arquivo">
                    <CloseIcon />
                </button>
            </div>
        )}
        <form onSubmit={handleSendMessage} className="input-form">
          <FileInput onFileChange={(e) => setSelectedFile(e.target.files[0])} disabled={isLoading} />
          <textarea
            ref={textareaRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder="Digite sua mensagem..."
            rows="1"
            disabled={isLoading}
          />
          <button type="submit" className="send-button" disabled={isLoading || (!userInput.trim() && !selectedFile)} title="Enviar">
            <SendIcon />
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;
