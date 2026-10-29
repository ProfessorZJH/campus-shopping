package cn.bugstack.ai.infrastructure.adapter.repository;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.catalog.model.aggregate.ProductAggregate;
import cn.bugstack.ai.domain.catalog.model.entity.ProductSkuEntity;
import cn.bugstack.ai.domain.catalog.model.valobj.*;
import cn.bugstack.ai.infrastructure.dao.ICatalogDao;
import cn.bugstack.ai.infrastructure.dao.po.*;
import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;
import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import java.util.*;
import java.nio.file.*;
import java.io.*;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
/** 聚合/PO 映射与本地商品图片存储；图片重编码，不直接公开用户原始文件。 */
@Repository
public class CatalogRepository implements ICatalogRepository {
 @Resource private ICatalogDao dao;@Value("${campus.uploads}") private String uploadDir;
 public ProductAggregate find(String id,boolean lock){ProductPO p=dao.product(id,lock);return p==null?null:aggregate(p,dao.skus(List.of(id)));}
 public List<ProductAggregate> search(String merchant,String q,String category,boolean publicOnly,int offset,int limit){
  List<ProductPO> ps=dao.search(merchant,q,category,publicOnly,offset,limit,"NEWEST");if(ps.isEmpty())return List.of();
  List<SkuPO> ss=dao.skus(ps.stream().map(ProductPO::getId).toList());
  return ps.stream().map(p->aggregate(p,ss.stream().filter(s->s.getProductId().equals(p.getId())).toList())).toList();
 }
 public List<ProductAggregate> recall(List<String> terms,int limit){return fromProducts(dao.recall(terms,limit));}
 public List<ProductAggregate> publicByIds(List<String> ids){return ids.isEmpty()?List.of():fromProducts(dao.publicByIds(ids));}
 public List<ProductAggregate> searchSorted(String m,String q,String cat,boolean pub,int offset,int limit,String sort){
  List<ProductPO> ps=dao.search(m,q,cat,pub,offset,limit,sort);return fromProducts(ps);
 }
 public List<ProductAggregate> searchManagedSorted(String m,String q,String cat,String status,int offset,int limit,String sort){
  List<ProductPO> ps=dao.searchManaged(m,q,cat,status,offset,limit,sort);return fromProducts(ps);
 }
 private List<ProductAggregate> fromProducts(List<ProductPO> ps){
  if(ps.isEmpty())return List.of();List<SkuPO> ss=dao.skus(ps.stream().map(ProductPO::getId).toList());
  return ps.stream().map(p->aggregate(p,ss.stream().filter(s->s.getProductId().equals(p.getId())).toList())).toList();
 }
 public long count(String m,String q,String cat,boolean pub){return dao.count(m,q,cat,pub);}
 public List<ProductAggregate> searchManaged(String merchant,String q,String category,String status,int offset,int limit){
  List<ProductPO> ps=dao.searchManaged(merchant,q,category,status,offset,limit,"NEWEST");if(ps.isEmpty())return List.of();
  List<SkuPO> ss=dao.skus(ps.stream().map(ProductPO::getId).toList());
  return ps.stream().map(p->aggregate(p,ss.stream().filter(s->s.getProductId().equals(p.getId())).toList())).toList();
 }
 public long countManaged(String merchant,String q,String category,String status){return dao.countManaged(merchant,q,category,status);}
 public void insert(ProductAggregate p){dao.insertProduct(po(p));for(ProductSkuEntity s:p.getSkus())dao.insertSku(sku(p,s));}
 public void save(ProductAggregate p){
  if(dao.saveProduct(po(p))!=1)throw new AppException(ResponseCode.STATE_CONFLICT);
  Set<String> old=new HashSet<>(dao.skus(List.of(p.getId())).stream().map(SkuPO::getId).toList());
  for(ProductSkuEntity s:p.getSkus()){if(old.contains(s.id()))dao.saveSku(sku(p,s));else dao.insertSku(sku(p,s));}
 }
 public List<SkuOfferVO> offers(List<String> ids,boolean lock){if(ids.isEmpty())return List.of();return dao.offers(ids,lock).stream().map(p->new SkuOfferVO(p.getSkuId(),p.getProductId(),p.getMerchantId(),p.getStoreId(),p.getTitle(),p.getSpecKey(),p.getPriceCent(),p.getVersion(),p.getProductStatus(),p.getSkuStatus(),p.getImageUrl(),p.getDescription())).toList();}
 public List<CategoryVO> categories(){return dao.categories().stream().map(p->new CategoryVO(p.getCode(),p.getName(),p.getActive())).toList();}
 public void category(String c,String n,boolean a){dao.category(c,n,a);}
 private ProductAggregate aggregate(ProductPO p,List<SkuPO> ss){return new ProductAggregate(p.getId(),p.getMerchantId(),p.getStoreId(),p.getTitle(),p.getDescription(),p.getCategoryCode(),p.getImageUrl(),p.getStatus(),p.getVersion(),ss.stream().map(s->new ProductSkuEntity(s.getId(),s.getSpecKey(),s.getPriceCent(),s.getStatus(),s.getVersion())).toList());}
 private ProductPO po(ProductAggregate p){return ProductPO.builder().id(p.getId()).merchantId(p.getMerchantId()).storeId(p.getStoreId()).title(p.getTitle()).description(p.getDescription()).categoryCode(p.getCategoryCode()).imageUrl(p.getImageUrl()).status(p.getStatus()).version(p.getVersion()).build();}
 private SkuPO sku(ProductAggregate p,ProductSkuEntity s){return SkuPO.builder().id(s.id()).productId(p.getId()).merchantId(p.getMerchantId()).storeId(p.getStoreId()).specKey(s.specKey()).priceCent(s.priceCent()).status(s.status()).version(s.version()).build();}
 public String storeImage(byte[] data){
  if(data==null||data.length==0||data.length>2*1024*1024)throw new AppException(ResponseCode.UPLOAD_INVALID);
  try(ImageInputStream in=ImageIO.createImageInputStream(new ByteArrayInputStream(data))){
   Iterator<ImageReader> rs=ImageIO.getImageReaders(in);if(!rs.hasNext())throw new AppException(ResponseCode.UPLOAD_INVALID);
   ImageReader r=rs.next();try{r.setInput(in);if((long)r.getWidth(0)*r.getHeight(0)>12000000L)throw new AppException(ResponseCode.UPLOAD_INVALID);
    String name=UUID.randomUUID()+".png";Path dir=Path.of(uploadDir).toAbsolutePath().normalize();Files.createDirectories(dir);
    if(!ImageIO.write(r.read(0),"png",dir.resolve(name).toFile()))throw new IOException("图片编码失败");return "/media/"+name;
   }finally{r.dispose();}
  }catch(IOException e){throw new IllegalStateException("商品图片存储失败",e);}
 }
}
