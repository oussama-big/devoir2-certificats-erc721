// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CertificateERC721 is ERC721URIStorage, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct CertificateData {
        string studentId;
        string recipientName; // nom du titulaire
        uint256 issuedAt;
        bool revoked;
        bool exists;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => CertificateData) private _certificates;
    mapping(bytes32 => bool) private _mintedStudentHashes;

    event CertificateMinted(
        uint256 indexed tokenId,
        address indexed to,
        string studentId,
        string tokenURI
    );
    event CertificateRevoked(uint256 indexed tokenId, address indexed revokedBy);

    constructor(address admin, address minter) ERC721("AcademicCertificate", "CERT") {
        require(admin != address(0), "Invalid admin address");
        require(minter != address(0), "Invalid minter address");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    function mintCertificate(
        address to,
        string calldata studentId,
        string calldata recipientName,
        string calldata uri
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256) {
        require(to != address(0), "Recipient is zero address");
        require(bytes(studentId).length > 0, "Empty studentId");
        require(bytes(uri).length > 0, "Empty tokenURI");

        bytes32 studentHash = keccak256(bytes(studentId));
        require(!_mintedStudentHashes[studentHash], "Duplicate studentId");

        _mintedStudentHashes[studentHash] = true;
        uint256 tokenId = _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        _certificates[tokenId] = CertificateData({
            studentId: studentId,
            recipientName: recipientName,
            issuedAt: block.timestamp,
            revoked: false,
            exists: true
        });

        emit CertificateMinted(tokenId, to, studentId, uri);
        return tokenId;
    }

    function batchMintCertificates(
        address[] calldata to,
        string[] calldata uris
    ) external onlyRole(MINTER_ROLE) nonReentrant {
        require(to.length == uris.length, "Array length mismatch");
        require(to.length > 0, "Empty batch");

        for (uint256 i = 0; i < to.length; i++) {
            require(to[i] != address(0), "Recipient is zero address");
            require(bytes(uris[i]).length > 0, "Empty tokenURI");

            uint256 tokenId = _nextTokenId++;
            _safeMint(to[i], tokenId);
            _setTokenURI(tokenId, uris[i]);

            _certificates[tokenId] = CertificateData({
                studentId: "",
                recipientName: "",
                issuedAt: block.timestamp,
                revoked: false,
                exists: true
            });

            emit CertificateMinted(tokenId, to[i], "", uris[i]);
        }
    }

    function revokeCertificate(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_certificates[tokenId].exists, "Certificate does not exist");
        require(!_certificates[tokenId].revoked, "Already revoked");

        _certificates[tokenId].revoked = true;
        emit CertificateRevoked(tokenId, msg.sender);
    }

    function getCertificate(uint256 tokenId)
        external
        view
        returns (
            string memory studentId,
            string memory recipientName,
            uint256 issuedAt,
            bool revoked,
            string memory uri
        )
    {
        require(_certificates[tokenId].exists, "Certificate does not exist");
        CertificateData memory cert = _certificates[tokenId];
        return (cert.studentId, cert.recipientName, cert.issuedAt, cert.revoked, tokenURI(tokenId));
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}