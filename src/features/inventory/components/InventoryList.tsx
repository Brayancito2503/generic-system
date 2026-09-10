'use client';

import { useInventoryList } from '../hooks/useInventoryQueries';
import { useDeleteInventoryItem } from '../hooks/useInventoryMutations';

export const InventoryList = () => {
    const { data: items, isLoading, error } = useInventoryList();
    const deleteItem = useDeleteInventoryItem();

    if (isLoading) return <div>Loading inventory...</div>;
    if (error) return <div>Error loading inventory</div>;

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Inventory</h2>
            <div className="grid gap-4">
                {items?.map((item) => (
                    <div key={item.id} className="flex justify-between p-4 border rounded shadow-sm">
                        <div>
                            <h3 className="font-semibold">{item.name}</h3>
                            <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-mono text-lg">{item.quantity} units</span>
                            <button
                                onClick={() => deleteItem.mutate(item.id)}
                                className="text-red-500 hover:underline"
                                disabled={deleteItem.isPending}
                            >
                                {deleteItem.isPending ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
