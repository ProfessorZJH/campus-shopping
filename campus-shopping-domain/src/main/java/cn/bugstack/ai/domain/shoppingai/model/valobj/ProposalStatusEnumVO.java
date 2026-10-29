package cn.bugstack.ai.domain.shoppingai.model.valobj;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** AI 提案状态；确认后不可再次更换选择。 */
public enum ProposalStatusEnumVO {
    PENDING, CONFIRMED, REJECTED;

    /** 持久化和 HTTP 使用枚举名称；无效/未知值必须显式失败，不静默降级。 */
    public static ProposalStatusEnumVO fromCode(String code) {
        for (ProposalStatusEnumVO value : values()) {
            if (value.name().equals(code)) {
                return value;
            }
        }
        throw new AppException(ResponseCode.STATE_CONFLICT);
    }
}
