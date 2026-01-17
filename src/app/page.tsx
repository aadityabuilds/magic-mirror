import { HomeClient } from "@/components/home-client";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen" />}>
      <HomeClient />
    </Suspense>
  );
}
