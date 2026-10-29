#!/usr/bin/env python3
"""本地真实 HTTP 冒烟检查：创建临时测试账号和一条商户申请，不删除数据。"""
import argparse
import http.cookiejar
import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8091")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    url = urllib.parse.urlsplit(base)
    if url.hostname not in {"127.0.0.1", "localhost", "::1"}:
        parser.error("仅允许在本地开发环境执行。")
    jar = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    username = "smoke" + uuid.uuid4().hex[:20]
    password = secrets.token_urlsafe(24)
    checks = 0

    def call(method, path, payload=None, token=None, extra=None, expected_http=200, expected_code="0000", opener=None):
        nonlocal checks
        headers = {"Content-Type": "application/json"}
        if token: headers["X-CSRF-TOKEN"] = token
        if extra: headers.update(extra)
        data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(base + path, data=data, headers=headers, method=method)
        try:
            result = (opener or client).open(request, timeout=20)
        except urllib.error.HTTPError as error:
            result = error
        with result:
            body = json.load(result)
            assert result.status == expected_http, (path, result.status, expected_http)
            assert body.get("code") == expected_code, (path, body.get("code"), expected_code)
        checks += 1
        return body.get("data")

    token = call("GET", "/api/v1/auth/csrf")["token"]
    call("GET", "/api/v1/auth/me", expected_http=401, expected_code="A0004")
    payload = {"username": username, "password": password, "displayName": "联调用户"}
    user = call("POST", "/api/v1/auth/register", payload, token)
    call("POST", "/api/v1/auth/register", payload, token, expected_code="A0001")
    call("POST", "/api/v1/auth/login", {"username": username, "password": "wrong-password"}, token, expected_code="A0002")
    old_id = next(c.value for c in jar if c.name == "JSESSIONID")
    signed_in = call("POST", "/api/v1/auth/login", {"username": username, "password": password}, token)
    new_id = next(c.value for c in jar if c.name == "JSESSIONID")
    assert old_id != new_id
    assert signed_in["userId"] == user["userId"]
    call("POST", "/api/v1/merchant-applications", {"merchantName": "联调店铺", "category": "stationery", "contactName": "联调经营者", "contactPhone": "13800000000", "storeName": "测试门店", "location": "校园测试区"}, token,
         {"Idempotency-Key": "old-token"}, expected_http=403, expected_code="A0005")
    token = call("GET", "/api/v1/auth/csrf")["token"]
    assert call("GET", "/api/v1/auth/me")["userId"] == user["userId"]
    key = uuid.uuid4().hex
    first = call("POST", "/api/v1/merchant-applications", {"merchantName": "联调店铺", "category": "stationery", "contactName": "联调经营者", "contactPhone": "13800000000", "storeName": "测试门店", "location": "校园测试区"}, token, {"Idempotency-Key": key})
    again = call("POST", "/api/v1/merchant-applications", {"merchantName": "联调店铺", "category": "stationery", "contactName": "联调经营者", "contactPhone": "13800000000", "storeName": "测试门店", "location": "校园测试区"}, token, {"Idempotency-Key": key})
    assert first["applicationId"] == again["applicationId"]
    call("POST", "/api/v1/auth/logout", {}, token)
    call("GET", "/api/v1/auth/me", expected_http=401, expected_code="A0004")
    # 使用另一个客户端重放退出前的 Cookie。
    call("GET", "/api/v1/auth/me", extra={"Cookie": "JSESSIONID=" + new_id}, expected_http=401,
         expected_code="A0004", opener=urllib.request.build_opener())
    print("真实 HTTP 检查通过：", checks, "项；userId=", user["userId"])
    print("测试账号与商户申请已保留在本地库，凭据未打印。")


if __name__ == "__main__":
    main()
