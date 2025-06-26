
const fetch = require('node-fetch'); 
const { LM_STUDIO_URL, DEFAULT_MODEL_IDENTIFIER } = require('../config/ServerConfig');

async function streamChatCompletion(messages) {
    const response = await fetch(LM_STUDIO_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: DEFAULT_MODEL_IDENTIFIER,
            messages: messages,
            temperature: 0.7,
            stream: true,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        // Lançar um erro ajuda a centralizar o tratamento de erros no controller.
        throw new Error(`LM Studio API request failed with status ${response.status}: ${errorBody}`);
    }

    return response.body; // Retorna o stream diretamente
}

module.exports = { streamChatCompletion };