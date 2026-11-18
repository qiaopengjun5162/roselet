"use client";

/**
 * Minimal consumer of the real membership context, used by the Playwright CT
 * wallet-session test. Kept outside `__tests__` so Jest does not treat it as
 * a suite (it has no tests of its own).
 */
import { MembershipProvider, useMembership } from "@/app/membership-context";

function WalletStatus() {
  const { walletAddress, connectError, connectWallet } = useMembership();
  return (
    <div>
      <button type="button" onClick={() => void connectWallet()}>
        connect-wallet
      </button>
      <output data-testid="wallet-address">{walletAddress ?? "none"}</output>
      <output data-testid="wallet-error">{connectError ?? ""}</output>
    </div>
  );
}

export function WalletSessionFixture() {
  return (
    <MembershipProvider>
      <WalletStatus />
    </MembershipProvider>
  );
}
