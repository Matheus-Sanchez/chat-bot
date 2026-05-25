const {
    DEFAULT_MODEL_IDENTIFIER,
    LM_STUDIO_CHAT_URL,
    LM_STUDIO_LOAD_MODEL_URL,
    LM_STUDIO_LOCAL_MODELS_URL,
    LM_STUDIO_MAX_TOKENS,
    LM_STUDIO_MODELS_URL,
    LM_STUDIO_TEMPERATURE,
    LM_STUDIO_TIMEOUT_MS,
    LM_STUDIO_UNLOAD_MODEL_URL,
} = require('../config/ServerConfig');

let cachedAutoModel = null;
let activeModelIdentifier = DEFAULT_MODEL_IDENTIFIER !== 'auto' ? DEFAULT_MODEL_IDENTIFIER : null;

function ensureFetchAvailable() {
    if (typeof fetch !== 'function') {
        throw new Error('Node.js 20+ is required because this backend uses the native fetch API.');
    }
}

function withTimeout(signal, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('LM Studio request timed out.')), timeoutMs);

    if (signal) {
        if (signal.aborted) controller.abort(signal.reason);
        signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }

    return {
        signal: controller.signal,
        clear: () => clearTimeout(timeout),
    };
}

async function readErrorBody(response) {
    const text = await response.text();
    return text.length > 1000 ? `${text.slice(0, 1000)}...` : text;
}

function normalizeModels(payload) {
    if (!payload || !Array.isArray(payload.data)) return [];

    return payload.data
        .map((model) => ({
            id: model.id || model.model || model.name,
            object: model.object,
            ownedBy: model.owned_by || model.ownedBy,
        }))
        .filter((model) => Boolean(model.id));
}

function normalizeLocalModels(payload) {
    if (!payload || !Array.isArray(payload.models)) return [];

    return payload.models
        .filter((model) => model.type === 'llm')
        .map((model) => ({
            id: model.key,
            name: model.display_name || model.key,
            publisher: model.publisher,
            type: model.type,
            architecture: model.architecture,
            params: model.params_string,
            quantization: model.quantization?.name,
            sizeBytes: model.size_bytes,
            maxContextLength: model.max_context_length,
            selectedVariant: model.selected_variant,
            variants: model.variants || [],
            loaded: Array.isArray(model.loaded_instances) && model.loaded_instances.length > 0,
            loadedInstances: model.loaded_instances || [],
            capabilities: model.capabilities || {},
        }))
        .filter((model) => Boolean(model.id));
}

async function getModels(options = {}) {
    ensureFetchAvailable();

    const request = withTimeout(options.signal, LM_STUDIO_TIMEOUT_MS);
    try {
        const response = await fetch(LM_STUDIO_MODELS_URL, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: request.signal,
        });

        if (!response.ok) {
            throw new Error(`LM Studio models request failed with status ${response.status}: ${await readErrorBody(response)}`);
        }

        const payload = await response.json();
        return normalizeModels(payload);
    } finally {
        request.clear();
    }
}

async function getLocalModels(options = {}) {
    ensureFetchAvailable();

    const request = withTimeout(options.signal, LM_STUDIO_TIMEOUT_MS);
    try {
        const response = await fetch(LM_STUDIO_LOCAL_MODELS_URL, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: request.signal,
        });

        if (!response.ok) {
            throw new Error(`LM Studio local models request failed with status ${response.status}: ${await readErrorBody(response)}`);
        }

        const payload = await response.json();
        return normalizeLocalModels(payload);
    } finally {
        request.clear();
    }
}

function getActiveModelIdentifier() {
    return activeModelIdentifier || cachedAutoModel;
}

function setActiveModelIdentifier(modelId) {
    activeModelIdentifier = modelId;
    cachedAutoModel = modelId;
    return activeModelIdentifier;
}

async function resolveModelIdentifier(options = {}) {
    if (activeModelIdentifier) {
        return activeModelIdentifier;
    }

    if (DEFAULT_MODEL_IDENTIFIER && DEFAULT_MODEL_IDENTIFIER !== 'auto') {
        return DEFAULT_MODEL_IDENTIFIER;
    }

    if (cachedAutoModel) return cachedAutoModel;

    const localModels = await getLocalModels(options).catch(() => []);
    const loadedLocalModel = localModels.find((model) => model.loaded);
    if (loadedLocalModel) {
        cachedAutoModel = loadedLocalModel.id;
        return cachedAutoModel;
    }

    const openAiModels = await getModels(options);
    if (!openAiModels.length) {
        throw new Error('LM Studio did not report any available models. Load a model or set LM_STUDIO_MODEL in .env.');
    }

    cachedAutoModel = openAiModels[0].id;
    return cachedAutoModel;
}

async function loadModel(modelId, options = {}) {
    ensureFetchAvailable();

    if (!modelId || typeof modelId !== 'string') {
        throw new Error('Model id is required.');
    }

    const localModels = await getLocalModels(options);
    const model = localModels.find((candidate) => candidate.id === modelId);

    if (!model) {
        throw new Error(`Model "${modelId}" was not found among local LM Studio LLM models.`);
    }

    if (model.loaded) {
        setActiveModelIdentifier(model.id);
        return {
            status: 'already-loaded',
            model,
            activeModel: model.id,
        };
    }

    const request = withTimeout(options.signal, Math.max(LM_STUDIO_TIMEOUT_MS, 120000));
    try {
        const response = await fetch(LM_STUDIO_LOAD_MODEL_URL, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: model.id }),
            signal: request.signal,
        });

        if (!response.ok) {
            throw new Error(`LM Studio load model request failed with status ${response.status}: ${await readErrorBody(response)}`);
        }

        const payload = await response.json();
        setActiveModelIdentifier(model.id);

        return {
            status: payload.status || 'loaded',
            instanceId: payload.instance_id,
            loadTimeSeconds: payload.load_time_seconds,
            model,
            activeModel: model.id,
        };
    } finally {
        request.clear();
    }
}

function getLoadedInstanceIds(model) {
    if (!Array.isArray(model.loadedInstances)) return [];

    return model.loadedInstances
        .map((instance) => instance.instance_id || instance.instanceId || instance.id)
        .filter(Boolean);
}

async function unloadModelInstance(instanceId, options = {}) {
    ensureFetchAvailable();

    if (!instanceId || typeof instanceId !== 'string') {
        throw new Error('Model instance id is required.');
    }

    const request = withTimeout(options.signal, Math.max(LM_STUDIO_TIMEOUT_MS, 120000));
    try {
        const response = await fetch(LM_STUDIO_UNLOAD_MODEL_URL, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ instance_id: instanceId }),
            signal: request.signal,
        });

        if (!response.ok) {
            throw new Error(`LM Studio unload model request failed with status ${response.status}: ${await readErrorBody(response)}`);
        }

        return response.json().catch(() => ({ instance_id: instanceId }));
    } finally {
        request.clear();
    }
}

async function unloadLoadedLlmModels(options = {}) {
    const localModels = await getLocalModels(options);
    const loadedInstanceIds = localModels.flatMap(getLoadedInstanceIds);

    for (const instanceId of loadedInstanceIds) {
        await unloadModelInstance(instanceId, options);
    }

    activeModelIdentifier = null;
    cachedAutoModel = null;

    return loadedInstanceIds;
}

async function prepareModelForChat(modelId, options = {}) {
    const requestedModelId = modelId || await resolveModelIdentifier(options);
    const localModels = await getLocalModels(options);
    const model = localModels.find((candidate) => candidate.id === requestedModelId);

    if (!model) {
        throw new Error(`Model "${requestedModelId}" was not found among local LM Studio LLM models.`);
    }

    const unloadedInstances = await unloadLoadedLlmModels(options);
    const loadResult = await loadModel(requestedModelId, options);

    return {
        ...loadResult,
        unloadedInstances,
        activeModel: loadResult.activeModel || requestedModelId,
    };
}

async function streamChatCompletion(messages, options = {}) {
    ensureFetchAvailable();

    const { activeModel: model } = await prepareModelForChat(options.model, options);
    const request = withTimeout(options.signal, LM_STUDIO_TIMEOUT_MS);

    const response = await fetch(LM_STUDIO_CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
        },
        body: JSON.stringify({
            model,
            messages,
            temperature: LM_STUDIO_TEMPERATURE,
            max_tokens: LM_STUDIO_MAX_TOKENS,
            stream: true,
        }),
        signal: request.signal,
    });
    request.clear();

    if (!response.ok) {
        throw new Error(`LM Studio chat request failed with status ${response.status}: ${await readErrorBody(response)}`);
    }

    if (!response.body) {
        throw new Error('LM Studio did not return a readable stream.');
    }

    return { stream: response.body, model };
}

module.exports = {
    getActiveModelIdentifier,
    getLocalModels,
    getModels,
    loadModel,
    prepareModelForChat,
    resolveModelIdentifier,
    setActiveModelIdentifier,
    streamChatCompletion,
    unloadLoadedLlmModels,
    unloadModelInstance,
};
