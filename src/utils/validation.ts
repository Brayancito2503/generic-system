/**
 * Valida si un objeto está vacío
 */
export const isEmpty = (obj: object) => {
    return Object.keys(obj).length === 0;
};

/**
 * Validador de Email profesional
 */
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Valida si el texto contiene caracteres especiales
 */
export const hasSpecialChars = (text: string): boolean => {
    const specialCharsRegex = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
    return specialCharsRegex.test(text);
};

/**
 * Valida fortaleza de contraseña:
 * Al menos 8 caracteres, una mayúscula, una minúscula y un número.
 */
export const isStrongPassword = (password: string): boolean => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    return passwordRegex.test(password);
};

/**
 * Valida si es un número de teléfono válido (ejemplo genérico)
 */
export const isValidPhone = (phone: string): boolean => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/; // Estándar E.164
    return phoneRegex.test(phone);
};

/**
 * Valida que un precio no sea negativo
 */
export const isValidPrice = (price: number): boolean => {
    return price >= 0 && !isNaN(price);
};