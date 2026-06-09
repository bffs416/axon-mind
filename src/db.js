import { createClient } from '@supabase/supabase-js';
import { createIcons, Play, Pause, RotateCcw, Calendar, ListTodo, Plus, Check, Circle, CheckCircle, BarChart3, UploadCloud, Edit2, Trash2, X, Zap, Layers, BookOpen, DollarSign, Music, Globe, Briefcase, Map, Component, Mic, Activity, Headphones, Eye, PlayCircle, Brain, Search, Cloud, DownloadCloud, FileText, Braces, Sparkles, Lightbulb } from 'lucide';

// ==================== SUPABASE ====================
export const supabase = createClient(
  window.location.origin,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJwb3N0Z3JlcyIsImlhdCI6MTc4MDk1NTU3OSwiZXhwIjoyMDk2MzE1NTc5fQ.LQcQih063fmKguL8WQy8gqbTOO9QdSwg_p-M5zZPV84'
);

// ==================== URLS ====================
export const N8N_URL = window.location.origin + '/webhook/pomodoro-sync';
export const ARCHITECT_URL = window.location.origin + '/webhook/axon-architect';
export const SLICER_URL = window.location.origin + '/webhook/axon-slicer';
export const POLYGLOT_TRANSLATE_URL = window.location.origin + '/webhook/polyglot-translate';
export const DISTILL_URL = window.location.origin + '/webhook/distill-media';
export const FINANCE_ASSISTANT_URL = window.location.origin + '/webhook/finance-assistant';

// ==================== THEME ====================
export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('axon_theme', theme);
}
window.setTheme = setTheme;

const savedTheme = localStorage.getItem('axon_theme') || 'light';
setTheme(savedTheme);

// ==================== CONSTANTS ====================
export const modes = { pomodoro: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };
export const weekPlan = JSON.parse(localStorage.getItem('axon_week_plan') || '[]');
export const ALARM_CONFIG = {
  useCustomSound: false,
  soundUrl: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
  volume: 0.5
};
export const motivations = [
  "¡Excelente! Un paso más cerca de tu meta 🚀","¡Así se hace! Tu futuro yo te lo agradecerá 💪",
  "¡Increíble enfoque! Mereces ese descanso 🎯","¡Pomodoro completado! Eres imparable 🔥",
  "¡Otro logro más! La constancia es tu superpoder ⭐","¡Genial! Cada minuto cuenta 🏆"
];
export const SRS_INTERVALS = [0.00694, 1, 3, 7, 14, 30, 90];
export const MAX_SRS_LEVEL = 6;
export const SRS_XP = { difficult: 10, good: 5, easy: 2 };
export const POLYMATH_LEVELS = [
  { name: 'Novato', minXP: 0, emoji: '🌱' },
  { name: 'Aprendiz', minXP: 100, emoji: '🌿' },
  { name: 'Explorador', minXP: 300, emoji: '🌳' },
  { name: 'Erudito', minXP: 1000, emoji: '📚' },
  { name: 'Maestro', minXP: 3000, emoji: '🏆' },
  { name: 'Polímata', minXP: 10000, emoji: '🧠' }
];

export const POLYGLOT_LANGUAGES = {
  fr: { name: 'Francés', flag: '🇫🇷', tts: 'fr-FR', color: '#3b82f6' },
  pt: { name: 'Portugués', flag: '🇵🇹', tts: 'pt-PT', color: '#10b981' },
  de: { name: 'Alemán', flag: '🇩🇪', tts: 'de-DE', color: '#f59e0b' },
  hi: { name: 'Hindi', flag: '🇮🇳', tts: 'hi-IN', color: '#f97316' },
  ar: { name: 'Árabe', flag: '🇸🇦', tts: 'ar-SA', color: '#059669' },
  ko: { name: 'Coreano', flag: '🇰🇷', tts: 'ko-KR', color: '#ec4899' },
  zh: { name: 'Chino', flag: '🇨🇳', tts: 'zh-CN', color: '#dc2626' }
};
export const POLYGLOT_LANG_IDS = Object.keys(POLYGLOT_LANGUAGES);

// ==================== HELPERS ====================
export function capitalizeFirstLetter(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function linkify(text) {
  if (!text) return "";
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlPattern, '<a href="$1" target="_blank" style="color:var(--accent);text-decoration:underline;">$1</a>');
}

export function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatCurrency(amount) {
  return '$' + Number(amount).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatCurrencyUSD(amount) {
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtMoney(amount, currency) {
  if (currency === 'USD') return formatCurrencyUSD(amount);
  return formatCurrency(amount);
}

// ==================== DOM HELPERS ====================
window.$ = id => document.getElementById(id);
export const $ = window.$;
window.closeModal = (id) => { $(id).style.display = 'none'; };

export function initIcons() {
  createIcons({ icons: { Play, Pause, RotateCcw, Calendar, ListTodo, Plus, Check, Circle, CheckCircle, BarChart3, UploadCloud, Edit2, Trash2, X, Zap, Layers, BookOpen, DollarSign, Music, Globe, Briefcase, Map, Component, Mic, Activity, Headphones, Eye, PlayCircle, Brain, Search, Cloud, DownloadCloud, FileText, Braces, Sparkles, Lightbulb } });
}
window.initIcons = initIcons;

// ==================== TOAST ====================
export function showToast(msg) {
  const t = $('motivation-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ==================== AUDIO ====================
export function playSound(type) {
  try {
    if (!ALARM_CONFIG.soundEnabled) return;
    if (ALARM_CONFIG.soundUrl) {
      const audio = new Audio(ALARM_CONFIG.soundUrl);
      audio.volume = ALARM_CONFIG.volume;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => { console.warn("Audio play blocked by browser:", error); });
      }
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const configs = {
      workStart: [{ f: 660, d: 0, t: 0.1 }, { f: 880, d: 0.1, t: 0.2 }],
      workEnd: [{ f: 880, d: 0, t: 0.2 }, { f: 880, d: 0.3, t: 0.2 }, { f: 880, d: 0.6, t: 0.2 }],
      breakStart: [{ f: 440, d: 0, t: 0.3 }, { f: 330, d: 0.3, t: 0.4 }]
    };
    (configs[type] || configs.workEnd).forEach(s => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = s.f;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + s.d);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s.d + s.t);
      osc.start(ctx.currentTime + s.d);
      osc.stop(ctx.currentTime + s.d + s.t);
    });
  } catch (e) {
    console.warn("playSound failed:", e);
  }
}

// ==================== NOTIFICATIONS ====================
export async function showNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '🎯', vibrate: [200, 100, 200], requireInteraction: true });
  }
}

export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ==================== CONFETTI ====================
export function fireConfetti() {
  const canvas = $('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const particles = Array.from({length: 120}, () => ({
    x: canvas.width/2, y: canvas.height/2,
    vx: (Math.random()-0.5)*16, vy: Math.random()*-14 - 4,
    size: Math.random()*6+3, color: ['#8b5cf6','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899'][Math.floor(Math.random()*6)],
    life: 1
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.008;
      if (p.life > 0) { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x,p.y,p.size,p.size); }
    });
    ctx.globalAlpha = 1;
    if (++frame < 120) requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  draw();
}

// ==================== WAKE LOCK ====================
let wakeLock = null;
export async function requestWakeLock() {
  if ('wakeLock' in navigator && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {}
  }
}
export async function releaseWakeLock() {
  if (wakeLock) {
    try { await wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }
}

// ==================== TIMER PERSISTENCE ====================
export function saveTimerState(pomodoroEndTime, currentMode, sessionsCompleted, pomodoroStartTime, selectedTaskId, selectedTaskTitle, currentSessionId) {
  if (!pomodoroEndTime) return;
  sessionStorage.setItem('axon_timer', JSON.stringify({
    pomodoroEndTime, currentMode, sessionsCompleted, pomodoroStartTime,
    selectedTaskId, selectedTaskTitle, currentSessionId
  }));
}

export function clearTimerState() {
  sessionStorage.removeItem('axon_timer');
}

export function restoreTimerState(timerState, updateDisplay, startBtn, pauseBtn, handleTimerComplete, requestWakeLockFn) {
  const saved = sessionStorage.getItem('axon_timer');
  if (!saved) return false;
  try {
    const st = JSON.parse(saved);
    const now = Date.now();
    if (st.pomodoroEndTime > now) {
      timerState.pomodoroEndTime = st.pomodoroEndTime;
      timerState.currentMode = st.currentMode;
      timerState.sessionsCompleted = st.sessionsCompleted;
      timerState.pomodoroStartTime = st.pomodoroStartTime;
      timerState.selectedTaskId = st.selectedTaskId;
      timerState.selectedTaskTitle = st.selectedTaskTitle;
      timerState.currentSessionId = st.currentSessionId;
      timerState.timeLeft = Math.max(0, Math.ceil((st.pomodoroEndTime - now) / 1000));
      updateDisplay(timerState);
      document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === st.currentMode);
      });
      document.body.classList.add('immersive-mode');
      if (startBtn) startBtn.disabled = true;
      if (pauseBtn) pauseBtn.disabled = false;
      timerState.timerId = setInterval(async () => {
        timerState.timeLeft = Math.max(0, Math.ceil((timerState.pomodoroEndTime - Date.now()) / 1000));
        updateDisplay(timerState);
        if (timerState.timeLeft <= 0) {
          await handleTimerComplete(timerState);
        }
      }, 1000);
      if (requestWakeLockFn) requestWakeLockFn();
      return true;
    }
  } catch (e) {}
  clearTimerState();
  return false;
}

// ==================== POLYGLOT ALPHABETS ====================
export const POLYGLOT_ALPHABETS = {
  fr: { script: 'Latino', chars: 'A a B b C c D d E e F f G g H h I i J j K k L l M m N n O o P p Q q R r S s T t U u V v W w X x Y y Z z<br>À à Â â Æ æ Ç ç É é È è Ê ê Ë ë Î î Ï ï Ô ô Œ œ Ù ù Û û Ü ü' },
  pt: { script: 'Latino', chars: 'A a B b C c D d E e F f G g H h I i J j K k L l M m N n O o P p Q q R r S s T t U u V v W w X x Y y Z z<br>Á á Â â Ã ã À à Ç ç É é Ê ê Í í Ó ó Ô ô Õ õ Ú ú Ü ü' },
  de: { script: 'Latino', chars: 'A a B b C c D d E e F f G g H h I i J j K k L l M m N n O o P p Q q R r S s T t U u V v W w X x Y y Z z<br>Ä ä Ö ö Ü ü ß' },
  hi: { script: 'Devanagari', chars: 'अ आ इ ई उ ऊ ए ऐ ओ औ क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह' },
  ar: { script: 'Árabe', chars: 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي' },
  ko: { script: 'Hangul', chars: 'ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ<br>ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ' },
  zh: { script: 'Hanzi (Simplificado)', chars: '的 一 是 不 了 人 我 在 有 他 这 中 大 来 上 国 个 到 说 们 为 子 和 你 地 出 道 也 时 年 得 就 那 要 下 以 生 会 自 着 去 之 过 家 学 对 可 她 里 后 么 天 然 能 没 日 面 心 经 成 发 工 向 动 走 做 爱 开 手 分 长 水 头 机 当 住 部 打 党 方 又 白 如 前 所 定 见 月 把 但 信 使 全 女 数 注 公 很' }
};

// ==================== GET POLYMATH LEVEL ====================
export function getPolymathLevel(xp) {
  let level = POLYMATH_LEVELS[0];
  for (const l of POLYMATH_LEVELS) {
    if (xp >= l.minXP) level = l;
  }
  return level;
}

export function getXPForNextLevel(xp) {
  for (let i = 0; i < POLYMATH_LEVELS.length - 1; i++) {
    if (xp >= POLYMATH_LEVELS[i].minXP && xp < POLYMATH_LEVELS[i + 1].minXP) {
      return POLYMATH_LEVELS[i + 1].minXP - xp;
    }
  }
  return 0;
}
