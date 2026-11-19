import { useState } from "react";
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from "ethers";
import CertificateArtifact from "./abi/CertificateERC721.json";

const RPC_URL = "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Remplacer par ton adresse déployée
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
const MINTER_ROLE = keccak256(toUtf8Bytes("MINTER_ROLE"));

interface CertificateView {
  tokenId: string;
  studentId: string;
  recipientName: string;
  issuedAt: string;
  revoked: boolean;
  tokenURI: string;
  owner: string;
}

export default function App() {
  const [privateKey, setPrivateKey] = useState<string>("");
  const [account, setAccount] = useState<string>("");
  const [isMinter, setIsMinter] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [toAddress, setToAddress] = useState("");
  const [studentId, setStudentId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [tokenURI, setTokenURI] = useState("ipfs://QmCertificatLocal01");

  const [queryTokenId, setQueryTokenId] = useState("0");
  const [certDetails, setCertDetails] = useState<CertificateView | null>(null);

  function parseContractError(err: any): string {
    const raw = err?.reason || err?.shortMessage || err?.message || "Erreur inconnue";
    if (raw.includes("AccessControlUnauthorizedAccount") || raw.includes("missing role")) {
      return "Accès refusé : ce compte local ne possède pas le rôle requis (MINTER_ROLE ou DEFAULT_ADMIN_ROLE).";
    }
    if (raw.includes("Duplicate studentId")) {
      return "Erreur métier : un certificat a déjà été émis pour ce studentId.";
    }
    if (raw.includes("Certificate does not exist")) {
      return "Ce tokenId n'existe pas.";
    }
    if (raw.includes("Already revoked")) {
      return "Ce certificat est déjà révoqué.";
    }
    return raw;
  }

  function getProvider() {
    return new JsonRpcProvider(RPC_URL);
  }

  function getSigner() {
    if (!privateKey.trim()) {
      throw new Error("Entre une clé privée d'un compte Hardhat local.");
    }
    return new Wallet(privateKey.trim(), getProvider());
  }

  async function loadLocalAccount() {
    setErrorMsg("");
    setStatus("");
    try {
      const signer = getSigner();
      const addr = await signer.getAddress();
      setAccount(addr);

      const contract = new Contract(CONTRACT_ADDRESS, CertificateArtifact.abi, getProvider());
      setIsMinter(await contract.hasRole(MINTER_ROLE, addr));
      setIsAdmin(await contract.hasRole(DEFAULT_ADMIN_ROLE, addr));
      setStatus(`Compte local actif : ${addr}`);
    } catch (err) {
      setErrorMsg(parseContractError(err));
    }
  }

  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("Transaction de mint en cours sur le nœud local...");
    try {
      const signer = getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CertificateArtifact.abi, signer);
      const tx = await contract.mintCertificate(toAddress, studentId, recipientName, tokenURI);
      const receipt = await tx.wait();

      let mintedId = "?";
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === "CertificateMinted") {
            mintedId = parsed.args.tokenId.toString();
          }
        } catch {
          // Ignorer les autres logs
        }
      }

      setStatus(`Certificat émis ! tokenId = ${mintedId} | tokenURI = ${tokenURI}`);
      setQueryTokenId(mintedId);
    } catch (err) {
      setStatus("");
      setErrorMsg(parseContractError(err));
    }
  }

  async function handleFetchCertificate() {
    setErrorMsg("");
    try {
      const contract = new Contract(CONTRACT_ADDRESS, CertificateArtifact.abi, getProvider());
      const id = BigInt(queryTokenId);
      const [sId, rName, issuedAt, revoked, uri] = await contract.getCertificate(id);
      const owner = await contract.ownerOf(id);

      setCertDetails({
        tokenId: queryTokenId,
        studentId: sId,
        recipientName: rName,
        issuedAt: new Date(Number(issuedAt) * 1000).toLocaleString(),
        revoked,
        tokenURI: uri,
        owner,
      });
    } catch (err) {
      setCertDetails(null);
      setErrorMsg(parseContractError(err));
    }
  }

  async function handleRevoke() {
    setErrorMsg("");
    setStatus("Révocation en cours sur le nœud local...");
    try {
      const signer = getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CertificateArtifact.abi, signer);
      const tx = await contract.revokeCertificate(BigInt(queryTokenId));
      await tx.wait();
      setStatus(`Certificat #${queryTokenId} révoqué.`);
      await handleFetchCertificate();
    } catch (err) {
      setStatus("");
      setErrorMsg(parseContractError(err));
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "2rem auto", fontFamily: "sans-serif", padding: "0 1rem" }}>
      <h1>Gestion des Certificats ERC-721 (100 % Local - Sans MetaMask)</h1>

      <div style={{ padding: "1rem", border: "1px solid #ccc", borderRadius: 8, marginBottom: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Clé privée locale (depuis <code>npx hardhat node</code>) :
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="password"
            placeholder="0x..."
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" onClick={loadLocalAccount}>Charger le compte</button>
        </div>

        {account && (
          <div style={{ marginTop: "0.75rem" }}>
            <p><strong>Adresse :</strong> {account}</p>
            <p>
              <strong>Rôles :</strong>{" "}
              {isAdmin ? "DEFAULT_ADMIN_ROLE " : ""}
              {isMinter ? "MINTER_ROLE " : ""}
              {!isAdmin && !isMinter ? "Aucun rôle privilégié" : ""}
            </p>
          </div>
        )}
      </div>

      {status && <div style={{ padding: "0.75rem", background: "#e6ffed", border: "1px solid #34d058", marginBottom: "1rem" }}>{status}</div>}
      {errorMsg && <div style={{ padding: "0.75rem", background: "#ffeef0", border: "1px solid #d73a49", marginBottom: "1rem" }}>{errorMsg}</div>}

      <form onSubmit={handleMint} style={{ display: "grid", gap: "0.75rem", padding: "1rem", border: "1px solid #ccc", borderRadius: 8, marginBottom: "1.5rem" }}>
        <h2>Émettre un certificat (mintCertificate)</h2>
        <input placeholder="Adresse étudiant (0x...)" value={toAddress} onChange={(e) => setToAddress(e.target.value)} required />
        <input placeholder="Student ID (ex: STU-2026-001)" value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
        <input placeholder="Nom complet de l'étudiant" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required />
        <input placeholder="Token URI (ex: ipfs://...)" value={tokenURI} onChange={(e) => setTokenURI(e.target.value)} required />
        <button type="submit">Minter le certificat NFT</button>
      </form>

      <div style={{ padding: "1rem", border: "1px solid #ccc", borderRadius: 8 }}>
        <h2>Consulter ou Révoquer un certificat</h2>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <input type="number" min="0" value={queryTokenId} onChange={(e) => setQueryTokenId(e.target.value)} />
          <button type="button" onClick={handleFetchCertificate}>Consulter (getCertificate)</button>
          <button type="button" onClick={handleRevoke} style={{ background: "#d73a49", color: "white", border: "none", padding: "0.4rem 0.8rem" }}>
            Révoquer (Admin)
          </button>
        </div>

        {certDetails && (
          <div style={{ background: "#f6f8fa", padding: "1rem", borderRadius: 6 }}>
            <p><strong>tokenId :</strong> {certDetails.tokenId}</p>
            <p><strong>tokenURI :</strong> {certDetails.tokenURI}</p>
            <p><strong>Propriétaire (ownerOf) :</strong> {certDetails.owner}</p>
            <p><strong>Student ID :</strong> {certDetails.studentId}</p>
            <p><strong>Étudiant :</strong> {certDetails.recipientName}</p>
            <p><strong>Date d'émission :</strong> {certDetails.issuedAt}</p>
            <p><strong>Statut :</strong> {certDetails.revoked ? "RÉVOQUÉ" : "VALIDE"}</p>
          </div>
        )}
      </div>
    </div>
  );
}