package cn.bugstack.ai.domain.merchant.model.entity;
import java.util.*;
import java.time.*;
/** 入驻资料命令，不接收客户端伪造的申请人或审核人。 */
public record AdmissionCommandEntity(String name, String category, String contactName, String contactPhone, String storeName, String location) {}
