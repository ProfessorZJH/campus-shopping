# 从现有七模块构建，不重新初始化脚手架；构建阶段会执行 JUnit（MySQL 类需另设变量）。
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY . .
RUN mvn -B -ntp clean verify

FROM eclipse-temurin:17-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 campus && useradd --uid 10001 --gid campus --no-create-home campus
WORKDIR /app
COPY --from=build /workspace/campus-shopping-app/target/campus-shopping-app.jar app.jar
RUN mkdir -p /app/var/uploads && chown -R campus:campus /app
USER campus
EXPOSE 8091
ENTRYPOINT ["java", "-jar", "/app/app.jar"]