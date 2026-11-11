// Parcela propia: la que marca el agricultor en el mapa. Geometría y guardado en el celular.

const CLAVE = 'lpr.parcela_propia';
export const M2_POR_TAREA = 628.86; // tarea dominicana

/**
 * @typedef {{type: 'Polygon', coordinates: number[][][]}} Poligono  GeoJSON, [lon, lat]
 * @typedef {{poligono_geojson: Poligono, centro: {lat: number, lon: number}, guardada: string}} ParcelaPropia
 */

/** Área en m² (proyección local simple, suficiente para una parcela). */
export function areaM2(geojson) {
  const anillo = geojson.coordinates[0];
  const lat0 = (anillo.reduce((a, p) => a + p[1], 0) / anillo.length) * Math.PI / 180;
  const xy = anillo.map(([lon, lat]) => [lon * 111320 * Math.cos(lat0), lat * 110540]);
  let s = 0;
  for (let i = 0; i < xy.length - 1; i++) s += xy[i][0] * xy[i + 1][1] - xy[i + 1][0] * xy[i][1];
  return Math.abs(s) / 2;
}

/** Centro aproximado: promedio de las esquinas (sin repetir la última). */
export function centroide(geojson) {
  const anillo = geojson.coordinates[0].slice(0, -1);
  const lon = anillo.reduce((a, p) => a + p[0], 0) / anillo.length;
  const lat = anillo.reduce((a, p) => a + p[1], 0) / anillo.length;
  return { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) };
}

/** Distancia en km entre dos puntos {lat, lon}. */
export function distanciaKm(a, b) {
  const rad = (g) => g * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function segmentosSeCortan(p1, p2, p3, p4) {
  const giro = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = giro(p3, p4, p1);
  const d2 = giro(p3, p4, p2);
  const d3 = giro(p1, p2, p3);
  const d4 = giro(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * ¿El contorno cerrado se cruza consigo mismo?
 * @param {number[][]} puntos esquinas [x, y] sin repetir la primera
 */
export function seCruza(puntos) {
  const n = puntos.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue; // lados vecinos
      if (segmentosSeCortan(puntos[i], puntos[(i + 1) % n], puntos[j], puntos[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * Arma el polígono GeoJSON a partir de las esquinas marcadas.
 * @param {number[][]} puntos [lat, lon]
 * @returns {Poligono}
 */
export function poligonoDesdePuntos(puntos) {
  const anillo = puntos.map(([lat, lon]) => [Number(lon.toFixed(6)), Number(lat.toFixed(6))]);
  anillo.push([...anillo[0]]);
  return { type: 'Polygon', coordinates: [anillo] };
}

function valida(p) {
  const anillo = p?.poligono_geojson?.coordinates?.[0];
  return Array.isArray(anillo) && anillo.length >= 4
    && anillo.every((q) => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1]))
    && Number.isFinite(p.centro?.lat) && Number.isFinite(p.centro?.lon);
}

/** @returns {ParcelaPropia|null} */
export function leerPropia() {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE));
    return valida(p) ? p : null;
  } catch {
    return null;
  }
}

/** @returns {boolean} si se pudo guardar en el celular */
export function guardarPropia(p) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export function borrarPropia() {
  try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
}

/**
 * La parcela que usa la app: la propia (si existe) sobre la base de parcela.json.
 * @param {Object} base  contenido de parcela.json
 * @param {ParcelaPropia|null} propia
 */
export function parcelaActiva(base, propia) {
  if (!propia) {
    return { ...base, propia: false, area_m2: areaM2(base.poligono_geojson) };
  }
  return {
    ...base,
    propia: true,
    etiqueta: 'REPORTADO',
    centro: propia.centro,
    poligono_geojson: propia.poligono_geojson,
    area_tareas: null,
    area_m2: areaM2(propia.poligono_geojson),
    guardada: propia.guardada,
  };
}
