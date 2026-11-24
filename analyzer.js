// Motor de Análise de Currículo ATS & LinkedIn para Primeiro Emprego em TI
// Baseado nas diretrizes do Projeto de Extensão Conecta Comunidade (ODS 4 e ODS 8)

const TI_KEYWORDS = {
  dev: [
    'java', 'python', 'javascript', 'typescript', 'c#', 'c++', 'php',
    'html', 'html5', 'css', 'css3', 'react', 'node', 'sql', 'mysql',
    'postgresql', 'mongodb', 'git', 'github', 'api', 'rest', 'crud', 'spring'
  ],
  infra: [
    'linux', 'windows', 'redes', 'tcp/ip', 'dns', 'dhcp', 'cisco',
    'packet tracer', 'virtualbox', 'vmware', 'suporte', 'hardware',
    'help desk', 'service desk', 'cloud', 'aws', 'azure', 'lgpd', 'segurança'
  ],
  soft: [
    'comunicação', 'trabalho em equipe', 'resolução de problemas', 'scrum',
    'kanban', 'ágil', 'proatividade', 'organização', 'aprendizado', 'liderança'
  ]
};

const CLICHES = [
  'crescer junto com a empresa',
  'buscar novos desafios',
  'contribuir para o sucesso da empresa',
  'à disposição da empresa',
  'dinâmico e proativo',
  'vestir a camisa'
];

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function analyzeResumeText(rawText, pageCount = 1, jobDescription = '') {
  const text = (rawText || '').trim();
  const norm = normalizeText(text);
  const items = [];
  let score = 0;

  if (!text) {
    return {
      score: 0,
      level: 'bad',
      summary: 'Nenhum texto encontrado. Se o PDF for uma imagem escaneada, sistemas ATS não conseguem lê-lo.',
      items: [
        {
          status: 'bad',
          title: 'Texto não selecionável (Risco crítico de ATS)',
          detail: 'Sistemas como Gupy e CIEE precisam de texto selecionável. Exporte seu currículo pelo Word, Google Docs ou pelo nosso Gerador ATS.'
        }
      ],
      matchedJobKeywords: [],
      missingJobKeywords: []
    };
  }

  // 1. Número de páginas (Regra do modelo: 1 página para estágio / 1º emprego)
  if (pageCount <= 1) {
    score += 15;
    items.push({
      status: 'ok',
      title: 'Tamanho ideal para Estágio / 1º Emprego (1 página)',
      detail: 'Currículos enxutos de 1 página facilitam a leitura rápida de recrutadores em menos de 15 segundos.'
    });
  } else {
    score += 5;
    items.push({
      status: 'warn',
      title: `Currículo com ${pageCount} páginas`,
      detail: 'Para estágio e primeiro emprego em TI, o recomendado é condensar o conteúdo em 1 página, priorizando formação, stack e projetos.'
    });
  }

  // 2. Contato & E-mail Profissional
  const contact = extractContactInfo(text);
  const emailMatch = contact.email ? [contact.email] : null;
  const hasPhone = Boolean(contact.phone);
  const hasLinkedIn = Boolean(contact.linkedin);
  const hasGitHub = Boolean(contact.github);

  if (emailMatch && hasPhone) {
    const email = emailMatch[0].toLowerCase();
    const informalEmail = /(gatinh|novinh|lind|sk8|bolad|1234|gamer|xoxo)/i.test(email);
    if (informalEmail) {
      score += 8;
      items.push({
        status: 'warn',
        title: `E-mail pouco profissional detectado (${email})`,
        detail: 'Crie um e-mail no formato nome.sobrenome@gmail.com para passar mais credibilidade.'
      });
    } else {
      score += 15;
      items.push({
        status: 'ok',
        title: 'Dados de contato básicos presentes',
        detail: `E-mail (${email}) e telefone identificados.`
      });
    }
  } else {
    items.push({
      status: 'bad',
      title: 'Contato incompleto',
      detail: 'Inclua telefone com DDD, cidade/UF e um e-mail profissional no cabeçalho.'
    });
  }

  // 3. LinkedIn e GitHub
  if (hasLinkedIn && hasGitHub) {
    score += 15;
    items.push({
      status: 'ok',
      title: 'LinkedIn e GitHub presentes',
      detail: 'Excelente! Em TI, o GitHub funciona como seu portfólio prático para comprovar projetos mesmo sem experiência prévia.'
    });
  } else if (hasLinkedIn || hasGitHub) {
    score += 8;
    items.push({
      status: 'warn',
      title: hasLinkedIn ? 'Falta o link do GitHub' : 'Falta o link do LinkedIn',
      detail: 'Adicione tanto o LinkedIn quanto o GitHub no topo do currículo para aumentar suas chances em processos de TI.'
    });
  } else {
    items.push({
      status: 'bad',
      title: 'Sem links de LinkedIn e GitHub',
      detail: 'Recrutadores de TI buscam perfis ativos no LinkedIn e repositórios no GitHub com projetos da faculdade ou estudos.'
    });
  }

  // 4. Objetivo Profissional
  const hasObjective = /objetivo|resumo/i.test(text);
  const hasCliche = CLICHES.some(c => norm.includes(normalizeText(c)));
  const hasTargetRole = /(estagio|suporte|desenvolvedor|desenvolvimento|redes|infraestrutura|dados|qa|analista|ti\b|front|back)/i.test(norm);

  if (hasObjective && hasTargetRole && !hasCliche) {
    score += 15;
    items.push({
      status: 'ok',
      title: 'Objetivo direcionado para TI',
      detail: 'Seu objetivo indica claramente a área/nível pretendido, o que ajuda tanto o recrutador quanto o filtro do ATS.'
    });
  } else if (hasCliche) {
    score += 5;
    items.push({
      status: 'warn',
      title: 'Objetivo com frases genéricas/clichês',
      detail: 'Evite frases como "crescer junto com a empresa". Seja direto: Ex: "Estágio em Suporte Técnico, Infraestrutura de Redes ou Desenvolvimento".'
    });
  } else {
    score += 5;
    items.push({
      status: 'warn',
      title: 'Objetivo ausente ou pouco específico para TI',
      detail: 'Defina uma seção "Objetivo" clara citando o cargo desejado (ex: Estágio em Desenvolvimento Web / Suporte Técnico).'
    });
  }

  // 5. Competências Técnicas
  const foundDev = TI_KEYWORDS.dev.filter(k => norm.includes(k));
  const foundInfra = TI_KEYWORDS.infra.filter(k => norm.includes(k));
  const foundSoft = TI_KEYWORDS.soft.filter(k => norm.includes(normalizeText(k)));
  const totalTech = foundDev.length + foundInfra.length;

  if (totalTech >= 5) {
    score += 20;
    items.push({
      status: 'ok',
      title: `Boa densidade de palavras-chave técnicas (${totalTech} identificadas)`,
      detail: `Tecnologias detectadas: ${[...foundDev, ...foundInfra].slice(0, 10).join(', ')}.`
    });
  } else if (totalTech >= 2) {
    score += 10;
    items.push({
      status: 'warn',
      title: `Poucas palavras-chave técnicas (${totalTech} identificadas)`,
      detail: 'Separe suas competências em categorias (Infraestrutura/Redes, Desenvolvimento/Dados e Competências Pessoais) como no modelo da oficina.'
    });
  } else {
    items.push({
      status: 'bad',
      title: 'Faltam palavras-chave técnicas de TI',
      detail: 'Liste linguagens, bancos de dados, sistemas operacionais e ferramentas usadas na faculdade (ex: Java, Python, SQL, Git, Linux, Packet Tracer).'
    });
  }

  // 6. Projetos Acadêmicos / Formação
  const hasProjects = /(projeto|projetos|crud|github|packet tracer|academico|tcc|repositorio)/i.test(norm);
  const hasEducation = /(formacao|graduacao|tecnologo|bacharelado|ciencia da computacao|sistemas de informacao|analise e desenvolvimento|engenharia de software|semestre|cursando)/i.test(norm);

  if (hasProjects && hasEducation) {
    score += 20;
    items.push({
      status: 'ok',
      title: 'Formação Acadêmica e Projetos presentes',
      detail: 'Para quem busca o primeiro emprego, destacar projetos da faculdade com a tecnologia e finalidade faz toda a diferença.'
    });
  } else if (hasEducation) {
    score += 10;
    items.push({
      status: 'warn',
      title: 'Inclua uma seção de Projetos Técnicos e Acadêmicos',
      detail: 'Mesmo sem experiência profissional em TI, descreva 1 ou 2 trabalhos práticos da faculdade indicando a tecnologia e o resultado.'
    });
  } else {
    items.push({
      status: 'bad',
      title: 'Formação Acadêmica não identificada claramente',
      detail: 'Informe curso, instituição, semestre atual e previsão de conclusão (Mês/Ano).'
    });
  }

  // 7. Match com a vaga desejada (opcional)
  let matchedJobKeywords = [];
  let missingJobKeywords = [];
  if (jobDescription.trim()) {
    const jobNorm = normalizeText(jobDescription);
    const allKnown = [...TI_KEYWORDS.dev, ...TI_KEYWORDS.infra, ...TI_KEYWORDS.soft];
    const required = [...new Set(allKnown.filter(k => jobNorm.includes(normalizeText(k))))];
    matchedJobKeywords = required.filter(k => norm.includes(normalizeText(k)));
    missingJobKeywords = required.filter(k => !norm.includes(normalizeText(k)));
  }

  const level = score >= 75 ? 'ok' : score >= 45 ? 'warn' : 'bad';
  const summary =
    level === 'ok'
      ? 'Ótima base para sistemas ATS e recrutadores de TI! Veja os ajustes finos abaixo.'
      : level === 'warn'
      ? 'Currículo razoável, mas precisa de ajustes importantes para não ser filtrado no ATS.'
      : 'Atenção: seu currículo precisa de reestruturação para vagas de estágio/1º emprego em TI.';

  return {
    score: Math.min(100, score),
    level,
    summary,
    items,
    foundTech: [...foundDev, ...foundInfra],
    foundSoft,
    matchedJobKeywords,
    missingJobKeywords
  };
}

function analyzeLinkedInProfile({ url, headline, about, exp, github }) {
  const items = [];
  let score = 0;

  // URL personalizada
  if (url && /linkedin\.com\/in\/[a-z0-9-]+/i.test(url) && !/\d{6,}/.test(url)) {
    score += 15;
    items.push({
      status: 'ok',
      title: 'URL do LinkedIn personalizada',
      detail: 'URL limpa facilita o compartilhamento no currículo e com recrutadores.'
    });
  } else {
    items.push({
      status: 'warn',
      title: 'Personalize a URL do seu LinkedIn',
      detail: 'Remova números aleatórios nas configurações de URL pública do LinkedIn (ex: linkedin.com/in/seu-nome).'
    });
  }

  // Headline estratégica
  const hlNorm = normalizeText(headline);
  const hlHasRole = /(estagio|estudante|desenvolvedor|suporte|ti|analista|dados|redes|qa)/i.test(hlNorm);
  const hlHasTech = [...TI_KEYWORDS.dev, ...TI_KEYWORDS.infra].some(k => hlNorm.includes(k));
  if (headline.trim().length >= 20 && hlHasRole && hlHasTech) {
    score += 25;
    items.push({
      status: 'ok',
      title: 'Título (Headline) estratégico para buscas',
      detail: 'Contém área de interesse e tecnologias-chave, aumentando sua aparição nas buscas de tech recruiters.'
    });
  } else {
    items.push({
      status: 'bad',
      title: 'Melhore seu Título (Headline)',
      detail: 'Evite deixar apenas "Estudante". Use: "Estudante de ADS | Java, SQL, Git | Em busca de Estágio em TI".'
    });
  }

  // Seção Sobre
  if ((about || '').trim().length >= 80) {
    score += 20;
    items.push({
      status: 'ok',
      title: 'Seção "Sobre" preenchida',
      detail: 'Conte brevemente sua formação, o que está estudando, projetos recentes e o tipo de oportunidade que busca.'
    });
  } else {
    items.push({
      status: 'warn',
      title: 'Seção "Sobre" muito curta ou vazia',
      detail: 'Escreva 2 parágrafos curtos com suas tecnologias principais, objetivo de estágio/1º emprego e link para o GitHub.'
    });
  }

  // Projetos e Competências
  const expNorm = normalizeText(exp);
  const expTechCount = [...TI_KEYWORDS.dev, ...TI_KEYWORDS.infra].filter(k => expNorm.includes(k)).length;
  if (expTechCount >= 3) {
    score += 25;
    items.push({
      status: 'ok',
      title: `Experiências/Projetos com ${expTechCount} tecnologias citadas`,
      detail: 'Inclua também cursos (Cisco, Alura, Fundação Bradesco, DIO) e projetos na seção "Projetos" do LinkedIn.'
    });
  } else {
    items.push({
      status: 'warn',
      title: 'Detalhe melhor seus projetos e competências',
      detail: 'Adicione projetos acadêmicos na seção "Projetos" e preencha até 15 competências técnicas para ranquear melhor.'
    });
  }

  // GitHub
  if (github && /github\.com\//i.test(github)) {
    score += 15;
    items.push({
      status: 'ok',
      title: 'GitHub conectado ao posicionamento',
      detail: 'Mantenha um README.md organizado nos seus principais repositórios com prints e instruções de execução.'
    });
  } else {
    items.push({
      status: 'warn',
      title: 'Adicione seu GitHub na seção "Em destaque"',
      detail: 'Fixe seus melhores repositórios e projetos da faculdade na seção "Em destaque" do LinkedIn.'
    });
  }

  const level = score >= 75 ? 'ok' : score >= 45 ? 'warn' : 'bad';
  return {
    score,
    level,
    summary:
      level === 'ok'
        ? 'Perfil bem posicionado! Continue interagindo em vagas e publicando seus aprendizados.'
        : 'Seu LinkedIn pode gerar muito mais visualizações de recrutadores com os ajustes abaixo.',
    items
  };
}

function extractContactInfo(rawText) {
  const text = rawText || '';
  const compactText = text.replace(/\s*([@])\s*/g, '$1').replace(/([a-zA-Z0-9])\s*\.\s*(dev|com|br|org|net|edu|io)\b/gi, '$1.$2');
  const email = (compactText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [''])[0];
  const phoneRaw = (text.match(/\(?\s*\d{2}\s*\)?\s*\d{4,5}\s*-?\s*\d{4}/) || [''])[0];
  const phone = phoneRaw.replace(/\s+/g, ' ').replace(/\s*-\s*/, '-').trim();

  let city = '';
  for (const line of text.split(/\r?\n/)) {
    for (const part of line.split('|')) {
      const candidate = part.trim();
      if (/^[A-ZÀ-Ú][a-zà-úA-ZÀ-Ú ]{1,28}\/[A-Z]{2}$/.test(candidate)) {
        city = candidate;
        break;
      }
    }
    if (city) break;
  }

  const linkedin = (text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s|,;]+/i) || [''])[0];
  const github = (text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s|,;]+/i) || [''])[0];
  return { email, phone, city, linkedin, github };
}

function mergeWrappedLines(lines) {
  if (!lines || !lines.length) return [];
  const hasBullets = lines.some(l => /^[•\-*▪]\s*/.test(l));
  if (!hasBullets) return lines;

  const merged = [];
  for (const line of lines) {
    const isBullet = /^[•\-*▪]\s*/.test(line);
    const isJobHeader = /\|/.test(line) && !isBullet;
    if (isBullet || isJobHeader || merged.length === 0) {
      merged.push(line.replace(/^[•\-*▪]\s*/, '').trim());
    } else {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`.replace(/\s+/g, ' ').trim();
    }
  }
  return merged;
}

function extractSections(rawText) {
  const lines = (rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const headers = [
    { key: 'objective', rx: /^(objetivo|objetivo profissional|resumo)$/i },
    { key: 'skills', rx: /^(competencias|habilidades|competencias tecnicas.*|conhecimentos.*)$/i },
    { key: 'projects', rx: /^(projetos|projetos tecnicos.*|projetos academicos.*)$/i },
    { key: 'experience', rx: /^(experiencia|experiencia profissional.*)$/i },
    { key: 'education', rx: /^(formacao|formacao academica.*)$/i },
    { key: 'courses', rx: /^(cursos|cursos e certificacoes.*)$/i },
    { key: 'languages', rx: /^(idiomas.*)$/i }
  ];

  const sections = {};
  let currentKey = null;
  for (const line of lines) {
    const clean = normalizeText(line).replace(/[:\-–]+$/, '').trim();
    const matched = headers.find(h => h.rx.test(clean));
    if (matched) {
      currentKey = matched.key;
      if (!sections[currentKey]) sections[currentKey] = [];
      continue;
    }
    if (currentKey) {
      sections[currentKey].push(line);
    }
  }
  return sections;
}

function parseResumeToProfile(rawText) {
  const lines = (rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const contact = extractContactInfo(rawText);
  const sections = extractSections(rawText);

  let name = '';
  for (const line of lines.slice(0, 5)) {
    if (!/@|linkedin\.com|github\.com|\d{4}/i.test(line) && line.length >= 4 && line.length <= 70) {
      name = line.split('|')[0].trim();
      break;
    }
  }

  const norm = normalizeText(rawText);
  const infraList = TI_KEYWORDS.infra.filter(k => norm.includes(k));
  const devList = TI_KEYWORDS.dev.filter(k => norm.includes(k));
  const softList = TI_KEYWORDS.soft.filter(k => norm.includes(normalizeText(k)));

  return {
    name,
    city: contact.city,
    email: contact.email,
    phone: contact.phone,
    linkedin: contact.linkedin,
    github: contact.github,
    objective: (sections.objective || []).join(' '),
    projects: mergeWrappedLines(sections.projects || []).join('\n'),
    experience: mergeWrappedLines(sections.experience || []).join('\n'),
    education: (sections.education || []).join('\n'),
    courses: mergeWrappedLines(sections.courses || []).join('\n'),
    languages: (sections.languages || []).join(' '),
    infra: infraList.join(', '),
    dev: devList.join(', '),
    soft: softList.join(', ')
  };
}

window.ConectaAnalyzer = {
  analyzeResumeText,
  analyzeLinkedInProfile,
  parseResumeToProfile
};
