"""核对人工语义评审记录的完整性，不代替人工判断。"""

from datetime import datetime


def review_complete(review):
    if not isinstance(review, dict) or review.get('reviewStatus') != 'HUMAN_REVIEWED':
        return False
    reviewer = review.get('reviewer')
    reviewed_at = review.get('reviewedAt')
    if not isinstance(reviewer, str) or not reviewer.strip() or not isinstance(reviewed_at, str):
        return False
    try:
        datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
    except ValueError:
        return False
    if type(review.get('semanticLeak')) is not bool:
        return False
    assertions = review.get('assertions')
    if not isinstance(assertions, list):
        return False
    if not assertions:
        reason = review.get('noAssertionsReason')
        return isinstance(reason, str) and bool(reason.strip())
    return all(isinstance(item, dict) and type(item.get('supported')) is bool for item in assertions)
