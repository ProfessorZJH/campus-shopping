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

    public String getCode() { return code; }
    public String getInfo() { return info; }

    public AppException(ResponseCode responseCode) {
        this(responseCode.getCode(), responseCode.getInfo());
    }

    public AppException(String code) {
        super(code);
        this.code = code;
        this.info = null;
    }

    public AppException(String code, Throwable cause) {
        super(code, cause);
        this.code = code;
        this.info = null;
    }

    public AppException(String code, String message) {
        super(message);
        this.code = code;
        this.info = message;
    }

    public AppException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.info = message;
    }
}
