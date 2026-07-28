<div align="center">
  # 🚀 InsightAI - Next-Gen AI Data Analytics
  
  **Talk to your database using Natural Language. Powered by Groq, Gemini, and Local Ollama Fallbacks.**
  
  <p align="center">
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
    <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  </p>
</div>

---

## 🌟 Overview

**InsightAI** is an intelligent, high-performance data analytics workspace that bridges the gap between raw data and actionable business insights. It allows non-technical users and enterprise analysts to query complex datasets using **natural language (NL2SQL)**, instantly generating accurate SQL queries, explanations, and beautiful visualizations.

The platform utilizes a **Hybrid Multi-Agent LLM Architecture** for maximum reliability and speed:
1. **Groq (Llama 3)** - For ultra-fast, high-speed initial inference.
2. **Google Gemini (2.0 / 2.5 Pro)** - For deep reasoning and complex queries.
3. **Ollama (Qwen3:8b)** - A 100% local, offline fallback engine ensuring the system never goes down even without internet.

---

## 📸 Screenshots

### 📊 Landing Page
![Landing Page](screenshots/landing_page.png)

(screenshots/dashboard.png)

### 💬 Sign In Page
![Sign In Page](screenshots/sign_in_page.png)

### 📈 Dashboard
![Dashboard](screenshots/dashboard.png)

---

## ✨ Core Features

- **🧠 Natural Language to SQL (NL2SQL)**: Ask questions in plain English and instantly get optimized SQL queries executed against your dataset.
- **🛡️ Hybrid LLM Fallback System**: Seamlessly shifts between Groq (Speed) -> Gemini (Reasoning) -> Local Ollama (Offline capability).
- **📊 Auto-Visualizations**: Automatically determines the best chart type (bar, line, pie, area) for your query results.
- **☁️ Supabase Integration**: Cloud PostgreSQL persistence for workspaces, query history, and saved dashboards.
- **🗂️ Multi-Source Support**: Import data via CSV, Excel, SQLite, or direct PostgreSQL connections.
- **⚡ In-Memory Engine**: Uses DuckDB/AlaSQL on the backend for lightning-fast analysis of uploaded datasets.

---

## 🛠️ Architecture

The project is built on a high-performance modern web stack:

- **Frontend**: React 19, Vite, Tailwind CSS 4, Recharts, Framer Motion.
- **Backend**: Python, FastAPI, Uvicorn, SQLAlchemy.
- **AI/LLM Stack**: Groq SDK, Google Generative AI SDK, local `ollama-python`.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (3.10+)
- [Ollama](https://ollama.ai/) (Optional, for offline fallback)

### 1. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/Nikhil9897/Insight-AI.git
cd Insight-AI

# Install frontend & Node dependencies
npm install

# (Optional) The backend Python virtual environment will be created automatically 
# upon the first run, or you can set it up manually.
```

### 2. Environment Variables

Rename `.env.example` to `.env` and configure your API keys:

```env
# LLM Provider Configuration
LLM_PROVIDER=groq
OLLAMA_MODEL=qwen3:8b
OLLAMA_HOST=http://localhost:11434

# API Keys
GROQ_API_KEY="your_groq_api_key"
GEMINI_API_KEY="your_gemini_api_key"

# Database
SUPABASE_DATABASE_URL="postgresql://user:password@host:6543/postgres"
```

### 3. Run the App

Start both the Vite frontend and FastAPI backend concurrently:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port specified by Vite), and the API documentation is available at `http://localhost:3000/docs`.

---
<div align="center">
<i>Built with ❤️ for AI-Driven Data Analytics.</i>
</div>
