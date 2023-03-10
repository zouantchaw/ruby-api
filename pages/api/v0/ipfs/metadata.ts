import { ThirdwebStorage } from "@thirdweb-dev/storage";
import { NextApiRequest, NextApiResponse } from "next";
import { NFTStorage } from "nft.storage";
import { z } from "zod";

// Upload Metadata Schema
const UploadMetadataSchema = z.object({
  name: z.string(),
  description: z.string(),
  external_url: z.string().url(),
  token_id: z.number(),
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
  const checkRequiredParams = UploadMetadataSchema.safeParse(req.body);
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
  const { name, description, external_url } = body;
  // Parse the file name from the URL: https://ipfs.ethosnft.com/chapter2bikes/preview-chapter2-bharms-koko-aero-frame.mp4
  const file_name = external_url.split("/").pop();
  console.log(`Pinning metadata asset: ${file_name}`);
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
        // Upload the content at external_url to IPFS
        const response = await fetch(external_url);
        const file = await response.blob();
        const contentCid = await nftStorageClient.storeBlob(file);
        console.log("file: ", file);

        // Upload the metadata to IPFS
        const uploadMetadata = await storage.upload({
          name: name,
          description: description,
          image: `https://ipfs.io/ipfs/${contentCid}`,
          external_url,
        });
        const metadataCid = uploadMetadata.replace("ipfs://", "");
        const metadataUri = await storage.resolveScheme(uploadMetadata);

        res.status(200).json({
          response: "OK",
          metadata_uri: metadataUri,
          metadata_cid: metadataCid,
          name,
        });
        res.end();
      } catch (error) {
        console.log("Error: ", error);
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
