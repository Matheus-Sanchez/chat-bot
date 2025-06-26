// server.js

// --- 1. Importação das dependências ---
const express = require('express');
const cors = require('cors');
const { PORT, DEFAULT_MODEL_IDENTIFIER } = require('./config/ServerConfig'); // Importa as constantes
const chatRoutes = require('./routes/chat'); // Importa as rotas

// --- 2. Inicialização do Aplicativo ---
const app = express();

// --- 3. Middlewares ---
app.use(cors());
app.use(express.json());

// --- 4. Definição das Rotas da API ---

app.get('/', (req, res) => {
  res.status(200).send('Servidor do Chat LLM está funcionando! 🚀');
});

// Usa as rotas de chat (ex: /chat)
app.use('/', chatRoutes);

// --- 5. Inicialização do Servidor ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend iniciado com sucesso!`);
  console.log(`Ouvindo em: http://localhost:${PORT}`);
  console.log(`Modo: Streaming Habilitado`);
  console.log(`Modelo padrão: "${DEFAULT_MODEL_IDENTIFIER}"`);
});