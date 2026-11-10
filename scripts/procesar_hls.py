"""Procesa las estadísticas HLS (Landsat + Sentinel-2) descargadas de NASA AppEEARS y escribe data/historia.json.

Pasos: une L30 y S30 por fecha, quita nubes/sombras/nieve con Fmask, calcula NDVI y MNDWI,
suaviza, remuestrea cada 8 días, detecta ciclos de arroz y resume la historia de la parcela.

Uso:
    python scripts/procesar_hls.py                          # lee scripts/raw/*.csv
    python scripts/procesar_hls.py --entrada scripts/raw/ejemplo.csv --ejemplo
    python scripts/procesar_hls.py --crear-ejemplo          # genera scripts/raw/ejemplo.csv para probar

Formato de entrada (salida "Statistics" de un Area Sample de AppEEARS):
    columnas Dataset, Date y Mean (y Median para Fmask). El nombre de la capa (B03, B04, B05, B8A,
    B06, B11, Fmask) y el producto (HLSL30 o HLSS30) se reconocen en la columna Dataset o en el
    nombre del archivo. Si AppEEARS cambia los nombres, ajusta CAPAS más abajo.

Ciclo de arroz: un pico de NDVI cuenta como arroz si en los 20–70 días antes del pico se vio agua
(MNDWI > 0 en alguna fecha sin nubes). Si las nubes taparon toda esa ventana, se acepta un NDVI bajo
de siembra (< 0.30) como señal, y si eso pasa en muchos ciclos la detección se marca como dudosa.

Fmask (HLS v2.0) — bits que se descartan:
    bit 1 = nube, bit 2 = junto a nube o sombra, bit 3 = sombra de nube, bit 4 = nieve/hielo.
    (bit 0 = cirros y bit 5 = agua no se descartan: el agua de inundación del arroz es justo lo que buscamos.)
    Como la estadística de área da un solo valor por fecha, se usa la mediana de Fmask de la parcela.
"""
import argparse
import json
import math
import random
import re
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.signal import find_peaks

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "data"
RAW = Path(__file__).resolve().parent / "raw"

# Capas por producto: qué banda es cada color
CAPAS = {
    "HLSL30": {"B03": "verde", "B04": "rojo", "B05": "nir", "B06": "swir1", "Fmask": "fmask"},
    "HLSS30": {"B03": "verde", "B04": "rojo", "B8A": "nir", "B11": "swir1", "Fmask": "fmask"},
}
BITS_DESCARTE = (1, 2, 3, 4)

# Parámetros de detección (configurables por línea de comandos)
PASO_DIAS = 8
HUECO_MAX_PASOS = 3            # no se rellenan huecos de más de 3 × 8 = 24 días
PROMINENCIA = 0.20
SEPARACION_DIAS = 75
NDVI_SIEMBRA = 0.30            # "NDVI bajo de siembra"
VENTANA_AGUA = (20, 70)        # días antes del pico donde se busca agua o NDVI bajo
NDVI_DESCUBIERTO = 0.30
HUECO_MAX_SEGUIDOS = 150       # días entre una cosecha y la siguiente siembra para contar "seguidos"
UMBRAL_TENDENCIA = 0.01        # NDVI por ciclo


def leer_csvs(rutas):
    filas = []
    for ruta in rutas:
        df = pd.read_csv(ruta)
        if not {"Dataset", "Date", "Mean"} <= set(df.columns):
            sys.exit(f"{ruta.name}: faltan las columnas Dataset, Date o Mean.")
        texto_archivo = ruta.name.upper()
        for _, f in df.iterrows():
            dataset = str(f["Dataset"])
            producto = next((p for p in CAPAS if p in dataset.upper() or p in texto_archivo), None)
            if not producto:
                continue
            capa = next((c for c in CAPAS[producto] if re.search(rf"(^|[_\-\s]){c}($|[_\-\s])", dataset, re.I)), None)
            if not capa:
                continue
            valor = f["Median"] if capa == "Fmask" and "Median" in df.columns else f["Mean"]
            filas.append({"fecha": pd.to_datetime(f["Date"]).normalize(), "producto": producto, "banda": CAPAS[producto][capa], "valor": valor})
    if not filas:
        sys.exit("No se reconoció ninguna capa HLS en los CSV.")
    largo = pd.DataFrame(filas)
    ancho = largo.pivot_table(index=["fecha", "producto"], columns="banda", values="valor", aggfunc="mean").reset_index()
    return ancho


def limpiar(df):
    total = len(df)
    if "fmask" in df:
        fm = df["fmask"].fillna(0).round().astype(int).to_numpy()
        malo = np.zeros(len(df), dtype=bool)
        for b in BITS_DESCARTE:
            malo |= ((fm >> b) & 1) == 1
        df = df[~malo].copy()
    df = df.dropna(subset=["rojo", "nir", "verde", "swir1"])
    df["ndvi"] = (df["nir"] - df["rojo"]) / (df["nir"] + df["rojo"])
    df["mndwi"] = (df["verde"] - df["swir1"]) / (df["verde"] + df["swir1"])
    df = df[df["ndvi"].between(-1, 1) & df["mndwi"].between(-1, 1)]
    # Una fecha con Landsat y Sentinel-2: promedio de los dos
    serie = df.groupby("fecha")[["ndvi", "mndwi"]].mean().sort_index()
    print(f"Fechas: {total} con datos, {len(serie)} válidas tras quitar nubes/sombras/nieve.")
    return serie


def remuestrear(serie):
    suave = serie.rolling(3, center=True, min_periods=1).median()
    rejilla = pd.date_range(suave.index.min(), suave.index.max(), freq=f"{PASO_DIAS}D")
    unida = suave.reindex(suave.index.union(rejilla)).interpolate(method="time", limit=HUECO_MAX_PASOS, limit_area="inside")
    return suave, unida.reindex(rejilla)


def es_arroz(obs, fecha_pico):
    """Arroz si en los 20–70 días antes del pico se vio agua (MNDWI > 0).
    Si las nubes taparon esa ventana (ninguna observación), basta con NDVI bajo de siembra en la serie remuestreada."""
    ventana = obs[(obs.index >= fecha_pico - pd.Timedelta(days=VENTANA_AGUA[1])) & (obs.index <= fecha_pico - pd.Timedelta(days=VENTANA_AGUA[0]))]
    if len(ventana):
        return bool((ventana["mndwi"] > 0).any()), False
    return None, True


def detectar_ciclos(r, obs):
    ndvi = r["ndvi"].to_numpy()
    validos = ~np.isnan(ndvi)
    picos, props = find_peaks(np.where(validos, ndvi, 0), prominence=PROMINENCIA, distance=max(1, SEPARACION_DIAS // PASO_DIAS))
    fechas = r.index
    ciclos = []
    for i in picos:
        if not validos[i]:
            continue
        fp = fechas[i]
        arroz, sin_observar = es_arroz(obs, fp)
        if sin_observar:
            ventana = r[(r.index >= fp - pd.Timedelta(days=VENTANA_AGUA[1])) & (r.index <= fp - pd.Timedelta(days=VENTANA_AGUA[0]))]
            arroz = bool((ventana["ndvi"] < NDVI_SIEMBRA).any())
        # inicio: punto más bajo en los 100 días antes del pico
        antes = r["ndvi"][(r.index >= fp - pd.Timedelta(days=100)) & (r.index < fp)].dropna()
        inicio = antes.idxmin() if len(antes) else fp
        # cosecha: primera caída por debajo de la mitad entre pico y base, en los 90 días después
        despues = r["ndvi"][(r.index > fp) & (r.index <= fp + pd.Timedelta(days=90))].dropna()
        base = antes.min() if len(antes) else NDVI_SIEMBRA
        corte = base + 0.5 * (ndvi[i] - base)
        bajo = despues[despues < corte]
        cosecha = bajo.index[0] if len(bajo) else (despues.index[-1] if len(despues) else fp)
        ciclos.append({"inicio": inicio, "pico": fp, "cosecha": cosecha, "ndvi_pico": round(float(ndvi[i]), 3), "arroz": arroz, "sin_observar": sin_observar})
    return ciclos


def dias_descubierto(r, desde, hasta):
    tramo = r[(r.index > desde) & (r.index < hasta)]
    if tramo.empty:
        return 0
    descubierto = (tramo["ndvi"] < NDVI_DESCUBIERTO) & (tramo["mndwi"] < 0)
    return int(descubierto.sum() * PASO_DIAS)


def resumir(r, todos):
    arroz = [c for c in todos if c["arroz"]]
    for k, c in enumerate(todos):
        sig = todos[k + 1] if k + 1 < len(todos) else None
        c["sig"] = sig
    # seguidos al final: ciclos de arroz consecutivos sin hueco largo ni ciclo de otro cultivo
    seguidos = 0
    for c in reversed(todos):
        if not c["arroz"]:
            break
        if seguidos and (c["sig"]["inicio"] - c["cosecha"]).days > HUECO_MAX_SEGUIDOS:
            break
        seguidos += 1
    salida = []
    for n, c in enumerate(arroz, start=1):
        sig = c["sig"]
        dias = dias_descubierto(r, c["cosecha"], sig["inicio"]) if sig and sig["arroz"] and (sig["inicio"] - c["cosecha"]).days <= HUECO_MAX_SEGUIDOS else None
        salida.append({"n": n, "inicio": c["inicio"].strftime("%Y-%m-%d"), "pico": c["pico"].strftime("%Y-%m-%d"),
                       "cosecha": c["cosecha"].strftime("%Y-%m-%d"), "ndvi_pico": c["ndvi_pico"], "dias_descubierto_despues": dias})
    ultimos = arroz[-max(3, seguidos):] if len(arroz) >= 2 else arroz
    pendiente = float(np.polyfit(range(len(ultimos)), [c["ndvi_pico"] for c in ultimos], 1)[0]) if len(ultimos) >= 2 else 0.0
    tendencia = "bajando" if pendiente < -UMBRAL_TENDENCIA else "subiendo" if pendiente > UMBRAL_TENDENCIA else "estable"
    dias_validos = [c["dias_descubierto_despues"] for c in salida if c["dias_descubierto_despues"] is not None]
    resumen = {"ciclos_arroz_seguidos": seguidos, "tendencia_vigor": tendencia, "pendiente_vigor_por_ciclo": round(pendiente, 3),
               "dias_descubierto_promedio": round(sum(dias_validos) / len(dias_validos)) if dias_validos else None}
    return salida, resumen


def confiable(serie, ciclos):
    motivos = []
    if len(serie) < 40:
        motivos.append(f"pocos puntos válidos ({len(serie)})")
    huecos = serie.index.to_series().diff().dt.days.dropna()
    if len(huecos) and huecos.median() > 32:
        motivos.append(f"fechas muy separadas (mediana {huecos.median():.0f} días)")
    if len(ciclos) < 2:
        motivos.append("menos de 2 ciclos de arroz")
    else:
        inicios = pd.Series([pd.Timestamp(c["inicio"]) for c in ciclos])
        sep = inicios.diff().dt.days.dropna()
        if len(sep) > 2 and sep.std() / sep.mean() > 0.6:
            motivos.append("ciclos irregulares")
    return not motivos, motivos


def crear_ejemplo(destino):
    """Crea un CSV con el formato de AppEEARS a partir de la serie de ejemplo de data/historia.json."""
    historia = json.loads((DATA / "historia.json").read_text(encoding="utf-8"))
    if historia.get("etiqueta") != "EJEMPLO":
        sys.exit("data/historia.json ya no es de ejemplo; no se crea ejemplo.csv a partir de datos reales.")
    random.seed(3)
    filas = []
    for p in historia["serie"]:
        producto = random.choice(["HLSL30", "HLSS30"])
        nir_banda = "B05" if producto == "HLSL30" else "B8A"
        swir_banda = "B06" if producto == "HLSL30" else "B11"
        rojo = 0.06 + random.uniform(-0.005, 0.005)
        ndvi, mndwi = p["ndvi"], p["mndwi"]
        nir = rojo * (1 + ndvi) / (1 - ndvi)
        verde = 0.08
        swir = verde * (1 - mndwi) / (1 + mndwi)
        fmask = 64  # aerosol bajo, sin nube
        if random.random() < 0.12:  # nubes que el script debe quitar
            fmask, nir = 2 | 64, rojo * 1.1
        for banda, v in (("B03", verde), ("B04", rojo), (nir_banda, nir), (swir_banda, swir), ("Fmask", fmask)):
            filas.append({"File Name": f"{producto}.v2.0_{banda}", "Dataset": f"{producto}_020_{banda}", "aid": "aid0001",
                          "Date": p["fecha"], "Count": 140, "Mean": round(v, 5), "Median": round(v, 5)})
    destino.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(filas).to_csv(destino, index=False)
    print(f"Escrito: {destino} ({len(filas)} filas)")


def main():
    global PROMINENCIA, SEPARACION_DIAS
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--entrada", nargs="*", help="CSV de AppEEARS (por defecto, scripts/raw/*.csv)")
    ap.add_argument("--salida", default=str(DATA / "historia.json"))
    ap.add_argument("--prominencia", type=float, default=PROMINENCIA)
    ap.add_argument("--separacion-dias", type=int, default=SEPARACION_DIAS)
    ap.add_argument("--ejemplo", action="store_true", help="marca la salida como EJEMPLO (para el CSV de muestra)")
    ap.add_argument("--crear-ejemplo", action="store_true", help="genera scripts/raw/ejemplo.csv y termina")
    a = ap.parse_args()
    PROMINENCIA, SEPARACION_DIAS = a.prominencia, a.separacion_dias

    if a.crear_ejemplo:
        crear_ejemplo(RAW / "ejemplo.csv")
        return

    rutas = [Path(p) for p in a.entrada] if a.entrada else sorted(RAW.glob("*.csv"))
    if not a.entrada:
        rutas = [p for p in rutas if p.name != "ejemplo.csv"] or rutas
    if not rutas:
        sys.exit("No hay CSV en scripts/raw/. Descárgalos de AppEEARS (ver LEEME_scripts.md).")
    print("Leyendo:", ", ".join(p.name for p in rutas))

    serie = limpiar(leer_csvs(rutas))
    suave, r = remuestrear(serie)
    todos = detectar_ciclos(r, serie)
    ciclos, resumen = resumir(r, todos)
    ok, motivos = confiable(serie, ciclos)
    n_sin_agua = sum(1 for c in todos if c["sin_observar"])
    if n_sin_agua > len(todos) / 3:
        ok = False
        motivos.append(f"en {n_sin_agua} ciclos las nubes no dejaron ver si hubo agua")

    etiqueta_serie = "EJEMPLO" if a.ejemplo else "OBSERVADO"
    salida = {
        "etiqueta": "EJEMPLO" if a.ejemplo else "OBSERVADO",
        "etiqueta_ciclos": "EJEMPLO" if a.ejemplo else "ESTIMADO",
        "fuente": "NASA HLS (Landsat + Sentinel-2) vía AppEEARS",
        "consultado": date.today().isoformat(),
        "deteccion_confiable": ok,
        "motivos_duda": motivos,
        "parametros": {"prominencia": PROMINENCIA, "separacion_dias": SEPARACION_DIAS, "bits_fmask_descartados": list(BITS_DESCARTE)},
        "serie": [{"fecha": f.strftime("%Y-%m-%d"), "ndvi": round(float(v.ndvi), 3), "mndwi": round(float(v.mndwi), 3), "etiqueta": etiqueta_serie}
                  for f, v in suave.iterrows()],
        "ciclos": ciclos,
        "resumen": resumen,
    }
    Path(a.salida).write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"Ciclos detectados: {len(todos)} ({len(ciclos)} de arroz)")
    print(f"Ciclos de arroz seguidos al final: {resumen['ciclos_arroz_seguidos']}")
    print(f"Tendencia de la fuerza del cultivo: {resumen['tendencia_vigor']} ({resumen['pendiente_vigor_por_ciclo']} por ciclo)")
    print(f"Días de tierra descubierta (promedio): {resumen['dias_descubierto_promedio']}")
    if ok:
        print("Detección: confiable.")
    else:
        print("Detección DUDOSA: " + "; ".join(motivos) + ". La app pedirá al agricultor que confirme o corrija.")
    print(f"Escrito: {a.salida}")


if __name__ == "__main__":
    main()
