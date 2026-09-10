// (Mesas, Estados de mesa)
export enum TableStatusEnum {
    Available = 1,   // Disponible
    Occupied = 2,    // Ocupada
    Reserved = 3,    // Reservada
    Cleaning = 4,    // En limpieza
    OutOfOrder = 5,  // Fuera de servicio
    PendingPayment = 6 // Pago Pendiente
}

export interface Table {
    tableId: number;
    tableNumber: string; // String por si usan "Mesa A1"
    capacity: number;
    status: TableStatusEnum;
    locationDescription?: string; // Ej: "Terraza", "Salón Principal"
}