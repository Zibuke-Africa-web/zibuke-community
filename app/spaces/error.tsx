"use client";

import { RecoveryCard } from "@/components/recovery-card";
export default function SpacesError({ retry }: { retry: () => void }) { return <RecoveryCard retry={retry} />; }
