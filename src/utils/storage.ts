// Manejar tokens y preferencias. Es mejor tener un wrapper que maneje errores de serialización.
export const storage = {
    set: (key: string, value: any) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(key, JSON.stringify(value));
    },
    get: <T>(key: string): T | null => {
        if (typeof window === 'undefined') return null;
        const item = localStorage.getItem(key);
        try {
            return item ? JSON.parse(item) : null;
        } catch {
            return null;
        }
    },
    remove: (key: string) => localStorage.removeItem(key),
};