FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000
VOLUME ["/app/server/data"]
CMD ["node", "server/index.js"]