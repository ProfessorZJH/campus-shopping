package cn.bugstack.ai.infrastructure.dao;
import org.apache.ibatis.annotations.*;
import cn.bugstack.ai.infrastructure.dao.po.*;
import java.util.*;
import java.time.*;
/** 数据访问映射，业务决定由领域服务作出。 */
@Mapper
public interface IMerchantDao {
    MerchantPO find(@Param("id") String id, @Param("lock") boolean lock);
    int insertMerchant(@Param("po") MerchantPO po);
    int insertStore(@Param("po") MerchantPO po);
    List<MerchantPO> list(@Param("offset") int offset, @Param("limit") int limit, @Param("activeOnly") boolean activeOnly, @Param("q") String q);
    long count(@Param("activeOnly") boolean activeOnly, @Param("q") String q);
    int setStatus(@Param("id") String id, @Param("status") String status);
    int updateProfile(@Param("id") String id,@Param("name") String name);
    int updateStore(@Param("id") String id,@Param("storeName") String storeName,@Param("location") String location);
}
