// ==================== AXON MIND — CONFIG & SHARED DEPENDENCIES ====================
import { createClient } from '@supabase/supabase-js';
import { createIcons, Play, Pause, RotateCcw, Calendar, ListTodo, Plus, Check, Circle, BarChart3, UploadCloud, Edit2, Trash2, X, Zap, Layers, BookOpen, DollarSign } from 'lucide';

// ==================== SUPABASE ====================
export const supabase = createClient(
  'https://blwaxxacneipoaufpiag.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsd2F4eGFjbmVpcG9hdWZwaWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5Mzg0ODgsImV4cCI6MjA3MzUxNDQ4OH0.MYorhHHAEOnFj5DPYZHozi5pyDZbtJQDBOeD2Te3WXU'
);

// ==================== WEBHOOK URLs ====================
export const N8N_URL = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/pomodoro-sync';
export const ARCHITECT_URL = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/axon-architect';
export const SLICER_URL = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/axon-slicer';
export const POLYGLOT_TRANSLATE_URL = 'https://n8n-tuzb.srv1017783.hstgr.cloud/webhook/polyglot-translate';

// ==================== THEME ====================
window.setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('axon_theme', theme);
};
const savedTheme = localStorage.getItem('axon_theme') || 'light';
window.setTheme(savedTheme);

// ==================== DOM HELPER ====================
window.$ = id => document.getElementById(id);
export const $ = window.$;
window.closeModal = (id) => { $(id).style.display = 'none'; };

// ==================== ICONS ====================
export function initIcons() {
  createIcons({ icons: { Play, Pause, RotateCcw, Calendar, ListTodo, Plus, Check, Circle, BarChart3, UploadCloud, Edit2, Trash2, X, Zap, Layers, BookOpen, DollarSign } });
}
window.initIcons = initIcons;

// ==================== AUDIO ALARM ====================
const ALARM_CONFIG = {
  useCustomSound: false,
  soundUrl: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
  volume: 0.5
};

export function playSound(type = 'workEnd') {
  if (ALARM_CONFIG.useCustomSound) {
    const audio = new Audio(ALARM_CONFIG.soundUrl);
    audio.volume = ALARM_CONFIG.volume;
    audio.play();
    return;
  }

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const configs = {
    workStart: [
      { f: 660, d: 0, t: 0.1 },
      { f: 880, d: 0.1, t: 0.2 }
    ],
    workEnd: [
      { f: 880, d: 0, t: 0.2 },
      { f: 880, d: 0.3, t: 0.2 },
      { f: 880, d: 0.6, t: 0.2 }
    ],
    breakStart: [
      { f: 440, d: 0, t: 0.3 },
      { f: 330, d: 0.3, t: 0.4 }
    ]
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

// ==================== TOAST ====================
export function showToast(msg) {
  const t = $('motivation-toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ==================== CONFETTI ====================
export function fireConfetti() {
  const canvas = $('confetti-canvas'), ctx = canvas.getContext('2d');
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

// ==================== SHARED HELPERS ====================
export const capitalizeFirstLetter = (str) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const linkify = (text) => {
  if (!text) return "";
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlPattern, '<a href="$1" target="_blank" style="color:var(--accent);text-decoration:underline;">$1</a>');
};

export const timeToMin = (t) => { if(!t) return 0; const [h,m] = t.split(':').map(Number); return h*60+m; };
export const minToTime = (m) => { const h = Math.floor(m/60).toString().padStart(2,'0'), mm = (m%60).toString().padStart(2,'0'); return `${h}:${mm}`; };
export const format12h = (tStr) => {
  if(!tStr) return '';
  let [h, m] = tStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; h = h ? h : 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
};
export const formatDuration = (min) => {
  const h = Math.floor(min/60), m = min%60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const motivations = [
  "¡Excelente! Un paso más cerca de tu meta 🚀","¡Así se hace! Tu futuro yo te lo agradecerá 💪",
  "¡Increíble enfoque! Mereces ese descanso 🎯","¡Pomodoro completado! Eres imparable 🔥",
  "¡Otro logro más! La constancia es tu superpoder ⭐","¡Genial! Cada minuto cuenta 🏆"
];
