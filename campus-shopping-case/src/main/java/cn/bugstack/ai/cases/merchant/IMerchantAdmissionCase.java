package cn.bugstack.ai.cases.merchant;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
/** 商户开通跨 Merchant 与 Identity 的事务用例。 */
public interface IMerchantAdmissionCase {
 MerchantVO approve(String actor,String applicationId); void reject(String actor,String applicationId,String reason);
 void setActive(String actor,String merchantId,boolean active,String reason);
 MerchantVO updateProfile(String actor,String merchantId,String name,String storeName,String location);
}
