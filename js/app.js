// Arranque, navegación entre pantallas, carga de datos y estado de la app.

import { cargarTextos, idiomaInicial, setIdioma, getIdioma, t, aplicarTextos, esc } from './i18n.js';
import { cargarDatos } from './datos.js';
import { calcularSenales, aplicarSimulador } from './senales.js';
import { recomendar } from './motor.js';
import * as historia from './historia.js';
import * as suelo from './suelo.js';
import * as decision from './decision.js';
import { iniciarSensor } from './thingspeak.js';

const PANTALLAS = { parcela: historia, suelo, decision };
const CLAVE_CONFIRMACION = 'lpr.confirmacion';

/** Estado de la app. Todo lo que se ve sale de aquí. */
const estado = {
  datos: null,
  prioridad: 'mejorar_suelo',
  confirmacion: { respuesta: null, ciclos: null },
  confirmacionGuardada: true,
  sensor: { estado: 'sin_configurar', lectura: null },
  sim: { activo: false, ph: 7, sal: 2, ciclos: 5, seco: false },
};

function leerConfirmacion() {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_CONFIRMACION));
    if (c && ['si', 'en_parte', 'no'].includes(c.respuesta)) {
      return { respuesta: c.respuesta, ciclos: Number.isInteger(c.ciclos) ? c.ciclos : null };
    }
  } catch { /* sin almacenamiento o dato roto */ }
  return { respuesta: null, ciclos: null };
}

/** Señales reales, señales usadas (con simulador) y recomendación. */
function contexto() {
  const { datos } = estado;
  const reales = calcularSenales(datos, { lectura: estado.sensor.lectura, confirmacion: estado.confirmacion });
  const usadas = estado.sim.activo ? aplicarSimulador(reales, estado.sim) : reales;
  const resultado = recomendar(usadas, datos.reglas, datos.cultivos, datos.umbrales, estado.prioridad);
  return { datos, estado, reales, usadas, resultado, acciones };
}

const acciones = {
  setPrioridad(p) { estado.prioridad = p; actualizar(); },
  setSim(cambios) { Object.assign(estado.sim, cambios, { activo: true }); actualizar(); },
  salirSim() { estado.sim.activo = false; actualizar(); },
  setConfirmacion(respuesta, ciclos = null) {
    estado.confirmacion = { respuesta, ciclos };
    try {
      localStorage.setItem(CLAVE_CONFIRMACION, JSON.stringify(estado.confirmacion));
      estado.confirmacionGuardada = true;
    } catch {
      estado.confirmacionGuardada = false;
    }
    actualizar();
  },
};

function franjaEjemplo(ctx) {
  const { datos, reales } = ctx;
  const hay = [datos.parcela, datos.historia, datos.clima].some((d) => d.etiqueta === 'EJEMPLO')
    || Object.values(reales).some((s) => s.etiqueta === 'EJEMPLO');
  document.getElementById('franja-ejemplo').hidden = !hay;
}

/** Recalcula y actualiza las 3 pantallas (sin reconstruirlas). */
function actualizar() {
  const ctx = contexto();
  franjaEjemplo(ctx);
  Object.entries(PANTALLAS).forEach(([nombre, mod]) => mod.actualizar(document.getElementById(`pantalla-${nombre}`), ctx));
}

/** Construye las 3 pantallas (al arrancar y al cambiar de idioma). */
function montar() {
  aplicarTextos();
  const boton = document.getElementById('boton-idioma');
  boton.textContent = t('idioma.boton');
  boton.setAttribute('aria-label', t('idioma.aria'));
  boton.lang = t('idioma.lang');

  const ctx = contexto();
  Object.entries(PANTALLAS).forEach(([nombre, mod]) => mod.montar(document.getElementById(`pantalla-${nombre}`), ctx));
  actualizar();
}

// ---------- Navegación ----------
function pantallaDesdeHash() {
  const h = location.hash.replace('#', '');
  return h in PANTALLAS ? h : 'parcela';
}

function mostrarPantalla(nombre, enfocar = false) {
  Object.keys(PANTALLAS).forEach((p) => {
    document.getElementById(`pantalla-${p}`).hidden = p !== nombre;
  });
  document.querySelectorAll('.pestanas a').forEach((a) => {
    if (a.dataset.pantalla === nombre) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  PANTALLAS[nombre].alMostrar?.();
  if (enfocar) {
    window.scrollTo(0, 0);
    document.getElementById('contenido').focus({ preventScroll: true });
  }
}

function mostrarError(err) {
  document.getElementById('cargando').hidden = true;
  const caja = document.getElementById('error-carga');
  caja.hidden = false;
  const archivo = err.archivo || 'data/';
  caja.innerHTML = `<strong>Faltan datos · Missing data</strong>
    <span>No pudimos cargar ${esc(archivo)}. Recarga la página. Si sigue pasando, revisa que la carpeta data/ esté completa.</span>`;
  console.error(err);
}

async function iniciar() {
  try {
    estado.datos = await cargarDatos();
  } catch (err) {
    mostrarError(err);
    return;
  }
  cargarTextos(estado.datos.textos);
  setIdioma(idiomaInicial(estado.datos.config.idioma_por_defecto));
  estado.confirmacion = leerConfirmacion();

  document.getElementById('cargando').hidden = true;
  montar();
  mostrarPantalla(pantallaDesdeHash());

  window.addEventListener('hashchange', () => mostrarPantalla(pantallaDesdeHash(), true));
  document.getElementById('boton-idioma').addEventListener('click', () => {
    setIdioma(getIdioma() === 'es' ? 'en' : 'es');
    montar();
  });

  // Sensor simulado: cada lectura nueva recalcula todo (el simulador manual tiene prioridad).
  iniciarSensor(estado.datos.config.thingspeak, (sensor) => {
    estado.sensor = sensor;
    actualizar();
  }, () => suelo.tic?.());
}

iniciar();
