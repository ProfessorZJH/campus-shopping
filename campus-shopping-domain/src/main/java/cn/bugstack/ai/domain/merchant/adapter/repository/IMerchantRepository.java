package cn.bugstack.ai.domain.merchant.adapter.repository;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import java.util.*;
/** 商户与门店本地数据访问抽象。 */
public interface IMerchantRepository {
 MerchantVO find(String id,boolean lock); void save(MerchantVO merchant);
 long count(boolean activeOnly); long count(boolean activeOnly,String q);
 List<MerchantVO> list(int offset,int limit,boolean activeOnly); List<MerchantVO> list(int offset,int limit,boolean activeOnly,String q); void setStatus(String id,String status);
 void updateProfile(String id,String name,String storeName,String location);
}
