// Pantalla 1 — Mi parcela: mapa, línea de tiempo desde 2013, resumen y confirmación del agricultor.

/* global L, Chart */
import { t, esc, num, fecha } from './i18n.js';
import { etiqueta, meta } from './etiquetas.js';

const M2_POR_TAREA = 628.86; // tarea dominicana
const DIA = 86400000;
const ts = (iso) => new Date(`${iso}T12:00:00`).getTime();

let el = null;
let mapa = null;
let graficos = [];
let verTodo = false;
let alCambiarAncho = null;

const css = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
const esCelular = () => window.matchMedia('(max-width: 640px)').matches;

// ---------- Ilustración del hero: parcelas de arroz vistas desde arriba ----------

function ilustracionCampos() {
  let semilla = 20131;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const verdes = ['#24391C', '#2F4A22', '#3A5A28', '#46692F', '#557A36', '#6C8F3E', '#86A646', '#9DBA4E'];
  const W = 900; const H = 520;
  let poligonos = '';
  let resaltada = '';
  let fila = 0;
  for (let y = -80; y < H + 80; y += 58 + azar() * 26, fila++) {
    const alto = 54 + azar() * 24;
    let x = -120 + azar() * 40;
    let col = 0;
    while (x < W + 120) {
      const ancho = 70 + azar() * 130;
      const j = () => (azar() - 0.5) * 14;
      const p = [[x + j(), y + j()], [x + ancho + j(), y + j()], [x + ancho + j(), y + alto + j()], [x + j(), y + alto + j()]];
      const puntos = p.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ');
      if (fila === 5 && col === 4) {
        resaltada = `<polygon points="${puntos}" fill="#B9D46E" stroke="#fff" stroke-width="3" stroke-dasharray="9 6"/>`;
      } else {
        poligonos += `<polygon points="${puntos}" fill="${verdes[Math.floor(azar() * verdes.length)]}"/>`;
      }
      x += ancho + 6;
      col++;
    }
  }
  return `<svg class="hero-campos" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="${W}" height="${H}" fill="#1B2D15"/>
    <g transform="rotate(-14 ${W / 2} ${H / 2}) scale(1.25) translate(-90 -60)" stroke="rgba(214,232,180,0.28)" stroke-width="2.5" stroke-linejoin="round">
      ${poligonos}${resaltada}
      <path d="M-100 330 C 150 280, 300 420, 520 350 S 850 240, 1050 300" fill="none" stroke="#6F9C9A" stroke-width="10" opacity="0.7"/>
    </g>
  </svg>`;
}

// ---------- Cálculos ----------

/** Área del polígono en m² (proyección local simple, suficiente para una parcela). */
function areaM2(geojson) {
  const anillo = geojson.coordinates[0];
  const lat0 = (anillo.reduce((a, p) => a + p[1], 0) / anillo.length) * Math.PI / 180;
  const xy = anillo.map(([lon, lat]) => [lon * 111320 * Math.cos(lat0), lat * 110540]);
  let s = 0;
  for (let i = 0; i < xy.length - 1; i++) s += xy[i][0] * xy[i + 1][1] - xy[i + 1][0] * xy[i][1];
  return Math.abs(s) / 2;
}

// ---------- Construcción ----------

export function montar(contenedor, ctx) {
  el = contenedor;
  const { datos } = ctx;
  const { parcela, historia, clima } = datos;

  // Ficha de la parcela
  const nombreAgricultor = parcela.agricultor?.nombre && parcela.agricultor.nombre !== 'PENDIENTE' && parcela.agricultor.permiso_uso
    ? parcela.agricultor.nombre : null;
  let area;
  if (Number.isFinite(parcela.area_tareas)) {
    area = { tareas: parcela.area_tareas, ha: parcela.area_tareas * M2_POR_TAREA / 10000, etq: parcela.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'REPORTADO' };
  } else {
    const m2 = areaM2(parcela.poligono_geojson);
    area = { tareas: m2 / M2_POR_TAREA, ha: m2 / 10000, etq: parcela.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'ESTIMADO' };
  }
  const etqParcela = parcela.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'REPORTADO';

  el.innerHTML = `
    <div class="hero">
      ${ilustracionCampos()}
      <div class="hero-texto">
        <span class="pildora">${esc(parcela.comunidad)}</span>
        <h2 id="titulo-parcela">${esc(t('p1.titulo'))}</h2>
        <p class="hero-intro">${esc(t('p1.intro'))}</p>
      </div>
      <div class="ficha">
        <div class="ficha-nombre">${esc(nombreAgricultor ?? parcela.nombre)}</div>
        <dl>
          <dt>${esc(t('p1.comunidad'))}</dt><dd>${esc(parcela.comunidad)} ${etiqueta(etqParcela)}</dd>
          <dt>${esc(t('p1.area'))}</dt><dd>${esc(t('p1.area_valor', { tareas: num(area.tareas), ha: num(area.ha, 1) }))} ${etiqueta(area.etq)}</dd>
          <dt>${esc(t('p1.cultivo'))}</dt><dd>${esc(t(`cultivo.${parcela.cultivo_actual}`))} ${etiqueta(etqParcela)}</dd>
        </dl>
      </div>
    </div>

    <div class="bloque">
      <h3 class="bloque-cabeza">${esc(t('p1.mapa_titulo'))}</h3>
      <div class="mapa" id="h-mapa" role="img" aria-label="${esc(t('p1.mapa_alt', { comunidad: parcela.comunidad }))}"></div>
    </div>

    <div class="bloque">
      <div class="bloque-cabeza">
        <h3>${esc(t('p1.linea_titulo'))}</h3>
        <button type="button" class="boton" id="h-ver" hidden></button>
      </div>
      ${historia.deteccion_confiable === false ? `<div class="alerta" role="alert"><strong>${esc(t('p1.no_confiable'))}</strong></div>` : ''}
      <p class="nota ayuda">${esc(t('p1.linea_ayuda'))}</p>
      <div class="tarjeta tarjeta-blanca grafico">
        <div class="lienzo lienzo-alto"><canvas id="h-linea" role="img"></canvas></div>
        <p class="grafico-sub">${esc(t('p1.lluvia_anual'))} (mm)</p>
        <div class="lienzo lienzo-bajo"><canvas id="h-lluvia" role="img"></canvas></div>
        <div class="grafico-pie">
          ${meta({ etiqueta: historia.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'OBSERVADO', fuente: historia.fuente, fecha: historia.consultado })}
          ${meta({ etiqueta: clima.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'OBSERVADO', fuente: clima.fuente, fecha: clima.consultado })}
        </div>
      </div>
    </div>

    <div class="bloque">
      <h3 class="bloque-cabeza">${esc(t('p1.resumen_titulo'))}</h3>
      <div class="rejilla rejilla-3" id="h-resumen"></div>
    </div>

    <div class="bloque">
      <div class="tarjeta confirmar">
        <h3 id="h-pregunta">${esc(t('p1.confirmar_titulo'))}</h3>
        <div class="opciones" role="group" aria-labelledby="h-pregunta">
          <button type="button" class="boton" data-resp="si" aria-pressed="false">${esc(t('p1.si'))}</button>
          <button type="button" class="boton" data-resp="en_parte" aria-pressed="false">${esc(t('p1.en_parte'))}</button>
          <button type="button" class="boton" data-resp="no" aria-pressed="false">${esc(t('p1.no'))}</button>
        </div>
        <form id="h-corregir" class="corregir" hidden novalidate>
          <label for="h-ciclos">${esc(t('p1.corregir_label'))}</label>
          <div class="corregir-fila">
            <input type="number" id="h-ciclos" inputmode="numeric" min="0" max="30" step="1" required>
            <button type="submit" class="boton boton-primario">${esc(t('p1.guardar'))}</button>
          </div>
        </form>
        <p id="h-estado" class="nota" role="status"></p>
      </div>
      <p class="limite">${esc(t('p1.limite'))}</p>
    </div>`;

  // Confirmación
  let pendiente = null;
  el.querySelectorAll('[data-resp]').forEach((b) => b.addEventListener('click', () => {
    const r = b.dataset.resp;
    if (r === 'si') {
      ctx.acciones.setConfirmacion('si');
    } else {
      pendiente = r;
      el.querySelectorAll('[data-resp]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      el.querySelector('#h-corregir').hidden = false;
      const input = el.querySelector('#h-ciclos');
      if (!input.value) input.value = String(ctx.datos.historia.resumen.ciclos_arroz_seguidos ?? '');
      input.focus();
    }
  }));
  el.querySelector('#h-corregir').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = Number(el.querySelector('#h-ciclos').value);
    if (!Number.isInteger(n) || n < 0 || n > 30) {
      el.querySelector('#h-estado').textContent = t('p1.pide_numero');
      return;
    }
    ctx.acciones.setConfirmacion(pendiente ?? ctx.estado.confirmacion.respuesta ?? 'en_parte', n);
  });

  montarMapa(parcela);
  montarGraficos(datos);
}

function montarMapa(parcela) {
  if (mapa) { mapa.remove(); mapa = null; }
  if (typeof L === 'undefined') return;
  const div = el.querySelector('#h-mapa');
  mapa = L.map(div, { scrollWheelZoom: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);
  const capa = L.geoJSON(parcela.poligono_geojson, {
    style: { color: '#3F6B26', weight: 3, fillColor: '#9DBA4E', fillOpacity: 0.35, dashArray: '8 5' },
  }).addTo(mapa);
  mapa.fitBounds(capa.getBounds(), { padding: [24, 24], maxZoom: 16 });
}

function montarGraficos(datos) {
  graficos.forEach((g) => g.destroy());
  graficos = [];
  if (typeof Chart === 'undefined') return;

  const { historia, clima } = datos;
  const serie = historia.serie.filter((p) => Number.isFinite(p.ndvi)).map((p) => ({ x: ts(p.fecha), y: p.ndvi }));
  if (!serie.length) return;
  const desde = new Date(serie[0].x).getFullYear();
  const xMin = ts(`${desde}-01-01`);
  const xMax = serie[serie.length - 1].x + 20 * DIA;
  const anioFin = new Date(xMax).getFullYear();
  const lluvia = clima.lluvia_anual_mm.filter((a) => a.anio >= desde && Number.isFinite(a.mm));

  const verde = css('--verde');
  const tinta = css('--tinta-suave');
  const rejilla = css('--borde');
  const fuente = { family: css('--fuente') || 'sans-serif', size: 11 };

  const ticksAnuales = (escala) => {
    const ticks = [];
    for (let a = new Date(escala.min).getFullYear(); a <= new Date(escala.max).getFullYear() + 1; a++) {
      const v = ts(`${a}-07-01`); // a mitad de año, donde cae la barra de lluvia
      if (v >= escala.min && v <= escala.max) ticks.push({ value: v });
    }
    escala.ticks = ticks;
  };
  const ejeX = (mostrarEtiquetas) => ({
    type: 'linear', min: xMin, max: xMax,
    afterBuildTicks: ticksAnuales,
    ticks: { display: mostrarEtiquetas, color: tinta, font: fuente, maxRotation: 0, autoSkip: true, callback: (v) => new Date(v).getFullYear() },
    grid: { color: rejilla, drawTicks: false },
    border: { display: false },
  });
  const anchoFijo = (escala) => { escala.width = 48; };

  // Bandas sombreadas de cada ciclo de arroz
  const bandas = {
    id: 'bandasCiclos',
    beforeDatasetsDraw(chart) {
      const { ctx: c, chartArea: a, scales: { x } } = chart;
      c.save();
      c.beginPath(); c.rect(a.left, a.top, a.right - a.left, a.bottom - a.top); c.clip();
      historia.ciclos.forEach((ciclo) => {
        const x1 = x.getPixelForValue(ts(ciclo.inicio));
        const x2 = x.getPixelForValue(ts(ciclo.cosecha));
        if (x2 < a.left || x1 > a.right) return;
        c.fillStyle = 'rgba(157, 186, 78, 0.22)';
        c.fillRect(x1, a.top, x2 - x1, a.bottom - a.top);
        if (x2 - x1 > 14) {
          c.fillStyle = tinta;
          c.font = `600 10px ${fuente.family}`;
          c.textAlign = 'center';
          c.fillText(String(ciclo.n), (x1 + x2) / 2, a.top + 12);
        }
      });
      c.restore();
    },
  };

  const linea = new Chart(el.querySelector('#h-linea'), {
    type: 'line',
    data: { datasets: [{ data: serie, borderColor: verde, backgroundColor: verde, borderWidth: 1.8, pointRadius: 1.6, pointHoverRadius: 5, fill: false, tension: 0.25, spanGaps: 40 * DIA }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: ejeX(false),
        y: { min: 0, max: 1, afterFit: anchoFijo, ticks: { color: tinta, font: fuente, stepSize: 0.2, callback: (v) => num(v, 1) }, grid: { color: rejilla }, border: { display: false },
          title: { display: !esCelular(), text: t('p1.eje_fuerza'), color: tinta, font: fuente } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false, callbacks: { title: () => '', label: (i) => t('p1.tooltip', { fecha: fecha(i.parsed.x), valor: num(i.parsed.y, 2) }) } },
      },
    },
    plugins: [bandas],
  });

  const barras = new Chart(el.querySelector('#h-lluvia'), {
    type: 'bar',
    data: { datasets: [{ data: lluvia.map((a) => ({ x: ts(`${a.anio}-07-01`), y: a.mm })), backgroundColor: css('--lluvia'), borderRadius: 3, barPercentage: 0.7, categoryPercentage: 1 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
      scales: {
        x: ejeX(true),
        y: { beginAtZero: true, afterFit: anchoFijo, ticks: { color: tinta, font: fuente, maxTicksLimit: 3, callback: (v) => num(v) }, grid: { color: rejilla }, border: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false, callbacks: { title: () => '', label: (i) => t('p1.tooltip_lluvia', { anio: new Date(i.parsed.x).getFullYear(), mm: num(i.parsed.y) }) } },
      },
    },
  });
  graficos = [linea, barras];

  // Textos alternativos
  const tendencia = historia.resumen?.tendencia_vigor ?? 'estable';
  el.querySelector('#h-linea').setAttribute('aria-label', t('p1.grafico_alt', { desde, hasta: anioFin, n: historia.ciclos.length, tendencia: t(`tendencia.frase.${tendencia}`) }));
  if (lluvia.length) {
    const seco = lluvia.reduce((a, b) => (b.mm < a.mm ? b : a));
    el.querySelector('#h-lluvia').setAttribute('aria-label', t('p1.lluvia_alt', { desde: lluvia[0].anio, hasta: lluvia[lluvia.length - 1].anio, seco: seco.anio, mm: num(seco.mm) }));
  }

  // En celular: últimos 5 años, con botón para ver desde 2013.
  const boton = el.querySelector('#h-ver');
  const aplicarRango = () => {
    const corto = esCelular() && !verTodo;
    const min = corto ? Math.max(xMin, ts(`${anioFin - 4}-01-01`)) : xMin;
    graficos.forEach((g) => { g.options.scales.x.min = min; g.update('none'); });
    boton.hidden = !esCelular();
    boton.textContent = verTodo ? t('p1.ver_reciente') : t('p1.ver_todo');
    boton.setAttribute('aria-pressed', String(verTodo));
  };
  boton.addEventListener('click', () => { verTodo = !verTodo; aplicarRango(); });
  const consulta = window.matchMedia('(max-width: 640px)');
  if (alCambiarAncho) consulta.removeEventListener('change', alCambiarAncho);
  alCambiarAncho = aplicarRango;
  consulta.addEventListener('change', alCambiarAncho);
  aplicarRango();
}

/** Leaflet necesita recalcular su tamaño cuando la pantalla se hace visible. */
export function alMostrar() {
  if (mapa) setTimeout(() => mapa.invalidateSize(), 0);
}

// ---------- Actualización ----------

export function actualizar(contenedor, ctx) {
  if (!el) return;
  const { reales, estado } = ctx;
  const ciclos = reales.ciclos_arroz_seguidos;
  const tend = reales.tendencia_vigor;
  const dias = reales.dias_descubierto_promedio;

  const cifra = (valor, nombre, s, extra = '') => `<div class="tarjeta cifra">
      <span class="cifra-valor">${valor}</span>
      <span class="cifra-nombre">${esc(nombre)}</span>
      ${extra}
      ${meta({ etiqueta: s.etiqueta, fuente: s.etiqueta === 'REPORTADO' ? null : s.fuente })}
    </div>`;
  el.querySelector('#h-resumen').innerHTML = [
    cifra(esc(num(ciclos.valor)), t('p1.ciclos'), ciclos),
    cifra(esc(tend.valor ? t(`tendencia.${tend.valor}`) : '—'), t('p1.tendencia'), tend),
    cifra(esc(num(dias.valor)), t('p1.descubierto'), dias),
  ].join('');

  // Estado de la confirmación
  const conf = estado.confirmacion;
  el.querySelectorAll('[data-resp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.resp === conf.respuesta)));
  const corregir = el.querySelector('#h-corregir');
  const estadoTxt = el.querySelector('#h-estado');
  if (conf.respuesta === 'si') {
    corregir.hidden = true;
    estadoTxt.textContent = t('p1.gracias_si');
  } else if (conf.respuesta && Number.isInteger(conf.ciclos)) {
    corregir.hidden = false;
    el.querySelector('#h-ciclos').value = String(conf.ciclos);
    estadoTxt.innerHTML = `${esc(t('p1.usando_correccion', { n: conf.ciclos }))} ${etiqueta('REPORTADO')}`;
  } else {
    estadoTxt.textContent = '';
  }
  if (!estado.confirmacionGuardada) estadoTxt.textContent += ` ${t('p1.no_guardado')}`;
}
