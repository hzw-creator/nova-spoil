// Owner: Agent C — "/" sends you to the stage view
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/stage");
}
