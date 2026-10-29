# Campus Shopping · 集成验收仓库

当前仓库已通过 GitHub 连接器初始化。**完整业务源码尚未导入**，不能把空仓库或工作流存在视为验收通过。

目标版本：v1.2.3（Java 17 / Spring Boot / MySQL 8 / Python FastAPI / Vue / NVIDIA + Milvus / 讯飞 MaaS）。

## 导入源码

从 ChatGPT 对话中下载 `campus-shopping-v1.2.3-nvidia-milvus-20261029.zip`。解压后将其中 `campus-shopping/` 下的全部源文件（包含 `.github`、`.gitignore` 等隐藏文件）复制到本仓库工作区，保留本仓库的 `.git/`；然后提交推送。**不要上传 .env、真实 API Key、数据库密码、日志或缓存。**

已有源码自带 `.github/workflows/full-release.yml`，在提交源码后会触发完整验收：Maven/JDK17、隔离 MySQL 8、Python 单测、真实 Spring HTTP 业务链路、Chromium 浏览器测试和结果 artifact。

## 外部 AI 验收

实际 NVIDIA / 讯飞 / Milvus 调用与普通 CI 分开。请先轮换此前在聊天中暴露的凭据，写入 GitHub Actions Secrets；Milvus 需要 TLS 或私网隧道及最小权限账户，**禁止公网明文 HTTP + root 密码**。

所有真正的构建及测试结论，以 [Actions](https://github.com/ProfessorZJH/campus-shopping/actions) 的运行日志与测试报告为准。