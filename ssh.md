# SSH Access to Hetzner Server

## Quick SSH Command

```bash
ssh -i ~/.ssh/hetzner_mastodon_new root@46.62.208.186
```

## Server Details
- **IP Address**: `46.62.208.186`
- **Username**: `root`
- **SSH Key**: `~/.ssh/hetzner_mastodon_new`
- **Server**: Hetzner Cloud CX22 `#110599164 cypher-mastodon`
- **Server Type**: CX22 (2 vCPU, 4GB RAM, 40GB SSD)
- **Domain**: `social.cypheruniversity.com`
- **Created**: October 11, 2025

## First Time Connection

If you get a "host key verification" prompt, type `yes` to accept:

```
The authenticity of host '5.78.131.130 (5.78.131.130)' can't be established.
ED25519 key fingerprint is SHA256:VGB/q9R/tz9mQyxE0biJuwakGsgac0r8cyVmlwPdOvA.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
```

## Troubleshooting

### Host Key Changed Error

If you see this error:
```
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
```

Clear the old host key:
```bash
ssh-keygen -R 5.78.131.130
```

Then try connecting again.

### Permission Issues

If SSH key permissions are wrong:
```bash
chmod 600 ~/.ssh/hetzner_mastodon
chmod 700 ~/.ssh
```

### Bypass Host Key Checking (Emergency)

If you need to bypass host key checking:
```bash
ssh -o StrictHostKeyChecking=no -i ~/.ssh/hetzner_mastodon root@5.78.131.130
```

## Hetzner Rescue System

If you need to access rescue mode:

1. **Enable Rescue in Hetzner Console**:
   - Go to your server in Hetzner Cloud Console
   - Click **"Rescue"** tab
   - Click **"Enable Rescue System"**
   - Note the rescue password provided
   - **Reboot** the server

2. **Connect to Rescue**:
   ```bash
   ssh root@5.78.131.130
   # Use the rescue password when prompted
   ```

3. **Mount Your System** (if needed):
   ```bash
   mount /dev/sda1 /mnt
   mount --bind /dev /mnt/dev
   mount --bind /proc /mnt/proc
   mount --bind /sys /mnt/sys
   chroot /mnt /bin/bash
   ```

4. **Disable Rescue When Done**:
   - Go back to Hetzner Console
   - Click **"Disable Rescue System"**
   - **Reboot** to normal mode

## Services on Server

- **Nginx**: Web server for Mastodon
- **Mastodon**: Social media instance at `social.cypheruniversity.com`
- **SSL Certificate**: Let's Encrypt (auto-renewed)

## Common Commands

Check nginx status:
```bash
systemctl status nginx
```

Check SSL certificate:
```bash
certbot certificates
```

Test Mastodon site:
```bash
curl -I https://social.cypheruniversity.com
```

## Notes

- SSH key was set up on: October 11, 2025
- Server timezone: UTC
- Server created: October 11, 2025
- SSH key fingerprint: `SHA256:1vBajstAO0XkkDhvlf3+QJhHSlQgs6vFuZhW1bRKkDM`
