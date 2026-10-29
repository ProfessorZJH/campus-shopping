package cn.bugstack.ai.domain.identity.model.valobj;
import java.util.*;
/** 权限角色：内置角色不可修改，自定义角色只在其所属商户内有效。 */
public record MerchantRoleVO(String code,String name,Set<String> permissions,boolean builtin) {}
