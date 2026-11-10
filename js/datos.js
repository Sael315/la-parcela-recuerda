// Lee los JSON de data/ y revisa que tengan la forma esperada.

const ARCHIVOS = ['config', 'parcela', 'historia', 'clima', 'suelo', 'cultivos', 'reglas', 'umbrales', 'textos'];

/** Error de carga que recuerda qué archivo falló. */
export class ErrorDatos extends Error {
  /** @param {string} archivo @param {string} detalle */
  constructor(archivo, detalle) {
    super(`${archivo}: ${detalle}`);
    this.archivo = archivo;
  }
}

/**
 * Comprobaciones mínimas de forma. Cada una devuelve un texto si algo falta.
 * @type {Object<string, (d: any) => string|null>}
 */
const FORMAS = {
  config: (d) => (d.thingspeak && typeof d.thingspeak.canal_id === 'string' ? null : 'falta thingspeak.canal_id'),
  parcela: (d) => (d.centro && Number.isFinite(d.centro.lat) && d.poligono_geojson?.coordinates ? null : 'faltan centro o poligono_geojson'),
  historia: (d) => (Array.isArray(d.serie) && Array.isArray(d.ciclos) && d.resumen ? null : 'faltan serie, ciclos o resumen'),
  clima: (d) => (Array.isArray(d.lluvia_anual_mm) ? null : 'falta lluvia_anual_mm'),
  suelo: (d) => (d.ph && d.sal_dsm ? null : 'faltan ph o sal_dsm'),
  cultivos: (d) => (d.cultivos && Object.values(d.cultivos).every((c) => c.puntaje) ? null : 'cada cultivo necesita puntaje'),
  reglas: (d) => (Array.isArray(d) && d.every((r) => r.id && Array.isArray(r.cuando)) ? null : 'cada regla necesita id y cuando'),
  umbrales: (d) => (Number.isFinite(d.sal_alta_dsm) && Number.isFinite(d.anio_seco_fraccion) ? null : 'faltan umbrales de sal o de año seco'),
  textos: (d) => (d.es && d.en ? null : 'faltan los textos es / en'),
};

/**
 * Lee un JSON de data/ y valida su forma.
 * @param {string} nombre sin extensión
 */
export async function leerArchivo(nombre) {
  let datos;
  try {
    const resp = await fetch(`data/${nombre}.json`, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    datos = await resp.json();
  } catch (e) {
    throw new ErrorDatos(`data/${nombre}.json`, e.message);
  }
  const problema = FORMAS[nombre]?.(datos);
  if (problema) throw new ErrorDatos(`data/${nombre}.json`, problema);
  return datos;
}

/**
 * Carga todos los archivos de datos.
 * @returns {Promise<Object<string, any>>}
 */
export async function cargarDatos() {
  const valores = await Promise.all(ARCHIVOS.map(leerArchivo));
  return Object.fromEntries(ARCHIVOS.map((n, i) => [n, valores[i]]));
}
