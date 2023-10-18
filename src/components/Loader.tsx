import { Loader2 } from "lucide-react";
import React from "react";

export const Loader = ({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) => {
  return (
    <div className="flex-1 flex justify-center items-center flex-col mb-28">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <h3 className="font-semibold text-xl">{title || "Loading..."}</h3>
        <p className="text-zinc-500 text-sm">{subtitle || "We're preparing"}</p>
      </div>
    </div>
  );
};
