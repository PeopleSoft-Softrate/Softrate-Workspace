# Hostinger VPS Deployment

This repo cannot use a plain same-origin `/api/...` proxy for every backend because the sales and HRMS services both expose overlapping routes such as `/api/auth`.

Use unique proxy prefixes on the public subdomain:

- Sales backend: `/sales-api`
- CRM backend: `/crm-api`
- Tickets backend: `/tickets-api`
- Finance backend: `/finance-api`
- HRMS backend: `/hrms-api`

The production frontend configs in this repo now expect those prefixes.

## Frontend paths

Serve each Angular app on its own path:

- `/admin/` -> `apps/sales/admin-crm`
- `/sales/` -> `apps/sales/emp`
- `/hrms/` -> `apps/hrms/emp-hr`
- `/tickets/` -> `apps/tickets`
- `/finance/` -> `apps/finance`

Example production builds on the VPS:

```bash
cd apps/sales/admin-crm && npm run build -- --base-href /admin/ --output-path /var/www/softrate/admin
cd apps/sales/emp && npm run build -- --base-href /sales/ --output-path /var/www/softrate/sales
cd apps/hrms/emp-hr && npm run build -- --base-href /hrms/ --output-path /var/www/softrate/hrms
cd apps/tickets && npm run build -- --base-href /tickets/ --output-path /var/www/softrate/tickets
cd apps/finance && npm run build -- --base-href /finance/ --output-path /var/www/softrate/finance
```

You can also use the helper script:

```bash
bash deploy/scripts/build-frontends.sh /var/www/softrate
```

## Backend ports

Run each Node service locally on the VPS:

- `services/sales` -> `4000`
- `services/crm` -> `4100`
- `services/tickets` -> `4300`
- `services/finance` -> `4400`
- `services/hrms` -> `5001`

The Nginx template is in [hostinger-nginx.conf](/Users/pragit/Documents/GitHub/Softrate-Workspace/docs/hostinger-nginx.conf).

PM2 config for the APIs is in [ecosystem.config.cjs](/Users/pragit/Documents/GitHub/Softrate-Workspace/deploy/pm2/ecosystem.config.cjs).

A VPS bootstrap helper that installs Node, Nginx, Certbot, and PM2 is in [bootstrap-hostinger-vps.sh](/Users/pragit/Documents/GitHub/Softrate-Workspace/deploy/scripts/bootstrap-hostinger-vps.sh).

## HRMS env note

If you use the HRMS email/logo flow, set `BACKEND_URL` to the public proxied URL, not the local port:

```env
BACKEND_URL=https://your-subdomain.example.com/hrms-api
```

## Why this layout

- One subdomain can still host every frontend by using path-based routing.
- Unique API prefixes prevent route collisions between services.
- Sales SSE and HRMS Socket.IO continue to work through Nginx with the included proxy settings.
