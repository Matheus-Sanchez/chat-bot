const { streamChatCompletion } = require('../services/lmstudioService');
const { Readable } = require('stream');
const { MAX_CONTEXT_MESSAGES, MAX_MESSAGE_CHARS } = require('../config/ServerConfig');

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);

function validateMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return 'A requisição precisa conter um array de "messages" não vazio.';
    }

    for (const [index, message] of messages.entries()) {
        if (!message || typeof message !== 'object') {
            return `A mensagem ${index} precisa ser um objeto.`;
        }

        if (!ALLOWED_ROLES.has(message.role)) {
            return `A mensagem ${index} possui role inválida. Use system, user ou assistant.`;
        }

        if (typeof message.content !== 'string' || !message.content.trim()) {
            return `A mensagem ${index} precisa conter content em texto.`;
        }

        if (message.content.length > MAX_MESSAGE_CHARS) {
            return `A mensagem ${index} excede o limite de ${MAX_MESSAGE_CHARS} caracteres.`;
        }
    }

    return null;
}

async function handleChat(req, res) {
    const { messages } = req.body;
    const validationError = validateMessages(messages);

    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const messagesForLlm = messages.length > MAX_CONTEXT_MESSAGES
        ? messages.slice(-MAX_CONTEXT_MESSAGES)
        : messages;

    console.log(`[${new Date().toLocaleTimeString()}] Nova requisição de streaming...`);

    const abortController = new AbortController();
    res.on('close', () => abortController.abort(new Error('Client disconnected.')));

    try {
        const { stream, model } = await streamChatCompletion(messagesForLlm, {
            signal: abortController.signal,
        });

        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('X-Model-Id', model);

        if (typeof res.flushHeaders === 'function') {
            res.flushHeaders();
        }

        const nodeStream = typeof Readable.fromWeb === 'function'
            ? Readable.fromWeb(stream)
            : stream;

        res.on('close', () => {
            if (!res.writableEnded && typeof nodeStream.destroy === 'function') {
                nodeStream.destroy();
            }
        });

        nodeStream.on('error', (error) => {
            console.error('ERRO no stream do LM Studio:', error.message);
            if (!res.headersSent) {
                res.status(502).json({ error: 'Erro durante o streaming do modelo.' });
            } else {
                res.end();
            }
        });

        nodeStream.pipe(res);

    } catch (error) {
        console.error('ERRO ao processar a requisição de chat:', error.message);

        if (res.headersSent) {
            return res.end();
        }

        return res.status(502).json({
            error: 'Falha na comunicação com o servidor do modelo de linguagem.',
            detail: error.message,
        });
    }
}

module.exports = {
    handleChat,
    validateMessages,
};
