import prismadb from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { pinecone } from "@/lib/pinecone";
import { getUserSubscriptionPlan } from "@/lib/stripe";
import { PLANS } from "@/config/stripe";

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
    .middleware(async ({ req }) => {
      const { getUser } = getKindeServerSession();
      const user = getUser();

      if (!user || !user.id) throw new Error("Unauthorized");

      const subscriptionPlan = await getUserSubscriptionPlan();

      return { userId: user.id, subscriptionPlan };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const newFile = await prismadb.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url: `https://uploadthing-prod.s3.us-west-2.amazonaws.com/${file.key}`,
          uploadStatus: "PROCESSING",
        },
      });
      try {
        const response = await fetch(
          `https://uploadthing-prod.s3.us-west-2.amazonaws.com/${file.key}`
        );
        const blob = await response.blob();

        const loader = new PDFLoader(blob);

        const pageLevelDocs = await loader.load();
        const pageAmt = pageLevelDocs.length;

        const { subscriptionPlan } = metadata;
        const { isSubscribed } = subscriptionPlan;

        const isProExceeded =
          pageAmt > PLANS.find((plan) => plan.name === "Pro")!.pagesPerPdf;
        const isFreeExceeded =
          pageAmt > PLANS.find((plan) => plan.name === "Free")!.pagesPerPdf;

        if (
          (isSubscribed && isProExceeded) ||
          (!isSubscribed && isFreeExceeded)
        ) {
          await prismadb.file.update({
            data: {
              uploadStatus: "FAILED",
            },
            where: {
              id: newFile.id,
            },
          });
        }

        const pineconeIndex = pinecone.Index("query-master");
        const embeddings = new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY,
        });

        await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
          pineconeIndex,
        });
        await prismadb.file.update({
          where: {
            id: newFile.id,
          },
          data: {
            uploadStatus: "SUCCESS",
          },
        });
      } catch (error) {
        console.log(error);

        await prismadb.file.update({
          where: {
            id: newFile.id,
          },
          data: {
            uploadStatus: "FAILED",
          },
        });
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
