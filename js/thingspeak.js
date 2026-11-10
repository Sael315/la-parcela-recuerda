// Lectura del sensor simulado (se completa en la fase 6).
export function iniciarSensor(config, alCambiar) {
  alCambiar({ estado: 'sin_configurar', lectura: null });
}
