export const storageConfig = {
    provider: process.env.STORAGE_PROVIDER || 'local',
    recordingsDir: process.env.RECORDINGS_DIR || 'uploads/recordings',
    // Base dir for general (non-recording) uploads — course videos/PDFs/
    // thumbnails/resources route through here via storage.js's baseDir option.
    uploadsDir: process.env.UPLOADS_DIR || 'uploads',
};
