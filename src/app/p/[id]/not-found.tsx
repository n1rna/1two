import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PasteNotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-20">
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold">Paste not found</p>
        <p className="text-sm text-muted-foreground">
          This paste may have been deleted or the link is incorrect.
        </p>
      </div>
      <Link
        href="/tools/paste"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Go to Paste Bin
      </Link>
    </div>
  );
}
