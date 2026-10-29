package cn.bugstack.ai.api;

import cn.bugstack.ai.api.dto.*;
import cn.bugstack.ai.api.response.Response;
import java.security.Principal;
import java.util.*;

/** 对外接口契约，由 Trigger 的 KnowledgeController 实现。 */
public interface IKnowledgeApi {
    /** 当前用户可管理的知识库。 */
    Response<List<KnowledgeBaseResponseDTO>> bases(Principal principal);
    /** 创建明确可见范围的知识库。 */
    Response<KnowledgeBaseResponseDTO> createBase(KnowledgeBaseRequestDTO request, Principal principal);
    /** 文档版本和索引状态列表。 */
    Response<List<KnowledgeDocumentResponseDTO>> documents(String baseId, int page, int size, Principal principal);
    Response<PageResponseDTO<KnowledgeDocumentResponseDTO>> documentsPage(String baseId, int page, int size, Principal principal);
    /** 获授权管理者查看正文。 */
    Response<KnowledgeDocumentResponseDTO> document(String documentId, Principal principal);
    /** 上传并尝试索引；失败版本可见且可重试。 */
    Response<KnowledgeDocumentResponseDTO> upload(String baseId, DocumentUploadRequestDTO request, Principal principal);
    /** 幂等重建此版本的索引。 */
    Response<KnowledgeDocumentResponseDTO> index(String documentId, Principal principal);
    /** 只允许已就绪的最新版本发布生效。 */
    Response<Void> publish(String documentId, Principal principal);
    /** 撤回后立即从 Java 检索白名单排除。 */
    Response<Void> withdraw(String documentId, Principal principal);
}
