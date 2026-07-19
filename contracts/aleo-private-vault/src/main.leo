program roselet_private_vault.aleo {
    @noupgrade
    constructor() {}

    record PrivateRose {
        owner: address,
        rose_id: field,
        content_commitment: field,
        ai_reply_commitment: field,
        share_key: field,
    }

    record RoseShare {
        owner: address,
        rose_id: field,
        content_commitment: field,
        share_key: field,
    }

    fn plant_private_rose(
        rose_id: field,
        content_commitment: field,
        ai_reply_commitment: field,
        share_key: field,
    ) -> PrivateRose {
        return PrivateRose {
            owner: self.signer,
            rose_id,
            content_commitment,
            ai_reply_commitment,
            share_key,
        };
    }

    fn rotate_share_key(
        private rose: PrivateRose,
        new_share_key: field,
    ) -> PrivateRose {
        assert_eq(rose.owner, self.signer);
        return PrivateRose {
            owner: rose.owner,
            rose_id: rose.rose_id,
            content_commitment: rose.content_commitment,
            ai_reply_commitment: rose.ai_reply_commitment,
            share_key: new_share_key,
        };
    }

    fn share_private_rose(
        private rose: PrivateRose,
        recipient: address,
    ) -> (PrivateRose, RoseShare) {
        assert_eq(rose.owner, self.signer);
        let retained_rose: PrivateRose = PrivateRose {
            owner: rose.owner,
            rose_id: rose.rose_id,
            content_commitment: rose.content_commitment,
            ai_reply_commitment: rose.ai_reply_commitment,
            share_key: rose.share_key,
        };
        let share: RoseShare = RoseShare {
            owner: recipient,
            rose_id: rose.rose_id,
            content_commitment: rose.content_commitment,
            share_key: rose.share_key,
        };
        return (retained_rose, share);
    }

    fn matching_commitments(left: field, right: field) -> bool {
        return left == right;
    }
}
