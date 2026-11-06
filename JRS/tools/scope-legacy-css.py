#!/usr/bin/env python3
"""Copy the legacy HR stylesheets under a .hr-legacy scope for the React shell.

Pages that move from the embedded workspace into the shell keep the exact legacy
look by rendering the legacy markup inside <div class="hr-legacy">. This script
rewrites the legacy rules so they only apply there:

* every selector is prefixed with .hr-legacy; :root, html, body and #content map to
  the scope element itself, and layout properties on those are dropped so the shell
  keeps control of page sizing;
* width breakpoints become container queries on the scope element, because the
  legacy breakpoints were written for the iframe width, which equals the width of
  the shell content area; height breakpoints stay media queries.

Usage: python3 tools/scope-legacy-css.py > jrs-hr-module/client/src/legacy/legacy-scope.css
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
# workspace-ui.css is loaded by the shell too; only its #content-only rules are copied.
SOURCES = ["styles.css", "workspace.css", "embedded.css", "workspace-ui.css"]
SHARED = {"workspace-ui.css"}
SCOPE = ".hr-legacy"
# Descendant rules keep their original specificity, so shared overrides that beat them
# inside the iframe (workspace-ui.css) still beat them in the shell.
PREFIX = ":where(.hr-legacy)"
# Rules written against #content had id-level specificity inside the iframe; this keeps
# it while matching the scope class (the id never exists).
ID_PREFIX = ":is(.hr-legacy, #hr-legacy-scope)"
CONTAINER = "hrlegacy"
ROOT_LAYOUT = {
    "height", "min-height", "max-height", "width", "min-width", "max-width", "flex", "flex-grow",
    "flex-shrink", "flex-basis", "display", "overflow", "overflow-x", "overflow-y",
    "overscroll-behavior", "position", "padding", "margin", "grid-template-columns",
}


def strip_comments(text):
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def split_top(text, sep=","):
    parts, depth, current = [], 0, ""
    for char in text:
        if char in "([":
            depth += 1
        elif char in ")]":
            depth -= 1
        if char == sep and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += char
    parts.append(current)
    return [part.strip() for part in parts if part.strip()]


def parse_blocks(text):
    """Yield (prelude, body) pairs for the top level of a stylesheet."""
    index, length = 0, len(text)
    while index < length:
        start = text.find("{", index)
        if start < 0:
            return
        prelude = text[index:start].strip()
        depth, cursor = 1, start + 1
        while depth and cursor < length:
            if text[cursor] == "{":
                depth += 1
            elif text[cursor] == "}":
                depth -= 1
            cursor += 1
        yield prelude, text[start + 1:cursor - 1]
        index = cursor


def scope_selector(selector):
    """Return (scoped selector, targets the scope element itself)."""
    selector = selector.strip()
    if "#content" in selector:
        tail = selector.split("#content", 1)[1]
        return (ID_PREFIX + tail if tail.strip() else SCOPE), not tail.strip()
    if selector == ":root":
        return SCOPE, True
    match = re.match(r"^(html|body)\b(.*)$", selector)
    if match:
        rest = match.group(2)
        rest = re.sub(r"^\s*body\b", "", rest)
        return (PREFIX + rest if rest.strip() else SCOPE), not rest.strip()
    if selector == "*":
        return PREFIX + " *", False
    return PREFIX + " " + selector, False


def declarations(body, root):
    if not root:
        return body.strip()
    kept = []
    for item in split_top(body, ";"):
        name = item.split(":", 1)[0].strip().lower()
        if name.startswith("--") or name not in ROOT_LAYOUT:
            kept.append(item)
    return ";".join(kept)


def rule(prelude, body, shared=False):
    plain, root = [], []
    for selector in split_top(prelude):
        if selector.startswith("html.fit-") or "#app-shell" in selector or "#login-screen" in selector:
            continue
        if shared and ("#content" not in selector or ".workspace-body" in selector):
            continue
        scoped, is_root = scope_selector(selector)
        (root if is_root else plain).append(scoped)
    out = ""
    if plain:
        out += ",".join(plain) + "{" + body.strip() + "}\n"
    if root:
        kept = declarations(body, True)
        if kept:
            out += ",".join(dict.fromkeys(root)) + "{" + kept + "}\n"
    return out


def condition(query):
    """Split one media query into (container part, media part)."""
    width, other = [], []
    for feature in re.findall(r"\([^)]*\)", query):
        (width if re.search(r"\b(min|max)-width\b", feature) else other).append(feature)
    return " and ".join(width), " and ".join(other)


def media(prelude, body, shared=False):
    queries = split_top(prelude[len("@media"):])
    inner = sheet(body, shared)
    if not inner.strip():
        return ""
    out = ""
    for query in queries:
        width, other = condition(query)
        block = inner
        if other:
            block = "@media " + other + "{\n" + block + "}\n"
        if width:
            block = "@container " + CONTAINER + " " + width + "{\n" + block + "}\n"
        out += block
    return out


def sheet(text, shared=False):
    out = ""
    for prelude, body in parse_blocks(text):
        if prelude.startswith("@media"):
            out += media(prelude, body, shared)
        elif prelude.startswith("@keyframes") or prelude.startswith("@font-face"):
            if not shared:
                out += prelude + "{" + body + "}\n"
        elif prelude.startswith("@"):
            continue
        else:
            out += rule(prelude, body, shared)
    return out


def main():
    out = [
        "/* Generated by tools/scope-legacy-css.py from the legacy HR stylesheets. Do not edit by hand. */\n",
        SCOPE + "{container:" + CONTAINER + "/inline-size}\n",
    ]
    for name in SOURCES:
        source = strip_comments((ROOT / "JRS HR" / "dist" / name).read_text(encoding="utf-8"))
        out.append("/* " + name + " */\n" + sheet(source, name in SHARED))
    sys.stdout.write("".join(out))


if __name__ == "__main__":
    main()
