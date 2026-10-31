package cn.bugstack.ai.test.commerce;

import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.*;
import cn.bugstack.ai.domain.inventory.model.valobj.SkuQuantityVO;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import org.springframework.context.ApplicationContext;
import org.springframework.transaction.support.TransactionTemplate;

/** 只用于专用MySQL测试库，通过所属领域装载冻结快照，不向生产提供导入入口。 */
final class ShoppingEvaluationFixture {

    final CommerceMySqlIntegrationTest f;
    final Map<String, String> logicalToActual = new LinkedHashMap<>();
    final Map<String, String> actualToLogical = new LinkedHashMap<>();
    final Map<String, MerchantVO> merchants = new HashMap<>();
    final Map<String, String> owners = new HashMap<>();
    final ApplicationContext context;

    ShoppingEvaluationFixture(ApplicationContext context) {
        this.context = context;
        f = new CommerceMySqlIntegrationTest();
        context.getAutowireCapableBeanFactory().autowireBean(f);
        f.aiEngine = context.getBean(cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort.class);
        f.merchantService = context.getBean(cn.bugstack.ai.domain.merchant.service.IMerchantService.class);
        f.accessRepository = context.getBean(cn.bugstack.ai.infrastructure.adapter.repository.AccessRepository.class);
        f.inventoryService = context.getBean(cn.bugstack.ai.domain.inventory.service.impl.InventoryServiceImpl.class);
        f.fixture();
    }

    void map(String logical, String actual) {
        logicalToActual.put(logical, actual);
        actualToLogical.put(actual, logical);
    }

    String logical(String actual) {
        return Objects.requireNonNull(actualToLogical.get(actual), "unmapped actual ID");
    }

    void load(JsonNode data) {
        f.catalog.upsertCategory(f.admin, "evaluation", "合成评测", true);
        for (JsonNode m : data.path("merchants").path("merchants")) {
            String id = m.path("merchantId").asText();
            if (id.equals("m0")) {
                f.admission.updateProfile(f.owner, f.merchant.id(), m.path("name").asText(), "合成门店", "测试校区");
                merchants.put(id, f.merchant);
                owners.put(id, f.owner);
                map(id, f.merchant.id());
                continue;
            }
            String owner = f.accounts.register("evaluation_owner_" + id, CommerceMySqlIntegrationTest.PASSWORD, "合成经营者").getUserId();
            var application = f.applications.submitDetailed(
                owner,
                new AdmissionCommandEntity(m.path("name").asText(), "文具", "测试联系人", "10000000000", "合成门店", "测试校区"),
                "eval-" + id
            );
            MerchantVO merchant = f.admission.approve(f.admin, application.getApplicationId());
            merchants.put(id, merchant);
            owners.put(id, owner);
            map(id, merchant.id());
        }
        f.applications.submitDetailed(
            f.other,
            new AdmissionCommandEntity("合成待审商户", "文具", "测试联系人", "10000000000", "待审门店", "测试校区"),
            "evaluation-pending"
        );
        for (JsonNode p : data.path("products")) loadProduct(p);
        for (JsonNode d : data.path("knowledge")) {
            String mid = d.path("merchantId").isNull() ? null : d.path("merchantId").asText();
            String actor = mid == null ? f.admin : owners.get(mid);
            var base = f.knowledge.createBase(actor, mid == null ? null : merchants.get(mid).id(), d.path("title").asText(), d.path("visibility").asText());
            var doc = f.aiState.createDocument(null, base.id(), d.path("title").asText(), d.path("content").asText());
            f.aiState.completeIndex(f.aiState.beginIndex(doc.id()), true, "");
            if (!d.path("status").asText().equals("DRAFT")) f.knowledge.publish(actor, doc.id());
            if (d.path("status").asText().equals("WITHDRAWN")) f.knowledge.withdraw(actor, doc.id());
            map(d.path("documentId").asText(), doc.id());
        }
        for (JsonNode m : data.path("merchants").path("merchants")) {
            if (m.path("status").asText().equals("SUSPENDED")) f.admission.setActive(
                f.admin,
                logicalToActual.get(m.path("merchantId").asText()),
                false,
                "合成评测停用"
            );
        }
    }

    private void loadProduct(JsonNode p) {
        String mid = p.path("merchantId").asText();
        MerchantVO merchant = merchants.get(mid);
        String owner = owners.get(mid);
        List<ProductSkuEntity> skus = new ArrayList<>();
        for (JsonNode s : p.path("skus")) skus.add(new ProductSkuEntity(null, s.path("specKey").asText(), s.path("priceCent").asLong(), "ACTIVE", 0));
        ProductAggregate created = f.catalog
            .createProduct(
                owner,
                merchant.id(),
                new ProductCreateCommandEntity(p.path("title").asText(), p.path("description").asText(), "evaluation", "", skus)
            )
            .product();
        map(p.path("productId").asText(), created.getId());
        List<ProductSkuEntity> snapshot = new ArrayList<>();
        for (int i = 0; i < created.getSkus().size(); i++) {
            JsonNode s = p.path("skus").get(i);
            var actual = created.getSkus().get(i);
            map(s.path("skuId").asText(), actual.id());
            if (s.path("onHand").asInt() > 0) f.catalog.replenishStock(owner, merchant.id(), actual.id(), s.path("onHand").asInt(), "eval-" + actual.id());
            if (s.path("reserved").asInt() > 0) new TransactionTemplate(f.transactionManager).executeWithoutResult(status ->
                f.inventoryService.reserve(actual.id(), merchant.id(), merchant.storeId(), List.of(new SkuQuantityVO(actual.id(), s.path("reserved").asInt())))
            );
            snapshot.add(new ProductSkuEntity(actual.id(), actual.specKey(), actual.priceCent(), s.path("status").asText(), actual.version()));
        }
        // 没有“导入旧状态”用例，测试通过商品本域仓储装载状态；不跨域写表或放开生产API。
        new TransactionTemplate(f.transactionManager).executeWithoutResult(status -> {
            var repo = context.getBean(ICatalogRepository.class);
            var current = repo.find(created.getId(), true);
            repo.save(
                new ProductAggregate(
                    current.getId(),
                    current.getMerchantId(),
                    current.getStoreId(),
                    current.getTitle(),
                    current.getDescription(),
                    current.getCategoryCode(),
                    "",
                    p.path("status").asText(),
                    current.getVersion(),
                    snapshot
                )
            );
        });
    }

    String actor(JsonNode c) {
        String actor = c.path("actorRef").asText();
        return actor.equals("platform-admin") ? f.admin : actor.startsWith("merchant-owner-") ? owners.get(actor.substring(15)) : f.buyer;
    }
}
