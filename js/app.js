// Arranque, navegación entre pantallas y carga de datos.

import { cargarTextos, idiomaInicial, setIdioma, getIdioma, t, aplicarTextos, esc } from './i18n.js';

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

async function iniciar() {
  const resp = await fetch('data/textos.json');
  cargarTextos(await resp.json());
  setIdioma(idiomaInicial('es'));
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
