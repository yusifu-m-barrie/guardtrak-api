# SSL configuration (Let's Encrypt)

Use Certbot with the Nginx plugin after the HTTP site is serving.

## Issue certificate

```bash
sudo certbot --nginx -d api.example.com
```

Certbot modifies the site to listen on 443 with certificates under `/etc/letsencrypt/live/api.example.com/`.

## Expected HTTPS server block (after certbot)

Certbot typically adds:

```nginx
listen 443 ssl;
ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
include             /etc/letsencrypt/options-ssl-nginx.conf;
ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
```

And an HTTP→HTTPS redirect on port 80.

## Application settings

With TLS terminated at Nginx:

```env
TRUST_PROXY=true
CORS_ORIGINS=https://app.example.com
WS_CORS_ORIGINS=https://app.example.com
```

## Renewal

```bash
sudo certbot renew --dry-run
sudo systemctl status certbot.timer
```

## Manual TLS (without Certbot)

Place fullchain and key on disk, then:

```nginx
listen 443 ssl http2;
ssl_certificate     /etc/ssl/certs/guardtrak-fullchain.pem;
ssl_certificate_key /etc/ssl/private/guardtrak.key;
```

Prefer Certbot on Hostinger / DigitalOcean / EC2 / Azure Ubuntu images.
