// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CertificateERC721 is ERC721URIStorage, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Certificate {
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
        address recipient;
        uint256 issuedAt;
        bool revoked;
        bool exists;
    }

    struct MintInput {
        address to;
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
        string uri;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => Certificate) private _certificates;
    mapping(bytes32 => bool) private _mintedStudentHashes;

    event CertificateMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        string studentId,
        string studentName,
        string diplomaTitle,
        string issueDate,
        string grade,
        string uri
    );

    event CertificateRevoked(uint256 indexed tokenId, address indexed revokedBy);

    constructor(address defaultAdmin, address minter) ERC721("AcademicCertificate", "CERT") {
        require(defaultAdmin != address(0), "Invalid admin address");
        require(minter != address(0), "Invalid minter address");

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
    }

    function mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade,
        string calldata uri
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256) {
        return _mintSingle(
            MintInput({
                to: to,
                studentName: studentName,
                studentId: studentId,
                diplomaTitle: diplomaTitle,
                issueDate: issueDate,
                grade: grade,
                uri: uri
            })
        );
    }

    function batchMint(
        address[] calldata recipients,
        string[] calldata studentNames,
        string[] calldata studentIds,
        string[] calldata diplomaTitles,
        string[] calldata issueDates,
        string[] calldata grades,
        string[] calldata uris
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256[] memory mintedIds) {
        require(recipients.length > 0, "Empty batch");
        require(
            recipients.length == studentNames.length &&
            recipients.length == studentIds.length &&
            recipients.length == diplomaTitles.length &&
            recipients.length == issueDates.length &&
            recipients.length == grades.length &&
            recipients.length == uris.length,
            "Array lengths mismatch"
        );

        mintedIds = new uint256[](recipients.length);
        for (uint256 i = 0; i < recipients.length; i++) {
            mintedIds[i] = _mintSingle(
                MintInput({
                    to: recipients[i],
                    studentName: studentNames[i],
                    studentId: studentIds[i],
                    diplomaTitle: diplomaTitles[i],
                    issueDate: issueDates[i],
                    grade: grades[i],
                    uri: uris[i]
                })
            );
        }
    }

    function revoke(uint256 certId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeInternal(certId);
    }

    function revokeCertificate(uint256 certId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeInternal(certId);
    }

    function _revokeInternal(uint256 certId) internal {
        require(_certificates[certId].exists, "Certificate does not exist");
        require(!_certificates[certId].revoked, "Already revoked");

        _certificates[certId].revoked = true;
        emit CertificateRevoked(certId, msg.sender);
    }

    function getCertificate(uint256 certId) external view returns (Certificate memory) {
        require(_certificates[certId].exists, "Certificate does not exist");
        return _certificates[certId];
    }

    function isStudentIdMinted(string calldata studentId) external view returns (bool) {
        return _mintedStudentHashes[keccak256(bytes(studentId))];
    }

    function _mintSingle(MintInput memory input) internal returns (uint256 tokenId) {
        require(input.to != address(0), "Invalid recipient address");
        require(bytes(input.studentName).length > 0, "Empty studentName");
        require(bytes(input.studentId).length > 0, "Empty studentId");
        require(bytes(input.diplomaTitle).length > 0, "Empty diplomaTitle");
        require(bytes(input.issueDate).length > 0, "Empty issueDate");
        require(bytes(input.uri).length > 0, "Empty URI");

        bytes32 studentKey = keccak256(bytes(input.studentId));
        require(!_mintedStudentHashes[studentKey], "Duplicate studentId");

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _mintedStudentHashes[studentKey] = true;
        _certificates[tokenId] = Certificate({
            studentName: input.studentName,
            studentId: input.studentId,
            diplomaTitle: input.diplomaTitle,
            issueDate: input.issueDate,
            grade: input.grade,
            recipient: input.to,
            issuedAt: block.timestamp,
            revoked: false,
            exists: true
        });

        _safeMint(input.to, tokenId);
        _setTokenURI(tokenId, input.uri);

        emit CertificateMinted(
            tokenId,
            input.to,
            input.studentId,
            input.studentName,
            input.diplomaTitle,
            input.issueDate,
            input.grade,
            input.uri
        );
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