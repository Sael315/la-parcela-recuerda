# La parcela recuerda — *The plot remembers*

**What to plant after rice, and why.** A small web app for rice farmers in Mao, Valverde (Dominican Republic) that reads a plot's history from NASA satellites since 2013, NASA's historical rainfall, soil pH and salt, what the farmer remembers, and the farmer's own priority, and suggests two rotation crops, each with its reasons and limits.

- **Live app:** https://sael315.github.io/la-parcela-recuerda/
- **Engine tests:** https://sael315.github.io/la-parcela-recuerda/tests/motor.test.html
- NASA Space Apps Challenge 2026 · Santiago de los Caballeros · Challenge: **Field Shift: Adapting Farms with NASA Data** · Team INPONOR

> The app is in Spanish by default (its users are Dominican farmers), with a full English version: press **EN** at the top.

## The problem

Around Mao, many plots grow flooded rice season after season. Repeated rice drains nitrogen, keeps the soil bare between harvests, uses a lot of water, and in parts of the valley the soil is getting saltier. Farmers know rotation helps, but the hard question is *which* crop, on *this* plot, and *why*. A weak harvest can mean tired soil, or simply a dry year, and the right answer differs.

## How it works

Three screens, made for a phone with a weak connection:

1. **My plot:** the plot on a map and a timeline of crop strength (NDVI) since 2013, from NASA HLS (Landsat + Sentinel-2). Each rice cycle shows up as a numbered "mountain", with yearly rainfall underneath so dry years and weak cycles line up. The farmer confirms or corrects the history, and the correction feeds the recommendation.
2. **My soil:** pH and salt (estimated from SoilGrids, or simulated by a Wokwi device through ThingSpeak), surface soil moisture from NASA POWER, and Mao's yearly rainfall since 1981, comparing 1991–2010 with 2011–2025.
3. **What to plant:** the farmer picks a priority (save water, improve soil, protect the harvest). A small, transparent rule engine (`data/reglas.json`) suggests two crops. Each card says **why** (and which data produced each reason), **what you gain**, **its limit**, and **which rule it came from**. Safety rules raise warnings (for example, very high pH). A "What if…?" simulator recalculates instantly, and the result can be shared by WhatsApp.

The key idea of joining the two original projects (CambiaCosecha + Finca Viva): **separating drought from tired soil.** If crop strength keeps falling *while rainfall was normal*, the engine suggests legumes to rebuild the soil. If the last cycle was dry, it blames the drought instead and suggests drought-tolerant crops.

## NASA data used

| Data | What for | Link |
|---|---|---|
| **HLS v2.0** — HLSL30 (Landsat 8/9) and HLSS30 (Sentinel-2), via **AppEEARS** | NDVI (crop strength) and MNDWI (flood water) for the plot since 2013; rice cycle detection | [HLS](https://www.earthdata.nasa.gov/data/projects/hls) · [AppEEARS](https://appeears.earthdatacloud.nasa.gov/) |
| **NASA POWER** daily API (`PRECTOTCORR`, `T2M`, `GWETTOP`, community AG) | Yearly and per-cycle rainfall since 1981, surface soil moisture | [POWER](https://power.larc.nasa.gov/) |

Other data: **SoilGrids 2.0** (ISRIC) for estimated soil pH; **OpenStreetMap** base map.

## Real, estimated, simulated, example

Every number in the app carries an origin tag, always written as a word (not only a color):

| Tag | Meaning |
|---|---|
| `OBSERVADO` / OBSERVED | Seen by satellite or recorded by NASA |
| `ESTIMADO` / ESTIMATED | Calculated, or taken from a global map (SoilGrids, detected cycles) |
| `REPORTADO` / REPORTED | Said by the farmer |
| `SIMULADO` / SIMULATED | From the Wokwi sensor or the "What if…?" simulator |
| `EJEMPLO` / EXAMPLE | Placeholder until the real value exists |

While any example data is in use, a banner says so. **Current status:** rainfall and soil moisture are real NASA POWER data. The plot location, its satellite history, soil pH and salt are still example data until the team picks the pilot plot (see [`PENDIENTES.md`](PENDIENTES.md)). The app never claims a pest diagnosis, future rain, or a measurement that wasn't made.

## Run the data scripts

See [`scripts/LEEME_scripts.md`](scripts/LEEME_scripts.md) (includes Google Colab steps).

```bash
python -m pip install -r scripts/requirements.txt
python scripts/procesar_hls.py         # AppEEARS CSVs in scripts/raw/ → data/historia.json
python scripts/descargar_power.py      # → data/clima.json
python scripts/descargar_soilgrids.py  # → data/suelo.json
```

The simulated sensor (ESP32 with two knobs) is in [`wokwi/`](wokwi/LEEME_wokwi.md).

## Run it locally

No build step and no dependencies to install: plain HTML, CSS and JavaScript modules, with Leaflet 1.9.4 and Chart.js 4.4.1 from a CDN.

```bash
python -m http.server 8000
# open http://localhost:8000/  ·  tests: http://localhost:8000/tests/motor.test.html
```

## Project layout

```
index.html            app shell (3 screens, hash navigation)
css/app.css           styles and design tokens (light and dark)
js/                   app.js, datos.js, motor.js (pure rule engine), senales.js,
                      historia.js, suelo.js, decision.js, thingspeak.js, etiquetas.js, i18n.js
data/                 JSON read by the app (config, plot, history, climate, soil, crops, rules, thresholds, texts)
scripts/              Python data scripts
wokwi/                simulated pH/salt sensor
tests/motor.test.html rule engine tests (run in the browser)
```

## Team

Team **INPONOR** — NASA Space Apps Challenge 2026, Santiago de los Caballeros, Dominican Republic.

## License

[MIT](LICENSE)
