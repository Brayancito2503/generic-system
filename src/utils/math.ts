/**
 * Calcula el IVA de un monto
 */
export const calculateTax = (amount: number, taxRate: number = 0.15) => {
    return amount * taxRate;
};

/**
 * Calcula el total con propina sugerida
 */
export const calculateTotalWithTip = (amount: number, tipPercentage: number) => {
    return amount + (amount * (tipPercentage / 100));
};

/**
 * Suma los subtotales de un array de productos
 */
export const calculateOrderTotal = <T extends { price: number; quantity: number }>(items: T[]) => {
    return items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
};