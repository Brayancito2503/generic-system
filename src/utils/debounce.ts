/**
 * Debounce genérico con soporte de cancelación.
 *
 * ¿Qué hace?
 * Retrasa la ejecución de una función hasta que hayan pasado
 * X milisegundos sin que vuelva a ejecutarse.
 *
 * Caso de uso típico:
 * - Búsquedas en inputs
 * - Validaciones en tiempo real
 * - Llamadas a APIs mientras el usuario escribe
 *
 * ¿Por qué usarlo con useMemo?
 * Porque si se recrea en cada render,
 * el temporizador se pierde y el debounce no funciona correctamente.
 *
 * Compatible con:
 * - Navegador
 * - Node.js
 * - Edge runtime
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number = 300
) {
  // Se usa ReturnType<typeof setTimeout>
  // para que funcione tanto en Node como en Browser.
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Función que se ejecutará de forma diferida
  const debounced = (...args: Parameters<T>) => {
    // Si ya existe un timer pendiente, lo cancelamos
    if (timer) clearTimeout(timer);

    // Creamos un nuevo temporizador
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  /**
   * Permite cancelar manualmente el debounce.
   * Útil en:
   * - useEffect cleanup
   * - Cuando el componente se desmonta
   */
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}