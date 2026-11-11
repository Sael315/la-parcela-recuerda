// Pantalla 3 — Qué siembro: prioridad, alertas, 2 recomendaciones, simulador, impacto y compartir.

import { t, tr, esc, num, getIdioma } from './i18n.js';
import { encabezado, etiqueta, etiquetasUnicas } from './etiquetas.js';
import { M2_POR_TAREA } from './parcela.js';

const PRIORIDADES = ['ahorrar_agua', 'mejorar_suelo', 'proteger_rendimiento'];

const ICONOS = {
  ahorrar_agua: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  mejorar_suelo: '<path d="M3 20h18"/><path d="M6 16.5h12"/><path d="M12 16V9"/><path d="M12 10c0-3 2.2-5 5-5 0 3-2.2 5-5 5z"/><path d="M12 12c0-2.5-2-4.2-4.5-4.2 0 2.5 2 4.2 4.5 4.2z"/>',
  proteger_rendimiento: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M12 8v8M9.5 11.5c1.3 0 2.5.9 2.5 2.2M14.5 9.5c-1.3 0-2.5.9-2.5 2.2"/>',
};
const icono = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[p]}</svg>`;

/** Señales que se pueden poner en el simulador, con sus límites. */
const RANGOS = {
  ph: { min: 4.5, max: 9, paso: 0.1, dec: 1 },
  sal: { min: 0, max: 10, paso: 0.1, dec: 1 },
  ciclos: { min: 0, max: 10, paso: 1, dec: 0 },
};
const limitar = (v, r) => Math.min(r.max, Math.max(r.min, v));

let el = null;
let ultimoMensaje = '';

// ---------- Construcción ----------

export function montar(contenedor, ctx) {
  el = contenedor;
  const { datos } = ctx;
  const deslizador = (clave, etq) => {
    const r = RANGOS[clave];
    return `<div class="rango">
      <label for="sim-${clave}">${esc(t(etq))}</label>
      <output id="sim-${clave}-valor" for="sim-${clave}"></output>
      <input type="range" id="sim-${clave}" min="${r.min}" max="${r.max}" step="${r.paso}">
    </div>`;
  };

  el.innerHTML = `
    ${encabezado('titulo-decision', t('p3.chip'), t('p3.titulo'), t('p3.intro'))}

    <div class="bloque bloque-primero">
      <h3 id="titulo-prioridad">${esc(t('p3.prioridad_titulo'))}</h3>
      <div class="prioridades" role="group" aria-labelledby="titulo-prioridad">
        ${PRIORIDADES.map((p) => `<button type="button" class="prioridad" data-prioridad="${p}" aria-pressed="false">${icono(p)}<span>${esc(t(`prio.${p}`))}</span></button>`).join('')}
      </div>
    </div>

    <div class="bloque">
      <div id="d-alertas" class="pila"></div>
      <div id="d-sim-aviso" class="aviso-sim" role="status" hidden>
        ${etiqueta('SIMULADO')}<span>${esc(t('sim.activo'))}</span>
        <button type="button" class="boton" data-accion="volver">${esc(t('sim.volver'))}</button>
      </div>
      <h3 class="bloque-cabeza">${esc(t('p3.opciones_titulo'))}</h3>
      <div id="d-opciones" class="rejilla rejilla-2" aria-live="polite"></div>
      <div id="d-descartados"></div>
      <p class="nota" id="d-pendientes"></p>
    </div>

    <details class="bloque desplegable" id="d-sim">
      <summary><span>${esc(t('sim.titulo'))}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/><path class="mas" d="M12 6v12"/></svg></summary>
      <div class="desplegable-cuerpo">
        <p class="nota">${esc(t('sim.ayuda'))}</p>
        <div class="rangos">
          ${deslizador('ph', 'sim.ph')}
          ${deslizador('sal', 'sim.sal')}
          ${deslizador('ciclos', 'sim.ciclos')}
          <fieldset class="rango">
            <legend>${esc(t('sim.seco'))}</legend>
            <div class="opciones">
              <button type="button" class="boton" data-seco="true" aria-pressed="false">${esc(t('sim.si'))}</button>
              <button type="button" class="boton" data-seco="false" aria-pressed="false">${esc(t('sim.no'))}</button>
            </div>
          </fieldset>
        </div>
        <button type="button" class="boton" data-accion="volver">${esc(t('sim.volver'))}</button>
      </div>
    </details>

    <div class="bloque">
      <div class="bloque-cabeza"><h3>${esc(t('imp.titulo'))}</h3>${etiqueta('ESTIMADO')}</div>
      <p class="nota">${esc(t('imp.intro'))}</p>
      <div class="tabla-envoltura">${tablaImpacto(datos.cultivos.impacto_3_temporadas)}</div>
    </div>

    <div class="bloque">
      <h3 class="bloque-cabeza">${esc(t('comp.titulo'))}</h3>
      <div class="botones">
        <a class="boton boton-primario" id="d-whatsapp" href="#" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c.3 2.2 2.3 4.2 4.5 4.5l1-1.2 1.8.8c-.2 1.2-1.2 1.9-2.4 1.7-3-.5-5.3-2.8-5.8-5.8-.2-1.2.5-2.2 1.7-2.4l.8 1.8z"/></svg>
          <span>${esc(t('comp.whatsapp'))}</span>
        </a>
        <button type="button" class="boton" data-accion="copiar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
          <span>${esc(t('comp.copiar'))}</span>
        </button>
      </div>
      <p class="nota" id="d-copiado" role="status"></p>
    </div>`;

  // Eventos
  el.querySelectorAll('[data-prioridad]').forEach((b) => b.addEventListener('click', () => ctx.acciones.setPrioridad(b.dataset.prioridad)));
  el.querySelectorAll('[data-accion="volver"]').forEach((b) => b.addEventListener('click', () => {
    ctx.acciones.salirSim();
    el.querySelector('#d-sim').open = false;
  }));
  Object.keys(RANGOS).forEach((clave) => {
    el.querySelector(`#sim-${clave}`).addEventListener('input', (e) => {
      ctx.acciones.setSim(simDesdeControles({ [clave]: Number(e.target.value) }));
    });
  });
  el.querySelectorAll('[data-seco]').forEach((b) => b.addEventListener('click', () => {
    ctx.acciones.setSim(simDesdeControles({ seco: b.dataset.seco === 'true' }));
  }));
  el.querySelector('[data-accion="copiar"]').addEventListener('click', copiar);
}

/** Lee todos los controles del simulador para que, al activarlo, se usen los 4 valores visibles. */
function simDesdeControles(cambio) {
  const valores = {
    ph: Number(el.querySelector('#sim-ph').value),
    sal: Number(el.querySelector('#sim-sal').value),
    ciclos: Number(el.querySelector('#sim-ciclos').value),
    seco: el.querySelector('[data-seco="true"]').getAttribute('aria-pressed') === 'true',
  };
  return { ...valores, ...cambio };
}

function tablaImpacto(impacto) {
  const fila = (clave, nombre) => {
    const dato = impacto?.[clave];
    const tieneFuente = dato && dato.fuente && Number.isFinite(dato.valor);
    const valor = tieneFuente
      ? `${esc(t('imp.menos', { pct: num(dato.valor) }))}<span class="nota">${esc(t('imp.fuente', { fuente: dato.fuente }))}</span>`
      : `<span class="pendiente">${esc(t('imp.pendiente'))}</span>`;
    return `<tr><th scope="row">${esc(t(nombre))}</th><td>${esc(t('imp.base'))}</td><td>${valor}</td></tr>`;
  };
  return `<table class="tabla-impacto">
    <thead><tr><th scope="col">${esc(t('imp.recurso'))}</th><th scope="col">${esc(t('imp.solo_arroz'))}</th><th scope="col">${esc(t('imp.rotando'))}</th></tr></thead>
    <tbody>${fila('agua_ahorro_pct_rotando', 'imp.agua')}${fila('urea_ahorro_pct_rotando', 'imp.abono')}</tbody>
  </table>`;
}

// ---------- Actualización ----------

function textoRazon(r) {
  if (r.clave) {
    const vars = { ...(r.vars ?? {}) };
    if (vars.prioridad) vars.prioridad = t(`prio.frase.${vars.prioridad}`);
    if (Number.isFinite(vars.u)) vars.u = num(vars.u, 1);
    if (Number.isFinite(vars.sal)) vars.sal = num(vars.sal, 1);
    return t(r.clave, vars);
  }
  return getIdioma() === 'en' ? r.texto_en : r.texto;
}

function tarjeta(op, n, simulando) {
  const c = op.cultivo;
  const razones = op.razones.slice(0, 3).map((r) => {
    const etqs = etiquetasUnicas(r.senales.map((s) => s.etiqueta));
    return `<li><span>${esc(textoRazon(r))}</span>${etqs.length ? ` <span class="meta">${etqs.map(etiqueta).join('')}</span>` : ''}</li>`;
  }).join('');
  const origen = op.origen === 'reglas'
    ? op.reglas.map((r) => t('p3.regla', { id: r.id, origen: r.viene_de })).join(', ')
    : t(op.origen === 'sal' ? 'p3.regla_sal' : 'p3.regla_defecto');
  return `<article class="opcion">
    <div class="opcion-cabeza">
      <span class="opcion-icono" aria-hidden="true">${c.icono ?? '🌱'}</span>
      <div>
        <p class="opcion-num">${esc(t('p3.opcion', { n }))}</p>
        <h4>${esc(tr(c, 'nombre'))}</h4>
      </div>
      ${simulando ? etiqueta('SIMULADO') : ''}
    </div>
    <div class="opcion-parte">
      <h5>${esc(t('p3.porque'))}</h5>
      <ul class="razones">${razones}</ul>
    </div>
    <dl class="opcion-datos">
      <div><dt>${esc(t('p3.ganas'))}</dt><dd>${esc(tr(op, 'beneficio'))}</dd></div>
      <div><dt>${esc(t('p3.limite'))}</dt><dd>${esc(tr(op, 'limite'))}</dd></div>
    </dl>
    <p class="nota">${esc(t('p3.viene_de', { reglas: origen }))}</p>
  </article>`;
}

function descartado(e, sal, umbrales) {
  const cultivo = tr(e.cultivo, 'nombre');
  if (e.motivo === 'sal') return t('p3.desc_sal', { cultivo, u: num(e.umbral, 1), sal: num(sal, 1) });
  if (e.motivo === 'sin_dato_sal') {
    const nivel = sal >= umbrales.sal_alta_dsm ? t('sal.alta') : t('sal.media');
    return t('p3.desc_sin_dato', { cultivo, nivel: nivel.toLowerCase() });
  }
  return t('p3.desc_regla', { cultivo });
}

export function actualizar(contenedor, ctx) {
  if (!el) return;
  const { estado, resultado, usadas, reales, datos } = ctx;
  const simulando = estado.sim.activo;

  el.querySelectorAll('[data-prioridad]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.prioridad === estado.prioridad)));

  // Alertas de seguridad
  el.querySelector('#d-alertas').innerHTML = resultado.alertas.map((a) => `
    <div class="alerta" role="alert">
      <strong>${esc(t('p3.alerta_titulo'))}</strong>
      <span>${esc(getIdioma() === 'en' ? a.texto_en : a.texto)} <span class="meta">${etiquetasUnicas(a.etiquetas).map(etiqueta).join('')}</span></span>
      <span><b>${esc(t('p3.alerta_accion'))}</b></span>
    </div>`).join('');

  el.querySelector('#d-sim-aviso').hidden = !simulando;

  // Tarjetas
  const opciones = resultado.opciones;
  let html = opciones.map((op, i) => tarjeta(op, i + 1, simulando)).join('');
  if (opciones.length === 1) html += `<p class="tarjeta nota-grande">${esc(t('p3.una_opcion'))}</p>`;
  if (opciones.length === 0) html = `<div class="alerta" role="alert"><strong>${esc(t('p3.ninguna'))}</strong></div>`;
  el.querySelector('#d-opciones').innerHTML = html;

  const sal = usadas.sal_dsm?.valor;
  el.querySelector('#d-descartados').innerHTML = resultado.excluidos.length
    ? `<div class="descartados"><h4>${esc(t('p3.descartados'))}</h4><ul>${resultado.excluidos.map((e) => `<li>${esc(descartado(e, sal, datos.umbrales))}</li>`).join('')}</ul></div>`
    : '';

  const pendientes = [];
  if (datos.umbrales.pendiente_validar) pendientes.push(t('p3.umbrales_pendientes'));
  if (datos.cultivos.pendiente_validar) pendientes.push(t('p3.cultivos_pendientes'));
  el.querySelector('#d-pendientes').textContent = pendientes.join(' ');

  // Simulador: si no está activo, los controles muestran los datos reales.
  const valoresSim = simulando ? estado.sim : {
    ph: reales.ph.valor ?? 7, sal: reales.sal_dsm.valor ?? 0,
    ciclos: reales.ciclos_arroz_seguidos.valor ?? 0, seco: reales.ultimo_anio_seco.valor === true,
  };
  Object.entries(RANGOS).forEach(([clave, r]) => {
    const v = limitar(valoresSim[clave], r);
    const input = el.querySelector(`#sim-${clave}`);
    if (document.activeElement !== input) input.value = String(v);
    el.querySelector(`#sim-${clave}-valor`).textContent = num(v, r.dec);
  });
  el.querySelectorAll('[data-seco]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.seco === 'true') === valoresSim.seco)));

  // Compartir
  const lista = opciones.length
    ? opciones.map((op, i) => `${i + 1}) ${tr(op.cultivo, 'nombre')}: ${tr(op, 'beneficio')}`).join(' ')
    : t('comp.sin_opciones');
  const parcelaTxt = ctx.parcela?.propia ? t('comp.parcela', { tareas: num(ctx.parcela.area_m2 / M2_POR_TAREA) }) : '';
  ultimoMensaje = t('comp.mensaje', { parcela: parcelaTxt, opciones: lista, url: datos.config.app_url });
  el.querySelector('#d-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(ultimoMensaje)}`;
}

async function copiar() {
  const aviso = el.querySelector('#d-copiado');
  try {
    await navigator.clipboard.writeText(ultimoMensaje);
    aviso.textContent = t('comp.copiado');
  } catch {
    // Respaldo: mostrar el texto para copiarlo a mano.
    aviso.innerHTML = `${esc(t('comp.no_copiado'))}<br><span class="texto-copiable">${esc(ultimoMensaje)}</span>`;
  }
}
