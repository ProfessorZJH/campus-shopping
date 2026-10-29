package cn.bugstack.ai.infrastructure.dao;
import org.apache.ibatis.annotations.*;
import cn.bugstack.ai.infrastructure.dao.po.*;
import java.util.*;
import java.time.*;
/** 数据访问映射，业务决定由领域服务作出。 */
@Mapper
public interface IMerchantApplicationDao {
    int insertIfAbsent(@Param("po") MerchantApplicationPO po);
    MerchantApplicationPO queryByApplicantAndRequestKey(@Param("applicantUserId") String applicantUserId, @Param("requestKey") String requestKey);
    MerchantApplicationPO lock(@Param("id") String id);
    int saveReview(@Param("po") MerchantApplicationPO po);
    long count(@Param("userId") String userId,@Param("status") String status, @Param("q") String q);
    List<MerchantApplicationPO> list(@Param("userId") String userId, @Param("status") String status, @Param("offset") int offset, @Param("limit") int limit, @Param("q") String q);
}
