/**
 * Stamps a Seller's interview-identity verification as 'verified' on the back
 * of an admin-driven grant of the 'seller' role itself (Users > change role,
 * or approving a seller application) — admin directly authorizing someone as
 * a seller is treated as sufficient trust to also list their Mock Interview
 * profile, without requiring a separate ID-upload + Verifications approval.
 * Does not downgrade an existing 'verified'/'rejected' status's timestamps
 * needlessly, but always ensures the end state is 'verified'.
 */
export async function verifySellerForAdminGrant(seller, adminId) {
    if (seller.verification?.status === 'verified') return;
    seller.verification.status = 'verified';
    seller.verification.verifiedAt = new Date();
    seller.verification.verifiedBy = adminId;
    seller.verification.rejectionReason = '';
    await seller.save();
}
