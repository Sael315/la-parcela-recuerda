// Pantalla 2 — Mi suelo hoy: pH, sal, humedad, estado del sensor simulado y lluvia histórica.

/* global Chart */
import { t, esc, num, getIdioma } from './i18n.js';
import { encabezado, etiqueta, meta } from './etiquetas.js';

let el = null;
let grafico = null;
let sensorActual = { estado: 'sin_configurar', lectura: null };

const css = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

/** Frase que compara el promedio de lluvia de los dos periodos. */
function fraseLluvia(clima) {
  const p1 = clima.promedio_1991_2010_mm;
  const p2 = clima.promedio_2011_2025_mm;
  if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 === 0) return t('p2.lluvia_falta');
  const pct = ((p2 - p1) / p1) * 100;
  if (Math.abs(pct) < 2) return t('p2.lluvia_igual');
  return t(pct < 0 ? 'p2.lluvia_menos' : 'p2.lluvia_mas', { pct: num(Math.abs(pct)) });
}

export function montar(contenedor, ctx) {
  el = contenedor;
  const { clima } = ctx.datos;
  const etqClima = clima.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'OBSERVADO';
  const frase = fraseLluvia(clima);

  el.innerHTML = `
    ${encabezado('titulo-suelo', t('p2.chip'), t('p2.titulo'), t('p2.intro'))}

    <div class="bloque bloque-primero">
      <p class="sensor" id="s-sensor" role="status"></p>
      <div class="rejilla rejilla-3" id="s-tarjetas"></div>
    </div>

    <div class="bloque">
      <div class="bloque-cabeza"><h3>${esc(t('p2.lluvia_titulo'))}</h3></div>
      <p class="frase-grande">${esc(frase)}</p>
      <div class="tarjeta tarjeta-blanca grafico">
        <div class="lienzo lienzo-medio"><canvas id="s-lluvia" role="img"></canvas></div>
        <div class="grafico-pie">${meta({ etiqueta: etqClima, fuente: clima.fuente, fecha: clima.consultado })}</div>
      </div>
      <p class="limite">${esc(t('p2.limite'))}</p>
    </div>`;

  montarGrafico(clima, frase);
}

function montarGrafico(clima, frase) {
  if (grafico) { grafico.destroy(); grafico = null; }
  const anios = clima.lluvia_anual_mm.filter((a) => Number.isFinite(a.mm));
  if (typeof Chart === 'undefined' || !anios.length) return;

  const tinta = css('--tinta-suave');
  const rejilla = css('--borde');
  const fuente = { family: css('--fuente') || 'sans-serif', size: 11 };
  const promedio = (desde, hasta, valor) => (Number.isFinite(valor) ? [{ x: desde - 0.4, y: valor }, { x: hasta + 0.4, y: valor }] : []);

  grafico = new Chart(el.querySelector('#s-lluvia'), {
    data: {
      datasets: [
        { type: 'bar', label: t('p2.lluvia_serie'), data: anios.map((a) => ({ x: a.anio, y: a.mm })), backgroundColor: css('--lluvia'), borderRadius: 3, barPercentage: 0.75, categoryPercentage: 1, order: 2 },
        { type: 'line', label: `${t('p2.prom1')}: ${t('p2.mm_anio', { mm: num(clima.promedio_1991_2010_mm) })}`, data: promedio(1991, 2010, clima.promedio_1991_2010_mm), borderColor: css('--tinta'), borderWidth: 2.5, borderDash: [6, 4], pointRadius: 0, order: 1 },
        { type: 'line', label: `${t('p2.prom2')}: ${t('p2.mm_anio', { mm: num(clima.promedio_2011_2025_mm) })}`, data: promedio(2011, 2025, clima.promedio_2011_2025_mm), borderColor: css('--ambar'), borderWidth: 3, pointRadius: 0, order: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
      scales: {
        x: { type: 'linear', min: anios[0].anio - 0.6, max: anios[anios.length - 1].anio + 0.6,
          ticks: { color: tinta, font: fuente, stepSize: 5, callback: (v) => (Number.isInteger(v) && v % 5 === 0 ? v : '') }, grid: { display: false }, border: { color: rejilla } },
        y: { beginAtZero: true, ticks: { color: tinta, font: fuente, maxTicksLimit: 5, callback: (v) => num(v) }, grid: { color: rejilla }, border: { display: false },
          title: { display: true, text: 'mm', color: tinta, font: fuente } },
      },
      plugins: {
        legend: { position: 'bottom', align: 'start', labels: { color: tinta, font: fuente, boxWidth: 18, boxHeight: 3, padding: 12 } },
        tooltip: { displayColors: false, filter: (i) => i.datasetIndex === 0,
          callbacks: { title: () => '', label: (i) => t('p1.tooltip_lluvia', { anio: i.parsed.x, mm: num(i.parsed.y) }) } },
      },
    },
  });
  el.querySelector('#s-lluvia').setAttribute('aria-label', t('p2.lluvia_alt', { desde: anios[0].anio, hasta: anios[anios.length - 1].anio, frase }));
}

function palabraSal(sal, umbrales) {
  if (!Number.isFinite(sal)) return '';
  if (sal >= umbrales.sal_alta_dsm) return t('sal.alta');
  if (sal >= umbrales.sal_media_dsm) return t('sal.media');
  return t('sal.baja');
}

function textoSensor() {
  const { estado, lectura } = sensorActual;
  if (estado === 'vivo') {
    const s = Math.max(0, Math.round((Date.now() - Date.parse(lectura.hora)) / 1000));
    return t('sensor.vivo', { s });
  }
  if (estado === 'sin_conexion') {
    if (!lectura) return t('sensor.sin_conexion_nada');
    const hora = new Intl.DateTimeFormat(getIdioma() === 'en' ? 'en-US' : 'es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lectura.hora));
    return t('sensor.sin_conexion', { hora });
  }
  return t('sensor.sin_configurar');
}

/** Refresca "hace N s" cada segundo. */
export function tic() {
  if (!el || sensorActual.estado !== 'vivo') return;
  const p = el.querySelector('#s-sensor .sensor-texto');
  if (p) p.textContent = textoSensor();
}

export function actualizar(contenedor, ctx) {
  if (!el) return;
  const { reales, estado, datos } = ctx;
  const { suelo, clima, umbrales } = datos;
  sensorActual = estado.sensor;

  const sensor = el.querySelector('#s-sensor');
  sensor.dataset.estado = sensorActual.estado;
  sensor.innerHTML = `<span class="sensor-punto" aria-hidden="true"></span><span><b>${esc(t('sensor.titulo'))}:</b> <span class="sensor-texto">${esc(textoSensor())}</span></span>`;

  const ph = reales.ph;
  const sal = reales.sal_dsm;
  const hum = clima.humedad_superficial;
  const etqHum = hum?.etiqueta ?? (clima.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'OBSERVADO');

  let palabraPh = '';
  if (Number.isFinite(ph.valor) && ph.valor >= umbrales.ph_muy_alto) palabraPh = t('p2.ph_muy_alto');
  else if (Number.isFinite(ph.valor) && ph.valor <= umbrales.ph_muy_bajo) palabraPh = t('p2.ph_muy_bajo');
  const referenciaPh = ph.etiqueta === 'SIMULADO' && Number.isFinite(suelo.ph?.valor)
    ? `<span class="cifra-extra">${esc(t('p2.ph_zona', { v: num(suelo.ph.valor, 1) }))} ${etiqueta(suelo.ph.etiqueta)}</span>` : '';

  const metaPh = { etiqueta: ph.etiqueta, fuente: ph.fuente, fecha: ph.etiqueta === 'SIMULADO' ? null : ph.fecha };
  el.querySelector('#s-tarjetas').innerHTML = `
    <div class="tarjeta cifra">
      <span class="cifra-nombre">${esc(t('p2.ph'))}</span>
      <span class="cifra-valor">${esc(num(ph.valor, 1))}</span>
      ${palabraPh ? `<span class="cifra-palabra aviso-texto">${esc(palabraPh)}</span>` : ''}
      ${meta(metaPh)}
      ${referenciaPh}
    </div>
    <div class="tarjeta cifra">
      <span class="cifra-nombre">${esc(t('p2.sal'))}</span>
      <span class="cifra-valor">${esc(num(sal.valor, 1))}<small>dS/m</small></span>
      <span class="cifra-palabra">${esc(palabraSal(sal.valor, umbrales))}</span>
      ${meta({ etiqueta: sal.etiqueta, fuente: sal.fuente })}
    </div>
    <div class="tarjeta cifra">
      <span class="cifra-nombre">${esc(t('p2.humedad'))}</span>
      <span class="cifra-valor">${Number.isFinite(hum?.valor) ? `${esc(num(hum.valor * 100))}<small>%</small>` : esc(t('p2.sin_dato'))}</span>
      ${meta({ etiqueta: etqHum, fuente: 'NASA POWER (GWETTOP)', fecha: hum?.fecha })}
    </div>`;
}
