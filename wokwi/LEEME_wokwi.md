# Sensor simulado: Wokwi + ThingSpeak

**Flujo:** Wokwi (un ESP32 virtual con 2 perillas) → envía cada 16 s → ThingSpeak (un "buzón" en internet, canal público: `field1` = pH, `field2` = sal) → la app lo lee cada 15 s.

Todo es **simulado**: la app lo muestra con la etiqueta `SIMULADO`. Sirve para mostrar en la demo cómo cambiaría la recomendación si un sensor real midiera la parcela.

## 1. Crear el canal en ThingSpeak

1. Crea una cuenta gratis en [thingspeak.mathworks.com](https://thingspeak.mathworks.com/).
2. **Channels → My Channels → New Channel**.
   - Name: `La parcela recuerda (demo)`.
   - Field 1: `pH`. Field 2: `Sal dS/m`. Marca solo esos dos.
   - Guarda.
3. En **Sharing**, elige **Share channel view with everyone** (canal público). La app lee el canal sin clave.
4. Anota el **Channel ID** (el número que aparece arriba).
5. En **API Keys**, copia la **Write API Key**. Esta clave **no** se sube al repositorio.

> Usa un canal solo para esta demo. Los proyectos gratuitos de Wokwi son públicos y cualquiera podría ver la clave de escritura.

## 2. Crear el proyecto en Wokwi

1. Entra a [wokwi.com](https://wokwi.com/) e inicia sesión.
2. **New Project → ESP32** (Arduino).
3. Reemplaza el contenido de `sketch.ino` con el de [`sketch.ino`](sketch.ino).
4. Abre la pestaña `diagram.json` y reemplázala con [`diagram.json`](diagram.json). Debes ver el ESP32 con dos perillas: pH en el pin 34 y sal en el pin 35.
5. En `sketch.ino`, cambia `THINGSPEAK_WRITE_KEY = "PEGAR_AQUI"` por tu Write API Key. **Hazlo solo en wokwi.com.**
6. Si hace falta, ajusta los rangos al inicio del archivo (`PH_MIN`, `PH_MAX`, `SAL_MIN`, `SAL_MAX`) alrededor del pH de SoilGrids y de los rangos que dé el profesor.
7. Pulsa ▶ (Start simulation).

## 3. Comprobar que llegan datos

1. En el **monitor serie** de Wokwi debe aparecer cada 16 s una línea como:
   `pH 7.45 · sal 3.10 dS/m → HTTP 200, respuesta: 12`
   - Un número mayor que 0 es el número de entrada guardada: todo bien.
   - `0` = rechazado: revisa la clave o espera 15 s entre envíos (límite del plan gratis).
2. En ThingSpeak, en **Private View** o **Public View**, deben aparecer puntos en las dos gráficas.
3. Prueba la lectura pública en el navegador (cambia `123456` por tu Channel ID):
   `https://api.thingspeak.com/channels/123456/feeds/last.json`

## 4. Conectar la app

1. En `data/config.json`, cambia `"canal_id": "PENDIENTE"` por tu Channel ID (como texto, por ejemplo `"123456"`).
2. Haz commit y espera a que GitHub Pages se actualice.
3. Abre la pantalla **2. Mi suelo**: debe decir "En vivo · última lectura hace N s". Gira la perilla de sal en Wokwi: en menos de 30 s cambian la tarjeta de sal y la recomendación de la pantalla 3.
4. Si paras la simulación, después de 2 minutos (`max_antiguedad_s`) la app pasa a "Sin conexión" y muestra la última lectura guardada en el celular.
