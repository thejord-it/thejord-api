import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Mapping Italian slug -> English slug
const translationPairs = [
  { itSlug: 'cron-expression-builder', enSlug: 'cron-expression-builder' },
  { itSlug: 'json-schema-converter', enSlug: 'json-schema-converter' },
  { itSlug: 'come-validare-json-online', enSlug: 'how-to-validate-json-online' },
  { itSlug: 'base64-encoder-decoder-guida', enSlug: 'base64-encoder-decoder-guide' },
  { itSlug: 'regex-tester-italiano-pattern', enSlug: 'regex-tester-patterns-guide' },
  { itSlug: 'lancio-thejord-it', enSlug: 'thejord-launch-announcement' }
]

async function main() {
  console.log('Fixing translation groups...\n')

  for (const pair of translationPairs) {
    // Get Italian post
    const itPost = await prisma.blog_posts.findUnique({
      where: { slug_language: { slug: pair.itSlug, language: 'it' } }
    })

    // Get English post
    const enPost = await prisma.blog_posts.findUnique({
      where: { slug_language: { slug: pair.enSlug, language: 'en' } }
    })

    if (!itPost || !enPost) {
      console.log(`Skipping ${pair.itSlug} - missing post`)
      continue
    }

    // Use Italian post's translationGroup for both
    const translationGroup = itPost.translationGroup

    if (!translationGroup) {
      console.log(`Skipping ${pair.itSlug} - no translationGroup on Italian post`)
      continue
    }

    // Update English post to use same translationGroup
    await prisma.blog_posts.update({
      where: { id: enPost.id },
      data: { translationGroup }
    })

    console.log(`Linked: ${pair.itSlug} (it) <-> ${pair.enSlug} (en) [${translationGroup}]`)
  }

  console.log('\nDone!')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
