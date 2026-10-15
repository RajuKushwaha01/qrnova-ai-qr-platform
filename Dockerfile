FROM node:20-alpine
ENV NODE_ENV=production PORT=3000 \
    DATA_DIR=/data/db STORAGE_DIR=/data/storage UPLOADS_DIR=/data/uploads
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY . .
RUN mkdir -p /data/db /data/storage /data/uploads && chown -R node:node /app /data
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]