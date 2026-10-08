import { siteConfig } from "@/site.config";

const REVALIDATE_SECONDS = 3600;
const REQUEST_TIMEOUT_MS = 8000;

/** Star count for `siteConfig.repo`; null when GitHub is unreachable so the badge is just omitted. */
export async function getRepoStars(): Promise<number | null> {
  const repoPath = new URL(siteConfig.repo).pathname;
  try {
    const res = await fetch(`https://api.github.com/repos${repoPath}`, {
      // GitHub's API rejects requests without a User-Agent.
      headers: { Accept: "application/vnd.github+json", "User-Agent": "lab-web" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { stargazers_count?: number };
    return json.stargazers_count ?? null;
  } catch {
    return null;
  }
}
