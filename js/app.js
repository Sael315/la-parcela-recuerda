// Arranque, navegación entre pantallas y carga de datos.

import { cargarTextos, idiomaInicial, setIdioma, getIdioma, t, aplicarTextos, esc } from './i18n.js';
import { cargarDatos } from './datos.js';

const PANTALLAS = ['parcela', 'suelo', 'decision'];

function pantallaDesdeHash() {
  const h = location.hash.replace('#', '');
  return PANTALLAS.includes(h) ? h : 'parcela';
}

function mostrarPantalla(nombre, enfocar = false) {
  PANTALLAS.forEach((p) => {
    document.getElementById(`pantalla-${p}`).hidden = p !== nombre;
  });
  document.querySelectorAll('.pestanas a').forEach((a) => {
    if (a.dataset.pantalla === nombre) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (enfocar) {
    window.scrollTo(0, 0);
    document.getElementById('contenido').focus({ preventScroll: true });
  }
}

function encabezado(id, chip, titulo, intro) {
  return `<header class="encabezado">
    <span class="pildora">${esc(chip)}</span>
    <div><h2 id="${id}">${esc(titulo)}</h2><p>${esc(intro)}</p></div>
  </header>`;
}

function pintar() {
  aplicarTextos();
  const boton = document.getElementById('boton-idioma');
  boton.textContent = t('idioma.boton');
  boton.setAttribute('aria-label', t('idioma.aria'));
  boton.lang = t('idioma.lang');

  document.getElementById('pantalla-parcela').innerHTML = encabezado('titulo-parcela', 'Mao, Valverde', t('p1.titulo'), t('p1.intro'));
  document.getElementById('pantalla-suelo').innerHTML = encabezado('titulo-suelo', t('p2.chip'), t('p2.titulo'), t('p2.intro'));
  document.getElementById('pantalla-decision').innerHTML = encabezado('titulo-decision', t('p3.chip'), t('p3.titulo'), t('p3.intro'));
}

function franjaEjemplo(datos) {
  const hay = [datos.parcela, datos.historia, datos.clima, datos.suelo.ph, datos.suelo.sal_dsm]
    .some((d) => d.etiqueta === 'EJEMPLO');
  document.getElementById('franja-ejemplo').hidden = !hay;
}

function mostrarError(err) {
  document.getElementById('cargando').hidden = true;
  const caja = document.getElementById('error-carga');
  caja.hidden = false;
  const archivo = err.archivo || 'data/';
  // Sin textos cargados, el mensaje sale en español.
  caja.innerHTML = `<strong>${esc(t('error.titulo') === 'error.titulo' ? 'Faltan datos' : t('error.titulo'))}</strong>
    <span>${esc(t('error.datos') === 'error.datos' ? `No pudimos cargar ${archivo}. Recarga la página.` : t('error.datos', { archivo }))}</span>`;
  console.error(err);
}

async function iniciar() {
  let datos;
  try {
    datos = await cargarDatos();
  } catch (err) {
    mostrarError(err);
    return;
  }
  cargarTextos(datos.textos);
  setIdioma(idiomaInicial(datos.config.idioma_por_defecto));
  franjaEjemplo(datos);
  pintar();
  document.getElementById('cargando').hidden = true;
  mostrarPantalla(pantallaDesdeHash());

  window.addEventListener('hashchange', () => mostrarPantalla(pantallaDesdeHash(), true));
  document.getElementById('boton-idioma').addEventListener('click', () => {
    setIdioma(getIdioma() === 'es' ? 'en' : 'es');
    pintar();
  });
}

iniciar();
