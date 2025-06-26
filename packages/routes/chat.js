// filepath: packages/chat-local-back/routes/chat.js
const express = require('express');
const router = express.Router();
const { handleChat } = require('../controllers/chatController');

// A rota principal de chat
router.post('/chat', handleChat);

module.exports = router;