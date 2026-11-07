-- 履约与售后只追加业务事件；同一订单/售后阶段以 dedupe_key 去重，重复操作不产生重复成功记录。
CREATE TABLE IF NOT EXISTS trd_order_event (
 id VARCHAR(36) PRIMARY KEY,
 event_seq BIGINT NOT NULL AUTO_INCREMENT,
 order_id VARCHAR(36) NOT NULL,
 after_sale_id VARCHAR(36) NULL,
 event_type VARCHAR(32) NOT NULL,
 event_time DATETIME(3) NOT NULL,
 actor_id VARCHAR(36) NULL,
 actor_role VARCHAR(24) NULL,
 reason VARCHAR(500) NOT NULL DEFAULT '',
 dedupe_key VARCHAR(80) NOT NULL,
 UNIQUE KEY uk_order_event_dedupe(order_id,dedupe_key),
 UNIQUE KEY uk_order_event_seq(event_seq),
 KEY ix_order_event_time(order_id,event_time,event_seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
