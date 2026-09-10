/**
 * Formatea un número a la moneda de Nicaragua (Córdoba Oro - C$).
 */
export const formatCurrency = (
    amount: number,
    locale: string = 'es-NI',
    currency: string = 'NIO'
) => {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const formatDateToLocal = (
    dateStr: string,
    locale: string = 'es-NI',
) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    };
    return new Intl.DateTimeFormat(locale, options).format(date);
};