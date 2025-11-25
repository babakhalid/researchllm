import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const BASE_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(BASE_DIR, '.env');
dotenv.config({ path: ENV_PATH });

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

// Paths
const BACKUP_DIR = path.join(BASE_DIR, 'backup');
const MAIN_PATH = path.join(BACKUP_DIR, 'main.py');
const FRONTEND_DIST = path.join(BASE_DIR, 'dist');

// Helper functions
const stripAnsi = (text: string): string => {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
};

const envValuePresent = (value: string | undefined): boolean => {
  if (!value) return false;
  const cleaned = value.trim();
  if (!cleaned) return false;
  const lower = cleaned.toLowerCase();
  if (lower.startsWith('your_') || lower.endsWith('_here')) return false;
  if (['changeme', 'example'].includes(lower)) return false;
  return true;
};

const persistEnv = (key: string, value: string): void => {
  process.env[key] = value;
  // Simple .env file update (append or update)
  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  }
  const lines = envContent.split('\n');
  const keyIndex = lines.findIndex(line => line.startsWith(`${key}=`));

  if (keyIndex >= 0) {
    lines[keyIndex] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(ENV_PATH, lines.join('\n'));
};

const ensureMainExists = (): void => {
  if (!fs.existsSync(MAIN_PATH)) {
    throw new Error(`main.py not found at expected path: ${MAIN_PATH}`);
  }
};

// Types
interface UserCredentials {
  google_api_key?: string;
  anthropic_api_key?: string;
  modal_token_id?: string;
  modal_token_secret?: string;
}

interface SingleExperimentRequest {
  task: string;
  gpu?: string;
  model?: string;
  test_mode?: boolean;
  credentials?: UserCredentials;
}

interface OrchestratorExperimentRequest {
  task: string;
  gpu?: string;
  model?: string;
  num_agents?: number;
  max_rounds?: number;
  max_parallel?: number;
  test_mode?: boolean;
  credentials?: UserCredentials;
}

interface CredentialUpdateRequest {
  google_api_key?: string;
  anthropic_api_key?: string;
  modal_token_id?: string;
  modal_token_secret?: string;
}

interface SummaryHistoryItem {
  type: 'thought' | 'code' | 'result' | 'text';
  content: string;
}

interface AgentSummaryRequest {
  agent_id: string;
  history: SummaryHistoryItem[];
}

// Build command helpers
const buildSingleCommand = (req: SingleExperimentRequest): string[] => {
  const cmd = [
    'python',
    MAIN_PATH,
    req.task,
    '--mode',
    'single',
    '--model',
    req.model || 'claude-opus-4-5',
  ];
  if (req.gpu) {
    cmd.push('--gpu', req.gpu);
  }
  if (req.test_mode) {
    cmd.push('--test-mode');
  }
  return cmd;
};

const buildOrchestratorCommand = (req: OrchestratorExperimentRequest): string[] => {
  const cmd = [
    'python',
    MAIN_PATH,
    req.task,
    '--mode',
    'orchestrator',
    '--model',
    req.model || 'claude-opus-4-5',
    '--num-agents',
    String(req.num_agents || 3),
    '--max-rounds',
    String(req.max_rounds || 3),
    '--max-parallel',
    String(req.max_parallel || 2),
  ];
  if (req.gpu) {
    cmd.push('--gpu', req.gpu);
  }
  if (req.test_mode) {
    cmd.push('--test-mode');
  }
  return cmd;
};

// Streaming subprocess function
const streamSubprocess = (
  cmd: string[],
  meta: Record<string, any>,
  credentials?: UserCredentials,
  res?: Response
) => {
  ensureMainExists();

  const startedAt = new Date();
  const env = { ...process.env, AI_RESEARCHER_ENABLE_EVENTS: '1' };

  // Override with user credentials if provided
  if (credentials) {
    if (credentials.google_api_key) env.GOOGLE_API_KEY = credentials.google_api_key;
    if (credentials.anthropic_api_key) env.ANTHROPIC_API_KEY = credentials.anthropic_api_key;
    if (credentials.modal_token_id) env.MODAL_TOKEN_ID = credentials.modal_token_id;
    if (credentials.modal_token_secret) env.MODAL_TOKEN_SECRET = credentials.modal_token_secret;
  }

  const proc = spawn(cmd[0], cmd.slice(1), {
    env,
    cwd: BACKUP_DIR,
  });

  if (res) {
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
  }

  const sendEvent = (event: any) => {
    if (res) {
      res.write(JSON.stringify(event) + '\n');
    }
  };

  proc.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line: string) => {
      if (line.trim()) {
        sendEvent({
          type: 'line',
          stream: 'stdout',
          timestamp: new Date().toISOString(),
          raw: line,
          plain: stripAnsi(line),
          ...meta,
        });
      }
    });
  });

  proc.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line: string) => {
      if (line.trim()) {
        sendEvent({
          type: 'line',
          stream: 'stderr',
          timestamp: new Date().toISOString(),
          raw: line,
          plain: stripAnsi(line),
          ...meta,
        });
      }
    });
  });

  proc.on('close', (exitCode) => {
    const finishedAt = new Date();
    sendEvent({
      type: 'summary',
      timestamp: finishedAt.toISOString(),
      exit_code: exitCode,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_seconds: (finishedAt.getTime() - startedAt.getTime()) / 1000,
      ...meta,
    });
    if (res) {
      res.end();
    }
  });

  return proc;
};

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  const exists = fs.existsSync(MAIN_PATH);
  res.json({
    status: exists ? 'ok' : 'error',
    main_py: MAIN_PATH,
    main_py_exists: exists,
  });
});

app.get('/api/state', (_req: Request, res: Response) => {
  res.json({
    status: 'active',
    info: 'Node.js API server running',
  });
});

app.get('/api/credentials/status', (_req: Request, res: Response) => {
  const hasGoogle = envValuePresent(process.env.GOOGLE_API_KEY);
  const hasAnthropic = envValuePresent(process.env.ANTHROPIC_API_KEY);
  const hasModalId = envValuePresent(process.env.MODAL_TOKEN_ID);
  const hasModalSecret = envValuePresent(process.env.MODAL_TOKEN_SECRET);

  res.json({
    has_google_api_key: hasGoogle,
    has_anthropic_api_key: hasAnthropic,
    has_modal_token: hasModalId && hasModalSecret,
  });
});

app.post('/api/credentials', (req: Request, res: Response) => {
  try {
    const body = req.body as CredentialUpdateRequest;

    if (body.google_api_key?.trim()) {
      persistEnv('GOOGLE_API_KEY', body.google_api_key.trim());
    }
    if (body.anthropic_api_key?.trim()) {
      persistEnv('ANTHROPIC_API_KEY', body.anthropic_api_key.trim());
    }
    if (body.modal_token_id?.trim()) {
      persistEnv('MODAL_TOKEN_ID', body.modal_token_id.trim());
    }
    if (body.modal_token_secret?.trim()) {
      persistEnv('MODAL_TOKEN_SECRET', body.modal_token_secret.trim());
    }

    // Return updated status
    const hasGoogle = envValuePresent(process.env.GOOGLE_API_KEY);
    const hasAnthropic = envValuePresent(process.env.ANTHROPIC_API_KEY);
    const hasModalId = envValuePresent(process.env.MODAL_TOKEN_ID);
    const hasModalSecret = envValuePresent(process.env.MODAL_TOKEN_SECRET);

    res.json({
      has_google_api_key: hasGoogle,
      has_anthropic_api_key: hasAnthropic,
      has_modal_token: hasModalId && hasModalSecret,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to persist credentials' });
  }
});

app.post('/api/experiments/single/stream', (req: Request, res: Response) => {
  const body = req.body as SingleExperimentRequest;
  const cmd = buildSingleCommand(body);
  const meta = {
    mode: 'single',
    task: body.task,
    gpu: body.gpu,
    command: cmd,
  };
  streamSubprocess(cmd, meta, body.credentials, res);
});

app.post('/api/experiments/orchestrator/stream', (req: Request, res: Response) => {
  const body = req.body as OrchestratorExperimentRequest;
  const cmd = buildOrchestratorCommand(body);
  const meta = {
    mode: 'orchestrator',
    task: body.task,
    gpu: body.gpu,
    command: cmd,
  };
  streamSubprocess(cmd, meta, body.credentials, res);
});

app.post('/api/agents/summarize', async (req: Request, res: Response) => {
  try {
    const body = req.body as AgentSummaryRequest;

    // Import insights module dynamically
    const { summarize_agent_findings } = await import('./insights.js');
    const result = await summarize_agent_findings(body.agent_id, body.history);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Serve static frontend files
if (fs.existsSync(FRONTEND_DIST)) {
  const assetsPath = path.join(FRONTEND_DIST, 'assets');
  if (fs.existsSync(assetsPath)) {
    app.use('/assets', express.static(assetsPath));
  }
}

// SPA catch-all route
app.get('*', (req: Request, res: Response) => {
  if (fs.existsSync(FRONTEND_DIST)) {
    const filePath = path.join(FRONTEND_DIST, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }

    const indexPath = path.join(FRONTEND_DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }

  res.json({
    message: 'AI Researcher API is running. Frontend not built.',
    docs: '/docs',
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Base directory: ${BASE_DIR}`);
  console.log(`📦 Backup directory: ${BACKUP_DIR}`);
  console.log(`🐍 Python main.py: ${MAIN_PATH}`);
  console.log(`🎨 Frontend dist: ${FRONTEND_DIST}`);
});
