FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "tsx", "src/server.ts"]
