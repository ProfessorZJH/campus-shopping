package cn.bugstack.ai.api.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionResponseDTO {

    private String code;
    private String label;
    private Boolean grantable;
}
