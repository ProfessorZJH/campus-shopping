package cn.bugstack.ai.domain.merchant.service;

import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import java.util.*;

/** 经营资格公开能力，不提供绕过授权的 HTTP 入口。 */
public interface IMerchantService {
  List<MerchantVO> findAll(List<String> ids);
  MerchantVO publicDisplay(String id);
  MerchantVO find(String merchantId);
  MerchantVO requireActiveForNewTrade(String merchantId);
  long count(boolean activeOnly);
  long count(boolean activeOnly, String q);
  List<MerchantVO> list(int page, int size, boolean activeOnly);
  List<MerchantVO> list(int page, int size, boolean activeOnly, String q);
  void changeStatus(String merchantId, boolean active);
  void updateProfile(String id, String name, String storeName, String location);
}
