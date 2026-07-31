FROM node:20-bookworm-slim
WORKDIR /workspace/services/finance
COPY services/finance/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY services/finance/ ./
RUN mkdir -p /workspace/services/crm/src/modules/amc
COPY services/crm/src/modules/amc/amcService.js /workspace/services/crm/src/modules/amc/amcService.js
EXPOSE 4400
CMD ["node", "server.js"]
