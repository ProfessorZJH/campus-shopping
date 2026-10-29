package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 商户公开经营信息，不包含申请人私人联系方式。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MerchantResponseDTO {
    private String merchantId;
    private String name;
    private String category;
    private String status;
    private String storeId;
    private String storeName;
    private String location;
}
