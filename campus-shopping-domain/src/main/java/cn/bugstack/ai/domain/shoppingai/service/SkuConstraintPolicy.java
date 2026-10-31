package cn.bugstack.ai.domain.shoppingai.service;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/** 原文规格策略；Python与Java独立执行同一行为契约，远程结果不能放宽要求。 */
public final class SkuConstraintPolicy {

    private static final String NEGATIVE =
        "不要推荐|不想要|不想选|不想买|不需要|不要选|不推荐|不接受|不喜欢|不要|不选|不买|不用|别推荐|别选|别买|排除|不考虑|不含|不是|拒绝|非";
    private static final String CUES = NEGATIVE + "|只要|想要|规格为|规格是|要|选择|选|换成|改成|改为";
    private static final Pattern FOLLOWUP = Pattern.compile("这个|那个|它|换一个|换一款|便宜点|贵一点|还有别的|类似的|这些");

    private SkuConstraintPolicy() {}

    private static String normalize(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    }

    private static Set<String> values(String spec) {
        Set<String> result = new HashSet<>();
        for (String part : normalize(spec).split("[,，;；/|、]")) {
            if (!part.isEmpty()) result.add(part.substring(part.lastIndexOf(':') + 1));
        }
        return result;
    }

    private static String dimension(String term) {
        if (term.endsWith("装")) return "pack";
        if (term.endsWith("色")) return "color";
        if (term.endsWith("杯")) return "cup";
        if (term.endsWith("号") || term.endsWith("型")) return "size";
        for (String[] axis : new String[][] { { "ml|l", "volume" }, { "kg|g", "mass" }, { "cm|mm", "length" }, { "码", "size" } }) {
            if (term.matches("\\d+(?:\\.\\d+)?(?:" + axis[0] + ")")) return axis[1];
        }
        return "spec";
    }

    public record Constraints(Set<String> required, Set<String> forbidden, boolean ambiguous) {
        public boolean active() {
            return ambiguous || !required.isEmpty() || !forbidden.isEmpty();
        }

        public boolean accepts(String spec) {
            Set<String> actual = values(spec);
            return (
                !ambiguous &&
                actual.containsAll(required) &&
                Collections.disjoint(actual, forbidden) &&
                forbidden.stream().allMatch(term -> actual.stream().anyMatch(v -> dimension(v).equals(dimension(term))))
            );
        }
    }

    private static Constraints extract(String question, Set<String> vocabulary, List<String> titles) {
        String text = normalize(question);
        Set<String> terms = new HashSet<>(vocabulary);
        var numeric = Pattern.compile("(?<![a-z0-9.])\\d+(?:\\.\\d+)?(?:ml|kg|cm|mm|l|g|码)(?![a-z0-9.])").matcher(text);
        while (numeric.find()) terms.add(numeric.group());
        var explicit = Pattern.compile("(?<!需)(?:" + CUES + ")([^,，。;；!?？]{1,40})").matcher(text);
        while (explicit.find()) {
            String token = explicit.group(1).split(CUES, -1)[0];
            String originalToken = token;
            token = token.replaceAll("^[0-9一二两三四五六七八九十]+(?:个|件|份|瓶|盒|包|本|支|杯|袋)", "");
            String quantityTail = token;
            boolean startsAttribute =
                vocabulary.stream().anyMatch(quantityTail::startsWith) ||
                Pattern.compile("^.{1,2}?(?:装|色|码|杯|号|型)|^\\d+(?:\\.\\d+)?(?:ml|kg|cm|mm|l|g)").matcher(token).find();
            if (!originalToken.equals(token) && !startsAttribute) continue;
            for (String title : titles) {
                int at = token.indexOf(normalize(title));
                if (at >= 0) token = token.substring(0, at);
            }
            token = token.replaceAll("的+$", "");
            String atoms = vocabulary
                .stream()
                .sorted(
                    Comparator.comparingInt(String::length)
                        .reversed()
                        .thenComparing(v -> v)
                )
                .map(Pattern::quote)
                .collect(java.util.stream.Collectors.joining("|"));
            String atomPattern = (atoms.isEmpty() ? "" : atoms + "|") + "\\d+(?:\\.\\d+)?(?:ml|kg|cm|mm|l|g|码)|.{1,12}?(?:装|色|码|杯|号|型)";
            var attribute = Pattern.compile(atomPattern).matcher(token);
            int cursor = 0;
            while (attribute.find()) {
                String value = attribute.group().replaceAll("^(?:和|及|与|并且|同时|的|也)+", "");
                if (!value.isEmpty()) terms.add(value);
                cursor = attribute.end();
            }
            String remainder = token.substring(cursor).replaceAll("^(?:和|及|与|并且|同时|的|也)+", "");
            boolean productName = titles.stream().anyMatch(title -> !remainder.isEmpty() && normalize(title).contains(remainder));
            if (
                !remainder.isEmpty() &&
                !productName &&
                (explicit.group().startsWith("规格为") ||
                    explicit.group().startsWith("规格是") ||
                    (explicit.group().matches("^(?:只要|要|换成|改成|改为).*") && remainder.length() <= 8))
            ) terms.add(remainder);
        }
        Set<String> required = new HashSet<>(),
            forbidden = new HashSet<>();
        boolean ambiguous = Pattern.compile("不是不要|并非不要").matcher(text).find();
        if (terms.isEmpty()) return new Constraints(Set.of(), Set.of(), ambiguous);
        String pattern = terms
            .stream()
            .sorted(
                Comparator.comparingInt(String::length)
                    .reversed()
                    .thenComparing(v -> v)
            )
            .map(Pattern::quote)
            .collect(java.util.stream.Collectors.joining("|"));
        var matches = Pattern.compile(pattern).matcher(text);
        while (matches.find()) {
            String term = matches.group(),
                prefix = text.substring(0, matches.start()),
                suffix = text.substring(matches.end());
            if (term.matches("[\\x00-\\x7f]+") && (prefix.matches(".*[a-z0-9.]$") || suffix.matches("^[a-z0-9.].*"))) continue;
            String[] clauses = prefix.split("[,，。;；!?？]|但是|而是", -1);
            var cues = Pattern.compile(CUES).matcher(clauses[clauses.length - 1]);
            String cue = "";
            while (cues.find()) cue = cues.group();
            boolean negative = cue.matches(NEGATIVE) || suffix.matches("^(?:不要|不选|不考虑)(?:[,，。;；!?？]|$).*");
            if (suffix.split("[,，。;；!?？]", -1)[0].matches(".*都(?:不要|不选|不考虑)$")) negative = true;
            (negative ? forbidden : required).add(term);
        }
        return new Constraints(Set.copyOf(required), Set.copyOf(forbidden), ambiguous || !Collections.disjoint(required, forbidden));
    }

    /** history仅含按时间排序的用户消息；新规格替换同维度历史约束。 */
    public static Constraints resolve(String question, List<String> history, List<String> specs, List<String> titles) {
        Set<String> vocabulary = new HashSet<>();
        specs.forEach(s ->
            values(s)
                .stream()
                .filter(v -> v.length() >= 2)
                .forEach(vocabulary::add)
        );
        List<String> sortedTitles = titles.stream().sorted(Comparator.comparingInt(String::length).reversed()).toList();
        Constraints current = extract(question, vocabulary, sortedTitles);
        Set<String> required = new HashSet<>(current.required()),
            forbidden = new HashSet<>(current.forbidden()),
            axes = new HashSet<>();
        required.forEach(v -> axes.add(dimension(v)));
        forbidden.forEach(v -> axes.add(dimension(v)));
        boolean ambiguous = current.ambiguous();
        if (FOLLOWUP.matcher(question).find()) {
            for (int i = history.size() - 1; i >= 0; i--) {
                var inherited = extract(history.get(i), vocabulary, sortedTitles);
                Set<String> newAxes = new HashSet<>();
                inherited.required().forEach(v -> newAxes.add(dimension(v)));
                inherited.forbidden().forEach(v -> newAxes.add(dimension(v)));
                newAxes.removeAll(axes);
                inherited
                    .required()
                    .stream()
                    .filter(v -> newAxes.contains(dimension(v)))
                    .forEach(required::add);
                inherited
                    .forbidden()
                    .stream()
                    .filter(v -> newAxes.contains(dimension(v)))
                    .forEach(forbidden::add);
                if (!newAxes.isEmpty()) ambiguous |= inherited.ambiguous();
                axes.addAll(newAxes);
                if (!FOLLOWUP.matcher(history.get(i)).find()) break;
            }
        }
        return new Constraints(Set.copyOf(required), Set.copyOf(forbidden), ambiguous);
    }
}
