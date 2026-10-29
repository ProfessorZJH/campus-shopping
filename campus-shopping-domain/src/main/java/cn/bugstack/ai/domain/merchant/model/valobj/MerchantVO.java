package cn.bugstack.ai.domain.merchant.model.valobj;
import java.util.*;
import java.time.*;
/** 商户与首店的只读业务视图。 */
public record MerchantVO(String id, String applicationId, String name, String category, String status, String storeId, String storeName, String location) {}
