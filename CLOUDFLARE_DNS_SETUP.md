# ☁️ Cloudflare DNS Setup for Mastodon

Quick guide to update DNS in Cloudflare for your new Hetzner server.

---

## 🎯 What You Need

- Cloudflare account access
- Domain: `cypheruniversity.com`
- New server IP: `46.62.208.186`

---

## 📝 Step-by-Step Instructions

### 1. Log into Cloudflare
Go to: **https://dash.cloudflare.com/**

### 2. Select Your Domain
Click on **cypheruniversity.com** in your domains list

### 3. Go to DNS Settings
Click **DNS** in the left sidebar menu

### 4. Find or Create the `social` A Record

#### If the record already exists:
1. Find the row with **Name**: `social`
2. Click **Edit** button
3. Update **IPv4 address** to: `46.62.208.186`
4. **⚠️ IMPORTANT:** Click the cloud icon to set it to **DNS only** (gray cloud)
5. Click **Save**

#### If the record doesn't exist:
1. Click **Add record** button
2. Fill in:
   - **Type**: A
   - **Name**: `social`
   - **IPv4 address**: `46.62.208.186`
   - **Proxy status**: Click to set **DNS only** (gray cloud icon)
   - **TTL**: Auto (default)
3. Click **Save**

---

## ⚠️ Critical: Proxy Status (Gray Cloud)

**During initial setup, use "DNS only" (gray cloud icon)**

### Why?

- Let's Encrypt (SSL certificate) needs direct access to your server
- Cloudflare proxy (orange cloud) would block SSL verification
- After SSL is working, you can enable proxy if desired

### How to identify:

- **Gray cloud** ☁️ = DNS only (direct to server) ✅ Use this initially
- **Orange cloud** 🟠 = Proxied through Cloudflare ❌ Don't use yet

---

## 🔍 Verify DNS Update

### In Cloudflare Dashboard:
You should see:
```
Type: A
Name: social
Content: 46.62.208.186
Proxy status: DNS only (gray cloud)
TTL: Auto
```

### From Your Terminal:
```bash
# Check DNS resolution
dig social.cypheruniversity.com

# Should show in the ANSWER section:
# social.cypheruniversity.com. 300 IN A 46.62.208.186
```

---

## ⏱️ DNS Propagation Time

**Cloudflare is fast!**
- Typical propagation: 1-5 minutes
- Maximum wait: 10-15 minutes

### Check if DNS is ready:
```bash
# Method 1: Using dig
dig social.cypheruniversity.com +short
# Should return: 46.62.208.186

# Method 2: Using nslookup
nslookup social.cypheruniversity.com
# Should show: 46.62.208.186

# Method 3: Using ping
ping -c 1 social.cypheruniversity.com
# Should ping: 46.62.208.186
```

---

## 🔄 After SSL Certificate is Installed

Once Mastodon is up and running with SSL certificate, you can **optionally** enable Cloudflare proxy:

### Benefits of Cloudflare Proxy (Orange Cloud):
- ✅ DDoS protection
- ✅ CDN/caching for faster loading
- ✅ Hide your origin server IP
- ✅ Additional firewall rules
- ✅ Analytics

### To Enable:
1. Go back to DNS settings in Cloudflare
2. Click **Edit** on the `social` A record
3. Click the cloud icon to change to **orange** (Proxied)
4. Click **Save**

**Note:** You'll need to adjust Cloudflare SSL settings:
- Go to **SSL/TLS** → **Overview**
- Set SSL mode to: **Full (strict)**

---

## 🐛 Troubleshooting

### DNS not updating?
- Clear local DNS cache:
  ```bash
  # Mac
  sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
  ```
- Wait 5 more minutes
- Check in incognito/private browser window

### Still showing old IP?
- Verify you saved the changes in Cloudflare
- Check you're editing the right domain
- Some ISPs cache DNS longer - try `8.8.8.8` (Google DNS):
  ```bash
  dig @8.8.8.8 social.cypheruniversity.com
  ```

### Can't access after enabling proxy?
- Check SSL/TLS mode is set to **Full (strict)**
- Verify origin certificate is valid
- Check Cloudflare firewall rules aren't blocking

---

## 📋 Quick Reference

**Current Setup:**
- Domain: `social.cypheruniversity.com`
- Points to: `46.62.208.186`
- DNS Provider: Cloudflare
- Initial proxy: DNS only (gray cloud)

**After deployment:**
- Can enable: Proxied (orange cloud)
- SSL mode: Full (strict)
- HTTPS: Enabled

---

## 🔗 Useful Links

- Cloudflare Dashboard: https://dash.cloudflare.com/
- Cloudflare DNS Docs: https://developers.cloudflare.com/dns/
- SSL/TLS Settings: https://dash.cloudflare.com/ → Your domain → SSL/TLS

---

**Status Checklist:**
- [ ] Logged into Cloudflare
- [ ] Found cypheruniversity.com domain
- [ ] Updated/created `social` A record
- [ ] Set to 46.62.208.186
- [ ] Proxy status: DNS only (gray cloud)
- [ ] Saved changes
- [ ] Verified with dig command
- [ ] DNS propagated successfully

