package cn.bugstack.ai.api.dto;

import java.time.*;
import java.util.*;
import lombok.*;

/** 上传新文档或同一文档的新版本；文件最大2MB。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentUploadRequestDTO {

  private String rootId;
  private String title;
  private String filename;
  private String contentType;

  @lombok.ToString.Exclude
  private String base64;
}
