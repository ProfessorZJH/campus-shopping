package cn.bugstack.ai.api.dto;

import lombok.*;

/** 上传完成后返回当前媒体访问路径；图片归属在商品保存时建立。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductImageUploadDTO {

    private String url;
}
