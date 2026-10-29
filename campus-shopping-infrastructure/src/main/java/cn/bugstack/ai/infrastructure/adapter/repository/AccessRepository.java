package cn.bugstack.ai.infrastructure.adapter.repository;
import cn.bugstack.ai.domain.identity.adapter.repository.IAccessRepository;
import cn.bugstack.ai.domain.identity.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.IAccessDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Repository;
import java.util.*;
/** 授权仓储只做数据库映射，权限规则留在领域服务。 */
@Repository
public class AccessRepository implements IAccessRepository {
 @Resource private IAccessDao dao;
 public boolean isAdmin(String userId){return dao.countAdmin(userId)>0;}
 public void grantAdmin(String userId){dao.grantAdmin(userId);}
 public MembershipVO member(String userId,String merchantId,boolean lock){return toMember(dao.member(userId,merchantId,lock));}
 public List<MembershipVO> memberships(String userId){return dao.memberships(userId).stream().map(this::toMember).toList();}
 public List<MembershipVO> members(String merchantId){return dao.members(merchantId).stream().map(this::toMember).toList();}
 public void grantOwner(String merchantId,String userId,String applicationId){dao.grantOwner(merchantId,userId,applicationId);}
 public void grantClerk(String merchantId,String userId){dao.grantClerk(merchantId,userId);}
 public void revoke(String merchantId,String userId){dao.cancelInvitations(merchantId,userId);dao.revoke(merchantId,userId);}
 public void invite(InvitationVO i,String inviter){dao.invite(InvitationPO.builder().id(i.id()).merchantId(i.merchantId()).targetUserId(i.targetUserId()).status(i.status()).expiresAt(i.expiresAt()).build(),inviter);}
 public InvitationVO invitation(String id){return toInvitation(dao.invitation(id));}
 public List<InvitationVO> invitations(String userId){return dao.invitations(userId).stream().map(this::toInvitation).toList();}
 public void accept(String id){dao.accept(id);}
 public void audit(String actor,String action,String target,String merchantId,String detail){dao.audit(UUID.randomUUID().toString(),actor,action,target,merchantId,detail);}
 public List<MerchantRoleVO> customRoles(String merchantId){
  return dao.roles(merchantId).stream().map(r->new MerchantRoleVO(r.getRoleCode(),r.getName(),dao.rolePermissions(merchantId,r.getRoleCode()),false)).toList();
 }
 public MerchantRoleVO customRole(String merchantId,String code,boolean lock){
  var r=dao.role(merchantId,code,lock);
  return r==null?null:new MerchantRoleVO(code,r.getName(),dao.rolePermissions(merchantId,code),false);
 }
 public Set<String> customPermissions(String merchantId,String code){return dao.rolePermissions(merchantId,code);}
 public void createRole(String mid,String code,String name,Set<String> permissions){dao.createRole(mid,code,name);dao.insertPermissions(mid,code,permissions);}
 public void updateRole(String mid,String code,String name,Set<String> permissions){dao.updateRole(mid,code,name);dao.deletePermissions(mid,code);dao.insertPermissions(mid,code,permissions);}
 public void deleteRole(String mid,String code){dao.deletePermissions(mid,code);dao.deleteRole(mid,code);}
 public int countRoleMembers(String mid,String code){return dao.countRoleMembers(mid,code);}
 public void assignRole(String mid,String uid,String code){dao.assignRole(mid,uid,code);}
 private MembershipVO toMember(MembershipPO p){return p==null?null:new MembershipVO(p.getMerchantId(),p.getUserId(),p.getRole(),p.getStatus());}
 private InvitationVO toInvitation(InvitationPO p){return p==null?null:new InvitationVO(p.getId(),p.getMerchantId(),p.getTargetUserId(),p.getStatus(),p.getExpiresAt());}
}
