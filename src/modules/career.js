// ==================== AXON MIND — MÓDULO DE CARRERA / TRABAJO REMOTO ====================
// Dependencias: config.js (showToast)
import { $, showToast } from './config.js';

const STORAGE_KEY = 'axon_career_checklist';

const CHECKLIST_ITEMS = [
  { id: 'cv', label: '📄 CV actualizado y en PDF', desc: 'Adaptado a roles tech/remoto, formato ATS-friendly' },
  { id: 'linkedin', label: '🔗 LinkedIn optimizado', desc: 'Foto profesional, headline claro, summary con keywords' },
  { id: 'portfolio', label: '💻 Portafolio / GitHub activo', desc: 'Repos con proyectos destacados, README claros' },
  { id: 'weworkremotely', label: '🌐 Perfil en We Work Remotely', desc: 'Uno de los portales más grandes de trabajo remoto' },
  { id: 'remoteok', label: '🌐 Perfil en Remote OK', desc: 'Agregador de empleos remotos en tecnología' },
  { id: 'linkedin_jobs', label: '🔍 Alertas en LinkedIn Jobs', desc: 'Configurar alertas con filtro "Remoto" + palabras clave' },
  { id: 'applications', label: '📨 Aplicar a 5+ trabajos por semana', desc: 'Constancia > intensidad. Personaliza cada aplicación' },
  { id: 'interview_prep', label: '🎯 Preparación para entrevistas técnicas', desc: 'Practicar algoritmos, system design y behavioral' },
  { id: 'networking', label: '🤝 Networking activo', desc: 'Conectar con reclutadores, participar en comunidades' },
  { id: 'salary', label: '💰 Investigar rangos salariales', desc: 'Saber cuánto pedir según mercado y ubicación' },
];

const TOP_PORTALES = [
  // ===== BOLSAS DE TRABAJO =====
  { name: 'We Work Remotely', url: 'https://weworkremotely.com/', desc: 'El portal remoto más grande del mundo' },
  { name: 'Remote OK', url: 'https://remoteok.com/', desc: 'Agregador con miles de empleos tech remotos' },
  { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/', desc: 'Filtro "Remoto" + alertas personalizadas' },
  { name: 'Wellfound (AngelList)', url: 'https://wellfound.com/jobs', desc: 'Startups. Filtro Job Type > "Remote OK"' },
  { name: 'Remotive', url: 'https://remotive.com/', desc: 'Empleos remotos curados en tech, marketing, soporte' },
  { name: 'JustRemote', url: 'https://justremote.co', desc: 'Empleos remotos con filtros por tipo y ubicación' },
  { name: 'Jobspresso', url: 'https://jobspresso.co/', desc: 'Puestos remotos de alta calidad y legítimos' },
  { name: '4 Day Week', url: 'https://4dayweek.io', desc: 'Trabajos de software con semana de 4 días' },
  { name: 'Daily Remote', url: 'https://dailyremote.com', desc: 'Empleos remotos curados para cualquier puesto' },
  { name: 'Real Work From Anywhere', url: 'https://www.realworkfromanywhere.com/', desc: 'Empleos 100% desde cualquier lugar' },
  { name: 'Upwork', url: 'https://www.upwork.com', desc: 'Freelance global en cualquier categoría' },
  { name: 'Toptal', url: 'https://www.toptal.com/careers', desc: 'Red exclusiva para developers top (proceso selectivo)' },
  { name: 'Authentic Jobs', url: 'https://authenticjobs.com/?search_location=remote', desc: 'Portal de empleos con filtro remoto' },
  { name: 'Built In', url: 'https://builtin.com/jobs/remote', desc: 'Empleos en tecnología con filtro remoto' },
  { name: 'ClojureJobboard.com', url: 'https://clojurejobboard.com/remote-clojure-jobs.html', desc: 'Empleos de Clojure — filtro Solo remoto' },
  { name: 'Crypto Jobs', url: 'https://crypto.jobs/?jobs=remote', desc: 'Empleos blockchain para entusiastas crypto' },
  { name: 'Crypto Jobs List', url: 'https://cryptojobslist.com/remote', desc: 'Tablero #1 de trabajos crypto/bitcoin/blockchain' },
  { name: 'Cryptocurrency Jobs', url: 'https://cryptocurrencyjobs.co/remote/', desc: 'Filtro de ubicación → Remote' },
  { name: 'CyberJobHunt.in', url: 'https://cyberjobhunt.in/', desc: 'Empleos de ciberseguridad en grandes empresas y startups' },
  { name: 'Diversify Tech', url: 'https://www.diversifytech.com/job-board', desc: 'Empresas transparentes en Diversidad e Inclusión' },
  { name: 'Dribbble Jobs', url: 'https://dribbble.com/jobs?location=Anywhere', desc: 'Empleos de diseño con ubicación Anywhere' },
  { name: 'Drupal Jobs', url: 'https://jobs.drupal.org/home/type/telecommute-remote-3588', desc: 'Empleos Drupal remotos' },
  { name: 'hiring.lat', url: 'https://hiring.lat', desc: 'Ofertas para LATAM con oportunidades remotas o reubicación' },
  { name: 'Findjobit', url: 'https://findjobit.com/jobs', desc: 'Empleos remotos para profesionales IT de LATAM' },
  { name: 'freelancermap', url: 'https://www.freelancermap.com/projects/remote.html', desc: 'Freelance IT, sobre todo proyectos alemanes' },
  { name: 'Golangprojects', url: 'https://www.golangprojects.com/golang-remote-jobs.html', desc: 'Empleos Go/Golang — filtro Solo remoto' },
  { name: 'Guru', url: 'https://www.guru.com/', desc: 'MUCHAS categorías fuera de software también' },
  { name: 'HackerX', url: 'https://hackerx.org/jobs/', desc: 'Portal para hackers y developers' },
  { name: 'Hasjob', url: 'https://hasjob.co/', desc: 'Filtro de ubicación → "Anywhere/Remote"' },
  { name: 'HigherEdJobs', url: 'https://www.higheredjobs.com/search/remote.cfm', desc: 'Educación superior con filtro remoto' },
  { name: 'HN hiring', url: 'https://www.hnhiring.me/', desc: 'Filtro REMOTE de Hacker News' },
  { name: 'JOBBOX.io', url: 'https://landing.jobs/jobs', desc: 'Filtro → Solo remoto' },
  { name: 'JobsCollider', url: 'https://jobscollider.com/remote-jobs', desc: 'Miles de empleos remotos de 10k+ empresas' },
  { name: 'Larajobs', url: 'https://larajobs.com/?location=&remote=1', desc: 'La conexión artesanal con el empleo (Laravel)' },
  { name: 'No Fluff Jobs', url: 'https://nofluffjobs.com/pl/#criteria=remote', desc: 'Filtro → "remote"' },
  { name: 'NODESK', url: 'https://nodesk.co/remote-jobs/', desc: 'Portal para nómadas digitales' },
  { name: 'Power to Fly', url: 'https://powertofly.com/jobs/', desc: 'Específico para mujeres en tech' },
  { name: 'Remote AI Jobs', url: 'https://www.moaijobs.com/remote-ai-jobs', desc: 'Empleos remotos en ML, ingeniería, data science, IA' },
  { name: 'Remote Backend Jobs', url: 'https://www.remotebackendjobs.com/', desc: 'Solo empleos remotos de backend de 22 portales' },
  { name: 'Remote Frontend Jobs', url: 'https://www.remotefrontendjobs.com/', desc: 'Solo empleos remotos de frontend de 22 portales' },
  { name: 'PyJobs.com', url: 'https://www.pyjobs.com/?remoteLevel[0]=1&remoteLevel[1]=2', desc: 'Empleos para developers Python' },
  { name: 'Remote Game Jobs', url: 'https://remotegamejobs.com/', desc: 'Trabajo remoto en la industria de videojuegos' },
  { name: 'remote-es/remotes (GitHub)', url: 'https://github.com/remote-es/remotes', desc: 'Empresas con empleos remotos con contratos españoles' },
  { name: 'thatmlopsguy/remote-pt (GitHub)', url: 'https://github.com/thatmlopsguy/remote-pt', desc: 'Empresas con empleos remotos con contratos portugueses' },
  { name: 'remote-jobs (GitHub)', url: 'https://github.com/remoteintech/remote-jobs', desc: 'Lista de empresas tech favorables al trabajo remoto' },
  { name: 'Remotees', url: 'https://weworkremotely.com/?utm_source=Remotees&utm_medium=Redirect&utm_campaign=Remotees', desc: 'Redirección a We Work Remotely' },
  { name: 'RemoteJobs.lat', url: 'https://remotejobs.lat/', desc: 'Empleos remotos para LATAM' },
  { name: 'Remote Works', url: 'https://remote.works-hub.com', desc: 'Empleos remotos en desarrollo de software' },
  { name: 'Ruby On Remote', url: 'https://rubyonremote.com/', desc: 'Todos los empleos remotos de Ruby en un solo lugar' },
  { name: 'Skip the Drive', url: 'https://www.skipthedrive.com/', desc: 'Portal de empleos remotos' },
  { name: 'Slasify', url: 'https://slasify.com/en', desc: 'Oportunidades remotas desde Asia con nómina global' },
  { name: 'Stream Native Jobs', url: 'https://streamnative.io/careers', desc: 'Desplázate hasta Join Us' },
  { name: 'SwissDev Jobs', url: 'https://swissdevjobs.ch/', desc: 'Filtro → "Remote / Work from home"' },
  { name: 'Virtual Vocations', url: 'https://www.virtualvocations.com/', desc: 'Portal de empleos virtuales' },
  { name: 'Vue.js Jobs', url: 'https://vuejobs.com/', desc: 'Empleos Vue.js — pestaña "Remote"' },
  { name: 'Web3Jobs', url: 'https://web3.career/remote-jobs', desc: 'Empleos remotos de Web3' },
  { name: 'Workana', url: 'https://www.workana.com/', desc: 'Freelance en español y portugués' },
  { name: 'Working Nomads', url: 'https://www.workingnomads.com/jobs', desc: 'Empleos remotos para nómadas digitales' },
  { name: 'zuhausejobs.com', url: 'https://zuhausejobs.com', desc: 'Empleos remotos en alemán (DE/AT/CH)' },
  { name: 'Dataaxy', url: 'https://dataaxy.com', desc: 'Bolsa de trabajo e inversa en datos e IA, Norteamérica' },
  { name: 'Freel', url: 'https://freel.ca', desc: 'Freelancers en Canadá' },
  { name: 'DevOpsJobs', url: 'https://devopsprojectshq.com', desc: 'Empleos DevOps, SRE, Cloud, ingeniería de plataformas' },
  { name: 'UI/UX Jobs Board', url: 'https://uiuxjobsboard.com/design-jobs/remote', desc: 'Empleos remotos para diseñadores UI/UX' },
  { name: 'EmbeddedJobs', url: 'https://embedded.jobs', desc: 'Ingenieros y desarrolladores de sistemas embebidos' },
  { name: 'Jobo', url: 'https://jobo.pl', desc: 'Empleos 100% remotos verificados de Polonia' },

  // ===== AGREGADORES =====
  { name: 'Career Vault', url: 'https://careervault.io/', desc: 'Cientos de empleos remotos diarios desde páginas de carreras' },
  { name: 'Findwork', url: 'https://findwork.dev/', desc: 'Agrega múltiples bolsas + Glassdoor + Crunchbase' },
  { name: 'Google Jobs', url: 'https://www.google.com/search?q=remote&ibp=htl;jobs', desc: 'Agrega ofertas de múltiples portales con filtros' },
  { name: 'JS Remotely', url: 'https://javascript.jobs/remote', desc: 'Todos los empleos remotos de JavaScript' },
  { name: 'Remote.io', url: 'https://www.remote.io/', desc: 'Agregador de empleos remotos tech' },
  { name: 'Remote 4 Me', url: 'https://remote4me.com/', desc: 'Agregador de empleos remotos tech y no-tech' },
  { name: 'Remote Index', url: 'https://remoteindex.co/', desc: 'Agregador de empleos remotos tech' },
  { name: 'Remote Python', url: 'https://www.remotepython.com/', desc: 'Agregador específico para empleos remotos Python' },
  { name: 'SlashJobs', url: 'https://slashjobs.com/', desc: 'Agregador con filtros and/or/not para developers' },
  { name: 'tokenjobs.io', url: 'https://tokenjobs.io?remote=true', desc: 'Agregador web3 con filtros por keyword, ubicación, idioma' },
  { name: 'UN Talent', url: 'https://untalent.org/jobs/home-based', desc: 'Vacantes en Naciones Unidas y agencias' },
  { name: 'Vollna', url: 'https://www.vollna.com/', desc: 'Agregador de los mejores sitios freelance' },
  { name: 'whoishiring.io', url: 'https://whoishiring.io/#!/search/19.41/-43.14/2/?remote=true', desc: 'Agregador con filtro remoto' },
];

const TOP_EMPRESAS = [
  { name: 'Automattic', url: 'https://automattic.com/work-with-us/', desc: 'Creadores de WordPress.com. 100% remota.' },
  { name: 'GitLab', url: 'https://about.gitlab.com/jobs/', desc: 'DevOps. Pioneros all-remote con transparencia total.' },
  { name: 'Toptal', url: 'https://www.toptal.com/careers', desc: 'Red global de developers. 100% remota.' },
  { name: 'Buffer', url: 'https://buffer.com/journey', desc: 'Redes sociales. Transparencia salarial y remoto.' },
  { name: 'Zapier', url: 'https://zapier.com/about', desc: 'Automatización no-code. 100% remota desde siempre.' },
  { name: 'Doist', url: 'https://doist.com/careers', desc: 'Creadores de Todoist. Equipo global asíncrono.' },
  { name: '1Password', url: 'https://1password.com/careers', desc: 'Gestor de contraseñas. Remoto-friendly.' },
  { name: 'Ghost', url: 'https://ghost.org/about/#careers', desc: 'Plataforma de publicación. Non-profit, 100% remota.' },
  { name: 'Basecamp', url: 'https://basecamp.com/about', desc: 'Gestión de proyectos. Remoto desde 1999.' },
  { name: 'Stripe', url: 'https://stripe.com/blog/remote-hub', desc: 'Infraestructura de pagos. Equipos remotos globales.' },
];

function loadChecklist() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveChecklist(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function toggleChecklistItem(id) {
  const data = loadChecklist();
  data[id] = !data[id];
  saveChecklist(data);
  renderChecklist();
  updateProgress();
}

function renderChecklist() {
  const container = $('career-checklist');
  if (!container) return;
  const data = loadChecklist();
  container.innerHTML = CHECKLIST_ITEMS.map(item => {
    const checked = data[item.id] || false;
    return `
      <div class="career-checklist-item ${checked ? 'completed' : ''}" onclick="window.toggleCareerChecklist('${item.id}')">
        <div class="career-checklist-check">${checked ? '✅' : '⬜'}</div>
        <div class="career-checklist-content">
          <div class="career-checklist-label">${item.label}</div>
          <div class="career-checklist-desc">${item.desc}</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateProgress() {
  const data = loadChecklist();
  const total = CHECKLIST_ITEMS.length;
  const done = CHECKLIST_ITEMS.filter(i => data[i.id]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = $('career-progress-bar');
  const text = $('career-progress-text');
  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = `${done}/${total} · ${pct}%`;
}

function renderPortales() {
  const container = $('career-portales');
  if (!container) return;
  container.innerHTML = TOP_PORTALES.map(p => `
    <a href="${p.url}" target="_blank" rel="noopener" class="career-link-card">
      <div class="career-link-name">${p.name}</div>
      <div class="career-link-desc">${p.desc}</div>
    </a>
  `).join('');
}

function renderEmpresas() {
  const container = $('career-empresas');
  if (!container) return;
  container.innerHTML = TOP_EMPRESAS.map(e => `
    <a href="${e.url}" target="_blank" rel="noopener" class="career-link-card">
      <div class="career-link-name">${e.name}</div>
      <div class="career-link-desc">${e.desc}</div>
    </a>
  `).join('');
}

function switchCareerTab(tabId, btn) {
  document.querySelectorAll('.career-subtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.career-tab-content').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const tab = $('career-tab-' + tabId);
  if (tab) tab.classList.add('active');
}

export function initCareer() {
  window.toggleCareerChecklist = toggleChecklistItem;
  window.switchCareerTab = switchCareerTab;

  // Render on DOMContentLoaded or immediately if already loaded
  const render = () => {
    renderChecklist();
    updateProgress();
    renderPortales();
    renderEmpresas();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  return { renderChecklist, updateProgress };
}
