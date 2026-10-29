package cn.bugstack.ai.test.commerce;

import cn.bugstack.ai.domain.shoppingai.model.aggregate.KnowledgePublicationPolicy;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgePublicationVO;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Domain 规则回归：不能因索引已生成就发布旧版本，也不能撤错当前指针。 */
class KnowledgePublicationPolicyTest {
    @Test
    void latestReadyDocumentCanPublish() {
        var version = new KnowledgePublicationVO("doc-2", "root", "doc-1", 2, 2, "READY");
        assertDoesNotThrow(() -> KnowledgePublicationPolicy.requirePublishable(version));
        assertFalse(KnowledgePublicationPolicy.isActive(version));
    }

    @Test
    void pendingAndFailedIndexMustNotPublish() {
        for (String status : new String[] {"PENDING", "FAILED"}) {
            var version = new KnowledgePublicationVO("doc-2", "root", "doc-1", 2, 2, status);
            assertEquals("AI0003", assertThrows(AppException.class,
                    () -> KnowledgePublicationPolicy.requirePublishable(version)).getCode());
        }
    }

    @Test
    void olderReadyVersionCannotOverwriteLatest() {
        var version = new KnowledgePublicationVO("doc-1", "root", "doc-1", 1, 2, "READY");
        assertEquals("G0002", assertThrows(AppException.class,
                () -> KnowledgePublicationPolicy.requirePublishable(version)).getCode());
        assertTrue(KnowledgePublicationPolicy.isActive(version));
    }

    @Test
    void withdrawingInactiveVersionCannotClearActivePointer() {
        var stale = new KnowledgePublicationVO("doc-1", "root", "doc-2", 1, 2, "READY");
        assertFalse(KnowledgePublicationPolicy.isActive(stale));
        assertTrue(KnowledgePublicationPolicy.isActive(
                new KnowledgePublicationVO("doc-2", "root", "doc-2", 2, 2, "READY")));
    }
}
