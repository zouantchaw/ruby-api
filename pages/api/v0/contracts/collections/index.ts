import { DeployEvent, ThirdwebSDK } from "@thirdweb-dev/sdk";
import { ThirdwebStorage } from "@thirdweb-dev/storage";
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
  socials: z.any().optional(),
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
    res.status(400).json({
      response: "NOK",
      error: {
        status_code: 400,
        code: "invalid_parameters",
        message: `Invalid required parameter: ${errorPath}`,
      },
    });
    console.log(`Invalid required parameter: ${errorPath}`);
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
    const storage = new ThirdwebStorage();


    // Define callback function to handle deploy event
    const onDeploy = async (event: DeployEvent) => {
      console.log(`Contract deployment: ${event.status}`);
      //  Only send response when status is `submitted`
      if (event.status === "completed") {
        // Mint NFT 0
        console.log("Minting NFT 0");
        const nftZeroMetadata = {
          name: "ethos",
          description: "Introduce your customers to digital assets",
          image: "https://bafybeibo4rsume3fylomred4gzwhqgxvk7tuvjm2lfktm76zcapcgl2wcm.ipfs.nftstorage.link/4c51a148-ec18-4e75-9f53-38481186aeee.png",
        };
        const contract = await thirdweb.getContract(event.contractAddress as string);
        const mintTx = await contract.erc721.mint(nftZeroMetadata);
        const mintReceipt = await mintTx.receipt;
        console.log("txHash: ", mintReceipt.transactionHash);
        const tokenId = mintTx.id;
        console.log(`Minted NFT : ${tokenId}`);

        // Send NFT 0 to burn address
        const burnAddress = "0x000000000000000000000000000000000000dEaD";
        console.log(`Sending NFT 0 to burn address: ${burnAddress}`);
        const sendTx = await contract.call("safeTransferFrom", "0x429505F06cf1214dC5d03C335cF4632B314ecb6C", burnAddress, tokenId);
        console.log("burnTx: ", sendTx);

        // Burn NFT 0
        // console.log("Burning NFT 0");
        // const result = await contract.erc721.burn(0);
        // console.log("burn result: ", result);
        // console.log(`Successfully burned NFT 0`);

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
        });
      }
    };

    // Add deploy listener to the deployer
    deployer.addDeployListener(onDeploy);

    // Deploy NFT collection contract
    // await deployer.deployNFTCollection({
    //   name,
    //   symbol,
    //   description,
    //   image: logo,
    //   primary_sale_recipient: process.env.ETHOS_ETHEREUM_DEPLOYER_ADDRESS || "",
    // });
    await deployer.deployBuiltInContract("nft-collection", {
      // Required parameters
      name, 
      primary_sale_recipient: "0x429505F06cf1214dC5d03C335cF4632B314ecb6C",

      // Optional parameters
      description,
      symbol,
    })
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
