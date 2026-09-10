// Enum para los estados del pedido
export enum OrderStatus {
    Pending = 'PENDING',
    New = 'NEW',
    InProgress = 'IN_PROGRESS',
    Ready = 'READY',
}

// Interfaz para los items dentro de un pedido
export interface KitchenOrderItem {
    id: string;
    name: string;
    quantity: number;
    notes?: string;
    completed?: boolean;
}

// Interfaz para un pedido completo en la cocina
export interface KitchenOrder {
    id: string;
    tableNumber: string;
    waiterName: string;
    ticketNumber: string;
    timeElapsed: string; // Podría ser una cadena localizada o una fecha real en una aplicación real
    status: OrderStatus;
    items: KitchenOrderItem[];
}
