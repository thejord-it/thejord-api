import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';

const router = Router();

// Middleware to verify auth token
const verifyToken = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    (req as any).user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// GET /api/settings/:key - Get a setting by key
router.get('/:key', verifyToken, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const setting = await prisma.admin_settings.findUnique({
      where: { key }
    });

    // Return null if setting doesn't exist (client handles defaults)
    res.json({
      success: true,
      data: setting ? setting.value : null
    });
  } catch (error: any) {
    console.error('Get setting error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get setting',
      message: error.message
    });
  }
});

// PUT /api/settings/:key - Create or update a setting
router.put('/:key', verifyToken, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Value is required'
      });
    }

    const setting = await prisma.admin_settings.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });

    res.json({
      success: true,
      data: setting.value
    });
  } catch (error: any) {
    console.error('Update setting error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update setting',
      message: error.message
    });
  }
});

// DELETE /api/settings/:key - Delete a setting
router.delete('/:key', verifyToken, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    await prisma.admin_settings.delete({
      where: { key }
    });

    res.json({
      success: true,
      message: 'Setting deleted'
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Setting not found'
      });
    }
    console.error('Delete setting error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete setting',
      message: error.message
    });
  }
});

// GET /api/settings - Get all settings (for backup/export)
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.admin_settings.findMany();

    // Convert to object format
    const data: Record<string, any> = {};
    for (const setting of settings) {
      data[setting.key] = setting.value;
    }

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Get all settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get settings',
      message: error.message
    });
  }
});

export default router;
