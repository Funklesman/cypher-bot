# ⚡ Quick Start - Mastodon Deployment

**TL;DR:** 5 steps to get your Mastodon + Bot running again

---

## 🎯 What You Need

- [ ] 15 minutes
- [ ] Hetzner Cloud account
- [ ] Credit card for Hetzner (~$5/month)

---

## 📍 5 Simple Steps

### 1️⃣ Create Hetzner Server (5 min)

1. Go to https://console.hetzner.cloud/
2. Click **"+ Add Server"**
3. Choose:
   - **Location**: Any (Hillsboro is closest to you)
   - **Image**: Ubuntu 22.04
   - **Type**: CPX11 (2GB RAM)
   - **SSH Key**: Upload `~/.ssh/hetzner_mastodon.pub`
4. Click **"Create & Buy"**
5. **Copy the IP address** (e.g., 5.161.250.11)

---

### 2️⃣ Update DNS in Cloudflare (2 min)

1. Log into **Cloudflare** (https://dash.cloudflare.com/)
2. Click on `cypheruniversity.com` domain
3. Go to **DNS** settings
4. Edit the A record for `social`:
   - IPv4 address: **5.161.250.11**
   - Proxy status: **DNS only** (gray cloud) ⚠️
5. Save

Wait 1-5 minutes for DNS to propagate (Cloudflare is fast!).

---

### 3️⃣ Run Deployment Script (10 min)

**On your Mac, run these commands:**

```bash
# SSH into your new server (replace with your IP)
ssh -i ~/.ssh/hetzner_mastodon root@YOUR_NEW_IP

# If you get a host key warning:
# ssh-keygen -R YOUR_NEW_IP
# Then try SSH again

# Download and run the deployment script
curl -o deploy.sh https://raw.githubusercontent.com/[OR PASTE MANUALLY]

# OR copy/paste the script:
nano deploy.sh
# Paste content from hetzner-mastodon-deploy.sh
# Press Ctrl+X, Y, Enter

# Make it executable and run
chmod +x deploy.sh
./deploy.sh
```

**Sit back and watch the magic happen! ☕**

The script will:
- Install everything
- Get SSL certificate
- Start Mastodon
- Takes ~10 minutes

---

### 4️⃣ Create Admin Account (2 min)

1. Go to **https://social.cypheruniversity.com**
2. Click **"Create account"**
3. Fill in details (you'll be admin automatically)
4. Log in
5. Go to **Preferences → Development → New Application**
6. Create app:
   - Name: `Crypto News Bot`
   - Scopes: Check `write:statuses`
7. **Copy the Access Token**

---

### 5️⃣ Configure Your Bot (1 min)

**On your Mac:**

```bash
cd "/Users/cypherfunk/Desktop/Desktop messy 2/tweet-bot 2"

# Edit .env
nano .env

# Update these lines:
MASTODON_API_URL=https://social.cypheruniversity.com/api/v1/
MASTODON_ACCESS_TOKEN=[PASTE YOUR TOKEN]
MASTODON_POST_ENABLED=true

# Save (Ctrl+X, Y, Enter)

# Test it!
npm run post:single
```

---

## ✅ Done!

Your bot should now post to Mastodon! Check https://social.cypheruniversity.com

---

## 🚀 Start Bot in Production

```bash
cd "/Users/cypherfunk/Desktop/Desktop messy 2/tweet-bot 2"
npm run start:prod
```

---

## 🆘 Problems?

### DNS Not Working Yet
Wait 30 minutes, DNS can be slow. Check with:
```bash
dig social.cypheruniversity.com
```

### SSL Certificate Failed
The script will tell you if DNS isn't ready. Wait and re-run.

### Can't SSH
Clear old host key:
```bash
ssh-keygen -R YOUR_NEW_IP
```

### Bot Can't Post
Check your access token is correct in `.env`

---

## 📚 Full Documentation

See `DEPLOYMENT_GUIDE.md` for detailed instructions and troubleshooting.

---

**That's it! You're back online! 🎉**

