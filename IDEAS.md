# Ideas para después

Cosas que parecen útiles pero quedan fuera del alcance de la especificación de esta versión.

- **Alerta en vivo (Finca Viva):** avisar al agricultor cuando la fuerza del cultivo de la temporada actual cae por debajo de lo normal para esa etapa. Es el siguiente paso natural después de la historia de la parcela.
- **Recordar la prioridad elegida** en el celular, igual que el idioma y la confirmación.
- **Varias parcelas:** elegir entre las parcelas de una cooperativa o de una comunidad.
- **Funcionar sin conexión** (service worker) para el campo con poca señal.
- **Leer la foto real de la parcela** en el hero cuando exista, con permiso.
- **Sensor real de pH y conductividad** en vez del simulado, con la misma ruta ThingSpeak → app.
- **Descarga automática de HLS** con la API de AppEEARS (requiere guardar credenciales fuera del repositorio).
- **Comparar con parcelas vecinas** para separar mejor un año malo de la zona de un problema de la parcela.
- **Elegir mi parcela en el mapa:** ✅ construida la versión sin backend (ver abajo). Pendiente: la versión con Supabase.

---

## Diseño: "Elegir mi parcela" en el mapa

> Estado: **versión sin backend construida** (aprobada por el equipo y agregada a `CLAUDE.md`, pantalla 1, punto 6). Código en `js/parcela.js` y `js/historia.js`.
> Diferencia con este diseño: **no hay lista de comunidades** (`comunidades.json`), para no inventar coordenadas. En su lugar hay "Usar mi ubicación" (GPS) e "Ir a Mao". Se puede agregar cuando Agropecuaria dé las coordenadas de cada comunidad.
> La versión con Supabase (abajo) sigue siendo solo una propuesta.

### Qué problema resuelve

Hoy la parcela es fija: sus coordenadas y su contorno están escritos a mano en `data/parcela.json`. Con esta función, el agricultor (o el técnico que lo acompaña) marca su propia parcela tocando el mapa, y la app se adapta a ella.

### Dónde va

**Pestaña 1 — Mi parcela, sección "Dónde está tu parcela"** (el mapa). No hace falta una pestaña nueva: la app sigue teniendo 3 pantallas.

```
┌─ Pestaña 1: Mi parcela ───────────────────────────┐
│ Portada (dibujo)  ← la parcela resaltada toma     │
│                     la forma real del contorno    │
│ ┌─ Dónde está tu parcela ───────────────────────┐ │
│ │  [mapa]                                       │ │
│ │  [ Cambiar mi parcela ]   ← botón nuevo       │ │
│ └───────────────────────────────────────────────┘ │
│ Fuerza del cultivo desde 2013 …                   │
└───────────────────────────────────────────────────┘
```

### Cómo se usa (paso a paso)

1. **"Cambiar mi parcela"** → el mapa entra en modo edición: crece a pantalla completa en celular y aparece una barra de herramientas abajo.
2. **Ubicarse**, de una de estas formas:
   - **"Usar mi ubicación"**: el GPS del celular centra el mapa donde está parado el agricultor. Pide permiso; si lo niega, sigue a mano.
   - **Elegir la comunidad** en una lista fija (Mao, Guayacanes, Jaibón, Ámina, Hatillo Palma…), con coordenadas guardadas en `data/comunidades.json`, sin buscar en internet.
   - Mover el mapa con el dedo.
3. **Marcar las esquinas:** cada toque pone un punto, y la app une los puntos con una línea. Botones:
   - **"Deshacer punto"**
   - **"Cerrar parcela"** (se activa con 3 puntos o más)
   - **"Cancelar"** (vuelve a la parcela anterior)
4. **Revisión en vivo** mientras marca:
   - área calculada en **tareas y hectáreas**, que se actualiza con cada punto;
   - avisos sin bloquear: "El contorno se cruza consigo mismo", "La parcela parece muy grande (más de 2,000 tareas)", "Esta parcela está lejos de Valverde: los datos de lluvia guardados son de Mao".
5. **"Guardar mi parcela"**: se guarda en el celular (`localStorage`, clave `lpr.parcela_propia`) como GeoJSON, con la etiqueta **REPORTADO**.
6. Al guardar, cambian al instante:
   - el **mapa**, centrado en el contorno nuevo;
   - la **ficha de la portada**: área nueva (REPORTADO) y nombre "Mi parcela";
   - el **dibujo de la portada**: la parcela resaltada toma la forma real del contorno;
   - el **texto de WhatsApp**: incluye el área.
7. **"Volver a la parcela piloto"** borra la parcela propia y regresa a `parcela.json`.

### Cómo funcionaría la simulación (lo importante)

La especificación prohíbe llamar a la NASA o a SoilGrids en vivo desde la app, y la historia del satélite tarda horas en prepararse (AppEEARS). Por eso, **al cambiar de parcela no todo puede ser real al instante**. La app debe decirlo claramente:

| Dato | ¿Qué pasa al elegir una parcela nueva? | Etiqueta |
|---|---|---|
| Contorno, centro, área | Real, al instante (lo marcó el agricultor) | REPORTADO |
| Lluvia por año (NASA POWER) | Se mantiene si la parcela está a menos de ~25 km del punto de `clima.json` (la cuadrícula de POWER mide ~50 km). Si está más lejos, aviso. | OBSERVADO |
| Humedad del suelo (POWER) | Igual que la lluvia | OBSERVADO |
| **Historia del satélite** (fuerza del cultivo, ciclos) | **No existe todavía para esa parcela.** Se muestra la historia de ejemplo con una franja: "Tu parcela todavía no tiene historia del satélite. Estás viendo un ejemplo." | **SIMULADO** |
| Ciclos de arroz seguidos | El agricultor puede escribirlos con "¿Esta historia es correcta?" → No. Así la recomendación usa su dato real. | REPORTADO |
| pH (SoilGrids) | Se mantiene el valor guardado, con el aviso "pH de otra ubicación" | ESTIMADO + aviso |
| Sal | Igual que hoy: sensor simulado o ejemplo | SIMULADO / EJEMPLO |

**Resultado:** con una parcela nueva, la recomendación usa lo que dijo el agricultor (REPORTADO), la lluvia real de la zona (OBSERVADO) y una historia simulada, todo con su etiqueta. Así la demostración funciona en cualquier punto de Mao sin inventar datos.

**Botón "Pedir la historia real de esta parcela"** (el puente hacia los datos reales, sin backend):
1. Descarga el archivo `mi_parcela.geojson`, listo para subirlo a AppEEARS.
2. Muestra las coordenadas para copiarlas en los scripts (`--lat`, `--lon`).
3. El equipo corre `procesar_hls.py`, `descargar_power.py` y `descargar_soilgrids.py`, y hace commit de los JSON.
4. La próxima vez que se abra la app, la historia es real (OBSERVADO / ESTIMADO).

### Versión futura con backend (Supabase)

Para que funcione solo, sin que el equipo corra scripts:

```
Agricultor marca la parcela
        │
        ▼
Supabase: tabla "parcelas"        ← guarda contorno y estado
        │  (dispara un trabajo)
        ▼
Trabajador (GitHub Actions o un servidor pequeño en Python)
  1. Pide HLS a la API de AppEEARS con la clave de Earthdata (guardada como secreto)
  2. Espera (minutos u horas) y procesa con procesar_hls.py
  3. Baja POWER y SoilGrids (segundos)
  4. Guarda historia, clima y suelo en Supabase
        │
        ▼
La app muestra el estado: "Pedido enviado" → "Procesando (puede tardar horas)" → "Lista"
```

Esto sí necesita cuentas de usuario, reglas de quién ve qué parcela (RLS de Supabase) y guardar credenciales de Earthdata de forma segura. Es el paso de demo a piloto real.

### Qué habría que cambiar en el código (versión sin backend)

| Archivo | Cambio |
|---|---|
| `CLAUDE.md` | Agregar la función a la sección 5 (pantalla 1) |
| `js/historia.js` | Botón, modo edición del mapa (clics de Leaflet, sin plugins), cálculo de área en vivo, dibujo de la portada con el contorno real |
| `js/app.js` | Estado `parcela`: primero `lpr.parcela_propia`, si no `parcela.json`; acciones guardar y borrar |
| `js/senales.js` | Si la parcela es propia y la historia es de otra, marcar las señales de la historia como SIMULADO |
| `js/datos.js` | Leer `comunidades.json` |
| `data/comunidades.json` | Lista fija de comunidades de Valverde con sus coordenadas |
| `data/textos.json` | Textos nuevos en ES y EN |
| `css/app.css` | Barra de herramientas del mapa, mapa a pantalla completa en celular (botones de 44 px) |
| `tests/motor.test.html` | Caso nuevo: con parcela propia, la historia queda SIMULADO |

Esfuerzo estimado: 1 día de trabajo para la versión sin backend.
