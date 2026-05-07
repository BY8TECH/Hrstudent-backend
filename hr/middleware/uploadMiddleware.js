const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDirectoryExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath;

        if (file.fieldname === 'images') {
            uploadPath = 'uploads/announcements/images';
        } else if (file.fieldname === 'videos') {
            uploadPath = 'uploads/announcements/videos';
        } else if (file.fieldname === 'image') {
            uploadPath = 'uploads/courses/categories';
        } else {
            uploadPath = 'uploads/announcements';
        }

        ensureDirectoryExists(uploadPath);
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'images') {
        // Accept images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed for images field'), false);
        }
    } else if (file.fieldname === 'videos') {
        // Accept videos only
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed for videos field'), false);
        }
    } else {
        cb(null, true);
    }
};

// Create multer instance for images (5 MB limit)
const uploadImages = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }  // 5 MB
});

// Create multer instance for videos (50 MB limit)
const uploadVideos = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }  // 50 MB
});

// Combined upload (use higher limit so both can go through one instance)
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }
});

// Wrap multer to catch errors gracefully (prevents server crash)
const safeUpload = (multerMiddleware) => (req, res, next) => {
    multerMiddleware(req, res, (err) => {
        if (err) {
            console.error('[Upload Error]', err.message);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: `File too large. Images max 5 MB, Videos max 50 MB.` });
            }
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        next();
    });
};

// Export configured upload middleware
module.exports = {
    uploadAnnouncementFiles: safeUpload(upload.fields([
        { name: 'images', maxCount: 10 },
        { name: 'videos', maxCount: 5 }
    ])),
    uploadCourseCategory: safeUpload(upload.single('image'))
};
