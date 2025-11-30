import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const postsKeywords = [
  {
    slug: 'cron-expression-builder',
    keywords: ['cron', 'cron expression', 'cron builder', 'task scheduler', 'automation', 'devops', 'linux cron', 'crontab']
  },
  {
    slug: 'json-schema-converter',
    keywords: ['json schema', 'json validation', 'json schema converter', 'api documentation', 'openapi', 'swagger', 'ajv']
  },
  {
    slug: 'come-validare-json-online',
    keywords: ['validare json', 'json formatter', 'json validator', 'json prettify', 'json minify', 'json to yaml']
  },
  {
    slug: 'base64-encoder-decoder-guida',
    keywords: ['base64', 'base64 encoder', 'base64 decoder', 'encode base64', 'decode base64', 'base64 tool']
  },
  {
    slug: 'regex-tester-italiano-pattern',
    keywords: ['regex', 'regex tester', 'espressioni regolari', 'codice fiscale regex', 'partita iva regex', 'telefono italiano regex']
  },
  {
    slug: 'lancio-thejord-it',
    keywords: ['thejord', 'developer tools', 'open source', 'privacy', 'json formatter', 'base64', 'regex tester']
  }
]

async function fixKeywords() {
  try {
    console.log('🔧 Fixing keywords for all blog posts...\n')

    for (const post of postsKeywords) {
      console.log(`📝 Updating: ${post.slug}`)

      await prisma.blogPost.updateMany({
        where: {
          slug: post.slug,
          language: 'it'
        },
        data: {
          keywords: post.keywords
        }
      })

      console.log(`✅ Updated with ${post.keywords.length} keywords`)
    }

    console.log(`\n🎉 All posts updated successfully!`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

fixKeywords()
