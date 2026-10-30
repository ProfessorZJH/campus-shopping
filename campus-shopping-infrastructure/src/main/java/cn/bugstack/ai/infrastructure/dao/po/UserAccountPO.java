package cn.bugstack.ai.infrastructure.dao.po;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/** 数据表 iam_user 的持久化对象；不对外作为 API DTO 返回。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAccountPO {

    private String id;
    private String username;

    @ToString.Exclude
    private String passwordHash;

    private String displayName;
    private String status;
    private Long version;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
