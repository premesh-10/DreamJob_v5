import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { fileTypeFromFile } from 'file-type';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Ensure upload directories exist ──────────────────────────────────────────
const uploadsBase = path.join(__dirname, '..', 'uploads');
const dirs = ['thumbnails', 'videos', 'pdfs', 'resources', 'avatars', 'applications', 'companies', 'verification', 'webinar-resources', 'knowledge'];
dirs.forEach(dir => {
    const fullPath = path.join(uploadsBase, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// ── Storage engine factory ────────────────────────────────────────────────────
const makeStorage = (subfolder) => multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(uploadsBase, subfolder));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

// ── File filters ──────────────────────────────────────────────────────────────
const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed for thumbnails'), false);
};

const videoFilter = (req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime', 'video/x-matroska'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('video/')) return cb(null, true);
    cb(new Error('Only video files are allowed'), false);
};

const pdfFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Only PDF files are allowed'), false);
};

const resourceFilter = (req, file, cb) => {
    const allowed = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain'
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('File type not supported'), false);
};

// ── Multer instances ──────────────────────────────────────────────────────────
export const uploadThumbnail = multer({
    storage: makeStorage('thumbnails'),
    fileFilter: imageFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
}).single('thumbnail');

export const uploadVideo = multer({
    storage: makeStorage('videos'),
    fileFilter: videoFilter,
    limits: { fileSize: 500 * 1024 * 1024 } // 500 MB
}).single('video');

export const uploadPDF = multer({
    storage: makeStorage('pdfs'),
    fileFilter: pdfFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
}).single('pdf');

export const uploadResource = multer({
    storage: makeStorage('resources'),
    fileFilter: resourceFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
}).single('resource');

// Webinar resources use a separate subfolder (not 'resources') because /uploads/resources/*
// is blanket-protected in server.js as paid-course content gated behind the course-stream
// endpoint — webinar resources are revealed/gated at the API layer instead (visibleBeforeLive/
// downloadable flags), so they need a publicly-servable static path.
export const uploadWebinarResource = multer({
    storage: makeStorage('webinar-resources'),
    fileFilter: resourceFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
}).single('resource');

export const uploadAvatar = multer({
    storage: makeStorage('avatars'),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
}).single('avatar');

export const uploadApplicationDoc = multer({
    storage: makeStorage('applications'),
    fileFilter: resourceFilter,
    limits: { fileSize: 15 * 1024 * 1024 } // 15 MB
}).single('file');

export const uploadCompanyLogo = multer({
    storage: makeStorage('companies'),
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
}).single('logo');

export const uploadVerificationDoc = multer({
    storage: makeStorage('verification'),
    fileFilter: resourceFilter,
    limits: { fileSize: 15 * 1024 * 1024 } // 15 MB
}).single('document');

// ── Post-write content verification ───────────────────────────────────────────
// multer's fileFilter only checks the client-declared MIME type, which is
// trivial to spoof (e.g. rename a .txt to .mp4). This reads the real magic
// bytes back off disk after the write and rejects on mismatch — applied to
// the course-related upload wrappers below. Other upload types (avatar,
// application docs, etc.) are unchanged/out of scope but can adopt this in
// one line each later.
const CATEGORY_MIME_PREFIXES = {
    image: ['image/'],
    video: ['video/'],
    pdf: ['application/pdf'],
    // Legacy .doc/.ppt/.xls are an OLE2/CFB container — file-type can detect
    // the container but can't always resolve it to the specific Office app
    // without deeper parsing, so 'application/x-cfb' is accepted here too.
    document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.',
        'application/vnd.ms-powerpoint',
        'application/x-cfb',
    ],
};

export const verifyFileContent = (allowedCategories) => async (req, res, next) => {
    if (!req.file) return next();
    try {
        const detected = await fileTypeFromFile(req.file.path);
        // Plain-text files have no reliable magic bytes — file-type returns
        // undefined for them by design. Allow through only if the declared
        // mimetype was already text/plain (gated by multer's fileFilter).
        if (!detected) {
            if (req.file.mimetype === 'text/plain') return next();
            deleteUploadedFile(req.file.path);
            return res.status(400).json({ message: 'Could not verify file content — upload rejected' });
        }

        const allowedPrefixes = allowedCategories.flatMap(cat => CATEGORY_MIME_PREFIXES[cat] || []);
        const matches = allowedPrefixes.some(prefix => detected.mime.startsWith(prefix));
        if (!matches) {
            deleteUploadedFile(req.file.path);
            return res.status(400).json({ message: `File content does not match an allowed type (detected: ${detected.mime})` });
        }
        next();
    } catch (error) {
        next(error);
    }
};

// ── Middleware wrappers (convert multer callback to express middleware) ────────
export const handleThumbnailUpload = (req, res, next) => {
    uploadThumbnail(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        verifyFileContent(['image'])(req, res, next);
    });
};

export const handleVideoUpload = (req, res, next) => {
    uploadVideo(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        verifyFileContent(['video'])(req, res, next);
    });
};

export const handlePDFUpload = (req, res, next) => {
    uploadPDF(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        verifyFileContent(['pdf'])(req, res, next);
    });
};

export const handleResourceUpload = (req, res, next) => {
    uploadResource(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        verifyFileContent(['document', 'image'])(req, res, next);
    });
};

export const handleWebinarResourceUpload = (req, res, next) => {
    uploadWebinarResource(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        verifyFileContent(['document', 'image'])(req, res, next);
    });
};

export const handleApplicationDocUpload = (req, res, next) => {
    uploadApplicationDoc(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};

export const handleCompanyLogoUpload = (req, res, next) => {
    uploadCompanyLogo(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};

export const handleVerificationDocUpload = (req, res, next) => {
    uploadVerificationDoc(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};

export const uploadKnowledgeCover = multer({
    storage: makeStorage('knowledge'),
    fileFilter: imageFilter,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
}).single('cover');

export const handleKnowledgeCoverUpload = (req, res, next) => {
    uploadKnowledgeCover(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        verifyFileContent(['image'])(req, res, next);
    });
};

// ── Helper to delete a file from disk ─────────────────────────────────────────
export const deleteUploadedFile = (filePath) => {
    if (!filePath) return;
    // Only delete if the path is within our uploads directory
    const absolutePath = filePath.startsWith('/uploads')
        ? path.join(__dirname, '..', filePath)
        : filePath;
    if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
    }
};
