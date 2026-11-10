"""Descarga lluvia, temperatura y humedad superficial de NASA POWER y escribe data/clima.json.

Uso:
    python scripts/descargar_power.py                 # usa el centro de data/parcela.json
    python scripts/descargar_power.py --lat 19.55 --lon -71.08

No necesita clave. Los valores faltantes de POWER (-999) se guardan como nulos.
"""
import argparse
import json
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "data"
URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMETROS = "PRECTOTCORR,T2M,GWETTOP"
DIAS_MINIMOS_ANIO = 360  # un año cuenta como completo si tiene al menos estos días con dato de lluvia


def leer_json(nombre):
    ruta = DATA / nombre
    return json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else None


def descargar(lat, lon, inicio, fin, intentos=3):
    params = {
        "parameters": PARAMETROS, "community": "AG", "latitude": lat, "longitude": lon,
        "start": inicio.strftime("%Y%m%d"), "end": fin.strftime("%Y%m%d"), "format": "JSON",
    }
    for i in range(1, intentos + 1):
        try:
            r = requests.get(URL, params=params, timeout=120)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            print(f"Intento {i} de {intentos} falló: {e}")
            if i < intentos:
                time.sleep(5 * i)
    sys.exit("No se pudo descargar NASA POWER. No se escribió nada.")


def a_tabla(respuesta):
    p = respuesta["properties"]["parameter"]
    df = pd.DataFrame({k: pd.Series(v) for k, v in p.items()})
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    df = df.mask(df <= -999)  # -999 = sin dato
    return df.sort_index()


def promedio(anuales, desde, hasta):
    v = [a["mm"] for a in anuales if desde <= a["anio"] <= hasta]
    return round(sum(v) / len(v)) if v else None


def main():
    parcela = leer_json("parcela.json") or {}
    centro = parcela.get("centro", {})
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lat", type=float, default=centro.get("lat"))
    ap.add_argument("--lon", type=float, default=centro.get("lon"))
    ap.add_argument("--salida", default=str(DATA / "clima.json"))
    a = ap.parse_args()
    if a.lat is None or a.lon is None:
        sys.exit("Faltan coordenadas: usa --lat y --lon, o completa data/parcela.json.")

    hoy = date.today()
    print(f"Descargando NASA POWER para {a.lat}, {a.lon} (1981-01-01 a {hoy})…")
    df = a_tabla(descargar(a.lat, a.lon, date(1981, 1, 1), hoy))

    lluvia = df["PRECTOTCORR"]
    anuales = []
    for anio, serie in lluvia.groupby(lluvia.index.year):
        dias = int(serie.notna().sum())
        if dias >= DIAS_MINIMOS_ANIO:
            anuales.append({"anio": int(anio), "mm": round(float(serie.sum()))})
    print(f"Años completos: {anuales[0]['anio']}–{anuales[-1]['anio']} ({len(anuales)})")

    # Lluvia de cada ciclo de arroz (fechas de historia.json)
    historia = leer_json("historia.json")
    por_ciclo, etiqueta_ciclos = [], "OBSERVADO"
    if historia and historia.get("ciclos"):
        etiqueta_ciclos = "EJEMPLO" if historia.get("etiqueta") == "EJEMPLO" else "OBSERVADO"
        for c in historia["ciclos"]:
            tramo = lluvia[c["inicio"]:c["cosecha"]]
            completo = len(tramo) > 0 and tramo.notna().mean() > 0.9 and pd.Timestamp(c["cosecha"]) <= lluvia.last_valid_index()
            por_ciclo.append({"ciclo": c["n"], "mm": round(float(tramo.sum())) if completo else None})

    gw = df["GWETTOP"].dropna()
    humedad = {"valor": round(float(gw.iloc[-1]), 3), "fecha": gw.index[-1].strftime("%Y-%m-%d"), "etiqueta": "OBSERVADO"} if len(gw) else None

    salida = {
        "etiqueta": "OBSERVADO",
        "fuente": "NASA POWER",
        "consultado": hoy.isoformat(),
        "punto": {"lat": a.lat, "lon": a.lon},
        "nota": "Lluvia: PRECTOTCORR (mm/día) sumada por año; solo años completos. Humedad: GWETTOP (0 a 1, primeros 5 cm).",
        "lluvia_anual_mm": anuales,
        "promedio_1991_2010_mm": promedio(anuales, 1991, 2010),
        "promedio_2011_2025_mm": promedio(anuales, 2011, 2025),
        "lluvia_por_ciclo_etiqueta": etiqueta_ciclos,
        "lluvia_por_ciclo_mm": por_ciclo,
        "humedad_superficial": humedad,
        "temperatura_media_anual_c": [
            {"anio": int(y), "c": round(float(s.mean()), 1)} for y, s in df["T2M"].groupby(df.index.year) if s.notna().sum() >= DIAS_MINIMOS_ANIO
        ],
    }
    Path(a.salida).write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Promedio 1991–2010: {salida['promedio_1991_2010_mm']} mm · 2011–2025: {salida['promedio_2011_2025_mm']} mm")
    if humedad:
        print(f"Humedad superficial más reciente: {humedad['valor']} ({humedad['fecha']})")
    if etiqueta_ciclos == "EJEMPLO":
        print("Aviso: las fechas de los ciclos vienen de una historia de EJEMPLO; la lluvia por ciclo queda marcada EJEMPLO.")
    print(f"Escrito: {a.salida}")


if __name__ == "__main__":
    main()
