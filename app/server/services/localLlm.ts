import axios from "axios";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

export interface LocalLlmConfig {
  enabled: boolean;
  serverPath: string;
  modelPath: string;
  modelName: string;
  host: string;
  port: number;
  ctxSize: number;
  timeoutMs: number;
  startupTimeoutMs: number;
  maxTokens: number;
  temperature: number;
}

let llamaProcess: ChildProcess | null = null;
let startupPromise: Promise<void> | null = null;
let lastOutput = "";

export function getLocalLlmConfig(): LocalLlmConfig {
  return {
    enabled: parseBoolean(process.env.LOCAL_LLM_ENABLED, true),
    serverPath: process.env.LLAMA_CPP_SERVER_PATH?.trim() || findBundledFile(["tools", "llama.cpp", "llama-server.exe"]),
    modelPath: process.env.LOCAL_LLM_MODEL_PATH?.trim() || findBundledFile(["models", "gemma3-1b.gguf"]),
    modelName: process.env.LOCAL_LLM_MODEL_NAME?.trim() || "local-llama-cpp",
    host: process.env.LOCAL_LLM_HOST?.trim() || "127.0.0.1",
    port: parseNumber(process.env.LOCAL_LLM_PORT, 8081),
    ctxSize: parseNumber(process.env.LOCAL_LLM_CTX_SIZE, 4096),
    timeoutMs: parseNumber(process.env.LOCAL_LLM_TIMEOUT_MS, 90000),
    startupTimeoutMs: parseNumber(process.env.LOCAL_LLM_STARTUP_TIMEOUT_MS, 120000),
    maxTokens: parseNumber(process.env.LOCAL_LLM_MAX_TOKENS, 2200),
    temperature: parseFloat(process.env.LOCAL_LLM_TEMPERATURE || "0.1"),
  };
}

function findBundledFile(parts: string[]): string {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const candidates = [
    path.resolve(process.cwd(), ...parts),
    resourcesPath ? path.resolve(resourcesPath, ...parts) : "",
    resourcesPath ? path.resolve(resourcesPath, "app", ...parts) : "",
  ].filter(Boolean);

  return candidates.find(candidate => fs.existsSync(candidate)) || "";
}

export function isLocalLlmConfigured(config = getLocalLlmConfig()): boolean {
  return Boolean(config.enabled && config.serverPath && config.modelPath);
}

export function getLocalLlmBaseUrl(config = getLocalLlmConfig()): string {
  return `http://${config.host}:${config.port}`;
}

export async function completeWithLocalLlm(prompt: string): Promise<string> {
  const config = getLocalLlmConfig();

  if (!isLocalLlmConfigured(config)) {
    throw new Error("Local LLM is not configured. Set LLAMA_CPP_SERVER_PATH and LOCAL_LLM_MODEL_PATH.");
  }

  await ensureLocalLlmReady(config);

  const response = await axios.post(
    `${getLocalLlmBaseUrl(config)}/v1/chat/completions`,
    {
      model: config.modelName,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a local offline project analysis assistant. Return only valid JSON with no markdown, no code fences, and no extra text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    },
    {
      timeout: config.timeoutMs,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Local LLM returned an empty response.");
  }

  return content;
}

export function shutdownLocalLlm(): void {
  if (llamaProcess) {
    llamaProcess.kill();
    llamaProcess = null;
  }
  startupPromise = null;
}

async function ensureLocalLlmReady(config: LocalLlmConfig): Promise<void> {
  if (await isServerReachable(config)) {
    return;
  }

  if (startupPromise) {
    return startupPromise;
  }

  startupPromise = startLocalLlm(config).catch(err => {
    startupPromise = null;
    throw err;
  });
  return startupPromise;
}

async function startLocalLlm(config: LocalLlmConfig): Promise<void> {
  validateLocalLlmPaths(config);

  lastOutput = "";
  const args = [
    "--model",
    config.modelPath,
    "--host",
    config.host,
    "--port",
    String(config.port),
    "--ctx-size",
    String(config.ctxSize),
  ];

  llamaProcess = spawn(config.serverPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  llamaProcess.stdout?.on("data", (data: { toString(): string }) => appendOutput(data.toString()));
  llamaProcess.stderr?.on("data", (data: { toString(): string }) => appendOutput(data.toString()));

  llamaProcess.once("exit", (code: number | null, signal: string | null) => {
    appendOutput(`llama.cpp exited with code ${code ?? "null"} and signal ${signal ?? "null"}`);
    llamaProcess = null;
    startupPromise = null;
  });

  llamaProcess.once("error", (err: Error) => {
    appendOutput(err.message);
    llamaProcess = null;
    startupPromise = null;
  });

  try {
    await waitForServer(config);
  } catch (err) {
    shutdownLocalLlm();
    throw err;
  }
}

function validateLocalLlmPaths(config: LocalLlmConfig): void {
  if (!fs.existsSync(config.serverPath)) {
    throw new Error(`llama.cpp server executable was not found: ${config.serverPath}`);
  }

  if (!fs.existsSync(config.modelPath)) {
    throw new Error(`Local LLM model file was not found: ${config.modelPath}`);
  }
}

async function waitForServer(config: LocalLlmConfig): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < config.startupTimeoutMs) {
    if (await isServerReachable(config)) {
      return;
    }

    if (!llamaProcess) {
      throw new Error(`llama.cpp stopped before becoming ready. ${lastOutput}`.trim());
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for llama.cpp to start. ${lastOutput}`.trim());
}

async function isServerReachable(config: LocalLlmConfig): Promise<boolean> {
  try {
    const response = await axios.get(`${getLocalLlmBaseUrl(config)}/health`, {
      timeout: 2000,
      validateStatus: () => true,
    });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

function appendOutput(output: string): void {
  lastOutput = `${lastOutput}${output}`.slice(-4000);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
