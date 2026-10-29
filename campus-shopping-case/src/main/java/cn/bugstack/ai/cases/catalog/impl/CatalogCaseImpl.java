package cn.bugstack.ai.cases.catalog.impl;
import cn.bugstack.ai.cases.catalog.ICatalogCase;
import cn.bugstack.ai.domain.catalog.service.ICatalogService;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductCreateEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.SkuOfferVO;
import cn.bugstack.ai.domain.identity.service.IAccessService;
import cn.bugstack.ai.domain.merchant.service.IMerchantService;
import cn.bugstack.ai.domain.merchant.model.valobj.MerchantVO;
import cn.bugstack.ai.domain.inventory.service.IInventoryService;
import cn.bugstack.ai.domain.inventory.model.valobj.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import static cn.bugstack.ai.types.common.Checks.require;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;
import java.util.*;
/** 新增 SKU 与初始化库存同事务，禁止跨商户操作；停用后可受控下架。 */
@Service
public class CatalogCaseImpl implements ICatalogCase {
 private final ICatalogService catalog;private final IInventoryService inventory;private final IMerchantService merchants;private final IAccessService access;
 public CatalogCaseImpl(ICatalogService catalog,IInventoryService inventory,IMerchantService merchants,IAccessService access){this.catalog=catalog;this.inventory=inventory;this.merchants=merchants;this.access=access;}
 @Transactional(rollbackFor=Exception.class)
 public ProductAggregate create(String actor,String merchant,ProductCreateEntity command){access.requirePermission(actor,merchant,"product.write");MerchantVO m=merchants.requireActiveForNewTrade(merchant);ProductAggregate p=catalog.create(merchant,m.storeId(),command);for(var s:p.getSkus())inventory.initialize(merchant,m.storeId(),s.id());return p;}
 @Transactional(rollbackFor=Exception.class)
 public ProductAggregate addSku(String actor,String merchant,String product,String spec,long price){access.requirePermission(actor,merchant,"product.write");MerchantVO m=merchants.requireActiveForNewTrade(merchant);ProductAggregate p=catalog.addSku(merchant,product,spec,price);for(var s:p.getSkus())inventory.initialize(merchant,m.storeId(),s.id());return p;}
 @Transactional(rollbackFor=Exception.class)
 public void price(String actor,String merchant,String product,String sku,long price,long version){access.requirePermission(actor,merchant,"product.write");merchants.requireActiveForNewTrade(merchant);catalog.changePrice(merchant,product,sku,price,version);}
 @Transactional(rollbackFor=Exception.class)
 public void edit(String actor,String merchant,String product,String title,String desc,String category,String image,long version){access.requirePermission(actor,merchant,"product.write");merchants.requireActiveForNewTrade(merchant);catalog.edit(merchant,product,title,desc,category,image,version);}
 @Transactional(rollbackFor=Exception.class)
 public void publish(String actor,String merchant,String product,boolean published){access.requirePermission(actor,merchant,"product.write");if(published)merchants.requireActiveForNewTrade(merchant);catalog.publish(merchant,product,published);}
 @Transactional(rollbackFor=Exception.class)
 public void forceUnpublish(String actor,String product){access.requireAdmin(actor);catalog.forceUnpublish(product);access.audit(actor,"PRODUCT_FORCE_UNPUBLISH",product,null,"平台下架商品");}
 @Transactional(rollbackFor=Exception.class)
 public void replenish(String actor,String merchant,String sku,int quantity,String key){access.requirePermission(actor,merchant,"stock.replenish");MerchantVO m=merchants.requireActiveForNewTrade(merchant);SkuOfferVO offer=catalog.offers(List.of(sku),false,true).get(0);require(offer.merchantId().equals(merchant)&&offer.storeId().equals(m.storeId()),ResponseCode.AUTH_FORBIDDEN);inventory.replenish(merchant,m.storeId(),sku,quantity,key);}
 public List<StockVO> stocks(String actor,String merchant,int page,int size){return stocks(actor,merchant,page,size,"");}
 public List<StockVO> stocks(String actor,String merchant,int page,int size,String q){access.requirePermission(actor,merchant,"stock.read");return inventory.list(merchant,page,size,q);}
 public List<StockMovementVO> movements(String actor,String merchant,int page,int size){access.requirePermission(actor,merchant,"stock.read");return inventory.movements(merchant,page,size);}
 public List<ProductAggregate> publicProducts(String merchant,String query,String category,int page,int size){return catalog.search(merchant,query,category,true,page,size);}
 public List<ProductAggregate> publicProductsSorted(String merchant,String query,String category,int page,int size,String sort){return catalog.searchSorted(merchant,query,category,true,page,size,sort);}
 public List<ProductAggregate> managedProductsSorted(String actor,String merchant,String q,String cat,String status,int page,int size,String sort){
  access.requirePermission(actor,merchant,"product.read");return catalog.searchManagedSorted(merchant,q,cat,status,page,size,sort);
 }
 public ProductAggregate publicDetail(String id){ProductAggregate p=catalog.find(id);require("PUBLISHED".equals(p.getStatus())&&"ACTIVE".equals(merchants.find(p.getMerchantId()).status()),ResponseCode.PRODUCT_UNAVAILABLE);return p;}
 public List<ProductAggregate> managedProducts(String actor,String merchant,int page,int size){access.requirePermission(actor,merchant,"product.read");return catalog.search(merchant,"",null,false,page,size);}
 public Map<String,SkuOfferVO> stockOffers(String actor,String merchant,List<String> skuIds){
  access.requirePermission(actor,merchant,"product.read");
  if(skuIds.isEmpty())return Map.of();
  return catalog.offers(skuIds,false,false).stream().filter(o->merchant.equals(o.merchantId())).collect(java.util.stream.Collectors.toMap(SkuOfferVO::skuId,o->o));
 }
 public long countStocks(String actor,String merchant){return countStocks(actor,merchant,"");}
 public long countStocks(String actor,String merchant,String q){access.requirePermission(actor,merchant,"stock.read");return inventory.countStocks(merchant,q);}
 public long countMovements(String actor,String merchant){access.requirePermission(actor,merchant,"stock.read");return inventory.countMovements(merchant);}
 public long countPublicProducts(String merchant,String query,String category){return catalog.count(merchant,query,category,true);}
 public long countManagedProducts(String actor,String merchant){access.requirePermission(actor,merchant,"product.read");return catalog.count(merchant,"",null,false);}
 public List<ProductAggregate> managedProductsFiltered(String actor,String merchant,String q,String category,String status,int page,int size){access.requirePermission(actor,merchant,"product.read");return catalog.searchManaged(merchant,q,category,status,page,size);}
 public long countManagedProductsFiltered(String actor,String merchant,String q,String category,String status){access.requirePermission(actor,merchant,"product.read");return catalog.countManaged(merchant,q,category,status);}
 public long countAdminProducts(String actor,String merchant,String query){access.requireAdmin(actor);return catalog.count(merchant,query,null,false);}
 public String image(String actor,String merchant,byte[] bytes){access.requirePermission(actor,merchant,"product.write");require("ACTIVE".equals(merchants.find(merchant).status()),ResponseCode.MERCHANT_SUSPENDED);return catalog.storeImage(bytes);}
 @Transactional(rollbackFor=Exception.class)
 public void category(String actor,String code,String name,boolean active){access.requireAdmin(actor);catalog.category(code,name,active);access.audit(actor,"CATEGORY_CHANGED",code,null,"维护平台商品类目");}
 public List<ProductAggregate> adminProducts(String actor,String merchant,String query,int page,int size){access.requireAdmin(actor);return catalog.search(merchant,query,null,false,page,size);}
}
