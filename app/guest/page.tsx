"use client";
import { useState } from "react";
import { WalkingNotebook } from "@/components/WalkingNotebook";
import { GUEST_OWNER, guestRequest } from "@/lib/guest-store";

export default function GuestPage() {
  const [, setSaving] = useState(false);
  const [, setDraft] = useState(false);
  return <main className="container appRoot walkingRoot">
    <WalkingNotebook owner={GUEST_OWNER} request={guestRequest} local onUnsavedChange={setDraft} onSavingChange={setSaving} />

  </main>;
}
