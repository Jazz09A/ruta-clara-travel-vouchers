/**
 * Reglas del onboarding (primer arranque).
 *
 * Separadas del componente para poder verificarlas sin montar la pantalla:
 * son las reglas que el cliente y el backend aplican por igual (contraseña
 * de 10 caracteres mínimo, correo válido, nombre de agencia obligatorio).
 */

export interface FormularioInstalacion {
  nombre: string;
  correo: string;
  password: string;
  confirmar: string;
  agenciaNombre: string;
  agenciaEmail: string;
  agenciaWhatsapp: string;
  agenciaDireccion: string;
  agenciaZona: string;
}

export const FORMULARIO_VACIO: FormularioInstalacion = {
  nombre: "",
  correo: "",
  password: "",
  confirmar: "",
  agenciaNombre: "",
  agenciaEmail: "",
  agenciaWhatsapp: "",
  agenciaDireccion: "",
  agenciaZona: "America/Caracas",
};

/** Longitud mínima de la contraseña (la misma que exige el backend). */
export const MIN_PASSWORD = 10;

export type ErroresInstalacion = Partial<Record<keyof FormularioInstalacion, string>>;

/** Expresión mínima de correo: no es un validador RFC, sólo descarta correos mal formados. */
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reglas de la contraseña, para mostrarlas mientras se escribe. */
export function reglasPassword(password: string): Array<{ texto: string; cumple: boolean }> {
  return [
    { texto: `Mínimo ${MIN_PASSWORD} caracteres`, cumple: password.length >= MIN_PASSWORD },
    { texto: "Una letra", cumple: /[a-zA-Z]/.test(password) },
    { texto: "Un número", cumple: /\d/.test(password) },
  ];
}

/** Valida el paso 1: la cuenta del administrador. */
export function validarCuenta(form: FormularioInstalacion): ErroresInstalacion {
  const errores: ErroresInstalacion = {};

  if (form.nombre.trim().length < 2) {
    errores.nombre = "Escribe tu nombre completo.";
  }
  if (!CORREO_VALIDO.test(form.correo.trim())) {
    errores.correo = "Escribe un correo válido.";
  }
  if (form.password.length < MIN_PASSWORD) {
    errores.password = `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`;
  }
  if (form.confirmar !== form.password) {
    errores.confirmar = "Las contraseñas no coinciden.";
  }

  return errores;
}

/** Valida el paso 2: los datos de la agencia. */
export function validarAgencia(form: FormularioInstalacion): ErroresInstalacion {
  const errores: ErroresInstalacion = {};

  if (form.agenciaNombre.trim().length < 2) {
    errores.agenciaNombre = "Escribe el nombre de tu agencia.";
  }
  if (form.agenciaEmail.trim() && !CORREO_VALIDO.test(form.agenciaEmail.trim())) {
    errores.agenciaEmail = "Escribe un correo válido.";
  }

  return errores;
}
