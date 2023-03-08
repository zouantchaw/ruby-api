import { ThirdwebStorage } from "@thirdweb-dev/storage";
import { NextApiRequest, NextApiResponse } from "next";
import { NFTStorage } from "nft.storage";
import { z } from "zod";

// Upload Directory Schema
const UploadCollectionSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  description: z.any().optional(),
  max_supply: z.number(),
  logo: z.string().url(),
  banner: z.string().url(),
  socials: z.object({
    website: z.any().optional(),
    twitter: z.any().optional(),
    instagram: z.any().optional(),
  }).optional(),
  metadata: z.array(
    z.object({
      name: z.string(),
      token_id: z.number(),
      description: z.string(),
      external_url: z.string().url(),
    })
  ),
});

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
    console.log("Invalid parameters");
    res.status(400).json({
      response: "NOK",
      error: {
        status_code: 400,
        code: "invalid_parameters",
        message: `Invalid required parameter: ${errorPath}`,
      },
    });
    res.end();
    return;
  }
  console.log("Valid parameters");

  const { method, body } = req;
  const { name, symbol, max_supply, description, metadata } = body;
  console.log("Collection Info:", name, symbol, max_supply, description);
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
        files.push({ ...body, metadata: undefined });

        // Iterate through the metadata array
        // For each object:
        // 1. Upload the content at external_url to IPFS
        // 2. Spread the object and add the image property using the contentCid
        // 3. Push the object to the files array
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
          name,
          symbol,
          max_supply,
        });
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
