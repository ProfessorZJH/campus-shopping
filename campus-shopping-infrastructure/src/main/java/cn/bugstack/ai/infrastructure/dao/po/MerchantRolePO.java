package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
/** 自定义角色持久化对象。 */
@Data @NoArgsConstructor @AllArgsConstructor
public class MerchantRolePO { private String merchantId;private String roleCode;private String name; }
