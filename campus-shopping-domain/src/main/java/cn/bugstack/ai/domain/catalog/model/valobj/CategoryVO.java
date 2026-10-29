package cn.bugstack.ai.domain.catalog.model.valobj;
import java.util.*;
import java.time.*;
/** 平台统一商品类别。 */
public record CategoryVO(String code, String name, boolean active) {}
