package cn.bugstack.ai.domain.merchant.model.valobj;

/** 商户与首店的只读视图；状态字符串仅在数据/接口边界保存。 */
public record MerchantVO(String id, String applicationId, String name, String category, String status,
                         String storeId, String storeName, String location) {
    public MerchantVO {
        MerchantStatusEnumVO.fromCode(status);
    }

    public MerchantStatusEnumVO statusEnum() {
        return MerchantStatusEnumVO.fromCode(status);
    }
}
