export abstract class AppError extends Error {
    abstract readonly code: string;
    abstract readonly userMessage: string;
    
    constructor(message: string, public cause?: Error) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class APIError extends AppError {
    readonly code = 'API_ERROR';
    
    constructor(
        message: string,
        public status: number,
        public statusText: string,
        public userMessage: string = 'An API error occurred'
    ) {
        super(message);
    }
}

export class NetworkError extends AppError {
    readonly code = 'NETWORK_ERROR';
    readonly userMessage = 'Network connection failed. Please check your internet connection.';
    
    constructor(message: string = 'Network request failed', cause?: Error) {
        super(message, cause);
    }
}

export class AuthenticationError extends AppError {
    readonly code = 'AUTH_ERROR';
    readonly userMessage = 'Invalid API key. Please check your Real-Debrid API key.';
    
    constructor(message: string = 'Authentication failed') {
        super(message);
    }
}

export class ValidationError extends AppError {
    readonly code = 'VALIDATION_ERROR';
    readonly userMessage = 'Invalid input provided.';
    
    constructor(message: string, public field?: string) {
        super(message);
    }
}

export class StorageError extends AppError {
    readonly code = 'STORAGE_ERROR';
    readonly userMessage = 'Failed to access browser storage.';
    
    constructor(message: string = 'Storage operation failed', cause?: Error) {
        super(message, cause);
    }
}

export class RateLimitError extends AppError {
    readonly code = 'RATE_LIMIT_ERROR';
    readonly userMessage = 'Too many requests. Please wait a moment before trying again.';
    
    constructor(message: string = 'Rate limit exceeded') {
        super(message);
    }
}

export function createErrorFromResponse(status: number, statusText: string, message?: string): AppError {
    const errorMessage = message || `HTTP ${status}: ${statusText}`;
    
    switch (status) {
        case 401:
            return new AuthenticationError(errorMessage);
        case 403:
            return new AuthenticationError('Access forbidden. Please check your API key permissions.');
        case 429:
            return new RateLimitError(errorMessage);
        case 404:
            return new APIError(errorMessage, status, statusText, 'Resource not found.');
        case 500:
        case 502:
        case 503:
        case 504:
            return new APIError(errorMessage, status, statusText, 'Server error. Please try again later.');
        default:
            if (status >= 400 && status < 500) {
                return new APIError(errorMessage, status, statusText, 'Client error occurred.');
            } else if (status >= 500) {
                return new APIError(errorMessage, status, statusText, 'Server error occurred.');
            }
            return new APIError(errorMessage, status, statusText);
    }
}