package cn.bugstack.ai.infrastructure.adapter.repository;
import cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantRepository;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.infrastructure.dao.IMerchantDao;
import cn.bugstack.ai.infrastructure.dao.po.MerchantPO;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;
import java.util.*;
/** 同一事务内写入商户与首店；不创建跨域的用户权限。 */
@Repository
public class MerchantRepository implements IMerchantRepository {
 @Resource private IMerchantDao dao;
 public MerchantVO find(String id,boolean lock){return fromPO(dao.find(id,lock));}
 public void save(MerchantVO m){MerchantPO p=MerchantPO.builder().id(m.id()).applicationId(m.applicationId()).name(m.name()).category(m.category()).status(m.status()).storeId(m.storeId()).storeName(m.storeName()).location(m.location()).build();dao.insertMerchant(p);dao.insertStore(p);}
 public List<MerchantVO> list(int offset,int limit,boolean activeOnly){return list(offset,limit,activeOnly,"");}
 public List<MerchantVO> list(int offset,int limit,boolean activeOnly,String q){return dao.list(offset,limit,activeOnly,q).stream().map(this::fromPO).toList();}
 public long count(boolean activeOnly){return count(activeOnly,"");}
 public long count(boolean activeOnly,String q){return dao.count(activeOnly,q);}
 public void setStatus(String id,String status){dao.setStatus(id,status);}
 private MerchantVO fromPO(MerchantPO p){return p==null?null:new MerchantVO(p.getId(),p.getApplicationId(),p.getName(),p.getCategory(),p.getStatus(),p.getStoreId(),p.getStoreName(),p.getLocation());}
 public void updateProfile(String id,String name,String storeName,String location){dao.updateProfile(id,name);dao.updateStore(id,storeName,location);}
}
