// Lee el sensor simulado (Wokwi → ThingSpeak) desde el canal público, sin clave.
// Si falla o la lectura es vieja, usa la última lectura guardada en este celular.

const CLAVE = 'lpr.ultima_lectura';

/**
 * @typedef {Object} EstadoSensor
 * @property {'vivo'|'sin_conexion'|'sin_configurar'} estado
 * @property {{ph: number, sal: number, hora: string}|null} lectura
 */

function leerGuardada() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE));
    if (g && Number.isFinite(g.ph) && Number.isFinite(g.sal) && g.hora) return g;
  } catch { /* sin almacenamiento */ }
  return null;
}

function guardar(lectura) {
  try { localStorage.setItem(CLAVE, JSON.stringify(lectura)); } catch { /* sin almacenamiento */ }
}

/**
 * Empieza a leer el canal cada `intervalo_ms`.
 * @param {Object} config  config.thingspeak
 * @param {(e: EstadoSensor) => void} alCambiar  se llama cuando cambia el estado o llega una lectura nueva
 * @param {() => void} [cadaSegundo]  para refrescar "hace N s"
 */
export function iniciarSensor(config, alCambiar, cadaSegundo) {
  const canal = config?.canal_id;
  if (!config?.habilitado || !canal || canal === 'PENDIENTE') {
    alCambiar({ estado: 'sin_configurar', lectura: null });
    return;
  }

  let anterior = '';
  const avisar = (e) => {
    const firma = `${e.estado}|${e.lectura?.hora ?? ''}`;
    if (firma !== anterior) { anterior = firma; alCambiar(e); }
  };

  async function consultar() {
    try {
      const resp = await fetch(`https://api.thingspeak.com/channels/${encodeURIComponent(canal)}/feeds/last.json`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const j = await resp.json();
      const lectura = { ph: parseFloat(j?.[config.campo_ph]), sal: parseFloat(j?.[config.campo_sal]), hora: j?.created_at };
      const edad = (Date.now() - Date.parse(lectura.hora)) / 1000;
      if (Number.isFinite(lectura.ph) && Number.isFinite(lectura.sal) && edad <= config.max_antiguedad_s) {
        guardar(lectura);
        avisar({ estado: 'vivo', lectura });
        return;
      }
      if (Number.isFinite(lectura.ph) && Number.isFinite(lectura.sal)) guardar(lectura);
    } catch { /* sin red o canal caído: se usa lo guardado */ }
    avisar({ estado: 'sin_conexion', lectura: leerGuardada() });
  }

  consultar();
  setInterval(consultar, config.intervalo_ms || 15000);
  if (cadaSegundo) setInterval(cadaSegundo, 1000);
}
