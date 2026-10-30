package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 完整入驻资料；申请人只从认证主体获取。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitMerchantApplicationRequestDTO {

    private String merchantName;
    private String category;
    private String contactName;
    private String contactPhone;
    private String storeName;
    private String location;
}
