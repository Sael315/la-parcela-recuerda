// Motor de reglas de rotación. Función pura: no toca el DOM ni la red.

const OPERADORES = {
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
};

/**
 * @typedef {Object} Senal
 * @property {*} valor
 * @property {string|null} [etiqueta]  OBSERVADO | ESTIMADO | REPORTADO | SIMULADO | EJEMPLO
 */

/**
 * @typedef {Object} Razon
 * @property {string} [texto]      razón de la regla, en español
 * @property {string} [texto_en]   razón de la regla, en inglés
 * @property {string} [clave]      clave de textos.json cuando la razón no viene de una regla
 * @property {Object} [vars]       variables para la clave
 * @property {{senal: string, etiqueta: string|null}[]} senales  señales que la produjeron
 * @property {string|null} regla
 */

/**
 * @typedef {Object} Opcion
 * @property {string} id
 * @property {Object} cultivo        ficha de cultivos.json
 * @property {number} puntaje        puntos de reglas + puntaje de la prioridad
 * @property {number} puntosReglas
 * @property {Razon[]} razones
 * @property {string} beneficio
 * @property {string} beneficio_en
 * @property {string} limite
 * @property {string} limite_en
 * @property {{id: string, viene_de: string}[]} reglas
 */

/** Acepta señales como {valor, etiqueta} o como valor suelto. */
function normalizar(senales = {}) {
  const s = {};
  for (const [k, v] of Object.entries(senales)) {
    s[k] = v !== null && typeof v === 'object' && 'valor' in v ? v : { valor: v, etiqueta: null };
  }
  return s;
}

const faltante = (v) => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v));

function leerUmbral(valor, umbrales) {
  return typeof valor === 'string' && valor.startsWith('@') ? umbrales[valor.slice(1)] : valor;
}

/**
 * Evalúa las condiciones de una regla.
 * @returns {true|false|null} null si falta alguna señal
 */
function evaluar(cuando, s, umbrales) {
  let resultado = true;
  for (const cond of cuando) {
    const v = s[cond.senal]?.valor;
    if (faltante(v)) return null;
    const op = Object.keys(OPERADORES).find((o) => o in cond);
    if (!op) return null;
    const limite = leerUmbral(cond[op], umbrales);
    if (faltante(limite)) return null;
    if (!OPERADORES[op](v, limite)) resultado = false;
  }
  return resultado;
}

function rellenar(texto, s) {
  if (!texto) return texto;
  return texto.replace(/\{(\w+)\}/g, (_, k) => (faltante(s[k]?.valor) ? `{${k}}` : String(s[k].valor)));
}

/**
 * Recomienda qué sembrar después del arroz.
 *
 * @param {Object<string, Senal|*>} senales  ph, sal_dsm, ciclos_arroz_seguidos, tendencia_vigor,
 *   dias_descubierto_promedio, ultimo_anio_seco, plagas_repetidas
 * @param {Object[]} reglas      contenido de reglas.json
 * @param {Object} cultivos      contenido de cultivos.json (o solo su objeto `cultivos`)
 * @param {Object} umbrales      contenido de umbrales.json
 * @param {'ahorrar_agua'|'mejorar_suelo'|'proteger_rendimiento'} prioridad
 * @returns {{
 *   alertas: {id: string, texto: string, texto_en: string, etiquetas: (string|null)[]}[],
 *   opciones: Opcion[],
 *   reglasActivadas: string[],
 *   sinDato: string[],
 *   excluidos: {id: string, cultivo: Object, motivo: 'sal'|'sin_dato_sal'|'regla', regla: string|null, umbral: number|null}[],
 *   porDefecto: boolean
 * }}
 */
export function recomendar(senales, reglas, cultivos, umbrales, prioridad = 'mejorar_suelo') {
  const s = normalizar(senales);
  const lista = cultivos?.cultivos ?? cultivos ?? {};

  const estado = {};
  for (const [id, c] of Object.entries(lista)) {
    estado[id] = { id, cultivo: c, puntosReglas: 0, razones: [], reglas: [], exclusion: null };
  }

  const alertas = [];
  const reglasActivadas = [];
  const sinDato = [];
  let algunaCultivo = false;

  const excluir = (id, motivo, regla, umbral = null) => {
    if (estado[id] && !estado[id].exclusion) estado[id].exclusion = { motivo, regla, umbral };
  };

  // Excluye por sal: umbral menor que la sal actual, o umbral desconocido con sal media o alta.
  const filtrarPorSal = (regla) => {
    const sal = s.sal_dsm?.valor;
    if (faltante(sal)) return;
    const salMediaOAlta = sal >= umbrales.sal_media_dsm;
    for (const [id, c] of Object.entries(lista)) {
      const u = c.umbral_sal_dsm;
      if (u === null || u === undefined) {
        if (salMediaOAlta) excluir(id, 'sin_dato_sal', regla);
      } else if (u < sal) {
        excluir(id, 'sal', regla, u);
      }
    }
  };

  for (const regla of reglas) {
    const ok = evaluar(regla.cuando, s, umbrales);
    if (ok === null) { sinDato.push(regla.id); continue; }
    if (!ok) continue;

    reglasActivadas.push(regla.id);
    const usadas = [...new Set(regla.cuando.map((c) => c.senal))]
      .map((senal) => ({ senal, etiqueta: s[senal]?.etiqueta ?? null }));

    if (regla.alertar) {
      alertas.push({ id: regla.id, texto: regla.alertar, texto_en: regla.alertar_en ?? regla.alertar, etiquetas: usadas.map((u) => u.etiqueta) });
    }
    (regla.excluir ?? []).forEach((id) => excluir(id, 'regla', regla.id));
    if (regla.excluir_por_umbral_sal) filtrarPorSal(regla.id);

    if (regla.tipo === 'cultivo') algunaCultivo = true;
    for (const [id, puntos] of Object.entries(regla.sumar ?? {})) {
      if (!estado[id]) continue;
      estado[id].puntosReglas += puntos;
      if (regla.razon) {
        estado[id].razones.push({ texto: rellenar(regla.razon, s), texto_en: rellenar(regla.razon_en ?? regla.razon, s), senales: usadas, regla: regla.id });
      }
      estado[id].reglas.push({ id: regla.id, viene_de: regla.viene_de });
    }
  }

  // La sal siempre manda, aunque no se active la regla sal_alta (nota de cultivos.json).
  filtrarPorSal(null);

  const puntajePrioridad = (e) => e.cultivo.puntaje?.[prioridad] ?? 0;
  const ordenOriginal = Object.keys(lista);
  const ordenar = (a, b) => (b.puntaje - a.puntaje)
    || (puntajePrioridad(b) - puntajePrioridad(a))
    || (ordenOriginal.indexOf(a.id) - ordenOriginal.indexOf(b.id));

  let candidatos = Object.values(estado).filter((e) => !e.exclusion);
  const porDefecto = !algunaCultivo;

  if (porDefecto) {
    // Sin reglas de cultivo: las 2 mejores leguminosas según la prioridad.
    candidatos = candidatos.filter((e) => e.cultivo.familia === 'leguminosa');
    candidatos.forEach((e) => {
      e.razones.push({ clave: 'p3.razon_defecto', senales: [], regla: null });
    });
  }

  candidatos.forEach((e) => { e.puntaje = e.puntosReglas + puntajePrioridad(e); });
  candidatos.sort(ordenar);

  const opciones = candidatos.slice(0, 2).map((e) => {
    const razones = [...e.razones];
    if (puntajePrioridad(e) >= 3) {
      razones.push({ clave: 'p3.razon_prioridad', vars: { prioridad }, senales: [{ senal: 'prioridad', etiqueta: 'REPORTADO' }], regla: null });
    }
    return {
      id: e.id,
      cultivo: e.cultivo,
      puntaje: e.puntaje,
      puntosReglas: e.puntosReglas,
      razones,
      beneficio: e.cultivo.beneficio ?? '',
      beneficio_en: e.cultivo.beneficio_en ?? e.cultivo.beneficio ?? '',
      limite: e.cultivo.limite ?? '',
      limite_en: e.cultivo.limite_en ?? e.cultivo.limite ?? '',
      reglas: e.reglas,
    };
  });

  const excluidos = Object.values(estado)
    .filter((e) => e.exclusion)
    .map((e) => ({ id: e.id, cultivo: e.cultivo, ...e.exclusion }));

  return { alertas, opciones, reglasActivadas, sinDato, excluidos, porDefecto };
}
