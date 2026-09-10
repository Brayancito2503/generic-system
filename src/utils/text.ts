/**
 * Convierte un texto a slug (ej: "Pizza de Jamón" -> "pizza-de-jamon")
 */
export const slugify = (text: string) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
};

/**
 * Acorta un texto y añade puntos suspensivos (útil para descripciones de platos)
 */
export const truncate = (text: string, length: number) => {
    return text.length > length ? `${text.substring(0, length)}...` : text;
};