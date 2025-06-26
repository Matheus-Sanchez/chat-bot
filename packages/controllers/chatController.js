const { streamChatCompletion } = require('../services/lmstudioService');
const { MAX_CONTEXT_MESSAGES } = require('../config/ServerConfig');

async function handleChat(req, res) {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
            error: 'A requisição precisa conter um array de "messages" não vazio.',
        });
    }

    // Limita o contexto para a LLM
    const messagesForLlm = messages.length > MAX_CONTEXT_MESSAGES
        ? messages.slice(-MAX_CONTEXT_MESSAGES)
        : messages;

    console.log(`[${new Date().toLocaleTimeString()}] Nova requisição de streaming...`);

    try {
        const stream = await streamChatCompletion(messagesForLlm);

        // Configura os headers para streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Retransmite o stream do serviço diretamente para o cliente
        stream.pipe(res);

    } catch (error) {
        console.error('ERRO ao processar a requisição de chat:', error.message);
        res.status(500).json({
            error: 'Falha na comunicação com o servidor do modelo de linguagem.',
        });
    }
}

module.exports = { handleChat };
