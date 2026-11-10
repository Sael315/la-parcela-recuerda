// Textos ES/EN. Los textos viven en data/textos.json.

const CLAVE_IDIOMA = 'lpr.idioma';

let textos = { es: {}, en: {} };
let idioma = 'es';

/** @param {{es: Object<string,string>, en: Object<string,string>}} t */
export function cargarTextos(t) { textos = t; }

/** Idioma guardado, o el de config.json. */
export function idiomaInicial(porDefecto = 'es') {
  try {
    const guardado = localStorage.getItem(CLAVE_IDIOMA);
    if (guardado === 'es' || guardado === 'en') return guardado;
  } catch { /* sin almacenamiento */ }
  return porDefecto === 'en' ? 'en' : 'es';
}

export function getIdioma() { return idioma; }

/** @param {'es'|'en'} nuevo */
export function setIdioma(nuevo) {
  idioma = nuevo === 'en' ? 'en' : 'es';
  document.documentElement.lang = idioma;
  try { localStorage.setItem(CLAVE_IDIOMA, idioma); } catch { /* sin almacenamiento */ }
}

/**
 * Devuelve el texto de una clave, con {variables} reemplazadas.
 * @param {string} clave
 * @param {Object<string, string|number>} [vars]
 */
export function t(clave, vars = {}) {
  const base = textos[idioma]?.[clave] ?? textos.es?.[clave] ?? clave;
  return base.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

/** Elige el campo traducido de un objeto de datos: campo / campo_en. */
export function tr(obj, campo) {
  if (!obj) return '';
  if (idioma === 'en' && obj[`${campo}_en`]) return obj[`${campo}_en`];
  return obj[campo] ?? '';
}

/** Aplica los textos a los elementos con data-i18n / data-i18n-aria. */
export function aplicarTextos(raiz = document) {
  raiz.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  raiz.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

/** Formatea números según el idioma. */
export function num(valor, decimales = 0) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-DO', {
    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
  }).format(valor);
}

/** Formatea una fecha ISO (AAAA-MM-DD) como "15 ago 2019". */
export function fecha(iso, opciones = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—';
  const d = typeof iso === 'number' ? new Date(iso) : new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-DO', opciones).format(d).replace(/\./g, '');
}

/** Escapa texto para insertarlo como HTML. */
export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
