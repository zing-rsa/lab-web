import { Home } from "@/components/Home";
import { getRepoStars } from "@/lib/github";

export default async function Page() {
  const stars = await getRepoStars();
  return <Home stars={stars} />;
}
