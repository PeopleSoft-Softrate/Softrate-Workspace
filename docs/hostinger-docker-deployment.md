# Hostinger Docker Deployment

This repo now includes a Docker Compose deployment path that is better suited for the Hostinger VPS than running Node directly on the host.

## Stack layout

- `gateway`: Nginx container that serves all frontend apps and proxies backend traffic
- `sales-api`
- `crm-api`
- `tickets-api`
- `finance-api`
- `hrms-api`

Only the gateway is public. All backend containers stay on the internal Docker network.

## Public paths

Frontends:

- `/admin/`
- `/sales/`
- `/hrms/`
- `/tickets/`
- `/finance/`

Backend proxies:

- `/sales-api`
- `/crm-api`
- `/tickets-api`
- `/finance-api`
- `/hrms-api`

## Files

- Compose stack: [docker-compose.yml](/Users/pragit/Documents/GitHub/Softrate-Workspace/docker-compose.yml)
- Gateway Dockerfile: [gateway.Dockerfile](/Users/pragit/Documents/GitHub/Softrate-Workspace/deploy/docker/gateway.Dockerfile)
- Gateway Nginx config: [gateway.conf](/Users/pragit/Documents/GitHub/Softrate-Workspace/deploy/docker/nginx/gateway.conf)
- API Dockerfiles: [deploy/docker/services](/Users/pragit/Documents/GitHub/Softrate-Workspace/deploy/docker/services)
- Compose env example: [.env.docker.example](/Users/pragit/Documents/GitHub/Softrate-Workspace/.env.docker.example)
- Helper script: [docker-up.sh](/Users/pragit/Documents/GitHub/Softrate-Workspace/deploy/scripts/docker-up.sh)

## Before first deploy

Create a compose env file:

```bash
cp .env.docker.example .env.docker
```

Update these values:

```env
GATEWAY_PORT=80
PUBLIC_BASE_URL=http://193.203.161.48
FINANCE_HRMS_MONGO_URI=
```

Notes:

- `PUBLIC_BASE_URL` should be the VPS URL now, and later `https://workspace.softrateglobal.com`
- `FINANCE_HRMS_MONGO_URI` is needed if the finance service reads HRMS data from a different Mongo URI than its own default

## Deploy

```bash
bash deploy/scripts/docker-up.sh .env.docker
```

Or directly:

```bash
docker compose --env-file .env.docker up -d --build
```

## Runtime env files

The API containers read secrets from the existing local files:

- `services/sales/.env`
- `services/crm/.env`
- `services/tickets/.env`
- `services/finance/.env`
- `services/hrms/.env`

The compose file overrides only the container-specific values that must change for Docker:

- service ports
- public frontend/backend base URLs
- ticket upload path

## Later when the domain is mapped

Change:

```env
PUBLIC_BASE_URL=https://workspace.softrateglobal.com
```

Then rebuild:

```bash
docker compose --env-file .env.docker up -d --build
```

HTTPS can be terminated either:

- in front of Docker by Hostinger/Nginx on the host, or
- by extending the gateway container with TLS certificates later

For now, this stack is prepared for HTTP by IP and HTTP/HTTPS by domain once DNS is ready.
