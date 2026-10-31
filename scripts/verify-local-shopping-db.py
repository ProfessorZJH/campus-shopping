#!/usr/bin/env python3
"""只读核对真实页面验收产生的 MySQL 交易、库存和图片快照。"""
import importlib.util
import json
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import pymysql

ROOT=Path(__file__).resolve().parents[1]


def main():
    spec=importlib.util.spec_from_file_location('full_smoke',ROOT/'scripts/smoke-full.py')
    smoke=importlib.util.module_from_spec(spec);spec.loader.exec_module(smoke)
    config=smoke.env_file(ROOT/'.env')
    address=urlparse(config['DB_URL'].removeprefix('jdbc:'))
    database=address.path.strip('/')
    if address.hostname not in ('127.0.0.1','localhost') or database!='campus_shopping':
        raise ValueError('只允许用户授权的本地 campus_shopping 库')
    state=json.loads((ROOT/'var/local-live/shopping-accounts.json').read_text(encoding='utf-8'))
    report={'testType':'READ_ONLY_MYSQL_POST_BROWSER','database':database,'status':'RUNNING',
            'startedAt':datetime.now().astimezone().isoformat(),'checks':[]}
    output=ROOT/'docs/testing/evidence/local-live/database-readback.json'
    def check(condition,name,**details):
        report['checks'].append({'name':name,'status':'PASS' if condition else 'FAILED',**details})
        if not condition:report['status']='FAILED'
        output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        if not condition:raise AssertionError(name)
        print(name+': PASS',flush=True)
    with pymysql.connect(host=address.hostname,port=address.port or 3306,
                         user=config['DB_USERNAME'],password=config['DB_PASSWORD'],
                         database=database,charset='utf8mb4',
                         cursorclass=pymysql.cursors.DictCursor) as connection:
        with connection.cursor() as cursor:
            cursor.execute('SET SESSION TRANSACTION READ ONLY')
            def rows(sql,params):
                cursor.execute(sql,params);return cursor.fetchall()
            completed=state['browserOrderId'];refunded=state['browserRefundOrderId']
            orders=rows('SELECT id,status,total_cent FROM trd_order WHERE id IN (%s,%s)',(completed,refunded))
            indexed={row['id']:row for row in orders}
            check(indexed[completed]['status']=='COMPLETED' and indexed[completed]['total_cent']==1200
                  and indexed[refunded]['status']=='REFUNDED' and indexed[refunded]['total_cent']==600,
                  'mysql_orders_completed_and_refunded',orders=orders)
            payments=rows('SELECT order_id,amount_cent,status FROM trd_payment WHERE order_id IN (%s,%s)',(completed,refunded))
            check(len(payments)==2 and {row['amount_cent'] for row in payments}=={600,1200},
                  'mysql_both_simulated_payments_recorded',payments=payments)
            refunds=rows('SELECT order_id,amount_cent FROM trd_refund WHERE order_id=%s',(refunded,))
            check(len(refunds)==1 and refunds[0]['amount_cent']==600,'mysql_refund_once_for_full_amount',refunds=refunds)
            items=rows('SELECT order_id,sku_id,quantity,unit_price_cent,image_url FROM trd_order_item WHERE order_id IN (%s,%s)',(completed,refunded))
            check(len(items)==2 and all(row['image_url']==state['imageUrl'] and row['sku_id']==state['skuId']
                  and row['unit_price_cent']==600 for row in items),
                  'mysql_order_item_image_and_price_snapshots',items=items)
            stocks=rows('SELECT sku_id,on_hand,reserved FROM inv_stock_balance WHERE sku_id=%s',(state['skuId'],))
            check(len(stocks)==1 and stocks[0]['on_hand']==48 and stocks[0]['reserved']==0,
                  'mysql_stock_consumed_two_refund_released_reservation',stocks=stocks)
            verifications=rows('SELECT p.order_id,COUNT(v.id) AS verification_count FROM ful_pickup_task p LEFT JOIN ful_pickup_verification v ON v.pickup_id=p.id WHERE p.order_id IN (%s,%s) GROUP BY p.order_id',(completed,refunded))
            counts={row['order_id']:row['verification_count'] for row in verifications}
            check(counts.get(completed)==1 and counts.get(refunded)==0,
                  'mysql_pickup_only_completed_order_verified',verifications=verifications)
            proposals=rows('SELECT id,status FROM ai_proposal WHERE id=%s',(state['browserProposalId'],))
            check(len(proposals)==1 and proposals[0]['status']=='CONFIRMED',
                  'mysql_browser_proposal_confirmed',proposals=proposals)
            cart=rows('SELECT sku_id,quantity FROM trd_cart_item WHERE user_id=%s',
                      (state['users']['buyer']['userId'],))
            check(not cart,'mysql_buyer_cart_consumed_by_checkout',cart=cart)
        connection.rollback()
    report['status']='PASS'
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':main()
