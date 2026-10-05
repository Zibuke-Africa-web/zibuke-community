import { loadSpaces } from "./data";
import { SpacesDirectory } from "./views";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spaces | Zibuke Community" };

export default async function SpacesPage() {
  const data = await loadSpaces();
  return <SpacesDirectory {...data} />;
}
