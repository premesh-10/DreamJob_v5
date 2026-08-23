import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { storageConfig } from '../config/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.join(__dirname, '..');

const toAbsolute = (relativePath) => path.join(backendRoot, relativePath);
const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

// Local-disk storage provider. Designed so a future `s3` provider can be
// swapped in via STORAGE_PROVIDER without changing any call site — every
// caller deals only in storage-relative path strings, never raw fs paths.
//
// `baseDir` defaults to the recordings dir on every method below so every
// pre-existing call site (built for recordings) is unaffected — new
// callers (course videos/PDFs/thumbnails/resources) pass
// `{ baseDir: storageConfig.uploadsDir }` to route through the same
// abstraction without disturbing the recording flows.
const localProvider = {
    async save(buffer, { folder = '', filename, baseDir = storageConfig.recordingsDir }) {
        const dir = path.join(backendRoot, baseDir, folder);
        ensureDir(dir);
        const fullPath = path.join(dir, filename);
        await fs.promises.writeFile(fullPath, buffer);
        return path.join(baseDir, folder, filename).replace(/\\/g, '/');
    },

    // Used to pull LiveKit Cloud Egress output (which must target S3/GCS/Azure)
    // down into local disk so recordings still live behind our own storage
    // abstraction rather than a raw third-party URL.
    async saveFromUrl(remoteUrl, { folder = '', filename, baseDir = storageConfig.recordingsDir }) {
        const dir = path.join(backendRoot, baseDir, folder);
        ensureDir(dir);
        const fullPath = path.join(dir, filename);
        const relativePath = path.join(baseDir, folder, filename).replace(/\\/g, '/');
        return new Promise((resolve, reject) => {
            const client = remoteUrl.startsWith('https') ? https : http;
            client.get(remoteUrl, (response) => {
                if (response.statusCode && response.statusCode >= 400) {
                    reject(new Error(`Failed to download recording (status ${response.statusCode})`));
                    return;
                }
                const fileStream = fs.createWriteStream(fullPath);
                response.pipe(fileStream);
                fileStream.on('finish', () => { fileStream.close(); resolve(relativePath); });
                fileStream.on('error', reject);
            }).on('error', reject);
        });
    },

    async delete(relativePath) {
        if (!relativePath) return;
        const fullPath = toAbsolute(relativePath);
        if (fs.existsSync(fullPath)) await fs.promises.unlink(fullPath);
    },

    exists(relativePath) {
        return !!relativePath && fs.existsSync(toAbsolute(relativePath));
    },

    getStat(relativePath) {
        return fs.statSync(toAbsolute(relativePath));
    },

    getReadStream(relativePath, options) {
        return fs.createReadStream(toAbsolute(relativePath), options);
    },

    // Seam for a future CDN-backed implementation to return a signed/CDN URL
    // instead — local impl just normalizes to the existing /uploads/... path
    // the static-serving middleware in server.js already serves.
    getPublicUrl(relativePath) {
        if (!relativePath) return '';
        return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    },
};

function loadProvider() {
    if (storageConfig.provider === 's3') {
        throw new Error('S3 storage provider not implemented yet. Set STORAGE_PROVIDER=local in .env.');
    }
    return localProvider;
}

export const storageProvider = loadProvider();
