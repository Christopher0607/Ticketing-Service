import Link from "next/link";
import { Empty } from "./ui";
export default function NotFound() {
  return <div className="shell page"><Empty title="This page is unavailable"><Link href="/events" className="button primary">Explore events</Link></Empty></div>;
}
