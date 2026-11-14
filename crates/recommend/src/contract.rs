//! Cross-language contract tests for the WASM-unavailable fallbacks.
//!
//! `AGENTS.md` makes `crates/recommend` the single authority for colours and
//! copy, yet both front-ends keep a small TypeScript fallback so the first
//! paint still works when the WASM bundle cannot load. Those literals are
//! invisible to the Rust compiler and have already drifted: unknown colours
//! used to fall back to `🌸` / the raw id on the TS side while `color.rs`
//! falls back to the first registered colour.
//!
//! These tests read the TS sources at test time (like the backend's
//! `frontend_memo_contract_matches_backend`) and compare every fallback
//! literal with the Rust function that actually owns the behaviour. They need
//! a full workspace checkout, not just this crate.

use std::fs;

const WEB_RECOMMEND: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/lib/recommend.ts"
);
const MINIPROGRAM_WASM: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/miniprogram/src/utils/wasm.ts"
);

const COLOUR_IDS: [&str; 3] = ["red", "white", "yellow"];
const UNKNOWN_COLOUR: &str = "not-a-registered-colour";

fn read(path: &str) -> String {
    fs::read_to_string(path).unwrap_or_else(|err| {
        panic!("cannot read {path}: {err}; this contract test needs a full workspace checkout")
    })
}

/// Value of a `key: "value"` / `key: 'value'` pair on one source line.
fn field<'a>(line: &'a str, key: &str, quote: char) -> Option<&'a str> {
    let marker = format!("{key}: {quote}");
    let start = line.find(&marker)? + marker.len();
    let rest = &line[start..];
    Some(&rest[..rest.find(quote)?])
}

/// Last quoted literal on a line — the final `?? "…"` fallback branch.
fn last_quoted(line: &str, quote: char) -> Option<&str> {
    line.split(quote).skip(1).step_by(2).last()
}

fn line_containing<'a>(src: &'a str, needle: &str) -> &'a str {
    src.lines()
        .find(|line| line.contains(needle))
        .unwrap_or_else(|| panic!("TS source no longer contains `{needle}`"))
}

#[test]
fn web_colour_fallbacks_match_rust_wasm() {
    let src = read(WEB_RECOMMEND);
    let emojis = line_containing(&src, "const _CE");
    let labels = line_containing(&src, "const _CL");

    for id in COLOUR_IDS {
        let emoji = crate::color::color_emoji(id);
        let label = crate::color::color_label(id);
        assert_eq!(
            field(emojis, id, '"'),
            Some(emoji.as_str()),
            "web _CE fallback for `{id}` drifted from color_emoji"
        );
        assert_eq!(
            field(labels, id, '"'),
            Some(label.as_str()),
            "web _CL fallback for `{id}` drifted from color_label"
        );
    }
}

#[test]
fn miniprogram_colour_fallbacks_match_rust_wasm() {
    let src = read(MINIPROGRAM_WASM);
    let start = src
        .find("const COLOR_FALLBACK")
        .expect("miniprogram COLOR_FALLBACK table is missing");
    let block = &src[start..];
    let end = block.find("];").expect("miniprogram COLOR_FALLBACK table is unterminated");
    let rows: Vec<&str> = block[..end].lines().filter(|line| line.contains("id: '")).collect();

    assert_eq!(
        rows.len(),
        COLOUR_IDS.len(),
        "miniprogram colour table must list exactly the Rust colours"
    );
    for (index, row) in rows.iter().enumerate() {
        let id = field(row, "id", '\'').expect("colour row has no id");
        let label = field(row, "label", '\'').expect("colour row has no label");
        let emoji = field(row, "emoji", '\'').expect("colour row has no emoji");
        assert_eq!(id, COLOUR_IDS[index], "colour id/order drifted");
        assert_eq!(
            label,
            crate::color::color_label(id).as_str(),
            "miniprogram label for `{id}` drifted from color_label"
        );
        assert_eq!(
            emoji,
            crate::color::color_emoji(id).as_str(),
            "miniprogram emoji for `{id}` drifted from color_emoji"
        );
    }
}

#[test]
fn unknown_colour_fallbacks_match_rust_wasm() {
    let rust_emoji = crate::color::color_emoji(UNKNOWN_COLOUR);
    let rust_label = crate::color::color_label(UNKNOWN_COLOUR);

    let web = read(WEB_RECOMMEND);
    let cases_web = [
        ("export function colorEmoji", &rust_emoji),
        ("export function colorLabel", &rust_label),
    ];
    for (needle, expected) in cases_web {
        let line = line_containing(&web, needle);
        assert_eq!(
            last_quoted(line, '"'),
            Some(expected.as_str()),
            "web `{needle}` uses a different unknown-colour fallback than Rust WASM"
        );
    }

    let mp = read(MINIPROGRAM_WASM);
    let cases_mp = [
        ("export function colorEmoji", &rust_emoji),
        ("export function colorLabel", &rust_label),
    ];
    for (needle, expected) in cases_mp {
        let line = line_containing(&mp, needle);
        assert_eq!(
            last_quoted(line, '\''),
            Some(expected.as_str()),
            "miniprogram `{needle}` uses a different unknown-colour fallback than Rust WASM"
        );
    }
}

#[test]
fn web_tip_fallbacks_are_copied_from_rust_authority() {
    let src = read(WEB_RECOMMEND);
    let start = src
        .find("const fallback: Record<TipContext")
        .expect("web getTips fallback table is missing");
    let block = &src[start..];
    let end = block.find("\n  };").expect("web getTips fallback table is unterminated");

    let mut seen: Vec<String> = Vec::new();
    for line in block[..end].lines() {
        if !line.contains(": [{ text: \"") {
            continue;
        }
        let context = line.trim_start().split(':').next().unwrap_or_default().trim();
        let text = field(line, "text", '"').expect("tip row has no text");
        let authoritative: Vec<&str> =
            crate::tips::get_tips_internal(crate::tips::parse_context(context))
                .iter()
                .map(|tip| tip.text)
                .collect();
        assert!(
            authoritative.contains(&text),
            "web fallback tip for `{context}` is not in the Rust authority: {text}"
        );
        seen.push(context.to_string());
    }

    let mut expected = vec!["garden", "home", "login", "plant"];
    seen.sort();
    expected.sort();
    assert_eq!(
        seen, expected,
        "web must provide a Rust-backed fallback tip for every TipContext"
    );
}
