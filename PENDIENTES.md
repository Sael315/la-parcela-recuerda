# Pendientes

Datos reales que faltan y quién los da. Mientras falte alguno, la app muestra la franja "Contiene datos de ejemplo".

| Pendiente | Quién | Dónde va |
|---|---|---|
| Coordenadas y polígono reales de la parcela (las actuales son de relleno, en el casco urbano de Mao) | Agropecuaria | `data/parcela.json` |
| Nombre, frase y foto del agricultor, con permiso escrito | Agropecuaria | `data/parcela.json` (`permiso_uso: true` solo con el permiso firmado) |
| Descarga de HLS en AppEEARS | Informática 2 | `scripts/raw/` → `python scripts/procesar_hls.py` |
| Volver a correr POWER y SoilGrids con las coordenadas reales | Informática 2 | `data/clima.json`, `data/suelo.json` |
| Validar umbrales, puntajes, beneficios y límites de cultivos; confirmar el gandul con sal | Profesor de Agropecuaria | `data/umbrales.json`, `data/cultivos.json` → `pendiente_validar: false` |
| Fuente para el ahorro de agua y urea al rotar | Agropecuaria | `data/cultivos.json` → `impacto_3_temporadas` (valor **y** fuente) |
| Crear el canal ThingSpeak y poner su número | Electrónica | `data/config.json` → `thingspeak.canal_id` |
| Poner la clave de escritura en Wokwi | Electrónica | `wokwi/sketch.ino` (solo en wokwi.com, no en el repo) |
| Confirmar en las reglas oficiales de Space Apps 2026 qué se puede preparar antes | Todo el equipo | — |
| Capturas del diseño VERDA (pantalla completa y detalles) | Quien tenga el enlace | `docs/referencia/` — ✅ hay 4 capturas |

## Estado de cada archivo de datos (10 nov 2026)

| Archivo | Estado | Nota |
|---|---|---|
| `data/clima.json` | **Real** (`OBSERVADO`), NASA POWER | Descargado con las coordenadas de relleno (19.5517, −71.0781). POWER usa una cuadrícula de ~50 km, así que servirá casi igual para la parcela real, pero hay que volver a correrlo. La **lluvia por ciclo** queda `EJEMPLO` porque usa las fechas de ciclos de ejemplo. |
| `data/suelo.json` | `EJEMPLO` | SoilGrids **no tiene pH** en el punto de relleno (casco urbano, enmascarado). Con el centro real de la parcela sí debería dar valor. La sal es de ejemplo hasta tener el sensor o una medición. |
| `data/historia.json` | `EJEMPLO` | Serie sintética creíble (2013–2026, 26 ciclos de arroz, una temporada sin arroz en 2024). Se reemplaza con `procesar_hls.py`. |
| `data/parcela.json` | `EJEMPLO` | Coordenadas, polígono y agricultor de relleno. El área (≈ 221 tareas) se calcula del polígono. |
| `data/umbrales.json`, `data/cultivos.json` | Pendientes de validar | La app muestra la nota "Umbrales pendientes de validación por el profesor". Los umbrales de sal son aproximados (FAO 29) y están marcados "por confirmar". |
| `data/config.json` | `canal_id: PENDIENTE` | Sin canal, la app no intenta conectarse y usa SoilGrids o el ejemplo. |

## Para quitar la franja de ejemplo

La franja desaparece sola cuando ningún dato en uso es `EJEMPLO`: `parcela.json`, `historia.json` y `clima.json` sin `"etiqueta": "EJEMPLO"`, pH de SoilGrids (`ESTIMADO`) y sal desde el sensor simulado (`SIMULADO`) o medida.
