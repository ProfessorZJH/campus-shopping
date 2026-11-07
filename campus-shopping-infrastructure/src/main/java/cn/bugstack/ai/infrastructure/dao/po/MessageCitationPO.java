package cn.bugstack.ai.infrastructure.dao.po;

import java.util.*;
import lombok.*;

/** 历史消息的最小引用快照；不保存受保护正文。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageCitationPO {

    private String messageId;
    private int ordinal;
    private String documentId;
    private String rootId;
    private int documentVersion;
    private String chunkId;
    private String title;
    private String snippet;
}
