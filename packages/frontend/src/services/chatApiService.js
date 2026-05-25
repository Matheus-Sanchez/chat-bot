function normalizeApiBaseUrl(value = '') {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/chat') ? trimmed.slice(0, -5) : trimmed;
}

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || ''
);

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function readError(response, fallback) {
  const payload = await response.json().catch(() => null);
  return payload?.detail || payload?.error || fallback;
}

function parseSseEvent(eventText, { onChunk, onReasoning, onStatus }) {
  const lines = eventText.split(/\r?\n/);
  const eventType = lines
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim() || 'message';
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();

  if (!data || data === '[DONE]') return;

  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch (error) {
    console.error('Nao foi possivel interpretar evento SSE:', error, data);
    return;
  }

  if (eventType === 'status') {
    onStatus?.(parsed);
    return;
  }

  if (eventType === 'error') {
    throw new Error(parsed.detail || parsed.error || 'Falha durante o streaming.');
  }

  const delta = parsed.choices?.[0]?.delta || {};
  const message = parsed.choices?.[0]?.message || {};
  const content = delta.content ?? message.content;
  const reasoning = delta.reasoning_content ?? message.reasoning_content;

  if (reasoning && !content) {
    onReasoning?.(reasoning);
    onStatus?.({
      state: 'reasoning',
      message: 'Raciocinando antes de responder...',
    });
    return;
  }

  if (content) {
    onStatus?.({ state: 'streaming' });
    onChunk(content);
  }
}

function parseBufferedEvents(buffer, handlers, isFinal = false) {
  const events = buffer.split(/\r?\n\r?\n/);
  const remainder = isFinal ? '' : events.pop() ?? '';

  for (const eventText of events) {
    parseSseEvent(eventText, handlers);
  }

  if (isFinal && remainder) {
    parseSseEvent(remainder, handlers);
  }

  return remainder;
}

export async function streamChat(messages, { model, signal, onChunk, onReasoning, onStatus }) {
  const handlers = { onChunk, onReasoning, onStatus };
  const response = await fetch(apiUrl('/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, model }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Falha ao chamar o backend.'));
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
      parseBufferedEvents(buffer, handlers, true);
      onStatus?.({ state: 'done' });
      return;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = parseBufferedEvents(buffer, handlers);
  }
}

export async function fetchModels({ signal } = {}) {
  const response = await fetch(apiUrl('/models'), { signal });
  if (!response.ok) {
    throw new Error(await readError(response, 'Nao foi possivel consultar os modelos.'));
  }

  return response.json();
}

export async function requestModelLoad(modelId, { signal } = {}) {
  const response = await fetch(apiUrl('/models/load'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: modelId }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'Nao foi possivel carregar o modelo.'));
  }

  return response.json();
}
