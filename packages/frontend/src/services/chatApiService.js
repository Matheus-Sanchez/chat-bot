const API_URL = 'http://localhost:4000/chat';

export const streamChat = async (messages, onChunk, onEnd, onError) => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        onEnd();
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      
      // O stream do LM Studio pode enviar múltiplos eventos "data:" em um único chunk.
      // Precisamos processar cada um individualmente.
      const eventLines = chunk.split('\n').filter(line => line.startsWith('data: '));
      for (const line of eventLines) {
        const jsonData = line.substring(6);
        if (jsonData.trim() === '[DONE]') {
          continue; // Ignora o evento [DONE] se ele vier no meio
        }
        try {
          const parsed = JSON.parse(jsonData);
          if (parsed.choices && parsed.choices[0].delta.content) {
            onChunk(parsed.choices[0].delta.content);
          }
        } catch (e) {
          console.error('Erro ao parsear o chunk JSON:', jsonData);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao fazer streaming da resposta:', error);
    onError(error);
  }
};
