// Cache keys
export const CACHE_KEYS = {
    USER_INFO: 'rd_user_info',
    TORRENTS_LIST: 'rd_torrents_list',
    AVAILABLE_HOSTS: 'rd_available_hosts',
    API_KEY: 'rdApiKey',
} as const;

// Cache TTL values (in minutes)
export const CACHE_TTL = {
    USER_INFO: 15, // 15 minutes
    TORRENTS_LIST: 2, // 2 minutes (more frequent updates for active content)
    AVAILABLE_HOSTS: 60, // 1 hour (hosts don't change often)
} as const;

// API configuration
export const API_CONFIG = {
    BASE_URL: 'https://api.real-debrid.com/rest/1.0',
    TIMEOUT: 10000, // 10 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
} as const;

// UI constants
export const UI_CONFIG = {
    NOTIFICATION_DURATION: 3000, // 3 seconds
    DEBOUNCE_DELAY: 300, // 300ms
    MAX_FILENAME_LENGTH: 50,
} as const;

// File size formatting
export const FILE_SIZE = {
    BYTES_PER_KB: 1024,
    BYTES_PER_MB: 1024 * 1024,
    BYTES_PER_GB: 1024 * 1024 * 1024,
} as const;