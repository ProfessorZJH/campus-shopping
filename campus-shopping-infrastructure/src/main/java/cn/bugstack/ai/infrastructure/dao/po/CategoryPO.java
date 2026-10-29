package cn.bugstack.ai.infrastructure.dao.po;
import lombok.*;
import java.util.*;
import java.time.*;
/** 类目持久化对象。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CategoryPO {
    private String code;
    private String name;
    private Boolean active;
}
