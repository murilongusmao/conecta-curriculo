# Conecta Carreira TI

Aplicação web do **Projeto de Extensão Conecta Comunidade** (ODS 4 e ODS 8) para ajudar estudantes de Tecnologia da Informação (TI) a preparar currículos compatíveis com sistemas **ATS (Gupy, CIEE, Indeed)**, otimizar o **LinkedIn** e coletar **feedback online** para apresentação ao professor.

## Estrutura do Projeto

- `index.html`, `styles.css`, `analyzer.js`, `app.js` — Aplicação web estática (pronta para GitHub Pages).
- `worker/worker.js` — Backend gratuito para **Cloudflare Workers** chamando a **Gemini API** (`gemini-2.5-flash`).
- `api/analyze.js` — Alternativa equivalente para **Vercel Serverless Functions**.
- `google-apps-script/Code.gs` — Script para conectar o formulário da Aba 4 a uma planilha do **Google Sheets**.

---

## 1. Conectar a Pesquisa de Feedback ao Google Sheets (2 minutos)

1. Crie uma nova planilha no [Google Sheets](https://sheets.google.com).
2. No menu superior, acesse **Extensões → Apps Script**.
3. Apague o conteúdo padrão e cole todo o código de [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
4. Clique em **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
5. Autorize o acesso e copie a **URL do App da Web** (`https://script.google.com/macros/s/.../exec`).

---

## 2. Conectar a Análise Real com IA (Gemini API gratuita)

1. Gere uma chave gratuita no [Google AI Studio](https://aistudio.google.com/apikey).
2. Escolha **uma** das duas opções gratuitas abaixo para proteger sua chave:

### Opção A: Cloudflare Workers (recomendado)
1. Acesse o painel da [Cloudflare](https://dash.cloudflare.com) → **Workers & Pages → Create Worker**.
2. Cole o código de [`worker/worker.js`](worker/worker.js) e clique em **Deploy**.
3. Vá em **Settings → Variables and Secrets → Add**:
   - Nome: `GEMINI_API_KEY` | Valor: sua chave do Google AI Studio (marque como **Encrypt**).
4. Copie a URL do Worker (ex.: `https://conecta-carreira-ai.seu-usuario.workers.dev`).

### Opção B: Vercel
1. Suba este repositório no GitHub e importe na [Vercel](https://vercel.com).
2. Em **Settings → Environment Variables**, adicione `GEMINI_API_KEY` com sua chave do Google AI Studio.
3. A rota ficará disponível em `https://seu-projeto.vercel.app/api/analyze`.

---

## 3. Publicar no GitHub Pages

1. Abra [`app.js`](app.js) e preencha as duas constantes no topo (opcional — também é possível colar pelo botão **"Configurar IA & Sheets"** no site):
   ```js
   const DEFAULT_AI_ENDPOINT = 'https://sua-url-worker-ou-vercel';
   const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/.../exec';
   ```
2. Envie os arquivos para um repositório público no GitHub.
3. No repositório, vá em **Settings → Pages → Branch: `main` (pasta `/root`) → Save**.
4. Compartilhe o link do GitHub Pages com os participantes da oficina!
