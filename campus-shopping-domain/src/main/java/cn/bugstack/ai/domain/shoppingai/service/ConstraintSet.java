package cn.bugstack.ai.domain.shoppingai.service;

import cn.bugstack.ai.domain.shoppingai.model.valobj.ProposalItemVO;
import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Pattern;

/** 用户原文的可执行约束；远程模型不能补写、放宽预算或购买数量。 */
public record ConstraintSet(SkuConstraintPolicy.Constraints specs, Long budgetCent, Integer requestedQuantity, boolean clarification) {
    private static final String DIGITS = "零〇一二两三四五六七八九十百千万";
    private static final String NUMBER = "[\\d" + DIGITS + "点.]+";
    private static final String UNIT = "[个件份瓶盒包本支杯袋斤]";
    private static final Pattern FOLLOWUP = Pattern.compile("这个|那个|它|换一个|换一款|便宜点|贵一点|还有别的|类似的|这些");
    private static final Pattern QUANTITY = Pattern.compile("(?<![\\d." + DIGITS + "])(\\d+(?:\\.\\d+)?|[" + DIGITS + "]+)\\s*" + UNIT);
    private static final String UNCERTAIN = "(?:[" + DIGITS + "\\d]*[几多来余]|[" + DIGITS + "\\d]+\\s*[到至~-]\\s*[" + DIGITS + "\\d]+)\\s*";

    private record Intent(Long value, boolean specified, boolean invalid) {}

    public static ConstraintSet resolve(String question, List<String> history, List<ProposalItemVO> quotes) {
        Intent budget = budget(question),
            quantity = quantity(question);
        if (FOLLOWUP.matcher(question).find()) {
            for (int i = history.size() - 1; i >= 0; i--) {
                String previous = history.get(i);
                if (!budget.specified()) budget = budget(previous);
                if (!quantity.specified()) quantity = quantity(previous);
                if (!FOLLOWUP.matcher(previous).find()) break;
            }
        }
        var specs = SkuConstraintPolicy.resolve(
            question,
            history,
            quotes.stream().map(ProposalItemVO::specKey).toList(),
            quotes.stream().map(ProposalItemVO::title).toList()
        );
        return new ConstraintSet(
            specs,
            budget.value(),
            quantity.value() == null ? null : quantity.value().intValue(),
            budget.invalid() || quantity.invalid() || specs.ambiguous()
        );
    }

    private static Intent budget(String text) {
        boolean marker = Pattern.compile("预算|不超过|最多|不到|上限|(?:元|块)\\s*(?:以内|以下|左右)").matcher(text).find();
        if (
            marker &&
            Pattern.compile(UNCERTAIN + "(?:元|块)")
                .matcher(text)
                .find()
        ) return new Intent(null, true, true);
        Set<Long> amounts = new HashSet<>();
        for (String expression : new String[] {
            "(?:预算|上限)\\s*(" + NUMBER + ")\\s*(?:元|块)?",
            "(?:不超过|最多|不到)\\s*(" + NUMBER + ")\\s*(?:元|块)",
            "(" + NUMBER + ")\\s*(?:元|块)\\s*(?:以内|以下|左右)",
        }) {
            var matches = Pattern.compile(expression).matcher(text);
            while (matches.find()) {
                try {
                    long cents = amount(matches.group(1)).movePointRight(2).longValueExact();
                    if (cents < 0 || cents > 100000000) return new Intent(null, true, true);
                    amounts.add(cents);
                } catch (ArithmeticException | IllegalArgumentException error) {
                    return new Intent(null, true, true);
                }
            }
        }
        return amounts.size() == 1 ? new Intent(amounts.iterator().next(), true, false) : new Intent(null, marker, marker);
    }

    private static BigDecimal amount(String raw) {
        if (raw.matches("\\d+(?:\\.\\d{1,2})?")) return new BigDecimal(raw);
        if (!raw.matches("[" + DIGITS + "]+(?:点[零〇一二两三四五六七八九]{1,2})?")) throw new IllegalArgumentException();
        String[] parts = raw.split("点", -1);
        String fraction = "";
        if (parts.length == 2) for (char c : parts[1].toCharArray()) fraction += integer(Character.toString(c));
        return new BigDecimal(integer(parts[0]) + (fraction.isEmpty() ? "" : "." + fraction));
    }

    private static long integer(String raw) {
        long total = 0,
            section = 0,
            number = 0;
        String digits = "零一二三四五六七八九";
        for (char c : raw.replace('〇', '零').replace('两', '二').toCharArray()) {
            int digit = digits.indexOf(c);
            if (digit >= 0) number = digit;
            else if (c == '万') {
                total = Math.addExact(total, Math.multiplyExact(Math.addExact(section, number), 10000));
                section = number = 0;
            } else {
                long unit = switch (c) {
                    case '十' -> 10;
                    case '百' -> 100;
                    case '千' -> 1000;
                    default -> throw new IllegalArgumentException();
                };
                section = Math.addExact(section, Math.multiplyExact(number == 0 ? 1 : number, unit));
                number = 0;
            }
        }
        return Math.addExact(total, Math.addExact(section, number));
    }

    private static Intent quantity(String text) {
        text = text.replaceAll("换一个|换一款|还有一个选择", "");
        if (
            Pattern.compile(UNCERTAIN + UNIT)
                .matcher(text)
                .find()
        ) return new Intent(null, true, true);
        var matches = QUANTITY.matcher(text);
        Long value = null;
        while (matches.find()) {
            if (value != null) return new Intent(null, true, true);
            try {
                String raw = matches.group(1);
                value = raw.matches("\\d+") ? Long.parseLong(raw) : integer(raw);
            } catch (ArithmeticException | IllegalArgumentException error) {
                return new Intent(null, true, true);
            }
            if (value < 1 || value > 99) return new Intent(null, true, true);
        }
        return new Intent(value, value != null, false);
    }
}
