# 🚀 Mastodon Server Deployment Guide

Complete guide to deploy your Mastodon instance on Hetzner Cloud for the Crypto News Bot.

## 📋 Prerequisites

- [ ] Hetzner Cloud account
- [ ] SSH key at `~/.ssh/hetzner_mastodon` (you already have this!)
- [ ] Access to your DNS provider (Wix)

---

## Step 1: Create New Hetzner Server

### 1.1 Log into Hetzner Cloud Console
Go to: https://console.hetzner.cloud/

### 1.2 Create New Server

**Basic Settings:**
- **Location**: Choose closest to you (e.g., Hillsboro, USA)
- **Image**: Ubuntu 22.04
- **Type**: CPX11 (2 vCPUs, 2GB RAM) - ~€4.51/month
- **Volume**: None needed

**Networking:**
- **IPv4**: ✓ Enable
- **IPv6**: ✓ Enable (optional)

**SSH Keys:**
- Upload your public key from `~/.ssh/hetzner_mastodon.pub`
- OR create a new key pair

**Server Name:**
- Name: `cypher-mastodon` (or your preference)

**Click "Create & Buy Now"**

### 1.3 Note Your New IP Address
Once created, note the **IPv4 address** (e.g., `5.78.131.130`)

---

## Step 2: Update DNS in Cloudflare

### 2.1 Log into Cloudflare
Go to: https://dash.cloudflare.com/

### 2.2 Select Your Domain
Click on `cypheruniversity.com`

### 2.3 Go to DNS Settings
Click **DNS** in the left sidebar

### 2.4 Update or Create A Record

**If `social` A record exists:**
1. Click **Edit** on the existing `social` A record
2. Update **IPv4 address** to: `46.62.208.186`
3. Set **Proxy status**: **DNS only** (gray cloud) ⚠️ Important!
4. Click **Save**

**If `social` A record doesn't exist:**
1. Click **Add record**
2. **Type**: A
3. **Name**: social
4. **IPv4 address**: 46.62.208.186
5. **Proxy status**: **DNS only** (gray cloud) ⚠️ Important!
6. **TTL**: Auto
7. Click **Save**

### 2.5 Why "DNS only" (Gray Cloud)?

During initial setup, SSL certificate generation needs direct access to your server. After SSL is working, you can enable Cloudflare proxy (orange cloud) if desired.

### 2.6 Wait for DNS Propagation
Check DNS propagation (usually 1-5 minutes with Cloudflare):
```bash
dig social.cypheruniversity.com
```

Should show: `46.62.208.186`

---

## Step 3: Upload and Run Deployment Script

### 3.1 SSH into Your New Server
```bash
ssh -i ~/.ssh/hetzner_mastodon root@[YOUR_NEW_IP]
```

If you get a host key warning (because old server is gone):
```bash
ssh-keygen -R [YOUR_NEW_IP]
ssh-keygen -R social.cypheruniversity.com
```

### 3.2 Upload the Deployment Script

**Option A - Using SCP:**
```bash
# From your Mac
scp -i ~/.ssh/hetzner_mastodon \
  "/Users/cypherfunk/Desktop/Desktop messy 2/tweet-bot 2/hetzner-mastodon-deploy.sh" \
  root@[YOUR_NEW_IP]:/root/
```

**Option B - Copy/Paste:**
```bash
# On the server
nano /root/hetzner-mastodon-deploy.sh
# Paste the script content
# Press Ctrl+X, then Y, then Enter
```

### 3.3 Make Script Executable
```bash
chmod +x /root/hetzner-mastodon-deploy.sh
```

### 3.4 Run the Deployment Script
```bash
/root/hetzner-mastodon-deploy.sh
```

**What the script does:**
- ✅ Updates system packages
- ✅ Installs Docker & Nginx
- ✅ Configures firewall
- ✅ Obtains SSL certificate (Let's Encrypt)
- ✅ Sets up Mastodon with PostgreSQL & Redis
- ✅ Configures auto-renewal for SSL
- ✅ Starts all services

**Duration:** ~10-15 minutes

---

## Step 4: Create Admin Account & Get API Token

### 4.1 Visit Your Mastodon Instance
Go to: **https://social.cypheruniversity.com**

### 4.2 Create Your Account
- Click **"Create account"**
- Fill in details (first account becomes admin automatically)
- Username: `Funklesfunk` (or your preference)
- Email: Your email
- Password: Create a strong password

### 4.3 Create Bot API Application

1. Log in to your new account
2. Go to **Preferences** (⚙️ icon)
3. Click **Development** in left sidebar
4. Click **New Application**
5. Fill in:
   - **Application name**: `Crypto News Bot`
   - **Redirect URI**: Leave default
   - **Scopes**: Check `write:statuses`
6. Click **Submit**
7. Click on your new application name
8. **Copy the Access Token**

### 4.4 Update Your Local Bot Configuration

Edit your local `.env` file:
```bash
# On your Mac
nano "/Users/cypherfunk/Desktop/Desktop messy 2/tweet-bot 2/.env"
```

Update these lines:
```bash
MASTODON_API_URL=https://social.cypheruniversity.com/api/v1/
MASTODON_ACCESS_TOKEN=[PASTE_YOUR_ACCESS_TOKEN_HERE]
MASTODON_POST_ENABLED=true
```

---

## Step 5: Test Your Bot

### 5.1 Test Mastodon Connection
```bash
cd "/Users/cypherfunk/Desktop/Desktop messy 2/tweet-bot 2"
npm run post:single
```

This should:
- ✅ Fetch crypto news
- ✅ Generate a post using AI
- ✅ Post to your Mastodon instance

### 5.2 Check Your Mastodon
Go to https://social.cypheruniversity.com and verify the post appears!

---

## 🎉 Success Checklist

- [ ] Hetzner server created
- [ ] DNS updated and propagated
- [ ] Deployment script completed successfully
- [ ] Mastodon accessible at https://social.cypheruniversity.com
- [ ] Admin account created
- [ ] Bot API token obtained and configured
- [ ] Test post successful

---

## 🔧 Useful Commands

### On Hetzner Server (SSH):

```bash
# View Mastodon logs
cd /opt/mastodon
docker compose logs --tail 50 web

# Restart Mastodon
docker compose restart

# Check container status
docker compose ps

# Stop all services
docker compose down

# Start all services
docker compose up -d

# Check SSL certificate
certbot certificates

# View nginx logs
tail -f /var/log/nginx/error.log

# Check if ports are listening
netstat -tulpn | grep -E '(:80|:443|:3000)'
```

### On Your Mac (Local Bot):

```bash
cd "/Users/cypherfunk/Desktop/Desktop messy 2/tweet-bot 2"

# Post a single update
npm run post:single

# Start in testing mode (posts every 30 min)
npm start

# Start in production mode (posts every 6 hours)
npm run start:prod

# Generate crypto diary
npm run diary:generate

# Check bot status
./check-tweetbot.sh
```

---

## 🚨 Troubleshooting

### DNS Not Propagating
```bash
# Check current DNS
dig social.cypheruniversity.com

# Force clear local DNS cache (Mac)
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

### SSL Certificate Failed
```bash
# On server, check if port 80 is accessible
curl -I http://social.cypheruniversity.com

# Retry certificate manually
systemctl stop nginx
certbot certonly --standalone -d social.cypheruniversity.com
systemctl start nginx
```

### Mastodon Not Starting
```bash
# Check logs
cd /opt/mastodon
docker compose logs web
docker compose logs db
docker compose logs redis

# Restart everything
docker compose down
docker compose up -d
```

### Bot Can't Connect
```bash
# Test from your Mac
curl -I https://social.cypheruniversity.com/api/v1/instance

# Should return HTTP 200 OK
```

---

## 📊 Monitoring & Maintenance

### SSL Certificate Auto-Renewal
The script sets up automatic renewal. Check status:
```bash
systemctl status certbot.timer
systemctl list-timers | grep certbot
```

### Backups (Recommended)

**Database backup:**
```bash
cd /opt/mastodon
docker compose exec db pg_dump -U mastodon mastodon > backup_$(date +%Y%m%d).sql
```

**Full backup:**
```bash
# Enable Hetzner snapshots in Cloud Console (costs extra)
# Or use rsync to backup /opt/mastodon directory
```

---

## 📝 Important Files & Locations

**On Hetzner Server:**
- Mastodon directory: `/opt/mastodon/`
- Docker compose file: `/opt/mastodon/docker-compose.yml`
- Nginx config: `/etc/nginx/sites-available/mastodon`
- SSL certificates: `/etc/letsencrypt/live/social.cypheruniversity.com/`
- Logs: `/var/log/nginx/` and `docker compose logs`

**On Your Mac:**
- Bot directory: `/Users/cypherfunk/Desktop/Desktop messy 2/tweet-bot 2/`
- Configuration: `.env` file
- Logs: `logs/` directory
- SSH key: `~/.ssh/hetzner_mastodon`

---

## 🔐 Security Notes

✅ **Already configured in the script:**
- Firewall (UFW) enabled
- HTTPS only (HTTP redirects to HTTPS)
- Security headers configured
- SSL/TLS enabled

📝 **You should also:**
- Change admin password after first login
- Keep the server updated: `apt update && apt upgrade`
- Consider setting up fail2ban for SSH protection
- Regular backups (Hetzner snapshots or manual)

---

## 💰 Costs

- **Hetzner CPX11**: ~€4.51/month (~$5/month)
- **Bandwidth**: 20TB included (more than enough)
- **Backups**: +20% if enabled (~€0.90/month)

**Total**: ~$5-6/month

---

## 🎯 Next Steps After Deployment

1. **Customize your Mastodon instance**
   - Upload profile picture
   - Set server description
   - Configure server rules

2. **Run your bot in production**
   ```bash
   cd "/Users/cypherfunk/Desktop/Desktop messy 2/tweet-bot 2"
   npm run start:prod
   ```

3. **Enable cross-posting** (optional)
   - Configure X/Twitter posting
   - Configure Bluesky posting
   - See README.md for details

4. **Set up monitoring**
   - Monitor server resources
   - Check bot logs regularly
   - Ensure posts are going through

---

## 📞 Support Resources

- **Mastodon Docs**: https://docs.joinmastodon.org/
- **Docker Docs**: https://docs.docker.com/
- **Hetzner Support**: https://docs.hetzner.com/
- **Let's Encrypt**: https://letsencrypt.org/docs/

---

**Created:** October 11, 2025  
**For:** Cypher University Crypto News Bot  
**Domain:** social.cypheruniversity.com

