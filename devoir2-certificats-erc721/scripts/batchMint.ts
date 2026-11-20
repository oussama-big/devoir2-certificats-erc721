import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create({ network: "localhost" });

  const contractAddress = ethers.getAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3");
  const signers = await ethers.getSigners();
  const minter = signers[1]; // 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (MINTER_ROLE)

  const contract = await ethers.getContractAt("CertificateERC721", contractAddress, minter);

  const recipients = [
    ethers.getAddress("0x90F79bf6EB2c4f870365E785982E1f101E93b906"),
    ethers.getAddress("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"),
  ];
  const studentNames = ["Amina Benali", "Youssef El Amrani"];
  const studentIds = ["2023-INF-042", "2023-INF-043"];
  const diplomaTitles = ["Licence Informatique", "Master IDIA"];
  const issueDates = ["2026-06-15", "2026-06-20"];
  const grades = ["Mention Bien", "Très Bien"];
  const uris = [
    "ipfs://QmCertificat2023INF042",
    "ipfs://QmCertificat2023INF043",
  ];

  const tx = await contract.batchMint(
    recipients,
    studentNames,
    studentIds,
    diplomaTitles,
    issueDates,
    grades,
    uris
  );
  const receipt = await tx.wait();

  console.log("Batch mint réussi ! Tx hash :", receipt?.hash ?? tx.hash);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});