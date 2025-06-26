import React, { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import FileInput from './components/FileInput';
import { streamChat } from './services/chatApiService';

// --- COMPONENTE PRINCIPAL ---

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou o assistente de IA interno. Como posso ajudar?' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

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
        finalPrompt = `Contexto do ficheiro "${selectedFile.name}":

${fileContent}

---

${trimmedInput}`;
      } catch (error) {
        console.error("Erro ao ler o ficheiro:", error);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao ler o ficheiro.' }]);
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
    streamChat(
      newMessages,
      (chunk) => {
        accumulatedResponse += chunk;
        setMessages(prev => {
          const lastMsgIndex = prev.length - 1;
          // Se a última mensagem for do assistente, atualiza. Senão, adiciona uma nova.
          if (prev[lastMsgIndex]?.role === 'assistant') {
            const updatedMessages = [...prev];
            updatedMessages[lastMsgIndex] = { ...updatedMessages[lastMsgIndex], content: accumulatedResponse };
            return updatedMessages;
          } else {
            return [...prev, { role: 'assistant', content: accumulatedResponse }];
          }
        });
      },
      () => {
        setIsLoading(false);
      },
      (error) => {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Ocorreu um erro no servidor.' }]);
        setIsLoading(false);
      }
    );
  };

  return (
    <div className="bg-slate-100 flex items-center justify-center h-screen font-sans">
      <div className="w-full max-w-3xl h-full md:h-[95vh] flex flex-col bg-white shadow-2xl rounded-xl">
        <header className="bg-slate-800 text-white p-4 rounded-t-xl flex items-center">
          <h1 className="text-xl font-bold">Assistente de IA Interno</h1>
        </header>
        
        <ChatWindow messages={messages} isLoading={isLoading} />
        
        <footer className="p-4 border-t border-slate-200 bg-white rounded-b-xl">
          <form onSubmit={handleSendMessage} className="flex flex-col">
             <div className="flex items-center space-x-4">
               <FileInput 
                 selectedFile={selectedFile} 
                 onFileChange={(e) => setSelectedFile(e.target.files[0])}
                 onFileRemove={() => setSelectedFile(null)}
               />
               <input
                 type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)}
                 placeholder="Digite a sua mensagem..." autoComplete="off"
                 className="flex-1 p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                 disabled={isLoading} />
               <button
                 type="submit" disabled={isLoading || (!userInput.trim() && !selectedFile)}
                 className="bg-blue-600 text-white font-semibold px-5 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:bg-slate-400 disabled:cursor-not-allowed">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
               </button>
             </div>
          </form>
        </footer>
      </div>
    </div>
  );
}

export default App;
