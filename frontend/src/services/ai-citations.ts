import type { ChatResponse, Citation } from './api-types';

/**
 * 引用只投影展示所需字段；服务端缺字段时保持显式空值，
 * 前端不得据此构造内部文档直链。
 */
export function citationsOf(
  answer: Pick<ChatResponse, 'citations'> | null | undefined,
): Citation[] {
  return (answer?.citations ?? []).map((citation) => ({
    documentId: citation?.documentId || '',
    title: citation?.title || '',
    snippet: citation?.snippet || '',
  }));
}
