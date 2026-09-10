export interface InventoryItem {
    id: number;
    name: string;
    sku: string;
    quantity: number;
    minStock: number;
    category: string;
    updatedAt: string;
}

export interface CreateInventoryItemDTO {
    name: string;
    sku: string;
    quantity: number;
    minStock: number;
    category: string;
}

export interface UpdateInventoryItemDTO extends Partial<CreateInventoryItemDTO> {
    id: number;
}

export interface InventoryFilters {
    category?: string;
    lowStock?: boolean;
}
