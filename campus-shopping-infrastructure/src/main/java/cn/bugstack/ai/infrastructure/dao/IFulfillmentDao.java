package cn.bugstack.ai.infrastructure.dao;
import org.apache.ibatis.annotations.*;
import cn.bugstack.ai.infrastructure.dao.po.*;
import java.util.*;
import java.time.*;
/** 数据访问映射，业务决定由领域服务作出。 */
@Mapper
public interface IFulfillmentDao {
    PickupPO pickup(@Param("order") String order, @Param("lock") boolean lock);
    int insert(@Param("p") PickupPO p);
    int save(@Param("p") PickupPO p);
    List<PickupPO> list(@Param("merchant") String merchant, @Param("status") String status, @Param("offset") int offset, @Param("limit") int limit);
    int verify(@Param("id") String id, @Param("pickup") String pickup, @Param("actor") String actor);
}
