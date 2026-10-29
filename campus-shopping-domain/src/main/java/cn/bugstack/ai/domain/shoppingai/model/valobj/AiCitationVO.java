package cn.bugstack.ai.domain.shoppingai.model.valobj;

import java.time.*;
import java.util.*;

/** 引用必须在 Java 端复验授权与正文一致性。 */
public record AiCitationVO(String documentId, String chunkId, String title, String snippet, double score) {}
