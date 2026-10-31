FROM node:22.16.0-bookworm-slim@sha256:048ed02c5fd52e86fda6fbd2f6a76cf0d4492fd6c6fee9e2c463ed5108da0e34 AS frontend
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# 从现有七模块构建，前端使用上一步从锁定依赖编译的产物。
FROM maven:3.9.9-eclipse-temurin-17@sha256:f58d59b6273e785ac0a4477f6e9b5ba1d7731c75b906c0f7b34076f1851318cc AS build
WORKDIR /workspace
COPY . .
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
COPY --from=frontend /workspace/frontend/dist /workspace/campus-shopping-app/target/generated-ui
RUN mvn -B -ntp verify -Dfrontend.skip=true

FROM eclipse-temurin:17-jre-jammy@sha256:c35794d1348777e6bc310b9b7f420098ef8f37e988199549b545fded79a895a2
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 campus && useradd --uid 10001 --gid campus --no-create-home campus
WORKDIR /app
COPY --from=build /workspace/campus-shopping-app/target/campus-shopping-app.jar app.jar
COPY --from=build /workspace/campus-shopping-app/target/release-manifest.json release-manifest.json
RUN mkdir -p /app/var/uploads && chown -R campus:campus /app
USER campus
EXPOSE 8091
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
