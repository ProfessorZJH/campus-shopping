#!/usr/bin/env python3
"""Run the M1.4.3 Milvus-candidate -> Java/MySQL fact revalidation probe.

The probe starts from a read-only public Java catalog snapshot, writes only
that snapshot to a newly generated isolated Milvus collection, searches the
collection, and then re-reads every returned product through Java's detail
endpoint.  It never calls a business write endpoint and refuses to reuse the
production product collection.  A Java service must already be running on a
loopback address.  Missing prerequisites are reported as ``NOT_RUN``.
"""
from __future__ import annotations

import argparse
from dataclasses import replace
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-service"))

from app.agent_contract import AgentScope
from app.agent_evidence import assert_isolated_collection, isolated_collection_name, safe_exception_code
from app.agent_fact import revalidate_product_candidates
from app.config import Settings, validate_service_url
from app.product_index import ProductIndex
from app.provider import Provider


LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}
PRODUCTION_COLLECTION = "campus_products_v1"


class ProbeNotRun(RuntimeError):
    """The optional real acceptance probe cannot run in this environment."""


def load_env(path: Path) -> None:
    """Load simple KEY=value files without invoking a shell or printing values."""

    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def assert_loopback(url: str, label: str) -> urllib.parse.ParseResult:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in LOOPBACK_HOSTS:
        raise ValueError(f"{label} must use a loopback HTTP(S) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError(f"{label} must not embed credentials or query parameters")
    return parsed


def _request_json(
    base_url: str,
    method: str,
    path: str,
    *,
    tolerate_not_found: bool = False,
) -> dict | None:
    request = urllib.request.Request(
        base_url.rstrip("/") + path,
        headers={"Accept": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            value = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        if tolerate_not_found and error.code == 404:
            return None
        raise ProbeNotRun(f"{method} {path.split('?', 1)[0]} returned HTTP {error.code}") from None
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise ProbeNotRun(f"{method} {path.split('?', 1)[0]} unavailable: {type(error).__name__}") from None
    if not isinstance(value, dict):
        raise ProbeNotRun(f"{method} {path} returned a non-object response")
    return value


def _items(response: dict) -> tuple[list[dict], bool]:
    if response.get("code") != "0000":
        raise ProbeNotRun("Java catalog response was not successful")
    data = response.get("data")
    if isinstance(data, dict):
        raw_items = data.get("items")
        has_next = bool(data.get("hasNext"))
    else:
        raw_items = data
        has_next = False
    if not isinstance(raw_items, list):
        raise ProbeNotRun("Java catalog response has no product items")
    return [item for item in raw_items if isinstance(item, dict)], has_next


def java_products_to_index(products: list[dict]) -> list[dict]:
    """Convert Java public views into the ProductIndex's write-only DTO.

    The vector sync contract indexes active SKU metadata even when the current
    stock snapshot is empty.  Stock is therefore deliberately rechecked only
    after Milvus returns candidate IDs.
    """

    result: list[dict] = []
    seen: set[str] = set()
    for product in products:
        product_id = product.get("productId")
        merchant_id = product.get("merchantId")
        title = product.get("title")
        if not all(isinstance(value, str) and value for value in (product_id, merchant_id, title)):
            continue
        if product_id in seen or product.get("status") not in (None, "PUBLISHED"):
            continue
        valid_specs: list[str] = []
        for sku in product.get("skus") or []:
            if not isinstance(sku, dict):
                continue
            spec = sku.get("specKey")
            price = sku.get("priceCent")
            available = sku.get("available")
            if (
                isinstance(spec, str)
                and bool(spec)
                and sku.get("status") in (None, "ACTIVE")
                and isinstance(price, int)
                and not isinstance(price, bool)
                and price > 0
                and isinstance(available, int)
                and not isinstance(available, bool)
                and available >= 0
            ):
                valid_specs.append(spec)
        if not valid_specs:
            continue
        result.append(
            {
                "productId": product_id,
                "merchantId": merchant_id,
                "title": title,
                "description": (
                    product.get("description") if isinstance(product.get("description"), str) else ""
                ),
                "categoryCode": (
                    product.get("categoryCode")
                    if isinstance(product.get("categoryCode"), str)
                    else "uncategorized"
                ),
                "specs": valid_specs,
            }
        )
        seen.add(product_id)
    return result


def java_product_to_fact_rows(product: dict) -> list[dict]:
    """Convert one Java detail response into strict CatalogFactSnapshot rows."""

    product_id = product.get("productId")
    merchant_id = product.get("merchantId")
    title = product.get("title")
    published = product.get("status") == "PUBLISHED"
    eligible = published and isinstance(merchant_id, str) and bool(merchant_id)
    if not all(isinstance(value, str) and value for value in (product_id, merchant_id, title)):
        return []
    rows: list[dict] = []
    for sku in product.get("skus") or []:
        if not isinstance(sku, dict):
            continue
        if sku.get("status") not in (None, "ACTIVE"):
            continue
        rows.append(
            {
                "productId": product_id,
                "merchantId": merchant_id,
                "title": title,
                "skuId": sku.get("skuId"),
                "priceCent": sku.get("priceCent"),
                "available": sku.get("available"),
                "published": published,
                "merchantEligible": eligible,
            }
        )
    return rows


def read_public_catalog(base_url: str, query: str, page_size: int, max_pages: int) -> list[dict]:
    if not 1 <= page_size <= 100:
        raise ValueError("page size must be between 1 and 100")
    if not 1 <= max_pages <= 100:
        raise ValueError("max pages must be between 1 and 100")
    products: list[dict] = []
    for page in range(1, max_pages + 1):
        path = "/api/v1/products/page?" + urllib.parse.urlencode(
            {"q": query, "page": page, "size": page_size, "sort": "NEWEST"}
        )
        response = _request_json(base_url, "GET", path)
        assert response is not None
        page_items, has_next = _items(response)
        products.extend(page_items)
        if not has_next:
            return products
        if not page_items:
            raise ProbeNotRun("Java catalog pagination returned an empty page with hasNext=true")
    raise ProbeNotRun("Java catalog exceeded the bounded page limit")


class JavaDetailFactPort:
    """Read-only Java detail adapter used by the existing Python fact contract."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.requested_ids: list[str] = []
        self.detail_reads = 0
        self.detail_not_found = 0
        self.detail_non_success = 0
        self.detail_invalid = 0
        self.non_published_product_count = 0
        self.non_active_sku_count = 0
        self.no_stock_sku_count = 0
        self.non_published_product_ids: set[str] = set()
        self.non_active_product_ids: set[str] = set()
        self.no_stock_product_ids: set[str] = set()
        self.not_found_product_ids: set[str] = set()

    def read_current_product_facts(self, product_ids: list[str], scope: AgentScope) -> list[dict]:
        scope.assert_active()
        rows: list[dict] = []
        for product_id in list(dict.fromkeys(product_ids)):
            self.requested_ids.append(product_id)
            path = "/api/v1/products/" + urllib.parse.quote(product_id, safe="")
            response = _request_json(self.base_url, "GET", path, tolerate_not_found=True)
            if response is None:
                self.detail_not_found += 1
                self.not_found_product_ids.add(product_id)
                continue
            if response.get("code") != "0000":
                self.detail_non_success += 1
                continue
            detail = response.get("data")
            if not isinstance(detail, dict):
                self.detail_invalid += 1
                continue
            self.detail_reads += 1
            if detail.get("status") != "PUBLISHED":
                self.non_published_product_count += 1
                self.non_published_product_ids.add(product_id)
            for sku in detail.get("skus") or []:
                if not isinstance(sku, dict):
                    continue
                if sku.get("status") not in (None, "ACTIVE"):
                    self.non_active_sku_count += 1
                    self.non_active_product_ids.add(product_id)
                    continue
                available = sku.get("available")
                if isinstance(available, int) and not isinstance(available, bool) and available <= 0:
                    self.no_stock_sku_count += 1
                    self.no_stock_product_ids.add(product_id)
            rows.extend(java_product_to_fact_rows(detail))
        scope.assert_active()
        return rows


def _scope() -> AgentScope:
    token = secrets.token_urlsafe(18)
    expires = datetime.now(timezone.utc).timestamp() + 600
    return AgentScope(
        user_id="m1-4-3-harness",
        identity_kind="consumer",
        permissions=frozenset({"catalog.product.search"}),
        authorization_source="java-public-catalog-read",
        turn_token=token,
        turn_expires_at=expires,
        lease_checker=lambda current, expected: current == token and expected == expires,
    )


def run(args: argparse.Namespace) -> dict:
    java_url = args.java_base_url.rstrip("/")
    assert_loopback(java_url, "Java base URL")
    try:
        settings = Settings.from_env()
    except (TypeError, ValueError) as error:
        raise ProbeNotRun("AI/Embedding/Milvus environment could not be parsed") from error
    if not all((settings.embedding_url, settings.embedding_key, settings.embedding_model)):
        raise ProbeNotRun("Embedding configuration is incomplete")
    if not all((settings.milvus_uri, settings.milvus_token)):
        raise ProbeNotRun("Milvus configuration is incomplete")
    started = datetime.now(timezone.utc).isoformat()
    seed_products = read_public_catalog(java_url, args.catalog_query, args.page_size, args.max_pages)
    index_products = java_products_to_index(seed_products)
    if not index_products:
        raise ProbeNotRun("Java catalog returned no currently sellable products")
    query = args.query.strip() or index_products[0]["title"]
    collection = isolated_collection_name()
    assert_isolated_collection(collection, PRODUCTION_COLLECTION)

    with tempfile.TemporaryDirectory(prefix="campus-agent-m1-4-3-") as directory:
        isolated = replace(
            settings,
            api_key=secrets.token_urlsafe(32),
            db_path=str(Path(directory) / "harness.sqlite3"),
            product_collection=collection,
        )
        try:
            isolated.validate()
            validate_service_url(isolated.embedding_url, "Embedding", isolated.trusted_http_hosts)
            validate_service_url(isolated.milvus_uri, "Milvus", isolated.trusted_http_hosts, root_only=True)
        except ValueError as error:
            raise ProbeNotRun("isolated Embedding/Milvus configuration failed safety validation") from error

        index = ProductIndex(isolated, Provider(isolated))
        client = None
        collection_was_absent = False
        operation_error: BaseException | None = None
        cleanup_error: BaseException | None = None
        candidate_ids: list[str] = []
        verified: list[dict] = []
        port = JavaDetailFactPort(java_url)
        unknown_boundary_dropped = False
        try:
            client = index._connect()
            if client.has_collection(collection_name=collection):
                raise ProbeNotRun("generated Milvus collection already exists; refusing to reuse it")
            collection_was_absent = True
            first = index.upsert(index_products)
            if not client.has_collection(collection_name=collection) or first.get("indexed") != len(index_products):
                raise AssertionError("isolated Milvus index write count did not match the Java snapshot")
            search = index.search(query, args.limit)
            candidate_ids = [str(value) for value in search.get("productIds", []) if value]
            if not candidate_ids:
                raise AssertionError("isolated Milvus search returned no candidate IDs")
            indexed_ids = {item["productId"] for item in index_products}
            if not set(candidate_ids).issubset(indexed_ids):
                raise AssertionError("Milvus returned a candidate outside the Java seed snapshot")
            verified = revalidate_product_candidates(candidate_ids, _scope(), port)
            verified_ids = {item["productId"] for item in verified}
            if not verified:
                raise AssertionError("Java detail revalidation accepted no Milvus candidates")
            if not verified_ids.issubset(set(candidate_ids)):
                raise AssertionError("Java revalidation returned a product outside the Milvus candidate set")
            unknown_boundary_dropped = not revalidate_product_candidates(
                ["m1-harness-unknown-candidate"], _scope(), port
            )
            if not unknown_boundary_dropped:
                raise AssertionError("unknown Java product ID was not filtered")
        except BaseException as error:  # noqa: BLE001 - report only a stable error code below
            operation_error = error
        finally:
            if collection_was_absent and client is not None:
                try:
                    if client.has_collection(collection_name=collection):
                        client.drop_collection(collection_name=collection)
                    if client.has_collection(collection_name=collection):
                        raise AssertionError("isolated Milvus collection cleanup failed")
                except BaseException as error:  # noqa: BLE001 - report only a stable error code below
                    cleanup_error = error
            if client is not None:
                client.close()
        if operation_error is not None:
            raise operation_error
        if cleanup_error is not None:
            raise cleanup_error

    return {
        "startedAt": started,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "status": "PASS",
        "evidenceStatus": "REAL",
        "chain": "REAL_JAVA_MYSQL_PUBLIC_FACTS_TO_ISOLATED_REAL_MILVUS_TO_JAVA_DETAIL_REVALIDATION",
        "javaSeedSource": "GET /api/v1/products/page",
        "javaRevalidationSource": "GET /api/v1/products/{productId}",
        "isolatedMilvusCollection": collection,
        "seedProductCount": len(index_products),
        "candidateCount": len(candidate_ids),
        "revalidatedCount": len(verified),
        "filteredCandidateCount": len(set(candidate_ids) - {item["productId"] for item in verified}),
        "javaDetailReads": port.detail_reads,
        "requestedCandidateCount": len(candidate_ids),
        "javaDetail404Count": port.detail_not_found,
        "javaDetailNonSuccessCount": port.detail_non_success,
        "javaDetailInvalidCount": port.detail_invalid,
        "nonPublishedProductCount": port.non_published_product_count,
        "nonActiveSkuCount": port.non_active_sku_count,
        "noStockSkuCount": port.no_stock_sku_count,
        "nonPublishedCandidateCount": len(port.non_published_product_ids),
        "nonActiveCandidateCount": len(port.non_active_product_ids),
        "noStockCandidateCount": len(port.no_stock_product_ids),
        "javaDetail404CandidateCount": len(port.not_found_product_ids),
        "unknownBoundaryDropped": unknown_boundary_dropped,
        "productionProductCollectionModified": False,
        "businessWrites": False,
        "javaMySqlTested": True,
        "checks": [
            "Java public catalog facts were read before indexing",
            "Only published products and active SKUs with positive price were indexed; stock was revalidated after retrieval",
            "Milvus used a fresh per-run collection and returned candidate product IDs",
            "Each candidate ID was re-read through Java's current detail view",
            "Strict CatalogFactSnapshot validation accepted only published, eligible, positive-stock facts",
            "Unknown IDs, inactive SKUs, unpublished products, and zero-stock SKUs are counted and filtered",
            "The per-run Milvus collection was dropped during cleanup",
            "No Java business write endpoint or transaction table was called",
        ],
    }


def _write(path: Path, report: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env")
    parser.add_argument("--java-base-url", default="http://127.0.0.1:8091")
    parser.add_argument("--catalog-query", default="")
    parser.add_argument("--query", default="")
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--max-pages", type=int, default=20)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "docs/testing/evidence/agent-v1.1-m1-milvus-java-fact-revalidation.json",
    )
    args = parser.parse_args()
    load_env(args.env_file)
    try:
        report = run(args)
    except ProbeNotRun as error:
        report = {
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "status": "NOT_RUN",
            "evidenceStatus": "NOT_RUN",
            "reason": str(error),
            "candidateCount": 0,
            "filteredCandidateCount": 0,
            "revalidatedCount": 0,
            "javaDetail404Count": 0,
            "javaDetailNonSuccessCount": 0,
            "javaDetailInvalidCount": 0,
            "nonPublishedProductCount": 0,
            "nonActiveSkuCount": 0,
            "noStockSkuCount": 0,
            "nonPublishedCandidateCount": 0,
            "nonActiveCandidateCount": 0,
            "noStockCandidateCount": 0,
            "javaDetail404CandidateCount": 0,
            "unknownBoundaryDropped": False,
            "productionProductCollectionModified": False,
            "businessWrites": False,
            "javaMySqlTested": False,
        }
        _write(args.output, report)
        print("M1.4.3 Milvus/Java fact revalidation NOT_RUN", file=sys.stderr)
        return 2
    except Exception as error:  # noqa: BLE001 - never print downstream exception text
        report = {
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "status": "FAIL",
            "evidenceStatus": "DEGRADED",
            "errorCode": safe_exception_code(error),
            "candidateCount": 0,
            "filteredCandidateCount": 0,
            "revalidatedCount": 0,
            "javaDetail404Count": 0,
            "javaDetailNonSuccessCount": 0,
            "javaDetailInvalidCount": 0,
            "nonPublishedProductCount": 0,
            "nonActiveSkuCount": 0,
            "noStockSkuCount": 0,
            "nonPublishedCandidateCount": 0,
            "nonActiveCandidateCount": 0,
            "noStockCandidateCount": 0,
            "javaDetail404CandidateCount": 0,
            "unknownBoundaryDropped": False,
            "productionProductCollectionModified": False,
            "businessWrites": False,
            "javaMySqlTested": False,
        }
        _write(args.output, report)
        print("M1.4.3 Milvus/Java fact revalidation FAIL", file=sys.stderr)
        return 1
    _write(args.output, report)
    print("M1.4.3 Milvus/Java fact revalidation PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
