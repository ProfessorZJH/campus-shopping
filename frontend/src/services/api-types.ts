/**
 * 传输层类型试点，字段与 docs/api/openapi.json 的生成契约保持一致。
 * 这里只描述 HTTP 响应结构，不复制领域状态机或权限规则。
 */
export interface ApiEnvelope<T> {
  code: string;
  info: string;
  data: T | null;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
}

export type ChatMode = 'LOCAL_RETRIEVAL_DEMO' | 'LLM' | 'LOCAL_FALLBACK';
export type RetrievalMode = 'REMOTE_EMBEDDING' | 'LOCAL_CHAR_NGRAM_DEMO' | 'BM25_DEGRADED';

export interface Citation {
  documentId: string;
  title: string;
  snippet: string;
}

export type CitationStatus = 'AVAILABLE' | 'NONE' | 'MISSING' | 'HIDDEN';

export interface MessageResponse {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  citations: Citation[];
  citationStatus: CitationStatus;
}

export interface ProposalItem {
  skuId: string;
  merchantId: string;
  title: string;
  specKey: string;
  imageUrl: string;
  priceCent: number;
  quoteVersion: number;
  quantity: number;
}

export interface Proposal {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  items: ProposalItem[];
  expiresAt: string;
}

export interface ChatResponse {
  conversationId: string;
  answer: string;
  mode: ChatMode;
  retrievalMode: RetrievalMode;
  warning: string | null;
  citations: Citation[];
  proposal: Proposal | null;
  latencyMs: number;
}
