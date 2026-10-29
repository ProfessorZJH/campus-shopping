-- 请先用拥有建库权限的 MySQL 账号执行此脚本。
-- 1. 创建数据库。MySQL 8.0 的 utf8mb4_0900_ai_ci 排序规则适用于此示例。
CREATE DATABASE IF NOT EXISTS `campus_shopping`
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

-- 2. 明确选择数据库：否则后面的不带库名前缀的 SQL 可能执行到错误的库。
USE `campus_shopping`;

-- 3. 创建商户入驻申请表（当前只实现“提交申请”，审核字段为后续预留）。
CREATE TABLE IF NOT EXISTS `mer_application` (
    `application_id`    VARCHAR(64)  NOT NULL COMMENT '申请唯一业务 ID',
    `applicant_user_id` VARCHAR(64)  NOT NULL COMMENT '申请人 ID，必须由后端认证主体决定',
    `request_key`       VARCHAR(64)  NOT NULL COMMENT '客户端本次提交的幂等键',
    `merchant_name`     VARCHAR(100) NOT NULL COMMENT '商户名称',
    `status`            VARCHAR(20)  NOT NULL DEFAULT 'SUBMITTED' COMMENT '审核状态',
    `reviewer_user_id`  VARCHAR(64)           DEFAULT NULL COMMENT '审核人 ID',
    `rejection_reason`  VARCHAR(500)          DEFAULT NULL COMMENT '驳回原因',
    `version`           INT         NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
    `create_time`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`application_id`),
    UNIQUE KEY `uk_applicant_request` (`applicant_user_id`, `request_key`),
    KEY `idx_applicant_created` (`applicant_user_id`, `create_time`),
    KEY `idx_status_created` (`status`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商户入驻申请';

-- 4. 检查当前库和表。
SELECT DATABASE();
SHOW TABLES LIKE 'mer_application';
SHOW CREATE TABLE `mer_application`;
