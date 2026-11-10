// Pantalla 2 — Mi suelo hoy (se completa en la fase 6).
import { t } from './i18n.js';
import { encabezado } from './etiquetas.js';

export function montar(el) {
  el.innerHTML = encabezado('titulo-suelo', t('p2.chip'), t('p2.titulo'), t('p2.intro'));
}
export function actualizar() {}
