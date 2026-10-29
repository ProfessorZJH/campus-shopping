# IAM-01 用户注册：从零到完整接口的中文跟敲教程（V3.1）

> **历史教学记录，不是R1运行指南。** 当前源码、接口与部署步骤见 [R1运行手册](../operations/R1-runbook.md)；不要把本文件中的旧版本示例复制覆盖当前实现。


> **历史教学记录**：当前已实现数据库 Session 登录。新的启动方法、CSRF 和认证以 [P1-01](../iterations/P1-01-auth-session.md) 为准，不要再次导入旧 Basic 配置。
> 技术环境：Java 17、Spring Boot 3.4.3、MySQL 8、MyBatis、Lombok。  
> 参考规范：小傅哥 `xfg-ddd-skills` 2.2.4 与你提供的 `group-buy-market` 真实工程。  
> **这份是中文教学版，解释、代码注释、操作说明统一使用中文。Java 类名、注解、技术名词及接口路径保持原样，保证能够照着敲。**  
> 代码来源：下方每个代码块直接取自本交付包的对应文件，不另外拼接示例。  
> 开发范围：IAM-01 注册练习；**不包括** IAM-02 登录、正式账号认证和完整 P1 验收。

## 零、先弄清楚这次真正的执行顺序

**对照工程的接口实现关系：**

```text
API 层：IAuthApi（方法契约、DTO）
   │ 由 Trigger 实现
   ▼
Trigger 层：AuthController implements IAuthApi
   │ 通过 IUserAccountService 调用
   ▼
Domain 层：UserAccountServiceImpl（注册规则）
   ├─ UserAccountAggregate（账号身份和状态）
   └─ IUserAccountRepository（本地账号持久化接口）
       │ 由 Infrastructure 实现
       ▼
Infrastructure 层：UserAccountRepository
   ├─ PasswordEncoder：写库前生成 BCrypt 摘要
   └─ IUserAccountDao / UserAccountPO / MyBatis XML
       ▼
MySQL：iam_user 表（只保存密码摘要）
```

**实际 HTTP 运行顺序：** 请求先被 Spring MVC 分派到 `AuthController.register()`，再调用 Domain 和 Infrastructure；`IAuthApi` 本身是 Java 接口，不是可执行的独立 HTTP 路由。

**特别注意 Repository 与 Port：** 本次按小傅哥的具体规范区分，本地 MySQL/Redis 数据访问使用 Repository，远程 HTTP/RPC 等访问才使用 Port。IAM-01 不调用远程服务，因此**没有密码哈希 Port**。这是项目选择的分类规范，不意味着一般六边形架构永远禁止其他技术 Port。

## 一、写代码之前

请在**你现有的六模块项目**中逐个文件修改，不要重新生成脚手架。

1. 使用 JDK 17、Maven、MySQL 8，确认 IDEA 开启了 Lombok 注解处理。
2. 先提交或备份自己当前的代码，再与这份源码对照，避免覆盖已经手写的内容。
3. 如果之前使用过 V2 的 `IPasswordHasherPort` 和 `BCryptPasswordHasherPort`，要删除那两个旧类及相关引用；V3.1 不再使用它们。
4. 只执行本次 IAM-01 的建表 SQL，不要直接执行未落地的整个 P1 数据库草案。
5. `Response<T>`、`AppException` 和 `ResponseCode` 是原项目已有类；能复用就不新建第二份。

以下文件路径均**以 `campus-shopping/` 项目根目录为起点**。


## 第一部分：准备数据库


### 1. 用户表与唯一索引

**文件位置：** `docs/dev-ops/mysql/sql/02_iam_user_registration.sql`

**先理解：** 先执行 `SHOW CREATE TABLE iam_user;` 检查现有结构。首次创建时执行完整建表脚本；已经存在同名表时不要删除数据或盲目执行 `ALTER TABLE`。其中用户名唯一索引是防止并发重复注册的最终保护，数据库只允许存储 `password_hash`。

```sql
-- IAM-01 账号注册专用 DDL，独立于完整 P1 草案
-- 仅在 MySQL 8+ 本地练习库执行；本文件不会修改 mer_application 等业务表。
CREATE DATABASE IF NOT EXISTS campus_shopping
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE campus_shopping;

-- 如果 iam_user 已在 P1 草案中创建，先 SHOW COLUMNS FROM iam_user;
-- 不要指望 CREATE TABLE IF NOT EXISTS 自动补 display_name，需另外迁移。
CREATE TABLE IF NOT EXISTS iam_user (
    id            VARCHAR(36)  NOT NULL,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(50)  NOT NULL,
    status        VARCHAR(24)  NOT NULL DEFAULT 'ACTIVE',
    version       BIGINT       NOT NULL DEFAULT 0,
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                  ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_iam_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 已存在老版 iam_user 且只有 display_name 缺失时，手动执行一次以下语句，
-- 并按真实业务数据补齐 display_name；新库不要执行。
-- ALTER TABLE iam_user ADD COLUMN display_name VARCHAR(50) NOT NULL DEFAULT '' AFTER password_hash;

SHOW CREATE TABLE iam_user;
```


## 第二部分：API 层


### 2. 注册接口契约

**文件位置：** `campus-shopping-api/src/main/java/cn/bugstack/ai/api/IAuthApi.java`

**先理解：** `IAuthApi` 定义对外方法的参数和返回值。它只是一份 Java 接口契约，真正的 HTTP 请求由后面的 `AuthController` 接收。API 接口不写数据库逻辑，也不放 `@RestController`。

```java
package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.RegisterRequestDTO;
import cn.bugstack.ai.api.dto.RegisterResponseDTO;
import cn.bugstack.ai.api.response.Response;

/**
 * Identity 对外接口契约。
 * 仅描述输入输出；HTTP 路由和 Spring 注解交给 Trigger 的实现类。
 */
public interface IAuthApi {

    /** 注册普通用户；注册请求不接受 userId 或 role。 */
    Response<RegisterResponseDTO> register(RegisterRequestDTO request);
}
```


### 3. 注册请求参数

**文件位置：** `campus-shopping-api/src/main/java/cn/bugstack/ai/api/dto/RegisterRequestDTO.java`

**先理解：** `@Data` 提供属性访问方法，`@Builder` 提供构造器式创建方式。特别注意密码字段的 `@ToString.Exclude`：它防止 Lombok 自动生成的 `toString()` 输出密码，但**并不能阻止你手工把整个请求对象转为 JSON 后写入日志**。

```java
package cn.bugstack.ai.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import java.io.Serializable;

/** 用户注册请求；密码只在本次请求中使用，不允许输出到日志。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequestDTO implements Serializable {
    private static final long serialVersionUID = 1L;
    private String username;
    @ToString.Exclude // Lombok @Data 自动生成 toString，不能泄露密码。
    private String password;
    private String displayName;
}
```


### 4. 注册响应参数

**文件位置：** `campus-shopping-api/src/main/java/cn/bugstack/ai/api/dto/RegisterResponseDTO.java`

**先理解：** 注册成功只返回 `userId`。密码、密码摘要、管理员权限和商户角色都不能出现在响应里。这里需要区分面向 HTTP 的 DTO 与领域聚合对象。

```java
package cn.bugstack.ai.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;

/** 注册成功仅返回用户 ID，不返回密码摘要或权限。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegisterResponseDTO implements Serializable {
    private static final long serialVersionUID = 1L;
    private String userId;
}
```


### 5. 通用响应对象（已有文件）

**文件位置：** `campus-shopping-api/src/main/java/cn/bugstack/ai/api/response/Response.java`

**先理解：** 这是脚手架已有的 `Response<T>`，**不要重新创建第二份**。项目统一返回 `code`、`info`、`data` 三个字段；不凭空增加 `success`。业务成功判断为 `code == "0000"`。

```java
package cn.bugstack.ai.api.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/** 对外统一响应结构，与 group-buy-market 的 Response<T> 一致。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Response<T> implements Serializable {

    private static final long serialVersionUID = 7000723935764546321L;

    private String code;
    private String info;
    private T data;
}
```


## 第三部分：Types 公共类型


### 6. 错误码枚举（修改已有文件）

**文件位置：** `campus-shopping-types/src/main/java/cn/bugstack/ai/types/enums/ResponseCode.java`

**先理解：** 只要在已有枚举里增加注册错误码 `AUTH_USERNAME_EXISTS("A0001", "用户名已被注册")`，不要覆盖你之前写好的商户业务错误码。账号状态归 Domain 的 `EnumVO`，业务异常码归 Types 的 `ResponseCode`。

```java
package cn.bugstack.ai.types.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 统一响应码：通用错误 + 领域错误。
 * 参考 group-buy-market/types/enums/ResponseCode 的组织方式。
 */
@Getter
@AllArgsConstructor
@NoArgsConstructor
public enum ResponseCode {

    SUCCESS("0000", "成功"),
    UN_ERROR("0001", "未知失败"),
    ILLEGAL_PARAMETER("0002", "非法参数"),
    /** Identity: 用户名已注册 */
    AUTH_USERNAME_EXISTS("A0001", "用户名已被注册"),

    /** 商户入驻申请：重复的幂等键对应不同内容 */
    MERCHANT_REQUEST_CONFLICT("M0001", "幂等键已用于另一份申请"),
    /** 商户入驻申请：已审核不得再次审核 */
    MERCHANT_ALREADY_REVIEWED("M0002", "申请已经审核，不能重复处理"),
    /** 商户入驻申请：申请人不能审核本人申请 */
    MERCHANT_SELF_REVIEW_FORBIDDEN("M0003", "申请人不能审核自己的入驻申请");

    private String code;
    private String info;
}
```


### 7. 统一业务异常（已有文件）

**文件位置：** `campus-shopping-types/src/main/java/cn/bugstack/ai/types/exception/AppException.java`

**先理解：** 业务失败统一抛出 `AppException`。`getCode()` 供客户端区分错误，`getInfo()` 供接口返回可读提示。这里给出完整文件供对照，你的工程里存在就不要重新新建。

```java
package cn.bugstack.ai.types.exception;

import cn.bugstack.ai.types.enums.ResponseCode;
import lombok.Getter;

/**
 * 统一业务异常。
 * 业务码供客户端识别，错误详情保存在 RuntimeException 的 message 中，方便日志与异常链排查。
 */
@Getter
public class AppException extends RuntimeException {

    private static final long serialVersionUID = 5317680961212299217L;

    /** 业务异常码 */
    private final String code;

    /** 可安全向调用者展示的业务提示 */
    private final String info;

    public AppException(ResponseCode responseCode) {
        this(responseCode.getCode(), responseCode.getInfo());
    }

    public AppException(String code) {
        super(code);
        this.code = code;
        this.info = null;
    }

    public AppException(String code, Throwable cause) {
        super(code, cause);
        this.code = code;
        this.info = null;
    }

    public AppException(String code, String message) {
        super(message);
        this.code = code;
        this.info = message;
    }

    public AppException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.info = message;
    }
}
```


## 第四部分：Trigger 接入层


### 8. HTTP 注册控制器

**文件位置：** `campus-shopping-trigger/src/main/java/cn/bugstack/ai/trigger/http/AuthController.java`

**先理解：** 留意类声明 `implements IAuthApi`。`@RestController` 和 `@PostMapping` 在 Trigger 实现类上，`@Resource` 注入 `IUserAccountService`。控制器只做参数接收、调用领域服务、转换 DTO 和返回业务码，**不直接调用 DAO**。本例按参考项目习惯分别捕获 `AppException` 和一般异常。

```java
package cn.bugstack.ai.trigger.http;

import cn.bugstack.ai.api.IAuthApi;
import cn.bugstack.ai.api.dto.RegisterRequestDTO;
import cn.bugstack.ai.api.dto.RegisterResponseDTO;
import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户注册 HTTP 入口，参照 group-buy-market：API 接口由 Trigger 实现。
 * 仅用于 dev 阶段的手写练习；正式上线前须替换演示身份体系并评审风控。
 */
@Slf4j
@Profile("dev")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController implements IAuthApi {

    @Resource
    private IUserAccountService userAccountService;

    @Override
    @PostMapping("/register")
    public Response<RegisterResponseDTO> register(@RequestBody RegisterRequestDTO request) {
        try {
            if (request == null) {
                throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
            }
            // 绝对不要记录 request 整体：它包含明文密码。
            UserAccountAggregate account = userAccountService.register(
                    request.getUsername(), request.getPassword(), request.getDisplayName());

            log.info("用户注册成功 userId={}", account.getUserId());
            RegisterResponseDTO dto = RegisterResponseDTO.builder()
                    .userId(account.getUserId())
                    .build();
            return Response.<RegisterResponseDTO>builder()
                    .code(ResponseCode.SUCCESS.getCode())
                    .info(ResponseCode.SUCCESS.getInfo())
                    .data(dto)
                    .build();
        } catch (AppException e) {
            log.warn("用户注册业务失败 code={}", e.getCode());
            return Response.<RegisterResponseDTO>builder()
                    .code(e.getCode())
                    .info(e.getInfo())
                    .build();
        } catch (Exception e) {
            log.error("用户注册系统错误", e);
            return Response.<RegisterResponseDTO>builder()
                    .code(ResponseCode.UN_ERROR.getCode())
                    .info(ResponseCode.UN_ERROR.getInfo())
                    .build();
        }
    }
}
```


## 第五部分：Domain 领域层


### 9. 账号业务状态枚举

**文件位置：** `campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/model/valobj/UserAccountStatusEnumVO.java`

**先理解：** `ACTIVE` 表示正常账号，`DISABLED` 表示停用账号。状态值对象只表达业务状态，不与 `ResponseCode` 的错误码混淆。

```java
package cn.bugstack.ai.domain.identity.model.valobj;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** 账号状态值对象；不把业务状态当作错误码。 */
@Getter
@AllArgsConstructor
public enum UserAccountStatusEnumVO {
    ACTIVE("ACTIVE", "正常"),
    DISABLED("DISABLED", "停用");

    private final String code;
    private final String info;
}
```


### 10. 用户账号聚合根

**文件位置：** `campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/model/aggregate/UserAccountAggregate.java`

**先理解：** 聚合持有账号 ID、用户名、显示名、状态和版本号。这里仅提供 `@Getter`，不允许调用方任意设置账号状态。**没有** `password` 或 `passwordHash` 字段，账号注册时也不会自动授予平台管理员权限。

```java
package cn.bugstack.ai.domain.identity.model.aggregate;

import cn.bugstack.ai.domain.identity.model.valobj.UserAccountStatusEnumVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import lombok.Getter;

/**
 * 用户账号聚合根。
 *
 * 负责保存账号身份和业务状态，不包含明文密码或密码摘要字段。
 * 密码摘要由基础设施层的本地仓储在写入数据库前生成。
 */
@Getter
public class UserAccountAggregate {

    private final String userId;
    private final String username;
    private final String displayName;
    private final UserAccountStatusEnumVO status;
    private final long version;

    private UserAccountAggregate(String userId, String username, String displayName) {
        if (userId == null || userId.isBlank()
                || username == null || username.isBlank()
                || displayName == null || displayName.isBlank()) {
            throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
        }
        this.userId = userId;
        this.username = username;
        this.displayName = displayName;
        this.status = UserAccountStatusEnumVO.ACTIVE;
        this.version = 0L;
    }

    /** 创建普通用户账号：默认正常状态，不授予管理员或商户权限。 */
    public static UserAccountAggregate register(String userId, String username,
                                                String displayName) {
        return new UserAccountAggregate(userId, username, displayName);
    }
}
```


### 11. 本地仓储接口

**文件位置：** `campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/adapter/repository/IUserAccountRepository.java`

**先理解：** 这里是小傅哥明确的本地 Repository：定义持久化账号所需的接口，不直接编写 SQL。`rawPassword` 只是临时参数，真正写数据库之前会生成摘要。不要把 BCrypt 当成远程服务去创建 Port。

```java
package cn.bugstack.ai.domain.identity.adapter.repository;

import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;

/**
 * 本地用户账号仓储接口。
 *
 * 注册密码仅作为临时方法参数传递，不写入聚合，也不出现在接口响应中。
 * 具体实现负责在持久化前进行安全哈希处理。
 */
public interface IUserAccountRepository {

    /** 保存新账号及其密码摘要；数据库中只允许出现摘要，不能存储明文。 */
    void save(UserAccountAggregate account, String rawPassword);
}
```


### 12. 领域服务接口

**文件位置：** `campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/service/IUserAccountService.java`

**先理解：** 领域服务定义业务能力 `register`，它和对外的 `IAuthApi` 不是一个层次：`IAuthApi` 定义用户能调用什么接口，领域服务定义系统能够完成怎样的注册业务。

```java
package cn.bugstack.ai.domain.identity.service;

import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;

/** 账号领域服务，对 Trigger 暴露注册业务能力。 */
public interface IUserAccountService {
    UserAccountAggregate register(String username, String password, String displayName);
}
```


### 13. 注册领域服务实现

**文件位置：** `campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/service/impl/UserAccountServiceImpl.java`

**先理解：** 通过手写构造器注入 `private final IUserAccountRepository`，遵循你希望练习的方式。按顺序完成用户名规范化、密码长度检查、显示名检查、创建聚合、调用 Repository。**密码不能 `trim()`**。

```java
package cn.bugstack.ai.domain.identity.service.impl;

import cn.bugstack.ai.domain.identity.adapter.repository.IUserAccountRepository;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;

/**
 * 账号注册领域服务。
 * final 依赖通过手写构造器注入，符合当前练习选定的编码风格。
 * 一次注册只有一条 INSERT，不需要为了演示而人为引入 Case 模块。
 */
@Service
public class UserAccountServiceImpl implements IUserAccountService {

    private final IUserAccountRepository repository;

    public UserAccountServiceImpl(IUserAccountRepository repository) {
        this.repository = repository;
    }

    @Override
    public UserAccountAggregate register(String username, String password, String displayName) {
        // 1. 用户名统一小写，规避大小写差异造成的重复账号。
        String normalizedUsername = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        if (!normalizedUsername.matches("[a-z][a-z0-9_]{3,31}")) {
            throw invalid("用户名必须为 4~32 位，以字母开头，仅含小写字母、数字和下划线");
        }

        // 2. 密码绝对不能 trim；限制长度及 BCrypt 的 72 字节输入上限。
        if (password == null || password.length() < 8 || password.length() > 64
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw invalid("密码须为 8~64 个字符，UTF-8 不超过 72 字节");
        }

        // 3. 显示名称是用户资料，不是 username。
        String normalizedDisplayName = displayName == null ? "" : displayName.trim();
        if (normalizedDisplayName.isEmpty() || normalizedDisplayName.length() > 50) {
            throw invalid("显示名称必须为 1~50 个字符");
        }

        // 4. 创建账号聚合：只保存账号身份与业务状态，不保存密码。
        UserAccountAggregate account = UserAccountAggregate.register(
                UUID.randomUUID().toString(), normalizedUsername, normalizedDisplayName);

        // 5. 调用本地仓储：写入数据库前才把临时密码转换成哈希。
        repository.save(account, password);
        return account;
    }

    private static AppException invalid(String info) {
        return new AppException(ResponseCode.ILLEGAL_PARAMETER.getCode(), info);
    }
}
```


## 第六部分：Infrastructure 基础设施层


### 14. BCrypt 编码器配置

**文件位置：** `campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/config/PasswordEncoderConfig.java`

**先理解：** `@Configuration` 声明配置类，`@Bean` 将一个 `PasswordEncoder` 放入 Spring 容器。这个编码器供本地注册仓储和 dev HTTP Basic 测试账号复用。这里不做远程请求，所以不新建 `IPasswordHasherPort`。

```java
package cn.bugstack.ai.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 本地密码哈希组件配置。
 * BCrypt 是进程内算法，不涉及远程调用，也不需要远程 Port 或 Gateway。
 */
@Configuration
public class PasswordEncoderConfig {

    /** 注册账号与本地开发环境的 HTTP Basic 测试账号共用此编码器。 */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
```


### 15. 数据库持久化对象

**文件位置：** `campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/dao/po/UserAccountPO.java`

**先理解：** PO 对应数据库列，与聚合根的职责不同。它可以带 `@Data`、`@Builder` 等注解，且包含 `passwordHash`，但这个对象不能直接作为 API 响应返回。

```java
package cn.bugstack.ai.infrastructure.dao.po;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** 数据表 iam_user 的持久化对象；不对外作为 API DTO 返回。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAccountPO {
    private String id;
    private String username;
    private String passwordHash;
    private String displayName;
    private String status;
    private Long version;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```


### 16. MyBatis DAO 接口

**文件位置：** `campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/dao/IUserAccountDao.java`

**先理解：** `@Mapper` 让 MyBatis 为 DAO 接口提供代理实现。`@Param("username")` 映射 XML 中的 `#{username}`。DAO 只声明数据库操作，不处理账号业务规则。

```java
package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.UserAccountPO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** MyBatis Mapper 接口：只声明 SQL 行为，不编写业务判断。 */
@Mapper
public interface IUserAccountDao {
    int insert(UserAccountPO user);

    /** 唯一键冲突后再次确认具体是 username 重复，避免误报主键冲突。 */
    int countByUsername(@Param("username") String username);
}
```


### 17. 本地账号 Repository 实现

**文件位置：** `campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/adapter/repository/UserAccountRepository.java`

**先理解：** `@Repository` 声明仓储，`@Resource` 注入 DAO 和 `PasswordEncoder`。关键顺序：**先编码密码 → 再创建 PO → 再插入数据库**。捕获唯一键冲突后还要辨认是否真正属于用户名重复，不能将所有数据库故障伪装成 `A0001`。

```java
package cn.bugstack.ai.infrastructure.adapter.repository;

import cn.bugstack.ai.domain.identity.adapter.repository.IUserAccountRepository;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.infrastructure.dao.IUserAccountDao;
import cn.bugstack.ai.infrastructure.dao.po.UserAccountPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Repository;
import org.springframework.security.crypto.password.PasswordEncoder;

/** 本地用户账号仓储实现；使用 @Resource 注入 MyBatis DAO。 */
@Repository
public class UserAccountRepository implements IUserAccountRepository {

    @Resource
    private IUserAccountDao userAccountDao;

    @Resource
    private PasswordEncoder passwordEncoder;

    @Override
    public void save(UserAccountAggregate account, String rawPassword) {
        // 聚合 -> PO：仅在 Infrastructure 中处理字段映射。
        // 仅在本地持久化边界生成密码摘要，绝不能将明文密码写入数据库。
        String passwordHash = passwordEncoder.encode(rawPassword);
        UserAccountPO po = UserAccountPO.builder()
                .id(account.getUserId())
                .username(account.getUsername())
                .passwordHash(passwordHash)
                .displayName(account.getDisplayName())
                .status(account.getStatus().getCode())
                .version(account.getVersion())
                .build();

        try {
            userAccountDao.insert(po);
        } catch (DuplicateKeyException e) {
            // 即使并发请求同时通过前置检查，数据库唯一索引仍可拦住第二次写入。
            if (userAccountDao.countByUsername(account.getUsername()) > 0) {
                throw new AppException(ResponseCode.AUTH_USERNAME_EXISTS.getCode(),
                        ResponseCode.AUTH_USERNAME_EXISTS.getInfo(), e);
            }
            // 不是用户名重复（例如 UUID 主键冲突），不要假装成业务错误。
            throw e;
        }
    }
}
```


## 第七部分：App 装配与 SQL


### 18. MyBatis XML 映射

**文件位置：** `campus-shopping-app/src/main/resources/mybatis/mapper/iam_user_mapper.xml`

**先理解：** XML 的 `namespace` 必须等于 `IUserAccountDao` 的完整 Java 包名，`insert` 和 `countByUsername` 的 `id` 要与方法名一一对应。`password_hash` 是数据库列，`passwordHash` 是 Java 属性。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "https://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="cn.bugstack.ai.infrastructure.dao.IUserAccountDao">

    <!-- 所有字段名和 UserAccountPO 一一对应 -->
    <insert id="insert" parameterType="cn.bugstack.ai.infrastructure.dao.po.UserAccountPO">
        INSERT INTO iam_user (id, username, password_hash, display_name, status, version)
        VALUES (#{id}, #{username}, #{passwordHash}, #{displayName}, #{status}, #{version})
    </insert>

    <select id="countByUsername" resultType="int">
        SELECT COUNT(1)
        FROM iam_user
        WHERE username = #{username}
    </select>
</mapper>
```


### 19. 开发环境认证配置

**文件位置：** `campus-shopping-app/src/main/java/cn/bugstack/ai/config/DemoBasicSecurityConfig.java`

**先理解：** 允许匿名 POST `/api/v1/auth/register`，商户申请仍必须经过 dev Basic 认证。`@Profile("dev")` 表示只在开发环境启用。不要把开发环境无状态 Basic 配置直接当作生产会话登录方案。

```java
package cn.bugstack.ai.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

/**
 * 只用于本地 dev 演示的认证配置。
 * 使用环境变量提供的测试账号，通过 HTTP Basic 传入，不允许把凭据写入仓库。
 * 无状态接口练习关闭 CSRF；真实浏览器会话登录上线前必须恢复相应的 CSRF 防护。
 */
@Profile("dev")
@Configuration
public class DemoBasicSecurityConfig {
    @Bean
    SecurityFilterChain devSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        // IAM-01 注册接口允许匿名；其它敏感接口仍按原规则保护。
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/merchant-applications").authenticated()
                        .anyRequest().denyAll())
                .httpBasic(Customizer.withDefaults())
                .build();
    }

    @Bean
    UserDetailsService demoUserDetailsService(
            @Value("${demo.auth.username}") String username,
            @Value("${demo.auth.password}") String password,
            PasswordEncoder encoder) {
        return new InMemoryUserDetailsManager(
                User.withUsername(username)
                        .password(encoder.encode(password))
                        .roles("USER")
                        .build());
    }
}
```


### 20. 基础设施 Maven 依赖

**文件位置：** `campus-shopping-infrastructure/pom.xml`

**先理解：** 重点检查 `spring-security-crypto` 是否加入依赖。已有工程不要整份覆盖 `pom.xml`；正确做法是按差异补齐依赖，保留脚手架的其他模块配置。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>cn.bugstack.ai</groupId>
        <artifactId>campus-shopping</artifactId>
        <version>1.0-SNAPSHOT</version>
    </parent>

    <artifactId>campus-shopping-infrastructure</artifactId>

    <dependencies>
        <dependency>
            <groupId>org.mybatis.spring.boot</groupId>
            <artifactId>mybatis-spring-boot-starter</artifactId>
        </dependency>

        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
        </dependency>
        <!-- Infrastructure 使用 BCrypt，但 Domain 不依赖 Spring Security。 -->
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-crypto</artifactId>
        </dependency>

        <!-- 系统模块 -->
        <dependency>
            <groupId>cn.bugstack.ai</groupId>
            <artifactId>campus-shopping-domain</artifactId>
        </dependency>
    </dependencies>

    <build>
        <finalName>campus-shopping-infrastructure</finalName>
    </build>

</project>
```


### 21. 开发环境 YAML 配置

**文件位置：** `campus-shopping-app/src/main/resources/application-dev.yml`

**先理解：** 重点检查数据库名、端口和 `mybatis.mapper-locations`。新的用户 Mapper 与原商户 Mapper 要一起加载，避免出现 MyBatis 找不到 SQL 的错误。数据库密码通过环境变量提供，不写在 Git 仓库里。

```yaml
server:
  port: 8091
  address: 127.0.0.1 # 仅供本地手写练习，不对局域网开放 Basic 凭据

spring:
  datasource:
    url: ${DB_URL:jdbc:mysql://127.0.0.1:3306/campus_shopping?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver

# 原脚手架自带 frame_case_mapper.xml 占位示例，不能一起加载。
mybatis:
  mapper-locations:
    - classpath:/mybatis/mapper/merchant_application_mapper.xml
    - classpath:/mybatis/mapper/iam_user_mapper.xml

demo:
  auth:
    username: ${DEMO_AUTH_USERNAME}
    password: ${DEMO_AUTH_PASSWORD}

thread:
  pool:
    executor:
      config:
        core-pool-size: 2
        max-pool-size: 4
        keep-alive-time: 10
        block-queue-size: 100
        policy: CallerRunsPolicy
```


## 第八部分：验证代码


### 22. Domain 领域单元测试

**文件位置：** `campus-shopping-app/src/test/java/cn/bugstack/ai/test/identity/UserAccountServiceTest.java`

**先理解：** 这组测试使用模拟 Repository，不连接 MySQL；验证用户名转小写、字段校验、重复用户名错误码，以及聚合内部不保存密码字段。`@Test` 是 JUnit 测试方法标记。

```java
package cn.bugstack.ai.test.identity;

import cn.bugstack.ai.domain.identity.adapter.repository.IUserAccountRepository;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.model.valobj.UserAccountStatusEnumVO;
import cn.bugstack.ai.domain.identity.service.impl.UserAccountServiceImpl;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;

/** 领域服务单元测试：使用模拟仓储，不启动 Spring 容器或真实数据库。 */
class UserAccountServiceTest {

    @Test
    void registerNormalizesFieldsAndDoesNotStorePasswordInAggregate() {
        FakeRepository repository = new FakeRepository();
        UserAccountServiceImpl service = new UserAccountServiceImpl(repository);
        UserAccountAggregate user = service.register(
                " Student001 ", "MySecurePass123!", " 校园用户 ");

        assertEquals("student001", user.getUsername());
        assertEquals("校园用户", user.getDisplayName());
        assertEquals(UserAccountStatusEnumVO.ACTIVE, user.getStatus());
        assertEquals(0L, user.getVersion());
        assertNotNull(user.getUserId());
        assertSame(user, repository.saved);
        assertTrue(repository.receivedExpectedCredential);
        // 聚合不允许暴露明文密码字段，也不能暴露密码摘要字段。
        assertFalse(java.util.Arrays.stream(UserAccountAggregate.class.getDeclaredFields())
                .anyMatch(field -> field.getName().toLowerCase().contains("password")));
    }

    @Test
    void invalidFieldsAreRejectedBeforePersistence() {
        FakeRepository repository = new FakeRepository();
        UserAccountServiceImpl service = new UserAccountServiceImpl(repository);
        AppException badUsername = assertThrows(AppException.class,
                () -> service.register("a", "MySecurePass123!", "测试用户"));
        assertEquals(ResponseCode.ILLEGAL_PARAMETER.getCode(), badUsername.getCode());
        AppException badPassword = assertThrows(AppException.class,
                () -> service.register("student001", "123", "测试用户"));
        assertEquals(ResponseCode.ILLEGAL_PARAMETER.getCode(), badPassword.getCode());
        assertNull(repository.saved);
    }

    @Test
    void duplicateUsernameIsRejectedThroughRepositoryContract() {
        FakeRepository repository = new FakeRepository();
        UserAccountServiceImpl service = new UserAccountServiceImpl(repository);
        service.register("student001", "MySecurePass123!", "首次注册");
        AppException exception = assertThrows(AppException.class,
                () -> service.register("STUDENT001", "MySecurePass123!", "重复注册"));
        assertEquals(ResponseCode.AUTH_USERNAME_EXISTS.getCode(), exception.getCode());
    }

    static class FakeRepository implements IUserAccountRepository {
        private final Set<String> usernames = new HashSet<>();
        UserAccountAggregate saved;
        boolean receivedExpectedCredential;
        @Override
        public void save(UserAccountAggregate account, String rawPassword) {
            if (!usernames.add(account.getUsername())) {
                throw new AppException(ResponseCode.AUTH_USERNAME_EXISTS);
            }
            saved = account;
            receivedExpectedCredential = "MySecurePass123!".equals(rawPassword);
        }
    }
}
```


### 23. Infrastructure 仓储单元测试

**文件位置：** `campus-shopping-app/src/test/java/cn/bugstack/ai/test/identity/UserAccountRepositoryTest.java`

**先理解：** 这组测试使用真实 BCrypt 编码器和模拟 DAO，捕获 INSERT 的 PO，验证写入前生成密码摘要；另测唯一键错误是否正确转换。Mock 的方法名是 Java 标识符，需要保持英文不翻译。

```java
package cn.bugstack.ai.test.identity;

import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.infrastructure.adapter.repository.UserAccountRepository;
import cn.bugstack.ai.infrastructure.config.PasswordEncoderConfig;
import cn.bugstack.ai.infrastructure.dao.IUserAccountDao;
import cn.bugstack.ai.infrastructure.dao.po.UserAccountPO;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** 基础设施单元测试：验证执行 DAO 插入前已完成 BCrypt 哈希。 */
class UserAccountRepositoryTest {

    private final PasswordEncoder encoder = new PasswordEncoderConfig().passwordEncoder();

    private UserAccountRepository repository(IUserAccountDao dao) {
        UserAccountRepository repository = new UserAccountRepository();
        ReflectionTestUtils.setField(repository, "userAccountDao", dao);
        ReflectionTestUtils.setField(repository, "passwordEncoder", encoder);
        return repository;
    }

    private UserAccountAggregate account() {
        return UserAccountAggregate.register("account-1", "student001", "校园用户");
    }

    @Test
    void insertWritesOnlyBCryptHashToMySqlDao() {
        IUserAccountDao dao = mock(IUserAccountDao.class);
        repository(dao).save(account(), "MySecurePass123!");
        ArgumentCaptor<UserAccountPO> captor = ArgumentCaptor.forClass(UserAccountPO.class);
        verify(dao).insert(captor.capture());
        UserAccountPO po = captor.getValue();
        assertEquals("account-1", po.getId());
        assertEquals("student001", po.getUsername());
        assertEquals("ACTIVE", po.getStatus());
        assertEquals(0L, po.getVersion());
        assertNotEquals("MySecurePass123!", po.getPasswordHash());
        assertTrue(encoder.matches("MySecurePass123!", po.getPasswordHash()));
    }

    @Test
    void duplicateUsernameIsMappedToAppException() {
        IUserAccountDao dao = mock(IUserAccountDao.class);
        when(dao.insert(any(UserAccountPO.class))).thenThrow(new DuplicateKeyException("duplicate"));
        when(dao.countByUsername("student001")).thenReturn(1);
        AppException e = assertThrows(AppException.class,
                () -> repository(dao).save(account(), "MySecurePass123!"));
        assertEquals(ResponseCode.AUTH_USERNAME_EXISTS.getCode(), e.getCode());
    }

    @Test
    void OtherUniqueConflictsAreNotMisreported() {
        IUserAccountDao dao = mock(IUserAccountDao.class);
        when(dao.insert(any(UserAccountPO.class))).thenThrow(new DuplicateKeyException("duplicate"));
        when(dao.countByUsername("student001")).thenReturn(0);
        assertThrows(DuplicateKeyException.class,
                () -> repository(dao).save(account(), "MySecurePass123!"));
    }
}
```


### 24. Trigger HTTP 接口测试

**文件位置：** `campus-shopping-app/src/test/java/cn/bugstack/ai/test/identity/AuthControllerTest.java`

**先理解：** 用 `MockMvc` 验证接口路径和返回业务码，并验证 `AuthController` 确实实现 `IAuthApi`。这只是单独的 MVC 测试，**没有**加载完整 Spring Security 过滤器链；匿名放行配置要另外做集成验证。

```java
package cn.bugstack.ai.test.identity;

import cn.bugstack.ai.api.IAuthApi;
import cn.bugstack.ai.domain.identity.model.aggregate.UserAccountAggregate;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.trigger.http.AuthController;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** MVC 接口测试不加载 SecurityFilterChain；安全规则须另做集成测试。 */
class AuthControllerTest {
    private static final String REGISTER_JSON = "{\"username\":\"student001\",\"password\":\"MySecurePass123!\",\"displayName\":\"校园用户\"}";

    private MockMvc mvc(IUserAccountService service) {
        AuthController controller = new AuthController();
        ReflectionTestUtils.setField(controller, "userAccountService", service);
        return MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void triggerMustImplementApiContract() {
        assertTrue(IAuthApi.class.isAssignableFrom(AuthController.class));
    }

    @Test
    void successReturnsOnlyUserId() throws Exception {
        IUserAccountService service = mock(IUserAccountService.class);
        when(service.register("student001", "MySecurePass123!", "校园用户"))
                .thenReturn(UserAccountAggregate.register("user-1", "student001", "校园用户"));
        mvc(service).perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(REGISTER_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("0000"))
                .andExpect(jsonPath("$.data.userId").value("user-1"))
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist());
    }

    @Test
    void duplicateUsernameReturnsBusinessCode() throws Exception {
        IUserAccountService service = mock(IUserAccountService.class);
        when(service.register(anyString(), anyString(), anyString()))
                .thenThrow(new AppException(ResponseCode.AUTH_USERNAME_EXISTS));
        mvc(service).perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(REGISTER_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("A0001"));
    }

    @Test
    void malformedJsonIsRejectedBeforeController() throws Exception {
        IUserAccountService service = mock(IUserAccountService.class);
        mvc(service).perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
```


## 九、运行顺序和验证方法

### 1. 确认环境

在项目根目录使用 IDEA 终端执行：

```powershell
java -version
mvn -version
```

确认 Java 为 17；数据库使用 MySQL 8。执行第一部分的建表 SQL 后，再确认开发环境所需变量已设置：`DB_USERNAME`、`DB_PASSWORD`、`DEMO_AUTH_USERNAME`、`DEMO_AUTH_PASSWORD`。**不要把真实密码提交到仓库。**

### 2. 运行测试和启动服务

```powershell
# 先执行当前模块及依赖模块的测试
mvn -pl campus-shopping-app -am test

# 若测试通过，安装多模块依赖并运行 Spring Boot
mvn -pl campus-shopping-app -am install -DskipTests
mvn -f campus-shopping-app/pom.xml spring-boot:run
```

如果尚未启用开发环境，请在运行配置中设置 Spring Profile 为 `dev`。本项目开发配置监听 `127.0.0.1:8091`，属于本地练习地址。

### 3. 发起用户注册请求

请求地址：`POST http://127.0.0.1:8091/api/v1/auth/register`

```json
{
  "username": "student001",
  "password": "MySecurePass123!",
  "displayName": "校园用户"
}
```

首次注册成功，期望返回：

```json
{
  "code": "0000",
  "info": "成功",
  "data": {"userId": "由后端生成的 UUID"}
}
```

再使用相同用户名注册，期望返回业务失败码 `A0001`：

```json
{
  "code": "A0001",
  "info": "用户名已被注册",
  "data": null
}
```

参照 `group-buy-market` 的控制器写法，当前业务异常由 Controller 捕获，所以即使注册失败，HTTP 状态也可能是 **200**，必须检查响应体的 `code`；不能只靠 HTTP 状态判断业务是否成功。JSON 格式错误等问题可能由 Spring MVC 在进入 Controller 前返回 HTTP 400。

### 4. 检查数据库

```sql
USE campus_shopping;

SELECT id, username, LEFT(password_hash, 7) AS hash_prefix,
       display_name, status, version
FROM iam_user
WHERE username = 'student001';

SELECT COUNT(*) AS user_count
FROM iam_user
WHERE username = 'student001';
```

正确结果应只有一条用户记录，`password_hash` 是 BCrypt 摘要而不是明文；账号状态是 `ACTIVE`。

### 5. 本次练习验收清单

- [ ] 能解释 `IAuthApi` 与 `AuthController implements IAuthApi` 的区别。
- [ ] 能解释 `IUserAccountService` 为什么位于 Domain，而不是直接访问 DAO。
- [ ] 能说出 Repository（本地）与 Port（远程）在当前小傅哥 Skill 中的分类。
- [ ] 知道 `@RestController`、`@Resource`、`@Repository`、`@Mapper`、`@Configuration`、`@Bean` 各自的作用。
- [ ] 能解释聚合根为什么不开放 `setStatus()`，也不保存密码。
- [ ] 能解释数据库用户名唯一索引为什么比“先查询再插入”更可靠。
- [ ] 可以执行三组单元测试，并用 HTTP 请求和 SQL 查询验证结果。

## 十、哪些功能还没有完成？

**IAM-01 仅是本地注册练习，不代表完整身份系统已经完成。**

- 当前演示用 HTTP Basic 登录账号仍由内存用户管理器提供；新注册的数据库用户还不能直接登录，需要 IAM-02 处理。
- `MockMvc` 单独测试不包含完整安全过滤器链，匿名注册的安全规则仍需 Spring Boot 集成验证。
- 真实 MySQL 并发注册、完整 Maven/JUnit、生产级验证码或限流、CSRF 安全配置等，也需在后续阶段逐项验证。
- 本次修订是**中文可读性修复**：不会因为重写教程就声称这些功能已经实现或测试通过。
