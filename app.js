// Controlador Principal — Conecta Carreira TI

// Cole aqui suas URLs após publicar o Worker/Vercel e o Google Apps Script (opcional; também pode configurar pela interface)
const DEFAULT_AI_ENDPOINT = 'https://conecta-carreira-ai.murilo-dngusmao.workers.dev';
const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwZ1tQ27IU70Yezoy0ehncT0ifnxwhVH9edSB7TPVR2vlAaf17rmJf1d68pbltsd172/exec';
const CONFIG_STORAGE_KEY = 'conecta_carreira_config_v1';
const ADMIN_PASSWORD = 'conecta2026'; // Altere esta senha se desejar

document.addEventListener('DOMContentLoaded', () => {
  // Configurar worker do PDF.js se disponível
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  let lastPdfPages = 1;

  // --- Gerenciamento de Conexões (IA Gemini + Google Sheets) ---
  function getConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || '{}');
      return {
        aiUrl: (saved.aiUrl || DEFAULT_AI_ENDPOINT || '').trim(),
        sheetsUrl: (saved.sheetsUrl || DEFAULT_SHEETS_URL || '').trim(),
        aiModel: (saved.aiModel || 'gemini-2.5-flash').trim()
      };
    } catch {
      return { aiUrl: DEFAULT_AI_ENDPOINT, sheetsUrl: DEFAULT_SHEETS_URL, aiModel: 'gemini-2.5-flash' };
    }
  }

  const integrationsPanel = document.getElementById('integrations-panel');
  const cfgAiInput = document.getElementById('cfg-ai-url');
  const cfgSheetsInput = document.getElementById('cfg-sheets-url');
  const cfgModelSelect = document.getElementById('cfg-ai-model');
  const cfgStatusMsg = document.getElementById('cfg-status-msg');

  const initialCfg = getConfig();
  cfgAiInput.value = initialCfg.aiUrl;
  cfgSheetsInput.value = initialCfg.sheetsUrl;
  cfgModelSelect.value = initialCfg.aiModel;

  document.getElementById('toggle-config-btn').addEventListener('click', () => {
    if (!integrationsPanel.classList.contains('hidden')) {
      integrationsPanel.classList.add('hidden');
      return;
    }
    const senha = prompt('Digite a senha do organizador para acessar as configurações:');
    if (senha === null) return;
    if (senha === ADMIN_PASSWORD) {
      integrationsPanel.classList.remove('hidden');
      integrationsPanel.scrollIntoView({ behavior: 'smooth' });
    } else {
      alert('Senha incorreta.');
    }
  });

  document.getElementById('close-config-btn').addEventListener('click', () => {
    integrationsPanel.classList.add('hidden');
  });

  document.getElementById('save-config-btn').addEventListener('click', () => {
    const newCfg = {
      aiUrl: cfgAiInput.value.trim(),
      sheetsUrl: cfgSheetsInput.value.trim(),
      aiModel: cfgModelSelect.value
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newCfg));
    cfgStatusMsg.textContent = 'Conexões salvas neste navegador!';
    setTimeout(() => (cfgStatusMsg.textContent = ''), 3500);
    if (newCfg.sheetsUrl) syncFromSheets();
  });

  // --- Navegação por Abas ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  function activateTab(tabId) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    tabPanels.forEach(p => p.classList.toggle('active', p.id === tabId));
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  // --- Upload e Extração de PDF ---
  const pdfInput = document.getElementById('pdf-input');
  const pdfDropzone = document.getElementById('pdf-dropzone');
  const pdfFileLabel = document.getElementById('pdf-file-label');
  const pdfRawText = document.getElementById('pdf-raw-text');
  const targetJobText = document.getElementById('target-job-text');

  async function extractPdfFile(file) {
    if (!file || file.type !== 'application/pdf') {
      alert('Por favor, selecione um arquivo no formato PDF.');
      return;
    }
    pdfFileLabel.textContent = `Arquivo selecionado: ${file.name}`;

    if (!window.pdfjsLib) {
      alert('Biblioteca PDF.js não carregada. Cole o texto do currículo manualmente no campo abaixo.');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      lastPdfPages = pdf.numPages;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const linesMap = [];

        for (const item of content.items) {
          if (!item.str) continue;
          const x = item.transform ? item.transform[4] : 0;
          const y = item.transform ? item.transform[5] : 0;
          let line = linesMap.find(l => Math.abs(l.y - y) <= 3.5);
          if (!line) {
            line = { y, items: [] };
            linesMap.push(line);
          }
          line.items.push({ str: item.str, x, w: item.width || 0 });
        }

        linesMap.sort((a, b) => b.y - a.y);
        const pageLines = linesMap.map(line => {
          line.items.sort((a, b) => a.x - b.x);
          let text = '';
          let prevEnd = null;
          for (const part of line.items) {
            if (prevEnd !== null) {
              const gap = part.x - prevEnd;
              const needsSpace = gap > 2.2 && !text.endsWith(' ') && !part.str.startsWith(' ');
              if (needsSpace) text += ' ';
            }
            text += part.str;
            prevEnd = part.x + part.w;
          }
          return text.trim();
        }).filter(Boolean);

        fullText += pageLines.join('\n') + '\n';
      }

      pdfRawText.value = fullText.trim();
      runPdfAnalysis();
    } catch (err) {
      console.error(err);
      alert('Não foi possível ler o PDF automaticamente. Cole o texto do currículo no campo abaixo.');
    }
  }

  pdfInput.addEventListener('change', e => {
    if (e.target.files.length > 0) extractPdfFile(e.target.files[0]);
  });

  pdfDropzone.addEventListener('dragover', e => {
    e.preventDefault();
    pdfDropzone.classList.add('dragover');
  });

  pdfDropzone.addEventListener('dragleave', () => {
    pdfDropzone.classList.remove('dragover');
  });

  pdfDropzone.addEventListener('drop', e => {
    e.preventDefault();
    pdfDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) extractPdfFile(e.dataTransfer.files[0]);
  });

  // --- Renderização de Diagnóstico ---
  function renderDiagnosis(containerEl, emptyEl, result, showJobMatch = false) {
    emptyEl.classList.add('hidden');
    containerEl.classList.remove('hidden');

    let jobHtml = '';
    if (showJobMatch && (result.matchedJobKeywords.length || result.missingJobKeywords.length)) {
      jobHtml = `
        <div class="diag-item ${result.missingJobKeywords.length ? 'warn' : 'ok'}" style="margin-top:12px;">
          <strong>Compatibilidade com a vaga informada</strong>
          ${
            result.matchedJobKeywords.length
              ? `<div class="small">Encontradas no seu currículo:</div>
                 <div class="kw-chips">${result.matchedJobKeywords.map(k => `<span class="kw-chip">${escapeHtml(k)}</span>`).join('')}</div>`
              : ''
          }
          ${
            result.missingJobKeywords.length
              ? `<div class="small" style="margin-top:8px;">Palavras-chave da vaga que faltam incluir (se você tiver conhecimento):</div>
                 <div class="kw-chips">${result.missingJobKeywords.map(k => `<span class="kw-chip missing">${escapeHtml(k)}</span>`).join('')}</div>`
              : ''
          }
        </div>
      `;
    }

    containerEl.innerHTML = `
      <div class="score-header">
        <div class="score-circle score-${result.level}">${result.score}%</div>
        <div>
          <strong>Pontuação ATS &amp; Recrutador</strong>
          <p class="muted" style="margin:2px 0 0;">${escapeHtml(result.summary)}</p>
        </div>
      </div>
      <div class="diag-list">
        ${result.items
          .map(
            item => `
          <div class="diag-item ${item.status}">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.detail)}</span>
          </div>
        `
          )
          .join('')}
      </div>
      ${jobHtml}
    `;
  }

  function runPdfAnalysis() {
    const result = window.ConectaAnalyzer.analyzeResumeText(
      pdfRawText.value,
      lastPdfPages,
      targetJobText.value
    );
    renderDiagnosis(
      document.getElementById('pdf-analysis-output'),
      document.getElementById('pdf-analysis-empty'),
      result,
      true
    );
  }

  document.getElementById('analyze-pdf-btn').addEventListener('click', runPdfAnalysis);

  // Enviar dados extraídos para o Gerador ATS
  function fillBuilderFromParsed(parsed) {
    if (parsed.name && !cvFields.name.value) cvFields.name.value = parsed.name;
    if (parsed.city && !cvFields.city.value) cvFields.city.value = parsed.city;
    if (parsed.email) cvFields.email.value = parsed.email;
    if (parsed.phone) cvFields.phone.value = parsed.phone;
    if (parsed.linkedin) cvFields.linkedin.value = parsed.linkedin;
    if (parsed.github) cvFields.github.value = parsed.github;
    if (parsed.objective && !cvFields.objective.value) cvFields.objective.value = parsed.objective;
    if (parsed.projects && !cvFields.projects.value) cvFields.projects.value = parsed.projects;
    if (parsed.experience && !cvFields.experience.value) cvFields.experience.value = parsed.experience;
    if (parsed.education && !cvFields.education.value) cvFields.education.value = parsed.education;
    if (parsed.courses && !cvFields.courses.value) cvFields.courses.value = parsed.courses;
    if (parsed.languages && !cvFields.languages.value) cvFields.languages.value = parsed.languages;
    if (parsed.infra && !cvFields.skillsInfra.value) cvFields.skillsInfra.value = parsed.infra;
    if (parsed.dev && !cvFields.skillsDev.value) cvFields.skillsDev.value = parsed.dev;
    if (parsed.soft && !cvFields.skillsSoft.value) cvFields.skillsSoft.value = parsed.soft;
  }

  document.getElementById('send-to-builder-btn').addEventListener('click', () => {
    const parsed = window.ConectaAnalyzer.parseResumeToProfile(pdfRawText.value);
    fillBuilderFromParsed(parsed);
    renderCvPreview();
    activateTab('builder-tab');
  });

  // --- Análise Real com IA (Gemini via Cloudflare Worker / Vercel) ---
  async function runGeminiAnalysis({ mode, content, jobDescription, outputEl, emptyEl, btnEl }) {
    const { aiUrl, aiModel } = getConfig();
    if (!content.trim()) {
      alert('Preencha ou envie o conteúdo antes de analisar com IA.');
      return;
    }

    if (!aiUrl) {
      integrationsPanel.classList.remove('hidden');
      emptyEl.classList.add('hidden');
      outputEl.classList.remove('hidden');
      outputEl.innerHTML = `
        <div class="diag-item warn">
          <strong>Backend Gemini ainda não configurado</strong>
          <span>Cole a URL do seu Cloudflare Worker ou Vercel em <strong>"Configurar IA &amp; Sheets"</strong> acima (veja o passo a passo no README.md), ou use o prompt pronto abaixo no Gemini/ChatGPT:</span>
          <textarea rows="5" style="margin-top:8px;" readonly>Atue como especialista em recrutamento de TI para estágio/1º emprego (padrão ATS 1 página). Analise o conteúdo abaixo, aponte melhorias e reescreva objetivo, competências e projetos acadêmicos:\n\n${escapeHtml(content.slice(0, 2500))}</textarea>
        </div>
      `;
      return;
    }

    const originalLabel = btnEl.textContent;
    btnEl.disabled = true;
    btnEl.textContent = 'Analisando com Gemini...';

    try {
      const res = await fetch(aiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, content, jobDescription, model: aiModel })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.analysis) {
        throw new Error(data.error || 'Erro ao consultar o backend de IA.');
      }

      const ai = data.analysis;
      renderDiagnosis(
        outputEl,
        emptyEl,
        {
          score: Number(ai.score || 0),
          level: ai.level || 'warn',
          summary: `${ai.summary || ''} (Modelo: ${data.model || 'Gemini'})`,
          items: Array.isArray(ai.items) ? ai.items : [],
          matchedJobKeywords: [],
          missingJobKeywords: Array.isArray(ai.missingKeywords) ? ai.missingKeywords : []
        },
        Array.isArray(ai.missingKeywords) && ai.missingKeywords.length > 0
      );

      if (ai.improvedProfile) {
        const applyBox = document.createElement('div');
        applyBox.className = 'diag-item ok';
        applyBox.style.marginTop = '12px';
        applyBox.innerHTML = `
          <strong>Sugestão de Melhoria Gerada pela IA</strong>
          <span>${escapeHtml(ai.improvedProfile.tips || 'Clique abaixo para preencher o Currículo Melhorado (Aba 3) com os textos reescritos pela IA.')}</span>
          <div class="btn-row" style="margin-top:8px;">
            <button type="button" class="btn btn-primary small-btn" id="apply-ai-profile-btn">Aplicar Sugestões da IA no Currículo &rarr;</button>
          </div>
        `;
        outputEl.appendChild(applyBox);

        applyBox.querySelector('#apply-ai-profile-btn').addEventListener('click', () => {
          const parsed = window.ConectaAnalyzer.parseResumeToProfile(pdfRawText.value);
          fillBuilderFromParsed(parsed);

          if (ai.improvedProfile.objective) cvFields.objective.value = ai.improvedProfile.objective;
          if (ai.improvedProfile.skillsInfra) cvFields.skillsInfra.value = ai.improvedProfile.skillsInfra;
          if (ai.improvedProfile.skillsDev) cvFields.skillsDev.value = ai.improvedProfile.skillsDev;
          if (ai.improvedProfile.skillsSoft) cvFields.skillsSoft.value = ai.improvedProfile.skillsSoft;
          if (ai.improvedProfile.projects) cvFields.projects.value = ai.improvedProfile.projects;

          renderCvPreview();
          activateTab('builder-tab');
        });
      }
    } catch (err) {
      alert(`Não foi possível concluir a análise com IA: ${err.message}`);
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = originalLabel;
    }
  }

  document.getElementById('analyze-pdf-ai-btn').addEventListener('click', e => {
    runGeminiAnalysis({
      mode: 'resume',
      content: pdfRawText.value,
      jobDescription: targetJobText.value,
      outputEl: document.getElementById('pdf-analysis-output'),
      emptyEl: document.getElementById('pdf-analysis-empty'),
      btnEl: e.currentTarget
    });
  });

  // --- Editor e Preview ATS ---
  const cvFields = {
    theme: document.getElementById('template-theme'),
    name: document.getElementById('cv-name'),
    city: document.getElementById('cv-city'),
    phone: document.getElementById('cv-phone'),
    email: document.getElementById('cv-email'),
    linkedin: document.getElementById('cv-linkedin'),
    github: document.getElementById('cv-github'),
    objective: document.getElementById('cv-objective'),
    skillsInfra: document.getElementById('cv-skills-infra'),
    skillsDev: document.getElementById('cv-skills-dev'),
    skillsSoft: document.getElementById('cv-skills-soft'),
    projects: document.getElementById('cv-projects'),
    experience: document.getElementById('cv-experience'),
    education: document.getElementById('cv-education'),
    courses: document.getElementById('cv-courses'),
    languages: document.getElementById('cv-languages')
  };

  const cvPreview = document.getElementById('cv-preview');
  const pageFitBadge = document.getElementById('page-fit-badge');

  function linesToList(text) {
    const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    return `<ul>${lines.map(l => `<li>${escapeHtml(l.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul>`;
  }

  function renderCvPreview() {
    cvPreview.className = `cv-sheet theme-${cvFields.theme.value}`;

    const contactParts = [
      cvFields.city.value,
      cvFields.phone.value,
      cvFields.email.value
    ].filter(Boolean);

    const linksParts = [
      cvFields.linkedin.value ? `LinkedIn: ${cvFields.linkedin.value}` : '',
      cvFields.github.value ? `GitHub: ${cvFields.github.value}` : ''
    ].filter(Boolean);

    const skillsHtml = [
      cvFields.skillsInfra.value
        ? `<li><strong>Infraestrutura e Redes:</strong> ${escapeHtml(cvFields.skillsInfra.value)}</li>`
        : '',
      cvFields.skillsDev.value
        ? `<li><strong>Desenvolvimento e Tecnologia:</strong> ${escapeHtml(cvFields.skillsDev.value)}</li>`
        : '',
      cvFields.skillsSoft.value
        ? `<li><strong>Competências Pessoais:</strong> ${escapeHtml(cvFields.skillsSoft.value)}</li>`
        : ''
    ]
      .filter(Boolean)
      .join('');

    cvPreview.innerHTML = `
      <h1 class="cv-name">${escapeHtml(cvFields.name.value || 'NOME COMPLETO DO ESTUDANTE')}</h1>
      <div class="cv-contact">
        ${escapeHtml(contactParts.join(' | ') || 'Cidade/UF | (00) 00000-0000 | nome.sobrenome@email.com')}
        ${linksParts.length ? `<br />${escapeHtml(linksParts.join(' | '))}` : ''}
      </div>

      ${
        cvFields.objective.value
          ? `<section class="cv-section">
               <h2 class="cv-section-title">Objetivo</h2>
               <p>${escapeHtml(cvFields.objective.value)}</p>
             </section>`
          : ''
      }

      ${
        skillsHtml
          ? `<section class="cv-section">
               <h2 class="cv-section-title">Competências Técnicas e Pessoais</h2>
               <ul>${skillsHtml}</ul>
             </section>`
          : ''
      }

      ${
        cvFields.projects.value.trim()
          ? `<section class="cv-section">
               <h2 class="cv-section-title">Projetos Técnicos e Acadêmicos</h2>
               ${linesToList(cvFields.projects.value)}
             </section>`
          : ''
      }

      ${
        cvFields.experience.value.trim()
          ? `<section class="cv-section">
               <h2 class="cv-section-title">Experiência Profissional (ou Outras Experiências)</h2>
               ${linesToList(cvFields.experience.value)}
             </section>`
          : ''
      }

      ${
        cvFields.education.value.trim()
          ? `<section class="cv-section">
               <h2 class="cv-section-title">Formação Acadêmica</h2>
               <p>${escapeHtml(cvFields.education.value)}</p>
             </section>`
          : ''
      }

      ${
        cvFields.courses.value.trim()
          ? `<section class="cv-section">
               <h2 class="cv-section-title">Cursos e Certificações</h2>
               ${linesToList(cvFields.courses.value)}
             </section>`
          : ''
      }

      ${
        cvFields.languages.value.trim()
          ? `<section class="cv-section">
               <h2 class="cv-section-title">Idiomas</h2>
               <p>${escapeHtml(cvFields.languages.value)}</p>
             </section>`
          : ''
      }
    `;

    // Estimar se cabe em 1 página A4 (~1050px em tela)
    const fitsOnePage = cvPreview.scrollHeight <= 1040;
    pageFitBadge.textContent = fitsOnePage
      ? '1 Página · Pronto para ATS'
      : 'Atenção: pode passar de 1 página';
    pageFitBadge.className = `badge ${fitsOnePage ? 'badge-ok' : 'badge-warn'}`;
  }

  Object.values(cvFields).forEach(el => {
    el.addEventListener('input', renderCvPreview);
    el.addEventListener('change', renderCvPreview);
  });

  document.getElementById('auto-improve-btn').addEventListener('click', () => {
    if (!cvFields.objective.value.trim() || /crescer junto|desafios/i.test(cvFields.objective.value)) {
      cvFields.objective.value =
        'Estágio em Tecnologia da Informação (Suporte Técnico, Infraestrutura de Redes ou Desenvolvimento de Software), aplicando conhecimentos práticos em resolução de problemas e projetos acadêmicos.';
    }
    if (!cvFields.skillsSoft.value.trim()) {
      cvFields.skillsSoft.value =
        'Resolução de problemas, Trabalho em equipe, Metodologias Ágeis (Scrum), Proatividade, Comunicação clara';
    }
    renderCvPreview();
  });

  document.getElementById('print-cv-btn').addEventListener('click', () => {
    activateTab('builder-tab');
    window.print();
  });

  // --- Pesquisa Online de Feedback & Painel do Professor ---
  const STORAGE_KEY = 'conecta_carreira_feedback_v1';
  const INITIAL_SEED = [
    {
      name: 'Mariana S. (ADS - 3º sem)',
      goal: 'Estágio em TI',
      rating: 5,
      clarity: 'Sim, muito claras',
      confidence: 'Sim, muito mais preparado(a)',
      comment: 'Não sabia que sistemas ATS barravam currículos com duas colunas e gráficos. O modelo de 1 página ficou bem mais limpo.',
      date: '2026-11-16'
    },
    {
      name: 'Rafael T. (Sistemas de Inf.)',
      goal: 'Primeiro Emprego / Júnior',
      rating: 4,
      clarity: 'Sim, muito claras',
      confidence: 'Sim, muito mais preparado(a)',
      comment: 'A análise mostrou que faltava o link do meu GitHub e projetos da faculdade. Agora consegui estruturar melhor.',
      date: '2026-11-16'
    }
  ];

  function loadFeedbacks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED));
        return [...INITIAL_SEED];
      }
      return JSON.parse(raw);
    } catch {
      return [...INITIAL_SEED];
    }
  }

  function saveFeedbacks(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  const syncStatusEl = document.getElementById('sheets-sync-status');

  async function syncFromSheets() {
    const { sheetsUrl } = getConfig();
    if (!sheetsUrl) {
      syncStatusEl.textContent = 'Modo local (conecte o Google Sheets em "Configurar IA & Sheets" para reunir respostas de todos os celulares).';
      return;
    }
    syncStatusEl.textContent = 'Sincronizando respostas com o Google Sheets...';
    try {
      const res = await fetch(sheetsUrl);
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.responses)) {
        saveFeedbacks(data.responses);
        renderSurveyDashboard();
        syncStatusEl.textContent = `Conectado ao Google Sheets (${data.responses.length} respostas sincronizadas).`;
      } else {
        syncStatusEl.textContent = 'Não foi possível ler a planilha. Exibindo dados locais.';
      }
    } catch {
      syncStatusEl.textContent = 'Falha de conexão com o Google Sheets. Exibindo dados locais.';
    }
  }

  document.getElementById('sync-sheets-btn').addEventListener('click', syncFromSheets);

  function renderSurveyDashboard() {
    const list = loadFeedbacks();
    const total = list.length;
    const avg = total ? (list.reduce((acc, item) => acc + Number(item.rating), 0) / total).toFixed(1) : '0.0';
    const preparedCount = list.filter(i => i.confidence.startsWith('Sim')).length;
    const preparedPct = total ? Math.round((preparedCount / total) * 100) : 0;

    document.getElementById('survey-kpis').innerHTML = `
      <div class="kpi-box">
        <strong>${total}</strong>
        <span>Respostas coletadas</span>
      </div>
      <div class="kpi-box">
        <strong>${avg} / 5</strong>
        <span>Nota média do currículo</span>
      </div>
      <div class="kpi-box">
        <strong>${preparedPct}%</strong>
        <span>Mais preparados(as)</span>
      </div>
    `;

    const counts = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: list.filter(i => Number(i.rating) === star).length
    }));

    document.getElementById('rating-bars').innerHTML = counts
      .map(c => {
        const pct = total ? Math.round((c.count / total) * 100) : 0;
        return `
          <div class="bar-row">
            <span>Nota ${c.star}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
            <span>${c.count}</span>
          </div>
        `;
      })
      .join('');

    document.getElementById('feedback-list').innerHTML = list
      .slice()
      .reverse()
      .map(
        item => `
        <div class="fb-item">
          <div class="fb-item-head">
            <span>${escapeHtml(item.name || 'Participante Anônimo')} · ${escapeHtml(item.goal)}</span>
            <span>Nota ${item.rating}/5</span>
          </div>
          <div class="small muted">${escapeHtml(item.clarity)} · ${escapeHtml(item.confidence)}</div>
          ${item.comment ? `<p style="margin:6px 0 0;">"${escapeHtml(item.comment)}"</p>` : ''}
        </div>
      `
      )
      .join('');
  }

  document.getElementById('feedback-form').addEventListener('submit', async e => {
    e.preventDefault();
    const ratingEl = document.querySelector('input[name="fb-rating"]:checked');
    const newEntry = {
      name: document.getElementById('fb-name').value.trim() || 'Participante Anônimo',
      goal: document.getElementById('fb-goal').value,
      rating: Number(ratingEl ? ratingEl.value : 5),
      clarity: document.getElementById('fb-clarity').value,
      confidence: document.getElementById('fb-confidence').value,
      comment: document.getElementById('fb-comment').value.trim(),
      date: new Date().toISOString().slice(0, 10)
    };

    const list = loadFeedbacks();
    list.push(newEntry);
    saveFeedbacks(list);
    renderSurveyDashboard();

    const { sheetsUrl } = getConfig();
    const msg = document.getElementById('fb-success-msg');
    if (sheetsUrl) {
      try {
        await fetch(sheetsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(newEntry)
        });
        msg.textContent = 'Feedback registrado no Google Sheets com sucesso! Obrigado por participar.';
        syncFromSheets();
      } catch {
        msg.textContent = 'Feedback salvo localmente (não foi possível enviar ao Google Sheets agora).';
      }
    } else {
      msg.textContent = 'Feedback registrado com sucesso! Obrigado por participar.';
    }

    e.target.reset();
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 4500);
  });

  document.getElementById('export-csv-btn').addEventListener('click', () => {
    const list = loadFeedbacks();
    const header = ['Data', 'Participante', 'Objetivo', 'Nota (1-5)', 'Clareza', 'Preparacao', 'Comentario'];
    const rows = list.map(i => [
      i.date,
      `"${(i.name || '').replace(/"/g, '""')}"`,
      `"${(i.goal || '').replace(/"/g, '""')}"`,
      i.rating,
      `"${(i.clarity || '').replace(/"/g, '""')}"`,
      `"${(i.confidence || '').replace(/"/g, '""')}"`,
      `"${(i.comment || '').replace(/"/g, '""')}"`
    ]);
    const csv = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pesquisa_feedback_conecta_comunidade.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('print-report-btn').addEventListener('click', () => {
    activateTab('survey-tab');
    window.print();
  });

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Inicialização
  renderCvPreview();
  renderSurveyDashboard();
  syncFromSheets();
});
