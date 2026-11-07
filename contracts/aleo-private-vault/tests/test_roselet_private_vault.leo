import roselet_private_vault.aleo;

program test_roselet_private_vault.aleo {
    @test
    fn test_matching_commitments() {
        assert(roselet_private_vault.aleo::matching_commitments(1field, 1field));
        assert(!roselet_private_vault.aleo::matching_commitments(1field, 2field));
    }

    @noupgrade
    constructor() {}
}
