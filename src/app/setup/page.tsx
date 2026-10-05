import { Suspense } from "react";
import { SetupForm } from "@/components/SetupForm";

export default function SetupPage() {
  return (
    <Suspense>
      <SetupForm />
    </Suspense>
  );
}
