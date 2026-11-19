import { network } from "hardhat";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

async function main() {
  const { ethers } = await network.create();
  // Account #1 possède MINTER_ROLE ; Account #3 et Account #4 recevront les certificats
  const [, minter, , student1, student2] = await ethers.getSigners();

  const contract = await ethers.getContractAt("CertificateERC721", CONTRACT_ADDRESS, minter);

  const recipients = [student1.address, student2.address];
  const uris = [
    "ipfs://QmCertificatBatch01",
    "ipfs://QmCertificatBatch02",
  ];

  const tx = await contract.batchMintCertificates(recipients, uris);
  const receipt = await tx.wait();

  console.log("Batch mint réussi ! Tx hash :", receipt?.hash);

  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "CertificateMinted") {
        console.log(
          `Émis -> tokenId: ${parsed.args.tokenId.toString()} | to: ${parsed.args.to} | uri: ${parsed.args.tokenURI}`
        );
      }
    } catch {
      // Ignorer les autres logs
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});