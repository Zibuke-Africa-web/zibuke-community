"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { uploadMedia } from "@/app/actions";

export function FeedComposer() {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined, input: HTMLInputElement) {
    if (!file) {
      return;
    }

    setUploading(true);
    setStatus(null);

    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadMedia(formData);

    input.value = "";
    setUploading(false);
    setStatus(
      result.ok
        ? { tone: "success", text: "Photo uploaded." }
        : { tone: "error", text: result.error ?? "That upload did not go through." },
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <label htmlFor="composer-body" className="sr-only">
        Write a post
      </label>
      <textarea
        id="composer-body"
        name="body"
        rows={2}
        placeholder="What are you working on?"
        className="w-full resize-none rounded-md bg-gray-100 px-3 py-2.5 text-sm text-gray-900 transition-colors placeholder:text-gray-500 hover:bg-gray-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-brand-600"
      />

      <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3">
        <button
          type="button"
          aria-label="Add a photo"
          onClick={() => fileInput.current?.click()}
          className="grid size-11 place-items-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          {uploading ? (
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          ) : (
            <Camera aria-hidden="true" className="size-5" />
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) =>
            handleFile(event.target.files?.[0], event.currentTarget)
          }
        />
        {status ? (
          <p
            role="status"
            className={`text-xs ${
              status.tone === "error" ? "text-red-700" : "text-gray-500"
            }`}
          >
            {status.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
