const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

function readInt(name, fallback, min = 0) {
    const rawValue = process.env[name];
    if (!rawValue) return fallback;

    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < min) return fallback;
    return parsed;
}

function readFloat(name, fallback, min = 0, max = 2) {
    const rawValue = process.env[name];
    if (!rawValue) return fallback;

    const parsed = Number.parseFloat(rawValue);
    if (Number.isNaN(parsed) || parsed < min || parsed > max) return fallback;
    return parsed;
}

function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}

const LM_STUDIO_BASE_URL = trimTrailingSlash(
    process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234'
);

module.exports = {
    HOST: process.env.HOST || '0.0.0.0',
    PORT: readInt('PORT', 4000, 1),
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    LM_STUDIO_BASE_URL,
    LM_STUDIO_CHAT_URL: process.env.LM_STUDIO_CHAT_URL || `${LM_STUDIO_BASE_URL}/v1/chat/completions`,
    LM_STUDIO_MODELS_URL: process.env.LM_STUDIO_MODELS_URL || `${LM_STUDIO_BASE_URL}/v1/models`,
    LM_STUDIO_LOCAL_MODELS_URL: process.env.LM_STUDIO_LOCAL_MODELS_URL || `${LM_STUDIO_BASE_URL}/api/v1/models`,
    LM_STUDIO_LOAD_MODEL_URL: process.env.LM_STUDIO_LOAD_MODEL_URL || `${LM_STUDIO_BASE_URL}/api/v1/models/load`,
    MAX_CONTEXT_MESSAGES: readInt('MAX_CONTEXT_MESSAGES', 20, 1),
    MAX_MESSAGE_CHARS: readInt('MAX_MESSAGE_CHARS', 20000, 100),
    MAX_REQUEST_BODY_SIZE: process.env.MAX_REQUEST_BODY_SIZE || '1mb',
    DEFAULT_MODEL_IDENTIFIER: process.env.LM_STUDIO_MODEL || 'auto',
    LM_STUDIO_TIMEOUT_MS: readInt('LM_STUDIO_TIMEOUT_MS', 30000, 1000),
    LM_STUDIO_MAX_TOKENS: readInt('LM_STUDIO_MAX_TOKENS', 512, 1),
    LM_STUDIO_TEMPERATURE: readFloat('LM_STUDIO_TEMPERATURE', 0.7, 0, 2),
};
