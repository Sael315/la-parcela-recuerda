// La parcela recuerda — sensor simulado de pH y sal (Wokwi + ESP32)
//
// Dos perillas (potenciómetros) simulan un medidor de pH y uno de sal del suelo.
// Cada 16 s envía los dos valores a ThingSpeak, y la app los lee desde el canal público.
//
// ⚠️ La clave de escritura va SOLO en wokwi.com, nunca en el repositorio.
//    Los proyectos gratuitos de Wokwi son públicos: usa un canal de ThingSpeak
//    creado solo para esta demo, sin otros datos.

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ---------- Configuración ----------
const char* THINGSPEAK_WRITE_KEY = "HDKL0DBBGVJB9T8G";  // clave de escritura (Write API Key) del canal de demo

const char* WIFI_RED = "Wokwi-GUEST";  // red simulada de Wokwi, sin contraseña
const char* WIFI_CLAVE = "";
const int WIFI_CANAL = 6;

const int PIN_PH = 34;   // perilla de pH
const int PIN_SAL = 35;  // perilla de sal

// Rangos de las perillas. Ajustar alrededor del pH de SoilGrids y de los rangos del profesor.
const float PH_MIN = 6.0;
const float PH_MAX = 9.0;
const float SAL_MIN = 0.5;   // dS/m
const float SAL_MAX = 8.0;   // dS/m

const unsigned long INTERVALO_MS = 16000;  // ThingSpeak gratuito acepta 1 envío cada 15 s

// ---------- Programa ----------
unsigned long ultimoEnvio = 0;

float leerEscala(int pin, float minimo, float maximo) {
  int crudo = analogRead(pin);  // 0–4095
  return minimo + (maximo - minimo) * (crudo / 4095.0);
}

void conectarWifi() {
  Serial.print("Conectando a ");
  Serial.print(WIFI_RED);
  WiFi.begin(WIFI_RED, WIFI_CLAVE, WIFI_CANAL);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.println(" listo");
}

void enviar(float ph, float sal) {
  if (WiFi.status() != WL_CONNECTED) conectarWifi();

  WiFiClientSecure cliente;
  cliente.setInsecure();  // demo: no se valida el certificado
  HTTPClient http;

  String url = "https://api.thingspeak.com/update?api_key=";
  url += THINGSPEAK_WRITE_KEY;
  url += "&field1=" + String(ph, 2);
  url += "&field2=" + String(sal, 2);

  http.begin(cliente, url);
  int codigo = http.GET();
  String respuesta = http.getString();
  http.end();

  Serial.printf("pH %.2f · sal %.2f dS/m → HTTP %d, respuesta: %s", ph, sal, codigo, respuesta.c_str());
  if (respuesta == "0") Serial.print("  (0 = rechazado: revisa la clave o espera 15 s entre envíos)");
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  conectarWifi();
}

void loop() {
  if (ultimoEnvio == 0 || millis() - ultimoEnvio >= INTERVALO_MS) {
    ultimoEnvio = millis();
    enviar(leerEscala(PIN_PH, PH_MIN, PH_MAX), leerEscala(PIN_SAL, SAL_MIN, SAL_MAX));
  }
  delay(100);
}
