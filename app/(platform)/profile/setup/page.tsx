import type { Metadata } from "next";
import { ProfileSetupForm } from "./profile-setup-form";

export const metadata: Metadata = {
  title: "Profile setup · Zibuke Community",
  description: "Fill out your Zibuke Community profile.",
};

export default function ProfileSetupPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          Set up your profile
        </h1>
        <p className="max-w-[68ch] text-sm leading-relaxed text-gray-600">
          Three steps: who you are, what you look like, and where else to find
          you.
        </p>
      </header>

      <ProfileSetupForm />
    </div>
  );
}
