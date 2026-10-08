"use client";
import { RecoveryCard } from "@/components/recovery-card";
export default function PlatformError({ retry }: { retry: () => void }) { return <RecoveryCard retry={retry} />; }
