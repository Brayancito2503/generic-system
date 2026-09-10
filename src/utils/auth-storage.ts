import { storage as browserStorage } from './storage';

const STORAGE_PREFIX = 'rms_';

const authStorage = {
    getToken: () => {
        return browserStorage.get<string>(`${STORAGE_PREFIX}token`);
    },
    setToken: (token: string) => {
        browserStorage.set(`${STORAGE_PREFIX}token`, token);
    },
    clearToken: () => {
        browserStorage.remove(`${STORAGE_PREFIX}token`);
    },
};

export default authStorage;
