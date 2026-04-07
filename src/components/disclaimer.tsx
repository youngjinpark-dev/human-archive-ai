import { DISCLAIMER_TEXT } from "@/lib/store-constants";

export default function Disclaimer({ text = DISCLAIMER_TEXT }: { text?: string }) {
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
      <span className="text-amber-500 mt-0.5 shrink-0">⚠️</span>
      <p>{text}</p>
    </div>
  );
}
