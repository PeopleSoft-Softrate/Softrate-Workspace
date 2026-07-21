/* === OPENROUTER CONFIG (COMMENTED OUT FOR REUSE) ===
const REQUIRED_ENV_KEYS = [
  'OPENROUTER_API_KEY',
  'OPENROUTER_BASE_URL',
  'OPENROUTER_MODEL',
];

let chatOpenAIImportPromise;

function getAiConfigStatus() {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !String(process.env[key] || '').trim());
  return {
    ok: missing.length === 0,
    missing,
  };
}

function assertAiEnv() {
  const status = getAiConfigStatus();
  if (!status.ok) {
    throw new Error(`AI configuration missing: ${status.missing.join(', ')}`);
  }
}

async function getChatOpenAIClass() {
  if (!chatOpenAIImportPromise) {
    chatOpenAIImportPromise = import('@langchain/openai');
  }

  const mod = await chatOpenAIImportPromise;
  return mod.ChatOpenAI;
}

async function createBaseModel() {
  assertAiEnv();
  const ChatOpenAI = await getChatOpenAIClass();
  const options = arguments[0] || {};

  return new ChatOpenAI({
    model: process.env.OPENROUTER_MODEL,
    apiKey: process.env.OPENROUTER_API_KEY,
    temperature: options.temperature ?? 0.1,
    timeout: options.timeout ?? 60000,
    maxTokens: options.maxTokens ?? 2200,
    streamUsage: false,
    configuration: {
      baseURL: process.env.OPENROUTER_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:4200',
        'X-OpenRouter-Title': 'DealVoice AI Brief',
      },
    },
  });
}
=================================================== */

// === GOOGLE AI STUDIO CONFIG ===
const REQUIRED_ENV_KEYS = [
  'GOOGLE_API_KEY',
];

let chatGoogleImportPromise;

function getAiConfigStatus() {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !String(process.env[key] || '').trim());
  return {
    ok: missing.length === 0,
    missing,
  };
}

function assertAiEnv() {
  const status = getAiConfigStatus();
  if (!status.ok) {
    throw new Error(`AI configuration missing: ${status.missing.join(', ')}`);
  }
}

async function getChatGoogleClass() {
  if (!chatGoogleImportPromise) {
    chatGoogleImportPromise = import('@langchain/google-genai');
  }

  const mod = await chatGoogleImportPromise;
  return mod.ChatGoogleGenerativeAI;
}

async function createBaseModel() {
  assertAiEnv();
  const ChatGoogleGenerativeAI = await getChatGoogleClass();
  const options = arguments[0] || {};

  return new ChatGoogleGenerativeAI({
    model: 'gemini-3.1-flash-lite',
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: options.temperature ?? 0.1,
    maxRetries: 2,
    maxOutputTokens: 8192,
  });
}

async function createStructuredModel(schema, options = {}) {
  const model = await createBaseModel(options);
  return model.withStructuredOutput(schema, {
    name: options.name || 'DealVoiceStructuredOutput',
  });
}

module.exports = {
  assertAiEnv,
  createBaseModel,
  createStructuredModel,
  getAiConfigStatus,
};
