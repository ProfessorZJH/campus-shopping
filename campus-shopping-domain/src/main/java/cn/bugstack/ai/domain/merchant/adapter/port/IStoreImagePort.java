package cn.bugstack.ai.domain.merchant.adapter.port;

/** 门店图片的对象存储与授权核对；只接受本商户按 STORE 用途上传的对象。 */
public interface IStoreImagePort {
    String storeImage(byte[] bytes, String merchantId);

    void requireOwned(String merchantId, String imageUrl);
}
