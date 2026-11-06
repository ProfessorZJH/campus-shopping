package cn.bugstack.ai.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** 商户/平台经营统计响应，期间与截至时间由服务端返回。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OperationsStatisticsResponseDTO {
    private String periodStart;
    private String periodEnd;
    private String timezone;
    private String asOf;
    private Long totalOrders;
    private Long paidOrders;
    private Long refundedOrders;
    private Long completedAmountCent;
    private Double refundRate;
    private List<StatisticsTrendDTO> trend;
    private List<StatisticsStatusDTO> statuses;
    private List<StatisticsProductDTO> products;
    private String metricNote;
}
