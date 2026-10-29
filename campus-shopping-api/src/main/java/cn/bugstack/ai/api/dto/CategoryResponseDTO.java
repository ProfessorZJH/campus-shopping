package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 商品类目。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CategoryResponseDTO {
    private String code;
    private String name;
    private Boolean active;
}
