package cn.bugstack.ai.trigger.http;
import cn.bugstack.ai.api.ICatalogApi;
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

/** HTTP 入口只做协议转换、可信身份提取和响应封装。 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
public class CatalogController implements ICatalogApi {
    @Resource private ICatalogCase catalogCase;
    @Resource private ICatalogService catalog;

    @Resource private IMerchantService merchants;    @Resource private IInventoryService inventory;

    /** 公开商品搜索与分页。 */
    @Override
    @GetMapping("/products")
    public Response<List<ProductResponseDTO>> products(@RequestParam(required=false) String merchantId, @RequestParam(defaultValue="") String q, @RequestParam(required=false) String category, @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="20") int size) {
        return execute(() -> {
            return products(catalogCase.publicProducts(merchantId,q,category,page,size));
        });
    }

    /** 带总数的商品搜索，供真实前端分页。 */
    @Override @GetMapping("/products/page")
    public Response<PageResponseDTO<ProductResponseDTO>> productPage(@RequestParam(required=false) String merchantId,@RequestParam(defaultValue="") String q,@RequestParam(required=false) String category,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="NEWEST") String sort){
        return execute(()->PageResponseDTO.of(products(catalogCase.publicProductsSorted(merchantId,q,category,page,size,sort)),page,size,catalogCase.countPublicProducts(merchantId,q,category)));
    }

    /** 查看可售商品与实时库存快照。 */
    @Override
    @GetMapping("/products/{productId}")
    public Response<ProductResponseDTO> detail(@PathVariable("productId") String productId) {
        return execute(() -> {
            return products(List.of(catalogCase.publicDetail(productId))).get(0);
        });
    }

    /** 商品类目列表。 */
    @Override
    @GetMapping("/categories")
    public Response<List<CategoryResponseDTO>> categories() {
        return execute(() -> {
            return catalog.categories().stream().map(c->CategoryResponseDTO.builder().code(c.code()).name(c.name()).active(c.active()).build()).toList();
        });
    }

    /** 商户自己的商品，包括草稿和下架。 */
    @Override
    @GetMapping("/merchants/{merchantId}/products")
    public Response<List<ProductResponseDTO>> managed(@PathVariable("merchantId") String merchantId, @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="20") int size, Principal principal) {
        return execute(() -> {
            return products(catalogCase.managedProducts(actor(principal),merchantId,page,size));
        });
    }

    @Override @GetMapping("/merchants/{merchantId}/products/page")
    public Response<PageResponseDTO<ProductResponseDTO>> managedPage(@PathVariable("merchantId") String merchantId,@RequestParam(defaultValue="") String q,@RequestParam(required=false) String category,@RequestParam(required=false) String status,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="NEWEST") String sort,Principal principal){
        return execute(()->PageResponseDTO.of(products(catalogCase.managedProductsSorted(actor(principal),merchantId,q,category,status,page,size,sort)),page,size,catalogCase.countManagedProductsFiltered(actor(principal),merchantId,q,category,status)));
    }

    /** 创建商品、多个规格与空库存。 */
    @Override
    @PostMapping("/merchants/{merchantId}/products")
    public Response<ProductResponseDTO> create(@PathVariable("merchantId") String merchantId, @RequestBody ProductRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);required(request.getSkus());var skus=request.getSkus().stream().map(s->new ProductSkuEntity(null,required(s).getSpecKey(),required(s.getPriceCent()),"ACTIVE",0)).toList();
            var product=catalogCase.create(actor(principal),merchantId,new ProductCreateEntity(request.getTitle(),request.getDescription(),request.getCategoryCode(),request.getImageUrl(),skus));return products(List.of(product)).get(0);
        });
    }

    /** 按版本修改商品资料。 */
    @Override
    @PutMapping("/merchants/{merchantId}/products/{productId}")
    public Response<Void> edit(@PathVariable("merchantId") String merchantId, @PathVariable("productId") String productId, @RequestBody ProductRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);catalogCase.edit(actor(principal),merchantId,productId,request.getTitle(),request.getDescription(),request.getCategoryCode(),request.getImageUrl(),required(request.getExpectedVersion()));return null;
        });
    }

    /** 新增规格并初始化库存。 */
    @Override
    @PostMapping("/merchants/{merchantId}/products/{productId}/skus")
    public Response<ProductResponseDTO> addSku(@PathVariable("merchantId") String merchantId, @PathVariable("productId") String productId, @RequestBody SkuRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);return products(List.of(catalogCase.addSku(actor(principal),merchantId,productId,request.getSpecKey(),required(request.getPriceCent())))).get(0);
        });
    }

    /** 按确认版本修改 SKU 售价。 */
    @Override
    @PutMapping("/merchants/{merchantId}/products/{productId}/skus/{skuId}/price")
    public Response<Void> price(@PathVariable("merchantId") String merchantId, @PathVariable("productId") String productId, @PathVariable("skuId") String skuId, @RequestBody PriceRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);catalogCase.price(actor(principal),merchantId,productId,skuId,required(request.getPriceCent()),required(request.getExpectedVersion()));return null;
        });
    }

    /** 上架或下架商品。 */
    @Override
    @PostMapping("/merchants/{merchantId}/products/{productId}/publish")
    public Response<Void> publish(@PathVariable("merchantId") String merchantId, @PathVariable("productId") String productId, @RequestBody PublishRequestDTO request, Principal principal) {
        return execute(() -> {
            catalogCase.publish(actor(principal),merchantId,productId,required(required(request).getPublished()));return null;
        });
    }

    /** 验证图片像素并重编码为 PNG，拒绝 SVG。 */
    @Override
    @PostMapping("/merchants/{merchantId}/images")
    public Response<ImageResponseDTO> image(@PathVariable("merchantId") String merchantId, @RequestBody FileUploadRequestDTO request, Principal principal) {
        return execute(() -> {
            return ImageResponseDTO.builder().url(catalogCase.image(actor(principal),merchantId,file(required(request).getBase64()))).build();
        });
    }

    /** 平台违规商品下架。 */
    @Override
    @PostMapping("/admin/products/{productId}/unpublish")
    public Response<Void> forceUnpublish(@PathVariable("productId") String productId, Principal principal) {
        return execute(() -> {
            catalogCase.forceUnpublish(actor(principal),productId);return null;
        });
    }

    /** 平台维护类目。 */
    @Override
    @PostMapping("/admin/categories")
    public Response<Void> category(@RequestBody CategoryRequestDTO request, Principal principal) {
        return execute(() -> {
            required(request);catalogCase.category(actor(principal),request.getCode(),request.getName(),required(request.getActive()));return null;
        });
    }
    private List<ProductResponseDTO> products(List<ProductAggregate> products){
        // 分页商品最多 100 件、每件最多 20 个 SKU；按领域库存查询上限分批读取。
        var ids=products.stream().flatMap(p->p.getSkus().stream()).map(ProductSkuEntity::id).distinct().toList();
        Map<String,StockVO> stocks=new HashMap<>();
        for(int start=0;start<ids.size();start+=500){
            inventory.stocks(ids.subList(start,Math.min(start+500,ids.size())))
                    .forEach(s->stocks.put(s.skuId(),s));
        }
        Map<String,String> names=new HashMap<>();
        return products.stream().map(p->{var view=ApiViews.product(p,stocks);
           view.setMerchantName(names.computeIfAbsent(p.getMerchantId(),m->merchants.find(m).name()));return view;}).toList();
    }
    /** 平台监管列表展示所有状态；权限仍由用例重新校验。 */
    @Override
    @GetMapping("/admin/products")
    public Response<List<ProductResponseDTO>> adminProducts(@RequestParam(required=false) String merchantId,@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,Principal principal){
        return execute(()->products(catalogCase.adminProducts(actor(principal),merchantId,q,page,size)));
    }

    @Override @GetMapping("/admin/products/page")
    public Response<PageResponseDTO<ProductResponseDTO>> adminProductPage(@RequestParam(required=false) String merchantId,@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,Principal principal){
        return execute(()->PageResponseDTO.of(products(catalogCase.adminProducts(actor(principal),merchantId,q,page,size)),page,size,catalogCase.countAdminProducts(actor(principal),merchantId,q)));
    }

    private <T> Response<T> execute(Supplier<T> action) {
        try { return Response.<T>builder().code(ResponseCode.SUCCESS.getCode()).info(ResponseCode.SUCCESS.getInfo()).data(action.get()).build(); }
        catch (AppException e) { log.warn("业务请求失败 code={}",e.getCode());return Response.<T>builder().code(e.getCode()).info(e.getInfo()).build(); }
        catch (Exception e) { log.error("接口执行异常",e);return Response.<T>builder().code(ResponseCode.UN_ERROR.getCode()).info(ResponseCode.UN_ERROR.getInfo()).build(); }
    }
}
