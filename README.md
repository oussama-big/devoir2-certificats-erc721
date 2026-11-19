@"
# Devoir 2 — Certificats ERC-721 (Environnement 100 % Local)

Projet Master **IDIA** (FST Tanger) — Encadrante : **Pr. Ikram Ben Abdel Ouahab**.

## Stack & exécution locale
- **Contrat :** Solidity `0.8.34`, Hardhat (`http://127.0.0.1:8545`, `chainId 31337`), OpenZeppelin (`ERC721URIStorage`, `AccessControl`, `ReentrancyGuard`).
- **Frontend :** React, Vite, TypeScript, Ethers v6 (`JsonRpcProvider` + `Wallet` local).

### Commandes
- Terminal 1 : ``npx hardhat node``
- Terminal 2 : ``npx hardhat run scripts/deploy.ts --network localhost``
- Tests : ``npx hardhat test``
- Frontend : ``cd frontend && npm install && npm run dev``
"@ | Out-File -FilePath README.md -Encoding utf8