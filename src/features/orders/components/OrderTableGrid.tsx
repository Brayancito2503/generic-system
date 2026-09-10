import React from "react";

interface OrderTableGridProps {
    children: React.ReactNode;
}

export const OrderTableGrid: React.FC<OrderTableGridProps> = ({ children }) => {
    return (
        <div className="flex-1 p-6 pt-0">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 pb-20">
                {children}
            </div>
        </div>
    );
};
