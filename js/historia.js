// Pantalla 1 — Mi parcela (se completa en la fase 5).
import { t } from './i18n.js';
import { encabezado } from './etiquetas.js';

export function montar(el, ctx) {
  el.innerHTML = encabezado('titulo-parcela', ctx.datos.parcela.comunidad, t('p1.titulo'), t('p1.intro'));
}
export function actualizar() {}
