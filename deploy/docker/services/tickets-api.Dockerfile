FROM node:20-bookworm-slim
WORKDIR /app
COPY services/tickets/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY services/tickets/ ./
RUN mkdir -p /app/uploads/tickets
EXPOSE 4300
CMD ["node", "server.js"]

