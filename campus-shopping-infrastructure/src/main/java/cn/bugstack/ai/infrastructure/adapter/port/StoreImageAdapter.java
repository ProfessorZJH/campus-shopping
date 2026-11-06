package cn.bugstack.ai.infrastructure.adapter.port;

import cn.bugstack.ai.domain.merchant.adapter.port.IStoreImagePort;
import cn.bugstack.ai.infrastructure.adapter.repository.ProductImageRepository;
import org.springframework.stereotype.Component;

/** 门店图片复用图片对象存储，但以 STORE 用途登记和核验归属。 */
@Component
public class StoreImageAdapter implements IStoreImagePort {

    private final ProductImageRepository images;

    public StoreImageAdapter(ProductImageRepository images) {
        this.images = images;
    }

    @Override
    public String storeImage(byte[] bytes, String merchantId) {
        return images.storeImage(bytes, merchantId, "STORE");
    }

    @Override
    public void requireOwned(String merchantId, String imageUrl) {
        images.requireOwnedStoreImage(merchantId, imageUrl);
    }
}
