# Scripts de datos

Los tres scripts escriben en `data/`. La app **nunca** llama a la NASA ni a SoilGrids en vivo: solo lee esos JSON.

| Script | Qué hace | Escribe | Necesita cuenta |
|---|---|---|---|
| `descargar_power.py` | Lluvia, temperatura y humedad superficial diarias de NASA POWER desde 1981 | `data/clima.json` | No |
| `descargar_soilgrids.py` | pH estimado del suelo (0–5 y 5–15 cm) de SoilGrids 2.0 | `data/suelo.json` | No |
| `procesar_hls.py` | Historia de la parcela desde 2013 con imágenes HLS (Landsat + Sentinel-2) | `data/historia.json` | Sí, Earthdata (para descargar de AppEEARS) |

Orden recomendado: **1)** `procesar_hls.py` (define las fechas de los ciclos) → **2)** `descargar_power.py` (calcula la lluvia de cada ciclo) → **3)** `descargar_soilgrids.py`.

Todos toman las coordenadas de `data/parcela.json` (`centro`). Cuando la parcela real esté definida, pon allí su centro y su polígono, y vuelve a correr los tres.

## Instalar

```bash
python -m pip install -r scripts/requirements.txt
```

## 1. NASA POWER (lluvia y humedad)

```bash
python scripts/descargar_power.py
```

- Endpoint: `https://power.larc.nasa.gov/api/temporal/daily/point`, `community=AG`, parámetros `PRECTOTCORR`, `T2M` y `GWETTOP`, desde 1981-01-01 hasta hoy.
- Los valores −999 (sin dato) se tratan como nulos. Un año cuenta solo si tiene al menos 360 días con lluvia registrada (el año en curso queda fuera).
- Calcula la lluvia total por año, los promedios de 1991–2010 y 2011–2025, la lluvia de cada ciclo de arroz (con las fechas de `historia.json`) y el último valor de `GWETTOP`.
- Si `historia.json` todavía es de ejemplo, la lluvia por ciclo queda marcada `EJEMPLO`.
- Ojo: POWER es una cuadrícula de unos 50 km que sale de modelos y satélites. Sirve para comparar años, no para medir la lluvia exacta de una parcela.

## 2. SoilGrids (pH estimado)

```bash
python scripts/descargar_soilgrids.py
```

- Endpoint: `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=…&lat=…&property=phh2o&depth=0-5cm&depth=5-15cm&value=mean`.
- SoilGrids guarda el pH **multiplicado por 10**: el script lo divide entre 10.
- Hace una sola consulta con reintentos y espera entre intentos. Si falla, **no escribe nada** y explica el error.
- Si el punto cae en zona urbana o en agua, SoilGrids no da valor (pasa con las coordenadas de relleno, que están en el casco urbano de Mao). Usa el centro real de la parcela.
- La sal **no** viene de SoilGrids: el script conserva el `sal_dsm` que ya tenga `suelo.json`.

## 3. HLS desde AppEEARS (historia de la parcela)

### Paso manual (lo hace una persona del equipo)

1. Crea una cuenta gratis en [NASA Earthdata](https://urs.earthdata.nasa.gov/) y entra a [AppEEARS](https://appeears.earthdatacloud.nasa.gov/).
2. Ve a **Extract → Area Sample → Start a new request**.
3. Polígono: copia el `poligono_geojson` de `data/parcela.json` dentro de un archivo `.geojson` (un `Feature` con esa geometría) y súbelo, o dibuja la parcela en el mapa.
4. Fechas: desde **2013-01-01** hasta hoy.
5. Productos y capas:
   - **HLSL30 v2.0** (Landsat): `B03` verde, `B04` rojo, `B05` infrarrojo cercano, `B06` infrarrojo de onda corta 1, `Fmask`.
   - **HLSS30 v2.0** (Sentinel-2): `B03` verde, `B04` rojo, **`B8A`** infrarrojo cercano, `B11` infrarrojo de onda corta 1, `Fmask`.
6. Salida: formato **GeoTIFF** y proyección geográfica (da igual para este uso). Envía la solicitud y espera el correo (puede tardar horas).
7. Descarga los archivos **`*-Statistics.csv`** (y `*-Statistics-QA.csv` si viene aparte) y guárdalos en `scripts/raw/`.

### Correr el script

```bash
python scripts/procesar_hls.py
```

Qué hace:

1. Lee todos los CSV de `scripts/raw/` (salvo `ejemplo.csv`) y une Landsat y Sentinel-2 en una sola serie por fecha.
2. Quita las fechas con **nube (bit 1), junto a nube o sombra (bit 2), sombra de nube (bit 3) o nieve/hielo (bit 4)** según la mediana de `Fmask` de la parcela. Los cirros (bit 0) y el agua (bit 5) no se descartan, porque el agua de la inundación del arroz es justo lo que se busca.
3. Calcula `NDVI = (NIR − Rojo) / (NIR + Rojo)` y `MNDWI = (Verde − SWIR1) / (Verde + SWIR1)`.
4. Suaviza con una mediana móvil de 3 puntos y remuestrea cada 8 días sin rellenar huecos de más de 24 días.
5. Busca picos de NDVI (`scipy.signal.find_peaks`, prominencia 0.20 y separación de 75 días, configurables con `--prominencia` y `--separacion-dias`). Un pico es **arroz** si en los 20–70 días antes se vio agua (MNDWI > 0). Si las nubes taparon toda esa ventana, acepta un NDVI bajo de siembra (< 0.30).
6. Calcula los ciclos de arroz seguidos al final, la tendencia de los picos (regresión simple: "bajando" si baja más de 0.01 por ciclo, "subiendo" si sube más de 0.01, "estable" en otro caso) y los días de tierra descubierta tras cada cosecha (NDVI < 0.30 y MNDWI < 0).
7. Escribe `data/historia.json`: la serie como `OBSERVADO` y los ciclos detectados como `ESTIMADO`.
8. Si hay pocos puntos válidos, fechas muy separadas, ciclos irregulares o muchos ciclos sin agua visible, pone `"deteccion_confiable": false`. Entonces la app avisa y le pide al agricultor que confirme o corrija (plan B).

Si los nombres de las columnas o de las capas de AppEEARS no coinciden, ajusta el diccionario `CAPAS` al inicio del script.

### Probar sin AppEEARS

```bash
python scripts/procesar_hls.py --crear-ejemplo
python scripts/procesar_hls.py --entrada scripts/raw/ejemplo.csv --ejemplo --salida prueba_historia.json
```

`ejemplo.csv` se genera a partir de la serie sintética de ejemplo, con el mismo formato que AppEEARS y con algunas fechas nubladas que el script debe quitar. Con `--ejemplo` la salida queda marcada `EJEMPLO`. Usa `--salida` para no pisar `data/historia.json`.

## En Google Colab

Abre un cuaderno nuevo en [colab.research.google.com](https://colab.research.google.com/) y corre estas celdas:

```python
!git clone https://github.com/Sael315/la-parcela-recuerda.git
%cd la-parcela-recuerda
!pip install -q -r scripts/requirements.txt
```

```python
# 1. Sube los CSV de AppEEARS a scripts/raw/ (panel de archivos a la izquierda) y luego:
!python scripts/procesar_hls.py
# 2. Lluvia y humedad
!python scripts/descargar_power.py
# 3. pH
!python scripts/descargar_soilgrids.py
```

```python
# Descarga los JSON nuevos para subirlos al repositorio
from google.colab import files
for f in ["historia", "clima", "suelo"]:
    files.download(f"data/{f}.json")
```

Después, sube los tres JSON a `data/` en GitHub (o haz commit desde tu computadora). GitHub Pages publica los cambios solo.
