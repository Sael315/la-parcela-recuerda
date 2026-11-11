# Especificación para Claude Code — App web "La parcela recuerda"

> Proyecto: CambiaCosecha + Finca Viva, unidos en una sola app.
> Equipo INPONOR · NASA Space Apps Challenge 2026 · Santiago de los Caballeros, 14–15 de noviembre de 2026
> Reto: **Field Shift: Adapting Farms with NASA Data** · Zona: Mao, Valverde, República Dominicana
>
> Sugerencia: guarda este archivo como `CLAUDE.md` en la raíz del repositorio para que Claude Code lo lea siempre.

---

## 0. Instrucciones para Claude Code

Construye la app web descrita en este documento, súbela a un repositorio público de GitHub y publícala con GitHub Pages.

**Forma de trabajar**

1. Lee el documento completo antes de escribir código. Haz un plan corto y una lista de tareas.
2. Construye por fases (sección 14). Al terminar cada fase: prueba, haz commit con un mensaje claro y sigue.
3. Todo el texto visible para el usuario va **en español**, con traducción al inglés en `i18n`.
4. **No inventes datos reales.** Donde falte un dato real, usa los datos de ejemplo de la sección 7, marcados con la etiqueta `EJEMPLO`, y deja el hueco listado en `PENDIENTES.md`.
5. **No pongas claves secretas en el repositorio.** El repositorio es público.
6. Verifica la app en un navegador real (Playwright está bien) a 390 px de ancho (celular) y a 1280 px (laptop): sin errores en consola, sin scroll horizontal, las 3 pantallas funcionando.
7. Al final, entrega: la URL de GitHub Pages, la URL del repositorio y el contenido de `PENDIENTES.md`.

**Lo que NO debes hacer**

- No agregues backend, base de datos, inicio de sesión ni pagos.
- No uses un framework ni un paso de compilación (ver sección 2).
- No llames APIs externas desde la app en tiempo real, salvo ThingSpeak (sección 10). Todo lo demás se lee de archivos JSON guardados.
- No prometas en la interfaz lluvia futura, diagnósticos de plagas ni mediciones que no existen.
- No agregues funciones fuera de este documento. Si algo parece útil, anótalo en `IDEAS.md`.

---

## 1. Qué es la app, en una frase

Una app web que le dice a un arrocero de Mao **qué sembrar después del arroz y por qué**, usando la historia de su parcela vista por satélites de la NASA desde 2013, la lluvia histórica de la NASA, el pH y la sal de su suelo (estimados o simulados), lo que él recuerda y la prioridad que él elige.

**De dónde viene cada parte**

| Parte | Viene de |
|---|---|
| Usuario, decisión, motor de reglas de rotación, panel de datos NASA, sal del suelo, simulador, tarjeta de recomendación | **CambiaCosecha** |
| Fuerza (vigor) del cultivo vista desde el satélite, usada para leer las temporadas pasadas; tarjeta por WhatsApp; regla de "cada recomendación dice su límite"; alcance de 3 pantallas | **Finca Viva** |
| Historia de la parcela desde 2013, confirmación del agricultor, separar sequía de tierra cansada, pH | **Nuevo, al unir las dos** |

La alerta en vivo de Finca Viva **no** se construye. Se anota en `IDEAS.md` como siguiente paso.

---

## 2. Tecnologías (decisión cerrada)

**Recomendación: HTML + CSS + JavaScript moderno (módulos ES), sin framework y sin compilación.**

Por qué, frente a TypeScript o React:

| Opción | Decisión | Motivo |
|---|---|---|
| HTML + CSS + JavaScript (ES modules) | **Usar** | Se publica tal cual en GitHub Pages, sin paso de compilación que pueda fallar el día del evento. El equipo (estudiantes) puede leerlo y editarlo en 2 días. |
| TypeScript | No usar | Obliga a compilar. El tipado se reemplaza con JSDoc en las funciones importantes. |
| React / Vue / Svelte | No usar | La app tiene 3 pantallas; un framework añade compilación, configuración de rutas en Pages y curva de aprendizaje sin beneficio real aquí. |
| Tailwind | No usar | Requiere aprender clases o compilar. |
| Pico.css u otro framework de estilos | No usar | La app sigue un diseño de referencia propio (sección 12); se logra mejor con CSS propio y variables. |

**Librerías, por CDN con versión fija** (no instalar con npm):

| Librería | Versión | Uso | Enlace |
|---|---|---|---|
| Leaflet | 1.9.4 | Mapa de la parcela | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` y `leaflet.js` |
| Chart.js | 4.4.1 | Gráficos | `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js` |

Mapa base de Leaflet: OpenStreetMap, con su atribución visible.

**Otras herramientas del proyecto**

| Herramienta | Uso |
|---|---|
| Python 3 (requests, pandas, numpy, scipy) | Scripts en `scripts/` que descargan y procesan los datos. Se pueden correr local o en Google Colab. |
| NASA POWER API | Lluvia, temperatura y humedad superficial de Mao (gratis, sin clave). |
| NASA AppEEARS | Imágenes HLS (Landsat + Sentinel-2) de la parcela desde 2013. Requiere cuenta Earthdata: la descarga la hace una persona del equipo; tú escribes el script que procesa el archivo descargado. |
| SoilGrids API (ISRIC) | pH estimado del suelo en el punto de la parcela. |
| Wokwi | Simula un ESP32 con 2 perillas (pH y sal). |
| ThingSpeak | "Buzón" que recibe lo que envía Wokwi y que la app lee por API. |
| Git + GitHub + GitHub Pages | Código público y app publicada gratis. Usa la CLI `gh` si está disponible. |

---

## 3. Usuario, decisión y principios

- **Usuario:** productor de arroz de Mao o Guayacanes, con celular y poca conexión.
- **Decisión:** "¿Qué siembro después del arroz y por qué?"
- **Prioridad que elige el usuario:** `ahorrar_agua`, `mejorar_suelo` o `proteger_rendimiento`. Desempata entre opciones válidas.

**Principios de interfaz**

1. **Cada número lleva su etiqueta de origen, fuente y fecha.** Etiquetas permitidas:

   | Etiqueta | Significado | Color sugerido |
   |---|---|---|
   | `OBSERVADO` | Visto por satélite o registrado por la NASA | verde |
   | `ESTIMADO` | Calculado o sacado de un mapa global (SoilGrids, ahorro) | ámbar |
   | `REPORTADO` | Lo dijo el agricultor | azul |
   | `SIMULADO` | Viene de Wokwi o del simulador "¿qué pasaría si…?" | morado |
   | `EJEMPLO` | Dato de relleno hasta tener el real | gris, con borde punteado |

   La etiqueta no depende solo del color: siempre lleva la palabra escrita.
2. **Mientras exista algún dato `EJEMPLO`**, se muestra arriba una franja: "Contiene datos de ejemplo. No son datos reales de una parcela."
3. **Frases prohibidas en la interfaz:** "tienes tal plaga", "va a llover", "medido" para algo que no se midió.
4. Lenguaje simple, sin tecnicismos. Por ejemplo, "fuerza del cultivo" en vez de "NDVI" (el término técnico puede ir en un texto de ayuda).
5. Accesible: contraste suficiente, botones de al menos 44 px de alto, todo usable con teclado, textos alternativos en gráficos.

---

## 4. Estructura del repositorio

```
la-parcela-recuerda/
├── index.html
├── css/
│   └── app.css              ← estilos propios (variables de diseño, componentes)
├── docs/
│   └── referencia/          ← capturas del diseño de referencia (sección 12)
├── js/
│   ├── app.js               ← arranque, navegación entre pantallas, carga de datos
│   ├── datos.js             ← lee los JSON y valida su forma
│   ├── motor.js             ← motor de reglas (sección 8)
│   ├── senales.js           ← calcula señales a partir de los datos (sección 8.2)
│   ├── historia.js          ← pantalla 1: mapa y línea de tiempo
│   ├── parcela.js           ← parcela propia: geometría y guardado (pantalla 1, punto 6)
│   ├── suelo.js             ← pantalla 2: pH, sal, lluvia, lectura en vivo
│   ├── decision.js          ← pantalla 3: recomendación, simulador, impacto, WhatsApp
│   ├── thingspeak.js        ← lectura del buzón con respaldo (sección 10)
│   ├── etiquetas.js         ← componente de etiqueta OBSERVADO/ESTIMADO/…
│   └── i18n.js              ← textos ES/EN
├── data/
│   ├── config.json          ← canal de ThingSpeak, coordenadas, banderas
│   ├── parcela.json
│   ├── historia.json
│   ├── clima.json
│   ├── suelo.json
│   ├── cultivos.json
│   ├── reglas.json
│   ├── umbrales.json
│   └── textos.json          ← traducciones
├── scripts/
│   ├── requirements.txt
│   ├── descargar_power.py
│   ├── descargar_soilgrids.py
│   ├── procesar_hls.py
│   └── LEEME_scripts.md     ← cómo correrlos, incluido el paso manual de AppEEARS
├── wokwi/
│   ├── sketch.ino
│   ├── diagram.json
│   └── LEEME_wokwi.md
├── tests/
│   └── motor.test.html      ← pruebas del motor que corren en el navegador
├── README.md                ← en inglés, para los jueces
├── PENDIENTES.md            ← datos reales que faltan y quién los da
├── IDEAS.md
└── .nojekyll
```

La app debe funcionar abriendo `index.html` con un servidor local (`python -m http.server 8000`) y desde GitHub Pages, con **rutas relativas** en todo.

---

## 5. Las 3 pantallas

Navegación con pestañas fijas abajo en celular y arriba en laptop: **1. Mi parcela · 2. Mi suelo · 3. Qué siembro**. Usa hash (`#parcela`, `#suelo`, `#decision`) para que funcione en GitHub Pages sin configuración de rutas. Arriba van el nombre de la app, el selector ES/EN y la franja de `EJEMPLO` si aplica.

### Pantalla 1 — Mi parcela (viene de Finca Viva + nuevo)

1. **Mapa** (Leaflet) centrado en la parcela, con su polígono dibujado. Debajo: nombre del agricultor (o "Parcela piloto"), comunidad, área en tareas y hectáreas, cultivo actual.
2. **Línea de tiempo desde 2013** (Chart.js, gráfico de línea):
   - Eje X: fechas. Eje Y: "fuerza del cultivo" (NDVI de 0 a 1).
   - Cada ciclo de arroz detectado aparece como una "montaña", con una banda sombreada y el número del ciclo.
   - Debajo del gráfico, barras pequeñas con la lluvia de cada año (de `clima.json`), para ver juntos los años secos y los ciclos débiles.
3. **Resumen en tarjetas** (cada una con su etiqueta):
   - Ciclos de arroz seguidos.
   - Tendencia de la fuerza del cultivo: "bajando", "estable" o "subiendo".
   - Promedio de días de tierra descubierta tras la cosecha.
4. **Confirmación del agricultor:** pregunta "¿Esta historia es correcta?" con botones **Sí / En parte / No**. Si elige "En parte" o "No", muestra un campo para corregir los ciclos de arroz seguidos. La respuesta se guarda en `localStorage` (con try/catch) y, si hay corrección, el motor usa el número corregido con etiqueta `REPORTADO`.
5. Texto de límite: "El satélite ve que algo pasó, pero no siempre por qué. Por eso tu confirmación es importante."
6. **Elegir mi parcela** (aprobada por el equipo después de la primera versión; diseño en `IDEAS.md`):
   - Botón **"Cambiar mi parcela"** debajo del mapa. Abre un modo edición (pantalla completa en celular) donde el agricultor marca las esquinas tocando el mapa, o moviendo el mapa hasta una cruz central y pulsando **"Marcar punto aquí"** (alternativa accesible con teclado). Botones: "Usar mi ubicación" (GPS), "Ir a Mao", "Deshacer punto", "Guardar mi parcela" y "Cancelar".
   - Mientras marca: área en tareas y hectáreas en vivo. Avisos: contorno que se cruza (impide guardar), parcela muy grande (> 2 000 tareas) o muy pequeña (< 0.5 tareas), y lejos del punto de los datos de lluvia (> 25 km).
   - Se guarda en `localStorage` (`lpr.parcela_propia`, con try/catch) con etiqueta `REPORTADO`. Cambian el mapa, la ficha de la portada (área, ubicación) y la parcela resaltada del dibujo, que toma la forma real del contorno. "Volver a la parcela piloto" la borra.
   - **Simulación:** la historia del satélite no existe todavía para esa parcela. Se sigue mostrando la de `historia.json` con el aviso "Tu parcela todavía no tiene historia del satélite", y sus señales pasan a `SIMULADO` (salvo la corrección del agricultor, que sigue `REPORTADO`). La lluvia de POWER se mantiene `OBSERVADO`, con aviso si la parcela está a más de 25 km. El pH muestra el aviso "es de la parcela piloto".
   - **"Pedir la historia real de esta parcela":** descarga `mi_parcela.geojson` (para AppEEARS) y muestra las coordenadas para los scripts.
   - No usa backend ni llamadas externas nuevas; no hay lista de comunidades para no inventar coordenadas.

### Pantalla 2 — Mi suelo hoy (viene de CambiaCosecha + nuevo)

1. **Tres tarjetas:**
   - **pH:** valor y etiqueta. Fuente por orden de prioridad: lectura de ThingSpeak (`SIMULADO`) → valor de SoilGrids (`ESTIMADO`) → ejemplo (`EJEMPLO`). Si hay lectura simulada, muestra también "pH estimado de la zona (SoilGrids): X" como referencia.
   - **Sal:** valor en dS/m con una palabra (baja / media / alta, según `umbrales.json`). Fuente: ThingSpeak (`SIMULADO`) → ejemplo.
   - **Humedad de la zona:** último valor de NASA POWER `GWETTOP` (0–1, mostrado como %) con etiqueta `OBSERVADO`.
2. **Indicador de conexión del sensor simulado:** "En vivo · última lectura hace 12 s", o "Sin conexión · mostrando la última lectura guardada (hora)".
3. **Gráfico de lluvia histórica** (NASA POWER): lluvia anual de Mao, con dos líneas de promedio, 1991–2010 y 2011–2025, y el cambio en % escrito en una frase.
4. Texto de límite: "El pH y la sal de esta pantalla son estimados o simulados. En un piloto real se medirían en la parcela."

### Pantalla 3 — Qué siembro (viene de CambiaCosecha + Finca Viva)

1. **Selector de prioridad:** tres botones grandes, "Ahorrar agua", "Mejorar mi tierra" y "Proteger mi cosecha". Por defecto, "Mejorar mi tierra".
2. **Dos tarjetas de recomendación.** Cada una muestra:
   - nombre del cultivo e ícono simple (emoji está bien);
   - **por qué:** 2 o 3 razones, cada una indicando qué dato la produjo, por ejemplo "Llevas 5 ciclos de arroz seguidos (OBSERVADO)";
   - **qué ganas:** beneficio, desde `cultivos.json`;
   - **su límite:** desde `cultivos.json`;
   - una nota pequeña "Viene de: regla X".
3. **Alertas antes de las tarjetas**, si alguna regla de seguridad se activa (por ejemplo, pH muy alto): caja de aviso con la acción "Consulta a un técnico antes de sembrar".
4. **Simulador "¿Qué pasaría si…?"** (desplegable):
   - controles deslizantes de pH (4.5–9.0), sal (0–10 dS/m), ciclos de arroz seguidos (0–10) y "¿el último año fue seco?" (sí/no);
   - al moverlos, las recomendaciones se recalculan al instante;
   - mientras el simulador está activo, todo lleva la etiqueta `SIMULADO` y aparece un botón "Volver a mis datos".
5. **Impacto en 3 temporadas:** comparación "arroz, arroz, arroz" frente a "arroz, rotación, arroz" en agua y abono. Los valores salen de `cultivos.json`. **Si ese valor no tiene `fuente`, se muestra "Pendiente de fuente" en lugar de un número.** Etiqueta `ESTIMADO`.
6. **Botón "Enviar por WhatsApp"**: abre `https://wa.me/?text=` con un texto codificado como este:
   "La parcela recuerda — Mi recomendación: 1) Sorgo: tolera la sal… 2) Caupí: … Datos: NASA, SoilGrids. Ver: <URL de la app>".
7. **Botón "Copiar recomendación"** como respaldo.

---

## 6. Fuentes de datos y scripts

Los scripts escriben en `data/`. La app **nunca** llama a NASA ni a SoilGrids en vivo.

### 6.1 `descargar_power.py` — NASA POWER

- Endpoint diario por punto: `https://power.larc.nasa.gov/api/temporal/daily/point`
- Parámetros: `PRECTOTCORR` (lluvia, mm/día), `T2M` (temperatura, °C), `GWETTOP` (humedad superficial 0–5 cm, de 0 a 1), `community=AG`, `latitude`, `longitude`, `start=19810101`, `end` = último día disponible, `format=JSON`.
- Calcula y guarda en `data/clima.json`:
  - la lluvia total por año;
  - el promedio anual de 1991–2010 y de 2011–2025;
  - la lluvia total de cada ciclo de arroz detectado (fechas desde `historia.json`, si existe);
  - el último valor de `GWETTOP` con su fecha.
- Marca cada valor con `"etiqueta": "OBSERVADO"`, `"fuente": "NASA POWER"` y la fecha de consulta.
- Trata los valores faltantes (POWER usa −999) como nulos.

### 6.2 `descargar_soilgrids.py` — pH estimado

- Endpoint: `https://rest.isric.org/soilgrids/v2.0/properties/query?lon={lon}&lat={lat}&property=phh2o&depth=0-5cm&depth=5-15cm&value=mean`
- **SoilGrids guarda el pH multiplicado por 10:** divide entre 10.
- Una sola consulta, con reintento y espera entre intentos. Si falla, no escribas nada y explica el error.
- Guarda en `data/suelo.json` el pH de cada profundidad con `"etiqueta": "ESTIMADO"`, `"fuente": "SoilGrids 2.0 (ISRIC)"`, resolución aproximada de 250 m y fecha de consulta.

### 6.3 `procesar_hls.py` — historia de la parcela (Finca Viva)

**Paso manual, lo hace una persona del equipo (documéntalo en `LEEME_scripts.md`):**

1. Entrar a NASA AppEEARS con una cuenta Earthdata.
2. Hacer un *Area Sample* con el polígono de la parcela (GeoJSON de `parcela.json`), fechas desde 2013-01-01 hasta hoy.
3. Productos: **HLSL30 v2.0** y **HLSS30 v2.0**. Capas:
   - Landsat (L30): B03 verde, B04 rojo, B05 infrarrojo cercano, B06 infrarrojo de onda corta 1, Fmask.
   - Sentinel-2 (S30): B03 verde, B04 rojo, **B8A** infrarrojo cercano, B11 infrarrojo de onda corta 1, Fmask.
4. Pedir la salida de estadísticas en CSV y guardarla en `scripts/raw/`.

**Lo que hace el script:**

1. Lee los CSV, une Landsat y Sentinel-2 en una sola serie por fecha.
2. Descarta las fechas con nubes, sombra de nube o nieve según Fmask (documenta qué bits usaste).
3. Calcula por fecha:
   - `NDVI = (NIR − Rojo) / (NIR + Rojo)`
   - `MNDWI = (Verde − SWIR1) / (Verde + SWIR1)`
4. Suaviza la serie (mediana móvil de unos 3 puntos) y la remuestrea cada 8 días sin rellenar huecos largos.
5. **Detecta ciclos de arroz:** picos de NDVI con `scipy.signal.find_peaks`, con prominencia mínima y separación mínima de unos 75 días, configurables. Un pico cuenta como ciclo de arroz si en los 20–70 días previos hubo agua (MNDWI > 0) o NDVI bajo de siembra. Guarda inicio, pico, cosecha (caída tras el pico) y valor del pico.
6. Calcula:
   - ciclos de arroz seguidos al final de la serie;
   - tendencia de los picos con una regresión simple: "bajando" si la pendiente es menor que el umbral negativo, "subiendo" si es mayor que el positivo, y "estable" en otro caso;
   - días de tierra descubierta tras cada cosecha (NDVI bajo y MNDWI < 0 hasta el siguiente inicio).
7. Escribe `data/historia.json` (forma en la sección 7) con `"etiqueta": "OBSERVADO"` en la serie y `"ESTIMADO"` en los ciclos detectados.
8. Imprime un resumen e indica si la detección es dudosa (pocos puntos válidos o ciclos irregulares). **Si es dudosa, pone `"deteccion_confiable": false`**, y la app entonces pide al agricultor que confirme o corrija (plan B).

Incluye un notebook o instrucciones para correr los tres scripts en Google Colab.

---

## 7. Formato de los datos

Crea todos los archivos con **datos de ejemplo marcados `EJEMPLO`**, para que la app funcione desde el primer día. Los scripts los reemplazan con datos reales.

### `data/config.json`
```json
{
  "app_url": "https://<usuario>.github.io/la-parcela-recuerda/",
  "thingspeak": {
    "habilitado": true,
    "canal_id": "PENDIENTE",
    "campo_ph": "field1",
    "campo_sal": "field2",
    "intervalo_ms": 15000,
    "max_antiguedad_s": 120
  },
  "idioma_por_defecto": "es"
}
```
La app lee el canal **público** de ThingSpeak **sin clave**. Si `canal_id` es `PENDIENTE`, la app no intenta conectarse y usa SoilGrids o el ejemplo.

### `data/parcela.json`
```json
{
  "etiqueta": "EJEMPLO",
  "nombre": "Parcela piloto",
  "agricultor": { "nombre": "PENDIENTE", "frase": "PENDIENTE", "foto": null, "permiso_uso": false },
  "comunidad": "Mao, Valverde",
  "centro": { "lat": 19.5517, "lon": -71.0781 },
  "poligono_geojson": { "type": "Polygon", "coordinates": [[[-71.0800, 19.5500], [-71.0760, 19.5500], [-71.0760, 19.5530], [-71.0800, 19.5530], [-71.0800, 19.5500]]] },
  "area_tareas": null,
  "cultivo_actual": "arroz",
  "plagas_repetidas": { "valor": false, "etiqueta": "EJEMPLO" }
}
```
Las coordenadas son de relleno, cerca del casco urbano de Mao. Agrégalas a `PENDIENTES.md`.

### `data/historia.json`
```json
{
  "etiqueta": "EJEMPLO",
  "fuente": "NASA HLS (Landsat + Sentinel-2) vía AppEEARS",
  "consultado": "2026-11-10",
  "deteccion_confiable": true,
  "serie": [ { "fecha": "2013-05-01", "ndvi": 0.18, "mndwi": -0.10 } ],
  "ciclos": [ { "n": 1, "inicio": "2013-06-10", "pico": "2013-08-20", "cosecha": "2013-10-05", "ndvi_pico": 0.78, "dias_descubierto_despues": 40 } ],
  "resumen": { "ciclos_arroz_seguidos": 5, "tendencia_vigor": "bajando", "pendiente_vigor_por_ciclo": -0.02, "dias_descubierto_promedio": 45 }
}
```
Para el ejemplo, genera una serie sintética creíble (ciclos de unos 4 meses, picos que bajan poco a poco, huecos por nubes) **y márcala `EJEMPLO`**.

### `data/clima.json`
```json
{
  "etiqueta": "EJEMPLO",
  "fuente": "NASA POWER",
  "lluvia_anual_mm": [ { "anio": 1981, "mm": 1000 } ],
  "promedio_1991_2010_mm": null,
  "promedio_2011_2025_mm": null,
  "lluvia_por_ciclo_mm": [ { "ciclo": 1, "mm": 400 } ],
  "humedad_superficial": { "valor": 0.35, "fecha": "2026-11-01" }
}
```

### `data/suelo.json`
```json
{
  "ph": { "valor": 7.2, "etiqueta": "EJEMPLO", "fuente": "SoilGrids 2.0 (ISRIC)", "profundidad": "0-5 cm", "consultado": null },
  "sal_dsm": { "valor": 2.0, "etiqueta": "EJEMPLO", "fuente": "Simulado hasta tener una medición" }
}
```

### `data/umbrales.json` (lo valida el profesor de Agropecuaria)
```json
{
  "pendiente_validar": true,
  "ph_muy_alto": 8.5,
  "ph_muy_bajo": 5.0,
  "sal_media_dsm": 2.0,
  "sal_alta_dsm": 4.0,
  "ciclos_arroz_muchos": 2,
  "dias_descubierto_muchos": 60,
  "anio_seco_fraccion": 0.8
}
```
`anio_seco_fraccion = 0.8` significa que un ciclo con menos del 80 % de la lluvia promedio de los ciclos se considera seco. Si `pendiente_validar` es `true`, la pantalla 3 muestra una nota pequeña: "Umbrales pendientes de validación por el profesor".

### `data/cultivos.json` (lo completa Agropecuaria)
```json
{
  "pendiente_validar": true,
  "cultivos": {
    "sorgo":      { "nombre": "Sorgo", "icono": "🌾", "familia": "gramínea", "umbral_sal_dsm": 6.8, "puntaje": { "ahorrar_agua": 3, "mejorar_suelo": 1, "proteger_rendimiento": 2 }, "beneficio": "Aguanta la sal y la sequía.", "limite": "No devuelve nitrógeno al suelo.", "fuente_umbral": "FAO, Ayers y Westcot (riego y drenaje 29) — por confirmar" },
    "caupi":      { "nombre": "Caupí (frijol de costa)", "icono": "🫘", "familia": "leguminosa", "umbral_sal_dsm": 4.9, "puntaje": { "ahorrar_agua": 3, "mejorar_suelo": 3, "proteger_rendimiento": 2 }, "beneficio": "Devuelve nitrógeno y tolera algo de sal.", "limite": "Menos conocido en la zona; confirmar mercado.", "fuente_umbral": "FAO 29 — por confirmar" },
    "habichuela": { "nombre": "Habichuela negra", "icono": "🫘", "familia": "leguminosa", "umbral_sal_dsm": 1.0, "puntaje": { "ahorrar_agua": 2, "mejorar_suelo": 3, "proteger_rendimiento": 3 }, "beneficio": "Devuelve nitrógeno y usa mucha menos agua que el arroz inundado.", "limite": "Muy sensible a la sal.", "fuente_umbral": "FAO 29 — por confirmar" },
    "gandul":     { "nombre": "Gandul", "icono": "🌱", "familia": "leguminosa", "umbral_sal_dsm": null, "puntaje": { "ahorrar_agua": 3, "mejorar_suelo": 3, "proteger_rendimiento": 2 }, "beneficio": "Devuelve nitrógeno y aguanta la sequía.", "limite": "Su tolerancia a la sal está por confirmar con el profesor.", "fuente_umbral": "PENDIENTE" },
    "cobertura":  { "nombre": "Leguminosa de cobertura", "icono": "🍀", "familia": "leguminosa", "umbral_sal_dsm": null, "puntaje": { "ahorrar_agua": 2, "mejorar_suelo": 3, "proteger_rendimiento": 1 }, "beneficio": "Tapa y protege la tierra descubierta.", "limite": "No es un cultivo para vender.", "fuente_umbral": "PENDIENTE" }
  },
  "impacto_3_temporadas": {
    "agua_ahorro_pct_rotando": { "valor": null, "fuente": null },
    "urea_ahorro_pct_rotando": { "valor": null, "fuente": null }
  }
}
```
Los umbrales de sal son aproximados y **deben** quedar marcados como por confirmar. Si `umbral_sal_dsm` es `null`, el motor no recomienda ese cultivo cuando la sal sea media o alta, y la tarjeta explica que falta el dato.

### `data/reglas.json`
Formato: una lista ordenada. Cada regla tiene `cuando` (todas las condiciones deben cumplirse), y puede `alertar`, `sumar` puntos a cultivos o `excluir` cultivos. Operadores permitidos: `>=`, `<=`, `>`, `<`, `==`, `!=`.

```json
[
  { "id": "ph_muy_alto", "tipo": "seguridad", "viene_de": "Nuevo",
    "cuando": [ { "senal": "ph", ">=": "@ph_muy_alto" } ],
    "alertar": "El pH es muy alto: puede haber exceso de sodio. Consulta a un técnico antes de sembrar cultivos delicados.",
    "excluir": ["habichuela"] },

  { "id": "sal_alta", "tipo": "cultivo", "viene_de": "CambiaCosecha",
    "cuando": [ { "senal": "sal_dsm", ">=": "@sal_alta_dsm" } ],
    "sumar": { "sorgo": 3, "caupi": 2 }, "excluir_por_umbral_sal": true,
    "razon": "Tu tierra tiene mucha sal ({sal_dsm} dS/m)." },

  { "id": "tierra_cansada", "tipo": "cultivo", "viene_de": "Finca Viva + Nuevo",
    "cuando": [ { "senal": "tendencia_vigor", "==": "bajando" }, { "senal": "ultimo_anio_seco", "==": false } ],
    "sumar": { "habichuela": 2, "caupi": 2, "gandul": 2, "cobertura": 1 },
    "razon": "La fuerza del cultivo viene bajando aunque llovió normal: señal de tierra cansada." },

  { "id": "anio_seco", "tipo": "cultivo", "viene_de": "Nuevo",
    "cuando": [ { "senal": "ultimo_anio_seco", "==": true } ],
    "sumar": { "sorgo": 2, "gandul": 1 },
    "razon": "El último ciclo fue seco; el cultivo débil probablemente fue por la sequía, no por la tierra." },

  { "id": "mucho_arroz", "tipo": "cultivo", "viene_de": "CambiaCosecha",
    "cuando": [ { "senal": "ciclos_arroz_seguidos", ">=": "@ciclos_arroz_muchos" }, { "senal": "sal_dsm", "<": "@sal_alta_dsm" } ],
    "sumar": { "habichuela": 3, "gandul": 2, "caupi": 1 },
    "razon": "Llevas {ciclos_arroz_seguidos} ciclos de arroz seguidos; una leguminosa devuelve nitrógeno al suelo." },

  { "id": "mucho_descubierto", "tipo": "cultivo", "viene_de": "CambiaCosecha + Finca Viva",
    "cuando": [ { "senal": "dias_descubierto_promedio", ">=": "@dias_descubierto_muchos" } ],
    "sumar": { "cobertura": 3 },
    "razon": "La tierra queda unos {dias_descubierto_promedio} días descubierta después de cosechar." },

  { "id": "plaga_repetida", "tipo": "cultivo", "viene_de": "Finca Viva",
    "cuando": [ { "senal": "plagas_repetidas", "==": true } ],
    "sumar": { "sorgo": 1, "caupi": 1, "gandul": 1 },
    "razon": "Has tenido plagas repetidas: cambiar de familia de cultivo rompe su ciclo." }
]
```
Los valores que empiezan con `@` se leen de `umbrales.json`. Los textos entre `{}` se reemplazan con el valor de la señal.

---

## 8. Motor de reglas

### 8.1 Funcionamiento (`js/motor.js`)

Función principal, documentada con JSDoc:

`recomendar(senales, reglas, cultivos, umbrales, prioridad) → { alertas, opciones: [opcion1, opcion2], reglasActivadas }`

1. Evalúa las reglas en orden. Si una regla tiene una señal faltante (nula), no se activa y se anota como "sin dato".
2. Las reglas `seguridad` agregan alertas y exclusiones.
3. Las reglas `cultivo` suman puntos y razones a cada cultivo.
4. `excluir_por_umbral_sal`: excluye todo cultivo con `umbral_sal_dsm` menor que la sal actual, o nulo cuando la sal sea media o alta.
5. Puntaje final = puntos de reglas + `puntaje[prioridad]` del cultivo (desempate). Ordena de mayor a menor y toma los 2 primeros que no estén excluidos.
6. Si ninguna regla de cultivo se activa, recomienda por defecto las 2 mejores leguminosas según la prioridad, con la razón "Rotar con una leguminosa después del arroz recupera nitrógeno".
7. Cada opción devuelve: cultivo, puntaje, razones (con la etiqueta de la señal que las produjo), beneficio, límite y las reglas de origen (`viene_de`).
8. El motor es una **función pura**: no toca el DOM ni la red.

### 8.2 Señales (`js/senales.js`)

| Señal | Cómo se obtiene | Etiqueta |
|---|---|---|
| `ph` | ThingSpeak si está en vivo y es reciente → `suelo.json` | SIMULADO / ESTIMADO / EJEMPLO |
| `sal_dsm` | ThingSpeak si está en vivo → `suelo.json` | SIMULADO / EJEMPLO |
| `ciclos_arroz_seguidos` | Corrección del agricultor si existe → `historia.json` | REPORTADO / ESTIMADO |
| `tendencia_vigor` | `historia.json` | ESTIMADO |
| `dias_descubierto_promedio` | `historia.json` | ESTIMADO |
| `ultimo_anio_seco` | Lluvia del último ciclo frente a `anio_seco_fraccion` × promedio de los ciclos (`clima.json`) | OBSERVADO |
| `plagas_repetidas` | `parcela.json` | REPORTADO |
| `prioridad` | Elección del usuario | REPORTADO |

En el simulador, las señales que el usuario mueve reemplazan a las reales y pasan a `SIMULADO`.

Con una parcela propia (pantalla 1, punto 6), las señales que salen de `historia.json` (`ciclos_arroz_seguidos` sin corrección, `tendencia_vigor`, `dias_descubierto_promedio`, `ultimo_anio_seco`) pasan a `SIMULADO`.

### 8.3 Pruebas (`tests/motor.test.html`)

Una página que corre casos y muestra ✔/✘. Casos mínimos:

1. Sal 6 dS/m → no recomienda habichuela; sorgo está entre las 2 opciones.
2. Sal 1, 5 ciclos de arroz, sin sequía, vigor bajando → aparece una leguminosa (habichuela, gandul o caupí).
3. pH 8.8 → hay una alerta y la habichuela queda excluida.
4. Último año seco + vigor bajando → no se activa `tierra_cansada`; sí se activa `anio_seco`.
5. Sin señales → recomendación por defecto, sin errores.
6. Cambiar la prioridad cambia el orden entre opciones empatadas.

---

## 9. Línea de tiempo (detalle)

- Chart.js en modo línea, puntos pequeños, sin relleno.
- Bandas sombreadas para cada ciclo (plugin simple propio o anotaciones dibujadas en `afterDraw`, sin plugins externos).
- Tooltip: "15 ago 2019 · fuerza del cultivo 0.74".
- En celular, por defecto muestra los últimos 5 años, con un botón "Ver desde 2013".
- Si `deteccion_confiable` es `false`, se ve un aviso: "No pudimos leer bien la historia. Confírmala o corrígela abajo" (plan B).

---

## 10. Simulación de pH y sal: Wokwi + ThingSpeak

**El flujo:** Wokwi (aparato virtual con 2 perillas) → envía cada ~16 s → ThingSpeak (buzón, canal público, `field1` = pH, `field2` = sal) → la app lo lee cada 15 s.

### 10.1 En la app (`js/thingspeak.js`)

- Lee `https://api.thingspeak.com/channels/{canal_id}/feeds/last.json`.
- Si responde y la lectura tiene menos de `max_antiguedad_s` segundos: estado "En vivo" y etiqueta `SIMULADO`.
- Si falla o la lectura es vieja: usa la última lectura guardada en `localStorage` (con su hora) o, si no hay, el valor de `suelo.json`. Estado "Sin conexión".
- Cada nueva lectura recalcula las recomendaciones de la pantalla 3, salvo que el usuario esté usando el simulador manual.
- No uses ninguna clave en la app.

### 10.2 En `wokwi/`

- `diagram.json`: un ESP32 DevKit con 2 potenciómetros (pH en GPIO34, sal en GPIO35).
- `sketch.ino`:
  - se conecta a la red `Wokwi-GUEST` (sin contraseña, canal 6);
  - lee los potenciómetros (0–4095) y los convierte en pH de 6.0 a 9.0 y sal de 0.5 a 8.0 dS/m. Los rangos van como constantes al inicio, comentadas: "ajustar alrededor del pH de SoilGrids y de los rangos del profesor";
  - envía con HTTP GET a `https://api.thingspeak.com/update?api_key=CLAVE&field1=PH&field2=SAL` cada 16 s y muestra la respuesta por el monitor serie (0 = rechazado);
  - la clave va en una constante `THINGSPEAK_WRITE_KEY = "PEGAR_AQUI"`, con un comentario que diga que debe ser de un canal solo para la demo, porque los proyectos gratuitos de Wokwi son públicos.
- `LEEME_wokwi.md`: cómo crear el proyecto en wokwi.com, pegar los dos archivos, crear el canal en ThingSpeak, poner la clave y comprobar que llegan datos.

---

## 11. Idiomas (ES/EN)

- Todos los textos de la interfaz en `data/textos.json`, con claves `es` y `en`.
- El selector cambia el idioma sin recargar y lo recuerda en `localStorage`.
- Las razones de las reglas también se traducen: agrega `razon_en` y `alertar_en` en `reglas.json`, y `beneficio_en` y `limite_en` en `cultivos.json`.

---

## 12. Diseño

### 12.1 Diseño de referencia: VERDA

La apariencia de la app se basa en el diseño **"VERDA — Sustainable Agriculture Website Design"** de Dribbble:
https://dribbble.com/shots/27805669-VERDA-Sustainable-Agriculture-Website-Design

**Antes de escribir CSS:**

1. Abre y mira **todas** las imágenes de `docs/referencia/` (capturas del diseño que puso el equipo). Si la carpeta está vacía, pide las capturas antes de diseñar; no adivines el diseño desde el nombre.
2. Escribe en `docs/referencia/NOTAS_DISENO.md` lo que observes: paleta de colores (con valores hex aproximados), tipografías y tamaños, forma de las tarjetas y botones (radios, sombras, bordes), uso de fotos o ilustraciones, espaciado, estilo del encabezado y de la navegación, e íconos.
3. Pasa esas observaciones a variables CSS en `:root` (colores, radios, sombras, espaciado, tipografía) y úsalas en todos los componentes.

**Cómo adaptarlo:**

- Toma de VERDA el **estilo visual**: paleta, tipografía, forma de tarjetas y botones, ritmo de espaciado y sensación general. No copies sus textos, su logo, su marca ni sus fotos.
- VERDA es un sitio web de presentación y esta app es una herramienta de 3 pantallas para celular: **adapta el estilo a la estructura de la sección 5**, no al revés. No agregues secciones de marketing que no estén en este documento.
- Si el diseño usa una fuente de Google Fonts, cárgala desde `fonts.googleapis.com` con un máximo de 2 familias. Si usa una fuente de pago, elige la alternativa gratuita más parecida y anótalo en `NOTAS_DISENO.md`.
- Las fotos que el diseño ponga como fondo o encabezado se reemplazan por la foto real de la parcela (cuando exista, con permiso) o por ilustraciones simples en SVG hechas por ti, nunca por fotos descargadas de internet.
- Mantén lo obligatorio de este documento aunque el diseño no lo tenga: etiquetas de origen visibles, franja de EJEMPLO, contraste suficiente, botones de al menos 44 px y modo oscuro con buen contraste.
- Para comparar, toma capturas de tu versión a 390 px y 1280 px y ponlas junto a las de referencia. Ajusta hasta que se note claramente el mismo lenguaje visual.

### 12.2 Reglas generales

- Si faltan capturas de referencia, usa por defecto: verde agrícola como color principal, acento ámbar para alertas, fondos claros cálidos, tarjetas con bordes redondeados y separación generosa.
- Define los colores como variables CSS, con versión para modo oscuro.
- Primero el celular. Ancho máximo del contenido en laptop: unos 960 px para la app.
- Etiquetas de origen como "chips" pequeños con la palabra escrita.
- Ícono y título de la app: "La parcela recuerda", con subtítulo "Qué sembrar después del arroz".
- Pie de página: "Datos: NASA POWER, NASA HLS (Landsat/Sentinel-2), SoilGrids. Equipo INPONOR · NASA Space Apps 2026", más el enlace al repositorio.
- Peso total razonable; nada de imágenes grandes.

---

## 13. Publicación en GitHub

1. Inicializa git y haz commits por fase.
2. Crea el repositorio público `la-parcela-recuerda` con `gh repo create` en la cuenta u organización que indique el equipo (si no la indican, pregunta antes de crearlo).
3. Agrega `.nojekyll` en la raíz.
4. Activa GitHub Pages desde la rama `main`, carpeta raíz. Con la CLI:
   `gh api -X POST repos/{owner}/la-parcela-recuerda/pages -f "source[branch]=main" -f "source[path]=/"`
5. Espera a que se publique, abre la URL y verifica que las 3 pantallas cargan con los datos.
6. Actualiza `config.json` → `app_url` con la URL real, y haz commit.
7. `README.md` en inglés: qué es, el problema, cómo funciona, datos NASA usados (con enlaces), qué es real, estimado y simulado, cómo correr los scripts, cómo correrla en local, el equipo y la licencia (MIT).

---

## 14. Fases de trabajo

| Fase | Entregable | Criterio para terminar |
|---|---|---|
| 1 | Estructura, `index.html`, navegación, i18n básico; leer `docs/referencia/` y escribir `NOTAS_DISENO.md` + variables CSS | Las 3 pestañas cambian, ES/EN funciona y el estilo base ya sigue la referencia |
| 2 | Archivos JSON de ejemplo + `datos.js` | La app carga todo y muestra la franja EJEMPLO |
| 3 | Motor + señales + pruebas | Las 6 pruebas pasan |
| 4 | Pantalla 3 completa (sin ThingSpeak) | Las recomendaciones cambian con la prioridad y el simulador |
| 5 | Pantalla 1 (mapa, línea de tiempo, confirmación) | La corrección del agricultor cambia la recomendación |
| 6 | Pantalla 2 + ThingSpeak con respaldo | Con `canal_id` PENDIENTE funciona sin errores; con un canal real se actualiza |
| 7 | Scripts Python + `LEEME_scripts.md` | `descargar_power.py` y `descargar_soilgrids.py` corren y escriben JSON válidos; `procesar_hls.py` funciona con un CSV de muestra que tú generes en `scripts/raw/ejemplo.csv` |
| 8 | Carpeta `wokwi/` | Archivos listos para pegar en wokwi.com |
| 9 | WhatsApp, copiar, impacto, pulido visual, accesibilidad | Revisión a 390 px y 1280 px sin errores en consola |
| 10 | GitHub + Pages + README + PENDIENTES | La URL pública funciona |

Si tienes acceso a internet, corre `descargar_power.py` y `descargar_soilgrids.py` con las coordenadas de ejemplo para que esos dos archivos tengan datos reales (con etiqueta real, no EJEMPLO) aunque la parcela final aún no esté definida, y anótalo en `PENDIENTES.md`.

---

## 15. `PENDIENTES.md` (créalo con esta lista)

| Pendiente | Quién | Dónde va |
|---|---|---|
| Coordenadas y polígono reales de la parcela | Agropecuaria | `parcela.json` |
| Nombre, frase y foto del agricultor, con permiso escrito | Agropecuaria | `parcela.json` |
| Descarga de HLS en AppEEARS | Informática 2 | `scripts/raw/` → `procesar_hls.py` |
| Volver a correr POWER y SoilGrids con las coordenadas reales | Informática 2 | `clima.json`, `suelo.json` |
| Validar umbrales, puntajes, beneficios y límites de cultivos; confirmar el gandul con sal | Profesor de Agropecuaria | `umbrales.json`, `cultivos.json` → `pendiente_validar: false` |
| Fuente para el ahorro de agua y urea al rotar | Agropecuaria | `cultivos.json` → `impacto_3_temporadas` |
| Crear el canal ThingSpeak y poner su número | Electrónica | `config.json` |
| Poner la clave de escritura en Wokwi | Electrónica | `wokwi/sketch.ino` (solo en wokwi.com, no en el repo) |
| Confirmar en las reglas oficiales de Space Apps 2026 qué se puede preparar antes | Todo el equipo | — |
| Capturas del diseño VERDA (pantalla completa y detalles) | Quien tenga el enlace | `docs/referencia/` |

---

## 16. Criterios de aceptación finales

- [ ] El estilo visual sigue la referencia VERDA (paleta, tipografía, tarjetas), adaptado a las 3 pantallas.
- [ ] Se abre desde un celular por la URL de GitHub Pages, sin registro.
- [ ] Funciona en local con `python -m http.server`.
- [ ] Las 3 pantallas muestran datos y cada número tiene su etiqueta de origen.
- [ ] La franja de EJEMPLO aparece mientras haya datos de ejemplo y desaparece cuando todos son reales.
- [ ] El simulador cambia la recomendación al instante y lo marca como SIMULADO.
- [ ] Con ThingSpeak configurado, girar la perilla de sal en Wokwi cambia la recomendación en ≤ 30 s; sin conexión, la app sigue funcionando.
- [ ] La confirmación o corrección del agricultor cambia la señal y la recomendación.
- [ ] El agricultor puede marcar su parcela en el mapa; el área se calcula en vivo, se guarda en el celular y la historia prestada aparece como SIMULADO.
- [ ] El botón de WhatsApp abre el mensaje con las dos opciones.
- [ ] ES/EN cambia todos los textos.
- [ ] Las 6 pruebas del motor pasan.
- [ ] No hay claves en el repositorio ni errores en consola.
- [ ] README en inglés y PENDIENTES.md completos.
