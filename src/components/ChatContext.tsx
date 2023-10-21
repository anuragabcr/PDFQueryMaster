import { ReactNode, createContext, useRef, useState } from "react";
import { useToast } from "./ui/use-toast";
import { useMutation } from "@tanstack/react-query";
import { trpc } from "@/app/_trpc/client";

type StreamResponse = {
  addMessage: () => void;
  message: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
};

export const ChatContext = createContext<StreamResponse>({
  addMessage: () => {},
  message: "",
  handleInputChange: () => {},
  isLoading: false,
});

interface Props {
  fileId: string;
  children: ReactNode;
}

export const ChatContextProvider = ({ fileId, children }: Props) => {
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const utils = trpc.useContext();

  const backupMsg = useRef("");

  const { toast } = useToast();

  const { mutate: sendMessage } = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      const response = await fetch("/api/message", {
        method: "POST",
        body: JSON.stringify({
          fileId,
          message,
        }),
      });
      if (!response.ok) throw new Error("Failed to send Message");
      return response.body;
    },
    onMutate: async ({ message }) => {
      backupMsg.current = message;
      setMessage("");

      await utils.getFileMessages.cancel();
      const prevMsg = utils.getFileMessages.getInfiniteData();
      utils.getFileMessages.setInfiniteData({ fileId, limit: 10 }, (old) => {
        if (!old) {
          return {
            pages: [],
            pageParams: [],
          };
        }
        let newPages = [...old.pages];
        let latestPage = newPages[0]!;
        latestPage.messages = [
          {
            createdAt: new Date().toISOString(),
            id: crypto.randomUUID(),
            text: message,
            isUserMessage: true,
          },
          ...latestPage.messages,
        ];
        newPages[0] = latestPage;
        return { ...old, pages: newPages };
      });
      setIsLoading(true);
      return {
        previousMessages: prevMsg?.pages.flatMap((page) => page.messages) ?? [],
      };
    },
    onError: (_, __, context) => {
      setMessage(backupMsg.current);
      utils.getFileMessages.setData(
        { fileId },
        { messages: context?.previousMessages ?? [] }
      );
    },
    onSettled: async () => {
      setIsLoading(false);
      await utils.getFileMessages.invalidate({ fileId });
    },
    onSuccess: async (stream) => {
      setIsLoading(false);

      if (!stream) {
        return toast({
          title: "Something went wrong...",
          description: "Refresh the page & try again",
          variant: "destructive",
        });
      }
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accRes = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        accRes += chunkValue;

        utils.getFileMessages.setInfiniteData({ fileId, limit: 10 }, (old) => {
          if (!old) return { pages: [], pageParams: [] };

          let isAiResponseCreated = old.pages.some((page) =>
            page.messages.some((message) => message.id === "ai-response")
          );

          let updatedPages = old.pages.map((page) => {
            if (page === old.pages[0]) {
              let updatedMessages;

              if (!isAiResponseCreated) {
                updatedMessages = [
                  {
                    createdAt: new Date().toISOString(),
                    id: "ai-response",
                    text: accRes,
                    isUserMessage: false,
                  },
                  ...page.messages,
                ];
              } else {
                updatedMessages = page.messages.map((message) => {
                  if (message.id === "ai-response") {
                    return {
                      ...message,
                      text: accRes,
                    };
                  }
                  return message;
                });
              }

              return {
                ...page,
                messages: updatedMessages,
              };
            }

            return page;
          });

          return { ...old, pages: updatedPages };
        });
      }
    },
  });

  const addMessage = () => sendMessage({ message });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  return (
    <ChatContext.Provider
      value={{
        addMessage,
        message,
        handleInputChange,
        isLoading,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
