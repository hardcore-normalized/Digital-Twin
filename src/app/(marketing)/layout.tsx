import Link from "next/link";
import { Logo } from "@/components/logo";
import { DownloadButton, StarButton } from "@/components/github-cta";
import { ButtonLink } from "@/components/ui";
import { getStarCount } from "@/lib/github";
import { DEMO_PATH, GITHUB_URL, GUIDE_URL, isWebsiteOnly } from "@/lib/site-mode";

async function currentUser() {
  // The public website has no database, so never look up a session there.
  if (isWebsiteOnly()) return null;
  const { getCurrentUser } = await import("@/lib/access");
  return getCurrentUser();
}

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const websiteOnly = isWebsiteOnly();
  const [user, stars] = await Promise.all([currentUser(), getStarCount()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-text-2 lg:flex">
            <Link href="/#how" className="hover:text-text">How it works</Link>
            <Link href="/#twins" className="hover:text-text">Digital twins</Link>
            {websiteOnly && <Link href={DEMO_PATH} className="hover:text-text">Live demo</Link>}
            <Link href="/#download" className="hover:text-text">Download</Link>
            <Link href="/security" className="hover:text-text">Security</Link>
            <Link href="/docs/storage-api" className="hover:text-text">Docs</Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex">
              <StarButton count={stars} size="sm" label="Star" />
            </span>
            {websiteOnly ? (
              <DownloadButton size="sm" label="Download" />
            ) : user ? (
              <ButtonLink href="/app" size="sm">Open dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/sign-in" variant="ghost" size="sm">Sign in</ButtonLink>
                <ButtonLink href="/sign-up" size="sm">Get started</ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div
          className={`mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-text-2 sm:px-6 ${websiteOnly ? "sm:grid-cols-[1fr_auto_auto_auto]" : "sm:grid-cols-[1fr_auto_auto_auto_auto]"}`}
        >
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-text-3">Every AI seat, every dollar, every person — with a twin you can ask.</p>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-text">Product</div>
            <Link href="/#how" className="block hover:text-text">How it works</Link>
            <Link href="/#free" className="block hover:text-text">Free, with your own keys</Link>
            {websiteOnly && <Link href={DEMO_PATH} className="block hover:text-text">Live demo</Link>}
            <Link href="/#download" className="block hover:text-text">Run it yourself</Link>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-text">Trust</div>
            <Link href="/security" className="block hover:text-text">Security &amp; privacy</Link>
            <Link href="/docs/storage-api" className="block hover:text-text">Storage API</Link>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-text">Open source</div>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="block hover:text-text">GitHub repository</a>
            <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className="block hover:text-text">Install guide</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="block hover:text-text">⭐ Star on GitHub</a>
            <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer" className="block hover:text-text">Report an issue</a>
          </div>
          {!websiteOnly && (
            <div className="space-y-2">
              <div className="font-medium text-text">Account</div>
              <Link href="/sign-in" className="block hover:text-text">Sign in</Link>
              <Link href="/sign-up" className="block hover:text-text">Create account</Link>
            </div>
          )}
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-text-3 sm:px-6">
          © {new Date().getFullYear()} Digital Twin · Free and open source under the{" "}
          <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className="underline">MIT license</a>, made by{" "}
          <a href="https://github.com/hardcore-normalized" target="_blank" rel="noopener noreferrer" className="underline">hardcore-normalized</a>. Claude is a trademark of
          Anthropic; Digital Twin is an independent project and is not affiliated with Anthropic.
        </div>
      </footer>
    </div>
  );
}
