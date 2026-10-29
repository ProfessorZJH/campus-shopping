package cn.bugstack.ai.api.dto;

import java.util.List;

/** 分页元信息由服务端 COUNT 查询提供；旧 List 接口暂时保留兼容。 */
public record PageResponseDTO<T>(List<T> items, int page, int size, long total, boolean hasNext) {
    public static <T> PageResponseDTO<T> of(List<T> items, int page, int size, long total) {
        if (items == null || page < 1 || size < 1 || size > 100 || total < 0) throw new IllegalArgumentException("分页参数无效");
        return new PageResponseDTO<>(List.copyOf(items), page, size, total, (long) page * size < total);
    }
}
