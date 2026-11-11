"""Consulta el pH estimado del suelo en SoilGrids 2.0 (ISRIC) y escribe data/suelo.json.

Uso:
    python scripts/descargar_soilgrids.py                  # usa el centro de data/parcela.json
    python scripts/descargar_soilgrids.py --lat 19.55 --lon -71.08

SoilGrids guarda el pH multiplicado por 10: aquí se divide entre 10.
Hace una sola consulta (con reintentos). Si falla, no escribe nada.
La sal (sal_dsm) no viene de SoilGrids: se conserva la que ya tenga suelo.json.
"""
import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "data"
URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROFUNDIDADES = ["0-5cm", "5-15cm"]


def leer_json(nombre):
    ruta = DATA / nombre
    return json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else None


def consultar(lat, lon, intentos=4):
    params = [("lon", lon), ("lat", lat), ("property", "phh2o")] + [("depth", d) for d in PROFUNDIDADES] + [("value", "mean")]
    for i in range(1, intentos + 1):
        try:
            r = requests.get(URL, params=params, timeout=60)
            if r.status_code == 429:
                raise requests.RequestException("demasiadas consultas (429)")
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            print(f"Intento {i} de {intentos} falló: {e}")
            if i < intentos:
                time.sleep(10 * i)
    sys.exit("No se pudo consultar SoilGrids (el servicio a veces está caído o limita las consultas). No se escribió nada.")


def main():
    parcela = leer_json("parcela.json") or {}
    centro = parcela.get("centro", {})
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lat", type=float, default=centro.get("lat"))
    ap.add_argument("--lon", type=float, default=centro.get("lon"))
    ap.add_argument("--salida", default=str(DATA / "suelo.json"))
    a = ap.parse_args()
    if a.lat is None or a.lon is None:
        sys.exit("Faltan coordenadas: usa --lat y --lon, o completa data/parcela.json.")

    print(f"Consultando SoilGrids para {a.lat}, {a.lon}…")
    respuesta = consultar(a.lat, a.lon)
    try:
        capa = next(l for l in respuesta["properties"]["layers"] if l["name"] == "phh2o")
    except (KeyError, StopIteration):
        sys.exit("La respuesta de SoilGrids no trae la capa phh2o. No se escribió nada.")

    valores = {}
    for d in capa["depths"]:
        media = d["values"].get("mean")
        if media is not None:
            valores[d["label"].replace(" ", "")] = round(media / 10, 1)
    if "0-5cm" not in valores:
        sys.exit("SoilGrids no tiene pH para este punto (puede ser zona urbana o agua). Prueba con las coordenadas de la parcela. No se escribió nada.")

    hoy = date.today().isoformat()
    anterior = leer_json("suelo.json") or {}
    salida = {
        "ph": {
            "valor": valores["0-5cm"], "etiqueta": "ESTIMADO", "fuente": "SoilGrids 2.0 (ISRIC)",
            "profundidad": "0-5 cm", "resolucion_m": 250, "consultado": hoy,
            "punto": {"lat": a.lat, "lon": a.lon},
            "por_profundidad": [
                {"profundidad": p.replace("cm", " cm").replace("-", "-"), "valor": valores.get(p), "etiqueta": "ESTIMADO"} for p in PROFUNDIDADES
            ],
        },
        "sal_dsm": anterior.get("sal_dsm") or {"valor": 2.0, "etiqueta": "EJEMPLO", "fuente": "Simulado hasta tener una medición", "fuente_en": "Simulated until there is a field measurement"},
    }
    Path(a.salida).write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"pH 0-5 cm: {valores.get('0-5cm')} · 5-15 cm: {valores.get('5-15cm')} (ESTIMADO, ~250 m)")
    print(f"Escrito: {a.salida}")


if __name__ == "__main__":
    main()
