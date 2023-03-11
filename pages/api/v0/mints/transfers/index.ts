import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ThirdwebStorage } from "@thirdweb-dev/storage";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

const PRIVATE_KEY: any = process.env.ETHOS_ETHEREUM_DEPLOYER_PRIVATE_KEY;

// Product NFT Schema
const TransferNftSchema = z.object({
  chain: z.string().refine((value) => {
    return ["mumbai", "goerli"].includes(value);
  }),
  contract_address: z.string().refine((value) => {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  }),
  token_id: z.number(),
  transfer_to_address: z.string(),
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
  const checkRequiredParams = TransferNftSchema.safeParse(req.body);
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
  const { chain, contract_address, token_id, transfer_to_address } = body;
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

  console.log("method: ", method);
  let thirdweb: any;
  let contract: any;
  switch (method) {
    case "POST":

      try {
        // Initialize thirdweb SDK using the private key and chain
        thirdweb = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, `${chain}`);
        contract = await thirdweb.getContract(contract_address);
        
        // Transfer NFT
        const transferTx = await contract.erc721.transfer(transfer_to_address, token_id);
        const transferReceipt = await transferTx.receipt;
        console.log("transferReceipt: ", transferReceipt);

        res.status(200).json({
          response: "OK",
          chain,
          transaction_hash: transferReceipt.transactionHash,
          transaction_external_url: `${blockExplorerUrl(chain)}/${
            transferReceipt.transactionHash
          }`,
          transfer_to_address,
          token_id,
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
