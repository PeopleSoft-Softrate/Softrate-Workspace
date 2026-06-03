FROM node:20-bookworm-slim AS sales-admin-build
WORKDIR /workspace/apps/sales/admin-crm
COPY apps/sales/admin-crm/package*.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund || npm install --legacy-peer-deps --no-audit --no-fund
COPY apps/sales/admin-crm/ ./
RUN npm run build -- --base-href /admin/

FROM node:20-bookworm-slim AS sales-employee-build
WORKDIR /workspace/apps/sales/emp
COPY apps/sales/emp/package*.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund || npm install --legacy-peer-deps --no-audit --no-fund
COPY apps/sales/emp/ ./
RUN chmod +x ./scripts/run-angular.sh && npm run build -- --base-href /sales/

FROM node:20-bookworm-slim AS hrms-build
WORKDIR "/workspace/apps/peoplespft-multi terent"
COPY ["apps/peoplespft-multi terent/package*.json", "./"]
RUN npm ci --legacy-peer-deps --no-audit --no-fund || npm install --legacy-peer-deps --no-audit --no-fund
COPY ["apps/peoplespft-multi terent/", "./"]
RUN npm run build -- --base-href /hrms/

FROM node:20-bookworm-slim AS tickets-build
WORKDIR /workspace/apps/tickets
COPY apps/tickets/package*.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund || npm install --legacy-peer-deps --no-audit --no-fund
COPY apps/tickets/ ./
RUN npm run build -- --base-href /tickets/

FROM node:20-bookworm-slim AS finance-build
WORKDIR /workspace/apps/finance
COPY apps/finance/package*.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund || npm install --legacy-peer-deps --no-audit --no-fund
COPY apps/finance/ ./
RUN npm run build -- --base-href /finance/

FROM nginx:1.27-alpine
COPY deploy/docker/nginx/gateway.conf /etc/nginx/conf.d/default.conf
COPY deploy/docker/nginx/workspace-routes.conf /etc/nginx/snippets/workspace-routes.conf
RUN mkdir -p /usr/share/nginx/html/admin \
    /usr/share/nginx/html/sales \
    /usr/share/nginx/html/hrms \
    /usr/share/nginx/html/tickets \
    /usr/share/nginx/html/finance
COPY --from=sales-admin-build /workspace/apps/sales/admin-crm/dist/web-page/browser/ /usr/share/nginx/html/admin/
COPY --from=sales-employee-build /workspace/apps/sales/emp/dist/employee-ui/browser/ /usr/share/nginx/html/sales/
COPY --from=hrms-build ["/workspace/apps/peoplespft-multi terent/dist/admin-page/browser/", "/usr/share/nginx/html/hrms/"]
COPY --from=tickets-build /workspace/apps/tickets/dist/client-ticket-portal/browser/ /usr/share/nginx/html/tickets/
COPY --from=finance-build /workspace/apps/finance/dist/web-page/browser/ /usr/share/nginx/html/finance/
