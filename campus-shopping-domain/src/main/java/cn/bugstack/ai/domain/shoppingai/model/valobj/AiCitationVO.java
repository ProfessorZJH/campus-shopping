package cn.bugstack.ai.domain.shoppingai.model.valobj;

/** 引用必须在 Java 端复验授权、版本与正文一致性；根和版本只用于历史证据复核。 */
public record AiCitationVO(
    String documentId,
    String chunkId,
    String title,
    String snippet,
    double score,
    String rootId,
    int documentVersion,
    int ordinal,
    String contentHash
) {
    public AiCitationVO(String documentId, String chunkId, String title, String snippet, double score) {
        this(documentId, chunkId, title, snippet, score, "", 0, -1, "");
    }

    public AiCitationVO(String documentId, String chunkId, String title, String snippet, double score, String rootId, int documentVersion) {
        this(documentId, chunkId, title, snippet, score, rootId, documentVersion, -1, "");
    }

    public AiCitationVO(String documentId, String chunkId, String title, String snippet, double score, int documentVersion, int ordinal, String contentHash) {
        this(documentId, chunkId, title, snippet, score, "", documentVersion, ordinal, contentHash);
    }

    public boolean hasDocumentSnapshot() {
        return rootId != null && !rootId.isBlank() && documentVersion > 0;
    }
}
