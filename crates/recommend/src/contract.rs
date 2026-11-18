//! Cross-language contract tests for the WASM-unavailable fallbacks.
//!
//! `AGENTS.md` makes `crates/recommend` the single authority for colours and
//! copy. Both front-ends used to keep their own TypeScript fallback tables,
//! which already drifted twice: unknown colours used to fall back to `🌸` /
//! the raw id, and the plant request body used to emit `anxiety: null` while
//! Rust omits blank fields entirely. The fix was to move every fallback into
//! `packages/core/src/fallbacks.ts` and let both front-ends import it.
//!
//! These tests read that single source at test time (like the backend's
//! `frontend_memo_contract_matches_backend`) and verify:
//!   * its data matches the Rust functions that own the behaviour;
//!   * both front-ends really import it instead of hard-coding literals again;
//!   * the behavioural fallbacks keep the Rust semantics (static markers,
//!     because Rust cannot execute TypeScript).
//!
//! They need a full workspace checkout, not just this crate.

use std::fs;

const CORE_FALLBACKS: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../packages/core/src/fallbacks.ts"
);
const WEB_RECOMMEND: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/lib/recommend.ts"
);
const MINIPROGRAM_WASM: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/miniprogram/src/utils/wasm.ts"
);
const WEB_PLANT_PAGE: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/app/plant/page.tsx"
);
const WEB_GARDEN_PAGE: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/app/garden/page.tsx"
);
const WEB_PROFILE_PAGE: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/app/profile/page.tsx"
);

const COLOUR_IDS: [&str; 3] = ["red", "white", "yellow"];
const UNKNOWN_COLOUR: &str = "not-a-registered-colour";

fn read(path: &str) -> String {
    fs::read_to_string(path).unwrap_or_else(|err| {
        panic!("cannot read {path}: {err}; this contract test needs a full workspace checkout")
    })
}

/// Value of a `key: "value"` pair on one source line.
fn field<'a>(line: &'a str, key: &str, quote: char) -> Option<&'a str> {
    let marker = format!("{key}: {quote}");
    let start = line.find(&marker)? + marker.len();
    let rest = &line[start..];
    Some(&rest[..rest.find(quote)?])
}

fn line_containing<'a>(src: &'a str, needle: &str) -> &'a str {
    src.lines()
        .find(|line| line.contains(needle))
        .unwrap_or_else(|| panic!("TS source no longer contains `{needle}`"))
}

fn block_between<'a>(src: &'a str, start_marker: &str, end_marker: &str) -> &'a str {
    let start = src
        .find(start_marker)
        .unwrap_or_else(|| panic!("TS source no longer contains `{start_marker}`"));
    let rest = &src[start..];
    let end = rest
        .find(end_marker)
        .unwrap_or_else(|| panic!("`{start_marker}` block is unterminated"));
    &rest[..end]
}

#[test]
fn shared_colour_fallbacks_match_rust_wasm() {
    let src = read(CORE_FALLBACKS);

    let table = block_between(&src, "export const COLOR_FALLBACK", "];");
    let rows: Vec<&str> = table.lines().filter(|line| line.contains("id: \"")).collect();
    assert_eq!(
        rows.len(),
        COLOUR_IDS.len(),
        "shared colour table must list exactly the Rust colours"
    );
    for (index, row) in rows.iter().enumerate() {
        let id = field(row, "id", '"').expect("colour row has no id");
        let label = field(row, "label", '"').expect("colour row has no label");
        let emoji = field(row, "emoji", '"').expect("colour row has no emoji");
        let rust_label = crate::color::color_label(id);
        let rust_emoji = crate::color::color_emoji(id);
        assert_eq!(id, COLOUR_IDS[index], "colour id/order drifted");
        assert_eq!(
            label,
            rust_label.as_str(),
            "shared label for `{id}` drifted from color_label"
        );
        assert_eq!(
            emoji,
            rust_emoji.as_str(),
            "shared emoji for `{id}` drifted from color_emoji"
        );
    }

    let emojis = line_containing(&src, "export const COLOR_EMOJI_FALLBACK");
    let labels = line_containing(&src, "export const COLOR_LABEL_FALLBACK");
    for id in COLOUR_IDS {
        let rust_emoji = crate::color::color_emoji(id);
        let rust_label = crate::color::color_label(id);
        assert_eq!(
            field(emojis, id, '"'),
            Some(rust_emoji.as_str()),
            "COLOR_EMOJI_FALLBACK for `{id}` drifted from color_emoji"
        );
        assert_eq!(
            field(labels, id, '"'),
            Some(rust_label.as_str()),
            "COLOR_LABEL_FALLBACK for `{id}` drifted from color_label"
        );
    }
}

#[test]
fn unknown_colour_fallback_is_derived_from_first_registered_colour() {
    let src = read(CORE_FALLBACKS);
    // color.rs `find()` returns COLORS[0] for unknown ids. Deriving the
    // fallback from the shared table makes a third hand-written literal
    // impossible.
    assert!(
        src.contains("UNKNOWN_COLOR_EMOJI_FALLBACK = COLOR_FALLBACK[0].emoji"),
        "unknown emoji fallback must be derived from the first shared colour"
    );
    assert!(
        src.contains("UNKNOWN_COLOR_LABEL_FALLBACK = COLOR_FALLBACK[0].label"),
        "unknown label fallback must be derived from the first shared colour"
    );

    let first = line_containing(&src, "{ id: \"red\"");
    let rust_emoji = crate::color::color_emoji(UNKNOWN_COLOUR);
    let rust_label = crate::color::color_label(UNKNOWN_COLOUR);
    assert_eq!(
        field(first, "emoji", '"'),
        Some(rust_emoji.as_str()),
        "first shared colour emoji differs from the Rust unknown-colour fallback"
    );
    assert_eq!(
        field(first, "label", '"'),
        Some(rust_label.as_str()),
        "first shared colour label differs from the Rust unknown-colour fallback"
    );
}

#[test]
fn shared_tip_fallbacks_are_copied_from_rust_authority() {
    let src = read(CORE_FALLBACKS);
    let block = block_between(&src, "export const TIP_FALLBACKS", "\n};");

    let mut seen: Vec<String> = Vec::new();
    for line in block.lines() {
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
            "shared fallback tip for `{context}` is not in the Rust authority: {text}"
        );
        seen.push(context.to_string());
    }

    let mut expected = vec!["garden", "home", "login", "plant"];
    seen.sort();
    expected.sort();
    assert_eq!(
        seen, expected,
        "shared package must provide a Rust-backed fallback tip for every TipContext"
    );
}

#[test]
fn frontends_import_shared_fallbacks() {
    for path in [WEB_RECOMMEND, MINIPROGRAM_WASM] {
        let src = read(path);
        assert!(
            src.contains("from \"@roselet/core\"") || src.contains("from '@roselet/core'"),
            "{path} must import @roselet/core for its WASM-unavailable fallbacks"
        );
        for literal in ["🌹", "🤍", "💛", "红玫瑰", "白玫瑰", "黄玫瑰"] {
            assert!(
                !src.contains(literal),
                "{path} hard-codes `{literal}` instead of importing the shared fallback"
            );
        }
        for old_table in ["const _CE", "const _CL", "const COLOR_FALLBACK"] {
            assert!(
                !src.contains(old_table),
                "{path} still declares a local colour table (`{old_table}`)"
            );
        }
    }
}

#[test]
fn shared_behaviour_fallbacks_keep_rust_semantics() {
    let src = read(CORE_FALLBACKS);

    // api_client.rs build_garden_url skips an "all" filter.
    assert!(
        src.contains("color !== \"all\""),
        "buildGardenUrlFallback must skip the `all` filter like Rust does"
    );
    // api_client.rs build_plant_body skips blank Option fields; it never emits
    // an explicit null. The TS side has dedicated jest tests with the same
    // expected strings (apps/web/src/lib/__tests__/core-fallbacks.test.ts).
    for marker in [
        "if (input.gratitude)",
        "if (input.anxiety)",
        "if (input.hope)",
        "if (input.is_private)",
        "if (input.recipient_nickname)",
    ] {
        assert!(
            src.contains(marker),
            "buildPlantBodyFallback lost the blank-field guard `{marker}`"
        );
    }
    assert!(
        !src.contains("?? null"),
        "buildPlantBodyFallback must not re-introduce explicit null fields"
    );
    // audio.rs playback_policy_internal
    assert!(
        src.contains("input.background_playing && input.starting === \"foreground\""),
        "audioPlaybackPolicyFallback drifted from playback_policy_internal"
    );

    // Pin the Rust side of the very same expectations.
    let client = crate::api_client::ApiClient::new("http://x".to_string());
    assert_eq!(
        client.build_garden_url(2, 10, Some("all")),
        "http://x/api/garden?page=2&per_page=10"
    );
    assert_eq!(
        client.build_plant_body("red", Some("g"), None, None, true, None),
        "{\"color\":\"red\",\"gratitude\":\"g\",\"is_private\":true}"
    );
    let policy = crate::audio::playback_policy_internal(&crate::audio::PlaybackPolicyInput {
        starting: crate::audio::AudioSource::Foreground,
        background_playing: true,
    });
    assert!(policy.stop_background);
}

#[test]
fn web_ui_pages_use_shared_colour_metadata() {
    // The plant / garden / profile pages used to keep a fourth, fifth and
    // sixth copy of the colour table (ids, labels and emojis), plus a ternary
    // that mapped a recommended colour to a hard-coded Chinese label. They now
    // compose UI-only styles on top of `@roselet/core`.
    //
    // `🌹` is intentionally NOT checked on the plant page: it is also the icon
    // for the "gratitude" input field, which is unrelated to colour metadata.
    // The shared table itself is pinned to Rust by the tests above.
    for (name, path) in [
        ("plant page", WEB_PLANT_PAGE),
        ("garden page", WEB_GARDEN_PAGE),
        ("profile page", WEB_PROFILE_PAGE),
    ] {
        let src = read(path);
        assert!(
            src.contains("from \"@roselet/core\"") || src.contains("from '@roselet/core'"),
            "{name} must import @roselet/core for its colour metadata"
        );
        for literal in ["红玫瑰", "白玫瑰", "黄玫瑰", "🤍", "💛"] {
            assert!(
                !src.contains(literal),
                "{name} hard-codes `{literal}` instead of using the shared colour table"
            );
        }
        for table_marker in ["id: \"red\"", "id: \"white\"", "id: \"yellow\"", "const COLORS = ["] {
            assert!(
                !src.contains(table_marker),
                "{name} still declares a local colour table (`{table_marker}`)"
            );
        }
    }
}
