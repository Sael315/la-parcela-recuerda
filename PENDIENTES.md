# Pendientes

La app está completa. Lo que falta son **datos reales** y la validación del profesor. Mientras falte alguno, la app muestra la franja "Contiene datos de ejemplo".

## Datos reales que faltan

| Pendiente | Quién | Dónde va |
|---|---|---|
| Coordenadas y polígono reales de la parcela piloto (los actuales son de relleno, en el casco urbano de Mao) | Agropecuaria | `data/parcela.json`. También se puede marcar en la app con "Cambiar mi parcela" → "Descargar mi_parcela.geojson" y copiar el polígono. |
| Nombre, frase y foto del agricultor, con permiso escrito | Agropecuaria | `data/parcela.json` (`permiso_uso: true` solo con el permiso firmado) |
| Descarga de HLS en AppEEARS | Informática 2 | `scripts/raw/` → `python scripts/procesar_hls.py` (revisar juntos la primera corrida: los nombres de columnas de AppEEARS pueden variar) |
| Volver a correr POWER y SoilGrids con las coordenadas reales | Informática 2 | `data/clima.json`, `data/suelo.json` |
| Validar umbrales, puntajes, beneficios y límites de cultivos; confirmar el gandul con sal | Profesor de Agropecuaria | `data/umbrales.json`, `data/cultivos.json` → `pendiente_validar: false` |
| Fuente para el ahorro de agua y urea al rotar | Agropecuaria | `data/cultivos.json` → `impacto_3_temporadas` (valor **y** fuente) |
| Coordenadas de las comunidades de Valverde (opcional, para una lista en "Cambiar mi parcela") | Agropecuaria | `IDEAS.md` |
| Confirmar en las reglas oficiales de Space Apps 2026 qué se puede preparar antes | Todo el equipo | — |

## Ya hecho

| Tarea | Estado |
|---|---|
| Capturas del diseño VERDA | ✅ 4 capturas en `docs/referencia/` |
| Canal de ThingSpeak | ✅ Canal público **3573977** en `data/config.json`; la app lo lee |
| Clave de escritura en Wokwi | ✅ Puesta solo en wokwi.com (la clave anterior quedó en el historial de GitHub y fue reemplazada) |
| "Elegir mi parcela" en el mapa | ✅ Versión sin backend publicada |

## Antes de la demo

- **Wokwi:** desde la red de casa no conecta (bloqueo hacia `netwi.wokwi.com`). Probar con datos del celular y en la red del evento. Respaldo: enviar una lectura a mano con `https://api.thingspeak.com/update?api_key=CLAVE&field1=PH&field2=SAL`, esperando 15 s entre envíos.
- **Última lectura del sensor:** la app usa la última lectura de ThingSpeak como "guardada" aunque tenga horas. Hoy es pH 7.8 y sal 6.0, así que recomienda solo sorgo. Para mostrar el caso de "tierra cansada" (leguminosas), enviar antes una lectura con sal baja, por ejemplo `field2=1.5`.
- **No mostrar la clave** en pantalla ni en capturas (barra de direcciones, `sketch.ino` de Wokwi).

## Estado de cada archivo de datos

| Archivo | Estado | Nota |
|---|---|---|
| `data/clima.json` | **Real** (`OBSERVADO`), NASA POWER | Descargado con las coordenadas de relleno (19.5517, −71.0781). POWER usa una cuadrícula de ~50 km, así que servirá casi igual para la parcela real, pero hay que volver a correrlo. La **lluvia por ciclo** queda `EJEMPLO` porque usa las fechas de ciclos de ejemplo. |
| `data/suelo.json` | `EJEMPLO` | SoilGrids **no tiene pH** en el punto de relleno (casco urbano, enmascarado). Con el centro real de la parcela sí debería dar valor. La sal es de ejemplo hasta tener el sensor o una medición. |
| `data/historia.json` | `EJEMPLO` | Serie sintética creíble (2013–2026, 26 ciclos de arroz, una temporada sin arroz en 2024). Se reemplaza con `procesar_hls.py`. |
| `data/parcela.json` | `EJEMPLO` | Coordenadas, polígono y agricultor de relleno. El área (≈ 221 tareas) se calcula del polígono. |
| `data/umbrales.json`, `data/cultivos.json` | Pendientes de validar | La app muestra la nota "Umbrales pendientes de validación por el profesor". Los umbrales de sal son aproximados (FAO 29) y están marcados "por confirmar". |
| `data/config.json` | ✅ Listo | Canal de ThingSpeak 3573977 |

## Para quitar la franja de ejemplo

La franja desaparece sola cuando ningún dato en uso es `EJEMPLO`: `parcela.json`, `historia.json` y `clima.json` sin `"etiqueta": "EJEMPLO"`, pH de SoilGrids (`ESTIMADO`) y sal desde el sensor simulado (`SIMULADO`) o medida.
