package cn.bugstack.ai.test.merchant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantApplicationRepository;
import cn.bugstack.ai.domain.merchant.adapter.repository.IMerchantRepository;
import cn.bugstack.ai.domain.merchant.service.MerchantApplicationServiceImpl;
import cn.bugstack.ai.types.exception.AppException;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 筛选条件必须在进入 SQL 前统一校验；列表与总数不得采用不同规则。 */
class MerchantApplicationFilterTest {

    @Test
    void listAndCountNormalizeAllValidFilters() {
        for (String state : new String[] { null, "", "  ", "SUBMITTED", "APPROVED", "REJECTED", " APPROVED " }) {
            var repository = mock(IMerchantApplicationRepository.class);
            var service = new MerchantApplicationServiceImpl(repository, mock(IMerchantRepository.class));
            String expected = state == null || state.isBlank() ? "" : state.strip();
            service.list(null, state, 1, 20);
            service.list(null, state, 1, 20, " 店 ");
            service.count(null, state);
            service.count(null, state, " 店 ");
            verify(repository).list(null, expected, 0, 20, "");
            verify(repository).list(null, expected, 0, 20, "店");
            verify(repository).count(null, expected, "");
            verify(repository).count(null, expected, "店");
        }
    }

    @Test
    void invalidFiltersFailBeforeRepositoryForEveryOverload() {
        var repository = mock(IMerchantApplicationRepository.class);
        var service = new MerchantApplicationServiceImpl(repository, mock(IMerchantRepository.class));
        for (String state : List.of("UNKNOWN", "approved", "APPROVED,REJECTED")) {
            assertEquals("0002", assertThrows(AppException.class, () -> service.list(null, state, 1, 20)).getCode());
            assertEquals("0002", assertThrows(AppException.class, () -> service.list(null, state, 1, 20, "店")).getCode());
            assertEquals("0002", assertThrows(AppException.class, () -> service.count(null, state)).getCode());
            assertEquals("0002", assertThrows(AppException.class, () -> service.count(null, state, "店")).getCode());
        }
        verifyNoInteractions(repository);
    }
}
