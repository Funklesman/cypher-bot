#!/bin/bash
# Mastodon Server Automated Deployment for Hetzner
# Run this script on a fresh Ubuntu 22.04 server

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="social.kodex.academy"
MASTODON_DIR="/opt/mastodon"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Mastodon Deployment Script${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Step 1: System Update
print_status "Updating system packages..."
apt update && apt upgrade -y
print_success "System updated"

# Step 2: Install basic utilities
print_status "Installing basic utilities..."
apt install -y curl wget gnupg apt-transport-https lsb-release ca-certificates ufw
print_success "Basic utilities installed"

# Step 3: Configure firewall
print_status "Configuring firewall..."
ufw --force enable
ufw allow ssh
ufw allow http
ufw allow https
print_success "Firewall configured"

# Step 4: Install Docker
print_status "Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker
systemctl start docker
print_success "Docker installed and started"

# Step 5: Install Nginx
print_status "Installing Nginx..."
apt install -y nginx
systemctl enable nginx
print_success "Nginx installed"

# Step 6: Check DNS
print_status "Checking DNS configuration..."
SERVER_IP=$(curl -s ifconfig.me)
DNS_IP=$(dig +short ${DOMAIN} | tail -n1)

echo "Server IP: ${SERVER_IP}"
echo "DNS Points to: ${DNS_IP}"

if [ "${SERVER_IP}" != "${DNS_IP}" ]; then
    print_warning "DNS does not point to this server yet!"
    print_warning "Please update your DNS A record for ${DOMAIN} to point to ${SERVER_IP}"
    read -p "Press Enter once DNS is updated and propagated..."
fi

# Step 7: Install SSL Certificate
print_status "Installing SSL certificate..."
apt install -y certbot
systemctl stop nginx  # Stop nginx temporarily for standalone certbot
certbot certonly --standalone -d ${DOMAIN} --non-interactive --agree-tos --email admin@cypheruniversity.com
print_success "SSL certificate obtained"

# Step 8: Create Mastodon directory
print_status "Creating Mastodon directory..."
mkdir -p ${MASTODON_DIR}
cd ${MASTODON_DIR}
print_success "Directory created: ${MASTODON_DIR}"

# Step 9: Create docker-compose.yml
print_status "Creating docker-compose.yml..."
cat > docker-compose.yml <<'EOF'
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
      - LOCAL_DOMAIN=social.kodex.academy
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
EOF
print_success "docker-compose.yml created"

# Step 10: Configure Nginx
print_status "Configuring Nginx..."
cat > /etc/nginx/sites-available/mastodon <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/mastodon /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
print_success "Nginx configured"

# Step 11: Start Mastodon
print_status "Starting Mastodon containers..."
cd ${MASTODON_DIR}
docker compose up -d
print_success "Mastodon containers started"

# Wait for containers to be ready
print_status "Waiting for containers to be ready (30 seconds)..."
sleep 30

# Step 12: Initialize database
print_status "Setting up Mastodon database..."
docker compose run --rm web rails db:migrate
print_success "Database initialized"

# Step 13: Setup automatic SSL renewal
print_status "Setting up automatic SSL renewal..."
systemctl enable certbot.timer
systemctl start certbot.timer
print_success "SSL auto-renewal configured"

# Final status check
print_status "Checking container status..."
docker compose ps

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Your Mastodon instance should be accessible at:${NC}"
echo -e "${YELLOW}https://${DOMAIN}${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Visit https://${DOMAIN} in your browser"
echo "2. Create your admin account (first account is admin)"
echo "3. Go to Preferences → Development → New Application"
echo "4. Create an app called 'Crypto News Bot' with write:statuses scope"
echo "5. Copy the access token to your local bot's .env file"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "View logs:        docker compose logs --tail 50 web"
echo "Restart:          docker compose restart"
echo "Stop:             docker compose down"
echo "Check status:     docker compose ps"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT: Change your admin password after first login!${NC}"
echo ""

