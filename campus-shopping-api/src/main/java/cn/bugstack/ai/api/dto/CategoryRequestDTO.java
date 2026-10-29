package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 平台类目管理请求。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CategoryRequestDTO {
    private String code;
    private String name;
    private Boolean active;
}
