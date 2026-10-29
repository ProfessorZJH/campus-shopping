package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 商户经营资料；只有本商户 Owner 可修改。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MerchantProfileRequestDTO {
    private String name;
    private String storeName;
    private String location;
}
