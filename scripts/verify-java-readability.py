#!/usr/bin/env python3
"""逐步防止核心 Java 源码再次被压成一行；不假装全仓已经格式化。"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

# PR4 只保护已治理的热点；业务文件进入此清单前必须先完成排版和回归。
CORE = [
    "campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/ShoppingAiCaseImpl.java",
    "campus-shopping-case/src/main/java/cn/bugstack/ai/cases/shoppingai/impl/KnowledgeCaseImpl.java",
    "campus-shopping-case/src/main/java/cn/bugstack/ai/cases/catalog/impl/CatalogCaseImpl.java",
    "campus-shopping-case/src/main/java/cn/bugstack/ai/cases/merchant/impl/MerchantAdmissionCaseImpl.java",
    "campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/catalog/service/impl/CatalogServiceImpl.java",
    "campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/inventory/service/impl/InventoryServiceImpl.java",
    "campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/identity/service/impl/AccessServiceImpl.java",
    "campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/fulfillment/service/impl/FulfillmentServiceImpl.java",
    "campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/merchant/service/MerchantApplicationServiceImpl.java",
    "campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/merchant/service/impl/MerchantServiceImpl.java",
    "campus-shopping-domain/src/main/java/cn/bugstack/ai/domain/shoppingai/model/aggregate/KnowledgePublicationPolicy.java",
]

def check(path: Path) -> list[str]:
    errors = []
    if not path.is_file():
        return [f"{path}: missing"]
    text = path.read_text(encoding="utf-8")
    if not text.endswith("\n"):
        errors.append(f"{path}: missing final newline")
    for number, line in enumerate(text.splitlines(), 1):
        if "\t" in line:
            errors.append(f"{path}:{number}: tab indentation")
        if line.rstrip() != line:
            errors.append(f"{path}:{number}: trailing whitespace")
        if len(line) > 160:
            errors.append(f"{path}:{number}: line length {len(line)} exceeds 160")
        if line.count("import ") > 1 and line.lstrip().startswith("import "):
            errors.append(f"{path}:{number}: multiple imports on one line")
    return errors


if __name__ == "__main__":
    problems = [p for file in CORE for p in check(ROOT / file)]
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        sys.exit(1)
    print(f"Java readability checks passed for {len(CORE)} guarded files")
