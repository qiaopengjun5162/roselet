// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RoseMemorial} from "../src/RoseMemorial.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract RoseMemorialTest is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function testMintStoresPublicMemorial() external {
        RoseMemorial memorial = new RoseMemorial();
        bytes32 roseId = bytes32(uint256(42));

        uint256 tokenId = memorial.mint(roseId, "Keep growing", 0);
        (string memory message, uint8 color) = memorial.memorial(tokenId);

        require(tokenId == 1, "unexpected token id");
        require(memorial.ownerOf(tokenId) == address(this), "unexpected owner");
        require(keccak256(bytes(message)) == keccak256(bytes("Keep growing")), "missing message");
        require(color == 0, "missing color");
    }

    function testRoseletCanVerifyOneOfficialMintWithoutBlockingTheWallet() external {
        RoseMemorial memorial = new RoseMemorial();
        bytes32 roseId = bytes32(uint256(42));
        uint256 firstTokenId = memorial.mint(roseId, "Keep growing", 0);
        uint256 secondTokenId = memorial.mint(roseId, "A second memory", 0);

        require(firstTokenId == 1, "unexpected first token id");
        require(secondTokenId == 2, "unexpected second token id");
    }
}
