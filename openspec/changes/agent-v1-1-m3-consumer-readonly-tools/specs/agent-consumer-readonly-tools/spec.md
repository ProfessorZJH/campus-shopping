# Spec Delta

## Purpose

为消费者提供受控 Run 内的知识问答和本人订单只读能力。Java 必须继续裁决身份、知识授权、订单归属及交易事实，模型只能理解请求、选择已声明工具并生成回答。

## ADDED Requirements

### Requirement: Consumer tools are explicitly read-only

Agent Runtime SHALL expose only `search_products`, `knowledge_qa`, and `get_my_orders` for this capability, and each tool MUST be marked read-only with a versioned schema.

#### Scenario: Unknown or write tool

- **WHEN** the model requests a tool outside the declared consumer set, including cart, order creation, payment, or inventory mutation
- **THEN** Java rejects the invocation with a stable authorization or parameter error and performs no business write

#### Scenario: Existing search remains compatible

- **WHEN** an M2 Run requests `search_products` with its existing valid schema
- **THEN** the request keeps the M2 result shape and Java fact revalidation behavior

### Requirement: Knowledge answers use the current authorized scope

`knowledge_qa` MUST use a scope computed by Java for the current actor and MUST revalidate that scope before accepting citations or returning an answer.

#### Scenario: Consumer asks a public knowledge question

- **WHEN** an active consumer Run submits a valid question and the authorized scope is unchanged
- **THEN** the tool returns an answer or bounded retrieval result with only citations from that scope

#### Scenario: Scope changes during model work

- **WHEN** a document is withdrawn, a merchant becomes inactive, or the actor loses knowledge permission before the result is finalized
- **THEN** Java rejects or degrades the result without returning the revoked citation or inferring a replacement scope

#### Scenario: Model names an unauthorized document

- **WHEN** the model returns a citation or document ID outside Java's current readable scope
- **THEN** Java drops the citation or fails the tool safely and does not expose the document content

### Requirement: Own-order queries are bound to the caller

`get_my_orders` MUST query orders with the current actor as buyer, accept only bounded read filters, and return a narrow immutable summary rather than a mutable aggregate or merchant-operation view.

#### Scenario: Consumer reads own orders

- **WHEN** an active consumer Run requests a valid page, size, or state filter without a merchant override
- **THEN** Java returns only orders whose buyer is the actor, with bounded order/item summary fields and no write side effect

#### Scenario: Cross-user or merchant override

- **WHEN** a tool argument attempts another buyer, merchant-wide scope, pickup location, after-sale timeline, or administrative filter
- **THEN** Java rejects the argument or ignores the unsupported field and never reads another buyer's order

#### Scenario: No matching orders

- **WHEN** the actor has no orders matching the bounded filter
- **THEN** the tool returns an empty immutable page with a stable total and no fabricated order facts

### Requirement: Tool results preserve Run safety and bounded failure

New consumer tools MUST use the existing Run capability, lease, allow-list, invocation idempotency, and round-trip limits; failures MUST not be converted into successful business facts.

#### Scenario: Repeated read invocation

- **WHEN** the same Run submits the same invocation key and input fingerprint again
- **THEN** Java replays the saved read result without repeating the underlying query; a different payload with the same key fails with a conflict

#### Scenario: Runtime or downstream failure

- **WHEN** the Runtime, knowledge engine, or order read dependency times out or returns an unavailable/error result
- **THEN** the tool returns a stable degraded/error category, does not commit a transaction write, and does not present an empty or guessed answer as success

### Requirement: Capability rollout remains private and versioned

The consumer tools MUST be enabled only after Java and Python schemas, fixtures, and compatibility tests agree; no public HTTP route or generated user API is added by this capability.

#### Scenario: Java/Python schema mismatch

- **WHEN** either side does not support the same tool version or required fields
- **THEN** the Run fails safely before executing a new tool and the existing `/ai/chat`, SSE, Proposal, and M2 search behavior remain available

#### Scenario: Direct public access

- **WHEN** a browser or unauthenticated client attempts to call the internal consumer tool path
- **THEN** the request is rejected and no consumer or merchant data is queried
