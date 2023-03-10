import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ThirdwebStorage } from "@thirdweb-dev/storage";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

const PRIVATE_KEY: any = process.env.ETHOS_ETHEREUM_DEPLOYER_PRIVATE_KEY;

// Collection NFT Schema
const CollectionNftSchema = z.object({
  chain: z.string().refine((value) => {
    return ["mumbai", "goerli"].includes(value);
  }),
  contract_address: z.string().refine((value) => {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  }),
  metadata_uri: z.string().url(),
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
  const checkRequiredParams = CollectionNftSchema.safeParse(req.body);
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
  const { chain, contract_address, metadata_uri } = body;
  const blockExplorerUrl = (chain: string) => {
    switch (chain) {
      case "mumbai":
        return "https://mumbai.polygonscan.com/tx";
      case "polygon":
        return "https://polygonscan.com/tx";
      case "mainnet":
        return "https://etherscan.io/tx";
      case "goerli":
        return "https://goerli.etherscan.io/tx";
      default:
        return "https://etherscan.io/tx";
    }
  };
  console.log("body: ", body);

  let thirdweb: any;
  let contract: any;
  let storage: any;
  switch (method) {
    case "POST":
      try {
        // Initialize thirdweb SDK using the private key and chain
        thirdweb = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, `${chain}`);
        contract = await thirdweb.getContract(contract_address);
        // Initialize thirdweb storage
        storage = new ThirdwebStorage();

        // Download the metadata from metadata_uri
        const metadata = await storage.downloadJSON(metadata_uri);
        console.log("metadata: ", metadata);

        // Mint the NFT
        const mintTx = await contract.erc721.mint(metadata);
        const mintReceipt = await mintTx.receipt;
        console.log("txHash: ", mintReceipt.transactionHash);
        const tokenId = mintTx.id;
        console.log("tokenId: ", tokenId);
        const nft = await mintTx.data();
        console.log("nft: ", nft);
        res.status(200).json({
          response: "OK",
          chain,
          contract_address,
          transaction_hash: mintReceipt.transactionHash,
transaction_external_url: `${blockExplorerUrl(chain)}/${
            mintReceipt.transactionHash
          }`,
          mint_to_address: nft.owner,
          token_id: nft.metadata.id,
          metadata_uri: nft.metadata.uri,
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
