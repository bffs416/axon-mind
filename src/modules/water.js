import { supabase, $, showToast, fireConfetti } from './config.js';

export function initWater() {
  // ==================== WATER TRACKER ====================
  let waterProfile = localStorage.getItem('axon_water_profile') || 'Pipe';
  
  const getTodayLocal = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWaterKey = () => {
    return `axon_water_${waterProfile}_${getTodayLocal()}`;
  };
  
  // Migrar de formato viejo (toDateString) a ISO si es necesario
  const migrateWaterKey = (profile) => {
    const today = new Date();
    const localDate = getTodayLocal();
    const oldKey = `axon_water_${profile}_` + today.toDateString();
    const newKey = `axon_water_${profile}_${localDate}`;
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
      window.fetchWaterFromSupabase();
  };
  
  window.addWater = async (amount) => {
      const before = waterTotal;
      waterTotal += amount;
      localStorage.setItem(getWaterKey(), waterTotal.toString());
      updateWaterDisplay();
      showToast(`💧 ${waterProfile}: +${amount.toFixed(2)}L | Total: ${waterTotal.toFixed(1)}L`);
  
      // Sincronizar con Supabase
      try {
          const { error } = await supabase.from('water_logs').insert({
              profile: waterProfile,
              amount: amount,
              date: getTodayLocal(),
              total_after: waterTotal
          });
          if (error) console.warn("Sync Water Error:", error);
      } catch (e) {
          console.warn("Supabase Water Sync failed (table might not exist):", e);
      }

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
  
  window.saveWater = async () => {
      const litros = waterTotal.toFixed(1);
      const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  
      showToast(`🔄 Sincronizando ${waterProfile}...`);
  
      try {
          const today = getTodayLocal();
          const { data, error } = await supabase
              .from('water_logs')
              .select('amount')
              .eq('profile', waterProfile)
              .eq('date', today);
  
          if (data) {
              const sum = data.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
              waterTotal = sum;
              localStorage.setItem(getWaterKey(), waterTotal.toString());
              updateWaterDisplay();
          }
          
          showToast(`✅ ${waterProfile}: Sincronizado. Total hoy: ${waterTotal.toFixed(1)}L`);
      } catch (e) {
          showToast(`⚠️ Error al sincronizar. Se mantuvo local.`);
      }
  };
  
  window.fetchWaterFromSupabase = async () => {
      try {
          const today = getTodayLocal();
          const { data, error } = await supabase
              .from('water_logs')
              .select('amount')
              .eq('profile', waterProfile)
              .eq('date', today);
  
          if (data) {
              const sum = data.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
              // Si el total en la nube es diferente al local, actualizamos
              if (Math.abs(sum - waterTotal) > 0.01) {
                  waterTotal = sum;
                  localStorage.setItem(getWaterKey(), waterTotal.toString());
                  updateWaterDisplay();
                  showToast(`💧 ${waterProfile}: ${waterTotal.toFixed(1)}L (Sincronizado)`);
                  console.log(`[Sync] ${waterProfile} actualizado a ${waterTotal.toFixed(1)}L`);
              }
          }
      } catch (e) {
          console.warn("Error en fetchWaterFromSupabase:", e);
      }
  };
  
  // Sincronización automática
  document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
          window.fetchWaterFromSupabase();
      }
  });
  
  setInterval(window.fetchWaterFromSupabase, 1000 * 60 * 5); // Cada 5 minutos

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

