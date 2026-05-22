const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const {
  CORS_ORIGIN,
  DEFAULT_MODEL_IDENTIFIER,
  HOST,
  LM_STUDIO_BASE_URL,
  MAX_REQUEST_BODY_SIZE,
  PORT,
} = require('./config/ServerConfig');
const chatRoutes = require('./routes/chat');
const {
  getActiveModelIdentifier,
  getLocalModels,
  getModels,
  loadModel,
  resolveModelIdentifier,
} = require('./services/lmstudioService');

function parseCorsOrigin(value) {
  if (!value || value === '*') return true;
  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function createApp() {
  const app = express();

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

  app.post('/models/load', async (req, res) => {
    try {
      const result = await loadModel(req.body?.model);
      res.status(200).json(result);
    } catch (error) {
      res.status(502).json({ error: 'Falha ao carregar modelo no LM Studio.', detail: error.message });
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

  app.use('/', chatRoutes);

  const frontendDist = path.resolve(__dirname, '../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.status(200).send('Servidor do Chat LLM esta funcionando.');
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
  app.listen(PORT, HOST, () => {
    console.log('Servidor backend iniciado com sucesso.');
    console.log(`Ouvindo em: http://${HOST}:${PORT}`);
    console.log('Modo: Streaming habilitado');
    console.log(`LM Studio: ${LM_STUDIO_BASE_URL}`);
    console.log(`Modelo: ${DEFAULT_MODEL_IDENTIFIER}`);
  });
}

module.exports = { createApp };
