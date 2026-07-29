# syntax=docker/dockerfile:1
# ============================================================
# CINTESP WEB — imagem do front-end (build estático + nginx)
# A imagem é GENÉRICA: as variáveis do Supabase entram em RUNTIME
# (o container gera /config.js a partir do ambiente — ver docker/40-cintesp-env.sh).
# ============================================================

# ---------- Estágio 1: build do Vite ----------
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependências com o lockfile (build reproduzível).
COPY package.json package-lock.json ./
RUN npm ci

# Copia o código e gera o build de produção em /app/dist.
COPY . .
RUN npm run build

# ---------- Estágio 2: servidor estático (nginx) ----------
FROM nginx:1.27-alpine AS runtime

# Config do nginx (SPA fallback + cache).
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Arquivos estáticos do build.
COPY --from=build /app/dist /usr/share/nginx/html

# Script que gera /config.js a partir das variáveis de ambiente ANTES do
# nginx subir (a imagem base do nginx executa /docker-entrypoint.d/*.sh).
COPY docker/40-cintesp-env.sh /docker-entrypoint.d/40-cintesp-env.sh
RUN chmod +x /docker-entrypoint.d/40-cintesp-env.sh

EXPOSE 80
# CMD/ENTRYPOINT herdados da imagem nginx (roda os scripts e inicia o nginx).
