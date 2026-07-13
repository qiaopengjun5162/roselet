import roselet_private_vault.aleo;
program test_roselet_private_vault.aleo;

function test_matching_commitments:
    call roselet_private_vault.aleo/matching_commitments 1field 1field into r0;
    assert.eq r0 true;
    call roselet_private_vault.aleo/matching_commitments 1field 2field into r1;
    not r1 into r2;
    assert.eq r2 true;

constructor:
    assert.eq edition 0u16;
