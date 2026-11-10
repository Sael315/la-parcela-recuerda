// Etiquetas de origen: OBSERVADO, ESTIMADO, REPORTADO, SIMULADO, EJEMPLO.
// Siempre llevan la palabra escrita; el color solo ayuda.

import { t, esc, fecha } from './i18n.js';

export const ETIQUETAS = ['OBSERVADO', 'ESTIMADO', 'REPORTADO', 'SIMULADO', 'EJEMPLO'];

/**
 * Píldora con la etiqueta de origen.
 * @param {string} tipo una de ETIQUETAS
 * @returns {string} HTML
 */
export function etiqueta(tipo) {
  const valido = ETIQUETAS.includes(tipo) ? tipo : 'EJEMPLO';
  return `<span class="etq etq-${valido.toLowerCase()}" title="${esc(t(`etq.ayuda.${valido}`))}">${esc(t(`etq.${valido}`))}</span>`;
}

/**
 * Encabezado de pantalla al estilo VERDA: píldora a la izquierda y titular ligero.
 * @param {string} id  id del h2 (para aria-labelledby)
 */
export function encabezado(id, chip, titulo, intro) {
  return `<header class="encabezado">
    <span class="pildora">${esc(chip)}</span>
    <div><h2 id="${id}">${esc(titulo)}</h2><p>${esc(intro)}</p></div>
  </header>`;
}

/** Etiquetas distintas de una lista, sin nulos. */
export function etiquetasUnicas(lista) {
  return [...new Set(lista.filter(Boolean))];
}

/**
 * Etiqueta + fuente + fecha, en una línea pequeña.
 * @param {{etiqueta: string, fuente?: string|null, fecha?: string|null}} dato
 * @returns {string} HTML
 */
export function meta(dato) {
  const partes = [];
  if (dato.fuente) partes.push(esc(dato.fuente));
  if (dato.fecha) partes.push(esc(fecha(dato.fecha)));
  return `<span class="meta">${etiqueta(dato.etiqueta)}${partes.length ? `<span>${partes.join(', ')}</span>` : ''}</span>`;
}
