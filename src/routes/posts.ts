import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../server';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/posts - Get all blog posts
// Query params: lang, published, search, tags
router.get('/', async (req: Request, res: Response) => {
  try {
    const { lang = 'it', published = 'true', search, tags } = req.query;

    const whereClause: any = {};

    // If lang is not 'all', filter by language
    if (lang !== 'all') {
      whereClause.language = lang as string;
    }

    // Filter by published status
    // 'all' = no filter, 'true' = published, 'false' = drafts, 'scheduled' = scheduled posts
    if (published === 'scheduled') {
      whereClause.published = false;
      whereClause.scheduledAt = { not: null };
    } else if (published !== 'all') {
      whereClause.published = published === 'true';
      // Exclude scheduled posts from drafts
      if (published === 'false') {
        whereClause.scheduledAt = null;
      }
    }

    // Search filter: search in title and excerpt only (not content to avoid matching related links)
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      whereClause.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { excerpt: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // Tags filter: filter by tags (OR logic - matches any of the provided tags)
    if (tags && typeof tags === 'string' && tags.trim()) {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagArray.length > 0) {
        whereClause.tags = { hasSome: tagArray };
      }
    }

    const posts = await prisma.blog_posts.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        slug: true,
        language: true,
        title: true,
        excerpt: true,
        author: true,
        readTime: true,
        tags: true,
        image: true,
        icon: true,
        published: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        scheduledAt: true,
        translationGroup: true
        // Exclude 'content' from list view for performance
      }
    });

    res.json({
      success: true,
      count: posts.length,
      data: posts
    });
  } catch (error: any) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts',
      message: error.message
    });
  }
});

// GET /api/posts/:slugOrId - Get single blog post by slug or ID
router.get('/:slugOrId', async (req: Request, res: Response) => {
  try {
    const { slugOrId } = req.params;
    const { lang = 'it' } = req.query;

    // Check if parameter is a UUID (for admin) or slug (for public)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

    let post;
    if (isUUID) {
      // Fetch by ID (for admin)
      post = await prisma.blog_posts.findUnique({
        where: { id: slugOrId }
      });
    } else {
      // Fetch by slug (for public)
      post = await prisma.blog_posts.findUnique({
        where: {
          slug_language: {
            slug: slugOrId,
            language: lang as string
          }
        }
      });
    }

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Don't return unpublished posts to public
    if (!post.published && !req.headers.authorization) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    res.json({
      success: true,
      data: post
    });
  } catch (error: any) {
    console.error('Error fetching post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post',
      message: error.message
    });
  }
});

// GET /api/posts/:slug/translations - Get translations for a post
router.get('/:slug/translations', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { lang = 'it' } = req.query;

    // First, find the post to get its translationGroup
    const post = await prisma.blog_posts.findUnique({
      where: {
        slug_language: {
          slug,
          language: lang as string
        }
      },
      select: {
        translationGroup: true
      }
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // If no translationGroup, no translations exist
    if (!post.translationGroup) {
      return res.json({
        success: true,
        data: {}
      });
    }

    // Find all posts with the same translationGroup
    const translations = await prisma.blog_posts.findMany({
      where: {
        translationGroup: post.translationGroup,
        published: true
      },
      select: {
        slug: true,
        language: true
      }
    });

    // Convert to object: { "it": "slug-it", "en": "slug-en" }
    const translationMap: Record<string, string> = {};
    for (const t of translations) {
      translationMap[t.language] = t.slug;
    }

    res.json({
      success: true,
      data: translationMap
    });
  } catch (error: any) {
    console.error('Error fetching translations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch translations',
      message: error.message
    });
  }
});

// POST /api/posts - Create new blog post (protected)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      id,
      slug,
      language,
      title,
      excerpt,
      content,
      author,
      readTime,
      tags,
      image,
      icon,
      published,
      publishedAt,
      scheduledAt,
      translationGroup,
      // SEO fields
      keywords,
      metaTitle,
      metaDescription,
      ogImage,
      canonicalUrl,
      editorType
    } = req.body;

    // Validation
    if (!slug || !language || !title || !excerpt || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['slug', 'language', 'title', 'excerpt', 'content']
      });
    }

    // Determine publishedAt based on status
    let finalPublishedAt = null;
    if (published) {
      finalPublishedAt = publishedAt ? new Date(publishedAt) : new Date();
    }

    // Parse scheduledAt if provided
    const finalScheduledAt = scheduledAt ? new Date(scheduledAt) : null;

    const post = await prisma.blog_posts.create({
      data: {
        id: id || crypto.randomUUID(),
        slug,
        language,
        title,
        excerpt,
        content,
        author: author || 'THEJORD Team',
        readTime: readTime || '5 min',
        tags: tags || [],
        image,
        icon,
        published: published || false,
        publishedAt: finalPublishedAt,
        scheduledAt: finalScheduledAt,
        translationGroup: translationGroup || null,
        // SEO fields
        keywords: keywords || [],
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        ogImage: ogImage || null,
        canonicalUrl: canonicalUrl || null,
        editorType: editorType || 'markdown',
        updatedAt: new Date()
      }
    });

    res.status(201).json({
      success: true,
      data: post
    });
  } catch (error: any) {
    console.error('Error creating post:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Post with this slug and language already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create post',
      message: error.message
    });
  }
});

// PUT /api/posts/:id - Update blog post (protected)
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.createdAt;

    const post = await prisma.blog_posts.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: post
    });
  } catch (error: any) {
    console.error('Error updating post:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update post',
      message: error.message
    });
  }
});

// GET /api/posts/scheduled/list - Get all scheduled posts (protected)
router.get('/scheduled/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const posts = await prisma.blog_posts.findMany({
      where: {
        published: false,
        scheduledAt: { not: null }
      },
      orderBy: {
        scheduledAt: 'asc'
      },
      select: {
        id: true,
        slug: true,
        language: true,
        title: true,
        excerpt: true,
        author: true,
        tags: true,
        image: true,
        scheduledAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      count: posts.length,
      data: posts
    });
  } catch (error: any) {
    console.error('Error fetching scheduled posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled posts',
      message: error.message
    });
  }
});

// DELETE /api/posts/:id - Delete blog post (protected)
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.blog_posts.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting post:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete post',
      message: error.message
    });
  }
});

export default router;
