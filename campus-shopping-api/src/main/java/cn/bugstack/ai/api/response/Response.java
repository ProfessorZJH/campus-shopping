package cn.bugstack.ai.api.response;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 对外统一响应结构，与 group-buy-market 的 Response<T> 一致。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Response<T> implements Serializable {

  private static final long serialVersionUID = 7000723935764546321L;

  private String code;
  private String info;
  private T data;
}
