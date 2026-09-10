import { useState, useCallback, useEffect } from "react";
import storage from "@/utils/auth-storage";
import { useRouter } from "next/navigation";

export const useAuth = () => {
    const router = useRouter();
    const [token, setToken] = useState<string | null>(storage.getToken());

    // useEffect(() => {
    //     // Sync token from storage on mount/change
    //     setToken(storage.getToken());
    // }, []);

    const login = useCallback((newToken: string) => {
        storage.setToken(newToken);
        setToken(newToken);
    }, []);

    const logout = useCallback(() => {
        storage.clearToken();
        setToken(null);
        router.push("/login");
    }, [router]);

    return {
        isAuthenticated: !!token,
        token,
        login,
        logout,
    };
};
