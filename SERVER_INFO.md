# 🖥️ Hetzner Server Information

**Created:** October 11, 2025  
**Status:** Active ✅

---

## 📍 Server Details

| Property | Value |
|----------|-------|
| **Name** | cypher-mastodon |
| **Server ID** | #110599164 |
| **Type** | CX22 |
| **vCPUs** | 2 |
| **RAM** | 4 GB |
| **Storage** | 40 GB SSD |
| **Location** | Helsinki (hel1) |
| **IPv4** | `46.62.208.186` |
| **IPv6** | `2a01:4f9:c013:5553::/64` |
| **Domain** | social.cypheruniversity.com |

---

## 💰 Pricing

| Item | Cost |
|------|------|
| **Monthly** | €3.29/month |
| **Hourly** | €0.005/hour |
| **Traffic Included** | 20 TB/month |
| **Current Usage** | 0.01 GB |

---

## 🔐 SSH Access

**Quick Command:**
```bash
ssh -i ~/.ssh/hetzner_mastodon_new root@46.62.208.186
```

**SSH Key Details:**
- Private key: `~/.ssh/hetzner_mastodon_new`
- Public key: `~/.ssh/hetzner_mastodon_new.pub`
- Key name: `cypher-mastodon-2025`
- Key type: ED25519
- Fingerprint: `SHA256:1vBajstAO0XkkDhvlf3+QJhHSlQgs6vFuZhW1bRKkDM`

---

## 🌐 DNS Configuration

**Domain:** social.cypheruniversity.com  
**DNS Provider:** Cloudflare

**Required A Record:**
```
Type: A
Name: social
IPv4 address: 46.62.208.186
Proxy status: DNS only (gray cloud) - IMPORTANT for initial setup
TTL: Auto
```

**⚠️ IMPORTANT:** Use **DNS only** (gray cloud icon) during initial setup. After SSL is working, you can enable Cloudflare proxy (orange cloud) if desired.

**Check DNS Propagation:**
```bash
dig social.cypheruniversity.com
```

Expected output should show: `46.62.208.186`

---

## 📦 Installed Software

After deployment script runs, the server will have:

- ✅ Ubuntu 22.04 LTS
- ✅ Docker & Docker Compose
- ✅ Nginx (web server)
- ✅ Certbot (SSL certificates)
- ✅ PostgreSQL 14 (in Docker)
- ✅ Redis 7 (in Docker)
- ✅ Mastodon v4.2.0 (in Docker)
- ✅ UFW Firewall (ports 22, 80, 443 open)

---

## 🔧 Important Directories

| Path | Purpose |
|------|---------|
| `/opt/mastodon/` | Mastodon installation directory |
| `/opt/mastodon/docker-compose.yml` | Docker configuration |
| `/opt/mastodon/postgres/` | PostgreSQL data |
| `/opt/mastodon/redis/` | Redis data |
| `/opt/mastodon/public/` | Mastodon public files |
| `/etc/nginx/sites-available/mastodon` | Nginx config |
| `/etc/letsencrypt/live/social.cypheruniversity.com/` | SSL certificates |

---

## 🔒 Security Configuration

**Firewall (UFW):**
- Port 22 (SSH) - Open
- Port 80 (HTTP) - Open (redirects to HTTPS)
- Port 443 (HTTPS) - Open
- All other ports - Blocked

**SSL/TLS:**
- Provider: Let's Encrypt
- Auto-renewal: Enabled via certbot.timer
- Certificate validity: 90 days
- Renewal checks: Twice daily

**Security Headers:**
- Strict-Transport-Security enabled
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff

---

## 📊 Resource Usage

**Current Status:**
- CPU: Low usage expected
- RAM: ~2-3GB used (out of 4GB)
- Disk: ~5-10GB used (out of 40GB)
- Traffic: 0/20TB

**Expected Usage:**
- Bot posting: Minimal CPU/RAM
- User growth: Scales with PostgreSQL
- Media uploads: Uses disk space

---

## 🔄 Backup Information

**Hetzner Snapshots:** Not enabled (costs +20% = €0.66/month extra)

**Manual Backup Commands:**

Database backup:
```bash
cd /opt/mastodon
docker compose exec db pg_dump -U mastodon mastodon > backup_$(date +%Y%m%d).sql
```

Full directory backup:
```bash
tar -czf mastodon-backup-$(date +%Y%m%d).tar.gz /opt/mastodon
```

---

## 🛠️ Useful Commands

**Check server status:**
```bash
# View running containers
docker compose ps

# View logs
docker compose logs --tail 50 web

# Restart services
docker compose restart

# Check firewall status
ufw status

# Check SSL certificate
certbot certificates

# Monitor resources
htop
df -h
free -h
```

---

## 📞 Support & Resources

**Hetzner:**
- Console: https://console.hetzner.cloud/
- Docs: https://docs.hetzner.com/
- Support: Via console ticket system

**Mastodon:**
- Docs: https://docs.joinmastodon.org/
- Instance: https://social.cypheruniversity.com

**Server Access Issues:**
- Check firewall: `ufw status`
- Check services: `systemctl status nginx docker`
- View logs: `journalctl -xe`

---

## 📅 Important Dates

- **Created:** October 11, 2025
- **SSL Valid Until:** ~January 9, 2026 (90 days, auto-renews)
- **Next DNS Review:** Check if propagation complete
- **First Backup:** Schedule after deployment complete

---

## ⚠️ Important Notes

1. **Keep SSH key secure** - Never share `hetzner_mastodon_new` private key
2. **Regular updates** - Run `apt update && apt upgrade` monthly
3. **Monitor disk space** - Media uploads can fill disk
4. **Backup regularly** - Database backups recommended weekly
5. **Check bot logs** - Ensure posting is working correctly

---

## 🎯 Next Steps After Creation

- [x] Server created
- [x] SSH key configured
- [ ] DNS updated to point to 46.62.208.186
- [ ] SSH connection tested
- [ ] Deployment script uploaded
- [ ] Deployment script executed
- [ ] Mastodon instance verified
- [ ] Admin account created
- [ ] Bot API token obtained
- [ ] Local bot configured
- [ ] Test post successful

---

**Server Dashboard:** https://console.hetzner.cloud/projects → cypher-mastodon

