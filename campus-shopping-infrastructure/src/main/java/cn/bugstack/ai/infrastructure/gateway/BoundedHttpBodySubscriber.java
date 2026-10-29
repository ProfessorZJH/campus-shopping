package cn.bugstack.ai.infrastructure.gateway;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;

/** HTTP 响应体硬上限；超过上限立即取消订阅，避免先完整接收再检查大小。 */
public final class BoundedHttpBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
    private final int limit;
    private final ByteArrayOutputStream output = new ByteArrayOutputStream();
    private final CompletableFuture<byte[]> result = new CompletableFuture<>();
    private Flow.Subscription subscription;

    public BoundedHttpBodySubscriber(int limit) {
        if (limit < 1) throw new IllegalArgumentException("响应大小上限必须大于零");
        this.limit = limit;
    }

    @Override public CompletionStage<byte[]> getBody() { return result; }

    @Override public void onSubscribe(Flow.Subscription subscription) {
        this.subscription = subscription;
        subscription.request(Long.MAX_VALUE);
    }

    @Override public void onNext(List<ByteBuffer> buffers) {
        if (result.isDone()) return;
        for (ByteBuffer buffer : buffers) {
            if (buffer.remaining() > limit - output.size()) {
                subscription.cancel();
                result.completeExceptionally(new IOException("AI 响应超过允许大小"));
                return;
            }
            byte[] bytes = new byte[buffer.remaining()];
            buffer.get(bytes);
            output.writeBytes(bytes);
        }
    }

    @Override public void onError(Throwable failure) { result.completeExceptionally(failure); }
    @Override public void onComplete() { result.complete(output.toByteArray()); }
}