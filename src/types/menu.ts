// (Categorías, Productos)
export interface Category {
    categoryId: number;
    name: string;
    description?: string;
    isActive: boolean;
    imageUrl?: string;
}

export interface Product {
    productId: number;
    categoryId: number;
    name: string;
    description: string;
    price: number;
    imageUrl?: string;
    isActive: boolean;
    isAvailable: boolean;
    preparationTimeMinutes?: number;
}

export interface CreateProductCommand {
    categoryId: number;
    name: string;
    description: string;
    price: number;
    imageUrl?: string;
}