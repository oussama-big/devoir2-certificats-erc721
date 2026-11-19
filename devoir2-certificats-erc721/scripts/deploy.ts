import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  const [deployer, minter] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("CertificateERC721");
  const contract = await Factory.deploy(deployer.address, minter.address);
  await contract.waitForDeployment();

  console.log("CertificateERC721 déployé à :", await contract.getAddress());
  console.log("Admin (DEFAULT_ADMIN_ROLE) :", deployer.address);
  console.log("Minter (MINTER_ROLE)       :", minter.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});