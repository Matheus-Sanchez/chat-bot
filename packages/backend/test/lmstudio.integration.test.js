const http = require('http');
const assert = require('node:assert/strict');
const test = require('node:test');

function startServer(app) {
    const server = http.createServer(app);

    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({
                server,
                url: `http://127.0.0.1:${port}`,
            });
        });
    });
}

function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

test('backend talks to the real LM Studio server', { timeout: 120000 }, async () => {
    process.env.LM_STUDIO_BASE_URL ||= 'http://127.0.0.1:1234';
    process.env.LM_STUDIO_MODEL ||= 'auto';
    process.env.LM_STUDIO_MAX_TOKENS ||= '32';
    process.env.LM_STUDIO_TEMPERATURE ||= '0.1';

    const { createApp } = require('../server');
    const backend = await startServer(createApp());

    try {
        const healthResponse = await fetch(`${backend.url}/health`);
        assert.equal(healthResponse.status, 200);
        const health = await healthResponse.json();
        assert.equal(health.status, 'ok');
        assert.ok(health.lmStudio.models.length > 0);

        const modelsResponse = await fetch(`${backend.url}/models`);
        assert.equal(modelsResponse.status, 200);
        const modelCatalog = await modelsResponse.json();
        assert.ok(modelCatalog.models.length > 0);
        assert.ok(modelCatalog.activeModel);

        const loadResponse = await fetch(`${backend.url}/models/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelCatalog.activeModel }),
        });
        assert.equal(loadResponse.status, 200);
        const loadResult = await loadResponse.json();
        assert.equal(loadResult.activeModel, modelCatalog.activeModel);

        const chatResponse = await fetch(`${backend.url}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'user',
                        content: 'Responda em portugues com uma frase curta dizendo que o teste funcionou.',
                    },
                ],
            }),
        });

        assert.equal(chatResponse.status, 200);
        assert.match(chatResponse.headers.get('content-type'), /text\/event-stream/);

        const streamText = await chatResponse.text();
        assert.match(streamText, /data:/);
        assert.match(streamText, /"content":/);
        console.log(`LM Studio model: ${health.lmStudio.selectedModel}`);
        console.log(`Stream sample: ${streamText.slice(0, 300).replace(/\s+/g, ' ')}`);
    } finally {
        await closeServer(backend.server);
    }
});
