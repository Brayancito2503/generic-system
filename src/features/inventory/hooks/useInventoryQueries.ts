import { useQuery } from '@tanstack/react-query';
import { getInventoryItems, getInventoryItemById } from '../api/inventory-api';
import { InventoryFilters } from '../types';

export const inventoryKeys = {
    all: ['inventory'] as const,
    lists: () => [...inventoryKeys.all, 'list'] as const,
    list: (filters: InventoryFilters) => [...inventoryKeys.lists(), { filters }] as const,
    details: () => [...inventoryKeys.all, 'detail'] as const,
    detail: (id: number) => [...inventoryKeys.details(), id] as const,
};

export const useInventoryList = (filters: InventoryFilters = {}) => {
    return useQuery({
        queryKey: inventoryKeys.list(filters),
        queryFn: () => getInventoryItems(filters),
    });
};

export const useInventoryItem = (id: number) => {
    return useQuery({
        queryKey: inventoryKeys.detail(id),
        queryFn: () => getInventoryItemById(id),
        enabled: !!id,
    });
};
