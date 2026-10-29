package cn.bugstack.ai.domain.shoppingai.model.valobj;
import java.util.*;
import java.time.*;
/** 知识文档不可变版本与索引状态；正文只返回给获准管理者。 */
public record KnowledgeDocumentVO(String id,String rootId,String baseId,String title,String merchantId,String visibility,int version,String status,String indexStatus,String content,String error,Instant createdAt) {}
