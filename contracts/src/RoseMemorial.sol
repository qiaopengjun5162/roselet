// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract RoseMemorial is ERC721 {
    error EmptyMessage();
    error MessageTooLong();
    error InvalidColor();

    uint256 public nextTokenId = 1;
    mapping(uint256 tokenId => string message) private messages;
    mapping(uint256 tokenId => uint8 color) private colors;

    event RoseMemorialMinted(
        uint256 indexed tokenId,
        bytes32 indexed roseId,
        address indexed recipient,
        bytes32 messageHash,
        uint8 color
    );

    constructor() ERC721("Roselet Memorial", "ROSE") {}

    function mint(bytes32 roseId, string calldata message, uint8 color) external returns (uint256 tokenId) {
        if (bytes(message).length == 0) revert EmptyMessage();
        if (bytes(message).length > 600) revert MessageTooLong();
        if (color > 2) revert InvalidColor();

        tokenId = nextTokenId++;
        messages[tokenId] = message;
        colors[tokenId] = color;
        _safeMint(msg.sender, tokenId);

        emit RoseMemorialMinted(tokenId, roseId, msg.sender, keccak256(bytes(message)), color);
    }

    function memorial(uint256 tokenId) external view returns (string memory message, uint8 color) {
        _requireOwned(tokenId);
        return (messages[tokenId], colors[tokenId]);
    }
}
