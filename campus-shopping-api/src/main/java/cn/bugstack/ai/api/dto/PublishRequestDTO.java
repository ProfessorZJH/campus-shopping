package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 商户上架或下架。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PublishRequestDTO {
    private Boolean published;
}
