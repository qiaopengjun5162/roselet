use serde::Serialize;
use sha2::{Digest, Sha256};

#[derive(Debug, PartialEq, Serialize)]
pub struct VaultInputs {
    pub rose_id: String,
    pub content_commitment: String,
    pub ai_reply_commitment: String,
    pub share_key: String,
}

pub fn build_vault_inputs(
    rose_id: &str,
    content: &str,
    ai_reply: &str,
    nonce: &str,
) -> Result<VaultInputs, String> {
    if rose_id.trim().is_empty() || content.trim().is_empty() || nonce.trim().is_empty() {
        return Err("rose_id, content and nonce are required".into());
    }

    Ok(VaultInputs {
        rose_id: commitment("rose-id", rose_id.trim()),
        content_commitment: commitment("content", content.trim()),
        ai_reply_commitment: commitment("ai-reply", ai_reply.trim()),
        share_key: commitment("share-key", nonce.trim()),
    })
}

fn commitment(domain: &str, value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"roselet-aleo-v1\0");
    hasher.update(domain.as_bytes());
    hasher.update(b"\0");
    hasher.update(value.as_bytes());
    let digest = hasher.finalize();
    let value = u128::from_be_bytes(digest[..16].try_into().expect("SHA-256 prefix length"));
    format!("{value}field")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_stable_domain_separated_fields() {
        let first =
            build_vault_inputs("rose-1", "private note", "gentle reply", "nonce-1").unwrap();
        let second =
            build_vault_inputs("rose-1", "private note", "gentle reply", "nonce-1").unwrap();

        assert_eq!(first, second);
        assert!(first.rose_id.ends_with("field"));
        assert_ne!(first.content_commitment, first.ai_reply_commitment);
        assert_ne!(first.content_commitment, first.share_key);
    }

    #[test]
    fn rejects_missing_private_inputs() {
        assert!(build_vault_inputs("", "note", "reply", "nonce").is_err());
        assert!(build_vault_inputs("rose", "", "reply", "nonce").is_err());
        assert!(build_vault_inputs("rose", "note", "reply", "").is_err());
    }
}
