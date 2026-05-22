const CHAT_URL = import.meta.env.VITE_API_URL || '/chat';

function parseSseEvent(eventText, onChunk) {
  const data = eventText
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();

  if (!data || data === '[DONE]') return;

  try {
    const parsed = JSON.parse(data);
    const content = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content;
    if (content) onChunk(content);
  } catch (error) {
    console.error('Erro ao parsear evento SSE:', error, data);
  }
}

function parseBufferedEvents(buffer, onChunk, isFinal = false) {
  const events = buffer.split(/\r?\n\r?\n/);
  const remainder = isFinal ? '' : events.pop() ?? '';

  for (const eventText of events) {
    parseSseEvent(eventText, onChunk);
  }

  if (isFinal && remainder) {
    parseSseEvent(remainder, onChunk);
  }

  return remainder;
}

export const streamChat = async (messages, onChunk, onEnd, onError) => {
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      let detail = 'Falha ao chamar o backend.';
      try {
        const payload = await response.json();
        detail = payload.detail || payload.error || detail;
      } catch (error) {
        console.error('Nao foi possivel ler o erro do backend:', error);
      }
      throw new Error(detail);
    }

    if (!response.body) {
      throw new Error('O navegador nao recebeu um stream de resposta.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        parseBufferedEvents(buffer, onChunk, true);
        onEnd();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = parseBufferedEvents(buffer, onChunk);
    }
  } catch (error) {
    console.error('Erro ao fazer streaming da resposta:', error);
    onError(error);
  }
};

export async function fetchModels() {
  const response = await fetch('/models');
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || payload.error || 'Nao foi possivel consultar os modelos.');
  }

  return response.json();
}

export async function requestModelLoad(modelId) {
  const response = await fetch('/models/load', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: modelId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || 'Nao foi possivel carregar o modelo.');
  }

  return payload;
}
