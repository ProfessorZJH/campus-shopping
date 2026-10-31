package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.Application;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.RecommendationPolicy;
import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.*;

/** 真实Case/MySQL采集；供应商来源由独立Python计划逐例携带，替身仍为STUB。 */
@SpringBootTest(
    classes = { Application.class, CommerceMySqlIntegrationTest.TimeConfig.class },
    properties = { "campus.jobs.enabled=false", "campus.bootstrap.enabled=false", "campus.security.rate-limit-enabled=false" }
)
@ActiveProfiles("mysql-integration")
@EnabledIfEnvironmentVariable(named = "MYSQL_TEST_URL", matches = ".+")
class ShoppingEvaluationMySqlTest {

    @Autowired
    ApplicationContext context;

    @SpyBean
    ICatalogService catalog;

    @SpyBean
    IAiEnginePort engine;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        CommerceMySqlIntegrationTest.db(registry);
    }

    @Test
    void captureActualRecallAndDerivedFusionWithoutProductionDebugApi() throws Exception {
        String input = Objects.requireNonNull(System.getenv("EVALUATION_INPUT_PATH"), "prepare isolated evaluation input first");
        ObjectMapper mapper = new ObjectMapper();
        JsonNode plan = mapper.readTree(Path.of(input).toFile());
        var fixture = new ShoppingEvaluationFixture(context);
        fixture.load(plan.path("dataset"));
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, JsonNode> cases = new HashMap<>();
        plan.path("dataset")
            .path("cases")
            .forEach(c -> cases.put(c.path("caseId").asText(), c));
        AtomicReference<JsonNode> current = new AtomicReference<>();
        List<List<String>> lexical = new ArrayList<>(),
            verified = new ArrayList<>(),
            sampled = new ArrayList<>();
        doAnswer(call -> {
            @SuppressWarnings("unchecked")
            List<ProductAggregate> actual = (List<ProductAggregate>) call.callRealMethod();
            List<ProductAggregate> effective = current.get().path("experiment").asText().equals("P-D") ? List.of() : actual;
            lexical.add(effective.stream().map(ProductAggregate::getId).toList());
            return effective;
        })
            .when(catalog)
            .recall(anyList(), anyInt());
        doAnswer(call -> {
            @SuppressWarnings("unchecked")
            List<ProductAggregate> actual = (List<ProductAggregate>) call.callRealMethod();
            verified.add(actual.stream().map(ProductAggregate::getId).toList());
            return actual;
        })
            .when(catalog)
            .recallByIds(anyList());
        doAnswer(call -> {
            sampled.add(List.copyOf(call.getArgument(0)));
            return call.callRealMethod();
        })
            .when(catalog)
            .availableOffers(anyList());
        doAnswer(call -> new AiRecallVO(current.get().path("query").asText(), strings(current.get().path("terms"))))
            .when(engine)
            .recall(anyString(), anyList());
        doAnswer(call -> strings(current.get().path("semanticIds")).stream().map(fixture.logicalToActual::get).filter(Objects::nonNull).toList())
            .when(engine)
            .semanticProducts(anyString(), anyInt());
        doAnswer(call -> {
            AiQueryEntity q = call.getArgument(0);
            return new AiAnswerVO("受控建议，不执行交易", "STUB", "STUB", q.retrievalQuery(), "", List.of(), List.of(), 0);
        })
            .when(engine)
            .query(any());
        try {
            for (JsonNode record : plan.path("records")) {
                current.set(record);
                lexical.clear();
                verified.clear();
                sampled.clear();
                JsonNode c = cases.get(record.path("caseId").asText());
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("caseId", c.path("caseId").asText());
                row.put("experiment", record.path("experiment").asText());
                row.put("status", record.path("status").asText());
                Map<String, Object> provenance = mapper.convertValue(record.path("provenance"), Map.class);
                provenance.put("javaMysql", Map.of("source", List.of("REAL"), "attempts", 1, "success", 1, "failure", 0));
                row.put("provenance", provenance);
                if (record.path("status").asText().equals("EXECUTED")) {
                    fixture.f.ai.chat(fixture.actor(c), null, c.path("originalQuery").asText());
                    assertEquals(1, lexical.size());
                    assertEquals(1, verified.size());
                    assertEquals(1, sampled.size());
                    Set<String> eligible = new HashSet<>(lexical.get(0));
                    eligible.addAll(verified.get(0));
                    List<String> semantic = strings(record.path("semanticIds")).stream().map(fixture.logicalToActual::get).filter(Objects::nonNull).toList();
                    List<String> fused = RecommendationPolicy.fuse(lexical.get(0), semantic).stream().filter(eligible::contains).toList();
                    row.put(
                        "stages",
                        Map.of(
                            "product.fused",
                            fused.stream().map(fixture::logical).toList(),
                            "sku.pool",
                            sampled.get(0).stream().map(fixture::logical).toList()
                        )
                    );
                    row.put(
                        "trace",
                        Map.of(
                            "lexical",
                            lexical.get(0).stream().map(fixture::logical).toList(),
                            "semantic",
                            strings(record.path("semanticIds")),
                            "revalidated",
                            verified.get(0).stream().map(fixture::logical).toList(),
                            "traceOrigin",
                            "derived-from-actual-inputs",
                            "skuSelection",
                            "round-robin"
                        )
                    );
                    List<String> actualScope = fixture.f.knowledge
                        .readableScope(fixture.actor(c))
                        .stream()
                        .map(KnowledgeScopeVO::id)
                        .map(fixture::logical)
                        .sorted()
                        .toList();
                    assertEquals(strings(c.path("allowedDocumentIds")).stream().sorted().toList(), actualScope);
                    row.put("actualScope", actualScope);
                } else {
                    row.put("reason", record.path("reason").asText());
                    row.put("stages", Map.of());
                }
                rows.add(row);
            }
            assertEquals(240, fixture.f.jdbc.queryForObject("SELECT COUNT(*) FROM cat_product", Integer.class));
            assertEquals(360, fixture.f.jdbc.queryForObject("SELECT COUNT(*) FROM cat_sku", Integer.class));
            Path output = Path.of(System.getenv().getOrDefault("EVALUATION_OUTPUT_PATH", "target/shopping-evaluation-java.json"));
            Files.createDirectories(output.toAbsolutePath().getParent());
            mapper
                .writerWithDefaultPrettyPrinter()
                .writeValue(
                    output.toFile(),
                    Map.of(
                        "schemaVersion",
                        1,
                        "datasetHash",
                        plan.path("datasetHash").asText(),
                        "adapter",
                        "java-mysql",
                        "profile",
                        plan.path("profile").asText(),
                        "split",
                        plan.path("split").asText(),
                        "database",
                        "campus_shopping_it",
                        "fixtureLoadedViaDomains",
                        true,
                        "logicalIdMap",
                        fixture.logicalToActual,
                        "rows",
                        rows,
                        "inputMeta",
                        Map.of("resources", plan.path("resources"), "actualModels", plan.path("actualModels"))
                    )
                );
        } finally {
            reset(catalog, engine);
        }
    }

    static List<String> strings(JsonNode node) {
        List<String> result = new ArrayList<>();
        node.forEach(v -> result.add(v.asText()));
        return result;
    }
}
