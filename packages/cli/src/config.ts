import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface CliConfig {
  apiKey?: string;
  baseUrl?: string;
  projectId?: string;
}

const CONFIG_DIR = join(homedir(), '.outserp');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadConfig(): CliConfig {
  // Env vars take precedence
  const envKey = process.env.OUTSERP_API_KEY;
  const envUrl = process.env.OUTSERP_BASE_URL;
  const envProject = process.env.OUTSERP_PROJECT_ID;

  let fileConfig: CliConfig = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
      // Ignore corrupted config
    }
  }

  return {
    apiKey: envKey || fileConfig.apiKey,
    baseUrl: envUrl || fileConfig.baseUrl || 'https://outserp.ai',
    projectId: envProject || fileConfig.projectId,
  };
}

export function saveConfig(config: CliConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function clearConfig(): void {
  if (existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, '{}', 'utf-8');
  }
}
