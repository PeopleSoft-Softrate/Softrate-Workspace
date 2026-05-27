FROM node:20-bookworm-slim
WORKDIR /app
COPY services/crm/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY services/crm/ ./
EXPOSE 4100
CMD ["node", "server.js"]

