# FireRunway

A [Next.js](https://nextjs.org) application built with TypeScript, Tailwind CSS, Framer Motion, and Recharts.

## Prerequisites

- [Node.js](https://nodejs.org) v18.17 or later
- npm (included with Node.js)

## Getting Started (Development)

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app. The page auto-updates as you edit files.

## Production Deployment

### 1. Clone and Install

```bash
git clone <repository-url>
cd firerunway
npm ci
```

> `npm ci` is preferred over `npm install` for production — it ensures a clean, reproducible install from `package-lock.json`.

### 2. Configure Environment Variables

Copy and configure any required environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your production values. At minimum, set:

```env
NODE_ENV=production
```

### 3. Build

```bash
npm run build
```

This creates an optimized production build in the `.next` directory.

### 4. Start the Server

```bash
npm run start
```

By default, the server runs on port `3000`. To use a different port:

```bash
PORT=8080 npm run start
```

### 5. Running with a Process Manager (Recommended)

Use [PM2](https://pm2.io) to keep the app running and auto-restart on crashes:

```bash
# Install PM2 globally
npm install -g pm2

# Start the app
pm2 start npm --name "firerunway" -- start

# Other useful commands
pm2 status          # Check status
pm2 logs firerunway # View logs
pm2 restart firerunway
pm2 stop firerunway

# Enable startup on boot
pm2 startup
pm2 save
```

### 6. Reverse Proxy with Nginx (Recommended)

Set up Nginx to handle SSL, caching, and proxying:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Then enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/firerunway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Available Scripts

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `npm run dev`   | Start development server           |
| `npm run build` | Create optimized production build  |
| `npm run start` | Start production server            |
| `npm run lint`  | Run ESLint                         |
