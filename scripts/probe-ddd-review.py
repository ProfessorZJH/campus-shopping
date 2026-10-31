#!/usr/bin/env python3
"""DDD 审查问题的修复回归探针：编译当前生产源码，依赖以显式替身隔离。

不启动 Spring、不连接数据库/模型、不读取 .env；原始 REPRODUCED 证据保留在 ddd-review-20261029.json，本脚本验证修复后的预期行为。注解替身只用于纯 Java 编译，仓储/网关替身只提供输入。
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = ROOT/'campus-shopping-domain/src/main/java/cn/bugstack/ai/domain'
JAVA = r'''
import cn.bugstack.ai.domain.catalog.service.impl.CatalogServiceImpl;
import cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogRepository;
import cn.bugstack.ai.domain.trading.adapter.repository.ITradingRepository;
import cn.bugstack.ai.domain.trading.service.impl.OrderServiceImpl;
import cn.bugstack.ai.domain.fulfillment.model.aggregate.PickupAggregate;
import cn.bugstack.ai.domain.fulfillment.model.valobj.PickupVO;
import cn.bugstack.ai.domain.shoppingai.model.entity.AiQueryEntity;
import cn.bugstack.ai.infrastructure.adapter.port.AiEnginePort;
import cn.bugstack.ai.infrastructure.gateway.AiGatewayService;
import cn.bugstack.ai.infrastructure.gateway.dto.AiGatewayDTO;
import cn.bugstack.ai.types.exception.AppException;
import java.lang.reflect.Proxy;
import java.time.Clock;
import java.util.*;

public class DddReviewProbe {
    @SuppressWarnings("unchecked")
    static <T> T repository(Class<T> type, Map<String,Object[]> calls) {
        return (T)Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},(p,m,a)->{
            calls.put(m.getName(),a);
            if(m.getReturnType()==long.class)return 0L;
            if(m.getReturnType()==int.class)return 0;
            if(List.class.isAssignableFrom(m.getReturnType()))return List.of();
            return null;
        });
    }
    static void observed(String id,String expected,String actual) {
        if(!actual.equals(expected))throw new AssertionError(id+" changed: "+actual);
        System.out.println(id+"|"+actual);
    }
    static String failure(Runnable call) {
        try {call.run();return "NO_ERROR";}
        catch(AppException e){return "AppException:"+e.getCode();}
        catch(Exception e){return e.getClass().getSimpleName();}
    }
    public static void main(String[] args)throws Exception {
        Map<String,Object[]> calls=new HashMap<>();
        var trading=new OrderServiceImpl(repository(ITradingRepository.class,calls),Clock.systemUTC());
        observed("invalid_order_filter","AppException:0002",failure(()->trading.orders("buyer",null,"PAYED",1,20)));
        if(calls.containsKey("orders"))throw new AssertionError("invalid filter reached repository");

        var port=new AiEnginePort();
        var gateway=new AiGatewayService(); // 显式上游协议替身，不访问网络。
        var field=AiEnginePort.class.getDeclaredField("gateway");field.setAccessible(true);field.set(port,gateway);
        gateway.recalled=new AiGatewayDTO.RecallResponse("正常问题",Arrays.asList((String)null));
        observed("null_upstream_recall_term","AppException:AI0001",failure(()->port.recall("正常问题",List.of())));

        gateway.recalled=new AiGatewayDTO.RecallResponse("正常问题",List.of("?"));
        var catalog=new CatalogServiceImpl(repository(ICatalogRepository.class,new HashMap<>()),repository(cn.bugstack.ai.domain.catalog.adapter.repository.ICatalogQueryRepository.class,new HashMap<>()));
        observed("invalid_upstream_term_blames_client","AppException:AI0001",failure(()->{
            var recall=port.recall("正常问题",List.of());catalog.recall(recall.terms(),200);
        }));

        gateway.answered=new AiGatewayDTO.Answer("正常回答","LOCAL_RETRIEVAL_DEMO","LOCAL_CHAR_NGRAM_DEMO","正常问题",null,
            List.of(),Arrays.asList((AiGatewayDTO.Recommendation)null),0);
        observed("null_upstream_recommendation","AppException:AI0001",failure(()->port.query(
            new AiQueryEntity("正常问题",List.of(),List.of(),List.of(),"正常问题",List.of()))));

        var pickup=new PickupAggregate(new PickupVO("task","order","merchant","store","buyer","CANCELED",null,null));
        observed("pickup_conflict_uses_fulfillment_code","AppException:F0003",failure(pickup::prepare));
    }
}
'''

STUBS = {
    'org/springframework/stereotype/Service.java':
        'package org.springframework.stereotype; public @interface Service {}',
    'org/springframework/stereotype/Component.java':
        'package org.springframework.stereotype; public @interface Component {}',
    'org/springframework/transaction/annotation/Propagation.java':
        'package org.springframework.transaction.annotation; public enum Propagation {REQUIRED,MANDATORY}',
    'org/springframework/transaction/annotation/Transactional.java':
        'package org.springframework.transaction.annotation; public @interface Transactional {'
        'Propagation propagation() default Propagation.REQUIRED; Class<?>[] rollbackFor() default {};}',
    'jakarta/annotation/Resource.java': 'package jakarta.annotation; public @interface Resource {}',
    'cn/bugstack/ai/infrastructure/gateway/AiGatewayService.java': '''
        package cn.bugstack.ai.infrastructure.gateway;
        import cn.bugstack.ai.infrastructure.gateway.dto.AiGatewayDTO;
        import java.util.Map;
        public class AiGatewayService {
            public AiGatewayDTO.RecallResponse recalled;
            public AiGatewayDTO.Answer answered;
            public AiGatewayDTO.RecallResponse recall(AiGatewayDTO.RecallRequest r){return recalled;}
            public AiGatewayDTO.Answer query(AiGatewayDTO.Query q){return answered;}
            public AiGatewayDTO.ProductSearchResult semanticProducts(AiGatewayDTO.ProductSearch r){return null;}
            public void indexProducts(AiGatewayDTO.ProductIndexRequest r){}
            public void deleteProducts(AiGatewayDTO.ProductDeleteRequest r){}
            public void index(AiGatewayDTO.Index r){}
            public String extract(AiGatewayDTO.Extract r){return "";}
        }''',
}


def sources():
    paths = []
    for folder in ('catalog','trading','shoppingai/model','fulfillment/model/valobj'):
        paths.extend((DOMAIN/folder).rglob('*.java'))
    paths.extend(DOMAIN/name for name in ('shoppingai/adapter/port/IAiEnginePort.java','fulfillment/model/aggregate/PickupAggregate.java'))
    paths.extend((ROOT/'campus-shopping-types/src/main/java').rglob('*.java'))
    paths.extend(ROOT/name for name in (
        'campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/adapter/port/AiEnginePort.java',
        'campus-shopping-infrastructure/src/main/java/cn/bugstack/ai/infrastructure/gateway/dto/AiGatewayDTO.java'))
    return sorted(set(paths))


def structure():
    counts, enums, imports = {}, [], []
    for context in sorted(DOMAIN.iterdir()):
        if not context.is_dir():
            continue
        paths = list(context.rglob('*.java'))
        counts[context.name] = len(paths)
        for path in paths:
            for number, line in enumerate(path.read_text('utf-8').splitlines(), 1):
                if re.search(r'\benum\s+\w+', line):
                    enums.append({'path': path.relative_to(ROOT).as_posix(), 'line': number})
                for target in re.findall(r'cn\.bugstack\.ai\.domain\.(\w+)', line):
                    if target != context.name:
                        imports.append({'path': path.relative_to(ROOT).as_posix(), 'line': number, 'target': target})
    controllers = list((ROOT/'campus-shopping-trigger/src/main/java').rglob('*Controller.java'))
    return {'contextJavaFiles': counts, 'domainEnums': enums, 'crossContextJavaReferences': imports,
            'duplicatedControllerExecuteMethods': sum('private <T> Response<T> execute' in p.read_text('utf-8')
                                                       for p in controllers)}


def schema_observations():
    from jsonschema import Draft202012Validator, RefResolver
    spec = json.loads((ROOT/'docs/api/openapi.json').read_text('utf-8'))
    shape = spec['paths']['/api/v1/orders/{orderId}']['get']['responses']['200']['content']['application/json']['schema']
    validator = Draft202012Validator(shape, resolver=RefResolver.from_schema(spec))
    cases = (
        ('success_missing_data', {'code': '0000', 'info': '成功'}),
        ('success_null_order', {'code': '0000', 'info': '成功', 'data': None}),
        ('success_empty_order', {'code': '0000', 'info': '成功', 'data': {}}),
    )
    observations = []
    for label, value in cases:
        accepted = validator.is_valid(value)
        assert not accepted, label+' must be rejected after contract repair'
        observations.append({'id': label, 'actual': 'rejected_by_current_order_response_schema'})
    return observations


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'docs/testing/evidence/ddd-refactor-20261029/regression.json')
    args = parser.parse_args()
    production = sources()
    with tempfile.TemporaryDirectory(prefix='campus-ddd-review-') as temporary:
        temp = Path(temporary)
        fixtures = []
        for name, content in {**STUBS, 'DddReviewProbe.java': JAVA}.items():
            path = temp/name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
            fixtures.append(path)
        classes = temp/'classes'
        classes.mkdir()
        subprocess.run(['javac', '-encoding', 'UTF-8', '--release', '17', '-d', str(classes),
                        *map(str, production), *map(str, fixtures)], check=True)
        output = subprocess.check_output(['java', '-Dfile.encoding=UTF-8', '-cp', str(classes), 'DddReviewProbe'],
                                         text=True, encoding='utf-8')
    observations = [{'id': line.split('|', 1)[0], 'actual': line.split('|', 1)[1]}
                    for line in output.splitlines() if line.strip()]
    assert len(observations) == 5
    schema_checks = schema_observations()
    report = {'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'PASS',
              'scope': 'CURRENT_PRODUCTION_JAVA_WITH_EXPLICIT_REPOSITORY_GATEWAY_AND_ANNOTATION_DOUBLES',
              'databaseUsed': False, 'springStarted': False, 'remoteServiceUsed': False,
              'structure': structure(), 'javaObservations': observations, 'schemaObservations': schema_checks,
              'openapiSha256': hashlib.sha256((ROOT/'docs/api/openapi.json').read_bytes()).hexdigest(),
              'productionSources': {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                                    for p in production}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'status': report['status'], 'productionFilesCompiled': len(production),
                      'javaObservations': observations, 'schemaObservations': schema_checks,
                      'structure': report['structure']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
