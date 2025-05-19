import multer from 'multer';
import path from 'path';

// Configure Multer storage (memory storage is good for S3 uploads, as files are streamed)
const storage = multer.memoryStorage();

// File filter to allow only images
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
        return cb(null, true);
    }
    cb(new Error('Error: File upload only supports the following filetypes - ' + allowedTypes));
};

export const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: fileFilter,
});

// Example usage for single file: upload.single('productImage')
// Example usage for multiple files (up to 5): upload.array('productImages', 5)