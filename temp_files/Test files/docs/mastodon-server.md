
# Mastodon Server Setup Guide for Hetzner Cloud

## Introduction
This guide covers setting up a Mastodon server on Hetzner Cloud using Docker and Nginx for SSL termination. The setup includes a crypto news bot integration.

## Prerequisites
- Hetzner Cloud account
- Domain name with DNS access (we used social.cypheruniversity.com)
- Basic Linux command line knowledge

## 1. Server Provisioning

### Create a Hetzner server:
- Minimum recommended: CPX11 (2GB RAM)
- OS: Ubuntu 22.04 LTS
- Enable backups (recommended)

### Initial server setup:
```bash
# Update the system
apt update && apt upgrade -y

# Install basic utilities
apt install -y curl wget gnupg apt-transport-https lsb-release ca-certificates ufw

# Configure firewall
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

## 2. DNS Configuration

Add an A record in your DNS provider (Wix in our case):
- Type: A
- Host: social (creates social.cypheruniversity.com)
- Value: Your Hetzner IP (5.78.131.130)
- TTL: 1 hour

DNS propagation can take up to 24 hours, but often happens within minutes.

## 3. SSL Certificate Setup

Install and run Certbot to obtain SSL certificates:
```bash
apt install -y certbot
certbot certonly --standalone -d social.cypheruniversity.com
```

## 4. Docker Installation

```bash
# Install Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Set Docker to start on boot
systemctl enable docker
```

## 5. Mastodon Installation

### Create directory for Mastodon:
```bash
mkdir -p /opt/mastodon
cd /opt/mastodon
```

### Create docker-compose.yml:
```bash
nano docker-compose.yml
```

Add this content:
```yaml
version: '3'
services:
  db:
    restart: always
    image: postgres:14-alpine
    networks:
      - internal_network
    volumes:
      - ./postgres:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=RyW6pG8kF3sBx7vQ9zE2
      - POSTGRES_USER=mastodon
      - POSTGRES_DB=mastodon

  redis:
    restart: always
    image: redis:7-alpine
    networks:
      - internal_network
    volumes:
      - ./redis:/data
    command: redis-server --appendonly yes --requirepass Jm5tP8sH4bK9vR2zX7dC

  web:
    restart: always
    image: tootsuite/mastodon:v4.2.0
    depends_on:
      - db
      - redis
    networks:
      - external_network
      - internal_network
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./public/system:/mastodon/public/system
      - ./public/assets:/mastodon/public/assets
    environment:
      - DB_HOST=db
      - DB_USER=mastodon
      - DB_NAME=mastodon
      - DB_PASS=RyW6pG8kF3sBx7vQ9zE2
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=Jm5tP8sH4bK9vR2zX7dC
      - LOCAL_DOMAIN=social.cypheruniversity.com
      - SECRET_KEY_BASE=f45vKyxEzROo/n7RmRyp+9GjHgYeR3yKDaXgGCZUh3mrD5Kfv6cdN2rIABYy+PQY0HddnhQG/KkhLNM4w/kEfg==
      - OTP_SECRET=B86BaVi3IJhLA0XNLCP3s+Wt2LVwBaYs6aHo+rK+k48f6qYd7iKrceoIHX63zBDEjHl02al3Ggi6SpIAFtyiVw==
      - VAPID_PRIVATE_KEY=1G4yoMLrnfskO2Rf9chPSumljaqp8KU4OwZTYDHsSR8=
      - VAPID_PUBLIC_KEY=BHxmLtpWxpdQDHo2yHGaRk9oIzeBGTsxBR7up20htcQMszzUnUx92RfaxwtL1DpsV-kH39woCX8sNaGfJOjfFB8=
      - RAILS_SERVE_STATIC_FILES=true
    command: bash -c "rm -f /mastodon/tmp/pids/server.pid; bundle exec rails s -p 3000 -b 0.0.0.0"

networks:
  external_network:
  internal_network:
    internal: true
```

### Generate new secrets (if needed):
```bash
# Generate SECRET_KEY_BASE
openssl rand -base64 64

# Generate OTP_SECRET
openssl rand -base64 64

# Generate VAPID keys (if not using the ones above)
docker-compose run --rm web rake mastodon:webpush:generate_vapid_key
```

### Start Mastodon:
```bash
docker-compose up -d
```

## 6. Nginx Configuration for SSL

### Install Nginx:
```bash
apt install -y nginx
```

### Create Nginx configuration:
```bash
nano /etc/nginx/sites-available/mastodon
```

Add this content:

server {
    listen 80;
    listen [::]:80;
    server_name social.cypheruniversity.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name social.cypheruniversity.com;

    ssl_certificate /etc/letsencrypt/live/social.cypheruniversity.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/social.cypheruniversity.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}


### Enable the configuration:
```bash
ln -s /etc/nginx/sites-available/mastodon /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 7. Initial Mastodon Setup

Your Mastodon instance should now be accessible at https://social.cypheruniversity.com

Default admin credentials:
- Username: Funklesfunk
- Password: 3d59493efd4a7056cdb6c13ed387171b

**IMPORTANT**: Change your admin password immediately after first login.

## 8. Bot Integration

### Create an API application:
1. Log in to https://social.cypheruniversity.com
2. Go to Preferences → Development → New Application
3. Fill in:
   - Name: Crypto News Bot
   - Scopes: select write:statuses
4. Save and copy the access token

### Configure your bot:
Update your bot's .env file with:

## 9. Testing

### Test your Mastodon instance:
1. Log in and post a test status
2. Verify email functionality (if configured)
3. Check mobile app access

### Test your bot:
```bash
node bot.js
```

## 10. Maintenance

### SSL certificate renewal:
Certbot automatically creates a renewal cron job. Verify with:
```bash
systemctl list-timers | grep certbot
```

### Automatic updates:
Already configured with unattended-upgrades to install security updates automatically.

### Backups:
Set up regular database dumps:
```bash
docker-compose exec db pg_dump -U mastodon mastodon > mastodon_backup_$(date +%Y%m%d).sql
```

## 11. Troubleshooting

### View container logs:
```bash
docker-compose logs --tail 50 web
```

### Check container status:
```bash
docker-compose ps
```

### Common issues:
- **Connection refused**: Check if containers are running and ports are correctly mapped
- **403 Forbidden**: Rails host validation issue - set proper environment variables
- **SSL errors**: Check Nginx configuration and certificate paths

### Restart services:
```bash
docker-compose down
docker-compose up -d
systemctl restart nginx
```

## Security Notes

- Change all default passwords
- Keep your server updated
- Consider setting up fail2ban for SSH protection
- Regular backups are essential

## Resources

- [Official Mastodon Documentation](https://docs.joinmastodon.org/)
- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

Created for Cypher University's Crypto News Bot on May 12, 2024.