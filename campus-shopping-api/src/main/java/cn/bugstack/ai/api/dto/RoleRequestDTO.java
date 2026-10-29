package cn.bugstack.ai.api.dto;
import lombok.*;import java.util.*;
/** 创建/更新商户自定义角色，不接受商户 ID 或 isAdmin 等授权字段。 */
@Data @NoArgsConstructor @AllArgsConstructor
public class RoleRequestDTO {private String name;private Set<String> permissions;}
