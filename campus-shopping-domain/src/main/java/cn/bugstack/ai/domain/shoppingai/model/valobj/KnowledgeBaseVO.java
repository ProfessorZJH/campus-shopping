package cn.bugstack.ai.domain.shoppingai.model.valobj;
import java.util.*;
import java.time.*;
/** 知识库的所有权与可见性。 */
public record KnowledgeBaseVO(String id, String name, String merchantId, String visibility) {}
