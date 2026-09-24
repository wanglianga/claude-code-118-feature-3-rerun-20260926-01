# syntax=docker/dockerfile:1
# =========================================================
# 城市工地围挡公益广告排期与验收系统 - 一体化镜像
# 前端 React+TS+Zustand 构建为静态资源，后端 Express 同端口服务 API 与静态页
# =========================================================

# ---------- 阶段 1：构建前端 ----------
FROM node:20-alpine AS web-builder
WORKDIR /build
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------- 阶段 2：构建后端 ----------
FROM node:20-alpine AS server-builder
WORKDIR /build
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ---------- 阶段 3：运行时（非 root） ----------
FROM node:20-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data
WORKDIR /app
COPY --from=server-builder /build/node_modules ./node_modules
COPY --from=server-builder /build/dist ./dist
COPY --from=web-builder /build/dist ./public
# 数据目录（JSON 持久化 + 上传照片），授权给非 root 用户
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1
CMD ["node", "dist/index.js"]
