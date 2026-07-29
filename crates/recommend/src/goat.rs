use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Deserialize)]
pub struct GoatOrderReferenceInput {
    pub reflection: serde_json::Value,
    pub payer: String,
    pub chain_id: u64,
    pub token_symbol: String,
    pub token_contract: String,
    pub amount_wei: String,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct GoatOrderReference {
    pub dapp_order_id: String,
    pub payer: String,
    pub chain_id: u64,
    pub token_symbol: String,
    pub token_contract: String,
    pub amount_wei: String,
}

pub fn build_order_reference(input_json: &str) -> Result<GoatOrderReference, String> {
    let input: GoatOrderReferenceInput = serde_json::from_str(input_json)
        .map_err(|_| "invalid order reference input".to_string())?;

    if !input.reflection.is_object() {
        return Err("reflection must be a JSON object".into());
    }
    if input.chain_id == 0 {
        return Err("chain_id must be a positive integer".into());
    }
    let payer = normalize_evm_address("payer", &input.payer)?;
    let token_contract = normalize_evm_address("token_contract", &input.token_contract)?;
    let token_symbol = input.token_symbol.trim().to_ascii_uppercase();
    if token_symbol.is_empty() {
        return Err("token_symbol is required".into());
    }
    let amount_wei = normalize_amount_wei(&input.amount_wei)?;
    // serde_json 默认使用 BTreeMap（键排序），序列化结果天然是规范 JSON，保证哈希确定。
    let reflection =
        serde_json::to_string(&input.reflection).map_err(|_| "invalid reflection".to_string())?;

    let mut hasher = Sha256::new();
    hasher.update(b"roselet-goat-x402-v1\0");
    for part in [
        reflection.as_str(),
        payer.as_str(),
        token_symbol.as_str(),
        token_contract.as_str(),
        amount_wei.as_str(),
    ] {
        hasher.update(part.as_bytes());
        hasher.update(b"\0");
    }
    hasher.update(input.chain_id.to_string().as_bytes());

    let digest = hasher.finalize();
    let dapp_order_id = format!(
        "0x{}",
        digest.iter().map(|byte| format!("{byte:02x}")).collect::<String>()
    );

    Ok(GoatOrderReference {
        dapp_order_id,
        payer,
        chain_id: input.chain_id,
        token_symbol,
        token_contract,
        amount_wei,
    })
}

fn normalize_evm_address(field: &str, value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    let invalid = || format!("{field} must be a 0x-prefixed EVM address");
    let Some(hex_digits) = trimmed.strip_prefix("0x") else {
        return Err(invalid());
    };
    if hex_digits.len() != 40 || !hex_digits.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(invalid());
    }
    Ok(format!("0x{}", hex_digits.to_ascii_lowercase()))
}

fn normalize_amount_wei(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || !trimmed.chars().all(|c| c.is_ascii_digit()) {
        return Err("amount_wei must be a positive integer".into());
    }
    let normalized = trimmed.trim_start_matches('0');
    if normalized.is_empty() {
        return Err("amount_wei must be a positive integer".into());
    }
    Ok(normalized.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const PAYER: &str = "0x1111111111111111111111111111111111111111";
    const CONTRACT: &str = "0x2222222222222222222222222222222222222222";

    fn input_json() -> String {
        format!(
            r#"{{"reflection":{{"color":"red","gratitude":"thanks"}},"payer":"{PAYER}","chain_id":48816,"token_symbol":"USDC","token_contract":"{CONTRACT}","amount_wei":"1000"}}"#
        )
    }

    #[test]
    fn builds_deterministic_domain_separated_reference() {
        let first = build_order_reference(&input_json()).unwrap();
        let second = build_order_reference(&input_json()).unwrap();

        assert_eq!(first, second);
        assert!(first.dapp_order_id.starts_with("0x"));
        assert_eq!(first.dapp_order_id.len(), 66);
    }

    #[test]
    fn normalizes_equivalent_payment_fields_to_same_reference() {
        let baseline = build_order_reference(&input_json()).unwrap();
        let equivalent = build_order_reference(&format!(
            r#"{{"reflection":{{"gratitude":"thanks","color":"red"}},"payer":"0x1111111111111111111111111111111111111111","chain_id":48816,"token_symbol":"usdc","token_contract":"0x2222222222222222222222222222222222222222","amount_wei":"01000"}}"#
        ))
        .unwrap();

        assert_eq!(baseline, equivalent);
    }

    #[test]
    fn binds_reference_to_each_field() {
        let baseline = build_order_reference(&input_json()).unwrap();
        let other_reflection =
            build_order_reference(&input_json().replace("thanks", "changed")).unwrap();
        let other_amount = build_order_reference(&input_json().replace("1000", "1001")).unwrap();

        assert_ne!(baseline.dapp_order_id, other_reflection.dapp_order_id);
        assert_ne!(baseline.dapp_order_id, other_amount.dapp_order_id);
    }

    #[test]
    fn rejects_invalid_payment_fields() {
        assert!(build_order_reference(&input_json().replace(PAYER, "not-an-address")).is_err());
        assert!(build_order_reference(&input_json().replace(CONTRACT, "0x1234")).is_err());
        assert!(build_order_reference(&input_json().replace("1000", "0")).is_err());
        assert!(build_order_reference(&input_json().replace("1000", "10.5")).is_err());
        assert!(build_order_reference(&input_json().replace("48816", "0")).is_err());
        assert!(build_order_reference(&input_json().replace("USDC", "")).is_err());
        assert!(
            build_order_reference(r#"{"reflection":[],"payer":"0x1111111111111111111111111111111111111111","chain_id":48816,"token_symbol":"USDC","token_contract":"0x2222222222222222222222222222222222222222","amount_wei":"1000"}"#)
                .is_err()
        );
        assert!(build_order_reference("{").is_err());
    }
}
