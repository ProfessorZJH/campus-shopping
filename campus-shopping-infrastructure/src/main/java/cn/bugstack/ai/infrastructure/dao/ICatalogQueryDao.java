package cn.bugstack.ai.infrastructure.dao;

import cn.bugstack.ai.infrastructure.dao.po.*;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 只读投影 DAO，禁止写语句。 */
@Mapper
public interface ICatalogQueryDao {
    List<ProductPO> search(
        @Param("merchantId") String merchantId,
        @Param("query") String query,
        @Param("category") String category,
        @Param("publicOnly") boolean publicOnly,
        @Param("offset") int offset,
        @Param("limit") int limit,
        @Param("sort") String sort
    );
    List<ProductPO> recall(@Param("terms") List<String> terms, @Param("limit") int limit);
    List<ProductPO> publicByIds(@Param("ids") List<String> ids);
    List<ProductPO> searchManaged(
        @Param("merchantId") String merchantId,
        @Param("query") String query,
        @Param("category") String category,
        @Param("status") String status,
        @Param("offset") int offset,
        @Param("limit") int limit,
        @Param("sort") String sort
    );
    long countManaged(@Param("merchantId") String merchantId, @Param("query") String query, @Param("category") String category, @Param("status") String status);
    long count(
        @Param("merchantId") String merchantId,
        @Param("query") String query,
        @Param("category") String category,
        @Param("publicOnly") boolean publicOnly
    );
}
