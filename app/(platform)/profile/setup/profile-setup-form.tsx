"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Save,
  UserRound,
} from "lucide-react";
import { updateProfile, uploadMedia } from "@/app/actions";

const steps = ["About you", "Photos", "Links"] as const;

const fieldClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600";

const labelClass = "text-sm font-medium text-gray-700";

type PhotoKind = "profile" | "cover";

export function ProfileSetupForm() {
  const [step, setStep] = useState(0);
  const [profileKey, setProfileKey] = useState("");
  const [coverKey, setCoverKey] = useState("");
  const [profilePreview, setProfilePreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [uploading, setUploading] = useState<PhotoKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const profileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function handleUpload(
    kind: PhotoKind,
    input: HTMLInputElement,
    file: File | undefined,
  ) {
    if (!file) {
      return;
    }

    setUploading(kind);
    setStatus(null);

    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadMedia(formData);

    input.value = "";
    setUploading(null);

    if (!result.ok || !result.key) {
      setStatus({
        tone: "error",
        text: result.error ?? "That upload did not go through.",
      });
      return;
    }

    if (kind === "profile") {
      setProfileKey(result.key);
      setProfilePreview((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return URL.createObjectURL(file);
      });
    } else {
      setCoverKey(result.key);
      setCoverPreview((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return URL.createObjectURL(file);
      });
    }

    setStatus({ tone: "success", text: "Photo uploaded." });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    const result = await updateProfile(new FormData(event.currentTarget));

    setSaving(false);
    setStatus(
      result.ok
        ? { tone: "success", text: "Profile saved." }
        : { tone: "error", text: result.error ?? "Could not save your profile." },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="profilePictureUrl" value={profileKey} />
      <input type="hidden" name="coverPhotoUrl" value={coverKey} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <h2 className="font-semibold text-gray-900">{steps[step]}</h2>
          <span className="text-gray-500">
            Step {step + 1} of {steps.length}
          </span>
        </div>
        <ol className="flex gap-2">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full ${
                index <= step ? "bg-brand-600" : "bg-gray-200"
              }`}
            />
          ))}
        </ol>
      </div>

      {status ? (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-sm ${
            status.tone === "error"
              ? "bg-red-50 text-red-700"
              : "bg-brand-50 text-brand-700"
          }`}
        >
          {status.text}
        </p>
      ) : null}

      {step === 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bio" className={labelClass}>
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={4}
              placeholder="What are you building, and what do you want help with?"
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="location" className={labelClass}>
                Location
              </label>
              <input
                id="location"
                name="location"
                placeholder="City, country"
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className={labelClass}>
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Optional"
                className={fieldClass}
              />
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className={labelClass}>Cover photo</span>
            <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
              {coverPreview ? (
                <Image
                  src={coverPreview}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <ImagePlus aria-hidden="true" className="size-6 text-gray-400" />
              )}
              <button
                type="button"
                aria-label="Choose a cover photo"
                onClick={() => coverInput.current?.click()}
                className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-white text-gray-700 shadow-sm transition-colors hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                {uploading === "cover" ? (
                  <Loader2 aria-hidden="true" className="size-5 animate-spin" />
                ) : (
                  <Camera aria-hidden="true" className="size-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelClass}>Profile photo</span>
            <div className="flex items-center gap-4">
              <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-600 text-lg font-semibold text-white">
                {profilePreview ? (
                  <Image
                    src={profilePreview}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <UserRound aria-hidden="true" className="size-7" />
                )}
              </span>
              <button
                type="button"
                onClick={() => profileInput.current?.click()}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                {uploading === "profile" ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Camera aria-hidden="true" className="size-4" />
                )}
                {profileKey ? "Replace photo" : "Add photo"}
              </button>
            </div>
          </div>

          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) =>
              handleUpload("cover", event.currentTarget, event.target.files?.[0])
            }
          />
          <input
            ref={profileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) =>
              handleUpload(
                "profile",
                event.currentTarget,
                event.target.files?.[0],
              )
            }
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="facebookUrl" className={labelClass}>
              Facebook
            </label>
            <input
              id="facebookUrl"
              name="facebookUrl"
              placeholder="https://facebook.com/..."
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="instagramUrl" className={labelClass}>
              Instagram
            </label>
            <input
              id="instagramUrl"
              name="instagramUrl"
              placeholder="https://instagram.com/..."
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tiktokUrl" className={labelClass}>
              TikTok
            </label>
            <input
              id="tiktokUrl"
              name="tiktokUrl"
              placeholder="https://tiktok.com/@..."
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="website" className={labelClass}>
              Website
            </label>
            <input
              id="website"
              name="website"
              placeholder="https://..."
              className={fieldClass}
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Back
        </button>

        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((current) => current + 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Continue
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            Save profile
          </button>
        )}
      </div>
    </form>
  );
}
