import type { User, Torrent, UnrestrictedLink, AvailableHost } from './types';
import { createErrorFromResponse, NetworkError } from './errors';
import { API_CONFIG } from './constants';

export class RealDebridAPI {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${API_CONFIG.BASE_URL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    ...options.headers,
                },
                signal: AbortSignal.timeout(API_CONFIG.TIMEOUT),
            });

            if (!response.ok) {
                throw createErrorFromResponse(response.status, response.statusText);
            }

            return response.json() as Promise<T>;
        } catch (error) {
            if (error instanceof TypeError) {
                // Network errors (fetch failures)
                throw new NetworkError('Failed to connect to Real-Debrid API', error);
            }
            throw error;
        }
    }

    async getUserInfo(): Promise<User> {
        return this.makeRequest<User>('/user');
    }

    async getTorrents(): Promise<Torrent[]> {
        return this.makeRequest<Torrent[]>('/torrents');
    }

    async getTorrentInfo(torrentId: string): Promise<Torrent> {
        return this.makeRequest<Torrent>(`/torrents/info/${torrentId}`);
    }

    async addMagnet(magnetLink: string, host: string): Promise<{ id: string; uri: string }> {
        const formData = new URLSearchParams();
        formData.append('magnet', magnetLink);
        formData.append('host', host);

        return this.makeRequest('/torrents/addMagnet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });
    }

    async selectFiles(torrentId: string, fileIds: number[] | 'all'): Promise<void> {
        const files = Array.isArray(fileIds) ? fileIds.join(',') : fileIds;
        
        return this.makeRequest(`/torrents/selectFiles/${torrentId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `files=${files}`,
        });
    }

    async deleteTorrent(torrentId: string): Promise<void> {
        return this.makeRequest(`/torrents/delete/${torrentId}`, {
            method: 'DELETE',
        });
    }

    async getUnrestrictedLink(link: string): Promise<UnrestrictedLink> {
        const formData = new URLSearchParams();
        formData.append('link', link);

        return this.makeRequest('/unrestrict/link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });
    }

    async getAvailableHosts(): Promise<AvailableHost[]> {
        return this.makeRequest<AvailableHost[]>('/torrents/availableHosts');
    }
}