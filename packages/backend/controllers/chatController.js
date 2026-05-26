const { streamChatCompletion } = require('../services/lmstudioService');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { chatQueue } = require('../services/chatQueue');
const { MAX_CONTEXT_MESSAGES, MAX_MESSAGE_CHARS } = require('../config/ServerConfig');

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
const SUPPORTED_IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,/i;

function validateTextContent(content, index) {
    if (typeof content !== 'string' || !content.trim()) {
        return `A mensagem ${index} precisa conter content em texto.`;
    }

    if (content.length > MAX_MESSAGE_CHARS) {
        return `A mensagem ${index} excede o limite de ${MAX_MESSAGE_CHARS} caracteres.`;
    }

    return null;
}

function validateContentParts(content, index) {
    if (!Array.isArray(content) || content.length === 0) {
        return `A mensagem ${index} precisa conter content em texto ou partes multimodais.`;
    }

    let hasContent = false;
    let textLength = 0;

    for (const [partIndex, part] of content.entries()) {
        if (!part || typeof part !== 'object') {
            return `A parte ${partIndex} da mensagem ${index} precisa ser um objeto.`;
        }

        if (part.type === 'text') {
            if (typeof part.text !== 'string') {
                return `A parte ${partIndex} da mensagem ${index} precisa conter text.`;
            }

            textLength += part.text.length;
            hasContent = hasContent || Boolean(part.text.trim());

            if (textLength > MAX_MESSAGE_CHARS) {
                return `A mensagem ${index} excede o limite de ${MAX_MESSAGE_CHARS} caracteres de texto.`;
            }

            continue;
        }

        if (part.type === 'image_url') {
            const imageUrl = part.image_url?.url;

            if (typeof imageUrl !== 'string' || !SUPPORTED_IMAGE_DATA_URL.test(imageUrl)) {
                return `A parte ${partIndex} da mensagem ${index} precisa conter uma imagem PNG, JPEG ou WebP em data URL.`;
            }

            hasContent = true;
            continue;
        }

        return `A parte ${partIndex} da mensagem ${index} possui tipo invalido. Use text ou image_url.`;
    }

    return hasContent
        ? null
        : `A mensagem ${index} precisa conter content em texto ou imagem.`;
}

function validateMessageContent(content, index) {
    if (typeof content === 'string') {
        return validateTextContent(content, index);
    }

    if (Array.isArray(content)) {
        return validateContentParts(content, index);
    }

    return `A mensagem ${index} precisa conter content em texto ou partes multimodais.`;
}

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

        const contentError = validateMessageContent(message.content, index);
        if (contentError) return contentError;
    }

    return null;
}

function writeSseEvent(res, event, payload) {
    if (res.destroyed || res.writableEnded) return false;

    if (event) {
        res.write(`event: ${event}\n`);
    }

    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    return true;
}

function setSseHeaders(res) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }
}

async function streamQueuedChat({ messages, res, signal }) {
    writeSseEvent(res, 'status', {
        state: 'processing',
        message: 'Preparando modelo no LM Studio...',
    });

    const { stream, model } = await streamChatCompletion(messages, {
        model: res.locals.requestedModel,
        signal,
    });

    writeSseEvent(res, 'status', {
        state: 'streaming',
        model,
        message: 'Recebendo resposta do LM Studio...',
    });

    const nodeStream = typeof Readable.fromWeb === 'function'
        ? Readable.fromWeb(stream)
        : stream;

    await pipeline(nodeStream, res, { signal });
}

async function handleChat(req, res) {
    const { messages, model } = req.body;
    const validationError = validateMessages(messages);

    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    if (model !== undefined && (typeof model !== 'string' || !model.trim())) {
        return res.status(400).json({ error: 'O campo "model" precisa ser texto quando informado.' });
    }

    const messagesForLlm = messages.length > MAX_CONTEXT_MESSAGES
        ? messages.slice(-MAX_CONTEXT_MESSAGES)
        : messages;

    console.log(`[${new Date().toLocaleTimeString()}] Nova requisição de streaming...`);

    const abortController = new AbortController();
    res.on('close', () => {
        if (!abortController.signal.aborted) {
            abortController.abort(new Error('Client disconnected.'));
        }
    });

    setSseHeaders(res);
    res.locals.requestedModel = model?.trim();

    try {
        await chatQueue.enqueue({
            signal: abortController.signal,
            onPositionChange: ({ position, queued }) => {
                writeSseEvent(res, 'status', {
                    state: 'queued',
                    position,
                    queued,
                    message: position === 1
                        ? 'Aguardando a vez na fila...'
                        : `Aguardando na fila (${position}/${queued})...`,
                });
            },
            run: () => streamQueuedChat({
                messages: messagesForLlm,
                res,
                signal: abortController.signal,
            }),
        });
    } catch (error) {
        if (abortController.signal.aborted || res.destroyed || res.writableEnded) {
            return;
        }

        console.error('ERRO ao processar a requisição de chat:', error.message);

        writeSseEvent(res, 'error', {
            error: 'Falha na comunicação com o servidor do modelo de linguagem.',
            detail: error.message,
        });
        return res.end();
    }
}

module.exports = {
    handleChat,
    validateMessages,
};
