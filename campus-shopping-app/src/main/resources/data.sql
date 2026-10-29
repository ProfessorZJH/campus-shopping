INSERT INTO cat_category(code,name) VALUES ('food','食品饮料'),('fruit','水果生鲜'),('stationery','文具图书'),('daily','日用百货'),('digital','数码配件') ON DUPLICATE KEY UPDATE code=code;
INSERT INTO sys_schema_version(version) VALUES(1) ON DUPLICATE KEY UPDATE version=version;
