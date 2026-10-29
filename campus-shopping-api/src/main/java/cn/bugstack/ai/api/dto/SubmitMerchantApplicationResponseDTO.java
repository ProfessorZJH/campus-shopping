package cn.bugstack.ai.api.dto;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 商户入驻申请响应，只暴露业务编号和申请状态。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitMerchantApplicationResponseDTO implements Serializable {

    private static final long serialVersionUID = 1L;
    private String applicationId;
    private String status;
}
