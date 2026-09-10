export const storage = {
    get: <T>(key: string): T | null => {
        if (typeof window === 'undefined') return null;
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    },
    set: (key: string, value: unknown) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(value));
        }
    },
    remove: (key: string) => localStorage.removeItem(key),
};