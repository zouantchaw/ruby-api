import { DeployEvent, ThirdwebSDK } from "@thirdweb-dev/sdk";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

const PRIVATE_KEY: any = process.env.ETHOS_ETHEREUM_DEPLOYER_PRIVATE_KEY;

// Product Contract Schema
const CollectionContractSchema = z.object({
  chain: z.string().refine((value) => {
    return ["mumbai", "goerli"].includes(value);
  }),
  name: z.string(),
  symbol: z.string(),
  max_supply: z.number(),
  description: z.string(),
  logo: z.string(),
  banner: z.string(),
  socials: z.object({
    website: z.string(),
    twitter: z.string(),
    instagram: z.string(),
  }),
});

export default async function handleCollectionContract(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
  const checkRequiredParams = CollectionContractSchema.safeParse(req.body);
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

  try {
    // Destructure the request body
    const {
      chain,
      name,
      symbol,
      description,
      logo,
      banner,
      socials,
      max_supply,
    } = req.body;
    console.log("chain: ", chain);
    // Resolve explorer URL
    // mumbai: https://mumbai.polygonscan.com/tx
    // polygon: https://polygonscan.com/tx
    // mainnet: https://etherscan.io/tx
    // goerli: https://goerli.etherscan.io/tx
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

    // Initialize thirdweb SDK using the private key and chain
    const thirdweb = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, `${chain}`);
    const deployer = thirdweb.deployer;

    // Define callback function to handle deploy event
    const onDeploy = async (event: DeployEvent) => {
      console.log(`Contract deployment: ${event.status}`);
      //  Only send response when status is `submitted`
      if (event.status === "completed") {
        // Set Contract metadata
        const contract = await thirdweb.getContract(event.contractAddress || "");
        await contract.metadata.set({
          name,
          description,
          symbol,
          max_supply,
          logo,
          banner,
        });
        console.log("Contract metadata set");
        // Get contract metadata
        const metadata = await contract.metadata.get();
        // Remove deploy listener
        deployer.removeDeployListener(onDeploy);
        res.status(200).json({
          response: "OK",
          chain,
          contract_address: event.contractAddress,
          transaction_hash: event.transactionHash,
transaction_external_url: `${blockExplorerUrl(chain)}/${
            event.transactionHash
          }`,
          contract_metadata: metadata,
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
      primary_sale_recipient: process.env.ETHOS_ETHEREUM_DEPLOYER_ADDRESS || "",
    });
  } catch (error: any) {
    // Handle errors
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || "Internal Server Error";
    const code = error.code || "internal_server_error";
    res.status(statusCode).json({
      response: "NOK",
      error: {
        status_code: statusCode,
        code,
        message: errorMessage,
      },
    });
  }
}
