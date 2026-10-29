package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 来源卡片，只返回安全标题和允许展示的片段。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CitationResponseDTO {

    private String documentId;
    private String title;
    private String snippet;
}
