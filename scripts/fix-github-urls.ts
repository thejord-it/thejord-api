import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find all posts with wrong GitHub URL
  const posts = await prisma.blog_posts.findMany({
    where: { content: { contains: 'thejord-tools' } }
  })

  console.log(`Found ${posts.length} posts with wrong GitHub URL\n`)

  for (const post of posts) {
    const newContent = post.content.replace(/thejord-tools/g, 'thejord-web')

    await prisma.blog_posts.update({
      where: { id: post.id },
      data: { content: newContent }
    })

    console.log(`Fixed: ${post.slug} (${post.language})`)
  }

  console.log('\nDone!')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
