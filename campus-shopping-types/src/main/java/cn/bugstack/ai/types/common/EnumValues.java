package cn.bugstack.ai.types.common;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** 固定业务码的边界转换；持久化坏值是内部故障，客户端筛选坏值是参数错误。 */
public final class EnumValues {

    private EnumValues() {}

    public static <E extends Enum<E>> E stored(Class<E> type, String code) {
        try {
            return Enum.valueOf(type, code);
        } catch (IllegalArgumentException | NullPointerException failure) {
            throw new IllegalStateException("无效的业务状态类型：" + type.getSimpleName(), failure);
        }
    }

    public static <E extends Enum<E>> String filter(Class<E> type, String code) {
        if (code == null || code.isBlank()) return "";
        try {
            return Enum.valueOf(type, code.strip()).name();
        } catch (IllegalArgumentException failure) {
            throw new AppException(ResponseCode.ILLEGAL_PARAMETER, failure);
        }
    }
}
