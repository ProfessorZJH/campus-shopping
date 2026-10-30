package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 商户上架或下架。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublishRequestDTO {

    private Boolean published;
}
