"use client";
import { RecoveryCard } from "@/components/recovery-card";
export default function ErrorPage({ retry }: { retry: () => void }) { return <main className="min-h-screen bg-white px-5 py-16"><RecoveryCard retry={retry} /></main>; }
