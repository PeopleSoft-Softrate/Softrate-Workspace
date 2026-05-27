FROM node:20-bookworm-slim
WORKDIR /app
COPY services/sales/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY services/sales/ ./
EXPOSE 4000
CMD ["node", "server.js"]

