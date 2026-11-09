# Agent v1.1 Milvus REST transport probe

Date: 2026-11-10
Branch: `codex/agent-v1-1-m2`
Scope: M1 Milvus transport diagnosis; this report does not close M1 tasks 4.2, 4.3, or 4.4.

## Result

An isolated Milvus REST v2 lifecycle probe completed successfully against the configured endpoint. The probe created a random collection, inserted two synthetic 3-dimensional vectors, loaded the collection, searched it, upserted one entity, deleted one entity, dropped the collection, and verified that the collection no longer existed.

Evidence: [agent-v1.1-milvus-rest-probe-20261110.json](evidence/agent-v1.1-milvus-rest-probe-20261110.json)

All nine lifecycle steps returned HTTP 200 with Milvus response code `0`. The final `has` check returned `false`, and `cleanupVerified=true`. The probe used only a random isolated collection and synthetic vectors; `productionProductCollectionModified=false`.

## Transport boundary

The REST result demonstrates that the configured service is reachable through its REST v2 API. It does not prove that the existing PyMilvus gRPC path works. The companion diagnostic still records:

- PyMilvus product acceptance blocked by the current gRPC/client connection path.
- TLS handshake on port 19530 passed.
- TLS verification on port 443 was blocked by certificate hostname verification (`verifyCode=62`).

Evidence: [agent-v1.1-milvus-diagnostic-20261110.json](evidence/agent-v1.1-milvus-diagnostic-20261110.json)

The current result should therefore be treated as transport evidence for the REST adapter work, not as proof that `ProductIndex` or the existing Milvus client has completed real product acceptance.

## OpenSpec status

The M1 task checkboxes remain unchanged:

- **4.2 remains unchecked.** The REST probe covers isolated CRUD/search lifecycle, but not the application product-index path, 2048-dimensional embedding vectors, or the formal acceptance script's complete evidence contract.
- **4.3 remains unchecked.** No Milvus candidate was passed through the Java/MySQL fact revalidation chain in this probe. The independent Java/MySQL evidence is recorded in the M1 fact-revalidation report on the companion branch/PR.
- **4.4 remains unchecked.** A real Uvicorn + model + embedding + Milvus + Java end-to-end run was not performed.

This report records a useful partial result without promoting a blocked gRPC transport or a synthetic REST probe to full M1 completion.
