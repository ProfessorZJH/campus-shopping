package cn.bugstack.ai.trigger.http;
import cn.bugstack.ai.api.IKnowledgeApi;
import cn.bugstack.ai.api.dto.*;import cn.bugstack.ai.api.response.Response;
import cn.bugstack.ai.types.enums.ResponseCode;import cn.bugstack.ai.types.exception.AppException;
import cn.bugstack.ai.domain.identity.service.*;import cn.bugstack.ai.domain.merchant.service.*;
import cn.bugstack.ai.domain.catalog.service.*;import cn.bugstack.ai.domain.inventory.service.*;import cn.bugstack.ai.domain.trading.service.*;import cn.bugstack.ai.domain.fulfillment.service.*;
import cn.bugstack.ai.cases.merchant.*;import cn.bugstack.ai.cases.catalog.*;import cn.bugstack.ai.cases.trading.*;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;import cn.bugstack.ai.domain.catalog.model.entity.*;import cn.bugstack.ai.domain.catalog.model.valobj.*;
import cn.bugstack.ai.domain.inventory.model.valobj.*;import cn.bugstack.ai.domain.trading.model.entity.*;import cn.bugstack.ai.domain.trading.model.valobj.*;import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import static cn.bugstack.ai.trigger.http.RequestInputs.*;import static cn.bugstack.ai.types.common.Checks.require;
import jakarta.annotation.Resource;import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;import java.util.*;import java.util.function.Supplier;import java.util.stream.Collectors;
import cn.bugstack.ai.cases.shoppingai.*;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
/** HTTP 入口只做协议转换、可信身份提取和响应封装。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class KnowledgeController implements IKnowledgeApi {
    @Resource private IKnowledgeCase knowledge;

    /** 当前用户可管理的知识库。 */
    @Override
    @GetMapping("/knowledge/bases")
    public Response<List<KnowledgeBaseResponseDTO>> bases(Principal principal) {
        return execute(() -> {
            return knowledge.managedBases(actor(principal)).stream().map(this::base).toList();
        });
    }

    /** 创建明确可见范围的知识库。 */
    @Override
    @PostMapping("/knowledge/bases")
    public Response<KnowledgeBaseResponseDTO> createBase(@RequestBody KnowledgeBaseRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);return base(knowledge.createBase(actor(principal),request.getMerchantId(),request.getName(),request.getVisibility()));
        });
    }

    /** 文档版本和索引状态列表。 */
    @Override
    @GetMapping("/knowledge/bases/{baseId}/documents")
    public Response<List<KnowledgeDocumentResponseDTO>> documents(@PathVariable("baseId") String baseId, @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="20") int size, Principal principal) {
        return execute(() -> {
            return knowledge.documents(actor(principal),baseId,page,size).stream().map(d->document(d,false)).toList();
        });
    }

    @Override @GetMapping("/knowledge/bases/{baseId}/documents/page")
    public Response<PageResponseDTO<KnowledgeDocumentResponseDTO>> documentsPage(@PathVariable("baseId") String baseId,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,Principal principal){
        return execute(()->PageResponseDTO.of(knowledge.documents(actor(principal),baseId,page,size).stream().map(d->document(d,false)).toList(),page,size,knowledge.countDocuments(actor(principal),baseId)));
    }

    /** 获授权管理者查看正文。 */
    @Override
    @GetMapping("/knowledge/documents/{documentId}")
    public Response<KnowledgeDocumentResponseDTO> document(@PathVariable("documentId") String documentId, Principal principal) {
        return execute(() -> {
            return document(knowledge.document(actor(principal),documentId),true);
        });
    }

    /** 上传并尝试索引；失败版本可见且可重试。 */
    @Override
    @PostMapping("/knowledge/bases/{baseId}/documents")
    public Response<KnowledgeDocumentResponseDTO> upload(@PathVariable("baseId") String baseId, @RequestBody DocumentUploadRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);return document(knowledge.upload(actor(principal),baseId,request.getRootId(),request.getTitle(),request.getFilename(),request.getContentType(),file(request.getBase64())),false);
        });
    }

    /** 幂等重建此版本的索引。 */
    @Override
    @PostMapping("/knowledge/documents/{documentId}/index")
    public Response<KnowledgeDocumentResponseDTO> index(@PathVariable("documentId") String documentId, Principal principal) {
        return execute(() -> {
            return document(knowledge.index(actor(principal),documentId),false);
        });
    }

    /** 只允许已就绪的最新版本发布生效。 */
    @Override
    @PostMapping("/knowledge/documents/{documentId}/publish")
    public Response<Void> publish(@PathVariable("documentId") String documentId, Principal principal) {
        return execute(() -> {
            knowledge.publish(actor(principal),documentId);return null;
        });
    }

    /** 撤回后立即从 Java 检索白名单排除。 */
    @Override
    @PostMapping("/knowledge/documents/{documentId}/withdraw")
    public Response<Void> withdraw(@PathVariable("documentId") String documentId, Principal principal) {
        return execute(() -> {
            knowledge.withdraw(actor(principal),documentId);return null;
        });
    }
    private KnowledgeBaseResponseDTO base(KnowledgeBaseVO b){return KnowledgeBaseResponseDTO.builder().id(b.id()).name(b.name()).merchantId(b.merchantId()).visibility(b.visibility()).build();}
    private KnowledgeDocumentResponseDTO document(KnowledgeDocumentVO d,boolean body){return KnowledgeDocumentResponseDTO.builder().id(d.id()).rootId(d.rootId()).baseId(d.baseId()).title(d.title()).version(d.version()).status(d.status()).indexStatus(d.indexStatus()).error(d.error()).content(body?d.content():null).createdAt(d.createdAt()).build();}
    private <T> Response<T> execute(Supplier<T> action) {
        try { return Response.<T>builder().code(ResponseCode.SUCCESS.getCode()).info(ResponseCode.SUCCESS.getInfo()).data(action.get()).build(); }
        catch (AppException e) { log.warn("业务请求失败 code={}",e.getCode());return Response.<T>builder().code(e.getCode()).info(e.getInfo()).build(); }
        catch (Exception e) { log.error("接口执行异常",e);return Response.<T>builder().code(ResponseCode.UN_ERROR.getCode()).info(ResponseCode.UN_ERROR.getInfo()).build(); }
    }
}
