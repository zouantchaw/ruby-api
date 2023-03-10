import { ThirdwebStorage } from "@thirdweb-dev/storage";
import { NextApiRequest, NextApiResponse } from "next";
import { NFTStorage } from "nft.storage";
import { z } from "zod";

// Upload Directory Schema
const UploadCollectionSchema = z.object({
  metadata: z.array(
    z.object({
      name: z.string(),
      token_id: z.number(),
      description: z.any().optional(),
      external_url: z.string().url(),
    })
  ),
});

const checkAssetVariations = (metadata: any) => {
  const externalUrls = metadata.map((asset: any) => {
    return asset.external_url;
  });
  const fileNames = externalUrls.map((url: any) => {
    const fileName = url.split("/").pop();
    return fileName;
  });
  const isSame = fileNames.every((fileName: any) => {
    return fileName === fileNames[0];
  });

  return !isSame;
};

export default async function (req: NextApiRequest, res: NextApiResponse) {
  // Set the CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  // Check if the API key is valid
  const apiKey = req.headers["authorization"];
  if (!apiKey || apiKey !== process.env.SERVER_AUTH_TOKEN) {
    console.log("Invalid API key");
    res.status(401).json({
      response: "NOK",
      error: {
        status_code: 401,
        message: "Invalid Authorization Token",
        code: "invalid_authorization_token",
      },
    });
    res.end();
    return;
  }
  console.log("Valid API key");

  // Check body against schema
  // Validate the request body
  const checkRequiredParams = UploadCollectionSchema.safeParse(req.body);
  if (!checkRequiredParams.success) {
    const errorPath = checkRequiredParams.error.issues[0].path[0];
    res.status(400).json({
      response: "NOK",
      error: {
        status_code: 400,
        code: "invalid_parameters",
        message: `Invalid required parameter: ${errorPath}`,
      },
    });
    console.log(`Invalid required parameter: ${errorPath}`);
    console.log(checkRequiredParams.error);
    res.end();
    return;
  }
  console.log("Valid parameters");

  const { method, body } = req;
  const { metadata } = body;
  const nftStorageClient = new NFTStorage({
    token: process.env.NFT_STORAGE_API_KEY as string,
  });
  let storage: any;
  let deployer: any;
  switch (method) {
    case "POST":
      // Initialize thirdweb storage
      storage = new ThirdwebStorage();
      try {
        const files = [];

        // Push the collection info to the files array
        // spread everything from the body except the metadata
        // files.push({ ...body, metadata: undefined });

        // Check if the assets have variations
        if (checkAssetVariations(metadata)) {
          // If the assets have variations
          // Iterate through the metadata array
          // For each object:
          // 1. Upload the content at external_url to IPFS
          // 2. Spread the object and add the image property using the contentCid
          // 3. Push the object to the files array
          console.log("Assets have variations");
          for (let i = 0; i < metadata.length; i++) {
            const { external_url } = metadata[i];
            const response = await fetch(external_url);
            const file = await response.blob();
            const contentCid = await nftStorageClient.storeBlob(file);
            const fileObj = {
              ...metadata[i],
              image: `https://ipfs.io/ipfs/${contentCid}`,
            };
            files.push(fileObj);
          }
        } else {
          // If the assets don't have variations
          // Iterate through the metadata array
          // For each object:
          // 1. Only upload the content at external_url of the first object to IPFS
          // 2. Spread the object and add the image property using the contentCid
          // 3. Push the object to the files array
          console.log("Assets don't have variations");
          const { external_url } = metadata[0];
          const response = await fetch(external_url);
          const file = await response.blob();
          const contentCid = await nftStorageClient.storeBlob(file);
          for (let i = 0; i < metadata.length; i++) {
            const fileObj = {
              ...metadata[i],
              image: `https://ipfs.io/ipfs/${contentCid}`,
            };
            files.push(fileObj);
          }
        }
        console.log("Files: ", files);

        const uris = await storage.uploadBatch(files);
        const baseCid = uris[0].split("/")[2];
        console.log("Base CID: ", baseCid);
        const baseUri = `https://gateway.ipfscdn.io/ipfs/${baseCid}`;
        console.log("Base URI: ", baseUri);

        res.status(200).json({
          response: "OK",
          base_uri: baseUri,
          base_cid: baseCid,
        });
        console.log("Collection URI:", baseUri);
        res.end();
      } catch (error) {
        res.status(500).json({
          response: "NOK",
          error: {
            status_code: 500,
            code: "internal_server_error",
            message: `${error}`,
          },
        });
        res.end();
      }
      break;
    default:
      res.setHeader("Allow", ["POST"]);
      res.status(405).json({
        response: "NOK",
        error: {
          status_code: 405,
          code: "method_not_allowed",
          message: `Method ${method} Not Allowed`,
        },
      });
      res.end();
  }
}
