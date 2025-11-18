# THEJORD API

Backend API for THEJORD platform - Blog and content management system.

## Tech Stack

- **Node.js 20+** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **Prisma** - ORM for PostgreSQL
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing

## Features

- ✅ RESTful API for blog posts
- ✅ Multilanguage support (IT/EN)
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ CORS enabled
- ✅ TypeScript with strict mode
- ✅ Prisma ORM with migrations

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/thejord-it/thejord-api.git
cd thejord-api

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
```

### Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view/edit data
npm run prisma:studio
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Server will run on http://localhost:3001
```

### Production

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## API Endpoints

### Public Endpoints

```
GET  /health                   - Health check
GET  /api/posts?lang=it        - Get all published posts (query: lang, published)
GET  /api/posts/:slug?lang=it  - Get single post by slug
```

### Protected Endpoints (require JWT token)

```
POST   /api/posts              - Create new post
PUT    /api/posts/:id          - Update post
DELETE /api/posts/:id          - Delete post
```

### Authentication

```
POST /api/auth/login           - Login (returns JWT token)
POST /api/auth/register        - Register new admin user
GET  /api/auth/me              - Get current user info
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/thejord_db
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key
CORS_ORIGIN=http://localhost:3000
```

## Database Schema

### BlogPost

- `id` - UUID primary key
- `slug` - URL-friendly identifier
- `language` - 'it' | 'en'
- `title` - Post title
- `excerpt` - Short description
- `content` - Full content (Markdown)
- `author` - Author name
- `readTime` - Estimated read time
- `tags` - Array of tags
- `image` - Emoji or image URL
- `published` - Boolean
- `createdAt` - Timestamp
- `updatedAt` - Timestamp

### User

- `id` - UUID primary key
- `email` - Unique email
- `password` - Hashed password (bcrypt)
- `name` - Full name
- `role` - 'admin' | 'editor'
- `createdAt` - Timestamp
- `updatedAt` - Timestamp

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Project Structure

```
thejord-api/
├── prisma/
│   └── schema.prisma       # Database schema
├── src/
│   ├── middleware/
│   │   └── auth.ts         # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.ts         # Auth endpoints
│   │   └── posts.ts        # Blog posts endpoints
│   └── server.ts           # Express server setup
├── .env.example            # Environment variables template
├── .gitignore
├── package.json
├── README.md
└── tsconfig.json
```

## Deployment

This API is designed to run on Kubernetes (K3s) with PostgreSQL.

See deployment documentation for detailed instructions.

## License

MIT © Il Giordano

## Links

- **Frontend**: [thejord-tools](https://github.com/thejord-it/thejord-tools)
- **Admin Panel**: [thejord-admin](https://github.com/thejord-it/thejord-admin)
- **Live Site**: [thejord.it](https://thejord.it)
