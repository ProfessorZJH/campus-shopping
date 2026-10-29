package cn.bugstack.ai.test.commerce;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import cn.bugstack.ai.cases.trading.impl.CartCaseImpl;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.catalog.service.impl.CatalogServiceImpl;
import cn.bugstack.ai.domain.identity.adapter.repository.IAccessRepository;
import cn.bugstack.ai.domain.identity.model.valobj.MembershipVO;
import cn.bugstack.ai.domain.identity.service.IUserAccountService;
import cn.bugstack.ai.domain.identity.service.impl.AccessServiceImpl;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.shoppingai.adapter.repository.IKnowledgeRepository;
import cn.bugstack.ai.domain.shoppingai.service.impl.KnowledgeServiceImpl;
import cn.bugstack.ai.domain.trading.service.ICartService;
import cn.bugstack.ai.types.exception.AppException;
import java.time.Clock;
import java.util.*;
import org.junit.jupiter.api.Test;

class InvalidInputContractTest {

    @Test
    void missingSkuIsBusinessValidationBeforeCartMutation() {
        var trading = mock(ICartService.class);
        var catalog = mock(ICatalogService.class);
        var cart = new CartCaseImpl(trading, catalog, mock(IMerchantService.class), mock(IUserAccountService.class));
        assertEquals("0002", assertThrows(AppException.class, () -> cart.set("u", null, 1)).getCode());
        assertEquals("0002", assertThrows(AppException.class, () -> cart.set("u", "sku", 0)).getCode());
        verifyNoInteractions(trading, catalog);
    }

    @Test
    void nullBatchMemberAndVisibilityCannotBecomeSystemErrors() {
        var repository = mock(ICatalogRepository.class);
        var catalog = new CatalogServiceImpl(
            repository,
            mock(cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogQueryRepository.class),
            mock(cn.bugstack.ai.domain.catalog.adapter.repository.IProductImageRepository.class)
        );
        assertEquals("0002", assertThrows(AppException.class, () -> catalog.offers(Arrays.asList("sku", null), true, false)).getCode());
        verifyNoInteractions(repository);
        var aiRepository = mock(IKnowledgeRepository.class);
        var state = new KnowledgeServiceImpl(aiRepository, Clock.systemUTC());
        assertEquals("0002", assertThrows(AppException.class, () -> state.createBase("知识库", null, null, "u")).getCode());
        verifyNoInteractions(aiRepository);
    }

    @Test
    void nullPermissionDoesNotTriggerImmutableMapNpe() {
        var repository = mock(IAccessRepository.class);
        when(repository.member("owner", "m", false)).thenReturn(new MembershipVO("m", "owner", "OWNER", "ACTIVE"));
        var roles = mock(cn.bugstack.ai.domain.identity.adapter.repository.IRoleRepository.class);
        var access = new AccessServiceImpl(repository, roles, mock(IUserAccountService.class), Clock.systemUTC());
        assertEquals(
            "0002",
            assertThrows(AppException.class, () ->
                new cn.bugstack.ai.domain.identity.service.impl.RoleServiceImpl(roles, repository, access).saveRole(
                    "owner",
                    "m",
                    null,
                    "角色",
                    new HashSet<>(Arrays.asList("product.read", null))
                )
            ).getCode()
        );
        verify(roles, never()).createRole(anyString(), anyString(), anyString(), anySet());
    }
}
