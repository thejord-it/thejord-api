import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import crypto from 'crypto';

const router = Router();

// IP ranges to exclude (developer IPs)
const EXCLUDED_IPS = [
  '93.41.245.152', // Fastweb home (may change)
];

// Tailscale range: 100.64.0.0/10 (100.64.* to 100.127.*)
function isTailscaleIP(ip: string): boolean {
  const match = ip.match(/^100\.(\d+)\./);
  if (!match) return false;
  const secondOctet = parseInt(match[1]);
  return secondOctet >= 64 && secondOctet <= 127;
}

// Bot detection patterns
const BOT_PATTERNS = /bot|crawler|spider|curl|wget|python|java|php|go-http|axios|node-fetch|postman|insomnia/i;

function isBot(userAgent: string): boolean {
  return BOT_PATTERNS.test(userAgent);
}

// Device type detection
function getDeviceType(userAgent: string): string {
  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent)) {
    if (/ipad|tablet/i.test(userAgent)) return 'tablet';
    return 'mobile';
  }
  return 'desktop';
}

// Browser detection
function getBrowser(userAgent: string): string {
  if (/edg/i.test(userAgent)) return 'Edge';
  if (/chrome/i.test(userAgent)) return 'Chrome';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent)) return 'Safari';
  if (/opera|opr/i.test(userAgent)) return 'Opera';
  return 'Other';
}

// OS detection
function getOS(userAgent: string): string {
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/macintosh|mac os/i.test(userAgent)) return 'macOS';
  if (/linux/i.test(userAgent)) return 'Linux';
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
  return 'Other';
}

// Get client IP from various headers
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return typeof realIP === 'string' ? realIP : realIP[0];
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// POST /api/analytics/track - Track pageview or event
router.post('/track', async (req: Request, res: Response) => {
  try {
    const ip = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';

    // Filter out developer IPs
    if (EXCLUDED_IPS.includes(ip) || isTailscaleIP(ip)) {
      return res.json({ success: true, tracked: false, reason: 'internal' });
    }

    // Filter out bots
    if (isBot(userAgent)) {
      return res.json({ success: true, tracked: false, reason: 'bot' });
    }

    const {
      path,
      event = 'pageview',
      referrer,
      sessionId,
      language,
      toolName,
      metadata
    } = req.body;

    // Validate required fields
    if (!path) {
      return res.status(400).json({ success: false, error: 'path is required' });
    }

    // Generate session ID if not provided
    const finalSessionId = sessionId || crypto.randomUUID();

    // Create analytics event
    await prisma.analytics_events.create({
      data: {
        sessionId: finalSessionId,
        path,
        event,
        referrer: referrer || req.headers.referer || null,
        country: null, // Could use IP geolocation service
        city: null,
        deviceType: getDeviceType(userAgent),
        browser: getBrowser(userAgent),
        os: getOS(userAgent),
        language: language || null,
        toolName: toolName || null,
        metadata: metadata || null
      }
    });

    res.json({ success: true, tracked: true, sessionId: finalSessionId });
  } catch (error: any) {
    console.error('Analytics tracking error:', error);
    // Don't fail the request - analytics should be non-blocking
    res.json({ success: true, tracked: false, reason: 'error' });
  }
});

// GET /api/analytics/stats - Get analytics statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, type = 'overview' } = req.query;

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate as string);
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter.gte = thirtyDaysAgo;
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate as string);
    }

    if (type === 'overview') {
      // Get overview stats
      const [totalPageviews, uniqueSessions, events] = await Promise.all([
        prisma.analytics_events.count({
          where: {
            event: 'pageview',
            createdAt: dateFilter
          }
        }),
        prisma.analytics_events.groupBy({
          by: ['sessionId'],
          where: {
            createdAt: dateFilter
          }
        }),
        prisma.analytics_events.count({
          where: {
            createdAt: dateFilter
          }
        })
      ]);

      return res.json({
        success: true,
        data: {
          pageviews: totalPageviews,
          sessions: uniqueSessions.length,
          totalEvents: events
        }
      });
    }

    if (type === 'pages') {
      // Top pages
      const pages = await prisma.analytics_events.groupBy({
        by: ['path'],
        where: {
          event: 'pageview',
          createdAt: dateFilter
        },
        _count: {
          path: true
        },
        orderBy: {
          _count: {
            path: 'desc'
          }
        },
        take: 20
      });

      return res.json({
        success: true,
        data: pages.map(p => ({
          path: p.path,
          views: p._count.path
        }))
      });
    }

    if (type === 'devices') {
      // Device breakdown
      const devices = await prisma.analytics_events.groupBy({
        by: ['deviceType'],
        where: {
          createdAt: dateFilter
        },
        _count: {
          deviceType: true
        }
      });

      return res.json({
        success: true,
        data: devices.map(d => ({
          device: d.deviceType,
          count: d._count.deviceType
        }))
      });
    }

    if (type === 'browsers') {
      // Browser breakdown
      const browsers = await prisma.analytics_events.groupBy({
        by: ['browser'],
        where: {
          createdAt: dateFilter
        },
        _count: {
          browser: true
        },
        orderBy: {
          _count: {
            browser: 'desc'
          }
        }
      });

      return res.json({
        success: true,
        data: browsers.map(b => ({
          browser: b.browser,
          count: b._count.browser
        }))
      });
    }

    if (type === 'referrers') {
      // Top referrers
      const referrers = await prisma.analytics_events.groupBy({
        by: ['referrer'],
        where: {
          referrer: { not: null },
          createdAt: dateFilter
        },
        _count: {
          referrer: true
        },
        orderBy: {
          _count: {
            referrer: 'desc'
          }
        },
        take: 20
      });

      return res.json({
        success: true,
        data: referrers.map(r => ({
          referrer: r.referrer,
          count: r._count.referrer
        }))
      });
    }

    if (type === 'tools') {
      // Tool usage
      const tools = await prisma.analytics_events.groupBy({
        by: ['toolName'],
        where: {
          event: 'tool_usage',
          toolName: { not: null },
          createdAt: dateFilter
        },
        _count: {
          toolName: true
        },
        orderBy: {
          _count: {
            toolName: 'desc'
          }
        }
      });

      return res.json({
        success: true,
        data: tools.map(t => ({
          tool: t.toolName,
          uses: t._count.toolName
        }))
      });
    }

    if (type === 'daily') {
      // Daily pageviews (raw SQL for date grouping)
      const daily = await prisma.$queryRaw`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as pageviews,
          COUNT(DISTINCT session_id) as sessions
        FROM analytics_events
        WHERE event = 'pageview'
          AND created_at >= ${dateFilter.gte}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      ` as Array<{ date: Date; pageviews: bigint; sessions: bigint }>;

      return res.json({
        success: true,
        data: daily.map(d => ({
          date: d.date,
          pageviews: Number(d.pageviews),
          sessions: Number(d.sessions)
        }))
      });
    }

    res.status(400).json({
      success: false,
      error: 'Invalid type. Available: overview, pages, devices, browsers, referrers, tools, daily'
    });

  } catch (error: any) {
    console.error('Analytics stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      message: error.message
    });
  }
});

// GET /api/analytics/realtime - Get realtime active sessions (last 5 minutes)
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const activeSessions = await prisma.analytics_events.groupBy({
      by: ['sessionId'],
      where: {
        createdAt: {
          gte: fiveMinutesAgo
        }
      }
    });

    res.json({
      success: true,
      data: {
        activeUsers: activeSessions.length
      }
    });
  } catch (error: any) {
    console.error('Realtime analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch realtime data'
    });
  }
});

export default router;
