import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function AvatarUpload({
  userId,
  value,
  onChange,
  displayName,
}: {
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  displayName?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const initials = (displayName || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${userId}/avatar.${ext || "jpg"}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upErr) throw upErr;
      // 1-year signed URL — bucket is private (workspace blocks public buckets).
      const { data: signed, error: sErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed) throw sErr ?? new Error("Couldn't sign URL");
      onChange(signed.signedUrl);
      toast.success("Avatar updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative w-16 h-16 rounded-2xl bg-[#ebe2d5] border-2 border-dashed border-[#bdaf9c] flex items-center justify-center overflow-hidden hover:bg-[#e2d8ca] transition-colors disabled:opacity-60"
        aria-label="Upload avatar"
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : displayName ? (
          <span className="text-sm font-bold text-[#5a5346]">{initials}</span>
        ) : (
          <Camera className="w-5 h-5 text-[#7a7164]" />
        )}
        {busy && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
      </button>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-xs font-bold uppercase tracking-wider text-[#2d2a26] hover:underline disabled:opacity-50"
          >
            {value ? "Change" : "Upload"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={busy}
              className="text-xs text-[#a23b2b] hover:underline inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#7a7164]">PNG or JPG, up to 5 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}