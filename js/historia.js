// Pantalla 1 — Mi parcela: mapa (y elegir mi parcela), línea de tiempo desde 2013, resumen y confirmación del agricultor.

/* global L, Chart */
import { t, esc, num, fecha } from './i18n.js';
import { etiqueta, meta } from './etiquetas.js';
import { M2_POR_TAREA, areaM2, centroide, distanciaKm, seCruza, poligonoDesdePuntos } from './parcela.js';

const DIA = 86400000;
const LEJOS_KM = 25;          // la cuadrícula de NASA POWER mide ~50 km
const TAREAS_MAX = 2000;
const TAREAS_MIN = 0.5;
const ts = (iso) => new Date(`${iso}T12:00:00`).getTime();

let el = null;
let mapa = null;
let graficos = [];
let verTodo = false;
let alCambiarAncho = null;

const css = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
const esCelular = () => window.matchMedia('(max-width: 640px)').matches;

// ---------- Ilustración del hero: parcelas de arroz vistas desde arriba ----------

/**
 * Puntos SVG con la forma real de la parcela, centrada y escalada dentro de la casilla resaltada.
 * @param {number[][]} anillo  [lon, lat]
 * @param {number[][]} casilla esquinas [x, y] de la casilla del dibujo
 */
function formaEnCasilla(anillo, casilla) {
  const lat0 = anillo[0][1] * Math.PI / 180;
  const xy = anillo.slice(0, -1).map(([lon, lat]) => [lon * Math.cos(lat0), -lat]);
  const xs = xy.map((p) => p[0]); const ys = xy.map((p) => p[1]);
  const ancho = Math.max(...xs) - Math.min(...xs) || 1;
  const alto = Math.max(...ys) - Math.min(...ys) || 1;
  const cx = casilla.reduce((a, p) => a + p[0], 0) / casilla.length;
  const cy = casilla.reduce((a, p) => a + p[1], 0) / casilla.length;
  const escala = Math.min(170 / ancho, 110 / alto);
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const my = (Math.max(...ys) + Math.min(...ys)) / 2;
  return xy.map(([x, y]) => `${(cx + (x - mx) * escala).toFixed(1)},${(cy + (y - my) * escala).toFixed(1)}`).join(' ');
}

/** @param {number[][]|null} forma  contorno de la parcela propia, o null para la casilla de siempre */
function ilustracionCampos(forma = null) {
  let semilla = 20131;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const verdes = ['#24391C', '#2F4A22', '#3A5A28', '#46692F', '#557A36', '#6C8F3E', '#86A646', '#9DBA4E'];
  const W = 900; const H = 520;
  const casillas = [];
  for (let y = -80; y < H + 80; y += 58 + azar() * 26) {
    const alto = 54 + azar() * 24;
    let x = -120 + azar() * 40;
    while (x < W + 120) {
      const ancho = 70 + azar() * 130;
      const j = () => (azar() - 0.5) * 14;
      const p = [[x + j(), y + j()], [x + ancho + j(), y + j()], [x + ancho + j(), y + alto + j()], [x + j(), y + alto + j()]];
      casillas.push({ p, color: verdes[Math.floor(azar() * verdes.length)] });
      x += ancho + 6;
    }
  }

  // La parcela resaltada es la casilla que queda arriba a la derecha de la portada,
  // zona libre de texto tanto en celular como en laptop. Aplica la misma transformación que <g>.
  const ang = -14 * Math.PI / 180;
  const enPantalla = ([x, y]) => {
    const sx = (x - 90) * 1.25 - W / 2; const sy = (y - 60) * 1.25 - H / 2;
    return [W / 2 + sx * Math.cos(ang) - sy * Math.sin(ang), H / 2 + sx * Math.sin(ang) + sy * Math.cos(ang)];
  };
  const objetivo = [W * 0.64, H * 0.26];
  let elegida = 0; let mejor = Infinity;
  casillas.forEach((c, i) => {
    const cx = c.p.reduce((a, q) => a + q[0], 0) / 4; const cy = c.p.reduce((a, q) => a + q[1], 0) / 4;
    const [px, py] = enPantalla([cx, cy]);
    const d = (px - objetivo[0]) ** 2 + (py - objetivo[1]) ** 2;
    if (d < mejor) { mejor = d; elegida = i; }
  });

  let poligonos = '';
  let resaltada = '';
  casillas.forEach((c, i) => {
    const puntos = c.p.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ');
    if (i === elegida) {
      // La parcela del agricultor: su forma real si la marcó, si no la casilla del dibujo.
      if (forma) poligonos += `<polygon points="${puntos}" fill="${verdes[2]}"/>`;
      resaltada = `<polygon points="${forma ? formaEnCasilla(forma, c.p) : puntos}" fill="#B9D46E" stroke="#fff" stroke-width="3" stroke-dasharray="9 6"/>`;
    } else {
      poligonos += `<polygon points="${puntos}" fill="${c.color}"/>`;
    }
  });
  return `<svg class="hero-campos" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="${W}" height="${H}" fill="#1B2D15"/>
    <g transform="rotate(-14 ${W / 2} ${H / 2}) scale(1.25) translate(-90 -60)" stroke="rgba(214,232,180,0.28)" stroke-width="2.5" stroke-linejoin="round">
      ${poligonos}${resaltada}
      <path d="M-100 330 C 150 280, 300 420, 520 350 S 850 240, 1050 300" fill="none" stroke="#6F9C9A" stroke-width="10" opacity="0.7"/>
    </g>
  </svg>`;
}

// ---------- Construcción ----------

/** Punto de referencia de los datos de lluvia (POWER) para medir distancias. */
function puntoReferencia(datos) {
  return datos.clima.punto ?? datos.parcela.centro;
}

export function montar(contenedor, ctx) {
  el = contenedor;
  const { datos, parcela, estado } = ctx;
  const { historia, clima } = datos;
  const base = datos.parcela;

  // Ficha de la parcela
  const nombreAgricultor = base.agricultor?.nombre && base.agricultor.nombre !== 'PENDIENTE' && base.agricultor.permiso_uso
    ? base.agricultor.nombre : null;
  let area;
  if (parcela.propia) {
    area = { tareas: parcela.area_m2 / M2_POR_TAREA, ha: parcela.area_m2 / 10000, etq: 'REPORTADO' };
  } else if (Number.isFinite(base.area_tareas)) {
    area = { tareas: base.area_tareas, ha: base.area_tareas * M2_POR_TAREA / 10000, etq: base.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'REPORTADO' };
  } else {
    area = { tareas: parcela.area_m2 / M2_POR_TAREA, ha: parcela.area_m2 / 10000, etq: base.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'ESTIMADO' };
  }
  const etqBase = base.etiqueta === 'EJEMPLO' ? 'EJEMPLO' : 'REPORTADO';
  const filaLugar = parcela.propia
    ? `<dt>${esc(t('p1.ubicacion'))}</dt><dd>${esc(num(parcela.centro.lat, 4))}, ${esc(num(parcela.centro.lon, 4))} ${etiqueta('REPORTADO')}</dd>`
    : `<dt>${esc(t('p1.comunidad'))}</dt><dd>${esc(base.comunidad)} ${etiqueta(etqBase)}</dd>`;
  const km = distanciaKm(parcela.centro, puntoReferencia(datos));

  // Avisos y "pedir la historia real", solo con parcela propia
  const bloquePropia = parcela.propia ? `
      <p class="nota">${esc(t(estado.parcelaGuardada ? 'p1.parcela_guardada' : 'p1.parcela_no_guardada'))}</p>
      <div class="alerta alerta-sim" role="status">
        <span>${etiqueta('SIMULADO')} ${esc(t('p1.sin_historia'))}</span>
        ${km > LEJOS_KM ? `<span>${esc(t('p1.lejos', { km: num(km) }))}</span>` : ''}
      </div>
      <div class="tarjeta pedir">
        <h4>${esc(t('p1.pedir_titulo'))}</h4>
        <p class="nota">${esc(t('p1.pedir_texto'))}</p>
        <div class="botones"><button type="button" class="boton" id="h-geojson">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>
          <span>${esc(t('p1.descargar'))}</span></button></div>
        <p class="nota">${esc(t('p1.coordenadas'))} <code>--lat ${parcela.centro.lat} --lon ${parcela.centro.lon}</code></p>
      </div>` : '';

  el.innerHTML = `
    <div class="hero">
      ${ilustracionCampos(parcela.propia ? parcela.poligono_geojson.coordinates[0] : null)}
      <div class="hero-texto">
        <span class="pildora">${esc(base.comunidad)}</span>
        <h2 id="titulo-parcela">${esc(t('p1.titulo'))}</h2>
        <p class="hero-intro">${esc(t('p1.intro'))}</p>
      </div>
      <div class="ficha">
        <div class="ficha-nombre">${esc(parcela.propia ? t('p1.mi_parcela') : (nombreAgricultor ?? base.nombre))}</div>
        <dl>
          ${filaLugar}
          <dt>${esc(t('p1.area'))}</dt><dd>${esc(t('p1.area_valor', { tareas: num(area.tareas), ha: num(area.ha, 1) }))} ${etiqueta(area.etq)}</dd>
          <dt>${esc(t('p1.cultivo'))}</dt><dd>${esc(t(`cultivo.${base.cultivo_actual}`))} ${etiqueta(etqBase)}</dd>
        </dl>
      </div>
    </div>

    <div class="bloque">
      <h3 class="bloque-cabeza">${esc(t('p1.mapa_titulo'))}</h3>
      <div class="zona-mapa" id="h-zona">
        <div class="mapa-envoltura">
          <div class="mapa" id="h-mapa" role="img" aria-label="${esc(t('p1.mapa_alt', { comunidad: parcela.propia ? t('p1.mi_parcela') : base.comunidad }))}"></div>
          <div class="mira" id="h-mira" aria-hidden="true" hidden></div>
        </div>
        <div class="editor" id="h-editor" hidden>
          <h4 id="h-editor-titulo">${esc(t('p1.ed_titulo'))}</h4>
          <p class="nota">${esc(t('p1.ed_ayuda'))}</p>
          <p class="editor-estado" id="h-ed-estado" role="status" aria-live="polite"></p>
          <p class="editor-avisos" id="h-ed-avisos" aria-live="polite"></p>
          <div class="editor-botones">
            <button type="button" class="boton" id="h-ed-gps">${esc(t('p1.ed_gps'))}</button>
            <button type="button" class="boton" id="h-ed-mao">${esc(t('p1.ed_mao'))}</button>
            <button type="button" class="boton" id="h-ed-aqui">${esc(t('p1.ed_aqui'))}</button>
            <button type="button" class="boton" id="h-ed-deshacer">${esc(t('p1.ed_deshacer'))}</button>
            <button type="button" class="boton boton-primario" id="h-ed-guardar">${esc(t('p1.ed_guardar'))}</button>
            <button type="button" class="boton" id="h-ed-cancelar">${esc(t('p1.ed_cancelar'))}</button>
          </div>
        </div>
      </div>
      <div class="botones mapa-acciones" id="h-acciones">
        <button type="button" class="boton" id="h-cambiar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/></svg>
          <span>${esc(t('p1.cambiar'))}</span></button>
        ${parcela.propia ? `<button type="button" class="boton" id="h-piloto">${esc(t('p1.volver_piloto'))}</button>` : ''}
      </div>
      ${bloquePropia}
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

  montarMapa(ctx);
  montarGraficos(datos);
}

// ---------- Mapa y "Elegir mi parcela" ----------

let capaParcela = null;
let edicion = null; // { puntos: [[lat, lon]], capa, gps }
let datosMapa = null;

function montarMapa(ctx) {
  const { parcela, datos } = ctx;
  edicion = null;
  datosMapa = datos;
  if (mapa) { mapa.remove(); mapa = null; }
  if (typeof L === 'undefined') return;
  const div = el.querySelector('#h-mapa');
  mapa = L.map(div, { scrollWheelZoom: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);
  capaParcela = L.geoJSON(parcela.poligono_geojson, {
    style: { color: '#3F6B26', weight: 3, fillColor: '#9DBA4E', fillOpacity: 0.35, dashArray: '8 5' },
  }).addTo(mapa);
  mapa.fitBounds(capaParcela.getBounds(), { padding: [24, 24], maxZoom: 17 });

  const $ = (id) => el.querySelector(id);
  $('#h-cambiar').addEventListener('click', () => entrarEdicion(ctx));
  $('#h-piloto')?.addEventListener('click', () => ctx.acciones.borrarParcelaPropia());
  $('#h-geojson')?.addEventListener('click', () => descargarGeojson(parcela.poligono_geojson));
  $('#h-ed-aqui').addEventListener('click', () => agregarPunto(mapa.getCenter(), datos));
  $('#h-ed-deshacer').addEventListener('click', () => { edicion?.puntos.pop(); pintarEdicion(datos); });
  $('#h-ed-cancelar').addEventListener('click', () => salirEdicion());
  $('#h-ed-mao').addEventListener('click', () => {
    const c = datos.parcela.centro;
    mapa.setView([c.lat, c.lon], 15);
  });
  $('#h-ed-gps').addEventListener('click', usarUbicacion);
  $('#h-ed-guardar').addEventListener('click', () => {
    if (!edicion || edicion.puntos.length < 3) return;
    const poligono = poligonoDesdePuntos(edicion.puntos);
    ctx.acciones.setParcelaPropia({ poligono_geojson: poligono, centro: centroide(poligono), guardada: new Date().toISOString() });
    // montar() reconstruye la pantalla; dejamos el foco en el mapa nuevo.
    document.getElementById('h-cambiar')?.focus();
  });
  $('#h-zona').addEventListener('keydown', (e) => { if (e.key === 'Escape' && edicion) salirEdicion(); });
  mapa.on('click', (e) => { if (edicion) agregarPunto(e.latlng, datos); });
}

function entrarEdicion(ctx) {
  if (!mapa) return;
  edicion = { puntos: [], capa: L.layerGroup().addTo(mapa), gps: null };
  capaParcela?.setStyle({ opacity: 0.35, fillOpacity: 0.08 });
  el.querySelector('#h-zona').classList.add('editando');
  el.querySelector('#h-editor').hidden = false;
  el.querySelector('#h-mira').hidden = false;
  el.querySelector('#h-acciones').hidden = true;
  div().setAttribute('role', 'application');
  setTimeout(() => mapa.invalidateSize(), 0);
  pintarEdicion(ctx.datos);
  el.querySelector('#h-ed-aqui').focus();
}

function salirEdicion() {
  if (!edicion) return;
  mapa.removeLayer(edicion.capa);
  edicion = null;
  capaParcela?.setStyle({ opacity: 1, fillOpacity: 0.35 });
  el.querySelector('#h-zona').classList.remove('editando');
  el.querySelector('#h-editor').hidden = true;
  el.querySelector('#h-mira').hidden = true;
  el.querySelector('#h-acciones').hidden = false;
  div().setAttribute('role', 'img');
  setTimeout(() => {
    mapa.invalidateSize();
    mapa.fitBounds(capaParcela.getBounds(), { padding: [24, 24], maxZoom: 17 });
  }, 0);
  el.querySelector('#h-cambiar').focus(); // cancelar no guarda nada
}

const div = () => el.querySelector('#h-mapa');

function agregarPunto(latlng, datos) {
  if (!edicion) return;
  edicion.puntos.push([latlng.lat, latlng.lng]);
  pintarEdicion(datos);
}

function pintarEdicion(datos) {
  if (!edicion) return;
  const { puntos, capa } = edicion;
  capa.clearLayers();
  const estilo = { color: '#B26B00', weight: 3, dashArray: '6 5', fillColor: '#F2B544', fillOpacity: 0.25 };
  if (puntos.length >= 3) L.polygon(puntos, estilo).addTo(capa);
  else if (puntos.length === 2) L.polyline(puntos, estilo).addTo(capa);
  puntos.forEach((p, i) => L.circleMarker(p, {
    radius: 7, color: '#fff', weight: 2, fillColor: i === puntos.length - 1 ? '#B26B00' : '#3F6B26', fillOpacity: 1,
  }).addTo(capa));
  if (edicion.gps) edicion.gps.addTo(capa);

  const estadoTxt = [t('p1.ed_puntos', { n: puntos.length })];
  const avisos = [];
  let cruza = false;
  if (puntos.length >= 3) {
    const poligono = poligonoDesdePuntos(puntos);
    const m2 = areaM2(poligono);
    estadoTxt.push(t('p1.ed_area', { tareas: num(m2 / M2_POR_TAREA, m2 / M2_POR_TAREA < 10 ? 1 : 0), ha: num(m2 / 10000, 2) }));
    cruza = seCruza(puntos.map(([lat, lon]) => [lon, lat]));
    if (cruza) avisos.push(t('p1.ed_cruza'));
    if (m2 / M2_POR_TAREA > TAREAS_MAX) avisos.push(t('p1.ed_grande'));
    if (m2 / M2_POR_TAREA < TAREAS_MIN) avisos.push(t('p1.ed_chica'));
    const km = distanciaKm(centroide(poligono), puntoReferencia(datos));
    if (km > LEJOS_KM) avisos.push(t('p1.ed_lejos', { km: num(km) }));
  } else {
    avisos.push(t('p1.ed_faltan'));
  }
  el.querySelector('#h-ed-estado').textContent = estadoTxt.join(' · ');
  el.querySelector('#h-ed-avisos').innerHTML = avisos.map((a) => `<span>${esc(a)}</span>`).join('');
  el.querySelector('#h-ed-guardar').disabled = puntos.length < 3 || cruza;
  el.querySelector('#h-ed-deshacer').disabled = puntos.length === 0;
}

function usarUbicacion() {
  const estadoEl = el.querySelector('#h-ed-avisos');
  if (!navigator.geolocation) { estadoEl.textContent = t('p1.ed_gps_error'); return; }
  estadoEl.textContent = t('p1.ed_gps_buscando');
  navigator.geolocation.getCurrentPosition((pos) => {
    if (!edicion) return;
    const { latitude, longitude } = pos.coords;
    mapa.setView([latitude, longitude], 17);
    edicion.gps = L.circleMarker([latitude, longitude], { radius: 9, color: '#1B4775', weight: 3, fillColor: '#6B93BD', fillOpacity: 0.6 });
    pintarEdicion(datosMapa);
    estadoEl.textContent = t('p1.ed_gps_listo');
  }, () => {
    estadoEl.textContent = t('p1.ed_gps_error');
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

/** Descarga el contorno como GeoJSON (Feature) para subirlo a AppEEARS. */
function descargarGeojson(poligono) {
  const feature = { type: 'Feature', properties: { nombre: 'Mi parcela', fuente: 'La parcela recuerda' }, geometry: poligono };
  const blob = new Blob([JSON.stringify(feature, null, 1)], { type: 'application/geo+json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mi_parcela.geojson';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
    const input = el.querySelector('#h-ciclos');
    if (document.activeElement !== input) input.value = String(conf.ciclos);
    estadoTxt.innerHTML = `${esc(t('p1.usando_correccion', { n: conf.ciclos }))} ${etiqueta('REPORTADO')}`;
  } else {
    estadoTxt.textContent = '';
  }
  if (!estado.confirmacionGuardada) estadoTxt.textContent += ` ${t('p1.no_guardado')}`;
}
