const http = require('http');
const assert = require('node:assert/strict');
const test = require('node:test');

function startServer(handler) {
    const server = http.createServer(handler);

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

async function startFakeLmStudio() {
    let activeModel = 'fake-gemma-model';
    const stats = {
        inFlight: 0,
        maxInFlight: 0,
        startedPrompts: [],
        startedModels: [],
        unloads: 0,
        loads: 0,
    };

    const serverInfo = await startServer((req, res) => {
        if (req.method === 'GET' && req.url === '/v1/models') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: [{ id: activeModel, object: 'model' }] }));
            return;
        }

        if (req.method === 'GET' && req.url === '/api/v1/models') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                models: [
                    {
                        type: 'llm',
                        key: 'fake-gemma-model',
                        display_name: 'Fake Gemma',
                        publisher: 'fake',
                        quantization: { name: 'Q4_K_M' },
                        params_string: '1B',
                        loaded_instances: activeModel === 'fake-gemma-model' ? [{ id: 'fake-gemma-model' }] : [],
                        max_context_length: 4096,
                        variants: ['fake-gemma-model@q4_k_m'],
                        selected_variant: 'fake-gemma-model@q4_k_m',
                    },
                    {
                        type: 'llm',
                        key: 'fake-alt-model',
                        display_name: 'Fake Alt',
                        publisher: 'fake',
                        quantization: { name: 'Q4_K_M' },
                        params_string: '2B',
                        loaded_instances: activeModel === 'fake-alt-model' ? [{ id: 'fake-alt-model' }] : [],
                        max_context_length: 8192,
                        variants: ['fake-alt-model@q4_k_m'],
                        selected_variant: 'fake-alt-model@q4_k_m',
                    },
                ],
            }));
            return;
        }

        if (req.method === 'POST' && req.url === '/api/v1/models/load') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                const payload = JSON.parse(body);
                assert.match(payload.model, /^fake-(gemma|alt)-model$/);
                activeModel = payload.model;
                stats.loads += 1;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    type: 'llm',
                    instance_id: `${activeModel}:1`,
                    load_time_seconds: 0.01,
                    status: 'loaded',
                }));
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/api/v1/models/unload') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                const payload = JSON.parse(body);
                assert.equal(payload.instance_id, activeModel);
                activeModel = null;
                stats.unloads += 1;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'unloaded' }));
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/v1/chat/completions') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                const payload = JSON.parse(body);
                assert.equal(payload.model, activeModel);
                assert.equal(payload.stream, true);
                const prompt = payload.messages.at(-1)?.content || '';
                const delayMs = prompt.includes('primeira concorrente') ? 150 : 0;
                let counted = true;

                stats.inFlight += 1;
                stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
                stats.startedPrompts.push(prompt);
                stats.startedModels.push(payload.model);

                const finishCount = () => {
                    if (!counted) return;
                    counted = false;
                    stats.inFlight -= 1;
                };

                res.on('finish', finishCount);
                res.on('close', finishCount);

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                });
                res.write('data: {"choices":[{"delta":{"content":"OK"}}]}\n\n');
                setTimeout(() => {
                    res.end('data: [DONE]\n\n');
                }, delayMs);
            });
            return;
        }

        res.writeHead(404);
        res.end();
    });

    return { ...serverInfo, stats };
}

test('backend validates requests and proxies LM Studio streams', { timeout: 10000 }, async () => {
    const fakeLmStudio = await startFakeLmStudio();
    process.env.LM_STUDIO_BASE_URL = fakeLmStudio.url;
    process.env.LM_STUDIO_MODEL = 'auto';
    process.env.LM_STUDIO_MAX_TOKENS = '32';

    const { createApp } = require('../server');
    const backend = await startServer(createApp());

    try {
        const healthResponse = await fetch(`${backend.url}/health`);
        assert.equal(healthResponse.status, 200);
        const health = await healthResponse.json();
        assert.equal(health.status, 'ok');
        assert.equal(health.lmStudio.selectedModel, 'fake-gemma-model');

        const modelsResponse = await fetch(`${backend.url}/models`);
        assert.equal(modelsResponse.status, 200);
        const models = await modelsResponse.json();
        assert.equal(models.models[0].id, 'fake-gemma-model');
        assert.equal(models.models[1].id, 'fake-alt-model');

        const invalidResponse = await fetch(`${backend.url}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [] }),
        });
        assert.equal(invalidResponse.status, 400);

        const chatResponse = await fetch(`${backend.url}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'Diga OK' }] }),
        });
        assert.equal(chatResponse.status, 200);
        assert.match(chatResponse.headers.get('content-type'), /text\/event-stream/);

        const streamText = await chatResponse.text();
        assert.match(streamText, /"OK"/);
        assert.match(streamText, /\[DONE\]/);

        const loadResponse = await fetch(`${backend.url}/models/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'fake-alt-model' }),
        });
        assert.equal(loadResponse.status, 200);
        const loadResult = await loadResponse.json();
        assert.equal(loadResult.status, 'selected');
        assert.equal(loadResult.activeModel, 'fake-alt-model');

        const secondChatResponse = await fetch(`${backend.url}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'fake-alt-model',
                messages: [{ role: 'user', content: 'Diga OK de novo' }],
            }),
        });
        assert.equal(secondChatResponse.status, 200);
        assert.match(await secondChatResponse.text(), /"OK"/);
        assert.equal(fakeLmStudio.stats.startedModels.at(-1), 'fake-alt-model');

        const firstQueuedChat = fetch(`${backend.url}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'fake-gemma-model',
                messages: [{ role: 'user', content: 'primeira concorrente' }],
            }),
        }).then(async (response) => {
            assert.equal(response.status, 200);
            return response.text();
        });

        const secondQueuedChat = fetch(`${backend.url}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'fake-alt-model',
                messages: [{ role: 'user', content: 'segunda concorrente' }],
            }),
        }).then(async (response) => {
            assert.equal(response.status, 200);
            return response.text();
        });

        const [firstQueuedText, secondQueuedText] = await Promise.all([firstQueuedChat, secondQueuedChat]);
        assert.match(firstQueuedText, /"OK"/);
        assert.match(secondQueuedText, /"OK"/);
        assert.match(secondQueuedText, /"queued"/);
        assert.equal(fakeLmStudio.stats.maxInFlight, 1);
        assert.deepEqual(fakeLmStudio.stats.startedPrompts.slice(-2), [
            'primeira concorrente',
            'segunda concorrente',
        ]);
        assert.deepEqual(fakeLmStudio.stats.startedModels.slice(-2), [
            'fake-gemma-model',
            'fake-alt-model',
        ]);
        assert.ok(fakeLmStudio.stats.unloads >= 2);
        assert.ok(fakeLmStudio.stats.loads >= 2);
    } finally {
        await closeServer(backend.server);
        await closeServer(fakeLmStudio.server);
    }
});
