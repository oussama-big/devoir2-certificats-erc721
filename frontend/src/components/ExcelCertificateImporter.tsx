import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Contract, getAddress, isAddress } from "ethers";

export interface StudentRow {
  id: number;
  selected: boolean;
  studentName: string;
  studentId: string;
  diplomaTitle: string;
  issueDate: string;
  recipientAddress: string;
  grade: string;
  uri: string;
}

interface Props {
  signer: any;
  contractAddress: string;
  abi: any;
  defaultRecipient?: string;
}

export const ExcelCertificateImporter: React.FC<Props> = ({
  signer,
  contractAddress,
  abi,
  defaultRecipient = "",
}) => {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setErrorMsg("");
    setStatusMsg("");
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: "",
      });

      const parsedRows: StudentRow[] = rawJson.map((item, idx) => {
        const studentName = String(item.studentName ?? "").trim();
        const studentId = String(item.studentId ?? item.studentid ?? "").trim();
        const diplomaTitle = String(item.diplomaTitle ?? "").trim();
        const issueDate = String(item.issueDate ?? "").trim();
        const recipientAddress = String(item.recipientAddress ?? "").trim();
        const grade = String(item.grade ?? "").trim();
        const uri =
          String(item.uri ?? item.tokenURI ?? "").trim() ||
          `ipfs://cert-${studentId || idx + 1}`;

        return {
          id: idx,
          selected: Boolean(studentName && studentId && diplomaTitle && issueDate),
          studentName,
          studentId,
          diplomaTitle,
          issueDate,
          recipientAddress,
          grade,
          uri,
        };
      });

      setRows(parsedRows);
      setStatusMsg(`${parsedRows.length} ligne(s) chargée(s) depuis "${file.name}".`);
    } catch (err: any) {
      setErrorMsg(`Erreur de lecture Excel/CSV : ${err?.message ?? "fichier invalide"}`);
    }
  }

  function toggleRow(id: number) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  }

  function toggleAll(checked: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  }

  function validateSelected(selectedRows: StudentRow[]) {
    if (selectedRows.length === 0) {
      throw new Error("Sélectionne au moins une ligne à émettre.");
    }
    if (selectedRows.length > 15) {
      throw new Error(
        "Limite recommandée : 15 certificats maximum par lot pour éviter un dépassement de gas."
      );
    }

    for (const r of selectedRows) {
      const targetAddr = r.recipientAddress || defaultRecipient;
      if (!targetAddr || !isAddress(targetAddr)) {
        throw new Error(
          `Adresse destinataire invalide pour ${r.studentName || r.studentId}.`
        );
      }
      if (!r.studentName || !r.studentId || !r.diplomaTitle || !r.issueDate) {
        throw new Error(`Champs obligatoires manquants sur la ligne ${r.id + 1}.`);
      }
    }
  }

  async function handleMintSelectedBatch() {
    setErrorMsg("");
    setStatusMsg("");
    try {
      if (!signer) {
        throw new Error("Charge d'abord un compte local possédant MINTER_ROLE.");
      }
      const selectedRows = rows.filter((r) => r.selected);
      validateSelected(selectedRows);

      setIsSubmitting(true);
      const contract = new Contract(contractAddress, abi, signer);

      const recipients = selectedRows.map((r) =>
        getAddress(r.recipientAddress || defaultRecipient)
      );
      const studentNames = selectedRows.map((r) => r.studentName);
      const studentIds = selectedRows.map((r) => r.studentId);
      const diplomaTitles = selectedRows.map((r) => r.diplomaTitle);
      const issueDates = selectedRows.map((r) => r.issueDate);
      const grades = selectedRows.map((r) => r.grade);
      const uris = selectedRows.map((r) => r.uri);

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

      setStatusMsg(
        `Lot émis (${selectedRows.length} certificats) — Tx Hash : ${
          receipt?.hash ?? tx.hash
        }`
      );
    } catch (err: any) {
      setErrorMsg(
        err?.reason || err?.shortMessage || err?.message || "Erreur lors de l'émission."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section style={{ marginTop: "0.75rem" }}>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        disabled={isSubmitting}
      />

      {statusMsg && <p style={{ color: "#065f46" }}>{statusMsg}</p>}
      {errorMsg && <p style={{ color: "#991b1b" }}>{errorMsg}</p>}

      {rows.length > 0 && (
        <>
          <div style={{ margin: "0.75rem 0", display: "flex", gap: "0.75rem" }}>
            <button type="button" onClick={() => toggleAll(true)} disabled={isSubmitting}>
              Tout sélectionner
            </button>
            <button type="button" onClick={() => toggleAll(false)} disabled={isSubmitting}>
              Tout désélectionner
            </button>
            <button
              type="button"
              onClick={handleMintSelectedBatch}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Émission en cours..." : "Émettre la sélection (batchMint)"}
            </button>
          </div>

          <table
            border={1}
            cellPadding={6}
            style={{ borderCollapse: "collapse", width: "100%" }}
          >
            <thead>
              <tr>
                <th>Émettre</th>
                <th>studentName</th>
                <th>studentId</th>
                <th>diplomaTitle</th>
                <th>issueDate</th>
                <th>recipientAddress</th>
                <th>grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={() => toggleRow(r.id)}
                      disabled={isSubmitting}
                    />
                  </td>
                  <td>{r.studentName}</td>
                  <td>{r.studentId}</td>
                  <td>{r.diplomaTitle}</td>
                  <td>{r.issueDate}</td>
                  <td>{r.recipientAddress || defaultRecipient}</td>
                  <td>{r.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
};