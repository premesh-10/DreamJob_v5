import { lookup as mimeLookup } from 'mime-types';
import { storageProvider } from './storage.js';

// Shared Range-request streaming logic for files behind the storage
// abstraction (recordings) — mirrors the existing /uploads static-serving
// Range logic in server.js, factored out so it isn't duplicated.
export function streamStoredFileWithRange(req, res, relativePath) {
    if (!storageProvider.exists(relativePath)) {
        return res.status(404).json({ message: 'File not found' });
    }

    const stat = storageProvider.getStat(relativePath);
    const fileSize = stat.size;
    const mimeType = mimeLookup(relativePath) || 'application/octet-stream';
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 10 * 1024 * 1024, fileSize - 1);
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache',
        });
        storageProvider.getReadStream(relativePath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
        });
        storageProvider.getReadStream(relativePath).pipe(res);
    }
}
