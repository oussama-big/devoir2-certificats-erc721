import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("CertificateERC721", function () {
  async function deployFixture() {
    const [deployer, minter, otherAccount, student1, student2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("CertificateERC721");
    const contract = await Factory.deploy(deployer.address, minter.address);
    await contract.waitForDeployment();

    return { contract, deployer, minter, otherAccount, student1, student2 };
  }

  it("1. Doit permettre le mint d'un certificat avec MINTER_ROLE et émettre CertificateMinted", async function () {
    const { contract, minter, student1 } = await deployFixture();

    const tx = await contract
      .connect(minter)
      .mintCertificate(
        student1.address,
        "STU-2026-001",
        "Oussama Bizg",
        "ipfs://QmExampleCert1"
      );

    await expect(tx)
      .to.emit(contract, "CertificateMinted")
      .withArgs(0n, student1.address, "STU-2026-001", "ipfs://QmExampleCert1");

    expect(await contract.ownerOf(0n)).to.equal(student1.address);
    expect(await contract.tokenURI(0n)).to.equal("ipfs://QmExampleCert1");

    const cert = await contract.getCertificate(0n);
    expect(cert[0]).to.equal("STU-2026-001");
    expect(cert[1]).to.equal("Oussama Bizg");
    expect(cert[3]).to.equal(false); // revoked
  });

  it("2. Doit refuser le mint et le revoke si l'appelant n'a pas le rôle requis", async function () {
    const { contract, minter, otherAccount, student1 } = await deployFixture();

    await expect(
      contract
        .connect(otherAccount)
        .mintCertificate(student1.address, "STU-2026-002", "Test", "ipfs://QmCert2")
    ).to.be.revert(ethers);

    await contract
      .connect(minter)
      .mintCertificate(student1.address, "STU-2026-002", "Test", "ipfs://QmCert2");

    // minter n'a pas DEFAULT_ADMIN_ROLE pour révoquer
    await expect(contract.connect(minter).revokeCertificate(0n)).to.be.revert(ethers);
    await expect(contract.connect(otherAccount).revokeCertificate(0n)).to.be.revert(ethers);
  });

it("3. Doit bloquer le double mint pour un même studentId", async function () {
    const { contract, minter, student1, student2 } = await deployFixture();

    await contract
      .connect(minter)
      .mintCertificate(student1.address, "STU-DUP-01", "Etudiant A", "ipfs://QmDup1");

    await expect(
      contract
        .connect(minter)
        .mintCertificate(student2.address, "STU-DUP-01", "Etudiant B", "ipfs://QmDup2")
    ).to.be.revert(ethers);
  });

  it("4. Doit exécuter le batchMintCertificates pour plusieurs destinataires", async function () {
    const { contract, minter, student1, student2 } = await deployFixture();

    const recipients = [student1.address, student2.address];
    const uris = ["ipfs://QmBatch1", "ipfs://QmBatch2"];

    await contract.connect(minter).batchMintCertificates(recipients, uris);

    expect(await contract.ownerOf(0n)).to.equal(student1.address);
    expect(await contract.ownerOf(1n)).to.equal(student2.address);
    expect(await contract.tokenURI(0n)).to.equal("ipfs://QmBatch1");
    expect(await contract.tokenURI(1n)).to.equal("ipfs://QmBatch2");
  });

  it("5. Doit révoquer un certificat avec DEFAULT_ADMIN_ROLE et émettre CertificateRevoked", async function () {
    const { contract, deployer, minter, student1 } = await deployFixture();

    await contract
      .connect(minter)
      .mintCertificate(student1.address, "STU-REV-01", "Etudiant Rev", "ipfs://QmRev1");

    const tx = await contract.connect(deployer).revokeCertificate(0n);

    await expect(tx)
      .to.emit(contract, "CertificateRevoked")
      .withArgs(0n, deployer.address);

    const cert = await contract.getCertificate(0n);
    expect(cert[3]).to.equal(true); // revoked
  });
});