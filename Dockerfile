# Multi-stage Dockerfile para SafaSanha (LogiScan)
# Otimizado para TrueNAS SCALE (Docker / Docker Compose) e ambientes de produção

# --- Estágio 1: Builder ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copia manifestos de dependência
COPY package*.json ./

# Instala todas as dependências (incluindo devDependencies necessárias para o build)
RUN npm install

# Copia o código-fonte da aplicação
COPY . .

# Executa o build de produção (Vite SPA + Server bundle CJS)
RUN npm run build

# --- Estágio 2: Runner ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Instala apenas dependências de produção necessárias em tempo de execução
COPY package*.json ./
RUN npm install --omit=dev --no-audit && npm cache clean --force

# Copia os artefatos compilados do estágio anterior
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/index.html ./index.html

# Expõe a porta padrão do servidor
EXPOSE 3000

# Healthcheck nativo em Node.js (sem necessidade de curl ou ferramentas externas)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health', (r) => { if (r.statusCode !== 200) process.exit(1); })"

# Inicia o servidor em modo de produção
CMD ["npm", "start"]
