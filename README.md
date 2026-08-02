<div align="center">

# 🚀 InsightAI — AI Data Analytics Platform

**Talk to your data in plain English. Driven by an enterprise-grade NL2SQL Engine & Hybrid LLM Routing.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![DuckDB](https://img.shields.io/badge/DuckDB-1.1-FFF000?style=for-the-badge&logo=duckdb&logoColor=black)](https://duckdb.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

---

## 🌟 Overview

**InsightAI** is a next-generation data analytics workspace that transforms natural language questions into accurate SQL, executable analytical pipelines, and rich interactive visualizations. 

Designed for both technical teams and non-technical business analysts, InsightAI features a **Precision-First NL2SQL Engine** with multi-tier fuzzy schema grounding, pre-SQL query validation, and dry-run SQL auto-repair.

### 🛡️ Multi-Provider Hybrid LLM Failover System

```
[ User Query ]
      │
      ▼
┌──────────────┐     Fallback     ┌──────────────┐     Offline     ┌──────────────┐
│  Groq Engine │ ────────────────►│ Gemini 2.0   │ ──────────────►│ Local Ollama │
│ (Llama 3.3)  │   (API Error)    │  (Flash/Pro) │   (No Network) │ (Qwen/DeepS) │
└──────────────┘                  └──────────────┘                 └──────────────┘
```

1. **Groq (Llama 3.3 70B)** — Ultra-fast primary inference for low-latency query generation.
2. **Google Gemini (2.0 Flash / Pro)** — Deep logical reasoning for complex analytical queries.
3. **Local Ollama (Qwen 2.5 / DeepSeek-R1)** — 100% offline fallback ensuring strict privacy and zero downtime.

---

## 📸 Screenshots

<div align="center">

### 📊 Landing Page & Analytics Console
![Landing Page](screenshots/landing_page.png)

### 📈 Interactive Dashboards & Smart Visualizations
![Dashboard](screenshots/dashboard.png)

### 🔒 Authentication & Workspace Management
![Sign In Page](screenshots/sign_in_page.png)

</div>

---

## 📁 Repository Structure

The workspace is organized into clean, decoupled **Frontend** and **Backend** modules:

```text
insightai-–-ai-data-analytics/
├── frontend/                     # React 19 + TypeScript + Vite Application
│   ├── src/                      # UI Components, State Management & Hooks
│   ├── index.html                # Entry point HTML
│   ├── vite.config.ts            # Vite bundler configuration
│   ├── tsconfig.json             # TypeScript configuration
│   ├── server.ts                 # Dev / Production server wrapper
│   ├── package.json              # Frontend dependencies
│   └── node_modules/             # Node packages
│
├── backend/                      # FastAPI + DuckDB Analytical Engine
│   ├── main.py                   # FastAPI server entry point
│   ├── config.py                 # Pydantic Settings & Environment loader
│   ├── database.py               # SQLite / PostgreSQL persistence layer
│   ├── routes/                   # API routes (analytics, datasets, intelligence)
│   ├── services/                 # Business logic, profilers & capability discovery
│   ├── nl2sql_engine/            # Multi-stage NL2SQL Pipeline (Parser, Resolver, Validator)
│   ├── tests/                    # Comprehensive Pytest test suite (200+ tests)
│   ├── requirements.txt          # Python dependencies
│   └── .venv/                    # Python virtual environment
│
├── .env.example                  # Environment configuration template
├── README.md                     # Project documentation
└── render.yaml / vercel.json     # Deployment configurations
```

---

## ✨ Core Features

| Feature | Description |
| :--- | :--- |
| **🧠 Precision NL2SQL Engine** | Multi-stage pipeline: Intent Parsing ➔ Schema Grounding ➔ Query IR ➔ SQL Generation ➔ Dry-Run Auto-Repair. |
| **⚡ DuckDB In-Memory Execution** | Analytical query execution engine capable of scanning millions of rows in milliseconds. |
| **📊 Smart Auto-Visualizations** | Automated chart type detection (Bar, Line, Area, Scatter, Pie, KPI Cards) based on query semantics. |
| **🔍 Dataset Profiler & Discovery** | Automatic column classification, data health checks, distribution detection, and capability suggestion. |
| **📂 Multi-Format Ingestion** | Support for CSV, Excel (`.xlsx`, `.xls`), SQLite, and direct PostgreSQL database connections. |
| **🔐 Supabase & SQLite Persistence** | Secure multi-tenant workspace state, query history, saved dashboards, and user preferences. |

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: React 19 + TypeScript 5.7 + Vite 6
- **Styling**: Tailwind CSS 4 + Lucide Icons + Framer Motion
- **Visualization**: Recharts + Custom Canvas Renderers
- **State & Utilities**: Zustand / React Hooks + TanStack Query

### **Backend**
- **Core Server**: Python 3.12 + FastAPI + Uvicorn
- **Engine**: DuckDB 1.1 + Pandas + NumPy + Polars
- **Persistence**: SQLAlchemy 2 + SQLite / PostgreSQL (Supabase)
- **AI/LLM Integrations**: Groq SDK + Google GenAI SDK + Ollama API

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.10+)
- [Ollama](https://ollama.ai/) *(Optional, for local offline LLM support)*

---

### 1. Environment Setup

Copy `.env.example` to `.env` in the root folder:

```bash
cp .env.example .env
```

Configure your LLM provider API keys in `.env`:

```env
# LLM Provider Configuration (groq | gemini | ollama)
LLM_PROVIDER=groq
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_HOST=http://localhost:11434

# API Keys
GROQ_API_KEY="your_groq_api_key"
GEMINI_API_KEY="your_gemini_api_key"

# Database Persistence
SUPABASE_DATABASE_URL="postgresql://user:password@host:6543/postgres"
```

---

### 2. Frontend Setup

Navigate to the `frontend/` directory and install Node dependencies:

```bash
cd frontend
npm install
npm run dev
```

The frontend will start at **`http://localhost:5173`**.

---

### 3. Backend Setup

Navigate to the `backend/` directory, set up the virtual environment, and start the FastAPI server:

```bash
cd backend

# Create virtual environment (if not already present)
python -m venv .venv

# Activate environment (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
uvicorn main:app --reload --port 8000
```

The API documentation will be available interactive at **`http://localhost:8000/docs`**.

---

## 🧪 Running Tests

InsightAI includes a complete Pytest test suite covering NL2SQL parsing, schema resolution, and analytical routing:

```bash
cd backend
python -m pytest tests/ -v
```

---

<div align="center">

### 💡 Contributing & License

Contributions are welcome! Please open an issue or pull request to suggest features or fixes.

Distributed under the MIT License. Built with ❤️ for AI-Driven Data Analytics.

</div>
