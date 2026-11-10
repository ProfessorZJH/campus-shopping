import copy

import pytest

from evaluation.semantic_review import review_complete


@pytest.fixture
def reviewed():
    return dict(reviewStatus='HUMAN_REVIEWED', reviewer='human-1', reviewedAt='2026-11-10T10:00:00Z',
                assertions=[{'supported': True}], semanticLeak=False)


@pytest.mark.parametrize('field,value', [
    ('reviewStatus', 'PENDING'),
    ('reviewer', '  '),
    ('reviewedAt', 'not-a-date'),
    ('semanticLeak', None),
    ('semanticLeak', 0),
    ('assertions', None),
    ('assertions', [{}]),
    ('assertions', [{'supported': 'yes'}]),
    ('assertions', []),
])
def test_incomplete_semantic_review_is_not_accepted(reviewed, field, value):
    reviewed[field] = value
    assert not review_complete(reviewed)


def test_valid_review_and_explicit_no_assertions_are_distinct(reviewed):
    assert review_complete(reviewed)
    no_assertions = copy.deepcopy(reviewed)
    no_assertions.update(assertions=[], noAssertionsReason='该输出没有需要证据支持的断言')
    assert review_complete(no_assertions)
    no_assertions['noAssertionsReason'] = '  '
    assert not review_complete(no_assertions)
