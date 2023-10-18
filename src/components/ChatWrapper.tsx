"use client";

import React from "react";
import Message from "./Message";
import ChatInput from "./ChatInput";
import { trpc } from "@/app/_trpc/client";
import { ArrowLeftIcon, Loader2, XCircle } from "lucide-react";
import { Loader } from "./Loader";
import Link from "next/link";
import { buttonVariants } from "./ui/button";

const ChatWrapper = ({ fileId }: { fileId: string }) => {
  const { data, isLoading } = trpc.getFileUploadStatus.useQuery(
    { fileId },
    {
      refetchInterval: (data) =>
        data?.status === "SUCCESS" || data?.status === "FAILED" ? false : 1000,
    }
  );

  if (isLoading)
    return (
      <div className="relative min-h-full bg-zinc-50 flex divide-y divide-zinc-200 flex-col justify-between gap-2">
        <Loader title="Loading..." subtitle="We're preparing your PDF." />
        <ChatInput isDisabled />
      </div>
    );

  if (data?.status === "PROCESSING")
    return (
      <div className="relative min-h-full bg-zinc-50 flex divide-y divide-zinc-200 flex-col justify-between gap-2">
        <Loader title="Processing PDF ..." subtitle="This won't take long." />
        <ChatInput isDisabled />
      </div>
    );

  if (data?.status === "FAILED")
    return (
      <div className="relative min-h-full bg-zinc-50 flex divide-y divide-zinc-200 flex-col justify-between gap-2">
        <div className="flex-1 flex justify-center items-center flex-col mb-28">
          <div className="flex flex-col items-center gap-2">
            <XCircle className="h-8 w-8 text-red-500" />
            <h3 className="font-semibold text-xl">Too many pages in PDF</h3>
            <p className="text-zinc-500 text-sm">
              Your <span className="font-medium">Free</span> plan supports up to
              5 pages per PDF.
            </p>
            <Link
              href={"/dashboard"}
              className={buttonVariants({
                variant: "secondary",
                className: "mt-4",
              })}
            >
              <ArrowLeftIcon className="h-3 w-3 mr-1.5" />
              Back
            </Link>
          </div>
        </div>
        <ChatInput isDisabled />
      </div>
    );

  return (
    <div className="relative min-h-full bg-zinc-50 flex divide-y divide-zinc-200 flex-col justify-between gap-2">
      <div className="flex-1 justify-between flex flex-col mb-28">
        <Message />
      </div>
      <ChatInput isDisabled={false} />
    </div>
  );
};

export default ChatWrapper;
