# Keep the runtime aligned with the Node 22 LTS version used by CI.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# The web build includes the Capacitor App callback bridge used by the Android wallet.
RUN npm install --no-save --package-lock=false @capacitor/core@^8 @capacitor/cli@^8 @capacitor/android@^8 @capacitor/assets@^3 @capacitor/app@^8 @capacitor/app-launcher@^8
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build --chown=10001:10001 /app/package.json /app/package-lock.json ./
COPY --from=build --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/dist ./dist
COPY --from=build --chown=10001:10001 /app/server ./server
RUN mkdir -p /data && chown -R 10001:10001 /data /app
USER 10001:10001
EXPOSE 3000
CMD ["npm", "start"]
