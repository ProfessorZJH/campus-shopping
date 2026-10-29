import cn.bugstack.ai.api.dto.PageResponseDTO;
import cn.bugstack.ai.domain.trading.model.entity.OrderItemEntity;
import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import java.util.List;

/** 不依赖 Spring/MySQL 的 SDD-02 真 Java 契约回归，Java 17。 */
public class SddReadModelCheck {
    private static int checks = 0;
    private static void check(boolean condition, String label) {
        if (!condition) throw new AssertionError(label);
        checks++;
    }
    public static void main(String[] args) {
        var first = PageResponseDTO.of(List.of("a", "b"), 1, 2, 5);
        check(first.hasNext() && first.total() == 5 && first.page() == 1, "首个分页存在下一页");
        var last = PageResponseDTO.of(List.of("e"), 3, 2, 5);
        check(!last.hasNext() && last.items().size() == 1, "末页不再有下一页");
        try { first.items().add("x"); throw new AssertionError("分页 items 不可修改"); }
        catch (UnsupportedOperationException expected) { checks++; }
        try { PageResponseDTO.of(List.of(), 1, 101, 0); throw new AssertionError("超限页大小必须拒绝"); }
        catch (IllegalArgumentException expected) { checks++; }
        var snapshot = new OrderItemEntity("sku1", "商品", "标准", 990, 1, "/media/original.png");
        check("/media/original.png".equals(snapshot.imageUrl()), "订单图片是创建时固定的快照");
        var oldOrder = new OrderItemEntity("sku1", "商品", "标准", 990, 1);
        check("".equals(oldOrder.imageUrl()), "历史数据无图兼容默认空值");
        var proposed = new ProposalItemVO("sku1", "m1", "商品", "标准", 990, 3, 1, "/media/a.png");
        check("/media/a.png".equals(proposed.imageUrl()), "AI 提案携带可信商品图");
        var legacy = new ProposalItemVO("sku1", "m1", "商品", "标准", 990, 3, 1);
        check("".equals(legacy.imageUrl()), "旧提案构造接口兼容空图片");
        System.out.println("SDD_READ_MODEL_JAVA_CHECKS=" + checks);
    }
}
