package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.*;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 只读投影 DAO，禁止写语句。 */
@Mapper
public interface IInventoryQueryDao {
  long countStocks(@Param("merchantId") String merchant, @Param("q") String q);
  List<StockPO> list(
    @Param("merchantId") String merchantId,
    @Param("offset") int offset,
    @Param("limit") int limit,
    @Param("q") String q
  );
}
