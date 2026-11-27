package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.Application;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.valobj.ProductCandidateSnapshot;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.shoppingai.adapter.port.IAiEnginePort;
import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.*;
import cn.bugstack.ai.domain.shoppingai.service.RecommendationPolicy;
import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.*;

/** 真实Case/MySQL分阶段召回、融合、事实复验采集及真实EXPLAIN执行计划核验；纯向量实验P-D不执行词面召回。 */
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
    IInventoryService inventory;

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

        // 连接池与MyBatis映射预热（不计入实验统计）
        List<String> warmupIds = fixture.logicalToActual.values().stream().limit(5).toList();
        if (!warmupIds.isEmpty()) {
            catalog.recallByIds(warmupIds);
            catalog.recall(List.of("测试"), 10);
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, JsonNode> cases = new HashMap<>();
        plan.path("dataset")
            .path("cases")
            .forEach(c -> cases.put(c.path("caseId").asText(), c));

        AtomicReference<JsonNode> current = new AtomicReference<>();
        List<List<String>> lexical = new ArrayList<>(),
            verified = new ArrayList<>(),
            sampled = new ArrayList<>();
        List<List<ProductCandidateSnapshot>> lexicalSnaps = new ArrayList<>(),
            verifiedSnaps = new ArrayList<>();
        List<Double> lexicalMs = new ArrayList<>(),
            javaSemanticMs = new ArrayList<>(),
            productRevalMs = new ArrayList<>(),
            offerRevalMs = new ArrayList<>(),
            stockRevalMs = new ArrayList<>();
        List<Boolean> lexicalExecutedFlag = new ArrayList<>();

        doAnswer(call -> {
            String exp = current.get().path("experiment").asText();
            if ("P-D".equals(exp) || current.get().path("skipLexicalRecall").asBoolean(false)) {
                // 纯向量实验严禁执行不必要的词面SQL召回，保证P-D计时与路径纯粹性
                lexicalExecutedFlag.add(false);
                lexical.add(List.of());
                lexicalSnaps.add(List.of());
                return List.of();
            }
            long t0 = System.nanoTime();
            @SuppressWarnings("unchecked")
            List<ProductAggregate> actual = (List<ProductAggregate>) call.callRealMethod();
            lexicalMs.add((System.nanoTime() - t0) / 1_000_000.0);
            lexicalExecutedFlag.add(true);
            lexical.add(actual.stream().map(ProductAggregate::getId).toList());
            lexicalSnaps.add(actual.stream().map(ProductCandidateSnapshot::from).toList());
            return actual;
        })
            .when(catalog)
            .recall(anyList(), anyInt());

        doAnswer(call -> {
            long t0 = System.nanoTime();
            @SuppressWarnings("unchecked")
            List<ProductAggregate> actual = (List<ProductAggregate>) call.callRealMethod();
            productRevalMs.add((System.nanoTime() - t0) / 1_000_000.0);
            verified.add(actual.stream().map(ProductAggregate::getId).toList());
            verifiedSnaps.add(actual.stream().map(ProductCandidateSnapshot::from).toList());
            return actual;
        })
            .when(catalog)
            .recallByIds(anyList());

        doAnswer(call -> {
            sampled.add(List.copyOf(call.getArgument(0)));
            long t0 = System.nanoTime();
            Object res = call.callRealMethod();
            offerRevalMs.add((System.nanoTime() - t0) / 1_000_000.0);
            return res;
        })
            .when(catalog)
            .availableOffers(anyList());

        doAnswer(call -> {
            long t0 = System.nanoTime();
            Object res = call.callRealMethod();
            stockRevalMs.add((System.nanoTime() - t0) / 1_000_000.0);
            return res;
        })
            .when(inventory)
            .stocks(anyList());

        doAnswer(call -> new AiRecallVO(current.get().path("query").asText(), strings(current.get().path("terms"))))
            .when(engine)
            .recall(anyString(), anyList());

        doAnswer(call -> {
            long t0 = System.nanoTime();
            List<String> ids = strings(current.get().path("semanticIds"));
            List<SemanticProductRankVO> ranks = new ArrayList<>();
            for (int i = 0; i < ids.size(); i++) {
                String actual = fixture.logicalToActual.get(ids.get(i));
                if (actual != null) ranks.add(new SemanticProductRankVO(actual, i + 1));
            }
            javaSemanticMs.add((System.nanoTime() - t0) / 1_000_000.0);
            return List.copyOf(ranks);
        })
            .when(engine)
            .semanticProductRanks(anyString(), anyInt());

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
                lexicalSnaps.clear();
                verifiedSnaps.clear();
                lexicalMs.clear();
                javaSemanticMs.clear();
                productRevalMs.clear();
                offerRevalMs.clear();
                stockRevalMs.clear();
                lexicalExecutedFlag.clear();

                JsonNode c = cases.get(record.path("caseId").asText());
                String exp = record.path("experiment").asText();
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("caseId", c.path("caseId").asText());
                row.put("experiment", exp);
                row.put("status", record.path("status").asText());
                Map<String, Object> provenance = mapper.convertValue(record.path("provenance"), Map.class);
                provenance.put("javaMysql", Map.of("source", List.of("REAL"), "attempts", 1, "success", 1, "failure", 0));
                row.put("provenance", provenance);

                if (record.path("status").asText().equals("EXECUTED")) {
                    long turnStart = System.nanoTime();
                    fixture.f.ai.chat(fixture.actor(c), null, c.path("originalQuery").asText());
                    double chatTurnTotalMs = (System.nanoTime() - turnStart) / 1_000_000.0;

                    assertEquals(1, lexical.size());
                    assertEquals(1, verified.size());
                    assertEquals(1, sampled.size());
                    if ("P-D".equals(exp)) {
                        assertEquals(List.of(), lexical.get(0));
                        assertEquals(Boolean.FALSE, lexicalExecutedFlag.get(0));
                        assertTrue(lexicalMs.isEmpty());
                    } else {
                        assertEquals(Boolean.TRUE, lexicalExecutedFlag.get(0));
                        assertEquals(1, lexicalMs.size());
                    }

                    Set<String> eligible = new HashSet<>(lexical.get(0));
                    eligible.addAll(verified.get(0));
                    List<String> semantic = strings(record.path("semanticIds")).stream().map(fixture.logicalToActual::get).filter(Objects::nonNull).toList();
                    Map<String, Integer> semanticRankMap = new LinkedHashMap<>();
                    for (int i = 0; i < semantic.size(); i++) semanticRankMap.putIfAbsent(semantic.get(i), i + 1);
                    Map<String, ProductCandidateSnapshot> snapById = new HashMap<>();
                    lexicalSnaps.get(0).forEach(s -> snapById.put(s.productId(), s));
                    verifiedSnaps.get(0).forEach(s -> snapById.put(s.productId(), s));

                    long fuseStart = System.nanoTime();
                    List<String> fused = RecommendationPolicy.fuse(lexical.get(0), semanticRankMap).stream().filter(eligible::contains).toList();
                    List<List<String>> skuGroups = fused
                        .stream()
                        .map(snapById::get)
                        .filter(Objects::nonNull)
                        .map(ProductCandidateSnapshot::activeSkuIds)
                        .toList();
                    RecommendationPolicy.sampleSkus(skuGroups);
                    double fusionMs = (System.nanoTime() - fuseStart) / 1_000_000.0;

                    Double lexStageMs = "P-D".equals(exp) ? null : lexicalMs.get(0);
                    Double vecStageMs = "P-L".equals(exp)
                        ? null
                        : (record.path("vectorSearchMs").isNumber() ? record.path("vectorSearchMs").asDouble() : 0.0) +
                          (javaSemanticMs.isEmpty() ? 0.0 : javaSemanticMs.get(0));
                    double prodRev = productRevalMs.isEmpty() ? 0.0 : productRevalMs.get(0);
                    double offerRev = offerRevalMs.isEmpty() ? 0.0 : offerRevalMs.get(0);
                    double stockRev = stockRevalMs.isEmpty() ? 0.0 : stockRevalMs.get(0);
                    double revalidationMs = prodRev + offerRev + stockRev;
                    double pipelineTotalMs = (lexStageMs != null ? lexStageMs : 0.0) + (vecStageMs != null ? vecStageMs : 0.0) + fusionMs + revalidationMs;

                    Map<String, Object> stageTimings = new LinkedHashMap<>();
                    stageTimings.put("lexicalRecallMs", lexStageMs);
                    stageTimings.put("vectorRecallMs", vecStageMs);
                    stageTimings.put("fusionMs", fusionMs);
                    stageTimings.put("revalidationMs", revalidationMs);
                    stageTimings.put(
                        "revalidationBreakdownMs",
                        Map.of("productRecallByIdsMs", prodRev, "availableOffersMs", offerRev, "inventoryStocksMs", stockRev)
                    );
                    stageTimings.put("pipelineTotalMs", pipelineTotalMs);
                    stageTimings.put("chatTurnTotalMs", chatTurnTotalMs);

                    row.put("latencyMs", pipelineTotalMs);
                    row.put("stageTimingsMs", stageTimings);
                    row.put(
                        "stages",
                        Map.of(
                            "product.fused",
                            fused.stream().map(fixture::logical).toList(),
                            "sku.pool",
                            sampled.get(0).stream().map(fixture::logical).toList()
                        )
                    );
                    Map<String, Object> traceMap = new LinkedHashMap<>();
                    traceMap.put("lexical", lexical.get(0).stream().map(fixture::logical).toList());
                    traceMap.put("lexicalExecuted", lexicalExecutedFlag.get(0));
                    traceMap.put("semantic", strings(record.path("semanticIds")));
                    traceMap.put("revalidated", verified.get(0).stream().map(fixture::logical).toList());
                    traceMap.put("traceOrigin", "derived-from-actual-inputs");
                    traceMap.put("skuSelection", "round-robin");
                    row.put("trace", traceMap);

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
            int expectedProducts = plan.path("dataset").path("products").size();
            int expectedSkus = 0;
            for (JsonNode p : plan.path("dataset").path("products")) {
                expectedSkus += p.path("skus").size();
            }
            assertEquals(expectedProducts, fixture.f.jdbc.queryForObject("SELECT COUNT(*) FROM cat_product", Integer.class));
            assertEquals(expectedSkus, fixture.f.jdbc.queryForObject("SELECT COUNT(*) FROM cat_sku", Integer.class));

            Map<String, Object> sqlDiagnostics = collectRealSqlPlanDiagnostics(fixture, plan.path("records"));

            Path output = Path.of(System.getenv().getOrDefault("EVALUATION_OUTPUT_PATH", "target/shopping-evaluation-java.json"));
            Files.createDirectories(output.toAbsolutePath().getParent());
            Map<String, Object> exportPayload = new LinkedHashMap<>();
            exportPayload.put("schemaVersion", 1);
            exportPayload.put("datasetHash", plan.path("datasetHash").asText());
            exportPayload.put("adapter", "java-mysql");
            exportPayload.put("profile", plan.path("profile").asText());
            exportPayload.put("split", plan.path("split").asText());
            exportPayload.put("database", "campus_shopping_it");
            exportPayload.put("fixtureLoadedViaDomains", true);
            exportPayload.put("logicalIdMap", fixture.logicalToActual);
            exportPayload.put("sqlDiagnostics", sqlDiagnostics);
            exportPayload.put("rows", rows);
            exportPayload.put(
                "inputMeta",
                Map.of("resources", plan.path("resources"), "actualModels", plan.path("actualModels"), "sqlDiagnostics", sqlDiagnostics)
            );
            mapper.writerWithDefaultPrettyPrinter().writeValue(output.toFile(), exportPayload);
        } finally {
            reset(catalog, engine, inventory);
        }
    }

    private static Map<String, Object> collectRealSqlPlanDiagnostics(ShoppingEvaluationFixture fixture, JsonNode records) throws Exception {
        List<String> sampleTerms = new ArrayList<>();
        for (JsonNode rec : records) {
            List<String> candidate = strings(rec.path("terms"));
            if (candidate.size() > sampleTerms.size()) {
                sampleTerms = candidate;
            }
            if (sampleTerms.size() >= 8) break;
        }
        if (sampleTerms.isEmpty()) {
            sampleTerms = List.of("中性笔", "黑色");
        }
        List<String> twoTerms = sampleTerms.subList(0, Math.min(2, sampleTerms.size()));
        List<String> sampleIds = fixture.logicalToActual.values().stream().limit(40).toList();

        String sqlFullTerms = buildRecallSql(sampleTerms, 200);
        String sqlTwoTerms = buildRecallSql(twoTerms, 200);
        String sqlPublicByIds = buildPublicByIdsSql(sampleIds);

        DataSourceHolder ds = new DataSourceHolder(Objects.requireNonNull(fixture.f.jdbc.getDataSource()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mysqlVersion", fixture.f.jdbc.queryForObject("SELECT VERSION()", String.class));
        result.put("optimizerSearchDepth", fixture.f.jdbc.queryForObject("SELECT @@optimizer_search_depth", Integer.class));
        result.put("sampleFullTermCount", sampleTerms.size());
        result.put("sampleFullTerms", sampleTerms);
        result.put("recallFullTermsPlan", ds.inspectQuery("recall_full_terms", sqlFullTerms));
        result.put("recallTwoTermsPlan", ds.inspectQuery("recall_two_terms", sqlTwoTerms));
        if (!sampleIds.isEmpty()) {
            result.put("publicByIdsPlan", ds.inspectQuery("public_by_ids", sqlPublicByIds));
        }
        return result;
    }

    private static String sqlQuote(String raw) {
        return "'" + raw.replace("\\", "\\\\").replace("'", "''") + "'";
    }

    private static String buildRecallSql(List<String> terms, int limit) {
        List<String> whereParts = new ArrayList<>();
        List<String> scoreParts = new ArrayList<>();
        for (String term : terms) {
            String q = sqlQuote(term);
            whereParts.add(
                "(LOCATE(LOWER(" +
                    q +
                    "),LOWER(CONCAT_WS(' ',p.title,p.description,c.name,m.name))) > 0 " +
                    "OR EXISTS (SELECT 1 FROM cat_sku s WHERE s.product_id=p.id AND s.status='ACTIVE' AND LOCATE(LOWER(" +
                    q +
                    "),LOWER(s.spec_key)) > 0))"
            );
            scoreParts.add(
                "(CASE WHEN LOCATE(LOWER(" +
                    q +
                    "),LOWER(p.title)) > 0 THEN 6 ELSE 0 END " +
                    "+ CASE WHEN LOCATE(LOWER(" +
                    q +
                    "),LOWER(p.description)) > 0 THEN 3 ELSE 0 END " +
                    "+ CASE WHEN LOCATE(LOWER(" +
                    q +
                    "),LOWER(COALESCE(c.name,''))) > 0 THEN 1 ELSE 0 END " +
                    "+ CASE WHEN EXISTS (SELECT 1 FROM cat_sku s WHERE s.product_id=p.id AND s.status='ACTIVE' " +
                    "AND LOCATE(LOWER(" +
                    q +
                    "),LOWER(s.spec_key)) > 0) THEN 4 ELSE 0 END)"
            );
        }
        return (
            "SELECT p.* FROM cat_product p " +
            "JOIN mer_merchant m ON m.id=p.merchant_id " +
            "LEFT JOIN cat_category c ON c.code=p.category_code " +
            "WHERE p.status='PUBLISHED' AND m.status='ACTIVE' " +
            "AND EXISTS (SELECT 1 FROM cat_sku active_s WHERE active_s.product_id=p.id AND active_s.status='ACTIVE') " +
            "AND (" +
            String.join(" OR ", whereParts) +
            ") " +
            "ORDER BY (" +
            String.join(" + ", scoreParts) +
            ") DESC, p.created_at DESC, p.id LIMIT " +
            limit
        );
    }

    private static String buildPublicByIdsSql(List<String> ids) {
        String inList = String.join(",", ids.stream().map(ShoppingEvaluationMySqlTest::sqlQuote).toList());
        return (
            "SELECT p.* FROM cat_product p JOIN mer_merchant m ON m.id=p.merchant_id " +
            "WHERE p.id IN (" +
            inList +
            ") AND p.status='PUBLISHED' AND m.status='ACTIVE' " +
            "AND EXISTS (SELECT 1 FROM cat_sku s WHERE s.product_id=p.id AND s.status='ACTIVE')"
        );
    }

    private record DataSourceHolder(javax.sql.DataSource dataSource) {
        Map<String, Object> inspectQuery(String label, String sql) throws Exception {
            Map<String, Object> diag = new LinkedHashMap<>();
            try (Connection conn = dataSource.getConnection(); Statement stmt = conn.createStatement()) {
                long tExplain = System.nanoTime();
                List<String> explainTree = new ArrayList<>();
                try (ResultSet rs = stmt.executeQuery("EXPLAIN FORMAT=TREE " + sql)) {
                    while (rs.next()) explainTree.add(rs.getString(1));
                }
                double explainTreeMs = (System.nanoTime() - tExplain) / 1_000_000.0;

                String lastQueryCost = null;
                try (ResultSet rs = stmt.executeQuery("SHOW SESSION STATUS LIKE 'Last_query_cost'")) {
                    if (rs.next()) lastQueryCost = rs.getString(2);
                }

                // 区分 SQL 编译/连接顺序搜索耗时 (PREPARE) 与实际算子执行耗时 (EXECUTE)
                String stmtName = "eval_stmt_" + label;
                stmt.execute("SET @eval_q = " + sqlQuote(sql));
                long tPrep = System.nanoTime();
                stmt.execute("PREPARE " + stmtName + " FROM @eval_q");
                double prepareOptimizeMs = (System.nanoTime() - tPrep) / 1_000_000.0;

                long tExec = System.nanoTime();
                int rowCount = 0;
                try (ResultSet rs = stmt.executeQuery("EXECUTE " + stmtName)) {
                    while (rs.next()) rowCount++;
                }
                double executeOnlyMs = (System.nanoTime() - tExec) / 1_000_000.0;
                stmt.execute("DEALLOCATE PREPARE " + stmtName);

                long tAnalyze = System.nanoTime();
                List<String> explainAnalyze = new ArrayList<>();
                try (ResultSet rs = stmt.executeQuery("EXPLAIN ANALYZE " + sql)) {
                    while (rs.next()) explainAnalyze.add(rs.getString(1));
                }
                double explainAnalyzeWallMs = (System.nanoTime() - tAnalyze) / 1_000_000.0;

                diag.put("explainTreeMs", explainTreeMs);
                diag.put("prepareOptimizeMs", prepareOptimizeMs);
                diag.put("executeOnlyMs", executeOnlyMs);
                diag.put("explainAnalyzeWallMs", explainAnalyzeWallMs);
                diag.put("returnedRows", rowCount);
                diag.put("lastQueryCost", lastQueryCost);
                diag.put("explainTree", String.join("\n", explainTree).trim());
                diag.put("explainAnalyze", String.join("\n", explainAnalyze).trim());
            }
            return diag;
        }
    }

    static List<String> strings(JsonNode node) {
        List<String> result = new ArrayList<>();
        node.forEach(v -> result.add(v.asText()));
        return result;
    }
}
