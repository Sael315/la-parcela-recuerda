// Calcula las señales del motor a partir de los datos, la lectura del sensor y la corrección del agricultor.

/**
 * @typedef {Object} Senal
 * @property {*} valor
 * @property {string} etiqueta   OBSERVADO | ESTIMADO | REPORTADO | SIMULADO | EJEMPLO
 * @property {string|null} [fuente]
 * @property {string|null} [fecha]
 */

/** Si el archivo es de ejemplo, la señal también lo es. */
const etq = (archivo, normal) => (archivo?.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : normal);

/**
 * ¿El último ciclo fue seco? Compara su lluvia con anio_seco_fraccion × promedio de los ciclos.
 * @param {{ciclo: number, mm: number|null}[]} porCiclo
 * @param {number} fraccion
 * @returns {boolean|null}
 */
export function ultimoCicloSeco(porCiclo, fraccion) {
  const validos = (porCiclo ?? []).filter((c) => Number.isFinite(c.mm));
  if (validos.length < 2) return null;
  const promedio = validos.reduce((a, c) => a + c.mm, 0) / validos.length;
  const ultimo = validos.reduce((a, c) => (c.ciclo > a.ciclo ? c : a));
  return ultimo.mm < fraccion * promedio;
}

/**
 * @param {Object} datos  todos los JSON
 * @param {Object} ctx
 * @param {{ph: number|null, sal: number|null, hora: string}|null} ctx.lectura  lectura del sensor simulado (en vivo o guardada)
 * @param {{respuesta: string|null, ciclos: number|null}|null} ctx.confirmacion  respuesta del agricultor
 * @returns {Object<string, Senal>}
 */
export function calcularSenales(datos, { lectura = null, confirmacion = null } = {}) {
  const { suelo, historia, clima, parcela, umbrales } = datos;
  const s = {};

  // pH: sensor simulado → suelo.json
  if (lectura && Number.isFinite(lectura.ph)) {
    s.ph = { valor: lectura.ph, etiqueta: 'SIMULADO', fuente: 'ThingSpeak (Wokwi)', fecha: lectura.hora };
  } else {
    s.ph = { valor: suelo.ph?.valor ?? null, etiqueta: suelo.ph?.etiqueta ?? 'EJEMPLO', fuente: suelo.ph?.fuente ?? null, fecha: suelo.ph?.consultado ?? null };
  }

  // Sal: sensor simulado → suelo.json
  if (lectura && Number.isFinite(lectura.sal)) {
    s.sal_dsm = { valor: lectura.sal, etiqueta: 'SIMULADO', fuente: 'ThingSpeak (Wokwi)', fecha: lectura.hora };
  } else {
    s.sal_dsm = { valor: suelo.sal_dsm?.valor ?? null, etiqueta: suelo.sal_dsm?.etiqueta ?? 'EJEMPLO', fuente: suelo.sal_dsm?.fuente ?? null, fecha: null };
  }

  // Ciclos de arroz seguidos: corrección del agricultor → historia.json
  const corregido = confirmacion && confirmacion.respuesta !== 'si' && Number.isInteger(confirmacion.ciclos);
  if (corregido) {
    s.ciclos_arroz_seguidos = { valor: confirmacion.ciclos, etiqueta: 'REPORTADO', fuente: null, fecha: null };
  } else {
    s.ciclos_arroz_seguidos = { valor: historia.resumen?.ciclos_arroz_seguidos ?? null, etiqueta: etq(historia, 'ESTIMADO'), fuente: historia.fuente, fecha: historia.consultado };
  }

  s.tendencia_vigor = { valor: historia.resumen?.tendencia_vigor ?? null, etiqueta: etq(historia, 'ESTIMADO'), fuente: historia.fuente, fecha: historia.consultado };
  s.dias_descubierto_promedio = { valor: historia.resumen?.dias_descubierto_promedio ?? null, etiqueta: etq(historia, 'ESTIMADO'), fuente: historia.fuente, fecha: historia.consultado };

  const etqCiclo = clima.lluvia_por_ciclo_etiqueta ?? etq(clima, 'OBSERVADO');
  s.ultimo_anio_seco = { valor: ultimoCicloSeco(clima.lluvia_por_ciclo_mm, umbrales.anio_seco_fraccion), etiqueta: etqCiclo, fuente: clima.fuente, fecha: clima.consultado ?? null };

  const plagas = parcela.plagas_repetidas;
  s.plagas_repetidas = { valor: plagas?.valor ?? null, etiqueta: plagas?.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'REPORTADO', fuente: null, fecha: null };

  return s;
}

/**
 * Reemplaza las señales con los valores del simulador. Mientras el simulador está activo, todo es SIMULADO.
 * @param {Object<string, Senal>} senales
 * @param {{ph: number, sal: number, ciclos: number, seco: boolean}} sim
 */
export function aplicarSimulador(senales, sim) {
  const s = {};
  for (const [k, v] of Object.entries(senales)) s[k] = { ...v, etiqueta: 'SIMULADO', fuente: null, fecha: null };
  s.ph.valor = sim.ph;
  s.sal_dsm.valor = sim.sal;
  s.ciclos_arroz_seguidos.valor = sim.ciclos;
  s.ultimo_anio_seco.valor = sim.seco;
  return s;
}
