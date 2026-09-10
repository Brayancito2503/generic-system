import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ProductDto } from '../types';
import { ApiResponse } from '@/types/api';

export const useGetProducts = (categoryId?: string) => {
  return useQuery({
    queryKey: ['pos', 'products', categoryId],
    queryFn: async () => {
      const response = await apiClient.get<unknown, ApiResponse<ProductDto[]>>('/products', {
        params: { categoryId }
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
