import { useEffect, useMemo, useState } from "react";
import { Contract, JsonRpcProvider, Wallet, getAddress, isAddress } from "ethers";
import contractAbi from "./abi/CertificateERC721.json";
import { ExcelCertificateImporter } from "./components/ExcelCertificateImporter";

const RPC_URL = "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const LOCAL_ACCOUNTS = [
  {
    label: "Compte #0 — Admin (DEFAULT_ADMIN_ROLE)",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
  {
    label: "Compte #1 — Minter (MINTER_ROLE)",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey:
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
  {
    label: "Compte #2 — Étudiant / Autre",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    privateKey:
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  },
];

interface CertificateView {
  tokenId: string;
  studentName: string;
  studentId: string;
  diplomaTitle: string;
  issueDate: string;
  grade: string;
  recipient: string;
  owner: string;
  issuedAt: string;
  revoked: boolean;
  tokenURI: string;
}

export default function App() {
  const provider = useMemo(() => new JsonRpcProvider(RPC_URL), []);
  const [selectedAccountIdx, setSelectedAccountIdx] = useState<number>(1);
  const [chainId, setChainId] = useState<string>("");

  const activeAccount = LOCAL_ACCOUNTS[selectedAccountIdx];
  const signer = useMemo(
    () => new Wallet(activeAccount.privateKey, provider),
    [activeAccount, provider]
  );

  const [recipientAddress, setRecipientAddress] = useState<string>(
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
  );
  const [studentName, setStudentName] = useState<string>("Oussama Bizg");
  const [studentId, setStudentId] = useState<string>("IDIA-2026-001");
  const [diplomaTitle, setDiplomaTitle] = useState<string>("Master IDIA");
  const [issueDate, setIssueDate] = useState<string>("2026-11-20");
  const [grade, setGrade] = useState<string>("Très Bien");
  const [uri, setUri] = useState<string>("ipfs://QmCertificatIDIA2026001");

  const [lookupId, setLookupId] = useState<string>("0");
  const [certData, setCertData] = useState<CertificateView | null>(null);

  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    provider
      .getNetwork()
      .then((net) => setChainId(net.chainId.toString()))
      .catch(() => setChainId("déconnecté"));
  }, [provider]);

  function clearFeedback() {
    setStatusMessage("");
    setErrorMessage("");
  }

  async function handleSingleMint(e: React.FormEvent) {
    e.preventDefault();
    clearFeedback();
    try {
      const targetAddr = recipientAddress.trim() || activeAccount.address;
      if (!isAddress(targetAddr)) {
        throw new Error("Adresse destinataire invalide.");
      }
      if (
        !studentName.trim() ||
        !studentId.trim() ||
        !diplomaTitle.trim() ||
        !issueDate.trim() ||
        !uri.trim()
      ) {
        throw new Error("Veuillez remplir tous les champs obligatoires.");
      }

      setLoading(true);
      const contract = new Contract(CONTRACT_ADDRESS, contractAbi, signer);
      const tx = await contract.mintCertificate(
        getAddress(targetAddr),
        studentName.trim(),
        studentId.trim(),
        diplomaTitle.trim(),
        issueDate.trim(),
        grade.trim(),
        uri.trim()
      );
      const receipt = await tx.wait();

      let mintedTokenId = "";
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === "CertificateMinted") {
            mintedTokenId = parsed.args.tokenId.toString();
            break;
          }
        } catch {
          // Ignorer les autres logs
        }
      }

      setStatusMessage(
        `Certificat émis${mintedTokenId ? ` (ID #${mintedTokenId})` : ""} — Tx : ${
          receipt?.hash ?? tx.hash
        }`
      );
      if (mintedTokenId) {
        setLookupId(mintedTokenId);
      }
    } catch (err: any) {
      setErrorMessage(
        err?.reason || err?.shortMessage || err?.message || "Erreur lors du mint."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLookupCertificate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    clearFeedback();
    try {
      const idTrimmed = lookupId.trim();
      if (
        idTrimmed === "" ||
        Number.isNaN(Number(idTrimmed)) ||
        Number(idTrimmed) < 0
      ) {
        throw new Error(
          "Veuillez saisir un identifiant de certificat valide (ex. 0, 1, 2...)."
        );
      }

      setLoading(true);
      const readContract = new Contract(CONTRACT_ADDRESS, contractAbi, provider);
      const tokenIdBig = BigInt(idTrimmed);

      const [cert, currentOwner, currentUri] = await Promise.all([
        readContract.getCertificate(tokenIdBig),
        readContract.ownerOf(tokenIdBig),
        readContract.tokenURI(tokenIdBig),
      ]);

      const timestampSec = Number(cert.issuedAt ?? 0);
      const formattedDate =
        timestampSec > 0 ? new Date(timestampSec * 1000).toLocaleString("fr-FR") : "—";

      setCertData({
        tokenId: tokenIdBig.toString(),
        studentName: cert.studentName,
        studentId: cert.studentId,
        diplomaTitle: cert.diplomaTitle,
        issueDate: cert.issueDate,
        grade: cert.grade,
        recipient: cert.recipient,
        owner: currentOwner,
        issuedAt: formattedDate,
        revoked: Boolean(cert.revoked),
        tokenURI: currentUri,
      });
      setStatusMessage(`Certificat #${tokenIdBig.toString()} chargé.`);
    } catch (err: any) {
      setCertData(null);
      setErrorMessage(
        err?.reason || err?.shortMessage || err?.message || "Certificat introuvable."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRevokeCertificate(tokenIdStr: string) {
    clearFeedback();
    try {
      setLoading(true);
      const contract = new Contract(CONTRACT_ADDRESS, contractAbi, signer);
      const tx = await contract.revoke(BigInt(tokenIdStr));
      const receipt = await tx.wait();

      setStatusMessage(
        `Certificat #${tokenIdStr} révoqué — Tx : ${receipt?.hash ?? tx.hash}`
      );
      await handleLookupCertificate();
    } catch (err: any) {
      setErrorMessage(
        err?.reason ||
          err?.shortMessage ||
          err?.message ||
          "Révocation refusée (vérifiez DEFAULT_ADMIN_ROLE)."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "2rem auto",
        padding: "0 1rem",
        fontFamily: "sans-serif",
      }}
    >
      <h1>Plateforme de Certification Académique (ERC-721)</h1>
      <p>
        <strong>Réseau :</strong> {RPC_URL} (Chain ID : <code>{chainId || "..."}</code>) |{" "}
        <strong>Contrat :</strong> <code>{CONTRACT_ADDRESS}</code>
      </p>

      <section
        style={{
          border: "1px solid #ddd",
          padding: "1rem",
          borderRadius: 8,
          marginBottom: "1.5rem",
        }}
      >
        <h2>1. Compte Local Actif</h2>
        <select
          value={selectedAccountIdx}
          onChange={(e) => setSelectedAccountIdx(Number(e.target.value))}
          style={{ padding: "0.4rem", minWidth: 320 }}
        >
          {LOCAL_ACCOUNTS.map((acc, idx) => (
            <option key={acc.address} value={idx}>
              {acc.label}
            </option>
          ))}
        </select>
        <p style={{ marginTop: "0.5rem" }}>
          Adresse active : <code>{activeAccount.address}</code>
        </p>
      </section>

      {statusMessage && (
        <div
          style={{
            padding: "0.75rem",
            background: "#ecfdf5",
            color: "#065f46",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div
          style={{
            padding: "0.75rem",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          {errorMessage}
        </div>
      )}

      <section
        style={{
          border: "1px solid #ddd",
          padding: "1rem",
          borderRadius: 8,
          marginBottom: "1.5rem",
        }}
      >
        <h2>2. Émission Unitaire (MINTER_ROLE)</h2>
        <form
          onSubmit={handleSingleMint}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}
        >
          <label>
            Nom complet (studentName)
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              style={{ width: "100%", padding: "0.35rem" }}
            />
          </label>
          <label>
            Identifiant étudiant / CNE (studentId)
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              style={{ width: "100%", padding: "0.35rem" }}
            />
          </label>
          <label>
            Intitulé du diplôme (diplomaTitle)
            <input
              type="text"
              value={diplomaTitle}
              onChange={(e) => setDiplomaTitle(e.target.value)}
              style={{ width: "100%", padding: "0.35rem" }}
            />
          </label>
          <label>
            Date d'émission (issueDate)
            <input
              type="text"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              style={{ width: "100%", padding: "0.35rem" }}
            />
          </label>
          <label>
            Mention / note (grade)
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              style={{ width: "100%", padding: "0.35rem" }}
            />
          </label>
          <label>
            Adresse destinataire (recipientAddress)
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              style={{ width: "100%", padding: "0.35rem" }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            URI des métadonnées (tokenURI)
            <input
              type="text"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              style={{ width: "100%", padding: "0.35rem" }}
            />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" disabled={loading} style={{ padding: "0.5rem 1rem" }}>
              {loading ? "Traitement..." : "Émettre le certificat"}
            </button>
          </div>
        </form>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          padding: "1rem",
          borderRadius: 8,
          marginBottom: "1.5rem",
        }}
      >
        <h2>3. Import Excel / CSV & Émission par Lot</h2>
        <ExcelCertificateImporter
          signer={signer}
          contractAddress={CONTRACT_ADDRESS}
          abi={contractAbi}
          defaultRecipient={activeAccount.address}
        />
      </section>

      <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
        <h2>4. Consultation Publique & Révocation</h2>
        <form
          onSubmit={handleLookupCertificate}
          style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
        >
          <input
            type="number"
            min={0}
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="ID du certificat (ex. 0)"
            style={{ padding: "0.4rem", width: 200 }}
          />
          <button type="submit" disabled={loading} style={{ padding: "0.4rem 0.9rem" }}>
            Rechercher
          </button>
        </form>

        {certData && (
          <div
            style={{
              background: "#f9fafb",
              padding: "1rem",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
            }}
          >
            <p>
              <strong>Certificat #{certData.tokenId}</strong> — Statut :{" "}
              <strong style={{ color: certData.revoked ? "#b91c1c" : "#15803d" }}>
                {certData.revoked ? "RÉVOQUÉ" : "VALIDE"}
              </strong>
            </p>
            <ul style={{ lineHeight: 1.7 }}>
              <li>
                <strong>Étudiant :</strong> {certData.studentName} ({certData.studentId})
              </li>
              <li>
                <strong>Diplôme :</strong> {certData.diplomaTitle}
              </li>
              <li>
                <strong>Date d'émission :</strong> {certData.issueDate} (Bloc horodaté :{" "}
                {certData.issuedAt})
              </li>
              <li>
                <strong>Mention :</strong> {certData.grade || "—"}
              </li>
              <li>
                <strong>Destinataire initial :</strong> <code>{certData.recipient}</code>
              </li>
              <li>
                <strong>Propriétaire actuel :</strong> <code>{certData.owner}</code>
              </li>
              <li>
                <strong>URI :</strong> <code>{certData.tokenURI}</code>
              </li>
            </ul>

            {!certData.revoked && (
              <button
                type="button"
                onClick={() => handleRevokeCertificate(certData.tokenId)}
                disabled={loading}
                style={{
                  padding: "0.45rem 0.9rem",
                  background: "#fee2e2",
                  color: "#991b1b",
                  border: "1px solid #fca5a5",
                  borderRadius: 4,
                }}
              >
                Révoquer ce certificat (DEFAULT_ADMIN_ROLE)
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}