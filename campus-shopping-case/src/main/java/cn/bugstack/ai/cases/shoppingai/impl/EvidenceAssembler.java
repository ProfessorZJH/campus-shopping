package cn.bugstack.ai.cases.shoppingai.impl;

import static cn.bugstack.ai.types.common.Checks.require;

import cn.bugstack.ai.cases.shoppingai.IKnowledgeCase;
import cn.bugstack.ai.domain.shoppingai.model.valobj.AiCitationVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeDocumentVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.KnowledgeScopeVO;
import cn.bugstack.ai.domain.shoppingai.model.valobj.MessageVO;
import cn.bugstack.ai.types.enums.ResponseCode;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** 只负责引用授权、版本和脱敏组装，不负责回答文本或会话编排。 */
final class EvidenceAssembler {

    private final IKnowledgeCase knowledge;

    EvidenceAssembler(IKnowledgeCase knowledge) {
        this.knowledge = knowledge;
    }

    /** 只返回当前授权知识范围中的可核实引用，内部文档始终隐藏原文。 */
    List<AiCitationVO> verifyOutput(String actor, List<AiCitationVO> requested, List<KnowledgeScopeVO> readable) {
        Set<String> allowedIds = readable.stream().map(KnowledgeScopeVO::id).collect(Collectors.toSet());
        List<String> citedIds = requested.stream().map(AiCitationVO::documentId).distinct().toList();
        require(allowedIds.containsAll(citedIds), ResponseCode.KNOWLEDGE_NOT_READY);
        Map<String, KnowledgeDocumentVO> byId = knowledge
                .citationDocuments(actor, citedIds)
                .stream()
                .collect(Collectors.toMap(KnowledgeDocumentVO::id, d -> d));
        List<AiCitationVO> citations = new ArrayList<>();
        for (AiCitationVO citation : requested) {
            KnowledgeDocumentVO document = byId.get(citation.documentId());
            require(document != null, ResponseCode.KNOWLEDGE_NOT_READY);
            boolean publicDocument = "PUBLIC".equals(document.visibility());
            String chunkBody = citation.ordinal() < 0 ? "" : chunk(document.content(), citation.ordinal());
            require(
                    citation.documentVersion() == document.version()
                            && citation.snippet() != null
                            && citation.snippet().codePointCount(0, citation.snippet().length()) <= 500
                            && (
                                    citation.ordinal() < 0
                                            ? !publicDocument || document.content().contains(citation.snippet())
                                            : citation.chunkId().equals(chunkId(document.id(), citation.ordinal()))
                                                    && citation.contentHash().equals(hash(chunkBody))
                                                    && (!publicDocument || chunkBody.contains(citation.snippet()))
                            ),
                    ResponseCode.KNOWLEDGE_NOT_READY
            );
            citations.add(
                    new AiCitationVO(
                            document.id(),
                            citation.chunkId(),
                            document.title(),
                            publicDocument ? citation.snippet() : "内部资料来源，原文片段不公开展示",
                            citation.score(),
                            document.rootId(),
                            document.version(),
                            citation.ordinal(),
                            citation.contentHash()
                    )
            );
        }
        return citations;
    }

    List<MessageVO> sanitizeHistory(String actor, List<MessageVO> messages, String fingerprint, List<KnowledgeScopeVO> readable) {
        Set<String> allowedIds = readable.stream().map(KnowledgeScopeVO::id).collect(Collectors.toSet());
        Map<String, KnowledgeDocumentVO> currentCitations = currentCitationDocuments(actor, messages, allowedIds);
        return messages
                .stream()
                .map(
                        message -> {
                            if (
                                    "assistant".equals(message.role())
                                            && message.accessFingerprint() != null
                                            && !message.accessFingerprint().isBlank()
                                            && !fingerprint.equals(message.accessFingerprint())
                            ) {
                                return new MessageVO(
                                        message.id(),
                                        message.conversationId(),
                                        message.role(),
                                        "资料权限或版本已变化，此历史回答已隐藏，请重新提问。",
                                        message.createdAt(),
                                        fingerprint,
                                        List.of(),
                                        message.citationsRecorded(),
                                        false
                                );
                            }
                            if (!message.citationsRecorded() || message.citations().isEmpty()) return message;
                            List<AiCitationVO> valid = message
                                    .citations()
                                    .stream()
                                    .filter(citation -> validCitation(citation, currentCitations, allowedIds))
                                    .toList();
                            return new MessageVO(
                                    message.id(),
                                    message.conversationId(),
                                    message.role(),
                                    message.content(),
                                    message.createdAt(),
                                    message.accessFingerprint(),
                                    valid,
                                    true,
                                    valid.size() == message.citations().size()
                            );
                        }
                )
                .toList();
    }

    private String chunkId(String document, int ordinal) {
        try {
            UUID namespace = UUID.fromString("6ba7b811-9dad-11d1-80b4-00c04fd430c8");
            byte[] bytes = ByteBuffer.allocate(16).putLong(namespace.getMostSignificantBits()).putLong(namespace.getLeastSignificantBits()).array();
            byte[] name = (document + ":" + ordinal).getBytes(StandardCharsets.UTF_8);
            byte[] input = new byte[bytes.length + name.length];
            System.arraycopy(bytes, 0, input, 0, bytes.length);
            System.arraycopy(name, 0, input, bytes.length, name.length);
            byte[] digest = MessageDigest.getInstance("SHA-1").digest(input);
            digest[6] = (byte) ((digest[6] & 0x0f) | 0x50);
            digest[8] = (byte) ((digest[8] & 0x3f) | 0x80);
            ByteBuffer result = ByteBuffer.wrap(digest);
            return new UUID(result.getLong(), result.getLong()).toString();
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    private String chunk(String content, int ordinal) {
        String normalized = stripUnicode(content.replace("\u0000", ""));
        int startPoint = ordinal * 620;
        int pointCount = normalized.codePointCount(0, normalized.length());
        if (startPoint < 0 || startPoint >= pointCount) return "";
        int endPoint = Math.min(pointCount, startPoint + 700);
        int start = normalized.offsetByCodePoints(0, startPoint);
        int end = normalized.offsetByCodePoints(0, endPoint);
        return normalized.substring(start, end);
    }

    /** 与 Python str.strip 对齐，同时覆盖 Java isWhitespace 未包含的 NBSP。 */
    private String stripUnicode(String value) {
        int start = 0;
        int end = value.length();
        while (start < end) {
            int codePoint = value.codePointAt(start);
            if (!Character.isWhitespace(codePoint) && !Character.isSpaceChar(codePoint)) break;
            start += Character.charCount(codePoint);
        }
        while (end > start) {
            int codePoint = value.codePointBefore(end);
            if (!Character.isWhitespace(codePoint) && !Character.isSpaceChar(codePoint)) break;
            end -= Character.charCount(codePoint);
        }
        return value.substring(start, end);
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte item : digest) result.append(String.format("%02x", item));
            return result.toString();
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    private Map<String, KnowledgeDocumentVO> currentCitationDocuments(String actor, List<MessageVO> messages, Set<String> allowedIds) {
        List<String> ids = messages
                .stream()
                .flatMap(message -> message.citations().stream())
                .filter(AiCitationVO::hasDocumentSnapshot)
                .map(AiCitationVO::documentId)
                .filter(allowedIds::contains)
                .distinct()
                .toList();
        Map<String, KnowledgeDocumentVO> current = new HashMap<>();
        for (int start = 0; start < ids.size(); start += 20) {
            knowledge.citationDocuments(actor, ids.subList(start, Math.min(start + 20, ids.size()))).forEach(document -> current.put(document.id(), document));
        }
        return current;
    }

    private boolean validCitation(AiCitationVO citation, Map<String, KnowledgeDocumentVO> current, Set<String> allowedIds) {
        if (!allowedIds.contains(citation.documentId()) || !citation.hasDocumentSnapshot()) return false;
        KnowledgeDocumentVO document = current.get(citation.documentId());
        if (
                document == null
                        || !citation.rootId().equals(document.rootId())
                        || citation.documentVersion() != document.version()
                        || !"PUBLISHED".equals(document.status())
                        || !"READY".equals(document.indexStatus())
        ) return false;
        if (!"PUBLIC".equals(document.visibility())) return "内部资料来源，原文片段不公开展示".equals(citation.snippet());
        return (
                citation.snippet() != null
                        && !citation.snippet().isBlank()
                        && citation.snippet().length() <= 500
                        && document.content() != null
                        && document.content().contains(citation.snippet())
        );
    }
}
