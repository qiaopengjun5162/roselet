program roselet_private_vault.aleo;

record PrivateRose:
    owner as address.private;
    rose_id as field.private;
    content_commitment as field.private;
    ai_reply_commitment as field.private;
    share_key as field.private;

record RoseShare:
    owner as address.private;
    rose_id as field.private;
    content_commitment as field.private;
    share_key as field.private;

function plant_private_rose:
    input r0 as field.private;
    input r1 as field.private;
    input r2 as field.private;
    input r3 as field.private;
    cast self.signer r0 r1 r2 r3 into r4 as PrivateRose.record;
    output r4 as PrivateRose.record;

function rotate_share_key:
    input r0 as PrivateRose.record;
    input r1 as field.private;
    assert.eq r0.owner self.signer;
    cast r0.owner r0.rose_id r0.content_commitment r0.ai_reply_commitment r1 into r2 as PrivateRose.record;
    output r2 as PrivateRose.record;

function share_private_rose:
    input r0 as PrivateRose.record;
    input r1 as address.private;
    assert.eq r0.owner self.signer;
    cast r0.owner r0.rose_id r0.content_commitment r0.ai_reply_commitment r0.share_key into r2 as PrivateRose.record;
    cast r1 r0.rose_id r0.content_commitment r0.share_key into r3 as RoseShare.record;
    output r2 as PrivateRose.record;
    output r3 as RoseShare.record;

function matching_commitments:
    input r0 as field.private;
    input r1 as field.private;
    is.eq r0 r1 into r2;
    output r2 as boolean.private;

constructor:
    assert.eq edition 0u16;
