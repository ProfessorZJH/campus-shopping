"""真实模型调用的可选运维验收入口；只读取服务端环境变量，绝不打印密钥。"""
import sys
from .config import Settings
from .retrieval import Provider


def main():
    settings = Settings.from_env()
    if not all((settings.llm_url, settings.llm_key, settings.llm_model)):
        print('LLM_SMOKE=NOT_CONFIGURED (请配置服务端 LLM_BASE_URL/LLM_API_KEY/LLM_MODEL)')
        return 2
    try:
        result = Provider(settings).complete('只输出 JSON 对象，字段 answer，回答一句简单的中文问候。', {'question': '你好'})
        if not isinstance(result.get('answer'), str) or not result['answer'].strip():
            raise ValueError('模型未返回有效 answer')
    except Exception:
        print('LLM_SMOKE=FAIL (核对网络、模型授权、模型ID、额度与兼容格式；不输出敏感响应)')
        return 1
    print('LLM_SMOKE=PASS model=' + settings.llm_model)
    return 0


if __name__ == '__main__':
    sys.exit(main())
