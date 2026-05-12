import { $, showToast } from './config.js';

export function initWater() {
  // ==================== WATER TRACKER ====================
  let waterProfile = localStorage.getItem('axon_water_profile') || 'Pipe';
  
  const getWaterKey = () => {
    const iso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD locale-independent
    return `axon_water_${waterProfile}_${iso}`;
  };
  
  // Migrar de formato viejo (toDateString) a ISO si es necesario
  const migrateWaterKey = (profile) => {
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    const oldKey = `axon_water_${profile}_` + today.toDateString();
    const newKey = `axon_water_${profile}_${iso}`;
    const oldVal = localStorage.getItem(oldKey);
    if (oldVal !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, oldVal);
    }
    return parseFloat(localStorage.getItem(newKey) || '0');
  };
  
  let waterTotal = migrateWaterKey(waterProfile);
  
  window.switchWaterProfile = (profile, btn) => {
      waterProfile = profile;
      localStorage.setItem('axon_water_profile', profile);
  
      // Update active button
      document.querySelectorAll('.water-profile-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
  
      // Reload water total for this profile
      waterTotal = parseFloat(localStorage.getItem(getWaterKey()) || '0');
      updateWaterDisplay();
  };
  
  window.addWater = (amount) => {
      const before = waterTotal;
      waterTotal += amount;
      localStorage.setItem(getWaterKey(), waterTotal.toString());
      updateWaterDisplay();
      showToast(`💧 ${waterProfile}: +${amount.toFixed(2)}L | Total: ${waterTotal.toFixed(1)}L`);
  
      // Dopamina: confeti al llegar a 3L
      if (before < 3 && waterTotal >= 3) {
          fireConfetti();
          setTimeout(() => fireConfetti(), 400);
          showToast(`🏆 ¡${waterProfile} LLEGÓ A 3L! ¡Hidratación óptima! 🎉`);
      }
  };
  
  window.resetWater = () => {
      waterTotal = 0;
      localStorage.setItem(getWaterKey(), '0');
      updateWaterDisplay();
  };
  
  window.saveWater = () => {
      const litros = waterTotal.toFixed(1);
      const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  
      // Guardar en localStorage por perfil
      const historial = JSON.parse(localStorage.getItem('axon_water_history') || '{}');
      const key = `${waterProfile}_${new Date().toDateString()}`;
      historial[key] = waterTotal;
      localStorage.setItem('axon_water_history', JSON.stringify(historial));
  
      // Notificación visual
      showToast(`💧 ${waterProfile}: ¡Hidratación guardada! ${litros}L — ${hoy}`);
  
      // Reiniciar contador para mañana
      waterTotal = 0;
      localStorage.setItem(getWaterKey(), '0');
      updateWaterDisplay();
  };
  
  function updateWaterDisplay() {
      const current = $('water-current');
      const fill = $('water-fill');
      if (current) current.textContent = waterTotal.toFixed(1);
      if (fill) fill.style.width = Math.min((waterTotal / 3) * 100, 100) + '%';
  }
  
  // Init water profile button on load
  document.addEventListener('DOMContentLoaded', () => {
      const btn = document.querySelector(`.water-profile-btn[data-water-profile="${waterProfile}"]`);
      if (btn) { btn.classList.add('active'); }
  });

  return { updateWaterDisplay, migrateWaterKey, waterProfile };
}
