# 🔑 SSH Key Information for New Hetzner Server

## Key Details

**Created:** October 11, 2025  
**Type:** ED25519 (modern, secure, fast)  
**Purpose:** Access to new Hetzner Mastodon server

---

## 📍 File Locations

**Private Key** (keep secret, never share):
```
/Users/cypherfunk/.ssh/hetzner_mastodon_new
```

**Public Key** (safe to share with Hetzner):
```
/Users/cypherfunk/.ssh/hetzner_mastodon_new.pub
```

---

## 🔐 Key Fingerprint

```
SHA256:1vBajstAO0XkkDhvlf3+QJhHSlQgs6vFuZhW1bRKkDM
```

Use this to verify you're connecting to the right server on first login.

---

## 📋 How to Use

### 1. Adding to Hetzner (During Server Creation)

In the Hetzner "Add an SSH key" dialog:

1. **SSH key field**: Paste the public key content (see below or run: `cat ~/.ssh/hetzner_mastodon_new.pub`)
2. **Name field**: Enter `cypher-mastodon-2025`
3. Check **"Set as default key"**
4. Click **"Add SSH key"**

### 2. Connecting to Your Server

Once server is created with IP address (e.g., 5.78.131.130):

```bash
ssh -i ~/.ssh/hetzner_mastodon_new root@YOUR_SERVER_IP
```

**First time connecting**, you'll see a fingerprint verification message. Type `yes` to accept.

### 3. Uploading the Deployment Script

```bash
scp -i ~/.ssh/hetzner_mastodon_new \
  "/Users/cypherfunk/Desktop/Desktop messy 2/tweet-bot 2/hetzner-mastodon-deploy.sh" \
  root@YOUR_SERVER_IP:/root/
```

---

## 💡 Quick Commands

**View public key** (to copy for Hetzner):
```bash
cat ~/.ssh/hetzner_mastodon_new.pub
```

**Copy public key to clipboard** (Mac):
```bash
cat ~/.ssh/hetzner_mastodon_new.pub | pbcopy
```

**Test SSH connection**:
```bash
ssh -i ~/.ssh/hetzner_mastodon_new root@YOUR_SERVER_IP
```

**Set correct permissions** (if needed):
```bash
chmod 600 ~/.ssh/hetzner_mastodon_new
chmod 644 ~/.ssh/hetzner_mastodon_new.pub
```

---

## 🔒 Security Notes

- ✅ **Private key** (`hetzner_mastodon_new`) stays on your Mac - NEVER upload this
- ✅ **Public key** (`hetzner_mastodon_new.pub`) is safe to share with Hetzner
- ✅ ED25519 keys are more secure and faster than older RSA keys
- ✅ No passphrase set (for convenience - set one if you prefer extra security)

---

## 🗑️ Old Key Cleanup (Optional)

You still have the old SSH key from the deleted server. You can remove it:

```bash
# Backup first (optional)
mv ~/.ssh/hetzner_mastodon ~/.ssh/hetzner_mastodon.old
mv ~/.ssh/hetzner_mastodon.pub ~/.ssh/hetzner_mastodon.pub.old

# Or delete directly
rm ~/.ssh/hetzner_mastodon ~/.ssh/hetzner_mastodon.pub
```

---

## 📝 Update Your ssh.md File

After creating the new server, update `/Users/cypherfunk/Desktop/Desktop messy 2/tweet-bot 2/ssh.md`:

```bash
# New SSH Command
ssh -i ~/.ssh/hetzner_mastodon_new root@NEW_IP_ADDRESS

# Server Details
- IP Address: [NEW IP]
- SSH Key: ~/.ssh/hetzner_mastodon_new
- Server: Hetzner Cloud CX22 (4GB RAM)
- Domain: social.cypheruniversity.com
```

---

## 🎯 Next Steps

1. ✅ SSH key created
2. ⏳ Copy public key and paste into Hetzner
3. ⏳ Create CX22 server in Hetzner
4. ⏳ Note the new IP address
5. ⏳ Update DNS to point to new IP
6. ⏳ SSH into server and run deployment script

---

**Need the public key content?** Run:
```bash
cat ~/.ssh/hetzner_mastodon_new.pub
```

Or copy directly to clipboard:
```bash
cat ~/.ssh/hetzner_mastodon_new.pub | pbcopy
```

