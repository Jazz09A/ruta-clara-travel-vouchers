/**
 * Diccionario de textos (FD-07).
 *
 * Los textos recurrentes y compartidos entre las dos apps viven aquí; el copy
 * puntual de una pantalla puede ir en el componente (ver nota del README de
 * desarrollo). Todo en español.
 */

export const DICCIONARIO = {
  // Acciones
  continuar: "Continuar",
  atras: "Atrás",
  siguiente: "Siguiente",
  anterior: "Anterior",
  guardar: "Guardar",
  guardar_cambios: "Guardar cambios",
  cancelar: "Cancelar",
  cerrar: "Cerrar",
  confirmar: "Confirmar",
  reintentar: "Reintentar",
  buscar: "Buscar",
  filtrar: "Filtrar",
  limpiar_filtros: "Limpiar filtros",
  aplicar: "Aplicar",
  quitar: "Quitar",
  editar: "Editar",
  eliminar: "Eliminar",
  agregar: "Agregar",
  copiar: "Copiar",
  copiado: "Copiado",
  ver_detalle: "Ver detalle",
  volver: "Volver",
  continuar_donde_vas: "Continuar donde te quedaste",
  comenzar: "Comenzar",

  // Estados
  cargando: "Cargando…",
  guardado: "Guardado",
  guardando: "Guardando…",
  sin_conexion: "Sin conexión — se guardará al reconectar",
  error_guardado: "No pudimos guardar. Reintenta",
  vacio_titulo: "Todavía no hay nada aquí",
  sin_resultados: "No encontramos resultados",
  sin_resultados_desc: "Prueba con otros filtros o términos de búsqueda.",

  // Red
  sin_conexion_titulo: "Sin conexión",
  sin_conexion_mensaje: "No pudimos conectar. Revisa tu internet; tus datos están guardados.",

  // Formulario
  opcional: "(opcional)",
  obligatorio: "Obligatorio",
  continuar_sin_guardar: "Tienes cambios sin guardar. ¿Salir de todos modos?",
  cambios_pendientes: "Tienes cambios sin guardar",

  // Público
  paso_de: "Paso",
  de_total: "de",
  tu_cupo_reservado: "Tu cupo está reservado por",
  cupo_vence_pronto: "Tu cupo vence pronto. Contacta a la agencia para conservarlo",
  verificando_pago: "Estamos verificando tu pago",
  ayuda_whatsapp: "¿Necesitas ayuda?",
  continuar_registro: "Comenzar",
  aceptar_aviso: "Acepto el aviso de privacidad",
  firmo_en_nombre: "Firmo en nombre propio y de mis acompañantes",
  desplazate: "Desplázate hasta el final para continuar",
  terminos_leidos: "He leído y acepto los términos y condiciones",
  leer_terminos: "Leer términos y condiciones",
  hora_salida_aviso: "La hora de salida se confirma en el grupo de WhatsApp",

  // Admin
  cerrar_sesion: "Cerrar sesión",
  sesion_cerrada: "Tu sesión se cerró por seguridad",
  inactividad: "¿Sigues ahí?",
  no_permiso: "No tienes permiso para esta acción",
  motivo_obligatorio: "Escribe el motivo",
  motivo_minimo: "El motivo debe tener al menos 5 caracteres",
  paso_up: "Confirma con tu código",
} as const;

export type ClaveDiccionario = keyof typeof DICCIONARIO;

/**
 * Traduce una clave del diccionario. Si la clave no existe devuelve la propia
 * clave (para que el error sea visible en desarrollo y no rompa la pantalla).
 */
export function t(clave: ClaveDiccionario): string {
  return DICCIONARIO[clave] ?? clave;
}
