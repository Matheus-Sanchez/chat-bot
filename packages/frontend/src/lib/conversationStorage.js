const CLIENT_ID_KEY = 'chat.clientId';
const ACTIVE_CONVERSATION_KEY = 'chat.activeConversationId';
const CONVERSATION_INDEX_KEY = 'chat.conversations.index';
const CONVERSATION_PREFIX = 'chat.conversations.';
const MAX_CONVERSATIONS = 20;

function createId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Nao foi possivel ler ${key} do localStorage:`, error);
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getConversationKey(conversationId) {
  return `${CONVERSATION_PREFIX}${conversationId}`;
}

function sanitizeMessage(message) {
  if (!message?.content?.trim()) return null;

  return {
    id: message.id || createId('message'),
    role: message.role,
    content: message.content,
    localOnly: Boolean(message.localOnly),
  };
}

function sanitizeMessages(messages) {
  return messages
    .map(sanitizeMessage)
    .filter((message) => message && ['system', 'user', 'assistant'].includes(message.role));
}

function titleFromMessages(messages) {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());
  if (!firstUserMessage) return 'Nova conversa';

  const singleLine = firstUserMessage.content.replace(/\s+/g, ' ').trim();
  return singleLine.length > 48 ? `${singleLine.slice(0, 45)}...` : singleLine;
}

function sortIndex(index) {
  return [...index].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function pruneConversationIndex(index) {
  const sortedIndex = sortIndex(index).slice(0, MAX_CONVERSATIONS);
  const keptIds = new Set(sortedIndex.map((item) => item.id));

  for (const item of index) {
    if (!keptIds.has(item.id)) {
      window.localStorage.removeItem(getConversationKey(item.id));
    }
  }

  writeJson(CONVERSATION_INDEX_KEY, sortedIndex);
  return sortedIndex;
}

export function ensureClientId() {
  const currentClientId = window.localStorage.getItem(CLIENT_ID_KEY);
  if (currentClientId) return currentClientId;

  const clientId = createId('client');
  window.localStorage.setItem(CLIENT_ID_KEY, clientId);
  return clientId;
}

export function getConversationIndex() {
  const index = readJson(CONVERSATION_INDEX_KEY, []);
  return Array.isArray(index) ? sortIndex(index) : [];
}

export function getActiveConversationId() {
  return window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);
}

export function setActiveConversationId(conversationId) {
  window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId);
}

export function createConversation({ modelId = '', messages = [] } = {}) {
  const now = new Date().toISOString();
  const sanitizedMessages = sanitizeMessages(messages);
  const conversation = {
    id: createId('conversation'),
    title: titleFromMessages(sanitizedMessages),
    createdAt: now,
    updatedAt: now,
    modelId,
    messages: sanitizedMessages,
  };

  writeJson(getConversationKey(conversation.id), conversation);
  const nextIndex = pruneConversationIndex([
    {
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      modelId: conversation.modelId,
    },
    ...getConversationIndex(),
  ]);
  setActiveConversationId(conversation.id);

  return { conversation, index: nextIndex };
}

export function loadConversation(conversationId) {
  if (!conversationId) return null;
  return readJson(getConversationKey(conversationId), null);
}

export function saveConversation({ id, createdAt, modelId = '', messages }) {
  const existingConversation = loadConversation(id);
  const sanitizedMessages = sanitizeMessages(messages);
  const now = new Date().toISOString();
  const conversation = {
    id,
    title: titleFromMessages(sanitizedMessages),
    createdAt: existingConversation?.createdAt || createdAt || now,
    updatedAt: now,
    modelId,
    messages: sanitizedMessages,
  };

  writeJson(getConversationKey(id), conversation);

  const indexWithoutConversation = getConversationIndex().filter((item) => item.id !== id);
  const nextIndex = pruneConversationIndex([
    {
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      modelId: conversation.modelId,
    },
    ...indexWithoutConversation,
  ]);

  return { conversation, index: nextIndex };
}

export function deleteConversation(conversationId) {
  window.localStorage.removeItem(getConversationKey(conversationId));
  const nextIndex = getConversationIndex().filter((item) => item.id !== conversationId);
  writeJson(CONVERSATION_INDEX_KEY, nextIndex);
  return nextIndex;
}

export function loadOrCreateActiveConversation({ defaultModelId = '', defaultMessages = [] } = {}) {
  ensureClientId();

  const index = getConversationIndex();
  const activeConversationId = getActiveConversationId();
  const activeConversation = loadConversation(activeConversationId);

  if (activeConversation) {
    return { conversation: activeConversation, index };
  }

  const fallbackConversation = index.length ? loadConversation(index[0].id) : null;
  if (fallbackConversation) {
    setActiveConversationId(fallbackConversation.id);
    return { conversation: fallbackConversation, index };
  }

  return createConversation({
    modelId: defaultModelId,
    messages: defaultMessages,
  });
}
