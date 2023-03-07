import { DeployEvent, ThirdwebSDK } from "@thirdweb-dev/sdk";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

const PRIVATE_KEY: any = process.env.ETHOS_ETHEREUM_DEPLOYER_PRIVATE_KEY;

// Product Contract Schema
const ProductContractSchema = z.object({
  chain: z.string(),
  name: z.string(),
  symbol: z.string(),
  description: z.string(),
  logo: z.string(),
  banner: z.string(),
  socials: z.object({
    website: z.string(),
    twitter: z.string(),
    instagram: z.string(),
  }),
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
  const checkRequiredParams = ProductContractSchema.safeParse(req.body);
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
  const { chain, name, symbol, description, logo, banner, socials } = body;
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
  let supportedChains: string[];
  let thirdweb: any;
  let deployer: any;
  switch (method) {
    case "POST":
      // Check if the chain is supported
      supportedChains = ["mumbai", "goerli"];
      if (!supportedChains.includes(chain)) {
        console.log("Unsupported chain");
        res.status(400).json({
          response: "NOK",
          error: {
            status_code: 400,
            code: "unsupported_chain",
            message: `Unsupported chain: ${chain}`,
          },
        });
        res.end();
        break;
      }
      console.log("Supported chain");

      // Initialize thirdweb SDK using the private key and chain
      thirdweb = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, `${chain}`);
      deployer = thirdweb.deployer;

      try {
        console.log("Deploying contract...");
        // Define callback function to handle deploy event
        const onDeploy = async (event: DeployEvent) => {
          console.log(`Contract deployment: ${event.status}`);
          //  Only send response when status is `submitted`
          if (event.status === "completed") {
            // Remove deploy listener
            deployer.removeDeployListener(onDeploy);
            res.status(200).json({
              response: "OK",
              chain,
              contract_address: event.contractAddress,
              transaction_hash: event.transactionHash,
              etherscan_url: `${blockExplorerUrl(chain)}/${
                event.transactionHash
              }`,
              // contract_address: event.contractAddress || "",
              name,
              symbol,
            });
          }
        };

        // Add deploy listener to the deployer
        deployer.addDeployListener(onDeploy);

        // Deploy NFT collection contract
        await deployer.deployNFTCollection({
          name,
          symbol,
          description,
          image: logo,
          primary_sale_recipient:
            process.env.ETHOS_ETHEREUM_DEPLOYER_ADDRESS || "",
        });
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
