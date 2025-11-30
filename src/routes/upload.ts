import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter - only images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// POST /api/upload - Upload single image (protected)
router.post('/', authMiddleware, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const originalPath = req.file.path;
    const baseFilename = req.file.filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
    const webpFilename = `${baseFilename}.webp`;
    const thumbFilename = `${baseFilename}-thumb.webp`;
    const mediumFilename = `${baseFilename}-medium.webp`;
    const smallFilename = `${baseFilename}-small.webp`;

    const webpPath = path.join(uploadsDir, webpFilename);
    const thumbPath = path.join(uploadsDir, thumbFilename);
    const mediumPath = path.join(uploadsDir, mediumFilename);
    const smallPath = path.join(uploadsDir, smallFilename);

    // Process main image: resize to max 1920x1080 and convert to WebP (Desktop)
    await sharp(originalPath)
      .resize(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toFile(webpPath);

    // Generate medium size 1024x768 for tablets
    await sharp(originalPath)
      .resize(1024, 768, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toFile(mediumPath);

    // Generate small size 640x480 for mobile
    await sharp(originalPath)
      .resize(640, 480, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 75 })
      .toFile(smallPath);

    // Generate square thumbnail 400x400 for list view
    await sharp(originalPath)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toFile(thumbPath);

    // Delete original file, keep only WebP versions
    if (originalPath !== webpPath) {
      fs.unlinkSync(originalPath);
    }

    // Get file stats for all versions
    const stats = fs.statSync(webpPath);
    const thumbStats = fs.statSync(thumbPath);
    const mediumStats = fs.statSync(mediumPath);
    const smallStats = fs.statSync(smallPath);

    const imageUrl = `/uploads/${webpFilename}`;
    const thumbUrl = `/uploads/${thumbFilename}`;
    const mediumUrl = `/uploads/${mediumFilename}`;
    const smallUrl = `/uploads/${smallFilename}`;

    res.status(201).json({
      success: true,
      data: {
        filename: webpFilename,
        url: imageUrl,
        thumbnailUrl: thumbUrl,
        responsiveImages: {
          small: smallUrl,
          medium: mediumUrl,
          large: imageUrl
        },
        sizes: {
          large: stats.size,
          medium: mediumStats.size,
          small: smallStats.size,
          thumbnail: thumbStats.size
        },
        mimetype: 'image/webp'
      }
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      message: error.message
    });
  }
});

// DELETE /api/upload/:filename - Delete uploaded image (protected)
router.delete('/:filename', authMiddleware, (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Delete file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      message: error.message
    });
  }
});

export default router;
