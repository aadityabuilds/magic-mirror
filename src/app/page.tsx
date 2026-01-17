import { Suspense } from "react"
import { HomeClient } from "@/components/home-client"

export default function Page() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen" />}>
      <HomeClient />
    </Suspense>
  )
}
