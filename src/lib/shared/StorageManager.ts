import { StorageError } from './errors';
import { CACHE_KEYS } from './constants';
import type { CacheItem } from './types';

export class StorageManager {
    private static instance: StorageManager;
    private storage: any;

    private constructor() {
        // Try to use the standard WebExtensions API first
        if (typeof browser !== 'undefined' && browser.storage) {
            this.storage = browser.storage.local;
        }
        // Fall back to chrome API only if browser API is not available
        else if (typeof chrome !== 'undefined' && chrome.storage) {
            // Additional check for Firefox's incomplete chrome API implementation
            try {
                // Test if we can actually use chrome.storage
                const test = chrome.storage.local.get;
                if (typeof test === 'function') {
                    this.storage = chrome.storage.local;
                } else {
                    throw new Error('chrome.storage exists but is not fully implemented');
                }
            } catch (e) {
                // If we get here, we need to use the browser API
                if (typeof browser !== 'undefined') {
                    this.storage = browser.storage.local;
                } else {
                    throw new Error('No compatible storage API found');
                }
            }
        } else {
            throw new Error('No compatible storage API found');
        }
    }

    public static getInstance(): StorageManager {
        if (!StorageManager.instance) {
            StorageManager.instance = new StorageManager();
        }
        return StorageManager.instance;
    }

    private wrapStorageAPI<T>(promise: Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            promise.then(resolve).catch((error) => {
                // Handle Firefox's browser.storage promise rejection
                if (error && error.message && error.message.includes('Invalid argument')) {
                    console.warn('Storage API error:', error);
                    resolve(null as T);
                } else {
                    reject(error);
                }
            });
        });
    }

    public async set<T>(key: string, value: T, ttlMinutes: number): Promise<void> {
        const item: CacheItem<T> = {
            value,
            timestamp: Date.now(),
            ttl: ttlMinutes * 60 * 1000
        };

        try {
            await this.wrapStorageAPI(this.storage.set({ [key]: item }));
        } catch (error) {
            console.error('Storage set error:', error);
            throw new StorageError('Failed to save data to storage', error as Error);
        }
    }

    public async get<T>(key: string): Promise<T | null> {
        try {
            const result = await this.wrapStorageAPI(this.storage.get(key));
            const item = (result as Record<string, unknown>)[key];

            if (!item) {return null;}

            const { value, timestamp, ttl } = item as CacheItem<T>;
            const now = Date.now();

            if (now - timestamp > ttl) {
                await this.clear(key);
                return null;
            }

            return value as T;
        } catch (error) {
            console.error('Storage get error:', error);
            throw new StorageError('Failed to retrieve data from storage', error as Error);
        }
    }

    public async clear(key: string): Promise<void> {
        try {
            await this.wrapStorageAPI(this.storage.remove(key));
        } catch (error) {
            console.error('Storage clear error:', error);
            throw new StorageError('Failed to clear data from storage', error as Error);
        }
    }

    public async clearAll(): Promise<void> {
        try {
            await this.wrapStorageAPI(this.storage.clear());
        } catch (error) {
            console.error('Storage clearAll error:', error);
            throw new StorageError('Failed to clear all data from storage', error as Error);
        }
    }

    public async getApiKey(): Promise<string> {
        try {
            const result = await this.wrapStorageAPI(this.storage.get([CACHE_KEYS.API_KEY]));
            return (result as Record<string, string>)[CACHE_KEYS.API_KEY] || '';
        } catch (error) {
            console.error('Get API key error:', error);
            throw new StorageError('Failed to retrieve API key from storage', error as Error);
        }
    }

    public async setApiKey(apiKey: string): Promise<void> {
        try {
            await this.wrapStorageAPI(this.storage.set({ [CACHE_KEYS.API_KEY]: apiKey }));
        } catch (error) {
            console.error('Set API key error:', error);
            throw new StorageError('Failed to save API key to storage', error as Error);
        }
    }
}