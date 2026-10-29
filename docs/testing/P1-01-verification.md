# P1-01 实际验证记录

> 代码已写入工程副本，不等于编译通过或已部署。

## 1. 执行环境

当前容器有 JDK 21，没有 Maven、MySQL 服务或 Docker；连接 Maven Central 的 DNS 解析失败。代码目标仍为 Java 17，没有改成 Java 21 项目。

实际执行 `mvn -B -ntp clean verify` 返回退出码 127，原因：`mvn: command not found`。这是环境阻塞，不是测试通过。

## 2. 已执行的检查

- 使用 JDK 解析器和 `--release 17 -proc:none` 检查 Java 源码语法；不解析 Spring/Lombok 等依赖类型，不等于 Maven 编译。
- 解析七份 Maven POM 和 MyBatis 映射 XML，核对 DAO 方法与映射语句名称。
- 检查 Domain 的禁止依赖、Controller 实现 API 接口、文档相对文件链接。该脚本不验证 Markdown 锚点。
- 执行 Python 脚本语法检查和 HTTP 联调脚本的 `--help`。

具体数量和日志见本文后附的最终检查结果。

## 3. 已编写但未执行的测试

| 测试类 | 验证内容 | 当前结果 |
|---|---|---|
| UserAccountAuthenticationTest | 凭据校验、重建状态、停用与删除 | 未执行 |
| UserCredentialRepositoryTest | 真实 BCrypt、密码不泄漏、存储映射 | 未执行 |
| SessionAuthenticationIntegrationTest | Spring Security + MyBatis + H2 完整过滤器链 | 未执行 |
| MySqlIdentityIntegrationTest | 真实 MySQL 凭据读取、并发唯一索引、状态复验 | 未执行 |
| 既有注册和商户申请回归测试 | 保持已有业务契约 | 未重新执行 |

MockMvc 能检查会话对象失效，但不是真实 Servlet 容器的 Cookie 查找测试。另附 `scripts/smoke-auth.py` 用真实 HTTP 客户端检查登录和退出后旧 Cookie 重放，本次尚未对运行中的服务执行。

真实 MySQL 测试只允许使用 `campus_shopping_it` 专用测试库。未设置 `MYSQL_TEST_URL` 时该类会被跳过；跳过不等于通过。CI 配置已写入，未提交或触发远程 CI。

## 4. 本地必须补充的验证

```powershell
mvn -B -ntp clean verify
python .\scripts\verify-source.py
java -jar .\campus-shopping-app\target\campus-shopping-app.jar --spring.profiles.active=dev
# 在另一终端执行：
python .\scripts\smoke-auth.py --base-url http://127.0.0.1:8091
```

还需配置 MySQL 测试库变量后再执行 `mvn verify`。完整步骤见 [实施说明](../iterations/P1-01-auth-session.md)。

## 5. 尚未交付的产品能力

平台管理员初始化、商户审核、开店/Owner 授权、员工邀请、前端、AI、认证限流与审计入库、多实例会话、生产部署安全评审。旧脚手架的依赖和部署示例也未做整库安全审计。

## 6. 最终静态检查结果

- Java 17 语法解析：76 个源文件通过。
- 分层、映射和链接静态检查：257 项通过。数量会随文档链接增加而变化，不是单元测试数量。
- Maven XML：7 份解析通过；YAML：9 份语法解析通过。
- 新增 24 个 JUnit 测试方法：领域 7、凭据仓储 4、会话过滤器链 10、MySQL 3，**全部未执行**。全工程当前共 49 个 `@Test` 方法。
- 原始静态输出保存于 `P1-01-static-results.txt`。

没有使用框架替身伪装完整编译或真实 BCrypt 验证。
