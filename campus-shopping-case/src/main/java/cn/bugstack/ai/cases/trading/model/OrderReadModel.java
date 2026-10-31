package cn.bugstack.ai.cases.trading.model;

import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.trading.model.aggregate.OrderAggregate;
import cn.bugstack.ai.domain.trading.model.valobj.AfterSaleVO;

/** 用例层组合的订单读模型，不依赖 HTTP DTO。 */
public record OrderReadModel(
  OrderAggregate order,
  String merchantName,
  PickupVO pickup,
  AfterSaleVO afterSale
) {}
