export class CacheManager {
    private static instance: CacheManager;

    private constructor() {}

    public static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }

    public async set(key: string, value: any, ttlMinutes: number): Promise<void> {
        const item = {
            value,
            timestamp: Date.now(),
            ttl: ttlMinutes * 60 * 1000 // Convert minutes to milliseconds
        };
        await chrome.storage.local.set({ [key]: item });
    }

    public async get<T>(key: string): Promise<T | null> {
        const result = await chrome.storage.local.get(key);
        const item = result[key];
        
        if (!item) return null;

        const { value, timestamp, ttl } = item;
        const now = Date.now();

        if (now - timestamp > ttl) {
            await this.clear(key);
            return null;
        }

        return value as T;
    }

    public async clear(key: string): Promise<void> {
        await chrome.storage.local.remove(key);
    }

    public async clearAll(): Promise<void> {
        await chrome.storage.local.clear();
    }
}