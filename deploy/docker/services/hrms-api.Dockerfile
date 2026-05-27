FROM node:20-bookworm-slim
WORKDIR /app
COPY services/hrms/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY services/hrms/ ./
EXPOSE 5001
CMD ["node", "server.js"]

