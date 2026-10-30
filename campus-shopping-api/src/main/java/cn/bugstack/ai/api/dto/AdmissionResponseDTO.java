package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 仅本人和平台审核人员可查看的申请资料。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdmissionResponseDTO {

    private String applicationId;
    private String merchantName;
    private String category;
    private String contactName;
    private String contactPhone;
    private String storeName;
    private String location;
    private String status;
    private String rejectionReason;
    private String merchantId;
}
