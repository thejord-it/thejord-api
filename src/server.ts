import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Express = express();
const port = process.env.PORT || 3001;

// Initialize Prisma Client
export const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'thejord-api',
    version: '1.0.0'
  });
});

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// API Routes
import postsRouter from './routes/posts';
import authRouter from './routes/auth';
import uploadRouter from './routes/upload';
import settingsRouter from './routes/settings';
import analyticsRouter from './routes/analytics';

app.use('/api/posts', postsRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/analytics', analyticsRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const server = app.listen(port, () => {
  console.log(`🚀 THEJORD API running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Helper to revalidate Next.js cache
async function revalidateCache(slug: string, language: string) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://thejord.it';
  const revalidateToken = process.env.REVALIDATE_TOKEN || 'dev-token-change-in-production';

  try {
    const response = await fetch(`${frontendUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${revalidateToken}`
      },
      body: JSON.stringify({ path: '/blog', slug })
    });

    if (response.ok) {
      console.log(`🔄 Cache revalidated for: ${slug} (${language})`);
    } else {
      console.warn(`⚠️ Cache revalidation failed for ${slug}: ${response.status}`);
    }
  } catch (error) {
    console.warn(`⚠️ Cache revalidation error for ${slug}:`, error);
  }
}

// Cron job: Publish scheduled posts every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();

    // Find posts that are scheduled and the scheduled time has passed
    const postsToPublish = await prisma.blog_posts.findMany({
      where: {
        published: false,
        scheduledAt: {
          lte: now
        }
      }
    });

    if (postsToPublish.length > 0) {
      console.log(`📅 Publishing ${postsToPublish.length} scheduled post(s)...`);

      for (const post of postsToPublish) {
        await prisma.blog_posts.update({
          where: { id: post.id },
          data: {
            published: true,
            publishedAt: now,
            scheduledAt: null,
            updatedAt: now
          }
        });
        console.log(`✅ Published: "${post.title}" (${post.language})`);

        // Revalidate cache for this post
        await revalidateCache(post.slug, post.language);
      }
    }
  } catch (error) {
    console.error('❌ Error in scheduled publishing job:', error);
  }
});

console.log('⏰ Scheduled publishing cron job started (runs every minute)');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
