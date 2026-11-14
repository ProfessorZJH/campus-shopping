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

    def test_narrowing_must_apply_to_every_or_branch(self):
        cases = (
            ('WHERE LOCATE(#{q}, p.title) &gt; 0 OR p.merchant_id=#{merchantId}', False),
            ('WHERE p.merchant_id=#{merchantId} OR LOCATE(#{q}, p.title) &gt; 0', False),
            ('WHERE p.merchant_id=#{merchantId} AND p.active=1 OR LOCATE(#{q}, p.title) &gt; 0', False),
            ('WHERE (p.merchant_id=#{merchantId} OR LOCATE(#{q}, p.title) &gt; 0)', False),
            ('WHERE p.merchant_id=#{merchantId} <if test="extra">OR LOCATE(#{q}, p.title) &gt; 0</if>', False),
            ('WHERE EXISTS (SELECT 1 FROM other o WHERE o.merchant_id=#{merchantId}) '
             'AND LOCATE(#{q}, p.title) &gt; 0', False),
            ('WHERE p.id IN (SELECT id FROM other) AND LOCATE(#{q}, p.title) &gt; 0', False),
            ('WHERE LOCATE(#{q}, p.title) &gt; 0 # AND merchant_id=#{merchantId}\n', False),
            ('WHERE p.merchant_id=#{merchantId} AND LOCATE(#{q}, p.title) &gt; 0 '
             'UNION SELECT * FROM other', False),
            ('WHERE p.merchant_id=#{merchantId} AND '
             '(LOCATE(#{q}, p.title) &gt; 0 OR LOCATE(#{q}, p.description) &gt; 0)', True),
            ("WHERE p.merchant_id=#{merchantId} AND p.title='OR' AND LOCATE(#{q}, p.title) &gt; 0", True),
            ('WHERE p.id IN (#{first}, #{second}) AND LOCATE(#{q}, p.title) &gt; 0', True),
        )
        for condition, expected in cases:
            with self.subTest(condition=condition):
                findings = self.scan(
                    '<mapper><select id="search">SELECT * FROM cat_product p '
                    + condition + '</select></mapper>'
                )
                self.assertEqual(findings[0]["narrowed"], expected)

    def test_lower_column_detection_does_not_depend_on_alias(self):
        for column in ("o.title", "oi.title", "other_alias.title", "`o`.`title`", "title"):
            with self.subTest(column=column):
                findings = self.scan(
                    '<mapper><select id="search">SELECT * FROM products o WHERE LOWER('
                    + column + ') = LOWER(#{q})</select></mapper>'
                )
                self.assertIn("FUNCTION_ON_COLUMN", findings[0]["patterns"])
                self.assertFalse(findings[0]["narrowed"])
        self.assertEqual(self.scan(
            '<mapper><select id="search">SELECT * FROM products WHERE title = LOWER(#{q})</select></mapper>'
        ), [])

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

    def test_leading_wildcard_from_bind_is_detected(self):
        direct = self.scan(
            '<mapper><select id="search"><bind name="pattern" value="\'%\' + q + \'%\'"/>'
            'SELECT * FROM products WHERE title LIKE #{pattern}</select></mapper>'
        )
        self.assertIn("LEADING_WILDCARD", direct[0]["patterns"])
        self.assertFalse(direct[0]["narrowed"])

        for expression in ("LIKE #{pattern}", "LIKE (#{pattern,jdbcType=VARCHAR})", "LIKE ${pattern}"):
            with self.subTest(expression=expression):
                findings = self.scan(
                    '<mapper><sql id="binding"><bind name="prefix" value="\'%\'"/>'
                    '<bind name="pattern" value="prefix + query + \'%\'"/></sql>'
                    '<select id="search">SELECT * FROM cat_product p <include refid="binding"/>'
                    'WHERE p.title ' + expression + '</select></mapper>'
                )
                self.assertIn("LEADING_WILDCARD", findings[0]["patterns"])
                self.assertFalse(findings[0]["narrowed"])

        for value in ("query + '%'", "'book%' + query"):
            with self.subTest(value=value):
                findings = self.scan(
                    '<mapper><select id="search"><bind name="pattern" value="' + value + '"/>'
                    'SELECT * FROM products WHERE title LIKE #{pattern}</select></mapper>'
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
