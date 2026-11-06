package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 引用必须在 Java 端复验授权与正文一致性；根和版本只用于历史证据复核，不直接外发。 */
public record AiCitationVO(String documentId, String chunkId, String title, String snippet, double score, String rootId, int documentVersion) {
    public AiCitationVO(String documentId, String chunkId, String title, String snippet, double score) {
        this(documentId, chunkId, title, snippet, score, "", 0);
    }

    public boolean hasDocumentSnapshot() {
        return rootId != null && !rootId.isBlank() && documentVersion > 0;
    }
}
