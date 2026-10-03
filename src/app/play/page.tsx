import { Suspense } from "react";
import { Game } from "@/components/game/Game";

export const metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <Suspense>
      <Game />
    </Suspense>
  );
}
