package cn.bugstack.ai.types.common;

import cn.bugstack.ai.types.enums.ResponseCode;
import cn.bugstack.ai.types.exception.AppException;

/** 共同输入边界；不代替各聚合的业务规则。 */
public final class Checks {

    private Checks() {}

    public static String text(String value, String field, int max) {
        if (value == null || value.isBlank() || value.strip().length() > max) throw new AppException(
            ResponseCode.ILLEGAL_PARAMETER.getCode(),
            field + "不能为空且长度不能超过" + max
        );
        return value.strip();
    }

    public static String optional(String value, int max) {
        if (value == null) return "";
        if (value.length() > max) throw new AppException(ResponseCode.ILLEGAL_PARAMETER);
        return value.strip();
    }

    public static void require(boolean condition, ResponseCode code) {
        if (!condition) throw new AppException(code);
    }

    public static int size(int size) {
        require(size >= 1 && size <= 100, ResponseCode.ILLEGAL_PARAMETER);
        return size;
    }

    public static int offset(int page, int size) {
        size(size);
        require(page >= 1 && page <= 10000, ResponseCode.ILLEGAL_PARAMETER);
        return (page - 1) * size;
    }
}
