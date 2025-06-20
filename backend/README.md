# Tunlify Backend API

Backend API untuk layanan tunneling Tunlify dengan dukungan subdomain dinamis.

## 🚀 Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Database Setup
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb tunlify

# Import schema
sudo -u postgres psql tunlify < database/schema.sql
```

### 3. Environment Configuration
```bash
cp .env.example .env
# Edit .env dengan konfigurasi yang sesuai
```

### 4. Email Configuration
Setup SMTP untuk OTP emails:
- Gmail: Gunakan App Password
- SendGrid/Mailgun: Gunakan API credentials

### 5. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

## 🌐 Caddy Setup

### 1. Install Caddy
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 2. Configure Caddy
```bash
# Copy Caddyfile
sudo cp Caddyfile /etc/caddy/Caddyfile

# Create log directory
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy

# Test configuration
sudo caddy validate --config /etc/caddy/Caddyfile

# Start Caddy
sudo systemctl enable caddy
sudo systemctl start caddy
```

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Tunnels
- `GET /api/tunnels` - Get user tunnels
- `POST /api/tunnels` - Create tunnel
- `DELETE /api/tunnels/:id` - Delete tunnel
- `PATCH /api/tunnels/:id/status` - Update tunnel status

### Server Locations
- `GET /api/server-locations` - Get all locations

### Admin (requires admin role)
- `GET /api/admin/users` - Get all users
- `GET /api/admin/server-locations` - Manage locations
- `POST /api/admin/server-locations` - Add location
- `GET /api/admin/content` - Get content pages
- `GET /api/admin/settings` - Get settings
- `POST /api/admin/settings` - Update settings

### Content
- `GET /api/content/landing?lang=en` - Landing page content
- `GET /api/content/pricing?lang=en` - Pricing page content

## 🔧 Tunnel System

### Subdomain Format
```
[subdomain].[region].tunlify.biz.id
```

Contoh:
- `myapp.id.tunlify.biz.id` - Indonesia region
- `myapp.sg.tunlify.biz.id` - Singapore region
- `myapp.us.tunlify.biz.id` - US region

### Cara Kerja
1. User membuat tunnel di dashboard
2. Caddy menangkap request ke subdomain
3. Backend mencari tunnel di database
4. Request di-proxy ke target IP:port

## 🛡️ Security Features

- JWT authentication
- Rate limiting
- Input validation
- CORS protection
- Helmet security headers
- Password hashing dengan bcrypt
- OTP email verification

## 📊 Monitoring

### Logs
- Frontend: `/var/log/caddy/tunlify-frontend.log`
- API: `/var/log/caddy/tunlify-api.log`
- Tunnels: `/var/log/caddy/tunlify-tunnels-[region].log`

### Health Check
```bash
curl https://api.tunlify.biz.id/health
```

## 🔄 Default Users

- **Admin**: admin@tunlify.net / 123456
- **User**: user@tunlify.net / 123456

## 📝 Environment Variables

```env
DATABASE_URL=postgresql://username:password@localhost:5432/tunlify
JWT_SECRET=your-super-secret-jwt-key-here
PORT=3001
NODE_ENV=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FRONTEND_URL=https://tunlify.biz.id
TUNNEL_BASE_DOMAIN=tunlify.biz.id
```