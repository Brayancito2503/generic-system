import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../api/inventory-api';
import { CreateInventoryItemDTO, InventoryItem } from '../types';
import { inventoryKeys } from './useInventoryQueries';

export const useCreateInventoryItem = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createInventoryItem,
        onSuccess: (newItem) => {
            // Invalidate list to refetch
            queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() });
        },
    });
};

export const useUpdateInventoryItem = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateInventoryItem,
        onSuccess: (updatedItem) => {
            queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: inventoryKeys.detail(updatedItem.id) });
        },
    });
};

export const useDeleteInventoryItem = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteInventoryItem,
        onSuccess: (_, deletedId) => {
            queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() });
            queryClient.removeQueries({ queryKey: inventoryKeys.detail(deletedId) });
        },
    });
};
