export interface User {
    id: number
    username: string
    email: string
    points: number
    locale: string
    avatar: string
    type: 'premium' | 'free'
    premium: number // seconds left as premium
    expiration: string // JSON date
}

export interface TorrentFile {
    id: number
    path: string
    bytes: number
    selected: 0 | 1
}

export interface Torrent {
    id: string
    filename: string
    hash: string
    bytes: number
    host: string
    progress: number // 0-100
    status: 'downloading' | 'downloaded' | 'error' | 'virus' | 'compressing' | 'uploading' | 'dead' | 'waiting_files_selection' | 'magnet_conversion' | 'queued' | 'magnet_error'
    added: string // JSON date
    links: string[]
    files?: TorrentFile[]
}

export interface UnrestrictedLink {
    id: string
    filename: string
    mimeType: string
    filesize: number
    link: string
    host: string
    host_icon: string
    chunks: number
    crc: number
    download: string
    streamable: 0 | 1
}

export interface AvailableHost {
    host: string
    max_file_size: number
}

export interface ApiResponse<T> {
    data?: T
    error?: string
    status: number
}

export interface CacheItem<T> {
    value: T
    timestamp: number
    ttl: number
}
