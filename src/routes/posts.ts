import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/posts - Get all published blog posts
router.get('/', async (req: Request, res: Response) => {
  try {
    const { lang = 'it', published = 'true' } = req.query;

    const posts = await prisma.blogPost.findMany({
      where: {
        language: lang as string,
        ...(published === 'true' && { published: true })
      },
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
        published: true,
        createdAt: true,
        updatedAt: true
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

// GET /api/posts/:slug - Get single blog post by slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { lang = 'it' } = req.query;

    const post = await prisma.blogPost.findUnique({
      where: {
        slug_language: {
          slug,
          language: lang as string
        }
      }
    });

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

// POST /api/posts - Create new blog post (protected)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      slug,
      language,
      title,
      excerpt,
      content,
      author,
      readTime,
      tags,
      image,
      published
    } = req.body;

    // Validation
    if (!slug || !language || !title || !excerpt || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['slug', 'language', 'title', 'excerpt', 'content']
      });
    }

    const post = await prisma.blogPost.create({
      data: {
        slug,
        language,
        title,
        excerpt,
        content,
        author: author || 'THEJORD Team',
        readTime: readTime || '5 min',
        tags: tags || [],
        image,
        published: published || false
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

    const post = await prisma.blogPost.update({
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

// DELETE /api/posts/:id - Delete blog post (protected)
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.blogPost.delete({
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
