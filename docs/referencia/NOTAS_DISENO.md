# Notas de diseño — referencia VERDA

Observado en las 4 capturas de `docs/referencia/` (Dribbble, "VERDA — Sustainable Agriculture Website Design", de Flowscale). Solo se toma el **lenguaje visual**; no se copian textos, logo, marca ni fotos.

## Paleta (hex aproximados)

| Uso en VERDA | Hex aprox. | Variable en `app.css` |
|---|---|---|
| Verde de botones y de las palabras destacadas | `#5B8A3A` | `--verde` |
| Verde más oscuro (hover, texto verde sobre blanco) | `#3F6B26` | `--verde-oscuro` |
| Follaje de las fotos aéreas (fondo del hero) | `#1E3318` → `#2F4A22` | `--monte-1`, `--monte-2` |
| Verde claro de las terrazas iluminadas | `#9DBA4E` | `--brote` |
| Fondo blanco principal | `#FFFFFF` | `--fondo` |
| Fondo gris cálido de secciones ("About us") | `#F6F6F3` | `--fondo-suave` |
| Fondo de tarjetas (approach, FAQ, testimonios) | `#F3F3F0` | `--tarjeta` |
| Texto principal (casi negro, levemente verdoso) | `#171A15` | `--tinta` |
| Texto secundario | `#5E625B` | `--tinta-suave` |
| Bordes finos | `#E4E4DF` | `--borde` |

No hay un segundo color de acento: todo el color viene del verde y de la fotografía. Para las alertas (que VERDA no tiene) se agrega ámbar, como pide la especificación.

## Tipografía

- Una sola familia, sans geométrica de terminaciones suaves: muy parecida a **Plus Jakarta Sans** (gratis en Google Fonts). Se usa solo esa familia.
- Titulares grandes en peso **ligero/regular (300–400)**, interletrado algo cerrado (≈ −0.02 em), interlineado apretado (≈ 1.1). Ejemplo: "Growing a better future, together."
- Las cifras de impacto ("34%", "12,500+") van grandes y en peso ligero, con una etiqueta diminuta debajo.
- Texto de cuerpo pequeño (13–14 px en la captura), gris, interlineado cómodo.
- Etiquetas de sección ("ABOUT US", "FAQ") en mayúsculas, 9–10 px, peso medio, dentro de una píldora blanca o gris clara.

## Forma de los componentes

- **Barra de navegación:** píldora blanca flotante (radio ≈ 10–12 px) sobre el hero, logo a la izquierda, enlaces centrados en texto pequeño gris (el activo en verde) y botón verde en píldora a la derecha.
- **Botones:** píldora completa (`border-radius: 999px`), fondo verde, texto blanco pequeño, flecha al final. Botones de carrusel: círculos verdes.
- **Tarjetas:** fondo gris muy claro, **sin sombra**, sin borde o con borde muy fino, radio ≈ 8–10 px. Íconos de línea fina verdes arriba a la izquierda, título mediano y texto gris pequeño.
- **Hero:** foto aérea a todo el ancho (radio ≈ 12 px en las esquinas del bloque) con una tarjeta pequeña translúcida encima ("Harvest 2026"), titular blanco ligero a la izquierda y un texto corto con botón abajo a la derecha.
- **FAQ:** acordeón de filas grises separadas por espacio, con "−" a la derecha.
- **Pie:** tarjeta blanca grande flotando sobre una foto de campo, con columnas de enlaces pequeños.

## Fotos e ilustraciones

VERDA se apoya en fotos aéreas de terrazas y campos. Aquí **no se usan fotos descargadas**: el hero se reemplaza por una **ilustración SVG propia de parcelas de arroz vistas desde arriba** (polígonos verdes con bordes claros de los muros de las parcelas y un canal), con la parcela del usuario resaltada. Cuando exista una foto real de la parcela con permiso, puede reemplazarla.

## Espaciado y ritmo

- Mucho aire: secciones con 64–96 px arriba y abajo en escritorio, cuadrícula ancha con columnas generosas.
- Las secciones alternan entre blanco y gris cálido.
- Disposición asimétrica: etiqueta de sección a la izquierda y titular grande a la derecha.

## Íconos

De línea, trazo de ≈ 1.5 px, verdes, sin relleno (gráfico, bombilla, escudo, manos). Aquí se dibujan como SVG en línea.

## Cómo se adapta a la app (3 pantallas, primero el celular)

- La navegación flotante blanca se mantiene arriba en laptop. En celular las pestañas pasan a una barra fija abajo, con el mismo estilo de píldora.
- Solo la pantalla 1 tiene un hero grande (la ilustración aérea es el único elemento llamativo). Las pantallas 2 y 3 abren con la composición de "About us": píldora a la izquierda y titular ligero.
- Las cifras (ciclos de arroz, pH, sal, humedad) usan el estilo de las cifras de impacto de VERDA, pero cada una lleva su **etiqueta de origen** (OBSERVADO, ESTIMADO, REPORTADO, SIMULADO, EJEMPLO) como píldora con la palabra escrita.
- El simulador "¿Qué pasaría si…?" usa el estilo del acordeón FAQ.
- Lo que VERDA no tiene y la especificación exige: franja de EJEMPLO, cajas de alerta ámbar, botones de al menos 44 px, foco visible y modo oscuro (paleta de monte nocturno: fondo `#11170F`, tarjetas `#1A2317`, verde `#8DBE62`).
- Fuente: Plus Jakarta Sans, cargada desde Google Fonts. No es de pago, así que no hace falta alternativa.
