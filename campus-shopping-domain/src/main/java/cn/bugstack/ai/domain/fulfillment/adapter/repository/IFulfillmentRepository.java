package cn.bugstack.ai.domain.fulfillment.adapter.repository;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;import java.util.*;
/** 自提任务和核销事实的本地数据契约。 */
public interface IFulfillmentRepository {PickupVO pickup(String order,boolean lock);void insert(PickupVO task);void save(PickupVO task);void verify(String pickup,String actor);List<PickupVO> list(String merchant,String status,int offset,int size);}
