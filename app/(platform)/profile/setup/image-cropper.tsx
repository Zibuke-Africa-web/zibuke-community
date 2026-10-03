"use client";

import { useEffect, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Crop as CropIcon, Loader2, X } from "lucide-react";

const OUTPUT_SIZE = 512;
const JPEG_QUALITY = 0.85;

type ImageCropperProps = {
  source: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
};

export function ImageCropper({
  source,
  onCancel,
  onConfirm,
}: ImageCropperProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [working, setWorking] = useState(false);

  useEffect(() => {
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = event.currentTarget;

    setCrop(
      centerCrop(
        makeAspectCrop({ unit: "%", width: 80 }, 1, width, height),
        width,
        height,
      ),
    );
  }

  function handleConfirm() {
    const image = imageRef.current;
    const context = document.createElement("canvas").getContext("2d");

    if (!image || !crop || !context) {
      return;
    }

    setWorking(true);

    const bounds = image.getBoundingClientRect();
    const pixelCrop = convertToPixelCrop(crop, bounds.width, bounds.height);
    const scaleX = image.naturalWidth / bounds.width;
    const scaleY = image.naturalHeight / bounds.height;

    const canvas = context.canvas;
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    context.imageSmoothingQuality = "high";

    context.drawImage(
      image,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );

    canvas.toBlob(
      (blob) => {
        setWorking(false);

        if (blob) {
          onConfirm(blob);
        }
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-cropper-title"
        tabIndex={-1}
        className="flex w-full max-w-xl flex-col rounded-xl bg-white shadow-lg outline-none"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2
            id="image-cropper-title"
            className="text-base font-semibold text-gray-900"
          >
            Crop your photo
          </h2>
          <button
            type="button"
            aria-label="Cancel cropping"
            onClick={onCancel}
            className="grid size-11 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="flex justify-center bg-gray-100 p-4">
          <ReactCrop
            crop={crop}
            onChange={(nextCrop) => setCrop(nextCrop)}
            aspect={1}
            circularCrop
            keepSelection
            ruleOfThirds
          >
            <img
              ref={imageRef}
              src={source}
              alt="Photo selected for cropping"
              onLoad={handleImageLoad}
              className="max-h-[55vh] w-auto"
            />
          </ReactCrop>
        </div>

        <p className="px-5 pt-3 text-xs text-gray-500">
          Drag the circle to frame your photo. It saves as a square 1:1 JPEG at{" "}
          {OUTPUT_SIZE}
          {"\u00d7"}
          {OUTPUT_SIZE}.
        </p>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!crop || working}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {working ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <CropIcon aria-hidden="true" className="size-4" />
            )}
            Use this photo
          </button>
        </div>
      </div>
    </div>
  );
}
