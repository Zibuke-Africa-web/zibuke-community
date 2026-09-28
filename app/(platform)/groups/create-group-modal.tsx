"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { createGroup } from "@/app/actions";

const fieldClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600";

const optionClass =
  "flex cursor-pointer items-start gap-3 rounded-md border border-gray-300 px-3 py-2.5 text-sm transition-colors has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50";

export function CreateGroupModal() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    nameInput.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const result = await createGroup(new FormData(event.currentTarget));

    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? "Could not create the group.");
      return;
    }

    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
      >
        <Plus aria-hidden="true" className="size-4" />
        Create group
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-group-title"
            className="w-full max-w-lg rounded-xl bg-white shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2
                id="create-group-title"
                className="text-base font-semibold text-gray-900"
              >
                Create group
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="grid size-11 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 px-5 py-4"
            >
              {error ? (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="group-name"
                  className="text-sm font-medium text-gray-700"
                >
                  Group name
                </label>
                <input
                  ref={nameInput}
                  id="group-name"
                  name="name"
                  required
                  minLength={3}
                  placeholder="e.g. Secunda AI Creators"
                  className={fieldClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="group-description"
                  className="text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="group-description"
                  name="description"
                  rows={3}
                  placeholder="What is this group for, and who should join?"
                  className={fieldClass}
                />
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-gray-700">
                  Privacy
                </legend>
                <label className={optionClass}>
                  <input
                    type="radio"
                    name="privacy"
                    value="public"
                    defaultChecked
                    className="mt-0.5 size-4 accent-brand-600"
                  />
                  <span>
                    <span className="block font-medium text-gray-900">
                      Public
                    </span>
                    <span className="block text-xs text-gray-500">
                      Anyone can see who is in the group and what they post.
                    </span>
                  </span>
                </label>
                <label className={optionClass}>
                  <input
                    type="radio"
                    name="privacy"
                    value="private"
                    className="mt-0.5 size-4 accent-brand-600"
                  />
                  <span>
                    <span className="block font-medium text-gray-900">
                      Private
                    </span>
                    <span className="block text-xs text-gray-500">
                      Only members can see who is in the group and what they
                      post.
                    </span>
                  </span>
                </label>
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-gray-700">
                  Visibility
                </legend>
                <label className={optionClass}>
                  <input
                    type="radio"
                    name="visibility"
                    value="visible"
                    defaultChecked
                    className="mt-0.5 size-4 accent-brand-600"
                  />
                  <span>
                    <span className="block font-medium text-gray-900">
                      Visible
                    </span>
                    <span className="block text-xs text-gray-500">
                      Anyone can find this group in search.
                    </span>
                  </span>
                </label>
                <label className={optionClass}>
                  <input
                    type="radio"
                    name="visibility"
                    value="hidden"
                    className="mt-0.5 size-4 accent-brand-600"
                  />
                  <span>
                    <span className="block font-medium text-gray-900">
                      Hidden
                    </span>
                    <span className="block text-xs text-gray-500">
                      Only members can find this group in search.
                    </span>
                  </span>
                </label>
              </fieldset>

              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : null}
                  Create group
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
