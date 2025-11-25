# AI Researcher

An autonomous AI researcher built with **Vite + React + Node.js**. It takes a research objective, breaks it into experiments, spins up separate agents with access to their own GPUs to run these experiments, and delivers a paper-style writeup with findings.

## Architecture
- **Frontend**: Vite + React + TypeScript (root level)
- **Backend**: Node.js + Express API server (`server/` directory)
- **Research Engine**: Python scripts in `backup/` folder (orchestrator, agents, etc.)

## How it Works
- Decomposes your prompt into experiments and assigns them to specialist researcher agents.
- Each agent can launch GPU-enabled sandboxes to train models/run inference/etc., evaluate, and collect evidence.
- Based on the results of these experiments, the orchestrator can decide to finalize, or run more experiments.
- The orchestrator goes over all of the results and turns them into a coherent "paper".

## Quick Start
```bash
npm run setup    # Install all dependencies (frontend, server, Python)
npm run dev      # Start Vite frontend + Node.js API server
```
This installs all dependencies and starts both the Vite dev server (port 5173) and Node.js API server (port 8000).

## Keys Needed
- **LLM key** (at least one):
  - Google AI Studio: `GOOGLE_API_KEY` (for Gemini 3 Pro)
  - Anthropic: `ANTHROPIC_API_KEY` (for Claude Opus 4.5)
- **Modal tokens**: `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` (for GPU sandboxes)
- Add them to `.env` in the repo root, or paste them into the web prompt when asked.

## Model Selection
Choose between **Gemini 3 Pro** and **Claude Opus 4.5** from the dropdown in the web UI, or via CLI with `--model`.

## Development Commands
```bash
npm run dev              # Start both API server and Vite dev server
npm run api              # Start only the Node.js API server
npm run build            # Build frontend and server for production
npm run start            # Start production server
npm run lint             # Lint the frontend code
npm run typecheck        # TypeScript type checking
```

## Optional CLI (Python scripts in backup/)
The research engine can still be run directly via Python CLI:
```bash
cd backup
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py "Does label smoothing improve ViT-Base on CIFAR-10?" --mode single --gpu any --model gemini-3-pro-preview
```

## Deploy to Railway
One-click deploy to Railway:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new?template=https://github.com/mattshumer/ai-researcher)

Or manually:
1. Fork this repo
2. Create a new Railway project from GitHub
3. Add environment variables: `GOOGLE_API_KEY` or `ANTHROPIC_API_KEY`, plus `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`
4. Deploy — Railway will build the frontend and start the API automatically

## Status/Contribution
This is a super-early, experimental harness. There are a number of improvements to be worked out (i.e. dataset sharing between agents, key management, etc.), literature search, that would make this way more capable. If anyone wants to add these in, feel free!