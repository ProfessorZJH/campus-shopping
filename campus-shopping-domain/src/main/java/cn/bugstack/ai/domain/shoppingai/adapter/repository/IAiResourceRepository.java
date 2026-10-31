package cn.bugstack.ai.domain.shoppingai.adapter.repository;

/** 昂贵调用的准入许可与后台索引协调，不参与业务事务裁决。 */
public interface IAiResourceRepository {
    Permit acquire();
    boolean coordinateProductSync(Runnable task);

    interface Permit extends AutoCloseable {
        @Override
        void close();
    }
}
