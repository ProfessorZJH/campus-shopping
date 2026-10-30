package cn.bugstack.ai.types.exception;

import cn.bugstack.ai.types.enums.ResponseCode;

/**
 * 统一业务异常。
 * 业务码供客户端识别，错误详情保存在 RuntimeException 的 message 中，方便日志与异常链排查。
 */
public class AppException extends RuntimeException {

    private static final long serialVersionUID = 5317680961212299217L;

    /** 业务异常码 */
    private final String code;

    /** 可安全向调用者展示的业务提示 */
    private final String info;

    public String getCode() {
        return code;
    }

    public String getInfo() {
        return info;
    }

    public AppException(ResponseCode responseCode) {
        this(responseCode.getCode(), responseCode.getInfo());
    }

    public AppException(ResponseCode responseCode, Throwable cause) {
        this(responseCode.getCode(), responseCode.getInfo(), cause);
    }

    public AppException(String code) {
        this(ResponseCode.fromCode(code));
    }

    public AppException(String code, Throwable cause) {
        this(ResponseCode.fromCode(code), cause);
    }

    public AppException(String code, String message) {
        this(code, message, null);
    }

    public AppException(String code, String message, Throwable cause) {
        super(safeInfo(code, message), cause);
        this.code = ResponseCode.fromCode(code).getCode();
        this.info = safeInfo(code, message);
    }

    private static String safeInfo(String code, String message) {
        ResponseCode known = ResponseCode.fromCode(code);
        return message == null || message.isBlank() ? known.getInfo() : message;
    }

    public boolean isOperationalFailure() {
        return ResponseCode.fromCode(code).isOperationalFailure();
    }
}
