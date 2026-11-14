import importlib.util
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "verify-mapper-scan.py"
SPEC = importlib.util.spec_from_file_location("verify_mapper_scan", SCRIPT)
mapper_scan = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(mapper_scan)


class MapperScanTest(unittest.TestCase):
    def scan(self, xml):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "mapper.xml"
            path.write_text(xml, encoding="utf-8")
            return mapper_scan.scan(path)

    def test_nested_includes_are_scanned(self):
        findings = self.scan(
            '<mapper><sql id="outer"><include refid="inner"/></sql>'
            '<sql id="inner">AND LOCATE(#{q}, p.title)</sql>'
            '<select id="search">SELECT * FROM cat_product p <include refid="outer"/></select></mapper>'
        )
        self.assertEqual(len(findings), 1)
        self.assertFalse(findings[0]["narrowed"])

    def test_xml_attributes_and_comments_do_not_hide_or_invent_findings(self):
        findings = self.scan(
            "<mapper><sql id='filter'>AND LOCATE(#{q}, p.title)</sql>"
            "<select resultType='long' id='search'>SELECT * FROM cat_product p "
            "<!-- AND merchant_id=#{merchantId} --><include refid='filter' /></select></mapper>"
        )
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["statement"], "search")
        self.assertFalse(findings[0]["narrowed"])

    def test_optional_nested_conditions_cannot_prove_narrowing(self):
        for dynamic in (
            '<choose><when test="enabled">AND merchant_id=#{merchantId}</when></choose>',
            '<if test="enabled"><if test="other">AND 1=1</if> AND merchant_id=#{merchantId}</if>',
            '<foreach collection="ids" item="id">AND product_id=#{id}</foreach>',
        ):
            with self.subTest(dynamic=dynamic):
                findings = self.scan(
                    '<mapper><select id="search">SELECT * FROM cat_product p '
                    'WHERE LOCATE(#{q}, p.title) ' + dynamic + '</select></mapper>'
                )
                self.assertFalse(findings[0]["narrowed"])

    def test_unconditional_narrowing_is_recognized(self):
        findings = self.scan(
            '<mapper><select id="search">SELECT * FROM cat_product p '
            'WHERE p.merchant_id=#{merchantId} AND LOCATE(#{q}, p.title)</select></mapper>'
        )
        self.assertTrue(findings[0]["narrowed"])

    def test_leading_wildcard_in_literal_or_concat_is_detected(self):
        for expression in (
            "LIKE '%book%'",
            "like CONCAT('%', #{q}, '%')",
            "LIKE (concat(  '%book', #{q}))",
            'LIKE CONCAT("%", #{q})',
        ):
            with self.subTest(expression=expression):
                findings = self.scan(
                    '<mapper><select id="search">SELECT * FROM cat_product p WHERE p.title '
                    + expression + '</select></mapper>'
                )
                self.assertEqual(len(findings), 1)
                self.assertIn("LEADING_WILDCARD", findings[0]["patterns"])
                self.assertFalse(findings[0]["narrowed"])

        for expression in ("LIKE 'book%'", "LIKE CONCAT(#{q}, '%')", "LIKE CONCAT('book', #{q}, '%')"):
            with self.subTest(expression=expression):
                findings = self.scan(
                    '<mapper><select id="search">SELECT * FROM cat_product p WHERE p.title '
                    + expression + '</select></mapper>'
                )
                self.assertEqual(findings, [])

    def test_unknown_and_cyclic_includes_fail_closed(self):
        examples = (
            '<mapper><select id="search"><include refid="missing"/></select></mapper>',
            '<mapper><sql id="a"><include refid="b"/></sql><sql id="b"><include refid="a"/></sql>'
            '<select id="search"><include refid="a"/></select></mapper>',
        )
        for xml in examples:
            with self.subTest(xml=xml), self.assertRaises(ValueError):
                self.scan(xml)


if __name__ == "__main__":
    unittest.main()
