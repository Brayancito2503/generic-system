import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { CreateOrderCommand, POSOrderDto } from '../types';
import { ApiResponse } from '@/types/api';

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (command: CreateOrderCommand) => {
      const response = await apiClient.post<unknown, ApiResponse<POSOrderDto>>('/orders', command);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos', 'orders'] });
    },
  });
};
