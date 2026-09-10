'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Aquí podrías enviar el error a un servicio de logging (ej. Sentry)
        console.error('Error capturado:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">¡Ups! Algo salió mal</h2>
            <p className="text-gray-600 mb-6 max-w-md">
                Ha ocurrido un error inesperado en la aplicación. No te preocupes, esto ha sido reportado.
            </p>
            <div className="flex gap-4">
                <Button onClick={() => reset()}>
                    Intentar de nuevo
                </Button>
                <Button onClick={() => window.location.href = '/'}>
                    Ir al inicio
                </Button>
            </div>
        </div>
    );
}