const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const {
  CORS_ORIGIN,
  DEFAULT_MODEL_IDENTIFIER,
  FRONTEND_HOST,
  FRONTEND_PORT,
  HOST,
  LM_STUDIO_BASE_URL,
  MAX_REQUEST_BODY_SIZE,
  PORT,
} = require('./config/ServerConfig');
const { getServerUrls } = require('./config/networkUrls');
const chatRoutes = require('./routes/chat');
const { chatQueue } = require('./services/chatQueue');
const {
  getActiveModelIdentifier,
  getLocalModels,
  getModels,
  resolveModelIdentifier,
} = require('./services/lmstudioService');

function parseCorsOrigin(value) {
  if (!value || value === '*') return true;
  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function getFrontendDistPath() {
  return path.resolve(__dirname, '../frontend/dist');
}

function hasFrontendBuild() {
  return fs.existsSync(getFrontendDistPath());
}

function getRequestPort(req, fallback) {
  const hostHeader = req.get('host') || '';
  const port = Number.parseInt(hostHeader.split(':').at(-1), 10);
  return Number.isNaN(port) ? fallback : port;
}

function renderMissingFrontendPage({ backendUrls, frontendUrls }) {
  const renderLinks = (urls) => urls
    .map(({ label, url }) => `<li><a href="${url}">${label}: ${url}</a></li>`)
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chat LLM Local</title>
  <style>
    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #eef1f3;
      color: #17211f;
    }
    main {
      width: min(760px, calc(100% - 32px));
      margin: 48px auto;
      padding: 24px;
      border: 1px solid #d7dfdc;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 22px 60px rgba(24, 34, 31, 0.12);
    }
    h1 { margin: 0 0 8px; font-size: 1.45rem; }
    h2 { margin: 22px 0 8px; font-size: 0.92rem; text-transform: uppercase; color: #60706c; }
    p { color: #60706c; line-height: 1.5; }
    code {
      padding: 2px 5px;
      border-radius: 5px;
      background: #edf3f1;
      color: #0b5f59;
    }
    ul { padding-left: 20px; line-height: 1.9; }
    a { color: #0b5f59; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>Servidor do Chat LLM esta funcionando.</h1>
    <p>O build do frontend ainda nao foi encontrado. Para servir a interface por este mesmo endereco, rode <code>npm run serve</code> na raiz do projeto.</p>

    <h2>Frontend em desenvolvimento</h2>
    <ul>${renderLinks(frontendUrls)}</ul>

    <h2>Backend/API</h2>
    <ul>${renderLinks(backendUrls)}</ul>
  </main>
</body>
</html>`;
}

function createApp() {
  const app = express();
  const frontendDistExists = hasFrontendBuild();

  app.use(cors({ origin: parseCorsOrigin(CORS_ORIGIN) }));
  app.use(express.json({ limit: MAX_REQUEST_BODY_SIZE }));

  app.get('/health', async (req, res) => {
    try {
      const models = await getModels();
      res.status(200).json({
        status: 'ok',
        lmStudio: {
          reachable: true,
          baseUrl: LM_STUDIO_BASE_URL,
          activeModel: getActiveModelIdentifier(),
          selectedModel: await resolveModelIdentifier(),
          models,
        },
      });
    } catch (error) {
      res.status(503).json({
        status: 'degraded',
        lmStudio: {
          reachable: false,
          baseUrl: LM_STUDIO_BASE_URL,
          error: error.message,
        },
      });
    }
  });

  app.get('/models', async (req, res) => {
    try {
      const localModels = await getLocalModels();
      const activeModel = getActiveModelIdentifier() || await resolveModelIdentifier();
      res.status(200).json({
        activeModel,
        models: localModels,
      });
    } catch (error) {
      res.status(502).json({ error: 'Falha ao consultar modelos do LM Studio.', detail: error.message });
    }
  });

  app.get('/queue', (req, res) => {
    res.status(200).json(chatQueue.getSnapshot());
  });

  app.post('/models/load', async (req, res) => {
    try {
      const modelId = req.body?.model;
      if (!modelId || typeof modelId !== 'string') {
        return res.status(400).json({ error: 'Model id is required.' });
      }

      const localModels = await getLocalModels();
      const model = localModels.find((candidate) => candidate.id === modelId);

      if (!model) {
        return res.status(404).json({ error: `Model "${modelId}" was not found among local LM Studio LLM models.` });
      }

      return res.status(200).json({
        status: 'selected',
        model,
        activeModel: model.id,
        message: 'Modelo selecionado. Ele sera carregado quando a mensagem chegar na fila.',
      });
    } catch (error) {
      res.status(502).json({ error: 'Falha ao validar modelo no LM Studio.', detail: error.message });
    }
  });

  app.get('/api/config', (req, res) => {
    res.status(200).json({
      lmStudioBaseUrl: LM_STUDIO_BASE_URL,
      model: DEFAULT_MODEL_IDENTIFIER,
      activeModel: getActiveModelIdentifier(),
      streaming: true,
    });
  });

  app.get('/api/network', (req, res) => {
    const backendPort = getRequestPort(req, PORT);
    const backendUrls = getServerUrls({ host: HOST, port: backendPort });
    const frontendUrls = frontendDistExists
      ? backendUrls
      : getServerUrls({ host: FRONTEND_HOST, port: FRONTEND_PORT });

    res.status(200).json({
      mode: frontendDistExists ? 'integrated' : 'development',
      backendUrls,
      frontendUrls,
      lmStudioBaseUrl: LM_STUDIO_BASE_URL,
    });
  });

  app.use('/', chatRoutes);

  const frontendDist = getFrontendDistPath();
  if (frontendDistExists) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      const backendPort = getRequestPort(req, PORT);
      const backendUrls = getServerUrls({ host: HOST, port: backendPort });
      const frontendUrls = getServerUrls({ host: FRONTEND_HOST, port: FRONTEND_PORT });
      res.status(200).type('html').send(renderMissingFrontendPage({ backendUrls, frontendUrls }));
    });
  }

  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Payload muito grande para este servidor.' });
    }

    return next(err);
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const server = app.listen(PORT, HOST, () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : PORT;
    const urls = getServerUrls({ host: HOST, port });
    const frontendUrls = hasFrontendBuild()
      ? urls
      : getServerUrls({ host: FRONTEND_HOST, port: FRONTEND_PORT });

    console.log('Servidor backend iniciado com sucesso.');
    console.log('Enderecos do backend:');
    for (const { label, url } of urls) {
      console.log(`  ${label}: ${url}`);
    }
    console.log(hasFrontendBuild() ? 'Enderecos do frontend:' : 'Enderecos esperados do frontend dev:');
    for (const { label, url } of frontendUrls) {
      console.log(`  ${label}: ${url}`);
    }
    console.log('Modo: Streaming habilitado');
    console.log(`LM Studio: ${LM_STUDIO_BASE_URL}`);
    console.log(`Modelo: ${DEFAULT_MODEL_IDENTIFIER}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Porta ${PORT} ja esta em uso em ${HOST}. Encerre o processo atual ou altere PORT no .env.`);
      process.exit(1);
    }

    throw error;
  });
}

module.exports = { createApp };
