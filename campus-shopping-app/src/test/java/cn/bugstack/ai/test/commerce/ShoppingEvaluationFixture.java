package cn.bugstack.ai.test.commerce;

import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.cases.catalog.model.ProductSnapshot;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.*;
import cn.bugstack.ai.domain.inventory.model.valobj.SkuQuantityVO;
import cn.bugstack.ai.domain.merchant.model.entity.AdmissionCommandEntity;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
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
    final Map<String, String> clerks = new HashMap<>();
    final Map<String, String> clerkRoleCodes = new HashMap<>();
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
        Set<String> seenCategories = new LinkedHashSet<>();
        seenCategories.add("evaluation");
        for (JsonNode p : data.path("products")) {
            String code = p.path("categoryCode").asText("evaluation");
            if (seenCategories.add(code)) {
                f.catalog.upsertCategory(f.admin, code, "评测类目-" + code, true);
            }
        }
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
        List<JsonNode> docsToLoad = new ArrayList<>();
        data.path("knowledge").forEach(docsToLoad::add);
        docsToLoad.sort(Comparator.comparingInt(d -> d.hasNonNull("rootKey") && !d.path("rootKey").asText().isBlank() ? d.path("version").asInt(1) : 1));
        Map<String, String> rootBaseIds = new HashMap<>();
        Map<String, String> rootDocIds = new HashMap<>();
        for (JsonNode d : docsToLoad) {
            String mid = d.path("merchantId").isNull() ? null : d.path("merchantId").asText();
            String actor = mid == null ? f.admin : owners.get(mid);
            String visibility = d.path("visibility").asText();
            String rootKey = d.hasNonNull("rootKey") ? d.path("rootKey").asText().trim() : "";
            KnowledgeDocumentVO doc;
            if (!rootKey.isEmpty()) {
                String groupKey = (mid == null ? "PLATFORM" : mid) + "|" + visibility + "|" + rootKey;
                String baseId = rootBaseIds.computeIfAbsent(groupKey, k ->
                    f.knowledge.createBase(actor, mid == null ? null : merchants.get(mid).id(), d.path("title").asText(), visibility).id()
                );
                doc = f.aiState.createDocument(rootDocIds.get(groupKey), baseId, d.path("title").asText(), d.path("content").asText());
                rootDocIds.putIfAbsent(groupKey, doc.rootId());
            } else {
                var base = f.knowledge.createBase(actor, mid == null ? null : merchants.get(mid).id(), d.path("title").asText(), visibility);
                doc = f.aiState.createDocument(null, base.id(), d.path("title").asText(), d.path("content").asText());
            }
            f.aiState.completeIndex(f.aiState.beginIndex(doc.id()), true, "");
            if (!d.path("status").asText().equals("DRAFT")) f.knowledge.publish(actor, doc.id());
            if (d.path("status").asText().equals("WITHDRAWN")) f.knowledge.withdraw(actor, doc.id());
            map(d.path("documentId").asText(), doc.id());
        }
        for (JsonNode c : data.path("cases")) {
            String ref = c.path("actorRef").asText();
            if (ref.startsWith("merchant-clerk-read-") || ref.startsWith("merchant-clerk-noread-")) {
                ensureClerk(ref);
            }
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
        ProductSnapshot created = f.catalog
            .createProduct(
                owner,
                merchant.id(),
                new ProductCreateCommandEntity(p.path("title").asText(), p.path("description").asText(), p.path("categoryCode").asText("evaluation"), "", skus)
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

    String ensureClerk(String actorRef) {
        return clerks.computeIfAbsent(actorRef, ref -> {
            boolean canReadKnowledge = ref.startsWith("merchant-clerk-read-");
            String prefix = canReadKnowledge ? "merchant-clerk-read-" : "merchant-clerk-noread-";
            String mid = ref.substring(prefix.length());
            MerchantVO merchant = Objects.requireNonNull(merchants.get(mid), "unknown clerk merchant: " + mid);
            String owner = Objects.requireNonNull(owners.get(mid), "unknown clerk owner: " + mid);
            String username = (canReadKnowledge ? "eval_cr_" : "eval_cn_") + mid;
            String clerkUser = f.accounts.register(username, CommerceMySqlIntegrationTest.PASSWORD, "合成店员").getUserId();
            var invitation = f.access.invite(owner, merchant.id(), username);
            f.access.accept(clerkUser, invitation.id());
            String roleKey = mid + "|" + (canReadKnowledge ? "read" : "noread");
            String roleCode = clerkRoleCodes.computeIfAbsent(roleKey, k ->
                f.roles
                    .saveRole(
                        owner,
                        merchant.id(),
                        null,
                        canReadKnowledge ? "评测知识可读店员" : "评测商品只读店员",
                        canReadKnowledge ? Set.of("knowledge.read") : Set.of("product.read")
                    )
                    .code()
            );
            f.roles.assignRole(owner, merchant.id(), clerkUser, roleCode);
            return clerkUser;
        });
    }

    String actor(JsonNode c) {
        String actor = c.path("actorRef").asText();
        if (actor.equals("platform-admin")) return f.admin;
        if (actor.startsWith("merchant-owner-")) return owners.get(actor.substring(15));
        if (actor.startsWith("merchant-clerk-read-") || actor.startsWith("merchant-clerk-noread-")) return ensureClerk(actor);
        return f.buyer;
    }
}
