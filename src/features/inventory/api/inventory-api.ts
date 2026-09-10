import { apiClient } from '@/lib/api-client';
import { InventoryItem, CreateInventoryItemDTO, UpdateInventoryItemDTO, InventoryFilters } from '../types';

export const getInventoryItems = (filters?: InventoryFilters): Promise<InventoryItem[]> => {
    return apiClient.get('/inventory', { params: filters }) as unknown as Promise<InventoryItem[]>;
};

export const getInventoryItemById = (id: number): Promise<InventoryItem> => {
    return apiClient.get(`/inventory/${id}`) as unknown as Promise<InventoryItem>;
};

export const createInventoryItem = (data: CreateInventoryItemDTO): Promise<InventoryItem> => {
    return apiClient.post('/inventory', data) as unknown as Promise<InventoryItem>;
};

export const updateInventoryItem = ({ id, ...data }: UpdateInventoryItemDTO): Promise<InventoryItem> => {
    return apiClient.put(`/inventory/${id}`, data) as unknown as Promise<InventoryItem>;
};

export const deleteInventoryItem = (id: number): Promise<void> => {
    return apiClient.delete(`/inventory/${id}`) as unknown as Promise<void>;
};