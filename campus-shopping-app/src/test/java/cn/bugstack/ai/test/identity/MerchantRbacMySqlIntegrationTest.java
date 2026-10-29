package cn.bugstack.ai.test.identity;

import cn.bugstack.ai.Application;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.identity.service.IRoleService;
import cn.bugstack.ai.types.exception.AppException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.util.Set;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

/** 独立 MySQL 8 测试库的 RBAC 端到端数据库验证，禁止在生产库执行。 */
@SpringBootTest(classes=Application.class,properties={"campus.jobs.enabled=false","campus.bootstrap.enabled=false"})
@ActiveProfiles("mysql-integration")
@EnabledIfEnvironmentVariable(named="MYSQL_TEST_URL",matches=".+")
class MerchantRbacMySqlIntegrationTest {
    @Autowired IAccessService access;
    @Autowired IRoleService roleService;
    @Autowired JdbcTemplate jdbc;
    private final String suffix=UUID.randomUUID().toString().replace("-","").substring(0,15);
    private final String m1="rbac-m1-"+suffix,m2="rbac-m2-"+suffix;
    private final String owner="rbac-owner-"+suffix,clerk="rbac-clerk-"+suffix;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        String url=System.getenv("MYSQL_TEST_URL");
        if(url==null||!url.matches("jdbc:mysql://[^/]+/campus_shopping_it(?:\\?.*)?"))
            throw new IllegalStateException("RBAC 测试只允许使用 campus_shopping_it");
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.username",()->System.getenv("MYSQL_TEST_USERNAME"));
        registry.add("spring.datasource.password",()->System.getenv("MYSQL_TEST_PASSWORD"));
        registry.add("spring.datasource.driver-class-name",()->"com.mysql.cj.jdbc.Driver");
        registry.add("spring.sql.init.mode",()->"always");
        registry.add("spring.sql.init.schema-locations",()->"classpath:schema.sql");
        registry.add("spring.sql.init.data-locations",()->"classpath:data.sql");
    }

    @BeforeEach
    void seed() {
        for(String user:new String[]{owner,clerk})
            jdbc.update("INSERT INTO iam_user(id,username,password_hash,display_name,status) VALUES(?,?,?,?,?)",user,user,"test-hash-not-for-login",user,"ACTIVE");
        jdbc.update("INSERT INTO iam_merchant_membership(merchant_id,user_id,role,status) VALUES(?,?,?,?)",m1,owner,"OWNER","ACTIVE");
        jdbc.update("INSERT INTO iam_merchant_membership(merchant_id,user_id,role,status) VALUES(?,?,?,?)",m2,owner,"OWNER","ACTIVE");
        jdbc.update("INSERT INTO iam_merchant_membership(merchant_id,user_id,role,status) VALUES(?,?,?,?)",m1,clerk,"CLERK","ACTIVE");
    }

    @AfterEach
    void clean() {
        jdbc.update("DELETE FROM sys_audit WHERE merchant_id IN (?,?)",m1,m2);
        jdbc.update("DELETE FROM iam_invitation WHERE merchant_id IN (?,?)",m1,m2);
        jdbc.update("DELETE FROM iam_merchant_membership WHERE merchant_id IN (?,?)",m1,m2);
        jdbc.update("DELETE FROM iam_merchant_role_permission WHERE merchant_id IN (?,?)",m1,m2);
        jdbc.update("DELETE FROM iam_merchant_role WHERE merchant_id IN (?,?)",m1,m2);
        jdbc.update("DELETE FROM iam_user WHERE id IN (?,?)",owner,clerk);
    }

    @Test
    void builtInRolesCustomPermissionRevocationAndMerchantIsolation() {
        assertEquals(2,roleService.roles(owner,m1).size());
        assertThrows(AppException.class,()->roleService.saveRole(owner,m1,null,"越权角色",Set.of("role.manage")));
        var role=roleService.saveRole(owner,m1,null,"商品管理员",Set.of("product.read","product.write"));
        assertTrue(role.code().matches("R[a-f0-9]{12}"));
        assertEquals(3,roleService.roles(owner,m1).size());
        assertEquals(2,roleService.roles(owner,m2).size());
        assertThrows(AppException.class,()->roleService.assignRole(owner,m2,clerk,role.code()));
        roleService.assignRole(owner,m1,clerk,role.code());
        assertTrue(access.permissions(clerk,m1).contains("product.write"));
        assertThrows(AppException.class,()->access.requirePermission(clerk,m1,"role.manage"));
        assertThrows(AppException.class,()->access.requirePermission(clerk,m2,"product.read"));
        assertThrows(AppException.class,()->roleService.deleteRole(owner,m1,role.code()));
        roleService.saveRole(owner,m1,role.code(),"知识读取",Set.of("knowledge.read"));
        assertFalse(access.permissions(clerk,m1).contains("product.write"));
        assertTrue(access.permissions(clerk,m1).contains("knowledge.read"));
        roleService.assignRole(owner,m1,clerk,"CLERK");
        roleService.deleteRole(owner,m1,role.code());
        assertEquals(2,roleService.roles(owner,m1).size());
    }

    @Test
    void revokedCustomMemberReacceptsAsClerkRatherThanInheritingOldGrant() {
        var role=roleService.saveRole(owner,m1,null,"售后审核员",Set.of("aftersale.read","aftersale.review"));
        roleService.assignRole(owner,m1,clerk,role.code());
        assertTrue(access.permissions(clerk,m1).contains("aftersale.review"));
        access.revoke(owner,m1,clerk);
        assertTrue(access.permissions(clerk,m1).isEmpty());
        var invitation=access.invite(owner,m1,clerk);
        access.accept(clerk,invitation.id());
        assertTrue(access.permissions(clerk,m1).contains("order.prepare"));
        assertFalse(access.permissions(clerk,m1).contains("aftersale.review"));
        assertEquals("CLERK",jdbc.queryForObject("SELECT role FROM iam_merchant_membership WHERE merchant_id=? AND user_id=?",String.class,m1,clerk));
    }
}
