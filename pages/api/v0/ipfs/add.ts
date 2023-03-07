import { NextApiRequest, NextApiResponse } from "next";
import { NFTStorage } from "nft.storage";

interface ApiRequest extends NextApiRequest {
  body: {
    file_url: string;
  };
}

const handler = async (
  req: ApiRequest,
  res: NextApiResponse<{ pinContent: string } | { error: string }>
) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") res.status(405).end();

  console.log("NFT_STORAGE_API_KEY: ", typeof process.env.NFT_STORAGE_API_KEY)

  try {
    const nftStorageClient = new NFTStorage({
      token: process.env.NFT_STORAGE_API_KEY as string,
    });
    const { file_url } = req.body;
    console.log(`File URL: ${file_url}`);
    const fileName = file_url.split("/").pop();
    console.log(`Pinning file: ${fileName}`);
    const getFileContent = await fetch(file_url);
    console.log(`File content: ${getFileContent}`);
    const blob = await getFileContent.blob();
    console.log(`Blob: ${blob}`);
    const pinContent = await nftStorageClient.storeBlob(blob);
    console.log(`Pin content: ${pinContent}`);

    return res.status(200).json({ pinContent });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "failed to pin data" });
  }
};

export default handler;
