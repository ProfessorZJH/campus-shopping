package cn.bugstack.ai.api.dto;
import lombok.*;
import java.util.*;
import java.time.*;
/** 受限文件上传；内容不可写入日志。 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class FileUploadRequestDTO {
    private String filename;
    private String contentType;
    @lombok.ToString.Exclude
    private String base64;
}
